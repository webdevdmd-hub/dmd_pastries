package main

import (
	"testing"

	"gorm.io/gorm"

	"pastries-pos/internal/testsupport/testdb"
)

// The backfill is eight hand-written UPDATE statements naming twenty table and
// column names between them. A typo in any of them is a runtime error the first
// time the copy is run for real, in the middle of a migration, against
// production -- so they are run here against the actual schema instead.
//
// Empty tables are enough for that: Postgres validates every identifier before
// it looks at a single row, so a wrong column name fails just as loudly with
// nothing to update.
func TestBackfillStatementsMatchTheRealSchema(t *testing.T) {
	tx := testdb.Tx(t)

	if err := backfill(tx); err != nil {
		t.Fatalf("backfill against an empty schema: %v\n\n"+
			"Every statement names real tables and columns or none of them do; this "+
			"failing means one of the names in `columns` no longer matches the schema.", err)
	}
}

// The rule that matters: a row is only pointed at a copy that exists.
//
// Setting the path for a file the copy never reached would be strictly worse
// than leaving it NULL. NULL falls back to Appwrite and the image renders; a
// path to an object that is not there renders nothing, and there is no further
// fallback behind it.
func TestBackfillOnlyLinksFilesThatWereActuallyCopied(t *testing.T) {
	tx := testdb.Tx(t)
	seed := testdb.Seed(t, tx)

	const bucket = "the-appwrite-product-bucket"
	copiedFile := "file-that-was-copied"
	missedFile := "file-the-copy-never-reached"

	copiedCategory := insertCategory(t, tx, seed.BusinessID, "Copied", "COPIED", copiedFile)
	missedCategory := insertCategory(t, tx, seed.BusinessID, "Missed", "MISSED", missedFile)

	if err := tx.Exec(`
		INSERT INTO storage_migration_map
		  (appwrite_bucket_id, appwrite_file_id, supabase_bucket, supabase_path, bytes)
		VALUES (?, ?, 'product-images', ?, 123)`,
		bucket, copiedFile, copiedFile).Error; err != nil {
		t.Fatalf("seeding the map: %v", err)
	}

	if err := backfill(tx); err != nil {
		t.Fatalf("backfill: %v", err)
	}

	if got := categoryPath(t, tx, copiedCategory); got != copiedFile {
		t.Errorf("copied file: image_storage_path = %q, want %q", got, copiedFile)
	}
	if got := categoryPath(t, tx, missedCategory); got != "" {
		t.Errorf("uncopied file: image_storage_path = %q, want empty -- pointing a row "+
			"at an object that was never uploaded renders nothing, where NULL would "+
			"still have fallen back to Appwrite", got)
	}
}

// Re-running must not change anything, because a resumed copy runs it again.
func TestBackfillIsRepeatable(t *testing.T) {
	tx := testdb.Tx(t)
	seed := testdb.Seed(t, tx)

	const file = "a-copied-file"
	category := insertCategory(t, tx, seed.BusinessID, "Cakes", "CAKES", file)

	if err := tx.Exec(`
		INSERT INTO storage_migration_map
		  (appwrite_bucket_id, appwrite_file_id, supabase_bucket, supabase_path, bytes)
		VALUES ('bucket', ?, 'product-images', ?, 1)`, file, file).Error; err != nil {
		t.Fatalf("seeding the map: %v", err)
	}

	for attempt := 1; attempt <= 2; attempt++ {
		if err := backfill(tx); err != nil {
			t.Fatalf("backfill attempt %d: %v", attempt, err)
		}
		if got := categoryPath(t, tx, category); got != file {
			t.Fatalf("after attempt %d: image_storage_path = %q, want %q", attempt, got, file)
		}
	}
}

func insertCategory(t *testing.T, tx *gorm.DB, businessID, name, code, fileID string) string {
	t.Helper()

	id := testdb.NewUUID()
	if err := tx.Exec(`
		INSERT INTO product_categories
		  (id, business_id, category_name, category_code, image_file_id)
		VALUES (?, ?, ?, ?, ?)`, id, businessID, name, code, fileID).Error; err != nil {
		t.Fatalf("inserting category %s: %v", code, err)
	}
	return id
}

func categoryPath(t *testing.T, tx *gorm.DB, id string) string {
	t.Helper()

	var path *string
	if err := tx.Raw(`SELECT image_storage_path FROM product_categories WHERE id = ?`, id).
		Scan(&path).Error; err != nil {
		t.Fatalf("reading back category %s: %v", id, err)
	}
	if path == nil {
		return ""
	}
	return *path
}
