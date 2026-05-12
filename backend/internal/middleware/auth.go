package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"

	"pastries-pos/internal/modules/auth"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/response"
	"pastries-pos/internal/shared/utils"
)

type AuthMiddleware struct {
	authService *auth.Service
}

func NewAuthMiddleware(authService *auth.Service) *AuthMiddleware {
	return &AuthMiddleware{authService: authService}
}

func (m *AuthMiddleware) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			response.Error(c, 401, "missing or invalid authorization header", nil)
			c.Abort()
			return
		}

		token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		currentUser, err := m.authService.AuthenticateToken(token)
		if err != nil {
			if appErr, ok := err.(*apperrors.AppError); ok {
				response.Error(c, appErr.StatusCode, appErr.Message, appErr.Details)
			} else {
				response.Error(c, 401, err.Error(), nil)
			}
			c.Abort()
			return
		}

		c.Set(utils.AuthContextKey, currentUser)
		c.Next()
	}
}
