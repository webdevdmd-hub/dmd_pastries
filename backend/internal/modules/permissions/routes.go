package permissions

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	permissionsView gin.HandlerFunc,
) {
	group := router.Group("/api/v1/permissions")
	group.Use(authGuard)

	group.GET("", permissionsView, handler.ListPermissions)
}
