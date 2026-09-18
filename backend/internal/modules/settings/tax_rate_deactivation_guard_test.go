package settings_test

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/businesses"
	"pastries-pos/internal/modules/settings"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
	"pastries-pos/internal/testsupport/dryrundb"
)

// Regression: ISSUE-078 — deactivating a tax rate untaxed every product that
// still used it at the till.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
//
// Settings "delete" of a tax rate, and "Mark inactive", flip its status. The
// till joins a product's rate with tr.status = 'active', so a product still
// assigned the rate rang up with no tax. Both paths must now refuse while any
// product uses the rate. The tests run the real service through dryrundb.

const (
	taxGuardBusinessID = "5c2e7d10-7a57-4f0e-8b7e-2b0b8d6a1c01"
	taxGuardUserID     = "5c2e7d10-7a57-4f0e-8b7e-2b0b8d6a1c02"
	taxGuardRateID     = "5c2e7d10-7a57-4f0e-8b7e-2b0b8d6a1c03"
)

func settingsServiceWith(t *testing.T, respond dryrundb.Responder) (*settings.Service, *dryrundb.Recorder) {
	t.Helper()
	db, recorder := dryrundb.Open(t, respond)
	return settings.NewService(db, settings.NewRepository(db), businesses.NewRepository(db), audit.NewRepository(db)), recorder
}

func settingsUser() *utils.AuthContext {
	return &utils.AuthContext{UserID: taxGuardUserID, BusinessID: taxGuardBusinessID, CanAccessAllBranches: true}
}

// taxRateUsedBy answers as a business whose rate is assigned to n products.
func taxRateUsedBy(rate settings.TaxRate, products int64) dryrundb.Responder {
	return func(stmt dryrundb.Statement, db *gorm.DB) {
		switch stmt.Kind {
		case dryrundb.Query:
			if _, ok := db.Statement.Dest.(*settings.TaxRate); ok {
				dryrundb.Fill(db, rate)
				return
			}
			if strings.Contains(stmt.SQL, `FROM "products"`) && strings.Contains(stmt.Where(), "tax_rate_id") {
				dryrundb.SetCount(db, products)
			}
		case dryrundb.Update:
			if stmt.Table == "tax_rates" {
				dryrundb.Matched(db, 1)
			}
		}
	}
}

func vat5(isDefault bool) settings.TaxRate {
	return settings.TaxRate{
		ID:             taxGuardRateID,
		BusinessID:     taxGuardBusinessID,
		TaxName:        "UAE VAT 5%",
		TaxType:        "VAT",
		RatePercentage: 5,
		IsDefault:      isDefault,
		Status:         "active",
	}
}

func TestTaxRateProductsStillUseIsNotDeactivated(t *testing.T) {
	deactivate := map[string]func(*settings.Service) error{
		"delete": func(service *settings.Service) error {
			return service.DeleteTaxRate(settingsUser(), taxGuardRateID, "127.0.0.1", "test")
		},
		"mark inactive": func(service *settings.Service) error {
			_, err := service.UpdateTaxRateStatus(settingsUser(), taxGuardRateID, settings.UpdateStatusRequest{Status: "inactive"}, "127.0.0.1", "test")
			return err
		},
	}
	cases := []struct {
		name     string
		rate     settings.TaxRate
		products int64
		says     string
	}{
		{"three products", vat5(false), 3, "3 products still use this tax rate; move them to another tax rate"},
		{"one product", vat5(false), 1, "1 product still uses this tax rate; move it to another tax rate"},
		{"the default rate", vat5(true), 2, "2 products still use this tax rate"},
	}
	for path, run := range deactivate {
		for _, tc := range cases {
			t.Run(path+"/"+tc.name, func(t *testing.T) {
				service, recorder := settingsServiceWith(t, taxRateUsedBy(tc.rate, tc.products))
				err := run(service)

				var appErr *apperrors.AppError
				if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
					t.Fatalf("returned %v, want 409: products still ring up at this rate", err)
				}
				if !strings.Contains(appErr.Message, tc.says) {
					t.Errorf("409 message %q, want it to contain %q", appErr.Message, tc.says)
				}
				if writes := recorder.Writes("tax_rates"); len(writes) > 0 {
					t.Errorf("the rate was written although deactivation was refused: %s", writes[0].SQL)
				}
				if recorder.Commits() != 0 {
					t.Errorf("a refused deactivation committed %d transaction(s)", recorder.Commits())
				}
			})
		}
	}
}

func TestUnusedTaxRateIsDeactivated(t *testing.T) {
	service, recorder := settingsServiceWith(t, taxRateUsedBy(vat5(true), 0))
	if err := service.DeleteTaxRate(settingsUser(), taxGuardRateID, "127.0.0.1", "test"); err != nil {
		t.Fatalf("an unused rate was refused: %v", err)
	}
	writes := recorder.Writes("tax_rates")
	if len(writes) != 1 || !strings.Contains(writes[0].SQL, `"status"=`) {
		t.Fatalf("want one UPDATE of the rate's status, got %v", writes)
	}
	if recorder.Commits() != 1 {
		t.Fatalf("commits = %d, want 1", recorder.Commits())
	}
}

// Reactivating is never the dangerous direction; the guard must not block it.
func TestReactivatingAUsedTaxRateIsAllowed(t *testing.T) {
	rate := vat5(false)
	rate.Status = "inactive"
	service, recorder := settingsServiceWith(t, taxRateUsedBy(rate, 4))
	if _, err := service.UpdateTaxRateStatus(settingsUser(), taxGuardRateID, settings.UpdateStatusRequest{Status: "active"}, "127.0.0.1", "test"); err != nil {
		t.Fatalf("reactivating a rate products use was refused: %v", err)
	}
	if recorder.Commits() != 1 {
		t.Fatalf("commits = %d, want 1", recorder.Commits())
	}
}
