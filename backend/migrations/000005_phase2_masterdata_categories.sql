-- Phase 2.3 master data category foundation.
-- Adds tenant-scoped product, ingredient, packaging, and supplier categories.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS product_categories (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  parent_category_id uuid REFERENCES product_categories(id),
  category_name varchar(255) NOT NULL,
  category_code varchar(100) NOT NULL,
  description varchar(500),
  image_url varchar(500),
  sort_order integer NOT NULL DEFAULT 0,
  status varchar(50) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_product_categories_business_id ON product_categories(business_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_parent_category_id ON product_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_deleted_at ON product_categories(deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_business_code_active
  ON product_categories(business_id, lower(category_code))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_business_root_name_active
  ON product_categories(business_id, lower(category_name))
  WHERE parent_category_id IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_business_parent_name_active
  ON product_categories(business_id, parent_category_id, lower(category_name))
  WHERE parent_category_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ingredient_categories (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  category_name varchar(255) NOT NULL,
  description varchar(500),
  status varchar(50) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ingredient_categories_business_id ON ingredient_categories(business_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_categories_deleted_at ON ingredient_categories(deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredient_categories_business_name_active
  ON ingredient_categories(business_id, lower(category_name))
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS packaging_categories (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  category_name varchar(255) NOT NULL,
  description varchar(500),
  status varchar(50) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_packaging_categories_business_id ON packaging_categories(business_id);
CREATE INDEX IF NOT EXISTS idx_packaging_categories_deleted_at ON packaging_categories(deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_packaging_categories_business_name_active
  ON packaging_categories(business_id, lower(category_name))
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS supplier_categories (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  category_name varchar(255) NOT NULL,
  description varchar(500),
  status varchar(50) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_supplier_categories_business_id ON supplier_categories(business_id);
CREATE INDEX IF NOT EXISTS idx_supplier_categories_deleted_at ON supplier_categories(deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_categories_business_name_active
  ON supplier_categories(business_id, lower(category_name))
  WHERE deleted_at IS NULL;

INSERT INTO product_categories (id, business_id, category_name, category_code, sort_order, status, created_at, updated_at)
SELECT gen_random_uuid(), b.id, seed.category_name, seed.category_code, seed.sort_order, 'active', now(), now()
FROM businesses b
CROSS JOIN (
  VALUES
    ('Cakes', 'CAKES', 10),
    ('Pastries', 'PASTRIES', 20),
    ('Beverages', 'BEVERAGES', 30),
    ('Snacks', 'SNACKS', 40),
    ('Retail Items', 'RETAIL_ITEMS', 50)
) AS seed(category_name, category_code, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM product_categories pc
  WHERE pc.business_id = b.id
    AND lower(pc.category_name) = lower(seed.category_name)
    AND pc.parent_category_id IS NULL
    AND pc.deleted_at IS NULL
);

INSERT INTO ingredient_categories (id, business_id, category_name, status, created_at, updated_at)
SELECT gen_random_uuid(), b.id, seed.category_name, 'active', now(), now()
FROM businesses b
CROSS JOIN (
  VALUES
    ('Flour'),
    ('Sugar'),
    ('Dairy'),
    ('Chocolate'),
    ('Flavoring'),
    ('Fruits'),
    ('Dry Ingredients')
) AS seed(category_name)
WHERE NOT EXISTS (
  SELECT 1 FROM ingredient_categories c
  WHERE c.business_id = b.id
    AND lower(c.category_name) = lower(seed.category_name)
    AND c.deleted_at IS NULL
);

INSERT INTO packaging_categories (id, business_id, category_name, status, created_at, updated_at)
SELECT gen_random_uuid(), b.id, seed.category_name, 'active', now(), now()
FROM businesses b
CROSS JOIN (
  VALUES
    ('Cake Boxes'),
    ('Cups'),
    ('Trays'),
    ('Bags'),
    ('Stickers'),
    ('Candles'),
    ('Labels')
) AS seed(category_name)
WHERE NOT EXISTS (
  SELECT 1 FROM packaging_categories c
  WHERE c.business_id = b.id
    AND lower(c.category_name) = lower(seed.category_name)
    AND c.deleted_at IS NULL
);

INSERT INTO supplier_categories (id, business_id, category_name, status, created_at, updated_at)
SELECT gen_random_uuid(), b.id, seed.category_name, 'active', now(), now()
FROM businesses b
CROSS JOIN (
  VALUES
    ('Ingredient Supplier'),
    ('Packaging Supplier'),
    ('Equipment Supplier'),
    ('Logistics Supplier'),
    ('Service Provider')
) AS seed(category_name)
WHERE NOT EXISTS (
  SELECT 1 FROM supplier_categories c
  WHERE c.business_id = b.id
    AND lower(c.category_name) = lower(seed.category_name)
    AND c.deleted_at IS NULL
);
