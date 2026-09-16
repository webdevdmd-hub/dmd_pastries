package purchasing

import (
	"regexp"
	"strings"
	"testing"
)

// Regression: ISSUE-032 — purchasing documents credited every entry to "User".
//
// Bills, orders, receipts and vendor credits all store who entered them, and
// every one of those screens shows it. None of the responses carried a NAME, so
// the frontend fell back to its placeholder: on production on 2026-09-16, bill
// QAF-INV-1001 and vendor credit VC-000001 both read "Created by: User", while
// the payment beside them read "Paid by: Jo" because supplier payments join the
// users table.
//
// In a bakery where the owner, a manager and a counter hand all enter bills,
// "who typed this" is the first question asked of a figure that looks wrong,
// and the answer was on screen and useless.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
func TestPurchasingDocumentsNameWhoEnteredThem(t *testing.T) {
	service := purchasingSource(t, "service.go")

	for _, tc := range []struct {
		builder string
		field   string
		id      string
	}{
		{"func (s *Service) orderResponse(", "CreatedByUserName", "order.CreatedByUserID"},
		{"func (s *Service) invoiceResponse(", "CreatedByUserName", "invoice.CreatedByUserID"},
		{"func (s *Service) receiptResponse(", "ReceivedByUserName", "receipt.ReceivedByUserID"},
		{"func (s *Service) purchaseReturnResponse(", "CreatedByUserName", "purchaseReturn.CreatedByUserID"},
	} {
		body := functionBody(service, tc.builder)
		if body == "" {
			t.Errorf("%s not found", tc.builder)
			continue
		}
		resolved := regexp.MustCompile(tc.field + `\s*[:=]\s*s\.repo\.UserName\(businessID, ` + regexp.QuoteMeta(tc.id) + `\)`)
		if !resolved.MatchString(body) {
			t.Errorf("%s does not resolve %s from %s, so the screen falls back to the placeholder "+
				"name and every document looks as though nobody entered it", tc.builder, tc.field, tc.id)
		}
	}

	// The lookup must be scoped to the business: a user id from another tenant
	// must never resolve to that tenant's name.
	repository := purchasingSource(t, "repository.go")
	lookup := functionBody(repository, "func (r *Repository) UserName(")
	if lookup == "" {
		t.Fatal("Repository.UserName not found")
	}
	for _, clause := range []string{"business_id = ?", "full_name"} {
		if !strings.Contains(lookup, clause) {
			t.Errorf("UserName must query %q", clause)
		}
	}
}

// The DTOs must carry the field, or the name never reaches the browser.
func TestPurchasingResponsesCarryTheAuthorField(t *testing.T) {
	dto := purchasingSource(t, "dto.go")
	for _, tc := range []struct{ structName, json string }{
		{"PurchaseOrderResponse", "created_by_user_name"},
		{"PurchaseInvoiceResponse", "created_by_user_name"},
		{"PurchaseReceiptResponse", "received_by_user_name"},
		{"PurchaseReturnResponse", "created_by_user_name"},
	} {
		start := strings.Index(dto, "type "+tc.structName+" struct {")
		if start == -1 {
			t.Errorf("%s not found", tc.structName)
			continue
		}
		block := dto[start : start+strings.Index(dto[start:], "\n}\n")]
		if !strings.Contains(block, tc.json) {
			t.Errorf("%s has no %s field; the frontend reads that key and shows \"User\" without it",
				tc.structName, tc.json)
		}
	}
}
