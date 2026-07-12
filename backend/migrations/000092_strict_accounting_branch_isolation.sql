-- Make accounting configuration and ledger ownership branch-specific.

ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE accounting_account_mappings ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

CREATE TEMP TABLE tmp_accounting_default_branches ON COMMIT DROP AS
SELECT DISTINCT ON (business_id) business_id, id AS branch_id
FROM branches
WHERE deleted_at IS NULL
ORDER BY business_id, is_default DESC, created_at ASC, id ASC;

UPDATE journal_entries je
SET branch_id = defaults.branch_id
FROM tmp_accounting_default_branches defaults
WHERE je.business_id = defaults.business_id AND je.branch_id IS NULL;

UPDATE chart_of_accounts account
SET branch_id = defaults.branch_id
FROM tmp_accounting_default_branches defaults
WHERE account.business_id = defaults.business_id AND account.branch_id IS NULL;

CREATE TEMP TABLE tmp_account_branch_map (
    old_account_id UUID NOT NULL,
    business_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    new_account_id UUID NOT NULL,
    PRIMARY KEY (old_account_id, branch_id)
) ON COMMIT DROP;

INSERT INTO tmp_account_branch_map(old_account_id, business_id, branch_id, new_account_id)
SELECT account.id, account.business_id, branch.id,
       CASE WHEN account.branch_id = branch.id THEN account.id ELSE gen_random_uuid() END
FROM chart_of_accounts account
JOIN branches branch ON branch.business_id = account.business_id AND branch.deleted_at IS NULL
WHERE account.deleted_at IS NULL;

INSERT INTO chart_of_accounts (
    id, business_id, branch_id, parent_account_id, account_code, account_name,
    account_type, account_group, normal_balance, description, is_system_account,
    is_control_account, allow_manual_posting, status, created_by_user_id,
    updated_by_user_id, created_at, updated_at, deleted_at
)
SELECT mapping.new_account_id, account.business_id, mapping.branch_id, NULL,
       account.account_code, account.account_name, account.account_type,
       account.account_group, account.normal_balance, account.description,
       account.is_system_account, account.is_control_account,
       account.allow_manual_posting, account.status, account.created_by_user_id,
       account.updated_by_user_id, account.created_at, account.updated_at, account.deleted_at
FROM tmp_account_branch_map mapping
JOIN chart_of_accounts account ON account.id = mapping.old_account_id
WHERE mapping.new_account_id <> mapping.old_account_id;

UPDATE chart_of_accounts child
SET parent_account_id = parent_map.new_account_id
FROM tmp_account_branch_map child_map
JOIN chart_of_accounts original ON original.id = child_map.old_account_id
JOIN tmp_account_branch_map parent_map
  ON parent_map.old_account_id = original.parent_account_id
 AND parent_map.branch_id = child_map.branch_id
WHERE child.id = child_map.new_account_id;

UPDATE journal_entry_lines line
SET account_id = mapping.new_account_id
FROM journal_entries entry, tmp_account_branch_map mapping
WHERE line.journal_entry_id = entry.id
  AND line.business_id = entry.business_id
  AND mapping.old_account_id = line.account_id
  AND mapping.branch_id = entry.branch_id;

UPDATE payment_accounts payment
SET branch_id = defaults.branch_id
FROM tmp_accounting_default_branches defaults
WHERE payment.business_id = defaults.business_id AND payment.branch_id IS NULL;

UPDATE payment_accounts payment
SET chart_account_id = mapping.new_account_id
FROM tmp_account_branch_map mapping
WHERE mapping.old_account_id = payment.chart_account_id
  AND mapping.branch_id = payment.branch_id;

UPDATE account_transfers transfer
SET branch_id = defaults.branch_id
FROM tmp_accounting_default_branches defaults
WHERE transfer.business_id = defaults.business_id AND transfer.branch_id IS NULL;

UPDATE account_transfers transfer
SET from_chart_account_id = from_map.new_account_id,
    to_chart_account_id = to_map.new_account_id
FROM tmp_account_branch_map from_map, tmp_account_branch_map to_map
WHERE from_map.old_account_id = transfer.from_chart_account_id
  AND to_map.old_account_id = transfer.to_chart_account_id
  AND from_map.branch_id = transfer.branch_id
  AND to_map.branch_id = transfer.branch_id;

UPDATE platform_settlements settlement
SET branch_id = defaults.branch_id
FROM tmp_accounting_default_branches defaults
WHERE settlement.business_id = defaults.business_id AND settlement.branch_id IS NULL;

UPDATE platform_settlements settlement
SET platform_chart_account_id = platform_map.new_account_id,
    deposit_chart_account_id = deposit_map.new_account_id
FROM tmp_account_branch_map platform_map, tmp_account_branch_map deposit_map
WHERE platform_map.old_account_id = settlement.platform_chart_account_id
  AND deposit_map.old_account_id = settlement.deposit_chart_account_id
  AND platform_map.branch_id = settlement.branch_id
  AND deposit_map.branch_id = settlement.branch_id;

UPDATE platform_settlement_deductions deduction
SET expense_account_id = mapping.new_account_id
FROM platform_settlements settlement, tmp_account_branch_map mapping
WHERE deduction.platform_settlement_id = settlement.id
  AND deduction.business_id = settlement.business_id
  AND mapping.old_account_id = deduction.expense_account_id
  AND mapping.branch_id = settlement.branch_id;

UPDATE expenses expense
SET expense_account_id = expense_map.new_account_id,
    paid_through_account_id = paid_map.new_account_id
FROM tmp_account_branch_map expense_map, tmp_account_branch_map paid_map
WHERE expense_map.old_account_id = expense.expense_account_id
  AND paid_map.old_account_id = expense.paid_through_account_id
  AND expense_map.branch_id = expense.branch_id
  AND paid_map.branch_id = expense.branch_id;

UPDATE purchase_invoice_items item
SET account_id = mapping.new_account_id
FROM purchase_invoices invoice, tmp_account_branch_map mapping
WHERE item.purchase_invoice_id = invoice.id
  AND item.business_id = invoice.business_id
  AND item.account_id IS NOT NULL
  AND mapping.old_account_id = item.account_id
  AND mapping.branch_id = invoice.branch_id;

UPDATE purchase_order_items item
SET account_id = mapping.new_account_id
FROM purchase_orders purchase_order, tmp_account_branch_map mapping
WHERE item.purchase_order_id = purchase_order.id
  AND item.business_id = purchase_order.business_id
  AND item.account_id IS NOT NULL
  AND mapping.old_account_id = item.account_id
  AND mapping.branch_id = purchase_order.branch_id;

INSERT INTO accounting_account_mappings (
    id, business_id, branch_id, mapping_key, chart_account_id, description,
    created_at, updated_at, deleted_at
)
SELECT gen_random_uuid(), mapping.business_id, branch.id, mapping.mapping_key,
       account_map.new_account_id, mapping.description, mapping.created_at,
       mapping.updated_at, mapping.deleted_at
FROM accounting_account_mappings mapping
JOIN tmp_accounting_default_branches defaults ON defaults.business_id = mapping.business_id
JOIN branches branch ON branch.business_id = mapping.business_id AND branch.deleted_at IS NULL
JOIN tmp_account_branch_map account_map
  ON account_map.old_account_id = mapping.chart_account_id
 AND account_map.branch_id = branch.id
WHERE mapping.branch_id IS NULL AND branch.id <> defaults.branch_id;

UPDATE accounting_account_mappings mapping
SET branch_id = defaults.branch_id
FROM tmp_accounting_default_branches defaults
WHERE mapping.business_id = defaults.business_id AND mapping.branch_id IS NULL;

DROP INDEX IF EXISTS idx_chart_of_accounts_business_code;
DROP INDEX IF EXISTS idx_accounting_account_mappings_unique_active;

CREATE UNIQUE INDEX idx_chart_of_accounts_business_branch_code
    ON chart_of_accounts(business_id, branch_id, LOWER(account_code))
    WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_accounting_account_mappings_branch_unique_active
    ON accounting_account_mappings(business_id, branch_id, mapping_key)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_business_branch
    ON chart_of_accounts(business_id, branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_mappings_business_branch
    ON accounting_account_mappings(business_id, branch_id) WHERE deleted_at IS NULL;

ALTER TABLE chart_of_accounts ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE accounting_account_mappings ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE journal_entries ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE payment_accounts ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE account_transfers ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE platform_settlements ALTER COLUMN branch_id SET NOT NULL;
