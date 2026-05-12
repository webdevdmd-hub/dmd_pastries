BEGIN;

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS chk_customers_contact;

COMMIT;
