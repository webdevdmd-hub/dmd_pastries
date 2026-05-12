-- Sprint 3.3 suppliers foundation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO permissions (id, module_name, permission_key, description, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'suppliers', 'suppliers.view', 'View suppliers', now(), now()),
  (gen_random_uuid(), 'suppliers', 'suppliers.manage', 'Manage suppliers', now(), now())
ON CONFLICT (permission_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  supplier_code varchar(100) NOT NULL,
  supplier_name varchar(255) NOT NULL,
  supplier_category_id uuid REFERENCES supplier_categories(id),
  phone varchar(100),
  email varchar(255),
  website varchar(255),
  address_line_1 varchar(255),
  address_line_2 varchar(255),
  city varchar(100),
  state varchar(100),
  country varchar(100),
  postal_code varchar(50),
  tax_number varchar(100),
  notes text,
  status varchar(50) NOT NULL DEFAULT 'active',
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_suppliers_status CHECK (status IN ('active', 'inactive', 'blocked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_business_code
  ON suppliers(business_id, supplier_code)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_business_id ON suppliers(business_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_category_id ON suppliers(supplier_category_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_deleted_at ON suppliers(deleted_at);

CREATE TABLE IF NOT EXISTS supplier_contacts (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  contact_name varchar(255) NOT NULL,
  contact_role varchar(150),
  phone varchar(100),
  email varchar(255),
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_contacts_one_primary
  ON supplier_contacts(business_id, supplier_id)
  WHERE is_primary = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_business_id ON supplier_contacts(business_id);
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier_id ON supplier_contacts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_deleted_at ON supplier_contacts(deleted_at);

CREATE TABLE IF NOT EXISTS supplier_notes (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  note text NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_supplier_notes_business_id ON supplier_notes(business_id);
CREATE INDEX IF NOT EXISTS idx_supplier_notes_supplier_id ON supplier_notes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_notes_deleted_at ON supplier_notes(deleted_at);
