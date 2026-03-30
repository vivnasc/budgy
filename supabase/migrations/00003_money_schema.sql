-- ============================================================================
-- VIDA Ecosystem - Migration 00003: Money Schema Tables
-- ============================================================================
-- Financial management tables for VIDA Money:
--   accounts, categories, transactions, budgets, goals, funds,
--   xitique_groups, debt_records
-- Includes ENUM types, foreign keys, constraints, indexes, and RLS policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUM Types
-- ----------------------------------------------------------------------------

CREATE TYPE money_schema.account_type AS ENUM (
  'bank',
  'mpesa',
  'cash',
  'savings',
  'investment'
);

CREATE TYPE money_schema.category_type AS ENUM (
  'income',
  'expense'
);

CREATE TYPE money_schema.transaction_type AS ENUM (
  'income',
  'expense',
  'transfer'
);

CREATE TYPE money_schema.budget_period AS ENUM (
  'weekly',
  'monthly',
  'quarterly',
  'annual'
);

CREATE TYPE money_schema.debt_type AS ENUM (
  'owe',
  'owed'
);

-- ============================================================================
-- TABLE: accounts
-- ============================================================================

CREATE TABLE money_schema.accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            money_schema.account_type NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'MZN',
  balance         DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  color           TEXT,
  icon            TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE money_schema.accounts IS 'User financial accounts (bank, M-Pesa, cash, etc.)';

-- Indexes
CREATE INDEX idx_accounts_user_id ON money_schema.accounts (user_id);
CREATE INDEX idx_accounts_user_active ON money_schema.accounts (user_id, is_active);

-- Updated_at trigger
CREATE TRIGGER set_accounts_updated_at
  BEFORE UPDATE ON money_schema.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- TABLE: categories
-- ============================================================================

CREATE TABLE money_schema.categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            money_schema.category_type NOT NULL,
  icon            TEXT,
  color           TEXT,
  parent_id       UUID REFERENCES money_schema.categories(id) ON DELETE SET NULL,
  is_system       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE money_schema.categories IS 'Transaction categories (system defaults + user custom)';

-- Indexes
CREATE INDEX idx_categories_user_id ON money_schema.categories (user_id);
CREATE INDEX idx_categories_type ON money_schema.categories (type);
CREATE INDEX idx_categories_parent_id ON money_schema.categories (parent_id);

-- ============================================================================
-- TABLE: transactions
-- ============================================================================

CREATE TABLE money_schema.transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id              UUID NOT NULL REFERENCES money_schema.accounts(id) ON DELETE CASCADE,
  category_id             UUID REFERENCES money_schema.categories(id) ON DELETE SET NULL,
  type                    money_schema.transaction_type NOT NULL,
  amount                  DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency                TEXT NOT NULL DEFAULT 'MZN',
  description             TEXT,
  date                    DATE NOT NULL DEFAULT CURRENT_DATE,
  is_recurring            BOOLEAN NOT NULL DEFAULT false,
  recurring_config        JSONB,
  tags                    TEXT[],
  attachments             TEXT[],
  transfer_to_account_id  UUID REFERENCES money_schema.accounts(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Transfer must have a target account
  CONSTRAINT chk_transfer_target CHECK (
    (type != 'transfer') OR (transfer_to_account_id IS NOT NULL)
  )
);

COMMENT ON TABLE money_schema.transactions IS 'Financial transactions (income, expense, transfer)';

-- Indexes
CREATE INDEX idx_transactions_user_id ON money_schema.transactions (user_id);
CREATE INDEX idx_transactions_account_id ON money_schema.transactions (account_id);
CREATE INDEX idx_transactions_category_id ON money_schema.transactions (category_id);
CREATE INDEX idx_transactions_date ON money_schema.transactions (date DESC);
CREATE INDEX idx_transactions_user_date ON money_schema.transactions (user_id, date DESC);
CREATE INDEX idx_transactions_user_category ON money_schema.transactions (user_id, category_id);
CREATE INDEX idx_transactions_type ON money_schema.transactions (type);

-- Updated_at trigger
CREATE TRIGGER set_transactions_updated_at
  BEFORE UPDATE ON money_schema.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- TABLE: budgets
-- ============================================================================

CREATE TABLE money_schema.budgets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id         UUID REFERENCES money_schema.categories(id) ON DELETE SET NULL,
  amount              DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  period              money_schema.budget_period NOT NULL DEFAULT 'monthly',
  rollover_enabled    BOOLEAN NOT NULL DEFAULT false,
  rollover_amount     DECIMAL(15, 2) DEFAULT 0.00,
  start_date          DATE NOT NULL,
  end_date            DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_budget_dates CHECK (end_date IS NULL OR end_date > start_date)
);

COMMENT ON TABLE money_schema.budgets IS 'Budget allocations per category and period';

-- Indexes
CREATE INDEX idx_budgets_user_id ON money_schema.budgets (user_id);
CREATE INDEX idx_budgets_category_id ON money_schema.budgets (category_id);
CREATE INDEX idx_budgets_user_period ON money_schema.budgets (user_id, period);

-- Updated_at trigger
CREATE TRIGGER set_budgets_updated_at
  BEFORE UPDATE ON money_schema.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- TABLE: goals
-- ============================================================================

CREATE TABLE money_schema.goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  target_amount   DECIMAL(15, 2) NOT NULL CHECK (target_amount > 0),
  current_amount  DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (current_amount >= 0),
  currency        TEXT NOT NULL DEFAULT 'MZN',
  deadline        DATE,
  icon            TEXT,
  color           TEXT,
  is_completed    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE money_schema.goals IS 'Savings goals with progress tracking';

-- Indexes
CREATE INDEX idx_goals_user_id ON money_schema.goals (user_id);
CREATE INDEX idx_goals_user_completed ON money_schema.goals (user_id, is_completed);

-- Updated_at trigger
CREATE TRIGGER set_goals_updated_at
  BEFORE UPDATE ON money_schema.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- TABLE: funds
-- ============================================================================

CREATE TABLE money_schema.funds (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  target_amount           DECIMAL(15, 2) NOT NULL CHECK (target_amount > 0),
  current_amount          DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (current_amount >= 0),
  purpose                 TEXT,
  icon                    TEXT,
  color                   TEXT,
  auto_contribute         BOOLEAN NOT NULL DEFAULT false,
  contribute_amount       DECIMAL(15, 2),
  contribute_frequency    TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE money_schema.funds IS 'Ring-fenced funds for specific purposes (emergency, education, etc.)';

-- Indexes
CREATE INDEX idx_funds_user_id ON money_schema.funds (user_id);

-- Updated_at trigger
CREATE TRIGGER set_funds_updated_at
  BEFORE UPDATE ON money_schema.funds
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- TABLE: xitique_groups
-- ============================================================================

CREATE TABLE money_schema.xitique_groups (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  total_members           INT NOT NULL CHECK (total_members > 0),
  contribution_amount     DECIMAL(15, 2) NOT NULL CHECK (contribution_amount > 0),
  frequency               TEXT NOT NULL,
  currency                TEXT NOT NULL DEFAULT 'MZN',
  current_round           INT NOT NULL DEFAULT 1 CHECK (current_round > 0),
  my_turn                 INT CHECK (my_turn > 0),
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE money_schema.xitique_groups IS 'Xitique (rotating savings group) tracking';

-- Indexes
CREATE INDEX idx_xitique_groups_user_id ON money_schema.xitique_groups (user_id);

-- Updated_at trigger
CREATE TRIGGER set_xitique_groups_updated_at
  BEFORE UPDATE ON money_schema.xitique_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- TABLE: debt_records
-- ============================================================================

CREATE TABLE money_schema.debt_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type            money_schema.debt_type NOT NULL,
  person_name     TEXT NOT NULL,
  amount          DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency        TEXT NOT NULL DEFAULT 'MZN',
  description     TEXT,
  due_date        DATE,
  is_paid         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE money_schema.debt_records IS 'Personal debt tracking (money owed to/from others)';

-- Indexes
CREATE INDEX idx_debt_records_user_id ON money_schema.debt_records (user_id);
CREATE INDEX idx_debt_records_user_paid ON money_schema.debt_records (user_id, is_paid);
CREATE INDEX idx_debt_records_due_date ON money_schema.debt_records (due_date);

-- Updated_at trigger
CREATE TRIGGER set_debt_records_updated_at
  BEFORE UPDATE ON money_schema.debt_records
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all money_schema tables
ALTER TABLE money_schema.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.xitique_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.debt_records ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- Accounts RLS Policies
-- --------------------------------------------------------------------------

CREATE POLICY "accounts_select_own"
  ON money_schema.accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "accounts_insert_own"
  ON money_schema.accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "accounts_update_own"
  ON money_schema.accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "accounts_delete_own"
  ON money_schema.accounts FOR DELETE
  USING (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- Categories RLS Policies
-- --------------------------------------------------------------------------

-- Users can see system categories and their own custom categories
CREATE POLICY "categories_select"
  ON money_schema.categories FOR SELECT
  USING (is_system = true OR auth.uid() = user_id);

CREATE POLICY "categories_insert_own"
  ON money_schema.categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories_update_own"
  ON money_schema.categories FOR UPDATE
  USING (auth.uid() = user_id AND is_system = false)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories_delete_own"
  ON money_schema.categories FOR DELETE
  USING (auth.uid() = user_id AND is_system = false);

-- --------------------------------------------------------------------------
-- Transactions RLS Policies
-- --------------------------------------------------------------------------

CREATE POLICY "transactions_select_own"
  ON money_schema.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "transactions_insert_own"
  ON money_schema.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_update_own"
  ON money_schema.transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_delete_own"
  ON money_schema.transactions FOR DELETE
  USING (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- Budgets RLS Policies
-- --------------------------------------------------------------------------

CREATE POLICY "budgets_select_own"
  ON money_schema.budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "budgets_insert_own"
  ON money_schema.budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "budgets_update_own"
  ON money_schema.budgets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "budgets_delete_own"
  ON money_schema.budgets FOR DELETE
  USING (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- Goals RLS Policies
-- --------------------------------------------------------------------------

CREATE POLICY "goals_select_own"
  ON money_schema.goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "goals_insert_own"
  ON money_schema.goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_update_own"
  ON money_schema.goals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_delete_own"
  ON money_schema.goals FOR DELETE
  USING (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- Funds RLS Policies
-- --------------------------------------------------------------------------

CREATE POLICY "funds_select_own"
  ON money_schema.funds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "funds_insert_own"
  ON money_schema.funds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "funds_update_own"
  ON money_schema.funds FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "funds_delete_own"
  ON money_schema.funds FOR DELETE
  USING (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- Xitique Groups RLS Policies
-- --------------------------------------------------------------------------

CREATE POLICY "xitique_groups_select_own"
  ON money_schema.xitique_groups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "xitique_groups_insert_own"
  ON money_schema.xitique_groups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "xitique_groups_update_own"
  ON money_schema.xitique_groups FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "xitique_groups_delete_own"
  ON money_schema.xitique_groups FOR DELETE
  USING (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- Debt Records RLS Policies
-- --------------------------------------------------------------------------

CREATE POLICY "debt_records_select_own"
  ON money_schema.debt_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "debt_records_insert_own"
  ON money_schema.debt_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "debt_records_update_own"
  ON money_schema.debt_records FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "debt_records_delete_own"
  ON money_schema.debt_records FOR DELETE
  USING (auth.uid() = user_id);
