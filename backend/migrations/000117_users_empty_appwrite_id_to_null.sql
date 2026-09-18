-- 000117: A Supabase-only account has no Appwrite id; store NULL, not ''.
--
-- ISSUE-064 (found by /qa on production, 2026-09-18). Staff > Create User wrote
-- appwrite_user_id = '' once Supabase became the only identity provider. The
-- column's unique index treats NULLs as distinct but '' as a value, so the
-- first account created that way succeeded and every later one failed with
-- "failed to link identity provider user". The code now leaves the column
-- untouched when there is no Appwrite id; this clears the '' already stored so
-- the data follows the same rule. Idempotent: once cleared, no row matches.

UPDATE users
SET appwrite_user_id = NULL
WHERE appwrite_user_id = '';
