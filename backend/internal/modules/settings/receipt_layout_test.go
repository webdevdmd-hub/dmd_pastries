package settings

import (
	"encoding/json"
	"net/http"
	"testing"

	apperrors "pastries-pos/internal/shared/errors"
)

func TestReceiptLayoutConfigUpdateValueReplacesFooterConfig(t *testing.T) {
	oldConfig := json.RawMessage(`{"footerMessage":"Thank you for shopping with us"}`)
	newConfig := json.RawMessage(`{"footerMessage":"Visit us again"}`)

	got, ok, err := receiptLayoutConfigUpdateValue(&newConfig)
	if err != nil {
		t.Fatalf("receiptLayoutConfigUpdateValue() error = %v", err)
	}
	if !ok {
		t.Fatal("receiptLayoutConfigUpdateValue() ok = false, want true")
	}
	if got != string(newConfig) {
		t.Fatalf("layout_config update = %q, want exact replacement %q", got, string(newConfig))
	}
	if got == string(oldConfig)+string(newConfig) {
		t.Fatal("layout_config update appended the new footer config to the old config")
	}
	var parsed map[string]string
	if err := json.Unmarshal([]byte(got), &parsed); err != nil {
		t.Fatalf("layout_config update is not JSON: %v", err)
	}
	if parsed["footerMessage"] != "Visit us again" {
		t.Fatalf("footerMessage = %q, want replacement value", parsed["footerMessage"])
	}
}

func TestReceiptLayoutConfigUpdateValueSkipsNilConfig(t *testing.T) {
	got, ok, err := receiptLayoutConfigUpdateValue(nil)
	if err != nil {
		t.Fatalf("receiptLayoutConfigUpdateValue(nil) error = %v", err)
	}
	if ok {
		t.Fatalf("receiptLayoutConfigUpdateValue(nil) ok = true, want false with value %q", got)
	}
}

func TestValidateReceiptLayoutDefaultStateRequiresActiveStatus(t *testing.T) {
	tests := []struct {
		name        string
		isDefault   bool
		status      string
		wantMessage string
	}{
		{
			name:      "business-wide default can be active",
			isDefault: true,
			status:    "active",
		},
		{
			name:      "non-default can be inactive",
			isDefault: false,
			status:    "inactive",
		},
		{
			name:        "inactive default is rejected",
			isDefault:   true,
			status:      "inactive",
			wantMessage: "only active receipt layouts can be default",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateReceiptLayoutDefaultState(tt.isDefault, tt.status)
			if tt.wantMessage == "" {
				if err != nil {
					t.Fatalf("validateReceiptLayoutDefaultState() error = %v, want nil", err)
				}
				return
			}
			if err == nil {
				t.Fatal("validateReceiptLayoutDefaultState() error = nil, want validation error")
			}
			appErr, ok := err.(*apperrors.AppError)
			if !ok {
				t.Fatalf("validateReceiptLayoutDefaultState() error type = %T, want *AppError", err)
			}
			if appErr.StatusCode != http.StatusBadRequest {
				t.Fatalf("status code = %d, want %d", appErr.StatusCode, http.StatusBadRequest)
			}
			if appErr.Message != tt.wantMessage {
				t.Fatalf("message = %q, want %q", appErr.Message, tt.wantMessage)
			}
		})
	}
}

func TestValidateReceiptLayoutStatus(t *testing.T) {
	for _, status := range []string{"active", "inactive"} {
		if err := validateReceiptLayoutStatus(status); err != nil {
			t.Fatalf("validateReceiptLayoutStatus(%q) error = %v, want nil", status, err)
		}
	}

	err := validateReceiptLayoutStatus("archived")
	if err == nil {
		t.Fatal("validateReceiptLayoutStatus(archived) error = nil, want validation error")
	}
	appErr, ok := err.(*apperrors.AppError)
	if !ok {
		t.Fatalf("validateReceiptLayoutStatus() error type = %T, want *AppError", err)
	}
	if appErr.Message != "status must be active or inactive" {
		t.Fatalf("message = %q, want status validation message", appErr.Message)
	}
}
