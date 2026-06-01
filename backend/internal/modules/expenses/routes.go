package expenses

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	view gin.HandlerFunc,
	create gin.HandlerFunc,
	edit gin.HandlerFunc,
	deleteGuard gin.HandlerFunc,
) {
	group := router.Group("/api/v1/expenses")
	group.Use(authGuard)

	group.GET("", view, handler.List)
	group.POST("", create, handler.Create)
	group.GET("/:id", view, handler.Get)
	group.PATCH("/:id", edit, handler.Update)
	group.DELETE("/:id", deleteGuard, handler.Delete)
}
