-- 000116: Name supplier payments on their journals.
--
-- ISSUE-051 (found by /qa on production, 2026-09-17). A supplier payment
-- without a reference number was journalled with its own id as the reference,
-- so the journal list and ledger read "ea465cc4-229f-47e3-82d6-5fa822f0d9c4".
-- New payments use the supplier's name; this renames the existing journals the
-- same way. Only the display reference changes; no amounts or accounts.
-- Idempotent: once renamed, a row no longer matches.

UPDATE journal_entries je
SET reference_number = s.supplier_name,
    updated_at = NOW()
FROM supplier_payments sp
JOIN suppliers s ON s.id = sp.supplier_id AND s.business_id = sp.business_id
WHERE je.source_type = 'supplier_payment'
  AND je.source_id = sp.id
  AND je.business_id = sp.business_id
  AND je.reference_number = sp.id::text;
