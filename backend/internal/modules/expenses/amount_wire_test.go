package expenses

import (
	"encoding/json"
	"testing"

	"pastries-pos/internal/shared/money"
)

// expenses is the first module converted to money.Amount (Phase 6 / W4
// step 3). The contract for every module that follows: the response payload
// must be byte-identical to what float64 produced, because the frontend
// reads money with a helper that falls back to 0 for anything that is not a
// JSON number.
func TestExpenseResponseAmountStaysABareJSONNumber(t *testing.T) {
	for _, value := range []float64{0, 12.5, 1234.56, 100, -45.75} {
		encoded, err := json.Marshal(ExpenseResponse{Amount: money.FromFloat(value)})
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		decoded := map[string]interface{}{}
		if err := json.Unmarshal(encoded, &decoded); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		got, ok := decoded["amount"].(float64)
		if !ok {
			t.Fatalf("amount decoded as %T, must be a JSON number", decoded["amount"])
		}
		if got != value {
			t.Fatalf("amount round-tripped to %v, want %v", got, value)
		}
	}
}

// A request may send the amount as a number or as a decimal string; the
// string form is exact, which is the point of accepting it.
func TestCreateExpenseRequestAcceptsNumbersAndStrings(t *testing.T) {
	for _, payload := range []string{`{"amount":1234.56}`, `{"amount":"1234.56"}`} {
		var req CreateExpenseRequest
		if err := json.Unmarshal([]byte(payload), &req); err != nil {
			t.Fatalf("unmarshal %s: %v", payload, err)
		}
		expected, _ := money.FromString("1234.56")
		if !req.Amount.Equal(expected) {
			t.Fatalf("%s parsed as %s", payload, req.Amount)
		}
	}
}

// An omitted amount decodes to zero, which the service rejects with "amount
// must be greater than 0". The binding:"required" tag was dropped in the
// conversion because a struct type does not report zero the way a float64
// does; the service check is the one that matters and it already existed.
func TestOmittedAmountDecodesToZeroForTheServiceToReject(t *testing.T) {
	var req CreateExpenseRequest
	if err := json.Unmarshal([]byte(`{"expense_date":"2026-01-01"}`), &req); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !req.Amount.IsZero() {
		t.Fatalf("missing amount decoded as %s, want zero", req.Amount)
	}
	if req.Amount.IsPositive() {
		t.Fatal("a missing amount must not pass the positive check")
	}
}
