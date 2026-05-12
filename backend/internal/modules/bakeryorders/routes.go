package bakeryorders

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	view gin.HandlerFunc,
	manage gin.HandlerFunc,
) {
	group := router.Group("/api/v1/bakery-orders")
	group.Use(authGuard)

	group.GET("", view, handler.ListOrders)
	group.POST("", manage, handler.CreateOrder)
	group.GET("/summary", view, handler.Summary)

	group.GET("/:id", view, handler.GetOrder)
	group.PATCH("/:id", manage, handler.UpdateOrder)
	group.PATCH("/:id/status", manage, handler.UpdateStatus)
	group.DELETE("/:id", manage, handler.DeleteOrder)

	group.POST("/:id/items", manage, handler.AddItem)
	group.PATCH("/:id/items/:itemId", manage, handler.UpdateItem)
	group.DELETE("/:id/items/:itemId", manage, handler.DeleteItem)

	group.GET("/:id/payments", view, handler.ListPayments)
	group.POST("/:id/payments", manage, handler.AddPayment)

	group.POST("/:id/assign-production", manage, handler.AssignProduction)
	group.PATCH("/:id/production-status", manage, handler.UpdateProductionStatus)

	group.GET("/:id/packaging", view, handler.ListPackaging)
	group.POST("/:id/packaging", manage, handler.AddPackaging)
}
