package products

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	productsView gin.HandlerFunc,
	// One guard per write. A single guard over every write let a role holding
	// only products.create edit, deactivate and delete products (ISSUE-065).
	productsCreate gin.HandlerFunc,
	productsEdit gin.HandlerFunc,
	productsStatus gin.HandlerFunc,
	productsDelete gin.HandlerFunc,
	posView gin.HandlerFunc,
	// Unlocked by every permission whose form picks a product; see main.go.
	picker gin.HandlerFunc,
) {
	group := router.Group("/api/v1/products")
	group.Use(authGuard)

	group.GET("", productsView, handler.ListProducts)
	group.POST("", productsCreate, handler.CreateProduct)
	group.GET("/pos", posView, handler.POSProducts)
	group.GET("/lookup", posView, handler.LookupProduct)
	group.GET("/picker", picker, handler.PickerProducts)
	group.GET("/price-suggestions", productsView, handler.ListPriceSuggestions)
	// Applying a suggestion rewrites an existing product's sale price.
	group.POST("/price-suggestions/bulk-apply", productsEdit, handler.BulkApplyPriceSuggestions)
	group.POST("/price-suggestions/:id/apply", productsEdit, handler.ApplyPriceSuggestion)
	group.POST("/price-suggestions/:id/dismiss", productsEdit, handler.DismissPriceSuggestion)
	group.GET("/:id", productsView, handler.GetProduct)
	group.PATCH("/:id", productsEdit, handler.UpdateProduct)
	group.PATCH("/:id/status", productsStatus, handler.UpdateProductStatus)
	group.DELETE("/:id", productsDelete, handler.DeleteProduct)
}
