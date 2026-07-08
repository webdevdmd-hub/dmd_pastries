package dashboard

import (
	"testing"
	"time"

	"pastries-pos/internal/modules/audit"
)

func TestActivityFeedItemUsesBusinessReferenceNotEntityID(t *testing.T) {
	response := audit.ActivityLogResponse{
		EventType:     "purchase_order.created",
		EntityType:    "purchase_order",
		EntityID:      "7d38a397-c8e8-4bc3-b0d3-b3d49a6ca99c",
		ModuleLabel:   "Purchasing",
		ActionLabel:   "Created Purchase Order",
		RecordLabel:   "PO-000045",
		Summary:       "Created purchase order.",
		ActorUserName: "Aisha",
		CreatedAt:     time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC),
	}

	item := activityFeedItemFromAuditResponse(response, "PO-000045")

	if item.ReferenceNumber != "PO-000045" {
		t.Fatalf("ReferenceNumber = %q, want PO-000045", item.ReferenceNumber)
	}
	if item.ReferenceNumber == response.EntityID {
		t.Fatal("ReferenceNumber must not expose the audit entity UUID")
	}
	if item.RecordLabel != "PO-000045" {
		t.Fatalf("RecordLabel = %q, want PO-000045", item.RecordLabel)
	}
}

func TestActivityFeedItemLeavesReferenceEmptyWhenNoBusinessReferenceExists(t *testing.T) {
	response := audit.ActivityLogResponse{
		EventType:     "dashboard.admin_viewed",
		EntityType:    "dashboard",
		EntityID:      "admin",
		ModuleLabel:   "Dashboard",
		ActionLabel:   "Viewed Dashboard",
		RecordLabel:   "Dashboard viewed.",
		Summary:       "Dashboard viewed.",
		ActorUserName: "System",
		CreatedAt:     time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC),
	}

	item := activityFeedItemFromAuditResponse(response, "")

	if item.ReferenceNumber != "" {
		t.Fatalf("ReferenceNumber = %q, want empty string", item.ReferenceNumber)
	}
}

func TestActivityFeedItemSuppressesUUIDReference(t *testing.T) {
	response := audit.ActivityLogResponse{
		EventType:     "purchase_invoice.created",
		EntityType:    "purchase_invoice",
		EntityID:      "7d38a397-c8e8-4bc3-b0d3-b3d49a6ca99c",
		ModuleLabel:   "Purchasing",
		ActionLabel:   "Created Supplier Bill",
		RecordLabel:   "Supplier bill created.",
		Summary:       "Supplier bill created.",
		ActorUserName: "Aisha",
		CreatedAt:     time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC),
	}

	item := activityFeedItemFromAuditResponse(response, "7d38a397-c8e8-4bc3-b0d3-b3d49a6ca99c")

	if item.ReferenceNumber != "" {
		t.Fatalf("ReferenceNumber = %q, want empty string", item.ReferenceNumber)
	}
}

func TestActivityFeedItemBusinessDocumentReferences(t *testing.T) {
	tests := []struct {
		name      string
		eventType string
		entity    string
		reference string
	}{
		{name: "purchase order", eventType: "purchase_order.created", entity: "purchase_order", reference: "PO-000001"},
		{name: "vendor credit", eventType: "purchase_return.posted", entity: "purchase_return", reference: "VC-000001"},
		{name: "manufacturing batch", eventType: "production_batch.completed", entity: "production_batch", reference: "MFG-000001"},
		{name: "bakery order", eventType: "bakery_order.created", entity: "bakery_order", reference: "ORD-000001"},
		{name: "goods receipt", eventType: "purchase_receipt.posted", entity: "purchase_receipt", reference: "GRN-000001"},
		{name: "purchase bill", eventType: "purchase_invoice.posted", entity: "purchase_invoice", reference: "BILL-000001"},
		{name: "pos sale", eventType: "sale.created", entity: "sale", reference: "SALE-000001"},
		{name: "pos refund", eventType: "sale.refunded", entity: "sale_refund", reference: "RF-000001"},
		{name: "journal entry", eventType: "accounting.journal_entry_posted", entity: "journal_entry", reference: "JE-000001"},
		{name: "account transfer", eventType: "accounting.account_transfer_created", entity: "account_transfer", reference: "TRF-000001"},
		{name: "stock movement", eventType: "stock_movement.manual_created", entity: "stock_movement", reference: "SM-000001"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			response := audit.ActivityLogResponse{
				EventType:     tt.eventType,
				EntityType:    tt.entity,
				EntityID:      "7d38a397-c8e8-4bc3-b0d3-b3d49a6ca99c",
				ModuleLabel:   "Module",
				ActionLabel:   "Recorded Activity",
				RecordLabel:   "Activity recorded.",
				Summary:       "Activity recorded.",
				ActorUserName: "Aisha",
				CreatedAt:     time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC),
			}

			item := activityFeedItemFromAuditResponse(response, tt.reference)

			if item.ReferenceNumber != tt.reference {
				t.Fatalf("ReferenceNumber = %q, want %q", item.ReferenceNumber, tt.reference)
			}
			if item.ReferenceNumber == response.EntityID {
				t.Fatal("ReferenceNumber must not expose the audit entity UUID")
			}
		})
	}
}
