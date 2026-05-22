-- Accounting foundation: Chart of Accounts.

CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    parent_account_id UUID NULL REFERENCES chart_of_accounts(id),
    account_code VARCHAR(50) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    account_group VARCHAR(100) NOT NULL,
    normal_balance VARCHAR(20) NOT NULL,
    description TEXT,
    is_system_account BOOLEAN NOT NULL DEFAULT FALSE,
    is_control_account BOOLEAN NOT NULL DEFAULT FALSE,
    allow_manual_posting BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_by_user_id UUID NULL REFERENCES users(id),
    updated_by_user_id UUID NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_chart_of_accounts_type CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'cogs', 'expense')),
    CONSTRAINT chk_chart_of_accounts_normal_balance CHECK (normal_balance IN ('debit', 'credit')),
    CONSTRAINT chk_chart_of_accounts_status CHECK (status IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chart_of_accounts_business_code
    ON chart_of_accounts(business_id, LOWER(account_code))
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_business_type
    ON chart_of_accounts(business_id, account_type)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent
    ON chart_of_accounts(parent_account_id)
    WHERE deleted_at IS NULL;

