// Command import-identities copies staff accounts from Appwrite into Supabase,
// password hashes and all, and links each one to its existing local user row.
//
// This is the step that decides whether the migration is invisible. Supabase
// verifies Appwrite's Argon2id hashes directly, so an imported account signs in
// with the password it already had -- no reset email, no locked-out morning.
//
// It reads a JSON export rather than connecting to Appwrite's database. That
// keeps a MySQL driver out of go.mod for a one-off, keeps Appwrite's database
// credentials out of this program, and -- the real reason -- puts a file in
// front of the operator that they can read before anything is written.
//
// Produce the export from Appwrite's MariaDB, adjusting the table name for your
// project's internal number:
//
//	SELECT JSON_ARRAYAGG(JSON_OBJECT(
//	  'id', _uid, 'email', email, 'name', name, 'phone', phone,
//	  'password_hash', password, 'email_verified', emailVerification = 1,
//	  'enabled', status = 1))
//	FROM _1_users;
//
// Usage:
//
//	go run ./cmd/import-identities -export users.json              # dry run, writes nothing
//	go run ./cmd/import-identities -export users.json -confirm     # perform the import
//	go run ./cmd/import-identities -export users.json -verify      # re-check a finished import
//
// Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and the usual database
// variables. Safe to re-run: every step is idempotent, so a run that dies
// halfway is resumed by running it again.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"pastries-pos/internal/config"
	"pastries-pos/internal/database"
	"pastries-pos/internal/shared/utils"
)

// identityNamespace seeds the UUIDv5 that becomes each user's Supabase id.
//
// Arbitrary, and it must never change. Every Supabase id is derived from it, so
// a different namespace would mint different ids and orphan every row already
// linked. Fixing it here means the whole mapping can be recomputed from the
// Appwrite ids alone -- the backfill is checkable rather than merely trusted,
// and a lost identity_migration_map is an inconvenience instead of a disaster.
var identityNamespace = uuid.MustParse("3f2a1c58-9d4e-5b7a-8c16-2e9d4f7a1b03")

// supabaseUserID is the one place an Appwrite id becomes a Supabase id.
func supabaseUserID(appwriteUserID string) string {
	return uuid.NewSHA1(identityNamespace, []byte(appwriteUserID)).String()
}

type exportedUser struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Enabled       bool   `json:"enabled"`
	ID            string `json:"id"`
	Name          string `json:"name"`
	PasswordHash  string `json:"password_hash"`
	Phone         string `json:"phone"`
}

type localUser struct {
	AppwriteUserID string
	Email          string
	ID             string
	SupabaseUserID *string
}

type plannedImport struct {
	exported   exportedUser
	local      localUser
	supabaseID string
}

func main() {
	exportPath := flag.String("export", "", "path to the Appwrite users JSON export")
	confirm := flag.Bool("confirm", false, "actually create users and write links (otherwise dry run)")
	verify := flag.Bool("verify", false, "only re-check an import that has already run")
	flag.Parse()

	if *exportPath == "" {
		log.Fatal("-export is required; see the comment at the top of this file for the query that produces it")
	}

	cfg := config.Load()
	admin := utils.NewSupabaseAdminClient(cfg)
	if !admin.Configured() && !*verify {
		log.Fatal("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
	}

	db, err := database.NewPostgres(cfg)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}

	exported, err := loadExport(*exportPath)
	if err != nil {
		log.Fatalf("read export: %v", err)
	}
	log.Printf("export: %d users", len(exported))

	locals, err := loadLocalUsers(db)
	if err != nil {
		log.Fatalf("read local users: %v", err)
	}
	log.Printf("local: %d live users", len(locals))

	planned, problems := plan(exported, locals)
	report(planned, problems)

	if len(problems.blocking) > 0 {
		log.Fatalf("\n%d blocking problem(s). Nothing was written. Resolve them and run again.",
			len(problems.blocking))
	}

	if *verify {
		if err := verifyImport(db, planned); err != nil {
			log.Fatalf("verification failed: %v", err)
		}
		log.Println("\nverification passed: every user is linked and every id recomputes")
		return
	}

	if !*confirm {
		log.Printf("\nDRY RUN. %d user(s) would be imported. Re-run with -confirm to do it.", len(planned))
		return
	}

	if err := runImport(db, admin, planned); err != nil {
		log.Fatalf("import failed: %v", err)
	}

	if err := verifyImport(db, planned); err != nil {
		log.Fatalf("import finished but verification failed: %v", err)
	}
	log.Printf("\nimported and verified %d user(s)", len(planned))
}

func loadExport(path string) ([]exportedUser, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var users []exportedUser
	if err := json.Unmarshal(raw, &users); err != nil {
		return nil, fmt.Errorf("not a JSON array of users: %w", err)
	}
	return users, nil
}

// loadLocalUsers reads the live users. Soft-deleted rows are excluded because
// the auth path excludes them too -- importing a departed employee would create
// a working Supabase account for someone the app refuses to authenticate.
func loadLocalUsers(db *gorm.DB) (map[string]localUser, error) {
	var rows []localUser
	if err := db.Raw(`
		SELECT id, appwrite_user_id, email, supabase_user_id
		FROM users
		WHERE deleted_at IS NULL
	`).Scan(&rows).Error; err != nil {
		return nil, err
	}

	byAppwriteID := make(map[string]localUser, len(rows))
	for _, row := range rows {
		byAppwriteID[row.AppwriteUserID] = row
	}
	return byAppwriteID, nil
}

type problems struct {
	blocking []string
	notes    []string
}

// plan decides what would happen, and refuses anything it cannot do safely.
//
// Everything that would produce a user who cannot sign in is blocking. The
// alternative is finding out on cutover morning, one employee at a time.
func plan(exported []exportedUser, locals map[string]localUser) ([]plannedImport, problems) {
	var (
		result []plannedImport
		issues problems
	)

	// Presence in the export, recorded before any validation. Keying this off
	// successful planning instead would make one bad hash produce two
	// complaints -- the rejection, and a second claiming the user is missing
	// from the export they are plainly in. Cascading errors are how a report
	// someone reads under pressure stops being trusted.
	inExport := make(map[string]bool, len(exported))
	for _, user := range exported {
		inExport[user.ID] = true
	}

	for _, user := range exported {
		switch {
		case strings.TrimSpace(user.ID) == "":
			issues.blocking = append(issues.blocking, "an exported user has no id")
			continue
		case strings.TrimSpace(user.Email) == "":
			issues.blocking = append(issues.blocking,
				fmt.Sprintf("%s has no email; Supabase cannot create an account without one", user.ID))
			continue
		case strings.TrimSpace(user.PasswordHash) == "":
			issues.blocking = append(issues.blocking,
				fmt.Sprintf("%s (%s) has no password hash; they would be imported unable to sign in",
					user.Email, user.ID))
			continue
		}

		// GoTrue verifies Argon2 and bcrypt. Anything else is stored but never
		// matches, so the user is silently locked out -- worse than failing here.
		if !strings.HasPrefix(user.PasswordHash, "$argon2") && !strings.HasPrefix(user.PasswordHash, "$2") {
			issues.blocking = append(issues.blocking, fmt.Sprintf(
				"%s has a %s hash, which Supabase cannot verify; they need a password reset instead",
				user.Email, hashKind(user.PasswordHash)))
			continue
		}

		local, exists := locals[user.ID]
		if !exists {
			// An Appwrite account with no local employee row cannot log in
			// today either, so importing it changes nothing.
			issues.notes = append(issues.notes,
				fmt.Sprintf("%s exists in Appwrite but has no local user row; skipped", user.Email))
			continue
		}

		result = append(result, plannedImport{
			exported:   user,
			local:      local,
			supabaseID: supabaseUserID(user.ID),
		})
	}

	// The dangerous direction: a local employee absent from the export gets no
	// Supabase account, and discovers it when they try to sign in.
	for appwriteID, local := range locals {
		if !inExport[appwriteID] {
			issues.blocking = append(issues.blocking, fmt.Sprintf(
				"local user %s (%s) is not in the export; after cutover they could not sign in",
				local.Email, appwriteID))
		}
	}

	sort.Slice(result, func(i, j int) bool { return result[i].exported.Email < result[j].exported.Email })
	sort.Strings(issues.blocking)
	sort.Strings(issues.notes)
	return result, issues
}

func hashKind(hash string) string {
	switch {
	case strings.HasPrefix(hash, "$argon2"):
		return "argon2"
	case strings.HasPrefix(hash, "$2"):
		return "bcrypt"
	case strings.HasPrefix(hash, "$P$"), strings.HasPrefix(hash, "$H$"):
		return "phpass"
	case strings.HasPrefix(hash, "$"):
		return strings.SplitN(strings.TrimPrefix(hash, "$"), "$", 2)[0]
	default:
		return "unrecognised"
	}
}

func report(planned []plannedImport, issues problems) {
	log.Printf("\nplanned: %d user(s) to import", len(planned))
	for _, item := range planned {
		state := "new"
		if item.local.SupabaseUserID != nil {
			if *item.local.SupabaseUserID == item.supabaseID {
				state = "already linked"
			} else {
				state = "RELINK (existing id differs)"
			}
		}
		log.Printf("  %-40s %s  [%s]", item.exported.Email, item.supabaseID, state)
	}

	for _, note := range issues.notes {
		log.Printf("  note: %s", note)
	}
	for _, blocker := range issues.blocking {
		log.Printf("  BLOCKING: %s", blocker)
	}
}

// runImport creates each account and links it, one user at a time.
//
// Not batched, and not wrapped in a single transaction: creating a Supabase
// user is a network call that cannot be rolled back by the database. Doing them
// individually means a failure halfway leaves a consistent partial state that
// re-running finishes, rather than a set of Supabase accounts with no local
// links and no record of which.
func runImport(db *gorm.DB, admin *utils.SupabaseAdminClient, planned []plannedImport) error {
	for index, item := range planned {
		created, err := admin.CreateUserWithPasswordHash(
			item.supabaseID,
			item.exported.Email,
			item.exported.PasswordHash,
			item.exported.Name,
			item.exported.Phone,
		)
		if err != nil {
			// Re-running after a partial import hits this for everyone already
			// done. The id is deterministic, so an existing account is the one
			// we intended to create.
			if isAlreadyExists(err) {
				created = item.supabaseID
			} else {
				return fmt.Errorf("create %s: %w", item.exported.Email, err)
			}
		}
		if created != item.supabaseID {
			return fmt.Errorf("supabase returned id %s for %s, expected the derived %s",
				created, item.exported.Email, item.supabaseID)
		}

		if err := linkUser(db, item); err != nil {
			return fmt.Errorf("link %s: %w", item.exported.Email, err)
		}

		if (index+1)%25 == 0 || index+1 == len(planned) {
			log.Printf("  ... %d/%d", index+1, len(planned))
		}
	}
	return nil
}

func isAlreadyExists(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "already been registered") ||
		strings.Contains(message, "already exists") ||
		strings.Contains(message, "already registered")
}

// linkUser writes both halves of the mapping in one transaction.
//
// identity_migration_map is not bookkeeping. platform_audit_logs
// .actor_appwrite_user_id is NOT NULL and full of Appwrite ids; once Appwrite
// is gone, this table is the only thing that can say who those rows refer to.
func linkUser(db *gorm.DB, item plannedImport) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(
			`UPDATE users SET supabase_user_id = ?, updated_at = now() WHERE id = ?`,
			item.supabaseID, item.local.ID,
		).Error; err != nil {
			return err
		}

		return tx.Exec(`
			INSERT INTO identity_migration_map (appwrite_user_id, supabase_user_id, email)
			VALUES (?, ?, ?)
			ON CONFLICT (appwrite_user_id) DO UPDATE
			  SET supabase_user_id = EXCLUDED.supabase_user_id, email = EXCLUDED.email
		`, item.exported.ID, item.supabaseID, strings.ToLower(item.exported.Email)).Error
	})
}

// verifyImport re-derives every id from its Appwrite id and compares.
//
// This is why the namespace is fixed: correctness is checkable from the inputs
// rather than resting on the run having gone well.
func verifyImport(db *gorm.DB, planned []plannedImport) error {
	var unlinked int64
	if err := db.Raw(
		`SELECT count(*) FROM users WHERE deleted_at IS NULL AND supabase_user_id IS NULL`,
	).Scan(&unlinked).Error; err != nil {
		return err
	}
	if unlinked > 0 {
		return fmt.Errorf("%d live user(s) still have no supabase_user_id", unlinked)
	}

	for _, item := range planned {
		var stored string
		if err := db.Raw(
			`SELECT supabase_user_id::text FROM users WHERE id = ?`, item.local.ID,
		).Scan(&stored).Error; err != nil {
			return err
		}
		if stored != item.supabaseID {
			return fmt.Errorf("%s is linked to %s but recomputes to %s",
				item.exported.Email, stored, item.supabaseID)
		}
	}

	var mapped int64
	if err := db.Raw(`SELECT count(*) FROM identity_migration_map`).Scan(&mapped).Error; err != nil {
		return err
	}
	if mapped < int64(len(planned)) {
		return fmt.Errorf("identity_migration_map holds %d rows, expected at least %d",
			mapped, len(planned))
	}
	return nil
}
