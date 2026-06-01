-- Dedicated expenses module with auto-posted accounting journals.

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    expense_number VARCHAR(100) NOT NULL,
    expense_date DATE NOT NULL,
    expense_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    paid_through_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    supplier_id UUID NULL REFERENCES suppliers(id),
    customer_id UUID NULL REFERENCES customers(id),
    amount NUMERIC(14,2) NOT NULL,
    reference_number VARCHAR(255),
    notes TEXT,
    receipt_file_id VARCHAR(500),
    is_billable BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'posted',
    journal_entry_id UUID NULL REFERENCES journal_entries(id),
    reversal_journal_entry_id UUID NULL REFERENCES journal_entries(id),
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    updated_by_user_id UUID NULL REFERENCES users(id),
    voided_by_user_id UUID NULL REFERENCES users(id),
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_expenses_amount CHECK (amount > 0),
    CONSTRAINT chk_expenses_status CHECK (status IN ('posted', 'voided'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_business_number
    ON expenses(business_id, LOWER(expense_number))
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_business_branch_date
    ON expenses(business_id, branch_id, expense_date)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_business_status
    ON expenses(business_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_expense_account
    ON expenses(business_id, expense_account_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_paid_through_account
    ON expenses(business_id, paid_through_account_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_supplier
    ON expenses(business_id, supplier_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_customer
    ON expenses(business_id, customer_id)
    WHERE deleted_at IS NULL;
