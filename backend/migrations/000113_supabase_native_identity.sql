-- 000113: a schema that does not assume Appwrite exists
--
-- Decision (2026-09-09): the migration is a clean-slate swap, not a transition.
-- No users, files or records are carried over from Appwrite. That retires the
-- transition scaffolding 000110 and 000111 put in place, and it exposes one
-- constraint that predates all of it.
--
-- users.appwrite_user_id has been NOT NULL UNIQUE since 000001. Every account
-- was created in Appwrite first, so there was always a value. A Supabase-only
-- account has nothing to put there: the first one would be inserted with an
-- empty string, and the second would fail the unique index against it. So the
-- column becomes nullable. The unique index stays, because NULLs are distinct
-- under it and a real Appwrite id, where one still exists, must still be
-- unique.
--
-- It is not dropped, and neither is platform_audit_logs.actor_appwrite_user_id.
-- Both are written by code paths that are still compiled in, and removing a
-- column the application still names is a boot failure rather than a cleanup.
-- They go when the Appwrite client does.

ALTER TABLE users ALTER COLUMN appwrite_user_id DROP NOT NULL;

-- The two tables that existed only to make the import and the file copy
-- resumable and verifiable. Nothing is being imported or copied, so nothing
-- reads them. Both are empty on every database this has been applied to: the
-- commands that populate them were never run against production.
DROP TABLE IF EXISTS identity_migration_map;
DROP TABLE IF EXISTS storage_migration_map;

-- The *_storage_path columns from 000111 are deliberately kept. The storage
-- seam reads them, and a Supabase-only upload writes the object path there
-- with *_file_id left empty -- which is exactly the shape the read fallback
-- already handles. Collapsing the pair to one column is a later cleanup, not
-- a prerequisite for anything working.
