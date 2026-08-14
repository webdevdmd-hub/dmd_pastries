package accounting

import (
	"strings"
	"time"

	"gorm.io/gorm"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

// Payment-account opening balances (Phase 5 / W3).
//
// A migrated business's till and bank accounts already hold money before the
// first sale is recorded here. The opening balance books that money as
//
//	Dr <the account's chart account> / Cr 3400 Opening Balance Equity
//
// mirrored when the amount is negative (a bank overdraft is a liability).
// source_type is the `payment_account` slot reserved in refund_contract.go,
// whose stated contract is "corrected by editing the opening balance, which
// reposts" — so an edit soft-deletes the previous journal (freeing the
// idempotency slot from migration 000096) and posts a fresh one, rather than
// stacking a reversal.

// openingBalanceInput is the normalized opening balance from a create or
// update request: nil when the caller did not touch it.
type openingBalanceInput struct {
	Amount float64
	Date   *time.Time
}

// normalizeOpeningBalanceInput validates the request pair and reports whether
// the caller supplied either field. A non-zero amount requires a date: without
// one there is no period to book it in.
func normalizeOpeningBalanceInput(accountType string, amount *float64, date *string) (*openingBalanceInput, error) {
	if amount == nil && (date == nil || strings.TrimSpace(*date) == "") {
		return nil, nil
	}
	resolved := openingBalanceInput{}
	if amount != nil {
		resolved.Amount = roundMoney(*amount)
	}
	if date != nil && strings.TrimSpace(*date) != "" {
		parsed, err := parseRequiredDate(*date, "opening_balance_date")
		if err != nil {
			return nil, err
		}
		truncated := dateOnlyUTC(parsed)
		resolved.Date = &truncated
	}
	if resolved.Amount != 0 && resolved.Date == nil {
		return nil, apperrors.BadRequest("opening_balance_date is required when opening_balance is not zero", nil)
	}
	// A store-credit tender is backed by the Customer Advance liability and
	// is funded by actual credit grants, never by an opening entry.
	if resolved.Amount != 0 && strings.TrimSpace(accountType) == "store_credit" {
		return nil, apperrors.BadRequest("store credit accounts cannot carry an opening balance", nil)
	}
	return &resolved, nil
}

// buildPaymentAccountOpeningLines returns the two journal lines for an
// opening balance. A positive balance debits the asset; a negative one
// (overdraft) mirrors the entry.
func buildPaymentAccountOpeningLines(chartAccountID, equityAccountID string, amount float64, accountName string) []JournalEntryLineRequest {
	magnitude := absMoney(roundMoney(amount))
	description := "Opening balance: " + accountName
	if amount >= 0 {
		return []JournalEntryLineRequest{
			{AccountID: chartAccountID, DebitAmount: magnitude, Description: description},
			{AccountID: equityAccountID, CreditAmount: magnitude, Description: description},
		}
	}
	return []JournalEntryLineRequest{
		{AccountID: equityAccountID, DebitAmount: magnitude, Description: description},
		{AccountID: chartAccountID, CreditAmount: magnitude, Description: description},
	}
}

// applyPaymentAccountOpeningBalance posts (or reposts) the opening journal
// for an account and returns the journal id to store on the row. Callers run
// it inside their own transaction, so the period guard, branch stamping, and
// idempotency of createPostedSystemJournal all apply.
func (s *Service) applyPaymentAccountOpeningBalance(
	tx *gorm.DB,
	currentUser *utils.AuthContext,
	account *PaymentAccount,
	input openingBalanceInput,
) (*string, error) {
	branchID := ""
	if account.BranchID != nil {
		branchID = strings.TrimSpace(*account.BranchID)
	}
	if branchID == "" {
		return nil, apperrors.BadRequest("payment account requires a branch to carry an opening balance", nil)
	}

	// Clear the previous journal first: it holds the (business, source_type,
	// source_id) idempotency slot the new one needs.
	if err := s.clearPaymentAccountOpeningJournal(tx, currentUser, account); err != nil {
		return nil, err
	}

	amount := roundMoney(input.Amount)
	if amount == 0 {
		return nil, nil
	}
	entryDate := dateOnlyUTC(*input.Date)
	if err := EnsurePeriodOpen(tx, currentUser.BusinessID, entryDate); err != nil {
		return nil, err
	}
	equityAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, branchID, "opening_balance_equity", "3400", "Opening Balance Equity")
	if err != nil {
		return nil, err
	}
	lines := buildPaymentAccountOpeningLines(account.ChartAccountID, equityAccount.ID, amount, account.AccountName)
	journalID, err := s.createPostedSystemJournal(
		tx,
		currentUser,
		entryDate,
		branchID,
		SourcePaymentAccount,
		account.ID,
		account.AccountName,
		"Opening balance for "+account.AccountName,
		lines,
	)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(journalID) == "" {
		return nil, nil
	}
	return &journalID, nil
}

// clearPaymentAccountOpeningJournal soft-deletes an account's opening journal
// (on edit, or when the account itself is deleted) so 3400 does not strand a
// balance. Blocked when that journal sits in a locked period.
func (s *Service) clearPaymentAccountOpeningJournal(tx *gorm.DB, currentUser *utils.AuthContext, account *PaymentAccount) error {
	if account.OpeningJournalEntryID == nil || strings.TrimSpace(*account.OpeningJournalEntryID) == "" {
		return nil
	}
	journalID := strings.TrimSpace(*account.OpeningJournalEntryID)
	if err := EnsurePeriodOpenForJournals(tx, currentUser.BusinessID, journalID); err != nil {
		return err
	}
	if err := s.repo.SoftDeleteJournalEntry(tx, currentUser.BusinessID, journalID); err != nil && err != gorm.ErrRecordNotFound {
		return apperrors.Internal("failed to remove the previous opening balance journal")
	}
	return nil
}

func sameOptionalDate(left, right *time.Time) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return dateOnlyUTC(*left).Equal(dateOnlyUTC(*right))
}

func formatOptionalDate(value *time.Time) *string {
	if value == nil {
		return nil
	}
	formatted := dateOnlyUTC(*value).Format("2006-01-02")
	return &formatted
}
