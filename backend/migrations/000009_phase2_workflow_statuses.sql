-- Phase 2.7 order and payment status master data.
-- Adds global system default workflow statuses plus tenant custom statuses.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS order_statuses (
  id uuid PRIMARY KEY,
  business_id uuid REFERENCES businesses(id),
  status_name varchar(100) NOT NULL,
  status_key varchar(100) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  color varchar(50),
  is_system_default boolean NOT NULL DEFAULT false,
  is_final_status boolean NOT NULL DEFAULT false,
  status varchar(50) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_order_statuses_status CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX IF NOT EXISTS idx_order_statuses_business_id ON order_statuses(business_id);
CREATE INDEX IF NOT EXISTS idx_order_statuses_deleted_at ON order_statuses(deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_statuses_system_key_active
  ON order_statuses(lower(status_key))
  WHERE business_id IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_statuses_business_key_active
  ON order_statuses(business_id, lower(status_key))
  WHERE business_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS payment_statuses (
  id uuid PRIMARY KEY,
  business_id uuid REFERENCES businesses(id),
  status_name varchar(100) NOT NULL,
  status_key varchar(100) NOT NULL,
  color varchar(50),
  is_system_default boolean NOT NULL DEFAULT false,
  status varchar(50) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_payment_statuses_status CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX IF NOT EXISTS idx_payment_statuses_business_id ON payment_statuses(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_statuses_deleted_at ON payment_statuses(deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_statuses_system_key_active
  ON payment_statuses(lower(status_key))
  WHERE business_id IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_statuses_business_key_active
  ON payment_statuses(business_id, lower(status_key))
  WHERE business_id IS NOT NULL AND deleted_at IS NULL;

INSERT INTO order_statuses (id, business_id, status_name, status_key, sort_order, color, is_system_default, is_final_status, status, created_at, updated_at)
SELECT gen_random_uuid(), NULL, seed.status_name, seed.status_key, seed.sort_order, seed.color, true, seed.is_final_status, 'active', now(), now()
FROM (
  VALUES
    ('New', 'NEW', 10, '#64748b', false),
    ('Confirmed', 'CONFIRMED', 20, '#2563eb', false),
    ('In Production', 'IN_PRODUCTION', 30, '#f59e0b', false),
    ('Ready', 'READY', 40, '#16a34a', false),
    ('Delivered', 'DELIVERED', 50, '#0f766e', true),
    ('Completed', 'COMPLETED', 60, '#15803d', true),
    ('Cancelled', 'CANCELLED', 70, '#dc2626', true)
) AS seed(status_name, status_key, sort_order, color, is_final_status)
WHERE NOT EXISTS (
  SELECT 1 FROM order_statuses os
  WHERE os.business_id IS NULL
    AND lower(os.status_key) = lower(seed.status_key)
    AND os.deleted_at IS NULL
);

INSERT INTO payment_statuses (id, business_id, status_name, status_key, color, is_system_default, status, created_at, updated_at)
SELECT gen_random_uuid(), NULL, seed.status_name, seed.status_key, seed.color, true, 'active', now(), now()
FROM (
  VALUES
    ('Pending', 'PENDING', '#f59e0b'),
    ('Partial', 'PARTIAL', '#2563eb'),
    ('Paid', 'PAID', '#16a34a'),
    ('Refunded', 'REFUNDED', '#7c3aed'),
    ('Overdue', 'OVERDUE', '#dc2626')
) AS seed(status_name, status_key, color)
WHERE NOT EXISTS (
  SELECT 1 FROM payment_statuses ps
  WHERE ps.business_id IS NULL
    AND lower(ps.status_key) = lower(seed.status_key)
    AND ps.deleted_at IS NULL
);
