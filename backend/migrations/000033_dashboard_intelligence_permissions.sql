INSERT INTO permissions (id, module_name, permission_key, description, created_at, updated_at)
VALUES (gen_random_uuid(), 'dashboard', 'dashboard.view', 'View operational dashboards', now(), now())
ON CONFLICT (permission_key) DO UPDATE
SET module_name = EXCLUDED.module_name,
    description = EXCLUDED.description,
    updated_at = now();

INSERT INTO role_permissions (id, role_id, permission_id, allowed, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, true, now(), now()
FROM roles r
JOIN permissions p ON p.permission_key = 'dashboard.view'
WHERE r.business_id IS NOT NULL
  AND r.deleted_at IS NULL
  AND r.role_name IN ('Admin', 'Manager', 'Cashier', 'Inventory Clerk')
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );
