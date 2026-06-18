-- Supplier-level payments with allocations and unapplied supplier advances.

CREATE TABLE IF NOT EXISTS supplier_payments (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  payment_method_id uuid NOT NULL REFERENCES payment_methods(id),
  payment_method_name_snapshot varchar(150) NOT NULL,
  payment_method_type_snapshot varchar(50) NOT NULL,
  paid_through_account_id uuid NOT NULL REFERENCES payment_accounts(id),
  amount numeric(14,2) NOT NULL,
  allocated_amount numeric(14,2) NOT NULL DEFAULT 0,
  unapplied_amount numeric(14,2) NOT NULL DEFAULT 0,
  reference_number varchar(255) NOT NULL DEFAULT '',
  payment_date timestamptz NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'completed',
  notes text NOT NULL DEFAULT '',
  journal_entry_id uuid REFERENCES journal_entries(id),
  paid_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_supplier_payments_amount CHECK (amount > 0),
  CONSTRAINT chk_supplier_payments_allocated CHECK (allocated_amount >= 0 AND allocated_amount <= amount),
  CONSTRAINT chk_supplier_payments_unapplied CHECK (unapplied_amount >= 0 AND unapplied_amount = amount - allocated_amount),
  CONSTRAINT chk_supplier_payments_status CHECK (status IN ('completed', 'voided'))
);

CREATE TABLE IF NOT EXISTS supplier_payment_allocations (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  supplier_payment_id uuid NOT NULL REFERENCES supplier_payments(id),
  purchase_invoice_id uuid NOT NULL REFERENCES purchase_invoices(id),
  amount numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_supplier_payment_allocations_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_business_id
  ON supplier_payments(business_id);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_branch_id
  ON supplier_payments(branch_id);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier_id
  ON supplier_payments(supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_method_id
  ON supplier_payments(payment_method_id);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_paid_account
  ON supplier_payments(paid_through_account_id);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_date
  ON supplier_payments(payment_date);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_deleted_at
  ON supplier_payments(deleted_at);

CREATE INDEX IF NOT EXISTS idx_supplier_payment_allocations_payment_id
  ON supplier_payment_allocations(supplier_payment_id);

CREATE INDEX IF NOT EXISTS idx_supplier_payment_allocations_invoice_id
  ON supplier_payment_allocations(purchase_invoice_id);

CREATE INDEX IF NOT EXISTS idx_supplier_payment_allocations_deleted_at
  ON supplier_payment_allocations(deleted_at);

ALTER TABLE purchase_invoice_payments
  ADD COLUMN IF NOT EXISTS supplier_payment_id uuid REFERENCES supplier_payments(id),
  ADD COLUMN IF NOT EXISTS supplier_payment_allocation_id uuid REFERENCES supplier_payment_allocations(id);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_payments_supplier_payment_id
  ON purchase_invoice_payments(supplier_payment_id)
  WHERE deleted_at IS NULL;

INSERT INTO chart_of_accounts (
  id,
  business_id,
  account_code,
  account_name,
  account_type,
  account_group,
  normal_balance,
  description,
  is_system_account,
  is_control_account,
  allow_manual_posting,
  status,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  b.id,
  '1400',
  'Supplier Advances / Vendor Prepayments',
  'asset',
  'current_asset',
  'debit',
  'Unapplied supplier payments and vendor prepayments',
  true,
  true,
  false,
  'active',
  now(),
  now()
FROM businesses b
WHERE b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM chart_of_accounts coa
    WHERE coa.business_id = b.id
      AND coa.account_code = '1400'
      AND coa.deleted_at IS NULL
  );

UPDATE chart_of_accounts
SET account_name = 'Supplier Advances / Vendor Prepayments',
    description = 'Unapplied supplier payments and vendor prepayments',
    updated_at = now()
WHERE account_code = '1400'
  AND account_name = 'Advance to Supplier'
  AND deleted_at IS NULL;

INSERT INTO accounting_account_mappings (
  id,
  business_id,
  mapping_key,
  chart_account_id,
  description,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  b.id,
  'supplier_advance',
  coa.id,
  'Unapplied supplier payments and vendor prepayments',
  now(),
  now()
FROM businesses b
JOIN chart_of_accounts coa
  ON coa.business_id = b.id
  AND coa.account_code = '1400'
  AND coa.deleted_at IS NULL
WHERE b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM accounting_account_mappings aam
    WHERE aam.business_id = b.id
      AND aam.mapping_key = 'supplier_advance'
      AND aam.deleted_at IS NULL
  );
