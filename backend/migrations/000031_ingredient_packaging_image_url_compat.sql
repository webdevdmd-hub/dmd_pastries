ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS image_url varchar(500);

ALTER TABLE packaging_items
  ADD COLUMN IF NOT EXISTS image_url varchar(500);
