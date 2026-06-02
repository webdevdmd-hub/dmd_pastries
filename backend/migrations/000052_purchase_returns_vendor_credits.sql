-- Purchase Return / Vendor Credit foundation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS purchase_returns (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  purchase_order_id uuid REFERENCES purchase_orders(id),
  purchase_invoice_id uuid NOT NULL REFERENCES purchase_invoices(id),
  purchase_receipt_id uuid NOT NULL REFERENCES purchase_receipts(id),
  return_number varchar(100) NOT NULL,
  return_date date NOT NULL,
  supplier_reference_number varchar(255),
  reason text,
  status varchar(50) NOT NULL DEFAULT 'draft',
  subtotal_amount numeric(14, 4) NOT NULL DEFAULT 0,
  tax_amount numeric(14, 4) NOT NULL DEFAULT 0,
  discount_amount numeric(14, 4) NOT NULL DEFAULT 0,
  return_total numeric(14, 4) NOT NULL DEFAULT 0,
  applied_credit_amount numeric(14, 4) NOT NULL DEFAULT 0,
  open_credit_amount numeric(14, 4) NOT NULL DEFAULT 0,
  journal_entry_id uuid REFERENCES journal_entries(id),
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  posted_by_user_id uuid REFERENCES users(id),
  posted_at timestamptz,
  cancelled_by_user_id uuid REFERENCES users(id),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_purchase_returns_status CHECK (status IN ('draft', 'posted', 'cancelled')),
  CONSTRAINT chk_purchase_returns_amounts CHECK (
    subtotal_amount >= 0
    AND tax_amount >= 0
    AND discount_amount >= 0
    AND return_total >= 0
    AND applied_credit_amount >= 0
    AND open_credit_amount >= 0
  )
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  purchase_return_id uuid NOT NULL REFERENCES purchase_returns(id),
  purchase_receipt_item_id uuid NOT NULL REFERENCES purchase_receipt_items(id),
  item_type varchar(50) NOT NULL,
  product_id uuid REFERENCES products(id),
  ingredient_id uuid REFERENCES ingredients(id),
  packaging_item_id uuid REFERENCES packaging_items(id),
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
  item_name_snapshot varchar(255) NOT NULL,
  quantity numeric(14, 4) NOT NULL,
  unit_id uuid NOT NULL REFERENCES units(id),
  unit_cost numeric(14, 4) NOT NULL DEFAULT 0,
  discount_amount numeric(14, 4) NOT NULL DEFAULT 0,
  tax_rate_id uuid REFERENCES tax_rates(id),
  tax_amount numeric(14, 4) NOT NULL DEFAULT 0,
  line_subtotal numeric(14, 4) NOT NULL DEFAULT 0,
  line_total numeric(14, 4) NOT NULL DEFAULT 0,
  stock_location_id uuid REFERENCES stock_locations(id),
  stock_movement_id uuid REFERENCES stock_movements(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_purchase_return_items_item_type CHECK (item_type IN ('product', 'ingredient', 'packaging')),
  CONSTRAINT chk_purchase_return_items_quantity CHECK (quantity > 0),
  CONSTRAINT chk_purchase_return_items_amounts CHECK (
    unit_cost >= 0
    AND discount_amount >= 0
    AND tax_amount >= 0
    AND line_subtotal >= 0
    AND line_total >= 0
  )
);

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS returned_amount numeric(14, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credited_amount numeric(14, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS return_status varchar(50) NOT NULL DEFAULT 'none';

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS chk_stock_movement_type;
ALTER TABLE stock_movements
  ADD CONSTRAINT chk_stock_movement_type CHECK (movement_type IN (
    'opening_stock',
    'purchase_in',
    'purchase_return_out',
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

UPDATE purchase_invoices
SET return_status = 'none'
WHERE return_status IS NULL OR return_status = '';

ALTER TABLE purchase_invoices DROP CONSTRAINT IF EXISTS chk_purchase_invoices_return_status;
ALTER TABLE purchase_invoices
  ADD CONSTRAINT chk_purchase_invoices_return_status CHECK (return_status IN ('none', 'partially_returned', 'returned'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_returns_business_return_number
  ON purchase_returns(business_id, return_number)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_returns_business_id ON purchase_returns(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_branch_id ON purchase_returns(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier_id ON purchase_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_purchase_order_id ON purchase_returns(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_purchase_invoice_id ON purchase_returns(purchase_invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_purchase_receipt_id ON purchase_returns(purchase_receipt_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_status ON purchase_returns(status);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_return_date ON purchase_returns(return_date);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_journal_entry_id ON purchase_returns(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_deleted_at ON purchase_returns(deleted_at);

CREATE INDEX IF NOT EXISTS idx_purchase_return_items_business_id ON purchase_return_items(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_purchase_return_id ON purchase_return_items(purchase_return_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_purchase_receipt_item_id ON purchase_return_items(purchase_receipt_item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_inventory_item_id ON purchase_return_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_stock_movement_id ON purchase_return_items(stock_movement_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_deleted_at ON purchase_return_items(deleted_at);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_return_status ON purchase_invoices(return_status);

WITH permission_seed(module_name, permission_key, description) AS (
  VALUES
    ('purchasing', 'purchasing.returns.view', 'View purchase returns and vendor credits'),
    ('purchasing', 'purchasing.returns.create', 'Create purchase returns and vendor credits'),
    ('purchasing', 'purchasing.returns.edit', 'Edit draft purchase returns and vendor credits'),
    ('purchasing', 'purchasing.returns.post', 'Post purchase returns and vendor credits'),
    ('purchasing', 'purchasing.returns.cancel', 'Cancel draft purchase returns and vendor credits'),
    ('purchasing', 'purchasing.returns.manage', 'Manage purchase returns and vendor credits')
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
  AND p.permission_key LIKE 'purchasing.returns.%'
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );

WITH role_permission_seed(role_name, permission_key) AS (
  VALUES
    ('Manager', 'purchasing.returns.view'),
    ('Manager', 'purchasing.returns.create'),
    ('Manager', 'purchasing.returns.edit'),
    ('Manager', 'purchasing.returns.post'),
    ('Manager', 'purchasing.returns.cancel'),
    ('Manager', 'purchasing.returns.manage'),
    ('Inventory Clerk', 'purchasing.returns.view'),
    ('Inventory Clerk', 'purchasing.returns.create'),
    ('Inventory Clerk', 'purchasing.returns.edit'),
    ('Inventory Clerk', 'purchasing.returns.post'),
    ('Inventory Clerk', 'purchasing.returns.cancel')
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
