package inventory_test

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/inventory"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
	"pastries-pos/internal/testsupport/fakesql"
)

// Regression: ISSUE-085 — a stock location could be deleted with stock
// arriving or a draft transfer pending, and the transfer then completed onto
// the deleted location.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
//
// The stock check ran before the delete's transaction and nothing looked at
// draft transfers; completing a transfer never asked whether its locations
// still existed. FindStockLocation skips deleted rows, so stranded stock could
// not be moved out again.
//
// The database is scripted (testsupport/fakesql): each case says what the
// rows are, and the test reads the statements the service really sent.

const (
	businessID  = "0b6f0b8e-0000-4000-8000-000000000001"
	branchID    = "0b6f0b8e-0000-4000-8000-000000000002"
	coldRoomID  = "0b6f0b8e-0000-4000-8000-000000000007"
	frontDeskID = "0b6f0b8e-0000-4000-8000-000000000008"
	transferID  = "0b6f0b8e-0000-4000-8000-00000000000a"
)

func owner() *utils.AuthContext {
	branch := branchID
	return &utils.AuthContext{
		UserID:           "0b6f0b8e-0000-4000-8000-000000000009",
		BusinessID:       businessID,
		CurrentBranchID:  &branch,
		AllowedBranchIDs: []string{branchID},
	}
}

func location(id, name string) fakesql.Result {
	return fakesql.Row(map[string]any{
		"id": id, "business_id": businessID, "branch_id": branchID,
		"location_name": name, "location_code": strings.ToUpper(name[:4]),
		"is_default": false, "status": "active",
	})
}

// coldRoom answers for one live, non-default location. extra answers first.
func coldRoom(extra func(fakesql.Query) (fakesql.Result, bool)) fakesql.Responder {
	return func(q fakesql.Query) (fakesql.Result, bool) {
		if extra != nil {
			if result, ok := extra(q); ok {
				return result, true
			}
		}
		if q.Kind == "query" && q.Has(`FROM "stock_locations"`) && q.HasArg(coldRoomID) {
			return location(coldRoomID, "Cold room"), true
		}
		return fakesql.Result{}, false
	}
}

func service(t *testing.T, respond fakesql.Responder) (*inventory.Service, *fakesql.Recorder) {
	t.Helper()
	db, rec := fakesql.Open(t, respond)
	return inventory.NewService(db, inventory.NewRepository(db), audit.NewRepository(db)), rec
}

func conflict(t *testing.T, err error, mention string) {
	t.Helper()
	var appErr *apperrors.AppError
	if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
		t.Fatalf("want a 409 refusal; got %v", err)
	}
	if !strings.Contains(appErr.Message, mention) {
		t.Fatalf("the refusal must say %q; got %q", mention, appErr.Message)
	}
}

func TestLocationWithStockIsRefusedInsideTheDeleteTransaction(t *testing.T) {
	svc, rec := service(t, coldRoom(func(q fakesql.Query) (fakesql.Result, bool) {
		if q.Kind == "query" && q.Has("inventory_location_balances") {
			return fakesql.Count(1), true
		}
		return fakesql.Result{}, false
	}))

	err := svc.DeleteStockLocation(owner(), coldRoomID, "127.0.0.1", "test")
	conflict(t, err, "still holds stock")

	checks := rec.Matching("inventory_location_balances")
	if len(checks) != 1 || !checks[0].InTx {
		t.Fatalf("the stock check must run inside the delete's transaction, on the locked row:\n%s", rec.Dump())
	}
	if len(rec.Writes(`UPDATE "stock_locations"`)) != 0 || rec.Committed() {
		t.Fatalf("a refused delete must change nothing:\n%s", rec.Dump())
	}
}

func TestLocationOnADraftTransferIsRefused(t *testing.T) {
	svc, rec := service(t, coldRoom(func(q fakesql.Query) (fakesql.Result, bool) {
		if q.Kind == "query" && q.Has(`FROM "stock_transfers"`) && q.HasArg("draft") {
			return fakesql.Count(1), true
		}
		return fakesql.Result{}, false
	}))

	err := svc.DeleteStockLocation(owner(), coldRoomID, "127.0.0.1", "test")
	conflict(t, err, "draft stock transfer")
	if len(rec.Writes(`UPDATE "stock_locations"`)) != 0 {
		t.Fatalf("a refused delete must change nothing:\n%s", rec.Dump())
	}
}

func TestEmptyLocationIsDeletedUnderItsRowLock(t *testing.T) {
	svc, rec := service(t, coldRoom(nil))

	if err := svc.DeleteStockLocation(owner(), coldRoomID, "127.0.0.1", "test"); err != nil {
		t.Fatalf("an empty location with no draft transfer must delete; got %v\n%s", err, rec.Dump())
	}
	statements := rec.Statements()
	locked, deleted := -1, -1
	for i, q := range statements {
		if q.InTx && q.Has(`FROM "stock_locations"`, "FOR UPDATE") && locked == -1 {
			locked = i
		}
		if q.Has(`UPDATE "stock_locations"`, `"deleted_at"`) {
			deleted = i
		}
	}
	if locked == -1 || deleted == -1 || locked > deleted || !rec.Committed() {
		t.Fatalf("the delete must lock the location row, then soft-delete it:\n%s", rec.Dump())
	}
}

func TestTransferToADeletedLocationDoesNotComplete(t *testing.T) {
	svc, rec := service(t, func(q fakesql.Query) (fakesql.Result, bool) {
		switch {
		case q.Kind == "query" && q.Has(`FROM "stock_transfers"`):
			return fakesql.Row(map[string]any{
				"id": transferID, "business_id": businessID, "branch_id": branchID,
				"transfer_number": "TRF-000001", "inventory_item_id": "inv-4",
				"from_stock_location_id": coldRoomID, "to_stock_location_id": frontDeskID,
				"quantity": "5", "unit_id": "unit-1", "status": "draft",
			}), true
		// The destination was deleted after the draft was made: only the
		// source is still found.
		case q.Kind == "query" && q.Has(`FROM "stock_locations"`) && q.HasArg(coldRoomID):
			return location(coldRoomID, "Cold room"), true
		case q.Kind == "query" && q.Has("inventory_location_balances"):
			return fakesql.Row(map[string]any{
				"id": "bal-1", "business_id": businessID, "branch_id": branchID,
				"inventory_item_id": "inv-4", "stock_location_id": coldRoomID,
				"current_quantity": "10", "reserved_quantity": "0", "available_quantity": "10",
			}), true
		}
		return fakesql.Result{}, false
	})

	_, err := svc.CompleteStockTransfer(owner(), transferID, "127.0.0.1", "test")
	conflict(t, err, "destination location of this transfer has been deleted")
	if len(rec.Writes("inventory_location_balances")) != 0 || len(rec.Writes(`UPDATE "stock_transfers"`)) != 0 || rec.Committed() {
		t.Fatalf("no stock may move onto a deleted location:\n%s", rec.Dump())
	}
}
