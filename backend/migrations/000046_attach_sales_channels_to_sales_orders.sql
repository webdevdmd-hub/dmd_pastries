-- Attach business-defined sales channels/order sources to POS sales and bakery orders.

ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS sales_channel_id UUID NULL REFERENCES sales_channels(id),
    ADD COLUMN IF NOT EXISTS sales_channel_name_snapshot VARCHAR(150) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS external_order_number VARCHAR(150) NOT NULL DEFAULT '';

ALTER TABLE bakery_orders
    ADD COLUMN IF NOT EXISTS sales_channel_id UUID NULL REFERENCES sales_channels(id),
    ADD COLUMN IF NOT EXISTS sales_channel_name_snapshot VARCHAR(150) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS external_order_number VARCHAR(150) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_sales_business_channel
    ON sales(business_id, sales_channel_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_external_order_number
    ON sales(business_id, LOWER(external_order_number))
    WHERE external_order_number <> '' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bakery_orders_business_channel
    ON bakery_orders(business_id, sales_channel_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bakery_orders_external_order_number
    ON bakery_orders(business_id, LOWER(external_order_number))
    WHERE external_order_number <> '' AND deleted_at IS NULL;

WITH default_channels AS (
    SELECT DISTINCT ON (business_id)
        business_id,
        id,
        channel_name
    FROM sales_channels
    WHERE status = 'active'
      AND deleted_at IS NULL
    ORDER BY business_id, is_default DESC, channel_name ASC
)
UPDATE sales s
SET sales_channel_id = dc.id,
    sales_channel_name_snapshot = dc.channel_name
FROM default_channels dc
WHERE s.business_id = dc.business_id
  AND s.sales_channel_id IS NULL;

WITH default_channels AS (
    SELECT DISTINCT ON (business_id)
        business_id,
        id,
        channel_name
    FROM sales_channels
    WHERE status = 'active'
      AND deleted_at IS NULL
    ORDER BY business_id, is_default DESC, channel_name ASC
)
UPDATE bakery_orders bo
SET sales_channel_id = dc.id,
    sales_channel_name_snapshot = dc.channel_name
FROM default_channels dc
WHERE bo.business_id = dc.business_id
  AND bo.sales_channel_id IS NULL;
