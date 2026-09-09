package config

import (
	"strings"
	"testing"
)

// productionish is a config with every dangerous setting explicitly configured,
// as a real deployment should have.
func productionish() Config {
	return Config{
		AppEnv:           "production",
		GinMode:          "release",
		PasswordResetURL: "https://app.example/reset-password",
		PostgresSSLMode:  "verify-full",
	}
}

func TestAConfiguredDeploymentWarnsAboutNothing(t *testing.T) {
	if found := productionish().DevDefaultsInUse(); len(found) != 0 {
		t.Errorf("warned about %d settings that are configured: %+v", len(found), found)
	}
	if banner := DevDefaultsBanner(nil); banner != "" {
		t.Errorf("banner = %q, want empty so quiet boots stay quiet", banner)
	}
}

// The bug this exists for. PASSWORD_RESET_URL was unset in production for long
// enough that staff stopped reporting broken resets and started asking an admin
// instead -- nothing errored, the email sent, and the link went nowhere.
func TestTheUnsetResetURLIsReported(t *testing.T) {
	cfg := productionish()
	cfg.PasswordResetURL = "http://localhost:3000/reset-password"

	found := cfg.DevDefaultsInUse()
	if len(found) != 1 || found[0].Key != "PASSWORD_RESET_URL" {
		t.Fatalf("found = %+v, want exactly PASSWORD_RESET_URL", found)
	}

	banner := DevDefaultsBanner(found)
	if !strings.Contains(banner, "PASSWORD_RESET_URL") {
		t.Error("the banner does not name the setting")
	}
	// Naming the key is not enough. Someone reading a startup log needs to know
	// what it costs, or they scroll past it -- which is how it survived.
	if !strings.Contains(banner, "do nothing for the person who clicked") {
		t.Error("the banner does not say what goes wrong, so it reads as noise")
	}
}

// The check must not be gated on APP_ENV, because APP_ENV is itself one of the
// settings that goes unset. A guard asking "am I in production?" answers "no"
// on exactly the deployments that most need warning.
func TestWarningsAreNotGatedOnAppEnv(t *testing.T) {
	cfg := productionish()
	cfg.AppEnv = "development" // as it would be if nobody set it
	cfg.PasswordResetURL = "http://localhost:3000/reset-password"

	keys := map[string]bool{}
	for _, item := range cfg.DevDefaultsInUse() {
		keys[item.Key] = true
	}

	if !keys["PASSWORD_RESET_URL"] {
		t.Error("an unset APP_ENV silenced the reset-URL warning, which is the exact " +
			"failure this check exists to avoid")
	}
	if !keys["APP_ENV"] {
		t.Error("an unset APP_ENV is not itself reported, so nothing reveals that " +
			"other environment-gated checks are inert")
	}
}

// Every entry must carry a consequence. A list of variable names is a list
// someone skims; the cost is what makes it actionable.
func TestEverySettingExplainsItsConsequence(t *testing.T) {
	for _, candidate := range dangerousDefaults {
		if strings.TrimSpace(candidate.consequence) == "" {
			t.Errorf("%s has no consequence text", candidate.key)
		}
	}
}

func TestSslModeDefaultIsFlagged(t *testing.T) {
	cfg := productionish()
	cfg.PostgresSSLMode = "disable"

	found := cfg.DevDefaultsInUse()
	if len(found) != 1 || found[0].Key != "POSTGRES_SSLMODE" {
		t.Fatalf("found = %+v, want POSTGRES_SSLMODE", found)
	}
	// Correct today and dangerous the moment the database moves off this host,
	// which is precisely a change that comes with no code change to notice.
	if !strings.Contains(found[0].Consequence, "only safe while the database is on this host") {
		t.Errorf("consequence = %q, want it to name the condition that makes it safe",
			found[0].Consequence)
	}
}
