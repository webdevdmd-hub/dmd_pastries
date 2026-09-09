package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// APPWRITE_ENDPOINT is written both ways in the wild. Getting this wrong gives a
// 404 that reads exactly like a missing bucket, which is a bad hour.
func TestTheEndpointGetsExactlyOneVersionSegment(t *testing.T) {
	for _, given := range []string{
		"https://appwrite.example.test/v1",
		"https://appwrite.example.test",
		"https://appwrite.example.test/",
		"  https://appwrite.example.test/v1/  ",
	} {
		client := newAppwriteClient(given, "project", "key")
		if client.endpoint != "https://appwrite.example.test/v1" {
			t.Errorf("newAppwriteClient(%q).endpoint = %q", given, client.endpoint)
		}
	}
}

// The bucket is walked to the end, not just the first page.
//
// A bucket with more than 100 files that stops after one page is the quietest
// possible failure: the copy reports success, the counts look plausible, and
// the files nobody happened to open are simply gone once Appwrite is retired.
func TestListFilesFollowsTheCursorToTheEnd(t *testing.T) {
	var cursors []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		queries := r.URL.Query()["queries[]"]
		var after string
		for _, q := range queries {
			if strings.HasPrefix(q, "cursorAfter") {
				after = q
			}
		}
		cursors = append(cursors, after)

		w.Header().Set("Content-Type", "application/json")
		if after == "" {
			// A full page, so the caller must ask for another.
			var items []string
			for i := range 100 {
				items = append(items, fmt.Sprintf(`{"$id":"file%03d","name":"a.jpg","sizeOriginal":10}`, i))
			}
			fmt.Fprintf(w, `{"total":101,"files":[%s]}`, strings.Join(items, ","))
			return
		}
		fmt.Fprint(w, `{"total":101,"files":[{"$id":"last","name":"b.jpg","sizeOriginal":20}]}`)
	}))
	t.Cleanup(server.Close)

	files, err := newAppwriteClient(server.URL, "project", "key").ListFiles("bucket")
	if err != nil {
		t.Fatalf("ListFiles: %v", err)
	}

	if len(files) != 101 {
		t.Errorf("got %d files, want 101 -- pagination stopped early", len(files))
	}
	if len(cursors) != 2 {
		t.Fatalf("made %d request(s), want 2", len(cursors))
	}
	if want := `cursorAfter("file099")`; cursors[1] != want {
		t.Errorf("second request sent %q, want %q -- the cursor must be the last id "+
			"of the previous page, or the walk repeats or skips", cursors[1], want)
	}
}

// A short page ends the walk without a further request.
func TestListFilesStopsOnAShortPage(t *testing.T) {
	var requests int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"total":1,"files":[{"$id":"only","name":"a.jpg","sizeOriginal":5}]}`)
	}))
	t.Cleanup(server.Close)

	files, err := newAppwriteClient(server.URL, "project", "key").ListFiles("bucket")
	if err != nil {
		t.Fatalf("ListFiles: %v", err)
	}
	if len(files) != 1 || requests != 1 {
		t.Errorf("got %d file(s) in %d request(s), want 1 in 1", len(files), requests)
	}
}

func TestAppwriteCredentialsAreSent(t *testing.T) {
	var project, key string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		project = r.Header.Get("X-Appwrite-Project")
		key = r.Header.Get("X-Appwrite-Key")
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"total":0,"files":[]}`)
	}))
	t.Cleanup(server.Close)

	if _, err := newAppwriteClient(server.URL, "the-project", "the-key").ListFiles("b"); err != nil {
		t.Fatalf("ListFiles: %v", err)
	}
	if project != "the-project" || key != "the-key" {
		t.Errorf("project=%q key=%q; both headers are required", project, key)
	}
}

// A file at the cap must fail rather than upload truncated.
//
// A truncated image uploads perfectly happily and renders as a broken or
// half-drawn picture much later, with nothing linking it back to the copy.
func TestDownloadRefusesAnOversizedFileRatherThanTruncating(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(make([]byte, maxFileBytes+1))
	}))
	t.Cleanup(server.Close)

	_, err := newAppwriteClient(server.URL, "p", "k").Download("bucket", "big")
	if err == nil {
		t.Fatal("an oversized file was accepted, so a truncated copy would be uploaded")
	}
	if !strings.Contains(err.Error(), "larger than") {
		t.Errorf("err = %v, want it to name the size limit", err)
	}
}

// 409 means the object is already there, which is success for a resumable copy.
func TestUploadTreatsAConflictAsAlreadyCopied(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"error":"Duplicate"}`))
	}))
	t.Cleanup(server.Close)

	client := newSupabaseStorageClient(server.URL, "service-role")
	present, err := client.Upload("product-images", "abc", "image/jpeg", []byte("x"))
	if err != nil {
		t.Fatalf("a conflict was reported as an error, which would abort a resumed run: %v", err)
	}
	if !present {
		t.Error("a conflict should report the object as already present")
	}
}

func TestUploadSendsTheContentTypeAndNeverAnEmptyOne(t *testing.T) {
	var seen string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = r.Header.Get("Content-Type")
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)

	client := newSupabaseStorageClient(server.URL, "service-role")

	if _, err := client.Upload("b", "p", "image/png", []byte("x")); err != nil {
		t.Fatalf("Upload: %v", err)
	}
	if seen != "image/png" {
		t.Errorf("Content-Type = %q, want image/png", seen)
	}

	// Appwrite does not always know a mime type. Sending nothing makes Supabase
	// serve the object as text/plain, which browsers download instead of
	// displaying -- a product photo becomes a file prompt.
	if _, err := client.Upload("b", "p", "", []byte("x")); err != nil {
		t.Fatalf("Upload: %v", err)
	}
	if seen != "application/octet-stream" {
		t.Errorf("Content-Type = %q for an unknown type, want application/octet-stream", seen)
	}
}

// A missing bucket is a 404 and must be reported as absent, not as an error --
// the whole point of the check is to name the buckets to create.
func TestBucketExistsDistinguishesMissingFromBroken(t *testing.T) {
	for _, tc := range []struct {
		status    int
		exists    bool
		expectErr bool
	}{
		{http.StatusOK, true, false},
		{http.StatusNotFound, false, false},
		{http.StatusUnauthorized, false, true},
	} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(tc.status)
		}))

		exists, err := newSupabaseStorageClient(server.URL, "key").BucketExists("product-images")
		server.Close()

		if (err != nil) != tc.expectErr {
			t.Errorf("status %d: err = %v, expectErr = %v", tc.status, err, tc.expectErr)
		}
		if exists != tc.exists {
			t.Errorf("status %d: exists = %v, want %v", tc.status, exists, tc.exists)
		}
	}
}

func TestHumanBytes(t *testing.T) {
	for _, tc := range []struct {
		in   int64
		want string
	}{{512, "512 B"}, {2048, "2.0 KB"}, {5 << 20, "5.0 MB"}, {3 << 30, "3.0 GB"}} {
		if got := humanBytes(tc.in); got != tc.want {
			t.Errorf("humanBytes(%d) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
