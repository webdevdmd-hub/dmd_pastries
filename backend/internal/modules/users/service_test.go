package users

import (
	"strings"
	"testing"
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
