package accounting

import "strings"

// accountsPayableOperational is what suppliers are owed by the documents:
// open posted bills plus go-live openings, less vendor credits not yet applied.
func accountsPayableOperational(openBills, supplierOpenings, openVendorCredits float64) float64 {
	return roundMoney(openBills + supplierOpenings - openVendorCredits)
}

// supplierPaymentJournalReference names a supplier payment on its journal.
// Payments have no document number, so without a reference it fell back to
// the payment's id: the journal list read "ea465cc4-229f-47e3-82d6-...".
// (ISSUE-051)
func supplierPaymentJournalReference(referenceNumber, supplierName string) string {
	if reference := strings.TrimSpace(referenceNumber); reference != "" {
		return reference
	}
	return strings.TrimSpace(supplierName)
}
