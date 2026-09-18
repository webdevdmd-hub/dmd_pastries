package pos

import (
	"errors"
	"net/http"
	"os"
	"strings"
	"testing"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

// Regression: ISSUE-066 — pos.discount.apply was offered on the Roles screen
// and seeded into Cashier and Manager, but nothing checked it. On production
// on 2026-09-18 a role holding pos.view, pos.sell and pos.checkout only took
// 10% off SALE-20260918-000001 and the server accepted it.
// Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-18.md

func TestADiscountNeedsTheDiscountPermission(t *testing.T) {
	seller := &utils.AuthContext{Permissions: []string{"pos.view", "pos.sell", "pos.checkout"}}
	discounter := &utils.AuthContext{Permissions: []string{"pos.sell", "pos.discount.apply"}}

	err := requireDiscountPermission(seller, 38.57)
	var appErr *apperrors.AppError
	if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusForbidden {
		t.Fatalf("a discount without pos.discount.apply returned %v, want 403", err)
	}
	if err := requireDiscountPermission(discounter, 38.57); err != nil {
		t.Fatalf("a discount with pos.discount.apply was refused: %v", err)
	}
	if err := requireDiscountPermission(seller, 0); err != nil {
		t.Fatalf("a sale with no discount was refused: %v", err)
	}
}

// The check is only a check if Checkout makes it, on the calculated amount
// (which covers line and sale discounts alike), before anything is written.
func TestCheckoutChecksTheDiscountPermissionBeforeWriting(t *testing.T) {
	raw, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	src := strings.ReplaceAll(string(raw), "\r\n", "\n")
	start := strings.Index(src, "func (s *Service) Checkout(")
	if start < 0 {
		t.Fatal("Checkout not found")
	}
	body := src[start:]
	if end := strings.Index(body[1:], "\nfunc "); end >= 0 {
		body = body[:end+1]
	}

	check := strings.Index(body, "requireDiscountPermission(currentUser, calculation.DiscountAmount)")
	if check < 0 {
		t.Fatal("Checkout does not call requireDiscountPermission on the calculated discount")
	}
	if write := strings.Index(body, "s.repo.CreateSale("); write >= 0 && write < check {
		t.Fatal("Checkout writes the sale before checking the discount permission")
	}
}
