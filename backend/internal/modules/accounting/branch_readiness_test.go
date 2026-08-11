package accounting

import (
	"reflect"
	"testing"
)

func TestMissingValuesNamesOnlyWhatIsAbsent(t *testing.T) {
	expected := []string{"1000", "1100", "2000", "5070"}
	present := []string{"1100", "5070"}

	got := missingValues(expected, present)
	want := []string{"1000", "2000"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("missingValues = %v, want %v", got, want)
	}
}

func TestMissingValuesIgnoresCaseAndPadding(t *testing.T) {
	if got := missingValues([]string{"cogs"}, []string{" COGS "}); len(got) != 0 {
		t.Fatalf("missingValues = %v, want none", got)
	}
}

func TestMissingValuesReturnsEmptySliceNotNil(t *testing.T) {
	// The readiness payload is JSON; a nil slice would serialise as null and
	// make "nothing missing" indistinguishable from "not checked".
	got := missingValues([]string{"1000"}, []string{"1000"})
	if got == nil {
		t.Fatal("missingValues returned nil, want an empty slice")
	}
	if len(got) != 0 {
		t.Fatalf("missingValues = %v, want empty", got)
	}
}

// The seeded defaults are what the readiness report measures each branch
// against, so a branch seeded today must come back complete.
func TestDefaultSeedsCoverEveryMappingKey(t *testing.T) {
	codes := map[string]struct{}{}
	for _, seed := range DefaultChartAccountSeeds() {
		codes[seed.Code] = struct{}{}
	}
	for _, mapping := range DefaultAccountMappingSeeds() {
		if _, ok := codes[mapping.AccountCode]; !ok {
			t.Errorf("mapping %q points at account code %q, which is not seeded",
				mapping.Key, mapping.AccountCode)
		}
	}
}
