package accounting

import "testing"

func TestDefaultPaymentAccountSeeds(t *testing.T) {
	if len(defaultPaymentAccountSeeds) != 4 {
		t.Fatalf("expected 4 default payment account seeds, got %d", len(defaultPaymentAccountSeeds))
	}

	expected := map[string]defaultPaymentAccountSeed{
		"Cash": {
			MethodName:        "Cash",
			MethodType:        "cash",
			AccountNamePrefix: "Cash Box",
			AccountType:       "cash",
			ChartCode:         "1000",
			IsDefault:         true,
			RequiresReference: false,
			ShowInPurchasing:  true,
			ShowInExpenses:    true,
		},
		"Card": {
			MethodName:        "Card",
			MethodType:        "card",
			AccountNamePrefix: "Card Clearing",
			AccountType:       "card_clearing",
			ChartCode:         "1030",
			IsDefault:         false,
			RequiresReference: true,
			ShowInPurchasing:  true,
			ShowInExpenses:    false,
		},
		"Bank Transfer": {
			MethodName:        "Bank Transfer",
			MethodType:        "bank_transfer",
			AccountNamePrefix: "Bank Account",
			AccountType:       "bank",
			ChartCode:         "1010",
			IsDefault:         false,
			RequiresReference: true,
			ShowInPurchasing:  true,
			ShowInExpenses:    true,
		},
		// W4: store-credit redemption tender rides the Customer Advance
		// control account; it must never surface in purchasing or expenses.
		"Store Credit": {
			MethodName:        "Store Credit",
			MethodType:        "store_credit",
			AccountNamePrefix: "Store Credit",
			AccountType:       "store_credit",
			ChartCode:         "2200",
			IsDefault:         false,
			RequiresReference: false,
			ShowInPurchasing:  false,
			ShowInExpenses:    false,
		},
	}

	for _, seed := range defaultPaymentAccountSeeds {
		want, ok := expected[seed.MethodName]
		if !ok {
			t.Fatalf("unexpected payment account seed: %+v", seed)
		}
		if seed != want {
			t.Fatalf("seed for %s = %+v, want %+v", seed.MethodName, seed, want)
		}
	}
}
