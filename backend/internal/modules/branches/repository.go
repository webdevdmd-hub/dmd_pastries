package branches

import (
	"gorm.io/gorm"

	apperrors "pastries-pos/internal/shared/errors"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(tx *gorm.DB, branch *Branch) error {
	return tx.Create(branch).Error
}

func (r *Repository) ListByBusinessID(businessID string) ([]Branch, error) {
	var branches []Branch
	err := r.db.Where("business_id = ?", businessID).Order("created_at DESC").Find(&branches).Error
	return branches, err
}

func (r *Repository) ListByBusinessIDAndIDs(businessID string, branchIDs []string) ([]Branch, error) {
	var branches []Branch
	if len(branchIDs) == 0 {
		return branches, nil
	}
	err := r.db.Where("business_id = ? AND id IN ?", businessID, branchIDs).Order("created_at DESC").Find(&branches).Error
	return branches, err
}

func (r *Repository) FindByIDAndBusinessID(branchID, businessID string) (*Branch, error) {
	var branch Branch
	err := r.db.Where("id = ? AND business_id = ?", branchID, businessID).First(&branch).Error
	if err != nil {
		return nil, err
	}
	return &branch, nil
}

func (r *Repository) ExistsByCodeAndBusinessID(code, businessID string) (bool, error) {
	var count int64
	err := r.db.Model(&Branch{}).
		Where("LOWER(code) = LOWER(?) AND business_id = ?", code, businessID).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) ExistsByCodeAndBusinessIDExcludingID(code, businessID, excludedBranchID string) (bool, error) {
	var count int64
	err := r.db.Model(&Branch{}).
		Where("LOWER(code) = LOWER(?) AND business_id = ? AND id <> ?", code, businessID, excludedBranchID).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) UpdateByBusinessID(branchID, businessID string, updates map[string]interface{}) error {
	result := r.db.Model(&Branch{}).Where("id = ? AND business_id = ?", branchID, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperrors.NotFound("branch not found")
	}
	return nil
}

func (r *Repository) CountByBusinessID(businessID string) (int64, error) {
	var count int64
	err := r.db.Model(&Branch{}).Where("business_id = ?", businessID).Count(&count).Error
	return count, err
}

func (r *Repository) CountActiveByBusinessID(businessID string) (int64, error) {
	var count int64
	err := r.db.Model(&Branch{}).Where("business_id = ? AND status = ?", businessID, "active").Count(&count).Error
	return count, err
}

func (r *Repository) ClearDefault(tx *gorm.DB, businessID string) error {
	return tx.Model(&Branch{}).Where("business_id = ?", businessID).Update("is_default", false).Error
}

func (r *Repository) UpdateByBusinessIDTx(tx *gorm.DB, branchID, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&Branch{}).Where("id = ? AND business_id = ?", branchID, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperrors.NotFound("branch not found")
	}
	return nil
}

func (r *Repository) UserExistsByIDAndBusinessID(userID, businessID string) (bool, error) {
	var count int64
	err := r.db.Table("users").
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", userID, businessID).
		Count(&count).Error
	return count > 0, err
}
