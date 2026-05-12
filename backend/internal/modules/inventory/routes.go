package inventory

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	view gin.HandlerFunc,
	manage gin.HandlerFunc,
) {
	group := router.Group("/api/v1/inventory")
	group.Use(authGuard)

	group.GET("", view, handler.ListInventory)
	group.POST("/opening-stock", manage, handler.CreateOpeningStock)
	group.GET("/movements", view, handler.ListMovements)
	group.GET("/low-stock", view, handler.LowStock)
	group.GET("/expiry-alerts", view, handler.ExpiryAlerts)
	group.PATCH("/expiry-batches/:batchId", manage, handler.UpdateExpiryBatch)
	group.PATCH("/expiry-batches/:batchId/status", manage, handler.UpdateExpiryBatchStatus)
	group.GET("/:id", view, handler.GetInventoryItem)
	group.POST("/:id/adjust", manage, handler.AdjustStock)
	group.GET("/:id/movements", view, handler.ListItemMovements)
	group.GET("/:id/expiry-batches", view, handler.ListExpiryBatches)
	group.POST("/:id/expiry-batches", manage, handler.CreateExpiryBatch)
}

func RegisterStockMovementRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	view gin.HandlerFunc,
	manage gin.HandlerFunc,
) {
	group := router.Group("/api/v1/stock-movements")
	group.Use(authGuard)

	group.GET("", view, handler.ListStockMovements)
	group.GET("/summary", view, handler.StockMovementSummary)
	group.GET("/audit/:inventoryItemId", view, handler.InventoryLedgerAudit)
	group.GET("/inventory/:inventoryItemId", view, handler.ListStockMovementsByInventory)
	group.POST("/manual", manage, handler.CreateManualStockMovement)
	group.GET("/:id", view, handler.GetStockMovement)
	group.POST("/:id/reverse", manage, handler.ReverseStockMovement)
}
