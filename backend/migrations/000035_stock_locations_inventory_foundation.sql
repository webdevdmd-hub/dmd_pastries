CREATE TABLE IF NOT EXISTS stock_locations (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  location_name varchar(150) NOT NULL,
  location_code varchar(80) NOT NULL,
  location_type varchar(50),
  description text,
  is_default boolean NOT NULL DEFAULT false,
  status varchar(50) NOT NULL DEFAULT 'active',
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_stock_locations_type CHECK (
    location_type IS NULL OR location_type IN (
      'kitchen',
      'store_room',
      'front_desk',
      'display_counter',
      'warehouse',
      'production_area',
      'pickup_area',
      'other'
    )
  ),
  CONSTRAINT chk_stock_locations_status CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX IF NOT EXISTS idx_stock_locations_business_id ON stock_locations(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_locations_branch_id ON stock_locations(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_locations_status ON stock_locations(status);
CREATE INDEX IF NOT EXISTS idx_stock_locations_deleted_at ON stock_locations(deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_locations_business_branch_code
  ON stock_locations(business_id, branch_id, LOWER(location_code))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_locations_one_default_per_branch
  ON stock_locations(business_id, branch_id)
  WHERE deleted_at IS NULL AND is_default = true;

CREATE TABLE IF NOT EXISTS inventory_location_balances (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
  stock_location_id uuid NOT NULL REFERENCES stock_locations(id),
  current_quantity numeric(14, 4) NOT NULL DEFAULT 0,
  reserved_quantity numeric(14, 4) NOT NULL DEFAULT 0,
  available_quantity numeric(14, 4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_inventory_location_balances_quantities CHECK (
    current_quantity >= 0
    AND reserved_quantity >= 0
    AND available_quantity >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_inventory_location_balances_business_id ON inventory_location_balances(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location_balances_branch_id ON inventory_location_balances(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location_balances_inventory_item_id ON inventory_location_balances(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location_balances_stock_location_id ON inventory_location_balances(stock_location_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_location_balances_item_location
  ON inventory_location_balances(inventory_item_id, stock_location_id);

CREATE TABLE IF NOT EXISTS stock_transfers (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  transfer_number varchar(100) NOT NULL,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
  from_stock_location_id uuid NOT NULL REFERENCES stock_locations(id),
  to_stock_location_id uuid NOT NULL REFERENCES stock_locations(id),
  quantity numeric(14, 4) NOT NULL,
  unit_id uuid NOT NULL REFERENCES units(id),
  reason text,
  notes text,
  status varchar(50) NOT NULL DEFAULT 'draft',
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  completed_by_user_id uuid REFERENCES users(id),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_stock_transfers_status CHECK (status IN ('draft', 'completed', 'cancelled')),
  CONSTRAINT chk_stock_transfers_quantity CHECK (quantity > 0),
  CONSTRAINT chk_stock_transfers_locations CHECK (from_stock_location_id <> to_stock_location_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_business_id ON stock_transfers(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_branch_id ON stock_transfers(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_inventory_item_id ON stock_transfers(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_deleted_at ON stock_transfers(deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_transfers_business_number
  ON stock_transfers(business_id, transfer_number)
  WHERE deleted_at IS NULL;

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS stock_location_id uuid REFERENCES stock_locations(id),
  ADD COLUMN IF NOT EXISTS from_stock_location_id uuid REFERENCES stock_locations(id),
  ADD COLUMN IF NOT EXISTS to_stock_location_id uuid REFERENCES stock_locations(id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_stock_location_id ON stock_movements(stock_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_from_stock_location_id ON stock_movements(from_stock_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_to_stock_location_id ON stock_movements(to_stock_location_id);

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS chk_stock_movement_type;
ALTER TABLE stock_movements
  ADD CONSTRAINT chk_stock_movement_type CHECK (movement_type IN (
    'opening_stock',
    'purchase_in',
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

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS chk_stock_movement_direction;
ALTER TABLE stock_movements
  ADD CONSTRAINT chk_stock_movement_direction
  CHECK (movement_direction IN ('in', 'out', 'neutral', 'transfer'));

WITH branch_creator AS (
  SELECT DISTINCT ON (u.business_id)
    u.business_id,
    u.id AS user_id
  FROM users u
  WHERE u.deleted_at IS NULL
  ORDER BY u.business_id, u.created_at ASC
)
INSERT INTO stock_locations (
  id,
  business_id,
  branch_id,
  location_name,
  location_code,
  location_type,
  is_default,
  status,
  created_by_user_id,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  b.business_id,
  b.id,
  'Main Stock',
  'MAIN',
  'store_room',
  true,
  'active',
  bc.user_id,
  now(),
  now()
FROM branches b
JOIN branch_creator bc ON bc.business_id = b.business_id
WHERE b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM stock_locations sl
    WHERE sl.business_id = b.business_id
      AND sl.branch_id = b.id
      AND sl.deleted_at IS NULL
  );

INSERT INTO inventory_location_balances (
  id,
  business_id,
  branch_id,
  inventory_item_id,
  stock_location_id,
  current_quantity,
  reserved_quantity,
  available_quantity,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  ii.business_id,
  ii.branch_id,
  ii.id,
  sl.id,
  ii.current_quantity,
  ii.reserved_quantity,
  ii.available_quantity,
  now(),
  now()
FROM inventory_items ii
JOIN stock_locations sl
  ON sl.business_id = ii.business_id
 AND sl.branch_id = ii.branch_id
 AND sl.is_default = true
 AND sl.deleted_at IS NULL
WHERE ii.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM inventory_location_balances ilb
    WHERE ilb.inventory_item_id = ii.id
      AND ilb.stock_location_id = sl.id
  );

WITH permission_seed(module_name, permission_key, description) AS (
  VALUES
    ('inventory', 'inventory.locations.manage', 'Manage stock locations'),
    ('inventory', 'inventory.transfer.create', 'Create internal stock transfers'),
    ('inventory', 'inventory.transfer.complete', 'Complete internal stock transfers'),
    ('inventory', 'inventory.transfer.cancel', 'Cancel internal stock transfers')
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
  AND r.deleted_at IS NULL
  AND p.permission_key IN (
    'inventory.locations.manage',
    'inventory.transfer.create',
    'inventory.transfer.complete',
    'inventory.transfer.cancel'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );

WITH role_permission_seed(role_name, permission_key) AS (
  VALUES
    ('Manager', 'inventory.locations.manage'),
    ('Manager', 'inventory.transfer.create'),
    ('Manager', 'inventory.transfer.complete'),
    ('Manager', 'inventory.transfer.cancel'),
    ('Inventory Clerk', 'inventory.locations.manage'),
    ('Inventory Clerk', 'inventory.transfer.create'),
    ('Inventory Clerk', 'inventory.transfer.complete'),
    ('Inventory Clerk', 'inventory.transfer.cancel')
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
