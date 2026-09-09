#!/usr/bin/env bash
#
# Does production's schema match what the migrations produce?
#
# There is reason to doubt it. The migration runner records a checksum for every
# file and never verifies one, there are no down-migrations, and there is no CI.
# Any hotfix applied straight to production over the past 107 migrations is
# invisible and would be silently dropped by a rebuild -- or, worse, would make
# a restore fail halfway through the window.
#
# This builds the schema the migrations produce, in a throwaway container, and
# diffs it against a schema-only dump of production.
#
# Usage:
#   bash backend/scripts/db-schema-drift.sh path/to/prod-schema.sql
#
# Get that file from db-backup-verify.sh, which writes it as prod-schema.sql,
# or directly:
#   pg_dump --schema-only --schema=public --no-owner --no-privileges "$SOURCE_DSN"
#
# Nothing here touches production: it reads one file.

set -euo pipefail

PROD_SCHEMA="${1:?Usage: db-schema-drift.sh path/to/prod-schema.sql}"
[ -f "$PROD_SCHEMA" ] || { echo "no such file: $PROD_SCHEMA" >&2; exit 1; }

# Match production's major version, not the migration target's. The question is
# whether prod matches the migrations, and a different major would introduce
# formatting differences that look like drift and are not.
PG_IMAGE="${PG_IMAGE:-postgres:16-alpine}"
SCRATCH="${SCRATCH:-pastries-drift-ref}"
MIGRATIONS="${MIGRATIONS:-migrations}"
OUT_DIR="${OUT_DIR:-./db-drift-$(date +%Y%m%d-%H%M%S)}"
SCRATCH_PORT="${SCRATCH_PORT:-55441}"
# Generated per run rather than hardcoded: a fixed password written into a
# script is the kind of string that gets copied into a real config later.
SCRATCH_PW="${SCRATCH_PW:-$(head -c 18 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9')}"

[ -d "$MIGRATIONS" ] || { echo "run this from backend/, or set MIGRATIONS" >&2; exit 1; }

mkdir -p "$OUT_DIR"
cleanup() { docker rm -f "$SCRATCH" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> building the reference schema from $(ls "$MIGRATIONS"/*.sql | wc -l) migrations"
docker rm -f "$SCRATCH" >/dev/null 2>&1 || true
docker run -d --name "$SCRATCH" -e POSTGRES_PASSWORD="$SCRATCH_PW" -e POSTGRES_DB=drift_ref \
  -p "$SCRATCH_PORT:5432" "$PG_IMAGE" >/dev/null
until docker exec "$SCRATCH" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

# The repo's own runner, not a reimplementation: the question is what THIS
# migrator produces, including any ordering or idempotency quirk it has.
# libpq key=value rather than a URL. Same thing to pgx, and it is the form
# config.PostgresDSN() already builds -- but it also keeps the password out of a
# "user:pass@host" shape, which is what a secret scanner matches on and what a
# human copies without thinking.
DATABASE_URL="host=localhost port=${SCRATCH_PORT} user=postgres password=${SCRATCH_PW} dbname=drift_ref sslmode=disable" \
  MIGRATIONS_PATH="$MIGRATIONS" go run ./cmd/migrate | tail -1

docker exec "$SCRATCH" pg_dump -U postgres -d drift_ref \
  --schema-only --schema=public --no-owner --no-privileges > "$OUT_DIR/reference-schema.sql"

# Normalise away everything that differs for reasons that are not drift: dump
# header comments, the server version banner, blank lines, and SET statements
# whose ordering is not stable between runs.
normalise() {
  grep -vE '^--|^$|^SET |^SELECT pg_catalog\.set_config' "$1" \
    | sed -E 's/[[:space:]]+$//' \
    | sort
}

normalise "$OUT_DIR/reference-schema.sql" > "$OUT_DIR/reference.normalised"
normalise "$PROD_SCHEMA"                  > "$OUT_DIR/production.normalised"

echo
echo "==> lines only in PRODUCTION (undocumented hotfixes -- these would be lost)"
comm -13 "$OUT_DIR/reference.normalised" "$OUT_DIR/production.normalised" \
  | tee "$OUT_DIR/only-in-production.sql" | head -40
echo "    total: $(wc -l < "$OUT_DIR/only-in-production.sql")"

echo
echo "==> lines only in the MIGRATIONS (never applied to production)"
comm -23 "$OUT_DIR/reference.normalised" "$OUT_DIR/production.normalised" \
  | tee "$OUT_DIR/only-in-migrations.sql" | head -40
echo "    total: $(wc -l < "$OUT_DIR/only-in-migrations.sql")"

echo
if [ ! -s "$OUT_DIR/only-in-production.sql" ] && [ ! -s "$OUT_DIR/only-in-migrations.sql" ]; then
  echo "==> NO DRIFT. Production is exactly what the migrations produce."
else
  echo "==> DRIFT FOUND. Every line above needs an explanation before the window."
  echo "    A line only in production is a change nobody wrote down. Decide"
  echo "    whether it becomes migration 000111 or gets dropped deliberately --"
  echo "    do not discover it mid-restore."
fi
echo
echo "==> artifacts in $OUT_DIR"
