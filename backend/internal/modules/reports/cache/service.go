package cache

import "time"

// Service is a placeholder: nothing calls Get or Set, so every report is
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

func (s *Service) Get(key string) ([]byte, bool, error) {
	// TODO: Wire Redis here when report caching is enabled.
	return nil, false, nil
}

func (s *Service) Set(key string, value []byte, ttl time.Duration) error {
	// TODO: Wire Redis here when report caching is enabled.
	return nil
}

func (s *Service) Invalidate(pattern string) error {
	// TODO: Wire Redis key invalidation here when report caching is enabled.
	return nil
}
