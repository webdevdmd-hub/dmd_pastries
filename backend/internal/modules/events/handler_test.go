package events

import (
	"bufio"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"pastries-pos/internal/shared/events"
	"pastries-pos/internal/shared/utils"
)

// A stand-in for the auth middleware: whoever calls says which business they
// are, so the test can play two businesses without tokens.
func fakeAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(utils.AuthContextKey, &utils.AuthContext{
			UserID:     "user-" + c.GetHeader("X-Test-Business"),
			BusinessID: c.GetHeader("X-Test-Business"),
		})
		c.Next()
	}
}

func newTestServer(t *testing.T) (*httptest.Server, *events.Hub) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	hub := events.NewHub()
	router := gin.New()
	RegisterRoutes(router, NewHandler(hub), fakeAuth())
	server := httptest.NewServer(router)
	t.Cleanup(server.Close)
	return server, hub
}

func TestChangedRelaysToTheBusinessAndRejectsJunk(t *testing.T) {
	server, hub := newTestServer(t)
	other, cancel := hub.Subscribe("biz-a", "tab-listener")
	defer cancel()

	post := func(body, business, client string) *http.Response {
		req, _ := http.NewRequest(http.MethodPost, server.URL+"/api/v1/events/changed", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-Business", business)
		req.Header.Set("X-Client-Id", client)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("POST: %v", err)
		}
		return resp
	}

	if resp := post(`{"roots":["inventory","inventory"," orders "]}`, "biz-a", "tab-origin"); resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	select {
	case change := <-other.C:
		if len(change.Roots) != 2 || change.Roots[0] != "inventory" || change.Roots[1] != "orders" {
			t.Errorf("roots = %v, want deduplicated and trimmed [inventory orders]", change.Roots)
		}
		if change.ClientID != "tab-origin" {
			t.Errorf("client id = %q, want tab-origin", change.ClientID)
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatal("the listening tab did not receive the change")
	}

	// Another business posting the same thing must not reach biz-a.
	post(`{"roots":["inventory"]}`, "biz-b", "tab-b")
	select {
	case change := <-other.C:
		t.Errorf("biz-a received a change published by biz-b: %+v", change)
	case <-time.After(100 * time.Millisecond):
	}

	for _, body := range []string{`{}`, `{"roots":[]}`, `{"roots":[""]}`, `{"roots":["` + strings.Repeat("x", 65) + `"]}`} {
		if resp := post(body, "biz-a", "tab-origin"); resp.StatusCode != http.StatusBadRequest {
			t.Errorf("body %s: status = %d, want 400", body, resp.StatusCode)
		}
	}
}

// The stream must say hello immediately (so proxies commit to streaming),
// then deliver a change as one SSE event, and stop when the client leaves.
func TestStreamDeliversChangesAsServerSentEvents(t *testing.T) {
	server, hub := newTestServer(t)

	ctx, cancelReq := context.WithCancel(context.Background())
	defer cancelReq()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+"/api/v1/events/stream", nil)
	req.Header.Set("X-Test-Business", "biz-a")
	req.Header.Set("X-Client-Id", "tab-listener")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET stream: %v", err)
	}
	defer resp.Body.Close()

	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Fatalf("Content-Type = %q, want text/event-stream", ct)
	}
	reader := bufio.NewReader(resp.Body)
	first, _ := reader.ReadString('\n')
	if !strings.HasPrefix(first, ": connected") {
		t.Fatalf("first line = %q, want the connected comment", first)
	}

	// Wait until the hub sees the subscriber, then publish from another tab.
	deadline := time.Now().Add(time.Second)
	for hub.Subscribers("biz-a") == 0 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if hub.Publish("biz-a", events.Change{Roots: []string{"pos", "inventory"}, ClientID: "tab-origin"}) != 1 {
		t.Fatal("publish did not reach the streaming tab")
	}

	var lines []string
	for len(lines) < 3 {
		line, err := reader.ReadString('\n')
		if err != nil {
			t.Fatalf("reading stream: %v (got %q)", err, lines)
		}
		if strings.TrimSpace(line) == "" && len(lines) == 0 {
			continue // the blank line after the connected comment
		}
		lines = append(lines, line)
	}
	if lines[0] != "event: changed\n" {
		t.Errorf("event line = %q", lines[0])
	}
	if !strings.HasPrefix(lines[1], `data: {"roots":["pos","inventory"]`) {
		t.Errorf("data line = %q", lines[1])
	}

	cancelReq()
	deadline = time.Now().Add(time.Second)
	for hub.Subscribers("biz-a") != 0 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if hub.Subscribers("biz-a") != 0 {
		t.Error("the subscriber was not removed after the client disconnected")
	}
}
