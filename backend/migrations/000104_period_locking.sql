-- 000104: Period locking / "close the books" (Phase 5 / W1)
--
-- A single business-wide inclusive lock date on company_settings: journals
-- dated on or before books_closed_through can no longer be created, posted,
-- edited, deleted, or reversed. Enforcement lives in Go
-- (accounting.EnsurePeriodOpen at every journal write/delete site); these
-- columns are the single source of truth the guard reads.

ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS books_closed_through date;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS books_lock_updated_by_user_id uuid;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS books_lock_updated_at timestamptz;

-- Permission: the row itself is upserted by the boot-time seeder; existing
-- system-default Admin roles get the grant here (mirrors migration 000101).
-- Managers intentionally do NOT receive it — locking the books is an
-- owner/admin control, grantable per-role in the RBAC UI where wanted.
INSERT INTO permissions (id, module_name, permission_key, description, created_at, updated_at)
SELECT gen_random_uuid(), 'accounting', 'accounting.period.lock', 'Lock and unlock accounting periods (close the books)', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_key = 'accounting.period.lock');

INSERT INTO role_permissions (id, role_id, permission_id, allowed, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, true, now(), now()
FROM roles r
JOIN permissions p ON p.permission_key = 'accounting.period.lock'
WHERE r.business_id IS NOT NULL
  AND r.role_name = 'Admin'
  AND r.is_system_default = true
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
