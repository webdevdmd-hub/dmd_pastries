package payments

import (
	"math"
	"strings"
	"time"

	"gorm.io/gorm"

	reportshared "pastries-pos/internal/modules/reports/shared"
	"pastries-pos/internal/shared/utils"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

type SaleRow struct {
	ID            string
	BusinessID    string
	BranchID      string
	SaleNumber    string
	TotalAmount   float64
	PaidAmount    float64
	ChangeAmount  float64
	PaymentStatus string
	SaleStatus    string
}

type PaymentMethodRow struct {
	ID                string
	MethodName        string
	MethodType        string
	RequiresReference bool
}

type paymentScanRow struct {
	ID                        string
	PaymentID                 string
	BusinessID                string
	BranchID                  string
	BranchName                string
	SaleID                    string
	SaleNumber                string
	SourceType                string
	SourceID                  string
	SourceNumber              string
	CustomerName              string
	PaymentMethodID           string
	PaymentMethodNameSnapshot string
	PaymentMethodTypeSnapshot string
	PaymentMethodName         string
	PaymentMethodType         string
	Amount                    float64
	ReferenceNumber           string
	ProviderTransactionID     string
	PaymentStatus             string
	PaymentType               *string
	PaidByUserID              string
	PaidByUserName            string
	Notes                     string
	PaidAt                    time.Time
	CreatedAt                 time.Time
	UpdatedAt                 time.Time
}

type operationalPaymentSummary struct {
	Rows             []PaymentSummaryByMethod
	TotalCollected   float64
	TotalRefunded    float64
	NetCollected     float64
	POSCollected     float64
	BakeryCollected  float64
	DepositCollected float64
	BalanceCollected float64
	FullCollected    float64
	PaymentsCount    int64
	RefundsCount     int64
}

func (r *Repository) ListPayments(businessID string, query PaymentListQuery) ([]PaymentResponse, int64, error) {
	baseSQL, args := customerPaymentLedgerSQL(businessID, query)
	countSQL := "SELECT COUNT(*) FROM (" + baseSQL + ") ledger"
	var total int64
	if err := r.db.Raw(countSQL, args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	sortBy := safePaymentSortBy(query.SortBy)
	sortOrder := "desc"
	if strings.ToLower(query.SortOrder) == "asc" {
		sortOrder = "asc"
	}
	var rows []paymentScanRow
	listSQL := "SELECT * FROM (" + baseSQL + ") ledger ORDER BY " + sortBy + " " + sortOrder + " OFFSET ? LIMIT ?"
	listArgs := append(args, (query.Page-1)*query.Limit, query.Limit)
	err := r.db.Raw(listSQL, listArgs...).Scan(&rows).Error
	return toPaymentResponses(rows), total, err
}

func customerPaymentLedgerSQL(businessID string, query PaymentListQuery) (string, []interface{}) {
	sourceType := strings.ToLower(strings.TrimSpace(query.SourceType))
	queries := make([]string, 0, 2)
	args := make([]interface{}, 0)
	if sourceType == "" || sourceType == "pos_sale" {
		sql, sqlArgs := posPaymentLedgerSQL(businessID, query)
		queries = append(queries, sql)
		args = append(args, sqlArgs...)
	}
	if sourceType == "" || sourceType == "bakery_order" {
		sql, sqlArgs := bakeryOrderPaymentLedgerSQL(businessID, query)
		queries = append(queries, sql)
		args = append(args, sqlArgs...)
	}
	if len(queries) == 0 {
		return emptyPaymentLedgerSQL(), nil
	}
	return strings.Join(queries, " UNION ALL "), args
}

func posPaymentLedgerSQL(businessID string, query PaymentListQuery) (string, []interface{}) {
	where := []string{"sp.business_id = ?", "sp.deleted_at IS NULL", "s.deleted_at IS NULL"}
	args := []interface{}{businessID}
	if query.Search != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(query.Search)) + "%"
		where = append(where, `(LOWER(COALESCE(sp.reference_number, '')) LIKE ? OR LOWER(COALESCE(sp.provider_transaction_id, '')) LIKE ? OR LOWER(COALESCE(s.sale_number, '')) LIKE ? OR LOWER(COALESCE(c.full_name, '')) LIKE ? OR LOWER(COALESCE(sp.payment_method_name_snapshot, '')) LIKE ? OR LOWER(COALESCE(u.full_name, '')) LIKE ?)`)
		args = append(args, like, like, like, like, like, like)
	}
	if query.SaleID != "" {
		where = append(where, "sp.sale_id = ?")
		args = append(args, query.SaleID)
	}
	if query.BakeryOrderID != "" {
		where = append(where, "1 = 0")
	}
	if query.SourceID != "" {
		where = append(where, "sp.sale_id = ?")
		args = append(args, query.SourceID)
	}
	if query.PaymentMethodID != "" {
		where = append(where, "sp.payment_method_id = ?")
		args = append(args, query.PaymentMethodID)
	}
	if query.PaymentStatus != "" {
		where = append(where, "sp.payment_status = ?")
		args = append(args, query.PaymentStatus)
	}
	if query.BranchID != "" {
		where = append(where, "sp.branch_id = ?")
		args = append(args, query.BranchID)
	}
	if query.PaidByUserID != "" {
		where = append(where, "sp.paid_by_user_id = ?")
		args = append(args, query.PaidByUserID)
	}
	if query.DateFrom != "" {
		where = append(where, "sp.paid_at >= ?")
		args = append(args, query.DateFrom)
	}
	if query.DateTo != "" {
		where = append(where, "sp.paid_at <= ?")
		args = append(args, query.DateTo)
	}
	sql := `
		SELECT
			sp.id::text AS id,
			sp.id::text AS payment_id,
			sp.business_id::text AS business_id,
			sp.branch_id::text AS branch_id,
			COALESCE(b.branch_name, '') AS branch_name,
			sp.sale_id::text AS sale_id,
			COALESCE(s.sale_number, '') AS sale_number,
			'pos_sale' AS source_type,
			sp.sale_id::text AS source_id,
			COALESCE(s.sale_number, '') AS source_number,
			COALESCE(c.full_name, '') AS customer_name,
			sp.payment_method_id::text AS payment_method_id,
			sp.payment_method_name_snapshot,
			sp.payment_method_type_snapshot,
			sp.payment_method_name_snapshot AS payment_method_name,
			sp.payment_method_type_snapshot AS payment_method_type,
			sp.amount,
			COALESCE(sp.reference_number, '') AS reference_number,
			COALESCE(sp.provider_transaction_id, '') AS provider_transaction_id,
			sp.payment_status,
			NULL::text AS payment_type,
			sp.paid_by_user_id::text AS paid_by_user_id,
			COALESCE(u.full_name, '') AS paid_by_user_name,
			COALESCE(sp.notes, '') AS notes,
			sp.paid_at,
			sp.created_at,
			sp.updated_at
		FROM sale_payments sp
		JOIN sales s ON s.id = sp.sale_id AND s.business_id = sp.business_id
		LEFT JOIN branches b ON b.id = sp.branch_id AND b.business_id = sp.business_id
		LEFT JOIN customers c ON c.id = s.customer_id AND c.business_id = s.business_id AND c.branch_id = s.branch_id
		LEFT JOIN users u ON u.id = sp.paid_by_user_id AND u.business_id = sp.business_id
		WHERE ` + strings.Join(where, " AND ")
	return sql, args
}

func bakeryOrderPaymentLedgerSQL(businessID string, query PaymentListQuery) (string, []interface{}) {
	where := []string{"bop.business_id = ?", "bo.deleted_at IS NULL"}
	args := []interface{}{businessID}
	if query.Search != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(query.Search)) + "%"
		where = append(where, `(LOWER(COALESCE(bop.reference_number, '')) LIKE ? OR LOWER(COALESCE(bo.order_number, '')) LIKE ? OR LOWER(COALESCE(bo.customer_name_snapshot, '')) LIKE ? OR LOWER(COALESCE(bop.payment_method_name_snapshot, '')) LIKE ? OR LOWER(COALESCE(u.full_name, '')) LIKE ?)`)
		args = append(args, like, like, like, like, like)
	}
	if query.SaleID != "" {
		where = append(where, "1 = 0")
	}
	if query.BakeryOrderID != "" {
		where = append(where, "bop.bakery_order_id = ?")
		args = append(args, query.BakeryOrderID)
	}
	if query.SourceID != "" {
		where = append(where, "bop.bakery_order_id = ?")
		args = append(args, query.SourceID)
	}
	if query.PaymentMethodID != "" {
		where = append(where, "bop.payment_method_id = ?")
		args = append(args, query.PaymentMethodID)
	}
	if query.PaymentStatus != "" && strings.ToLower(strings.TrimSpace(query.PaymentStatus)) != "completed" {
		where = append(where, "1 = 0")
	}
	if query.BranchID != "" {
		where = append(where, "bo.branch_id = ?")
		args = append(args, query.BranchID)
	}
	if query.PaidByUserID != "" {
		where = append(where, "bop.paid_by_user_id = ?")
		args = append(args, query.PaidByUserID)
	}
	if query.DateFrom != "" {
		where = append(where, "bop.paid_at >= ?")
		args = append(args, query.DateFrom)
	}
	if query.DateTo != "" {
		where = append(where, "bop.paid_at <= ?")
		args = append(args, query.DateTo)
	}
	sql := `
		SELECT
			bop.id::text AS id,
			bop.id::text AS payment_id,
			bop.business_id::text AS business_id,
			bo.branch_id::text AS branch_id,
			COALESCE(b.branch_name, '') AS branch_name,
			'' AS sale_id,
			'' AS sale_number,
			'bakery_order' AS source_type,
			bop.bakery_order_id::text AS source_id,
			COALESCE(bo.order_number, '') AS source_number,
			COALESCE(bo.customer_name_snapshot, '') AS customer_name,
			bop.payment_method_id::text AS payment_method_id,
			bop.payment_method_name_snapshot,
			COALESCE(pm.method_type, '') AS payment_method_type_snapshot,
			bop.payment_method_name_snapshot AS payment_method_name,
			COALESCE(pm.method_type, '') AS payment_method_type,
			bop.amount,
			COALESCE(bop.reference_number, '') AS reference_number,
			'' AS provider_transaction_id,
			'completed' AS payment_status,
			bop.payment_type,
			bop.paid_by_user_id::text AS paid_by_user_id,
			COALESCE(u.full_name, '') AS paid_by_user_name,
			'' AS notes,
			bop.paid_at,
			bop.created_at,
			bop.created_at AS updated_at
		FROM bakery_order_payments bop
		JOIN bakery_orders bo ON bo.id = bop.bakery_order_id AND bo.business_id = bop.business_id
		LEFT JOIN branches b ON b.id = bo.branch_id AND b.business_id = bop.business_id
		LEFT JOIN payment_methods pm ON pm.id = bop.payment_method_id AND pm.business_id = bop.business_id
		LEFT JOIN users u ON u.id = bop.paid_by_user_id AND u.business_id = bop.business_id
		WHERE ` + strings.Join(where, " AND ")
	return sql, args
}

func emptyPaymentLedgerSQL() string {
	return `
		SELECT
			'' AS id,
			'' AS payment_id,
			'' AS business_id,
			'' AS branch_id,
			'' AS branch_name,
			'' AS sale_id,
			'' AS sale_number,
			'' AS source_type,
			'' AS source_id,
			'' AS source_number,
			'' AS customer_name,
			'' AS payment_method_id,
			'' AS payment_method_name_snapshot,
			'' AS payment_method_type_snapshot,
			'' AS payment_method_name,
			'' AS payment_method_type,
			0 AS amount,
			'' AS reference_number,
			'' AS provider_transaction_id,
			'' AS payment_status,
			NULL::text AS payment_type,
			'' AS paid_by_user_id,
			'' AS paid_by_user_name,
			'' AS notes,
			NOW() AS paid_at,
			NOW() AS created_at,
			NOW() AS updated_at
		WHERE 1 = 0`
}

func (r *Repository) FindPayment(businessID, paymentID string) (*PaymentResponse, error) {
	var row paymentScanRow
	err := r.db.Table("sale_payments sp").
		Select("sp.*, s.sale_number, u.full_name AS paid_by_user_name").
		Joins("JOIN sales s ON s.id = sp.sale_id").
		Joins("LEFT JOIN users u ON u.id = sp.paid_by_user_id").
		Where("sp.id = ? AND sp.business_id = ? AND sp.deleted_at IS NULL", paymentID, businessID).
		Take(&row).Error
	if err != nil {
		return nil, err
	}
	response := row.toResponse()
	var refunds []PaymentRefundResponse
	if err := r.db.Table("payment_refunds").Where("sale_payment_id = ? AND business_id = ? AND deleted_at IS NULL", paymentID, businessID).Order("refunded_at DESC").Scan(&refunds).Error; err != nil {
		return nil, err
	}
	response.Refunds = refunds
	return &response, nil
}

func (r *Repository) FindSale(tx *gorm.DB, businessID, saleID string) (*SaleRow, error) {
	var sale SaleRow
	err := tx.Table("sales").Where("id = ? AND business_id = ? AND deleted_at IS NULL", saleID, businessID).Take(&sale).Error
	if err != nil {
		return nil, err
	}
	return &sale, nil
}

func (r *Repository) FindPaymentModel(tx *gorm.DB, businessID, paymentID string) (*SalePayment, error) {
	var payment SalePayment
	err := tx.Where("id = ? AND business_id = ? AND deleted_at IS NULL", paymentID, businessID).Take(&payment).Error
	if err != nil {
		return nil, err
	}
	return &payment, nil
}

func (r *Repository) ListSalePayments(businessID, saleID string) ([]PaymentResponse, error) {
	var rows []paymentScanRow
	err := r.db.Table("sale_payments sp").
		Select("sp.*, s.sale_number, u.full_name AS paid_by_user_name").
		Joins("JOIN sales s ON s.id = sp.sale_id").
		Joins("LEFT JOIN users u ON u.id = sp.paid_by_user_id").
		Where("sp.sale_id = ? AND sp.business_id = ? AND sp.deleted_at IS NULL", saleID, businessID).
		Order("sp.paid_at ASC").
		Scan(&rows).Error
	return toPaymentResponses(rows), err
}

func (r *Repository) FindPaymentMethod(tx *gorm.DB, businessID, methodID string) (*PaymentMethodRow, error) {
	var method PaymentMethodRow
	err := tx.Table("payment_methods").Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", methodID, businessID, "active").Take(&method).Error
	if err != nil {
		return nil, err
	}
	return &method, nil
}

func (r *Repository) CreatePayment(tx *gorm.DB, payment *SalePayment) error {
	return tx.Create(payment).Error
}

func (r *Repository) CreateRefund(tx *gorm.DB, refund *PaymentRefund) error {
	return tx.Create(refund).Error
}

func (r *Repository) CreateReconciliation(tx *gorm.DB, reconciliation *PaymentReconciliation) error {
	return tx.Create(reconciliation).Error
}

func (r *Repository) UpdatePayment(tx *gorm.DB, businessID, paymentID string, updates map[string]interface{}) error {
	return tx.Model(&SalePayment{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", paymentID, businessID).Updates(updates).Error
}

func (r *Repository) UpdateSale(tx *gorm.DB, businessID, saleID string, updates map[string]interface{}) error {
	return tx.Table("sales").Where("id = ? AND business_id = ? AND deleted_at IS NULL", saleID, businessID).Updates(updates).Error
}

func (r *Repository) BranchExists(tx *gorm.DB, businessID, branchID string) (bool, error) {
	var count int64
	err := tx.Table("branches").Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", branchID, businessID, "active").Count(&count).Error
	return count > 0, err
}

func (r *Repository) PaymentRefundedAmount(tx *gorm.DB, businessID, paymentID string) (float64, error) {
	var total float64
	err := tx.Table("payment_refunds").Select("COALESCE(SUM(refund_amount), 0)").Where("business_id = ? AND sale_payment_id = ? AND refund_status = ? AND deleted_at IS NULL", businessID, paymentID, "completed").Scan(&total).Error
	return total, err
}

func (r *Repository) SalePaymentTotals(tx *gorm.DB, businessID, saleID string) (paid float64, refunded float64, err error) {
	err = tx.Table("sale_payments").Select("COALESCE(SUM(amount), 0)").Where("business_id = ? AND sale_id = ? AND payment_status IN ? AND deleted_at IS NULL", businessID, saleID, []string{"completed", "partially_refunded", "refunded"}).Scan(&paid).Error
	if err != nil {
		return 0, 0, err
	}
	err = tx.Table("payment_refunds").Select("COALESCE(SUM(refund_amount), 0)").Where("business_id = ? AND sale_id = ? AND refund_status = ? AND deleted_at IS NULL", businessID, saleID, "completed").Scan(&refunded).Error
	return paid, refunded, err
}

func (r *Repository) GenerateRefundNumber(tx *gorm.DB, businessID string, now time.Time) (string, error) {
	datePart := now.Format("20060102")
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":"+datePart+":payment_refunds").Error; err != nil {
		return "", err
	}
	prefix := "PAY-RFND-" + datePart + "-"
	return utils.NextSequentialNumber(tx.Table("payment_refunds").Where("business_id = ?", businessID), "refund_number", prefix, 6)
}

func (r *Repository) ListRefunds(businessID string, query RefundListQuery) ([]PaymentRefundResponse, int64, error) {
	db := r.db.Table("payment_refunds").Where("payment_refunds.business_id = ? AND payment_refunds.deleted_at IS NULL", businessID)
	db = applyRefundFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []PaymentRefundResponse
	err := db.Select("payment_refunds.*, COALESCE(sr.return_number, '') AS sales_return_number").
		Joins("LEFT JOIN sales_returns sr ON sr.id = payment_refunds.sales_return_id AND sr.business_id = payment_refunds.business_id").
		Order("payment_refunds.refunded_at DESC").
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Scan(&rows).Error
	return rows, total, err
}

func (r *Repository) FindRefund(businessID, refundID string) (*PaymentRefundResponse, error) {
	var row PaymentRefundResponse
	err := r.db.Table("payment_refunds").
		Select("payment_refunds.*, COALESCE(sr.return_number, '') AS sales_return_number").
		Joins("LEFT JOIN sales_returns sr ON sr.id = payment_refunds.sales_return_id AND sr.business_id = payment_refunds.business_id").
		Where("payment_refunds.id = ? AND payment_refunds.business_id = ? AND payment_refunds.deleted_at IS NULL", refundID, businessID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) DailySummary(businessID, dateLabel, dateFrom, dateTo, branchID string, warningStartUTC, warningEndUTC *time.Time) (*DailySummaryResponse, error) {
	summary, err := r.operationalPaymentSummary(businessID, dateFrom, dateTo, branchID)
	if err != nil {
		return nil, err
	}
	warnings := []PaymentConsistencyWarning{}
	if warningStartUTC != nil && warningEndUTC != nil {
		scope := reportshared.MetricScope{BusinessID: businessID, BranchID: branchID, AllBranches: branchID == ""}
		warningRows, err := reportshared.JournalConsistencyWarnings(r.db, scope, *warningStartUTC, *warningEndUTC)
		if err != nil {
			return nil, err
		}
		warnings = make([]PaymentConsistencyWarning, 0, len(warningRows))
		for _, row := range warningRows {
			warnings = append(warnings, PaymentConsistencyWarning{Code: row.Code, Message: row.Message, SourceType: row.SourceType, MissingCount: row.MissingCount})
		}
	}
	return dailySummaryFromOperational(dateLabel, branchID, summary, warnings), nil
}

func (r *Repository) MethodSummary(businessID, dateFrom, dateTo, branchID string) ([]PaymentSummaryByMethod, error) {
	summary, err := r.operationalPaymentSummary(businessID, dateFrom, dateTo, branchID)
	if err != nil {
		return nil, err
	}
	return summary.Rows, nil
}

func (r *Repository) operationalPaymentSummary(businessID, dateFrom, dateTo, branchID string) (*operationalPaymentSummary, error) {
	paymentWhere := "business_id = ? AND payment_status IN ? AND deleted_at IS NULL"
	paymentArgs := []interface{}{businessID, []string{"completed", "partially_refunded", "refunded"}}
	bakeryWhere := "bop.business_id = ? AND bo.deleted_at IS NULL"
	bakeryArgs := []interface{}{businessID}
	refundWhere := "business_id = ? AND refund_status = ? AND deleted_at IS NULL"
	refundArgs := []interface{}{businessID, "completed"}
	if dateFrom != "" {
		paymentWhere += " AND paid_at >= ?"
		bakeryWhere += " AND bop.paid_at >= ?"
		refundWhere += " AND refunded_at >= ?"
		paymentArgs = append(paymentArgs, dateFrom)
		bakeryArgs = append(bakeryArgs, dateFrom)
		refundArgs = append(refundArgs, dateFrom)
	}
	if dateTo != "" {
		paymentWhere += " AND paid_at < ?"
		bakeryWhere += " AND bop.paid_at < ?"
		refundWhere += " AND refunded_at < ?"
		paymentArgs = append(paymentArgs, dateTo)
		bakeryArgs = append(bakeryArgs, dateTo)
		refundArgs = append(refundArgs, dateTo)
	}
	if branchID != "" {
		paymentWhere += " AND branch_id = ?"
		bakeryWhere += " AND bo.branch_id = ?"
		refundWhere += " AND branch_id = ?"
		paymentArgs = append(paymentArgs, branchID)
		bakeryArgs = append(bakeryArgs, branchID)
		refundArgs = append(refundArgs, branchID)
	}
	var collectedRows []PaymentSummaryByMethod
	if err := r.db.Table("sale_payments").
		Select("payment_method_id, payment_method_name_snapshot AS payment_method_name, payment_method_type_snapshot AS payment_method_type, COALESCE(SUM(amount), 0) AS collected_amount, COALESCE(SUM(amount), 0) AS total_amount, COUNT(*) AS transaction_count").
		Where(paymentWhere, paymentArgs...).
		Group("payment_method_id, payment_method_name_snapshot, payment_method_type_snapshot").
		Scan(&collectedRows).Error; err != nil {
		return nil, err
	}
	posCollected := sumCollectedAmount(collectedRows)
	var bakeryRows []PaymentSummaryByMethod
	if err := r.db.Table("bakery_order_payments bop").
		Select("bop.payment_method_id, bop.payment_method_name_snapshot AS payment_method_name, COALESCE(pm.method_type, '') AS payment_method_type, COALESCE(SUM(bop.amount), 0) AS collected_amount, COALESCE(SUM(bop.amount), 0) AS total_amount, COUNT(*) AS transaction_count").
		Joins("JOIN bakery_orders bo ON bo.id = bop.bakery_order_id AND bo.business_id = bop.business_id").
		Joins("LEFT JOIN payment_methods pm ON pm.id = bop.payment_method_id AND pm.business_id = bop.business_id").
		Where(bakeryWhere, bakeryArgs...).
		Group("bop.payment_method_id, bop.payment_method_name_snapshot, pm.method_type").
		Scan(&bakeryRows).Error; err != nil {
		return nil, err
	}
	bakeryCollected := sumCollectedAmount(bakeryRows)
	collectedRows = append(collectedRows, bakeryRows...)
	var refundRows []PaymentSummaryByMethod
	if err := r.db.Table("payment_refunds").
		Select("payment_method_id, payment_method_name_snapshot AS payment_method_name, COALESCE(SUM(refund_amount), 0) AS refunded_amount, COALESCE(SUM(refund_amount), 0) AS refund_amount, COUNT(*) AS refund_transaction_count").
		Where(refundWhere, refundArgs...).
		Group("payment_method_id, payment_method_name_snapshot").
		Scan(&refundRows).Error; err != nil {
		return nil, err
	}
	rows := mergePaymentSummaryRows(collectedRows, refundRows)
	for i := range rows {
		rows[i].RefundAmount = rows[i].RefundedAmount
		rows[i].TotalAmount = rows[i].CollectedAmount
		rows[i].NetAmount = roundMoney(rows[i].CollectedAmount - rows[i].RefundedAmount)
	}
	type bakeryPaymentTypeTotal struct {
		PaymentType string
		Amount      float64
	}
	var paymentTypeTotals []bakeryPaymentTypeTotal
	if err := r.db.Table("bakery_order_payments bop").
		Select("bop.payment_type, COALESCE(SUM(bop.amount), 0) AS amount").
		Joins("JOIN bakery_orders bo ON bo.id = bop.bakery_order_id AND bo.business_id = bop.business_id").
		Where(bakeryWhere, bakeryArgs...).
		Group("bop.payment_type").
		Scan(&paymentTypeTotals).Error; err != nil {
		return nil, err
	}
	depositCollected, balanceCollected, fullCollected := 0.0, 0.0, 0.0
	for _, row := range paymentTypeTotals {
		switch row.PaymentType {
		case "deposit":
			depositCollected += row.Amount
		case "balance":
			balanceCollected += row.Amount
		case "full":
			fullCollected += row.Amount
		}
	}
	return operationalSummaryFromRows(rows, posCollected, bakeryCollected, depositCollected, balanceCollected, fullCollected), nil
}

func (r *Repository) ExpectedAmount(businessID, branchID, methodID string, date time.Time) (float64, error) {
	dateString := date.Format("2006-01-02")
	var collected, bakeryCollected, refunded float64
	if err := r.db.Table("sale_payments").Select("COALESCE(SUM(amount),0)").Where("business_id = ? AND branch_id = ? AND payment_method_id = ? AND payment_status IN ? AND deleted_at IS NULL AND paid_at::date = ?", businessID, branchID, methodID, []string{"completed", "partially_refunded", "refunded"}, dateString).Scan(&collected).Error; err != nil {
		return 0, err
	}
	if err := r.db.Table("bakery_order_payments bop").Joins("JOIN bakery_orders bo ON bo.id = bop.bakery_order_id AND bo.business_id = bop.business_id").Select("COALESCE(SUM(bop.amount),0)").Where("bop.business_id = ? AND bo.branch_id = ? AND bop.payment_method_id = ? AND bo.deleted_at IS NULL AND bop.paid_at::date = ?", businessID, branchID, methodID, dateString).Scan(&bakeryCollected).Error; err != nil {
		return 0, err
	}
	if err := r.db.Table("payment_refunds").Select("COALESCE(SUM(refund_amount),0)").Where("business_id = ? AND branch_id = ? AND payment_method_id = ? AND refund_status = ? AND deleted_at IS NULL AND refunded_at::date = ?", businessID, branchID, methodID, "completed", dateString).Scan(&refunded).Error; err != nil {
		return 0, err
	}
	return roundMoney(collected + bakeryCollected - refunded), nil
}

func (r *Repository) ListReconciliations(businessID string, query ReconciliationListQuery) ([]ReconciliationResponse, int64, error) {
	db := r.db.Table("payment_reconciliations").Where("business_id = ? AND deleted_at IS NULL", businessID)
	if query.BranchID != "" {
		db = db.Where("branch_id = ?", query.BranchID)
	}
	if query.PaymentMethodID != "" {
		db = db.Where("payment_method_id = ?", query.PaymentMethodID)
	}
	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.DateFrom != "" {
		db = db.Where("reconciliation_date >= ?", query.DateFrom)
	}
	if query.DateTo != "" {
		db = db.Where("reconciliation_date <= ?", query.DateTo)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []ReconciliationResponse
	err := db.Order("reconciliation_date DESC").Offset((query.Page - 1) * query.Limit).Limit(query.Limit).Scan(&rows).Error
	return rows, total, err
}

func (r *Repository) FindReconciliation(businessID, id string) (*ReconciliationResponse, error) {
	var row ReconciliationResponse
	err := r.db.Table("payment_reconciliations").Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Take(&row).Error
	return &row, err
}

func applyPaymentFilters(db *gorm.DB, q PaymentListQuery) *gorm.DB {
	if q.Search != "" {
		like := "%" + strings.ToLower(q.Search) + "%"
		db = db.Where("LOWER(sp.reference_number) LIKE ? OR LOWER(sp.provider_transaction_id) LIKE ? OR LOWER(s.sale_number) LIKE ?", like, like, like)
	}
	if q.SaleID != "" {
		db = db.Where("sp.sale_id = ?", q.SaleID)
	}
	if q.PaymentMethodID != "" {
		db = db.Where("sp.payment_method_id = ?", q.PaymentMethodID)
	}
	if q.PaymentStatus != "" {
		db = db.Where("sp.payment_status = ?", q.PaymentStatus)
	}
	if q.BranchID != "" {
		db = db.Where("sp.branch_id = ?", q.BranchID)
	}
	if q.PaidByUserID != "" {
		db = db.Where("sp.paid_by_user_id = ?", q.PaidByUserID)
	}
	if q.DateFrom != "" {
		db = db.Where("sp.paid_at >= ?", q.DateFrom)
	}
	if q.DateTo != "" {
		db = db.Where("sp.paid_at <= ?", q.DateTo)
	}
	return db
}

func applyRefundFilters(db *gorm.DB, q RefundListQuery) *gorm.DB {
	if q.SaleID != "" {
		db = db.Where("payment_refunds.sale_id = ?", q.SaleID)
	}
	if q.PaymentMethodID != "" {
		db = db.Where("payment_refunds.payment_method_id = ?", q.PaymentMethodID)
	}
	if q.RefundStatus != "" {
		db = db.Where("payment_refunds.refund_status = ?", q.RefundStatus)
	}
	if q.BranchID != "" {
		db = db.Where("payment_refunds.branch_id = ?", q.BranchID)
	}
	if q.DateFrom != "" {
		db = db.Where("payment_refunds.refunded_at >= ?", q.DateFrom)
	}
	if q.DateTo != "" {
		db = db.Where("payment_refunds.refunded_at <= ?", q.DateTo)
	}
	return db
}

func safePaymentSortBy(value string) string {
	switch value {
	case "amount", "payment_status", "created_at", "paid_at", "source_type", "source_number", "customer_name", "payment_method_name", "branch_name":
		return value
	default:
		return "paid_at"
	}
}

func normalizePagination(page, limit int) (int, int) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	return page, limit
}

func totalPages(total int64, limit int) int {
	if limit <= 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(limit)))
}

func roundMoney(value float64) float64 {
	return math.Round(value*100) / 100
}

func (row paymentScanRow) toResponse() PaymentResponse {
	paymentID := row.PaymentID
	if paymentID == "" {
		paymentID = row.ID
	}
	sourceType := row.SourceType
	if sourceType == "" && row.SaleID != "" {
		sourceType = "pos_sale"
	}
	sourceID := row.SourceID
	if sourceID == "" {
		sourceID = row.SaleID
	}
	sourceNumber := row.SourceNumber
	if sourceNumber == "" {
		sourceNumber = row.SaleNumber
	}
	paymentMethodName := row.PaymentMethodName
	if paymentMethodName == "" {
		paymentMethodName = row.PaymentMethodNameSnapshot
	}
	paymentMethodType := row.PaymentMethodType
	if paymentMethodType == "" {
		paymentMethodType = row.PaymentMethodTypeSnapshot
	}
	return PaymentResponse{
		ID:                        row.ID,
		PaymentID:                 paymentID,
		BusinessID:                row.BusinessID,
		BranchID:                  row.BranchID,
		BranchName:                row.BranchName,
		SaleID:                    row.SaleID,
		SaleNumber:                row.SaleNumber,
		SourceType:                sourceType,
		SourceID:                  sourceID,
		SourceNumber:              sourceNumber,
		CustomerName:              row.CustomerName,
		PaymentMethodID:           row.PaymentMethodID,
		PaymentMethodNameSnapshot: row.PaymentMethodNameSnapshot,
		PaymentMethodTypeSnapshot: row.PaymentMethodTypeSnapshot,
		PaymentMethodName:         paymentMethodName,
		PaymentMethodType:         paymentMethodType,
		Amount:                    row.Amount,
		ReferenceNumber:           row.ReferenceNumber,
		ProviderTransactionID:     row.ProviderTransactionID,
		PaymentStatus:             row.PaymentStatus,
		PaymentType:               row.PaymentType,
		PaidByUserID:              row.PaidByUserID,
		PaidByUserName:            row.PaidByUserName,
		Notes:                     row.Notes,
		PaidAt:                    row.PaidAt,
		CreatedAt:                 row.CreatedAt,
		UpdatedAt:                 row.UpdatedAt,
	}
}

func toPaymentResponses(rows []paymentScanRow) []PaymentResponse {
	responses := make([]PaymentResponse, 0, len(rows))
	for _, row := range rows {
		responses = append(responses, row.toResponse())
	}
	return responses
}

func sumCollectedAmount(rows []PaymentSummaryByMethod) float64 {
	total := 0.0
	for _, row := range rows {
		total += row.CollectedAmount
	}
	return roundMoney(total)
}

func operationalSummaryFromRows(rows []PaymentSummaryByMethod, posCollected, bakeryCollected, depositCollected, balanceCollected, fullCollected float64) *operationalPaymentSummary {
	summary := &operationalPaymentSummary{
		Rows:             rows,
		POSCollected:     roundMoney(posCollected),
		BakeryCollected:  roundMoney(bakeryCollected),
		DepositCollected: roundMoney(depositCollected),
		BalanceCollected: roundMoney(balanceCollected),
		FullCollected:    roundMoney(fullCollected),
	}
	for _, row := range rows {
		summary.TotalCollected += row.CollectedAmount
		summary.TotalRefunded += row.RefundedAmount
		summary.PaymentsCount += row.GrossTransactionCount
		summary.RefundsCount += row.RefundTransactionCount
	}
	summary.TotalCollected = roundMoney(summary.TotalCollected)
	summary.TotalRefunded = roundMoney(summary.TotalRefunded)
	summary.NetCollected = roundMoney(summary.TotalCollected - summary.TotalRefunded)
	return summary
}

func dailySummaryFromOperational(dateLabel, branchID string, summary *operationalPaymentSummary, warnings []PaymentConsistencyWarning) *DailySummaryResponse {
	return &DailySummaryResponse{
		Date:                dateLabel,
		BranchID:            branchID,
		TotalCollected:      summary.TotalCollected,
		TotalRefunded:       summary.TotalRefunded,
		NetCollected:        summary.NetCollected,
		POSCollected:        summary.POSCollected,
		BakeryCollected:     summary.BakeryCollected,
		DepositCollected:    summary.DepositCollected,
		BalanceCollected:    summary.BalanceCollected,
		FullCollected:       summary.FullCollected,
		PaymentsCount:       summary.PaymentsCount,
		RefundsCount:        summary.RefundsCount,
		ByMethod:            summary.Rows,
		SourceOfTruth:       "payment_transactions",
		ConsistencyWarnings: warnings,
	}
}

func mergePaymentSummaryRows(collectedRows, refundRows []PaymentSummaryByMethod) []PaymentSummaryByMethod {
	byMethod := make(map[string]*PaymentSummaryByMethod)
	order := make([]string, 0, len(collectedRows)+len(refundRows))
	for _, row := range collectedRows {
		normalizePaymentSummaryCounts(&row)
		key := row.PaymentMethodID
		existing, ok := byMethod[key]
		if !ok {
			copyRow := row
			byMethod[key] = &copyRow
			order = append(order, key)
			continue
		}
		existing.CollectedAmount = roundMoney(existing.CollectedAmount + row.CollectedAmount)
		existing.TotalAmount = roundMoney(existing.TotalAmount + row.TotalAmount)
		existing.GrossTransactionCount += row.GrossTransactionCount
		existing.TransactionCount = existing.GrossTransactionCount
		existing.Count = existing.GrossTransactionCount
		if existing.PaymentMethodName == "" {
			existing.PaymentMethodName = row.PaymentMethodName
		}
		if existing.PaymentMethodType == "" {
			existing.PaymentMethodType = row.PaymentMethodType
		}
	}
	for _, row := range refundRows {
		normalizePaymentSummaryCounts(&row)
		key := row.PaymentMethodID
		existing, ok := byMethod[key]
		if !ok {
			copyRow := row
			byMethod[key] = &copyRow
			order = append(order, key)
			continue
		}
		existing.RefundedAmount = roundMoney(existing.RefundedAmount + row.RefundedAmount)
		existing.RefundAmount = roundMoney(existing.RefundAmount + row.RefundAmount)
		existing.RefundTransactionCount += row.RefundTransactionCount
		if existing.PaymentMethodName == "" {
			existing.PaymentMethodName = row.PaymentMethodName
		}
	}
	result := make([]PaymentSummaryByMethod, 0, len(order))
	seen := map[string]struct{}{}
	for _, key := range order {
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		row := *byMethod[key]
		normalizePaymentSummaryCounts(&row)
		result = append(result, row)
	}
	return result
}

func normalizePaymentSummaryCounts(row *PaymentSummaryByMethod) {
	if row.GrossTransactionCount == 0 {
		row.GrossTransactionCount = row.TransactionCount
	}
	if row.RefundTransactionCount == 0 && row.Count > 0 && row.GrossTransactionCount == 0 {
		row.RefundTransactionCount = row.Count
	}
	row.TransactionCount = row.GrossTransactionCount
	row.Count = row.GrossTransactionCount
	row.NetTransactionCount = row.GrossTransactionCount - row.RefundTransactionCount
	if row.NetTransactionCount < 0 {
		row.NetTransactionCount = 0
	}
}
