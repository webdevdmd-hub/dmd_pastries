package config

import (
	"fmt"
	"strings"
)

// DevDefault is one setting still sitting on the value it falls back to when
// nobody configures it.
type DevDefault struct {
	Key         string
	Value       string
	Consequence string
}

// dangerousDefaults are the settings whose fallback is right for a laptop and
// wrong for a shop.
//
// Every entry earned its place by being wrong in production at some point, or
// by being one deploy away from it. The list is deliberately short: a warning
// that names ten things gets skimmed, and the one that mattered goes with it.
var dangerousDefaults = []struct {
	key      string
	fallback string
	actual   func(Config) string
	// unsafe reports whether the current value is the dangerous one.
	//
	// nil means "equal to fallback", which is the ordinary case: a setting
	// nobody configured. It exists for the settings where the dangerous value
	// is one somebody chose -- those cannot be caught by comparing against a
	// default, and they are the ones most likely to be believed safe.
	unsafe      func(string) bool
	consequence string
}{
	{
		key:      "PASSWORD_RESET_URL",
		fallback: "http://localhost:3000/reset-password",
		actual:   func(c Config) string { return c.PasswordResetURL },
		// Found unset in production on 2026-09-09, having been that way long
		// enough that staff had settled on asking an admin instead. Nothing
		// errors: the provider sends the email, the link resolves to nowhere,
		// and the failure lands on someone with no way to report it usefully.
		consequence: "password reset emails link to localhost and do nothing for the person who clicked",
	},
	{
		key:      "APP_ENV",
		fallback: "development",
		actual:   func(c Config) string { return c.AppEnv },
		// Worth naming for a second-order reason: any guard written as "warn if
		// APP_ENV is production" is inert while this is unset, so an unset
		// APP_ENV quietly disables other safety checks as well as this one.
		consequence: "the app believes it is running on a laptop, which disables environment-gated checks",
	},
	{
		key:         "GIN_MODE",
		fallback:    "debug",
		actual:      func(c Config) string { return c.GinMode },
		consequence: "debug logging and route dumps in production output",
	},
	{
		key:      "POSTGRES_SSLMODE",
		fallback: "disable",
		actual:   func(c Config) string { return c.PostgresSSLMode },
		// Correct while Postgres shares a Docker bridge with the API. It stops
		// being correct the moment the database is reached over a network, and
		// nothing about the app changes at that moment to say so.
		consequence: "database traffic is unencrypted, which is only safe while the database is on this host",
	},
	{
		key:      "POSTGRES_SSLMODE",
		fallback: "verify-full",
		actual:   func(c Config) string { return c.PostgresSSLMode },
		// The dangerous middle. `require` encrypts and verifies nothing, so it
		// silences the warning above while leaving the connection open to
		// anything that can answer for the database host -- and it is the value
		// people reach for, because it reads like the secure one.
		//
		// `prefer` and `allow` are worse again: they fall back to plaintext
		// without saying so, so the connection can be unencrypted while the
		// setting claims otherwise.
		unsafe: func(value string) bool {
			switch strings.ToLower(strings.TrimSpace(value)) {
			case "require", "prefer", "allow":
				return true
			default:
				return false
			}
		},
		consequence: "traffic is encrypted but the server certificate is never checked, " +
			"so anything that can answer for the database host can read and rewrite every query",
	},
}

// DevDefaultsInUse lists the settings still on their fallback values.
//
// Deliberately not gated on APP_ENV. The whole failure being guarded here is a
// setting nobody configured, and APP_ENV is one of those settings -- a check
// that asks "am I in production?" answers "no" on exactly the deployments that
// need the warning most.
func (c Config) DevDefaultsInUse() []DevDefault {
	found := make([]DevDefault, 0, len(dangerousDefaults))

	for _, candidate := range dangerousDefaults {
		value := candidate.actual(c)

		dangerous := value == candidate.fallback
		if candidate.unsafe != nil {
			dangerous = candidate.unsafe(value)
		}
		if !dangerous {
			continue
		}

		// The actual value, not the fallback. They are the same thing for an
		// unset setting and different for a chosen one, and printing the
		// fallback there would report a value nobody set.
		found = append(found, DevDefault{
			Key:         candidate.key,
			Value:       value,
			Consequence: candidate.consequence,
		})
	}

	return found
}

// DevDefaultsBanner renders the warning, or "" when there is nothing to say.
//
// Returned as one multi-line string rather than a line per setting so it cannot
// be split up by interleaved logs from other goroutines at boot -- a warning
// scattered through a startup sequence is a warning nobody reads.
func DevDefaultsBanner(defaults []DevDefault) string {
	if len(defaults) == 0 {
		return ""
	}

	var builder strings.Builder
	builder.WriteString("\n")
	builder.WriteString("================================================================\n")
	builder.WriteString(fmt.Sprintf(" %d setting(s) are running on development defaults\n", len(defaults)))
	builder.WriteString("================================================================\n")

	for _, item := range defaults {
		builder.WriteString(fmt.Sprintf("  %s = %q\n", item.Key, item.Value))
		builder.WriteString(fmt.Sprintf("      -> %s\n", item.Consequence))
	}

	builder.WriteString("  Set these in the deployment environment if this is not a laptop.\n")
	builder.WriteString("================================================================")

	return builder.String()
}
