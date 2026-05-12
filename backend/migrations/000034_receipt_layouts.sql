CREATE TABLE IF NOT EXISTS receipt_layouts (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NULL REFERENCES branches(id),
  layout_name varchar(150) NOT NULL,
  receipt_type varchar(50) NOT NULL,
  printer_type varchar(100),
  counter_id varchar(100),
  is_default boolean NOT NULL DEFAULT false,
  status varchar(50) NOT NULL DEFAULT 'active',
  layout_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_receipt_layout_type CHECK (receipt_type IN ('58mm', '80mm', 'a4', 'custom')),
  CONSTRAINT chk_receipt_layout_status CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX IF NOT EXISTS idx_receipt_layouts_business_id ON receipt_layouts(business_id);
CREATE INDEX IF NOT EXISTS idx_receipt_layouts_branch_id ON receipt_layouts(branch_id);
CREATE INDEX IF NOT EXISTS idx_receipt_layouts_receipt_type ON receipt_layouts(receipt_type);
CREATE INDEX IF NOT EXISTS idx_receipt_layouts_status ON receipt_layouts(status);
CREATE INDEX IF NOT EXISTS idx_receipt_layouts_deleted_at ON receipt_layouts(deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_layouts_business_branch_name
  ON receipt_layouts(
    business_id,
    COALESCE(branch_id::text, ''),
    LOWER(layout_name)
  )
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_layouts_one_default_per_scope
  ON receipt_layouts(
    business_id,
    COALESCE(branch_id::text, ''),
    receipt_type,
    COALESCE(printer_type, ''),
    COALESCE(counter_id, '')
  )
  WHERE deleted_at IS NULL
    AND is_default = true;
