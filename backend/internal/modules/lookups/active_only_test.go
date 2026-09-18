package lookups_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/lookups"
	"pastries-pos/internal/modules/masterdata"
	"pastries-pos/internal/shared/utils"
	"pastries-pos/internal/testsupport/fakesql"
)

// Regression: ISSUE-089 — the product form offered units and categories that
// Master Data had deactivated.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
//
// "Deleting" a unit or category only marks it inactive, and /lookups handed
// back the module's full lists. This mounts the real route over a scripted
// database holding one active and one inactive record of each kind.

const (
	businessID = "0b6f0b8e-0000-4000-8000-000000000001"
	branchID   = "0b6f0b8e-0000-4000-8000-000000000002"
)

func TestLookupsOfferOnlyActiveUnitsAndCategories(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, _ := fakesql.Open(t, func(q fakesql.Query) (fakesql.Result, bool) {
		switch {
		case q.Kind == "query" && q.Has(`FROM "units"`):
			return fakesql.Result{
				Columns: []string{"id", "unit_name", "symbol", "status", "unit_category_id"},
				Rows: [][]any{
					{"u-kg", "Kilogram", "kg", "active", "uc-1"},
					{"u-tray", "Tray", "tray", "inactive", "uc-1"},
				},
			}, true
		case q.Kind == "query" && q.Has(`FROM "product_categories"`):
			return fakesql.Result{
				Columns: []string{"id", "business_id", "branch_id", "category_name", "category_code", "status"},
				Rows: [][]any{
					{"c-cakes", businessID, branchID, "Cakes", "CAKES", "active"},
					{"c-seasonal", businessID, branchID, "Seasonal", "SEASONAL", "inactive"},
				},
			}, true
		}
		return fakesql.Result{}, false
	})

	masterData := masterdata.NewService(db, masterdata.NewRepository(db), audit.NewRepository(db))
	router := gin.New()
	branch := branchID
	lookups.RegisterRoutes(router, lookups.NewHandler(masterData, nil, nil), func(c *gin.Context) {
		c.Set(utils.AuthContextKey, &utils.AuthContext{
			UserID:           "0b6f0b8e-0000-4000-8000-000000000009",
			BusinessID:       businessID,
			CurrentBranchID:  &branch,
			AllowedBranchIDs: []string{branchID},
		})
		c.Next()
	})

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/lookups?kinds=units,product_categories", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("GET /lookups = %d: %s", recorder.Code, recorder.Body.String())
	}

	var body struct {
		Data map[string][]struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	for kind, want := range map[string]string{"units": "u-kg", "product_categories": "c-cakes"} {
		got := body.Data[kind]
		if len(got) != 1 || got[0].ID != want {
			t.Errorf("%s: a form must be offered only the active record %s; got %+v", kind, want, got)
		}
	}
}
