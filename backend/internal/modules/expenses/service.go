package expenses

import (
	"errors"
	"math"
	"strings"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/accounting"
	"pastries-pos/internal/modules/audit"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db        *gorm.DB
	repo      *Repository
	auditRepo *audit.Repository
}

func NewService(db *gorm.DB, repo *Repository, auditRepo *audit.Repository) *Service {
	return &Service{db: db, repo: repo, auditRepo: auditRepo}
}

func (s *Service) List(currentUser *utils.AuthContext, query ExpenseListQuery) (*ExpenseListResponse, error) {
	if currentUser == nil {
		return nil, apperrors.Unauthorized("missing authenticated user")
	}
	if err := normalizeListQuery(currentUser, &query); err != nil {
		return nil, err
	}
	expenses, total, err := s.repo.List(currentUser.BusinessID, query)
	if err != nil {
		return nil, err
	}
	items, err := s.repo.LoadResponses(currentUser.BusinessID, expenses)
	if err != nil {
		return nil, err
	}
	return &ExpenseListResponse{
		Items: items,
		Pagination: Pagination{
			Page:       query.Page,
			Limit:      query.Limit,
			Total:      total,
			TotalPages: int(math.Ceil(float64(total) / float64(query.Limit))),
		},
	}, nil
}

func (s *Service) Get(currentUser *utils.AuthContext, id string) (ExpenseResponse, error) {
	expense, err := s.repo.FindByID(currentUser.BusinessID, id)
	if err != nil {
		return ExpenseResponse{}, mapNotFound(err, "expense not found")
	}
	if !currentUser.CanAccessBranch(expense.BranchID) {
		return ExpenseResponse{}, apperrors.Forbidden("branch access denied")
	}
	return s.repo.LoadResponse(currentUser.BusinessID, *expense)
}

func (s *Service) Create(currentUser *utils.AuthContext, req CreateExpenseRequest, ipAddress, userAgent string) (ExpenseResponse, error) {
	if currentUser == nil {
		return ExpenseResponse{}, apperrors.Unauthorized("missing authenticated user")
	}
	normalized, err := s.normalizeCreateRequest(currentUser, req)
	if err != nil {
		return ExpenseResponse{}, err
	}

	var created Expense
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.validateExpenseInput(tx, currentUser.BusinessID, normalized.BranchID, normalized.ExpenseAccountID, normalized.PaidThroughAccountID, normalized.SupplierID, normalized.CustomerID); err != nil {
			return err
		}

		expenseNumber, err := s.repo.NextExpenseNumber(tx, currentUser.BusinessID, normalized.ExpenseDate)
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		created = Expense{
			ID:                   utils.NewUUID(),
			BusinessID:           currentUser.BusinessID,
			BranchID:             normalized.BranchID,
			ExpenseNumber:        expenseNumber,
			ExpenseDate:          normalized.ExpenseDate,
			ExpenseAccountID:     normalized.ExpenseAccountID,
			PaidThroughAccountID: normalized.PaidThroughAccountID,
			SupplierID:           normalized.SupplierID,
			CustomerID:           normalized.CustomerID,
			Amount:               normalized.Amount,
			ReferenceNumber:      normalized.ReferenceNumber,
			Notes:                normalized.Notes,
			ReceiptFileID:        normalized.ReceiptFileID,
			IsBillable:           normalized.IsBillable,
			Status:               "posted",
			CreatedByUserID:      currentUser.UserID,
			CreatedAt:            now,
			UpdatedAt:            now,
		}
		if err := s.repo.Create(tx, &created); err != nil {
			return err
		}
		entryID, err := s.postExpenseJournal(tx, currentUser, created, "expense", nil)
		if err != nil {
			return err
		}
		created.JournalEntryID = &entryID
		if err := s.repo.Update(tx, currentUser.BusinessID, created.ID, map[string]interface{}{"journal_entry_id": entryID}); err != nil {
			return err
		}
		return s.auditRepo.CreateActivity(tx, audit.ActivityInput{
			BusinessID:  currentUser.BusinessID,
			ActorUserID: currentUser.UserID,
			EventType:   "expense.created",
			EntityType:  "expenses",
			EntityID:    created.ID,
			Summary:     "Expense created and posted",
			Metadata: audit.RecordMetadata(created.ExpenseNumber, map[string]interface{}{
				"expense_number":   created.ExpenseNumber,
				"reference_number": created.ReferenceNumber,
				"branch_id":        created.BranchID,
				"amount":           created.Amount,
				"journal_entry":    entryID,
				"status":           created.Status,
			}, nil),
			IPAddress: ipAddress,
			UserAgent: userAgent,
		})
	})
	if err != nil {
		return ExpenseResponse{}, err
	}
	return s.repo.LoadResponse(currentUser.BusinessID, created)
}

func (s *Service) Update(currentUser *utils.AuthContext, id string, req UpdateExpenseRequest, ipAddress, userAgent string) (ExpenseResponse, error) {
	if currentUser == nil {
		return ExpenseResponse{}, apperrors.Unauthorized("missing authenticated user")
	}
	var updated Expense
	err := s.db.Transaction(func(tx *gorm.DB) error {
		existing, err := s.repo.FindByIDForUpdate(tx, currentUser.BusinessID, id)
		if err != nil {
			return mapNotFound(err, "expense not found")
		}
		if !currentUser.CanAccessBranch(existing.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if existing.Status != "posted" {
			return apperrors.BadRequest("only posted expenses can be updated", nil)
		}

		normalized, err := s.normalizeUpdateRequest(currentUser, *existing, req)
		if err != nil {
			return err
		}
		if err := s.validateExpenseInput(tx, currentUser.BusinessID, normalized.BranchID, normalized.ExpenseAccountID, normalized.PaidThroughAccountID, normalized.SupplierID, normalized.CustomerID); err != nil {
			return err
		}

		accountingChanged := !sameDate(existing.ExpenseDate, normalized.ExpenseDate) ||
			existing.BranchID != normalized.BranchID ||
			existing.ExpenseAccountID != normalized.ExpenseAccountID ||
			existing.PaidThroughAccountID != normalized.PaidThroughAccountID ||
			roundMoney(existing.Amount) != roundMoney(normalized.Amount)

		now := time.Now().UTC()
		updates := map[string]interface{}{
			"branch_id":               normalized.BranchID,
			"expense_date":            normalized.ExpenseDate,
			"expense_account_id":      normalized.ExpenseAccountID,
			"paid_through_account_id": normalized.PaidThroughAccountID,
			"supplier_id":             normalized.SupplierID,
			"customer_id":             normalized.CustomerID,
			"amount":                  normalized.Amount,
			"reference_number":        normalized.ReferenceNumber,
			"notes":                   normalized.Notes,
			"receipt_file_id":         normalized.ReceiptFileID,
			"is_billable":             normalized.IsBillable,
			"updated_by_user_id":      currentUser.UserID,
			"updated_at":              now,
		}
		updated = *existing
		updated.BranchID = normalized.BranchID
		updated.ExpenseDate = normalized.ExpenseDate
		updated.ExpenseAccountID = normalized.ExpenseAccountID
		updated.PaidThroughAccountID = normalized.PaidThroughAccountID
		updated.SupplierID = normalized.SupplierID
		updated.CustomerID = normalized.CustomerID
		updated.Amount = normalized.Amount
		updated.ReferenceNumber = normalized.ReferenceNumber
		updated.Notes = normalized.Notes
		updated.ReceiptFileID = normalized.ReceiptFileID
		updated.IsBillable = normalized.IsBillable
		updated.UpdatedByUserID = &currentUser.UserID
		updated.UpdatedAt = now

		if accountingChanged {
			reversalID, err := s.postReversalJournal(tx, currentUser, *existing, "expense_update_reversal")
			if err != nil {
				return err
			}
			updated.ReversalJournalEntryID = &reversalID
			newEntryID, err := s.postExpenseJournal(tx, currentUser, updated, "expense", nil)
			if err != nil {
				return err
			}
			updated.JournalEntryID = &newEntryID
			updates["reversal_journal_entry_id"] = reversalID
			updates["journal_entry_id"] = newEntryID
		}

		if err := s.repo.Update(tx, currentUser.BusinessID, id, updates); err != nil {
			return err
		}
		changes := expenseChanges(*existing, updated)
		return s.auditRepo.CreateActivity(tx, audit.ActivityInput{
			BusinessID:  currentUser.BusinessID,
			ActorUserID: currentUser.UserID,
			EventType:   "expense.updated",
			EntityType:  "expenses",
			EntityID:    id,
			Summary:     "Expense updated",
			Metadata: audit.RecordMetadata(existing.ExpenseNumber, map[string]interface{}{
				"expense_number":     existing.ExpenseNumber,
				"reference_number":   updated.ReferenceNumber,
				"branch_id":          updated.BranchID,
				"amount":             updated.Amount,
				"accounting_changed": accountingChanged,
			}, changes),
			IPAddress: ipAddress,
			UserAgent: userAgent,
		})
	})
	if err != nil {
		return ExpenseResponse{}, err
	}
	return s.repo.LoadResponse(currentUser.BusinessID, updated)
}

func (s *Service) Delete(currentUser *utils.AuthContext, id string, ipAddress, userAgent string) error {
	if currentUser == nil {
		return apperrors.Unauthorized("missing authenticated user")
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		expense, err := s.repo.FindByIDForUpdate(tx, currentUser.BusinessID, id)
		if err != nil {
			return mapNotFound(err, "expense not found")
		}
		if !currentUser.CanAccessBranch(expense.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		journalIDs, err := s.repo.ListExpenseJournalEntryIDs(tx, currentUser.BusinessID, expense.ID)
		if err != nil {
			return err
		}
		if err := s.repo.HardDeleteExpense(tx, currentUser.BusinessID, id); err != nil {
			return err
		}
		if err := s.repo.HardDeleteJournalEntries(tx, currentUser.BusinessID, journalIDs); err != nil {
			return err
		}
		return s.auditRepo.CreateActivity(tx, audit.ActivityInput{
			BusinessID:  currentUser.BusinessID,
			ActorUserID: currentUser.UserID,
			EventType:   "expense.hard_deleted",
			EntityType:  "expenses",
			EntityID:    id,
			Summary:     "Expense hard deleted",
			Metadata: audit.RecordMetadata(expense.ExpenseNumber, map[string]interface{}{
				"expense_number":   expense.ExpenseNumber,
				"reference_number": expense.ReferenceNumber,
				"branch_id":        expense.BranchID,
				"amount":           expense.Amount,
				"journal_entries":  journalIDs,
			}, []audit.AuditChange{
				{Field: "status", Label: "Status", OldValue: expense.Status, NewValue: "deleted"},
			}),
			IPAddress: ipAddress,
			UserAgent: userAgent,
		})
	})
}

func expenseChanges(existing, updated Expense) []audit.AuditChange {
	changes := []audit.AuditChange{}
	audit.AddChange(&changes, "branch_id", "Branch", existing.BranchID, updated.BranchID)
	audit.AddChange(&changes, "expense_date", "Expense date", existing.ExpenseDate, updated.ExpenseDate)
	audit.AddChange(&changes, "expense_account_id", "Expense account", existing.ExpenseAccountID, updated.ExpenseAccountID)
	audit.AddChange(&changes, "paid_through_account_id", "Paid through", existing.PaidThroughAccountID, updated.PaidThroughAccountID)
	audit.AddChange(&changes, "supplier_id", "Supplier", existing.SupplierID, updated.SupplierID)
	audit.AddChange(&changes, "customer_id", "Customer", existing.CustomerID, updated.CustomerID)
	audit.AddChange(&changes, "amount", "Amount", existing.Amount, updated.Amount)
	audit.AddChange(&changes, "reference_number", "Reference number", existing.ReferenceNumber, updated.ReferenceNumber)
	audit.AddChange(&changes, "notes", "Notes", existing.Notes, updated.Notes)
	audit.AddChange(&changes, "receipt_file_id", "Receipt file", existing.ReceiptFileID, updated.ReceiptFileID)
	audit.AddChange(&changes, "is_billable", "Billable", existing.IsBillable, updated.IsBillable)
	return changes
}

type normalizedExpenseInput struct {
	BranchID             string
	ExpenseDate          time.Time
	ExpenseAccountID     string
	PaidThroughAccountID string
	SupplierID           *string
	CustomerID           *string
	Amount               float64
	ReferenceNumber      string
	Notes                string
	ReceiptFileID        string
	IsBillable           bool
}

func (s *Service) normalizeCreateRequest(currentUser *utils.AuthContext, req CreateExpenseRequest) (normalizedExpenseInput, error) {
	branchID, err := currentUser.ResolveOperationalBranch(strings.TrimSpace(req.BranchID))
	if err != nil {
		return normalizedExpenseInput{}, err
	}
	expenseDate, err := parseDate(req.ExpenseDate)
	if err != nil {
		return normalizedExpenseInput{}, err
	}
	amount := roundMoney(req.Amount)
	if amount <= 0 {
		return normalizedExpenseInput{}, apperrors.BadRequest("amount must be greater than 0", nil)
	}
	return normalizedExpenseInput{
		BranchID:             branchID,
		ExpenseDate:          expenseDate,
		ExpenseAccountID:     strings.TrimSpace(req.ExpenseAccountID),
		PaidThroughAccountID: strings.TrimSpace(req.PaidThroughAccountID),
		SupplierID:           normalizeOptionalUUID(req.SupplierID),
		CustomerID:           normalizeOptionalUUID(req.CustomerID),
		Amount:               amount,
		ReferenceNumber:      strings.TrimSpace(req.ReferenceNumber),
		Notes:                strings.TrimSpace(req.Notes),
		ReceiptFileID:        strings.TrimSpace(req.ReceiptFileID),
		IsBillable:           req.IsBillable,
	}, nil
}

func (s *Service) normalizeUpdateRequest(currentUser *utils.AuthContext, existing Expense, req UpdateExpenseRequest) (normalizedExpenseInput, error) {
	branchID := existing.BranchID
	if req.BranchID != nil {
		resolved, err := currentUser.ResolveOperationalBranch(strings.TrimSpace(*req.BranchID))
		if err != nil {
			return normalizedExpenseInput{}, err
		}
		branchID = resolved
	}
	expenseDate := existing.ExpenseDate
	if req.ExpenseDate != nil {
		parsed, err := parseDate(*req.ExpenseDate)
		if err != nil {
			return normalizedExpenseInput{}, err
		}
		expenseDate = parsed
	}
	amount := roundMoney(existing.Amount)
	if req.Amount != nil {
		amount = roundMoney(*req.Amount)
	}
	if amount <= 0 {
		return normalizedExpenseInput{}, apperrors.BadRequest("amount must be greater than 0", nil)
	}
	expenseAccountID := existing.ExpenseAccountID
	if req.ExpenseAccountID != nil {
		expenseAccountID = strings.TrimSpace(*req.ExpenseAccountID)
	}
	paidThroughAccountID := existing.PaidThroughAccountID
	if req.PaidThroughAccountID != nil {
		paidThroughAccountID = strings.TrimSpace(*req.PaidThroughAccountID)
	}
	referenceNumber := existing.ReferenceNumber
	if req.ReferenceNumber != nil {
		referenceNumber = strings.TrimSpace(*req.ReferenceNumber)
	}
	notes := existing.Notes
	if req.Notes != nil {
		notes = strings.TrimSpace(*req.Notes)
	}
	receiptFileID := existing.ReceiptFileID
	if req.ReceiptFileID != nil {
		receiptFileID = strings.TrimSpace(*req.ReceiptFileID)
	}
	isBillable := existing.IsBillable
	if req.IsBillable != nil {
		isBillable = *req.IsBillable
	}
	supplierID := existing.SupplierID
	if req.SupplierID != nil {
		supplierID = normalizeOptionalUUID(req.SupplierID)
	}
	customerID := existing.CustomerID
	if req.CustomerID != nil {
		customerID = normalizeOptionalUUID(req.CustomerID)
	}
	return normalizedExpenseInput{
		BranchID:             branchID,
		ExpenseDate:          expenseDate,
		ExpenseAccountID:     expenseAccountID,
		PaidThroughAccountID: paidThroughAccountID,
		SupplierID:           supplierID,
		CustomerID:           customerID,
		Amount:               amount,
		ReferenceNumber:      referenceNumber,
		Notes:                notes,
		ReceiptFileID:        receiptFileID,
		IsBillable:           isBillable,
	}, nil
}

func (s *Service) validateExpenseInput(tx *gorm.DB, businessID, branchID, expenseAccountID, paidThroughAccountID string, supplierID, customerID *string) error {
	if branchID == "" {
		return apperrors.BadRequest("branch_id is required", nil)
	}
	if err := s.repo.ValidateBranch(tx, businessID, branchID); err != nil {
		return mapNotFound(err, "branch not found")
	}
	expenseAccount, err := s.repo.ValidateAccount(tx, businessID, expenseAccountID)
	if err != nil {
		return mapNotFound(err, "expense account not found")
	}
	if expenseAccount.AccountType != "expense" && expenseAccount.AccountType != "cogs" {
		return apperrors.BadRequest("expense_account_id must be an expense or cogs account", nil)
	}
	if !expenseAccount.AllowManualPosting {
		return apperrors.BadRequest("expense account does not allow manual posting", nil)
	}
	if _, err := s.repo.ValidatePaidThroughPaymentAccount(tx, businessID, branchID, paidThroughAccountID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.BadRequest("paid_through_account_id must reference an active payment account ledger for this branch", nil)
		}
		return err
	}
	if supplierID != nil {
		if err := s.repo.ValidateSupplier(tx, businessID, branchID, *supplierID); err != nil {
			return mapNotFound(err, "supplier not found")
		}
	}
	if customerID != nil {
		if err := s.repo.ValidateCustomer(tx, businessID, branchID, *customerID); err != nil {
			return mapNotFound(err, "customer not found")
		}
	}
	return nil
}

func (s *Service) postExpenseJournal(tx *gorm.DB, currentUser *utils.AuthContext, expense Expense, sourceType string, reversedEntryID *string) (string, error) {
	entryNumber, err := s.repo.NextJournalEntryNumber(tx, expense.BusinessID, expense.ExpenseDate)
	if err != nil {
		return "", err
	}
	now := time.Now().UTC()
	sourceID := expense.ID
	branchID := expense.BranchID
	entry := accounting.JournalEntry{
		ID:              utils.NewUUID(),
		BusinessID:      expense.BusinessID,
		BranchID:        &branchID,
		EntryNumber:     entryNumber,
		EntryDate:       expense.ExpenseDate,
		ReferenceNumber: coalesceReference(expense.ReferenceNumber, expense.ExpenseNumber),
		SourceType:      sourceType,
		SourceID:        &sourceID,
		Narration:       "Expense " + expense.ExpenseNumber,
		Status:          "posted",
		TotalDebit:      expense.Amount,
		TotalCredit:     expense.Amount,
		PostedAt:        &now,
		PostedByUserID:  &currentUser.UserID,
		ReversedEntryID: reversedEntryID,
		CreatedByUserID: currentUser.UserID,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	lines := []accounting.JournalEntryLine{
		{
			ID:             utils.NewUUID(),
			BusinessID:     expense.BusinessID,
			JournalEntryID: entry.ID,
			AccountID:      expense.ExpenseAccountID,
			LineNumber:     1,
			DebitAmount:    expense.Amount,
			CreditAmount:   0,
			Description:    coalesceReference(expense.Notes, "Expense "+expense.ExpenseNumber),
			CreatedAt:      now,
			UpdatedAt:      now,
		},
		{
			ID:             utils.NewUUID(),
			BusinessID:     expense.BusinessID,
			JournalEntryID: entry.ID,
			AccountID:      expense.PaidThroughAccountID,
			LineNumber:     2,
			DebitAmount:    0,
			CreditAmount:   expense.Amount,
			Description:    "Paid through account",
			CreatedAt:      now,
			UpdatedAt:      now,
		},
	}
	if err := s.repo.CreateJournalEntry(tx, &entry, lines); err != nil {
		return "", err
	}
	return entry.ID, nil
}

func (s *Service) postReversalJournal(tx *gorm.DB, currentUser *utils.AuthContext, expense Expense, sourceType string) (string, error) {
	if expense.JournalEntryID == nil || *expense.JournalEntryID == "" {
		return "", apperrors.BadRequest("expense has no journal entry to reverse", nil)
	}
	lines, err := s.repo.FindJournalLines(tx, expense.BusinessID, *expense.JournalEntryID)
	if err != nil {
		return "", err
	}
	if len(lines) == 0 {
		return "", apperrors.BadRequest("expense journal has no lines to reverse", nil)
	}
	entryNumber, err := s.repo.NextJournalEntryNumber(tx, expense.BusinessID, expense.ExpenseDate)
	if err != nil {
		return "", err
	}
	now := time.Now().UTC()
	sourceID := expense.ID
	branchID := expense.BranchID
	entry := accounting.JournalEntry{
		ID:              utils.NewUUID(),
		BusinessID:      expense.BusinessID,
		BranchID:        &branchID,
		EntryNumber:     entryNumber,
		EntryDate:       expense.ExpenseDate,
		ReferenceNumber: coalesceReference(expense.ReferenceNumber, expense.ExpenseNumber),
		SourceType:      sourceType,
		SourceID:        &sourceID,
		Narration:       "Reversal for expense " + expense.ExpenseNumber,
		Status:          "posted",
		TotalDebit:      expense.Amount,
		TotalCredit:     expense.Amount,
		PostedAt:        &now,
		PostedByUserID:  &currentUser.UserID,
		ReversedEntryID: expense.JournalEntryID,
		CreatedByUserID: currentUser.UserID,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	reversalLines := make([]accounting.JournalEntryLine, 0, len(lines))
	for _, line := range lines {
		reversalLines = append(reversalLines, accounting.JournalEntryLine{
			ID:             utils.NewUUID(),
			BusinessID:     expense.BusinessID,
			JournalEntryID: entry.ID,
			AccountID:      line.AccountID,
			LineNumber:     line.LineNumber,
			DebitAmount:    line.CreditAmount,
			CreditAmount:   line.DebitAmount,
			Description:    "Reversal: " + line.Description,
			CreatedAt:      now,
			UpdatedAt:      now,
		})
	}
	if err := s.repo.CreateJournalEntry(tx, &entry, reversalLines); err != nil {
		return "", err
	}
	if err := s.repo.MarkJournalReversed(tx, expense.BusinessID, *expense.JournalEntryID, entry.ID, currentUser.UserID, now); err != nil {
		return "", err
	}
	return entry.ID, nil
}

func normalizeListQuery(currentUser *utils.AuthContext, query *ExpenseListQuery) error {
	if currentUser == nil {
		return apperrors.Unauthorized("missing authenticated user")
	}
	branchID := strings.TrimSpace(query.BranchID)
	if branchID != "" {
		if !currentUser.CanAccessBranch(branchID) {
			return apperrors.Forbidden("branch access denied")
		}
		query.BranchID = branchID
	} else if !currentUser.CanAccessAllBranches {
		resolved, err := currentUser.ResolveOperationalBranch("")
		if err != nil {
			return err
		}
		query.BranchID = resolved
	}
	query.Status = strings.ToLower(strings.TrimSpace(query.Status))
	if query.Status != "" && query.Status != "posted" && query.Status != "voided" {
		return apperrors.BadRequest("invalid status", nil)
	}
	if query.DateFrom != "" {
		if _, err := parseDate(query.DateFrom); err != nil {
			return err
		}
	}
	if query.DateTo != "" {
		if _, err := parseDate(query.DateTo); err != nil {
			return err
		}
	}
	if query.DateFrom != "" && query.DateTo != "" && query.DateFrom > query.DateTo {
		return apperrors.BadRequest("date_from must be before or equal to date_to", nil)
	}
	query.Page = normalizePositive(query.Page, 1)
	query.Limit = normalizePositive(query.Limit, 20)
	if query.Limit > 100 {
		query.Limit = 100
	}
	query.SortOrder = strings.ToLower(strings.TrimSpace(query.SortOrder))
	if query.SortOrder != "asc" {
		query.SortOrder = "desc"
	}
	return nil
}

func parseDate(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, apperrors.BadRequest("expense_date is required", nil)
	}
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		return time.Time{}, apperrors.BadRequest("date must use YYYY-MM-DD format", nil)
	}
	return parsed, nil
}

func normalizeOptionalUUID(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func normalizePositive(value, fallback int) int {
	if value <= 0 {
		return fallback
	}
	return value
}

func roundMoney(value float64) float64 {
	return math.Round(value*100) / 100
}

func sameDate(left, right time.Time) bool {
	return left.Format("2006-01-02") == right.Format("2006-01-02")
}

func coalesceReference(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value != "" {
		return value
	}
	return fallback
}

func mapNotFound(err error, message string) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return apperrors.NotFound(message)
	}
	return err
}
