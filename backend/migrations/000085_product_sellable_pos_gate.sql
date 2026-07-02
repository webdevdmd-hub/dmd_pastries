ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_sellable BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE products
SET is_sellable = TRUE
WHERE product_type IN ('finished_product', 'service', 'ready_to_sell', 'made_to_order', 'retail')
  AND deleted_at IS NULL;

UPDATE products
SET is_sellable = FALSE
WHERE product_type IN ('ingredient', 'packaging', 'raw_material', 'semi_finished', 'consumable', 'equipment', 'manufactured')
  AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_pos_sellable
  ON products(business_id, branch_id, status, is_pos_visible, is_sellable)
  WHERE deleted_at IS NULL;
