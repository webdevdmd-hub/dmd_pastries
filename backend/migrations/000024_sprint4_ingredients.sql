-- Sprint 4.4 ingredient catalog foundation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ingredients (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  ingredient_category_id uuid NOT NULL REFERENCES ingredient_categories(id),
  supplier_id uuid REFERENCES suppliers(id),
  ingredient_name varchar(255) NOT NULL,
  ingredient_code varchar(100) NOT NULL,
  description text,
  unit_id uuid NOT NULL REFERENCES units(id),
  cost_per_unit numeric(14, 4) NOT NULL DEFAULT 0,
  is_stock_tracked boolean NOT NULL DEFAULT true,
  is_expiry_tracked boolean NOT NULL DEFAULT true,
  reorder_level numeric(14, 4) NOT NULL DEFAULT 0,
  image_file_id varchar(500),
  status varchar(50) NOT NULL DEFAULT 'active',
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_ingredients_status CHECK (status IN ('active', 'inactive')),
  CONSTRAINT chk_ingredients_amounts CHECK (cost_per_unit >= 0 AND reorder_level >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_business_code
  ON ingredients(business_id, ingredient_code)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_business_name
  ON ingredients(business_id, lower(ingredient_name))
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ingredients_business_id ON ingredients(business_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_category_id ON ingredients(ingredient_category_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_supplier_id ON ingredients(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_status ON ingredients(status);
CREATE INDEX IF NOT EXISTS idx_ingredients_stock_tracked ON ingredients(is_stock_tracked);
CREATE INDEX IF NOT EXISTS idx_ingredients_expiry_tracked ON ingredients(is_expiry_tracked);
CREATE INDEX IF NOT EXISTS idx_ingredients_deleted_at ON ingredients(deleted_at);
CREATE INDEX IF NOT EXISTS idx_inventory_items_ingredient_id ON inventory_items(ingredient_id);
