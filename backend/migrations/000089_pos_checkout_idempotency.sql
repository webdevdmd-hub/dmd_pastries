ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS checkout_reference VARCHAR(80) NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_business_checkout_reference
  ON sales(business_id, checkout_reference)
  WHERE checkout_reference <> '' AND deleted_at IS NULL;
