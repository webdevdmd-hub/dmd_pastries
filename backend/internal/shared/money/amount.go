package money

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/shopspring/decimal"
)

// Amount is an exact decimal money value (Phase 6 / W4 step 2).
//
// It exists so arithmetic stops accumulating binary-float error. Today's
// float64 amounts are why the ledger needs a rounding-residue absorber, why
// reports compare against a 0.05 drift epsilon, and why a scatter of
// +0.0001 tolerance literals guard comparisons that ought to be exact.
//
// # Wire format
//
// Amount marshals as a bare JSON number, not a string, so adopting it does
// not change a single API payload. That is load-bearing: the frontend has
// sixteen copies of a `numberValue()` helper that falls back to 0 for any
// non-number, so a string-serialized amount would turn every money field on
// every screen into zero, with no error anywhere to notice it by.
//
// Values that today serialize with float artefacts (0.30000000000000004)
// will serialize cleanly (0.3) once their arithmetic runs through Amount.
// That is the migration working, not a format change.
//
// Switching to string serialization later is a change to MarshalJSON here
// plus a shared frontend parser that accepts `string | number` -- deliberately
// out of scope until the arithmetic is exact everywhere.
//
// # Scale
//
// Amount does not round on its own. Callers apply Round2 for money presented
// and posted at cents, or Round4 for unit costs and quantities, at the point
// the scale actually matters. Rounding on every operation would reintroduce
// the compounding this type removes.
type Amount struct {
	d decimal.Decimal
}

// Zero is the additive identity, and the value of a nil-ish Amount: the zero
// Amount is usable without construction.
var Zero = Amount{}

func FromFloat(value float64) Amount { return Amount{d: decimal.NewFromFloat(value)} }

func FromInt(value int64) Amount { return Amount{d: decimal.NewFromInt(value)} }

// FromString parses an exact decimal. Prefer it over FromFloat when the
// source is already text (a request body, a NUMERIC column), because it
// avoids a round trip through binary floating point.
func FromString(value string) (Amount, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return Zero, nil
	}
	parsed, err := decimal.NewFromString(trimmed)
	if err != nil {
		return Zero, fmt.Errorf("money: cannot parse %q as an amount: %w", value, err)
	}
	return Amount{d: parsed}, nil
}

// Float64 converts back for the boundaries that still speak float64. Money
// values fit NUMERIC(14,2), which is well inside float64's exact-integer
// range, so this does not lose cents.
func (a Amount) Float64() float64 {
	value, _ := a.d.Float64()
	return value
}

func (a Amount) String() string { return a.d.String() }

func (a Amount) Add(other Amount) Amount { return Amount{d: a.d.Add(other.d)} }

func (a Amount) Sub(other Amount) Amount { return Amount{d: a.d.Sub(other.d)} }

func (a Amount) Mul(other Amount) Amount { return Amount{d: a.d.Mul(other.d)} }

// Div is exact to 16 decimal places, well beyond any scale money is stored
// at, so the caller decides where to round.
func (a Amount) Div(other Amount) Amount { return Amount{d: a.d.Div(other.d)} }

func (a Amount) Neg() Amount { return Amount{d: a.d.Neg()} }

func (a Amount) Abs() Amount { return Amount{d: a.d.Abs()} }

// Round2 snaps to cents; Round4 to the scale of unit costs and quantities.
// Both round half away from zero, matching the math.Round behaviour every
// module used before this package existed.
func (a Amount) Round2() Amount { return Amount{d: a.d.Round(2)} }

func (a Amount) Round4() Amount { return Amount{d: a.d.Round(4)} }

func (a Amount) IsZero() bool { return a.d.IsZero() }

func (a Amount) IsNegative() bool { return a.d.IsNegative() }

func (a Amount) IsPositive() bool { return a.d.IsPositive() }

// Equal is exact. Unlike the float64 helper of the same purpose it needs no
// epsilon, which is the point of the migration: once both sides are decimals
// a difference is a real difference.
func (a Amount) Equal(other Amount) bool { return a.d.Equal(other.d) }

func (a Amount) GreaterThan(other Amount) bool { return a.d.GreaterThan(other.d) }

func (a Amount) LessThan(other Amount) bool { return a.d.LessThan(other.d) }

func (a Amount) Cmp(other Amount) int { return a.d.Cmp(other.d) }

// Sum totals amounts exactly, with no intermediate rounding.
func Sum(amounts ...Amount) Amount {
	total := Zero
	for _, amount := range amounts {
		total = total.Add(amount)
	}
	return total
}

// MarshalJSON emits a bare number. See the type comment: quoting it would
// silently zero every money field in the frontend.
func (a Amount) MarshalJSON() ([]byte, error) {
	return []byte(a.d.String()), nil
}

// UnmarshalJSON accepts a JSON number or a quoted decimal string, so a client
// sending "12.34" is read exactly rather than through float64.
func (a *Amount) UnmarshalJSON(data []byte) error {
	text := strings.TrimSpace(string(data))
	if text == "" || text == "null" {
		*a = Zero
		return nil
	}
	if text[0] == '"' {
		var quoted string
		if err := json.Unmarshal(data, &quoted); err != nil {
			return err
		}
		parsed, err := FromString(quoted)
		if err != nil {
			return err
		}
		*a = parsed
		return nil
	}
	parsed, err := FromString(text)
	if err != nil {
		return err
	}
	*a = parsed
	return nil
}

// Value and Scan let an Amount sit directly in a GORM model against a NUMERIC
// column. The driver runs with PreferSimpleProtocol, so NUMERIC arrives as
// text and is parsed exactly -- it never passes through float64.
func (a Amount) Value() (driver.Value, error) { return a.d.String(), nil }

func (a *Amount) Scan(value interface{}) error {
	if value == nil {
		*a = Zero
		return nil
	}
	switch typed := value.(type) {
	case float64:
		*a = FromFloat(typed)
		return nil
	case int64:
		*a = FromInt(typed)
		return nil
	case []byte:
		parsed, err := FromString(string(typed))
		if err != nil {
			return err
		}
		*a = parsed
		return nil
	case string:
		parsed, err := FromString(typed)
		if err != nil {
			return err
		}
		*a = parsed
		return nil
	default:
		var scanned decimal.Decimal
		if err := scanned.Scan(value); err != nil {
			return fmt.Errorf("money: cannot scan %T into an Amount: %w", value, err)
		}
		*a = Amount{d: scanned}
		return nil
	}
}
