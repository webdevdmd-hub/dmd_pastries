-- Accounting foundation: Journal Entries / Voucher Entry.

CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    branch_id UUID NULL REFERENCES branches(id),
    entry_number VARCHAR(100) NOT NULL,
    entry_date DATE NOT NULL,
    reference_number VARCHAR(255),
    source_type VARCHAR(100),
    source_id UUID NULL,
    narration TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    total_debit NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_credit NUMERIC(14,2) NOT NULL DEFAULT 0,
    posted_at TIMESTAMPTZ,
    posted_by_user_id UUID NULL REFERENCES users(id),
    reversed_entry_id UUID NULL REFERENCES journal_entries(id),
    reversed_at TIMESTAMPTZ,
    reversed_by_user_id UUID NULL REFERENCES users(id),
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    updated_by_user_id UUID NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_journal_entries_status CHECK (status IN ('draft', 'posted', 'reversed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_business_number
    ON journal_entries(business_id, entry_number)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_journal_entries_business_date
    ON journal_entries(business_id, entry_date)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_journal_entries_business_branch
    ON journal_entries(business_id, branch_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_journal_entries_source
    ON journal_entries(business_id, source_type, source_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    line_number INTEGER NOT NULL,
    debit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    credit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_journal_entry_lines_amount CHECK (
        debit_amount >= 0
        AND credit_amount >= 0
        AND NOT (debit_amount > 0 AND credit_amount > 0)
        AND (debit_amount > 0 OR credit_amount > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry
    ON journal_entry_lines(journal_entry_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account
    ON journal_entry_lines(business_id, account_id)
    WHERE deleted_at IS NULL;

