// Package events fans "something changed" notices out to every open browser
// tab of a business, so a sale rung on one terminal shows on the others
// without anyone pressing reload.
//
// The unit of change is a query root -- the same names the frontend's
// invalidation map uses ("inventory", "orders", ...). The frontend already
// knows exactly which roots each of its mutations touches; after invalidating
// them locally it tells the API, and the API relays the list to the other
// tabs of the same business. Nothing here interprets the roots; they are
// opaque strings with a size cap.
//
// In-memory and per process. The API runs as one replica; if that ever
// changes, this is the seam to put a shared bus behind.
package events

import (
	"sync"
	"time"
)

// Change is one notice: these roots changed, and this client caused it.
type Change struct {
	Roots    []string  `json:"roots"`
	ClientID string    `json:"client_id,omitempty"`
	At       time.Time `json:"at"`
}

// Subscriber is one open tab. Its channel is buffered; a tab that cannot
// keep up loses notices rather than blocking the publisher, and the next
// notice it does receive invalidates broadly enough to catch up.
type Subscriber struct {
	ClientID string
	C        <-chan Change
	ch       chan Change
}

const subscriberBuffer = 32

type Hub struct {
	mu   sync.Mutex
	subs map[string]map[*Subscriber]struct{} // business id -> tabs
}

func NewHub() *Hub {
	return &Hub{subs: make(map[string]map[*Subscriber]struct{})}
}

// Subscribe registers a tab. The returned cancel must be called when the
// connection closes, or the hub keeps a dead channel forever.
func (h *Hub) Subscribe(businessID, clientID string) (*Subscriber, func()) {
	ch := make(chan Change, subscriberBuffer)
	sub := &Subscriber{ClientID: clientID, C: ch, ch: ch}

	h.mu.Lock()
	if h.subs[businessID] == nil {
		h.subs[businessID] = make(map[*Subscriber]struct{})
	}
	h.subs[businessID][sub] = struct{}{}
	h.mu.Unlock()

	return sub, func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if tabs := h.subs[businessID]; tabs != nil {
			delete(tabs, sub)
			if len(tabs) == 0 {
				delete(h.subs, businessID)
			}
		}
	}
}

// Publish sends the change to every tab of the business except the one that
// caused it -- that tab has already invalidated locally, and echoing it back
// would refetch the same data twice.
func (h *Hub) Publish(businessID string, change Change) (delivered int) {
	h.mu.Lock()
	defer h.mu.Unlock()

	for sub := range h.subs[businessID] {
		if change.ClientID != "" && sub.ClientID == change.ClientID {
			continue
		}
		select {
		case sub.ch <- change:
			delivered++
		default:
			// Full buffer: this tab is not reading. Drop rather than block
			// the request that caused the change.
		}
	}
	return delivered
}

// Subscribers is how many tabs a business has open. For health output.
func (h *Hub) Subscribers(businessID string) int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.subs[businessID])
}

// Publisher is what services hold: enough to announce a change, nothing
// more. The hub satisfies it; tests use a recorder.
type Publisher interface {
	Publish(businessID string, change Change) int
}

// Announce is the one-liner services call after a change made outside a
// signed-in tab -- a public endpoint, or a job -- where no browser can
// announce it. Roots are the frontend's query-root names.
func Announce(publisher Publisher, businessID string, roots ...string) {
	if publisher == nil || businessID == "" || len(roots) == 0 {
		return
	}
	publisher.Publish(businessID, Change{Roots: roots, At: time.Now().UTC()})
}
