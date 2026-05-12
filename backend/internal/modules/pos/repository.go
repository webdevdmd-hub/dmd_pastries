package pos

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

func (r *Repository) ListPOSProducts(businessID, branchID string, query POSProductQuery) ([]ProductRow, int64, error) {
	db := r.db.Table("products p").
		Select("p.*, pc.category_name, pc.category_code, u.unit_name, u.symbol, tr.tax_name, tr.tax_type, tr.rate_percentage, tr.is_inclusive").
		Joins("JOIN product_categories pc ON pc.id = p.category_id AND pc.branch_id = p.branch_id").
		Joins("JOIN units u ON u.id = p.unit_id").
		Joins("LEFT JOIN tax_rates tr ON tr.id = p.tax_rate_id").
		Where("p.business_id = ? AND p.branch_id = ? AND p.status = ? AND p.is_pos_visible = ? AND p.deleted_at IS NULL", businessID, branchID, "active", true)
	db = applyPOSProductFilters(db, query)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []ProductRow
	err := db.Order("p.product_name ASC").
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Scan(&rows).Error
	return rows, total, err
}

func (r *Repository) FindPOSProductByID(tx *gorm.DB, businessID, branchID, productID string) (*ProductRow, error) {
	var row ProductRow
	err := tx.Table("products p").
		Select("p.*, pc.category_name, pc.category_code, u.unit_name, u.symbol, tr.tax_name, tr.tax_type, tr.rate_percentage, tr.is_inclusive").
		Joins("JOIN product_categories pc ON pc.id = p.category_id AND pc.branch_id = p.branch_id").
		Joins("JOIN units u ON u.id = p.unit_id").
		Joins("LEFT JOIN tax_rates tr ON tr.id = p.tax_rate_id").
		Where("p.id = ? AND p.business_id = ? AND p.branch_id = ? AND p.status = ? AND p.is_pos_visible = ? AND p.deleted_at IS NULL", productID, businessID, branchID, "active", true).
		Take(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) FindVariantByID(tx *gorm.DB, businessID, branchID, productID, variantID string) (*VariantRow, error) {
	var row VariantRow
	err := tx.Table("product_variants pv").
		Joins("JOIN products p ON p.id = pv.product_id AND p.business_id = pv.business_id AND p.deleted_at IS NULL").
		Where("pv.id = ? AND pv.product_id = ? AND pv.business_id = ? AND p.branch_id = ? AND pv.status = ? AND pv.deleted_at IS NULL", variantID, productID, businessID, branchID, "active").
		Take(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) FindProductInventoryForSale(tx *gorm.DB, businessID, branchID, productID string) (*ProductInventoryStockRow, error) {
	var row ProductInventoryStockRow
	err := tx.Table("products p").
		Select("p.id AS product_id, p.product_name, p.is_stock_tracked, ii.id AS inventory_item_id, COALESCE(ii.available_quantity, 0) AS available_quantity").
		Joins("LEFT JOIN inventory_items ii ON ii.business_id = p.business_id AND ii.branch_id = ? AND ii.item_type = ? AND ii.product_id = p.id AND ii.deleted_at IS NULL", branchID, "product").
		Where("p.id = ? AND p.business_id = ? AND p.branch_id = ? AND p.deleted_at IS NULL", productID, businessID, branchID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) LoadActiveVariants(businessID string, productIDs []string) (map[string][]POSVariantResponse, error) {
	result := map[string][]POSVariantResponse{}
	if len(productIDs) == 0 {
		return result, nil
	}

	var rows []VariantRow
	if err := r.db.Table("product_variants").
		Where("business_id = ? AND product_id IN ? AND status = ? AND deleted_at IS NULL", businessID, productIDs, "active").
		Order("sort_order ASC, variant_name ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	for _, row := range rows {
		result[row.ProductID] = append(result[row.ProductID], toPOSVariant(row))
	}
	return result, nil
}

func (r *Repository) LookupProduct(businessID, branchID, field, value string) (*ProductRow, *VariantRow, error) {
	if field == "sku" || field == "barcode" {
		var variant VariantRow
		err := r.db.Table("product_variants pv").
			Joins("JOIN products p ON p.id = pv.product_id AND p.business_id = pv.business_id AND p.branch_id = ? AND p.deleted_at IS NULL", branchID).
			Where("pv.business_id = ? AND pv.status = ? AND pv.deleted_at IS NULL", businessID, "active").
			Where("pv."+field+" = ?", value).
			Take(&variant).Error
		if err == nil {
			product, err := r.FindPOSProductByID(r.db, businessID, branchID, variant.ProductID)
			if err != nil {
				return nil, nil, err
			}
			return product, &variant, nil
		}
	}

	product, err := r.findPOSProductByLookup(businessID, branchID, field, value)
	if err != nil {
		return nil, nil, err
	}
	return product, nil, nil
}

func (r *Repository) findPOSProductByLookup(businessID, branchID, field, value string) (*ProductRow, error) {
	var row ProductRow
	err := r.db.Table("products p").
		Select("p.*, pc.category_name, pc.category_code, u.unit_name, u.symbol, tr.tax_name, tr.tax_type, tr.rate_percentage, tr.is_inclusive").
		Joins("JOIN product_categories pc ON pc.id = p.category_id AND pc.branch_id = p.branch_id").
		Joins("JOIN units u ON u.id = p.unit_id").
		Joins("LEFT JOIN tax_rates tr ON tr.id = p.tax_rate_id").
		Where("p.business_id = ? AND p.branch_id = ? AND p.status = ? AND p.is_pos_visible = ? AND p.deleted_at IS NULL", businessID, branchID, "active", true).
		Where("p."+field+" = ?", value).
		Take(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) BranchExists(tx *gorm.DB, businessID, branchID string) (bool, error) {
	var count int64
	err := tx.Table("branches").Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", branchID, businessID, "active").Count(&count).Error
	return count > 0, err
}

func (r *Repository) CustomerExists(tx *gorm.DB, businessID, branchID, customerID string) (bool, error) {
	if !tx.Migrator().HasTable("customers") {
		return false, nil
	}
	var count int64
	err := tx.Table("customers").Where("id = ? AND business_id = ? AND branch_id = ? AND status = ? AND deleted_at IS NULL", customerID, businessID, branchID, "active").Count(&count).Error
	return count > 0, err
}

func (r *Repository) FindPaymentMethod(tx *gorm.DB, businessID, paymentMethodID string) (*PaymentMethodRow, error) {
	var row PaymentMethodRow
	err := tx.Table("payment_methods").
		Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", paymentMethodID, businessID, "active").
		Take(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) GenerateSaleNumber(tx *gorm.DB, businessID string, soldAt time.Time) (string, error) {
	datePart := soldAt.Format("20060102")
	lockKey := businessID + ":" + datePart + ":sales"
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", lockKey).Error; err != nil {
		return "", err
	}

	var count int64
	prefix := "SALE-" + datePart + "-"
	if err := tx.Model(&Sale{}).Where("business_id = ? AND sale_number LIKE ?", businessID, prefix+"%").Count(&count).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%06d", prefix, count+1), nil
}

func (r *Repository) GenerateHoldNumber(tx *gorm.DB, businessID string, heldAt time.Time) (string, error) {
	datePart := heldAt.Format("20060102")
	lockKey := businessID + ":" + datePart + ":held_sales"
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", lockKey).Error; err != nil {
		return "", err
	}
	var count int64
	prefix := "HOLD-" + datePart + "-"
	if err := tx.Model(&HeldSale{}).Where("business_id = ? AND hold_number LIKE ?", businessID, prefix+"%").Count(&count).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%06d", prefix, count+1), nil
}

func (r *Repository) GenerateRefundNumber(tx *gorm.DB, businessID string, createdAt time.Time) (string, error) {
	datePart := createdAt.Format("20060102")
	lockKey := businessID + ":" + datePart + ":refunds"
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", lockKey).Error; err != nil {
		return "", err
	}
	var count int64
	prefix := "RFND-" + datePart + "-"
	if err := tx.Model(&SaleRefund{}).Where("business_id = ? AND refund_number LIKE ?", businessID, prefix+"%").Count(&count).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%06d", prefix, count+1), nil
}

func (r *Repository) CreateSale(tx *gorm.DB, sale *Sale, items []SaleItem, payments []SalePayment) error {
	if err := tx.Create(sale).Error; err != nil {
		return err
	}
	if len(items) > 0 {
		if err := tx.Create(&items).Error; err != nil {
			return err
		}
	}
	if len(payments) > 0 {
		if err := tx.Create(&payments).Error; err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) ListSales(businessID string, query SalesListQuery) ([]SaleSummaryResponse, int64, error) {
	db := r.db.Table("sales s").
		Joins("JOIN users u ON u.id = s.cashier_user_id").
		Joins("JOIN branches b ON b.id = s.branch_id").
		Joins("LEFT JOIN customers c ON c.id = s.customer_id AND c.business_id = s.business_id AND c.branch_id = s.branch_id").
		Where("s.business_id = ? AND s.deleted_at IS NULL", businessID)
	db = applySalesFilters(db, query)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	sortBy := safeSaleSortBy(query.SortBy)
	sortOrder := "desc"
	if strings.ToLower(query.SortOrder) == "asc" {
		sortOrder = "asc"
	}
	var rows []SaleSummaryResponse
	err := db.Select("s.id, s.sale_number, s.branch_id, b.branch_name, s.cashier_user_id, u.full_name AS cashier_name, s.customer_id, COALESCE(c.full_name, '') AS customer_name, s.total_amount, s.paid_amount, s.payment_status, s.sale_status, s.sold_at").
		Order("s." + sortBy + " " + sortOrder).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Scan(&rows).Error
	return rows, total, err
}

func (r *Repository) FindSaleByID(tx *gorm.DB, businessID, saleID string) (*Sale, error) {
	var sale Sale
	err := tx.Where("id = ? AND business_id = ? AND deleted_at IS NULL", saleID, businessID).Take(&sale).Error
	if err != nil {
		return nil, err
	}
	return &sale, nil
}

func (r *Repository) LoadSaleDetails(businessID, saleID string) (*SaleResponse, error) {
	sale, err := r.FindSaleByID(r.db, businessID, saleID)
	if err != nil {
		return nil, err
	}
	return r.toSaleResponse(*sale, true)
}

func (r *Repository) SaleItems(tx *gorm.DB, businessID, saleID string) ([]SaleItem, error) {
	var items []SaleItem
	err := tx.Where("business_id = ? AND sale_id = ?", businessID, saleID).Order("created_at ASC").Find(&items).Error
	return items, err
}

func (r *Repository) toSaleResponse(sale Sale, includeChildren bool) (*SaleResponse, error) {
	response := &SaleResponse{
		ID:             sale.ID,
		BusinessID:     sale.BusinessID,
		BranchID:       sale.BranchID,
		CashierUserID:  sale.CashierUserID,
		CustomerID:     sale.CustomerID,
		SaleNumber:     sale.SaleNumber,
		SubtotalAmount: sale.SubtotalAmount,
		DiscountType:   sale.DiscountType,
		DiscountValue:  sale.DiscountValue,
		DiscountAmount: sale.DiscountAmount,
		TaxableAmount:  sale.TaxableAmount,
		TaxAmount:      sale.TaxAmount,
		TotalAmount:    sale.TotalAmount,
		PaidAmount:     sale.PaidAmount,
		ChangeAmount:   sale.ChangeAmount,
		PaymentStatus:  sale.PaymentStatus,
		SaleStatus:     sale.SaleStatus,
		Notes:          sale.Notes,
		SoldAt:         sale.SoldAt,
		CreatedAt:      sale.CreatedAt,
		UpdatedAt:      sale.UpdatedAt,
	}

	_ = r.db.Table("users").Select("full_name").Where("id = ? AND business_id = ?", sale.CashierUserID, sale.BusinessID).Scan(&response.CashierName).Error
	_ = r.db.Table("branches").Select("branch_name").Where("id = ? AND business_id = ?", sale.BranchID, sale.BusinessID).Scan(&response.BranchName).Error
	if sale.CustomerID != nil {
		var customer struct {
			FullName string
			Phone    string
		}
		_ = r.db.Table("customers").Select("full_name, phone").Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", *sale.CustomerID, sale.BusinessID, sale.BranchID).Scan(&customer).Error
		response.CustomerName = customer.FullName
		response.CustomerPhone = customer.Phone
	}

	if !includeChildren {
		return response, nil
	}

	if err := r.db.Table("sale_items").Where("sale_id = ? AND business_id = ?", sale.ID, sale.BusinessID).Order("created_at ASC").Scan(&response.Items).Error; err != nil {
		return nil, err
	}
	if err := r.db.Table("sale_payments").Where("sale_id = ? AND business_id = ?", sale.ID, sale.BusinessID).Order("paid_at ASC").Scan(&response.Payments).Error; err != nil {
		return nil, err
	}
	if err := r.db.Table("sale_refunds").Where("sale_id = ? AND business_id = ?", sale.ID, sale.BusinessID).Order("created_at ASC").Scan(&response.Refunds).Error; err != nil {
		return nil, err
	}
	var saleVoid SaleVoidResponse
	result := r.db.Table("sale_voids").Where("sale_id = ? AND business_id = ?", sale.ID, sale.BusinessID).Limit(1).Scan(&saleVoid)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected > 0 {
		response.Void = &saleVoid
	}
	return response, nil
}

func (r *Repository) LoadReceipt(sale Sale) (*ReceiptReadyResponse, error) {
	response, err := r.toSaleResponse(sale, true)
	if err != nil {
		return nil, err
	}
	var company struct {
		BusinessDisplayName string
		VATNumber           string
		ReceiptFooter       string
	}
	_ = r.db.Table("company_settings").
		Select("business_display_name, vat_number, receipt_footer").
		Where("business_id = ?", sale.BusinessID).
		Take(&company).Error

	return &ReceiptReadyResponse{
		BusinessName:  company.BusinessDisplayName,
		BranchName:    response.BranchName,
		VATNumber:     company.VATNumber,
		ReceiptFooter: company.ReceiptFooter,
		SaleNumber:    sale.SaleNumber,
		SoldAt:        sale.SoldAt,
		CashierName:   response.CashierName,
		CustomerID:    sale.CustomerID,
		CustomerName:  response.CustomerName,
		CustomerPhone: response.CustomerPhone,
		Items:         response.Items,
		Subtotal:      sale.SubtotalAmount,
		Discount:      sale.DiscountAmount,
		TaxAmount:     sale.TaxAmount,
		Total:         sale.TotalAmount,
		Payments:      response.Payments,
		PaidAmount:    sale.PaidAmount,
		ChangeAmount:  sale.ChangeAmount,
		QRPlaceholder: "",
	}, nil
}

func (r *Repository) SumRefunds(tx *gorm.DB, businessID, saleID string) (float64, error) {
	var total float64
	err := tx.Table("sale_refunds").Select("COALESCE(SUM(refund_amount), 0)").Where("business_id = ? AND sale_id = ?", businessID, saleID).Scan(&total).Error
	return total, err
}

func (r *Repository) CreateRefund(tx *gorm.DB, refund *SaleRefund) error {
	return tx.Create(refund).Error
}

func (r *Repository) CreateVoid(tx *gorm.DB, saleVoid *SaleVoid) error {
	return tx.Create(saleVoid).Error
}

func (r *Repository) UpdateSale(tx *gorm.DB, businessID, saleID string, updates map[string]interface{}) error {
	result := tx.Model(&Sale{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", saleID, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) CreateHeldSale(tx *gorm.DB, heldSale *HeldSale, items []HeldSaleItem) error {
	if err := tx.Create(heldSale).Error; err != nil {
		return err
	}
	if len(items) > 0 {
		return tx.Create(&items).Error
	}
	return nil
}

func (r *Repository) ListHeldSales(businessID string, query HeldSalesListQuery) ([]HeldSaleResponse, int64, error) {
	db := r.db.Table("held_sales hs").
		Joins("JOIN users u ON u.id = hs.cashier_user_id").
		Joins("JOIN branches b ON b.id = hs.branch_id").
		Where("hs.business_id = ? AND hs.deleted_at IS NULL", businessID)
	db = applyHeldSalesFilters(db, query)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []heldSaleScanRow
	err := db.Select("hs.*, b.branch_name, u.full_name AS cashier_name").
		Order("hs.held_at DESC").
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Scan(&rows).Error
	return toHeldSaleResponses(rows), total, err
}

func (r *Repository) LoadHeldSaleDetails(businessID, heldSaleID string) (*HeldSaleResponse, error) {
	var row heldSaleScanRow
	if err := r.db.Table("held_sales hs").
		Select("hs.*, b.branch_name, u.full_name AS cashier_name").
		Joins("JOIN users u ON u.id = hs.cashier_user_id").
		Joins("JOIN branches b ON b.id = hs.branch_id").
		Where("hs.id = ? AND hs.business_id = ? AND hs.deleted_at IS NULL", heldSaleID, businessID).
		Take(&row).Error; err != nil {
		return nil, err
	}
	response := row.toResponse()
	if err := r.db.Table("held_sale_items").Where("held_sale_id = ? AND business_id = ?", heldSaleID, businessID).Order("sort_order ASC, created_at ASC").Scan(&response.Items).Error; err != nil {
		return nil, err
	}
	return &response, nil
}

func (r *Repository) FindHeldSale(tx *gorm.DB, businessID, heldSaleID string) (*HeldSale, error) {
	var heldSale HeldSale
	err := tx.Where("id = ? AND business_id = ? AND deleted_at IS NULL", heldSaleID, businessID).Take(&heldSale).Error
	if err != nil {
		return nil, err
	}
	return &heldSale, nil
}

func (r *Repository) HeldSaleItems(tx *gorm.DB, businessID, heldSaleID string) ([]HeldSaleItem, error) {
	var items []HeldSaleItem
	err := tx.Where("business_id = ? AND held_sale_id = ?", businessID, heldSaleID).Order("sort_order ASC, created_at ASC").Find(&items).Error
	return items, err
}

func (r *Repository) UpdateHeldSale(tx *gorm.DB, businessID, heldSaleID string, updates map[string]interface{}) error {
	result := tx.Model(&HeldSale{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", heldSaleID, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

type ProductRow struct {
	ID             string
	BusinessID     string
	BranchID       string
	CategoryID     string
	UnitID         string
	TaxRateID      *string
	ProductName    string
	ProductCode    string
	SKU            string
	Barcode        string
	ProductType    string
	SalePrice      float64
	ImageFileID    string
	IsStockTracked bool
	Status         string
	CategoryName   string
	CategoryCode   string
	UnitName       string
	Symbol         string
	TaxName        string
	TaxType        string
	RatePercentage float64
	IsInclusive    bool
}

type ProductInventoryStockRow struct {
	ProductID         string
	ProductName       string
	IsStockTracked    bool
	InventoryItemID   *string
	AvailableQuantity float64
}

type VariantRow struct {
	ID          string
	BusinessID  string
	ProductID   string
	VariantName string
	SKU         string
	Barcode     string
	SalePrice   float64
	ImageFileID string
	Status      string
}

type PaymentMethodRow struct {
	ID                string
	MethodName        string
	MethodType        string
	RequiresReference bool
}

type heldSaleScanRow struct {
	ID                      string
	BusinessID              string
	BranchID                string
	BranchName              string
	CashierUserID           string
	CashierName             string
	CustomerID              *string
	HoldNumber              string
	ItemCount               int
	EstimatedSubtotal       float64
	EstimatedDiscountAmount float64
	EstimatedTaxAmount      float64
	EstimatedTotal          float64
	Status                  string
	Notes                   string
	HeldAt                  time.Time
	ResumedAt               *time.Time
	CancelledAt             *time.Time
	ExpiresAt               *time.Time
	CreatedAt               time.Time
	UpdatedAt               time.Time
}

func (row heldSaleScanRow) toResponse() HeldSaleResponse {
	return HeldSaleResponse{
		ID:                      row.ID,
		BusinessID:              row.BusinessID,
		BranchID:                row.BranchID,
		BranchName:              row.BranchName,
		CashierUserID:           row.CashierUserID,
		CashierName:             row.CashierName,
		CustomerID:              row.CustomerID,
		HoldNumber:              row.HoldNumber,
		ItemCount:               row.ItemCount,
		EstimatedSubtotal:       row.EstimatedSubtotal,
		EstimatedDiscountAmount: row.EstimatedDiscountAmount,
		EstimatedTaxAmount:      row.EstimatedTaxAmount,
		EstimatedTotal:          row.EstimatedTotal,
		Status:                  row.Status,
		Notes:                   row.Notes,
		HeldAt:                  row.HeldAt,
		ResumedAt:               row.ResumedAt,
		CancelledAt:             row.CancelledAt,
		ExpiresAt:               row.ExpiresAt,
		CreatedAt:               row.CreatedAt,
		UpdatedAt:               row.UpdatedAt,
	}
}

func toHeldSaleResponses(rows []heldSaleScanRow) []HeldSaleResponse {
	responses := make([]HeldSaleResponse, 0, len(rows))
	for _, row := range rows {
		responses = append(responses, row.toResponse())
	}
	return responses
}

func applyPOSProductFilters(db *gorm.DB, query POSProductQuery) *gorm.DB {
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(p.product_name) LIKE ? OR LOWER(p.product_code) LIKE ? OR LOWER(p.sku) LIKE ? OR LOWER(p.barcode) LIKE ?", like, like, like, like)
	}
	if query.CategoryID != "" {
		db = db.Where("p.category_id = ?", query.CategoryID)
	}
	if query.ProductType != "" {
		db = db.Where("p.product_type = ?", query.ProductType)
	}
	return db
}

func applySalesFilters(db *gorm.DB, query SalesListQuery) *gorm.DB {
	if query.Search != "" {
		db = db.Where("LOWER(s.sale_number) LIKE ? OR LOWER(u.full_name) LIKE ?", "%"+strings.ToLower(query.Search)+"%", "%"+strings.ToLower(query.Search)+"%")
	}
	if query.BranchID != "" {
		db = db.Where("s.branch_id = ?", query.BranchID)
	}
	if query.SaleStatus != "" {
		db = db.Where("s.sale_status = ?", query.SaleStatus)
	}
	if query.PaymentStatus != "" {
		db = db.Where("s.payment_status = ?", query.PaymentStatus)
	}
	if query.CashierUserID != "" {
		db = db.Where("s.cashier_user_id = ?", query.CashierUserID)
	}
	if query.CustomerID != "" {
		db = db.Where("s.customer_id = ?", query.CustomerID)
	}
	if query.DateFrom != "" {
		db = db.Where("s.sold_at >= ?", query.DateFrom)
	}
	if query.DateTo != "" {
		db = db.Where("s.sold_at <= ?", query.DateTo)
	}
	return db
}

func applyHeldSalesFilters(db *gorm.DB, query HeldSalesListQuery) *gorm.DB {
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(hs.hold_number) LIKE ? OR LOWER(u.full_name) LIKE ?", like, like)
	}
	if query.BranchID != "" {
		db = db.Where("hs.branch_id = ?", query.BranchID)
	}
	if query.CashierUserID != "" {
		db = db.Where("hs.cashier_user_id = ?", query.CashierUserID)
	}
	if query.Status != "" {
		db = db.Where("hs.status = ?", query.Status)
	}
	return db
}

func safeSaleSortBy(value string) string {
	switch value {
	case "sale_number", "total_amount", "payment_status", "sale_status", "created_at":
		return value
	default:
		return "sold_at"
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
