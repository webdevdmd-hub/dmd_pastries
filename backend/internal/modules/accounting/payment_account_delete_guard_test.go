package accounting_test

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/accounting"
	"pastries-pos/internal/modules/audit"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/testsupport/dryrundb"
)

// Regression: ISSUE-079 — a payment account used only as a payment method's
// branch account could be deleted.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
//
// DeletePaymentAccount checked payment_methods.default_payment_account_id and
// nothing else. Checkout resolves a branch's payment_method_account_mappings
// override before that default, so deleting an account a branch override
// pointed at left that branch's till with nowhere to post the method.

const deleteGuardPaymentAccountID = "7a1f0c52-54d4-4a8e-9a0f-0d6c1f1e0b05"

func deletePaymentAccountWith(t *testing.T, methodDefaults, branchOverrides int64) (error, *dryrundb.Recorder) {
	t.Helper()
	branchID := deleteGuardBranchID
	account := accounting.PaymentAccount{
		ID:             deleteGuardPaymentAccountID,
		BusinessID:     deleteGuardBusinessID,
		BranchID:       &branchID,
		AccountName:    "Card terminal - Marina",
		AccountType:    "card_clearing",
		ChartAccountID: deleteGuardAccountID,
		Status:         "active",
	}
	db, recorder := dryrundb.Open(t, func(stmt dryrundb.Statement, db *gorm.DB) {
		switch stmt.Kind {
		case dryrundb.Query:
			if _, ok := db.Statement.Dest.(*accounting.PaymentAccount); ok {
				dryrundb.Fill(db, account)
				return
			}
			switch {
			case selectsFrom(stmt, "payment_methods"):
				dryrundb.SetCount(db, methodDefaults)
			case selectsFrom(stmt, "payment_method_account_mappings"):
				dryrundb.SetCount(db, branchOverrides)
			}
		case dryrundb.Update:
			if stmt.Table == "payment_accounts" {
				dryrundb.Matched(db, 1)
			}
		}
	})
	service := accounting.NewService(db, accounting.NewRepository(db), audit.NewRepository(db))
	err := service.DeletePaymentAccount(deleteGuardUser(), deleteGuardPaymentAccountID, "127.0.0.1", "test")
	return err, recorder
}

func TestPaymentAccountABranchPaysIntoIsNotDeleted(t *testing.T) {
	cases := []struct {
		name                            string
		methodDefaults, branchOverrides int64
		says                            string
	}{
		{"a payment method's branch account", 0, 1, "for a branch"},
		{"a payment method's default account", 1, 0, "unlink it before deleting"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err, recorder := deletePaymentAccountWith(t, tc.methodDefaults, tc.branchOverrides)

			var appErr *apperrors.AppError
			if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
				t.Fatalf("delete returned %v, want 409: a payment method still uses the account", err)
			}
			if !strings.Contains(appErr.Message, tc.says) {
				t.Errorf("409 message %q does not say what uses the account (%q)", appErr.Message, tc.says)
			}
			if writes := recorder.Writes("payment_accounts"); len(writes) > 0 {
				t.Errorf("the account was written although the delete was refused: %s", writes[0].SQL)
			}
			if recorder.Commits() != 0 {
				t.Errorf("a refused delete committed %d transaction(s)", recorder.Commits())
			}
		})
	}
}

func TestUnlinkedPaymentAccountIsDeleted(t *testing.T) {
	err, recorder := deletePaymentAccountWith(t, 0, 0)
	if err != nil {
		t.Fatalf("delete refused an unlinked account: %v", err)
	}
	writes := recorder.Writes("payment_accounts")
	if len(writes) != 1 || !strings.Contains(writes[0].SQL, `"deleted_at"=`) {
		t.Fatalf("want one UPDATE setting deleted_at, got %v", writes)
	}
	if recorder.Commits() != 1 {
		t.Fatalf("commits = %d, want 1", recorder.Commits())
	}
}
