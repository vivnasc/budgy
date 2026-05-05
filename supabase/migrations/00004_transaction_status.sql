-- ============================================================================
-- BUDGY Migration 00004: Transaction Status
-- ============================================================================
-- Adds a `status` column to transactions so the user can mark a transaction
-- as 'pending' (planned/expected, not yet realised), 'completed' (already
-- happened) or 'cancelled' (no longer relevant).
--
-- Existing rows default to 'completed' (they were imported as actual events).
-- The application excludes 'pending' and 'cancelled' rows from balance and
-- income/expense totals.
--
-- Idempotent: safe to run multiple times.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE money_schema.transaction_status AS ENUM ('pending', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE money_schema.transactions
  ADD COLUMN IF NOT EXISTS status money_schema.transaction_status NOT NULL DEFAULT 'completed';

CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON money_schema.transactions (user_id, status);

CREATE INDEX IF NOT EXISTS idx_transactions_user_status_date
  ON money_schema.transactions (user_id, status, date DESC);
