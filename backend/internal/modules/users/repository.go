package users

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"pastries-pos/internal/shared/utils"

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

// UpdateProviderIDs links a local user to their account in every live identity
// provider. Written together so a row can never carry one id and not the other
// after a partially applied update.
func (r *Repository) UpdateProviderIDs(tx *gorm.DB, userID string, ids utils.ProviderIDs) error {
	updates := map[string]interface{}{"appwrite_user_id": ids.Appwrite}
	// Only touch supabase_user_id when there is one: before cutover it must
	// stay NULL, and the partial unique index treats NULLs as distinct while an
	// empty string would collide on the second user.
	if supabaseID := ids.SupabaseOrNil(); supabaseID != nil {
		updates["supabase_user_id"] = *supabaseID
	}
	return tx.Model(&User{}).Where("id = ?", userID).Updates(updates).Error
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

// EnsureBranchAccess grants access additively. Use it only when creating a user
// or accepting an invitation, where there is no prior access to supersede.
//
// For a transfer or reassignment use ReplaceBranchAccess: this function alone
// would leave the old branch in place, and nothing else revokes it.
func (r *Repository) EnsureBranchAccess(tx *gorm.DB, businessID, userID, branchID string) error {
	access := UserBranchAccess{BusinessID: businessID, UserID: userID, BranchID: branchID}
	defaults := UserBranchAccess{ID: uuid.NewString()}
	return tx.Where("business_id = ? AND user_id = ? AND branch_id = ?", businessID, userID, branchID).
		Attrs(defaults).
		FirstOrCreate(&access).Error
}

// ReplaceBranchAccess makes branchID the user's only branch access row.
//
// Branch access was previously insert-only, so a user moved from one branch to
// another accumulated both. Their allowed-branch set — and therefore every
// record guard built on it — kept authorizing the branch they had left.
func (r *Repository) ReplaceBranchAccess(tx *gorm.DB, businessID, userID, branchID string) error {
	if err := tx.Where("business_id = ? AND user_id = ? AND branch_id <> ?", businessID, userID, branchID).
		Delete(&UserBranchAccess{}).Error; err != nil {
		return err
	}
	return r.EnsureBranchAccess(tx, businessID, userID, branchID)
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

// ListActiveByEmail returns every live account with this address across
// businesses. Email is not unique across tenants, so a reset request from a
// login page that knows no business must reach each one.
func (r *Repository) ListActiveByEmail(email string) ([]User, error) {
	var found []User
	err := r.db.
		Where("LOWER(email) = LOWER(?) AND status IN ('active', 'invited')", email).
		Find(&found).Error
	return found, err
}

func (r *Repository) MarkPasswordResetRequested(tx *gorm.DB, userID string, at time.Time) error {
	return tx.Model(&User{}).Where("id = ?", userID).Update("password_reset_requested_at", at).Error
}

func (r *Repository) ClearPasswordResetRequest(tx *gorm.DB, userID string) error {
	return tx.Model(&User{}).Where("id = ?", userID).Update("password_reset_requested_at", nil).Error
}
