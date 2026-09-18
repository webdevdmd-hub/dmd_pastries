package settings

import (
	"os"
	"strings"
	"testing"
)

func readSource(t *testing.T, path string) string {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return strings.ReplaceAll(string(raw), "\r\n", "\n")
}

// Regression: ISSUE-062 — receipt layout Preview always failed: the page sent
// no body and the handler required one ("invalid request payload", EOF).
func TestReceiptPreviewAcceptsAnEmptyBody(t *testing.T) {
	handler := readSource(t, "handler.go")
	i := strings.Index(handler, "func (h *Handler) PreviewReceiptLayout(")
	if i == -1 || !strings.Contains(handler[i:], "c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF)") {
		t.Error("PreviewReceiptLayout must accept an empty body; both request fields are optional")
	}
}
