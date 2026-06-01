-- Auto accounting posting trace columns for POS sales and bakery orders.

ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS accounting_journal_entry_id UUID NULL REFERENCES journal_entries(id);

ALTER TABLE sale_payments
    ADD COLUMN IF NOT EXISTS journal_entry_id UUID NULL REFERENCES journal_entries(id);

ALTER TABLE bakery_orders
    ADD COLUMN IF NOT EXISTS accounting_journal_entry_id UUID NULL REFERENCES journal_entries(id);

ALTER TABLE bakery_order_payments
    ADD COLUMN IF NOT EXISTS journal_entry_id UUID NULL REFERENCES journal_entries(id);

CREATE INDEX IF NOT EXISTS idx_sales_accounting_journal_entry
    ON sales(accounting_journal_entry_id)
    WHERE accounting_journal_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sale_payments_journal_entry
    ON sale_payments(journal_entry_id)
    WHERE journal_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bakery_orders_accounting_journal_entry
    ON bakery_orders(accounting_journal_entry_id)
    WHERE accounting_journal_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bakery_order_payments_journal_entry
    ON bakery_order_payments(journal_entry_id)
    WHERE journal_entry_id IS NOT NULL;
