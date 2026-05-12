-- Sprint 4.2 recipes / BOM foundation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO permissions (id, module_name, permission_key, description, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'recipes', 'recipes.view', 'View recipes', now(), now()),
  (gen_random_uuid(), 'recipes', 'recipes.manage', 'Manage recipes', now(), now())
ON CONFLICT (permission_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  product_id uuid NOT NULL REFERENCES products(id),
  recipe_code varchar(100) NOT NULL,
  recipe_name varchar(255) NOT NULL,
  description text,
  batch_yield_quantity numeric(14, 4) NOT NULL,
  batch_yield_unit_id uuid NOT NULL REFERENCES units(id),
  preparation_time_minutes integer,
  instructions text,
  estimated_ingredient_cost numeric(14, 2) NOT NULL DEFAULT 0,
  estimated_packaging_cost numeric(14, 2) NOT NULL DEFAULT 0,
  estimated_total_cost numeric(14, 2) NOT NULL DEFAULT 0,
  cost_per_yield_unit numeric(14, 4) NOT NULL DEFAULT 0,
  version_number integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT false,
  status varchar(50) NOT NULL DEFAULT 'draft',
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_recipes_status CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  CONSTRAINT chk_recipes_yield CHECK (batch_yield_quantity > 0),
  CONSTRAINT chk_recipes_prep_time CHECK (preparation_time_minutes IS NULL OR preparation_time_minutes >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_business_code
  ON recipes(business_id, recipe_code)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_one_active_per_product
  ON recipes(business_id, product_id)
  WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recipes_business_id ON recipes(business_id);
CREATE INDEX IF NOT EXISTS idx_recipes_product_id ON recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_recipes_status ON recipes(status);
CREATE INDEX IF NOT EXISTS idx_recipes_deleted_at ON recipes(deleted_at);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  recipe_id uuid NOT NULL REFERENCES recipes(id),
  ingredient_id uuid,
  inventory_item_id uuid REFERENCES inventory_items(id),
  item_name_snapshot varchar(255) NOT NULL,
  quantity_required numeric(14, 4) NOT NULL,
  unit_id uuid NOT NULL REFERENCES units(id),
  unit_cost_snapshot numeric(14, 4) NOT NULL DEFAULT 0,
  total_cost numeric(14, 2) NOT NULL DEFAULT 0,
  wastage_percentage numeric(8, 4) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_recipe_ingredient_quantity CHECK (quantity_required > 0),
  CONSTRAINT chk_recipe_ingredient_wastage CHECK (wastage_percentage >= 0),
  CONSTRAINT chk_recipe_ingredient_reference CHECK (ingredient_id IS NOT NULL OR inventory_item_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_business_id ON recipe_ingredients(business_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_inventory_item_id ON recipe_ingredients(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_deleted_at ON recipe_ingredients(deleted_at);

CREATE TABLE IF NOT EXISTS recipe_packaging (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  recipe_id uuid NOT NULL REFERENCES recipes(id),
  packaging_item_id uuid NOT NULL REFERENCES packaging_items(id),
  packaging_name_snapshot varchar(255) NOT NULL,
  quantity_required numeric(14, 4) NOT NULL,
  unit_id uuid NOT NULL REFERENCES units(id),
  unit_cost_snapshot numeric(14, 4) NOT NULL DEFAULT 0,
  total_cost numeric(14, 2) NOT NULL DEFAULT 0,
  is_optional boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_recipe_packaging_quantity CHECK (quantity_required > 0)
);

CREATE INDEX IF NOT EXISTS idx_recipe_packaging_business_id ON recipe_packaging(business_id);
CREATE INDEX IF NOT EXISTS idx_recipe_packaging_recipe_id ON recipe_packaging(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_packaging_packaging_item_id ON recipe_packaging(packaging_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_packaging_deleted_at ON recipe_packaging(deleted_at);

CREATE TABLE IF NOT EXISTS recipe_versions (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  recipe_id uuid NOT NULL REFERENCES recipes(id),
  version_number integer NOT NULL,
  change_note text,
  snapshot_json jsonb NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipe_versions_business_id ON recipe_versions(business_id);
CREATE INDEX IF NOT EXISTS idx_recipe_versions_recipe_id ON recipe_versions(recipe_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_versions_recipe_version
  ON recipe_versions(recipe_id, version_number);
