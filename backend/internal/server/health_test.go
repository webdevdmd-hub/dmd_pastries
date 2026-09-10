package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"pastries-pos/internal/config"
)

// The question /health exists to answer: is this process pointed at Supabase,
// and if not, why not. Each case below is a state that was actually observed
// during the cutover.

func TestHealthClassifiesThePoolerAsSupabase(t *testing.T) {
	summary := configSummary(config.Config{
		PostgresHost:    "aws-0-ap-south-1.pooler.supabase.com",
		PostgresSSLMode: "verify-full",
	})

	if summary["database"] != "supabase" {
		t.Errorf("database = %v, want supabase", summary["database"])
	}
	if summary["database_url_override"] != false {
		t.Error("no DATABASE_URL was set, yet an override was reported")
	}
	if summary["database_tls"] != "verify-full" {
		t.Errorf("database_tls = %v", summary["database_tls"])
	}
}

// The trap that cost three rounds of "done": every POSTGRES_* variable was
// changed correctly, and DATABASE_URL -- still pointing at the old database --
// silently won. The summary has to name that by itself.
func TestHealthReportsADatabaseURLOverride(t *testing.T) {
	summary := configSummary(config.Config{
		DatabaseURL:  "postgresql://user:pw@dmdpastries-internal-alias:5432/dmd_pastries",
		PostgresHost: "aws-0-ap-south-1.pooler.supabase.com", // ignored by the app when DATABASE_URL is set
	})

	if summary["database_url_override"] != true {
		t.Fatal("DATABASE_URL is set and the override was not reported")
	}
	if summary["database"] != "other" {
		t.Errorf("database = %v; DATABASE_URL points at the old host, so POSTGRES_HOST must not be believed", summary["database"])
	}
}

func TestHealthClassifiesADatabaseURLThatPointsAtSupabase(t *testing.T) {
	summary := configSummary(config.Config{
		DatabaseURL: "postgresql://postgres.ref:pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
	})
	if summary["database"] != "supabase" || summary["database_url_override"] != true {
		t.Errorf("summary = %v", summary)
	}
}

func TestHealthReportsWhichProviderIssuesSessions(t *testing.T) {
	both := config.Config{
		AppwriteEndpoint: "https://appwrite.example.test/v1", AppwriteProjectID: "p", AppwriteAPIKey: "k",
		SupabaseURL: "https://examplerefnotreal01.supabase.co",
	}

	for _, tc := range []struct {
		name string
		cfg  config.Config
		want string
	}{
		{"nothing configured", config.Config{}, "appwrite"},
		{"appwrite only", config.Config{AppwriteEndpoint: "https://a.test/v1", AppwriteProjectID: "p", AppwriteAPIKey: "k"}, "appwrite"},
		{"supabase only, flag unset", config.Config{SupabaseURL: "https://examplerefnotreal01.supabase.co"}, "supabase"},
		{"both, flag appwrite", withPrimary(both, "appwrite"), "appwrite"},
		{"both, flag supabase", withPrimary(both, "supabase"), "supabase"},
	} {
		if got := configSummary(tc.cfg)["auth"]; got != tc.want {
			t.Errorf("%s: auth = %v, want %s", tc.name, got, tc.want)
		}
	}
}

func withPrimary(cfg config.Config, primary string) config.Config {
	cfg.AuthPrimaryProvider = primary
	return cfg
}

// End to end through the real router, and the one property that must hold on
// an unauthenticated endpoint: the summary classifies hosts, it never prints
// them. The old database's name is an internal Docker alias.
func TestHealthEndpointCarriesTheSummaryAndLeaksNoHostname(t *testing.T) {
	const internalHost = "dmdpastries-internal-alias-zz9"
	router := NewRouter(config.Config{
		AppName:      "pastries-pos-api",
		DatabaseURL:  "postgresql://user:pw@" + internalHost + ":5432/dmd_pastries",
		PostgresHost: internalHost,
	})

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/health", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d", recorder.Code)
	}
	body := recorder.Body.String()
	if strings.Contains(body, internalHost) {
		t.Fatalf("/health printed the database hostname: %s", body)
	}
	if strings.Contains(body, "user:pw") {
		t.Fatalf("/health printed credentials: %s", body)
	}

	var payload struct {
		Data struct {
			Status string         `json:"status"`
			Config map[string]any `json:"config"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if payload.Data.Status != "healthy" {
		t.Errorf("status = %q; the existing field must survive", payload.Data.Status)
	}
	if payload.Data.Config["database_url_override"] != true || payload.Data.Config["database"] != "other" {
		t.Errorf("config = %v", payload.Data.Config)
	}
}
