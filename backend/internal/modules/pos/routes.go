package pos

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	posView gin.HandlerFunc,
	posPaymentMethods gin.HandlerFunc,
	posSell gin.HandlerFunc,
	posRefund gin.HandlerFunc,
	posVoid gin.HandlerFunc,
) {
	group := router.Group("/api/v1/pos")
	group.Use(authGuard)

	group.GET("/payment-methods", posPaymentMethods, handler.ListPaymentMethods)
	group.GET("/reference-data", posPaymentMethods, handler.ReferenceData)
	group.GET("/products", posView, handler.ListProducts)
	group.GET("/products/lookup", posView, handler.LookupProduct)
	group.POST("/held-sales", posSell, handler.CreateHeldSale)
	group.GET("/held-sales", posView, handler.ListHeldSales)
	group.GET("/held-sales/:id", posView, handler.GetHeldSale)
	group.POST("/held-sales/:id/resume", posSell, handler.ResumeHeldSale)
	group.DELETE("/held-sales/:id", posSell, handler.CancelHeldSale)
	group.POST("/checkout", posSell, handler.Checkout)
	group.GET("/checkout-status/:checkout_reference", posSell, handler.GetCheckoutStatus)
	group.GET("/sales", posView, handler.ListSales)
	group.GET("/sales/:id", posView, handler.GetSale)
	group.GET("/sales/:id/receipt", posView, handler.GetReceipt)
	group.POST("/sales/:id/refund", posRefund, handler.RefundSale)
	group.POST("/sales/:id/void", posVoid, handler.VoidSale)
}
