package dashboard

// Repository is a placeholder for dashboard-only SQL helpers when the dashboard
// report expands beyond the shared foundation queries.
type Repository struct{}

func NewRepository() *Repository {
	return &Repository{}
}
