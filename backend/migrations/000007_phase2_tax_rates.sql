-- Phase 2.5 tax rates foundation.
-- Adds tenant-scoped tax rates and seeds UAE VAT 5% for existing businesses.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tax_rates (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  tax_name varchar(150) NOT NULL,
  tax_type varchar(50) NOT NULL,
  rate_percentage numeric(7, 4) NOT NULL,
  is_inclusive boolean NOT NULL DEFAULT false,
  country varchar(100),
  region varchar(100),
  is_default boolean NOT NULL DEFAULT false,
  status varchar(50) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_tax_rates_rate_percentage CHECK (rate_percentage >= 0 AND rate_percentage <= 100),
  CONSTRAINT chk_tax_rates_tax_type CHECK (tax_type IN ('VAT', 'GST', 'Sales Tax', 'Service Charge', 'Custom')),
  CONSTRAINT chk_tax_rates_status CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX IF NOT EXISTS idx_tax_rates_business_id ON tax_rates(business_id);
CREATE INDEX IF NOT EXISTS idx_tax_rates_deleted_at ON tax_rates(deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_rates_business_name_active
  ON tax_rates(business_id, lower(tax_name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_rates_one_default_per_business
  ON tax_rates(business_id)
  WHERE is_default = true AND deleted_at IS NULL;

INSERT INTO tax_rates (
  id,
  business_id,
  tax_name,
  tax_type,
  rate_percentage,
  is_inclusive,
  country,
  is_default,
  status,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  b.id,
  'UAE VAT 5%',
  'VAT',
  5,
  false,
  'UAE',
  true,
  'active',
  now(),
  now()
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1
  FROM tax_rates tr
  WHERE tr.business_id = b.id
    AND lower(tr.tax_name) = lower('UAE VAT 5%')
    AND tr.deleted_at IS NULL
);
