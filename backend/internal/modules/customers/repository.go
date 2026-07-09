package customers

import (
	"fmt"
	"math"
	"strings"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/shared/utils"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(tx *gorm.DB, customer *Customer) error {
	return tx.Create(customer).Error
}

func (r *Repository) FindByID(id, businessID, branchID string) (*Customer, error) {
	var customer Customer
	err := r.db.Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).First(&customer).Error
	if err != nil {
		return nil, err
	}
	return &customer, nil
}

func (r *Repository) Update(tx *gorm.DB, id, businessID, branchID string, updates map[string]interface{}) error {
	result := tx.Model(&Customer{}).Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) List(businessID, branchID string, query CustomerListQuery) ([]Customer, int64, error) {
	db := r.db.Model(&Customer{}).Where("customers.business_id = ? AND customers.branch_id = ? AND customers.deleted_at IS NULL", businessID, branchID)
	db = applyCustomerFilters(db, query)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	sortOrder := "desc"
	if strings.ToLower(query.SortOrder) == "asc" {
		sortOrder = "asc"
	}

	var customers []Customer
	err := db.Order(fmt.Sprintf("customers.%s %s", safeCustomerSortBy(query.SortBy), sortOrder)).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&customers).Error
	return customers, total, err
}

func (r *Repository) Lookup(businessID, branchID string, query CustomerLookupQuery) ([]CustomerLookupItem, error) {
	db := r.db.Model(&Customer{}).Where("business_id = ? AND branch_id = ? AND status = ? AND deleted_at IS NULL", businessID, branchID, "active")
	if query.Phone != "" {
		db = db.Where("phone ILIKE ?", "%"+query.Phone+"%")
	}
	if query.Email != "" {
		db = db.Where("email ILIKE ?", "%"+query.Email+"%")
	}
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(full_name) LIKE ? OR LOWER(phone) LIKE ? OR LOWER(email) LIKE ? OR LOWER(customer_code) LIKE ?", like, like, like, like)
	}
	var customers []CustomerLookupItem
	err := db.Select("id, customer_code, full_name, phone, email, status").Order("full_name ASC").Limit(query.Limit).Scan(&customers).Error
	return customers, err
}

func (r *Repository) NextCustomerCode(tx *gorm.DB, businessID, branchID string) (string, error) {
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":"+branchID+":customers").Error; err != nil {
		return "", err
	}
	var count int64
	if err := tx.Model(&Customer{}).Where("business_id = ? AND branch_id = ?", businessID, branchID).Count(&count).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("CUST-%06d", count+1), nil
}

func (r *Repository) CustomerCodeExists(tx *gorm.DB, businessID, branchID, value string) (bool, error) {
	var count int64
	err := tx.Model(&Customer{}).Where("business_id = ? AND branch_id = ? AND LOWER(customer_code) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, value).Count(&count).Error
	return count > 0, err
}

func (r *Repository) PhoneExists(businessID, branchID, value, excludeID string) (bool, error) {
	return r.exists("phone", businessID, branchID, value, excludeID)
}

func (r *Repository) EmailExists(businessID, branchID, value, excludeID string) (bool, error) {
	return r.exists("email", businessID, branchID, value, excludeID)
}

func (r *Repository) FindByContact(businessID, branchID, phone, email string) (*Customer, error) {
	var customer Customer
	query := r.db.Where("business_id = ? AND branch_id = ? AND deleted_at IS NULL", businessID, branchID)
	if strings.TrimSpace(phone) != "" && strings.TrimSpace(email) != "" {
		query = query.Where("LOWER(phone) = LOWER(?) OR LOWER(email) = LOWER(?)", strings.TrimSpace(phone), strings.TrimSpace(email))
	} else if strings.TrimSpace(phone) != "" {
		query = query.Where("LOWER(phone) = LOWER(?)", strings.TrimSpace(phone))
	} else if strings.TrimSpace(email) != "" {
		query = query.Where("LOWER(email) = LOWER(?)", strings.TrimSpace(email))
	} else {
		return nil, gorm.ErrRecordNotFound
	}
	if err := query.Order("created_at ASC").First(&customer).Error; err != nil {
		return nil, err
	}
	return &customer, nil
}

func (r *Repository) LoadCustomerResponses(businessID string, customers []Customer) ([]CustomerResponse, error) {
	responses := make([]CustomerResponse, 0, len(customers))
	for _, customer := range customers {
		response, err := r.LoadCustomerResponse(businessID, customer)
		if err != nil {
			return nil, err
		}
		responses = append(responses, response)
	}
	return responses, nil
}

func (r *Repository) LoadCustomerResponse(businessID string, customer Customer) (CustomerResponse, error) {
	tags, err := r.ListCustomerTags(businessID, customer.BranchID, customer.ID)
	if err != nil {
		return CustomerResponse{}, err
	}
	response := toCustomerResponse(customer, tags)
	stats, err := r.BasicStats(businessID, customer.BranchID, customer.ID)
	if err == nil {
		response.Stats = stats
	}
	return response, nil
}

func (r *Repository) ListTags(businessID, branchID string) ([]CustomerTagResponse, error) {
	var tags []CustomerTagResponse
	err := r.db.Table("customer_tags").
		Select("id, tag_name, color, created_at, updated_at").
		Where("business_id = ? AND branch_id = ? AND deleted_at IS NULL", businessID, branchID).
		Order("tag_name ASC").
		Scan(&tags).Error
	return tags, err
}

func (r *Repository) FindTagByID(id, businessID, branchID string) (*CustomerTag, error) {
	var tag CustomerTag
	err := r.db.Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).First(&tag).Error
	if err != nil {
		return nil, err
	}
	return &tag, nil
}

func (r *Repository) CreateTag(tx *gorm.DB, tag *CustomerTag) error {
	return tx.Create(tag).Error
}

func (r *Repository) UpdateTag(tx *gorm.DB, id, businessID, branchID string, updates map[string]interface{}) error {
	result := tx.Model(&CustomerTag{}).Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) TagNameExists(businessID, branchID, value, excludeID string) (bool, error) {
	if strings.TrimSpace(value) == "" {
		return false, nil
	}
	var count int64
	query := r.db.Model(&CustomerTag{}).Where("business_id = ? AND branch_id = ? AND LOWER(tag_name) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, value)
	if excludeID != "" {
		query = query.Where("id <> ?", excludeID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *Repository) ReplaceCustomerTags(tx *gorm.DB, businessID, branchID, customerID string, tagIDs []string) error {
	if err := tx.Where("business_id = ? AND branch_id = ? AND customer_id = ?", businessID, branchID, customerID).Delete(&CustomerTagMapping{}).Error; err != nil {
		return err
	}
	for _, tagID := range tagIDs {
		mapping := CustomerTagMapping{
			ID:         utils.NewUUID(),
			BusinessID: businessID,
			BranchID:   branchID,
			CustomerID: customerID,
			TagID:      tagID,
		}
		if err := tx.Create(&mapping).Error; err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) AttachCustomerTag(tx *gorm.DB, businessID, branchID, customerID, tagID string) error {
	mapping := CustomerTagMapping{
		ID:         utils.NewUUID(),
		BusinessID: businessID,
		BranchID:   branchID,
		CustomerID: customerID,
		TagID:      tagID,
	}
	return tx.Where("business_id = ? AND branch_id = ? AND customer_id = ? AND tag_id = ?", businessID, branchID, customerID, tagID).FirstOrCreate(&mapping).Error
}

func (r *Repository) RemoveCustomerTag(tx *gorm.DB, businessID, branchID, customerID, tagID string) error {
	result := tx.Where("business_id = ? AND branch_id = ? AND customer_id = ? AND tag_id = ?", businessID, branchID, customerID, tagID).Delete(&CustomerTagMapping{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) ValidateTagIDs(businessID, branchID string, tagIDs []string) error {
	if len(tagIDs) == 0 {
		return nil
	}
	var count int64
	if err := r.db.Model(&CustomerTag{}).Where("business_id = ? AND branch_id = ? AND id IN ? AND deleted_at IS NULL", businessID, branchID, tagIDs).Count(&count).Error; err != nil {
		return err
	}
	if count != int64(len(uniqueStrings(tagIDs))) {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) ListCustomerTags(businessID, branchID, customerID string) ([]CustomerTagResponse, error) {
	var tags []CustomerTagResponse
	err := r.db.Table("customer_tags ct").
		Select("ct.id, ct.tag_name, ct.color, ct.created_at, ct.updated_at").
		Joins("JOIN customer_tag_mappings ctm ON ctm.tag_id = ct.id").
		Where("ctm.business_id = ? AND ctm.branch_id = ? AND ctm.customer_id = ? AND ct.business_id = ? AND ct.branch_id = ? AND ct.deleted_at IS NULL", businessID, branchID, customerID, businessID, branchID).
		Order("ct.tag_name ASC").
		Scan(&tags).Error
	return tags, err
}

func (r *Repository) CreateNote(tx *gorm.DB, note *CustomerNote) error {
	return tx.Create(note).Error
}

func (r *Repository) ListNotes(businessID, branchID, customerID string) ([]CustomerNoteResponse, error) {
	var notes []CustomerNoteResponse
	err := r.db.Table("customer_notes cn").
		Select("cn.id, cn.customer_id, cn.note, cn.created_by_user_id, u.full_name AS created_by_name, cn.created_at, cn.updated_at").
		Joins("LEFT JOIN users u ON u.id = cn.created_by_user_id").
		Where("cn.business_id = ? AND cn.branch_id = ? AND cn.customer_id = ? AND cn.deleted_at IS NULL", businessID, branchID, customerID).
		Order("cn.created_at DESC").
		Scan(&notes).Error
	return notes, err
}

func (r *Repository) DeleteNote(tx *gorm.DB, businessID, branchID, customerID, noteID string) error {
	result := tx.Model(&CustomerNote{}).
		Where("id = ? AND customer_id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", noteID, customerID, businessID, branchID).
		Update("deleted_at", gorm.DeletedAt{Time: time.Now().UTC(), Valid: true})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) BasicStats(businessID, branchID, customerID string) (*CustomerBasicStats, error) {
	full, err := r.Stats(businessID, branchID, customerID)
	if err != nil {
		return nil, err
	}
	return &CustomerBasicStats{
		TotalOrdersCount: full.TotalOrdersCount,
		LastPurchaseAt:   full.LastPurchaseAt,
		TotalSalesAmount: full.TotalSalesAmount,
		NetSpent:         full.NetSpent,
	}, nil
}

func (r *Repository) Stats(businessID, branchID, customerID string) (*CustomerStatsResponse, error) {
	var stats CustomerStatsResponse
	stats.CustomerID = customerID
	if err := r.db.Table("sales").
		Select("COALESCE(SUM(total_amount), 0) AS pos_sales_amount, COUNT(*) AS pos_sales_count, MAX(sold_at) AS last_purchase_at").
		Where("business_id = ? AND branch_id = ? AND customer_id = ? AND deleted_at IS NULL AND sale_status <> ?", businessID, branchID, customerID, "voided").
		Scan(&stats).Error; err != nil {
		return nil, err
	}
	if err := r.db.Table("bakery_orders").
		Select("COALESCE(SUM(total_amount), 0) AS bakery_orders_amount, COUNT(*) AS bakery_orders_count, MAX(event_date) AS last_order_at").
		Where("business_id = ? AND branch_id = ? AND customer_id = ? AND deleted_at IS NULL AND order_status <> ?", businessID, branchID, customerID, "cancelled").
		Scan(&stats).Error; err != nil {
		return nil, err
	}
	if err := r.db.Table("sale_payments sp").
		Joins("JOIN sales s ON s.id = sp.sale_id AND s.business_id = sp.business_id AND s.branch_id = sp.branch_id").
		Select("COALESCE(SUM(sp.amount), 0)").
		Where("sp.business_id = ? AND sp.branch_id = ? AND s.customer_id = ? AND sp.payment_status IN ? AND sp.deleted_at IS NULL AND s.deleted_at IS NULL AND s.sale_status <> ?", businessID, branchID, customerID, []string{"completed", "partially_refunded", "refunded"}, "voided").
		Scan(&stats.TotalPaidAmount).Error; err != nil {
		return nil, err
	}
	var bakeryPaid float64
	if err := r.db.Table("bakery_order_payments bop").
		Joins("JOIN bakery_orders bo ON bo.id = bop.bakery_order_id AND bo.business_id = bop.business_id").
		Select("COALESCE(SUM(bop.amount), 0)").
		Where("bop.business_id = ? AND bo.branch_id = ? AND bo.customer_id = ? AND bo.deleted_at IS NULL AND bo.order_status <> ?", businessID, branchID, customerID, "cancelled").
		Scan(&bakeryPaid).Error; err != nil {
		return nil, err
	}
	stats.TotalPaidAmount += bakeryPaid
	if err := r.db.Table("payment_refunds pr").
		Joins("JOIN sales s ON s.id = pr.sale_id AND s.business_id = pr.business_id AND s.branch_id = pr.branch_id").
		Select("COALESCE(SUM(pr.refund_amount), 0)").
		Where("pr.business_id = ? AND pr.branch_id = ? AND s.customer_id = ? AND pr.refund_status = ? AND pr.deleted_at IS NULL AND s.deleted_at IS NULL AND s.sale_status <> ?", businessID, branchID, customerID, "completed", "voided").
		Scan(&stats.TotalRefundedAmount).Error; err != nil {
		return nil, err
	}
	var saleRefunded float64
	if err := r.db.Table("sale_refunds sr").
		Joins("JOIN sales s ON s.id = sr.sale_id AND s.business_id = sr.business_id").
		Select("COALESCE(SUM(sr.refund_amount), 0)").
		Where("sr.business_id = ? AND s.branch_id = ? AND s.customer_id = ? AND s.deleted_at IS NULL AND s.sale_status <> ?", businessID, branchID, customerID, "voided").
		Scan(&saleRefunded).Error; err != nil {
		return nil, err
	}
	stats.TotalRefundedAmount += saleRefunded
	var posOutstanding float64
	if err := r.db.Table("sales").
		Select("COALESCE(SUM(total_amount - paid_amount), 0)").
		Where("business_id = ? AND branch_id = ? AND customer_id = ? AND deleted_at IS NULL AND sale_status <> ? AND payment_status IN ? AND (total_amount - paid_amount) > 0", businessID, branchID, customerID, "voided", []string{"unpaid", "partial"}).
		Scan(&posOutstanding).Error; err != nil {
		return nil, err
	}
	var bakeryOutstanding float64
	if err := r.db.Table("bakery_orders").
		Select("COALESCE(SUM(balance_amount), 0)").
		Where("business_id = ? AND branch_id = ? AND customer_id = ? AND deleted_at IS NULL AND order_status <> ? AND payment_status IN ? AND balance_amount > 0", businessID, branchID, customerID, "cancelled", []string{"unpaid", "partial"}).
		Scan(&bakeryOutstanding).Error; err != nil {
		return nil, err
	}
	var posPending, bakeryPending int64
	if err := r.db.Table("sales").
		Where("business_id = ? AND branch_id = ? AND customer_id = ? AND deleted_at IS NULL AND sale_status <> ? AND payment_status IN ? AND (total_amount - paid_amount) > 0", businessID, branchID, customerID, "voided", []string{"unpaid", "partial"}).
		Count(&posPending).Error; err != nil {
		return nil, err
	}
	if err := r.db.Table("bakery_orders").
		Where("business_id = ? AND branch_id = ? AND customer_id = ? AND deleted_at IS NULL AND order_status <> ? AND payment_status IN ? AND balance_amount > 0", businessID, branchID, customerID, "cancelled", []string{"unpaid", "partial"}).
		Count(&bakeryPending).Error; err != nil {
		return nil, err
	}
	stats.CustomerID = customerID
	stats.TotalSalesAmount = stats.POSSalesAmount + stats.BakeryOrdersAmount
	stats.TotalOrdersCount = stats.POSSalesCount + stats.BakeryOrdersCount
	stats.LastPurchaseAt = latestCustomerTime(stats.LastPurchaseAt, stats.LastOrderAt)
	stats.TotalSalesAmount = roundCustomerMoney(stats.TotalSalesAmount)
	stats.POSSalesAmount = roundCustomerMoney(stats.POSSalesAmount)
	stats.BakeryOrdersAmount = roundCustomerMoney(stats.BakeryOrdersAmount)
	stats.TotalPaidAmount = roundCustomerMoney(stats.TotalPaidAmount)
	stats.TotalRefundedAmount = roundCustomerMoney(stats.TotalRefundedAmount)
	stats.NetSpent = roundCustomerMoney(stats.TotalPaidAmount - stats.TotalRefundedAmount)
	stats.OutstandingBalance = roundCustomerMoney(posOutstanding + bakeryOutstanding)
	if stats.OutstandingBalance < 0 {
		stats.OutstandingBalance = 0
	}
	stats.PendingPayments = posPending + bakeryPending
	transactions, err := r.CustomerRecentTransactions(businessID, branchID, customerID, 10)
	if err != nil {
		return nil, err
	}
	stats.RecentTransactions = transactions
	return &stats, nil
}

func (r *Repository) CustomerRecentTransactions(businessID, branchID, customerID string, limit int) ([]CustomerTransactionResponse, error) {
	if limit <= 0 {
		limit = 10
	}
	query := `
		SELECT * FROM (
			SELECT
				s.id::text AS id,
				'pos_sale' AS source_type,
				s.id::text AS source_id,
				s.sale_number AS source_number,
				'POS sale' AS description,
				s.total_amount AS amount,
				s.sale_status AS status,
				s.payment_status AS payment_status,
				s.sold_at AS occurred_at
			FROM sales s
			WHERE s.business_id = ? AND s.branch_id = ? AND s.customer_id = ? AND s.deleted_at IS NULL AND s.sale_status <> 'voided'
			UNION ALL
			SELECT
				bo.id::text AS id,
				'bakery_order' AS source_type,
				bo.id::text AS source_id,
				bo.order_number AS source_number,
				'Bakery order' AS description,
				bo.total_amount AS amount,
				bo.order_status AS status,
				bo.payment_status AS payment_status,
				bo.event_date::timestamptz AS occurred_at
			FROM bakery_orders bo
			WHERE bo.business_id = ? AND bo.branch_id = ? AND bo.customer_id = ? AND bo.deleted_at IS NULL AND bo.order_status <> 'cancelled'
			UNION ALL
			SELECT
				sp.id::text AS id,
				'pos_payment' AS source_type,
				s.id::text AS source_id,
				s.sale_number AS source_number,
				COALESCE(NULLIF(sp.payment_method_name_snapshot, ''), 'POS payment') AS description,
				sp.amount AS amount,
				sp.payment_status AS status,
				sp.payment_status AS payment_status,
				sp.paid_at AS occurred_at
			FROM sale_payments sp
			JOIN sales s ON s.id = sp.sale_id AND s.business_id = sp.business_id AND s.branch_id = sp.branch_id
			WHERE sp.business_id = ? AND sp.branch_id = ? AND s.customer_id = ? AND sp.payment_status IN ('completed', 'partially_refunded', 'refunded') AND sp.deleted_at IS NULL AND s.deleted_at IS NULL AND s.sale_status <> 'voided'
			UNION ALL
			SELECT
				bop.id::text AS id,
				'bakery_payment' AS source_type,
				bo.id::text AS source_id,
				bo.order_number AS source_number,
				COALESCE(NULLIF(bop.payment_method_name_snapshot, ''), 'Bakery payment') AS description,
				bop.amount AS amount,
				'completed' AS status,
				'completed' AS payment_status,
				bop.paid_at AS occurred_at
			FROM bakery_order_payments bop
			JOIN bakery_orders bo ON bo.id = bop.bakery_order_id AND bo.business_id = bop.business_id
			WHERE bop.business_id = ? AND bo.branch_id = ? AND bo.customer_id = ? AND bo.deleted_at IS NULL AND bo.order_status <> 'cancelled'
			UNION ALL
			SELECT
				pr.id::text AS id,
				'refund' AS source_type,
				s.id::text AS source_id,
				COALESCE(NULLIF(pr.refund_number, ''), s.sale_number) AS source_number,
				COALESCE(NULLIF(pr.refund_reason, ''), 'Refund') AS description,
				pr.refund_amount AS amount,
				pr.refund_status AS status,
				pr.refund_status AS payment_status,
				pr.refunded_at AS occurred_at
			FROM payment_refunds pr
			JOIN sales s ON s.id = pr.sale_id AND s.business_id = pr.business_id AND s.branch_id = pr.branch_id
			WHERE pr.business_id = ? AND pr.branch_id = ? AND s.customer_id = ? AND pr.refund_status = 'completed' AND pr.deleted_at IS NULL AND s.deleted_at IS NULL AND s.sale_status <> 'voided'
			UNION ALL
			SELECT
				sr.id::text AS id,
				'sale_refund' AS source_type,
				s.id::text AS source_id,
				COALESCE(NULLIF(sr.refund_number, ''), s.sale_number) AS source_number,
				COALESCE(NULLIF(sr.reason, ''), 'Sale refund') AS description,
				sr.refund_amount AS amount,
				'completed' AS status,
				'completed' AS payment_status,
				sr.created_at AS occurred_at
			FROM sale_refunds sr
			JOIN sales s ON s.id = sr.sale_id AND s.business_id = sr.business_id
			WHERE sr.business_id = ? AND s.branch_id = ? AND s.customer_id = ? AND s.deleted_at IS NULL AND s.sale_status <> 'voided'
		) customer_transactions
		ORDER BY occurred_at DESC
		LIMIT ?`
	args := []interface{}{
		businessID, branchID, customerID,
		businessID, branchID, customerID,
		businessID, branchID, customerID,
		businessID, branchID, customerID,
		businessID, branchID, customerID,
		businessID, branchID, customerID,
		limit,
	}
	var transactions []CustomerTransactionResponse
	if err := r.db.Raw(query, args...).Scan(&transactions).Error; err != nil {
		return nil, err
	}
	return transactions, nil
}

func latestCustomerTime(a, b *time.Time) *time.Time {
	if a == nil {
		return b
	}
	if b == nil {
		return a
	}
	if b.After(*a) {
		return b
	}
	return a
}

func (r *Repository) exists(column, businessID, branchID, value, excludeID string) (bool, error) {
	if strings.TrimSpace(value) == "" {
		return false, nil
	}
	var count int64
	query := r.db.Model(&Customer{}).Where("business_id = ? AND branch_id = ? AND LOWER("+column+") = LOWER(?) AND deleted_at IS NULL", businessID, branchID, value)
	if excludeID != "" {
		query = query.Where("id <> ?", excludeID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

func applyCustomerFilters(db *gorm.DB, query CustomerListQuery) *gorm.DB {
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(customers.full_name) LIKE ? OR LOWER(customers.phone) LIKE ? OR LOWER(customers.email) LIKE ? OR LOWER(customers.customer_code) LIKE ?", like, like, like, like)
	}
	if query.Phone != "" {
		db = db.Where("customers.phone ILIKE ?", "%"+query.Phone+"%")
	}
	if query.Email != "" {
		db = db.Where("customers.email ILIKE ?", "%"+query.Email+"%")
	}
	if query.Status != "" {
		db = db.Where("customers.status = ?", query.Status)
	}
	if query.TagID != "" {
		db = db.Joins("JOIN customer_tag_mappings ctm ON ctm.customer_id = customers.id AND ctm.business_id = customers.business_id").
			Where("ctm.tag_id = ?", query.TagID)
	}
	if query.DateFrom != "" {
		db = db.Where("customers.created_at >= ?", query.DateFrom)
	}
	if query.DateTo != "" {
		db = db.Where("customers.created_at <= ?", query.DateTo)
	}
	return db
}

func safeCustomerSortBy(value string) string {
	switch value {
	case "full_name", "customer_code", "status", "updated_at":
		return value
	default:
		return "created_at"
	}
}

func customerTotalPages(total int64, limit int) int {
	if limit <= 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(limit)))
}

func uniqueStrings(values []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func roundCustomerMoney(value float64) float64 {
	return math.Round(value*100) / 100
}
