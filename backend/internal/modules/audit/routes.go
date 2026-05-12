package audit

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	settingsManage gin.HandlerFunc,
) {
	group := router.Group("/api/v1/activity-logs")
	group.Use(authGuard)

	group.GET("", settingsManage, handler.ListActivityLogs)
}
