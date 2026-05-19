-- Link bakery order production records to specific order items when batches are
-- created from an item.

ALTER TABLE bakery_order_productions
  ADD COLUMN IF NOT EXISTS bakery_order_item_id UUID NULL REFERENCES bakery_order_items(id);

DROP INDEX IF EXISTS idx_bakery_order_productions_order;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bakery_order_productions_order_level
  ON bakery_order_productions(business_id, bakery_order_id)
  WHERE bakery_order_item_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bakery_order_productions_item_level
  ON bakery_order_productions(business_id, bakery_order_id, bakery_order_item_id)
  WHERE bakery_order_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bakery_order_productions_item
  ON bakery_order_productions(bakery_order_item_id);
