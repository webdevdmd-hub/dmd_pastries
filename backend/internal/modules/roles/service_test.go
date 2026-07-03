package roles

import (
	"testing"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

func TestCreateRoleRequiresAtLeastOnePermission(t *testing.T) {
	service := NewService(nil, nil, nil)
	currentUser := &utils.AuthContext{BusinessID: "business-id"}

	_, err := service.CreateRole(currentUser, CreateRoleRequest{
		RoleName:       "Cashier",
		PermissionKeys: []string{},
	})

	assertPermissionRequiredError(t, err)
}

func TestCreateRoleRequiresAtLeastOneNonBlankPermission(t *testing.T) {
	service := NewService(nil, nil, nil)
	currentUser := &utils.AuthContext{BusinessID: "business-id"}

	_, err := service.CreateRole(currentUser, CreateRoleRequest{
		RoleName:       "Cashier",
		PermissionKeys: []string{" ", ""},
	})

	assertPermissionRequiredError(t, err)
}

func TestUpdateRolePermissionsRequiresAtLeastOnePermission(t *testing.T) {
	service := NewService(nil, nil, nil)
	currentUser := &utils.AuthContext{BusinessID: "business-id"}

	_, err := service.UpdateRolePermissions(
		currentUser,
		"role-id",
		UpdateRolePermissionsRequest{PermissionKeys: []string{}},
	)

	assertPermissionRequiredError(t, err)
}

func TestUpdateRolePermissionsRequiresAtLeastOneNonBlankPermission(t *testing.T) {
	service := NewService(nil, nil, nil)
	currentUser := &utils.AuthContext{BusinessID: "business-id"}

	_, err := service.UpdateRolePermissions(
		currentUser,
		"role-id",
		UpdateRolePermissionsRequest{PermissionKeys: []string{" ", ""}},
	)

	assertPermissionRequiredError(t, err)
}

func assertPermissionRequiredError(t *testing.T, err error) {
	t.Helper()

	if err == nil {
		t.Fatal("expected permission validation error, got nil")
	}

	appErr, ok := err.(*apperrors.AppError)
	if !ok {
		t.Fatalf("expected AppError, got %T", err)
	}

	if appErr.StatusCode != 400 {
		t.Fatalf("expected status 400, got %d", appErr.StatusCode)
	}

	if appErr.Message != permissionRequiredMessage {
		t.Fatalf("expected message %q, got %q", permissionRequiredMessage, appErr.Message)
	}

	details, ok := appErr.Details.(map[string][]string)
	if !ok {
		t.Fatalf("expected field error map, got %T", appErr.Details)
	}

	messages := details["permission_keys"]
	if len(messages) != 1 || messages[0] != permissionRequiredMessage {
		t.Fatalf("expected permission_keys field message %q, got %#v", permissionRequiredMessage, messages)
	}
}
