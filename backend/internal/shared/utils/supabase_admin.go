package utils

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"pastries-pos/internal/config"
)

// SupabaseAdminClient covers the server-side user operations this app performs:
// creating staff accounts, removing them, blocking sign-in, and driving password
// recovery. It is the Supabase counterpart to AppwriteClient's admin half.
//
// Hand-rolled over net/http rather than pulling in a client library. There are
// six calls, the error mapping has to produce messages a bakery owner can act
// on, and go.mod is deliberately short.
//
// It holds the service_role key, which is unrestricted access to the whole
// database including the auth schema. It must never be handed to the frontend,
// logged, or included in an error returned to a caller.
type SupabaseAdminClient struct {
	baseURL    string
	serviceKey string
	httpClient *http.Client
	appEnv     string
	e2eToken   string
}

func NewSupabaseAdminClient(cfg config.Config) *SupabaseAdminClient {
	baseURL := ""
	if ref := strings.TrimSpace(cfg.SupabaseProjectRef); ref != "" {
		baseURL = fmt.Sprintf("https://%s.supabase.co/auth/v1", ref)
	}

	return &SupabaseAdminClient{
		baseURL:    baseURL,
		serviceKey: strings.TrimSpace(cfg.SupabaseServiceRoleKey),
		httpClient: &http.Client{Timeout: 20 * time.Second},
		appEnv:     cfg.AppEnv,
		e2eToken:   cfg.E2EAuthToken,
	}
}

// Configured reports whether this client can reach Supabase. Before cutover it
// is false and every method is a no-op, so the client can be constructed and
// held without changing behaviour.
func (c *SupabaseAdminClient) Configured() bool {
	return c.baseURL != "" && c.serviceKey != ""
}

func (c *SupabaseAdminClient) isE2E() bool {
	return c.appEnv == "e2e" && strings.TrimSpace(c.e2eToken) != ""
}

// CreateUser makes a staff account and returns its Supabase user id.
//
// email_confirm is true because the backend is the one creating the account --
// an admin adding an employee, or an invitation being accepted. Requiring the
// new employee to confirm an address their manager just typed adds a failure
// point without adding a check, and the invitation itself is the proof.
func (c *SupabaseAdminClient) CreateUser(email, password, name, phone string) (string, error) {
	if c.isE2E() {
		return e2eSupabaseUserID(email), nil
	}

	body := map[string]any{
		"email":         strings.ToLower(strings.TrimSpace(email)),
		"password":      password,
		"email_confirm": true,
		"user_metadata": map[string]any{"full_name": name},
	}
	if trimmed := strings.TrimSpace(phone); trimmed != "" {
		body["phone"] = trimmed
	}

	var created struct {
		ID string `json:"id"`
	}
	if err := c.do(http.MethodPost, "/admin/users", body, &created); err != nil {
		return "", err
	}
	if created.ID == "" {
		return "", fmt.Errorf("supabase created a user without returning an id")
	}
	return created.ID, nil
}

// CreateUserWithPasswordHash imports an existing account, password and all.
//
// This is what makes the migration invisible to staff: Supabase verifies
// Appwrite's Argon2id hashes directly, so everyone keeps the password they
// already have. The id is supplied by the caller rather than minted here,
// because it is derived deterministically from the Appwrite id -- which makes
// the mapping reproducible from scratch instead of trusting one backfill run.
func (c *SupabaseAdminClient) CreateUserWithPasswordHash(userID, email, passwordHash, name, phone string) (string, error) {
	if c.isE2E() {
		return e2eSupabaseUserID(email), nil
	}

	body := map[string]any{
		"id":            userID,
		"email":         strings.ToLower(strings.TrimSpace(email)),
		"password_hash": passwordHash,
		"email_confirm": true,
		"user_metadata": map[string]any{"full_name": name},
	}
	if trimmed := strings.TrimSpace(phone); trimmed != "" {
		body["phone"] = trimmed
	}

	var created struct {
		ID string `json:"id"`
	}
	if err := c.do(http.MethodPost, "/admin/users", body, &created); err != nil {
		return "", err
	}
	return created.ID, nil
}

func (c *SupabaseAdminClient) DeleteUser(userID string) error {
	if c.isE2E() {
		return nil
	}
	return c.do(http.MethodDelete, "/admin/users/"+userID, nil, nil)
}

// SetUserStatus blocks or restores sign-in.
//
// Supabase expresses this as a ban with a duration, and "none" lifts it. The
// far date is Supabase's own idiom for an indefinite ban.
//
// Note what this does NOT do: a ban blocks new sign-ins but leaves already
// issued access tokens valid until they expire. Appwrite's DeleteUserSessions
// killed them immediately and Supabase has no admin equivalent. That gap is
// already covered, and not by this client -- AuthenticateToken re-reads the
// local users row on every single request and refuses anything whose status is
// not active, so deactivating an employee takes effect on their next request no
// matter what token they hold. This call stops them signing in again.
func (c *SupabaseAdminClient) SetUserStatus(userID string, enabled bool) error {
	if c.isE2E() {
		return nil
	}

	banDuration := "876000h" // ~100 years
	if enabled {
		banDuration = "none"
	}

	return c.do(http.MethodPut, "/admin/users/"+userID, map[string]any{
		"ban_duration": banDuration,
	}, nil)
}

// CreatePasswordRecovery asks Supabase to email a reset link.
//
// Unauthenticated by design: it must not reveal whether an address is
// registered, so it returns success either way.
func (c *SupabaseAdminClient) CreatePasswordRecovery(email, redirectURL string) error {
	if c.isE2E() {
		return nil
	}

	return c.do(http.MethodPost, "/recover", map[string]any{
		"email":       strings.ToLower(strings.TrimSpace(email)),
		"redirect_to": redirectURL,
	}, nil)
}

// CompletePasswordRecovery exchanges a recovery token for a session and sets the
// new password with it.
//
// The shape differs from Appwrite, which took a user id plus a secret. Supabase
// proves identity with a single-use token instead, so there is nothing to pass
// a user id for -- and nothing the caller could pass one for safely, since
// knowing an id must never be enough to change someone's password.
func (c *SupabaseAdminClient) CompletePasswordRecovery(recoveryToken, newPassword string) error {
	if c.isE2E() {
		return nil
	}

	var session struct {
		AccessToken string `json:"access_token"`
	}
	if err := c.do(http.MethodPost, "/verify", map[string]any{
		"type":  "recovery",
		"token": recoveryToken,
	}, &session); err != nil {
		return err
	}
	if session.AccessToken == "" {
		return fmt.Errorf("password reset link is invalid or has already been used")
	}

	return c.doAs(session.AccessToken, http.MethodPut, "/user", map[string]any{
		"password": newPassword,
	}, nil)
}

func (c *SupabaseAdminClient) do(method, path string, body, out any) error {
	return c.request(method, path, c.serviceKey, body, out)
}

// doAs acts on behalf of a user session rather than as the service role, so the
// service_role key never authorises a password change.
func (c *SupabaseAdminClient) doAs(accessToken, method, path string, body, out any) error {
	return c.request(method, path, accessToken, body, out)
}

func (c *SupabaseAdminClient) request(method, path, bearer string, body, out any) error {
	if !c.Configured() {
		return fmt.Errorf("supabase admin client is not configured")
	}

	var payload io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("encode supabase request: %w", err)
		}
		payload = bytes.NewReader(encoded)
	}

	req, err := http.NewRequest(method, c.baseURL+path, payload)
	if err != nil {
		return fmt.Errorf("build supabase request: %w", err)
	}
	req.Header.Set("apikey", c.serviceKey)
	req.Header.Set("Authorization", "Bearer "+bearer)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("supabase is unreachable: %w", err)
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return fmt.Errorf("read supabase response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return supabaseError(resp.StatusCode, responseBody)
	}

	if out != nil && len(responseBody) > 0 {
		if err := json.Unmarshal(responseBody, out); err != nil {
			return fmt.Errorf("decode supabase response: %w", err)
		}
	}
	return nil
}

// SupabaseAPIError carries Supabase's own error text so callers can map it to
// something a user can act on, without the caller having to parse JSON.
type SupabaseAPIError struct {
	StatusCode int
	Code       string
	Message    string
}

func (e *SupabaseAPIError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return fmt.Sprintf("supabase returned %d", e.StatusCode)
}

func supabaseError(status int, body []byte) error {
	// GoTrue has used several error shapes over time; try each rather than
	// throwing away the message and reporting a bare status code.
	var parsed struct {
		ErrorCode        string `json:"error_code"`
		Code             any    `json:"code"`
		Msg              string `json:"msg"`
		Message          string `json:"message"`
		Error            string `json:"error"`
		ErrorDescription string `json:"error_description"`
	}
	_ = json.Unmarshal(body, &parsed)

	message := firstNonEmpty(parsed.Msg, parsed.Message, parsed.ErrorDescription, parsed.Error)
	code := parsed.ErrorCode
	if code == "" {
		if asString, ok := parsed.Code.(string); ok {
			code = asString
		}
	}

	return &SupabaseAPIError{StatusCode: status, Code: code, Message: message}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

// FriendlySupabaseCreateUserError turns a failed account creation into
// something the person at the counter can act on. Mirrors
// FriendlyAppwriteCreateUserError so the handlers keep the same shape.
func FriendlySupabaseCreateUserError(err error) (string, map[string]interface{}) {
	if err == nil {
		return "failed to create user", nil
	}

	details := map[string]interface{}{"supabase_error": err.Error()}

	var apiErr *SupabaseAPIError
	if errors.As(err, &apiErr) {
		details["supabase_status_code"] = apiErr.StatusCode
		if apiErr.Code != "" {
			details["supabase_error_code"] = apiErr.Code
		}
	}

	message := strings.ToLower(err.Error())
	switch {
	case strings.Contains(message, "already been registered") ||
		strings.Contains(message, "already exists") ||
		strings.Contains(message, "already registered"):
		return "a user already exists with this email or phone", details
	// Found the hard way: GoTrue validates the domain and rejects reserved or
	// disposable-looking addresses that Appwrite accepted without complaint.
	case strings.Contains(message, "email_address_invalid") || strings.Contains(message, "email address") && strings.Contains(message, "invalid"):
		return "that email address was rejected. Use a real, deliverable address", details
	case strings.Contains(message, "password"):
		return "the password was rejected. Use at least 8 characters", details
	case strings.Contains(message, "phone"):
		return "the phone number was rejected. Use international format like +971501234567 or leave it empty", details
	default:
		return "failed to create user", details
	}
}

func e2eSupabaseUserID(email string) string {
	return e2eAppwriteUserID(email)
}
