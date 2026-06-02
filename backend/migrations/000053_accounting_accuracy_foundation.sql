CREATE TABLE IF NOT EXISTS accounting_account_mappings (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    mapping_key VARCHAR(100) NOT NULL,
    chart_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_account_mappings_unique_active
    ON accounting_account_mappings(business_id, mapping_key)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_account_mappings_business_id
    ON accounting_account_mappings(business_id);

CREATE INDEX IF NOT EXISTS idx_accounting_account_mappings_chart_account_id
    ON accounting_account_mappings(chart_account_id);

ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS average_unit_cost NUMERIC(18, 6) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS inventory_value NUMERIC(18, 6) NOT NULL DEFAULT 0;

ALTER TABLE stock_movements
    ADD COLUMN IF NOT EXISTS unit_cost_snapshot NUMERIC(18, 6) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_cost NUMERIC(18, 6) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS valuation_method VARCHAR(50) NOT NULL DEFAULT 'weighted_average',
    ADD COLUMN IF NOT EXISTS accounting_journal_entry_id UUID REFERENCES journal_entries(id);

ALTER TABLE purchase_invoices
    ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id);

ALTER TABLE purchase_invoice_payments
    ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id);

ALTER TABLE purchase_receipts
    ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id);

ALTER TABLE purchase_receipt_items
    ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(18, 6) NOT NULL DEFAULT 0;

ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS cogs_journal_entry_id UUID REFERENCES journal_entries(id),
    ADD COLUMN IF NOT EXISTS void_journal_entry_id UUID REFERENCES journal_entries(id);

ALTER TABLE sales_returns
    ADD COLUMN IF NOT EXISTS inventory_journal_entry_id UUID REFERENCES journal_entries(id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = 'idx_journal_entries_unique_source_posted'
    ) THEN
        CREATE UNIQUE INDEX idx_journal_entries_unique_source_posted
            ON journal_entries(business_id, source_type, source_id)
            WHERE deleted_at IS NULL
              AND source_id IS NOT NULL
              AND source_type <> ''
              AND status IN ('posted', 'reversed');
    END IF;
END $$;
