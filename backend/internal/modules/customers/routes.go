package customers

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	view gin.HandlerFunc,
	manage gin.HandlerFunc,
) {
	group := router.Group("/api/v1/customers")
	group.Use(authGuard)

	group.GET("", view, handler.ListCustomers)
	group.POST("", manage, handler.CreateCustomer)
	group.GET("/lookup", view, handler.LookupCustomers)
	group.POST("/quick-create", manage, handler.QuickCreateCustomer)

	group.GET("/tags", view, handler.ListTags)
	group.POST("/tags", manage, handler.CreateTag)
	group.PATCH("/tags/:id", manage, handler.UpdateTag)
	group.DELETE("/tags/:id", manage, handler.DeleteTag)

	group.GET("/:id/notes", view, handler.ListNotes)
	group.POST("/:id/notes", manage, handler.AddNote)
	group.DELETE("/:id/notes/:noteId", manage, handler.DeleteNote)
	group.GET("/:id/tags", view, handler.ListCustomerTags)
	group.POST("/:id/tags", manage, handler.AttachTag)
	group.DELETE("/:id/tags/:tagId", manage, handler.RemoveTag)
	group.GET("/:id/stats", view, handler.Stats)
	group.GET("/:id", view, handler.GetCustomer)
	group.PATCH("/:id", manage, handler.UpdateCustomer)
	group.PATCH("/:id/status", manage, handler.UpdateCustomerStatus)
	group.DELETE("/:id", manage, handler.DeleteCustomer)
}
