package response

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Meta struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	Errors  interface{} `json:"errors,omitempty"`
}

func Success(c *gin.Context, status int, message string, data interface{}) {
	c.JSON(status, Meta{
		Success: true,
		Message: message,
		Data:    data,
	})
}

func Error(c *gin.Context, status int, message string, err interface{}) {
	c.JSON(status, Meta{
		Success: false,
		Message: message,
		Errors:  err,
	})
}

// InternalErrorMessage is all a user sees when something unexpected fails.
const InternalErrorMessage = "Something went wrong on our side. Please try again, and contact support if it keeps happening."

// InternalError answers an unexpected failure without exposing it.
//
// Handlers used to put err.Error() in the response -- as the message in two
// modules, as the error detail in the rest -- and the client shows readable
// detail. On production on 2026-09-16 a failed expense save toasted:
//
//	ERROR: duplicate key value violates unique constraint
//	"idx_journal_entries_unique_source_posted" (SQLSTATE 23505)
//
// A constraint name, a table's index scheme and the database engine, to a
// bakery counter. The error is logged here, with the route, for whoever
// investigates; the user gets a sentence.
//
// Regression: ISSUE-038 — server errors showed raw database messages to users
// Found by /qa on 2026-09-16
func InternalError(c *gin.Context, err error) {
	if err != nil {
		log.Printf("internal error: %s %s: %v", c.Request.Method, c.FullPath(), err)
	}
	c.JSON(http.StatusInternalServerError, Meta{
		Success: false,
		Message: InternalErrorMessage,
	})
}
