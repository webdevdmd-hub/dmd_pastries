package dashboard

// Package dashboard is reserved for dashboard-specific report orchestration as
// report complexity grows. Sprint 5.1 keeps the first dashboard aggregations in
// the parent reports repository to avoid premature indirection.
type Service struct{}

func NewService() *Service {
	return &Service{}
}
