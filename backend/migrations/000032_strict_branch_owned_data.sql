-- Strict branch-owned catalog/master data.
-- Existing business-scoped records are assigned to each business default branch.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TEMP TABLE IF NOT EXISTS tmp_business_default_branches AS
SELECT DISTINCT ON (business_id)
  business_id,
  id AS branch_id
FROM branches
WHERE deleted_at IS NULL
ORDER BY business_id, is_default DESC, created_at ASC;

ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE ingredient_categories ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE packaging_categories ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE supplier_categories ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE product_media ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE customer_tags ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE customer_tag_mappings ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE customer_notes ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE supplier_contacts ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE supplier_notes ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE packaging_items ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE packaging_usage_rules ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE recipe_packaging ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);
ALTER TABLE recipe_versions ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);

UPDATE product_categories t SET branch_id = b.branch_id FROM tmp_business_default_branches b WHERE t.business_id = b.business_id AND t.branch_id IS NULL;
UPDATE ingredient_categories t SET branch_id = b.branch_id FROM tmp_business_default_branches b WHERE t.business_id = b.business_id AND t.branch_id IS NULL;
UPDATE packaging_categories t SET branch_id = b.branch_id FROM tmp_business_default_branches b WHERE t.business_id = b.business_id AND t.branch_id IS NULL;
UPDATE supplier_categories t SET branch_id = b.branch_id FROM tmp_business_default_branches b WHERE t.business_id = b.business_id AND t.branch_id IS NULL;
UPDATE products t SET branch_id = b.branch_id FROM tmp_business_default_branches b WHERE t.business_id = b.business_id AND t.branch_id IS NULL;
UPDATE product_media pm SET branch_id = p.branch_id FROM products p WHERE pm.product_id = p.id AND pm.business_id = p.business_id AND pm.branch_id IS NULL;
UPDATE customers t SET branch_id = b.branch_id FROM tmp_business_default_branches b WHERE t.business_id = b.business_id AND t.branch_id IS NULL;
UPDATE customer_tags t SET branch_id = b.branch_id FROM tmp_business_default_branches b WHERE t.business_id = b.business_id AND t.branch_id IS NULL;
UPDATE customer_tag_mappings m SET branch_id = c.branch_id FROM customers c WHERE m.customer_id = c.id AND m.business_id = c.business_id AND m.branch_id IS NULL;
UPDATE customer_notes n SET branch_id = c.branch_id FROM customers c WHERE n.customer_id = c.id AND n.business_id = c.business_id AND n.branch_id IS NULL;
UPDATE suppliers t SET branch_id = b.branch_id FROM tmp_business_default_branches b WHERE t.business_id = b.business_id AND t.branch_id IS NULL;
UPDATE supplier_contacts c SET branch_id = s.branch_id FROM suppliers s WHERE c.supplier_id = s.id AND c.business_id = s.business_id AND c.branch_id IS NULL;
UPDATE supplier_notes n SET branch_id = s.branch_id FROM suppliers s WHERE n.supplier_id = s.id AND n.business_id = s.business_id AND n.branch_id IS NULL;
UPDATE ingredients t SET branch_id = b.branch_id FROM tmp_business_default_branches b WHERE t.business_id = b.business_id AND t.branch_id IS NULL;
UPDATE packaging_items t SET branch_id = b.branch_id FROM tmp_business_default_branches b WHERE t.business_id = b.business_id AND t.branch_id IS NULL;
UPDATE packaging_usage_rules r SET branch_id = p.branch_id FROM products p WHERE r.product_id = p.id AND r.business_id = p.business_id AND r.branch_id IS NULL;
UPDATE recipes t SET branch_id = p.branch_id FROM products p WHERE t.product_id = p.id AND t.business_id = p.business_id AND t.branch_id IS NULL;
UPDATE recipe_ingredients ri SET branch_id = r.branch_id FROM recipes r WHERE ri.recipe_id = r.id AND ri.business_id = r.business_id AND ri.branch_id IS NULL;
UPDATE recipe_packaging rp SET branch_id = r.branch_id FROM recipes r WHERE rp.recipe_id = r.id AND rp.business_id = r.business_id AND rp.branch_id IS NULL;
UPDATE recipe_versions rv SET branch_id = r.branch_id FROM recipes r WHERE rv.recipe_id = r.id AND rv.business_id = r.business_id AND rv.branch_id IS NULL;

ALTER TABLE product_categories ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE ingredient_categories ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE packaging_categories ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE supplier_categories ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE products ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE customer_tags ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE customer_tag_mappings ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE customer_notes ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE suppliers ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE supplier_contacts ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE supplier_notes ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE ingredients ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE packaging_items ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE packaging_usage_rules ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE recipes ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE recipe_ingredients ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE recipe_packaging ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE recipe_versions ALTER COLUMN branch_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_categories_business_branch ON product_categories(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_categories_business_branch ON ingredient_categories(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_packaging_categories_business_branch ON packaging_categories(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_supplier_categories_business_branch ON supplier_categories(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_products_business_branch ON products(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_branch ON customers(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_business_branch ON customer_tags(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_customer_tag_mappings_business_branch ON customer_tag_mappings(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_business_branch ON customer_notes(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_business_branch ON suppliers(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_business_branch ON supplier_contacts(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_supplier_notes_business_branch ON supplier_notes(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_business_branch ON ingredients(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_packaging_items_business_branch ON packaging_items(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_packaging_usage_rules_business_branch ON packaging_usage_rules(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_recipes_business_branch ON recipes(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_business_branch ON recipe_ingredients(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_recipe_packaging_business_branch ON recipe_packaging(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_recipe_versions_business_branch ON recipe_versions(business_id, branch_id);

DROP INDEX IF EXISTS idx_product_categories_business_code_active;
DROP INDEX IF EXISTS idx_product_categories_business_root_name_active;
DROP INDEX IF EXISTS idx_product_categories_business_parent_name_active;
DROP INDEX IF EXISTS idx_products_business_code;
DROP INDEX IF EXISTS idx_products_business_sku;
DROP INDEX IF EXISTS idx_products_business_barcode;
DROP INDEX IF EXISTS idx_customers_business_code_unique;
DROP INDEX IF EXISTS idx_customers_business_phone_unique;
DROP INDEX IF EXISTS idx_customers_business_email_unique;
DROP INDEX IF EXISTS idx_suppliers_business_code;
DROP INDEX IF EXISTS idx_ingredients_business_code;
DROP INDEX IF EXISTS idx_packaging_items_business_code;
DROP INDEX IF EXISTS idx_recipes_business_code;
DROP INDEX IF EXISTS idx_recipes_one_active_per_product;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_branch_code_active
  ON product_categories(business_id, branch_id, lower(category_code))
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_branch_root_name_active
  ON product_categories(business_id, branch_id, lower(category_name))
  WHERE parent_category_id IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_branch_parent_name_active
  ON product_categories(business_id, branch_id, parent_category_id, lower(category_name))
  WHERE parent_category_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_branch_code
  ON products(business_id, branch_id, lower(product_code))
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_branch_sku
  ON products(business_id, branch_id, lower(sku))
  WHERE sku <> '' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_branch_barcode
  ON products(business_id, branch_id, lower(barcode))
  WHERE barcode <> '' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_branch_code_unique
  ON customers(business_id, branch_id, lower(customer_code))
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_branch_phone_unique
  ON customers(business_id, branch_id, lower(phone))
  WHERE phone <> '' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_branch_email_unique
  ON customers(business_id, branch_id, lower(email))
  WHERE email <> '' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_branch_code
  ON suppliers(business_id, branch_id, supplier_code)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_branch_code
  ON ingredients(business_id, branch_id, ingredient_code)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_packaging_items_branch_code
  ON packaging_items(business_id, branch_id, packaging_code)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_branch_code
  ON recipes(business_id, branch_id, recipe_code)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_one_active_per_branch_product
  ON recipes(business_id, branch_id, product_id)
  WHERE is_active = true AND deleted_at IS NULL;
