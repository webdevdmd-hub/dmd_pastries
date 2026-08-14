package accounting

import (
	"net/http"
	"strings"
	"testing"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

func TestPostPurchaseReceiptJournalIsNoOpForBillOnlyPolicy(t *testing.T) {
	service := &Service{}
	journalID, err := service.PostPurchaseReceiptJournal(nil, &utils.AuthContext{}, "receipt-id")
	if err != nil {
		t.Fatalf("PostPurchaseReceiptJournal returned error: %v", err)
	}
	if journalID != "" {
		t.Fatalf("PostPurchaseReceiptJournal returned journal ID %q, want empty", journalID)
	}
}

func TestBackfillTargetsExcludePurchaseReceipts(t *testing.T) {
	for _, target := range defaultBackfillTargets() {
		if target == "purchase_receipts" {
			t.Fatal("purchase_receipts must not be a default accounting backfill target under bill-only purchasing accounting")
		}
	}
	if validBackfillTarget("purchase_receipts") {
		t.Fatal("purchase_receipts must not be accepted as an accounting backfill target")
	}
}

func TestBackfillReadinessUsesSelectedTargets(t *testing.T) {
	targets := backfillReadinessTargets(BackfillReadinessQuery{
		Targets: []string{"purchase_invoices", "payment_refunds"},
	})
	if len(targets) != 2 || targets[0] != "purchase_invoices" || targets[1] != "payment_refunds" {
		t.Fatalf("readiness targets = %#v, want selected purchase_invoices/payment_refunds", targets)
	}

	service := &Service{}
	req := normalizeBackfillRequest(BackfillJournalsRequest{Targets: targets, DryRun: true})
	// Backfills are branch-scoped: an unscoped run would post journals across
	// every branch of the business.
	if _, err := service.validateBackfillRequest(backfillAuthContext(), req); err != nil {
		t.Fatalf("selected readiness targets should pass dry-run validation: %v", err)
	}
}

func TestBackfillReadinessFallsBackToDefaultTargets(t *testing.T) {
	targets := backfillReadinessTargets(BackfillReadinessQuery{})
	if len(targets) != len(defaultBackfillTargets()) {
		t.Fatalf("readiness default target count = %d, want %d", len(targets), len(defaultBackfillTargets()))
	}
	for index, target := range defaultBackfillTargets() {
		if targets[index] != target {
			t.Fatalf("readiness default target %d = %q, want %q", index, targets[index], target)
		}
	}
}

func TestBackfillReadinessRejectsInvalidSelectedTarget(t *testing.T) {
	service := &Service{}
	targets := backfillReadinessTargets(BackfillReadinessQuery{
		Targets: []string{"purchase_receipts"},
	})
	req := normalizeBackfillRequest(BackfillJournalsRequest{Targets: targets, DryRun: true})
	_, err := service.validateBackfillRequest(backfillAuthContext(), req)
	if err == nil {
		t.Fatal("purchase_receipts should fail readiness validation")
	}
	appErr, ok := err.(*apperrors.AppError)
	if !ok || appErr.Message != "invalid backfill target" {
		t.Fatalf("readiness validation error = %#v, want invalid backfill target", err)
	}
}

func TestStockMovementBackfillExcludesPurchaseIn(t *testing.T) {
	_, _, _, _, _, _, _, _, _, extraCondition := backfillTargetQuery("stock_movements")
	if extraCondition == "" {
		t.Fatal("stock_movements backfill should have a movement_type filter")
	}
	if containsSQLToken(extraCondition, "purchase_in") {
		t.Fatalf("stock_movements backfill condition %q must not include purchase_in", extraCondition)
	}
}

func TestPurchaseInvoiceBackfillStillEnabled(t *testing.T) {
	table, _, _, _, _, _, statusColumn, statusValue, missingCondition, _ := backfillTargetQuery("purchase_invoices")
	if table != "purchase_invoices" {
		t.Fatalf("purchase invoice backfill table = %q, want purchase_invoices", table)
	}
	if statusColumn != "status" || statusValue != "posted" {
		t.Fatalf("purchase invoice backfill status = %q/%q, want status/posted", statusColumn, statusValue)
	}
	if missingCondition != "journal_entry_id IS NULL" {
		t.Fatalf("purchase invoice missing condition = %q, want journal_entry_id IS NULL", missingCondition)
	}
}

func TestPaymentRefundBackfillTargetsPOSRefundsOnly(t *testing.T) {
	table, _, _, _, _, dateColumn, statusColumn, statusValue, missingCondition, extraCondition := backfillTargetQuery("payment_refunds")
	if table != "payment_refunds" {
		t.Fatalf("payment refund backfill table = %q, want payment_refunds", table)
	}
	if dateColumn != "refunded_at" || statusColumn != "refund_status" || statusValue != "completed" {
		t.Fatalf("payment refund backfill status/date = %q/%q/%q", dateColumn, statusColumn, statusValue)
	}
	if !strings.Contains(missingCondition, "journal_entry_id IS NULL") || !strings.Contains(missingCondition, "pos_sale_refund") {
		t.Fatalf("payment refund missing condition should find unlinked pos_sale_refund journals, got %q", missingCondition)
	}
	if !strings.Contains(extraCondition, "'pos_sale'") || !strings.Contains(extraCondition, "'payment_adjustment'") || strings.Contains(extraCondition, "'sales_return'") {
		t.Fatalf("payment refund extra condition should include only POS/payment adjustment refunds, got %q", extraCondition)
	}
	if !validBackfillTarget("payment_refunds") {
		t.Fatal("payment_refunds must be an accepted accounting backfill target")
	}
}

func TestPurchaseReturnBackfillTargetsPostedMissingJournals(t *testing.T) {
	table, _, _, _, _, dateColumn, statusColumn, statusValue, missingCondition, extraCondition := backfillTargetQuery("purchase_returns")
	if table != "purchase_returns" {
		t.Fatalf("purchase return backfill table = %q, want purchase_returns", table)
	}
	if dateColumn != "return_date" || statusColumn != "status" || statusValue != "posted" {
		t.Fatalf("purchase return backfill status/date = %q/%q/%q", dateColumn, statusColumn, statusValue)
	}
	if missingCondition != "journal_entry_id IS NULL" {
		t.Fatalf("purchase return missing condition = %q, want journal_entry_id IS NULL", missingCondition)
	}
	if extraCondition != "" {
		t.Fatalf("purchase return extra condition = %q, want empty", extraCondition)
	}
	if !validBackfillTarget("purchase_returns") {
		t.Fatal("purchase_returns must be an accepted accounting backfill target")
	}
}

func TestValidatePurchaseReturnPostedJournalAcceptsMatchingPostedJournal(t *testing.T) {
	purchaseReturnID := "purchase-return-id"
	entry := &JournalEntry{
		ID:         "journal-id",
		SourceType: "purchase_return",
		SourceID:   &purchaseReturnID,
		Status:     "posted",
	}

	if err := validatePurchaseReturnPostedJournal(entry, purchaseReturnID); err != nil {
		t.Fatalf("expected matching posted purchase return journal to be accepted: %v", err)
	}
}

func TestValidatePurchaseReturnPostedJournalRejectsInvalidLinkedJournal(t *testing.T) {
	purchaseReturnID := "purchase-return-id"
	otherSourceID := "other-id"
	cases := []struct {
		name  string
		entry *JournalEntry
	}{
		{
			name:  "missing entry",
			entry: nil,
		},
		{
			name: "wrong source type",
			entry: &JournalEntry{
				ID:         "journal-id",
				SourceType: "purchase_invoice",
				SourceID:   &purchaseReturnID,
				Status:     "posted",
			},
		},
		{
			name: "wrong source id",
			entry: &JournalEntry{
				ID:         "journal-id",
				SourceType: "purchase_return",
				SourceID:   &otherSourceID,
				Status:     "posted",
			},
		},
		{
			name: "unposted journal",
			entry: &JournalEntry{
				ID:         "journal-id",
				SourceType: "purchase_return",
				SourceID:   &purchaseReturnID,
				Status:     "draft",
			},
		},
		{
			name: "reversed journal",
			entry: &JournalEntry{
				ID:         "journal-id",
				SourceType: "purchase_return",
				SourceID:   &purchaseReturnID,
				Status:     "reversed",
			},
		},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			err := validatePurchaseReturnPostedJournal(tt.entry, purchaseReturnID)
			if err == nil {
				t.Fatal("expected invalid linked journal to be rejected")
			}
			appErr, ok := err.(*apperrors.AppError)
			if !ok {
				t.Fatalf("expected AppError, got %T", err)
			}
			if appErr.StatusCode != http.StatusConflict {
				t.Fatalf("status = %d, want %d", appErr.StatusCode, http.StatusConflict)
			}
		})
	}
}

func TestValidateBakeryOrderRevenuePostedJournalAcceptsMatchingPostedJournal(t *testing.T) {
	orderID := "bakery-order-id"
	entry := &JournalEntry{
		ID:         "journal-id",
		SourceType: "bakery_order_revenue",
		SourceID:   &orderID,
		Status:     "posted",
	}

	if err := validateBakeryOrderRevenuePostedJournal(entry, orderID); err != nil {
		t.Fatalf("expected matching posted bakery order revenue journal to be accepted: %v", err)
	}
}

func TestValidateBakeryOrderRevenuePostedJournalRejectsInvalidLinkedJournal(t *testing.T) {
	orderID := "bakery-order-id"
	otherSourceID := "other-id"
	cases := []struct {
		name  string
		entry *JournalEntry
	}{
		{
			name:  "missing entry",
			entry: nil,
		},
		{
			name: "wrong source type",
			entry: &JournalEntry{
				ID:         "journal-id",
				SourceType: "bakery_order_payment",
				SourceID:   &orderID,
				Status:     "posted",
			},
		},
		{
			name: "wrong source id",
			entry: &JournalEntry{
				ID:         "journal-id",
				SourceType: "bakery_order_revenue",
				SourceID:   &otherSourceID,
				Status:     "posted",
			},
		},
		{
			name: "unposted journal",
			entry: &JournalEntry{
				ID:         "journal-id",
				SourceType: "bakery_order_revenue",
				SourceID:   &orderID,
				Status:     "draft",
			},
		},
		{
			name: "reversed journal",
			entry: &JournalEntry{
				ID:         "journal-id",
				SourceType: "bakery_order_revenue",
				SourceID:   &orderID,
				Status:     "reversed",
			},
		},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			err := validateBakeryOrderRevenuePostedJournal(tt.entry, orderID)
			if err == nil {
				t.Fatal("expected invalid linked journal to be rejected")
			}
			appErr, ok := err.(*apperrors.AppError)
			if !ok {
				t.Fatalf("expected AppError, got %T", err)
			}
			if appErr.StatusCode != http.StatusConflict {
				t.Fatalf("status = %d, want %d", appErr.StatusCode, http.StatusConflict)
			}
		})
	}
}

func TestJournalEntryFiltersAcceptAllOrigin(t *testing.T) {
	if err := validateJournalEntryFilters(JournalEntryListQuery{JournalOrigin: "all"}); err != nil {
		t.Fatalf("journal_origin=all should be accepted: %v", err)
	}
}

func TestJournalEntrySystemSourceTypeFilterIncludesPurchaseReturn(t *testing.T) {
	conditions := journalEntryFilterConditions(JournalEntryListQuery{
		JournalOrigin: "system",
		Search:        "VC-000001",
		SourceType:    "purchase_return",
	})

	if !hasJournalEntryFilterCondition(conditions, "COALESCE(source_type, '') <> ?", "manual") {
		t.Fatalf("expected system-origin condition, got %#v", conditions)
	}
	if !hasJournalEntryFilterCondition(conditions, "source_type = ?", "purchase_return") {
		t.Fatalf("expected purchase_return source_type condition, got %#v", conditions)
	}
	if !hasJournalEntryFilterCondition(conditions, "LOWER(entry_number) LIKE ? OR LOWER(reference_number) LIKE ? OR LOWER(narration) LIKE ? OR LOWER(id::text) LIKE ? OR LOWER(COALESCE(source_id::text, '')) LIKE ?", "%vc-000001%") {
		t.Fatalf("expected reference-number search condition for VC-000001, got %#v", conditions)
	}
}

func containsSQLToken(value, token string) bool {
	for i := 0; i+len(token) <= len(value); i++ {
		if value[i:i+len(token)] == token {
			return true
		}
	}
	return false
}

func hasJournalEntryFilterCondition(conditions []journalEntryFilterCondition, clause string, arg interface{}) bool {
	for _, condition := range conditions {
		if condition.Clause != clause || len(condition.Args) == 0 {
			continue
		}
		if condition.Args[0] == arg {
			return true
		}
	}
	return false
}

// backfillAuthContext is a caller scoped to a single branch, which every
// backfill now requires.
func backfillAuthContext() *utils.AuthContext {
	branchID := "11111111-1111-4111-8111-111111111111"
	return &utils.AuthContext{
		CurrentBranchID:  &branchID,
		AllowedBranchIDs: []string{branchID},
	}
}
