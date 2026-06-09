-- Phase 5: allow recipes/BOM lines to use Product Master products as components.

ALTER TABLE recipe_ingredients
  ADD COLUMN IF NOT EXISTS component_product_id uuid,
  ADD COLUMN IF NOT EXISTS component_variant_id uuid;

ALTER TABLE recipe_packaging
  ADD COLUMN IF NOT EXISTS component_product_id uuid,
  ADD COLUMN IF NOT EXISTS component_variant_id uuid;

ALTER TABLE recipe_packaging
  ALTER COLUMN packaging_item_id DROP NOT NULL;

ALTER TABLE recipe_ingredients
  DROP CONSTRAINT IF EXISTS chk_recipe_ingredient_reference;

ALTER TABLE recipe_ingredients
  ADD CONSTRAINT chk_recipe_ingredient_reference CHECK (
    ingredient_id IS NOT NULL
    OR inventory_item_id IS NOT NULL
    OR component_product_id IS NOT NULL
  );

ALTER TABLE recipe_packaging
  DROP CONSTRAINT IF EXISTS chk_recipe_packaging_reference;

ALTER TABLE recipe_packaging
  ADD CONSTRAINT chk_recipe_packaging_reference CHECK (
    packaging_item_id IS NOT NULL
    OR component_product_id IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_component_product
  ON recipe_ingredients(component_product_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_component_variant
  ON recipe_ingredients(component_variant_id);

CREATE INDEX IF NOT EXISTS idx_recipe_packaging_component_product
  ON recipe_packaging(component_product_id);

CREATE INDEX IF NOT EXISTS idx_recipe_packaging_component_variant
  ON recipe_packaging(component_variant_id);
