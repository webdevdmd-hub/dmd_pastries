package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv                   string
	AppName                  string
	Port                     string
	GinMode                  string
	DatabaseURL              string
	PostgresHost             string
	PostgresPort             string
	PostgresUser             string
	PostgresPassword         string
	PostgresDB               string
	PostgresSSLMode          string
	PostgresSSLRootCert      string
	PostgresTimezone         string
	DBMaxOpenConns           int
	DBMaxIdleConns           int
	DBConnMaxLifetimeMinutes int
	DBConnMaxIdleMinutes     int
	DBStatsLogSeconds        int
	AppwriteEndpoint         string
	AppwriteProjectID        string
	AppwriteAPIKey           string
	SupabaseURL              string
	SupabaseJWTSecret        string
	SupabaseServiceRoleKey   string
	AuthPrimaryProvider      string
	E2EAuthToken             string
	RequireEmailVerification bool
	PasswordResetURL         string
	DefaultBusinessCurrency  string
	DefaultBusinessTimezone  string
	DefaultTrialDays         int
	AutoRunMigrations        bool
	MigrationsPath           string
	SuperAdminEnabled        bool
	SuperAdminEmails         []string
	CORSAllowedOrigins       []string
}

func Load() Config {
	loadDotEnv()

	cfg := loadDatabaseConfig()
	cfg.AppwriteEndpoint = mustEnv("APPWRITE_ENDPOINT")
	cfg.AppwriteProjectID = mustEnv("APPWRITE_PROJECT_ID")
	cfg.AppwriteAPIKey = mustEnv("APPWRITE_API_KEY")
	// Optional on purpose. While these are empty the Supabase verifier refuses
	// every token and the app runs exactly as it did before, so this ships
	// inert and the cutover is a deploy-time environment change rather than a
	// code change. mustEnv here would make the migration a flag day.
	cfg.SupabaseURL = getEnv("SUPABASE_URL", "")
	cfg.SupabaseJWTSecret = getEnv("SUPABASE_JWT_SECRET", "")
	// Unrestricted database access, including the auth schema. Never goes to
	// the frontend and never appears in an error returned to a caller.
	cfg.SupabaseServiceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY", "")
	// The cutover switch. Both providers keep verifying tokens either way;
	// this decides which one issues sessions for new sign-ins and therefore
	// which one sends password reset emails. Flipping it back is the rollback.
	cfg.AuthPrimaryProvider = getEnv("AUTH_PRIMARY_PROVIDER", "appwrite")
	cfg.E2EAuthToken = getEnv("E2E_AUTH_TOKEN", "")
	cfg.RequireEmailVerification = getEnvBool("REQUIRE_EMAIL_VERIFICATION", false)
	cfg.PasswordResetURL = getEnv("PASSWORD_RESET_URL", "http://localhost:3000/reset-password")
	cfg.DefaultBusinessCurrency = getEnv("DEFAULT_BUSINESS_CURRENCY", "AED")
	cfg.DefaultBusinessTimezone = getEnv("DEFAULT_BUSINESS_TIMEZONE", "Asia/Dubai")
	cfg.DefaultTrialDays = getEnvInt("DEFAULT_TRIAL_DAYS", 14)
	cfg.AutoRunMigrations = getEnvBool("AUTO_RUN_MIGRATIONS", false)
	cfg.MigrationsPath = getEnv("MIGRATIONS_PATH", "migrations")
	cfg.SuperAdminEnabled = getEnvBool("SUPER_ADMIN_ENABLED", false)
	cfg.SuperAdminEmails = getEnvStringList("SUPER_ADMIN_EMAILS")
	cfg.CORSAllowedOrigins = getEnvStringList("CORS_ALLOWED_ORIGINS")
	return cfg
}

func LoadDatabase() Config {
	loadDotEnv()
	return loadDatabaseConfig()
}

func loadDatabaseConfig() Config {
	return Config{
		AppEnv:           getEnv("APP_ENV", "development"),
		AppName:          getEnv("APP_NAME", "pastries-pos-api"),
		Port:             getEnv("PORT", "8080"),
		GinMode:          getEnv("GIN_MODE", "debug"),
		DatabaseURL:      getEnv("DATABASE_URL", ""),
		PostgresHost:     getEnv("POSTGRES_HOST", ""),
		PostgresPort:     getEnv("POSTGRES_PORT", "5432"),
		PostgresUser:     getEnv("POSTGRES_USER", ""),
		PostgresPassword: getEnv("POSTGRES_PASSWORD", ""),
		PostgresDB:       getEnv("POSTGRES_DB", ""),
		PostgresSSLMode:  getEnv("POSTGRES_SSLMODE", "disable"),
		// No fallback on purpose. An empty sslrootcert is not the same as an
		// absent one -- libpq treats it as a path to a file that is not there
		// and refuses the connection, so a default here would break every
		// deployment that never sets it.
		PostgresSSLRootCert: getEnv("POSTGRES_SSLROOTCERT", ""),
		PostgresTimezone:    getEnv("POSTGRES_TIMEZONE", "UTC"),

		// Go's database/sql defaults are unlimited open connections and two
		// idle ones. On a Postgres sharing the Docker bridge that only ever
		// showed up as a busy afternoon opening more connections than anyone
		// counted. Against a managed Postgres reached over the internet both
		// halves bite: unlimited open exhausts the provider's client limit and
		// starts refusing connections instead of queueing, and an idle cap of
		// two means almost every query re-runs the TCP and TLS handshake --
		// three extra round trips, on a connection that used to be free.
		//
		// Idle is held equal to open so a connection that has been paid for
		// stays paid for; the lifetime and idle timeouts below are what
		// actually retire them.
		DBMaxOpenConns:           getEnvInt("DB_MAX_OPEN_CONNS", 25),
		DBMaxIdleConns:           getEnvInt("DB_MAX_IDLE_CONNS", 25),
		DBConnMaxLifetimeMinutes: getEnvInt("DB_CONN_MAX_LIFETIME_MINUTES", 30),
		DBConnMaxIdleMinutes:     getEnvInt("DB_CONN_MAX_IDLE_MINUTES", 5),
		DBStatsLogSeconds:        getEnvInt("DB_STATS_LOG_SECONDS", 0),
	}
}

func loadDotEnv() {
	_ = godotenv.Load()
}

func (c Config) PostgresDSN() string {
	if c.DatabaseURL != "" {
		return c.DatabaseURL
	}

	if c.PostgresHost == "" || c.PostgresUser == "" || c.PostgresPassword == "" || c.PostgresDB == "" {
		panic("missing database configuration: set DATABASE_URL or all required POSTGRES_* variables")
	}

	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=%s",
		c.PostgresHost,
		c.PostgresUser,
		c.PostgresPassword,
		c.PostgresDB,
		c.PostgresPort,
		c.PostgresSSLMode,
		c.PostgresTimezone,
	)

	// Appended rather than added to the format string, so a deployment that
	// does not set it gets the exact DSN it got before.
	//
	// Only needed when the server's certificate is signed by an authority the
	// image does not already trust. The runtime image now installs
	// ca-certificates, so a publicly signed certificate verifies without this;
	// it exists for a provider that hands out its own root, which is how
	// Supabase's direct connection is documented.
	if root := strings.TrimSpace(c.PostgresSSLRootCert); root != "" {
		dsn += " sslrootcert=" + root
	}

	return dsn
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func mustEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		panic(fmt.Sprintf("missing required environment variable: %s. Create a .env file in the project root and set this value, or export it in your shell", key))
	}
	return value
}

func getEnvInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		panic(fmt.Sprintf("invalid integer value for %s", key))
	}

	return parsed
}

func getEnvBool(key string, fallback bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseBool(value)
	if err != nil {
		panic(fmt.Sprintf("invalid boolean value for %s", key))
	}

	return parsed
}

func getEnvStringList(key string) []string {
	value := os.Getenv(key)
	if value == "" {
		return []string{}
	}

	parts := strings.Split(value, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		normalized := strings.ToLower(strings.TrimSpace(part))
		if normalized != "" {
			values = append(values, normalized)
		}
	}

	return values
}
