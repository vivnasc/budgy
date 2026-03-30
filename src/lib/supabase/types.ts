/**
 * TypeScript types for the money_schema database tables.
 * Matches supabase/migrations/00003_money_schema.sql
 */

// ─── Enums ──────────────────────────────────────────────────────────────────

export type AccountType = "bank" | "mpesa" | "cash" | "savings" | "investment";
export type CategoryType = "income" | "expense";
export type TransactionType = "income" | "expense" | "transfer";
export type BudgetPeriod = "weekly" | "monthly" | "quarterly" | "annual";
export type DebtType = "owe" | "owed";

// ─── Tables ─────────────────────────────────────────────────────────────────

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  balance: number;
  color: string | null;
  icon: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  is_system: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string | null;
  date: string;
  is_recurring: boolean;
  recurring_config: Record<string, unknown> | null;
  tags: string[] | null;
  attachments: string[] | null;
  transfer_to_account_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  categories?: Category | null;
  accounts?: Account | null;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  period: BudgetPeriod;
  rollover_enabled: boolean;
  rollover_amount: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  categories?: Category | null;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  currency: string;
  deadline: string | null;
  icon: string | null;
  color: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Fund {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  purpose: string | null;
  icon: string | null;
  color: string | null;
  auto_contribute: boolean;
  contribute_amount: number | null;
  contribute_frequency: string | null;
  created_at: string;
  updated_at: string;
}

export interface XitiqueGroup {
  id: string;
  user_id: string;
  name: string;
  total_members: number;
  contribution_amount: number;
  frequency: string;
  currency: string;
  current_round: number;
  my_turn: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DebtRecord {
  id: string;
  user_id: string;
  type: DebtType;
  person_name: string;
  amount: number;
  currency: string;
  description: string | null;
  due_date: string | null;
  is_paid: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Insert types (omit server-generated fields) ────────────────────────────

export type AccountInsert = Omit<Account, "id" | "created_at" | "updated_at" | "user_id">;
export type TransactionInsert = Omit<Transaction, "id" | "created_at" | "updated_at" | "user_id" | "categories" | "accounts">;
export type BudgetInsert = Omit<Budget, "id" | "created_at" | "updated_at" | "user_id" | "categories">;
export type GoalInsert = Omit<Goal, "id" | "created_at" | "updated_at" | "user_id">;
export type DebtRecordInsert = Omit<DebtRecord, "id" | "created_at" | "updated_at" | "user_id">;
export type XitiqueGroupInsert = Omit<XitiqueGroup, "id" | "created_at" | "updated_at" | "user_id">;
