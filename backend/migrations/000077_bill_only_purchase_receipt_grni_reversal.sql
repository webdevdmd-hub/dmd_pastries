-- Bill-only purchasing accounting:
-- Reverse historical GRNI journals created from purchase receipts and clear their document links.
-- Future purchase receipt / GRN accounting is disabled in application code; purchase bills remain
-- the point where Accounts Payable is recognized.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TEMP TABLE tmp_purchase_receipt_grni_reversals ON COMMIT DROP AS
SELECT
  je.id AS original_journal_id,
  gen_random_uuid() AS reversal_journal_id,
  je.business_id,
  je.branch_id,
  je.entry_date,
  je.reference_number,
  je.source_id,
  je.total_debit,
  je.total_credit,
  je.posted_by_user_id,
  je.created_by_user_id
FROM journal_entries je
WHERE je.source_type = 'purchase_receipt_grni'
  AND je.status = 'posted'
  AND je.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM journal_entries rev
    WHERE rev.business_id = je.business_id
      AND rev.reversed_entry_id = je.id
      AND rev.deleted_at IS NULL
  );

INSERT INTO journal_entries (
  id,
  business_id,
  branch_id,
  entry_number,
  entry_date,
  reference_number,
  source_type,
  source_id,
  narration,
  status,
  total_debit,
  total_credit,
  posted_at,
  posted_by_user_id,
  reversed_entry_id,
  created_by_user_id,
  updated_by_user_id,
  created_at,
  updated_at
)
SELECT
  reversal_journal_id,
  business_id,
  branch_id,
  'JV-GRNI-REV-' || SUBSTRING(REPLACE(reversal_journal_id::text, '-', ''), 1, 16),
  CURRENT_DATE,
  reference_number,
  'purchase_receipt_grni_reversal',
  source_id,
  'Reverse legacy purchase receipt GRNI ' || COALESCE(reference_number, ''),
  'posted',
  total_debit,
  total_credit,
  NOW(),
  posted_by_user_id,
  original_journal_id,
  created_by_user_id,
  created_by_user_id,
  NOW(),
  NOW()
FROM tmp_purchase_receipt_grni_reversals;

INSERT INTO journal_entry_lines (
  id,
  business_id,
  journal_entry_id,
  account_id,
  line_number,
  debit_amount,
  credit_amount,
  description,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  jel.business_id,
  t.reversal_journal_id,
  jel.account_id,
  jel.line_number,
  jel.credit_amount,
  jel.debit_amount,
  'Reversal: ' || COALESCE(jel.description, ''),
  NOW(),
  NOW()
FROM journal_entry_lines jel
JOIN tmp_purchase_receipt_grni_reversals t
  ON t.original_journal_id = jel.journal_entry_id
WHERE jel.deleted_at IS NULL;

UPDATE journal_entries je
SET
  status = 'reversed',
  reversed_at = NOW(),
  reversed_by_user_id = t.created_by_user_id,
  updated_by_user_id = t.created_by_user_id,
  updated_at = NOW()
FROM tmp_purchase_receipt_grni_reversals t
WHERE je.id = t.original_journal_id
  AND je.business_id = t.business_id
  AND je.status = 'posted'
  AND je.deleted_at IS NULL;

UPDATE purchase_receipts pr
SET
  journal_entry_id = NULL,
  updated_at = NOW()
FROM tmp_purchase_receipt_grni_reversals t
WHERE pr.id = t.source_id
  AND pr.business_id = t.business_id
  AND pr.journal_entry_id = t.original_journal_id
  AND pr.deleted_at IS NULL;

UPDATE stock_movements sm
SET
  accounting_journal_entry_id = NULL
FROM tmp_purchase_receipt_grni_reversals t
WHERE sm.business_id = t.business_id
  AND sm.reference_type = 'purchase_receipt'
  AND sm.reference_id = t.source_id
  AND sm.accounting_journal_entry_id = t.original_journal_id;
