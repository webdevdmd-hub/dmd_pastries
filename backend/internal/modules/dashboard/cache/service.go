package cache

import "time"

// Service is a placeholder: nothing calls Get or Set, so every dashboard is
// computed live.
//
// SECURITY: before wiring a real cache, every key must include business_id and
// branch_id. The callers pass an opaque key and there is no key builder, so a
// key that omits either would serve one tenant's or branch's figures to
// another. Write paths also need invalidation, which does not exist yet.
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
