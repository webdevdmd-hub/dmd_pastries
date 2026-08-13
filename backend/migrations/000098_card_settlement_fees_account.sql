-- 000098: Card settlement support (Phase 4 / W5)
--
-- Decision (2026-08-12 workshop, §5): card settlements reuse the existing
-- platform-settlement flow (clearing -> bank, fees as deductions). This
-- migration seeds the dedicated fees account, 6260 Card Processing Fees, for
-- every existing branch so it is pickable as a settlement deduction. New
-- tenants get it from the seeder.

WITH required_accounts(account_code, account_name, account_type, account_group, normal_balance, is_control_account, allow_manual_posting) AS (
    VALUES
        ('6260', 'Card Processing Fees', 'expense', 'operating_expense', 'debit', FALSE, TRUE)
)
INSERT INTO chart_of_accounts (
    id,
    business_id,
    branch_id,
    account_code,
    account_name,
    account_type,
    account_group,
    normal_balance,
    is_control_account,
    allow_manual_posting,
    is_system_account,
    status,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    b.id,
    br.id,
    ra.account_code,
    ra.account_name,
    ra.account_type,
    ra.account_group,
    ra.normal_balance,
    ra.is_control_account,
    ra.allow_manual_posting,
    TRUE,
    'active',
    NOW(),
    NOW()
FROM businesses b
JOIN branches br ON br.business_id = b.id AND br.deleted_at IS NULL
CROSS JOIN required_accounts ra
WHERE b.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM chart_of_accounts coa
      WHERE coa.business_id = b.id
        AND coa.branch_id = br.id
        AND LOWER(coa.account_code) = LOWER(ra.account_code)
        AND coa.deleted_at IS NULL
  );
