-- 000103: Repair default_tax_mode for businesses created after 000101
--
-- Migration 000101 derived every business's default_tax_mode from its
-- governing tax rate's is_inclusive flag, but business creation kept
-- hard-coding 'inclusive'. Businesses signed up between 000101 and the Go
-- fix (EnsureSettings.derivedDefaultTaxMode) therefore carry
-- default_tax_mode='inclusive' against an exclusive-flagged rate — the
-- server's Default-mode totals then disagree with every client preview and
-- non-cash checkouts fail as phantom overpayments (/qa 2026-08-14,
-- ISSUE-003). Re-derive exactly that cohort: rows still on 'inclusive'
-- whose governing rate is exclusive.

WITH business_modes AS (
    SELECT b.id AS business_id,
           CASE WHEN COALESCE((
               SELECT tr.is_inclusive FROM tax_rates tr
               WHERE tr.business_id = b.id AND tr.deleted_at IS NULL AND tr.status = 'active'
               ORDER BY tr.is_default DESC, tr.created_at ASC
               LIMIT 1
           ), TRUE) THEN 'inclusive' ELSE 'exclusive' END AS mode
    FROM businesses b
    WHERE b.deleted_at IS NULL
)
UPDATE business_settings bs
SET default_tax_mode = bm.mode
FROM business_modes bm
WHERE bs.business_id = bm.business_id
  AND bs.default_tax_mode = 'inclusive'
  AND bm.mode = 'exclusive';
