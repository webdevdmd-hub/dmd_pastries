-- Phase 6: allow manufacturing consumption rows to reference Product Master components.

ALTER TABLE production_ingredient_consumptions
  ADD COLUMN IF NOT EXISTS component_product_id uuid,
  ADD COLUMN IF NOT EXISTS component_variant_id uuid;

ALTER TABLE production_packaging_consumptions
  ADD COLUMN IF NOT EXISTS component_product_id uuid,
  ADD COLUMN IF NOT EXISTS component_variant_id uuid,
  ADD COLUMN IF NOT EXISTS inventory_item_id uuid;

ALTER TABLE production_packaging_consumptions
  ALTER COLUMN packaging_item_id DROP NOT NULL;

ALTER TABLE production_packaging_consumptions
  DROP CONSTRAINT IF EXISTS chk_production_packaging_reference;

ALTER TABLE production_packaging_consumptions
  ADD CONSTRAINT chk_production_packaging_reference CHECK (
    packaging_item_id IS NOT NULL
    OR inventory_item_id IS NOT NULL
    OR component_product_id IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_production_ingredients_component_product
  ON production_ingredient_consumptions(component_product_id);

CREATE INDEX IF NOT EXISTS idx_production_ingredients_component_variant
  ON production_ingredient_consumptions(component_variant_id);

CREATE INDEX IF NOT EXISTS idx_production_packaging_inventory_item
  ON production_packaging_consumptions(inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_production_packaging_component_product
  ON production_packaging_consumptions(component_product_id);

CREATE INDEX IF NOT EXISTS idx_production_packaging_component_variant
  ON production_packaging_consumptions(component_variant_id);
