package businesses

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

func (r *Repository) Create(tx *gorm.DB, business *Business) error {
	return tx.Create(business).Error
}

func (r *Repository) UpdateOwnerUserID(tx *gorm.DB, businessID string, ownerUserID string) error {
	return tx.Model(&Business{}).
		Where("id = ?", businessID).
		Update("owner_user_id", ownerUserID).Error
}

func (r *Repository) FindByID(businessID string) (*Business, error) {
	var business Business
	err := r.db.Where("id = ?", businessID).First(&business).Error
	if err != nil {
		return nil, err
	}
	return &business, nil
}

func (r *Repository) UpdateByID(tx *gorm.DB, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&Business{}).Where("id = ?", businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperrors.NotFound("business not found")
	}
	return nil
}

func (r *Repository) EnsureSettings(tx *gorm.DB, businessID string) (*BusinessSettings, error) {
	settings := BusinessSettings{
		BusinessID: businessID,
	}
	defaults := BusinessSettings{
		ID:                 utils.NewUUID(),
		AllowNegativeStock: false,
		DefaultTaxRate:     0,
		PriceIncludesTax:   false,
		LowStockAlert:      true,
		DefaultLanguage:    "en",
		DateFormat:         "YYYY-MM-DD",
	}
	if err := tx.Where("business_id = ?", businessID).Attrs(defaults).FirstOrCreate(&settings).Error; err != nil {
		return nil, err
	}
	return &settings, nil
}

func (r *Repository) UpdateSettings(tx *gorm.DB, businessID string, updates map[string]interface{}) error {
	return tx.Model(&BusinessSettings{}).Where("business_id = ?", businessID).Updates(updates).Error
}

func (r *Repository) CountActiveUsers(businessID string) (int64, error) {
	var count int64
	err := r.db.Table("users").Where("business_id = ? AND status = ? AND deleted_at IS NULL", businessID, "active").Count(&count).Error
	return count, err
}

func (r *Repository) FindUserBranchID(userID, businessID string) (*string, error) {
	var result struct {
		BranchID *string
	}
	err := r.db.Table("users").Select("COALESCE(current_branch_id, branch_id) AS branch_id").Where("id = ? AND business_id = ? AND deleted_at IS NULL", userID, businessID).Scan(&result).Error
	if err != nil {
		return nil, err
	}
	return result.BranchID, nil
}

func (r *Repository) UpdateUserCurrentBranch(tx *gorm.DB, userID, businessID, branchID string) error {
	result := tx.Table("users").Where("id = ? AND business_id = ? AND deleted_at IS NULL", userID, businessID).Updates(map[string]interface{}{
		"current_branch_id": branchID,
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperrors.NotFound("user not found")
	}
	return nil
}
