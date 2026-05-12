-- Phase 2.1 settings foundation.
-- Apply after 000002_phase1_business_workspace.sql.

CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL UNIQUE REFERENCES businesses(id),
  business_display_name varchar(255) NOT NULL,
  logo_url varchar(500),
  address varchar(500),
  phone varchar(100),
  email varchar(255),
  website varchar(255),
  vat_number varchar(100),
  currency varchar(10) NOT NULL,
  timezone varchar(100) NOT NULL,
  invoice_footer varchar(500),
  receipt_footer varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_company_settings_deleted_at ON company_settings(deleted_at);

INSERT INTO company_settings (
  id,
  business_id,
  business_display_name,
  vat_number,
  currency,
  timezone,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  b.id,
  b.business_name,
  b.vat_number,
  b.currency,
  b.timezone,
  now(),
  now()
FROM businesses b
LEFT JOIN company_settings cs ON cs.business_id = b.id
WHERE cs.id IS NULL;
