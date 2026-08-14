package accounting

import (
	"strings"
	"testing"
)

// Phase 6 / W3: every seeded account belongs to exactly one header, headers
// themselves are parentless, and a header's type matches its children — the
// statements group by that relationship, so a mismatch would file an account
// under the wrong section of the balance sheet.
func TestSeededChartHierarchyIsWellFormed(t *testing.T) {
	seeds := DefaultChartAccountSeeds()
	byCode := make(map[string]defaultAccountSeed, len(seeds))
	for _, seed := range seeds {
		if _, clash := byCode[seed.Code]; clash {
			t.Fatalf("duplicate seeded account code %q", seed.Code)
		}
		byCode[seed.Code] = seed
	}

	headers := 0
	for _, seed := range seeds {
		if seed.IsHeader {
			headers++
			if seed.Parent != "" {
				t.Errorf("header %s must not have a parent (got %q)", seed.Code, seed.Parent)
			}
			if seed.AllowManualPosting {
				t.Errorf("header %s must not be postable", seed.Code)
			}
			continue
		}
		if seed.Parent == "" {
			t.Errorf("account %s (%s) has no header", seed.Code, seed.Name)
			continue
		}
		parent, ok := byCode[seed.Parent]
		if !ok {
			t.Errorf("account %s points at unknown header %q", seed.Code, seed.Parent)
			continue
		}
		if !parent.IsHeader {
			t.Errorf("account %s points at %s, which is not a header", seed.Code, parent.Code)
		}
		if !strings.EqualFold(parent.Type, seed.Type) {
			t.Errorf("account %s is %s but header %s is %s", seed.Code, seed.Type, parent.Code, parent.Type)
		}
	}
	if headers == 0 {
		t.Fatal("no header accounts are seeded")
	}
}

// Every account type present in the chart needs at least one header, otherwise
// accounts of that type would have nowhere to roll up.
func TestEveryAccountTypeHasAHeader(t *testing.T) {
	headerTypes := map[string]bool{}
	childTypes := map[string]bool{}
	for _, seed := range DefaultChartAccountSeeds() {
		if seed.IsHeader {
			headerTypes[strings.ToLower(seed.Type)] = true
			continue
		}
		childTypes[strings.ToLower(seed.Type)] = true
	}
	for accountType := range childTypes {
		if !headerTypes[accountType] {
			t.Errorf("account type %q has no header account", accountType)
		}
	}
}
