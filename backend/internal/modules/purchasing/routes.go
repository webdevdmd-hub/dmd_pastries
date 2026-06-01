package purchasing

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	view gin.HandlerFunc,
	manage gin.HandlerFunc,
) {
	group := router.Group("/api/v1/purchasing")
	group.Use(authGuard)

	group.GET("/document-chain", view, handler.GetDocumentChain)

	group.GET("/orders", view, handler.ListOrders)
	group.POST("/orders", manage, handler.CreateOrder)
	group.GET("/orders/:id", view, handler.GetOrder)
	group.GET("/orders/:id/document-chain", view, handler.GetOrderDocumentChain)
	group.PATCH("/orders/:id", manage, handler.UpdateOrder)
	group.PATCH("/orders/:id/status", manage, handler.UpdateOrderStatus)
	group.POST("/orders/:id/convert-to-invoice", manage, handler.ConvertOrderToInvoice)
	group.DELETE("/orders/:id", manage, handler.DeleteOrder)

	group.GET("/invoices", view, handler.ListInvoices)
	group.POST("/invoices", manage, handler.CreateInvoice)
	group.GET("/payments", view, handler.ListInvoicePayments)
	group.GET("/invoices/:id", view, handler.GetInvoice)
	group.PATCH("/invoices/:id", manage, handler.UpdateInvoice)
	group.POST("/invoices/:id/post", manage, handler.PostInvoice)
	group.POST("/invoices/:id/cancel", manage, handler.CancelInvoice)
	group.POST("/invoices/:id/convert-to-receipt", manage, handler.ConvertInvoiceToReceipt)
	group.GET("/invoices/:id/payments", view, handler.ListInvoicePaymentsByInvoice)
	group.POST("/invoices/:id/payments", manage, handler.AddInvoicePayment)

	group.POST("/receive", manage, handler.Receive)
	group.GET("/receipts", view, handler.ListReceipts)
	group.GET("/receipts/:id", view, handler.GetReceipt)
	group.POST("/receipts/:id/post", manage, handler.PostReceipt)
	group.POST("/receipts/:id/cancel", manage, handler.CancelReceipt)

	group.GET("/summary", view, handler.Summary)
	group.GET("/supplier/:supplierId/history", view, handler.SupplierHistory)
}
