package audit

import (
	"encoding/json"
	"testing"
)

func TestBusinessRecordReferenceUsesMetadataBusinessReferences(t *testing.T) {
	tests := []struct {
		name       string
		entityType string
		key        string
		value      string
	}{
		{name: "bakery order", entityType: "bakery_order", key: "order_number", value: "ORD-000002"},
		{name: "vendor credit", entityType: "purchase_return", key: "return_number", value: "VC-000002"},
		{name: "purchase order", entityType: "purchase_order", key: "purchase_order_number", value: "PO-000045"},
		{name: "goods receipt", entityType: "purchase_receipt", key: "receipt_number", value: "GRN-000018"},
		{name: "stock movement", entityType: "stock_movement", key: "reference_number", value: "SM-000010"},
		{name: "production batch", entityType: "production_batch", key: "production_batch_number", value: "PB-000007"},
		{name: "pos sale", entityType: "sale", key: "sale_number", value: "SALE-000021"},
		{name: "pos refund", entityType: "payment_refund", key: "refund_number", value: "RF-000003"},
		{name: "sales return", entityType: "sales_return", key: "sales_return_number", value: "CN-000004"},
		{name: "journal entry", entityType: "journal_entry", key: "entry_number", value: "JE-000010"},
	}

	repo := &Repository{}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			metadata, err := json.Marshal(map[string]interface{}{tt.key: tt.value})
			if err != nil {
				t.Fatalf("marshal metadata: %v", err)
			}
			log := AuditLog{
				BusinessID:  "business-id",
				EntityType:  tt.entityType,
				EntityID:    "7d38a397-c8e8-4bc3-b0d3-b3d49a6ca99c",
				ReferenceID: "7d38a397-c8e8-4bc3-b0d3-b3d49a6ca99c",
				Metadata:    string(metadata),
				Summary:     "Created record.",
			}
			if got := repo.BusinessRecordReference("business-id", log); got != tt.value {
				t.Fatalf("BusinessRecordReference() = %q, want %q", got, tt.value)
			}
		})
	}
}

func TestBusinessRecordReferenceDoesNotFallbackToUUIDOrSummary(t *testing.T) {
	log := AuditLog{
		BusinessID:  "business-id",
		EntityType:  "purchase_order",
		EntityID:    "7d38a397-c8e8-4bc3-b0d3-b3d49a6ca99c",
		ReferenceID: "7d38a397-c8e8-4bc3-b0d3-b3d49a6ca99c",
		Summary:     "Created purchase order.",
	}

	if got := (&Repository{}).BusinessRecordReference("business-id", log); got != "" {
		t.Fatalf("BusinessRecordReference() = %q, want empty string", got)
	}
}
