package packaging

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	view gin.HandlerFunc,
	manage gin.HandlerFunc,
) {
	group := router.Group("/api/v1/packaging")
	group.Use(authGuard)

	group.GET("", view, handler.List)
	group.POST("", manage, handler.Create)
	group.GET("/lookup", view, handler.Lookup)
	group.GET("/product/:productId", view, handler.ListProductRules)
	group.POST("/product/:productId", manage, handler.CreateProductRule)
	group.DELETE("/product/:productId/:ruleId", manage, handler.DeleteProductRule)
	group.GET("/:id", view, handler.Get)
	group.PATCH("/:id", manage, handler.Update)
	group.PATCH("/:id/status", manage, handler.UpdateStatus)
	group.DELETE("/:id", manage, handler.Delete)
}
