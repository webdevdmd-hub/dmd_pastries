package reports

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

// Phase 6 / W0: the receivables and payables reports gained ledger-backed
// headers. These tests cover what can be asserted without a database: the SQL
// scope, the drift metric names, and the response shape.

func repositorySource(t *testing.T) string {
	t.Helper()
	source, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatalf("read reports repository source: %v", err)
	}
	return string(source)
}

func functionBody(t *testing.T, source, name string) string {
	t.Helper()
	index := strings.Index(source, "func (r *Repository) "+name+"(")
	if index < 0 {
		t.Fatalf("%s not found", name)
	}
	body := source[index:]
	if end := strings.Index(body[1:], "\nfunc "); end > 0 {
		body = body[:end]
	}
	return body
}

// The supplier-payables rows used status <> 'cancelled', which admits draft
// bills into an accounts-payable figure while the ledger counts only posted
// ones -- a guaranteed, unexplainable variance. Both the row query and the
// count query must scope to posted bills.
func TestSupplierPayablesRowsCountOnlyPostedBills(t *testing.T) {
	body := functionBody(t, repositorySource(t), "FinancialSupplierPayables")

	if strings.Contains(body, "pi.status <> 'cancelled'") {
		t.Fatal("supplier payables must not admit draft bills into an accounts-payable figure")
	}
	if occurrences := strings.Count(body, "shared.PurchaseInvoiceLedgerCondition("); occurrences < 2 {
		t.Fatalf("both the row query and the count query must scope to posted bills, found %d", occurrences)
	}
	if occurrences := strings.Count(body, "shared.PurchaseInvoiceOutstandingCondition("); occurrences < 2 {
		t.Fatalf("both the row query and the count query must scope to outstanding bills, found %d", occurrences)
	}
}

// The header and the financial summary must name the same drift the same way,
// or the same underlying problem shows up under two different codes.
func TestBalanceHeadersReuseSummaryDriftMetricNames(t *testing.T) {
	source := repositorySource(t)

	receivables := functionBody(t, source, "OutstandingBalancesHeader")
	if !strings.Contains(receivables, `Metric: "outstanding_customer_balance"`) {
		t.Fatal("receivables header must report drift under the summary's metric name")
	}
	if !strings.Contains(receivables, `"accounts_receivable", "1100"`) {
		t.Fatal("receivables header must read the AR control account")
	}

	payables := functionBody(t, source, "SupplierPayablesHeader")
	if !strings.Contains(payables, `Metric: "supplier_payable_balance"`) {
		t.Fatal("payables header must report drift under the summary's metric name")
	}
	if !strings.Contains(payables, `"accounts_payable", "2000"`) {
		t.Fatal("payables header must read the AP control account")
	}
	// Supplier advances are an asset; netting them into the payable would
	// understate both sides, so they are read separately.
	if !strings.Contains(payables, `"supplier_advance", "1400"`) {
		t.Fatal("payables header must surface supplier advances separately")
	}
}

// The header is a control-account balance as of the report end date. Reading
// it over the report window instead would silently answer a different
// question, so pin the as-of argument.
func TestBalanceHeadersReadBalanceAsOfReportEndDate(t *testing.T) {
	source := repositorySource(t)
	for _, name := range []string{"OutstandingBalancesHeader", "SupplierPayablesHeader"} {
		body := functionBody(t, source, name)
		if !strings.Contains(body, `filter.DateTo.Format("2006-01-02")`) {
			t.Fatalf("%s must read the control balance as of the report end date", name)
		}
	}
}

func TestOutstandingBalancesResponseCarriesHeaderAndProvenance(t *testing.T) {
	payload, err := json.Marshal(OutstandingBalancesReportResponse{
		Items:         []OutstandingBalanceReportItem{},
		Header:        ReportBalanceHeader{LedgerBalance: 1200.50, OperationalBalance: 1200.50},
		SourceOfTruth: journalSourceOfTruth,
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	decoded := map[string]interface{}{}
	if err := json.Unmarshal(payload, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if decoded["source_of_truth"] != "journal_entries" {
		t.Fatalf("expected ledger provenance, got %v", decoded["source_of_truth"])
	}
	header, ok := decoded["header"].(map[string]interface{})
	if !ok {
		t.Fatal("response must carry a header object")
	}
	if header["ledger_balance"] != 1200.50 {
		t.Fatalf("unexpected ledger balance: %v", header["ledger_balance"])
	}
	// Warnings are omitted when the ledger and operational figures agree, so
	// a clean report does not render an empty warning strip.
	if _, present := decoded["consistency_warnings"]; present {
		t.Fatal("consistency_warnings must be omitted when there is no drift")
	}
}

func TestSupplierPayablesResponseSurfacesAdvancesSeparately(t *testing.T) {
	payload, err := json.Marshal(SupplierPayablesReportResponse{
		Items:            []SupplierPayableReportItem{},
		Header:           ReportBalanceHeader{LedgerBalance: 800, OperationalBalance: 800},
		SupplierAdvances: 150,
		SourceOfTruth:    journalSourceOfTruth,
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	decoded := map[string]interface{}{}
	if err := json.Unmarshal(payload, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if decoded["supplier_advances"] != float64(150) {
		t.Fatalf("advances must not be netted into the payable: %v", decoded["supplier_advances"])
	}
	header := decoded["header"].(map[string]interface{})
	if header["ledger_balance"] != float64(800) {
		t.Fatalf("unexpected payable balance: %v", header["ledger_balance"])
	}
}
