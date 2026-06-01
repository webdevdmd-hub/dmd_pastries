-- Fund Transfers + Platform Settlements foundation.

CREATE TABLE IF NOT EXISTS account_transfers (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    branch_id UUID NULL REFERENCES branches(id),
    transfer_number VARCHAR(100) NOT NULL,
    transfer_date DATE NOT NULL,
    from_payment_account_id UUID NOT NULL REFERENCES payment_accounts(id),
    to_payment_account_id UUID NOT NULL REFERENCES payment_accounts(id),
    from_chart_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    to_chart_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    reference_number VARCHAR(255),
    notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    journal_entry_id UUID NULL REFERENCES journal_entries(id),
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_account_transfers_status CHECK (status IN ('completed', 'reversed')),
    CONSTRAINT chk_account_transfers_amount CHECK (amount > 0),
    CONSTRAINT chk_account_transfers_accounts CHECK (from_payment_account_id <> to_payment_account_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_transfers_business_number
    ON account_transfers(business_id, transfer_number)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_account_transfers_business_date
    ON account_transfers(business_id, transfer_date)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_account_transfers_accounts
    ON account_transfers(business_id, from_payment_account_id, to_payment_account_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS platform_settlements (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    branch_id UUID NULL REFERENCES branches(id),
    settlement_number VARCHAR(100) NOT NULL,
    settlement_date DATE NOT NULL,
    platform_payment_account_id UUID NOT NULL REFERENCES payment_accounts(id),
    deposit_payment_account_id UUID NOT NULL REFERENCES payment_accounts(id),
    platform_chart_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    deposit_chart_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    gross_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    deductions_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    net_received_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    reference_number VARCHAR(255),
    notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    journal_entry_id UUID NULL REFERENCES journal_entries(id),
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_platform_settlements_status CHECK (status IN ('completed', 'reversed')),
    CONSTRAINT chk_platform_settlements_amounts CHECK (
        gross_amount > 0
        AND deductions_total >= 0
        AND net_received_amount >= 0
        AND ROUND((net_received_amount + deductions_total)::numeric, 2) = ROUND(gross_amount::numeric, 2)
    ),
    CONSTRAINT chk_platform_settlements_accounts CHECK (platform_payment_account_id <> deposit_payment_account_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_settlements_business_number
    ON platform_settlements(business_id, settlement_number)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_settlements_business_date
    ON platform_settlements(business_id, settlement_date)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_settlements_accounts
    ON platform_settlements(business_id, platform_payment_account_id, deposit_payment_account_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS platform_settlement_deductions (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    platform_settlement_id UUID NOT NULL REFERENCES platform_settlements(id) ON DELETE CASCADE,
    expense_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    deduction_type VARCHAR(100) NOT NULL,
    description TEXT,
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_platform_settlement_deductions_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_platform_settlement_deductions_settlement
    ON platform_settlement_deductions(platform_settlement_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_settlement_deductions_account
    ON platform_settlement_deductions(business_id, expense_account_id)
    WHERE deleted_at IS NULL;
