-- Give journal lines their own branch, and tie them to the entry and account.
--
-- Migration 000092 made chart_of_accounts branch-scoped, but the posting code
-- kept resolving accounts by (business_id, account_code). That lookup now
-- matches one row per branch and returns an arbitrary one, so a journal header
-- can carry branch B while its lines point at branch A's accounts. Nothing in
-- the schema prevented that.
--
-- The invariant spans three tables, so it cannot be a CHECK. Two composite
-- foreign keys express it instead.
--
-- Everything here is safe to apply to existing data:
--   * the new column is nullable, so no backfill is required to land it
--   * both foreign keys are NOT VALID, which enforces them on new writes while
--     leaving historical rows unchecked
--
-- Historical rows already violate fk_jel_account_branch — that is the defect
-- being fixed — so a validated constraint would fail this migration and, because
-- migrations run automatically at start-up, prevent the application from
-- booting. SET NOT NULL and VALIDATE CONSTRAINT are deliberately deferred to the
-- documented remediation in docs/accounting-branch-backfill.md, to be run by an
-- operator once the cross-branch line count reaches zero.

ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- Composite foreign keys need a matching unique constraint on the referenced side.
ALTER TABLE journal_entries
    DROP CONSTRAINT IF EXISTS uq_journal_entries_id_branch;
ALTER TABLE journal_entries
    ADD CONSTRAINT uq_journal_entries_id_branch UNIQUE (id, branch_id);

ALTER TABLE chart_of_accounts
    DROP CONSTRAINT IF EXISTS uq_chart_of_accounts_id_branch;
ALTER TABLE chart_of_accounts
    ADD CONSTRAINT uq_chart_of_accounts_id_branch UNIQUE (id, branch_id);

ALTER TABLE journal_entry_lines
    DROP CONSTRAINT IF EXISTS fk_jel_entry_branch;
ALTER TABLE journal_entry_lines
    ADD CONSTRAINT fk_jel_entry_branch
        FOREIGN KEY (journal_entry_id, branch_id)
        REFERENCES journal_entries(id, branch_id) NOT VALID;

ALTER TABLE journal_entry_lines
    DROP CONSTRAINT IF EXISTS fk_jel_account_branch;
ALTER TABLE journal_entry_lines
    ADD CONSTRAINT fk_jel_account_branch
        FOREIGN KEY (account_id, branch_id)
        REFERENCES chart_of_accounts(id, branch_id) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_business_branch
    ON journal_entry_lines (business_id, branch_id);
