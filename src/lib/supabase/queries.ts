/**
 * Supabase query helpers for the money_schema tables.
 * Used by React hooks and API routes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Account,
  AccountInsert,
  Transaction,
  TransactionInsert,
  Budget,
  Goal,
  GoalInsert,
  DebtRecord,
  DebtRecordInsert,
  XitiqueGroup,
  XitiqueGroupInsert,
  Category,
} from "./types";

// ─── Accounts ───────────────────────────────────────────────────────────────

export async function getAccounts(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .schema("money_schema")
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return { data: data as Account[] | null, error };
}

export async function createAccount(supabase: SupabaseClient, userId: string, account: AccountInsert) {
  const { data, error } = await supabase
    .schema("money_schema")
    .from("accounts")
    .insert({ ...account, user_id: userId })
    .select()
    .single();

  return { data: data as Account | null, error };
}

// ─── Categories ─────────────────────────────────────────────────────────────

export async function getCategories(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .schema("money_schema")
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  return { data: data as Category[] | null, error };
}

// ─── Transactions ───────────────────────────────────────────────────────────

export async function getTransactions(
  supabase: SupabaseClient,
  userId: string,
  opts: {
    type?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const { type, from, to, limit = 50, offset = 0 } = opts;

  let query = supabase
    .schema("money_schema")
    .from("transactions")
    .select("*, categories(*), accounts(*)", { count: "exact" })
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) query = query.eq("type", type);
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data, error, count } = await query;
  return { data: data as Transaction[] | null, error, count };
}

export async function createTransaction(supabase: SupabaseClient, userId: string, tx: TransactionInsert) {
  const { data, error } = await supabase
    .schema("money_schema")
    .from("transactions")
    .insert({ ...tx, user_id: userId })
    .select("*, categories(*), accounts(*)")
    .single();

  return { data: data as Transaction | null, error };
}

export async function createTransactions(supabase: SupabaseClient, userId: string, txs: TransactionInsert[]) {
  const rows = txs.map((tx) => ({ ...tx, user_id: userId }));
  const { data, error } = await supabase
    .schema("money_schema")
    .from("transactions")
    .insert(rows)
    .select();

  return { data: data as Transaction[] | null, error };
}

export async function deleteTransaction(supabase: SupabaseClient, id: string) {
  const { error } = await supabase
    .schema("money_schema")
    .from("transactions")
    .delete()
    .eq("id", id);

  return { error };
}

// ─── Budgets ────────────────────────────────────────────────────────────────

export async function getBudgets(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .schema("money_schema")
    .from("budgets")
    .select("*, categories(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return { data: data as Budget[] | null, error };
}

// ─── Goals ──────────────────────────────────────────────────────────────────

export async function getGoals(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .schema("money_schema")
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return { data: data as Goal[] | null, error };
}

export async function createGoal(supabase: SupabaseClient, userId: string, goal: GoalInsert) {
  const { data, error } = await supabase
    .schema("money_schema")
    .from("goals")
    .insert({ ...goal, user_id: userId })
    .select()
    .single();

  return { data: data as Goal | null, error };
}

// ─── Debts ──────────────────────────────────────────────────────────────────

export async function getDebts(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .schema("money_schema")
    .from("debt_records")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return { data: data as DebtRecord[] | null, error };
}

export async function createDebt(supabase: SupabaseClient, userId: string, debt: DebtRecordInsert) {
  const { data, error } = await supabase
    .schema("money_schema")
    .from("debt_records")
    .insert({ ...debt, user_id: userId })
    .select()
    .single();

  return { data: data as DebtRecord | null, error };
}

// ─── Xitique ────────────────────────────────────────────────────────────────

export async function getXitiqueGroups(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .schema("money_schema")
    .from("xitique_groups")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return { data: data as XitiqueGroup[] | null, error };
}

export async function createXitiqueGroup(supabase: SupabaseClient, userId: string, group: XitiqueGroupInsert) {
  const { data, error } = await supabase
    .schema("money_schema")
    .from("xitique_groups")
    .insert({ ...group, user_id: userId })
    .select()
    .single();

  return { data: data as XitiqueGroup | null, error };
}

// ─── Dashboard Aggregates ───────────────────────────────────────────────────

export async function getDashboardData(supabase: SupabaseClient, userId: string) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]!;
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]!;

  const [accounts, transactions, budgets, goals, debts, xitique] = await Promise.all([
    getAccounts(supabase, userId),
    getTransactions(supabase, userId, { from: firstOfMonth, to: lastOfMonth, limit: 200 }),
    getBudgets(supabase, userId),
    getGoals(supabase, userId),
    getDebts(supabase, userId),
    getXitiqueGroups(supabase, userId),
  ]);

  return {
    accounts: accounts.data ?? [],
    transactions: transactions.data ?? [],
    budgets: budgets.data ?? [],
    goals: goals.data ?? [],
    debts: debts.data ?? [],
    xitique: xitique.data ?? [],
  };
}
