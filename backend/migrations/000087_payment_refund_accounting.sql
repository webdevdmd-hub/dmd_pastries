ALTER TABLE payment_refunds
  ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES journal_entries(id);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_journal_entry_id
  ON payment_refunds(journal_entry_id)
  WHERE journal_entry_id IS NOT NULL;

ALTER TABLE payment_refunds DROP CONSTRAINT IF EXISTS chk_payment_refunds_source;

ALTER TABLE payment_refunds
  ADD CONSTRAINT chk_payment_refunds_source
  CHECK (refund_source IN ('payment_adjustment', 'pos_sale', 'sales_return'));
