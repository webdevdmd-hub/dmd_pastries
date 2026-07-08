ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_purchasable boolean NOT NULL DEFAULT false;

UPDATE products
SET is_purchasable = TRUE
WHERE deleted_at IS NULL
  AND product_type IN ('ingredient', 'packaging', 'raw_material', 'semi_finished', 'consumable', 'equipment');

UPDATE products
SET is_purchasable = FALSE
WHERE deleted_at IS NULL
  AND product_type IN ('finished_product', 'service');

CREATE INDEX IF NOT EXISTS idx_products_purchasable
  ON products(business_id, branch_id, status, is_purchasable)
  WHERE deleted_at IS NULL;
