package suppliers

import (
	"strings"
	"testing"
)

// Regression: ISSUE-023 — purchasing supplier pickers hid inactive suppliers the server accepts.
//
// ISSUE-021 let the server pay a deactivated supplier's posted bills, as the
// Deactivate dialog promises. Verified live on 2026-09-15, but only from the bill
// drawer: the Payments Made picker read this lookup, which returned active
// suppliers only, and showed "No matching suppliers found." for QA Flour Co.
//
// Pickers that start NEW documents still want active suppliers only, so the
// default is unchanged and purchasing asks for the rest explicitly.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
func TestSupplierLookupCanIncludeInactiveSuppliers(t *testing.T) {
	if got := lookupStatuses(SupplierLookupQuery{}); strings.Join(got, ",") != "active" {
		t.Errorf("default lookup statuses = %v; pickers outside purchasing must keep seeing active suppliers only", got)
	}
	got := strings.Join(lookupStatuses(SupplierLookupQuery{IncludeInactive: true}), ",")
	for _, status := range []string{"active", "inactive", "blocked"} {
		if !strings.Contains(got, status) {
			t.Errorf("include_inactive lookup omits %s suppliers, whose posted bills the server lets you pay", status)
		}
	}

	handler := readSource(t, "handler.go")
	if !strings.Contains(functionBody(handler, "func (h *Handler) LookupSuppliers("), `c.Query("include_inactive")`) {
		t.Error("LookupSuppliers must read include_inactive, or purchasing's request for inactive suppliers is ignored")
	}
	repository := readSource(t, "repository.go")
	if !strings.Contains(functionBody(repository, "func (r *Repository) Lookup("), "lookupStatuses(query)") {
		t.Error("Lookup must filter by lookupStatuses(query), not a hardcoded active status")
	}
}

// Regression: ISSUE-024 — purchasing supplier pickers stopped at 20 suppliers.
//
// Purchasing loads the supplier list once and searches it in the browser. The
// lookup capped every request at 20, so the 21st supplier onward could not be
// chosen, filtered or paid from any purchasing screen, with nothing on screen to
// say the list was cut short.
func TestSupplierLookupCapCoversAWholeSupplierList(t *testing.T) {
	if supplierLookupMaxLimit < 100 {
		t.Errorf("supplierLookupMaxLimit = %d; purchasing searches this list in the browser, so a small cap hides suppliers", supplierLookupMaxLimit)
	}
	service := readSource(t, "service.go")
	body := functionBody(service, "func (s *Service) LookupSuppliers(")
	if !strings.Contains(body, "query.Limit > supplierLookupMaxLimit") {
		t.Error("LookupSuppliers must cap at supplierLookupMaxLimit; a separate literal cap drifts from the frontend request")
	}
}
