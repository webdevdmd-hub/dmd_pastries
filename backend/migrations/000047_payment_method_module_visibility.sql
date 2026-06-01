-- Add module-level visibility controls for payment methods.

ALTER TABLE payment_methods
    ADD COLUMN IF NOT EXISTS show_in_pos BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS show_in_bakery_orders BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS show_in_purchasing BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS show_in_expenses BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS show_in_dashboard_collection BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE payment_methods
SET
    show_in_pos = TRUE,
    show_in_bakery_orders = TRUE,
    show_in_dashboard_collection = TRUE,
    show_in_purchasing = CASE
        WHEN method_type IN ('cash', 'bank_transfer') THEN TRUE
        ELSE FALSE
    END,
    show_in_expenses = CASE
        WHEN method_type IN ('cash', 'bank_transfer') THEN TRUE
        ELSE FALSE
    END
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payment_methods_pos_visible
    ON payment_methods(business_id, show_in_pos, status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payment_methods_bakery_visible
    ON payment_methods(business_id, show_in_bakery_orders, status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payment_methods_purchasing_visible
    ON payment_methods(business_id, show_in_purchasing, status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payment_methods_expenses_visible
    ON payment_methods(business_id, show_in_expenses, status)
    WHERE deleted_at IS NULL;
