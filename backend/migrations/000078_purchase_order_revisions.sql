CREATE TABLE IF NOT EXISTS purchase_order_revisions (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
  revision_number integer NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'applied',
  payment_excess_action varchar(50) NOT NULL DEFAULT 'supplier_advance',
  reason text NOT NULL DEFAULT '',
  original_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  revised_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  impact_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_purchase_order_revisions_status CHECK (status IN ('previewed', 'applied', 'failed')),
  CONSTRAINT chk_purchase_order_revisions_payment_excess_action CHECK (payment_excess_action IN ('supplier_advance', 'vendor_credit', 'refund_receivable'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_order_revisions_business_order_revision
  ON purchase_order_revisions(business_id, purchase_order_id, revision_number)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_order_revisions_business_id ON purchase_order_revisions(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_revisions_purchase_order_id ON purchase_order_revisions(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_revisions_branch_id ON purchase_order_revisions(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_revisions_created_at ON purchase_order_revisions(created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_order_revisions_deleted_at ON purchase_order_revisions(deleted_at);
