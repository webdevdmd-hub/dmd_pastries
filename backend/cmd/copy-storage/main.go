// Command copy-storage copies every file from Appwrite storage into Supabase
// and points the database at the copies.
//
// It runs while the shop is open, on purpose. Nothing it does is visible to a
// user: reads still resolve through the Appwrite id until
// NEXT_PUBLIC_STORAGE_PROVIDER is flipped, and a file the copy has not reached
// yet falls back the same way a file it has never seen does. That is what the
// fallback chain in frontend/src/lib/storage/files.ts is for -- prefer the
// Supabase path, fall back to the Appwrite id, fall back to the legacy URL --
// and it is why storage does not need a window while the database does.
//
// The Supabase path is the Appwrite file id, unchanged. That looks redundant
// and is the point: the mapping is recomputable from the id alone, so the
// column backfill is a pure column-to-column transform, verification is a set
// comparison rather than a join through a table, and losing
// storage_migration_map costs a re-listing rather than the mapping itself. The
// same reasoning as the deterministic user ids in cmd/import-identities.
//
// Usage:
//
//	go run ./cmd/copy-storage \
//	  -product-images <bucket-id> -business-assets <bucket-id> -documents <bucket-id>
//
//	  ... plans and writes nothing.
//
//	go run ./cmd/copy-storage -confirm ...   # copy, then backfill the columns
//	go run ./cmd/copy-storage -verify  ...   # re-check a finished copy
//
// Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APPWRITE_ENDPOINT,
// APPWRITE_PROJECT_ID, APPWRITE_API_KEY and the usual database variables.
//
// Bucket ids are flags rather than configuration because they exist today only
// as NEXT_PUBLIC_* variables on the frontend, and a command that is deleted
// after the migration should not add permanent settings to the backend.
//
// Safe to re-run: every step is idempotent. A run that dies halfway is resumed
// by running it again.
package main

import (
	"flag"
	"fmt"
	"log"
	"sort"
	"strings"

	"gorm.io/gorm"

	"pastries-pos/internal/config"
	"pastries-pos/internal/database"
)

// bucketPair is one Appwrite bucket and the Supabase bucket it becomes.
//
// userAvatars is absent. It is declared in the frontend and never called from
// anywhere in the app, so copying it would mean creating a bucket, moving
// nothing into it, and verifying it forever. Phase 2 drops it instead.
type bucketPair struct {
	flagName string
	appwrite string
	supabase string
}

// column is one place the database points at a stored file.
type column struct {
	table    string
	fileID   string
	path     string
	supabase string // the Supabase bucket its files live in
}

// Every *_file_id column and its *_storage_path sibling from migration 000111.
//
// product_media is handled separately: it is the one place the bucket is data
// rather than implied by the column, so its backfill has to read bucket_id.
var columns = []column{
	{"company_settings", "logo_file_id", "logo_storage_path", "business-assets"},
	{"expenses", "receipt_file_id", "receipt_storage_path", "documents"},
	{"ingredients", "image_file_id", "image_storage_path", "product-images"},
	{"packaging_items", "image_file_id", "image_storage_path", "product-images"},
	{"product_categories", "image_file_id", "image_storage_path", "product-images"},
	{"product_variants", "image_file_id", "image_storage_path", "product-images"},
	{"products", "image_file_id", "image_storage_path", "product-images"},
}

type plannedCopy struct {
	pair bucketPair
	file appwriteFile
	done bool // already recorded in storage_migration_map
}

func main() {
	log.SetFlags(0)

	var (
		productImages  = flag.String("product-images", "", "Appwrite bucket id for product images")
		businessAssets = flag.String("business-assets", "", "Appwrite bucket id for business assets")
		documents      = flag.String("documents", "", "Appwrite bucket id for documents")
		confirm        = flag.Bool("confirm", false, "actually copy files and backfill the columns")
		verify         = flag.Bool("verify", false, "only re-check a copy that has already run")
	)
	flag.Parse()

	pairs := []bucketPair{
		{"-product-images", *productImages, "product-images"},
		{"-business-assets", *businessAssets, "business-assets"},
		{"-documents", *documents, "documents"},
	}

	var missing []string
	for _, pair := range pairs {
		if strings.TrimSpace(pair.appwrite) == "" {
			missing = append(missing, pair.flagName)
		}
	}
	if len(missing) > 0 {
		log.Fatalf("missing bucket id(s): %s\n\nThese are the NEXT_PUBLIC_APPWRITE_*_BUCKET_ID values\n"+
			"from the frontend environment.", strings.Join(missing, ", "))
	}

	cfg := config.Load()
	if strings.TrimSpace(cfg.SupabaseURL) == "" || strings.TrimSpace(cfg.SupabaseServiceRoleKey) == "" {
		log.Fatal("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
	}

	db, err := database.NewPostgres(cfg)
	if err != nil {
		log.Fatalf("connecting to the database: %v", err)
	}

	appwrite := newAppwriteClient(cfg.AppwriteEndpoint, cfg.AppwriteProjectID, cfg.AppwriteAPIKey)
	supabase := newSupabaseStorageClient(cfg.SupabaseURL, cfg.SupabaseServiceRoleKey)

	if err := requireBuckets(supabase, pairs); err != nil {
		log.Fatalf("%v", err)
	}

	if *verify {
		if err := runVerify(db, appwrite, pairs); err != nil {
			log.Fatalf("verify failed: %v", err)
		}
		return
	}

	planned, err := plan(db, appwrite, pairs)
	if err != nil {
		log.Fatalf("planning the copy: %v", err)
	}
	report(planned)

	if !*confirm {
		log.Printf("\nDry run. Nothing was copied and no column was written.")
		log.Printf("Re-run with -confirm to perform the copy.")
		return
	}

	if err := runCopy(db, appwrite, supabase, planned); err != nil {
		log.Fatalf("copy failed: %v", err)
	}
	if err := backfill(db); err != nil {
		log.Fatalf("backfill failed: %v", err)
	}
	if err := runVerify(db, appwrite, pairs); err != nil {
		log.Fatalf("copy finished but verification failed: %v", err)
	}
	log.Printf("\nDone.")
}

// requireBuckets fails before reading anything from Appwrite.
//
// A missing bucket otherwise surfaces as an upload error on the first file,
// after a full listing has already run.
func requireBuckets(supabase *supabaseStorageClient, pairs []bucketPair) error {
	var absent []string
	for _, pair := range pairs {
		exists, err := supabase.BucketExists(pair.supabase)
		if err != nil {
			return err
		}
		if !exists {
			absent = append(absent, pair.supabase)
		}
	}
	if len(absent) > 0 {
		return fmt.Errorf("create these Supabase buckets first, public-read: %s\n\n"+
			"Public matches how Appwrite serves these today -- getFilePreview returns an\n"+
			"unauthenticated URL that goes straight into a src attribute. Making them\n"+
			"private means signed URLs with expiries on every product tile, which is a\n"+
			"different feature, not a like-for-like move", strings.Join(absent, ", "))
	}
	return nil
}

// plan lists both sides and works out what is left to do.
func plan(db *gorm.DB, appwrite *appwriteClient, pairs []bucketPair) ([]plannedCopy, error) {
	copied, err := alreadyCopied(db)
	if err != nil {
		return nil, err
	}

	var planned []plannedCopy
	for _, pair := range pairs {
		files, err := appwrite.ListFiles(pair.appwrite)
		if err != nil {
			return nil, err
		}
		log.Printf("  %-16s %4d file(s) in Appwrite", pair.supabase, len(files))

		for _, file := range files {
			planned = append(planned, plannedCopy{
				pair: pair,
				file: file,
				done: copied[pair.appwrite+"/"+file.ID],
			})
		}
	}

	sort.Slice(planned, func(i, j int) bool {
		if planned[i].pair.supabase != planned[j].pair.supabase {
			return planned[i].pair.supabase < planned[j].pair.supabase
		}
		return planned[i].file.ID < planned[j].file.ID
	})
	return planned, nil
}

func alreadyCopied(db *gorm.DB) (map[string]bool, error) {
	var rows []struct {
		AppwriteBucketID string
		AppwriteFileID   string
	}
	if err := db.Table("storage_migration_map").
		Select("appwrite_bucket_id, appwrite_file_id").
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	copied := make(map[string]bool, len(rows))
	for _, row := range rows {
		copied[row.AppwriteBucketID+"/"+row.AppwriteFileID] = true
	}
	return copied, nil
}

func report(planned []plannedCopy) {
	var todo, done int
	var bytes int64
	for _, item := range planned {
		if item.done {
			done++
			continue
		}
		todo++
		bytes += item.file.Size
	}

	log.Printf("\n%d file(s) total: %d already copied, %d to copy (%s)",
		len(planned), done, todo, humanBytes(bytes))
}

// runCopy moves one file at a time, recording each before moving on.
//
// Not batched and not wrapped in a transaction: uploading is a network call the
// database cannot roll back. Recording each file immediately after its upload
// means a run that dies leaves a state the next run continues from, rather than
// a bucket full of objects with no record of which.
func runCopy(db *gorm.DB, appwrite *appwriteClient, supabase *supabaseStorageClient, planned []plannedCopy) error {
	var copied, skipped int

	for index, item := range planned {
		if item.done {
			skipped++
			continue
		}

		content, err := appwrite.Download(item.pair.appwrite, item.file.ID)
		if err != nil {
			return fmt.Errorf("[%d/%d] %s: %w", index+1, len(planned), item.file.Name, err)
		}

		// The path is the Appwrite file id, so the mapping stays recomputable.
		alreadyPresent, err := supabase.Upload(
			item.pair.supabase, item.file.ID, item.file.MimeType, content)
		if err != nil {
			return fmt.Errorf("[%d/%d] %s: %w", index+1, len(planned), item.file.Name, err)
		}

		if err := record(db, item, int64(len(content))); err != nil {
			return fmt.Errorf("recording %s: %w", item.file.ID, err)
		}

		copied++
		state := "copied"
		if alreadyPresent {
			state = "already in the bucket, recorded"
		}
		log.Printf("  [%d/%d] %-14s %-24s %-9s %s",
			index+1, len(planned), item.pair.supabase, item.file.ID,
			humanBytes(int64(len(content))), state)
	}

	log.Printf("\n%d copied, %d skipped as already done.", copied, skipped)
	return nil
}

func record(db *gorm.DB, item plannedCopy, size int64) error {
	return db.Exec(`
		INSERT INTO storage_migration_map
		  (appwrite_bucket_id, appwrite_file_id, supabase_bucket, supabase_path, bytes)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT (appwrite_bucket_id, appwrite_file_id) DO UPDATE
		  SET supabase_bucket = EXCLUDED.supabase_bucket,
		      supabase_path   = EXCLUDED.supabase_path,
		      bytes           = EXCLUDED.bytes`,
		item.pair.appwrite, item.file.ID, item.pair.supabase, item.file.ID, size).Error
}

// backfill points each row at its copy.
//
// Only rows whose file actually reached Supabase, which is why this joins
// storage_migration_map rather than simply setting the path equal to the id
// everywhere. A row pointed at a path that does not exist would render a broken
// image with no fallback -- strictly worse than the NULL it replaced, because
// NULL still falls back to Appwrite.
func backfill(db *gorm.DB) error {
	log.Printf("\nBackfilling storage paths:")

	for _, c := range columns {
		result := db.Exec(fmt.Sprintf(`
			UPDATE %s AS t
			   SET %s = m.supabase_path
			  FROM storage_migration_map AS m
			 WHERE m.appwrite_file_id = t.%s
			   AND m.supabase_bucket  = ?
			   AND t.%s IS NOT NULL
			   AND t.%s <> ''
			   AND (t.%s IS NULL OR t.%s = '')`,
			c.table, c.path, c.fileID, c.fileID, c.fileID, c.path, c.path), c.supabase)
		if result.Error != nil {
			return fmt.Errorf("%s.%s: %w", c.table, c.path, result.Error)
		}
		log.Printf("  %-20s %-22s %4d row(s)", c.table, c.path, result.RowsAffected)
	}

	// product_media carries its bucket as data, so it matches on bucket_id
	// instead of a constant.
	result := db.Exec(`
		UPDATE product_media AS t
		   SET storage_path = m.supabase_path
		  FROM storage_migration_map AS m
		 WHERE m.appwrite_file_id   = t.file_id
		   AND m.appwrite_bucket_id = t.bucket_id
		   AND (t.storage_path IS NULL OR t.storage_path = '')`)
	if result.Error != nil {
		return fmt.Errorf("product_media.storage_path: %w", result.Error)
	}
	log.Printf("  %-20s %-22s %4d row(s)", "product_media", "storage_path", result.RowsAffected)
	return nil
}

// runVerify re-checks the two things that can silently be wrong: a file that
// was never copied, and a row still pointing only at Appwrite.
func runVerify(db *gorm.DB, appwrite *appwriteClient, pairs []bucketPair) error {
	log.Printf("\nVerifying:")

	copied, err := alreadyCopied(db)
	if err != nil {
		return err
	}

	var problems []string
	for _, pair := range pairs {
		files, err := appwrite.ListFiles(pair.appwrite)
		if err != nil {
			return err
		}

		var absent int
		for _, file := range files {
			if !copied[pair.appwrite+"/"+file.ID] {
				absent++
			}
		}
		log.Printf("  %-16s %4d file(s), %d not copied", pair.supabase, len(files), absent)
		if absent > 0 {
			problems = append(problems,
				fmt.Sprintf("%s: %d file(s) still only in Appwrite", pair.supabase, absent))
		}
	}

	for _, c := range columns {
		var unlinked int64
		query := fmt.Sprintf(
			`SELECT count(*) FROM %s WHERE %s IS NOT NULL AND %s <> '' AND (%s IS NULL OR %s = '')`,
			c.table, c.fileID, c.fileID, c.path, c.path)
		if err := db.Raw(query).Scan(&unlinked).Error; err != nil {
			return err
		}
		if unlinked > 0 {
			problems = append(problems,
				fmt.Sprintf("%s: %d row(s) have a %s but no %s", c.table, unlinked, c.fileID, c.path))
		}
	}

	if len(problems) > 0 {
		return fmt.Errorf("\n  %s", strings.Join(problems, "\n  "))
	}
	log.Printf("  every file is copied and every referencing row has a storage path.")
	return nil
}

func humanBytes(n int64) string {
	switch {
	case n >= 1<<30:
		return fmt.Sprintf("%.1f GB", float64(n)/float64(1<<30))
	case n >= 1<<20:
		return fmt.Sprintf("%.1f MB", float64(n)/float64(1<<20))
	case n >= 1<<10:
		return fmt.Sprintf("%.1f KB", float64(n)/float64(1<<10))
	default:
		return fmt.Sprintf("%d B", n)
	}
}
