-- 000099: Unified refund/reversal contract (Phase 4 / W6)
--
-- 1. payment_refunds learns two new shapes:
--    - bakery-order refunds (refund_source = 'bakery_order'): these have no
--      sale, so sale_id becomes nullable and bakery_order_id carries the
--      document link instead. A CHECK keeps every row anchored to exactly the
--      document its source demands.
--    - POS refund events now post ONE journal per refund (sale_refunds row),
--      not one per allocation slice; sale_refund_id links each allocation row
--      to its refund event.
-- 2. bakery_orders tracks the revenue-reversal journal posted when a completed
--    order is cancelled, and the cumulative post-completion refunded amount
--    (advance refunds are tracked by decrementing paid_amount instead, so the
--    two never mix).

ALTER TABLE payment_refunds ALTER COLUMN sale_id DROP NOT NULL;

ALTER TABLE payment_refunds ADD COLUMN IF NOT EXISTS bakery_order_id uuid REFERENCES bakery_orders(id);
ALTER TABLE payment_refunds ADD COLUMN IF NOT EXISTS sale_refund_id uuid REFERENCES sale_refunds(id);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_bakery_order_id
    ON payment_refunds(bakery_order_id) WHERE bakery_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_refunds_sale_refund_id
    ON payment_refunds(sale_refund_id) WHERE sale_refund_id IS NOT NULL;

ALTER TABLE payment_refunds DROP CONSTRAINT IF EXISTS chk_payment_refunds_source;
ALTER TABLE payment_refunds
    ADD CONSTRAINT chk_payment_refunds_source
    CHECK (refund_source IN ('payment_adjustment', 'pos_sale', 'sales_return', 'bakery_order'));

ALTER TABLE payment_refunds DROP CONSTRAINT IF EXISTS chk_payment_refunds_document;
ALTER TABLE payment_refunds
    ADD CONSTRAINT chk_payment_refunds_document
    CHECK (
        (refund_source = 'bakery_order' AND bakery_order_id IS NOT NULL)
        OR (refund_source <> 'bakery_order' AND sale_id IS NOT NULL)
    );

ALTER TABLE bakery_orders ADD COLUMN IF NOT EXISTS revenue_reversal_journal_entry_id uuid REFERENCES journal_entries(id);
ALTER TABLE bakery_orders ADD COLUMN IF NOT EXISTS refunded_amount numeric(14,4) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_bakery_orders_revenue_reversal_journal
    ON bakery_orders(revenue_reversal_journal_entry_id) WHERE revenue_reversal_journal_entry_id IS NOT NULL;
