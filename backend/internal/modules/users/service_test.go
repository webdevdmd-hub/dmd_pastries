package users

import (
	"strings"
	"testing"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

func TestGenerateTemporaryPassword(t *testing.T) {
	password, err := generateTemporaryPassword()
	if err != nil {
		t.Fatalf("generateTemporaryPassword returned error: %v", err)
	}

	if !strings.HasPrefix(password, "Tmp-") {
		t.Fatalf("expected temporary password to use Tmp- prefix, got %q", password)
	}

	if len(password) < 16 {
		t.Fatalf("expected temporary password length >= 16, got %d", len(password))
	}
}

func TestToUserResponseIncludesAvatarFileID(t *testing.T) {
	user := User{
		ID:             "user-id",
		AppwriteUserID: "appwrite-id",
		BusinessID:     "business-id",
		RoleID:         "role-id",
		FullName:       "Test User",
		Email:          "test@example.com",
		AvatarFileID:   "appwrite-avatar-file-id",
		Status:         "active",
	}

	response := toUserResponse(user)
	if response.AvatarFileID != user.AvatarFileID {
		t.Fatalf("expected avatar_file_id %q, got %q", user.AvatarFileID, response.AvatarFileID)
	}
}

func TestResolveInvitationBranchRequiresBranchForOperationalRoles(t *testing.T) {
	service := &Service{}
	currentUser := &utils.AuthContext{BusinessID: "business-id"}

	branchID, err := service.resolveInvitationBranch(currentUser, "Cashier", nil)
	if err == nil {
		t.Fatal("expected missing branch to be rejected for operational role")
	}
	if branchID != nil {
		t.Fatalf("expected no branch id, got %q", *branchID)
	}
	if !strings.Contains(err.Error(), "branch_id is required") {
		t.Fatalf("expected branch_id required error, got %v", err)
	}
}

func TestResolveInvitationBranchAllowsExplicitBranchlessAdminRoles(t *testing.T) {
	service := &Service{}
	currentUser := &utils.AuthContext{BusinessID: "business-id"}

	for _, roleName := range []string{"Admin", "Business Owner"} {
		branchID, err := service.resolveInvitationBranch(currentUser, roleName, nil)
		if err != nil {
			t.Fatalf("expected branchless %q invitation to be allowed, got %v", roleName, err)
		}
		if branchID != nil {
			t.Fatalf("expected branchless %q invitation to keep nil branch, got %q", roleName, *branchID)
		}
	}
}

func TestUpdateUserRejectsSelfRoleChangeBeforeRepository(t *testing.T) {
	service := &Service{}
	currentUser := &utils.AuthContext{UserID: "user-id", BusinessID: "business-id"}
	roleID := "role-id"

	_, err := service.UpdateUser(currentUser, "user-id", UpdateUserRequest{RoleID: &roleID}, "", "")

	assertSelfPrivilegedFieldError(t, err)
}

func TestUpdateUserRejectsSelfBranchChangeBeforeRepository(t *testing.T) {
	service := &Service{}
	currentUser := &utils.AuthContext{UserID: "user-id", BusinessID: "business-id"}
	branchID := "branch-id"

	_, err := service.UpdateUser(currentUser, "user-id", UpdateUserRequest{BranchID: &branchID}, "", "")

	assertSelfPrivilegedFieldError(t, err)
}

func TestAssignUserBranchRejectsSelfChangeBeforeRepository(t *testing.T) {
	service := &Service{}
	currentUser := &utils.AuthContext{UserID: "user-id", BusinessID: "business-id"}
	branchID := "branch-id"

	_, err := service.AssignUserBranch(currentUser, "user-id", AssignBranchRequest{BranchID: &branchID}, "", "")

	assertSelfPrivilegedFieldError(t, err)
}

func TestUpdateUserStatusRejectsSelfDeactivateBeforeRepository(t *testing.T) {
	service := &Service{}
	currentUser := &utils.AuthContext{UserID: "user-id", BusinessID: "business-id"}

	_, err := service.UpdateUserStatus(currentUser, "user-id", UpdateUserStatusRequest{Status: "inactive"}, "", "")

	assertSelfDestructiveActionError(t, err)
}

func TestUpdateUserStatusRejectsSelfSuspendBeforeRepository(t *testing.T) {
	service := &Service{}
	currentUser := &utils.AuthContext{UserID: "user-id", BusinessID: "business-id"}

	_, err := service.UpdateUserStatus(currentUser, "user-id", UpdateUserStatusRequest{Status: "suspended"}, "", "")

	assertSelfDestructiveActionError(t, err)
}

func TestDeleteUserRejectsSelfDeleteBeforeRepository(t *testing.T) {
	service := &Service{}
	currentUser := &utils.AuthContext{UserID: "user-id", BusinessID: "business-id"}

	_, err := service.DeleteUser(currentUser, "user-id", "", "")

	assertSelfDestructiveActionError(t, err)
}

func TestUpdateUserStatusRejectsOtherSelfChangeBeforeRepository(t *testing.T) {
	service := &Service{}
	currentUser := &utils.AuthContext{UserID: "user-id", BusinessID: "business-id"}

	_, err := service.UpdateUserStatus(currentUser, "user-id", UpdateUserStatusRequest{Status: "active"}, "", "")

	assertSelfPrivilegedFieldError(t, err)
}

func TestCreateUserRequiresValidExplicitStatusBeforeRepository(t *testing.T) {
	service := &Service{}
	currentUser := &utils.AuthContext{UserID: "actor-id", BusinessID: "business-id"}
	branchID := "branch-id"

	_, err := service.CreateUser(currentUser, CreateUserRequest{
		FullName: "Staff User",
		Email:    "staff@example.com",
		Phone:    "+971500000000",
		Password: "Password1",
		RoleID:   "role-id",
		BranchID: &branchID,
		Status:   "",
	}, "", "")

	assertInvalidStatusError(t, err)
}

func TestUpdateUserStatusRequiresValidStatusBeforeRepository(t *testing.T) {
	service := &Service{}
	currentUser := &utils.AuthContext{UserID: "actor-id", BusinessID: "business-id"}

	_, err := service.UpdateUserStatus(currentUser, "target-user-id", UpdateUserStatusRequest{Status: "pending"}, "", "")

	assertInvalidStatusError(t, err)
}

func assertSelfPrivilegedFieldError(t *testing.T, err error) {
	t.Helper()

	appErr, ok := err.(*apperrors.AppError)
	if !ok {
		t.Fatalf("expected AppError, got %T", err)
	}
	if appErr.StatusCode != 403 {
		t.Fatalf("expected status 403, got %d", appErr.StatusCode)
	}
	if appErr.Message != selfPrivilegedFieldUpdateMessage {
		t.Fatalf("expected message %q, got %q", selfPrivilegedFieldUpdateMessage, appErr.Message)
	}
}

func assertSelfDestructiveActionError(t *testing.T, err error) {
	t.Helper()

	appErr, ok := err.(*apperrors.AppError)
	if !ok {
		t.Fatalf("expected AppError, got %T", err)
	}
	if appErr.StatusCode != 403 {
		t.Fatalf("expected status 403, got %d", appErr.StatusCode)
	}
	if appErr.Message != selfDestructiveActionMessage {
		t.Fatalf("expected message %q, got %q", selfDestructiveActionMessage, appErr.Message)
	}
}

func assertInvalidStatusError(t *testing.T, err error) {
	t.Helper()

	appErr, ok := err.(*apperrors.AppError)
	if !ok {
		t.Fatalf("expected AppError, got %T", err)
	}
	if appErr.StatusCode != 400 {
		t.Fatalf("expected status 400, got %d", appErr.StatusCode)
	}
	if appErr.Message != "invalid status" {
		t.Fatalf("expected invalid status message, got %q", appErr.Message)
	}
}
