package recipes

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	view gin.HandlerFunc,
	manage gin.HandlerFunc,
) {
	group := router.Group("/api/v1/recipes")
	group.Use(authGuard)

	group.GET("", view, handler.List)
	group.POST("", manage, handler.Create)
	group.GET("/lookup", view, handler.Lookup)
	group.GET("/product/:productId", view, handler.ProductRecipe)
	group.GET("/:id", view, handler.Get)
	group.PATCH("/:id", manage, handler.Update)
	group.PATCH("/:id/status", manage, handler.UpdateStatus)
	group.DELETE("/:id", manage, handler.Delete)

	group.GET("/:id/ingredients", view, handler.ListIngredients)
	group.POST("/:id/ingredients", manage, handler.AddIngredient)
	group.PATCH("/:id/ingredients/:ingredientLineId", manage, handler.UpdateIngredient)
	group.DELETE("/:id/ingredients/:ingredientLineId", manage, handler.DeleteIngredient)

	group.GET("/:id/packaging", view, handler.ListPackaging)
	group.POST("/:id/packaging", manage, handler.AddPackaging)
	group.PATCH("/:id/packaging/:packagingLineId", manage, handler.UpdatePackaging)
	group.DELETE("/:id/packaging/:packagingLineId", manage, handler.DeletePackaging)

	group.GET("/:id/cost", view, handler.Cost)
	group.POST("/:id/recalculate-cost", manage, handler.RecalculateCost)
	group.GET("/:id/versions", view, handler.Versions)
	group.POST("/:id/create-version", manage, handler.CreateVersion)
}
