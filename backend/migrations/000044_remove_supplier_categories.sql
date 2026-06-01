-- Remove supplier/vendor categories. Suppliers are vendor master records; purchase line items carry item category/type.

ALTER TABLE suppliers DROP COLUMN IF EXISTS supplier_category_id;

DROP TABLE IF EXISTS supplier_categories;

DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions WHERE permission_key = 'master_data.supplier_categories.manage'
);

DELETE FROM permissions
WHERE permission_key = 'master_data.supplier_categories.manage';
