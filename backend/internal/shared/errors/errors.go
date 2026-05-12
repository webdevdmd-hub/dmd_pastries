package errors

import "net/http"

type AppError struct {
	StatusCode int         `json:"-"`
	Message    string      `json:"message"`
	Details    interface{} `json:"details,omitempty"`
}

func (e *AppError) Error() string {
	return e.Message
}

func New(status int, message string, details interface{}) *AppError {
	return &AppError{
		StatusCode: status,
		Message:    message,
		Details:    details,
	}
}

func BadRequest(message string, details interface{}) *AppError {
	return New(http.StatusBadRequest, message, details)
}

func Unauthorized(message string) *AppError {
	return New(http.StatusUnauthorized, message, nil)
}

func Forbidden(message string) *AppError {
	return New(http.StatusForbidden, message, nil)
}

func NotFound(message string) *AppError {
	return New(http.StatusNotFound, message, nil)
}

func Conflict(message string, details interface{}) *AppError {
	return New(http.StatusConflict, message, details)
}

func Internal(message string) *AppError {
	return New(http.StatusInternalServerError, message, nil)
}
