CREATE TABLE IF NOT EXISTS document_charges (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id),
    document_type VARCHAR(50) NOT NULL,
    document_id UUID NOT NULL,
    charge_type VARCHAR(50) NOT NULL,
    charge_name VARCHAR(150) NOT NULL,
    description TEXT,
    amount NUMERIC(18, 6) NOT NULL DEFAULT 0,
    tax_rate_id UUID REFERENCES tax_rates(id),
    tax_rate_name_snapshot VARCHAR(150) NOT NULL DEFAULT '',
    tax_rate_percentage_snapshot NUMERIC(10, 4) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18, 6) NOT NULL DEFAULT 0,
    total_amount NUMERIC(18, 6) NOT NULL DEFAULT 0,
    is_refundable BOOLEAN NOT NULL DEFAULT TRUE,
    source_charge_id UUID REFERENCES document_charges(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_document_charges_document_type CHECK (document_type IN ('pos_sale','held_sale','bakery_order','purchase_order','purchase_invoice','purchase_receipt','sales_return','purchase_return')),
    CONSTRAINT chk_document_charges_charge_type CHECK (charge_type IN ('delivery','service','packing','platform','freight','handling','other')),
    CONSTRAINT chk_document_charges_amount_non_negative CHECK (amount >= 0),
    CONSTRAINT chk_document_charges_tax_amount_non_negative CHECK (tax_amount >= 0),
    CONSTRAINT chk_document_charges_total_amount_non_negative CHECK (total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_document_charges_business_document
    ON document_charges(business_id, document_type, document_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_document_charges_branch
    ON document_charges(business_id, branch_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_document_charges_type
    ON document_charges(business_id, charge_type)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_document_charges_source_charge
    ON document_charges(source_charge_id)
    WHERE deleted_at IS NULL;

ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS charge_amount NUMERIC(18, 6) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS charge_tax_amount NUMERIC(18, 6) NOT NULL DEFAULT 0;

ALTER TABLE held_sales
    ADD COLUMN IF NOT EXISTS estimated_charge_amount NUMERIC(18, 6) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS estimated_charge_tax_amount NUMERIC(18, 6) NOT NULL DEFAULT 0;

ALTER TABLE bakery_orders
    ADD COLUMN IF NOT EXISTS charge_amount NUMERIC(18, 6) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS charge_tax_amount NUMERIC(18, 6) NOT NULL DEFAULT 0;

ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS charge_amount NUMERIC(18, 6) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS charge_tax_amount NUMERIC(18, 6) NOT NULL DEFAULT 0;

ALTER TABLE purchase_invoices
    ADD COLUMN IF NOT EXISTS charge_amount NUMERIC(18, 6) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS charge_tax_amount NUMERIC(18, 6) NOT NULL DEFAULT 0;

ALTER TABLE purchase_receipts
    ADD COLUMN IF NOT EXISTS charge_amount NUMERIC(18, 6) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS charge_tax_amount NUMERIC(18, 6) NOT NULL DEFAULT 0;

ALTER TABLE sales_returns
    ADD COLUMN IF NOT EXISTS charge_amount NUMERIC(18, 6) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS charge_tax_amount NUMERIC(18, 6) NOT NULL DEFAULT 0;

ALTER TABLE purchase_returns
    ADD COLUMN IF NOT EXISTS charge_amount NUMERIC(18, 6) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS charge_tax_amount NUMERIC(18, 6) NOT NULL DEFAULT 0;

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
        ('4050', 'Delivery Charge Income', 'income', 'sales_income', 'credit', TRUE, FALSE),
        ('4060', 'Service Charge Income', 'income', 'service_income', 'credit', TRUE, FALSE),
        ('4070', 'Packing Charge Income', 'income', 'sales_income', 'credit', TRUE, FALSE),
        ('4080', 'Delivery Charge Returns', 'income', 'sales_income', 'debit', TRUE, FALSE),
        ('5030', 'Freight / Carriage Inward', 'cogs', 'direct_expense', 'debit', FALSE, TRUE)
) AS seed(account_code, account_name, account_type, account_group, normal_balance, is_control_account, allow_manual_posting)
WHERE NOT EXISTS (
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
WHERE NOT EXISTS (
    SELECT 1 FROM accounting_account_mappings aam
    WHERE aam.business_id = b.id
      AND aam.mapping_key = seed.mapping_key
      AND aam.deleted_at IS NULL
);
