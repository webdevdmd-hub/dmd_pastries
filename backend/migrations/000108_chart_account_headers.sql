-- 000108: Chart of accounts hierarchy (Phase 6 / W3)
--
-- Decision (2026-08-14): the flat 75-account chart gains 11 header rows so
-- statements subtotal by group instead of listing every account at one level.
-- Headers are grouping rows only: they carry no postings and every posting
-- path rejects them (enforced in Go, in both the manual and system journal
-- line builders).
--
-- The scheme, two levels, standard SME/Zoho shape:
--   10 Current Assets          1000-1700
--   18 Non-Current Assets      1800-1900
--   20 Current Liabilities     2000-2600
--   28 Non-Current Liabilities 2800, 2900
--   30 Equity                  3000-3400
--   40 Sales & Service Income  4000,4010,4020,4040,4050,4060,4070,4080
--   49 Other Income            4030, 4090, 4100
--   50 Cost of Sales           5000-5090
--   60 Operating Expenses      6000-6040,6060-6120,6200,6210,6240,6250,6260
--   62 Finance Costs           6050, 6220
--   63 Tax Expense             6230
--
-- Every step is idempotent and additive. Existing parent_account_id values are
-- never overwritten, so an operator who re-grouped an account by hand keeps it.

ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS is_header boolean NOT NULL DEFAULT false;

-- 1. Insert the header rows for every existing (business, branch).
WITH header_accounts(account_code, account_name, account_type, account_group, normal_balance) AS (
    VALUES
        ('10', 'Current Assets',          'asset',     'current_asset',       'debit'),
        ('18', 'Non-Current Assets',      'asset',     'fixed_asset',         'debit'),
        ('20', 'Current Liabilities',     'liability', 'current_liability',   'credit'),
        ('28', 'Non-Current Liabilities', 'liability', 'long_term_liability', 'credit'),
        ('30', 'Equity',                  'equity',    'equity',              'credit'),
        ('40', 'Sales & Service Income',  'income',    'sales_income',        'credit'),
        ('49', 'Other Income',            'income',    'other_income',        'credit'),
        ('50', 'Cost of Sales',           'cogs',      'direct_expense',      'debit'),
        ('60', 'Operating Expenses',      'expense',   'operating_expense',   'debit'),
        ('62', 'Finance Costs',           'expense',   'finance_cost',        'debit'),
        ('63', 'Tax Expense',             'expense',   'tax_expense',         'debit')
)
INSERT INTO chart_of_accounts (
    id, business_id, branch_id, account_code, account_name, account_type,
    account_group, normal_balance, is_system_account, is_control_account,
    is_header, allow_manual_posting, status, created_at, updated_at
)
SELECT
    gen_random_uuid(), b.id, br.id, ha.account_code, ha.account_name,
    ha.account_type, ha.account_group, ha.normal_balance, TRUE, FALSE,
    TRUE, FALSE, 'active', NOW(), NOW()
FROM businesses b
JOIN branches br ON br.business_id = b.id AND br.deleted_at IS NULL
CROSS JOIN header_accounts ha
WHERE b.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM chart_of_accounts coa
      WHERE coa.business_id = b.id
        AND coa.branch_id = br.id
        AND LOWER(coa.account_code) = LOWER(ha.account_code)
        AND coa.deleted_at IS NULL
  );

-- 2. Point each existing account at its header on the same branch.
WITH account_parents(child_code, parent_code) AS (
    VALUES
        ('1000','10'),('1010','10'),('1020','10'),('1030','10'),('1100','10'),
        ('1200','10'),('1210','10'),('1300','10'),('1400','10'),('1500','10'),
        ('1600','10'),('1700','10'),
        ('1800','18'),('1810','18'),('1820','18'),('1830','18'),('1840','18'),
        ('1900','18'),
        ('2000','20'),('2050','20'),('2100','20'),('2200','20'),('2300','20'),
        ('2400','20'),('2500','20'),('2600','20'),
        ('2800','28'),('2900','28'),
        ('3000','30'),('3010','30'),('3100','30'),('3200','30'),('3300','30'),
        ('3400','30'),
        ('4000','40'),('4010','40'),('4020','40'),('4040','40'),('4050','40'),
        ('4060','40'),('4070','40'),('4080','40'),
        ('4030','49'),('4090','49'),('4100','49'),
        ('5000','50'),('5010','50'),('5020','50'),('5030','50'),('5040','50'),
        ('5050','50'),('5060','50'),('5070','50'),('5080','50'),('5090','50'),
        ('6000','60'),('6010','60'),('6020','60'),('6030','60'),('6040','60'),
        ('6060','60'),('6070','60'),('6080','60'),('6090','60'),('6100','60'),
        ('6110','60'),('6120','60'),('6200','60'),('6210','60'),('6240','60'),
        ('6250','60'),('6260','60'),
        ('6050','62'),('6220','62'),
        ('6230','63')
)
UPDATE chart_of_accounts child
SET parent_account_id = parent.id,
    updated_at = NOW()
FROM account_parents ap
JOIN chart_of_accounts parent
  ON LOWER(parent.account_code) = LOWER(ap.parent_code)
 AND parent.deleted_at IS NULL
WHERE LOWER(child.account_code) = LOWER(ap.child_code)
  AND child.business_id = parent.business_id
  AND child.branch_id = parent.branch_id
  AND child.deleted_at IS NULL
  AND child.parent_account_id IS NULL;

-- 3. A header must never be postable, even if one was created before this
--    migration by hand.
UPDATE chart_of_accounts
SET allow_manual_posting = FALSE, updated_at = NOW()
WHERE is_header = TRUE AND allow_manual_posting = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent
  ON chart_of_accounts (business_id, branch_id, parent_account_id)
  WHERE deleted_at IS NULL;
