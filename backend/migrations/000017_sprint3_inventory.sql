-- Sprint 3.1 inventory core foundation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  product_id uuid REFERENCES products(id),
  ingredient_id uuid,
  packaging_item_id uuid,
  item_type varchar(50) NOT NULL,
  current_quantity numeric(14, 4) NOT NULL DEFAULT 0,
  reserved_quantity numeric(14, 4) NOT NULL DEFAULT 0,
  available_quantity numeric(14, 4) NOT NULL DEFAULT 0,
  reorder_level numeric(14, 4) NOT NULL DEFAULT 0,
  unit_id uuid NOT NULL REFERENCES units(id),
  is_expiry_tracked boolean NOT NULL DEFAULT false,
  status varchar(50) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_inventory_item_type CHECK (item_type IN ('product', 'ingredient', 'packaging')),
  CONSTRAINT chk_inventory_status CHECK (status IN ('active', 'inactive')),
  CONSTRAINT chk_inventory_quantities CHECK (
    current_quantity >= 0
    AND reserved_quantity >= 0
    AND available_quantity >= 0
    AND reorder_level >= 0
  ),
  CONSTRAINT chk_inventory_single_item_reference CHECK (
    ((product_id IS NOT NULL)::int + (ingredient_id IS NOT NULL)::int + (packaging_item_id IS NOT NULL)::int) = 1
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_unique_active_item
  ON inventory_items (
    business_id,
    branch_id,
    item_type,
    COALESCE(product_id, ingredient_id, packaging_item_id)
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_business_id ON inventory_items(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_branch_id ON inventory_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_product_id ON inventory_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_deleted_at ON inventory_items(deleted_at);

CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
  item_type varchar(50) NOT NULL,
  movement_type varchar(50) NOT NULL,
  quantity numeric(14, 4) NOT NULL,
  before_quantity numeric(14, 4) NOT NULL,
  after_quantity numeric(14, 4) NOT NULL,
  unit_id uuid NOT NULL REFERENCES units(id),
  reference_type varchar(100),
  reference_id uuid,
  reason text,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_stock_movement_item_type CHECK (item_type IN ('product', 'ingredient', 'packaging')),
  CONSTRAINT chk_stock_movement_type CHECK (movement_type IN (
    'opening_stock',
    'purchase_in',
    'sale_out',
    'adjustment_in',
    'adjustment_out',
    'wastage',
    'return_in',
    'transfer_in',
    'transfer_out',
    'production_in',
    'production_out'
  )),
  CONSTRAINT chk_stock_movement_quantity CHECK (quantity > 0),
  CONSTRAINT chk_stock_movement_balances CHECK (before_quantity >= 0 AND after_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_business_id ON stock_movements(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_branch_id ON stock_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory_item_id ON stock_movements(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
  adjustment_type varchar(50) NOT NULL,
  quantity numeric(14, 4) NOT NULL,
  reason text NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_inventory_adjustment_type CHECK (adjustment_type IN ('increase', 'decrease')),
  CONSTRAINT chk_inventory_adjustment_quantity CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_business_id ON inventory_adjustments(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_inventory_item_id ON inventory_adjustments(inventory_item_id);

CREATE TABLE IF NOT EXISTS expiry_batches (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
  batch_number varchar(100),
  quantity numeric(14, 4) NOT NULL,
  expiry_date date NOT NULL,
  received_date date NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_expiry_batch_quantity CHECK (quantity > 0),
  CONSTRAINT chk_expiry_batch_status CHECK (status IN ('active', 'expired', 'depleted')),
  CONSTRAINT chk_expiry_batch_dates CHECK (expiry_date >= received_date)
);

CREATE INDEX IF NOT EXISTS idx_expiry_batches_business_id ON expiry_batches(business_id);
CREATE INDEX IF NOT EXISTS idx_expiry_batches_branch_id ON expiry_batches(branch_id);
CREATE INDEX IF NOT EXISTS idx_expiry_batches_inventory_item_id ON expiry_batches(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_expiry_batches_expiry_date ON expiry_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_expiry_batches_status ON expiry_batches(status);
CREATE INDEX IF NOT EXISTS idx_expiry_batches_deleted_at ON expiry_batches(deleted_at);
