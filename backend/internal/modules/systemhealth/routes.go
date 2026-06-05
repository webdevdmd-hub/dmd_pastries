package systemhealth

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	settingsView gin.HandlerFunc,
) {
	group := router.Group("/api/v1/system")
	group.Use(authGuard)

	group.GET("/api-routes", settingsView, handler.ListApiRoutes)
}
