-- 000107: Generic opening balances + per-counterparty AR/AP (Phase 6 / W1)
--
-- Phase 5 / W3 gave payment accounts an opening balance, and inventory has
-- had opening stock for longer. Everything else -- prepaid expenses, fixed
-- assets, loans, owner capital -- had no way to carry a go-live balance
-- except a manual journal against 3400, and accounts receivable and payable
-- could not be opened at all: 1100 and 2000 are control accounts with
-- allow_manual_posting = false, so even the manual workaround was closed.
--
-- Two tables rather than one. A chart-account opening posts to whichever
-- account it names, so it is keyed by that account. A counterparty opening
-- always posts to the AR or AP control account and exists to say WHICH
-- customer or supplier the control balance belongs to -- it is a subledger,
-- modelled on customer_credits (see accounting/customer_credit.go), because
-- journal lines cannot carry a party.
--
-- Both carry journal_entry_id so an edit can soft-delete the previous
-- journal and repost, the same correction contract payment accounts use.

CREATE TABLE IF NOT EXISTS chart_account_opening_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    chart_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    opening_date DATE NOT NULL,
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_by_user_id UUID REFERENCES users(id),
    updated_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- One live opening per account. The chart of accounts is branch-scoped
-- (migration 000092), so chart_account_id already implies a branch; branch_id
-- is carried for query scoping and stamped from the account.
CREATE UNIQUE INDEX IF NOT EXISTS idx_chart_account_opening_unique
    ON chart_account_opening_balances(business_id, branch_id, chart_account_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chart_account_opening_business_branch
    ON chart_account_opening_balances(business_id, branch_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS counterparty_opening_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    party_type VARCHAR(20) NOT NULL,
    party_id UUID NOT NULL,
    -- Positive means the counterparty owes the business (a receivable) for a
    -- customer, and the business owes the counterparty (a payable) for a
    -- supplier. Negative mirrors the entry in both cases.
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    opening_date DATE NOT NULL,
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_by_user_id UUID REFERENCES users(id),
    updated_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_counterparty_opening_party_type CHECK (party_type IN ('customer', 'supplier'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_counterparty_opening_unique
    ON counterparty_opening_balances(business_id, branch_id, party_type, party_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_counterparty_opening_scope
    ON counterparty_opening_balances(business_id, branch_id, party_type)
    WHERE deleted_at IS NULL;
