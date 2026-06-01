-- Payment Accounts foundation.
-- Payment methods describe how money is collected; payment accounts describe where money is held/accounted.

CREATE TABLE IF NOT EXISTS payment_accounts (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    branch_id UUID NULL REFERENCES branches(id),
    account_name VARCHAR(150) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    chart_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_by_user_id UUID NULL REFERENCES users(id),
    updated_by_user_id UUID NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_payment_accounts_type CHECK (account_type IN ('cash', 'bank', 'card_clearing', 'platform_clearing', 'wallet', 'other')),
    CONSTRAINT chk_payment_accounts_status CHECK (status IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_accounts_business_branch_name
    ON payment_accounts(business_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), LOWER(account_name))
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_accounts_business_branch_chart
    ON payment_accounts(business_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), chart_account_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payment_accounts_business_type
    ON payment_accounts(business_id, account_type, status)
    WHERE deleted_at IS NULL;

ALTER TABLE payment_methods
    ADD COLUMN IF NOT EXISTS default_payment_account_id UUID NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_payment_methods_default_payment_account'
    ) THEN
        ALTER TABLE payment_methods
            ADD CONSTRAINT fk_payment_methods_default_payment_account
            FOREIGN KEY (default_payment_account_id) REFERENCES payment_accounts(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_methods_default_payment_account
    ON payment_methods(default_payment_account_id)
    WHERE deleted_at IS NULL;
