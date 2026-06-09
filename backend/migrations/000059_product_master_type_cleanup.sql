-- Remove legacy product_type values after Product Master foundation.
-- Existing rows are normalized before tightening the database constraint.

UPDATE products
SET product_type = CASE product_type
  WHEN 'ready_to_sell' THEN 'finished_product'
  WHEN 'made_to_order' THEN 'finished_product'
  WHEN 'manufactured' THEN 'finished_product'
  WHEN 'retail' THEN 'finished_product'
  ELSE product_type
END
WHERE product_type IN ('ready_to_sell', 'made_to_order', 'manufactured', 'retail');

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS chk_products_product_type;

ALTER TABLE products
  ADD CONSTRAINT chk_products_product_type CHECK (
    product_type IN (
      'finished_product',
      'ingredient',
      'packaging',
      'raw_material',
      'semi_finished',
      'consumable',
      'equipment',
      'service'
    )
  );
