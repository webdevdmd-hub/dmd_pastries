package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Both providers are spoken to over plain HTTP rather than through an SDK.
//
// The Appwrite Go SDK is already a dependency, but it is here for auth and
// returns its own error and pagination types; this command needs three calls
// and is deleted after the migration, so a thin client keeps the shape obvious
// and matches how the Supabase side already works in
// internal/shared/utils/supabase_admin.go.

const (
	// Files are read into memory one at a time. Everything in these buckets is
	// a product photo or a receipt scan, so this is generous -- it exists to
	// turn "the process was killed" into a named error on one file.
	maxFileBytes = 64 << 20

	// Copying is a long loop of small transfers. A per-request timeout means a
	// single stalled file fails that file rather than the run.
	requestTimeout = 2 * time.Minute
)

type appwriteClient struct {
	endpoint  string
	projectID string
	apiKey    string
	http      *http.Client
}

func newAppwriteClient(endpoint, projectID, apiKey string) *appwriteClient {
	// APPWRITE_ENDPOINT is conventionally written with the /v1 already on it,
	// but not always, and a missing or doubled version segment produces a 404
	// that reads like a missing bucket.
	trimmed := strings.TrimRight(strings.TrimSpace(endpoint), "/")
	if !strings.HasSuffix(trimmed, "/v1") {
		trimmed += "/v1"
	}

	return &appwriteClient{
		endpoint:  trimmed,
		projectID: projectID,
		apiKey:    apiKey,
		http:      &http.Client{Timeout: requestTimeout},
	}
}

// appwriteFile is one object as Appwrite describes it.
type appwriteFile struct {
	ID       string `json:"$id"`
	Name     string `json:"name"`
	MimeType string `json:"mimeType"`
	Size     int64  `json:"sizeOriginal"`
}

func (c *appwriteClient) do(method, path string, query url.Values) (*http.Response, error) {
	full := c.endpoint + path
	if len(query) > 0 {
		full += "?" + query.Encode()
	}

	request, err := http.NewRequest(method, full, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("X-Appwrite-Project", c.projectID)
	request.Header.Set("X-Appwrite-Key", c.apiKey)
	request.Header.Set("Accept", "application/json")

	response, err := c.http.Do(request)
	if err != nil {
		return nil, fmt.Errorf("%s %s: %w", method, path, err)
	}
	if response.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		_ = response.Body.Close()
		return nil, fmt.Errorf("%s %s: appwrite returned %d: %s",
			method, path, response.StatusCode, strings.TrimSpace(string(body)))
	}
	return response, nil
}

// ListFiles walks a bucket completely, following the cursor.
//
// Every object, not only the ones a row points at. The app has no delete path
// anywhere, so orphans exist, and the difference between "referenced" and
// "present" is exactly where a file goes missing without anyone noticing --
// storage is cheap and a second pass over Appwrite after it is switched off is
// not possible.
func (c *appwriteClient) ListFiles(bucketID string) ([]appwriteFile, error) {
	var (
		all    []appwriteFile
		cursor string
	)

	for {
		query := url.Values{}
		query.Add("queries[]", `limit(100)`)
		if cursor != "" {
			query.Add("queries[]", fmt.Sprintf(`cursorAfter("%s")`, cursor))
		}

		response, err := c.do(http.MethodGet, "/storage/buckets/"+bucketID+"/files", query)
		if err != nil {
			return nil, err
		}

		var page struct {
			Total int64          `json:"total"`
			Files []appwriteFile `json:"files"`
		}
		decodeErr := json.NewDecoder(response.Body).Decode(&page)
		_ = response.Body.Close()
		if decodeErr != nil {
			return nil, fmt.Errorf("decoding file list for %s: %w", bucketID, decodeErr)
		}

		all = append(all, page.Files...)
		if len(page.Files) < 100 {
			return all, nil
		}
		cursor = page.Files[len(page.Files)-1].ID
	}
}

// Download reads one file whole.
func (c *appwriteClient) Download(bucketID, fileID string) ([]byte, error) {
	response, err := c.do(http.MethodGet,
		"/storage/buckets/"+bucketID+"/files/"+fileID+"/download", nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = response.Body.Close() }()

	// LimitReader plus one byte, so a file at exactly the cap is not silently
	// truncated into a corrupt copy that uploads successfully.
	body, err := io.ReadAll(io.LimitReader(response.Body, maxFileBytes+1))
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", fileID, err)
	}
	if int64(len(body)) > maxFileBytes {
		return nil, fmt.Errorf("%s is larger than the %d byte limit", fileID, int64(maxFileBytes))
	}
	return body, nil
}

type supabaseStorageClient struct {
	baseURL        string
	serviceRoleKey string
	http           *http.Client
}

func newSupabaseStorageClient(projectURL, serviceRoleKey string) *supabaseStorageClient {
	return &supabaseStorageClient{
		baseURL:        strings.TrimRight(strings.TrimSpace(projectURL), "/") + "/storage/v1",
		serviceRoleKey: serviceRoleKey,
		http:           &http.Client{Timeout: requestTimeout},
	}
}

func (c *supabaseStorageClient) request(method, path string, body io.Reader, contentType string) (*http.Response, error) {
	request, err := http.NewRequest(method, c.baseURL+path, body)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Authorization", "Bearer "+c.serviceRoleKey)
	request.Header.Set("apikey", c.serviceRoleKey)
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}
	return c.http.Do(request)
}

// BucketExists reports whether a bucket is already there.
//
// Creating it is deliberately not done here. A bucket carries a public/private
// decision and a size limit that outlive this command, so it belongs with the
// person who owns the project, not in a one-off copier that would quietly
// create it with whatever defaults this file happened to choose.
func (c *supabaseStorageClient) BucketExists(name string) (bool, error) {
	response, err := c.request(http.MethodGet, "/bucket/"+name, nil, "")
	if err != nil {
		return false, err
	}
	defer func() { _ = response.Body.Close() }()

	switch {
	case response.StatusCode == http.StatusOK:
		return true, nil
	case response.StatusCode == http.StatusNotFound:
		return false, nil
	default:
		detail, _ := io.ReadAll(io.LimitReader(response.Body, 1024))
		return false, fmt.Errorf("checking bucket %s: supabase returned %d: %s",
			name, response.StatusCode, strings.TrimSpace(string(detail)))
	}
}

// Upload writes one object, and treats "already there" as success.
//
// Upsert stays off. The path is the Appwrite file id, so a collision can only
// mean this file was already copied -- by an earlier run, or by an earlier
// iteration of this one that died after uploading and before recording. In both
// cases the bytes are already correct and overwriting them buys nothing, while
// upsert would turn a genuine id collision into silent replacement.
func (c *supabaseStorageClient) Upload(bucket, path, contentType string, content []byte) (alreadyPresent bool, err error) {
	if contentType == "" {
		// Supabase defaults to text/plain, which browsers download rather than
		// display -- turning a product photo into a file prompt.
		contentType = "application/octet-stream"
	}

	response, err := c.request(http.MethodPost,
		"/object/"+bucket+"/"+path, bytes.NewReader(content), contentType)
	if err != nil {
		return false, err
	}
	defer func() { _ = response.Body.Close() }()

	switch {
	case response.StatusCode < 300:
		return false, nil
	case response.StatusCode == http.StatusConflict:
		return true, nil
	default:
		detail, _ := io.ReadAll(io.LimitReader(response.Body, 1024))
		return false, fmt.Errorf("uploading %s/%s: supabase returned %d: %s",
			bucket, path, response.StatusCode, strings.TrimSpace(string(detail)))
	}
}
