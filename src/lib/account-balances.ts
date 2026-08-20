/**
 * Single source of truth for account balance recalculation.
 *
 * For each account computes two values from the transaction log:
 *   - balance:           sum of 'completed' transactions only (real cash moved)
 *   - balance_predicted: balance + pending transactions whose date falls within
 *                        the CURRENT month. Matches Mobills' "Saldo Previsto"
 *                        — i.e. "what will the balance be at the end of this
 *                        month if every scheduled bill / income clears as
 *                        planned". Pending transactions beyond this month are
 *                        ignored to avoid a year of future bills inflating
 *                        the headline number.
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
  date?: string | null;
}

export interface AccountBalances {
  balance: number;
  balance_predicted: number;
}

function endOfCurrentMonthMaputoISO(): string {
  // Maputo is UTC+2 year-round (no DST). Adjust now to local before computing
  // the end of the current month.
  const nowLocal = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const y = nowLocal.getUTCFullYear();
  const m = nowLocal.getUTCMonth();
  // last day of current month = day 0 of next month
  const lastDay = new Date(Date.UTC(y, m + 1, 0));
  return lastDay.toISOString().split("T")[0]!;
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
    .select("account_id, transfer_to_account_id, type, amount, status, date")
    .eq("user_id", userId);

  const endOfMonth = endOfCurrentMonthMaputoISO();

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
    const isPending = tx.status === "pending";
    // Only pending transactions whose date is within the current month count
    // towards balance_predicted. Beyond that, they're forecast noise.
    const isPendingThisMonth = isPending && (tx.date ?? "") <= endOfMonth;
    const counts_for_predicted = isCompleted || isPendingThisMonth;

    if (tx.account_id) {
      const acc = ensure(tx.account_id);
      // income: +magnitude · expense: -magnitude · transfer: +amount SINALIZADO
      // (o valor de uma transferência já traz o sinal da direcção — entrada
      // positiva, saída negativa — por isso soma-se directamente).
      const delta =
        tx.type === "income"
          ? amt
          : tx.type === "expense"
            ? -amt
            : tx.type === "transfer"
              ? amt
              : 0;
      if (counts_for_predicted) acc.balance_predicted += delta;
      if (isCompleted) acc.balance += delta;
    }
    if (tx.transfer_to_account_id && tx.type === "transfer") {
      const acc = ensure(tx.transfer_to_account_id);
      if (counts_for_predicted) acc.balance_predicted += amt;
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

  // Persist each account's balance. We check the result of every UPDATE and
  // surface failures: previously these errors were silently dropped, so an
  // RLS / column / type problem would leave `accounts.balance` unchanged while
  // the import or "Acertar saldo" flow still reported success — the balance on
  // screen never moved. Now any write failure throws so the caller can report
  // the real cause instead of failing quietly.
  const results = await Promise.all(
    Array.from(balances.entries())
      .filter(([id]) => !allowed || allowed.has(id))
      .map(async ([id, { balance, balance_predicted }]) => {
        const { data, error } = await supabase
          .schema("money_schema")
          .from("accounts")
          .update({ balance, balance_predicted })
          .eq("id", id)
          .eq("user_id", userId)
          .select("id");
        return { id, error, rows: Array.isArray(data) ? data.length : 0 };
      })
  );

  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    throw new Error(
      "Não foi possível gravar o saldo das contas: " +
        failed.map((r) => r.error?.message ?? "erro desconhecido").join("; ")
    );
  }
  // An UPDATE that matched zero rows (no error, but blocked by RLS or wrong id)
  // is also a silent failure — flag it so it doesn't masquerade as success.
  const noRows = results.filter((r) => !r.error && r.rows === 0);
  if (noRows.length > 0 && noRows.length === results.length) {
    throw new Error(
      "O saldo não foi gravado: o UPDATE não afectou nenhuma linha " +
        "(provável política RLS de UPDATE em falta em money_schema.accounts)."
    );
  }
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
