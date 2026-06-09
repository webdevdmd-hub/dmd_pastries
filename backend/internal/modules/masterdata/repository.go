package masterdata

import (
	"gorm.io/gorm"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateProductCategory(tx *gorm.DB, category *ProductCategory) error {
	return tx.Create(category).Error
}

func (r *Repository) ReplaceProductCategoryAllowedTypes(tx *gorm.DB, businessID, branchID, categoryID string, productTypes []string) error {
	if err := tx.Where("product_category_id = ? AND business_id = ? AND branch_id = ?", categoryID, businessID, branchID).Delete(&ProductCategoryAllowedType{}).Error; err != nil {
		return err
	}
	rows := make([]ProductCategoryAllowedType, 0, len(productTypes))
	for _, productType := range productTypes {
		rows = append(rows, ProductCategoryAllowedType{
			ID:                utils.NewUUID(),
			BusinessID:        businessID,
			BranchID:          branchID,
			ProductCategoryID: categoryID,
			ProductType:       productType,
		})
	}
	if len(rows) == 0 {
		return nil
	}
	return tx.Create(&rows).Error
}

func (r *Repository) ListUnitCategories() ([]UnitCategory, error) {
	var categories []UnitCategory
	err := r.db.Order("name ASC").Find(&categories).Error
	return categories, err
}

func (r *Repository) FindUnitCategory(id string) (*UnitCategory, error) {
	var category UnitCategory
	err := r.db.Where("id = ?", id).First(&category).Error
	if err != nil {
		return nil, err
	}
	return &category, nil
}

func (r *Repository) CreateUnit(tx *gorm.DB, unit *Unit) error {
	return tx.Create(unit).Error
}

func (r *Repository) ListUnits(businessID string) ([]Unit, error) {
	var units []Unit
	err := r.db.Preload("UnitCategory").
		Where("(business_id IS NULL OR business_id = ?) AND deleted_at IS NULL", businessID).
		Order("is_system_default DESC, unit_name ASC").
		Find(&units).Error
	return units, err
}

func (r *Repository) FindUnit(id, businessID string) (*Unit, error) {
	var unit Unit
	err := r.db.Preload("UnitCategory").
		Where("id = ? AND (business_id IS NULL OR business_id = ?) AND deleted_at IS NULL", id, businessID).
		First(&unit).Error
	if err != nil {
		return nil, err
	}
	return &unit, nil
}

func (r *Repository) UnitNameOrSymbolExists(businessID, name, symbol, excludedID string) (bool, error) {
	var count int64
	query := r.db.Model(&Unit{}).
		Where("deleted_at IS NULL").
		Where("(business_id IS NULL OR business_id = ?)", businessID).
		Where("(LOWER(unit_name) = LOWER(?) OR LOWER(symbol) = LOWER(?))", name, symbol)
	if excludedID != "" {
		query = query.Where("id <> ?", excludedID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *Repository) UpdateUnit(tx *gorm.DB, id, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&Unit{}).
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).
		Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperrors.NotFound("unit not found")
	}
	return nil
}

func (r *Repository) CreateOrderStatus(tx *gorm.DB, status *OrderStatus) error {
	return tx.Create(status).Error
}

func (r *Repository) ListOrderStatuses(businessID string) ([]OrderStatus, error) {
	var statuses []OrderStatus
	err := r.db.Where("(business_id IS NULL OR business_id = ?) AND deleted_at IS NULL", businessID).
		Order("sort_order ASC, status_name ASC").
		Find(&statuses).Error
	return statuses, err
}

func (r *Repository) FindOrderStatus(id, businessID string) (*OrderStatus, error) {
	var status OrderStatus
	err := r.db.Where("id = ? AND (business_id IS NULL OR business_id = ?) AND deleted_at IS NULL", id, businessID).First(&status).Error
	if err != nil {
		return nil, err
	}
	return &status, nil
}

func (r *Repository) OrderStatusKeyExists(businessID, key, excludedID string) (bool, error) {
	var count int64
	query := r.db.Model(&OrderStatus{}).
		Where("(business_id IS NULL OR business_id = ?) AND LOWER(status_key) = LOWER(?) AND deleted_at IS NULL", businessID, key)
	if excludedID != "" {
		query = query.Where("id <> ?", excludedID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *Repository) UpdateOrderStatus(tx *gorm.DB, id, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&OrderStatus{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperrors.NotFound("order status not found")
	}
	return nil
}

func (r *Repository) CreatePaymentStatus(tx *gorm.DB, status *PaymentStatus) error {
	return tx.Create(status).Error
}

func (r *Repository) ListPaymentStatuses(businessID string) ([]PaymentStatus, error) {
	var statuses []PaymentStatus
	err := r.db.Where("(business_id IS NULL OR business_id = ?) AND deleted_at IS NULL", businessID).
		Order("status_name ASC").
		Find(&statuses).Error
	return statuses, err
}

func (r *Repository) FindPaymentStatus(id, businessID string) (*PaymentStatus, error) {
	var status PaymentStatus
	err := r.db.Where("id = ? AND (business_id IS NULL OR business_id = ?) AND deleted_at IS NULL", id, businessID).First(&status).Error
	if err != nil {
		return nil, err
	}
	return &status, nil
}

func (r *Repository) PaymentStatusKeyExists(businessID, key, excludedID string) (bool, error) {
	var count int64
	query := r.db.Model(&PaymentStatus{}).
		Where("(business_id IS NULL OR business_id = ?) AND LOWER(status_key) = LOWER(?) AND deleted_at IS NULL", businessID, key)
	if excludedID != "" {
		query = query.Where("id <> ?", excludedID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *Repository) UpdatePaymentStatus(tx *gorm.DB, id, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&PaymentStatus{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperrors.NotFound("payment status not found")
	}
	return nil
}

func (r *Repository) ListProductCategories(businessID, branchID, productType string) ([]ProductCategory, error) {
	var categories []ProductCategory
	query := r.db.Model(&ProductCategory{}).
		Where("product_categories.business_id = ? AND product_categories.branch_id = ? AND product_categories.deleted_at IS NULL", businessID, branchID)
	if productType != "" {
		query = query.Joins("JOIN product_category_allowed_types pcat ON pcat.product_category_id = product_categories.id AND pcat.product_type = ?", productType)
	}
	err := query.Order("sort_order ASC, category_name ASC").Find(&categories).Error
	return categories, err
}

func (r *Repository) ListProductCategoriesTx(tx *gorm.DB, businessID, branchID string) ([]ProductCategory, error) {
	var categories []ProductCategory
	err := tx.Where("business_id = ? AND branch_id = ? AND deleted_at IS NULL", businessID, branchID).
		Order("sort_order ASC, category_name ASC").
		Find(&categories).Error
	return categories, err
}

func (r *Repository) FindProductCategory(id, businessID, branchID string) (*ProductCategory, error) {
	var category ProductCategory
	err := r.db.Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).First(&category).Error
	if err != nil {
		return nil, err
	}
	return &category, nil
}

func (r *Repository) ProductCategoryAllowedTypes(businessID, branchID string, categoryIDs []string) (map[string][]string, error) {
	result := make(map[string][]string, len(categoryIDs))
	if len(categoryIDs) == 0 {
		return result, nil
	}
	var rows []ProductCategoryAllowedType
	err := r.db.Where("business_id = ? AND branch_id = ? AND product_category_id IN ?", businessID, branchID, categoryIDs).
		Order("product_type ASC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.ProductCategoryID] = append(result[row.ProductCategoryID], row.ProductType)
	}
	return result, nil
}

func (r *Repository) CategoryAllowsProductType(businessID, branchID, categoryID, productType string) (bool, error) {
	var count int64
	err := r.db.Table("product_category_allowed_types").
		Where("business_id = ? AND branch_id = ? AND product_category_id = ? AND product_type = ?", businessID, branchID, categoryID, productType).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) FindActiveBranchTx(tx *gorm.DB, branchID, businessID string) error {
	var count int64
	err := tx.Table("branches").
		Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", branchID, businessID, "active").
		Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) FindProductCategoryByCodeTx(tx *gorm.DB, businessID, branchID, code string) (*ProductCategory, error) {
	var category ProductCategory
	err := tx.Where("business_id = ? AND branch_id = ? AND LOWER(category_code) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, code).
		First(&category).Error
	if err != nil {
		return nil, err
	}
	return &category, nil
}

func (r *Repository) FindProductCategoryByNameTx(tx *gorm.DB, businessID, branchID, parentID, name string) (*ProductCategory, error) {
	var category ProductCategory
	query := tx.Where("business_id = ? AND branch_id = ? AND LOWER(category_name) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, name)
	if parentID == "" {
		query = query.Where("parent_category_id IS NULL")
	} else {
		query = query.Where("parent_category_id = ?", parentID)
	}
	err := query.First(&category).Error
	if err != nil {
		return nil, err
	}
	return &category, nil
}

func (r *Repository) ProductNameExists(businessID, branchID, parentID, name, excludedID string) (bool, error) {
	var count int64
	query := r.db.Model(&ProductCategory{}).Where("business_id = ? AND branch_id = ? AND LOWER(category_name) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, name)
	if parentID == "" {
		query = query.Where("parent_category_id IS NULL")
	} else {
		query = query.Where("parent_category_id = ?", parentID)
	}
	if excludedID != "" {
		query = query.Where("id <> ?", excludedID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *Repository) ProductCodeExists(businessID, branchID, code, excludedID string) (bool, error) {
	var count int64
	query := r.db.Model(&ProductCategory{}).Where("business_id = ? AND branch_id = ? AND LOWER(category_code) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, code)
	if excludedID != "" {
		query = query.Where("id <> ?", excludedID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *Repository) UpdateProductCategory(tx *gorm.DB, id, businessID, branchID string, updates map[string]interface{}) error {
	result := tx.Model(&ProductCategory{}).Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperrors.NotFound("product category not found")
	}
	return nil
}

func (r *Repository) CreateSimpleCategory(tx *gorm.DB, table string, category interface{}) error {
	return tx.Table(table).Create(category).Error
}

func (r *Repository) ListSimpleCategoriesTx(tx *gorm.DB, table, businessID, branchID string) ([]SimpleCategoryResponse, error) {
	var categories []SimpleCategoryResponse
	err := tx.Table(table).
		Select("id, business_id, branch_id, category_name, description, status, created_at, updated_at").
		Where("business_id = ? AND branch_id = ? AND deleted_at IS NULL", businessID, branchID).
		Order("category_name ASC").
		Scan(&categories).Error
	return categories, err
}

func (r *Repository) ListSimpleCategories(table, businessID, branchID string) ([]SimpleCategoryResponse, error) {
	var categories []SimpleCategoryResponse
	err := r.db.Table(table).
		Select("id, business_id, branch_id, category_name, description, status, created_at, updated_at").
		Where("business_id = ? AND branch_id = ? AND deleted_at IS NULL", businessID, branchID).
		Order("category_name ASC").
		Scan(&categories).Error
	return categories, err
}

func (r *Repository) FindSimpleCategory(table, id, businessID, branchID string) (*SimpleCategoryResponse, error) {
	var category SimpleCategoryResponse
	err := r.db.Table(table).
		Select("id, business_id, branch_id, category_name, description, status, created_at, updated_at").
		Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).
		Take(&category).Error
	if err != nil {
		return nil, err
	}
	return &category, nil
}

func (r *Repository) SimpleNameExists(table, businessID, branchID, name, excludedID string) (bool, error) {
	var count int64
	query := r.db.Table(table).Where("business_id = ? AND branch_id = ? AND LOWER(category_name) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, name)
	if excludedID != "" {
		query = query.Where("id <> ?", excludedID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *Repository) SimpleNameExistsTx(tx *gorm.DB, table, businessID, branchID, name string) (bool, error) {
	var count int64
	err := tx.Table(table).
		Where("business_id = ? AND branch_id = ? AND LOWER(category_name) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, name).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) UpdateSimpleCategory(tx *gorm.DB, table, id, businessID, branchID string, updates map[string]interface{}) error {
	result := tx.Table(table).Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperrors.NotFound("category not found")
	}
	return nil
}

func (r *Repository) CountActive(table, businessID, branchID string) (int64, error) {
	var count int64
	err := r.db.Table(table).Where("business_id = ? AND branch_id = ? AND status = ? AND deleted_at IS NULL", businessID, branchID, "active").Count(&count).Error
	return count, err
}

func (r *Repository) CountActiveUnits(businessID string) (int64, error) {
	var count int64
	err := r.db.Model(&Unit{}).
		Where("(business_id IS NULL OR business_id = ?) AND status = ? AND deleted_at IS NULL", businessID, "active").
		Count(&count).Error
	return count, err
}

func (r *Repository) CountActiveShared(table, businessID string) (int64, error) {
	var count int64
	err := r.db.Table(table).
		Where("(business_id IS NULL OR business_id = ?) AND status = ? AND deleted_at IS NULL", businessID, "active").
		Count(&count).Error
	return count, err
}
