package shared

import (
	"pastries-pos/internal/shared/money"
	"strings"
	"time"

	"gorm.io/gorm"
)

var (
	RevenueJournalSources    = []string{"pos_sale", "bakery_order_revenue", "pos_sale_void", "sales_return"}
	GrossRevenueSources      = []string{"pos_sale", "bakery_order_revenue", "pos_sale_void"}
	CollectionJournalSources = []string{"pos_sale", "bakery_order_payment"}
	RefundJournalSources     = []string{"sales_return", "pos_sale_refund"}
)

const stockMovementsMissingJournalsQuery = `
				SELECT COUNT(*)
				FROM stock_movements sm
				WHERE sm.business_id = ?
				  AND sm.created_at >= ?
				  AND sm.created_at < ?
				  AND sm.movement_type IN ('opening_stock','adjustment_in','adjustment_out','wastage','purchase_return_out','purchase_bill_cancel_out')
				  AND COALESCE(sm.total_cost, 0) <> 0
				  AND sm.accounting_journal_entry_id IS NULL`

type MetricScope struct {
	BusinessID  string
	BranchID    string
	AllBranches bool
}

type FinancialTotals struct {
	Revenue             float64
	GrossRevenue        float64
	Refunded            float64
	Tax                 float64
	Collected           float64
	CashCollected       float64
	CardCollected       float64
	BankCollected       float64
	OutstandingCustomer float64
	SupplierPayable     float64
	PurchaseTotal       float64
	PaymentCount        int64
	RefundCount         int64
}

type ConsistencyWarning struct {
	Code         string `json:"code"`
	Message      string `json:"message"`
	SourceType   string `json:"source_type"`
	MissingCount int64  `json:"missing_count"`
}

func MetricScopeFromFilter(filter *ResolvedFilter) MetricScope {
	return MetricScope{
		BusinessID:  filter.BusinessID,
		BranchID:    filter.BranchID,
		AllBranches: filter.AllBranches,
	}
}

func LedgerFinancialTotals(db *gorm.DB, scope MetricScope, startUTC, endUTC time.Time) (*FinancialTotals, error) {
	dateFrom, dateTo := LedgerDateRange(startUTC, endUTC)
	totals := &FinancialTotals{}

	revenue, err := LedgerIncomeAmount(db, scope, dateFrom, dateTo, RevenueJournalSources, false)
	if err != nil {
		return nil, err
	}
	grossRevenue, err := LedgerIncomeAmount(db, scope, dateFrom, dateTo, GrossRevenueSources, false)
	if err != nil {
		return nil, err
	}
	tax, err := LedgerTaxAmount(db, scope, dateFrom, dateTo, RevenueJournalSources)
	if err != nil {
		return nil, err
	}
	refunded, refundCount, err := LedgerPaymentAccountCredits(db, scope, dateFrom, dateTo, RefundJournalSources)
	if err != nil {
		return nil, err
	}
	collected, cash, card, bank, paymentCount, err := LedgerPaymentAccountDebits(db, scope, dateFrom, dateTo, CollectionJournalSources)
	if err != nil {
		return nil, err
	}
	outstandingCustomer, err := LedgerMappedBalance(db, scope, "accounts_receivable", "1100", dateTo)
	if err != nil {
		return nil, err
	}
	supplierPayable, err := LedgerMappedBalance(db, scope, "accounts_payable", "2000", dateTo)
	if err != nil {
		return nil, err
	}
	purchaseTotal, err := LedgerMappedMovement(db, scope, "accounts_payable", "2000", dateFrom, dateTo, []string{"purchase_invoice", "purchase_invoice_edit", "purchase_invoice_cancel", "purchase_return", "purchase_return_reversal"})
	if err != nil {
		return nil, err
	}

	totals.Revenue = roundMetricMoney(revenue)
	totals.GrossRevenue = roundMetricMoney(grossRevenue)
	totals.Refunded = roundMetricMoney(refunded)
	totals.Tax = roundMetricMoney(tax)
	totals.Collected = roundMetricMoney(collected)
	totals.CashCollected = roundMetricMoney(cash)
	totals.CardCollected = roundMetricMoney(card)
	totals.BankCollected = roundMetricMoney(bank)
	totals.OutstandingCustomer = roundMetricMoney(outstandingCustomer)
	totals.SupplierPayable = roundMetricMoney(supplierPayable)
	totals.PurchaseTotal = roundMetricMoney(purchaseTotal)
	totals.PaymentCount = paymentCount
	totals.RefundCount = refundCount
	return totals, nil
}

func JournalConsistencyWarnings(db *gorm.DB, scope MetricScope, startUTC, endUTC time.Time) ([]ConsistencyWarning, error) {
	dateFrom, dateTo := LedgerDateRange(startUTC, endUTC)
	checks := []struct {
		code       string
		sourceType string
		message    string
		branchCol  string
		query      string
		args       []interface{}
	}{
		{
			code:       "pos_sales_missing_journals",
			sourceType: "pos_sale",
			message:    "Completed POS sales are missing posted accounting journals.",
			branchCol:  "s.branch_id",
			query: `
				SELECT COUNT(*)
				FROM sales s
				WHERE s.business_id = ?
				  AND s.deleted_at IS NULL
				  AND ` + SaleRevenueCondition("s") + `
				  AND s.sold_at >= ?
				  AND s.sold_at < ?
				  AND NOT EXISTS (
				    SELECT 1 FROM journal_entries je
				    WHERE je.business_id = s.business_id
				      AND je.source_type = 'pos_sale'
				      AND je.source_id = s.id
				      AND je.status IN ('posted', 'reversed')
				      AND je.deleted_at IS NULL
				  )`,
			args: []interface{}{scope.BusinessID, startUTC, endUTC},
		},
		{
			code:       "bakery_order_revenue_missing_journals",
			sourceType: "bakery_order_revenue",
			message:    "Bakery orders are missing posted revenue journals.",
			branchCol:  "bo.branch_id",
			query:      bakeryOrderRevenueMissingJournalsQuery,
			args:       []interface{}{scope.BusinessID, dateFrom, dateTo},
		},
		{
			code:       "bakery_payments_missing_journals",
			sourceType: "bakery_order_payment",
			message:    "Bakery order payments are missing posted accounting journals.",
			branchCol:  "bo.branch_id",
			query: `
				SELECT COUNT(*)
				FROM bakery_order_payments bop
				JOIN bakery_orders bo ON bo.id = bop.bakery_order_id AND bo.business_id = bop.business_id
				WHERE bop.business_id = ?
				  AND bo.deleted_at IS NULL
				  AND bop.paid_at >= ?
				  AND bop.paid_at < ?
				  AND (bop.journal_entry_id IS NULL OR NOT EXISTS (
				    SELECT 1 FROM journal_entries je
				    WHERE je.id = bop.journal_entry_id
				      AND je.business_id = bop.business_id
				      AND je.source_type = 'bakery_order_payment'
				      AND je.status IN ('posted', 'reversed')
				      AND je.deleted_at IS NULL
				  ))`,
			args: []interface{}{scope.BusinessID, startUTC, endUTC},
		},
		{
			code:       "pos_refunds_missing_journals",
			sourceType: "pos_sale_refund",
			message:    "Completed POS refunds are missing posted accounting journals.",
			branchCol:  "pr.branch_id",
			query: `
				SELECT COUNT(*)
				FROM payment_refunds pr
				WHERE pr.business_id = ?
				  AND pr.deleted_at IS NULL
				  AND pr.refund_status = 'completed'
				  AND pr.refunded_at >= ?
				  AND pr.refunded_at < ?
				  AND COALESCE(pr.refund_source, 'payment_adjustment') IN ('pos_sale', 'payment_adjustment')
				  AND (pr.journal_entry_id IS NULL OR NOT EXISTS (
				    SELECT 1 FROM journal_entries je
				    WHERE je.business_id = pr.business_id
				      AND je.source_type = 'pos_sale_refund'
				      AND je.source_id = pr.id
				      AND je.status IN ('posted', 'reversed')
				      AND je.deleted_at IS NULL
				  ))`,
			args: []interface{}{scope.BusinessID, startUTC, endUTC},
		},
		{
			code:       "purchase_bills_missing_journals",
			sourceType: "purchase_invoice",
			message:    "Posted purchase bills are missing posted accounting journals.",
			branchCol:  "pi.branch_id",
			query: `
				SELECT COUNT(*)
				FROM purchase_invoices pi
				WHERE pi.business_id = ?
				  AND pi.deleted_at IS NULL
				  AND pi.status = 'posted'
				  AND pi.invoice_date >= ?
				  AND pi.invoice_date <= ?
				  AND pi.journal_entry_id IS NULL`,
			args: []interface{}{scope.BusinessID, dateFrom, dateTo},
		},
		{
			code:       "supplier_payments_missing_journals",
			sourceType: "supplier_payment",
			message:    "Completed supplier payments are missing posted accounting journals.",
			branchCol:  "sp.branch_id",
			query: `
				SELECT COUNT(*)
				FROM supplier_payments sp
				WHERE sp.business_id = ?
				  AND sp.deleted_at IS NULL
				  AND sp.status = 'completed'
				  AND sp.payment_date >= ?
				  AND sp.payment_date <= ?
				  AND sp.journal_entry_id IS NULL`,
			args: []interface{}{scope.BusinessID, dateFrom, dateTo},
		},
		{
			code:       "expenses_missing_journals",
			sourceType: "expense",
			message:    "Posted expenses are missing posted accounting journals.",
			branchCol:  "e.branch_id",
			query: `
				SELECT COUNT(*)
				FROM expenses e
				WHERE e.business_id = ?
				  AND e.deleted_at IS NULL
				  AND e.status = 'posted'
				  AND e.expense_date >= ?
				  AND e.expense_date <= ?
				  AND e.journal_entry_id IS NULL`,
			args: []interface{}{scope.BusinessID, dateFrom, dateTo},
		},
		{
			code:       "vendor_credits_missing_journals",
			sourceType: "purchase_return",
			message:    "Posted Vendor Credits are missing posted accounting journals.",
			branchCol:  "prt.branch_id",
			query:      vendorCreditsMissingJournalsQuery,
			args:       []interface{}{scope.BusinessID, dateFrom, dateTo},
		},
		{
			code:       "manufacturing_batches_missing_journals",
			sourceType: "manufacturing_batch",
			message:    "Completed manufacturing batches are missing posted accounting journals.",
			branchCol:  "pb.branch_id",
			query: `
				SELECT COUNT(*)
				FROM production_batches pb
				WHERE pb.business_id = ?
				  AND pb.deleted_at IS NULL
				  AND pb.status = 'completed'
				  AND pb.completed_at >= ?
				  AND pb.completed_at < ?
				  AND NOT EXISTS (
				    SELECT 1 FROM journal_entries je
				    WHERE je.business_id = pb.business_id
				      AND je.source_type = 'manufacturing_batch'
				      AND je.source_id = pb.id
				      AND je.status IN ('posted', 'reversed')
				      AND je.deleted_at IS NULL
				  )`,
			args: []interface{}{scope.BusinessID, startUTC, endUTC},
		},
		{
			code:       "stock_movements_missing_journals",
			sourceType: "stock_movement",
			message:    "Valued stock movements are missing posted accounting journals.",
			branchCol:  "sm.branch_id",
			query:      stockMovementsMissingJournalsQuery,
			args:       []interface{}{scope.BusinessID, startUTC, endUTC},
		},
	}

	warnings := make([]ConsistencyWarning, 0)
	for _, check := range checks {
		query, args := addConsistencyBranchFilter(check.query, check.args, scope, check.branchCol)
		var count int64
		if err := db.Raw(query, args...).Scan(&count).Error; err != nil {
			return nil, err
		}
		if count > 0 {
			warnings = append(warnings, ConsistencyWarning{
				Code:         check.code,
				Message:      check.message,
				SourceType:   check.sourceType,
				MissingCount: count,
			})
		}
	}
	return warnings, nil
}

const bakeryOrderRevenueMissingJournalsQuery = `
	SELECT COUNT(*)
	FROM bakery_orders bo
	WHERE bo.business_id = ?
	  AND bo.deleted_at IS NULL
	  AND bo.order_status = 'completed'
	  AND bo.event_date >= ?
	  AND bo.event_date <= ?
	  AND (
	    bo.accounting_journal_entry_id IS NULL
	    OR NOT EXISTS (
	      SELECT 1 FROM journal_entries je
	      WHERE je.id = bo.accounting_journal_entry_id
	        AND je.business_id = bo.business_id
	        AND je.source_type = 'bakery_order_revenue'
	        AND je.source_id = bo.id
	        AND je.status = 'posted'
	        AND je.deleted_at IS NULL
	    )
	  )`

const vendorCreditsMissingJournalsQuery = `
	SELECT COUNT(*)
	FROM purchase_returns prt
	WHERE prt.business_id = ?
	  AND prt.deleted_at IS NULL
	  AND prt.status = 'posted'
	  AND prt.return_date >= ?
	  AND prt.return_date <= ?
	  AND (
	    prt.journal_entry_id IS NULL
	    OR NOT EXISTS (
	      SELECT 1 FROM journal_entries je
	      WHERE je.id = prt.journal_entry_id
	        AND je.business_id = prt.business_id
	        AND je.source_type = 'purchase_return'
	        AND je.source_id = prt.id
	        AND je.status = 'posted'
	        AND je.deleted_at IS NULL
	    )
	    OR EXISTS (
	      SELECT 1 FROM stock_movements sm
	      WHERE sm.business_id = prt.business_id
	        AND sm.reference_type = 'purchase_return'
	        AND sm.reference_id = prt.id
	        AND sm.movement_type = 'purchase_return_out'
	        AND sm.accounting_journal_entry_id IS DISTINCT FROM prt.journal_entry_id
	    )
	  )`

func LedgerIncomeAmount(db *gorm.DB, scope MetricScope, dateFrom, dateTo string, sourceTypes []string, positiveCreditsOnly bool) (float64, error) {
	branchClause, args := ledgerBranchClause(scope)
	args = append([]interface{}{scope.BusinessID, dateFrom, dateTo, sourceTypes}, args...)
	expression := "jel.credit_amount - jel.debit_amount"
	if positiveCreditsOnly {
		expression = "jel.credit_amount"
	}
	var total float64
	err := db.Raw(`
		SELECT COALESCE(SUM(`+expression+`), 0)
		FROM journal_entry_lines jel
		JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id
		JOIN chart_of_accounts coa ON coa.id = jel.account_id AND coa.business_id = jel.business_id
		WHERE jel.business_id = ?
		  AND jel.deleted_at IS NULL
		  AND je.deleted_at IS NULL
		  AND je.status IN ('posted', 'reversed')
		  AND je.entry_date >= ?
		  AND je.entry_date <= ?
		  AND je.source_type IN ?
		  AND coa.account_type = 'income'
		  `+branchClause, args...).Scan(&total).Error
	return roundMetricMoney(total), err
}

func LedgerTaxAmount(db *gorm.DB, scope MetricScope, dateFrom, dateTo string, sourceTypes []string) (float64, error) {
	branchClause, branchArgs := ledgerBranchClause(scope)
	accountBranchClause, accountBranchArgs := ledgerAccountBranchClause(scope)
	args := append([]interface{}{scope.BusinessID, dateFrom, dateTo, sourceTypes, scope.BusinessID}, accountBranchArgs...)
	args = append(args, branchArgs...)
	var total float64
	err := db.Raw(`
		SELECT COALESCE(SUM(jel.credit_amount - jel.debit_amount), 0)
		FROM journal_entry_lines jel
		JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id
		WHERE jel.business_id = ?
		  AND jel.deleted_at IS NULL
		  AND je.deleted_at IS NULL
		  AND je.status IN ('posted', 'reversed')
		  AND je.entry_date >= ?
		  AND je.entry_date <= ?
		  AND je.source_type IN ?
		  AND jel.account_id = (
		    SELECT COALESCE(aam.chart_account_id, coa.id)
		    FROM chart_of_accounts coa
		    LEFT JOIN accounting_account_mappings aam ON aam.business_id = coa.business_id AND aam.branch_id = coa.branch_id AND aam.mapping_key = 'vat_payable' AND aam.deleted_at IS NULL
		    WHERE coa.business_id = ? AND coa.account_code = '2100' AND coa.deleted_at IS NULL
		    `+accountBranchClause+`
		    ORDER BY CASE WHEN aam.chart_account_id IS NOT NULL THEN 0 ELSE 1 END
		    LIMIT 1
		  )
		  `+branchClause, args...).Scan(&total).Error
	return roundMetricMoney(total), err
}

func LedgerPaymentAccountDebits(db *gorm.DB, scope MetricScope, dateFrom, dateTo string, sourceTypes []string) (float64, float64, float64, float64, int64, error) {
	branchClause, args := ledgerBranchClause(scope)
	args = append([]interface{}{scope.BusinessID, dateFrom, dateTo, sourceTypes}, args...)
	var row struct {
		Total        float64
		Cash         float64
		Card         float64
		Bank         float64
		PaymentCount int64
	}
	err := db.Raw(`
		SELECT COALESCE(SUM(jel.debit_amount), 0) AS total,
		       COALESCE(SUM(jel.debit_amount) FILTER (WHERE pa.account_type = 'cash'), 0) AS cash,
		       COALESCE(SUM(jel.debit_amount) FILTER (WHERE pa.account_type = 'card_clearing'), 0) AS card,
		       COALESCE(SUM(jel.debit_amount) FILTER (WHERE pa.account_type IN ('bank', 'wallet', 'platform_clearing')), 0) AS bank,
		       COUNT(DISTINCT je.id) AS payment_count
		FROM journal_entry_lines jel
		JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id
		JOIN payment_accounts pa ON pa.chart_account_id = jel.account_id AND pa.business_id = jel.business_id AND pa.deleted_at IS NULL
		WHERE jel.business_id = ?
		  AND jel.deleted_at IS NULL
		  AND je.deleted_at IS NULL
		  AND je.status IN ('posted', 'reversed')
		  AND je.entry_date >= ?
		  AND je.entry_date <= ?
		  AND je.source_type IN ?
		  AND jel.debit_amount > 0
		  `+branchClause, args...).Scan(&row).Error
	return roundMetricMoney(row.Total), roundMetricMoney(row.Cash), roundMetricMoney(row.Card), roundMetricMoney(row.Bank), row.PaymentCount, err
}

func LedgerPaymentAccountCredits(db *gorm.DB, scope MetricScope, dateFrom, dateTo string, sourceTypes []string) (float64, int64, error) {
	branchClause, args := ledgerBranchClause(scope)
	args = append([]interface{}{scope.BusinessID, dateFrom, dateTo, sourceTypes}, args...)
	var row struct {
		Total       float64
		RefundCount int64
	}
	err := db.Raw(`
		SELECT COALESCE(SUM(jel.credit_amount), 0) AS total,
		       COUNT(DISTINCT je.id) AS refund_count
		FROM journal_entry_lines jel
		JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id
		JOIN payment_accounts pa ON pa.chart_account_id = jel.account_id AND pa.business_id = jel.business_id AND pa.deleted_at IS NULL
		WHERE jel.business_id = ?
		  AND jel.deleted_at IS NULL
		  AND je.deleted_at IS NULL
		  AND je.status IN ('posted', 'reversed')
		  AND je.entry_date >= ?
		  AND je.entry_date <= ?
		  AND je.source_type IN ?
		  AND jel.credit_amount > 0
		  `+branchClause, args...).Scan(&row).Error
	return roundMetricMoney(row.Total), row.RefundCount, err
}

func LedgerMappedBalance(db *gorm.DB, scope MetricScope, mappingKey, fallbackCode, asOfDate string) (float64, error) {
	branchClause, branchArgs := ledgerBranchClause(scope)
	accountBranchClause, accountBranchArgs := ledgerAccountBranchClause(scope)
	args := append([]interface{}{mappingKey, scope.BusinessID, fallbackCode}, accountBranchArgs...)
	args = append(args, scope.BusinessID, asOfDate)
	args = append(args, branchArgs...)
	var total float64
	err := db.Raw(`
		WITH target_account AS (
			SELECT COALESCE(aam.chart_account_id, coa.id) AS account_id, coa.normal_balance
			FROM chart_of_accounts coa
			LEFT JOIN accounting_account_mappings aam ON aam.business_id = coa.business_id AND aam.branch_id = coa.branch_id AND aam.mapping_key = ? AND aam.deleted_at IS NULL
			WHERE coa.business_id = ? AND coa.account_code = ? AND coa.deleted_at IS NULL
			`+accountBranchClause+`
			ORDER BY CASE WHEN aam.chart_account_id IS NOT NULL THEN 0 ELSE 1 END
			LIMIT 1
		)
		SELECT COALESCE(SUM(CASE WHEN ta.normal_balance = 'credit' THEN jel.credit_amount - jel.debit_amount ELSE jel.debit_amount - jel.credit_amount END), 0)
		FROM target_account ta
		JOIN journal_entry_lines jel ON jel.account_id = ta.account_id
		JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id
		WHERE jel.business_id = ?
		  AND jel.deleted_at IS NULL
		  AND je.deleted_at IS NULL
		  AND je.status IN ('posted', 'reversed')
		  AND je.entry_date <= ?
		  `+branchClause, args...).Scan(&total).Error
	return roundMetricMoney(total), err
}

func LedgerMappedMovement(db *gorm.DB, scope MetricScope, mappingKey, fallbackCode, dateFrom, dateTo string, sourceTypes []string) (float64, error) {
	branchClause, branchArgs := ledgerBranchClause(scope)
	accountBranchClause, accountBranchArgs := ledgerAccountBranchClause(scope)
	args := append([]interface{}{mappingKey, scope.BusinessID, fallbackCode}, accountBranchArgs...)
	args = append(args, scope.BusinessID, dateFrom, dateTo, sourceTypes)
	args = append(args, branchArgs...)
	var total float64
	err := db.Raw(`
		WITH target_account AS (
			SELECT COALESCE(aam.chart_account_id, coa.id) AS account_id, coa.normal_balance
			FROM chart_of_accounts coa
			LEFT JOIN accounting_account_mappings aam ON aam.business_id = coa.business_id AND aam.branch_id = coa.branch_id AND aam.mapping_key = ? AND aam.deleted_at IS NULL
			WHERE coa.business_id = ? AND coa.account_code = ? AND coa.deleted_at IS NULL
			`+accountBranchClause+`
			ORDER BY CASE WHEN aam.chart_account_id IS NOT NULL THEN 0 ELSE 1 END
			LIMIT 1
		)
		SELECT COALESCE(SUM(CASE WHEN ta.normal_balance = 'credit' THEN jel.credit_amount - jel.debit_amount ELSE jel.debit_amount - jel.credit_amount END), 0)
		FROM target_account ta
		JOIN journal_entry_lines jel ON jel.account_id = ta.account_id
		JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id
		WHERE jel.business_id = ?
		  AND jel.deleted_at IS NULL
		  AND je.deleted_at IS NULL
		  AND je.status IN ('posted', 'reversed')
		  AND je.entry_date >= ?
		  AND je.entry_date <= ?
		  AND je.source_type IN ?
		  `+branchClause, args...).Scan(&total).Error
	return roundMetricMoney(total), err
}

func ExpiringItemsCount(db *gorm.DB, scope MetricScope, todayDate string, days int) (int64, error) {
	if days <= 0 {
		days = 7
	}
	query := "SELECT COUNT(*) FROM expiry_batches WHERE business_id = ? AND status = 'active' AND deleted_at IS NULL AND expiry_date > ?::date AND expiry_date <= ?::date + (? * INTERVAL '1 day')"
	args := []interface{}{scope.BusinessID, todayDate, todayDate, days}
	if !scope.AllBranches {
		query += " AND branch_id = ?"
		args = append(args, scope.BranchID)
	}
	var total int64
	err := db.Raw(query, args...).Scan(&total).Error
	return total, err
}

// LedgerPeriodTotal is one bucket of a time series read from the ledger.
type LedgerPeriodTotal struct {
	Bucket    time.Time
	Collected float64
	Refunded  float64
}

// LedgerPeriodGranularity maps a report's group_by to a DATE_TRUNC unit.
// entry_date is a plain DATE, so unlike the operational trend -- which
// truncates a timestamptz in the Postgres session timezone and can therefore
// straddle midnight in the business's own timezone -- this needs no
// conversion.
func LedgerPeriodGranularity(groupBy string) string {
	switch strings.TrimSpace(groupBy) {
	case "week":
		return "week"
	case "month":
		return "month"
	default:
		return "day"
	}
}

// LedgerFinancialTotalsByPeriod buckets collections and refunds from the
// ledger (Phase 6 / W2).
//
// Deliberately one grouped query rather than calling LedgerFinancialTotals
// per bucket: that helper issues eight queries, so a 90-day daily trend would
// cost 720 round trips.
//
// Only flow metrics belong in a trend. The outstanding-customer and
// supplier-payable figures LedgerFinancialTotals also returns are cumulative
// as-of balances, which per bucket would be running totals -- a different
// question from the one this chart asks.
func LedgerFinancialTotalsByPeriod(db *gorm.DB, scope MetricScope, startUTC, endUTC time.Time, groupBy string) ([]LedgerPeriodTotal, error) {
	dateFrom, dateTo := LedgerDateRange(startUTC, endUTC)
	granularity := LedgerPeriodGranularity(groupBy)

	// The union is the query's own source filter; the two FILTER clauses then
	// split it. Because both sets are allow-lists, structural journals such
	// as year_end_close can never reach a bucket (asserted by test).
	sourceTypes := append(append([]string{}, CollectionJournalSources...), RefundJournalSources...)

	branchClause, branchArgs := ledgerBranchClause(scope)
	args := []interface{}{
		CollectionJournalSources, RefundJournalSources,
		scope.BusinessID, dateFrom, dateTo, sourceTypes,
	}
	args = append(args, branchArgs...)

	rows := []LedgerPeriodTotal{}
	err := db.Raw(`
		SELECT DATE_TRUNC('`+granularity+`', je.entry_date) AS bucket,
		       COALESCE(SUM(jel.debit_amount) FILTER (WHERE je.source_type IN ?), 0) AS collected,
		       COALESCE(SUM(jel.credit_amount) FILTER (WHERE je.source_type IN ?), 0) AS refunded
		FROM journal_entry_lines jel
		JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id
		JOIN payment_accounts pa ON pa.chart_account_id = jel.account_id AND pa.business_id = jel.business_id AND pa.deleted_at IS NULL
		WHERE jel.business_id = ?
		  AND jel.deleted_at IS NULL
		  AND je.deleted_at IS NULL
		  AND je.status IN ('posted', 'reversed')
		  AND je.entry_date >= ?
		  AND je.entry_date <= ?
		  AND je.source_type IN ?
		  `+branchClause+`
		GROUP BY bucket
		ORDER BY bucket ASC`, args...).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for index := range rows {
		rows[index].Collected = roundMetricMoney(rows[index].Collected)
		rows[index].Refunded = roundMetricMoney(rows[index].Refunded)
	}
	return rows, nil
}

// CounterpartyOpeningTotal sums the go-live opening balances attributed to
// customers or suppliers (Phase 6 / W1).
//
// These post to the AR and AP control accounts, so the ledger carries them
// from the moment they are entered. Every operational AR/AP figure has to add
// them back, or the reconciliation screens, the financial summary, and the
// receivables and payables headers all report drift that is not real. This is
// the single implementation; callers must not re-derive it.
//
// asOfDate is optional; when set, only openings dated on or before it count,
// which matches the as-of semantics of the ledger balance they are compared
// against.
func CounterpartyOpeningTotal(db *gorm.DB, scope MetricScope, partyType, asOfDate string) (float64, error) {
	query := `
		SELECT COALESCE(SUM(amount), 0)
		FROM counterparty_opening_balances
		WHERE business_id = ? AND party_type = ? AND deleted_at IS NULL`
	args := []interface{}{scope.BusinessID, strings.TrimSpace(partyType)}
	if !scope.AllBranches && strings.TrimSpace(scope.BranchID) != "" {
		query += " AND branch_id = ?"
		args = append(args, strings.TrimSpace(scope.BranchID))
	}
	if strings.TrimSpace(asOfDate) != "" {
		query += " AND opening_date <= ?"
		args = append(args, strings.TrimSpace(asOfDate))
	}
	var total float64
	err := db.Raw(query, args...).Scan(&total).Error
	return roundMetricMoney(total), err
}

func LedgerDateRange(startUTC, endUTC time.Time) (string, string) {
	dateFrom := startUTC.Format("2006-01-02")
	dateTo := endUTC.Add(-time.Nanosecond).Format("2006-01-02")
	if !startUTC.Before(endUTC) {
		dateTo = dateFrom
	}
	return dateFrom, dateTo
}

func ledgerBranchClause(scope MetricScope) (string, []interface{}) {
	if scope.AllBranches {
		return "", []interface{}{}
	}
	return " AND je.branch_id = ?", []interface{}{scope.BranchID}
}

// ledgerAccountBranchClause scopes the single-account lookups that pick one
// chart account with LIMIT 1. Account codes repeat once per branch, so without
// this a branch metric reads another branch's account and reports zero.
func ledgerAccountBranchClause(scope MetricScope) (string, []interface{}) {
	if scope.AllBranches {
		return "", []interface{}{}
	}
	return " AND coa.branch_id = ?", []interface{}{scope.BranchID}
}

func addConsistencyBranchFilter(query string, args []interface{}, scope MetricScope, branchColumn string) (string, []interface{}) {
	if scope.AllBranches {
		return query, args
	}
	query += " AND " + branchColumn + " = ?"
	args = append(args, scope.BranchID)
	return query, args
}

func roundMetricMoney(value float64) float64 { return money.Round2(value) }
