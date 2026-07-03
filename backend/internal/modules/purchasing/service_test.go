package purchasing

import (
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
