package middleware

import (
	"time"

	"github.com/gin-gonic/gin"

	"pastries-pos/internal/shared/telemetry"
)

// RequestStats counts served requests and their wall-clock duration.
//
// Paired with the SQL statement counter, this gives statements-per-request:
// the number that decides whether the database can move to a host reached over
// the internet. Both are process-wide counters sampled over the same interval,
// so the ratio holds regardless of how many requests overlapped.
//
// Health checks are excluded. Dokploy polls /health continuously, and counting
// those would divide the real statement total by a request count dominated by
// requests that touch no database at all -- making the app look far leaner than
// it is, on precisely the measurement being used to green-light the move.
func RequestStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.URL.Path == "/health" {
			c.Next()
			return
		}

		start := time.Now()
		c.Next()
		telemetry.RecordRequest(time.Since(start))
	}
}
