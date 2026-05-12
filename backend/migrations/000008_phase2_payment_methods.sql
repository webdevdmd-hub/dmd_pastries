-- Phase 2.6 payment methods foundation.
-- Adds tenant-scoped payment methods and seeds Cash, Card, and Bank Transfer.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  method_name varchar(150) NOT NULL,
  method_type varchar(50) NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  allow_split_payment boolean NOT NULL DEFAULT true,
  requires_reference boolean NOT NULL DEFAULT false,
  status varchar(50) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_payment_methods_method_type CHECK (method_type IN ('cash', 'card', 'bank_transfer', 'online', 'wallet', 'custom')),
  CONSTRAINT chk_payment_methods_status CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_business_id ON payment_methods(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_deleted_at ON payment_methods(deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_business_name_active
  ON payment_methods(business_id, lower(method_name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_one_default_per_business
  ON payment_methods(business_id)
  WHERE is_default = true AND deleted_at IS NULL;

INSERT INTO payment_methods (
  id,
  business_id,
  method_name,
  method_type,
  is_default,
  allow_split_payment,
  requires_reference,
  status,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  b.id,
  seed.method_name,
  seed.method_type,
  seed.is_default,
  seed.allow_split_payment,
  seed.requires_reference,
  'active',
  now(),
  now()
FROM businesses b
CROSS JOIN (
  VALUES
    ('Cash', 'cash', true, true, false),
    ('Card', 'card', false, true, true),
    ('Bank Transfer', 'bank_transfer', false, true, true)
) AS seed(method_name, method_type, is_default, allow_split_payment, requires_reference)
WHERE NOT EXISTS (
  SELECT 1
  FROM payment_methods pm
  WHERE pm.business_id = b.id
    AND lower(pm.method_name) = lower(seed.method_name)
    AND pm.deleted_at IS NULL
);
