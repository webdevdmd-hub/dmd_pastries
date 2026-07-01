package superadmin

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	platformAdminGuard gin.HandlerFunc,
) {
	group := router.Group("/api/v1/super-admin")
	group.Use(authGuard)
	group.Use(platformAdminGuard)

	group.GET("/me", handler.Me)
	group.GET("/businesses", handler.ListBusinesses)
	group.GET("/businesses/:id", handler.GetBusiness)
	group.PATCH("/businesses/:id/actions", handler.UpdateBusinessAction)
	group.GET("/users", handler.ListUsers)
	group.GET("/users/:id", handler.GetUser)
	group.GET("/users/:id/hard-delete-preview", handler.GetUserHardDeletePreview)
	group.PATCH("/users/:id/actions", handler.UpdateUserAction)
	group.GET("/tables", handler.ListTables)
	group.GET("/tables/:table/rows", handler.ListTableRows)
	group.PATCH("/tables/:table/rows/:id", handler.UpdateTableRow)
	group.GET("/diagnostics", handler.Diagnostics)
}
