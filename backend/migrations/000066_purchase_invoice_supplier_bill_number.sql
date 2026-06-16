ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS supplier_bill_number varchar(255);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier_bill_number
  ON purchase_invoices(business_id, supplier_id, supplier_bill_number)
  WHERE deleted_at IS NULL AND supplier_bill_number IS NOT NULL AND supplier_bill_number <> '';
