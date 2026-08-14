package accounting

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

// Year-end close (Phase 5 / W2).
//
// Closing a financial year moves its income and expense balances into
// 3100 Retained Earnings, per branch, so each branch's balance sheet
// balances on its own (chart accounts and journal lines are branch-scoped
// since migration 000092). The close posts with entry_date = the financial
// year's last day and then extends the books-closed-through lock to that
// date; posting before locking is deliberate, otherwise the close journal
// would trip its own guard.
//
// Reopening soft-deletes the close journals rather than reversing them: the
// idempotency index from migration 000096 covers status IN
// ('posted','reversed'), so a reversed close journal would hold the
// (business, source_type, source_id) slot forever and block re-closing.

// yearEndCloseSourceID keys a close journal per branch and financial year, so
// re-closing an already-closed year is a no-op instead of a duplicate.
//
// journal_entries.source_id is a uuid column, so the key cannot be the
// readable "<branch>-FY2025" it looks like it wants to be -- Postgres rejects
// that outright. Instead the branch UUID becomes a UUIDv5 namespace and the
// financial year is the name, which is deterministic (the same branch and year
// always derive the same id, which is what the idempotency index needs) while
// staying a valid uuid.
func yearEndCloseSourceID(branchID string, financialYearEnd time.Time) string {
	namespace, err := uuid.Parse(strings.TrimSpace(branchID))
	if err != nil {
		// Not reachable through the service (branch ids come from the
		// database), but a non-uuid branch must not silently collide with
		// another branch's key.
		namespace = uuid.NewSHA1(uuid.NameSpaceOID, []byte(strings.TrimSpace(branchID)))
	}
	return uuid.NewSHA1(namespace, []byte(fmt.Sprintf("year_end_close-FY%d", financialYearEnd.Year()))).String()
}

// financialYearWindowFor returns the financial year that ENDS on the given
// date, or an error when the date is not a financial-year end for this
// business.
func financialYearWindowFor(financialYearEnd time.Time, startMonth, startDay int) (time.Time, error) {
	// The year end is the day before the next year's start.
	nextStart := dateOnlyUTC(financialYearEnd).AddDate(0, 0, 1)
	if int(nextStart.Month()) != startMonth || nextStart.Day() != startDay {
		return time.Time{}, apperrors.BadRequest(
			fmt.Sprintf("financial_year_end_date must be the day before the financial year start (%s %d)", time.Month(startMonth), startDay),
			map[string]interface{}{"expected_next_start_month": startMonth, "expected_next_start_day": startDay},
		)
	}
	return nextStart.AddDate(-1, 0, 0), nil
}

// buildYearEndCloseLines turns a branch's profit-and-loss rows into the close
// journal: every income account is debited by its balance, every cogs/expense
// account credited, and the net lands in retained earnings. Returns nil when
// the branch had no activity worth closing.
func buildYearEndCloseLines(rows []ProfitLossAccountRowResponse, retainedEarningsAccountID string) ([]JournalEntryLineRequest, float64) {
	lines := make([]JournalEntryLineRequest, 0, len(rows)+1)
	netProfit := 0.0
	for _, row := range rows {
		amount := roundMoney(row.Amount)
		if amount == 0 {
			continue
		}
		switch row.AccountType {
		case "income":
			// Income carries a credit balance; closing it means debiting it
			// back to zero (a negative balance flips the side).
			if amount > 0 {
				lines = append(lines, JournalEntryLineRequest{AccountID: row.AccountID, DebitAmount: amount, Description: "Year-end close: " + row.AccountName})
			} else {
				lines = append(lines, JournalEntryLineRequest{AccountID: row.AccountID, CreditAmount: -amount, Description: "Year-end close: " + row.AccountName})
			}
			netProfit = roundMoney(netProfit + amount)
		case "cogs", "expense":
			if amount > 0 {
				lines = append(lines, JournalEntryLineRequest{AccountID: row.AccountID, CreditAmount: amount, Description: "Year-end close: " + row.AccountName})
			} else {
				lines = append(lines, JournalEntryLineRequest{AccountID: row.AccountID, DebitAmount: -amount, Description: "Year-end close: " + row.AccountName})
			}
			netProfit = roundMoney(netProfit - amount)
		}
	}
	if len(lines) == 0 {
		return nil, 0
	}
	if netProfit > 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: retainedEarningsAccountID, CreditAmount: netProfit, Description: "Year-end close: net profit to retained earnings"})
	} else if netProfit < 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: retainedEarningsAccountID, DebitAmount: -netProfit, Description: "Year-end close: net loss to retained earnings"})
	} else {
		// Income and expenses cancel exactly: the close still has to zero
		// both sides, and a two-sided journal needs no equity leg. The
		// existing balance check covers it.
		return lines, 0
	}
	return lines, netProfit
}

// ListFinancialYears reports every financial year from the earliest posted
// journal to today, with its close status.
func (s *Service) ListFinancialYears(currentUser *utils.AuthContext) (*FinancialYearListResponse, error) {
	settings, err := s.repo.EnsureAccountingSettings(s.db, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load accounting settings")
	}
	earliest, err := s.repo.EarliestJournalEntryDate(s.db, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load the earliest journal date")
	}
	items := make([]FinancialYearResponse, 0)
	if earliest == nil {
		return &FinancialYearListResponse{Items: items}, nil
	}
	closed, err := s.repo.ListYearEndCloseJournals(s.db, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load year-end close journals")
	}
	closedByYear := map[int][]YearEndCloseBranchResponse{}
	for _, row := range closed {
		year := dateOnlyUTC(row.EntryDate).Year()
		closedByYear[year] = append(closedByYear[year], YearEndCloseBranchResponse{
			BranchID:       row.BranchID,
			BranchName:     row.BranchName,
			JournalEntryID: row.JournalEntryID,
			EntryNumber:    row.EntryNumber,
			NetProfit:      roundMoney(row.NetProfit),
		})
	}

	today := dateOnlyUTC(time.Now().UTC())
	currentStart := financialYearStartFor(today, settings.FinancialYearStartMonth, settings.FinancialYearStartDay)
	start := financialYearStartFor(dateOnlyUTC(*earliest), settings.FinancialYearStartMonth, settings.FinancialYearStartDay)
	for !start.After(currentStart) {
		end := start.AddDate(1, 0, 0).AddDate(0, 0, -1)
		status := "open"
		if !end.Before(today) {
			status = "current"
		}
		branches := closedByYear[end.Year()]
		if len(branches) > 0 {
			status = "closed"
		}
		if branches == nil {
			branches = []YearEndCloseBranchResponse{}
		}
		items = append(items, FinancialYearResponse{
			FinancialYearStart: start.Format("2006-01-02"),
			FinancialYearEnd:   end.Format("2006-01-02"),
			Status:             status,
			Branches:           branches,
		})
		start = start.AddDate(1, 0, 0)
	}
	return &FinancialYearListResponse{Items: items}, nil
}

// PreviewYearEndClose reports what closing a year would post, per branch,
// without writing anything.
func (s *Service) PreviewYearEndClose(currentUser *utils.AuthContext, financialYearEndDate string) (*YearEndClosePreviewResponse, error) {
	window, err := s.resolveYearEndCloseWindow(currentUser, financialYearEndDate, false)
	if err != nil {
		return nil, err
	}
	branches, err := s.repo.ListBranchIDsWithJournals(s.db, currentUser.BusinessID, window.Start, window.End)
	if err != nil {
		return nil, apperrors.Internal("failed to load branches with activity")
	}
	items := make([]YearEndClosePreviewBranchResponse, 0, len(branches))
	for _, branch := range branches {
		rows, err := s.repo.ListProfitLossRows(currentUser.BusinessID, ProfitLossQuery{
			BranchID: branch.BranchID,
			DateFrom: window.Start.Format("2006-01-02"),
			DateTo:   window.End.Format("2006-01-02"),
		})
		if err != nil {
			return nil, apperrors.Internal("failed to calculate branch profit and loss")
		}
		lines, netProfit := buildYearEndCloseLines(rows, "preview")
		if lines == nil {
			continue
		}
		items = append(items, YearEndClosePreviewBranchResponse{
			BranchID:   branch.BranchID,
			BranchName: branch.BranchName,
			NetProfit:  roundMoney(netProfit),
			LineCount:  len(lines),
		})
	}
	return &YearEndClosePreviewResponse{
		FinancialYearStart: window.Start.Format("2006-01-02"),
		FinancialYearEnd:   window.End.Format("2006-01-02"),
		Branches:           items,
	}, nil
}

type yearEndCloseWindow struct {
	Start time.Time
	End   time.Time
}

// resolveYearEndCloseWindow validates the requested year end against the
// business's financial-year setting and, when closing, that the year is
// complete and every earlier year is already closed.
func (s *Service) resolveYearEndCloseWindow(currentUser *utils.AuthContext, financialYearEndDate string, forClose bool) (*yearEndCloseWindow, error) {
	end, err := parseRequiredDate(financialYearEndDate, "financial_year_end_date")
	if err != nil {
		return nil, err
	}
	end = dateOnlyUTC(end)
	settings, err := s.repo.EnsureAccountingSettings(s.db, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load accounting settings")
	}
	start, err := financialYearWindowFor(end, settings.FinancialYearStartMonth, settings.FinancialYearStartDay)
	if err != nil {
		return nil, err
	}
	if forClose {
		if !end.Before(dateOnlyUTC(time.Now().UTC())) {
			return nil, apperrors.BadRequest("the financial year must be complete before it can be closed", nil)
		}
		if err := s.ensureEarlierYearsClosed(currentUser, start); err != nil {
			return nil, err
		}
	}
	return &yearEndCloseWindow{Start: start, End: end}, nil
}

// ensureEarlierYearsClosed enforces oldest-first closing: each year's profit
// is computed from its own window, so skipping a year would strand its
// result outside retained earnings.
func (s *Service) ensureEarlierYearsClosed(currentUser *utils.AuthContext, start time.Time) error {
	earliest, err := s.repo.EarliestJournalEntryDate(s.db, currentUser.BusinessID)
	if err != nil {
		return apperrors.Internal("failed to load the earliest journal date")
	}
	if earliest == nil {
		return nil
	}
	closed, err := s.repo.ListYearEndCloseJournals(s.db, currentUser.BusinessID)
	if err != nil {
		return apperrors.Internal("failed to load year-end close journals")
	}
	closedYears := map[int]bool{}
	for _, row := range closed {
		closedYears[dateOnlyUTC(row.EntryDate).Year()] = true
	}
	settings, err := s.repo.EnsureAccountingSettings(s.db, currentUser.BusinessID)
	if err != nil {
		return apperrors.Internal("failed to load accounting settings")
	}
	cursor := financialYearStartFor(dateOnlyUTC(*earliest), settings.FinancialYearStartMonth, settings.FinancialYearStartDay)
	for cursor.Before(start) {
		priorEnd := cursor.AddDate(1, 0, 0).AddDate(0, 0, -1)
		if !closedYears[priorEnd.Year()] {
			hasActivity, err := s.repo.HasJournalsInWindow(s.db, currentUser.BusinessID, cursor, priorEnd)
			if err != nil {
				return apperrors.Internal("failed to check earlier financial year activity")
			}
			if hasActivity {
				return apperrors.BadRequest(
					"close financial years oldest first: "+priorEnd.Format("2006-01-02")+" is still open",
					map[string]interface{}{"open_financial_year_end": priorEnd.Format("2006-01-02")},
				)
			}
		}
		cursor = cursor.AddDate(1, 0, 0)
	}
	return nil
}

// CloseFinancialYear posts the per-branch close journals and extends the
// books-closed-through lock to the year end.
func (s *Service) CloseFinancialYear(currentUser *utils.AuthContext, req CloseFinancialYearRequest, ipAddress, userAgent string) (*YearEndCloseResponse, error) {
	window, err := s.resolveYearEndCloseWindow(currentUser, req.FinancialYearEndDate, true)
	if err != nil {
		return nil, err
	}
	branches, err := s.repo.ListBranchIDsWithJournals(s.db, currentUser.BusinessID, window.Start, window.End)
	if err != nil {
		return nil, apperrors.Internal("failed to load branches with activity")
	}
	posted := make([]YearEndCloseBranchResponse, 0, len(branches))
	if err := s.withTransaction(func(tx *gorm.DB) error {
		for _, branch := range branches {
			rows, err := s.repo.ListProfitLossRows(currentUser.BusinessID, ProfitLossQuery{
				BranchID: branch.BranchID,
				DateFrom: window.Start.Format("2006-01-02"),
				DateTo:   window.End.Format("2006-01-02"),
			})
			if err != nil {
				return apperrors.Internal("failed to calculate branch profit and loss")
			}
			retainedEarnings, err := s.requiredMappedAccount(tx, currentUser.BusinessID, branch.BranchID, "retained_earnings", "3100", "Retained Earnings")
			if err != nil {
				return err
			}
			lines, netProfit := buildYearEndCloseLines(rows, retainedEarnings.ID)
			if lines == nil {
				continue
			}
			journalID, err := s.createPostedSystemJournal(
				tx,
				currentUser,
				window.End,
				branch.BranchID,
				SourceYearEndClose,
				yearEndCloseSourceID(branch.BranchID, window.End),
				"FY"+window.End.Format("2006"),
				"Year-end close for "+window.Start.Format("2006-01-02")+" to "+window.End.Format("2006-01-02"),
				lines,
			)
			if err != nil {
				return err
			}
			posted = append(posted, YearEndCloseBranchResponse{
				BranchID:       branch.BranchID,
				BranchName:     branch.BranchName,
				JournalEntryID: journalID,
				NetProfit:      roundMoney(netProfit),
			})
		}

		// Lock last: the close journal is itself dated inside the window it
		// closes, so locking first would block it.
		if err := s.extendBooksClosedThrough(tx, currentUser, window.End); err != nil {
			return err
		}
		return s.writeEntityAudit(tx, currentUser, "accounting.year_end_closed", "accounting_period", currentUser.BusinessID,
			"Financial year closed through "+window.End.Format("2006-01-02")+".", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return &YearEndCloseResponse{
		FinancialYearStart: window.Start.Format("2006-01-02"),
		FinancialYearEnd:   window.End.Format("2006-01-02"),
		Branches:           posted,
	}, nil
}

// ReopenFinancialYear undoes the most recent close: it rolls the lock back
// first (so the soft-deletes are not blocked by the very lock the close set),
// then removes the close journals.
func (s *Service) ReopenFinancialYear(currentUser *utils.AuthContext, req CloseFinancialYearRequest, ipAddress, userAgent string) (*YearEndCloseResponse, error) {
	window, err := s.resolveYearEndCloseWindow(currentUser, req.FinancialYearEndDate, false)
	if err != nil {
		return nil, err
	}
	closed, err := s.repo.ListYearEndCloseJournals(s.db, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load year-end close journals")
	}
	if len(closed) == 0 {
		return nil, apperrors.BadRequest("no closed financial year to reopen", nil)
	}
	latestYear := 0
	for _, row := range closed {
		if year := dateOnlyUTC(row.EntryDate).Year(); year > latestYear {
			latestYear = year
		}
	}
	if window.End.Year() != latestYear {
		return nil, apperrors.BadRequest(
			"only the most recently closed financial year can be reopened",
			map[string]interface{}{"latest_closed_financial_year": latestYear},
		)
	}
	reopened := make([]YearEndCloseBranchResponse, 0)
	previousClose := time.Time{}
	for _, row := range closed {
		entryDate := dateOnlyUTC(row.EntryDate)
		if entryDate.Year() == latestYear {
			continue
		}
		if entryDate.After(previousClose) {
			previousClose = entryDate
		}
	}
	if err := s.withTransaction(func(tx *gorm.DB) error {
		// Roll the lock back BEFORE deleting, or EnsurePeriodOpenForJournals
		// would refuse to touch journals inside the year we are reopening.
		var newLock *time.Time
		if !previousClose.IsZero() {
			newLock = &previousClose
		}
		if err := s.setBooksClosedThrough(tx, currentUser, newLock); err != nil {
			return err
		}
		for _, row := range closed {
			if dateOnlyUTC(row.EntryDate).Year() != latestYear {
				continue
			}
			if err := EnsurePeriodOpenForJournals(tx, currentUser.BusinessID, row.JournalEntryID); err != nil {
				return err
			}
			if err := s.repo.SoftDeleteJournalEntry(tx, currentUser.BusinessID, row.JournalEntryID); err != nil && err != gorm.ErrRecordNotFound {
				return apperrors.Internal("failed to remove the year-end close journal")
			}
			reopened = append(reopened, YearEndCloseBranchResponse{
				BranchID:       row.BranchID,
				BranchName:     row.BranchName,
				JournalEntryID: row.JournalEntryID,
				EntryNumber:    row.EntryNumber,
				NetProfit:      roundMoney(row.NetProfit),
			})
		}
		return s.writeEntityAudit(tx, currentUser, "accounting.year_end_reopened", "accounting_period", currentUser.BusinessID,
			"Financial year reopened through "+window.End.Format("2006-01-02")+".", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return &YearEndCloseResponse{
		FinancialYearStart: window.Start.Format("2006-01-02"),
		FinancialYearEnd:   window.End.Format("2006-01-02"),
		Branches:           reopened,
	}, nil
}

// extendBooksClosedThrough moves the lock forward to at least the given date,
// never backwards (an earlier close must not unlock a later one).
func (s *Service) extendBooksClosedThrough(tx *gorm.DB, currentUser *utils.AuthContext, through time.Time) error {
	current, err := FindBooksClosedThrough(tx, currentUser.BusinessID)
	if err != nil {
		return apperrors.Internal("failed to read the current period lock")
	}
	target := dateOnlyUTC(through)
	if current != nil && !dateOnlyUTC(*current).Before(target) {
		return nil
	}
	return s.setBooksClosedThrough(tx, currentUser, &target)
}

func (s *Service) setBooksClosedThrough(tx *gorm.DB, currentUser *utils.AuthContext, through *time.Time) error {
	now := time.Now().UTC()
	updates := map[string]interface{}{
		"books_closed_through":          through,
		"books_lock_updated_by_user_id": currentUser.UserID,
		"books_lock_updated_at":         now,
		"updated_at":                    now,
	}
	if err := s.repo.UpdateAccountingSettings(tx, currentUser.BusinessID, updates); err != nil {
		return apperrors.Internal("failed to update the accounting period lock")
	}
	return nil
}

// lastYearEndCloseBefore returns the latest close date at or before asOf,
// scoped to a branch. The synthetic "current year profit" row on the balance
// sheet starts the day after it.
func (s *Service) lastYearEndCloseBefore(businessID, branchID string, asOf time.Time) (*time.Time, error) {
	return s.repo.LatestYearEndCloseDate(s.db, businessID, branchID, asOf)
}
