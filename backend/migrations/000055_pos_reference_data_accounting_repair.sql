-- POS-safe reference data support is code-only, but this migration repairs
-- databases that reached POS checkout before accounting accuracy migrations
-- were fully applied.

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

INSERT INTO chart_of_accounts (
    id, business_id, account_code, account_name, account_type, account_group,
    normal_balance, is_system_account, is_control_account, allow_manual_posting,
    status, created_at, updated_at
)
SELECT gen_random_uuid(), b.id, seed.account_code, seed.account_name, seed.account_type, seed.account_group,
       seed.normal_balance, TRUE, seed.is_control_account, seed.allow_manual_posting,
       'active', NOW(), NOW()
FROM businesses b
CROSS JOIN (
    VALUES
        ('1000', 'Cash in Hand', 'asset', 'current_asset', 'debit', TRUE, TRUE),
        ('1010', 'Bank Account', 'asset', 'current_asset', 'debit', TRUE, TRUE),
        ('1020', 'Petty Cash', 'asset', 'current_asset', 'debit', TRUE, TRUE),
        ('1100', 'Accounts Receivable', 'asset', 'current_asset', 'debit', TRUE, FALSE),
        ('1200', 'Inventory / Stock', 'asset', 'current_asset', 'debit', TRUE, FALSE),
        ('1210', 'Work in Process Inventory', 'asset', 'current_asset', 'debit', TRUE, FALSE),
        ('1300', 'VAT Receivable', 'asset', 'current_asset', 'debit', TRUE, FALSE),
        ('2000', 'Accounts Payable', 'liability', 'current_liability', 'credit', TRUE, FALSE),
        ('2050', 'Goods Received Not Invoiced / GRNI', 'liability', 'current_liability', 'credit', TRUE, FALSE),
        ('2100', 'VAT Payable', 'liability', 'current_liability', 'credit', TRUE, FALSE),
        ('2200', 'Customer Advance', 'liability', 'current_liability', 'credit', TRUE, FALSE),
        ('3400', 'Opening Balance Equity', 'equity', 'equity', 'credit', TRUE, FALSE),
        ('4000', 'Sales Income', 'income', 'sales_income', 'credit', TRUE, FALSE),
        ('4010', 'Bakery Order Income', 'income', 'sales_income', 'credit', TRUE, FALSE),
        ('4040', 'Sales Returns and Allowances', 'income', 'sales_income', 'debit', TRUE, FALSE),
        ('4050', 'Delivery Charge Income', 'income', 'sales_income', 'credit', TRUE, FALSE),
        ('4060', 'Service Charge Income', 'income', 'service_income', 'credit', TRUE, FALSE),
        ('4070', 'Packing Charge Income', 'income', 'sales_income', 'credit', TRUE, FALSE),
        ('4080', 'Delivery Charge Returns', 'income', 'sales_income', 'debit', TRUE, FALSE),
        ('4100', 'Inventory Adjustment Gain', 'income', 'other_income', 'credit', TRUE, FALSE),
        ('5020', 'Purchase Return', 'cogs', 'direct_expense', 'credit', TRUE, FALSE),
        ('5030', 'Freight / Carriage Inward', 'cogs', 'direct_expense', 'debit', FALSE, TRUE),
        ('5070', 'Cost of Goods Sold', 'cogs', 'direct_expense', 'debit', TRUE, FALSE),
        ('5080', 'Wastage Expense', 'cogs', 'direct_expense', 'debit', TRUE, FALSE),
        ('5090', 'Inventory Adjustment Loss', 'cogs', 'direct_expense', 'debit', TRUE, FALSE),
        ('6240', 'Platform Commission Expense', 'expense', 'operating_expense', 'debit', TRUE, TRUE),
        ('6250', 'Delivery Platform Charges', 'expense', 'operating_expense', 'debit', FALSE, TRUE)
) AS seed(account_code, account_name, account_type, account_group, normal_balance, is_control_account, allow_manual_posting)
WHERE b.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM chart_of_accounts coa
      WHERE coa.business_id = b.id
        AND LOWER(coa.account_code) = LOWER(seed.account_code)
        AND coa.deleted_at IS NULL
  );

INSERT INTO accounting_account_mappings (
    id, business_id, mapping_key, chart_account_id, description, created_at, updated_at
)
SELECT gen_random_uuid(), b.id, seed.mapping_key, coa.id, seed.description, NOW(), NOW()
FROM businesses b
JOIN (
    VALUES
        ('accounts_receivable', '1100', 'Customer unpaid balances'),
        ('accounts_payable', '2000', 'Supplier unpaid balances'),
        ('inventory_stock', '1200', 'Inventory stock value'),
        ('sales_income', '4000', 'POS sales income'),
        ('bakery_income', '4010', 'Bakery order income'),
        ('customer_advance', '2200', 'Customer deposits and advances'),
        ('vat_receivable', '1300', 'Input VAT receivable'),
        ('vat_payable', '2100', 'Output VAT payable'),
        ('cogs', '5070', 'Cost of goods sold'),
        ('sales_returns', '4040', 'Sales returns and allowances'),
        ('purchase_returns', '5020', 'Purchase returns'),
        ('wip_inventory', '1210', 'Manufacturing work in process'),
        ('wastage_expense', '5080', 'Inventory and production wastage'),
        ('opening_balance_equity', '3400', 'Opening stock/equity offset'),
        ('grni', '2050', 'Goods received not invoiced'),
        ('platform_commission_expense', '6240', 'Delivery platform commissions'),
        ('delivery_charge_income', '4050', 'Customer delivery charge income'),
        ('service_charge_income', '4060', 'Customer service charge income'),
        ('packing_charge_income', '4070', 'Customer packing charge income'),
        ('charge_refund_account', '4080', 'Refunded customer charges'),
        ('freight_inward', '5030', 'Supplier freight and carriage inward')
) AS seed(mapping_key, account_code, description) ON TRUE
JOIN chart_of_accounts coa
    ON coa.business_id = b.id
   AND coa.account_code = seed.account_code
   AND coa.status = 'active'
   AND coa.deleted_at IS NULL
WHERE b.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM accounting_account_mappings aam
      WHERE aam.business_id = b.id
        AND aam.mapping_key = seed.mapping_key
        AND aam.deleted_at IS NULL
  );
