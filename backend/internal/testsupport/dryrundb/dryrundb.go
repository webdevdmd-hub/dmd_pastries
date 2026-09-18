// Package dryrundb drives service methods with no database at all.
//
// gorm's DryRun mode builds every statement and runs none. That is enough to
// read what one repository call would send (see the ISSUE-063 and ISSUE-064
// tests), but not to drive a service method: those open their own
// transaction, which needs a connection, and they branch on what their
// queries return, which DryRun never produces.
//
// Open closes both gaps. Begin, Commit and Rollback succeed without a
// connection, every statement gorm builds is recorded, and a Responder the
// test supplies answers each one the way the database would have: it fills
// the destination and sets RowsAffected. A test can then say "this account
// has one journal line" and assert what the service does next, including
// what it never wrote.
//
// It is a stand-in for the database, not a model of one. The Responder is
// the whole of the data, so keep each test's answers small and explicit.
// Where real SQL semantics matter (constraints, migrations, types), use
// internal/testsupport/testdb.
package dryrundb

import (
	"context"
	"database/sql"
	"errors"
	"reflect"
	"strings"
	"sync"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Kind is which gorm callback chain built a statement.
type Kind string

const (
	Query  Kind = "query"
	Row    Kind = "row"
	Create Kind = "create"
	Update Kind = "update"
	Delete Kind = "delete"
	Raw    Kind = "raw"
)

// Statement is one statement gorm built.
type Statement struct {
	Kind  Kind
	Table string
	SQL   string
	Vars  []any
}

// Where returns the statement's WHERE clause, or "" when it has none.
func (s Statement) Where() string {
	index := strings.Index(s.SQL, " WHERE ")
	if index < 0 {
		return ""
	}
	return s.SQL[index+len(" WHERE "):]
}

// IsWrite reports whether the statement changes rows.
func (s Statement) IsWrite() bool {
	return s.Kind == Create || s.Kind == Update || s.Kind == Delete
}

// Responder answers a statement as the database would have. It may fill
// db.Statement.Dest and must set db.RowsAffected for anything it answers:
// a First or Take nobody answers fails with gorm.ErrRecordNotFound, and an
// Update nobody answers matched no rows, exactly as against a real table.
type Responder func(stmt Statement, db *gorm.DB)

// Recorder is what the service did.
type Recorder struct {
	mu         sync.Mutex
	statements []Statement
	commits    int
	rollbacks  int
}

// Statements returns every statement built so far, in order.
func (r *Recorder) Statements() []Statement {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]Statement(nil), r.statements...)
}

// Writes returns the create, update and delete statements against table.
func (r *Recorder) Writes(table string) []Statement {
	var writes []Statement
	for _, stmt := range r.Statements() {
		if stmt.IsWrite() && stmt.Table == table {
			writes = append(writes, stmt)
		}
	}
	return writes
}

// Commits returns how many transactions were committed.
func (r *Recorder) Commits() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.commits
}

// Rollbacks returns how many transactions were rolled back.
func (r *Recorder) Rollbacks() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.rollbacks
}

// Open returns a gorm handle backed by no database, and the recorder that
// sees everything run through it.
func Open(t testing.TB, respond Responder) (*gorm.DB, *Recorder) {
	t.Helper()
	recorder := &Recorder{}
	db, err := gorm.Open(postgres.New(postgres.Config{Conn: &pool{recorder: recorder}}), &gorm.Config{
		DryRun:                 true,
		DisableAutomaticPing:   true,
		SkipDefaultTransaction: true,
		Logger:                 logger.Discard,
	})
	if err != nil {
		t.Fatalf("dryrundb: open: %v", err)
	}

	capture := func(kind Kind) func(*gorm.DB) {
		return func(tx *gorm.DB) {
			if tx.Error != nil {
				return
			}
			stmt := Statement{
				Kind:  kind,
				Table: tx.Statement.Table,
				SQL:   tx.Statement.SQL.String(),
				Vars:  append([]any(nil), tx.Statement.Vars...),
			}
			recorder.mu.Lock()
			recorder.statements = append(recorder.statements, stmt)
			recorder.mu.Unlock()
			if respond != nil {
				respond(stmt, tx)
			}
			if kind == Query && tx.Statement.RaiseErrorOnNotFound && tx.RowsAffected == 0 {
				_ = tx.AddError(gorm.ErrRecordNotFound)
			}
		}
	}
	callbacks := db.Callback()
	for _, err := range []error{
		callbacks.Query().After("gorm:query").Register("dryrundb:query", capture(Query)),
		callbacks.Row().After("gorm:row").Register("dryrundb:row", capture(Row)),
		callbacks.Create().After("gorm:create").Register("dryrundb:create", capture(Create)),
		callbacks.Update().After("gorm:update").Register("dryrundb:update", capture(Update)),
		callbacks.Delete().After("gorm:delete").Register("dryrundb:delete", capture(Delete)),
		callbacks.Raw().After("gorm:raw").Register("dryrundb:raw", capture(Raw)),
	} {
		if err != nil {
			t.Fatalf("dryrundb: register callback: %v", err)
		}
	}
	return db, recorder
}

// SetCount answers a Count query with n.
func SetCount(db *gorm.DB, n int64) {
	if dest, ok := db.Statement.Dest.(*int64); ok {
		*dest = n
	}
	db.RowsAffected = n
}

// Fill answers a First, Take or Find into a struct with value, which must be
// the destination's own type.
func Fill(db *gorm.DB, value any) {
	dest := reflect.ValueOf(db.Statement.Dest)
	source := reflect.ValueOf(value)
	if dest.Kind() != reflect.Pointer || dest.Elem().Type() != source.Type() {
		_ = db.AddError(errors.New("dryrundb: Fill: destination is " + dest.Type().String() + ", value is " + source.Type().String()))
		return
	}
	dest.Elem().Set(source)
	db.RowsAffected = 1
}

// Matched answers an Update or Delete as having changed n rows.
func Matched(db *gorm.DB, n int64) {
	db.RowsAffected = n
}

var errNoDatabase = errors.New("dryrundb: there is no database; this statement should never have executed")

// pool is a connection that can begin a transaction and do nothing else.
// DryRun keeps gorm from ever asking it to run a statement.
type pool struct {
	recorder *Recorder
}

func (p *pool) PrepareContext(context.Context, string) (*sql.Stmt, error) {
	return nil, errNoDatabase
}

func (p *pool) ExecContext(context.Context, string, ...any) (sql.Result, error) {
	return nil, errNoDatabase
}

func (p *pool) QueryContext(context.Context, string, ...any) (*sql.Rows, error) {
	return nil, errNoDatabase
}

func (p *pool) QueryRowContext(context.Context, string, ...any) *sql.Row {
	return nil
}

// BeginTx satisfies gorm.ConnPoolBeginner, which is what lets db.Begin()
// succeed with no connection behind it.
func (p *pool) BeginTx(context.Context, *sql.TxOptions) (gorm.ConnPool, error) {
	return &transaction{pool: p}, nil
}

type transaction struct {
	*pool
}

func (t *transaction) Commit() error {
	t.recorder.mu.Lock()
	defer t.recorder.mu.Unlock()
	t.recorder.commits++
	return nil
}

func (t *transaction) Rollback() error {
	t.recorder.mu.Lock()
	defer t.recorder.mu.Unlock()
	t.recorder.rollbacks++
	return nil
}
