package cache

import "time"

type Service struct{}

func NewService() *Service {
	return &Service{}
}

func (s *Service) GetDashboard(key string) ([]byte, bool) {
	// TODO: wire Redis-backed dashboard cache when Redis is configured.
	return nil, false
}

func (s *Service) SetDashboard(key string, value []byte, ttl time.Duration) error {
	// TODO: persist dashboard payload with a short TTL in Redis.
	return nil
}

func (s *Service) InvalidateDashboard(pattern string) error {
	// TODO: invalidate Redis dashboard keys by business/branch pattern.
	return nil
}
