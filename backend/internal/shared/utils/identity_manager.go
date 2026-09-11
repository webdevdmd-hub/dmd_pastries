package utils

import (
	"errors"
	"fmt"
	"strings"
)

// ProviderIDs is one person's account id in each identity provider. Supabase is
// empty until that provider is configured.
type ProviderIDs struct {
	Appwrite string
	Supabase string
}

// SupabaseOrNil returns the Supabase id as a pointer, or nil when there isn't
// one. users.supabase_user_id is uuid with a partial unique index: NULLs are
// treated as distinct, an empty string is not, so writing "" would collide on
// the second account created before cutover.
func (ids ProviderIDs) AppwriteOrNil() *string {
	if strings.TrimSpace(ids.Appwrite) == "" {
		return nil
	}
	value := ids.Appwrite
	return &value
}

func (ids ProviderIDs) SupabaseOrNil() *string {
	if strings.TrimSpace(ids.Supabase) == "" {
		return nil
	}
	value := ids.Supabase
	return &value
}

// FriendlyCreateUserError turns a failed account creation into something the
// person at the counter can act on, whichever provider rejected it.
func FriendlyCreateUserError(err error) (string, map[string]interface{}) {
	var supabaseErr *SupabaseAPIError
	if errors.As(err, &supabaseErr) {
		return FriendlySupabaseCreateUserError(err)
	}
	return FriendlyAppwriteCreateUserError(err)
}

// IdentityManager owns account lifecycle across both providers while the
// migration is in flight.
//
// Creating an account writes to BOTH, and that is the point. users
// .appwrite_user_id is NOT NULL, so a Supabase-only account has nothing to put
// there; and more importantly, an employee hired during the dual-run window
// must still be able to sign in if the cutover is rolled back. Writing one
// provider would quietly make rollback lossy for exactly the people who joined
// most recently.
//
// Reads are not symmetrical with this: a token names its own issuer, so
// verification routes itself (see SupabaseVerifier.OwnsToken). Only writes need
// a coordinator, because there is no token to ask.
type IdentityManager struct {
	appwrite *AppwriteClient
	supabase *SupabaseAdminClient
	primary  string
}

// Provider values for AUTH_PRIMARY_PROVIDER.
const (
	primaryAppwrite = ProviderAppwrite
	primarySupabase = ProviderSupabase
)

func NewIdentityManager(appwrite *AppwriteClient, supabase *SupabaseAdminClient, primary string) *IdentityManager {
	normalized := strings.ToLower(strings.TrimSpace(primary))
	if normalized != primarySupabase {
		normalized = primaryAppwrite
	}

	return &IdentityManager{appwrite: appwrite, supabase: supabase, primary: normalized}
}

// supabaseLive reports whether the Supabase half is switched on.
func (m *IdentityManager) supabaseLive() bool {
	return m.supabase != nil && m.supabase.Configured()
}

// appwriteLive reports whether there is an Appwrite to write to at all.
func (m *IdentityManager) appwriteLive() bool {
	return m.appwrite != nil && m.appwrite.Configured()
}

// PrimaryIsSupabase reports which provider issues sessions for new sign-ins.
// Both continue to verify; this only decides where a password reset email comes
// from, so that the link a user clicks matches the system they log in to.
func (m *IdentityManager) PrimaryIsSupabase() bool {
	// With no Appwrite there is nothing else to be primary. The flag still
	// decides between them when both exist.
	if !m.appwriteLive() {
		return m.supabaseLive()
	}
	return m.primary == primarySupabase && m.supabaseLive()
}

// CreateUser makes the account in every live provider.
//
// If the second write fails the first is rolled back, so a half-created
// identity never survives. Without that, a retry hits "already exists" in
// Appwrite and the operator is stuck with an account they cannot finish
// creating and cannot see to delete.
func (m *IdentityManager) CreateUser(email, password, name, phone string) (ProviderIDs, error) {
	// Supabase only: the ordinary case for a fresh deployment. No Appwrite id
	// exists to derive a deterministic Supabase id from, so Supabase mints one.
	if !m.appwriteLive() {
		if !m.supabaseLive() {
			return ProviderIDs{}, fmt.Errorf("no identity provider is configured")
		}
		supabaseID, err := m.supabase.CreateUser("", email, password, name, phone)
		if err != nil {
			return ProviderIDs{}, err
		}
		return ProviderIDs{Supabase: supabaseID}, nil
	}

	appwriteID, err := m.appwrite.CreateUser(email, password, name, phone)
	if err != nil {
		return ProviderIDs{}, err
	}

	ids := ProviderIDs{Appwrite: appwriteID}
	if !m.supabaseLive() {
		return ids, nil
	}

	// Derived from the Appwrite id, never left to Supabase to invent. This is
	// the same function the bulk import uses, so an employee hired during the
	// migration window lands at exactly the address the import would have given
	// them -- which is what makes the import safe to re-run afterwards, and
	// what makes "recompute every id and compare" a real verification rather
	// than one that skips whoever joined most recently.
	supabaseID, err := m.supabase.CreateUser(
		SupabaseUserIDForAppwriteID(appwriteID), email, password, name, phone,
	)
	if err != nil {
		_ = m.appwrite.DeleteUser(appwriteID)
		return ProviderIDs{}, err
	}

	ids.Supabase = supabaseID
	return ids, nil
}

// DeleteUser removes the account from every provider that has it.
//
// Best effort across both: this runs as a compensator for a failed
// registration, where returning early on the first error would leave the other
// provider holding an orphan nobody will ever look for.
func (m *IdentityManager) DeleteUser(ids ProviderIDs) error {
	var failures []string

	if ids.Appwrite != "" && m.appwriteLive() {
		if err := m.appwrite.DeleteUser(ids.Appwrite); err != nil {
			failures = append(failures, "appwrite: "+err.Error())
		}
	}
	if ids.Supabase != "" && m.supabaseLive() {
		if err := m.supabase.DeleteUser(ids.Supabase); err != nil {
			failures = append(failures, "supabase: "+err.Error())
		}
	}

	if len(failures) > 0 {
		return fmt.Errorf("failed to delete identity: %s", strings.Join(failures, "; "))
	}
	return nil
}

// SetUserStatus blocks or restores sign-in everywhere.
//
// Both providers, always: leaving one enabled means a deactivated employee can
// still sign in through it, and dual-verify would accept the result.
func (m *IdentityManager) SetUserStatus(ids ProviderIDs, enabled bool) error {
	var failures []string

	if ids.Appwrite != "" && m.appwriteLive() {
		if err := m.appwrite.SetUserStatus(ids.Appwrite, enabled); err != nil {
			failures = append(failures, "appwrite: "+err.Error())
		}
	}
	if ids.Supabase != "" && m.supabaseLive() {
		if err := m.supabase.SetUserStatus(ids.Supabase, enabled); err != nil {
			failures = append(failures, "supabase: "+err.Error())
		}
	}

	if len(failures) > 0 {
		return fmt.Errorf("failed to set identity status: %s", strings.Join(failures, "; "))
	}
	return nil
}

// RevokeSessions ends live sessions where the provider supports it.
//
// Appwrite can; Supabase has no admin endpoint for it. That asymmetry does not
// matter here, and it is worth being explicit about why: AuthenticateToken
// re-reads the local users row on every request and refuses anything whose
// status is not active, so a deactivated employee stops being served on their
// next request regardless of the token they hold. This is a tidy-up, not the
// control.
func (m *IdentityManager) RevokeSessions(ids ProviderIDs) {
	if ids.Appwrite != "" && m.appwriteLive() {
		_ = m.appwrite.DeleteUserSessions(ids.Appwrite)
	}
}

// CreatePasswordRecovery sends the reset email from the provider that issues
// sessions, so the link lands in the system the user actually signs in to.
func (m *IdentityManager) CreatePasswordRecovery(email, redirectURL string) error {
	if m.PrimaryIsSupabase() {
		return m.supabase.CreatePasswordRecovery(email, redirectURL)
	}
	return m.appwrite.CreatePasswordRecovery(email, redirectURL)
}

// CreatePasswordResetToken mints a reset token for a link a manager hands over,
// bypassing email entirely. Supabase only: Appwrite has no equivalent, and an
// account that exists only there gets an error rather than a link that would
// never verify.
func (m *IdentityManager) CreatePasswordResetToken(ids ProviderIDs, email string) (string, error) {
	if !m.supabaseLive() || strings.TrimSpace(ids.Supabase) == "" {
		return "", fmt.Errorf("password reset links are only available for Supabase accounts")
	}
	return m.supabase.GenerateRecoveryToken(email)
}

// CompletePasswordRecovery finishes a reset.
//
// The two providers prove identity differently -- Appwrite with a user id plus
// a secret, Supabase with a single-use token -- so the caller passes whichever
// it received and this picks the path. Both shapes are accepted for as long as
// both providers are live, which lets the reset page migrate on its own
// schedule instead of having to change in the same deploy.
func (m *IdentityManager) CompletePasswordRecovery(userID, secret, recoveryToken, password string) error {
	if strings.TrimSpace(recoveryToken) != "" {
		if !m.supabaseLive() {
			return fmt.Errorf("password reset links of this kind are not enabled")
		}
		return m.supabase.CompletePasswordRecovery(recoveryToken, password)
	}

	if strings.TrimSpace(userID) == "" || strings.TrimSpace(secret) == "" {
		return fmt.Errorf("password reset link is incomplete")
	}
	if !m.appwriteLive() {
		return fmt.Errorf("password reset links of this kind are not enabled")
	}
	return m.appwrite.CompletePasswordRecovery(userID, secret, password)
}
