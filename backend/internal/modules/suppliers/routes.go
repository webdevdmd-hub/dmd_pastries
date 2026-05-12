package suppliers

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	view gin.HandlerFunc,
	manage gin.HandlerFunc,
) {
	group := router.Group("/api/v1/suppliers")
	group.Use(authGuard)

	group.GET("", view, handler.ListSuppliers)
	group.POST("", manage, handler.CreateSupplier)
	group.GET("/lookup", view, handler.LookupSuppliers)
	group.GET("/:id/contacts", view, handler.ListContacts)
	group.POST("/:id/contacts", manage, handler.CreateContact)
	group.PATCH("/:id/contacts/:contactId", manage, handler.UpdateContact)
	group.DELETE("/:id/contacts/:contactId", manage, handler.DeleteContact)
	group.GET("/:id/notes", view, handler.ListNotes)
	group.POST("/:id/notes", manage, handler.AddNote)
	group.DELETE("/:id/notes/:noteId", manage, handler.DeleteNote)
	group.GET("/:id/stats", view, handler.Stats)
	group.GET("/:id", view, handler.GetSupplier)
	group.PATCH("/:id", manage, handler.UpdateSupplier)
	group.PATCH("/:id/status", manage, handler.UpdateSupplierStatus)
	group.DELETE("/:id", manage, handler.DeleteSupplier)
}
