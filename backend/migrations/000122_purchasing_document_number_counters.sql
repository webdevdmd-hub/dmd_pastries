-- 000122: A purchasing document number is never issued twice.
--
-- ISSUE-082 (found by /investigate delete audit, 2026-09-18). Purchase order,
-- bill, receipt and vendor credit numbers were MAX(existing)+1 over the rows
-- that still exist, and a draft order (with its draft bills, receipts and
-- vendor credits) or a draft bill is hard-deleted. Deleting the newest draft
-- handed its number to the next document, so a PO number already sent to a
-- supplier could come back on a different order.
--
-- This table remembers the highest number each business has been issued per
-- sequence. The purchasing repository's NextNumber takes the greater of it
-- and the table's own maximum, then raises it.
--
-- The seed covers numbers deleted before this migration: the audit log records
-- every purchasing document's number (metadata document_number) when it is
-- created, deleted or not. Idempotent: the table is created only if missing,
-- and the seed only ever raises a counter.

CREATE TABLE IF NOT EXISTS document_number_counters (
    business_id uuid NOT NULL REFERENCES businesses(id),
    sequence_key varchar(100) NOT NULL,
    last_number bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (business_id, sequence_key),
    CONSTRAINT chk_document_number_counters_last_number CHECK (last_number >= 0)
);

INSERT INTO document_number_counters (business_id, sequence_key, last_number)
SELECT issued.business_id, issued.sequence_key, MAX(issued.number)
FROM (
    SELECT al.business_id,
           seq.sequence_key,
           substring(al.metadata->>'document_number' from length(seq.prefix) + 1)::bigint AS number
    FROM audit_logs al
    JOIN (VALUES
        ('purchase_order', 'purchase_orders', 'PO-'),
        ('purchase_invoice', 'purchase_invoices', 'PI-'),
        ('purchase_receipt', 'purchase_receipts', 'PR-'),
        ('purchase_return', 'purchase_returns', 'VC-')
    ) AS seq(entity_type, sequence_key, prefix) ON seq.entity_type = al.entity_type
    WHERE al.metadata->>'document_number' LIKE seq.prefix || '%'
      AND substring(al.metadata->>'document_number' from length(seq.prefix) + 1) ~ '^[0-9]{1,18}$'
) issued
GROUP BY issued.business_id, issued.sequence_key
ON CONFLICT (business_id, sequence_key) DO UPDATE
SET last_number = GREATEST(document_number_counters.last_number, EXCLUDED.last_number),
    updated_at = now();
