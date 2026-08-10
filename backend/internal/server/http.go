package server

import (
	"fmt"
	"net/http"
	"time"

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
	// CORS_ALLOWED_ORIGINS restricts browser access to known frontends;
	// an empty list falls back to allowing every origin so local setups keep working.
	allowedOrigins := cfg.CORSAllowedOrigins
	if len(allowedOrigins) == 0 {
		allowedOrigins = []string{"*"}
	}
	router.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Length", "Content-Type", "Accept", "Authorization", "X-Requested-With", "X-Appwrite-Project", "X-Appwrite-JWT", "X-Appwrite-Response-Format", "Cache-Control", "Pragma"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))
	router.Use(func(c *gin.Context) {
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

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
