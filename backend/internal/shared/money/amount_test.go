package money

import (
	"encoding/json"
	"math"
	"testing"
)

// The wire-format contract. Adopting Amount in a DTO must not change the
// bytes a client receives: the frontend has sixteen copies of a numberValue()
// helper that falls back to 0 for anything that is not a JSON number, so a
// quoted amount would zero every money field on every screen without raising
// an error anywhere.
func TestAmountMarshalsIdenticallyToFloat64(t *testing.T) {
	for _, value := range []float64{
		0, 1, -1, 0.5, 100, 100.5, 1234.56, -1234.56,
		0.01, -0.01, 999999.99, 99999999999.99, -99999999999.99,
		12.3, 7.25, 1000000, 0.1, 0.25,
	} {
		amountJSON, err := json.Marshal(FromFloat(value))
		if err != nil {
			t.Fatalf("marshal Amount(%v): %v", value, err)
		}
		floatJSON, err := json.Marshal(value)
		if err != nil {
			t.Fatalf("marshal float64(%v): %v", value, err)
		}
		if string(amountJSON) != string(floatJSON) {
			t.Fatalf("value %v: Amount marshals as %s, float64 as %s", value, amountJSON, floatJSON)
		}
	}
}

func TestAmountMarshalsAsABareNumberNotAString(t *testing.T) {
	encoded, err := json.Marshal(struct {
		Total Amount `json:"total"`
	}{Total: FromFloat(1234.56)})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if got, want := string(encoded), `{"total":1234.56}`; got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
	// Decoding into a plain interface must yield a number, which is what the
	// frontend's guard checks for.
	decoded := map[string]interface{}{}
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if _, ok := decoded["total"].(float64); !ok {
		t.Fatalf("total decoded as %T, must be a JSON number", decoded["total"])
	}
}

// Trailing zeros are dropped, matching float64. A NUMERIC(14,2) column
// holding 1234.50 must not start serializing as 1234.50 when float64 sent
// 1234.5.
func TestAmountDropsTrailingZerosLikeFloat64(t *testing.T) {
	for _, text := range []string{"1234.50", "100.00", "0.00", "-5.50"} {
		amount, err := FromString(text)
		if err != nil {
			t.Fatalf("parse %q: %v", text, err)
		}
		amountJSON, _ := json.Marshal(amount)
		floatJSON, _ := json.Marshal(amount.Float64())
		if string(amountJSON) != string(floatJSON) {
			t.Fatalf("%q: Amount %s, float64 %s", text, amountJSON, floatJSON)
		}
	}
}

// Where the two legitimately differ: float64 cannot represent these sums, so
// its output carries binary artefacts. Amount is exact. This is the migration
// doing its job, and it is the one category where a payload byte changes.
func TestAmountRemovesFloatArtefacts(t *testing.T) {
	// The addends must be variables. Go folds constant arithmetic at
	// arbitrary precision, so a literal 0.1 + 0.2 is exactly 0.3 and hides
	// the very artefact this test is about.
	left, right := 0.1, 0.2

	artefact, _ := json.Marshal(left + right)
	if string(artefact) != "0.30000000000000004" {
		t.Fatalf("expected float64 to render the artefact, got %s", artefact)
	}
	exact, _ := json.Marshal(FromFloat(left).Add(FromFloat(right)))
	if string(exact) != "0.3" {
		t.Fatalf("0.1 + 0.2 should be exactly 0.3 as an Amount, got %s", exact)
	}
}

func TestAmountUnmarshalsNumbersAndStrings(t *testing.T) {
	for _, payload := range []string{`{"total":1234.56}`, `{"total":"1234.56"}`} {
		var decoded struct {
			Total Amount `json:"total"`
		}
		if err := json.Unmarshal([]byte(payload), &decoded); err != nil {
			t.Fatalf("unmarshal %s: %v", payload, err)
		}
		if !decoded.Total.Equal(mustParse(t, "1234.56")) {
			t.Fatalf("%s decoded as %s", payload, decoded.Total)
		}
	}
	var missing struct {
		Total Amount `json:"total"`
	}
	if err := json.Unmarshal([]byte(`{"total":null}`), &missing); err != nil {
		t.Fatalf("unmarshal null: %v", err)
	}
	if !missing.Total.IsZero() {
		t.Fatal("a null amount must decode as zero")
	}
}

// The arithmetic this migration exists for: totalling rounded lines must land
// exactly on the header, with no residue for an absorber to swallow.
func TestAmountSummationHasNoResidue(t *testing.T) {
	lines := []Amount{}
	for _, text := range []string{"33.33", "33.33", "33.34"} {
		lines = append(lines, mustParse(t, text))
	}
	if got := Sum(lines...); !got.Equal(mustParse(t, "100.00")) {
		t.Fatalf("sum = %s, want 100", got)
	}

	// The float64 equivalent of a VAT-inclusive split, which is where the
	// residue absorber earns its keep today.
	gross := mustParse(t, "105.00")
	net := gross.Div(mustParse(t, "1.05")).Round2()
	vat := gross.Sub(net)
	if !net.Add(vat).Equal(gross) {
		t.Fatalf("net %s + vat %s must equal gross %s exactly", net, vat, gross)
	}
}

func TestAmountRoundingMatchesTheFloatHelpers(t *testing.T) {
	for _, value := range []float64{2.345, -2.345, 1234.5649, 1234.5651, 0.005} {
		if got, want := FromFloat(value).Round2().Float64(), Round2(value); got != want {
			t.Fatalf("Round2(%v): Amount %v, helper %v", value, got, want)
		}
		if got, want := FromFloat(value).Round4().Float64(), Round4(value); got != want {
			t.Fatalf("Round4(%v): Amount %v, helper %v", value, got, want)
		}
	}
	// Both round half away from zero, like math.Round.
	if got := mustParse(t, "2.345").Round2().String(); got != "2.35" {
		t.Fatalf("2.345 rounds to %s, want 2.35", got)
	}
	if got := mustParse(t, "-2.345").Round2().String(); got != "-2.35" {
		t.Fatalf("-2.345 rounds to %s, want -2.35", got)
	}
}

// Amounts fit NUMERIC(14,2), so the round trip through float64 that the
// remaining float boundaries still need must be lossless at that scale.
func TestAmountRoundTripsThroughFloat64WithinTheStoredScale(t *testing.T) {
	for _, text := range []string{"99999999999.99", "-99999999999.99", "0.01", "12345678.91"} {
		amount := mustParse(t, text)
		back := FromFloat(amount.Float64()).Round2()
		if !back.Equal(amount) {
			t.Fatalf("%s round-tripped to %s", text, back)
		}
	}
}

func TestAmountScansTheFormsTheDriverProduces(t *testing.T) {
	// PreferSimpleProtocol means NUMERIC arrives as text; the others are
	// defensive.
	for _, value := range []interface{}{"1234.56", []byte("1234.56"), 1234.56, nil} {
		var amount Amount
		if err := amount.Scan(value); err != nil {
			t.Fatalf("scan %#v: %v", value, err)
		}
		if value == nil {
			if !amount.IsZero() {
				t.Fatal("a NULL numeric must scan as zero")
			}
			continue
		}
		if !amount.Round2().Equal(mustParse(t, "1234.56")) {
			t.Fatalf("scan %#v produced %s", value, amount)
		}
	}
}

func TestZeroValueAmountIsUsable(t *testing.T) {
	var amount Amount
	if !amount.IsZero() {
		t.Fatal("the zero Amount must be zero")
	}
	if got := amount.Add(FromFloat(5)).Float64(); got != 5 {
		t.Fatalf("zero + 5 = %v", got)
	}
	encoded, _ := json.Marshal(amount)
	if string(encoded) != "0" {
		t.Fatalf("zero Amount marshals as %s, want 0", encoded)
	}
}

func TestAbsAndNegAgreeWithMath(t *testing.T) {
	amount := mustParse(t, "-5.25")
	if got := amount.Abs().Float64(); got != math.Abs(-5.25) {
		t.Fatalf("Abs = %v", got)
	}
	if got := amount.Neg().Float64(); got != 5.25 {
		t.Fatalf("Neg = %v", got)
	}
}

func mustParse(t *testing.T, text string) Amount {
	t.Helper()
	amount, err := FromString(text)
	if err != nil {
		t.Fatalf("parse %q: %v", text, err)
	}
	return amount
}
