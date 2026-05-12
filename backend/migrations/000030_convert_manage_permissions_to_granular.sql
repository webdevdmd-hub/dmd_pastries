WITH manage_permission_map(old_permission_key, new_permission_key) AS (
  VALUES
    ('roles.manage', 'roles.create'),
    ('roles.manage', 'roles.edit'),
    ('roles.manage', 'roles.delete'),
    ('roles.manage', 'roles.permissions.view'),
    ('roles.manage', 'roles.permissions.update'),

    ('branches.manage', 'branches.create'),
    ('branches.manage', 'branches.edit'),
    ('branches.manage', 'branches.status.update'),
    ('branches.manage', 'branches.switch'),
    ('branches.manage', 'branches.access.manage'),

    ('settings.manage', 'settings.company.update'),
    ('settings.manage', 'settings.tax_rates.manage'),
    ('settings.manage', 'settings.payment_methods.manage'),
    ('settings.manage', 'settings.receipt.update'),
    ('settings.manage', 'settings.hardware.update'),
    ('settings.manage', 'settings.notifications.update'),

    ('master_data.manage', 'master_data.units.manage'),
    ('master_data.manage', 'master_data.product_categories.manage'),
    ('master_data.manage', 'master_data.ingredient_categories.manage'),
    ('master_data.manage', 'master_data.packaging_categories.manage'),
    ('master_data.manage', 'master_data.supplier_categories.manage'),
    ('master_data.manage', 'master_data.order_statuses.manage'),
    ('master_data.manage', 'master_data.payment_statuses.manage'),

    ('products.manage', 'products.create'),
    ('products.manage', 'products.edit'),
    ('products.manage', 'products.delete'),
    ('products.manage', 'products.status.update'),
    ('products.manage', 'products.variants.manage'),
    ('products.manage', 'products.images.manage'),

    ('payments.manage', 'payments.add'),
    ('payments.manage', 'payments.refund'),
    ('payments.manage', 'payments.reconcile'),
    ('payments.manage', 'payments.summary.view'),
    ('payments.manage', 'payments.methods.view'),

    ('customers.manage', 'customers.create'),
    ('customers.manage', 'customers.edit'),
    ('customers.manage', 'customers.delete'),
    ('customers.manage', 'customers.status.update'),
    ('customers.manage', 'customers.notes.manage'),
    ('customers.manage', 'customers.tags.manage'),
    ('customers.manage', 'customers.quick_create'),

    ('orders.manage', 'orders.create'),
    ('orders.manage', 'orders.edit'),
    ('orders.manage', 'orders.delete'),
    ('orders.manage', 'orders.status.update'),
    ('orders.manage', 'orders.payments.manage'),
    ('orders.manage', 'orders.production.assign'),
    ('orders.manage', 'orders.packaging.manage'),

    ('inventory.manage', 'inventory.opening_stock'),
    ('inventory.manage', 'inventory.adjust'),
    ('inventory.manage', 'inventory.movements.view'),
    ('inventory.manage', 'inventory.low_stock.view'),
    ('inventory.manage', 'inventory.expiry.view'),
    ('inventory.manage', 'inventory.expiry_batches.manage'),
    ('inventory.manage', 'stock_movements.view'),
    ('inventory.manage', 'stock_movements.manual_create'),
    ('inventory.manage', 'stock_movements.reverse'),
    ('inventory.manage', 'stock_movements.audit.view'),
    ('inventory.manage', 'stock_movements.summary.view'),

    ('suppliers.manage', 'suppliers.create'),
    ('suppliers.manage', 'suppliers.edit'),
    ('suppliers.manage', 'suppliers.delete'),
    ('suppliers.manage', 'suppliers.status.update'),
    ('suppliers.manage', 'suppliers.contacts.manage'),
    ('suppliers.manage', 'suppliers.notes.manage'),
    ('suppliers.manage', 'suppliers.lookup'),

    ('purchasing.manage', 'purchasing.orders.create'),
    ('purchasing.manage', 'purchasing.orders.edit'),
    ('purchasing.manage', 'purchasing.orders.delete'),
    ('purchasing.manage', 'purchasing.orders.status.update'),
    ('purchasing.manage', 'purchasing.invoices.create'),
    ('purchasing.manage', 'purchasing.invoices.edit'),
    ('purchasing.manage', 'purchasing.invoices.post'),
    ('purchasing.manage', 'purchasing.invoices.cancel'),
    ('purchasing.manage', 'purchasing.receipts.create'),
    ('purchasing.manage', 'purchasing.receipts.post'),
    ('purchasing.manage', 'purchasing.receipts.cancel'),
    ('purchasing.manage', 'purchasing.receive_stock'),

    ('recipes.manage', 'recipes.create'),
    ('recipes.manage', 'recipes.edit'),
    ('recipes.manage', 'recipes.delete'),
    ('recipes.manage', 'recipes.status.update'),
    ('recipes.manage', 'recipes.ingredients.manage'),
    ('recipes.manage', 'recipes.packaging.manage'),
    ('recipes.manage', 'recipes.cost.recalculate'),
    ('recipes.manage', 'recipes.versions.create'),

    ('manufacturing.manage', 'manufacturing.batches.create'),
    ('manufacturing.manage', 'manufacturing.batches.edit'),
    ('manufacturing.manage', 'manufacturing.batches.delete'),
    ('manufacturing.manage', 'manufacturing.batches.start'),
    ('manufacturing.manage', 'manufacturing.batches.consume'),
    ('manufacturing.manage', 'manufacturing.batches.produce'),
    ('manufacturing.manage', 'manufacturing.batches.wastage'),
    ('manufacturing.manage', 'manufacturing.batches.complete'),
    ('manufacturing.manage', 'manufacturing.batches.cancel')
)
INSERT INTO role_permissions (id, role_id, permission_id, allowed, created_at, updated_at)
SELECT gen_random_uuid(), rp.role_id, new_permission.id, true, now(), now()
FROM role_permissions rp
JOIN permissions old_permission ON old_permission.id = rp.permission_id
JOIN manage_permission_map permission_map ON permission_map.old_permission_key = old_permission.permission_key
JOIN permissions new_permission ON new_permission.permission_key = permission_map.new_permission_key
WHERE rp.allowed = true
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions existing
    WHERE existing.role_id = rp.role_id
      AND existing.permission_id = new_permission.id
  );
