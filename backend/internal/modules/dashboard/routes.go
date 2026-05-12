package dashboard

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	view gin.HandlerFunc,
) {
	group := router.Group("/api/v1/dashboard")
	group.Use(authGuard)

	group.GET("/admin", view, handler.AdminDashboard)
	group.GET("/cashier", view, handler.CashierDashboard)
	group.GET("/production", view, handler.ProductionDashboard)
	group.GET("/purchasing", view, handler.PurchasingDashboard)
	group.GET("/recent-activity", view, handler.RecentActivity)
	group.GET("/alerts", view, handler.Alerts)
	group.GET("/kpi-summary", view, handler.KPISummary)
}
