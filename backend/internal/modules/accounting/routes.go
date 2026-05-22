package accounting

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	view gin.HandlerFunc,
	manage gin.HandlerFunc,
) {
	group := router.Group("/api/v1/accounting")
	group.Use(authGuard)

	group.GET("/chart-of-accounts", view, handler.ListChartAccounts)
	group.POST("/chart-of-accounts/seed-defaults", manage, handler.SeedDefaults)
	group.POST("/chart-of-accounts", manage, handler.CreateChartAccount)
	group.GET("/chart-of-accounts/:id/ledger-details", view, handler.GetLedgerDetails)
	group.GET("/chart-of-accounts/:id", view, handler.GetChartAccount)
	group.PATCH("/chart-of-accounts/:id", manage, handler.UpdateChartAccount)
	group.PATCH("/chart-of-accounts/:id/status", manage, handler.UpdateChartAccountStatus)
	group.DELETE("/chart-of-accounts/:id", manage, handler.DeleteChartAccount)

	group.GET("/reports/general-ledger", view, handler.GetGeneralLedger)
	group.GET("/reports/trial-balance", view, handler.GetTrialBalance)
	group.GET("/reports/profit-loss", view, handler.GetProfitLoss)
	group.GET("/reports/balance-sheet", view, handler.GetBalanceSheet)

	group.GET("/journal-entries", view, handler.ListJournalEntries)
	group.POST("/journal-entries", manage, handler.CreateJournalEntry)
	group.GET("/journal-entries/:id", view, handler.GetJournalEntry)
	group.PATCH("/journal-entries/:id", manage, handler.UpdateJournalEntry)
	group.POST("/journal-entries/:id/post", manage, handler.PostJournalEntry)
	group.POST("/journal-entries/:id/reverse", manage, handler.ReverseJournalEntry)
}
