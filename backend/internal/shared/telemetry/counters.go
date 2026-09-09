// Package telemetry holds process-wide counters for the one question that
// decides whether this app's database can move off the host it shares with the
// API: how many SQL statements does a typical request issue?
//
// Postgres currently sits on the same Docker bridge as the backend, so a
// statement costs a fraction of a millisecond and nobody has ever had to count
// them. Reached over the internet, each one costs a network round trip, and the
// bill is statements-per-request multiplied by that round trip. At 30
// statements and 20ms, an ordinary request gains 600ms -- at the counter,
// during the morning rush.
//
// These are global counters, not per-request ones. That is deliberate: the app
// never threads a context into GORM, so attributing statements to a request
// would mean touching every repository. It is also unnecessary, because the
// ratio of two counters sampled over the same interval is exact no matter how
// many requests ran concurrently. What it cannot give is a p95 -- read the
// result as a mean and leave headroom accordingly.
package telemetry

import (
	"sync/atomic"
	"time"
)

var (
	sqlStatements  atomic.Int64
	httpRequests   atomic.Int64
	httpNanos      atomic.Int64
	sqlErrorCount  atomic.Int64
	lastSampleTime atomic.Int64
)

// RecordStatement counts one SQL statement. Called from a GORM callback.
func RecordStatement(failed bool) {
	sqlStatements.Add(1)
	if failed {
		sqlErrorCount.Add(1)
	}
}

// RecordRequest counts one served HTTP request and its wall-clock duration.
func RecordRequest(d time.Duration) {
	httpRequests.Add(1)
	httpNanos.Add(int64(d))
}

// Sample is one interval's worth of counters, already differenced.
type Sample struct {
	Interval           time.Duration
	Requests           int64
	Statements         int64
	StatementErrors    int64
	MeanRequestLatency time.Duration
	StatementsPerReq   float64
}

// ProjectedOverhead is the latency an average request would gain if every
// statement suddenly cost an extra round trip of rtt.
//
// This is the Phase 0 gate for the database move, expressed directly rather
// than left as arithmetic for whoever reads the logs at 2am.
func (s Sample) ProjectedOverhead(rtt time.Duration) time.Duration {
	return time.Duration(s.StatementsPerReq * float64(rtt))
}

// TakeSample differences the counters against the previous call and returns the
// interval's numbers. The first call establishes the baseline.
func TakeSample(now time.Time) Sample {
	var (
		statements = sqlStatements.Swap(0)
		requests   = httpRequests.Swap(0)
		nanos      = httpNanos.Swap(0)
		errors     = sqlErrorCount.Swap(0)
	)

	previous := lastSampleTime.Swap(now.UnixNano())
	interval := time.Duration(0)
	if previous != 0 {
		interval = now.Sub(time.Unix(0, previous))
	}

	sample := Sample{
		Interval:        interval,
		Requests:        requests,
		Statements:      statements,
		StatementErrors: errors,
	}
	if requests > 0 {
		sample.MeanRequestLatency = time.Duration(nanos / requests)
		sample.StatementsPerReq = float64(statements) / float64(requests)
	}
	return sample
}
