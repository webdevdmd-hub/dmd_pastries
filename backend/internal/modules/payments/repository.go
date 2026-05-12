package payments

import (
	"fmt"
	"math"
	"strings"
	"time"

	"gorm.io/gorm"
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
	BusinessID                string
	BranchID                  string
	SaleID                    string
	SaleNumber                string
	PaymentMethodID           string
	PaymentMethodNameSnapshot string
	PaymentMethodTypeSnapshot string
	Amount                    float64
	ReferenceNumber           string
	ProviderTransactionID     string
	PaymentStatus             string
	PaidByUserID              string
	PaidByUserName            string
	Notes                     string
	PaidAt                    time.Time
	CreatedAt                 time.Time
	UpdatedAt                 time.Time
}

func (r *Repository) ListPayments(businessID string, query PaymentListQuery) ([]PaymentResponse, int64, error) {
	db := r.db.Table("sale_payments sp").
		Joins("JOIN sales s ON s.id = sp.sale_id").
		Joins("LEFT JOIN users u ON u.id = sp.paid_by_user_id").
		Where("sp.business_id = ? AND sp.deleted_at IS NULL", businessID)
	db = applyPaymentFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	sortBy := safePaymentSortBy(query.SortBy)
	sortOrder := "desc"
	if strings.ToLower(query.SortOrder) == "asc" {
		sortOrder = "asc"
	}
	var rows []paymentScanRow
	err := db.Select("sp.*, s.sale_number, u.full_name AS paid_by_user_name").
		Order("sp." + sortBy + " " + sortOrder).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Scan(&rows).Error
	return toPaymentResponses(rows), total, err
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
	var count int64
	prefix := "PAY-RFND-" + datePart + "-"
	if err := tx.Model(&PaymentRefund{}).Where("business_id = ? AND refund_number LIKE ?", businessID, prefix+"%").Count(&count).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%06d", prefix, count+1), nil
}

func (r *Repository) ListRefunds(businessID string, query RefundListQuery) ([]PaymentRefundResponse, int64, error) {
	db := r.db.Table("payment_refunds").Where("business_id = ? AND deleted_at IS NULL", businessID)
	db = applyRefundFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []PaymentRefundResponse
	err := db.Order("refunded_at DESC").Offset((query.Page - 1) * query.Limit).Limit(query.Limit).Scan(&rows).Error
	return rows, total, err
}

func (r *Repository) FindRefund(businessID, refundID string) (*PaymentRefundResponse, error) {
	var row PaymentRefundResponse
	err := r.db.Table("payment_refunds").Where("id = ? AND business_id = ? AND deleted_at IS NULL", refundID, businessID).Take(&row).Error
	return &row, err
}

func (r *Repository) DailySummary(businessID, date, branchID string) (*DailySummaryResponse, error) {
	paymentWhere := "business_id = ? AND payment_status IN ? AND deleted_at IS NULL AND paid_at::date = ?"
	paymentArgs := []interface{}{businessID, []string{"completed", "partially_refunded", "refunded"}, date}
	refundWhere := "business_id = ? AND refund_status = ? AND deleted_at IS NULL AND refunded_at::date = ?"
	refundArgs := []interface{}{businessID, "completed", date}
	if branchID != "" {
		paymentWhere += " AND branch_id = ?"
		paymentArgs = append(paymentArgs, branchID)
		refundWhere += " AND branch_id = ?"
		refundArgs = append(refundArgs, branchID)
	}
	var collectedRows []PaymentSummaryByMethod
	if err := r.db.Table("sale_payments").
		Select("payment_method_id, payment_method_name_snapshot AS payment_method_name, payment_method_type_snapshot AS payment_method_type, COALESCE(SUM(amount), 0) AS collected_amount, COUNT(*) AS transaction_count").
		Where(paymentWhere, paymentArgs...).
		Group("payment_method_id, payment_method_name_snapshot, payment_method_type_snapshot").
		Scan(&collectedRows).Error; err != nil {
		return nil, err
	}
	var refundRows []PaymentSummaryByMethod
	if err := r.db.Table("payment_refunds").
		Select("payment_method_id, payment_method_name_snapshot AS payment_method_name, COALESCE(SUM(refund_amount), 0) AS refunded_amount, COUNT(*) AS count").
		Where(refundWhere, refundArgs...).
		Group("payment_method_id, payment_method_name_snapshot").
		Scan(&refundRows).Error; err != nil {
		return nil, err
	}
	rows := mergePaymentSummaryRows(collectedRows, refundRows)
	totalCollected, totalRefunded, count := 0.0, 0.0, int64(0)
	for i := range rows {
		rows[i].NetAmount = roundMoney(rows[i].CollectedAmount - rows[i].RefundedAmount)
		totalCollected += rows[i].CollectedAmount
		totalRefunded += rows[i].RefundedAmount
		count += rows[i].TransactionCount
	}
	refundsCount := int64(0)
	if err := r.db.Table("payment_refunds").Where(refundWhere, refundArgs...).Count(&refundsCount).Error; err != nil {
		return nil, err
	}
	return &DailySummaryResponse{Date: date, BranchID: branchID, TotalCollected: roundMoney(totalCollected), TotalRefunded: roundMoney(totalRefunded), NetCollected: roundMoney(totalCollected - totalRefunded), PaymentsCount: count, RefundsCount: refundsCount, ByMethod: rows}, nil
}

func (r *Repository) MethodSummary(businessID, dateFrom, dateTo, branchID string) ([]PaymentSummaryByMethod, error) {
	paymentWhere := "business_id = ? AND payment_status IN ? AND deleted_at IS NULL"
	paymentArgs := []interface{}{businessID, []string{"completed", "partially_refunded", "refunded"}}
	refundWhere := "business_id = ? AND refund_status = ? AND deleted_at IS NULL"
	refundArgs := []interface{}{businessID, "completed"}
	if dateFrom != "" {
		paymentWhere += " AND paid_at >= ?"
		refundWhere += " AND refunded_at >= ?"
		paymentArgs = append(paymentArgs, dateFrom)
		refundArgs = append(refundArgs, dateFrom)
	}
	if dateTo != "" {
		paymentWhere += " AND paid_at <= ?"
		refundWhere += " AND refunded_at <= ?"
		paymentArgs = append(paymentArgs, dateTo)
		refundArgs = append(refundArgs, dateTo)
	}
	if branchID != "" {
		paymentWhere += " AND branch_id = ?"
		refundWhere += " AND branch_id = ?"
		paymentArgs = append(paymentArgs, branchID)
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
	var refundRows []PaymentSummaryByMethod
	if err := r.db.Table("payment_refunds").
		Select("payment_method_id, payment_method_name_snapshot AS payment_method_name, COALESCE(SUM(refund_amount), 0) AS refunded_amount, COALESCE(SUM(refund_amount), 0) AS refund_amount").
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
	return rows, nil
}

func (r *Repository) ExpectedAmount(businessID, branchID, methodID string, date time.Time) (float64, error) {
	dateString := date.Format("2006-01-02")
	var collected, refunded float64
	if err := r.db.Table("sale_payments").Select("COALESCE(SUM(amount),0)").Where("business_id = ? AND branch_id = ? AND payment_method_id = ? AND payment_status IN ? AND deleted_at IS NULL AND paid_at::date = ?", businessID, branchID, methodID, []string{"completed", "partially_refunded", "refunded"}, dateString).Scan(&collected).Error; err != nil {
		return 0, err
	}
	if err := r.db.Table("payment_refunds").Select("COALESCE(SUM(refund_amount),0)").Where("business_id = ? AND branch_id = ? AND payment_method_id = ? AND refund_status = ? AND deleted_at IS NULL AND refunded_at::date = ?", businessID, branchID, methodID, "completed", dateString).Scan(&refunded).Error; err != nil {
		return 0, err
	}
	return roundMoney(collected - refunded), nil
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
		db = db.Where("sale_id = ?", q.SaleID)
	}
	if q.PaymentMethodID != "" {
		db = db.Where("payment_method_id = ?", q.PaymentMethodID)
	}
	if q.RefundStatus != "" {
		db = db.Where("refund_status = ?", q.RefundStatus)
	}
	if q.BranchID != "" {
		db = db.Where("branch_id = ?", q.BranchID)
	}
	if q.DateFrom != "" {
		db = db.Where("refunded_at >= ?", q.DateFrom)
	}
	if q.DateTo != "" {
		db = db.Where("refunded_at <= ?", q.DateTo)
	}
	return db
}

func safePaymentSortBy(value string) string {
	switch value {
	case "amount", "payment_status", "created_at":
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
	return PaymentResponse{
		ID:                        row.ID,
		BusinessID:                row.BusinessID,
		BranchID:                  row.BranchID,
		SaleID:                    row.SaleID,
		SaleNumber:                row.SaleNumber,
		PaymentMethodID:           row.PaymentMethodID,
		PaymentMethodNameSnapshot: row.PaymentMethodNameSnapshot,
		PaymentMethodTypeSnapshot: row.PaymentMethodTypeSnapshot,
		Amount:                    row.Amount,
		ReferenceNumber:           row.ReferenceNumber,
		ProviderTransactionID:     row.ProviderTransactionID,
		PaymentStatus:             row.PaymentStatus,
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

func mergePaymentSummaryRows(collectedRows, refundRows []PaymentSummaryByMethod) []PaymentSummaryByMethod {
	byMethod := make(map[string]*PaymentSummaryByMethod)
	order := make([]string, 0, len(collectedRows)+len(refundRows))
	for _, row := range collectedRows {
		key := row.PaymentMethodID
		copyRow := row
		if copyRow.Count == 0 {
			copyRow.Count = copyRow.TransactionCount
		}
		byMethod[key] = &copyRow
		order = append(order, key)
	}
	for _, row := range refundRows {
		key := row.PaymentMethodID
		existing, ok := byMethod[key]
		if !ok {
			copyRow := row
			byMethod[key] = &copyRow
			order = append(order, key)
			continue
		}
		existing.RefundedAmount = row.RefundedAmount
		existing.RefundAmount = row.RefundAmount
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
		result = append(result, *byMethod[key])
	}
	return result
}
