package dashboard

import (
	"os"
	"strings"
	"testing"

	"pastries-pos/internal/shared/utils"
)

// Regression: ISSUE-068 — /dashboard/alerts needed only dashboard.view, so a
// till-only role saw "Order ORD-000006 has AED 357 outstanding" on the Cashier
// dashboard without being allowed to open Orders.
// Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-18.md

func everyAlert() *AlertsResponse {
	return &AlertsResponse{
		LowStockAlerts:           []LowStockAlert{{ItemName: "Flour"}},
		ExpiryAlerts:             []ExpiryAlert{{}},
		PendingOrderAlerts:       []PendingOrderAlert{{}},
		OutstandingPaymentAlerts: []OutstandingPaymentAlert{{}},
		ProductionDelayAlerts:    []ProductionDelayAlert{{}},
	}
}

func TestAlertsShowOnlyTheModulesTheRoleMayView(t *testing.T) {
	tillOnly := &utils.AuthContext{Permissions: []string{"dashboard.view", "pos.view", "pos.sell"}}
	got := alertsVisibleTo(tillOnly, everyAlert())
	if len(got.PendingOrderAlerts)+len(got.OutstandingPaymentAlerts) != 0 {
		t.Error("order alerts shown without orders.view")
	}
	if len(got.LowStockAlerts)+len(got.ExpiryAlerts) != 0 {
		t.Error("stock alerts shown without inventory.view")
	}
	if len(got.ProductionDelayAlerts) != 0 {
		t.Error("production alerts shown without manufacturing.view")
	}
	if got.OutstandingPaymentAlerts == nil || got.LowStockAlerts == nil {
		t.Error("an emptied group must stay an empty list, not null")
	}

	cashier := &utils.AuthContext{Permissions: []string{"dashboard.view", "orders.view"}}
	got = alertsVisibleTo(cashier, everyAlert())
	if len(got.PendingOrderAlerts) != 1 || len(got.OutstandingPaymentAlerts) != 1 {
		t.Error("order alerts hidden from a role with orders.view")
	}
	if len(got.LowStockAlerts) != 0 {
		t.Error("stock alerts shown to an orders-only role")
	}

	stockClerk := &utils.AuthContext{Permissions: []string{"inventory.low_stock.view"}}
	got = alertsVisibleTo(stockClerk, everyAlert())
	if len(got.LowStockAlerts) != 1 || len(got.ExpiryAlerts) != 0 {
		t.Error("inventory.low_stock.view should show low stock and nothing else")
	}
}

func TestAlertsEndpointFiltersBeforeAnswering(t *testing.T) {
	raw, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	src := strings.ReplaceAll(string(raw), "\r\n", "\n")
	start := strings.Index(src, "func (s *Service) Alerts(")
	if start < 0 {
		t.Fatal("Alerts not found")
	}
	body := src[start:]
	if end := strings.Index(body[1:], "\nfunc "); end >= 0 {
		body = body[:end+1]
	}
	if !strings.Contains(body, "return alertsVisibleTo(currentUser, result), nil") {
		t.Fatal("Alerts returns the repository result without filtering it by permission")
	}
}
