package branches

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	branchesView gin.HandlerFunc,
	branchesManage gin.HandlerFunc,
) {
	group := router.Group("/api/v1/branches")
	group.Use(authGuard)

	group.GET("", branchesView, handler.ListBranches)
	group.POST("", branchesManage, handler.CreateBranch)
	group.GET("/:id", branchesView, handler.GetBranch)
	group.PATCH("/:id", branchesManage, handler.UpdateBranch)
	group.PATCH("/:id/status", branchesManage, handler.UpdateBranchStatus)
}
