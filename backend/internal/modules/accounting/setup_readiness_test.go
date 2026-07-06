package accounting

import "testing"

func TestSetupIssuesAreReadyTreatsErrorAndBlockingAsNotReady(t *testing.T) {
	cases := []struct {
		name   string
		issues []BackfillReadinessIssue
		want   bool
	}{
		{name: "no issues", issues: nil, want: true},
		{name: "warning only", issues: []BackfillReadinessIssue{{Severity: "warning"}}, want: true},
		{name: "error blocks", issues: []BackfillReadinessIssue{{Severity: "error"}}, want: false},
		{name: "blocking blocks", issues: []BackfillReadinessIssue{{Severity: "blocking"}}, want: false},
		{name: "case and whitespace normalized", issues: []BackfillReadinessIssue{{Severity: " Error "}}, want: false},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if got := setupIssuesAreReady(tt.issues); got != tt.want {
				t.Fatalf("setupIssuesAreReady() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestBackfillRequiredMappingKeysAreValidAccountMappingKeys(t *testing.T) {
	for _, key := range backfillRequiredMappingKeys() {
		if !validAccountMappingKey(key) {
			t.Fatalf("backfill required mapping key %q is not accepted by validAccountMappingKey", key)
		}
	}
}

func TestPaymentReadinessAccountBranchAvailability(t *testing.T) {
	branchID := "branch-a"
	otherBranchID := "branch-b"
	cases := []struct {
		name    string
		account paymentReadinessAccount
		want    bool
	}{
		{
			name:    "business wide active account",
			account: paymentReadinessAccount{AccountID: "account-id", AccountStatus: "active"},
			want:    true,
		},
		{
			name: "matching branch active account",
			account: paymentReadinessAccount{
				AccountID:       "account-id",
				AccountStatus:   "active",
				AccountBranchID: &branchID,
			},
			want: true,
		},
		{
			name: "other branch account",
			account: paymentReadinessAccount{
				AccountID:       "account-id",
				AccountStatus:   "active",
				AccountBranchID: &otherBranchID,
			},
			want: false,
		},
		{
			name:    "inactive account",
			account: paymentReadinessAccount{AccountID: "account-id", AccountStatus: "inactive"},
			want:    false,
		},
		{
			name:    "missing account",
			account: paymentReadinessAccount{AccountStatus: "active"},
			want:    false,
		},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.account.activeForBranch(branchID); got != tt.want {
				t.Fatalf("activeForBranch() = %v, want %v", got, tt.want)
			}
		})
	}
}
