ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_file_id varchar(500);

UPDATE users
SET avatar_file_id = avatar_url
WHERE avatar_file_id IS NULL
  AND avatar_url IS NOT NULL
  AND avatar_url <> '';

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS logo_file_id varchar(500);

UPDATE company_settings
SET logo_file_id = logo_url
WHERE logo_file_id IS NULL
  AND logo_url IS NOT NULL
  AND logo_url <> '';

ALTER TABLE product_categories
  ADD COLUMN IF NOT EXISTS image_file_id varchar(500);

UPDATE product_categories
SET image_file_id = image_url
WHERE image_file_id IS NULL
  AND image_url IS NOT NULL
  AND image_url <> '';

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_file_id varchar(500);

UPDATE products
SET image_file_id = image_url
WHERE image_file_id IS NULL
  AND image_url IS NOT NULL
  AND image_url <> '';

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS image_file_id varchar(500);

UPDATE product_variants
SET image_file_id = image_url
WHERE image_file_id IS NULL
  AND image_url IS NOT NULL
  AND image_url <> '';

ALTER TABLE product_media
  ADD COLUMN IF NOT EXISTS file_id varchar(500),
  ADD COLUMN IF NOT EXISTS bucket_id varchar(150);

ALTER TABLE product_media
  ALTER COLUMN file_url DROP NOT NULL;

UPDATE product_media
SET file_id = file_url
WHERE file_id IS NULL
  AND file_url IS NOT NULL
  AND file_url <> '';
