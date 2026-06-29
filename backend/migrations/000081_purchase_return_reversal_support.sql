ALTER TABLE purchase_returns
  ADD COLUMN IF NOT EXISTS reversal_journal_entry_id uuid REFERENCES journal_entries(id),
  ADD COLUMN IF NOT EXISTS original_return_id uuid REFERENCES purchase_returns(id),
  ADD COLUMN IF NOT EXISTS reversal_return_id uuid REFERENCES purchase_returns(id),
  ADD COLUMN IF NOT EXISTS reversal_reason text,
  ADD COLUMN IF NOT EXISTS reversed_by_user_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz;

ALTER TABLE purchase_returns DROP CONSTRAINT IF EXISTS chk_purchase_returns_status;
ALTER TABLE purchase_returns
  ADD CONSTRAINT chk_purchase_returns_status CHECK (status IN ('draft', 'posted', 'cancelled', 'reversed'));

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS chk_stock_movement_type;
ALTER TABLE stock_movements
  ADD CONSTRAINT chk_stock_movement_type CHECK (movement_type IN (
    'opening_stock',
    'purchase_in',
    'purchase_return_out',
    'sale_out',
    'adjustment_in',
    'adjustment_out',
    'wastage',
    'return_in',
    'transfer',
    'transfer_in',
    'transfer_out',
    'production_in',
    'production_out',
    'purchase_bill_cancel_out'
  ));

CREATE INDEX IF NOT EXISTS idx_purchase_returns_reversal_journal_entry_id
  ON purchase_returns(reversal_journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_original_return_id
  ON purchase_returns(original_return_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_reversal_return_id
  ON purchase_returns(reversal_return_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_reversed_by_user_id
  ON purchase_returns(reversed_by_user_id);

INSERT INTO permissions (id, module_name, permission_key, description, created_at, updated_at)
VALUES (gen_random_uuid(), 'purchasing', 'purchasing.returns.reverse', 'Reverse posted purchase returns and vendor credits', now(), now())
ON CONFLICT (permission_key) DO UPDATE
SET module_name = EXCLUDED.module_name,
    description = EXCLUDED.description,
    updated_at = now();

INSERT INTO role_permissions (id, role_id, permission_id, allowed, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, true, now(), now()
FROM roles r
CROSS JOIN permissions p
WHERE r.business_id IS NOT NULL
  AND r.role_name IN ('Admin', 'Manager')
  AND p.permission_key = 'purchasing.returns.reverse'
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );
