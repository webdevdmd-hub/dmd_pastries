package response

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// Regression: ISSUE-038 — server errors showed raw database messages to users.
//
// On production on 2026-09-16 a failed expense save toasted "ERROR: duplicate
// key value violates unique constraint "idx_journal_entries_unique_source_posted"
// (SQLSTATE 23505)". Two modules sent err.Error() as the message; the other 26
// sent it as the error detail, which the client joins onto the message when it
// reads as prose. So every module could do it.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
func TestInternalErrorNeverEchoesTheError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPatch, "/api/v1/expenses/x", nil)

	secret := `ERROR: duplicate key value violates unique constraint "idx_journal_entries_unique_source_posted" (SQLSTATE 23505)`
	InternalError(c, errors.New(secret))

	if recorder.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", recorder.Code)
	}
	body := recorder.Body.String()
	for _, leak := range []string{"duplicate key", "SQLSTATE", "idx_journal_entries"} {
		if strings.Contains(body, leak) {
			t.Errorf("the response body contains %q, the raw error the user must not see: %s", leak, body)
		}
	}
	var meta Meta
	if err := json.Unmarshal(recorder.Body.Bytes(), &meta); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if meta.Success || meta.Message != InternalErrorMessage || meta.Errors != nil {
		t.Errorf("response = %+v, want success=false, the plain message, and no error detail", meta)
	}
}

// No handler may put an error's text in a 500 again. Scans every module, so a
// new module that copies the old pattern fails here.
func TestNoHandlerSendsARawErrorInA500(t *testing.T) {
	files, err := filepath.Glob("../../modules/*/*.go")
	if err != nil || len(files) == 0 {
		t.Fatalf("no module files found: %v", err)
	}
	leak := regexp.MustCompile(`response\.Error\(c,\s*(?:500|http\.StatusInternalServerError),[^\n]*err\.Error\(\)`)
	handlers := 0
	for _, file := range files {
		if strings.HasSuffix(file, "_test.go") {
			continue
		}
		raw, err := os.ReadFile(file)
		if err != nil {
			t.Fatalf("read %s: %v", file, err)
		}
		source := string(raw)
		if strings.Contains(source, "response.InternalError(c, err)") {
			handlers++
		}
		if loc := leak.FindStringIndex(source); loc != nil {
			line := strings.Count(source[:loc[0]], "\n") + 1
			t.Errorf("%s:%d sends err.Error() in a 500; use response.InternalError(c, err), which logs it instead",
				filepath.ToSlash(file), line)
		}
	}
	if handlers < 20 {
		t.Errorf("only %d modules use response.InternalError; the scan is reading the wrong files or the "+
			"handlers were reverted", handlers)
	}
}
