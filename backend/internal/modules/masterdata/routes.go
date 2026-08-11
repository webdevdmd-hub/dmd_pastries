package masterdata

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	masterDataView gin.HandlerFunc,
	masterDataManage gin.HandlerFunc,
) {
	group := router.Group("/api/v1/master-data")
	group.Use(authGuard)

	group.GET("/overview", masterDataView, handler.Overview)
	group.POST("/categories/copy", masterDataManage, handler.CopyCategories)

	group.GET("/unit-categories", masterDataView, handler.ListUnitCategories)
	group.GET("/units", masterDataView, handler.ListUnits)
	group.POST("/units", masterDataManage, handler.CreateUnit)
	group.GET("/units/:id", masterDataView, handler.GetUnit)
	group.PATCH("/units/:id", masterDataManage, handler.UpdateUnit)
	group.PATCH("/units/:id/status", masterDataManage, handler.UpdateUnitStatus)
	group.DELETE("/units/:id", masterDataManage, handler.DeleteUnit)

	group.GET("/order-statuses", masterDataView, handler.ListOrderStatuses)
	group.POST("/order-statuses", masterDataManage, handler.CreateOrderStatus)
	group.PATCH("/order-statuses/:id", masterDataManage, handler.UpdateOrderStatus)
	group.PATCH("/order-statuses/:id/status", masterDataManage, handler.UpdateOrderStatusStatus)

	group.GET("/payment-statuses", masterDataView, handler.ListPaymentStatuses)
	group.POST("/payment-statuses", masterDataManage, handler.CreatePaymentStatus)
	group.PATCH("/payment-statuses/:id", masterDataManage, handler.UpdatePaymentStatus)
	group.PATCH("/payment-statuses/:id/status", masterDataManage, handler.UpdatePaymentStatusStatus)

	// Ingredient and packaging categories had handlers, configs and a
	// branch-scoped service, but were never registered — so the settings pages
	// that call these paths had no backend at all.
	registerSimpleRoutes(group, "/ingredient-categories", handler, ingredientConfig(), masterDataView, masterDataManage, "Ingredient")
	registerSimpleRoutes(group, "/packaging-categories", handler, packagingConfig(), masterDataView, masterDataManage, "Packaging")

	group.GET("/product-categories", masterDataView, handler.ListProductCategories)
	group.POST("/product-categories", masterDataManage, handler.CreateProductCategory)
	group.GET("/product-categories/:id", masterDataView, handler.GetProductCategory)
	group.PATCH("/product-categories/:id", masterDataManage, handler.UpdateProductCategory)
	group.PATCH("/product-categories/:id/status", masterDataManage, handler.UpdateProductCategoryStatus)
	group.DELETE("/product-categories/:id", masterDataManage, handler.DeleteProductCategory)
}

func registerSimpleRoutes(group *gin.RouterGroup, path string, handler *Handler, cfg simpleCategoryConfig, view gin.HandlerFunc, manage gin.HandlerFunc, label string) {
	group.GET(path, view, func(c *gin.Context) {
		handler.listSimple(c, cfg, label+" categories fetched successfully")
	})
	group.POST(path, manage, func(c *gin.Context) {
		handler.createSimple(c, cfg, label+" category created successfully")
	})
	group.GET(path+"/:id", view, func(c *gin.Context) {
		handler.getSimple(c, cfg, label+" category fetched successfully")
	})
	group.PATCH(path+"/:id", manage, func(c *gin.Context) {
		handler.updateSimple(c, cfg, label+" category updated successfully")
	})
	group.PATCH(path+"/:id/status", manage, func(c *gin.Context) {
		handler.statusSimple(c, cfg, label+" category status updated successfully")
	})
	group.DELETE(path+"/:id", manage, func(c *gin.Context) {
		handler.deleteSimple(c, cfg, label+" category deactivated successfully")
	})
}

func ingredientConfig() simpleCategoryConfig {
	return simpleCategoryConfig{Table: "ingredient_categories", EntityType: "ingredient_category", EventPrefix: "ingredient_category"}
}

func packagingConfig() simpleCategoryConfig {
	return simpleCategoryConfig{Table: "packaging_categories", EntityType: "packaging_category", EventPrefix: "packaging_category"}
}
