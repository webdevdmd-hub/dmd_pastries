package salesreturns

import "testing"

// Phase 4 / W4: the store-credit outcome must be anchored to a customer
// account — a walk-in sale cannot take credit.
func TestValidateStoreCreditCustomer(t *testing.T) {
	customer := "3f0b6e0a-5f5e-4a51-9d1e-000000000001"
	empty := "  "
	cases := []struct {
		name       string
		mode       string
		customerID *string
		wantErr    bool
	}{
		{"store credit with customer passes", "store_credit", &customer, false},
		{"store credit without customer fails", "store_credit", nil, true},
		{"store credit with blank customer fails", "store_credit", &empty, true},
		{"refund without customer passes", "refund", nil, false},
		{"none without customer passes", "none", nil, false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			err := validateStoreCreditCustomer(testCase.mode, testCase.customerID)
			if testCase.wantErr && err == nil {
				t.Fatal("expected an error")
			}
			if !testCase.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}
