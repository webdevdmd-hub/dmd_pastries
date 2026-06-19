-- Defensive compatibility for older deployed binaries.
-- Current code maps PurchaseOrderItem.AccountName/AccountCode to the snapshot
-- columns, but an older running binary may still try to insert account_name and
-- account_code. Keep nullable alias columns so purchase order creation does not
-- crash during rolling deploys or partially updated environments.

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS account_name varchar(255),
  ADD COLUMN IF NOT EXISTS account_code varchar(100);

UPDATE purchase_order_items
SET account_name = COALESCE(account_name, account_name_snapshot),
    account_code = COALESCE(account_code, account_code_snapshot)
WHERE account_name IS NULL
   OR account_code IS NULL;

UPDATE purchase_order_items
SET account_name_snapshot = COALESCE(account_name_snapshot, account_name),
    account_code_snapshot = COALESCE(account_code_snapshot, account_code)
WHERE account_name_snapshot IS NULL
   OR account_code_snapshot IS NULL;
