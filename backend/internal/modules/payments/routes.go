package payments

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	view gin.HandlerFunc,
	manage gin.HandlerFunc,
	refund gin.HandlerFunc,
	summary gin.HandlerFunc,
	reconcile gin.HandlerFunc,
) {
	group := router.Group("/api/v1/payments")
	group.Use(authGuard)

	group.GET("", view, handler.ListPayments)
	group.GET("/summary/daily", summary, handler.DailySummary)
	group.GET("/summary/by-method", summary, handler.MethodSummary)
	group.GET("/refunds", refund, handler.ListRefunds)
	group.GET("/refunds/:id", refund, handler.GetRefund)
	group.POST("/reconciliations", reconcile, handler.CreateReconciliation)
	group.GET("/reconciliations", reconcile, handler.ListReconciliations)
	group.GET("/reconciliations/:id", reconcile, handler.GetReconciliation)
	group.GET("/sale/:saleId", view, handler.SalePayments)
	group.POST("/sale/:saleId/add-payment", manage, handler.AddPayment)
	group.POST("/:paymentId/refund", refund, handler.RefundPayment)
	group.GET("/:id", view, handler.GetPayment)
}
