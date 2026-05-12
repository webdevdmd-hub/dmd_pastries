package server

import (
	"fmt"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"pastries-pos/internal/config"
	"pastries-pos/internal/shared/response"
)

func NewRouter(cfg config.Config) *gin.Engine {
	gin.SetMode(cfg.GinMode)

	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
	}))

	router.GET("/health", func(c *gin.Context) {
		response.Success(c, 200, "ok", gin.H{
			"service": cfg.AppName,
			"status":  "healthy",
		})
	})

	return router
}

func Run(router *gin.Engine, port string) error {
	return router.Run(fmt.Sprintf(":%s", port))
}
