package products

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// Regression: ISSUE-065 — every product write sat behind one guard that any
// write permission opened. On production on 2026-09-18 a role holding only
// products.view + products.create deleted a product (DELETE 200).
// Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-18.md
//
// Each guard here names itself and stops the request, so the test sees which
// guard a route actually runs without a database or a handler.
func TestEachProductWriteRunsItsOwnGuard(t *testing.T) {
	gin.SetMode(gin.TestMode)
	named := func(name string) gin.HandlerFunc {
		return func(c *gin.Context) {
			c.Header("X-Guard", name)
			c.AbortWithStatus(http.StatusForbidden)
		}
	}
	pass := func(c *gin.Context) { c.Next() }

	router := gin.New()
	RegisterRoutes(router, &Handler{}, pass,
		named("view"), named("create"), named("edit"), named("status"), named("delete"),
		named("pos"), named("picker"))

	cases := []struct {
		method, path, guard string
	}{
		{http.MethodPost, "/api/v1/products", "create"},
		{http.MethodPatch, "/api/v1/products/p1", "edit"},
		{http.MethodPatch, "/api/v1/products/p1/status", "status"},
		{http.MethodDelete, "/api/v1/products/p1", "delete"},
		{http.MethodPost, "/api/v1/products/price-suggestions/bulk-apply", "edit"},
		{http.MethodPost, "/api/v1/products/price-suggestions/s1/apply", "edit"},
		{http.MethodPost, "/api/v1/products/price-suggestions/s1/dismiss", "edit"},
		{http.MethodGet, "/api/v1/products", "view"},
		{http.MethodGet, "/api/v1/products/p1", "view"},
	}
	for _, tc := range cases {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(tc.method, tc.path, nil))
		if got := recorder.Header().Get("X-Guard"); got != tc.guard {
			t.Errorf("%s %s ran guard %q, want %q", tc.method, tc.path, got, tc.guard)
		}
	}
}
