package suppliers

import (
	"strings"
	"testing"
	"time"
)

func TestSupplierStatsSQLUsesBranchSupplierAndStatusFilters(t *testing.T) {
	query := supplierStatsSQL()

	requiredFragments := []string{
		"po.business_id = ? AND po.branch_id = ? AND po.supplier_id = ?",
		"po.status <> 'cancelled' AND po.deleted_at IS NULL",
		"pi.business_id = ? AND pi.branch_id = ? AND pi.supplier_id = ?",
		"pi.status = 'posted' AND pi.deleted_at IS NULL",
		"sp.status = 'completed' AND sp.deleted_at IS NULL",
		"pip.payment_status = 'completed' AND pip.supplier_payment_id IS NULL",
		"pr.status = 'posted' AND pr.deleted_at IS NULL",
		"purchase_receipts pr",
		"pr.status = 'posted' AND pr.deleted_at IS NULL",
		"GREATEST(",
	}

	for _, fragment := range requiredFragments {
		if !strings.Contains(query, fragment) {
			t.Fatalf("supplierStatsSQL() missing %q in query:\n%s", fragment, query)
		}
	}
}

func TestSupplierStatsArgsRepeatScopeForEachAggregate(t *testing.T) {
	args := supplierStatsArgs("business-1", "branch-1", "supplier-1")
	// Derived from the query rather than hardcoded: a new correlated
	// subquery must come with its own scope triple, and a stale constant
	// here would let the two drift apart silently.
	placeholders := strings.Count(supplierStatsSQL(), "?")
	if len(args) != placeholders {
		t.Fatalf("len(args) = %d, want %d (one per ? in supplierStatsSQL)", len(args), placeholders)
	}
	if args[0] != "supplier-1" {
		t.Fatalf("args[0] = %v, want supplier id projection", args[0])
	}
	for index := 1; index < len(args); index += 3 {
		if args[index] != "business-1" || args[index+1] != "branch-1" || args[index+2] != "supplier-1" {
			t.Fatalf("args[%d:%d] = %#v, want business/branch/supplier scope", index, index+3, args[index:index+3])
		}
	}
}

func TestSupplierStatsResponseCalculatesPaidOutstandingAndLastPurchaseDate(t *testing.T) {
	lastPurchase := time.Date(2026, 7, 9, 12, 30, 0, 0, time.UTC)
	response := supplierStatsResponse(supplierStatsRow{
		SupplierID:           "supplier-1",
		TotalPurchaseOrders:  3,
		TotalBills:           2,
		TotalPurchaseAmount:  1200.125,
		SupplierPaymentsPaid: 350.444,
		InvoicePaymentsPaid:  100.111,
		VendorCredits:        25.222,
		LastPurchaseDate:     &lastPurchase,
	})

	if response.SupplierID != "supplier-1" {
		t.Fatalf("SupplierID = %q, want supplier-1", response.SupplierID)
	}
	if response.TotalPurchaseOrders != 3 {
		t.Fatalf("TotalPurchaseOrders = %d, want 3", response.TotalPurchaseOrders)
	}
	if response.TotalBills != 2 {
		t.Fatalf("TotalBills = %d, want 2", response.TotalBills)
	}
	if response.TotalPurchaseAmount != 1200.13 {
		t.Fatalf("TotalPurchaseAmount = %.2f, want 1200.13", response.TotalPurchaseAmount)
	}
	if response.TotalPaidAmount != 450.56 {
		t.Fatalf("TotalPaidAmount = %.2f, want 450.56", response.TotalPaidAmount)
	}
	if response.OutstandingBalance != 724.34 {
		t.Fatalf("OutstandingBalance = %.2f, want 724.34", response.OutstandingBalance)
	}
	if response.OutstandingPayables != response.OutstandingBalance {
		t.Fatalf("OutstandingPayables = %.2f, want same as outstanding balance", response.OutstandingPayables)
	}
	if response.LastPurchaseDate == nil || *response.LastPurchaseDate != "2026-07-09" {
		t.Fatalf("LastPurchaseDate = %v, want 2026-07-09", response.LastPurchaseDate)
	}
}

func TestSupplierStatsResponseAllowsSupplierCreditBalance(t *testing.T) {
	response := supplierStatsResponse(supplierStatsRow{
		SupplierID:           "supplier-1",
		TotalPurchaseAmount:  100,
		SupplierPaymentsPaid: 125,
		VendorCredits:        10,
	})

	if response.OutstandingBalance != -35 {
		t.Fatalf("OutstandingBalance = %.2f, want -35.00 supplier credit", response.OutstandingBalance)
	}
}
