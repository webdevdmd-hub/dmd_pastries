package products

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	productsView gin.HandlerFunc,
	productsManage gin.HandlerFunc,
	posView gin.HandlerFunc,
) {
	group := router.Group("/api/v1/products")
	group.Use(authGuard)

	group.GET("", productsView, handler.ListProducts)
	group.POST("", productsManage, handler.CreateProduct)
	group.GET("/pos", posView, handler.POSProducts)
	group.GET("/lookup", posView, handler.LookupProduct)
	group.GET("/price-suggestions", productsView, handler.ListPriceSuggestions)
	group.POST("/price-suggestions/bulk-apply", productsManage, handler.BulkApplyPriceSuggestions)
	group.POST("/price-suggestions/:id/apply", productsManage, handler.ApplyPriceSuggestion)
	group.POST("/price-suggestions/:id/dismiss", productsManage, handler.DismissPriceSuggestion)
	group.GET("/:id", productsView, handler.GetProduct)
	group.PATCH("/:id", productsManage, handler.UpdateProduct)
	group.PATCH("/:id/status", productsManage, handler.UpdateProductStatus)
	group.DELETE("/:id", productsManage, handler.DeleteProduct)
}
