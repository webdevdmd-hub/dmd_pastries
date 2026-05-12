-- Phase 2.4 units and measurements foundation.
-- Adds global unit categories and system default units visible to all businesses.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS unit_categories (
  id uuid PRIMARY KEY,
  name varchar(100) NOT NULL UNIQUE,
  description varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY,
  business_id uuid REFERENCES businesses(id),
  unit_category_id uuid NOT NULL REFERENCES unit_categories(id),
  unit_name varchar(100) NOT NULL,
  symbol varchar(50) NOT NULL,
  base_unit_id uuid REFERENCES units(id),
  conversion_factor numeric(18, 8) NOT NULL DEFAULT 1,
  decimal_precision integer NOT NULL DEFAULT 2,
  is_system_default boolean NOT NULL DEFAULT false,
  status varchar(50) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_units_business_id ON units(business_id);
CREATE INDEX IF NOT EXISTS idx_units_unit_category_id ON units(unit_category_id);
CREATE INDEX IF NOT EXISTS idx_units_base_unit_id ON units(base_unit_id);
CREATE INDEX IF NOT EXISTS idx_units_deleted_at ON units(deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_units_system_symbol_active
  ON units(lower(symbol))
  WHERE business_id IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_units_business_symbol_active
  ON units(business_id, lower(symbol))
  WHERE business_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_units_business_name_active
  ON units(business_id, lower(unit_name))
  WHERE business_id IS NOT NULL AND deleted_at IS NULL;

INSERT INTO unit_categories (id, name, description, created_at, updated_at)
SELECT gen_random_uuid(), seed.name, seed.description, now(), now()
FROM (
  VALUES
    ('Weight', ''),
    ('Volume', ''),
    ('Quantity', ''),
    ('Packaging', ''),
    ('Custom', '')
) AS seed(name, description)
WHERE NOT EXISTS (
  SELECT 1 FROM unit_categories uc WHERE lower(uc.name) = lower(seed.name)
);

INSERT INTO units (
  id,
  business_id,
  unit_category_id,
  unit_name,
  symbol,
  conversion_factor,
  decimal_precision,
  is_system_default,
  status,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  NULL,
  uc.id,
  seed.unit_name,
  seed.symbol,
  seed.conversion_factor,
  seed.decimal_precision,
  true,
  'active',
  now(),
  now()
FROM (
  VALUES
    ('Weight', 'Kilogram', 'kg', 1::numeric, 3),
    ('Weight', 'Gram', 'g', 0.001::numeric, 3),
    ('Weight', 'Milligram', 'mg', 0.000001::numeric, 3),
    ('Volume', 'Liter', 'ltr', 1::numeric, 3),
    ('Volume', 'Milliliter', 'ml', 0.001::numeric, 3),
    ('Quantity', 'Piece', 'pcs', 1::numeric, 0),
    ('Quantity', 'Dozen', 'dozen', 12::numeric, 0),
    ('Packaging', 'Box', 'box', 1::numeric, 0),
    ('Packaging', 'Tray', 'tray', 1::numeric, 0),
    ('Packaging', 'Cup', 'cup', 1::numeric, 0),
    ('Packaging', 'Packet', 'packet', 1::numeric, 0),
    ('Packaging', 'Bottle', 'bottle', 1::numeric, 0)
) AS seed(category_name, unit_name, symbol, conversion_factor, decimal_precision)
JOIN unit_categories uc ON lower(uc.name) = lower(seed.category_name)
WHERE NOT EXISTS (
  SELECT 1 FROM units u
  WHERE u.business_id IS NULL
    AND lower(u.symbol) = lower(seed.symbol)
    AND u.deleted_at IS NULL
);

UPDATE units child
SET base_unit_id = base.id,
    updated_at = now()
FROM (
  VALUES
    ('g', 'kg'),
    ('mg', 'kg'),
    ('ml', 'ltr'),
    ('dozen', 'pcs')
) AS rel(child_symbol, base_symbol)
JOIN units base
  ON base.business_id IS NULL
  AND lower(base.symbol) = lower(rel.base_symbol)
  AND base.deleted_at IS NULL
WHERE child.business_id IS NULL
  AND lower(child.symbol) = lower(rel.child_symbol)
  AND child.deleted_at IS NULL
  AND child.base_unit_id IS NULL;
