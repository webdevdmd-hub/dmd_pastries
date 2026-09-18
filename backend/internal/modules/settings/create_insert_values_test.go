package settings_test

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"pastries-pos/internal/modules/accounting"
	"pastries-pos/internal/modules/businesses"
	"pastries-pos/internal/modules/charges"
	"pastries-pos/internal/modules/ingredients"
	"pastries-pos/internal/modules/masterdata"
	"pastries-pos/internal/modules/packaging"
	"pastries-pos/internal/modules/products"
	"pastries-pos/internal/modules/roles"
	"pastries-pos/internal/modules/settings"
)

// Regression: ISSUE-063 — "off" choices made at creation were still saved "on"
// after the ISSUE-061 and ISSUE-039 fixes shipped.
//
// Both fixes added Select("*") to Create, on the belief that GORM left a false
// bool out of the INSERT. It does not: when a field's tag carries a parsed
// default (gorm:"default:true"), GORM writes that default in place of any zero
// value, whatever Select says. On production on 2026-09-18 a product created
// with "POS visible" unchecked sent is_pos_visible=false and came back true.
// The earlier tests only read the source for Select("*"), so they passed.
//
// These tests look at the INSERT GORM actually builds.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md

// insertedValues returns column -> value for the first row GORM would insert.
func insertedValues(t *testing.T, value any) map[string]any {
	t.Helper()
	db, err := gorm.Open(postgres.New(postgres.Config{DriverName: "pgx"}), &gorm.Config{
		DryRun:               true,
		DisableAutomaticPing: true,
		// Create opens a transaction by default, which dials the database.
		SkipDefaultTransaction: true,
		Logger:                 logger.Discard,
	})
	if err != nil {
		t.Fatalf("open dry-run gorm: %v", err)
	}
	result := db.Create(value)
	if result.Error != nil {
		t.Fatalf("dry-run create: %v", result.Error)
	}
	stmt := result.Statement
	sql := stmt.SQL.String()
	open, end := strings.Index(sql, "("), strings.Index(sql, ") VALUES")
	if open == -1 || end == -1 {
		t.Fatalf("not an INSERT: %s", sql)
	}
	values := map[string]any{}
	for i, column := range strings.Split(sql[open+1:end], ",") {
		values[strings.Trim(strings.TrimSpace(column), `"`)] = stmt.Vars[i]
	}
	return values
}

func TestCreatesKeepTheValuesChosen(t *testing.T) {
	cases := []struct {
		name  string
		model any
		want  map[string]any
	}{
		{"product hidden from POS", &products.Product{ID: "p1"},
			map[string]any{"is_pos_visible": false}},
		{"ingredient not tracked", &ingredients.Ingredient{ID: "i1"},
			map[string]any{"is_stock_tracked": false, "is_expiry_tracked": false}},
		{"packaging untracked and reusable", &packaging.PackagingItem{ID: "k1"},
			map[string]any{"is_stock_tracked": false, "is_consumable": false}},
		{"payment method with everything off", &settings.PaymentMethod{ID: "m1"},
			map[string]any{"allow_split_payment": false, "show_in_pos": false, "show_in_bakery_orders": false, "show_in_dashboard_collection": false}},
		{"non-refundable charges (created in batches)", &[]charges.DocumentCharge{{ID: "c1"}},
			map[string]any{"is_refundable": false}},
		{"account locked against manual posting", &accounting.ChartAccount{ID: "a1"},
			map[string]any{"allow_manual_posting": false}},
		{"denied role permission", &roles.RolePermission{ID: "r1"},
			map[string]any{"allowed": false}},
		{"low stock alerts off", &businesses.BusinessSettings{ID: "s1"},
			map[string]any{"low_stock_alert": false}},
		{"whole-number unit", &masterdata.Unit{ID: "u1", ConversionFactor: 1},
			map[string]any{"decimal_precision": 0}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := insertedValues(t, tc.model)
			for column, want := range tc.want {
				value, ok := got[column]
				if !ok {
					t.Errorf("%s is not in the INSERT", column)
					continue
				}
				if value != want {
					t.Errorf("%s: chose %v, INSERT writes %v", column, want, value)
				}
			}
		})
	}
}

// A bool tagged default:true can never be saved false through Create. The
// database columns carry their own defaults; the Go tags must not.
func TestNoModelTagsABoolDefaultTrue(t *testing.T) {
	pattern := regexp.MustCompile(`\bbool\s+` + "`" + `[^` + "`" + `]*gorm:"[^"]*default:true`)
	root := filepath.Join("..", "..")
	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil || entry.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return err
		}
		raw, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		for i, line := range strings.Split(string(raw), "\n") {
			if pattern.MatchString(line) {
				t.Errorf("%s:%d tags a bool default:true; false would be saved as true", path, i+1)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
