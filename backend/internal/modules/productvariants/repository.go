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

// VariantUses reports what outside the inventory still points at a variant,
// in words for a refusal message. Its stock is the inventory module's to
// answer (inventory.Repository.StockUses).
//
// A sale, an order or a recipe keeps the variant's id; deleting the variant
// under them left receipts and recipes showing a blank variant name
// (ISSUE-084).
func (r *Repository) VariantUses(tx *gorm.DB, businessID, variantID string) ([]string, error) {
	checks := []struct {
		label string
		query string
	}{
		{"sales", `SELECT COUNT(*) FROM sale_items si
			JOIN sales s ON s.id = si.sale_id
			WHERE si.business_id = ? AND si.product_variant_id = ? AND s.deleted_at IS NULL`},
		{"held sales", `SELECT COUNT(*) FROM held_sale_items hsi
			JOIN held_sales hs ON hs.id = hsi.held_sale_id
			WHERE hsi.business_id = ? AND hsi.product_variant_id = ? AND hs.status = 'held' AND hs.deleted_at IS NULL`},
		{"bakery orders", `SELECT COUNT(*) FROM bakery_order_items boi
			JOIN bakery_orders bo ON bo.id = boi.bakery_order_id
			WHERE boi.business_id = ? AND boi.product_variant_id = ? AND boi.deleted_at IS NULL AND bo.deleted_at IS NULL`},
		{"production batches", `SELECT COUNT(*) FROM production_batches
			WHERE business_id = ? AND product_variant_id = ? AND deleted_at IS NULL`},
		{"a recipe that makes it", `SELECT COUNT(*) FROM recipes
			WHERE business_id = ? AND product_variant_id = ? AND deleted_at IS NULL`},
		{"recipes using it", `SELECT COUNT(*) FROM recipe_ingredients ri
			JOIN recipes r ON r.id = ri.recipe_id
			WHERE ri.business_id = ? AND ri.component_variant_id = ? AND ri.deleted_at IS NULL AND r.deleted_at IS NULL`},
		{"recipes using it", `SELECT COUNT(*) FROM recipe_packaging rp
			JOIN recipes r ON r.id = rp.recipe_id
			WHERE rp.business_id = ? AND rp.component_variant_id = ? AND rp.deleted_at IS NULL AND r.deleted_at IS NULL`},
	}

	uses := make([]string, 0)
	for _, check := range checks {
		if len(uses) > 0 && uses[len(uses)-1] == check.label {
			continue
		}
		var count int64
		if err := tx.Raw(check.query, businessID, variantID).Scan(&count).Error; err != nil {
			return nil, err
		}
		if count > 0 {
			uses = append(uses, check.label)
		}
	}
	return uses, nil
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
