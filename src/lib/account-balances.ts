/**
 * Single source of truth for account balance recalculation.
 *
 * For each account computes two values from the transaction log:
 *   - balance:           sum of 'completed' transactions only (real cash moved)
 *   - balance_predicted: sum of 'completed' + 'pending' transactions (cancelled
 *                        is always excluded). Mobills-style "saldo previsto".
 *
 * Transactions categorised as "Ajuste de Saldo" still count (they represent
 * calibration entries the user explicitly created). They're filtered out of
 * income/expense pies elsewhere, but the running balance must include them.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

interface TxRow {
  account_id: string | null;
  transfer_to_account_id: string | null;
  type: string;
  amount: number;
  status?: string | null;
}

export interface AccountBalances {
  balance: number;
  balance_predicted: number;
}

/**
 * Computes the balance / balance_predicted pair for every account belonging
 * to `userId`, based on the current transaction log.
 */
export async function computeAccountBalances(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, AccountBalances>> {
  const { data: txs } = await supabase
    .schema("money_schema")
    .from("transactions")
    .select("account_id, transfer_to_account_id, type, amount, status")
    .eq("user_id", userId);

  const out = new Map<string, AccountBalances>();
  const ensure = (id: string): AccountBalances => {
    let cur = out.get(id);
    if (!cur) {
      cur = { balance: 0, balance_predicted: 0 };
      out.set(id, cur);
    }
    return cur;
  };

  for (const tx of (txs || []) as TxRow[]) {
    if (tx.status === "cancelled") continue;
    const amt = Number(tx.amount) || 0;
    const isCompleted = !tx.status || tx.status === "completed";

    if (tx.account_id) {
      const acc = ensure(tx.account_id);
      const delta =
        tx.type === "income" ? amt : tx.type === "expense" || tx.type === "transfer" ? -amt : 0;
      acc.balance_predicted += delta;
      if (isCompleted) acc.balance += delta;
    }
    if (tx.transfer_to_account_id && tx.type === "transfer") {
      const acc = ensure(tx.transfer_to_account_id);
      acc.balance_predicted += amt;
      if (isCompleted) acc.balance += amt;
    }
  }

  return out;
}

/**
 * Recomputes balances and persists them on `accounts.balance` and
 * `accounts.balance_predicted`. When `onlyAccountIds` is given, only those
 * rows are touched (faster); otherwise every account belonging to the user
 * is updated.
 */
export async function persistAccountBalances(
  supabase: SupabaseClient,
  userId: string,
  onlyAccountIds?: string[] | Set<string>
): Promise<void> {
  const balances = await computeAccountBalances(supabase, userId);
  const allowed = onlyAccountIds
    ? new Set(onlyAccountIds instanceof Set ? onlyAccountIds : onlyAccountIds)
    : null;

  // Make sure accounts that ended the period with zero are still updated
  // (e.g. a fully cancelled-out account).
  const { data: allAccounts } = allowed
    ? { data: null }
    : await supabase
        .schema("money_schema")
        .from("accounts")
        .select("id")
        .eq("user_id", userId);
  for (const row of (allAccounts || []) as { id: string }[]) {
    if (!balances.has(row.id)) balances.set(row.id, { balance: 0, balance_predicted: 0 });
  }

  await Promise.all(
    Array.from(balances.entries())
      .filter(([id]) => !allowed || allowed.has(id))
      .map(([id, { balance, balance_predicted }]) =>
        supabase
          .schema("money_schema")
          .from("accounts")
          .update({ balance, balance_predicted })
          .eq("id", id)
          .eq("user_id", userId)
      )
  );
}

/**
 * Convenience: returns the balance pair for a single account, computed but
 * NOT persisted. Useful for previews / response payloads.
 */
export async function getBalanceForAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string
): Promise<AccountBalances> {
  const all = await computeAccountBalances(supabase, userId);
  return all.get(accountId) ?? { balance: 0, balance_predicted: 0 };
}
