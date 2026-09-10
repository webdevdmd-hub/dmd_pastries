package server

import (
	"net/url"
	"strings"

	"pastries-pos/internal/config"
)

// configSummary says which backends this process was configured to use,
// coarsely enough to publish on an unauthenticated endpoint.
//
// It exists because of a specific confusion during the Supabase cutover. The
// container runs the migrator before the API, so a deploy whose database
// settings are wrong dies at boot -- and the previous container keeps serving.
// From outside, "the switch worked" and "the switch failed and the old build is
// still up" look identical: same URL, same 200, same "healthy". Three rounds of
// "done" were spent that way. This makes the difference visible in one request.
//
// Deliberately coarse. Hostnames are classified, never echoed: the old
// database's name is an internal Docker alias, and the only thing anyone
// outside needs to know is whether the API is pointed at Supabase or not.
func configSummary(cfg config.Config) map[string]any {
	host := strings.TrimSpace(cfg.PostgresHost)
	// DATABASE_URL, when set, replaces the whole DSN and every POSTGRES_*
	// variable is ignored. That is the single most likely reason a database
	// change "did not take", so it is reported by name.
	override := strings.TrimSpace(cfg.DatabaseURL) != ""
	if override {
		host = ""
		if parsed, err := url.Parse(strings.TrimSpace(cfg.DatabaseURL)); err == nil {
			host = parsed.Hostname()
		}
	}

	database := "other"
	if strings.HasSuffix(host, ".supabase.co") || strings.HasSuffix(host, ".supabase.com") {
		database = "supabase"
	}

	appwrite := strings.TrimSpace(cfg.AppwriteEndpoint) != "" &&
		strings.TrimSpace(cfg.AppwriteProjectID) != "" &&
		strings.TrimSpace(cfg.AppwriteAPIKey) != ""
	supabase := strings.TrimSpace(cfg.SupabaseURL) != ""

	// Mirrors IdentityManager.PrimaryIsSupabase: with no Appwrite there is
	// nothing else to be primary, whatever the flag says.
	auth := "appwrite"
	if supabase && (!appwrite || strings.EqualFold(strings.TrimSpace(cfg.AuthPrimaryProvider), "supabase")) {
		auth = "supabase"
	}

	return map[string]any{
		"database":              database,
		"database_url_override": override,
		"database_tls":          strings.TrimSpace(cfg.PostgresSSLMode),
		"auth":                  auth,
		"appwrite_configured":   appwrite,
		"supabase_configured":   supabase,
	}
}
