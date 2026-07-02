package pos

import (
	"fmt"
	"math"
	"strings"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/charges"
)

type Repository struct {
	db *gorm.DB
}

const posProductSelect = `
	p.id,
	p.business_id,
	p.branch_id,
	p.category_id,
	p.unit_id,
	tr.id AS tax_rate_id,
	p.product_name,
	p.product_code,
	p.sku,
	p.barcode,
	p.product_type,
	p.item_structure,
	p.sale_price,
	p.image_file_id,
	p.is_stock_tracked,
	p.status,
	pc.category_name,
	pc.category_code,
	u.unit_name,
	u.symbol,
	COALESCE(tr.tax_name, '') AS tax_name,
	COALESCE(tr.tax_type, '') AS tax_type,
	COALESCE(tr.rate_percentage, 0) AS rate_percentage,
	COALESCE(tr.is_inclusive, false) AS is_inclusive
`

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) ListPOSProducts(businessID, branchID string, query POSProductQuery) ([]ProductRow, int64, error) {
	db := r.db.Table("products p").
		Select(posProductSelect).
		Joins("JOIN product_categories pc ON pc.id = p.category_id AND pc.branch_id = p.branch_id").
		Joins("JOIN units u ON u.id = p.unit_id").
		Joins("LEFT JOIN tax_rates tr ON tr.id = p.tax_rate_id AND tr.business_id = p.business_id AND tr.status = ? AND tr.deleted_at IS NULL", "active").
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

func (r *Repository) ListPOSPaymentMethods(businessID, branchID string) ([]POSPaymentMethodResponse, error) {
	var rows []POSPaymentMethodResponse
	err := r.db.Table("payment_methods pm").
		Select(`
			pm.id,
			pm.business_id,
			pm.method_name,
			pm.method_type,
			pm.is_default,
			pm.status,
			pm.show_in_pos,
			pm.show_in_bakery_orders,
			pm.show_in_purchasing,
			pm.show_in_expenses,
			pm.show_in_dashboard_collection,
			pm.allow_split_payment,
			pm.requires_reference,
			pa.id::text AS default_payment_account_id,
			pa.account_name AS default_payment_account_name,
			pa.branch_id,
			COALESCE(account_branch.branch_name, checkout_branch.branch_name, '') AS branch_name,
			pm.created_at::text AS created_at,
			pm.updated_at::text AS updated_at
		`).
		Joins("LEFT JOIN payment_method_account_mappings pmam ON pmam.payment_method_id = pm.id AND pmam.business_id = pm.business_id AND pmam.branch_id = ? AND pmam.status = ? AND pmam.deleted_at IS NULL", branchID, "active").
		Joins("JOIN payment_accounts pa ON pa.id = COALESCE(pmam.payment_account_id, pm.default_payment_account_id) AND pa.business_id = pm.business_id AND pa.status = ? AND pa.deleted_at IS NULL", "active").
		Joins("LEFT JOIN branches account_branch ON account_branch.id = pa.branch_id AND account_branch.business_id = pm.business_id AND account_branch.deleted_at IS NULL").
		Joins("LEFT JOIN branches checkout_branch ON checkout_branch.id = ? AND checkout_branch.business_id = pm.business_id AND checkout_branch.deleted_at IS NULL", branchID).
		Where("pm.business_id = ? AND pm.status = ? AND pm.show_in_pos = ? AND COALESCE(pmam.payment_account_id, pm.default_payment_account_id) IS NOT NULL AND pm.deleted_at IS NULL", businessID, "active", true).
		Where("(pa.branch_id IS NULL OR pa.branch_id = ?)", branchID).
		Order("pm.is_default DESC, pm.method_name ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) ListPOSProductCategories(businessID, branchID string) ([]POSProductCategoryOption, error) {
	var rows []POSProductCategoryOption
	err := r.db.Table("product_categories").
		Select("id, business_id, branch_id, parent_category_id, category_name, category_code, description, image_file_id, sort_order, status, created_at, updated_at").
		Where("business_id = ? AND branch_id = ? AND status = ? AND deleted_at IS NULL", businessID, branchID, "active").
		Order("sort_order ASC, category_name ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) ListPOSUnits(businessID string) ([]POSUnitOption, error) {
	var rows []POSUnitOption
	err := r.db.Table("units u").
		Select(`
			u.id,
			u.business_id,
			u.unit_category_id,
			uc.name AS unit_category_name,
			u.unit_name,
			u.symbol,
			u.base_unit_id,
			u.conversion_factor,
			u.decimal_precision,
			u.is_system_default,
			u.status,
			u.created_at,
			u.updated_at
		`).
		Joins("JOIN unit_categories uc ON uc.id = u.unit_category_id").
		Where("(u.business_id IS NULL OR u.business_id = ?) AND u.status = ? AND u.deleted_at IS NULL", businessID, "active").
		Order("u.is_system_default DESC, u.unit_name ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) ListPOSTaxRates(businessID string) ([]POSTaxRateOption, error) {
	var rows []POSTaxRateOption
	err := r.db.Table("tax_rates").
		Select("id, business_id, tax_name, tax_type, rate_percentage, is_inclusive, country, region, is_default, status, created_at, updated_at").
		Where("business_id = ? AND status = ? AND deleted_at IS NULL", businessID, "active").
		Order("is_default DESC, tax_name ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) ListPOSSalesChannels(businessID string) ([]POSSalesChannelOption, error) {
	var rows []POSSalesChannelOption
	err := r.db.Table("sales_channels sc").
		Select(`
			sc.id,
			sc.business_id,
			sc.channel_name,
			sc.channel_type,
			sc.requires_external_order_number,
			sc.default_payment_method_id,
			COALESCE(pm.method_name, '') AS default_payment_method_name,
			sc.commission_rate,
			sc.is_default,
			sc.status,
			sc.created_at,
			sc.updated_at
		`).
		Joins("LEFT JOIN payment_methods pm ON pm.id = sc.default_payment_method_id AND pm.business_id = sc.business_id AND pm.deleted_at IS NULL").
		Where("sc.business_id = ? AND sc.status = ? AND sc.deleted_at IS NULL", businessID, "active").
		Order("sc.is_default DESC, sc.channel_name ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) ListPOSReceiptLayouts(businessID, branchID string) ([]POSReceiptLayoutOption, error) {
	var rows []POSReceiptLayoutOption
	err := r.db.Table("receipt_layouts").
		Select("id, business_id, branch_id, layout_name, receipt_type, printer_type, counter_id, is_default, status, layout_config, created_at, updated_at").
		Where("business_id = ? AND status = ? AND deleted_at IS NULL", businessID, "active").
		Where("(branch_id IS NULL OR branch_id = ?)", branchID).
		Order("branch_id ASC NULLS LAST, is_default DESC, layout_name ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) FindPOSProductByID(tx *gorm.DB, businessID, branchID, productID string) (*ProductRow, error) {
	var row ProductRow
	err := tx.Table("products p").
		Select(posProductSelect).
		Joins("JOIN product_categories pc ON pc.id = p.category_id AND pc.branch_id = p.branch_id").
		Joins("JOIN units u ON u.id = p.unit_id").
		Joins("LEFT JOIN tax_rates tr ON tr.id = p.tax_rate_id AND tr.business_id = p.business_id AND tr.status = ? AND tr.deleted_at IS NULL", "active").
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
		Select("pv.*, COALESCE(ii.current_quantity, 0) AS current_stock_quantity, COALESCE(ii.available_quantity, 0) AS available_stock_quantity").
		Joins("JOIN products p ON p.id = pv.product_id AND p.business_id = pv.business_id AND p.deleted_at IS NULL").
		Joins("LEFT JOIN inventory_items ii ON ii.business_id = pv.business_id AND ii.branch_id = p.branch_id AND ii.item_type = ? AND ii.product_id = pv.product_id AND ii.product_variant_id = pv.id AND ii.deleted_at IS NULL", "product_variant").
		Where("pv.id = ? AND pv.product_id = ? AND pv.business_id = ? AND p.branch_id = ? AND pv.status = ? AND pv.deleted_at IS NULL", variantID, productID, businessID, branchID, "active").
		Take(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) FindProductInventoryForSale(tx *gorm.DB, businessID, branchID, productID string, variantID *string) (*ProductInventoryStockRow, error) {
	var row ProductInventoryStockRow
	query := tx.Table("products p").
		Select("p.id AS product_id, p.product_name, p.is_stock_tracked, ii.id AS inventory_item_id, COALESCE(ii.available_quantity, 0) AS available_quantity").
		Where("p.id = ? AND p.business_id = ? AND p.branch_id = ? AND p.deleted_at IS NULL", productID, businessID, branchID)
	if variantID != nil && strings.TrimSpace(*variantID) != "" {
		query = query.Select("p.id AS product_id, p.product_name, pv.id AS product_variant_id, pv.variant_name, p.is_stock_tracked, ii.id AS inventory_item_id, COALESCE(ii.available_quantity, 0) AS available_quantity").
			Joins("JOIN product_variants pv ON pv.product_id = p.id AND pv.business_id = p.business_id AND pv.id = ? AND pv.status = ? AND pv.deleted_at IS NULL", *variantID, "active").
			Joins("LEFT JOIN inventory_items ii ON ii.business_id = p.business_id AND ii.branch_id = ? AND ii.item_type = ? AND ii.product_id = p.id AND ii.product_variant_id = pv.id AND ii.deleted_at IS NULL", branchID, "product_variant")
	} else {
		query = query.Joins("LEFT JOIN inventory_items ii ON ii.business_id = p.business_id AND ii.branch_id = ? AND ii.item_type = ? AND ii.product_id = p.id AND ii.product_variant_id IS NULL AND ii.deleted_at IS NULL", branchID, "product")
	}
	err := query.Take(&row).Error
	return &row, err
}

func (r *Repository) LoadActiveVariants(businessID, branchID string, productIDs []string) (map[string][]POSVariantResponse, error) {
	result := map[string][]POSVariantResponse{}
	if len(productIDs) == 0 {
		return result, nil
	}

	var rows []VariantRow
	if err := r.db.Table("product_variants pv").
		Select("pv.*, COALESCE(ii.current_quantity, 0) AS current_stock_quantity, COALESCE(ii.available_quantity, 0) AS available_stock_quantity").
		Joins("LEFT JOIN inventory_items ii ON ii.business_id = pv.business_id AND ii.branch_id = ? AND ii.item_type = ? AND ii.product_id = pv.product_id AND ii.product_variant_id = pv.id AND ii.deleted_at IS NULL", branchID, "product_variant").
		Where("pv.business_id = ? AND pv.product_id IN ? AND pv.status = ? AND pv.deleted_at IS NULL", businessID, productIDs, "active").
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
			Select("pv.*, COALESCE(ii.current_quantity, 0) AS current_stock_quantity, COALESCE(ii.available_quantity, 0) AS available_stock_quantity").
			Joins("JOIN products p ON p.id = pv.product_id AND p.business_id = pv.business_id AND p.branch_id = ? AND p.deleted_at IS NULL", branchID).
			Joins("LEFT JOIN inventory_items ii ON ii.business_id = pv.business_id AND ii.branch_id = p.branch_id AND ii.item_type = ? AND ii.product_id = pv.product_id AND ii.product_variant_id = pv.id AND ii.deleted_at IS NULL", "product_variant").
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
		Select(posProductSelect).
		Joins("JOIN product_categories pc ON pc.id = p.category_id AND pc.branch_id = p.branch_id").
		Joins("JOIN units u ON u.id = p.unit_id").
		Joins("LEFT JOIN tax_rates tr ON tr.id = p.tax_rate_id AND tr.business_id = p.business_id AND tr.status = ? AND tr.deleted_at IS NULL", "active").
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
		Select("id, method_name, method_type, requires_reference, show_in_pos").
		Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", paymentMethodID, businessID, "active").
		Take(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) FindSalesChannel(tx *gorm.DB, businessID, channelID string) (*SalesChannelRow, error) {
	var row SalesChannelRow
	err := tx.Table("sales_channels").
		Select("id, channel_name, requires_external_order_number, status").
		Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", channelID, businessID, "active").
		Take(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) DefaultSalesChannel(tx *gorm.DB, businessID string) (*SalesChannelRow, error) {
	var row SalesChannelRow
	err := tx.Table("sales_channels").
		Select("id, channel_name, requires_external_order_number, status").
		Where("business_id = ? AND status = ? AND deleted_at IS NULL", businessID, "active").
		Order("is_default DESC, channel_name ASC").
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

func (r *Repository) GeneratePaymentRefundNumber(tx *gorm.DB, businessID string, createdAt time.Time) (string, error) {
	datePart := createdAt.Format("20060102")
	lockKey := businessID + ":" + datePart + ":payment_refunds"
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", lockKey).Error; err != nil {
		return "", err
	}
	var count int64
	prefix := "PAY-RFND-" + datePart + "-"
	if err := tx.Model(&POSPaymentRefund{}).Where("business_id = ? AND refund_number LIKE ?", businessID, prefix+"%").Count(&count).Error; err != nil {
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
	err := db.Select("s.id, s.sale_number, s.branch_id, b.branch_name, s.cashier_user_id, u.full_name AS cashier_name, s.customer_id, COALESCE(c.full_name, '') AS customer_name, s.sales_channel_id, s.sales_channel_name_snapshot, s.external_order_number, s.charge_amount, s.charge_tax_amount, s.total_amount, s.paid_amount, s.payment_status, s.sale_status, s.sold_at").
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
		ID:                       sale.ID,
		BusinessID:               sale.BusinessID,
		BranchID:                 sale.BranchID,
		CashierUserID:            sale.CashierUserID,
		CustomerID:               sale.CustomerID,
		SalesChannelID:           sale.SalesChannelID,
		SalesChannelNameSnapshot: sale.SalesChannelNameSnapshot,
		ExternalOrderNumber:      sale.ExternalOrderNumber,
		SaleNumber:               sale.SaleNumber,
		SubtotalAmount:           sale.SubtotalAmount,
		DiscountType:             sale.DiscountType,
		DiscountValue:            sale.DiscountValue,
		DiscountAmount:           sale.DiscountAmount,
		TaxableAmount:            sale.TaxableAmount,
		TaxAmount:                sale.TaxAmount,
		ChargeAmount:             sale.ChargeAmount,
		ChargeTaxAmount:          sale.ChargeTaxAmount,
		TotalAmount:              sale.TotalAmount,
		PaidAmount:               sale.PaidAmount,
		ChangeAmount:             sale.ChangeAmount,
		PaymentStatus:            sale.PaymentStatus,
		SaleStatus:               sale.SaleStatus,
		AccountingJournalEntryID: sale.AccountingJournalEntryID,
		Notes:                    sale.Notes,
		SoldAt:                   sale.SoldAt,
		CreatedAt:                sale.CreatedAt,
		UpdatedAt:                sale.UpdatedAt,
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
	chargeRows, err := charges.ListChargeResponses(r.db, sale.BusinessID, "pos_sale", sale.ID)
	if err != nil {
		return nil, err
	}
	response.Charges = chargeRows
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
		BusinessName:    company.BusinessDisplayName,
		BranchName:      response.BranchName,
		VATNumber:       company.VATNumber,
		ReceiptFooter:   company.ReceiptFooter,
		SaleNumber:      sale.SaleNumber,
		SoldAt:          sale.SoldAt,
		CashierName:     response.CashierName,
		CustomerID:      sale.CustomerID,
		CustomerName:    response.CustomerName,
		CustomerPhone:   response.CustomerPhone,
		Items:           response.Items,
		Subtotal:        sale.SubtotalAmount,
		Discount:        sale.DiscountAmount,
		TaxAmount:       sale.TaxAmount,
		ChargeAmount:    sale.ChargeAmount,
		ChargeTaxAmount: sale.ChargeTaxAmount,
		Total:           sale.TotalAmount,
		Charges:         response.Charges,
		Payments:        response.Payments,
		PaidAmount:      sale.PaidAmount,
		ChangeAmount:    sale.ChangeAmount,
		QRPlaceholder:   "",
	}, nil
}

func (r *Repository) SumRefunds(tx *gorm.DB, businessID, saleID string) (float64, error) {
	var total float64
	err := tx.Table("sale_refunds").Select("COALESCE(SUM(refund_amount), 0)").Where("business_id = ? AND sale_id = ?", businessID, saleID).Scan(&total).Error
	return total, err
}

func (r *Repository) SumOperationalRefunds(tx *gorm.DB, businessID, saleID string) (float64, error) {
	var total float64
	err := tx.Table("payment_refunds").
		Select("COALESCE(SUM(refund_amount), 0)").
		Where("business_id = ? AND sale_id = ? AND refund_status = ? AND deleted_at IS NULL", businessID, saleID, "completed").
		Scan(&total).Error
	return total, err
}

func (r *Repository) CreateRefund(tx *gorm.DB, refund *SaleRefund) error {
	return tx.Create(refund).Error
}

func (r *Repository) SalePaymentsForRefundAllocation(tx *gorm.DB, businessID, saleID string) ([]SalePayment, error) {
	var payments []SalePayment
	err := tx.
		Where("business_id = ? AND sale_id = ? AND payment_status IN ? AND deleted_at IS NULL", businessID, saleID, []string{"completed", "partially_refunded", "refunded"}).
		Order("paid_at ASC, created_at ASC").
		Find(&payments).Error
	return payments, err
}

func (r *Repository) SalePaymentRefundedAmount(tx *gorm.DB, businessID, salePaymentID string) (float64, error) {
	var total float64
	err := tx.Table("payment_refunds").
		Select("COALESCE(SUM(refund_amount), 0)").
		Where("business_id = ? AND sale_payment_id = ? AND refund_status = ? AND deleted_at IS NULL", businessID, salePaymentID, "completed").
		Scan(&total).Error
	return total, err
}

func (r *Repository) CreateOperationalPaymentRefund(tx *gorm.DB, refund *POSPaymentRefund) error {
	return tx.Create(refund).Error
}

func (r *Repository) UpdateSalePaymentStatus(tx *gorm.DB, businessID, salePaymentID, status string, updatedAt time.Time) error {
	result := tx.Model(&SalePayment{}).
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", salePaymentID, businessID).
		Updates(map[string]interface{}{
			"payment_status": status,
			"updated_at":     updatedAt,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
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
	chargeRows, err := charges.ListChargeResponses(r.db, businessID, "held_sale", heldSaleID)
	if err != nil {
		return nil, err
	}
	response.Charges = chargeRows
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
	ItemStructure  string
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
	ProductVariantID  *string
	VariantName       string
	IsStockTracked    bool
	InventoryItemID   *string
	AvailableQuantity float64
}

type VariantRow struct {
	ID                     string
	BusinessID             string
	ProductID              string
	VariantName            string
	SKU                    string
	Barcode                string
	SalePrice              float64
	ImageFileID            string
	CurrentStockQuantity   float64
	AvailableStockQuantity float64
	Status                 string
}

type PaymentMethodRow struct {
	ID                string
	MethodName        string
	MethodType        string
	RequiresReference bool
	ShowInPOS         bool
}

type SalesChannelRow struct {
	ID                          string
	ChannelName                 string
	RequiresExternalOrderNumber bool
	Status                      string
}

type heldSaleScanRow struct {
	ID                       string
	BusinessID               string
	BranchID                 string
	BranchName               string
	CashierUserID            string
	CashierName              string
	CustomerID               *string
	HoldNumber               string
	ItemCount                int
	EstimatedSubtotal        float64
	EstimatedDiscountAmount  float64
	EstimatedTaxAmount       float64
	EstimatedChargeAmount    float64
	EstimatedChargeTaxAmount float64
	EstimatedTotal           float64
	Status                   string
	Notes                    string
	HeldAt                   time.Time
	ResumedAt                *time.Time
	CancelledAt              *time.Time
	ExpiresAt                *time.Time
	CreatedAt                time.Time
	UpdatedAt                time.Time
}

func (row heldSaleScanRow) toResponse() HeldSaleResponse {
	return HeldSaleResponse{
		ID:                       row.ID,
		BusinessID:               row.BusinessID,
		BranchID:                 row.BranchID,
		BranchName:               row.BranchName,
		CashierUserID:            row.CashierUserID,
		CashierName:              row.CashierName,
		CustomerID:               row.CustomerID,
		HoldNumber:               row.HoldNumber,
		ItemCount:                row.ItemCount,
		EstimatedSubtotal:        row.EstimatedSubtotal,
		EstimatedDiscountAmount:  row.EstimatedDiscountAmount,
		EstimatedTaxAmount:       row.EstimatedTaxAmount,
		EstimatedChargeAmount:    row.EstimatedChargeAmount,
		EstimatedChargeTaxAmount: row.EstimatedChargeTaxAmount,
		EstimatedTotal:           row.EstimatedTotal,
		Status:                   row.Status,
		Notes:                    row.Notes,
		HeldAt:                   row.HeldAt,
		ResumedAt:                row.ResumedAt,
		CancelledAt:              row.CancelledAt,
		ExpiresAt:                row.ExpiresAt,
		CreatedAt:                row.CreatedAt,
		UpdatedAt:                row.UpdatedAt,
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
	if query.ItemStructure != "" {
		db = db.Where("p.item_structure = ?", query.ItemStructure)
	}
	return db
}

func applySalesFilters(db *gorm.DB, query SalesListQuery) *gorm.DB {
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(s.sale_number) LIKE ? OR LOWER(u.full_name) LIKE ? OR LOWER(s.external_order_number) LIKE ?", like, like, like)
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
	if query.SalesChannelID != "" {
		db = db.Where("s.sales_channel_id = ?", query.SalesChannelID)
	}
	if query.ExternalOrderNumber != "" {
		db = db.Where("LOWER(s.external_order_number) = LOWER(?)", strings.TrimSpace(query.ExternalOrderNumber))
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
