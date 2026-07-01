package utils

import "github.com/gin-gonic/gin"

const AuthContextKey = "auth_context"

type AuthContext struct {
	UserID               string
	AppwriteUserID       string
	BusinessID           string
	RoleID               string
	RoleName             string
	FullName             string
	Email                string
	IsPlatformAdmin      bool
	CurrentBranchID      *string
	AssignedBranchID     *string
	AllowedBranchIDs     []string
	CanAccessAllBranches bool
	Permissions          []string
}

func MustAuthContext(c *gin.Context) *AuthContext {
	value, exists := c.Get(AuthContextKey)
	if !exists {
		return nil
	}

	context, _ := value.(*AuthContext)
	return context
}
