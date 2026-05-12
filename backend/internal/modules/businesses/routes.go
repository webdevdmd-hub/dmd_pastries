package businesses

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	settingsView gin.HandlerFunc,
	settingsManage gin.HandlerFunc,
) {
	businessGroup := router.Group("/api/v1/business")
	businessGroup.Use(authGuard)
	businessGroup.GET("", settingsView, handler.GetBusiness)
	businessGroup.PATCH("", settingsManage, handler.UpdateBusiness)
	businessGroup.GET("/onboarding-status", settingsView, handler.GetOnboardingStatus)

	settingsGroup := router.Group("/api/v1/settings")
	settingsGroup.Use(authGuard)
	settingsGroup.GET("", settingsView, handler.GetSettings)
	settingsGroup.PATCH("", settingsManage, handler.UpdateSettings)

	authGroup := router.Group("/api/v1/auth")
	authGroup.Use(authGuard)
	authGroup.POST("/switch-branch", settingsView, handler.SwitchBranch)
}
