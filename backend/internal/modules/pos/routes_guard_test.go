package pos

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// Regression: ISSUE-065 — checkout, hold, resume and cancel-held shared one
// guard, so pos.hold_sale alone could check out and pos.sell alone could
// cancel another cashier's held sale.
// Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-18.md
func TestEachTillActionRunsItsOwnGuard(t *testing.T) {
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
		named("view"), named("methods"), named("sell"), named("hold"), named("resume"),
		named("cancel_held"), named("refund"), named("void"))

	cases := []struct {
		method, path, guard string
	}{
		{http.MethodPost, "/api/v1/pos/checkout", "sell"},
		{http.MethodGet, "/api/v1/pos/checkout-status/ref", "sell"},
		{http.MethodPost, "/api/v1/pos/held-sales", "hold"},
		{http.MethodPost, "/api/v1/pos/held-sales/h1/resume", "resume"},
		{http.MethodDelete, "/api/v1/pos/held-sales/h1", "cancel_held"},
		{http.MethodPost, "/api/v1/pos/sales/s1/refund", "refund"},
		{http.MethodPost, "/api/v1/pos/sales/s1/void", "void"},
	}
	for _, tc := range cases {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(tc.method, tc.path, nil))
		if got := recorder.Header().Get("X-Guard"); got != tc.guard {
			t.Errorf("%s %s ran guard %q, want %q", tc.method, tc.path, got, tc.guard)
		}
	}
}
