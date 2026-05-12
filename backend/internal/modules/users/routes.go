package users

import (
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	usersView gin.HandlerFunc,
	usersCreate gin.HandlerFunc,
	usersEdit gin.HandlerFunc,
	usersDelete gin.HandlerFunc,
) {
	group := router.Group("/api/v1/users")
	group.Use(authGuard)

	group.GET("", usersView, handler.ListUsers)
	group.POST("", usersCreate, handler.CreateUser)
	group.POST("/invite", usersCreate, handler.InviteUser)
	group.POST("/invitations", usersCreate, handler.CreateInvitation)
	group.GET("/invitations", usersView, handler.ListInvitations)
	group.POST("/invitations/:id/resend", usersEdit, handler.ResendInvitation)
	group.PATCH("/invitations/:id/cancel", usersEdit, handler.CancelInvitation)
	group.GET("/:id", usersView, handler.GetUser)
	group.GET("/:id/activity", usersView, handler.GetUserActivity)
	group.PATCH("/:id", usersEdit, handler.UpdateUser)
	group.PATCH("/:id/branch", usersEdit, handler.AssignUserBranch)
	group.PATCH("/:id/status", usersEdit, handler.UpdateUserStatus)
	group.PATCH("/:id/restore", usersDelete, handler.RestoreUser)
	group.DELETE("/:id", usersDelete, handler.DeleteUser)
}

func RegisterPublicAuthRoutes(router *gin.Engine, handler *Handler) {
	group := router.Group("/api/v1/auth")
	group.POST("/accept-invitation", handler.AcceptInvitation)
}
