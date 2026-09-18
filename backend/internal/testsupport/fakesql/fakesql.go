// Package fakesql is a scripted stand-in for Postgres, for tests that drive a
// service through the SQL it really sends without a database.
//
// testdb needs a reachable Postgres and skips without one, so on a laptop or
// in CI without a database the delete guards it could check go untested.
// This is the opposite trade: no real rows, but every statement GORM builds
// -- inside and outside transactions -- is recorded in order, and a test
// answers the queries it cares about the way the database would for the rows
// it has in mind.
//
// Anything the responder does not answer behaves like an empty table: a
// SELECT returns no rows (so Count reads 0 and First is ErrRecordNotFound)
// and a write reports one row affected.
//
//	db, rec := fakesql.Open(t, func(q fakesql.Query) (fakesql.Result, bool) {
//	    if q.Has(`FROM "stock_movements"`) {
//	        return fakesql.Count(3), true
//	    }
//	    return fakesql.Result{}, false
//	})
//	err := service.Delete(user, id, "", "")
//	rec.Committed()     // did the transaction commit?
//	rec.Writes("UPDATE \"inventory_items\"")
package fakesql

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"io"
	"sort"
	"strings"
	"sync"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Query is one statement as the database receives it.
type Query struct {
	SQL  string
	Args []any
	// Kind is "query" for statements that return rows and "exec" for writes.
	Kind string
	// InTx is true when the statement ran inside a transaction.
	InTx bool
}

// Has reports whether the statement text contains every fragment.
func (q Query) Has(fragments ...string) bool {
	for _, fragment := range fragments {
		if !strings.Contains(q.SQL, fragment) {
			return false
		}
	}
	return true
}

// HasArg reports whether any bound argument equals value.
func (q Query) HasArg(value any) bool {
	for _, arg := range q.Args {
		if arg == value {
			return true
		}
	}
	return false
}

// Result is a responder's answer: rows for a query, rows affected for a
// write, or an error for either.
type Result struct {
	Columns      []string
	Rows         [][]any
	RowsAffected int64
	Err          error
}

// Responder answers a statement. Returning false falls back to the default:
// no rows for a query, one row affected for a write.
type Responder func(Query) (Result, bool)

// Count answers a COUNT(*) or any single-number query.
func Count(n int64) Result {
	return Result{Columns: []string{"count"}, Rows: [][]any{{n}}}
}

// Row answers with one row built from column -> value.
func Row(values map[string]any) Result {
	columns := make([]string, 0, len(values))
	for column := range values {
		columns = append(columns, column)
	}
	sort.Strings(columns)
	row := make([]any, len(columns))
	for i, column := range columns {
		row[i] = values[column]
	}
	return Result{Columns: columns, Rows: [][]any{row}}
}

// Affected answers a write with the given rows-affected count.
func Affected(n int64) Result {
	return Result{RowsAffected: n}
}

// Fail answers a statement with an error, as a constraint violation would.
func Fail(message string) Result {
	return Result{Err: errors.New(message)}
}

// Recorder holds every statement and transaction event, in order.
type Recorder struct {
	mu      sync.Mutex
	log     []Query
	respond Responder
}

// Open returns a GORM handle whose every statement goes to respond.
func Open(t testing.TB, respond Responder) (*gorm.DB, *Recorder) {
	t.Helper()
	if respond == nil {
		respond = func(Query) (Result, bool) { return Result{}, false }
	}
	recorder := &Recorder{respond: respond}
	sqlDB := sql.OpenDB(connector{recorder: recorder})
	db, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{
		DisableAutomaticPing: true,
		Logger:               logger.Discard,
	})
	if err != nil {
		t.Fatalf("fakesql: open gorm: %v", err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	return db, recorder
}

// Statements returns every statement sent, including BEGIN/COMMIT/ROLLBACK.
func (r *Recorder) Statements() []Query {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]Query(nil), r.log...)
}

// Matching returns the statements containing every fragment.
func (r *Recorder) Matching(fragments ...string) []Query {
	var out []Query
	for _, q := range r.Statements() {
		if q.Has(fragments...) {
			out = append(out, q)
		}
	}
	return out
}

// Writes returns the exec statements containing every fragment.
func (r *Recorder) Writes(fragments ...string) []Query {
	var out []Query
	for _, q := range r.Matching(fragments...) {
		if q.Kind == "exec" {
			out = append(out, q)
		}
	}
	return out
}

// Committed reports whether a transaction committed.
func (r *Recorder) Committed() bool { return len(r.Matching("COMMIT")) > 0 }

// RolledBack reports whether a transaction rolled back.
func (r *Recorder) RolledBack() bool { return len(r.Matching("ROLLBACK")) > 0 }

// Dump renders the log for a failure message.
func (r *Recorder) Dump() string {
	var b strings.Builder
	for _, q := range r.Statements() {
		b.WriteString("  ")
		if q.InTx {
			b.WriteString("[tx] ")
		}
		b.WriteString(q.SQL)
		b.WriteString("\n")
	}
	return b.String()
}

func (r *Recorder) record(q Query) {
	r.mu.Lock()
	r.log = append(r.log, q)
	r.mu.Unlock()
}

func (r *Recorder) answer(q Query) Result {
	r.record(q)
	if result, ok := r.respond(q); ok {
		return result
	}
	if q.Kind == "exec" {
		return Affected(1)
	}
	return Result{}
}

type connector struct{ recorder *Recorder }

func (c connector) Connect(context.Context) (driver.Conn, error) {
	return &conn{recorder: c.recorder}, nil
}

func (c connector) Driver() driver.Driver { return fakeDriver{} }

type fakeDriver struct{}

func (fakeDriver) Open(string) (driver.Conn, error) {
	return nil, errors.New("fakesql: use sql.OpenDB with a connector")
}

type conn struct {
	recorder *Recorder
	inTx     bool
}

func (c *conn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("fakesql: prepared statements are not supported")
}

func (c *conn) Close() error { return nil }

func (c *conn) Begin() (driver.Tx, error) {
	return c.BeginTx(context.Background(), driver.TxOptions{})
}

func (c *conn) BeginTx(context.Context, driver.TxOptions) (driver.Tx, error) {
	c.recorder.record(Query{SQL: "BEGIN", Kind: "exec", InTx: true})
	c.inTx = true
	return tx{conn: c}, nil
}

// CheckNamedValue passes arguments through, resolving driver.Valuer so a
// test compares plain values (a DeletedAt becomes its time, an Amount its
// string).
func (c *conn) CheckNamedValue(nv *driver.NamedValue) error {
	if valuer, ok := nv.Value.(driver.Valuer); ok {
		value, err := valuer.Value()
		if err != nil {
			return err
		}
		nv.Value = value
	}
	return nil
}

func (c *conn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	result := c.recorder.answer(Query{SQL: query, Args: plain(args), Kind: "exec", InTx: c.inTx})
	if result.Err != nil {
		return nil, result.Err
	}
	return driver.RowsAffected(result.RowsAffected), nil
}

func (c *conn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	result := c.recorder.answer(Query{SQL: query, Args: plain(args), Kind: "query", InTx: c.inTx})
	if result.Err != nil {
		return nil, result.Err
	}
	return &rows{columns: result.Columns, values: result.Rows}, nil
}

func plain(args []driver.NamedValue) []any {
	out := make([]any, len(args))
	for i, arg := range args {
		out[i] = arg.Value
	}
	return out
}

type tx struct{ conn *conn }

func (t tx) Commit() error {
	t.conn.recorder.record(Query{SQL: "COMMIT", Kind: "exec", InTx: true})
	t.conn.inTx = false
	return nil
}

func (t tx) Rollback() error {
	t.conn.recorder.record(Query{SQL: "ROLLBACK", Kind: "exec", InTx: true})
	t.conn.inTx = false
	return nil
}

type rows struct {
	columns []string
	values  [][]any
	next    int
}

func (r *rows) Columns() []string {
	if r.columns == nil {
		return []string{}
	}
	return r.columns
}

func (r *rows) Close() error { return nil }

func (r *rows) Next(dest []driver.Value) error {
	if r.next >= len(r.values) {
		return io.EOF
	}
	for i, value := range r.values[r.next] {
		dest[i] = value
	}
	r.next++
	return nil
}
