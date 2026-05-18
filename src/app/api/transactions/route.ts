import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountType } from "@/lib/supabase/types";
import { persistAccountBalances } from "@/lib/account-balances";

/**
 * GET /api/transactions
 *
 * List transactions with filtering and pagination.
 * Query params: type, status, from, to, category, account, limit, offset
 */
export async function GET(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const category = searchParams.get("category");
    const account = searchParams.get("account");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .schema("money_schema")
      .from("transactions")
      .select("*, categories(*), accounts!transactions_account_id_fkey(*)")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) query = query.eq("type", type);
    if (status) query = query.eq("status", status);
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);
    if (category) query = query.eq("category_id", category);
    if (account) query = query.eq("account_id", account);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ transactions: data, total: count });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/transactions
 *
 * Create one or more transactions.
 * Body: { transaction: {...} } or { transactions: [{...}] } for bulk.
 *
 * Each transaction may include `account` (name) and `transfer_to_account` (name)
 * which are resolved (creating accounts on demand) and replaced with `account_id`
 * / `transfer_to_account_id`. After insert, balances of affected accounts are
 * recalculated from all transactions of that user.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();

    // Bulk insert with duplicate detection + account resolution
    if (body.transactions && Array.isArray(body.transactions)) {
      const incoming = body.transactions as RawTxInput[];

      // Resolve account names → IDs (creating missing accounts)
      const accountIds = await resolveAccountIds(supabase, user.id, incoming);

      // Resolve category names → IDs
      const categoryIds = await resolveCategoryIds(supabase, user.id, incoming);

      const transactions: PreparedTx[] = incoming.map((tx) => {
        const cleaned = stripVirtualFields(tx);
        const accountId = tx.account ? accountIds.get(normalizeAccountKey(tx.account)) : undefined;
        const transferToId = tx.transfer_to_account
          ? accountIds.get(normalizeAccountKey(tx.transfer_to_account))
          : undefined;
        const categoryId = tx.category_name ? categoryIds.get(tx.category_name.toLowerCase()) : undefined;

        return {
          ...cleaned,
          user_id: user.id,
          account_id: accountId ?? (cleaned.account_id as string | undefined) ?? null,
          transfer_to_account_id: transferToId ?? (cleaned.transfer_to_account_id as string | undefined) ?? null,
          category_id: categoryId ?? (cleaned.category_id as string | undefined) ?? null,
          type: tx.type as string | undefined,
          amount: tx.amount,
          date: tx.date,
          description: tx.description,
        };
      });

      // Fetch existing transactions for this user to detect duplicates
      const { data: existing } = await supabase
        .schema("money_schema")
        .from("transactions")
        .select("date, amount, description, type, account_id")
        .eq("user_id", user.id);

      const existingKeys = new Set(
        (existing || []).map(
          (tx: { date?: string; amount?: number; description?: string; type?: string; account_id?: string | null }) =>
            buildDedupKey(tx.date, tx.amount, tx.description, tx.type, tx.account_id)
        )
      );

      const unique = transactions.filter((tx) => {
        const key = buildDedupKey(tx.date, tx.amount, tx.description, tx.type, tx.account_id);
        return !existingKeys.has(key);
      });

      const duplicates = transactions.length - unique.length;

      if (unique.length === 0) {
        return NextResponse.json({
          success: true,
          count: 0,
          duplicates,
          transactions: [],
          message: `${duplicates} transações já existem. Nada importado.`,
        });
      }

      const { data, error } = await supabase
        .schema("money_schema")
        .from("transactions")
        .insert(unique)
        .select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Recalculate balances for all accounts touched by the inserted rows
      const touched = new Set<string>();
      for (const tx of unique) {
        if (tx.account_id) touched.add(tx.account_id);
        if (tx.transfer_to_account_id) touched.add(tx.transfer_to_account_id);
      }
      await persistAccountBalances(supabase, user.id, Array.from(touched));

      return NextResponse.json({
        success: true,
        count: data?.length || 0,
        duplicates,
        transactions: data,
        message: duplicates > 0
          ? `${data?.length} importadas, ${duplicates} duplicadas ignoradas.`
          : undefined,
      });
    }

    // Single insert
    if (body.transaction) {
      const tx = body.transaction as RawTxInput;
      const accountIds = await resolveAccountIds(supabase, user.id, [tx]);
      const categoryIds = await resolveCategoryIds(supabase, user.id, [tx]);
      const cleaned = stripVirtualFields(tx);
      const accountId = tx.account ? accountIds.get(normalizeAccountKey(tx.account)) : undefined;
      const transferToId = tx.transfer_to_account
        ? accountIds.get(normalizeAccountKey(tx.transfer_to_account))
        : undefined;
      const categoryId = tx.category_name ? categoryIds.get(tx.category_name.toLowerCase()) : undefined;

      const transaction: PreparedTx = {
        ...cleaned,
        user_id: user.id,
        account_id: accountId ?? (cleaned.account_id as string | undefined) ?? null,
        transfer_to_account_id: transferToId ?? (cleaned.transfer_to_account_id as string | undefined) ?? null,
        category_id: categoryId ?? (cleaned.category_id as string | undefined) ?? null,
      };

      const { data, error } = await supabase
        .schema("money_schema")
        .from("transactions")
        .insert(transaction)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const touched: string[] = [];
      if (transaction.account_id) touched.push(transaction.account_id);
      if (transaction.transfer_to_account_id) touched.push(transaction.transfer_to_account_id);
      if (touched.length) await persistAccountBalances(supabase, user.id, touched);

      return NextResponse.json({ success: true, transaction: data });
    }

    return NextResponse.json(
      { error: "Body deve conter 'transaction' ou 'transactions'" },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/transactions
 *
 * Wipes all transactions and accounts for the authenticated user. Used by
 * the "Limpar dados" flow after a bad import.
 */
export async function DELETE() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { error: txErr } = await supabase
      .schema("money_schema")
      .from("transactions")
      .delete()
      .eq("user_id", user.id);
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    const { error: accErr } = await supabase
      .schema("money_schema")
      .from("accounts")
      .delete()
      .eq("user_id", user.id);
    if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

interface RawTxInput {
  type?: string;
  amount?: number;
  date?: string;
  description?: string;
  account?: string;
  transfer_to_account?: string;
  category_name?: string;
  account_id?: string;
  transfer_to_account_id?: string;
  category_id?: string;
  [key: string]: unknown;
}

interface PreparedTx {
  user_id: string;
  account_id: string | null;
  transfer_to_account_id: string | null;
  category_id: string | null;
  type?: string;
  amount?: number;
  date?: string;
  description?: string;
  [key: string]: unknown;
}

const VIRTUAL_FIELDS = ["account", "transfer_to_account", "category_name"] as const;

function stripVirtualFields(tx: RawTxInput): Record<string, unknown> {
  const out: Record<string, unknown> = { ...tx };
  for (const f of VIRTUAL_FIELDS) delete out[f];
  return out;
}

function normalizeAccountKey(name: string): string {
  return name.trim().toLowerCase();
}

function buildDedupKey(
  date: string | undefined,
  amount: number | undefined,
  description: string | undefined,
  type: string | undefined,
  accountId: string | null | undefined
): string {
  return `${date}|${amount}|${(description || "").toLowerCase().trim()}|${type}|${accountId ?? ""}`;
}

function inferAccountType(name: string): AccountType {
  const lower = name.toLowerCase();
  if (/m-?pesa|emola|e-?mola|wallet/.test(lower)) return "mpesa";
  if (/poupan|saving/.test(lower)) return "savings";
  if (/invest/.test(lower)) return "investment";
  if (/cash|dinheiro|caixa/.test(lower)) return "cash";
  return "bank";
}

/**
 * Returns a Map keyed by normalised account name → account id.
 * Creates accounts that don't yet exist for this user.
 */
async function resolveAccountIds(
  supabase: SupabaseClient,
  userId: string,
  txs: RawTxInput[]
): Promise<Map<string, string>> {
  const names = new Set<string>();
  for (const tx of txs) {
    if (tx.account) names.add(tx.account.trim());
    if (tx.transfer_to_account) names.add(tx.transfer_to_account.trim());
  }
  if (names.size === 0) return new Map();

  const { data: existing } = await supabase
    .schema("money_schema")
    .from("accounts")
    .select("id, name")
    .eq("user_id", userId);

  const map = new Map<string, string>();
  for (const acc of (existing || []) as { id: string; name: string }[]) {
    map.set(normalizeAccountKey(acc.name), acc.id);
  }

  const missing = Array.from(names).filter((n) => !map.has(normalizeAccountKey(n)));
  if (missing.length > 0) {
    const newRows = missing.map((name) => ({
      user_id: userId,
      name,
      type: inferAccountType(name),
      currency: "MZN",
      balance: 0,
      is_active: true,
    }));

    const { data: created } = await supabase
      .schema("money_schema")
      .from("accounts")
      .insert(newRows)
      .select("id, name");

    for (const acc of (created || []) as { id: string; name: string }[]) {
      map.set(normalizeAccountKey(acc.name), acc.id);
    }
  }

  return map;
}

async function resolveCategoryIds(
  supabase: SupabaseClient,
  userId: string,
  txs: RawTxInput[]
): Promise<Map<string, string>> {
  // Collect category names + which transaction type uses them (so we can
  // create new categories with the correct income/expense type)
  const nameToType = new Map<string, "income" | "expense">();
  for (const tx of txs) {
    if (!tx.category_name) continue;
    const name = tx.category_name.trim();
    if (!name) continue;
    if (nameToType.has(name)) continue;
    // Transfers don't get categories; map them to expense bucket if encountered
    nameToType.set(name, tx.type === "income" ? "income" : "expense");
  }
  if (nameToType.size === 0) return new Map();

  const { data } = await supabase
    .schema("money_schema")
    .from("categories")
    .select("id, name, user_id")
    .or(`user_id.is.null,user_id.eq.${userId}`);

  const map = new Map<string, string>();
  for (const cat of (data || []) as { id: string; name: string }[]) {
    map.set(cat.name.toLowerCase(), cat.id);
  }

  const missing = Array.from(nameToType.keys()).filter((n) => !map.has(n.toLowerCase()));
  if (missing.length > 0) {
    const newRows = missing.map((name) => ({
      user_id: userId,
      name,
      type: nameToType.get(name) ?? "expense",
      is_system: false,
    }));

    const { data: created } = await supabase
      .schema("money_schema")
      .from("categories")
      .insert(newRows)
      .select("id, name");

    for (const cat of (created || []) as { id: string; name: string }[]) {
      map.set(cat.name.toLowerCase(), cat.id);
    }
  }

  return map;
}

