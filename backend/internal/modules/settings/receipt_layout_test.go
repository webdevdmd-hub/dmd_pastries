package settings

import (
	"encoding/json"
	"testing"
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
