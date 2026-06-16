ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS reversal_journal_entry_id uuid REFERENCES journal_entries(id),
  ADD COLUMN IF NOT EXISTS cancelled_receipt_id uuid REFERENCES purchase_receipts(id);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_cancelled_by_user_id
  ON purchase_invoices(cancelled_by_user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_reversal_journal_entry_id
  ON purchase_invoices(reversal_journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_cancelled_receipt_id
  ON purchase_invoices(cancelled_receipt_id);

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS chk_stock_movement_type;
ALTER TABLE stock_movements
  ADD CONSTRAINT chk_stock_movement_type CHECK (movement_type IN (
    'opening_stock',
    'purchase_in',
    'purchase_return_out',
    'purchase_bill_cancel_out',
    'sale_out',
    'adjustment_in',
    'adjustment_out',
    'wastage',
    'return_in',
    'transfer',
    'transfer_in',
    'transfer_out',
    'production_in',
    'production_out'
  ));
