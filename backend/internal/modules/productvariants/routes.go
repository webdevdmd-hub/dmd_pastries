package productvariants

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	productsView gin.HandlerFunc,
	productsManage gin.HandlerFunc,
) {
	group := router.Group("/api/v1/products/:id/variants")
	group.Use(authGuard)

	group.GET("", productsView, handler.ListVariants)
	group.POST("", productsManage, handler.CreateVariant)
	group.PATCH("/:variantId", productsManage, handler.UpdateVariant)
	group.PATCH("/:variantId/status", productsManage, handler.UpdateVariantStatus)
	group.DELETE("/:variantId", productsManage, handler.DeleteVariant)
}
