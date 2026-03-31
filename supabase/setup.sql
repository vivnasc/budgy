-- ============================================================================
-- BUDGY - Setup Completo para Supabase
-- ============================================================================
-- INSTRUÇÕES:
-- 1. Vai ao Supabase Dashboard → SQL Editor
-- 2. Cola TODO este ficheiro
-- 3. Clica "Run"
-- 4. Pronto!
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Pré-requisitos: schema, profiles table, updated_at trigger
-- ----------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS money_schema;

-- Profiles table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 1. ENUM Types
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE money_schema.account_type AS ENUM ('bank', 'mpesa', 'cash', 'savings', 'investment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE money_schema.category_type AS ENUM ('income', 'expense');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE money_schema.transaction_type AS ENUM ('income', 'expense', 'transfer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE money_schema.budget_period AS ENUM ('weekly', 'monthly', 'quarterly', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE money_schema.debt_type AS ENUM ('owe', 'owed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- Accounts
CREATE TABLE IF NOT EXISTS money_schema.accounts (
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

-- Categories
CREATE TABLE IF NOT EXISTS money_schema.categories (
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

-- Transactions
CREATE TABLE IF NOT EXISTS money_schema.transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id              UUID REFERENCES money_schema.accounts(id) ON DELETE CASCADE,
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
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budgets
CREATE TABLE IF NOT EXISTS money_schema.budgets (
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

-- Goals
CREATE TABLE IF NOT EXISTS money_schema.goals (
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

-- Funds
CREATE TABLE IF NOT EXISTS money_schema.funds (
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

-- Xitique Groups
CREATE TABLE IF NOT EXISTS money_schema.xitique_groups (
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

-- Debt Records
CREATE TABLE IF NOT EXISTS money_schema.debt_records (
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

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON money_schema.accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_active ON money_schema.accounts (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON money_schema.categories (user_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON money_schema.categories (type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON money_schema.transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON money_schema.transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON money_schema.transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON money_schema.transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON money_schema.transactions (type);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON money_schema.budgets (user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON money_schema.goals (user_id);
CREATE INDEX IF NOT EXISTS idx_funds_user_id ON money_schema.funds (user_id);
CREATE INDEX IF NOT EXISTS idx_xitique_groups_user_id ON money_schema.xitique_groups (user_id);
CREATE INDEX IF NOT EXISTS idx_debt_records_user_id ON money_schema.debt_records (user_id);
CREATE INDEX IF NOT EXISTS idx_debt_records_user_paid ON money_schema.debt_records (user_id, is_paid);

-- ============================================================================
-- 4. UPDATED_AT TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS set_accounts_updated_at ON money_schema.accounts;
CREATE TRIGGER set_accounts_updated_at BEFORE UPDATE ON money_schema.accounts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_transactions_updated_at ON money_schema.transactions;
CREATE TRIGGER set_transactions_updated_at BEFORE UPDATE ON money_schema.transactions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_budgets_updated_at ON money_schema.budgets;
CREATE TRIGGER set_budgets_updated_at BEFORE UPDATE ON money_schema.budgets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_goals_updated_at ON money_schema.goals;
CREATE TRIGGER set_goals_updated_at BEFORE UPDATE ON money_schema.goals FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_funds_updated_at ON money_schema.funds;
CREATE TRIGGER set_funds_updated_at BEFORE UPDATE ON money_schema.funds FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_xitique_groups_updated_at ON money_schema.xitique_groups;
CREATE TRIGGER set_xitique_groups_updated_at BEFORE UPDATE ON money_schema.xitique_groups FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_debt_records_updated_at ON money_schema.debt_records;
CREATE TRIGGER set_debt_records_updated_at BEFORE UPDATE ON money_schema.debt_records FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE money_schema.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.xitique_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.debt_records ENABLE ROW LEVEL SECURITY;

-- Accounts
DROP POLICY IF EXISTS "accounts_select_own" ON money_schema.accounts;
DROP POLICY IF EXISTS "accounts_insert_own" ON money_schema.accounts;
DROP POLICY IF EXISTS "accounts_update_own" ON money_schema.accounts;
DROP POLICY IF EXISTS "accounts_delete_own" ON money_schema.accounts;
CREATE POLICY "accounts_select_own" ON money_schema.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounts_insert_own" ON money_schema.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts_update_own" ON money_schema.accounts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts_delete_own" ON money_schema.accounts FOR DELETE USING (auth.uid() = user_id);

-- Categories (system + own)
DROP POLICY IF EXISTS "categories_select" ON money_schema.categories;
DROP POLICY IF EXISTS "categories_insert_own" ON money_schema.categories;
DROP POLICY IF EXISTS "categories_update_own" ON money_schema.categories;
DROP POLICY IF EXISTS "categories_delete_own" ON money_schema.categories;
CREATE POLICY "categories_select" ON money_schema.categories FOR SELECT USING (is_system = true OR auth.uid() = user_id);
CREATE POLICY "categories_insert_own" ON money_schema.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_update_own" ON money_schema.categories FOR UPDATE USING (auth.uid() = user_id AND is_system = false) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_delete_own" ON money_schema.categories FOR DELETE USING (auth.uid() = user_id AND is_system = false);

-- Transactions
DROP POLICY IF EXISTS "transactions_select_own" ON money_schema.transactions;
DROP POLICY IF EXISTS "transactions_insert_own" ON money_schema.transactions;
DROP POLICY IF EXISTS "transactions_update_own" ON money_schema.transactions;
DROP POLICY IF EXISTS "transactions_delete_own" ON money_schema.transactions;
CREATE POLICY "transactions_select_own" ON money_schema.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions_insert_own" ON money_schema.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_update_own" ON money_schema.transactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_delete_own" ON money_schema.transactions FOR DELETE USING (auth.uid() = user_id);

-- Budgets
DROP POLICY IF EXISTS "budgets_select_own" ON money_schema.budgets;
DROP POLICY IF EXISTS "budgets_insert_own" ON money_schema.budgets;
DROP POLICY IF EXISTS "budgets_update_own" ON money_schema.budgets;
DROP POLICY IF EXISTS "budgets_delete_own" ON money_schema.budgets;
CREATE POLICY "budgets_select_own" ON money_schema.budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "budgets_insert_own" ON money_schema.budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "budgets_update_own" ON money_schema.budgets FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "budgets_delete_own" ON money_schema.budgets FOR DELETE USING (auth.uid() = user_id);

-- Goals
DROP POLICY IF EXISTS "goals_select_own" ON money_schema.goals;
DROP POLICY IF EXISTS "goals_insert_own" ON money_schema.goals;
DROP POLICY IF EXISTS "goals_update_own" ON money_schema.goals;
DROP POLICY IF EXISTS "goals_delete_own" ON money_schema.goals;
CREATE POLICY "goals_select_own" ON money_schema.goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "goals_insert_own" ON money_schema.goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals_update_own" ON money_schema.goals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals_delete_own" ON money_schema.goals FOR DELETE USING (auth.uid() = user_id);

-- Funds
DROP POLICY IF EXISTS "funds_select_own" ON money_schema.funds;
DROP POLICY IF EXISTS "funds_insert_own" ON money_schema.funds;
DROP POLICY IF EXISTS "funds_update_own" ON money_schema.funds;
DROP POLICY IF EXISTS "funds_delete_own" ON money_schema.funds;
CREATE POLICY "funds_select_own" ON money_schema.funds FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "funds_insert_own" ON money_schema.funds FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "funds_update_own" ON money_schema.funds FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "funds_delete_own" ON money_schema.funds FOR DELETE USING (auth.uid() = user_id);

-- Xitique Groups
DROP POLICY IF EXISTS "xitique_groups_select_own" ON money_schema.xitique_groups;
DROP POLICY IF EXISTS "xitique_groups_insert_own" ON money_schema.xitique_groups;
DROP POLICY IF EXISTS "xitique_groups_update_own" ON money_schema.xitique_groups;
DROP POLICY IF EXISTS "xitique_groups_delete_own" ON money_schema.xitique_groups;
CREATE POLICY "xitique_groups_select_own" ON money_schema.xitique_groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "xitique_groups_insert_own" ON money_schema.xitique_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "xitique_groups_update_own" ON money_schema.xitique_groups FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "xitique_groups_delete_own" ON money_schema.xitique_groups FOR DELETE USING (auth.uid() = user_id);

-- Debt Records
DROP POLICY IF EXISTS "debt_records_select_own" ON money_schema.debt_records;
DROP POLICY IF EXISTS "debt_records_insert_own" ON money_schema.debt_records;
DROP POLICY IF EXISTS "debt_records_update_own" ON money_schema.debt_records;
DROP POLICY IF EXISTS "debt_records_delete_own" ON money_schema.debt_records;
CREATE POLICY "debt_records_select_own" ON money_schema.debt_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "debt_records_insert_own" ON money_schema.debt_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "debt_records_update_own" ON money_schema.debt_records FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "debt_records_delete_own" ON money_schema.debt_records FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 6. SYSTEM CATEGORIES (default categories for all users)
-- ============================================================================

INSERT INTO money_schema.categories (name, type, icon, is_system) VALUES
  -- Expense categories
  ('Alimentação', 'expense', '🍽️', true),
  ('Transporte', 'expense', '🚗', true),
  ('Casa', 'expense', '🏠', true),
  ('Saúde', 'expense', '❤️', true),
  ('Educação', 'expense', '🎓', true),
  ('Lazer', 'expense', '🎮', true),
  ('Roupa', 'expense', '👕', true),
  ('Comunicação', 'expense', '📱', true),
  ('Compras', 'expense', '🛒', true),
  ('Contas & Serviços', 'expense', '⚡', true),
  ('Beleza & Cuidados', 'expense', '💅', true),
  ('Família', 'expense', '👨‍👩‍👧', true),
  ('Subscrições', 'expense', '📺', true),
  ('Combustível', 'expense', '⛽', true),
  ('Taxas Bancárias', 'expense', '🏦', true),
  ('Xitique', 'expense', '👥', true),
  ('Outros', 'expense', '📦', true),
  -- Income categories
  ('Salário', 'income', '💰', true),
  ('Freelance', 'income', '💻', true),
  ('Investimento', 'income', '📈', true),
  ('Xitique Recebido', 'income', '👥', true),
  ('Outro Rendimento', 'income', '💵', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DONE! A base de dados do BUDGY está pronta.
-- ============================================================================
