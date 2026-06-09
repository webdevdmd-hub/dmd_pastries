-- Branch-aware payment method to payment account mapping.
-- Keeps payment_methods.default_payment_account_id as fallback for existing setups.

CREATE TABLE IF NOT EXISTS payment_method_account_mappings (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
    payment_account_id UUID NOT NULL REFERENCES payment_accounts(id),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_payment_method_account_mappings_status CHECK (status IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_method_account_mappings_unique_active
    ON payment_method_account_mappings(business_id, branch_id, payment_method_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payment_method_account_mappings_account
    ON payment_method_account_mappings(payment_account_id)
    WHERE deleted_at IS NULL;
