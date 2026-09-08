-- 000110: a second identity column, so two providers can be live at once
--
-- Decision (2026-09-08): the Appwrite -> Supabase auth cutover adds a column
-- rather than overwriting users.appwrite_user_id, because overwriting it would
-- fight code that is already in the tree.
--
-- resolveLocalUserForIdentity (auth/service.go) looks a user up by provider id
-- and, on a miss, falls back to matching lowercase email and silently relinking
-- the provider id. With both providers live and one shared column, an Appwrite
-- token would miss the now-Supabase id, match by email, and relink the column
-- backwards; the next Supabase token would relink it forwards. The column would
-- flip on every login and the audit trail would be worthless.
--
-- Two columns instead: each provider resolves against its own, the fallback is
-- deleted for the Supabase path, and rollback is a frontend flag rather than a
-- data restore.
--
-- Supabase ids are uuid and Appwrite ids are 20-char alphanumeric, so the ids
-- cannot simply be reused. They are minted as deterministic UUIDv5 from the
-- Appwrite id, which makes the mapping reproducible from scratch and checkable
-- by recomputation rather than by trusting a one-off backfill.

ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_user_id uuid;

-- Partial, so the many NULLs before cutover do not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase_user_id
    ON users (supabase_user_id)
    WHERE supabase_user_id IS NOT NULL;

-- Kept permanently, not cleaned up after the migration.
-- platform_audit_logs.actor_appwrite_user_id is NOT NULL and full of historic
-- Appwrite ids; once Appwrite is gone this table is the only thing that can
-- still resolve who those rows refer to. Renaming or dropping the old column
-- does not make them resolvable -- only this mapping does.
CREATE TABLE IF NOT EXISTS identity_migration_map (
    appwrite_user_id varchar(100) PRIMARY KEY,
    supabase_user_id uuid        NOT NULL UNIQUE,
    email            varchar(255) NOT NULL,
    migrated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_migration_map_email
    ON identity_migration_map (lower(email));
