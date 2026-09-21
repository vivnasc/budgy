-- --------------------------------------------------------------------------
-- 00006_recurring_payments.sql
-- Pagamentos recorrentes (folha salarial): trabalhadores que a Vivianne paga
-- todos os meses (por M-Pesa, ~dia 21), com o nome e o valor de cada um.
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS money_schema.recurring_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,                       -- nome do trabalhador
  amount        NUMERIC NOT NULL CHECK (amount > 0), -- salário
  account_id    UUID REFERENCES money_schema.accounts(id) ON DELETE SET NULL,
  category_name TEXT DEFAULT 'Salários',
  note          TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_payments_user
  ON money_schema.recurring_payments(user_id);

ALTER TABLE money_schema.recurring_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_payments_select_own"
  ON money_schema.recurring_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "recurring_payments_insert_own"
  ON money_schema.recurring_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recurring_payments_update_own"
  ON money_schema.recurring_payments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recurring_payments_delete_own"
  ON money_schema.recurring_payments FOR DELETE
  USING (auth.uid() = user_id);
