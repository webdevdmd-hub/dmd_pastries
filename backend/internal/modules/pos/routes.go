package pos

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	posView gin.HandlerFunc,
	posPaymentMethods gin.HandlerFunc,
	// One guard per action. Checkout, hold, resume and cancel shared a single
	// guard, so any one of their permissions unlocked all four (ISSUE-065).
	posSell gin.HandlerFunc,
	posHold gin.HandlerFunc,
	posResume gin.HandlerFunc,
	posCancelHeld gin.HandlerFunc,
	posRefund gin.HandlerFunc,
	posVoid gin.HandlerFunc,
) {
	group := router.Group("/api/v1/pos")
	group.Use(authGuard)

	group.GET("/payment-methods", posPaymentMethods, handler.ListPaymentMethods)
	group.GET("/reference-data", posPaymentMethods, handler.ReferenceData)
	group.GET("/products", posView, handler.ListProducts)
	group.GET("/products/lookup", posView, handler.LookupProduct)
	group.POST("/held-sales", posHold, handler.CreateHeldSale)
	group.GET("/held-sales", posView, handler.ListHeldSales)
	group.GET("/held-sales/:id", posView, handler.GetHeldSale)
	group.POST("/held-sales/:id/resume", posResume, handler.ResumeHeldSale)
	group.DELETE("/held-sales/:id", posCancelHeld, handler.CancelHeldSale)
	group.POST("/checkout", posSell, handler.Checkout)
	group.GET("/checkout-status/:checkout_reference", posSell, handler.GetCheckoutStatus)
	group.GET("/sales", posView, handler.ListSales)
	group.GET("/sales/:id", posView, handler.GetSale)
	group.GET("/sales/:id/receipt", posView, handler.GetReceipt)
	group.POST("/sales/:id/refund", posRefund, handler.RefundSale)
	group.POST("/sales/:id/void", posVoid, handler.VoidSale)
}
