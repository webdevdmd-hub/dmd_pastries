package manufacturing

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	view gin.HandlerFunc,
	manage gin.HandlerFunc,
) {
	group := router.Group("/api/v1/manufacturing")
	group.Use(authGuard)

	group.GET("/summary", view, handler.Summary)
	group.GET("/product/:productId/history", view, handler.ProductHistory)
	group.GET("/batches", view, handler.ListBatches)
	group.POST("/batches", manage, handler.CreateBatch)
	group.GET("/batches/:id", view, handler.GetBatch)
	group.PATCH("/batches/:id", manage, handler.UpdateBatch)
	group.DELETE("/batches/:id", manage, handler.DeleteBatch)
	group.POST("/batches/:id/start", manage, handler.StartBatch)
	group.POST("/batches/:id/produce", manage, handler.ProduceBatch)
	group.POST("/batches/:id/wastage", manage, handler.RecordWastage)
	group.POST("/batches/:id/complete", manage, handler.CompleteBatch)
	group.POST("/batches/:id/cancel", manage, handler.CancelBatch)
	group.GET("/batches/:id/output", view, handler.GetOutputs)
	group.GET("/batches/:id/outputs", view, handler.GetOutputs)
	group.GET("/batches/:id/wastage", view, handler.GetWastage)
	group.GET("/batches/:id/ingredients", view, handler.ListIngredients)
	group.PATCH("/batches/:id/ingredients/:lineId", manage, handler.UpdateIngredient)
	group.GET("/batches/:id/packaging", view, handler.ListPackaging)
	group.PATCH("/batches/:id/packaging/:lineId", manage, handler.UpdatePackaging)
}
