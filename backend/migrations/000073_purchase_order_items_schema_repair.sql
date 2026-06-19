-- Repair purchase order item schema for product/account line support.
-- This is intentionally idempotent so production databases that missed or partially
-- applied the earlier PO account-line migration can be brought back in sync safely.

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS line_type varchar(30) NOT NULL DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES chart_of_accounts(id),
  ADD COLUMN IF NOT EXISTS account_name_snapshot varchar(255),
  ADD COLUMN IF NOT EXISTS account_code_snapshot varchar(100),
  ADD COLUMN IF NOT EXISTS description text;

UPDATE purchase_order_items
SET line_type = 'product'
WHERE line_type IS NULL OR line_type = '';

ALTER TABLE purchase_order_items
  ALTER COLUMN line_type SET DEFAULT 'product',
  ALTER COLUMN unit_id DROP NOT NULL;

ALTER TABLE purchase_order_items
  DROP CONSTRAINT IF EXISTS chk_po_item_type,
  DROP CONSTRAINT IF EXISTS chk_po_item_single_reference,
  DROP CONSTRAINT IF EXISTS chk_purchase_order_items_line_type;

ALTER TABLE purchase_order_items
  ADD CONSTRAINT chk_purchase_order_items_line_type CHECK (line_type IN ('product', 'account')),
  ADD CONSTRAINT chk_po_item_type CHECK (item_type IN ('product', 'ingredient', 'packaging', 'account')),
  ADD CONSTRAINT chk_po_item_single_reference CHECK (
    (
      line_type = 'product'
      AND account_id IS NULL
      AND unit_id IS NOT NULL
      AND ((product_id IS NOT NULL)::int + (ingredient_id IS NOT NULL)::int + (packaging_item_id IS NOT NULL)::int) = 1
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

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_line_type ON purchase_order_items(line_type);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_account_id ON purchase_order_items(account_id);
