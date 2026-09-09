package utils

import (
	"strings"

	"github.com/google/uuid"
)

// identityNamespace seeds the UUIDv5 that becomes each user's Supabase id.
//
// Arbitrary, and it must never change. Every Supabase id is derived from it, so
// a different namespace would mint different ids and orphan every row already
// linked. Fixing it here means the whole mapping can be recomputed from the
// Appwrite ids alone -- the backfill is checkable rather than merely trusted,
// and a lost identity_migration_map is an inconvenience instead of a disaster.
var identityNamespace = uuid.MustParse("3f2a1c58-9d4e-5b7a-8c16-2e9d4f7a1b03")

// SupabaseUserIDForAppwriteID is the one place an Appwrite id becomes a
// Supabase id.
//
// It lives in this package rather than in the import command because there are
// two routes into Supabase and they must agree: the bulk import of everyone who
// exists today, and the dual-write that runs every time an employee is hired
// during the migration window. They did not agree until 2026-09-09 -- the
// import derived its ids here, and dual-write let Supabase invent a random one.
//
// The consequence was silent and only visible at cutover. A user created by
// dual-write held a random id, so re-running the import saw a mismatch, tried
// to create the deterministic account, hit the email collision, and linked the
// local row to a UUID no Supabase user has. That person cannot sign in after
// the flip and nothing anywhere reports an error. Sharing the function removes
// the possibility rather than documenting the order that avoids it.
//
// Returns "" for a blank input so a caller can tell "no id" from a real one
// derived from an empty string, which would otherwise be a single fixed UUID
// that every such account collided on.
func SupabaseUserIDForAppwriteID(appwriteUserID string) string {
	trimmed := strings.TrimSpace(appwriteUserID)
	if trimmed == "" {
		return ""
	}
	return uuid.NewSHA1(identityNamespace, []byte(trimmed)).String()
}
