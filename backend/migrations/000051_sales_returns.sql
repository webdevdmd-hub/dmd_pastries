-- Sales Return / Credit Note foundation for item-level POS returns.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sales_returns (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  sale_id uuid NOT NULL REFERENCES sales(id),
  customer_id uuid REFERENCES customers(id),
  return_number varchar(100) NOT NULL,
  return_date date NOT NULL,
  reason text,
  status varchar(50) NOT NULL DEFAULT 'draft',
  subtotal_amount numeric(14, 4) NOT NULL DEFAULT 0,
  tax_amount numeric(14, 4) NOT NULL DEFAULT 0,
  return_total numeric(14, 4) NOT NULL DEFAULT 0,
  refund_mode varchar(50) NOT NULL DEFAULT 'none',
  refund_payment_method_id uuid REFERENCES payment_methods(id),
  refund_amount numeric(14, 4) NOT NULL DEFAULT 0,
  refund_reference_number varchar(255),
  payment_refund_id uuid REFERENCES payment_refunds(id),
  journal_entry_id uuid REFERENCES journal_entries(id),
  approved_by_user_id uuid REFERENCES users(id),
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  posted_by_user_id uuid REFERENCES users(id),
  posted_at timestamptz,
  cancelled_by_user_id uuid REFERENCES users(id),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_sales_returns_status CHECK (status IN ('draft', 'posted', 'cancelled')),
  CONSTRAINT chk_sales_returns_refund_mode CHECK (refund_mode IN ('none', 'refund')),
  CONSTRAINT chk_sales_returns_amounts CHECK (subtotal_amount >= 0 AND tax_amount >= 0 AND return_total >= 0 AND refund_amount >= 0)
);

CREATE TABLE IF NOT EXISTS sales_return_items (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  sales_return_id uuid NOT NULL REFERENCES sales_returns(id),
  sale_item_id uuid NOT NULL REFERENCES sale_items(id),
  product_id uuid NOT NULL REFERENCES products(id),
  product_variant_id uuid REFERENCES product_variants(id),
  product_name_snapshot varchar(255) NOT NULL,
  variant_name_snapshot varchar(255),
  sku_snapshot varchar(150),
  quantity numeric(14, 4) NOT NULL,
  unit_price numeric(14, 4) NOT NULL,
  discount_amount numeric(14, 4) NOT NULL DEFAULT 0,
  tax_rate_id uuid REFERENCES tax_rates(id),
  tax_rate_name_snapshot varchar(150),
  tax_rate_percentage_snapshot numeric(8, 4) NOT NULL DEFAULT 0,
  tax_amount numeric(14, 4) NOT NULL DEFAULT 0,
  line_subtotal numeric(14, 4) NOT NULL DEFAULT 0,
  line_total numeric(14, 4) NOT NULL DEFAULT 0,
  restock_action varchar(50) NOT NULL,
  stock_location_id uuid REFERENCES stock_locations(id),
  stock_movement_id uuid REFERENCES stock_movements(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_sales_return_items_quantity CHECK (quantity > 0),
  CONSTRAINT chk_sales_return_items_restock_action CHECK (restock_action IN ('restock', 'discard')),
  CONSTRAINT chk_sales_return_items_amounts CHECK (unit_price >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND line_subtotal >= 0 AND line_total >= 0)
);

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS return_status varchar(50) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS returned_amount numeric(14, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS return_refunded_amount numeric(14, 4) NOT NULL DEFAULT 0;

ALTER TABLE sales DROP CONSTRAINT IF EXISTS chk_sales_return_status;
ALTER TABLE sales
  ADD CONSTRAINT chk_sales_return_status CHECK (return_status IN ('none', 'partially_returned', 'returned'));

ALTER TABLE payment_refunds
  ADD COLUMN IF NOT EXISTS sales_return_id uuid REFERENCES sales_returns(id),
  ADD COLUMN IF NOT EXISTS refund_source varchar(50) NOT NULL DEFAULT 'payment_adjustment';

UPDATE payment_refunds
SET refund_source = 'payment_adjustment'
WHERE refund_source IS NULL OR refund_source = '';

ALTER TABLE payment_refunds DROP CONSTRAINT IF EXISTS chk_payment_refunds_source;
ALTER TABLE payment_refunds
  ADD CONSTRAINT chk_payment_refunds_source CHECK (refund_source IN ('payment_adjustment', 'sales_return'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_returns_business_return_number
  ON sales_returns(business_id, return_number)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_returns_business_id ON sales_returns(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_branch_id ON sales_returns(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_sale_id ON sales_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_customer_id ON sales_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_status ON sales_returns(status);
CREATE INDEX IF NOT EXISTS idx_sales_returns_return_date ON sales_returns(return_date);
CREATE INDEX IF NOT EXISTS idx_sales_returns_payment_refund_id ON sales_returns(payment_refund_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_journal_entry_id ON sales_returns(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_deleted_at ON sales_returns(deleted_at);

CREATE INDEX IF NOT EXISTS idx_sales_return_items_business_id ON sales_return_items(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_sales_return_id ON sales_return_items(sales_return_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_sale_item_id ON sales_return_items(sale_item_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_product_id ON sales_return_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_product_variant_id ON sales_return_items(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_stock_movement_id ON sales_return_items(stock_movement_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_deleted_at ON sales_return_items(deleted_at);

CREATE INDEX IF NOT EXISTS idx_sales_return_status ON sales(return_status);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_sales_return_id ON payment_refunds(sales_return_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_refund_source ON payment_refunds(refund_source);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_refunds_sales_return_unique
  ON payment_refunds(business_id, sales_return_id)
  WHERE sales_return_id IS NOT NULL AND deleted_at IS NULL;

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
  '4040',
  'Sales Returns and Allowances',
  'income',
  'sales_income',
  'debit',
  'Contra-income account for posted POS sales returns and credit notes.',
  true,
  true,
  false,
  'active',
  now(),
  now()
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1
  FROM chart_of_accounts coa
  WHERE coa.business_id = b.id
    AND lower(coa.account_code) = lower('4040')
    AND coa.deleted_at IS NULL
);

WITH permission_seed(module_name, permission_key, description) AS (
  VALUES
    ('sales_returns', 'sales_returns.view', 'View sales returns'),
    ('sales_returns', 'sales_returns.create', 'Create sales returns'),
    ('sales_returns', 'sales_returns.edit', 'Edit draft sales returns'),
    ('sales_returns', 'sales_returns.post', 'Post sales returns'),
    ('sales_returns', 'sales_returns.cancel', 'Cancel draft sales returns'),
    ('sales_returns', 'sales_returns.refund', 'Refund posted sales returns'),
    ('sales_returns', 'sales_returns.manage', 'Manage sales returns')
)
INSERT INTO permissions (id, module_name, permission_key, description, created_at, updated_at)
SELECT gen_random_uuid(), module_name, permission_key, description, now(), now()
FROM permission_seed
ON CONFLICT (permission_key) DO UPDATE
SET module_name = EXCLUDED.module_name,
    description = EXCLUDED.description,
    updated_at = now();

INSERT INTO role_permissions (id, role_id, permission_id, allowed, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, true, now(), now()
FROM roles r
CROSS JOIN permissions p
WHERE r.business_id IS NOT NULL
  AND r.role_name = 'Admin'
  AND p.permission_key LIKE 'sales_returns.%'
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );

WITH role_permission_seed(role_name, permission_key) AS (
  VALUES
    ('Cashier', 'sales_returns.view'),
    ('Cashier', 'sales_returns.create'),
    ('Manager', 'sales_returns.view'),
    ('Manager', 'sales_returns.create'),
    ('Manager', 'sales_returns.edit'),
    ('Manager', 'sales_returns.post'),
    ('Manager', 'sales_returns.cancel'),
    ('Manager', 'sales_returns.refund'),
    ('Manager', 'sales_returns.manage')
)
INSERT INTO role_permissions (id, role_id, permission_id, allowed, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, true, now(), now()
FROM role_permission_seed seed
JOIN roles r ON r.role_name = seed.role_name
JOIN permissions p ON p.permission_key = seed.permission_key
WHERE r.business_id IS NOT NULL
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );
