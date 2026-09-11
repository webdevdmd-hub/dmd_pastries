package events

import (
	"testing"
	"time"
)

func drain(t *testing.T, sub *Subscriber) (Change, bool) {
	t.Helper()
	select {
	case change := <-sub.C:
		return change, true
	case <-time.After(50 * time.Millisecond):
		return Change{}, false
	}
}

// The whole point: every other tab of the same business hears about it, the
// tab that did it does not (it already invalidated locally), and other
// businesses hear nothing at all.
func TestPublishReachesTheOtherTabsOfTheSameBusinessOnly(t *testing.T) {
	hub := NewHub()
	origin, cancelOrigin := hub.Subscribe("biz-a", "tab-1")
	defer cancelOrigin()
	other, cancelOther := hub.Subscribe("biz-a", "tab-2")
	defer cancelOther()
	stranger, cancelStranger := hub.Subscribe("biz-b", "tab-3")
	defer cancelStranger()

	delivered := hub.Publish("biz-a", Change{Roots: []string{"inventory"}, ClientID: "tab-1"})

	if delivered != 1 {
		t.Errorf("delivered = %d, want 1 (the other tab of biz-a)", delivered)
	}
	if change, ok := drain(t, other); !ok || len(change.Roots) != 1 || change.Roots[0] != "inventory" {
		t.Errorf("other tab got %+v (ok=%v), want the inventory change", change, ok)
	}
	if _, ok := drain(t, origin); ok {
		t.Error("the originating tab was echoed its own change")
	}
	if _, ok := drain(t, stranger); ok {
		t.Error("a tab of another business received the change")
	}
}

// Two tabs with no client id (an old client, a curl) still both get it: the
// echo filter only applies when the origin identified itself.
func TestAnAnonymousOriginIsNotFilteredOut(t *testing.T) {
	hub := NewHub()
	a, cancelA := hub.Subscribe("biz", "")
	defer cancelA()
	b, cancelB := hub.Subscribe("biz", "")
	defer cancelB()

	if delivered := hub.Publish("biz", Change{Roots: []string{"orders"}}); delivered != 2 {
		t.Errorf("delivered = %d, want 2", delivered)
	}
	if _, ok := drain(t, a); !ok {
		t.Error("tab a missed the change")
	}
	if _, ok := drain(t, b); !ok {
		t.Error("tab b missed the change")
	}
}

// A tab that stopped reading must not stall the request that published.
func TestASlowTabDropsNoticesInsteadOfBlockingThePublisher(t *testing.T) {
	hub := NewHub()
	_, cancel := hub.Subscribe("biz", "sleepy")
	defer cancel()

	done := make(chan struct{})
	go func() {
		for i := 0; i < subscriberBuffer*3; i++ {
			hub.Publish("biz", Change{Roots: []string{"pos"}})
		}
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Publish blocked on a subscriber that was not reading")
	}
}

func TestCancelRemovesTheTabAndTheEmptyBusiness(t *testing.T) {
	hub := NewHub()
	_, cancel := hub.Subscribe("biz", "tab")
	if hub.Subscribers("biz") != 1 {
		t.Fatalf("subscribers = %d, want 1", hub.Subscribers("biz"))
	}
	cancel()
	if hub.Subscribers("biz") != 0 {
		t.Errorf("subscribers = %d after cancel, want 0", hub.Subscribers("biz"))
	}
	if hub.Publish("biz", Change{Roots: []string{"x"}}) != 0 {
		t.Error("a cancelled tab was still delivered to")
	}
}
