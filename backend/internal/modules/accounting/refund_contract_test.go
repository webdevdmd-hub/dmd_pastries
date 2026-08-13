package accounting

import (
	"go/ast"
	"go/parser"
	"go/token"
	"math"
	"strconv"
	"strings"
	"testing"
)

// --- Registry completeness -------------------------------------------------

// sourceTypeConstants parses refund_contract.go and returns the values of the
// Source* const block — the canonical posting source-type list.
func sourceTypeConstants(t *testing.T) map[string]bool {
	t.Helper()
	fileSet := token.NewFileSet()
	parsed, err := parser.ParseFile(fileSet, "refund_contract.go", nil, 0)
	if err != nil {
		t.Fatalf("parse refund_contract.go: %v", err)
	}
	values := map[string]bool{}
	for _, decl := range parsed.Decls {
		genDecl, ok := decl.(*ast.GenDecl)
		if !ok || genDecl.Tok != token.CONST {
			continue
		}
		for _, spec := range genDecl.Specs {
			valueSpec, ok := spec.(*ast.ValueSpec)
			if !ok {
				continue
			}
			for i, name := range valueSpec.Names {
				if !strings.HasPrefix(name.Name, "Source") || i >= len(valueSpec.Values) {
					continue
				}
				if lit, ok := valueSpec.Values[i].(*ast.BasicLit); ok && lit.Kind == token.STRING {
					value, err := strconv.Unquote(lit.Value)
					if err != nil {
						t.Fatalf("unquote %s: %v", lit.Value, err)
					}
					values[value] = true
				}
			}
		}
	}
	if len(values) == 0 {
		t.Fatal("no Source* constants found in refund_contract.go")
	}
	return values
}

// TestReversalContractCompleteness: every posting source_type declares its
// reversal story — a reversal source_type or an explicit rationale, never
// both, never neither.
func TestReversalContractCompleteness(t *testing.T) {
	sourceTypes := sourceTypeConstants(t)
	for sourceType := range sourceTypes {
		contract, ok := reversalContracts[sourceType]
		if !ok {
			t.Errorf("source type %q has no entry in reversalContracts — declare how its financial effect is undone", sourceType)
			continue
		}
		hasReversal := strings.TrimSpace(contract.ReversedBy) != ""
		hasRationale := strings.TrimSpace(contract.Rationale) != ""
		if hasReversal == hasRationale {
			t.Errorf("source type %q must set exactly one of ReversedBy / Rationale", sourceType)
		}
		if hasReversal && !sourceTypes[contract.ReversedBy] {
			t.Errorf("source type %q declares reversal %q, which is not a declared source type", sourceType, contract.ReversedBy)
		}
	}
	for registered := range reversalContracts {
		if !sourceTypes[registered] {
			t.Errorf("reversalContracts entry %q has no matching Source* constant; add one or remove the entry", registered)
		}
	}
}

// TestPostingSourceTypesAreRegistered scans service.go for the source-type
// string literals actually posted and asserts each is in the registry, so a
// new posting flow cannot ship without a reversal declaration.
func TestPostingSourceTypesAreRegistered(t *testing.T) {
	sourceTypes := sourceTypeConstants(t)
	fileSet := token.NewFileSet()
	parsed, err := parser.ParseFile(fileSet, "service.go", nil, 0)
	if err != nil {
		t.Fatalf("parse service.go: %v", err)
	}
	check := func(pos token.Pos, literal string) {
		if !sourceTypes[literal] {
			position := fileSet.Position(pos)
			t.Errorf("service.go:%d posts source type %q that is not a declared Source* constant — add it to refund_contract.go and reversalContracts", position.Line, literal)
		}
	}
	stringLit := func(expr ast.Expr) (string, bool) {
		lit, ok := expr.(*ast.BasicLit)
		if !ok || lit.Kind != token.STRING {
			return "", false
		}
		value, err := strconv.Unquote(lit.Value)
		if err != nil {
			return "", false
		}
		return value, true
	}
	ast.Inspect(parsed, func(node ast.Node) bool {
		switch typed := node.(type) {
		case *ast.CallExpr:
			selector, ok := typed.Fun.(*ast.SelectorExpr)
			if !ok {
				return true
			}
			argIndex := -1
			switch selector.Sel.Name {
			case "createPostedSystemJournal", "createPostedTransferJournal":
				argIndex = 4
			case "reversePostedJournalInTx":
				argIndex = 3
			}
			if argIndex >= 0 && argIndex < len(typed.Args) {
				if value, ok := stringLit(typed.Args[argIndex]); ok {
					check(typed.Args[argIndex].Pos(), value)
				}
			}
		case *ast.KeyValueExpr:
			if key, ok := typed.Key.(*ast.Ident); ok && key.Name == "SourceType" {
				if value, ok := stringLit(typed.Value); ok && value != "" {
					check(typed.Value.Pos(), value)
				}
			}
		case *ast.AssignStmt:
			for i, lhs := range typed.Lhs {
				ident, ok := lhs.(*ast.Ident)
				if !ok || ident.Name != "sourceType" || i >= len(typed.Rhs) {
					continue
				}
				if value, ok := stringLit(typed.Rhs[i]); ok && value != "" {
					check(typed.Rhs[i].Pos(), value)
				}
			}
		}
		return true
	})
}

// --- Proration -------------------------------------------------------------

func TestProrateRefundSlicesProportional(t *testing.T) {
	// Inclusive AED 105 sale, tax 5: a 50% refund carries half the tax.
	tax, charges, net, err := prorateRefundSlices(52.50, 0, 105, 5, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tax != 2.50 {
		t.Fatalf("tax slice = %v, want 2.50", tax)
	}
	if len(charges) != 0 {
		t.Fatalf("unexpected charge slices: %v", charges)
	}
	if net != 50.00 {
		t.Fatalf("net slice = %v, want 50.00", net)
	}
}

// Three uneven partial refunds must reverse the document's tax EXACTLY —
// the cumulative rounding rule leaves no drift.
func TestProrateRefundSlicesCumulativeExactness(t *testing.T) {
	total, tax := 100.0, 4.76
	refunds := []float64{33.33, 33.33, 33.34}
	refundedBefore, taxSum, netSum := 0.0, 0.0, 0.0
	for _, refund := range refunds {
		taxSlice, _, netSlice, err := prorateRefundSlices(refund, refundedBefore, total, tax, nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		taxSum += taxSlice
		netSum += netSlice
		refundedBefore += refund
	}
	if math.Abs(taxSum-tax) > 1e-9 {
		t.Fatalf("cumulative tax = %v, want exactly %v", taxSum, tax)
	}
	if math.Abs(netSum-(total-tax)) > 1e-9 {
		t.Fatalf("cumulative net = %v, want exactly %v", netSum, total-tax)
	}
}

func TestProrateRefundSlicesWithCharges(t *testing.T) {
	// 105 total = 90 goods net + 10 delivery net + 5 tax; full refund.
	tax, charges, net, err := prorateRefundSlices(105, 0, 105, 5, []chargeNetAmount{{Name: "Delivery", Net: 10}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tax != 5 {
		t.Fatalf("tax slice = %v, want 5", tax)
	}
	if len(charges) != 1 || charges[0].Amount != 10 {
		t.Fatalf("charge slices = %v, want one slice of 10", charges)
	}
	if net != 90 {
		t.Fatalf("net slice = %v, want 90", net)
	}
}

func TestProrateRefundSlicesRejectsOverRefund(t *testing.T) {
	if _, _, _, err := prorateRefundSlices(60, 50, 100, 5, nil); err == nil {
		t.Fatal("refund beyond the document total must be rejected")
	}
}

// --- Unified builder -------------------------------------------------------

func lineTotals(lines []JournalEntryLineRequest) (debit, credit float64) {
	for _, line := range lines {
		debit += line.DebitAmount
		credit += line.CreditAmount
	}
	return roundMoney(debit), roundMoney(credit)
}

func TestBuildRefundJournalLinesARFirst(t *testing.T) {
	// Credit sale refund: 60 outstanding AR is restored, only 45 leaves as cash.
	lines, err := buildRefundJournalLines(refundJournalInput{
		ReferenceNumber:       "RFND-1",
		SalesReturnsAccountID: "acc-4040",
		NetAmount:             90,
		VATAccountID:          "acc-2100",
		TaxSlice:              5,
		ChargeAccountID:       "acc-4080",
		ChargeSlices:          []RefundChargeSlice{{Name: "Delivery", Amount: 10}},
		ARAccountID:           "acc-1100",
		ARSlice:               60,
		CashCredits:           []refundCashCredit{{AccountID: "acc-cash", Amount: 45, Description: "POS refund via Cash"}},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	debit, credit := lineTotals(lines)
	if debit != 105 || credit != 105 {
		t.Fatalf("journal out of balance: Dr %v / Cr %v", debit, credit)
	}
	byAccount := map[string]JournalEntryLineRequest{}
	for _, line := range lines {
		byAccount[line.AccountID] = line
	}
	if byAccount["acc-1100"].CreditAmount != 60 {
		t.Fatalf("AR credit = %v, want 60", byAccount["acc-1100"].CreditAmount)
	}
	if byAccount["acc-cash"].CreditAmount != 45 {
		t.Fatalf("cash credit = %v, want 45", byAccount["acc-cash"].CreditAmount)
	}
	if byAccount["acc-2100"].DebitAmount != 5 {
		t.Fatalf("VAT debit = %v, want 5", byAccount["acc-2100"].DebitAmount)
	}
}

func TestBuildRefundJournalLinesRejectsImbalance(t *testing.T) {
	_, err := buildRefundJournalLines(refundJournalInput{
		ReferenceNumber:       "RFND-2",
		SalesReturnsAccountID: "acc-4040",
		NetAmount:             100,
		CashCredits:           []refundCashCredit{{AccountID: "acc-cash", Amount: 90, Description: "cash"}},
	})
	if err == nil {
		t.Fatal("out-of-balance refund journal must be rejected")
	}
}

func TestBuildRefundJournalLinesRequiresAccounts(t *testing.T) {
	_, err := buildRefundJournalLines(refundJournalInput{
		ReferenceNumber: "RFND-3",
		NetAmount:       50,
		CashCredits:     []refundCashCredit{{AccountID: "acc-cash", Amount: 50, Description: "cash"}},
	})
	if err == nil {
		t.Fatal("missing sales-returns account must be rejected")
	}
}

// --- Bakery revenue reversal ----------------------------------------------

func bakeryRevenueLines() []JournalEntryLine {
	branch := "branch-1"
	return []JournalEntryLine{
		{AccountID: "acc-2200", BranchID: &branch, DebitAmount: 50, Description: "Customer advance applied"},
		{AccountID: "acc-1100", BranchID: &branch, DebitAmount: 55, Description: "Balance receivable"},
		{AccountID: "acc-4010", BranchID: &branch, CreditAmount: 90, Description: "Bakery order income"},
		{AccountID: "acc-4050", BranchID: &branch, CreditAmount: 10, Description: "Delivery charge"},
		{AccountID: "acc-2100", BranchID: &branch, CreditAmount: 5, Description: "VAT payable"},
	}
}

func TestBakeryRevenueReversalMirrorsIncomeSide(t *testing.T) {
	// No post-completion activity: current split equals the original 50/55.
	lines, err := buildBakeryOrderRevenueReversalLines(bakeryRevenueLines(), "acc-2200", "acc-1100", 50, 55)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	debit, credit := lineTotals(lines)
	if debit != 105 || credit != 105 {
		t.Fatalf("reversal out of balance: Dr %v / Cr %v", debit, credit)
	}
	byAccount := map[string]JournalEntryLineRequest{}
	for _, line := range lines {
		byAccount[line.AccountID] = line
	}
	if byAccount["acc-4010"].DebitAmount != 90 || byAccount["acc-4050"].DebitAmount != 10 || byAccount["acc-2100"].DebitAmount != 5 {
		t.Fatalf("income side not mirrored: %v", lines)
	}
	if byAccount["acc-2200"].CreditAmount != 50 || byAccount["acc-1100"].CreditAmount != 55 {
		t.Fatalf("counterparty split wrong: %v", lines)
	}
}

// Payments recorded after completion settle receivable: the reversal must use
// the CURRENT split (paid 80 / outstanding 25), not the completion-time one.
func TestBakeryRevenueReversalUsesCurrentMoneySplit(t *testing.T) {
	lines, err := buildBakeryOrderRevenueReversalLines(bakeryRevenueLines(), "acc-2200", "acc-1100", 80, 25)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	byAccount := map[string]JournalEntryLineRequest{}
	for _, line := range lines {
		byAccount[line.AccountID] = line
	}
	if byAccount["acc-2200"].CreditAmount != 80 {
		t.Fatalf("advance credit = %v, want current paid 80", byAccount["acc-2200"].CreditAmount)
	}
	if byAccount["acc-1100"].CreditAmount != 25 {
		t.Fatalf("AR credit = %v, want current outstanding 25", byAccount["acc-1100"].CreditAmount)
	}
}

func TestBakeryRevenueReversalRejectsDriftedTotals(t *testing.T) {
	if _, err := buildBakeryOrderRevenueReversalLines(bakeryRevenueLines(), "acc-2200", "acc-1100", 80, 10); err == nil {
		t.Fatal("paid+outstanding that no longer covers the income side must be rejected")
	}
}
