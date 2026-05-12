package cache

import "time"

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
