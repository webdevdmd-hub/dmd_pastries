package productvariants

import (
	"strings"

	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// ProductExists gates every variant operation. Variants have no branch column of
// their own, so their parent product — which is branch-scoped — is what confines
// them to a branch. Pass an empty branchID only for callers with all-branch access.
func (r *Repository) ProductExists(productID, businessID, branchID string) (bool, error) {
	var count int64
	query := r.db.Table("products").
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", productID, businessID)
	if branchID != "" {
		query = query.Where("branch_id = ?", branchID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *Repository) Create(tx *gorm.DB, variant *ProductVariant) error {
	return tx.Create(variant).Error
}

func (r *Repository) List(productID, businessID string) ([]ProductVariant, error) {
	var variants []ProductVariant
	err := r.db.Where("product_id = ? AND business_id = ? AND deleted_at IS NULL", productID, businessID).
		Order("sort_order ASC, variant_name ASC").
		Find(&variants).Error
	return variants, err
}

func (r *Repository) FindByID(productID, variantID, businessID string) (*ProductVariant, error) {
	var variant ProductVariant
	err := r.db.Where("id = ? AND product_id = ? AND business_id = ? AND deleted_at IS NULL", variantID, productID, businessID).First(&variant).Error
	if err != nil {
		return nil, err
	}
	return &variant, nil
}

func (r *Repository) Update(tx *gorm.DB, productID, variantID, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&ProductVariant{}).Where("id = ? AND product_id = ? AND business_id = ? AND deleted_at IS NULL", variantID, productID, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) SKUExists(businessID, sku, excludedVariantID string) (bool, error) {
	return r.variantValueExists("sku", businessID, sku, excludedVariantID)
}

func (r *Repository) BarcodeExists(businessID, barcode, excludedVariantID string) (bool, error) {
	return r.variantValueExists("barcode", businessID, barcode, excludedVariantID)
}

func (r *Repository) ProductSKUExists(businessID, sku string) (bool, error) {
	return r.productValueExists("sku", businessID, sku)
}

func (r *Repository) ProductBarcodeExists(businessID, barcode string) (bool, error) {
	return r.productValueExists("barcode", businessID, barcode)
}

func (r *Repository) variantValueExists(column, businessID, value, excludedVariantID string) (bool, error) {
	if strings.TrimSpace(value) == "" {
		return false, nil
	}
	var count int64
	query := r.db.Model(&ProductVariant{}).Where("business_id = ? AND LOWER("+column+") = LOWER(?) AND deleted_at IS NULL", businessID, value)
	if excludedVariantID != "" {
		query = query.Where("id <> ?", excludedVariantID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *Repository) productValueExists(column, businessID, value string) (bool, error) {
	if strings.TrimSpace(value) == "" {
		return false, nil
	}
	var count int64
	err := r.db.Table("products").Where("business_id = ? AND LOWER("+column+") = LOWER(?) AND deleted_at IS NULL", businessID, value).Count(&count).Error
	return count > 0, err
}
