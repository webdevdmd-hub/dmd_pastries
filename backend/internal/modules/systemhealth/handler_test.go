package systemhealth

import (
	"reflect"
	"testing"
	"time"
)

func TestProbeMetadataForRouteClassifiesRouteKinds(t *testing.T) {
	now := time.Date(2026, 7, 8, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		name     string
		method   string
		path     string
		category string
		mode     string
	}{
		{
			name:     "public health",
			method:   "GET",
			path:     "/health",
			category: probeCategoryPublic,
			mode:     probeModeSafeProbe,
		},
		{
			name:     "static authenticated GET",
			method:   "GET",
			path:     "/api/v1/products",
			category: probeCategoryAuthenticated,
			mode:     probeModeSafeProbe,
		},
		{
			name:     "dynamic route unsupported",
			method:   "GET",
			path:     "/api/v1/products/:id",
			category: probeCategoryUnsupported,
			mode:     probeModeLiveOnly,
		},
		{
			name:     "non GET unsupported",
			method:   "POST",
			path:     "/api/v1/products",
			category: probeCategoryUnsupported,
			mode:     probeModeLiveOnly,
		},
		{
			name:     "export route unsupported",
			method:   "GET",
			path:     "/api/v1/reports/export/csv",
			category: probeCategoryUnsupported,
			mode:     probeModeLiveOnly,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := probeMetadataForRoute(tt.method, tt.path, now)
			if got.category != tt.category {
				t.Fatalf("category = %q, want %q", got.category, tt.category)
			}
			if got.mode != tt.mode {
				t.Fatalf("mode = %q, want %q", got.mode, tt.mode)
			}
		})
	}
}

func TestProbeMetadataForRouteAddsSafeParameterizedProbePaths(t *testing.T) {
	now := time.Date(2026, 7, 8, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		path      string
		probePath string
	}{
		{
			path:      "/api/v1/accounting/reports/general-ledger",
			probePath: "/api/v1/accounting/reports/general-ledger?date_from=2026-07-08&date_to=2026-07-08&page=1&limit=1",
		},
		{
			path:      "/api/v1/accounting/reports/profit-loss",
			probePath: "/api/v1/accounting/reports/profit-loss?date_from=2026-07-08&date_to=2026-07-08&page=1&limit=1",
		},
		{
			path:      "/api/v1/accounting/reports/balance-sheet",
			probePath: "/api/v1/accounting/reports/balance-sheet?as_of_date=2026-07-08&page=1&limit=1",
		},
		{
			path:      "/api/v1/accounting/reconciliation/inventory/details",
			probePath: "/api/v1/accounting/reconciliation/inventory/details?as_of_date=2026-07-08&page=1&limit=1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := probeMetadataForRoute("GET", tt.path, now)
			if got.category != probeCategoryParameterRequired {
				t.Fatalf("category = %q, want %q", got.category, probeCategoryParameterRequired)
			}
			if got.mode != probeModeSafeProbe {
				t.Fatalf("mode = %q, want %q", got.mode, probeModeSafeProbe)
			}
			if got.path != tt.probePath {
				t.Fatalf("path = %q, want %q", got.path, tt.probePath)
			}
		})
	}
}

func TestProbeMetadataForRouteAddsExpectedValidationMessages(t *testing.T) {
	now := time.Date(2026, 7, 8, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		path     string
		messages []string
	}{
		{
			path:     "/api/v1/customers/lookup",
			messages: []string{"phone, email, or search is required"},
		},
		{
			path:     "/api/v1/products/lookup",
			messages: []string{"barcode, sku, or product_code is required"},
		},
		{
			path:     "/api/v1/pos/products/lookup",
			messages: []string{"barcode, sku, or product_code is required"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := probeMetadataForRoute("GET", tt.path, now)
			if got.category != probeCategoryParameterRequired {
				t.Fatalf("category = %q, want %q", got.category, probeCategoryParameterRequired)
			}
			if got.path != "" {
				t.Fatalf("probe path = %q, want empty", got.path)
			}
			if !reflect.DeepEqual(got.expectedValidationMessages, tt.messages) {
				t.Fatalf("messages = %#v, want %#v", got.expectedValidationMessages, tt.messages)
			}
		})
	}
}
