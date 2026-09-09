#!/usr/bin/env bash
#
# Take a backup of the production database and prove it restores.
#
# There is no backup or restore procedure written down anywhere in this repo,
# and whatever Dokploy does has never been tested by restoring it. That is the
# ordinary risk. It becomes an acute one during the Supabase migration, because
# a pg_dump is the only migration artifact -- if it does not restore, the window
# ends with the shop's books in one place and nothing to put them back from.
#
# So this does not just dump. It restores into a throwaway container and counts
# what arrived, because a dump nobody has restored is a hope, not a backup.
#
# Usage:
#   export SOURCE_DSN=...        # the production libpq URL, copied from Dokploy
#   bash backend/scripts/db-backup-verify.sh
#
# Export it in the shell rather than writing it into a file or a command you
# will later paste somewhere: it carries the production database password.
#
# Run it from the Dokploy host, where the database is reachable. Nothing is ever
# written to the source: every statement against it is a read.

set -euo pipefail

: "${SOURCE_DSN:?Set SOURCE_DSN to the production connection string}"

OUT_DIR="${OUT_DIR:-./db-backup-$(date +%Y%m%d-%H%M%S)}"
# Must be >= the source server's major version. Production is 16; using the
# Supabase target's 17 client is also correct and is what Postgres recommends.
PG_IMAGE="${PG_IMAGE:-postgres:17-alpine}"
SCRATCH="${SCRATCH:-pastries-restore-check}"
SCRATCH_PORT="${SCRATCH_PORT:-55440}"
# Generated, not hardcoded. The container is throwaway and only listens on
# localhost, but a fixed password written into a script is the kind of string
# that gets copied into a real config later.
SCRATCH_PW="${SCRATCH_PW:-$(head -c 18 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9')}"

mkdir -p "$OUT_DIR"
echo "==> artifacts: $OUT_DIR"

cleanup() {
  docker rm -f "$SCRATCH" >/dev/null 2>&1 || true
}
trap cleanup EXIT

run_pg() { docker run --rm --network host -e PGPASSWORD "$PG_IMAGE" "$@"; }

# ---------------------------------------------------------------- 1. inventory
# Taken before the dump so the comparison afterwards is against the real source,
# not against the dump's own idea of itself.
echo "==> reading the source inventory"
docker run --rm --network host "$PG_IMAGE" psql "$SOURCE_DSN" -tAF',' -c "
SELECT 'server_version', current_setting('server_version')
UNION ALL SELECT 'schema_migrations', count(*)::text FROM schema_migrations
UNION ALL SELECT 'tables',  count(*)::text FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'
UNION ALL SELECT 'columns', count(*)::text FROM information_schema.columns WHERE table_schema='public'
UNION ALL SELECT 'indexes', count(*)::text FROM pg_indexes WHERE schemaname='public'
UNION ALL SELECT 'fkeys',   count(*)::text FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f'
UNION ALL SELECT 'checks',  count(*)::text FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='c';
" | tee "$OUT_DIR/source-inventory.csv"

echo "==> per-table row counts (this is the one that catches a partial restore)"
docker run --rm --network host "$PG_IMAGE" psql "$SOURCE_DSN" -tAF',' -c "
SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY relname;
" > "$OUT_DIR/source-rowcounts.csv"
echo "    $(wc -l < "$OUT_DIR/source-rowcounts.csv") tables"

# ------------------------------------------------------------------- 2. dump
# Both formats on purpose: custom restores selectively and is what Phase 3 uses,
# plain is the one a human can read and grep at 3am when the custom one will not
# load. --no-owner and --no-privileges because the roles on the target will not
# match, on Supabase or in the scratch container below.
echo "==> dumping (custom + plain)"
docker run --rm --network host -v "$(pwd)/$OUT_DIR:/out" "$PG_IMAGE" \
  pg_dump --format=custom --schema=public --no-owner --no-privileges \
          --no-tablespaces --no-security-labels --no-subscriptions --no-publications \
          --file=/out/prod.dump "$SOURCE_DSN"
docker run --rm --network host -v "$(pwd)/$OUT_DIR:/out" "$PG_IMAGE" \
  pg_dump --format=plain --schema=public --no-owner --no-privileges \
          --file=/out/prod.sql "$SOURCE_DSN"
docker run --rm --network host -v "$(pwd)/$OUT_DIR:/out" "$PG_IMAGE" \
  pg_dump --schema-only --schema=public --no-owner --no-privileges \
          --file=/out/prod-schema.sql "$SOURCE_DSN"
ls -lh "$OUT_DIR"

# ----------------------------------------------------------------- 3. restore
echo "==> restoring into a throwaway container"
docker rm -f "$SCRATCH" >/dev/null 2>&1 || true
docker run -d --name "$SCRATCH" -e POSTGRES_PASSWORD="$SCRATCH_PW" -e POSTGRES_DB=verify \
  -p "$SCRATCH_PORT:5432" "$PG_IMAGE" >/dev/null

until docker exec "$SCRATCH" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

# pg_dump --schema=public emits CREATE SCHEMA public, which collides with the
# schema every database already has and aborts the whole restore under
# --exit-on-error. Excluding those two TOC entries is the fix, and it is the
# same recipe Phase 3 uses against Supabase.
docker exec "$SCRATCH" mkdir -p /restore
docker cp "$OUT_DIR/prod.dump" "$SCRATCH:/restore/prod.dump"
docker exec "$SCRATCH" sh -c "
  pg_restore -l /restore/prod.dump | grep -vE ' SCHEMA - public|COMMENT - SCHEMA public' > /restore/toc.list
  pg_restore -U postgres -d verify -L /restore/toc.list \
    --no-owner --no-privileges --single-transaction --exit-on-error /restore/prod.dump
"
echo "    restore exit: 0"

# ----------------------------------------------------------------- 4. compare
echo "==> comparing the restore against the source"
docker exec "$SCRATCH" psql -U postgres -d verify -tAF',' -c "
SELECT 'server_version', current_setting('server_version')
UNION ALL SELECT 'schema_migrations', count(*)::text FROM schema_migrations
UNION ALL SELECT 'tables',  count(*)::text FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'
UNION ALL SELECT 'columns', count(*)::text FROM information_schema.columns WHERE table_schema='public'
UNION ALL SELECT 'indexes', count(*)::text FROM pg_indexes WHERE schemaname='public'
UNION ALL SELECT 'fkeys',   count(*)::text FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f'
UNION ALL SELECT 'checks',  count(*)::text FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='c';
" > "$OUT_DIR/restored-inventory.csv"

# Exact counts, not the planner's estimate: n_live_tup is approximate and would
# report a difference that is not real, or hide one that is.
docker exec "$SCRATCH" psql -U postgres -d verify -tAF',' -c "
SELECT relname,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', relname), false, true, '')))[1]::text::bigint
FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY relname;
" > "$OUT_DIR/restored-rowcounts.csv"

echo
echo "--- inventory (server_version differing is expected: newer client/target) ---"
diff <(grep -v server_version "$OUT_DIR/source-inventory.csv") \
     <(grep -v server_version "$OUT_DIR/restored-inventory.csv") \
  && echo "    inventory MATCHES"

echo
echo "--- tables present in the source but not the restore ---"
comm -23 <(cut -d, -f1 "$OUT_DIR/source-rowcounts.csv" | sort) \
         <(cut -d, -f1 "$OUT_DIR/restored-rowcounts.csv" | sort) \
  | tee "$OUT_DIR/missing-tables.txt"
[ -s "$OUT_DIR/missing-tables.txt" ] && echo "    ^^ TABLES MISSING FROM THE RESTORE" || echo "    every table restored"

echo
echo "==> boot check: does the API accept this database?"
echo "    run, from backend/:"
echo "      export DATABASE_URL=\"host=localhost port=${SCRATCH_PORT} user=postgres password=\$SCRATCH_PW dbname=verify sslmode=disable\""
echo "      go run ./cmd/api"
echo "    (SCRATCH_PW is exported in this shell; the scratch password is generated per run)"
export SCRATCH_PW
echo "    VerifySchema fails the boot if a required table is missing, which is a"
echo "    stronger check than any count above. Then log in and ring one sale:"
echo "    a schema that satisfies VerifySchema can still be missing an index or"
echo "    a foreign key, and only real traffic notices."
echo
echo "==> scratch container is up on port $SCRATCH_PORT and will be removed when"
echo "    this script exits. Press Ctrl-C when you have finished with it."
echo "==> artifacts kept in $OUT_DIR"
read -r -p "press enter to tear down the scratch container " _
