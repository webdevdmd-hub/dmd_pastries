-- 000109: Supplier purchasing terms (Supplier redesign / P4)
--
-- The supplier record carried contact and address detail but nothing about how
-- you actually buy from the supplier. A buyer raising a purchase order had no
-- in-app answer to the two questions that decide the order:
--
--   "when will it arrive?"   -> lead time
--   "when do I have to pay?" -> payment terms
--
-- Both were absent from the schema, so no amount of UI work could surface them
-- (QA audit 2026-08-24, finding SUP-002). This adds them, plus the preferred
-- flag that decides which supplier wins when a PO line has several sources.
--
-- Every step is additive and idempotent. No column is dropped, no existing
-- value is rewritten, and every new column is nullable or carries a default,
-- so existing rows stay valid and the API keeps working unchanged if the
-- frontend never sends these fields.
--
-- payment_terms is a constrained string rather than an integer count of days:
-- "prepaid" is a real term and is not expressible as a number of days, and the
-- set is small and stable enough that a CHECK beats a lookup table here.
--
-- lead_time_days is NULLABLE on purpose. 0 is a meaningful value -- a same-day
-- courier -- so "unknown" cannot be encoded as 0 and needs its own state.

ALTER TABLE suppliers
    ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(20) NOT NULL DEFAULT '';

ALTER TABLE suppliers
    ADD COLUMN IF NOT EXISTS lead_time_days INTEGER;

ALTER TABLE suppliers
    ADD COLUMN IF NOT EXISTS is_preferred BOOLEAN NOT NULL DEFAULT FALSE;

-- '' is the "not set yet" state and must stay valid: every existing row has it.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_payment_terms_check'
    ) THEN
        ALTER TABLE suppliers
            ADD CONSTRAINT suppliers_payment_terms_check
            CHECK (payment_terms IN ('', 'prepaid', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90'));
    END IF;
END $$;

-- A negative lead time is not a thing. NULL stays allowed: it is "unknown".
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_lead_time_days_check'
    ) THEN
        ALTER TABLE suppliers
            ADD CONSTRAINT suppliers_lead_time_days_check
            CHECK (lead_time_days IS NULL OR (lead_time_days >= 0 AND lead_time_days <= 365));
    END IF;
END $$;

-- Preferred suppliers are read on every PO line that resolves a source, and
-- they are a small fraction of the table, so a partial index is the right shape.
CREATE INDEX IF NOT EXISTS idx_suppliers_preferred
    ON suppliers (business_id, branch_id)
    WHERE is_preferred = TRUE AND deleted_at IS NULL;
