-- Repair purchase invoice schema for Zoho-style bills.
-- Some production databases missed or partially applied the purchase bill
-- account-line/bill-discount migration. Keep this idempotent so converting a
-- PO to a draft bill can safely insert the current PurchaseInvoice model.

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS bill_discount_amount numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE purchase_invoice_items
  ADD COLUMN IF NOT EXISTS line_type varchar(30) NOT NULL DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES chart_of_accounts(id),
  ADD COLUMN IF NOT EXISTS account_name_snapshot varchar(255),
  ADD COLUMN IF NOT EXISTS account_code_snapshot varchar(100),
  ADD COLUMN IF NOT EXISTS description text;

UPDATE purchase_invoice_items
SET line_type = 'product'
WHERE line_type IS NULL OR line_type = '';

ALTER TABLE purchase_invoice_items
  ALTER COLUMN line_type SET DEFAULT 'product',
  ALTER COLUMN unit_id DROP NOT NULL;

ALTER TABLE purchase_invoice_items
  DROP CONSTRAINT IF EXISTS chk_pi_item_type,
  DROP CONSTRAINT IF EXISTS chk_purchase_invoice_item_type,
  DROP CONSTRAINT IF EXISTS chk_purchase_invoice_items_item_type,
  DROP CONSTRAINT IF EXISTS chk_pi_item_single_reference,
  DROP CONSTRAINT IF EXISTS chk_purchase_invoice_item_reference,
  DROP CONSTRAINT IF EXISTS chk_purchase_invoice_items_reference,
  DROP CONSTRAINT IF EXISTS chk_purchase_invoice_items_single_reference,
  DROP CONSTRAINT IF EXISTS chk_purchase_invoice_items_line_type;

ALTER TABLE purchase_invoice_items
  ADD CONSTRAINT chk_purchase_invoice_items_line_type CHECK (line_type IN ('product', 'account'));

ALTER TABLE purchase_invoice_items
  ADD CONSTRAINT chk_purchase_invoice_items_item_type CHECK (item_type IN ('product', 'ingredient', 'packaging', 'account'));

ALTER TABLE purchase_invoice_items
  ADD CONSTRAINT chk_purchase_invoice_items_single_reference CHECK (
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
    )
  );

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_line_type ON purchase_invoice_items(line_type);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_account_id ON purchase_invoice_items(account_id);
