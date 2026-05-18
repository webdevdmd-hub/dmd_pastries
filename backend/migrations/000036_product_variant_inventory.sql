-- Product variant-level inventory support.

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS product_variant_id uuid REFERENCES product_variants(id);

DROP INDEX IF EXISTS idx_inventory_unique_active_item;

ALTER TABLE inventory_items
  DROP CONSTRAINT IF EXISTS chk_inventory_item_type;
ALTER TABLE inventory_items
  ADD CONSTRAINT chk_inventory_item_type CHECK (item_type IN ('product', 'product_variant', 'ingredient', 'packaging'));

ALTER TABLE inventory_items
  DROP CONSTRAINT IF EXISTS chk_inventory_single_item_reference;
ALTER TABLE inventory_items
  ADD CONSTRAINT chk_inventory_single_item_reference CHECK (
    (
      item_type = 'product'
      AND product_id IS NOT NULL
      AND product_variant_id IS NULL
      AND ingredient_id IS NULL
      AND packaging_item_id IS NULL
    )
    OR (
      item_type = 'product_variant'
      AND product_id IS NOT NULL
      AND product_variant_id IS NOT NULL
      AND ingredient_id IS NULL
      AND packaging_item_id IS NULL
    )
    OR (
      item_type = 'ingredient'
      AND product_id IS NULL
      AND product_variant_id IS NULL
      AND ingredient_id IS NOT NULL
      AND packaging_item_id IS NULL
    )
    OR (
      item_type = 'packaging'
      AND product_id IS NULL
      AND product_variant_id IS NULL
      AND ingredient_id IS NULL
      AND packaging_item_id IS NOT NULL
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_unique_active_item
  ON inventory_items (
    business_id,
    branch_id,
    item_type,
    COALESCE(product_variant_id, product_id, ingredient_id, packaging_item_id)
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_product_variant_id ON inventory_items(product_variant_id);

ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS chk_stock_movement_item_type;
ALTER TABLE stock_movements
  ADD CONSTRAINT chk_stock_movement_item_type CHECK (item_type IN ('product', 'product_variant', 'ingredient', 'packaging'));
