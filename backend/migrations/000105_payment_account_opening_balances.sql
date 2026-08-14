-- 000105: Payment-account opening balances (Phase 5 / W3)
--
-- Until now the only opening balance in the system was inventory opening
-- stock, so every migrated business's cash/bank ledger balance started at
-- zero regardless of what was actually in the till or the bank. A payment
-- account can now carry an opening amount as of a date, posted as
--   Dr <account's chart account> / Cr 3400 Opening Balance Equity
-- (mirrored when the opening balance is negative, e.g. a bank overdraft).
--
-- source_type 'payment_account' was already reserved for exactly this in
-- accounting/refund_contract.go; editing the opening balance soft-deletes
-- the old journal and reposts, which is why no reversal contract is needed.

ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS opening_balance numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS opening_balance_date date;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS opening_journal_entry_id uuid;
