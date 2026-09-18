package settings

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

// Regression: ISSUE-061 — "off" switches chosen at creation were saved "on".
//
// These models tag bool fields gorm:"default:true". GORM's Create leaves a
// false bool out of the INSERT, so the column default TRUE wins. The same
// defect locked no account in ISSUE-039. Found by code review during the
// Settings audit on 2026-09-17: a payment method created with split payment
// off, a product created hidden from POS, an ingredient or packaging item
// created untracked, and a non-refundable charge were all saved the other way.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md

func readSource(t *testing.T, path string) string {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return strings.ReplaceAll(string(raw), "\r\n", "\n")
}

func TestCreatesPersistFalseForDefaultTrueFields(t *testing.T) {
	for path, pattern := range map[string]string{
		"repository.go":                `func \(r \*Repository\) CreatePaymentMethod\(tx \*gorm\.DB, method \*PaymentMethod\) error \{\s*return tx\.Select\("\*"\)\.Create\(method\)`,
		"../products/repository.go":    `func \(r \*Repository\) Create\(tx \*gorm\.DB, product \*Product\) error \{\s*return tx\.Select\("\*"\)\.Create\(product\)`,
		"../ingredients/repository.go": `func \(r \*Repository\) Create\(tx \*gorm\.DB, item \*Ingredient\) error \{\s*return tx\.Select\("\*"\)\.Create\(item\)`,
		"../packaging/repository.go":   `func \(r \*Repository\) Create\(tx \*gorm\.DB, item \*PackagingItem\) error \{\s*return tx\.Select\("\*"\)\.Create\(item\)`,
	} {
		if !regexp.MustCompile(pattern).MatchString(readSource(t, path)) {
			t.Errorf("%s must create with Select(\"*\"), or false default:true fields are saved as true", path)
		}
	}
	if !strings.Contains(readSource(t, "repository.go"), `tx.Select("*").Create(&seed)`) {
		t.Error("default payment method seeds must also create with Select(\"*\")")
	}
	charges := readSource(t, "../charges/service.go")
	for _, want := range []string{`tx.Select("*").Create(&rows)`, `tx.Select("*").Create(&copied)`} {
		if !strings.Contains(charges, want) {
			t.Errorf("charges must create with %s, or a non-refundable charge is saved refundable", want)
		}
	}
}

// Regression: ISSUE-062 — receipt layout Preview always failed: the page sent
// no body and the handler required one ("invalid request payload", EOF).
func TestReceiptPreviewAcceptsAnEmptyBody(t *testing.T) {
	handler := readSource(t, "handler.go")
	i := strings.Index(handler, "func (h *Handler) PreviewReceiptLayout(")
	if i == -1 || !strings.Contains(handler[i:], "c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF)") {
		t.Error("PreviewReceiptLayout must accept an empty body; both request fields are optional")
	}
}
