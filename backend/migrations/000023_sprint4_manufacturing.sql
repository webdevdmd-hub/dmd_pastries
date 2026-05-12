-- Sprint 4.3 manufacturing / production foundation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO permissions (id, module_name, permission_key, description, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'manufacturing', 'manufacturing.view', 'View manufacturing', now(), now()),
  (gen_random_uuid(), 'manufacturing', 'manufacturing.manage', 'Manage manufacturing', now(), now())
ON CONFLICT (permission_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS production_batches (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  recipe_id uuid NOT NULL REFERENCES recipes(id),
  product_id uuid NOT NULL REFERENCES products(id),
  production_batch_number varchar(100) NOT NULL,
  planned_quantity numeric(14, 4) NOT NULL,
  produced_quantity numeric(14, 4) NOT NULL DEFAULT 0,
  yield_unit_id uuid NOT NULL REFERENCES units(id),
  status varchar(50) NOT NULL DEFAULT 'draft',
  production_date date NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  ingredient_cost numeric(14, 2) NOT NULL DEFAULT 0,
  packaging_cost numeric(14, 2) NOT NULL DEFAULT 0,
  total_production_cost numeric(14, 2) NOT NULL DEFAULT 0,
  cost_per_unit numeric(14, 4) NOT NULL DEFAULT 0,
  wastage_quantity numeric(14, 4) NOT NULL DEFAULT 0,
  wastage_reason text,
  notes text,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  updated_by_user_id uuid NOT NULL REFERENCES users(id),
  completed_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_production_batches_status CHECK (status IN ('draft', 'planned', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT chk_production_batches_planned CHECK (planned_quantity > 0),
  CONSTRAINT chk_production_batches_produced CHECK (produced_quantity >= 0),
  CONSTRAINT chk_production_batches_wastage CHECK (wastage_quantity >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_production_batches_business_number
  ON production_batches(business_id, production_batch_number)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_production_batches_business_id ON production_batches(business_id);
CREATE INDEX IF NOT EXISTS idx_production_batches_branch_id ON production_batches(branch_id);
CREATE INDEX IF NOT EXISTS idx_production_batches_recipe_id ON production_batches(recipe_id);
CREATE INDEX IF NOT EXISTS idx_production_batches_product_id ON production_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_production_batches_status ON production_batches(status);
CREATE INDEX IF NOT EXISTS idx_production_batches_production_date ON production_batches(production_date);
CREATE INDEX IF NOT EXISTS idx_production_batches_deleted_at ON production_batches(deleted_at);

CREATE TABLE IF NOT EXISTS production_ingredient_consumptions (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  production_batch_id uuid NOT NULL REFERENCES production_batches(id),
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
  recipe_ingredient_id uuid NOT NULL REFERENCES recipe_ingredients(id),
  item_name_snapshot varchar(255) NOT NULL,
  planned_quantity numeric(14, 4) NOT NULL,
  actual_quantity numeric(14, 4) NOT NULL,
  unit_id uuid NOT NULL REFERENCES units(id),
  unit_cost_snapshot numeric(14, 4) NOT NULL DEFAULT 0,
  total_cost numeric(14, 2) NOT NULL DEFAULT 0,
  wastage_quantity numeric(14, 4) NOT NULL DEFAULT 0,
  stock_movement_id uuid REFERENCES stock_movements(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_production_ingredient_planned CHECK (planned_quantity > 0),
  CONSTRAINT chk_production_ingredient_actual CHECK (actual_quantity >= 0),
  CONSTRAINT chk_production_ingredient_wastage CHECK (wastage_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_production_ingredients_business_id ON production_ingredient_consumptions(business_id);
CREATE INDEX IF NOT EXISTS idx_production_ingredients_batch_id ON production_ingredient_consumptions(production_batch_id);
CREATE INDEX IF NOT EXISTS idx_production_ingredients_inventory_item_id ON production_ingredient_consumptions(inventory_item_id);

CREATE TABLE IF NOT EXISTS production_packaging_consumptions (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  production_batch_id uuid NOT NULL REFERENCES production_batches(id),
  packaging_item_id uuid NOT NULL REFERENCES packaging_items(id),
  recipe_packaging_id uuid NOT NULL REFERENCES recipe_packaging(id),
  packaging_name_snapshot varchar(255) NOT NULL,
  planned_quantity numeric(14, 4) NOT NULL,
  actual_quantity numeric(14, 4) NOT NULL,
  unit_id uuid NOT NULL REFERENCES units(id),
  unit_cost_snapshot numeric(14, 4) NOT NULL DEFAULT 0,
  total_cost numeric(14, 2) NOT NULL DEFAULT 0,
  is_optional boolean NOT NULL DEFAULT false,
  stock_movement_id uuid REFERENCES stock_movements(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_production_packaging_planned CHECK (planned_quantity > 0),
  CONSTRAINT chk_production_packaging_actual CHECK (actual_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_production_packaging_business_id ON production_packaging_consumptions(business_id);
CREATE INDEX IF NOT EXISTS idx_production_packaging_batch_id ON production_packaging_consumptions(production_batch_id);
CREATE INDEX IF NOT EXISTS idx_production_packaging_item_id ON production_packaging_consumptions(packaging_item_id);

CREATE TABLE IF NOT EXISTS production_outputs (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  production_batch_id uuid NOT NULL REFERENCES production_batches(id),
  product_id uuid NOT NULL REFERENCES products(id),
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
  produced_quantity numeric(14, 4) NOT NULL,
  unit_id uuid NOT NULL REFERENCES units(id),
  batch_number varchar(100),
  expiry_date date,
  stock_movement_id uuid REFERENCES stock_movements(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_production_output_quantity CHECK (produced_quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_production_outputs_business_id ON production_outputs(business_id);
CREATE INDEX IF NOT EXISTS idx_production_outputs_batch_id ON production_outputs(production_batch_id);
CREATE INDEX IF NOT EXISTS idx_production_outputs_product_id ON production_outputs(product_id);
