package auth

import (
	"gorm.io/gorm"

	"pastries-pos/internal/modules/users"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) FindUserByAppwriteUserID(appwriteUserID string) (*users.User, error) {
	var user users.User
	err := r.db.Preload("Role").Where("appwrite_user_id = ?", appwriteUserID).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *Repository) BusinessOwnerUserID(businessID string) (*string, error) {
	var result struct {
		OwnerUserID *string
	}
	if err := r.db.Table("businesses").Select("owner_user_id").Where("id = ? AND deleted_at IS NULL", businessID).Scan(&result).Error; err != nil {
		return nil, err
	}
	return result.OwnerUserID, nil
}

func (r *Repository) AllowedBranchIDs(businessID, userID string) ([]string, error) {
	var ids []string
	if err := r.db.Table("user_branch_access").
		Where("business_id = ? AND user_id = ?", businessID, userID).
		Pluck("branch_id", &ids).Error; err != nil {
		return nil, err
	}
	return ids, nil
}

func (r *Repository) ActiveBranchIDs(businessID string) ([]string, error) {
	var ids []string
	if err := r.db.Table("branches").
		Where("business_id = ? AND status = ? AND deleted_at IS NULL", businessID, "active").
		Order("created_at ASC").
		Pluck("id", &ids).Error; err != nil {
		return nil, err
	}
	return ids, nil
}
