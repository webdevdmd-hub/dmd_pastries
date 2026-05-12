-- Sprint 3.4 purchasing foundation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO permissions (id, module_name, permission_key, description, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'purchasing', 'purchasing.view', 'View purchasing', now(), now()),
  (gen_random_uuid(), 'purchasing', 'purchasing.manage', 'Manage purchasing', now(), now())
ON CONFLICT (permission_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  purchase_order_number varchar(100) NOT NULL,
  order_date date NOT NULL,
  expected_delivery_date date,
  status varchar(50) NOT NULL DEFAULT 'draft',
  subtotal_amount numeric(14, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(14, 2) NOT NULL DEFAULT 0,
  discount_amount numeric(14, 2) NOT NULL DEFAULT 0,
  total_amount numeric(14, 2) NOT NULL DEFAULT 0,
  notes text,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_purchase_orders_status CHECK (status IN ('draft', 'ordered', 'partially_received', 'received', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_business_number
  ON purchase_orders(business_id, purchase_order_number)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_business_id ON purchase_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch_id ON purchase_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_date ON purchase_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_deleted_at ON purchase_orders(deleted_at);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
  item_type varchar(50) NOT NULL,
  product_id uuid REFERENCES products(id),
  ingredient_id uuid,
  packaging_item_id uuid,
  item_name_snapshot varchar(255) NOT NULL,
  quantity_ordered numeric(14, 4) NOT NULL,
  quantity_received numeric(14, 4) NOT NULL DEFAULT 0,
  unit_id uuid NOT NULL REFERENCES units(id),
  unit_cost numeric(14, 4) NOT NULL DEFAULT 0,
  discount_amount numeric(14, 2) NOT NULL DEFAULT 0,
  tax_rate_id uuid REFERENCES tax_rates(id),
  tax_amount numeric(14, 2) NOT NULL DEFAULT 0,
  line_total numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_po_item_type CHECK (item_type IN ('product', 'ingredient', 'packaging')),
  CONSTRAINT chk_po_item_single_reference CHECK (
    ((product_id IS NOT NULL)::int + (ingredient_id IS NOT NULL)::int + (packaging_item_id IS NOT NULL)::int) = 1
  ),
  CONSTRAINT chk_po_item_quantity CHECK (quantity_ordered > 0 AND quantity_received >= 0 AND quantity_received <= quantity_ordered),
  CONSTRAINT chk_po_item_amounts CHECK (unit_cost >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_business_id ON purchase_order_items(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order_id ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_deleted_at ON purchase_order_items(deleted_at);

CREATE TABLE IF NOT EXISTS purchase_invoices (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  purchase_order_id uuid REFERENCES purchase_orders(id),
  invoice_number varchar(150) NOT NULL,
  invoice_date date NOT NULL,
  due_date date,
  status varchar(50) NOT NULL DEFAULT 'draft',
  payment_status varchar(50) NOT NULL DEFAULT 'unpaid',
  subtotal_amount numeric(14, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(14, 2) NOT NULL DEFAULT 0,
  discount_amount numeric(14, 2) NOT NULL DEFAULT 0,
  total_amount numeric(14, 2) NOT NULL DEFAULT 0,
  paid_amount numeric(14, 2) NOT NULL DEFAULT 0,
  balance_amount numeric(14, 2) NOT NULL DEFAULT 0,
  notes text,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_purchase_invoice_status CHECK (status IN ('draft', 'posted', 'cancelled')),
  CONSTRAINT chk_purchase_invoice_payment_status CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overdue'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_invoices_business_supplier_number
  ON purchase_invoices(business_id, supplier_id, invoice_number)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_business_id ON purchase_invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_branch_id ON purchase_invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier_id ON purchase_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_order_id ON purchase_invoices(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_status ON purchase_invoices(status);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_payment_status ON purchase_invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_invoice_date ON purchase_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_deleted_at ON purchase_invoices(deleted_at);

CREATE TABLE IF NOT EXISTS purchase_invoice_items (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  purchase_invoice_id uuid NOT NULL REFERENCES purchase_invoices(id),
  item_type varchar(50) NOT NULL,
  product_id uuid REFERENCES products(id),
  ingredient_id uuid,
  packaging_item_id uuid,
  item_name_snapshot varchar(255) NOT NULL,
  quantity numeric(14, 4) NOT NULL,
  unit_id uuid NOT NULL REFERENCES units(id),
  unit_cost numeric(14, 4) NOT NULL DEFAULT 0,
  discount_amount numeric(14, 2) NOT NULL DEFAULT 0,
  tax_rate_id uuid REFERENCES tax_rates(id),
  tax_amount numeric(14, 2) NOT NULL DEFAULT 0,
  line_total numeric(14, 2) NOT NULL DEFAULT 0,
  expiry_date date,
  batch_number varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_pi_item_type CHECK (item_type IN ('product', 'ingredient', 'packaging')),
  CONSTRAINT chk_pi_item_single_reference CHECK (
    ((product_id IS NOT NULL)::int + (ingredient_id IS NOT NULL)::int + (packaging_item_id IS NOT NULL)::int) = 1
  ),
  CONSTRAINT chk_pi_item_quantity CHECK (quantity > 0),
  CONSTRAINT chk_pi_item_amounts CHECK (unit_cost >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_business_id ON purchase_invoice_items(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_invoice_id ON purchase_invoice_items(purchase_invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_deleted_at ON purchase_invoice_items(deleted_at);

CREATE TABLE IF NOT EXISTS purchase_receipts (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  purchase_order_id uuid REFERENCES purchase_orders(id),
  purchase_invoice_id uuid REFERENCES purchase_invoices(id),
  receipt_number varchar(100) NOT NULL,
  received_date date NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'posted',
  received_by_user_id uuid NOT NULL REFERENCES users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_purchase_receipt_status CHECK (status IN ('draft', 'posted', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_receipts_business_number
  ON purchase_receipts(business_id, receipt_number)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_business_id ON purchase_receipts(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_branch_id ON purchase_receipts(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_supplier_id ON purchase_receipts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_order_id ON purchase_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_invoice_id ON purchase_receipts(purchase_invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_status ON purchase_receipts(status);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_received_date ON purchase_receipts(received_date);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_deleted_at ON purchase_receipts(deleted_at);

CREATE TABLE IF NOT EXISTS purchase_receipt_items (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  purchase_receipt_id uuid NOT NULL REFERENCES purchase_receipts(id),
  item_type varchar(50) NOT NULL,
  product_id uuid REFERENCES products(id),
  ingredient_id uuid,
  packaging_item_id uuid,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
  quantity_received numeric(14, 4) NOT NULL,
  unit_id uuid NOT NULL REFERENCES units(id),
  expiry_date date,
  batch_number varchar(100),
  stock_movement_id uuid REFERENCES stock_movements(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_pr_item_type CHECK (item_type IN ('product', 'ingredient', 'packaging')),
  CONSTRAINT chk_pr_item_single_reference CHECK (
    ((product_id IS NOT NULL)::int + (ingredient_id IS NOT NULL)::int + (packaging_item_id IS NOT NULL)::int) = 1
  ),
  CONSTRAINT chk_pr_item_quantity CHECK (quantity_received > 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_business_id ON purchase_receipt_items(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_receipt_id ON purchase_receipt_items(purchase_receipt_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_inventory_item_id ON purchase_receipt_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_stock_movement_id ON purchase_receipt_items(stock_movement_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_deleted_at ON purchase_receipt_items(deleted_at);
