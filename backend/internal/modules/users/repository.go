package users

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	apperrors "pastries-pos/internal/shared/errors"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(tx *gorm.DB, user *User) error {
	return tx.Create(user).Error
}

func (r *Repository) FindByAppwriteUserID(appwriteUserID string) (*User, error) {
	var user User
	err := r.db.Preload("Role").Where("appwrite_user_id = ?", appwriteUserID).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *Repository) FindByIDAndBusinessID(userID, businessID string) (*User, error) {
	var user User
	err := r.db.Preload("Role").Where("id = ? AND business_id = ?", userID, businessID).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *Repository) FindByIDAndBusinessIDUnscoped(userID, businessID string) (*User, error) {
	var user User
	err := r.db.Unscoped().Preload("Role").Where("id = ? AND business_id = ?", userID, businessID).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *Repository) ListByBusinessID(businessID string) ([]User, error) {
	var users []User
	err := r.db.Preload("Role").Where("business_id = ?", businessID).Order("created_at DESC").Find(&users).Error
	return users, err
}

func (r *Repository) ExistsByEmailAndBusinessID(email, businessID string) (bool, error) {
	var count int64
	err := r.db.Model(&User{}).
		Where("LOWER(email) = LOWER(?) AND business_id = ?", email, businessID).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) CountActiveByBusinessID(businessID string) (int64, error) {
	var count int64
	err := r.db.Model(&User{}).Where("business_id = ? AND status = ?", businessID, "active").Count(&count).Error
	return count, err
}

func (r *Repository) UpdateLastLogin(tx *gorm.DB, userID string, at time.Time) error {
	return tx.Model(&User{}).Where("id = ?", userID).Update("last_login_at", at).Error
}

func (r *Repository) UpdateAuthSync(tx *gorm.DB, userID string, emailVerified bool, lastLoginAt time.Time) error {
	return tx.Model(&User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"email_verified": emailVerified,
		"last_login_at":  lastLoginAt,
	}).Error
}

func (r *Repository) UpdateAppwriteUserID(tx *gorm.DB, userID, appwriteUserID string) error {
	return tx.Model(&User{}).Where("id = ?", userID).Update("appwrite_user_id", appwriteUserID).Error
}

func (r *Repository) UpdateEmailVerified(tx *gorm.DB, userID string, emailVerified bool) error {
	return tx.Model(&User{}).Where("id = ?", userID).Update("email_verified", emailVerified).Error
}

func (r *Repository) UpdateByBusinessID(userID, businessID string, updates map[string]interface{}) error {
	result := r.db.Model(&User{}).Where("id = ? AND business_id = ?", userID, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperrors.NotFound("user not found")
	}
	return nil
}

func (r *Repository) UpdateByBusinessIDTx(tx *gorm.DB, userID, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&User{}).Where("id = ? AND business_id = ?", userID, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperrors.NotFound("user not found")
	}
	return nil
}

func (r *Repository) EnsureBranchAccess(tx *gorm.DB, businessID, userID, branchID string) error {
	access := UserBranchAccess{BusinessID: businessID, UserID: userID, BranchID: branchID}
	defaults := UserBranchAccess{ID: uuid.NewString()}
	return tx.Where("business_id = ? AND user_id = ? AND branch_id = ?", businessID, userID, branchID).
		Attrs(defaults).
		FirstOrCreate(&access).Error
}

func (r *Repository) SoftDeleteByBusinessID(tx *gorm.DB, userID, businessID string) error {
	result := tx.Where("id = ? AND business_id = ?", userID, businessID).Delete(&User{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperrors.NotFound("user not found")
	}
	return nil
}

func (r *Repository) RestoreByBusinessID(tx *gorm.DB, userID, businessID string) error {
	result := tx.Unscoped().Model(&User{}).Where("id = ? AND business_id = ?", userID, businessID).Updates(map[string]interface{}{
		"deleted_at": nil,
		"status":     "active",
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperrors.NotFound("user not found")
	}
	return nil
}

func (r *Repository) CountActiveAdmins(businessID string) (int64, error) {
	var count int64
	err := r.db.Model(&User{}).
		Joins("JOIN roles ON roles.id = users.role_id").
		Where("users.business_id = ? AND users.status = ? AND LOWER(roles.role_name) = ?", businessID, "active", "admin").
		Count(&count).Error
	return count, err
}

func (r *Repository) CreateInvitation(tx *gorm.DB, invite *UserInvitation) error {
	return tx.Create(invite).Error
}

func (r *Repository) ListInvitations(businessID, status string) ([]UserInvitation, error) {
	var invites []UserInvitation
	query := r.db.Where("business_id = ?", businessID)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("created_at DESC").Find(&invites).Error
	return invites, err
}

func (r *Repository) FindInvitationByIDAndBusinessID(invitationID, businessID string) (*UserInvitation, error) {
	var invite UserInvitation
	err := r.db.Where("id = ? AND business_id = ?", invitationID, businessID).First(&invite).Error
	if err != nil {
		return nil, err
	}
	return &invite, nil
}

func (r *Repository) FindInvitationByTokenHash(tokenHash string) (*UserInvitation, error) {
	var invite UserInvitation
	err := r.db.Where("token_hash = ?", tokenHash).First(&invite).Error
	if err != nil {
		return nil, err
	}
	return &invite, nil
}

func (r *Repository) ExistsPendingInvitation(email, businessID string) (bool, error) {
	var count int64
	err := r.db.Model(&UserInvitation{}).
		Where("LOWER(email) = LOWER(?) AND business_id = ? AND status = ?", email, businessID, "pending").
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) UpdateInvitation(tx *gorm.DB, invitationID string, updates map[string]interface{}) error {
	return tx.Model(&UserInvitation{}).Where("id = ?", invitationID).Updates(updates).Error
}
