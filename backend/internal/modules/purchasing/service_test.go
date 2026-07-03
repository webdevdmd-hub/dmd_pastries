package purchasing

import (
	"encoding/json"
	"testing"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

func TestPostReturnRequiresAccountingServiceBeforeDatabaseWork(t *testing.T) {
	service := &Service{}
	currentUser := &utils.AuthContext{
		Permissions: []string{"purchasing.manage"},
	}

	_, err := service.PostReturn(currentUser, "purchase-return-id", "", "")
	if err == nil {
		t.Fatal("expected an error")
	}
	appErr, ok := err.(*apperrors.AppError)
	if !ok {
		t.Fatalf("expected AppError, got %T", err)
	}
	if appErr.Message != "purchase return accounting service is not configured" {
		t.Fatalf("unexpected error message: %q", appErr.Message)
	}
}

func TestPurchaseReturnResponseExposesJournalNumbers(t *testing.T) {
	journalID := "journal-id"
	journalNumber := "JE-000045"
	reversalJournalID := "reversal-journal-id"
	reversalJournalNumber := "JE-000046"
	response := PurchaseReturnResponse{
		JournalEntryID:             &journalID,
		JournalEntryNumber:         &journalNumber,
		ReversalJournalEntryID:     &reversalJournalID,
		ReversalJournalEntryNumber: &reversalJournalNumber,
	}

	payload, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("marshal purchase return response: %v", err)
	}

	var decoded map[string]interface{}
	if err := json.Unmarshal(payload, &decoded); err != nil {
		t.Fatalf("unmarshal purchase return response: %v", err)
	}

	if decoded["journal_entry_id"] != journalID {
		t.Fatalf("journal_entry_id = %v, want %q", decoded["journal_entry_id"], journalID)
	}
	if decoded["journal_entry_number"] != journalNumber {
		t.Fatalf("journal_entry_number = %v, want %q", decoded["journal_entry_number"], journalNumber)
	}
	if decoded["reversal_journal_entry_id"] != reversalJournalID {
		t.Fatalf("reversal_journal_entry_id = %v, want %q", decoded["reversal_journal_entry_id"], reversalJournalID)
	}
	if decoded["reversal_journal_entry_number"] != reversalJournalNumber {
		t.Fatalf("reversal_journal_entry_number = %v, want %q", decoded["reversal_journal_entry_number"], reversalJournalNumber)
	}
}

func TestReverseReturnRequiresAccountingServiceBeforeDatabaseWork(t *testing.T) {
	service := &Service{}
	currentUser := &utils.AuthContext{
		Permissions: []string{"purchasing.manage"},
	}

	_, err := service.ReverseReturn(currentUser, "purchase-return-id", ReversePurchaseReturnRequest{Reason: "Correction"}, "", "")
	if err == nil {
		t.Fatal("expected an error")
	}
	appErr, ok := err.(*apperrors.AppError)
	if !ok {
		t.Fatalf("expected AppError, got %T", err)
	}
	if appErr.Message != "purchase return accounting service is not configured" {
		t.Fatalf("unexpected error message: %q", appErr.Message)
	}
}
