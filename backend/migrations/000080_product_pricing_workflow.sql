ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_update_policy VARCHAR(50) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(30) NOT NULL DEFAULT 'markup',
  ADD COLUMN IF NOT EXISTS pricing_percent NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_sale_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS suggested_sale_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS auto_price_update_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sale_price_locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_purchase_cost NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS last_purchase_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_production_cost NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS last_production_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS average_inventory_cost NUMERIC(12,4);

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS cost_update_policy VARCHAR(50) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(30) NOT NULL DEFAULT 'markup',
  ADD COLUMN IF NOT EXISTS pricing_percent NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_sale_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS suggested_sale_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS auto_price_update_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sale_price_locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_purchase_cost NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS last_purchase_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_production_cost NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS last_production_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS average_inventory_cost NUMERIC(12,4);

CREATE TABLE IF NOT EXISTS product_price_suggestions (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  product_id UUID NOT NULL,
  product_variant_id UUID,
  current_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
  previous_cost NUMERIC(12,4),
  current_sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  suggested_sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  pricing_type VARCHAR(30) NOT NULL DEFAULT 'markup',
  pricing_percent NUMERIC(12,4) NOT NULL DEFAULT 0,
  source_type VARCHAR(80) NOT NULL,
  source_id UUID,
  source_number VARCHAR(120),
  reason TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_product_price_suggestions_business_branch_status
  ON product_price_suggestions (business_id, branch_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_price_suggestions_product
  ON product_price_suggestions (product_id, product_variant_id)
  WHERE deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_cost_update_policy'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT chk_products_cost_update_policy
      CHECK (cost_update_policy IN ('manual', 'latest_purchase', 'weighted_average', 'recipe_actual'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_pricing_type'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT chk_products_pricing_type
      CHECK (pricing_type IN ('markup', 'margin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_product_variants_cost_update_policy'
  ) THEN
    ALTER TABLE product_variants ADD CONSTRAINT chk_product_variants_cost_update_policy
      CHECK (cost_update_policy IN ('manual', 'latest_purchase', 'weighted_average', 'recipe_actual'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_product_variants_pricing_type'
  ) THEN
    ALTER TABLE product_variants ADD CONSTRAINT chk_product_variants_pricing_type
      CHECK (pricing_type IN ('markup', 'margin'));
  END IF;
END $$;
