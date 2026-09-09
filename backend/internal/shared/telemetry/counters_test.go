package telemetry

import (
	"sync"
	"testing"
	"time"
)

// The counters decide whether the database is allowed to move hosts, so the
// arithmetic on top of them is worth pinning. Everything here resets state
// first, because the counters are process-wide by design.
func reset() { TakeSample(time.Now()) }

func TestStatementsPerRequestIsTheRatioOverTheInterval(t *testing.T) {
	reset()

	for range 4 {
		RecordRequest(10 * time.Millisecond)
	}
	for range 50 {
		RecordStatement(false)
	}

	sample := TakeSample(time.Now())

	if sample.Requests != 4 || sample.Statements != 50 {
		t.Fatalf("requests=%d statements=%d", sample.Requests, sample.Statements)
	}
	if sample.StatementsPerReq != 12.5 {
		t.Errorf("StatementsPerReq = %v, want 12.5", sample.StatementsPerReq)
	}
	if sample.MeanRequestLatency != 10*time.Millisecond {
		t.Errorf("MeanRequestLatency = %s", sample.MeanRequestLatency)
	}
}

// This is the whole point of the instrumentation: turning a chattiness number
// into the latency a customer would feel at the counter.
func TestProjectedOverheadAnswersTheGate(t *testing.T) {
	sample := Sample{StatementsPerReq: 30}

	if got := sample.ProjectedOverhead(20 * time.Millisecond); got != 600*time.Millisecond {
		t.Errorf("30 statements at 20ms = %s, want 600ms", got)
	}
	if got := sample.ProjectedOverhead(200 * time.Microsecond); got != 6*time.Millisecond {
		t.Errorf("30 statements on the current bridge = %s, want 6ms", got)
	}
}

// A sample must describe its own interval and then start clean, or a quiet
// night would keep inflating the next busy morning's numbers.
func TestSamplesDoNotAccumulate(t *testing.T) {
	reset()

	RecordRequest(time.Millisecond)
	RecordStatement(false)
	RecordStatement(false)
	first := TakeSample(time.Now())

	second := TakeSample(time.Now())

	if first.Statements != 2 {
		t.Errorf("first.Statements = %d, want 2", first.Statements)
	}
	if second.Statements != 0 || second.Requests != 0 {
		t.Errorf("counters carried into the next interval: %+v", second)
	}
	if second.StatementsPerReq != 0 {
		t.Errorf("StatementsPerReq = %v with no requests, want 0", second.StatementsPerReq)
	}
}

// An idle interval must not divide by zero, and must be distinguishable from a
// busy one that issued no queries.
func TestIdleIntervalIsSafe(t *testing.T) {
	reset()

	sample := TakeSample(time.Now())
	if sample.StatementsPerReq != 0 || sample.MeanRequestLatency != 0 {
		t.Errorf("idle sample = %+v, want zeroed derived fields", sample)
	}
}

func TestStatementErrorsAreCountedSeparately(t *testing.T) {
	reset()

	RecordRequest(time.Millisecond)
	RecordStatement(false)
	RecordStatement(true)
	RecordStatement(true)

	sample := TakeSample(time.Now())
	if sample.Statements != 3 {
		t.Errorf("Statements = %d, want all 3 counted", sample.Statements)
	}
	if sample.StatementErrors != 2 {
		t.Errorf("StatementErrors = %d, want 2", sample.StatementErrors)
	}
}

// The counters are read from a POS under concurrent load. If they raced, the
// ratio would drift and the gate would be decided on a wrong number.
func TestCountersAreSafeUnderConcurrency(t *testing.T) {
	reset()

	const (
		workers           = 16
		requestsPerWorker = 25
		statementsPerReq  = 4
	)

	var wg sync.WaitGroup
	for range workers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range requestsPerWorker {
				RecordRequest(time.Millisecond)
				for range statementsPerReq {
					RecordStatement(false)
				}
			}
		}()
	}
	wg.Wait()

	sample := TakeSample(time.Now())

	if want := int64(workers * requestsPerWorker); sample.Requests != want {
		t.Errorf("Requests = %d, want %d", sample.Requests, want)
	}
	if want := int64(workers * requestsPerWorker * statementsPerReq); sample.Statements != want {
		t.Errorf("Statements = %d, want %d", sample.Statements, want)
	}
	// The ratio is exact even though every request overlapped, which is the
	// property that makes global counters an acceptable substitute for
	// per-request attribution.
	if sample.StatementsPerReq != statementsPerReq {
		t.Errorf("StatementsPerReq = %v, want %d", sample.StatementsPerReq, statementsPerReq)
	}
}
