-- 000115: Lock the accounts the app posts to by itself; add a manual adjustments account.
--
-- ISSUE-039 (found by /qa on production, 2026-09-16). The seed marks system
-- accounts "no manual posting", but ChartAccount.AllowManualPosting carries
-- gorm:"default:true" and GORM left false out of the INSERT, so the database
-- default TRUE won on every business. The expense form therefore offered
-- 5000 Opening Stock, 5070 Cost of Goods Sold and 1030 Card Clearing, and
-- manual journals and bill account lines accepted them.
--
-- Owner decision (2026-09-16): lock the accounts the app fills automatically,
-- and give hand corrections their own visible account instead.
--
--   locked   1030 Card Clearing Account
--            5000 Opening Stock        5010 Purchase
--            5020 Purchase Return      5050 Production Cost
--            5070 Cost of Goods Sold   5080 Wastage Expense
--            5090 Inventory Adjustment Loss
--   added    5095 Cost of Sales Adjustments (manual), under 50 Cost of Sales
--
-- What this does NOT change:
--   * Past journals, expenses and reports. Only future hand entries.
--   * Automatic postings: system journals do not check the lock.
--   * The 20 other accounts the seed once marked locked (receivables,
--     payables, inventory, VAT, advances, equity, income). They were never
--     locked in practice and locking them was not part of this decision.
--   * Accounts an operator created by hand (is_system_account = FALSE).
--
-- Any account can be unlocked again in Chart of Accounts -> Edit.
-- Idempotent: safe to run twice.

-- 1. Re-lock the automatic accounts the seed created.
UPDATE chart_of_accounts
SET allow_manual_posting = FALSE,
    updated_at = NOW()
WHERE is_system_account = TRUE
  AND is_header = FALSE
  AND deleted_at IS NULL
  AND allow_manual_posting = TRUE
  AND account_code IN ('1030', '5000', '5010', '5020', '5050', '5070', '5080', '5090');

-- 2. Add 5095 on every branch that has a chart, under that branch's 50 header.
INSERT INTO chart_of_accounts (
    id, business_id, branch_id, parent_account_id, account_code, account_name,
    account_type, account_group, normal_balance, is_system_account,
    is_control_account, is_header, allow_manual_posting, status, created_at, updated_at
)
SELECT
    gen_random_uuid(), header.business_id, header.branch_id, header.id, '5095',
    'Cost of Sales Adjustments (manual)', 'cogs', 'direct_expense', 'debit', TRUE,
    FALSE, FALSE, TRUE, 'active', NOW(), NOW()
FROM chart_of_accounts header
WHERE header.account_code = '50'
  AND header.is_header = TRUE
  AND header.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM chart_of_accounts existing
      WHERE existing.business_id = header.business_id
        AND existing.branch_id = header.branch_id
        AND LOWER(existing.account_code) = LOWER('5095')
        AND existing.deleted_at IS NULL
  );
