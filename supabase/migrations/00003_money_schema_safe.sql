-- ============================================================================
-- BUDGY - Money Schema (idempotente — seguro para correr várias vezes)
-- ============================================================================

-- Criar schema se não existir
CREATE SCHEMA IF NOT EXISTS money_schema;

-- Garantir que handle_updated_at existe
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- ENUM Types — CREATE só se não existir (NUNCA DROP, senão apaga colunas)
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'money_schema' AND t.typname = 'account_type') THEN
    CREATE TYPE money_schema.account_type AS ENUM ('bank', 'mpesa', 'cash', 'savings', 'investment');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'money_schema' AND t.typname = 'category_type') THEN
    CREATE TYPE money_schema.category_type AS ENUM ('income', 'expense');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'money_schema' AND t.typname = 'transaction_type') THEN
    CREATE TYPE money_schema.transaction_type AS ENUM ('income', 'expense', 'transfer');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'money_schema' AND t.typname = 'budget_period') THEN
    CREATE TYPE money_schema.budget_period AS ENUM ('weekly', 'monthly', 'quarterly', 'annual');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'money_schema' AND t.typname = 'debt_type') THEN
    CREATE TYPE money_schema.debt_type AS ENUM ('owe', 'owed');
  END IF;
END $$;

-- ============================================================================
-- TABLES (IF NOT EXISTS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS money_schema.accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS money_schema.categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            money_schema.category_type NOT NULL,
  icon            TEXT,
  color           TEXT,
  parent_id       UUID REFERENCES money_schema.categories(id) ON DELETE SET NULL,
  is_system       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS money_schema.transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id              UUID REFERENCES money_schema.accounts(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS money_schema.budgets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS money_schema.goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS money_schema.funds (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS money_schema.xitique_groups (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS money_schema.debt_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
-- RECOVERY: garantir que colunas dependentes de ENUMs existem
-- (caso uma migração anterior tenha feito DROP TYPE ... CASCADE)
-- ============================================================================

ALTER TABLE money_schema.accounts      ADD COLUMN IF NOT EXISTS type money_schema.account_type;
UPDATE money_schema.accounts SET type = 'bank' WHERE type IS NULL;
ALTER TABLE money_schema.accounts      ALTER COLUMN type SET NOT NULL;

ALTER TABLE money_schema.categories    ADD COLUMN IF NOT EXISTS type money_schema.category_type;
UPDATE money_schema.categories SET type = 'expense' WHERE type IS NULL;
ALTER TABLE money_schema.categories    ALTER COLUMN type SET NOT NULL;

ALTER TABLE money_schema.transactions  ADD COLUMN IF NOT EXISTS type money_schema.transaction_type;
UPDATE money_schema.transactions SET type = 'expense' WHERE type IS NULL;
ALTER TABLE money_schema.transactions  ALTER COLUMN type SET NOT NULL;

ALTER TABLE money_schema.budgets       ADD COLUMN IF NOT EXISTS period money_schema.budget_period DEFAULT 'monthly';
UPDATE money_schema.budgets SET period = 'monthly' WHERE period IS NULL;
ALTER TABLE money_schema.budgets       ALTER COLUMN period SET NOT NULL;

ALTER TABLE money_schema.debt_records  ADD COLUMN IF NOT EXISTS type money_schema.debt_type;
UPDATE money_schema.debt_records SET type = 'owe' WHERE type IS NULL;
ALTER TABLE money_schema.debt_records  ALTER COLUMN type SET NOT NULL;

-- ============================================================================
-- INDEXES (IF NOT EXISTS)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON money_schema.accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_active ON money_schema.accounts (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON money_schema.categories (user_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON money_schema.categories (type);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON money_schema.categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON money_schema.transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON money_schema.transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON money_schema.transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON money_schema.transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON money_schema.transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON money_schema.transactions (user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON money_schema.transactions (type);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON money_schema.budgets (user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON money_schema.budgets (category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_period ON money_schema.budgets (user_id, period);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON money_schema.goals (user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_completed ON money_schema.goals (user_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_funds_user_id ON money_schema.funds (user_id);
CREATE INDEX IF NOT EXISTS idx_xitique_groups_user_id ON money_schema.xitique_groups (user_id);
CREATE INDEX IF NOT EXISTS idx_debt_records_user_id ON money_schema.debt_records (user_id);
CREATE INDEX IF NOT EXISTS idx_debt_records_user_paid ON money_schema.debt_records (user_id, is_paid);
CREATE INDEX IF NOT EXISTS idx_debt_records_due_date ON money_schema.debt_records (due_date);

-- ============================================================================
-- TRIGGERS (DROP + CREATE para evitar duplicados)
-- ============================================================================

DROP TRIGGER IF EXISTS set_accounts_updated_at ON money_schema.accounts;
CREATE TRIGGER set_accounts_updated_at BEFORE UPDATE ON money_schema.accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_transactions_updated_at ON money_schema.transactions;
CREATE TRIGGER set_transactions_updated_at BEFORE UPDATE ON money_schema.transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_budgets_updated_at ON money_schema.budgets;
CREATE TRIGGER set_budgets_updated_at BEFORE UPDATE ON money_schema.budgets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_goals_updated_at ON money_schema.goals;
CREATE TRIGGER set_goals_updated_at BEFORE UPDATE ON money_schema.goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_funds_updated_at ON money_schema.funds;
CREATE TRIGGER set_funds_updated_at BEFORE UPDATE ON money_schema.funds
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_xitique_groups_updated_at ON money_schema.xitique_groups;
CREATE TRIGGER set_xitique_groups_updated_at BEFORE UPDATE ON money_schema.xitique_groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_debt_records_updated_at ON money_schema.debt_records;
CREATE TRIGGER set_debt_records_updated_at BEFORE UPDATE ON money_schema.debt_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE money_schema.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.xitique_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_schema.debt_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies (DROP IF EXISTS + CREATE)
DO $$
DECLARE
  _tables TEXT[] := ARRAY['accounts', 'categories', 'transactions', 'budgets', 'goals', 'funds', 'xitique_groups', 'debt_records'];
  _t TEXT;
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select_own" ON money_schema.%I', _t, _t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert_own" ON money_schema.%I', _t, _t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update_own" ON money_schema.%I', _t, _t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete_own" ON money_schema.%I', _t, _t);

    EXECUTE format('CREATE POLICY "%s_select_own" ON money_schema.%I FOR SELECT USING (auth.uid() = user_id)', _t, _t);
    EXECUTE format('CREATE POLICY "%s_insert_own" ON money_schema.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', _t, _t);
    EXECUTE format('CREATE POLICY "%s_update_own" ON money_schema.%I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', _t, _t);
    EXECUTE format('CREATE POLICY "%s_delete_own" ON money_schema.%I FOR DELETE USING (auth.uid() = user_id)', _t, _t);
  END LOOP;
END $$;

-- Categories: allow everyone to see system categories
DROP POLICY IF EXISTS "categories_select_own" ON money_schema.categories;
CREATE POLICY "categories_select_own" ON money_schema.categories FOR SELECT
  USING (is_system = true OR auth.uid() = user_id);

-- ============================================================================
-- GRANTS — expor money_schema ao PostgREST (anon/authenticated)
-- Sem isto, o cliente Supabase apanha "permission denied for schema money_schema"
-- IMPORTANTE: também tens de adicionar "money_schema" em
-- Supabase Dashboard → Settings → API → Exposed schemas
-- ============================================================================

GRANT USAGE ON SCHEMA money_schema TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA money_schema
  TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA money_schema
  TO anon, authenticated, service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA money_schema
  TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA money_schema
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA money_schema
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA money_schema
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
