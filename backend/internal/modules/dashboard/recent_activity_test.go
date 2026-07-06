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
