WITH permission_seed(module_name, permission_key, description) AS (
  VALUES
    ('users', 'users.view', 'View staff users'),
    ('users', 'users.create', 'Create staff users'),
    ('users', 'users.edit', 'Edit staff users'),
    ('users', 'users.delete', 'Delete staff users'),
    ('roles', 'roles.view', 'View roles'),
    ('roles', 'roles.manage', 'Manage roles'),
    ('branches', 'branches.view', 'View branches'),
    ('branches', 'branches.manage', 'Manage branches'),
    ('settings', 'settings.view', 'View settings'),
    ('settings', 'settings.manage', 'Manage settings'),
    ('master_data', 'master_data.view', 'View master data'),
    ('master_data', 'master_data.manage', 'Manage master data'),
    ('pos', 'pos.view', 'View POS module'),
    ('pos', 'pos.sell', 'Sell through POS'),
    ('pos', 'pos.refund', 'Refund POS orders'),
    ('pos', 'pos.void', 'Void POS sales'),
    ('payments', 'payments.view', 'View payments'),
    ('payments', 'payments.manage', 'Manage payments'),
    ('payments', 'payments.refund', 'Refund payments'),
    ('payments', 'payments.reconcile', 'Reconcile payments'),
    ('customers', 'customers.view', 'View customers'),
    ('customers', 'customers.manage', 'Manage customers'),
    ('products', 'products.view', 'View products'),
    ('products', 'products.manage', 'Manage products'),
    ('orders', 'orders.view', 'View orders'),
    ('orders', 'orders.manage', 'Manage orders'),
    ('inventory', 'inventory.view', 'View inventory'),
    ('inventory', 'inventory.manage', 'Manage inventory'),
    ('suppliers', 'suppliers.view', 'View suppliers'),
    ('suppliers', 'suppliers.manage', 'Manage suppliers'),
    ('purchasing', 'purchasing.view', 'View purchasing'),
    ('purchasing', 'purchasing.manage', 'Manage purchasing'),
    ('recipes', 'recipes.view', 'View recipes'),
    ('recipes', 'recipes.manage', 'Manage recipes'),
    ('manufacturing', 'manufacturing.view', 'View manufacturing'),
    ('manufacturing', 'manufacturing.manage', 'Manage manufacturing'),
    ('reports', 'reports.view', 'View reports')
)
INSERT INTO permissions (id, module_name, permission_key, description, created_at, updated_at)
SELECT gen_random_uuid(), module_name, permission_key, description, now(), now()
FROM permission_seed
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, allowed, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, true, now(), now()
FROM roles r
CROSS JOIN permissions p
WHERE r.business_id IS NOT NULL
  AND r.role_name = 'Admin'
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );

WITH role_permission_seed(role_name, permission_key) AS (
  VALUES
    ('Cashier', 'products.view'),
    ('Cashier', 'customers.view'),
    ('Cashier', 'orders.view'),
    ('Cashier', 'pos.view'),
    ('Cashier', 'pos.sell'),

    ('Manager', 'users.view'),
    ('Manager', 'roles.view'),
    ('Manager', 'branches.view'),
    ('Manager', 'branches.manage'),
    ('Manager', 'settings.view'),
    ('Manager', 'master_data.view'),
    ('Manager', 'master_data.manage'),
    ('Manager', 'pos.view'),
    ('Manager', 'pos.sell'),
    ('Manager', 'pos.refund'),
    ('Manager', 'pos.void'),
    ('Manager', 'products.view'),
    ('Manager', 'products.manage'),
    ('Manager', 'customers.view'),
    ('Manager', 'customers.manage'),
    ('Manager', 'orders.view'),
    ('Manager', 'orders.manage'),
    ('Manager', 'inventory.view'),
    ('Manager', 'inventory.manage'),
    ('Manager', 'suppliers.view'),
    ('Manager', 'suppliers.manage'),
    ('Manager', 'purchasing.view'),
    ('Manager', 'purchasing.manage'),
    ('Manager', 'recipes.view'),
    ('Manager', 'recipes.manage'),
    ('Manager', 'manufacturing.view'),
    ('Manager', 'manufacturing.manage'),
    ('Manager', 'reports.view'),

    ('Inventory Clerk', 'master_data.view'),
    ('Inventory Clerk', 'branches.view'),
    ('Inventory Clerk', 'products.view'),
    ('Inventory Clerk', 'products.manage'),
    ('Inventory Clerk', 'inventory.view'),
    ('Inventory Clerk', 'inventory.manage'),
    ('Inventory Clerk', 'suppliers.view'),
    ('Inventory Clerk', 'suppliers.manage'),
    ('Inventory Clerk', 'purchasing.view'),
    ('Inventory Clerk', 'purchasing.manage'),
    ('Inventory Clerk', 'recipes.view'),
    ('Inventory Clerk', 'recipes.manage'),
    ('Inventory Clerk', 'manufacturing.view'),
    ('Inventory Clerk', 'manufacturing.manage'),
    ('Inventory Clerk', 'orders.view')
)
INSERT INTO role_permissions (id, role_id, permission_id, allowed, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, true, now(), now()
FROM role_permission_seed seed
JOIN roles r ON r.role_name = seed.role_name
JOIN permissions p ON p.permission_key = seed.permission_key
WHERE r.business_id IS NOT NULL
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );

