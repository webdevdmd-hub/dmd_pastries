-- Phase 1 business workspace schema additions.
-- Apply after 000001_phase0_foundation.sql.

CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_name varchar(255) NOT NULL,
  name varchar(255) NOT NULL,
  code varchar(50) NOT NULL,
  address varchar(500),
  phone varchar(100),
  email varchar(255),
  address_line1 varchar(255),
  address_line2 varchar(255),
  city varchar(100),
  country varchar(100),
  timezone varchar(100),
  is_default boolean NOT NULL DEFAULT false,
  status varchar(50) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_branches_business_id ON branches(business_id);
CREATE INDEX IF NOT EXISTS idx_branches_business_default ON branches(business_id, is_default);
CREATE INDEX IF NOT EXISTS idx_branches_deleted_at ON branches(deleted_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_branch'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_branch
      FOREIGN KEY (branch_id) REFERENCES branches(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS business_settings (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL UNIQUE REFERENCES businesses(id),
  receipt_footer varchar(500),
  allow_negative_stock boolean NOT NULL DEFAULT false,
  default_tax_rate numeric NOT NULL DEFAULT 0,
  price_includes_tax boolean NOT NULL DEFAULT false,
  low_stock_alert boolean NOT NULL DEFAULT true,
  default_language varchar(20) NOT NULL DEFAULT 'en',
  date_format varchar(50) NOT NULL DEFAULT 'YYYY-MM-DD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_invitations (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid REFERENCES branches(id),
  role_id uuid NOT NULL REFERENCES roles(id),
  full_name varchar(255) NOT NULL,
  email varchar(255) NOT NULL,
  phone varchar(100),
  token_hash varchar(64) NOT NULL UNIQUE,
  status varchar(50) NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_business_id ON user_invitations(business_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_branch_id ON user_invitations(branch_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_role_id ON user_invitations(role_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_user_id uuid;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_user_id uuid;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS event_type varchar(150);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type varchar(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id varchar(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS summary varchar(500);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
