-- Supplier payment transactions for posted purchase invoices.

CREATE TABLE IF NOT EXISTS purchase_invoice_payments (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  purchase_invoice_id uuid NOT NULL REFERENCES purchase_invoices(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  payment_method_id uuid NOT NULL REFERENCES payment_methods(id),
  payment_method_name_snapshot varchar(150) NOT NULL,
  payment_method_type_snapshot varchar(50) NOT NULL,
  amount numeric(14,2) NOT NULL,
  payment_status varchar(50) NOT NULL DEFAULT 'completed',
  reference_number varchar(255) NOT NULL DEFAULT '',
  paid_by_user_id uuid NOT NULL REFERENCES users(id),
  paid_at timestamptz NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_purchase_invoice_payments_amount CHECK (amount > 0),
  CONSTRAINT chk_purchase_invoice_payments_status CHECK (payment_status IN ('completed', 'voided'))
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_payments_business_id
  ON purchase_invoice_payments(business_id);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_payments_branch_id
  ON purchase_invoice_payments(branch_id);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_payments_invoice_id
  ON purchase_invoice_payments(purchase_invoice_id);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_payments_supplier_id
  ON purchase_invoice_payments(supplier_id);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_payments_method_id
  ON purchase_invoice_payments(payment_method_id);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_payments_paid_at
  ON purchase_invoice_payments(paid_at);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_payments_deleted_at
  ON purchase_invoice_payments(deleted_at);
