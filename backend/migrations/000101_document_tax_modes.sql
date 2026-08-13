-- 000101: Per-document VAT modes + no-tax RBAC (Phase 4 / W3)
--
-- Decision §2b/2c (2026-08-12 workshop): Inclusive / Exclusive / No-tax is
-- selectable per document on POS sales, bakery orders, and purchase bills;
-- No-tax is permission-gated (sales.no_tax.apply) and audit-flagged.
--
-- Until now inclusiveness was a property of the TAX RATE (tax_rates.
-- is_inclusive), not the document. To avoid silently repricing businesses
-- whose default rate is exclusive, both the business default and historical
-- documents are backfilled from the business's default (or first active)
-- tax rate flag instead of a blanket 'inclusive'. Historical documents are
-- never recalculated — the column on them only pins the mode any future
-- edit recalculates under.

ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS default_tax_mode varchar(20) NOT NULL DEFAULT 'inclusive';
ALTER TABLE business_settings DROP CONSTRAINT IF EXISTS chk_business_settings_default_tax_mode;
ALTER TABLE business_settings
    ADD CONSTRAINT chk_business_settings_default_tax_mode
    CHECK (default_tax_mode IN ('inclusive', 'exclusive', 'no_tax'));

ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax_mode varchar(20) NOT NULL DEFAULT 'inclusive';
ALTER TABLE sales DROP CONSTRAINT IF EXISTS chk_sales_tax_mode;
ALTER TABLE sales
    ADD CONSTRAINT chk_sales_tax_mode
    CHECK (tax_mode IN ('inclusive', 'exclusive', 'no_tax'));

ALTER TABLE held_sales ADD COLUMN IF NOT EXISTS tax_mode varchar(20) NOT NULL DEFAULT 'inclusive';
ALTER TABLE held_sales DROP CONSTRAINT IF EXISTS chk_held_sales_tax_mode;
ALTER TABLE held_sales
    ADD CONSTRAINT chk_held_sales_tax_mode
    CHECK (tax_mode IN ('inclusive', 'exclusive', 'no_tax'));

ALTER TABLE bakery_orders ADD COLUMN IF NOT EXISTS tax_mode varchar(20) NOT NULL DEFAULT 'inclusive';
ALTER TABLE bakery_orders DROP CONSTRAINT IF EXISTS chk_bakery_orders_tax_mode;
ALTER TABLE bakery_orders
    ADD CONSTRAINT chk_bakery_orders_tax_mode
    CHECK (tax_mode IN ('inclusive', 'exclusive', 'no_tax'));

ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS tax_mode varchar(20) NOT NULL DEFAULT 'inclusive';
ALTER TABLE purchase_invoices DROP CONSTRAINT IF EXISTS chk_purchase_invoices_tax_mode;
ALTER TABLE purchase_invoices
    ADD CONSTRAINT chk_purchase_invoices_tax_mode
    CHECK (tax_mode IN ('inclusive', 'exclusive', 'no_tax'));

-- Backfill: a business whose governing tax rate is exclusive keeps exclusive
-- semantics as its default and on its historical documents.
WITH business_modes AS (
    SELECT b.id AS business_id,
           CASE WHEN COALESCE((
               SELECT tr.is_inclusive FROM tax_rates tr
               WHERE tr.business_id = b.id AND tr.deleted_at IS NULL AND tr.status = 'active'
               ORDER BY tr.is_default DESC, tr.created_at ASC
               LIMIT 1
           ), TRUE) THEN 'inclusive' ELSE 'exclusive' END AS mode
    FROM businesses b
    WHERE b.deleted_at IS NULL
)
UPDATE business_settings bs
SET default_tax_mode = bm.mode
FROM business_modes bm
WHERE bs.business_id = bm.business_id;

UPDATE sales s SET tax_mode = bs.default_tax_mode
FROM business_settings bs WHERE bs.business_id = s.business_id AND s.tax_mode <> bs.default_tax_mode;
UPDATE held_sales hs SET tax_mode = bs.default_tax_mode
FROM business_settings bs WHERE bs.business_id = hs.business_id AND hs.tax_mode <> bs.default_tax_mode;
UPDATE bakery_orders bo SET tax_mode = bs.default_tax_mode
FROM business_settings bs WHERE bs.business_id = bo.business_id AND bo.tax_mode <> bs.default_tax_mode;
UPDATE purchase_invoices pi SET tax_mode = bs.default_tax_mode
FROM business_settings bs WHERE bs.business_id = pi.business_id AND pi.tax_mode <> bs.default_tax_mode;

-- Permission: the row itself is upserted by the boot-time seeder; existing
-- Admin and Manager roles get the grant here (mirrors migration 000093).
INSERT INTO permissions (id, module_name, permission_key, description, created_at, updated_at)
SELECT gen_random_uuid(), 'pos', 'sales.no_tax.apply', 'Apply the no-tax mode to sales documents', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_key = 'sales.no_tax.apply');

INSERT INTO role_permissions (id, role_id, permission_id, allowed, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, true, now(), now()
FROM roles r
JOIN permissions p ON p.permission_key = 'sales.no_tax.apply'
WHERE r.business_id IS NOT NULL
  AND r.role_name IN ('Admin', 'Manager')
  AND r.is_system_default = true
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
