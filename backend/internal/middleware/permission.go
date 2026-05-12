package middleware

import (
	"fmt"

	"github.com/gin-gonic/gin"

	"pastries-pos/internal/shared/response"
	"pastries-pos/internal/shared/utils"
)

type PermissionMiddleware struct{}

func NewPermissionMiddleware() *PermissionMiddleware {
	return &PermissionMiddleware{}
}

func (m *PermissionMiddleware) RequirePermission(module, action string) gin.HandlerFunc {
	required := fmt.Sprintf("%s.%s", module, action)
	return func(c *gin.Context) {
		currentUser := utils.MustAuthContext(c)
		if currentUser == nil {
			response.Error(c, 401, "unauthenticated user", nil)
			c.Abort()
			return
		}

		for _, permission := range currentUser.Permissions {
			if permission == required {
				c.Next()
				return
			}
		}

		response.Error(c, 403, "missing required permission", gin.H{
			"required_permission": required,
		})
		c.Abort()
	}
}

func (m *PermissionMiddleware) RequireAnyPermission(required ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		currentUser := utils.MustAuthContext(c)
		if currentUser == nil {
			response.Error(c, 401, "unauthenticated user", nil)
			c.Abort()
			return
		}

		for _, userPermission := range currentUser.Permissions {
			for _, requiredPermission := range required {
				if userPermission == requiredPermission {
					c.Next()
					return
				}
			}
		}

		response.Error(c, 403, "missing required permission", gin.H{
			"required_permissions": required,
		})
		c.Abort()
	}
}
