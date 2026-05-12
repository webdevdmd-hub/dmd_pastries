-- Phase 0 foundation schema.
-- Apply before starting the API. Runtime GORM AutoMigrate is disabled.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY,
  business_name varchar(255) NOT NULL,
  owner_user_id uuid,
  currency varchar(10) NOT NULL,
  timezone varchar(100) NOT NULL,
  vat_number varchar(100),
  status varchar(50) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_businesses_deleted_at ON businesses(deleted_at);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY,
  business_id uuid REFERENCES businesses(id),
  role_name varchar(100) NOT NULL,
  description varchar(255),
  is_system_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_roles_business_id ON roles(business_id);
CREATE INDEX IF NOT EXISTS idx_roles_deleted_at ON roles(deleted_at);

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY,
  module_name varchar(100) NOT NULL,
  permission_key varchar(150) NOT NULL UNIQUE,
  description varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permissions_module_name ON permissions(module_name);

CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY,
  role_id uuid NOT NULL REFERENCES roles(id),
  permission_id uuid NOT NULL REFERENCES permissions(id),
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  appwrite_user_id varchar(100) NOT NULL UNIQUE,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid,
  role_id uuid NOT NULL REFERENCES roles(id),
  full_name varchar(255) NOT NULL,
  email varchar(255) NOT NULL,
  phone varchar(100),
  avatar_url varchar(500),
  status varchar(50) NOT NULL DEFAULT 'active',
  email_verified boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_businesses_owner_user'
  ) THEN
    ALTER TABLE businesses
      ADD CONSTRAINT fk_businesses_owner_user
      FOREIGN KEY (owner_user_id) REFERENCES users(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  plan_type varchar(50) NOT NULL,
  status varchar(50) NOT NULL,
  user_limit integer NOT NULL DEFAULT 5,
  branch_limit integer NOT NULL DEFAULT 1,
  trial_ends_at timestamptz,
  renewal_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_business_id ON subscriptions(business_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  user_id uuid NOT NULL,
  module_name varchar(100) NOT NULL,
  action_type varchar(100) NOT NULL,
  reference_id varchar(100) NOT NULL,
  ip_address varchar(100),
  user_agent varchar(255),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_business_id ON audit_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
