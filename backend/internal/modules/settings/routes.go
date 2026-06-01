package settings

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	settingsView gin.HandlerFunc,
	settingsManage gin.HandlerFunc,
) {
	group := router.Group("/api/v1/settings")
	group.Use(authGuard)

	group.GET("/company", settingsView, handler.GetCompanySettings)
	group.PATCH("/company", settingsManage, handler.UpdateCompanySettings)
	group.GET("/overview", settingsView, handler.GetOverview)

	group.GET("/tax-rates", settingsView, handler.ListTaxRates)
	group.POST("/tax-rates", settingsManage, handler.CreateTaxRate)
	group.GET("/tax-rates/:id", settingsView, handler.GetTaxRate)
	group.PATCH("/tax-rates/:id", settingsManage, handler.UpdateTaxRate)
	group.PATCH("/tax-rates/:id/status", settingsManage, handler.UpdateTaxRateStatus)
	group.DELETE("/tax-rates/:id", settingsManage, handler.DeleteTaxRate)

	group.GET("/payment-methods", settingsView, handler.ListPaymentMethods)
	group.POST("/payment-methods", settingsManage, handler.CreatePaymentMethod)
	group.GET("/payment-methods/:id", settingsView, handler.GetPaymentMethod)
	group.PATCH("/payment-methods/:id", settingsManage, handler.UpdatePaymentMethod)
	group.PATCH("/payment-methods/:id/status", settingsManage, handler.UpdatePaymentMethodStatus)
	group.DELETE("/payment-methods/:id", settingsManage, handler.DeletePaymentMethod)

	group.GET("/sales-channels", settingsView, handler.ListSalesChannels)
	group.POST("/sales-channels", settingsManage, handler.CreateSalesChannel)
	group.GET("/sales-channels/:id", settingsView, handler.GetSalesChannel)
	group.PATCH("/sales-channels/:id", settingsManage, handler.UpdateSalesChannel)
	group.PATCH("/sales-channels/:id/status", settingsManage, handler.UpdateSalesChannelStatus)
	group.PATCH("/sales-channels/:id/default", settingsManage, handler.SetDefaultSalesChannel)
	group.DELETE("/sales-channels/:id", settingsManage, handler.DeleteSalesChannel)

	group.GET("/receipt-layouts", settingsView, handler.ListReceiptLayouts)
	group.POST("/receipt-layouts", settingsManage, handler.CreateReceiptLayout)
	group.GET("/receipt-layouts/:id", settingsView, handler.GetReceiptLayout)
	group.PATCH("/receipt-layouts/:id", settingsManage, handler.UpdateReceiptLayout)
	group.DELETE("/receipt-layouts/:id", settingsManage, handler.DeleteReceiptLayout)
	group.PATCH("/receipt-layouts/:id/default", settingsManage, handler.SetDefaultReceiptLayout)
	group.POST("/receipt-layouts/:id/preview", settingsManage, handler.PreviewReceiptLayout)
}
