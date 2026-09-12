package ingredients

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	view gin.HandlerFunc,
	manage gin.HandlerFunc,
	// Guards /lookup: unlocked by every permission whose form picks one.
	picker gin.HandlerFunc,
) {
	group := router.Group("/api/v1/ingredients")
	group.Use(authGuard)

	group.GET("", view, handler.List)
	group.POST("", manage, handler.Create)
	group.GET("/lookup", picker, handler.Lookup)
	group.GET("/:id", view, handler.Get)
	group.PATCH("/:id", manage, handler.Update)
	group.PATCH("/:id/status", manage, handler.UpdateStatus)
	group.DELETE("/:id", manage, handler.Delete)
}
