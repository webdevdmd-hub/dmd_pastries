package pos_test

import (
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"testing"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/pos"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
	"pastries-pos/internal/testsupport/dryrundb"
)

// Regression: ISSUE-096 — a held sale could be both resumed and cancelled by
// two tills acting on it at once.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
//
// Resume and cancel read the held sale, checked status == "held" in Go, then
// updated it with no status condition. The race: both requests read "held";
// one writes first; the second's UPDATE still matched the row, so it
// succeeded too.
//
// The fake below replays exactly that interleaving. Every read sees the sale
// as held, but by the time this request's UPDATE runs the other till has
// already moved it on, so the row only matches an UPDATE that does not
// insist on status = 'held' -- which is what Postgres would do.

const (
	raceBusinessID = "3d9c4b0e-2f0a-4d61-9b55-6a1c2e7f8a01"
	raceBranchID   = "3d9c4b0e-2f0a-4d61-9b55-6a1c2e7f8a02"
	raceUserID     = "3d9c4b0e-2f0a-4d61-9b55-6a1c2e7f8a03"
	raceHeldSaleID = "3d9c4b0e-2f0a-4d61-9b55-6a1c2e7f8a04"
)

var whereStatus = regexp.MustCompile(`status = \$(\d+)`)

// heldSaleTable answers as a held_sales table whose one row the read sees as
// "held" and whose status at write time is statusAtWrite.
func heldSaleTable(statusAtWrite string) dryrundb.Responder {
	return func(stmt dryrundb.Statement, db *gorm.DB) {
		if stmt.Table != "held_sales" {
			return
		}
		switch stmt.Kind {
		case dryrundb.Query:
			if _, ok := db.Statement.Dest.(*pos.HeldSale); ok {
				dryrundb.Fill(db, pos.HeldSale{
					ID:         raceHeldSaleID,
					BusinessID: raceBusinessID,
					BranchID:   raceBranchID,
					HoldNumber: "HOLD-20260918-000001",
					Status:     "held",
					HeldAt:     time.Date(2026, 9, 18, 9, 0, 0, 0, time.UTC),
				})
			}
		case dryrundb.Update:
			// Unconstrained by status, the UPDATE matches the row whatever it
			// now holds; constrained, only if the status still agrees.
			if match := whereStatus.FindStringSubmatch(stmt.Where()); match != nil {
				index, _ := strconv.Atoi(match[1])
				if index < 1 || index > len(stmt.Vars) || stmt.Vars[index-1] != statusAtWrite {
					dryrundb.Matched(db, 0)
					return
				}
			}
			dryrundb.Matched(db, 1)
		}
	}
}

func raceService(t *testing.T, statusAtWrite string) (*pos.Service, *dryrundb.Recorder) {
	t.Helper()
	db, recorder := dryrundb.Open(t, heldSaleTable(statusAtWrite))
	return pos.NewService(db, pos.NewRepository(db), nil, audit.NewRepository(db)), recorder
}

func raceUser() *utils.AuthContext {
	branchID := raceBranchID
	return &utils.AuthContext{
		UserID:           raceUserID,
		BusinessID:       raceBusinessID,
		CurrentBranchID:  &branchID,
		AllowedBranchIDs: []string{raceBranchID},
	}
}

func TestTheLoserOfAHeldSaleRaceGetsAConflict(t *testing.T) {
	actions := map[string]func(*pos.Service) error{
		"cancel": func(service *pos.Service) error {
			return service.CancelHeldSale(raceUser(), raceHeldSaleID, "127.0.0.1", "test")
		},
		"resume": func(service *pos.Service) error {
			_, err := service.ResumeHeldSale(raceUser(), raceHeldSaleID, "127.0.0.1", "test")
			return err
		},
	}
	for name, act := range actions {
		for _, otherTill := range []string{"resumed", "cancelled"} {
			t.Run(name+" after the other till "+otherTill+" it", func(t *testing.T) {
				service, recorder := raceService(t, otherTill)
				err := act(service)

				if recorder.Commits() != 0 {
					t.Fatalf("both tills won: this %s committed after the sale was already %s", name, otherTill)
				}
				var appErr *apperrors.AppError
				if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
					t.Fatalf("returned %v, want 409", err)
				}
				if appErr.Message != "held sale was already resumed or cancelled; refresh the held sales list" {
					t.Errorf("409 message = %q", appErr.Message)
				}
			})
		}
	}
}

// Without a race the conditional UPDATE still matches and the cancel lands.
func TestAnUncontestedHeldSaleIsCancelled(t *testing.T) {
	service, recorder := raceService(t, "held")
	if err := service.CancelHeldSale(raceUser(), raceHeldSaleID, "127.0.0.1", "test"); err != nil {
		t.Fatalf("cancel: %v", err)
	}
	if recorder.Commits() != 1 {
		t.Fatalf("commits = %d, want 1", recorder.Commits())
	}
	writes := recorder.Writes("held_sales")
	if len(writes) != 1 || !whereStatus.MatchString(writes[0].Where()) {
		t.Fatalf("want one UPDATE conditioned on status, got %v", writes)
	}
}
