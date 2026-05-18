-- Allow recipes/manufacturing to output directly into a product variant.

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS product_variant_id uuid REFERENCES product_variants(id);

ALTER TABLE production_batches
  ADD COLUMN IF NOT EXISTS product_variant_id uuid REFERENCES product_variants(id);

ALTER TABLE production_outputs
  ADD COLUMN IF NOT EXISTS product_variant_id uuid REFERENCES product_variants(id);

DROP INDEX IF EXISTS idx_recipes_one_active_per_product;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_one_active_per_product_root
  ON recipes(business_id, product_id)
  WHERE product_variant_id IS NULL
    AND is_active = true
    AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_one_active_per_product_variant
  ON recipes(business_id, product_id, product_variant_id)
  WHERE product_variant_id IS NOT NULL
    AND is_active = true
    AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_recipes_product_variant_id
  ON recipes(product_variant_id);

CREATE INDEX IF NOT EXISTS idx_production_batches_product_variant_id
  ON production_batches(product_variant_id);

CREATE INDEX IF NOT EXISTS idx_production_outputs_product_variant_id
  ON production_outputs(product_variant_id);
