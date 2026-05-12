BEGIN;

INSERT INTO permissions (id, module_name, permission_key, description, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'customers', 'customers.view', 'View customers', now(), now()),
  (gen_random_uuid(), 'customers', 'customers.manage', 'Manage customers', now(), now())
ON CONFLICT (permission_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) DEFERRABLE INITIALLY DEFERRED,
  customer_code varchar(100) NOT NULL,
  full_name varchar(255) NOT NULL,
  phone varchar(100),
  email varchar(255),
  date_of_birth date,
  gender varchar(50),
  address_line_1 varchar(255),
  address_line_2 varchar(255),
  city varchar(100),
  state varchar(100),
  country varchar(100),
  postal_code varchar(50),
  notes text,
  status varchar(50) NOT NULL DEFAULT 'active',
  created_by_user_id uuid NOT NULL REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED,
  updated_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_customers_status CHECK (status IN ('active', 'inactive', 'blocked')),
  CONSTRAINT chk_customers_gender CHECK (gender IS NULL OR gender IN ('male', 'female', 'other', 'prefer_not_to_say'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_business_code_unique
  ON customers (business_id, lower(customer_code))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_business_phone_unique
  ON customers (business_id, lower(phone))
  WHERE deleted_at IS NULL AND NULLIF(BTRIM(COALESCE(phone, '')), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_business_email_unique
  ON customers (business_id, lower(email))
  WHERE deleted_at IS NULL AND NULLIF(BTRIM(COALESCE(email, '')), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers (business_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers (status);
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers (deleted_at);

CREATE TABLE IF NOT EXISTS customer_tags (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) DEFERRABLE INITIALLY DEFERRED,
  tag_name varchar(100) NOT NULL,
  color varchar(50),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_tags_business_name_unique
  ON customer_tags (business_id, lower(tag_name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_tags_business_id ON customer_tags (business_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_deleted_at ON customer_tags (deleted_at);

CREATE TABLE IF NOT EXISTS customer_tag_mappings (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) DEFERRABLE INITIALLY DEFERRED,
  customer_id uuid NOT NULL REFERENCES customers(id) DEFERRABLE INITIALLY DEFERRED,
  tag_id uuid NOT NULL REFERENCES customer_tags(id) DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_tag_mappings_unique
  ON customer_tag_mappings (business_id, customer_id, tag_id);

CREATE INDEX IF NOT EXISTS idx_customer_tag_mappings_business_id ON customer_tag_mappings (business_id);
CREATE INDEX IF NOT EXISTS idx_customer_tag_mappings_customer_id ON customer_tag_mappings (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tag_mappings_tag_id ON customer_tag_mappings (tag_id);

CREATE TABLE IF NOT EXISTS customer_notes (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) DEFERRABLE INITIALLY DEFERRED,
  customer_id uuid NOT NULL REFERENCES customers(id) DEFERRABLE INITIALLY DEFERRED,
  note text NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_customer_notes_business_id ON customer_notes (business_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer_id ON customer_notes (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_deleted_at ON customer_notes (deleted_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sales_customer'
  ) THEN
    ALTER TABLE sales
      ADD CONSTRAINT fk_sales_customer
      FOREIGN KEY (customer_id)
      REFERENCES customers(id)
      DEFERRABLE INITIALLY DEFERRED
      NOT VALID;
  END IF;
END $$;

COMMIT;
