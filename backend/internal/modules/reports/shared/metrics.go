package shared

import (
	"math"
	"time"

	"gorm.io/gorm"
)

var (
	RevenueJournalSources    = []string{"pos_sale", "bakery_order_revenue", "pos_sale_void", "sales_return"}
	GrossRevenueSources      = []string{"pos_sale", "bakery_order_revenue", "pos_sale_void"}
	CollectionJournalSources = []string{"pos_sale", "bakery_order_payment"}
	RefundJournalSources     = []string{"sales_return", "pos_sale_refund"}
)

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
	branchClause, args := ledgerBranchClause(scope)
	args = append([]interface{}{scope.BusinessID, dateFrom, dateTo, sourceTypes, scope.BusinessID}, args...)
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
		    LEFT JOIN accounting_account_mappings aam ON aam.business_id = coa.business_id AND aam.mapping_key = 'vat_payable' AND aam.deleted_at IS NULL
		    WHERE coa.business_id = ? AND coa.account_code = '2100' AND coa.deleted_at IS NULL
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
	branchClause, args := ledgerBranchClause(scope)
	args = append([]interface{}{mappingKey, scope.BusinessID, fallbackCode, scope.BusinessID, asOfDate}, args...)
	var total float64
	err := db.Raw(`
		WITH target_account AS (
			SELECT COALESCE(aam.chart_account_id, coa.id) AS account_id, coa.normal_balance
			FROM chart_of_accounts coa
			LEFT JOIN accounting_account_mappings aam ON aam.business_id = coa.business_id AND aam.mapping_key = ? AND aam.deleted_at IS NULL
			WHERE coa.business_id = ? AND coa.account_code = ? AND coa.deleted_at IS NULL
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
	branchClause, args := ledgerBranchClause(scope)
	args = append([]interface{}{mappingKey, scope.BusinessID, fallbackCode, scope.BusinessID, dateFrom, dateTo, sourceTypes}, args...)
	var total float64
	err := db.Raw(`
		WITH target_account AS (
			SELECT COALESCE(aam.chart_account_id, coa.id) AS account_id, coa.normal_balance
			FROM chart_of_accounts coa
			LEFT JOIN accounting_account_mappings aam ON aam.business_id = coa.business_id AND aam.mapping_key = ? AND aam.deleted_at IS NULL
			WHERE coa.business_id = ? AND coa.account_code = ? AND coa.deleted_at IS NULL
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

func ExpiringItemsCount(db *gorm.DB, scope MetricScope, days int) (int64, error) {
	if days <= 0 {
		days = 7
	}
	query := "SELECT COUNT(*) FROM expiry_batches WHERE business_id = ? AND status = 'active' AND deleted_at IS NULL AND expiry_date <= CURRENT_DATE + (? * INTERVAL '1 day')"
	args := []interface{}{scope.BusinessID, days}
	if !scope.AllBranches {
		query += " AND branch_id = ?"
		args = append(args, scope.BranchID)
	}
	var total int64
	err := db.Raw(query, args...).Scan(&total).Error
	return total, err
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

func roundMetricMoney(value float64) float64 {
	return math.Round(value*100) / 100
}
