package accounting

// Phase 4 / W6 — the unified refund/reversal contract.
//
// Every system journal the platform posts carries a source_type. This file is
// the single place where each source_type declares how its financial effect
// gets undone: either the source_type of the reversal journal that undoes it,
// or an explicit rationale for why no reversal path is required. A unit test
// (refund_contract_test.go) fails the build when a posting source_type is
// missing from the registry, so future flows cannot ship without deciding
// their reversal story.
//
// The refund journal itself is assembled by one pure builder for every money
// refund in the system (POS quick refunds, sales returns, bakery post-
// completion refunds), so the paths differ only by their inputs — goods flag,
// charge slices, AR outstanding — never by accounting shape.

import (
	"fmt"
	"math"

	apperrors "pastries-pos/internal/shared/errors"
)

// Journal source types. Literals in posting code must come from this block —
// the registry completeness test enumerates it.
const (
	SourcePOSSale                    = "pos_sale"
	SourcePOSSaleCOGS                = "pos_sale_cogs"
	SourcePOSSalePayment             = "pos_sale_payment"
	SourcePOSSaleVoid                = "pos_sale_void"
	SourcePOSSaleRefund              = "pos_sale_refund"
	SourceSalesReturn                = "sales_return"
	SourceSalesReturnInventory       = "sales_return_inventory"
	SourceBakeryOrderPayment         = "bakery_order_payment"
	SourceBakeryOrderRevenue         = "bakery_order_revenue"
	SourceBakeryOrderCOGS            = "bakery_order_cogs"
	SourceBakeryOrderCOGSReversal    = "bakery_order_cogs_reversal"
	SourceBakeryOrderRevenueReversal = "bakery_order_revenue_reversal"
	SourceBakeryOrderAdvanceRefund   = "bakery_order_advance_refund"
	SourceBakeryOrderRefund          = "bakery_order_refund"
	SourcePurchaseInvoice            = "purchase_invoice"
	SourcePurchaseInvoiceEdit        = "purchase_invoice_edit"
	SourcePurchaseInvoiceEditReverse = "purchase_invoice_edit_reverse"
	SourcePurchaseInvoiceCancel      = "purchase_invoice_cancel"
	SourcePurchaseInvoicePayment     = "purchase_invoice_payment"
	SourceSupplierPayment            = "supplier_payment"
	SourcePurchaseReturn             = "purchase_return"
	SourcePurchaseReturnReversal     = "purchase_return_reversal"
	SourceManufacturingBatch         = "manufacturing_batch"
	SourceExpense                    = "expense"
	SourceStockMovement              = "stock_movement"
	SourceInventoryOpeningStock      = "inventory_opening_stock"
	SourceInventoryAdjustment        = "inventory_adjustment"
	SourceInventoryWastage           = "inventory_wastage"
	SourceJournalReversal            = "journal_reversal"
	SourceAccountTransfer            = "account_transfer"
	SourcePlatformSettlement         = "platform_settlement"
	SourcePaymentAccount             = "payment_account"
)

// ReversalContract declares how the financial effect of a posting
// source_type is undone. Exactly one of the two fields is set.
type ReversalContract struct {
	// ReversedBy is the source_type of the journal that reverses this one.
	ReversedBy string
	// Rationale documents why the source_type needs no reversal journal of
	// its own (it IS a reversal, or its effect is undone through another
	// flow's entries).
	Rationale string
}

// reversalContracts is the table-driven registry: every posting source_type
// maps to its reversal story. The completeness test walks the Source* const
// block above and fails when an entry is missing, empty, or double-set.
var reversalContracts = map[string]ReversalContract{
	SourcePOSSale:              {ReversedBy: SourcePOSSaleVoid},
	SourcePOSSaleCOGS:          {ReversedBy: SourcePOSSaleVoid},
	SourcePOSSalePayment:       {Rationale: "money collected is returned through pos_sale_refund journals allocated against the payment"},
	SourcePOSSaleVoid:          {Rationale: "is itself the mirror reversal of pos_sale + pos_sale_cogs"},
	SourcePOSSaleRefund:        {Rationale: "correction entry; a wrong refund is corrected with a manual journal reversal (journal_reversal)"},
	SourceSalesReturn:          {Rationale: "is itself the revenue/VAT/charge reversal of a sale; posted returns cannot be un-posted"},
	SourceSalesReturnInventory: {Rationale: "is itself the COGS/inventory reversal of a sale's outbound movements"},

	SourceBakeryOrderPayment:         {ReversedBy: SourceBakeryOrderAdvanceRefund},
	SourceBakeryOrderRevenue:         {ReversedBy: SourceBakeryOrderRevenueReversal},
	SourceBakeryOrderCOGS:            {ReversedBy: SourceBakeryOrderCOGSReversal},
	SourceBakeryOrderCOGSReversal:    {Rationale: "is itself the mirror reversal of bakery_order_cogs on cancellation"},
	SourceBakeryOrderRevenueReversal: {Rationale: "is itself the reversal of bakery_order_revenue on cancellation"},
	SourceBakeryOrderAdvanceRefund:   {Rationale: "is itself the reversal of customer-advance money (bakery_order_payment)"},
	SourceBakeryOrderRefund:          {Rationale: "correction entry after completion; a wrong refund is corrected with a manual journal reversal"},

	SourcePurchaseInvoice:            {ReversedBy: SourcePurchaseInvoiceCancel},
	SourcePurchaseInvoiceEdit:        {ReversedBy: SourcePurchaseInvoiceEditReverse},
	SourcePurchaseInvoiceEditReverse: {Rationale: "is itself the reversal step of a bill edit"},
	SourcePurchaseInvoiceCancel:      {Rationale: "is itself the mirror reversal of purchase_invoice"},
	SourcePurchaseInvoicePayment:     {Rationale: "supplier money out is corrected through vendor credits (purchase_return) or a manual journal reversal"},
	SourceSupplierPayment:            {Rationale: "supplier money out is corrected through vendor credits (purchase_return) or a manual journal reversal"},
	SourcePurchaseReturn:             {ReversedBy: SourcePurchaseReturnReversal},
	SourcePurchaseReturnReversal:     {Rationale: "is itself the mirror reversal of purchase_return"},

	SourceManufacturingBatch:    {Rationale: "batches are corrected operationally (wastage/adjustment movements), which post their own journals"},
	SourceExpense:               {Rationale: "expenses are corrected with a manual journal reversal (journal_reversal)"},
	SourceStockMovement:         {Rationale: "movements reverse through mirror movements (is_reversal) whose journals post via the same movement pipeline"},
	SourceInventoryOpeningStock: {Rationale: "opening balances are corrected by adjustment movements, not reversed"},
	SourceInventoryAdjustment:   {Rationale: "an adjustment is undone by a counter-adjustment movement"},
	SourceInventoryWastage:      {Rationale: "wastage is undone by a counter-adjustment movement"},
	SourceJournalReversal:       {Rationale: "is itself the manual reversal mechanism"},
	SourceAccountTransfer:       {Rationale: "a wrong transfer is corrected by a counter-transfer"},
	SourcePlatformSettlement:    {Rationale: "a wrong settlement is corrected with a manual journal reversal until a dedicated reversal flow ships"},
	SourcePaymentAccount:        {Rationale: "opening-balance entry; corrected by editing the opening balance, which reposts"},
}

// RefundChargeSlice is one document charge's share of a refund, debited to
// the charge-refund account.
type RefundChargeSlice struct {
	Name   string
	Amount float64
}

// chargeNetAmount is a document charge's refundable net (total - tax), the
// base the proration runs over.
type chargeNetAmount struct {
	Name string
	Net  float64
}

// prorateRefundSlices splits a money refund into its tax slice, per-charge
// slices, and residual net-revenue slice, proportional to the refund's share
// of the document total.
//
// Rounding uses the cumulative technique: each slice is the difference
// between the rounded cumulative share after and before this refund, so a
// series of partial refunds that reaches the document total reverses the
// document's tax and charges EXACTLY, with no per-step drift.
func prorateRefundSlices(refundAmount, refundedBefore, totalAmount, taxTotal float64, charges []chargeNetAmount) (taxSlice float64, chargeSlices []RefundChargeSlice, netSlice float64, err error) {
	if refundAmount <= 0 {
		return 0, nil, 0, fmt.Errorf("refund amount must be positive")
	}
	if totalAmount <= 0 {
		return 0, nil, 0, fmt.Errorf("document total must be positive")
	}
	if refundedBefore < 0 {
		refundedBefore = 0
	}
	if roundMoney(refundedBefore+refundAmount) > roundMoney(totalAmount) {
		return 0, nil, 0, fmt.Errorf("refund exceeds document total")
	}
	cumulativeSlice := func(base float64) float64 {
		before := roundMoney(base * refundedBefore / totalAmount)
		after := roundMoney(base * (refundedBefore + refundAmount) / totalAmount)
		return roundMoney(after - before)
	}
	taxSlice = cumulativeSlice(taxTotal)
	slicesTotal := taxSlice
	for _, charge := range charges {
		if charge.Net <= 0 {
			continue
		}
		slice := cumulativeSlice(charge.Net)
		if slice <= 0 {
			continue
		}
		chargeSlices = append(chargeSlices, RefundChargeSlice{Name: charge.Name, Amount: slice})
		slicesTotal = roundMoney(slicesTotal + slice)
	}
	netSlice = roundMoney(refundAmount - slicesTotal)
	if netSlice < 0 {
		return 0, nil, 0, fmt.Errorf("refund slices exceed refund amount (tax+charges %.2f > refund %.2f)", slicesTotal, refundAmount)
	}
	return taxSlice, chargeSlices, netSlice, nil
}

// refundCashCredit is one payment-account credit of the refund journal (a
// refund event can pay back through several tenders).
type refundCashCredit struct {
	AccountID   string
	Amount      float64
	Description string
}

// refundJournalInput carries everything the unified refund builder needs,
// with all accounts already resolved for the document's branch.
type refundJournalInput struct {
	ReferenceNumber string

	// Debit side.
	SalesReturnsAccountID string
	NetAmount             float64
	ChargeAccountID       string
	ChargeSlices          []RefundChargeSlice
	VATAccountID          string
	TaxSlice              float64

	// Credit side. AR is credited before cash: refunding a credit sale first
	// cancels what the customer still owes, and only the collected part
	// leaves as money.
	ARAccountID string
	ARSlice     float64
	CashCredits []refundCashCredit
}

// buildRefundJournalLines assembles the unified refund entry:
//
//	Dr Sales Returns (net)  + Dr charge-refund (per charge) + Dr VAT Payable (tax slice)
//	  / Cr Accounts Receivable (outstanding slice) + Cr payment account(s) (collected slice)
//
// It is pure — accounts are pre-resolved — so the shape is unit-testable.
func buildRefundJournalLines(in refundJournalInput) ([]JournalEntryLineRequest, error) {
	lines := make([]JournalEntryLineRequest, 0, 4+len(in.ChargeSlices)+len(in.CashCredits))
	debitTotal := 0.0
	if in.NetAmount > 0 {
		if in.SalesReturnsAccountID == "" {
			return nil, apperrors.Internal("refund builder: sales returns account is required")
		}
		lines = append(lines, JournalEntryLineRequest{AccountID: in.SalesReturnsAccountID, DebitAmount: in.NetAmount, Description: "Refund allowance " + in.ReferenceNumber})
		debitTotal = roundMoney(debitTotal + in.NetAmount)
	}
	for _, slice := range in.ChargeSlices {
		if slice.Amount <= 0 {
			continue
		}
		if in.ChargeAccountID == "" {
			return nil, apperrors.Internal("refund builder: charge refund account is required")
		}
		lines = append(lines, JournalEntryLineRequest{AccountID: in.ChargeAccountID, DebitAmount: slice.Amount, Description: "Refunded customer charge: " + slice.Name})
		debitTotal = roundMoney(debitTotal + slice.Amount)
	}
	if in.TaxSlice > 0 {
		if in.VATAccountID == "" {
			return nil, apperrors.Internal("refund builder: VAT payable account is required")
		}
		lines = append(lines, JournalEntryLineRequest{AccountID: in.VATAccountID, DebitAmount: in.TaxSlice, Description: "VAT reversed on refund " + in.ReferenceNumber})
		debitTotal = roundMoney(debitTotal + in.TaxSlice)
	}

	creditTotal := 0.0
	if in.ARSlice > 0 {
		if in.ARAccountID == "" {
			return nil, apperrors.Internal("refund builder: accounts receivable account is required")
		}
		lines = append(lines, JournalEntryLineRequest{AccountID: in.ARAccountID, CreditAmount: in.ARSlice, Description: "Receivable restored on refund " + in.ReferenceNumber})
		creditTotal = roundMoney(creditTotal + in.ARSlice)
	}
	for _, credit := range in.CashCredits {
		if credit.Amount <= 0 {
			continue
		}
		lines = append(lines, JournalEntryLineRequest{AccountID: credit.AccountID, CreditAmount: credit.Amount, Description: credit.Description})
		creditTotal = roundMoney(creditTotal + credit.Amount)
	}

	if len(lines) < 2 {
		return nil, apperrors.Internal("refund builder: journal needs at least two lines")
	}
	if math.Abs(debitTotal-creditTotal) > systemBalanceEpsilon {
		return nil, apperrors.Internal(fmt.Sprintf("refund builder: journal out of balance (Dr %.4f vs Cr %.4f)", debitTotal, creditTotal))
	}
	return lines, nil
}

// buildBakeryOrderRevenueReversalLines reverses a completed bakery order's
// revenue journal on cancellation. The income/VAT/charge side is a pure
// mirror of the original lines, but the counterparty side is rebuilt from the
// order's CURRENT money state: payments recorded after completion settled
// part of the receivable, so blindly mirroring the original Dr Customer
// Advance / Dr AR split would over-credit AR and strand the settled cash.
//
//	Dr income/VAT/charges (mirror of original credits)
//	  / Cr Customer Advance (current paid) + Cr AR (current outstanding)
func buildBakeryOrderRevenueReversalLines(originalLines []JournalEntryLine, advanceAccountID, arAccountID string, currentPaid, currentBalance float64) ([]JournalEntryLineRequest, error) {
	if advanceAccountID == "" || arAccountID == "" {
		return nil, apperrors.Internal("bakery revenue reversal: advance and AR accounts are required")
	}
	currentPaid = roundMoney(math.Max(currentPaid, 0))
	currentBalance = roundMoney(math.Max(currentBalance, 0))

	lines := make([]JournalEntryLineRequest, 0, len(originalLines)+2)
	debitTotal := 0.0
	for _, line := range originalLines {
		// The original debit lines are the Customer Advance / AR split as of
		// completion; they are replaced below with the current split.
		if line.DebitAmount > 0 {
			continue
		}
		if line.CreditAmount <= 0 {
			continue
		}
		lines = append(lines, JournalEntryLineRequest{AccountID: line.AccountID, DebitAmount: roundMoney(line.CreditAmount), Description: "Cancellation reversal: " + line.Description})
		debitTotal = roundMoney(debitTotal + line.CreditAmount)
	}
	if debitTotal <= 0 {
		return nil, apperrors.Internal("bakery revenue reversal: original journal has no credit lines to mirror")
	}

	creditTotal := roundMoney(currentPaid + currentBalance)
	if math.Abs(debitTotal-creditTotal) > systemBalanceEpsilon {
		return nil, apperrors.Internal(fmt.Sprintf("bakery revenue reversal out of balance: income side %.4f vs paid+outstanding %.4f", debitTotal, creditTotal))
	}
	if currentPaid > 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: advanceAccountID, CreditAmount: currentPaid, Description: "Customer advance restored on cancellation"})
	}
	if currentBalance > 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: arAccountID, CreditAmount: currentBalance, Description: "Receivable cleared on cancellation"})
	}
	if len(lines) < 2 {
		return nil, apperrors.Internal("bakery revenue reversal: journal needs at least two lines")
	}
	return lines, nil
}
