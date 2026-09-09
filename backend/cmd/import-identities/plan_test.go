package main

import (
	"strings"
	"testing"

	"pastries-pos/internal/shared/utils"
)

func exportedFixture(id, email, hash string) exportedUser {
	return exportedUser{
		Email:         email,
		EmailVerified: true,
		Enabled:       true,
		ID:            id,
		Name:          "Staff Member",
		PasswordHash:  hash,
	}
}

const argon2Hash = "$argon2id$v=19$m=2048,t=4,p=3$c2FsdHNhbHQ$aGFzaGhhc2g"

func localFixture(appwriteID, email string) localUser {
	return localUser{
		AppwriteUserID: appwriteID,
		Email:          email,
		ID:             "00000000-0000-4000-8000-00000000000" + appwriteID[len(appwriteID)-1:],
	}
}

// The id must be reproducible from the Appwrite id alone. That is what makes
// the backfill checkable rather than trusted, and what makes a lost
// identity_migration_map an inconvenience instead of a disaster.
func TestSupabaseIDsAreDeterministic(t *testing.T) {
	first := utils.SupabaseUserIDForAppwriteID("65f1a2b3c4d5e6f7a8b9")
	second := utils.SupabaseUserIDForAppwriteID("65f1a2b3c4d5e6f7a8b9")

	if first != second {
		t.Fatalf("same input produced %s then %s", first, second)
	}
	if first == utils.SupabaseUserIDForAppwriteID("65f1a2b3c4d5e6f7a8ba") {
		t.Error("different Appwrite ids collided")
	}
	if len(first) != 36 {
		t.Errorf("id %q is not a uuid, and auth.users.id is uuid-typed", first)
	}
}

func TestAMatchedUserIsPlanned(t *testing.T) {
	planned, issues := plan(
		[]exportedUser{exportedFixture("aw1", "staff@test.invalid", argon2Hash)},
		map[string]localUser{"aw1": localFixture("aw1", "staff@test.invalid")},
	)

	if len(issues.blocking) != 0 {
		t.Fatalf("blocked a clean import: %v", issues.blocking)
	}
	if len(planned) != 1 || planned[0].supabaseID != utils.SupabaseUserIDForAppwriteID("aw1") {
		t.Fatalf("planned = %+v", planned)
	}
}

// The failure that would be discovered one employee at a time, at the counter.
func TestALocalUserMissingFromTheExportBlocks(t *testing.T) {
	_, issues := plan(
		[]exportedUser{exportedFixture("aw1", "staff@test.invalid", argon2Hash)},
		map[string]localUser{
			"aw1": localFixture("aw1", "staff@test.invalid"),
			"aw2": localFixture("aw2", "forgotten@test.invalid"),
		},
	)

	if len(issues.blocking) != 1 || !strings.Contains(issues.blocking[0], "forgotten@test.invalid") {
		t.Fatalf("blocking = %v, want the un-exported local user named", issues.blocking)
	}
	if !strings.Contains(issues.blocking[0], "could not sign in") {
		t.Error("the message does not say what it costs")
	}
}

// A hash Supabase cannot verify is stored happily and never matches, so the
// user is locked out silently. Better to refuse the whole run.
func TestUnverifiableHashesBlock(t *testing.T) {
	for name, hash := range map[string]string{
		"scrypt": "$scrypt$ln=16,r=8,p=1$c2FsdA$aGFzaA",
		"phpass": "$P$Babcdefghijklmnopqrstuvwxyz01",
		"md5ish": "5f4dcc3b5aa765d61d8327deb882cf99",
	} {
		t.Run(name, func(t *testing.T) {
			_, issues := plan(
				[]exportedUser{exportedFixture("aw1", "staff@test.invalid", hash)},
				map[string]localUser{"aw1": localFixture("aw1", "staff@test.invalid")},
			)
			if len(issues.blocking) == 0 {
				t.Fatal("accepted a hash Supabase cannot verify")
			}
			if !strings.Contains(issues.blocking[0], "password reset") {
				t.Errorf("blocking = %q, want it to say what to do instead", issues.blocking[0])
			}
		})
	}
}

func TestBcryptAndArgonAreBothAccepted(t *testing.T) {
	for name, hash := range map[string]string{
		"argon2id": argon2Hash,
		"bcrypt":   "$2y$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR",
	} {
		t.Run(name, func(t *testing.T) {
			planned, issues := plan(
				[]exportedUser{exportedFixture("aw1", "staff@test.invalid", hash)},
				map[string]localUser{"aw1": localFixture("aw1", "staff@test.invalid")},
			)
			if len(issues.blocking) != 0 {
				t.Fatalf("rejected a %s hash GoTrue can verify: %v", name, issues.blocking)
			}
			if len(planned) != 1 {
				t.Fatal("not planned")
			}
		})
	}
}

func TestMissingHashOrEmailBlocks(t *testing.T) {
	_, issues := plan(
		[]exportedUser{
			exportedFixture("aw1", "nohash@test.invalid", ""),
			exportedFixture("aw2", "", argon2Hash),
		},
		map[string]localUser{
			"aw1": localFixture("aw1", "nohash@test.invalid"),
			"aw2": localFixture("aw2", "noemail@test.invalid"),
		},
	)

	if len(issues.blocking) < 2 {
		t.Fatalf("blocking = %v, want both the missing hash and the missing email", issues.blocking)
	}
}

// An Appwrite account with no local row cannot sign in today either, so it is a
// note rather than a blocker -- but it must be reported, not swallowed.
func TestAnAppwriteOnlyAccountIsSkippedNotBlocked(t *testing.T) {
	planned, issues := plan(
		[]exportedUser{exportedFixture("aw-orphan", "orphan@test.invalid", argon2Hash)},
		map[string]localUser{},
	)

	if len(issues.blocking) != 0 {
		t.Fatalf("blocked on an orphan: %v", issues.blocking)
	}
	if len(planned) != 0 {
		t.Fatal("planned an import for a user with no local row")
	}
	if len(issues.notes) != 1 || !strings.Contains(issues.notes[0], "orphan@test.invalid") {
		t.Errorf("notes = %v, want the orphan reported", issues.notes)
	}
}

// Re-running after a partial import must be safe: already-linked users are
// planned again and the executor treats an existing account as success.
func TestAlreadyLinkedUsersArePlannedAgainForIdempotency(t *testing.T) {
	existing := utils.SupabaseUserIDForAppwriteID("aw1")
	local := localFixture("aw1", "staff@test.invalid")
	local.SupabaseUserID = &existing

	planned, issues := plan(
		[]exportedUser{exportedFixture("aw1", "staff@test.invalid", argon2Hash)},
		map[string]localUser{"aw1": local},
	)

	if len(issues.blocking) != 0 {
		t.Fatalf("a re-run was blocked: %v", issues.blocking)
	}
	if len(planned) != 1 || planned[0].supabaseID != existing {
		t.Fatalf("re-run would mint a different id: %+v", planned)
	}
}

func TestAlreadyExistsDetection(t *testing.T) {
	for _, message := range []string{
		"A user with this email address has already been registered",
		"user already exists",
		"Email already registered",
	} {
		if !isAlreadyExists(errorString(message)) {
			t.Errorf("did not recognise %q as an existing account, so a re-run would abort", message)
		}
	}
	if isAlreadyExists(errorString("connection refused")) {
		t.Error("treated a network failure as an existing account, which would skip a real user")
	}
}

type errorString string

func (e errorString) Error() string { return string(e) }
