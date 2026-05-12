-- Sprint 4.1 packaging module foundation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS packaging_items (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  packaging_category_id uuid NOT NULL REFERENCES packaging_categories(id),
  supplier_id uuid REFERENCES suppliers(id),
  packaging_name varchar(255) NOT NULL,
  packaging_code varchar(100) NOT NULL,
  description text,
  unit_id uuid NOT NULL REFERENCES units(id),
  cost_per_unit numeric(14, 4) NOT NULL DEFAULT 0,
  is_stock_tracked boolean NOT NULL DEFAULT true,
  is_consumable boolean NOT NULL DEFAULT true,
  reorder_level numeric(14, 4) NOT NULL DEFAULT 0,
  image_file_id varchar(500),
  status varchar(50) NOT NULL DEFAULT 'active',
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_packaging_items_status CHECK (status IN ('active', 'inactive')),
  CONSTRAINT chk_packaging_items_amounts CHECK (cost_per_unit >= 0 AND reorder_level >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_packaging_items_business_code
  ON packaging_items(business_id, packaging_code)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_packaging_items_business_id ON packaging_items(business_id);
CREATE INDEX IF NOT EXISTS idx_packaging_items_category_id ON packaging_items(packaging_category_id);
CREATE INDEX IF NOT EXISTS idx_packaging_items_supplier_id ON packaging_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_packaging_items_status ON packaging_items(status);
CREATE INDEX IF NOT EXISTS idx_packaging_items_stock_tracked ON packaging_items(is_stock_tracked);
CREATE INDEX IF NOT EXISTS idx_packaging_items_deleted_at ON packaging_items(deleted_at);

CREATE TABLE IF NOT EXISTS packaging_usage_rules (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  product_id uuid NOT NULL REFERENCES products(id),
  packaging_item_id uuid NOT NULL REFERENCES packaging_items(id),
  quantity_required numeric(14, 4) NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_packaging_usage_quantity CHECK (quantity_required > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_packaging_usage_unique_rule
  ON packaging_usage_rules(business_id, product_id, packaging_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_packaging_usage_one_default
  ON packaging_usage_rules(business_id, product_id)
  WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_packaging_usage_business_id ON packaging_usage_rules(business_id);
CREATE INDEX IF NOT EXISTS idx_packaging_usage_product_id ON packaging_usage_rules(product_id);
CREATE INDEX IF NOT EXISTS idx_packaging_usage_packaging_item_id ON packaging_usage_rules(packaging_item_id);
