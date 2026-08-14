-- 000106: Year-end close + retained earnings (Phase 5 / W2)
--
-- 3100 Retained Earnings has been seeded since the chart of accounts
-- existed, but nothing ever posted to it: the balance sheet's "Current Year
-- Profit / Loss" row was synthesized by re-running the P&L, so from year two
-- onward the prior year's profit belonged to no equity account and the sheet
-- could not balance. The close journal moves each closed year's income and
-- expense balances into 3100 for real.
--
-- No schema is needed -- close state is derived from the year_end_close
-- journals themselves, and the lock column shipped in 000104. This migration
-- only backfills the account mapping for businesses that already exist;
-- requiredMappedAccount self-heals a missing one, but seeding it here keeps
-- the mappings screen truthful.

INSERT INTO account_mappings (id, business_id, branch_id, mapping_key, chart_account_id, description, created_at, updated_at)
SELECT gen_random_uuid(), coa.business_id, coa.branch_id, 'retained_earnings', coa.id,
       'Accumulated profits from closed financial years', now(), now()
FROM chart_of_accounts coa
WHERE coa.account_code = '3100'
  AND coa.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM account_mappings am
      WHERE am.business_id = coa.business_id
        AND am.branch_id = coa.branch_id
        AND am.mapping_key = 'retained_earnings'
        AND am.deleted_at IS NULL
  );
