-- ============================================================================
-- BUDGY Migration 00005: Predicted Account Balance
-- ============================================================================
-- Adds `balance_predicted` to accounts so we can show, per account and as a
-- whole-portfolio total, the difference between:
--
--   balance            → only 'completed' transactions (the cash that has
--                        actually moved)
--   balance_predicted  → 'completed' + 'pending' transactions (including
--                        future-dated bills and salaries that the user has
--                        scheduled — what the balance will be once those
--                        materialise, if nothing else changes)
--
-- This matches the "Saldo atual" / "Saldo previsto" UX in Mobills.
--
-- Idempotent: safe to run multiple times.
-- ============================================================================

ALTER TABLE money_schema.accounts
  ADD COLUMN IF NOT EXISTS balance_predicted DECIMAL(15, 2) NOT NULL DEFAULT 0.00;

-- Initialise predicted = balance for existing rows so the UI doesn't show 0
-- everywhere before the first recalculation runs
UPDATE money_schema.accounts
   SET balance_predicted = balance
 WHERE balance_predicted = 0;
