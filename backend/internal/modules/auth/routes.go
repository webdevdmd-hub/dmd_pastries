package auth

import (
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(router *gin.Engine, handler *Handler, authGuard gin.HandlerFunc) {
	group := router.Group("/api/v1/auth")

	group.POST("/register-owner", handler.RegisterOwner)
	group.POST("/login-sync", handler.LoginSync)
	group.POST("/password-reset/request", handler.RequestPasswordReset)
	group.POST("/password-reset/complete", handler.CompletePasswordReset)
	group.GET("/me", authGuard, handler.Me)
	group.POST("/logout-sync", authGuard, handler.LogoutSync)
}
