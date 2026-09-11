// Package events exposes the change hub over HTTP: one long-lived stream a
// tab listens on, and one small endpoint a tab posts to after it has changed
// something. Both sit behind the ordinary auth guard; the business id comes
// from the verified token, never from the request, so a tab only ever hears
// about its own business.
package events

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"pastries-pos/internal/shared/events"
	"pastries-pos/internal/shared/response"
	"pastries-pos/internal/shared/utils"
)

const (
	// Traefik and browsers drop an idle connection long before this; a
	// comment line every 25 s keeps it open without waking the client's
	// message handler.
	heartbeat = 25 * time.Second
	maxRoots  = 64
	maxRoot   = 64
	// Header the tab uses to identify itself, so its own changes are not
	// echoed back to it. Random per tab; not a credential.
	clientIDHeader = "X-Client-Id"
)

type Handler struct {
	hub *events.Hub
}

func NewHandler(hub *events.Hub) *Handler {
	return &Handler{hub: hub}
}

func RegisterRoutes(router *gin.Engine, handler *Handler, authGuard gin.HandlerFunc) {
	group := router.Group("/api/v1/events")
	group.Use(authGuard)
	group.GET("/stream", handler.Stream)
	group.POST("/changed", handler.Changed)
}

type changedRequest struct {
	Roots []string `json:"roots" binding:"required"`
}

// Changed is called by a tab after one of its mutations succeeded and it has
// invalidated its own cache. The roots are relayed to the business's other
// tabs. Roots are opaque here; only their number and length are checked.
func (h *Handler) Changed(c *gin.Context) {
	var req changedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	roots, err := sanitizeRoots(req.Roots)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error(), nil)
		return
	}

	current := utils.MustAuthContext(c)
	delivered := h.hub.Publish(current.BusinessID, events.Change{
		Roots:    roots,
		ClientID: clientID(c),
		At:       time.Now().UTC(),
	})

	response.Success(c, http.StatusOK, "change relayed", gin.H{"delivered": delivered})
}

// Stream is the Server-Sent Events connection a tab keeps open. Each notice
// is one `changed` event whose data is the JSON change. It ends when the tab
// goes away.
func (h *Handler) Stream(c *gin.Context) {
	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		response.Error(c, http.StatusInternalServerError, "streaming is not supported by this server", nil)
		return
	}

	current := utils.MustAuthContext(c)
	sub, cancel := h.hub.Subscribe(current.BusinessID, clientID(c))
	defer cancel()

	header := c.Writer.Header()
	header.Set("Content-Type", "text/event-stream")
	header.Set("Cache-Control", "no-cache, no-transform")
	header.Set("Connection", "keep-alive")
	// Tells nginx-style proxies not to buffer; harmless elsewhere.
	header.Set("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)

	// A first byte straight away, so the client knows it is connected and
	// any proxy commits to streaming.
	if _, err := io.WriteString(c.Writer, ": connected\n\n"); err != nil {
		return
	}
	flusher.Flush()

	ticker := time.NewTicker(heartbeat)
	defer ticker.Stop()
	ctx := c.Request.Context()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := io.WriteString(c.Writer, ": ping\n\n"); err != nil {
				return
			}
			flusher.Flush()
		case change := <-sub.C:
			payload, err := json.Marshal(change)
			if err != nil {
				continue
			}
			if _, err := fmt.Fprintf(c.Writer, "event: changed\ndata: %s\n\n", payload); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func clientID(c *gin.Context) string {
	id := strings.TrimSpace(c.GetHeader(clientIDHeader))
	if len(id) > 64 {
		return id[:64]
	}
	return id
}

func sanitizeRoots(in []string) ([]string, error) {
	if len(in) == 0 {
		return nil, fmt.Errorf("roots must not be empty")
	}
	if len(in) > maxRoots {
		return nil, fmt.Errorf("too many roots (max %d)", maxRoots)
	}
	seen := make(map[string]struct{}, len(in))
	out := make([]string, 0, len(in))
	for _, raw := range in {
		root := strings.TrimSpace(raw)
		if root == "" || len(root) > maxRoot {
			return nil, fmt.Errorf("invalid root %q", raw)
		}
		if _, dup := seen[root]; dup {
			continue
		}
		seen[root] = struct{}{}
		out = append(out, root)
	}
	return out, nil
}
