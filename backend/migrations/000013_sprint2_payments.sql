-- Sprint 2.3 payments foundation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO permissions (id, module_name, permission_key, description, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'payments', 'payments.view', 'View payments', now(), now()),
  (gen_random_uuid(), 'payments', 'payments.manage', 'Manage payments', now(), now()),
  (gen_random_uuid(), 'payments', 'payments.refund', 'Refund payments', now(), now()),
  (gen_random_uuid(), 'payments', 'payments.reconcile', 'Reconcile payments', now(), now())
ON CONFLICT (permission_key) DO NOTHING;

ALTER TABLE sale_payments
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id),
  ADD COLUMN IF NOT EXISTS payment_method_type_snapshot varchar(50),
  ADD COLUMN IF NOT EXISTS provider_transaction_id varchar(255),
  ADD COLUMN IF NOT EXISTS payment_status varchar(50) NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS paid_by_user_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE sale_payments sp
SET branch_id = s.branch_id
FROM sales s
WHERE sp.sale_id = s.id
  AND sp.branch_id IS NULL;

UPDATE sale_payments sp
SET paid_by_user_id = s.cashier_user_id
FROM sales s
WHERE sp.sale_id = s.id
  AND sp.paid_by_user_id IS NULL;

UPDATE sale_payments sp
SET payment_method_type_snapshot = pm.method_type
FROM payment_methods pm
WHERE sp.payment_method_id = pm.id
  AND (sp.payment_method_type_snapshot IS NULL OR sp.payment_method_type_snapshot = '');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_sale_payments_status'
  ) THEN
    ALTER TABLE sale_payments
      ADD CONSTRAINT chk_sale_payments_status
      CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded', 'partially_refunded'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sale_payments_branch_id ON sale_payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_paid_by_user_id ON sale_payments(paid_by_user_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_status ON sale_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_sale_payments_paid_at ON sale_payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_sale_payments_deleted_at ON sale_payments(deleted_at);

CREATE TABLE IF NOT EXISTS payment_refunds (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  sale_id uuid NOT NULL REFERENCES sales(id),
  sale_payment_id uuid REFERENCES sale_payments(id),
  refund_number varchar(100) NOT NULL,
  payment_method_id uuid NOT NULL REFERENCES payment_methods(id),
  payment_method_name_snapshot varchar(150) NOT NULL,
  refund_amount numeric(14, 4) NOT NULL,
  refund_reason text NOT NULL,
  refund_status varchar(50) NOT NULL DEFAULT 'completed',
  approved_by_user_id uuid REFERENCES users(id),
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  refunded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_payment_refunds_amount CHECK (refund_amount > 0),
  CONSTRAINT chk_payment_refunds_status CHECK (refund_status IN ('pending', 'completed', 'failed', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_refunds_business_refund_number ON payment_refunds(business_id, refund_number);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_business_id ON payment_refunds(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_branch_id ON payment_refunds(branch_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_sale_id ON payment_refunds(sale_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_sale_payment_id ON payment_refunds(sale_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_method_id ON payment_refunds(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_status ON payment_refunds(refund_status);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_refunded_at ON payment_refunds(refunded_at);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_deleted_at ON payment_refunds(deleted_at);

CREATE TABLE IF NOT EXISTS payment_reconciliations (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  reconciliation_date date NOT NULL,
  payment_method_id uuid NOT NULL REFERENCES payment_methods(id),
  expected_amount numeric(14, 4) NOT NULL DEFAULT 0,
  counted_amount numeric(14, 4) NOT NULL DEFAULT 0,
  difference_amount numeric(14, 4) NOT NULL DEFAULT 0,
  status varchar(50) NOT NULL DEFAULT 'submitted',
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_payment_reconciliations_status CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  CONSTRAINT chk_payment_reconciliations_counted CHECK (counted_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_business_id ON payment_reconciliations(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_branch_id ON payment_reconciliations(branch_id);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_method_id ON payment_reconciliations(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_date ON payment_reconciliations(reconciliation_date);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_status ON payment_reconciliations(status);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_deleted_at ON payment_reconciliations(deleted_at);
