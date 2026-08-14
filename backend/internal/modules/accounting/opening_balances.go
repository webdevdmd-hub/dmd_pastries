package accounting

import (
	"strings"
	"time"

	"gorm.io/gorm"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

// Generic opening balances (Phase 6 / W1).
//
// A business going live mid-year already has balances everywhere: prepaid
// rent, a bank loan, owner capital, and -- above all -- customers who owe it
// money and suppliers it owes. Phase 5 / W3 opened cash and bank accounts;
// this opens the rest.
//
// Every opening books against 3400 Opening Balance Equity:
//
//	chart account, debit-normal   Dr <account> / Cr 3400
//	chart account, credit-normal  Dr 3400      / Cr <account>
//	customer                      Dr 1100      / Cr 3400
//	supplier                      Dr 3400      / Cr 2000
//
// with the entry mirrored when the amount is negative. Once every opening is
// entered, 3400 should net to zero; whatever is left is the part of the
// opening trial balance nobody has accounted for yet, which is why
// OpeningBalanceSummary reports it.
//
// Counterparty openings post to the AR and AP control accounts, which no
// per-line party column can attribute, so counterparty_opening_balances is
// the subledger that says whose balance it is -- the same shape as
// customer_credits behind 2200 (see customer_credit.go). Every operational
// AR/AP sum has to add these rows in, or the reconciliation screens report
// drift the ledger does not have.

// openingBalanceEligibility explains why an account cannot take a generic
// opening balance. Each exclusion has a dedicated mechanism instead, and
// allowing both would post to 3400 twice for the same asset.
type openingBalanceEligibility struct {
	Allowed bool
	Reason  string
}

// buildOpeningBalanceLines returns the two lines for an opening balance
// against 3400. normalBalance decides the direction a positive amount takes:
// a debit-normal account (an asset) is debited, a credit-normal one (a
// liability or equity) is credited.
func buildOpeningBalanceLines(accountID, equityAccountID, normalBalance string, amount float64, description string) []JournalEntryLineRequest {
	magnitude := absMoney(roundMoney(amount))
	debitsTheAccount := strings.TrimSpace(strings.ToLower(normalBalance)) != "credit"
	if amount < 0 {
		debitsTheAccount = !debitsTheAccount
	}
	if debitsTheAccount {
		return []JournalEntryLineRequest{
			{AccountID: accountID, DebitAmount: magnitude, Description: description},
			{AccountID: equityAccountID, CreditAmount: magnitude, Description: description},
		}
	}
	return []JournalEntryLineRequest{
		{AccountID: equityAccountID, DebitAmount: magnitude, Description: description},
		{AccountID: accountID, CreditAmount: magnitude, Description: description},
	}
}

// normalizeOpeningAmountAndDate validates the amount/date pair every opening
// shares: a non-zero amount has to name the period it belongs to.
func normalizeOpeningAmountAndDate(amount float64, date string) (float64, time.Time, error) {
	rounded := roundMoney(amount)
	parsed, err := parseRequiredDate(date, "opening_date")
	if err != nil {
		return 0, time.Time{}, err
	}
	return rounded, dateOnlyUTC(parsed), nil
}

// chartAccountOpeningEligibility rejects the accounts that already have a
// dedicated opening mechanism. Posting a generic opening on top of one of
// those would credit 3400 twice for the same balance.
func (s *Service) chartAccountOpeningEligibility(tx *gorm.DB, businessID string, account *ChartAccount) (openingBalanceEligibility, error) {
	if strings.TrimSpace(account.Status) != "active" {
		return openingBalanceEligibility{Reason: "an inactive account cannot carry an opening balance"}, nil
	}
	// The code-based exclusions come first: they are pure, and there is no
	// point paying for a payment-account lookup on an account that is
	// excluded either way.
	switch strings.TrimSpace(account.AccountCode) {
	case "1200", "1210":
		return openingBalanceEligibility{
			Reason: "inventory opening balances come from opening stock, not from this screen",
		}, nil
	case "1100":
		return openingBalanceEligibility{
			Reason: "receivables are opened per customer, not on the control account",
		}, nil
	case "2000":
		return openingBalanceEligibility{
			Reason: "payables are opened per supplier, not on the control account",
		}, nil
	case "3400":
		return openingBalanceEligibility{
			Reason: "3400 is the balancing account for every opening balance and cannot carry one itself",
		}, nil
	}
	used, err := s.repo.IsChartAccountUsedByPaymentAccount(tx, businessID, account.ID)
	if err != nil {
		return openingBalanceEligibility{}, apperrors.Internal("failed to check the account's opening balance mechanism")
	}
	if used {
		return openingBalanceEligibility{
			Reason: "this account belongs to a payment account; set its opening balance on the payment account instead",
		}, nil
	}
	return openingBalanceEligibility{Allowed: true}, nil
}

// applyChartAccountOpening posts or reposts the journal for a chart-account
// opening and returns the journal id to store on the row. Callers run it
// inside their own transaction.
func (s *Service) applyChartAccountOpening(
	tx *gorm.DB,
	currentUser *utils.AuthContext,
	row *ChartAccountOpeningBalance,
	account *ChartAccount,
) (*string, error) {
	// Clear first: the previous journal holds the (business, source_type,
	// source_id) idempotency slot from migration 000096 that the new one needs.
	if err := s.clearOpeningJournal(tx, currentUser, row.JournalEntryID); err != nil {
		return nil, err
	}
	amount := roundMoney(row.Amount)
	if amount == 0 {
		return nil, nil
	}
	entryDate := dateOnlyUTC(row.OpeningDate)
	if err := EnsurePeriodOpen(tx, currentUser.BusinessID, entryDate); err != nil {
		return nil, err
	}
	equityAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, row.BranchID, "opening_balance_equity", "3400", "Opening Balance Equity")
	if err != nil {
		return nil, err
	}
	description := "Opening balance: " + account.AccountName
	lines := buildOpeningBalanceLines(account.ID, equityAccount.ID, account.NormalBalance, amount, description)
	journalID, err := s.createPostedSystemJournal(
		tx,
		currentUser,
		entryDate,
		row.BranchID,
		SourceAccountOpeningBalance,
		account.ID,
		account.AccountName,
		description,
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

// applyCounterpartyOpening posts or reposts a customer's or supplier's
// opening balance against the matching control account.
func (s *Service) applyCounterpartyOpening(
	tx *gorm.DB,
	currentUser *utils.AuthContext,
	row *CounterpartyOpeningBalance,
	partyName string,
) (*string, error) {
	if err := s.clearOpeningJournal(tx, currentUser, row.JournalEntryID); err != nil {
		return nil, err
	}
	amount := roundMoney(row.Amount)
	if amount == 0 {
		return nil, nil
	}
	entryDate := dateOnlyUTC(row.OpeningDate)
	if err := EnsurePeriodOpen(tx, currentUser.BusinessID, entryDate); err != nil {
		return nil, err
	}
	equityAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, row.BranchID, "opening_balance_equity", "3400", "Opening Balance Equity")
	if err != nil {
		return nil, err
	}

	mappingKey, fallbackCode, fallbackName := "accounts_receivable", "1100", "Accounts Receivable"
	// A receivable is debit-normal, a payable credit-normal, which is what
	// flips the entry between the two.
	normalBalance := "debit"
	label := "customer"
	if row.PartyType == PartyTypeSupplier {
		mappingKey, fallbackCode, fallbackName = "accounts_payable", "2000", "Accounts Payable"
		normalBalance = "credit"
		label = "supplier"
	}
	controlAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, row.BranchID, mappingKey, fallbackCode, fallbackName)
	if err != nil {
		return nil, err
	}
	description := "Opening balance (" + label + "): " + partyName
	lines := buildOpeningBalanceLines(controlAccount.ID, equityAccount.ID, normalBalance, amount, description)
	journalID, err := s.createPostedSystemJournal(
		tx,
		currentUser,
		entryDate,
		row.BranchID,
		SourceCounterpartyOpeningBalance,
		row.PartyID,
		partyName,
		description,
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

// SaveChartAccountOpening creates or replaces the opening balance on a chart
// account. An amount of zero removes it.
func (s *Service) SaveChartAccountOpening(currentUser *utils.AuthContext, req SaveChartAccountOpeningRequest, ipAddress, userAgent string) (*ChartAccountOpeningResponse, error) {
	amount, openingDate, err := normalizeOpeningAmountAndDate(req.Amount, req.OpeningDate)
	if err != nil {
		return nil, err
	}
	var saved *ChartAccountOpeningResponse
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		account, err := s.repo.FindByID(currentUser.BusinessID, strings.TrimSpace(req.ChartAccountID))
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return apperrors.BadRequest("chart_account_id must reference an account in this business", nil)
			}
			return apperrors.Internal("failed to load the chart account")
		}
		eligibility, err := s.chartAccountOpeningEligibility(tx, currentUser.BusinessID, account)
		if err != nil {
			return err
		}
		if !eligibility.Allowed {
			return apperrors.BadRequest(eligibility.Reason, nil)
		}

		row, err := s.repo.FindChartAccountOpening(tx, currentUser.BusinessID, account.BranchID, account.ID)
		if err != nil && err != gorm.ErrRecordNotFound {
			return apperrors.Internal("failed to load the existing opening balance")
		}
		if err == gorm.ErrRecordNotFound {
			row = &ChartAccountOpeningBalance{
				ID:              utils.NewUUID(),
				BusinessID:      currentUser.BusinessID,
				BranchID:        account.BranchID,
				ChartAccountID:  account.ID,
				CreatedByUserID: &currentUser.UserID,
			}
		}
		row.Amount = amount
		row.OpeningDate = openingDate
		row.UpdatedByUserID = &currentUser.UserID

		journalID, err := s.applyChartAccountOpening(tx, currentUser, row, account)
		if err != nil {
			return err
		}
		row.JournalEntryID = journalID

		// A zero opening is a removal: keeping the row would show an entry
		// the ledger no longer carries.
		if amount == 0 {
			if strings.TrimSpace(row.ID) != "" {
				if err := s.repo.SoftDeleteChartAccountOpening(tx, currentUser.BusinessID, row.ID); err != nil {
					return apperrors.Internal("failed to remove the opening balance")
				}
			}
			saved = nil
			return s.writeEntityAudit(tx, currentUser, "accounting.opening_balance_cleared", "opening_balance", account.ID,
				"Opening balance cleared for "+account.AccountName+".", ipAddress, userAgent)
		}
		if err := s.repo.SaveChartAccountOpening(tx, row); err != nil {
			return apperrors.Internal("failed to save the opening balance")
		}
		saved = &ChartAccountOpeningResponse{
			ID:             row.ID,
			ChartAccountID: account.ID,
			BranchID:       row.BranchID,
			AccountCode:    account.AccountCode,
			AccountName:    account.AccountName,
			AccountType:    account.AccountType,
			NormalBalance:  account.NormalBalance,
			Amount:         row.Amount,
			OpeningDate:    row.OpeningDate.Format("2006-01-02"),
			JournalEntryID: row.JournalEntryID,
		}
		return s.writeEntityAudit(tx, currentUser, "accounting.opening_balance_saved", "opening_balance", account.ID,
			"Opening balance set for "+account.AccountName+".", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	if saved == nil {
		return &ChartAccountOpeningResponse{ChartAccountID: strings.TrimSpace(req.ChartAccountID), Amount: 0}, nil
	}
	return saved, nil
}

// SaveCounterpartyOpening creates or replaces a customer's or supplier's
// opening balance against the AR or AP control account.
func (s *Service) SaveCounterpartyOpening(currentUser *utils.AuthContext, req SaveCounterpartyOpeningRequest, ipAddress, userAgent string) (*CounterpartyOpeningResponse, error) {
	amount, openingDate, err := normalizeOpeningAmountAndDate(req.Amount, req.OpeningDate)
	if err != nil {
		return nil, err
	}
	partyType := strings.TrimSpace(req.PartyType)
	partyID := strings.TrimSpace(req.PartyID)

	var saved *CounterpartyOpeningResponse
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		partyName, branchID, err := s.repo.FindCounterpartyForOpening(tx, currentUser.BusinessID, partyType, partyID)
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return apperrors.BadRequest("party_id must reference a "+partyType+" in this business", nil)
			}
			return apperrors.Internal("failed to load the counterparty")
		}
		if strings.TrimSpace(branchID) == "" {
			return apperrors.BadRequest("this "+partyType+" has no branch and cannot carry an opening balance", nil)
		}

		row, err := s.repo.FindCounterpartyOpening(tx, currentUser.BusinessID, branchID, partyType, partyID)
		if err != nil && err != gorm.ErrRecordNotFound {
			return apperrors.Internal("failed to load the existing opening balance")
		}
		if err == gorm.ErrRecordNotFound {
			row = &CounterpartyOpeningBalance{
				ID:              utils.NewUUID(),
				BusinessID:      currentUser.BusinessID,
				BranchID:        branchID,
				PartyType:       partyType,
				PartyID:         partyID,
				CreatedByUserID: &currentUser.UserID,
			}
		}
		row.Amount = amount
		row.OpeningDate = openingDate
		row.UpdatedByUserID = &currentUser.UserID

		journalID, err := s.applyCounterpartyOpening(tx, currentUser, row, partyName)
		if err != nil {
			return err
		}
		row.JournalEntryID = journalID

		if amount == 0 {
			if strings.TrimSpace(row.ID) != "" {
				if err := s.repo.SoftDeleteCounterpartyOpening(tx, currentUser.BusinessID, row.ID); err != nil {
					return apperrors.Internal("failed to remove the opening balance")
				}
			}
			saved = nil
			return s.writeEntityAudit(tx, currentUser, "accounting.opening_balance_cleared", "opening_balance", partyID,
				"Opening balance cleared for "+partyName+".", ipAddress, userAgent)
		}
		if err := s.repo.SaveCounterpartyOpening(tx, row); err != nil {
			return apperrors.Internal("failed to save the opening balance")
		}
		saved = &CounterpartyOpeningResponse{
			ID:             row.ID,
			PartyType:      row.PartyType,
			PartyID:        row.PartyID,
			PartyName:      partyName,
			BranchID:       row.BranchID,
			Amount:         row.Amount,
			OpeningDate:    row.OpeningDate.Format("2006-01-02"),
			JournalEntryID: row.JournalEntryID,
		}
		return s.writeEntityAudit(tx, currentUser, "accounting.opening_balance_saved", "opening_balance", partyID,
			"Opening balance set for "+partyName+".", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	if saved == nil {
		return &CounterpartyOpeningResponse{PartyType: partyType, PartyID: partyID, Amount: 0}, nil
	}
	return saved, nil
}

func (s *Service) ListChartAccountOpenings(currentUser *utils.AuthContext, branchID string) ([]ChartAccountOpeningResponse, error) {
	rows, err := s.repo.ListChartAccountOpenings(currentUser.BusinessID, branchID)
	if err != nil {
		return nil, apperrors.Internal("failed to list opening balances")
	}
	items := make([]ChartAccountOpeningResponse, 0, len(rows))
	for _, row := range rows {
		items = append(items, ChartAccountOpeningResponse{
			ID:             row.ID,
			ChartAccountID: row.ChartAccountID,
			BranchID:       row.BranchID,
			AccountCode:    row.AccountCode,
			AccountName:    row.AccountName,
			AccountType:    row.AccountType,
			NormalBalance:  row.NormalBalance,
			Amount:         row.Amount,
			OpeningDate:    row.OpeningDate.Format("2006-01-02"),
			JournalEntryID: row.JournalEntryID,
		})
	}
	return items, nil
}

func (s *Service) ListCounterpartyOpenings(currentUser *utils.AuthContext, branchID, partyType string) ([]CounterpartyOpeningResponse, error) {
	rows, err := s.repo.ListCounterpartyOpenings(currentUser.BusinessID, branchID, partyType)
	if err != nil {
		return nil, apperrors.Internal("failed to list opening balances")
	}
	items := make([]CounterpartyOpeningResponse, 0, len(rows))
	for _, row := range rows {
		items = append(items, CounterpartyOpeningResponse{
			ID:             row.ID,
			PartyType:      row.PartyType,
			PartyID:        row.PartyID,
			PartyName:      row.PartyName,
			BranchID:       row.BranchID,
			Amount:         row.Amount,
			OpeningDate:    row.OpeningDate.Format("2006-01-02"),
			JournalEntryID: row.JournalEntryID,
		})
	}
	return items, nil
}

// GetOpeningBalanceSummary reports how much of 3400 is still unexplained.
func (s *Service) GetOpeningBalanceSummary(currentUser *utils.AuthContext, branchID string) (*OpeningBalanceSummaryResponse, error) {
	branchID = strings.TrimSpace(branchID)
	if branchID == "" {
		return nil, apperrors.BadRequest("branch_id is required: the chart of accounts is branch-scoped, so each branch opens its own books", nil)
	}
	equity, err := s.mappedLedgerBalance(currentUser.BusinessID, "opening_balance_equity", "3400", branchID, "")
	if err != nil {
		return nil, err
	}
	chartTotal, err := s.repo.SumChartAccountOpenings(currentUser.BusinessID, branchID)
	if err != nil {
		return nil, apperrors.Internal("failed to total chart account opening balances")
	}
	customerTotal, err := s.repo.SumCounterpartyOpeningBalances(currentUser.BusinessID, branchID, PartyTypeCustomer, "")
	if err != nil {
		return nil, apperrors.Internal("failed to total customer opening balances")
	}
	supplierTotal, err := s.repo.SumCounterpartyOpeningBalances(currentUser.BusinessID, branchID, PartyTypeSupplier, "")
	if err != nil {
		return nil, apperrors.Internal("failed to total supplier opening balances")
	}
	paymentTotal, err := s.repo.SumPaymentAccountOpenings(currentUser.BusinessID, branchID)
	if err != nil {
		return nil, apperrors.Internal("failed to total payment account opening balances")
	}
	unallocated := roundMoney(equity)
	return &OpeningBalanceSummaryResponse{
		BranchID:                   branchID,
		OpeningBalanceEquity:       roundMoney(equity),
		ChartAccountOpeningTotal:   chartTotal,
		CustomerOpeningTotal:       customerTotal,
		SupplierOpeningTotal:       supplierTotal,
		PaymentAccountOpeningTotal: paymentTotal,
		UnallocatedOpeningEquity:   unallocated,
		IsBalanced:                 absMoney(unallocated) < 0.005,
	}, nil
}

// clearOpeningJournal soft-deletes a previously posted opening journal, on
// edit or on delete, so 3400 does not strand a balance. Blocked when that
// journal sits in a locked period.
func (s *Service) clearOpeningJournal(tx *gorm.DB, currentUser *utils.AuthContext, journalEntryID *string) error {
	if journalEntryID == nil || strings.TrimSpace(*journalEntryID) == "" {
		return nil
	}
	journalID := strings.TrimSpace(*journalEntryID)
	if err := EnsurePeriodOpenForJournals(tx, currentUser.BusinessID, journalID); err != nil {
		return err
	}
	if err := s.repo.SoftDeleteJournalEntry(tx, currentUser.BusinessID, journalID); err != nil && err != gorm.ErrRecordNotFound {
		return apperrors.Internal("failed to remove the previous opening balance journal")
	}
	return nil
}
