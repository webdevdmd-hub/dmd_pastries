package bakeryorders

import "testing"

func TestResolveBakeryOrderPaymentTypeFirstPartialPaymentIsDeposit(t *testing.T) {
	paymentType := resolveBakeryOrderPaymentType(0, 100, 25)

	if paymentType != "deposit" {
		t.Fatalf("payment type = %q, want deposit", paymentType)
	}
}

func TestResolveBakeryOrderPaymentTypeSecondPartialPaymentIsBalance(t *testing.T) {
	paymentType := resolveBakeryOrderPaymentType(25, 75, 30)

	if paymentType != "balance" {
		t.Fatalf("payment type = %q, want balance", paymentType)
	}
}

func TestResolveBakeryOrderPaymentTypeClearingBalanceIsFull(t *testing.T) {
	paymentType := resolveBakeryOrderPaymentType(70, 30, 30)

	if paymentType != "full" {
		t.Fatalf("payment type = %q, want full", paymentType)
	}
}

func TestResolveBakeryOrderPaymentTypeFirstFullPaymentIsFull(t *testing.T) {
	paymentType := resolveBakeryOrderPaymentType(0, 100, 100)

	if paymentType != "full" {
		t.Fatalf("payment type = %q, want full", paymentType)
	}
}
