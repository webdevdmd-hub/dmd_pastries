-- 000111: a second storage reference, so files can move without a cutover
--
-- Decision (2026-09-09): the Appwrite -> Supabase storage migration adds a
-- column beside every *_file_id rather than rewriting them in place, for the
-- same reason the auth migration added supabase_user_id beside
-- appwrite_user_id: rewriting makes rollback a data restore.
--
-- Appwrite addresses a file by an opaque id and resolves it through
-- getFilePreview. Supabase addresses it by a path within a bucket. The two are
-- not interchangeable, so a row needs both while both providers hold copies.
--
-- Every render site in the app already reads
--     getProductImagePreviewUrl(x.imageFileId) ?? x.imageUrl
-- so it is already a fallback chain. This extends it by one link rather than
-- inventing a mechanism: prefer the Supabase path, fall back to the Appwrite
-- id, fall back to the legacy plain URL. Rolling back is then a frontend flag,
-- and no image ever 404s because a copy was missed.
--
-- The bucket is implied by the column, exactly as it is today: products go to
-- productImages, expenses to documents, and so on. product_media keeps its
-- explicit bucket_id because it is the one place a bucket is data-driven.
--
-- Nullable, with no backfill. Before the file copy runs every value is NULL and
-- every read falls through to Appwrite, which is what makes this inert.

ALTER TABLE company_settings   ADD COLUMN IF NOT EXISTS logo_storage_path    varchar(500);
ALTER TABLE expenses           ADD COLUMN IF NOT EXISTS receipt_storage_path varchar(500);
ALTER TABLE ingredients        ADD COLUMN IF NOT EXISTS image_storage_path   varchar(500);
ALTER TABLE packaging_items    ADD COLUMN IF NOT EXISTS image_storage_path   varchar(500);
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS image_storage_path   varchar(500);
ALTER TABLE product_media      ADD COLUMN IF NOT EXISTS storage_path         varchar(500);
ALTER TABLE product_variants   ADD COLUMN IF NOT EXISTS image_storage_path   varchar(500);
ALTER TABLE products           ADD COLUMN IF NOT EXISTS image_storage_path   varchar(500);

-- Included for uniformity, not because anything writes it. The userAvatars
-- bucket is declared in the frontend and never called, so this column is
-- expected to stay empty -- but "expected" is doing work there, and a column
-- that is present costs nothing while a column that is missing costs a
-- migration in the middle of a window.
ALTER TABLE users              ADD COLUMN IF NOT EXISTS avatar_storage_path  varchar(500);

-- Records which files have been copied, independent of the rows that reference
-- them.
--
-- The copy has to cover every object in each bucket, not just the ones a row
-- points at: the app has no delete path, so orphans exist, and the difference
-- between "referenced" and "present" is exactly where a missed file hides. This
-- table is also what makes the copy resumable -- a run that dies halfway is
-- continued rather than restarted against a provider that now has duplicates.
CREATE TABLE IF NOT EXISTS storage_migration_map (
    appwrite_bucket_id varchar(100)  NOT NULL,
    appwrite_file_id   varchar(500)  NOT NULL,
    supabase_bucket    varchar(100)  NOT NULL,
    supabase_path      varchar(500)  NOT NULL,
    bytes              bigint,
    copied_at          timestamptz   NOT NULL DEFAULT now(),
    PRIMARY KEY (appwrite_bucket_id, appwrite_file_id)
);

CREATE INDEX IF NOT EXISTS idx_storage_migration_map_path
    ON storage_migration_map (supabase_bucket, supabase_path);
