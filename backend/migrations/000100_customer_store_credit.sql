-- 000100: Customer store credit (Phase 4 / W4)
--
-- Decision §4 (2026-08-12 workshop): a sales return can compensate the
-- customer with store credit instead of money. Chart account 2200 Customer
-- Advance is a control account with no per-customer detail, so credits get a
-- subledger table. Reconciliation invariant: per business, SUM(balance) of
-- open credit rows equals the 2200 balance attributable to credit sources.
--
-- Three CHECK extensions:
--   * sales_returns.refund_mode gains 'store_credit' ('none' keeps its
--     historical meaning: goods back, no compensation).
--   * payment_methods.method_type gains 'store_credit' for the seeded
--     redemption tender.
--   * payment_accounts.account_type gains 'store_credit' for the per-branch
--     redemption account backed by chart 2200. It is deliberately NOT a
--     settleable clearing type (isSettleableClearingType stays unchanged).

CREATE TABLE IF NOT EXISTS customer_credits (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES businesses(id),
    branch_id uuid NOT NULL REFERENCES branches(id),
    customer_id uuid NOT NULL REFERENCES customers(id),
    source_type varchar(50) NOT NULL,
    source_id uuid,
    journal_entry_id uuid REFERENCES journal_entries(id),
    amount numeric(14,4) NOT NULL,
    balance numeric(14,4) NOT NULL,
    notes text NOT NULL DEFAULT '',
    created_by_user_id uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_customer_credits_source CHECK (source_type IN ('sales_return', 'bakery_order', 'manual')),
    CONSTRAINT chk_customer_credits_amount CHECK (amount > 0),
    CONSTRAINT chk_customer_credits_balance CHECK (balance >= 0 AND balance <= amount)
);

CREATE INDEX IF NOT EXISTS idx_customer_credits_business_customer
    ON customer_credits(business_id, customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_credits_source
    ON customer_credits(business_id, source_type, source_id);

-- Redemption audit trail: which sale consumed which credit rows.
CREATE TABLE IF NOT EXISTS customer_credit_redemptions (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES businesses(id),
    customer_credit_id uuid NOT NULL REFERENCES customer_credits(id),
    sale_id uuid NOT NULL REFERENCES sales(id),
    amount numeric(14,4) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_customer_credit_redemptions_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_customer_credit_redemptions_credit
    ON customer_credit_redemptions(customer_credit_id);
CREATE INDEX IF NOT EXISTS idx_customer_credit_redemptions_sale
    ON customer_credit_redemptions(business_id, sale_id);

ALTER TABLE sales_returns DROP CONSTRAINT IF EXISTS chk_sales_returns_refund_mode;
ALTER TABLE sales_returns
    ADD CONSTRAINT chk_sales_returns_refund_mode
    CHECK (refund_mode IN ('none', 'refund', 'store_credit'));

ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS chk_payment_methods_method_type;
ALTER TABLE payment_methods
    ADD CONSTRAINT chk_payment_methods_method_type
    CHECK (method_type IN ('cash', 'card', 'bank_transfer', 'online', 'wallet', 'custom', 'store_credit'));

ALTER TABLE payment_accounts DROP CONSTRAINT IF EXISTS chk_payment_accounts_type;
ALTER TABLE payment_accounts
    ADD CONSTRAINT chk_payment_accounts_type
    CHECK (account_type IN ('cash', 'bank', 'card_clearing', 'platform_clearing', 'wallet', 'other', 'store_credit'));
