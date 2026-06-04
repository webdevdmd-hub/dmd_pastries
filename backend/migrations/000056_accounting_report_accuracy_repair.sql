-- Adds missing account mappings required by inventory valuation accounting.

WITH required_accounts(account_code, account_name, account_type, account_group, normal_balance, is_control_account, allow_manual_posting) AS (
    VALUES
        ('4100', 'Inventory Adjustment Gain', 'income', 'other_income', 'credit', TRUE, FALSE),
        ('5090', 'Inventory Adjustment Loss', 'cogs', 'direct_expense', 'debit', TRUE, FALSE)
)
INSERT INTO chart_of_accounts (
    id,
    business_id,
    account_code,
    account_name,
    account_type,
    account_group,
    normal_balance,
    is_control_account,
    allow_manual_posting,
    status,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    b.id,
    ra.account_code,
    ra.account_name,
    ra.account_type,
    ra.account_group,
    ra.normal_balance,
    ra.is_control_account,
    ra.allow_manual_posting,
    'active',
    NOW(),
    NOW()
FROM businesses b
CROSS JOIN required_accounts ra
WHERE b.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM chart_of_accounts coa
      WHERE coa.business_id = b.id
        AND LOWER(coa.account_code) = LOWER(ra.account_code)
        AND coa.deleted_at IS NULL
  );

WITH required_mappings(mapping_key, account_code, description) AS (
    VALUES
        ('inventory_adjustment_gain', '4100', 'Inventory adjustment gains'),
        ('inventory_adjustment_loss', '5090', 'Inventory adjustment losses')
)
INSERT INTO accounting_account_mappings (
    id,
    business_id,
    mapping_key,
    chart_account_id,
    description,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    b.id,
    rm.mapping_key,
    coa.id,
    rm.description,
    NOW(),
    NOW()
FROM businesses b
JOIN required_mappings rm ON TRUE
JOIN chart_of_accounts coa
  ON coa.business_id = b.id
 AND LOWER(coa.account_code) = LOWER(rm.account_code)
 AND coa.deleted_at IS NULL
WHERE b.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM accounting_account_mappings aam
      WHERE aam.business_id = b.id
        AND aam.mapping_key = rm.mapping_key
        AND aam.deleted_at IS NULL
  );
