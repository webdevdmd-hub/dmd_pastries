// Package guards holds cross-module invariants that no single module owns.
//
// These are source scans rather than behavioural tests, which is normally the
// wrong tool. It is the right one here: the thing being protected is a
// hand-written SQL column list, and the failure mode is a column that is simply
// absent. Nothing throws, no row is missing, no test goes red -- the field
// arrives as an empty string and the image falls back to the old provider
// forever. There is no way to catch that without either a database or a scan,
// and the scan is the cheap one.
package guards

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// Each *_file_id column gained a *_storage_path sibling in migration 000111, so
// that files can move from Appwrite to Supabase without a cutover. A query that
// reads one and not the other is the bug this guards.
var siblings = map[string]string{
	"image_file_id":   "image_storage_path",
	"logo_file_id":    "logo_storage_path",
	"receipt_file_id": "receipt_storage_path",
	"avatar_file_id":  "avatar_storage_path",
}

// A bare SQL column on its own line, as it appears inside a raw query:
//
//	p.image_file_id,
var bareColumn = regexp.MustCompile(`^[a-z_]*\.?(image|logo|receipt|avatar)_file_id,?$`)

// isSQLContext reports whether this line is a SQL column list rather than Go
// code that happens to mention the column -- a struct tag, an update map, an
// audit field name. Those legitimately name one column without the other:
// writes still go to the old column, by design, until the upload path moves.
func isSQLContext(line string) bool {
	trimmed := strings.TrimSpace(line)
	return bareColumn.MatchString(trimmed) || strings.Contains(line, "Select(")
}

// nearby reports whether the sibling column appears close enough to count as
// part of the same column list.
//
// A window rather than the same line, because a raw query lists one column per
// line:
//
//	p.sale_price,
//	p.image_file_id,
//	p.image_storage_path,
//
// Three lines either side is enough for that and still tight enough that an
// unrelated mention elsewhere in the file cannot satisfy the check.
func nearby(lines []string, index int, sibling string) bool {
	const window = 3
	start := max(index-window, 0)
	end := min(index+window+1, len(lines))

	for _, line := range lines[start:end] {
		if strings.Contains(line, sibling) {
			return true
		}
	}
	return false
}

func TestEverySQLReadOfAFileIDAlsoReadsItsStoragePath(t *testing.T) {
	root := filepath.Join("..", "..", "..", "internal")

	var offenders []string
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}

		raw, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		lines := strings.Split(string(raw), "\n")
		for number, line := range lines {
			if !isSQLContext(line) {
				continue
			}
			for column, sibling := range siblings {
				if !strings.Contains(line, column) || nearby(lines, number, sibling) {
					continue
				}
				offenders = append(offenders,
					filepath.ToSlash(path)+":"+itoa(number+1)+"  selects "+column+" without "+sibling)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walking %s: %v", root, err)
	}

	if len(offenders) > 0 {
		t.Errorf("A query reads a file id but not its storage path:\n\n    %s\n\n"+
			"Add the sibling column to the select list. Without it the field is an\n"+
			"empty string at runtime, every image quietly falls back to Appwrite, and\n"+
			"the storage migration looks finished while that one screen never moved.",
			strings.Join(offenders, "\n    "))
	}
}

// The guard is only worth having if it can fail, and a scan that matches
// nothing passes for the wrong reason -- a broken regex, a wrong root path, a
// walk that silently visited no files all look identical to success. So assert
// it finds the real call sites.
func TestTheGuardActuallyInspectsTheRepository(t *testing.T) {
	root := filepath.Join("..", "..", "..", "internal")

	var sqlLines, goFiles int
	_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() || !strings.HasSuffix(path, ".go") {
			return nil
		}
		goFiles++
		raw, _ := os.ReadFile(path)
		for _, line := range strings.Split(string(raw), "\n") {
			if isSQLContext(line) {
				for column := range siblings {
					if strings.Contains(line, column) {
						sqlLines++
						break
					}
				}
			}
		}
		return nil
	})

	if goFiles < 50 {
		t.Fatalf("walked only %d Go files; the root path is probably wrong", goFiles)
	}
	// Four today: the POS raw product query, the POS category list, and the two
	// product-variant selects. If this drops to zero the guard has stopped
	// looking at anything.
	if sqlLines < 4 {
		t.Errorf("found %d SQL reads of a file id, want at least 4 -- the guard is "+
			"no longer matching the call sites it was written for", sqlLines)
	}
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var digits []byte
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	return string(digits)
}
