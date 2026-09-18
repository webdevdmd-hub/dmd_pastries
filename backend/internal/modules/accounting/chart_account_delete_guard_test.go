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
	"pastries-pos/internal/shared/utils"
	"pastries-pos/internal/testsupport/dryrundb"
)

// Regression: ISSUE-077 — a chart account that journal lines, an account
// mapping or a payment account still pointed at could be deleted.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
//
// DeleteChartAccount only refused while child accounts existed. Deleting an
// account with postings made Trial Balance drop it while the P&L and Balance
// Sheet kept it, its General Ledger 404'd, and every posting routed through a
// mapping or payment account onto it failed.
//
// These tests run the real service against no database: dryrundb answers each
// query the way a table holding the given references would, and records what
// the service wrote.

const (
	deleteGuardBusinessID = "7a1f0c52-54d4-4a8e-9a0f-0d6c1f1e0b01"
	deleteGuardBranchID   = "7a1f0c52-54d4-4a8e-9a0f-0d6c1f1e0b02"
	deleteGuardUserID     = "7a1f0c52-54d4-4a8e-9a0f-0d6c1f1e0b03"
	deleteGuardAccountID  = "7a1f0c52-54d4-4a8e-9a0f-0d6c1f1e0b04"
)

// chartAccountReferences is what points at the account being deleted.
type chartAccountReferences struct {
	liveJournalLines    int64
	deletedJournalLines int64
	mappings            int64
	paymentAccounts     int64
	methodDefaults      int64
	branchOverrides     int64
}

func deleteGuardUser() *utils.AuthContext {
	branchID := deleteGuardBranchID
	return &utils.AuthContext{
		UserID:           deleteGuardUserID,
		BusinessID:       deleteGuardBusinessID,
		CurrentBranchID:  &branchID,
		AllowedBranchIDs: []string{deleteGuardBranchID},
	}
}

// selectsFrom reports whether a statement reads from table, aliased or not.
func selectsFrom(stmt dryrundb.Statement, table string) bool {
	return strings.Contains(stmt.SQL, `FROM "`+table+`"`) || strings.Contains(stmt.SQL, "FROM "+table+" ")
}

func deleteChartAccountWith(t *testing.T, refs chartAccountReferences) (error, *dryrundb.Recorder) {
	t.Helper()
	account := accounting.ChartAccount{
		ID:            deleteGuardAccountID,
		BusinessID:    deleteGuardBusinessID,
		BranchID:      deleteGuardBranchID,
		AccountCode:   "6130",
		AccountName:   "Bad Debts Expense",
		AccountType:   "expense",
		AccountGroup:  "operating_expense",
		NormalBalance: "debit",
		Status:        "active",
	}
	db, recorder := dryrundb.Open(t, func(stmt dryrundb.Statement, db *gorm.DB) {
		switch stmt.Kind {
		case dryrundb.Query:
			if _, ok := db.Statement.Dest.(*accounting.ChartAccount); ok {
				dryrundb.Fill(db, account)
				return
			}
			switch {
			case selectsFrom(stmt, "journal_entry_lines"):
				lines := refs.liveJournalLines
				if !strings.Contains(stmt.Where(), "deleted_at IS NULL") {
					lines += refs.deletedJournalLines
				}
				dryrundb.SetCount(db, lines)
			case selectsFrom(stmt, "accounting_account_mappings"):
				dryrundb.SetCount(db, refs.mappings)
			case selectsFrom(stmt, "payment_accounts"):
				dryrundb.SetCount(db, refs.paymentAccounts)
			case selectsFrom(stmt, "payment_methods"):
				dryrundb.SetCount(db, refs.methodDefaults)
			case selectsFrom(stmt, "payment_method_account_mappings"):
				dryrundb.SetCount(db, refs.branchOverrides)
			}
		case dryrundb.Update:
			if stmt.Table == "chart_of_accounts" {
				dryrundb.Matched(db, 1)
			}
		}
	})
	service := accounting.NewService(db, accounting.NewRepository(db), audit.NewRepository(db))
	err := service.DeleteChartAccount(deleteGuardUser(), deleteGuardAccountID, "127.0.0.1", "test")
	return err, recorder
}

func TestChartAccountStillInUseIsNotDeleted(t *testing.T) {
	cases := []struct {
		name string
		refs chartAccountReferences
		says string
	}{
		{"posted to", chartAccountReferences{liveJournalLines: 2}, "has postings; deactivate it instead"},
		{"target of an account mapping", chartAccountReferences{mappings: 1}, "account mapping"},
		{"behind a payment account", chartAccountReferences{paymentAccounts: 1}, "payment account"},
		{"a payment method's default account", chartAccountReferences{methodDefaults: 1}, "payment method"},
		{"a payment method's branch account", chartAccountReferences{branchOverrides: 1}, "payment method"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err, recorder := deleteChartAccountWith(t, tc.refs)

			var appErr *apperrors.AppError
			if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
				t.Fatalf("delete returned %v, want 409: the account is still in use", err)
			}
			if !strings.Contains(appErr.Message, tc.says) {
				t.Errorf("409 message %q does not say what still uses the account (%q)", appErr.Message, tc.says)
			}
			if writes := recorder.Writes("chart_of_accounts"); len(writes) > 0 {
				t.Errorf("the account was written although the delete was refused: %s", writes[0].SQL)
			}
			if recorder.Commits() != 0 {
				t.Errorf("a refused delete committed %d transaction(s)", recorder.Commits())
			}
		})
	}
}

// The guard must not turn into "never delete": an account nothing points at
// still goes, and lines of deleted journals (soft-deleted with them) are not
// postings any report reads.
func TestUnusedChartAccountIsDeleted(t *testing.T) {
	for _, tc := range []struct {
		name string
		refs chartAccountReferences
	}{
		{"never used", chartAccountReferences{}},
		{"only lines of deleted journals", chartAccountReferences{deletedJournalLines: 3}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err, recorder := deleteChartAccountWith(t, tc.refs)
			if err != nil {
				t.Fatalf("delete refused an unused account: %v", err)
			}
			writes := recorder.Writes("chart_of_accounts")
			if len(writes) != 1 || !strings.Contains(writes[0].SQL, `"deleted_at"=`) {
				t.Fatalf("want one UPDATE setting deleted_at, got %v", writes)
			}
			if recorder.Commits() != 1 {
				t.Fatalf("commits = %d, want 1", recorder.Commits())
			}
		})
	}
}
