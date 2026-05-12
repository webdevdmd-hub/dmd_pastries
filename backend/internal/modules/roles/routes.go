package roles

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	rolesView gin.HandlerFunc,
	rolesManage gin.HandlerFunc,
) {
	group := router.Group("/api/v1/roles")
	group.Use(authGuard)

	group.GET("", rolesView, handler.ListRoles)
	group.POST("", rolesManage, handler.CreateRole)
	group.PATCH("/:id", rolesManage, handler.UpdateRole)
	group.DELETE("/:id", rolesManage, handler.DeleteRole)
	group.GET("/:id/permissions", rolesView, handler.GetRolePermissions)
	group.PATCH("/:id/permissions", rolesManage, handler.UpdateRolePermissions)
}
