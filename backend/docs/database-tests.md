# Database-backed tests

Most of this repository's tests are pure unit tests. A handful need a real
Postgres, and those live behind `internal/testsupport/testdb`.

## Why they exist

Two runtime-fatal bugs shipped with every suite green, because nothing in the
suite ran SQL:

- migration `000106` inserted into a table that does not exist, which aborts
  the migrator and stops the backend booting;
- the year-end close built `"<branch>-FY2025"` as the key for a `uuid` column,
  so every close would have failed.

Three things cannot be checked without a database, and all three have already
cost something or nearly did:

1. **Migrations.** They otherwise run only at boot.
2. **Column types and constraints.** A Go type that disagrees with its column
   compiles fine.
3. **GORM's routing of `sql.Scanner` / `driver.Valuer`.** This decides whether
   a `money.Amount` reads back as its value or as zero, and it is why the
   float64 → decimal migration could not proceed without a harness.

## Running them

They run as part of `go test ./...`. When no database is reachable they
**skip**, with a message saying so:

```
go test ./...
```

To require them — in CI, or when you want to be sure they actually ran:

```
REQUIRE_DB_TESTS=1 go test ./...
```

That turns "no database available" from a skip into a failure.

## Configuration

Credentials come from the same `POSTGRES_*` variables (or `DATABASE_URL`) the
application uses, read from `backend/.env` if present, so a working dev setup
needs no extra configuration.

| Variable | Meaning |
|---|---|
| `TEST_POSTGRES_DB` | test database name (default `pastries_pos_test`) |
| `TEST_DATABASE_URL` | full DSN, used verbatim; overrides the above |
| `REQUIRE_DB_TESTS=1` | make an unavailable database a failure, not a skip |

The test database is created automatically if missing, and the full migration
set is applied to it once per run.

## Safety

These tests write to real tables, so the harness **refuses to connect to any
database whose name does not end in `_test`**. The check runs before anything
connects to the target or applies a migration to it, so a misconfiguration is
contained rather than merely reported. It is not configurable, and it is why
the database name is never inherited from the application's `POSTGRES_DB`.

There is a matching live assertion: the tests verify `current_database()` ends
in `_test` against the connection they actually hold.

## Writing one

`testdb.Tx(t)` hands back a database bound to a transaction that is rolled
back when the test ends, so tests neither see nor leave each other's rows.
Code under test that opens its own transaction still works — GORM nests it as
a savepoint.

```go
func TestSomething(t *testing.T) {
    db := testdb.Tx(t)
    // ... use db
}
```

Use `testdb.Connect(t)` only when the test genuinely needs to commit.

Foreign keys make seeding the fiddly part; `seedBranch` in
`internal/testsupport/testdb/helpers_test.go` sets up the business, branch,
user and chart accounts most rows need.
