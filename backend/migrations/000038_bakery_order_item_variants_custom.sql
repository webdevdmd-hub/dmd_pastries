-- Support product variants and one-off custom items in bakery orders.

ALTER TABLE bakery_order_items
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE bakery_order_items
  ADD COLUMN IF NOT EXISTS product_variant_id UUID NULL REFERENCES product_variants(id),
  ADD COLUMN IF NOT EXISTS product_variant_name_snapshot VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS item_name_snapshot VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS item_source VARCHAR(50) NOT NULL DEFAULT 'catalog';

UPDATE bakery_order_items
SET
  item_source = COALESCE(NULLIF(item_source, ''), 'catalog'),
  item_name_snapshot = COALESCE(NULLIF(item_name_snapshot, ''), product_name_snapshot)
WHERE item_name_snapshot = '' OR item_source = '';

ALTER TABLE bakery_order_items
  DROP CONSTRAINT IF EXISTS chk_bakery_order_items_source;

ALTER TABLE bakery_order_items
  ADD CONSTRAINT chk_bakery_order_items_source CHECK (
    item_source IN ('catalog', 'custom')
    AND (
      (item_source = 'catalog' AND product_id IS NOT NULL AND item_name_snapshot <> '')
      OR
      (item_source = 'custom' AND product_id IS NULL AND product_variant_id IS NULL AND item_name_snapshot <> '')
    )
  );

CREATE INDEX IF NOT EXISTS idx_bakery_order_items_product_variant
  ON bakery_order_items(product_variant_id);

CREATE INDEX IF NOT EXISTS idx_bakery_order_items_source
  ON bakery_order_items(item_source);
