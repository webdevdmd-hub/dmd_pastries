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

func TestPaymentReadinessIssueClassifiesEffectiveAccountState(t *testing.T) {
	branchID := "branch-a"
	otherBranchID := "branch-b"
	chartAccountID := "chart-account-id"

	cases := []struct {
		name             string
		account          paymentReadinessAccount
		hasBranchMapping bool
		wantCode         string
	}{
		{
			name: "valid branch mapping",
			account: paymentReadinessAccount{
				AccountID:          "payment-account-id",
				AccountName:        "Main Cash",
				AccountStatus:      "active",
				AccountBranchID:    &branchID,
				ChartAccountID:     &chartAccountID,
				ChartAccountStatus: "active",
				Source:             "branch_mapping",
			},
			hasBranchMapping: true,
			wantCode:         "",
		},
		{
			name: "valid default fallback",
			account: paymentReadinessAccount{
				AccountID:          "payment-account-id",
				AccountName:        "Business Cash",
				AccountStatus:      "active",
				ChartAccountID:     &chartAccountID,
				ChartAccountStatus: "active",
				Source:             "default_payment_account",
			},
			hasBranchMapping: false,
			wantCode:         "",
		},
		{
			name: "missing branch mapping and default account",
			account: paymentReadinessAccount{
				Source: "default_payment_account",
			},
			hasBranchMapping: false,
			wantCode:         "payment_method_branch_mapping_missing",
		},
		{
			name: "branch mapping points to missing account",
			account: paymentReadinessAccount{
				Source: "branch_mapping",
			},
			hasBranchMapping: true,
			wantCode:         "payment_account_missing",
		},
		{
			name: "inactive account",
			account: paymentReadinessAccount{
				AccountID:          "payment-account-id",
				AccountName:        "Inactive Cash",
				AccountStatus:      "inactive",
				ChartAccountID:     &chartAccountID,
				ChartAccountStatus: "active",
				Source:             "branch_mapping",
			},
			hasBranchMapping: true,
			wantCode:         "payment_account_inactive",
		},
		{
			name: "wrong branch account",
			account: paymentReadinessAccount{
				AccountID:          "payment-account-id",
				AccountName:        "Other Branch Cash",
				AccountStatus:      "active",
				AccountBranchID:    &otherBranchID,
				ChartAccountID:     &chartAccountID,
				ChartAccountStatus: "active",
				Source:             "branch_mapping",
			},
			hasBranchMapping: true,
			wantCode:         "payment_account_branch_mismatch",
		},
		{
			name: "missing active ledger",
			account: paymentReadinessAccount{
				AccountID:     "payment-account-id",
				AccountName:   "No Ledger Cash",
				AccountStatus: "active",
				Source:        "branch_mapping",
			},
			hasBranchMapping: true,
			wantCode:         "payment_account_chart_account_missing",
		},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			issue := paymentReadinessIssue("method-id", "Cash", "cash", branchID, "Main", tt.account, tt.hasBranchMapping)
			if tt.wantCode == "" {
				if issue != nil {
					t.Fatalf("paymentReadinessIssue() = %#v, want nil", issue)
				}
				return
			}
			if issue == nil {
				t.Fatalf("paymentReadinessIssue() = nil, want %s", tt.wantCode)
			}
			if issue.CheckKey != tt.wantCode {
				t.Fatalf("CheckKey = %q, want %q", issue.CheckKey, tt.wantCode)
			}
			if issue.Details["method_name"] != "Cash" {
				t.Fatalf("method_name detail = %#v, want Cash", issue.Details["method_name"])
			}
			if issue.Details["branch_name"] != "Main" {
				t.Fatalf("branch_name detail = %#v, want Main", issue.Details["branch_name"])
			}
			if issue.Details["has_branch_mapping"] != tt.hasBranchMapping {
				t.Fatalf("has_branch_mapping detail = %#v, want %v", issue.Details["has_branch_mapping"], tt.hasBranchMapping)
			}
		})
	}
}
