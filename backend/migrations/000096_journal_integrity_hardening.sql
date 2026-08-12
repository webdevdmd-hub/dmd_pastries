-- 000096: Journal integrity hardening (audit Phase 3, 2026-08-12)
--
-- Finishes what 000095 staged and the operator runbook
-- (docs/accounting-branch-backfill.md steps 4-6) left pending:
--   1. Backfill journal_entry_lines.branch_id from the entry header.
--   2. Create the journal source idempotency unique index (K6).
--   3. Validate the 000095 composite branch FKs.
--   4. SET NOT NULL on journal_entry_lines.branch_id.
--
-- Every step is defensive: on a database whose data is still dirty the step
-- raises a NOTICE and skips rather than failing boot. Re-running is safe;
-- once the data is clean the skipped steps complete on the next boot.

-- 1. Backfill NULL line branches from the entry header. Safe by construction:
--    the line inherits exactly the branch its journal already carries.
UPDATE journal_entry_lines jl
SET branch_id = je.branch_id
FROM journal_entries je
WHERE je.id = jl.journal_entry_id
  AND jl.branch_id IS NULL
  AND je.branch_id IS NOT NULL;

-- 2. Idempotency: one posted/reversed journal per (business, source_type,
--    source_id). Skipped with a NOTICE while duplicates exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE deleted_at IS NULL AND source_id IS NOT NULL
      AND source_type <> '' AND status IN ('posted', 'reversed')
    GROUP BY business_id, source_type, source_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE '000096: duplicate journal sources exist; idempotency index NOT created. Resolve duplicates (runbook step 5) and re-run.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_unique_source_posted
      ON journal_entries (business_id, source_type, source_id)
      WHERE deleted_at IS NULL AND source_id IS NOT NULL
        AND source_type <> '' AND status IN ('posted', 'reversed');
  END IF;
END $$;

-- 3. Validate the 000095 NOT VALID composite FKs. NOTICE + skip on failure.
DO $$
BEGIN
  BEGIN
    ALTER TABLE journal_entry_lines VALIDATE CONSTRAINT fk_jel_entry_branch;
  EXCEPTION WHEN others THEN
    RAISE NOTICE '000096: fk_jel_entry_branch validation failed (%); remap cross-branch lines (runbook step 3) and re-run.', SQLERRM;
  END;
  BEGIN
    ALTER TABLE journal_entry_lines VALIDATE CONSTRAINT fk_jel_account_branch;
  EXCEPTION WHEN others THEN
    RAISE NOTICE '000096: fk_jel_account_branch validation failed (%); remap cross-branch lines (runbook step 3) and re-run.', SQLERRM;
  END;
END $$;

-- 4. Require a branch on every line once no NULLs remain.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM journal_entry_lines WHERE branch_id IS NULL) THEN
    RAISE NOTICE '000096: NULL-branch journal lines remain (headers without a branch); SET NOT NULL skipped.';
  ELSE
    ALTER TABLE journal_entry_lines ALTER COLUMN branch_id SET NOT NULL;
  END IF;
END $$;
