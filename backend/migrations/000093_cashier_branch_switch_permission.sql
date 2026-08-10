-- Cashiers need branches.switch so the POS frontend can self-repair a null
-- current_branch_id by switching to the cashier's assigned branch. Without it the
-- repair call 403s silently and every branch-scoped endpoint returns
-- "user has no assigned branch". The switch-branch service still enforces
-- CanAccessBranch, so this does not widen data access.
INSERT INTO role_permissions (id, role_id, permission_id, allowed, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, true, now(), now()
FROM roles r
JOIN permissions p ON p.permission_key = 'branches.switch'
WHERE r.business_id IS NOT NULL
  AND r.role_name = 'Cashier'
  AND r.is_system_default = true
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );
