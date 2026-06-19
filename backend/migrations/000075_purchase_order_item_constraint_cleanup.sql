-- Final cleanup for purchase order item constraints after product/account line support.
-- Some production databases still have the legacy constraint name
-- chk_purchase_order_items_single_reference, which rejects account rows.

ALTER TABLE purchase_order_items
  DROP CONSTRAINT IF EXISTS chk_po_item_single_reference,
  DROP CONSTRAINT IF EXISTS chk_purchase_order_items_single_reference;

ALTER TABLE purchase_order_items
  DROP CONSTRAINT IF EXISTS chk_po_item_type,
  DROP CONSTRAINT IF EXISTS chk_purchase_order_items_item_type,
  DROP CONSTRAINT IF EXISTS chk_purchase_order_items_line_type;

ALTER TABLE purchase_order_items
  ADD CONSTRAINT chk_purchase_order_items_line_type CHECK (line_type IN ('product', 'account')),
  ADD CONSTRAINT chk_purchase_order_items_item_type CHECK (item_type IN ('product', 'ingredient', 'packaging', 'account')),
  ADD CONSTRAINT chk_purchase_order_items_single_reference CHECK (
    (
      line_type = 'product'
      AND account_id IS NULL
      AND unit_id IS NOT NULL
      AND (
        (product_id IS NOT NULL)::int +
        (ingredient_id IS NOT NULL)::int +
        (packaging_item_id IS NOT NULL)::int
      ) = 1
    )
    OR
    (
      line_type = 'account'
      AND account_id IS NOT NULL
      AND product_id IS NULL
      AND ingredient_id IS NULL
      AND packaging_item_id IS NULL
      AND quantity_received = 0
    )
  );
