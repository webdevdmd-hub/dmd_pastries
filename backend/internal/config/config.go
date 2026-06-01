package config

import (
	"fmt"
	"os"
	"strconv"

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
	PostgresTimezone         string
	AppwriteEndpoint         string
	AppwriteProjectID        string
	AppwriteAPIKey           string
	E2EAuthToken             string
	RequireEmailVerification bool
	PasswordResetURL         string
	DefaultBusinessCurrency  string
	DefaultBusinessTimezone  string
	DefaultTrialDays         int
	AutoRunMigrations        bool
	MigrationsPath           string
}

func Load() Config {
	loadDotEnv()

	cfg := loadDatabaseConfig()
	cfg.AppwriteEndpoint = mustEnv("APPWRITE_ENDPOINT")
	cfg.AppwriteProjectID = mustEnv("APPWRITE_PROJECT_ID")
	cfg.AppwriteAPIKey = mustEnv("APPWRITE_API_KEY")
	cfg.E2EAuthToken = getEnv("E2E_AUTH_TOKEN", "")
	cfg.RequireEmailVerification = getEnvBool("REQUIRE_EMAIL_VERIFICATION", false)
	cfg.PasswordResetURL = getEnv("PASSWORD_RESET_URL", "http://localhost:3000/reset-password")
	cfg.DefaultBusinessCurrency = getEnv("DEFAULT_BUSINESS_CURRENCY", "AED")
	cfg.DefaultBusinessTimezone = getEnv("DEFAULT_BUSINESS_TIMEZONE", "Asia/Dubai")
	cfg.DefaultTrialDays = getEnvInt("DEFAULT_TRIAL_DAYS", 14)
	cfg.AutoRunMigrations = getEnvBool("AUTO_RUN_MIGRATIONS", false)
	cfg.MigrationsPath = getEnv("MIGRATIONS_PATH", "migrations")
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
		PostgresTimezone: getEnv("POSTGRES_TIMEZONE", "UTC"),
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

	return fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=%s",
		c.PostgresHost,
		c.PostgresUser,
		c.PostgresPassword,
		c.PostgresDB,
		c.PostgresPort,
		c.PostgresSSLMode,
		c.PostgresTimezone,
	)
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
