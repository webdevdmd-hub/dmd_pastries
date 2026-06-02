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

	group.GET("/account-mappings", view, handler.ListAccountMappings)
	group.POST("/account-mappings/seed-defaults", manage, handler.SeedAccountMappings)
	group.PATCH("/account-mappings", manage, handler.UpdateAccountMappings)

	group.GET("/payment-accounts", view, handler.ListPaymentAccounts)
	group.POST("/payment-accounts", manage, handler.CreatePaymentAccount)
	group.GET("/payment-accounts/:id", view, handler.GetPaymentAccount)
	group.PATCH("/payment-accounts/:id", manage, handler.UpdatePaymentAccount)
	group.PATCH("/payment-accounts/:id/status", manage, handler.UpdatePaymentAccountStatus)
	group.DELETE("/payment-accounts/:id", manage, handler.DeletePaymentAccount)

	group.GET("/account-transfers", view, handler.ListAccountTransfers)
	group.POST("/account-transfers", manage, handler.CreateAccountTransfer)
	group.GET("/account-transfers/:id", view, handler.GetAccountTransfer)

	group.GET("/platform-settlements", view, handler.ListPlatformSettlements)
	group.POST("/platform-settlements", manage, handler.CreatePlatformSettlement)
	group.GET("/platform-settlements/:id", view, handler.GetPlatformSettlement)

	group.GET("/reports/general-ledger", view, handler.GetGeneralLedger)
	group.GET("/reports/trial-balance", view, handler.GetTrialBalance)
	group.GET("/reports/profit-loss", view, handler.GetProfitLoss)
	group.GET("/reports/balance-sheet", view, handler.GetBalanceSheet)

	group.GET("/journal-entries", view, handler.ListJournalEntries)
	group.POST("/journal-entries", manage, handler.CreateJournalEntry)
	group.GET("/journal-entries/:id", view, handler.GetJournalEntry)
	group.PATCH("/journal-entries/:id", manage, handler.UpdateJournalEntry)
	group.DELETE("/journal-entries/:id", manage, handler.DeleteJournalEntry)
	group.POST("/journal-entries/:id/post", manage, handler.PostJournalEntry)
	group.POST("/journal-entries/:id/reverse", manage, handler.ReverseJournalEntry)
}
