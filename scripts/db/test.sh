#!/usr/bin/env bash
# Rebuild a clean database and run the database test suite.
#
#   scripts/db/test.sh            # uses $PG_ADMIN_URL or local socket as postgres
#
# Steps: drop/create DB → Supabase stand-ins (local only) → migrations (in
# order) → production seed → pgTAP tests (supabase/tests) → dev fixtures load
# check. With the Supabase CLI available, `supabase db reset && supabase test db`
# covers the first five steps instead.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="${ARENAFIT_TEST_DB:-arenafit_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)
if [[ -n "${PG_ADMIN_URL:-}" ]]; then
  ADMIN=("${PSQL[@]}" "$PG_ADMIN_URL")
  TARGET_URL="${PG_ADMIN_URL%/*}/$DB"
else
  ADMIN=(sudo -u postgres "${PSQL[@]}")
  TARGET_URL=""
fi

run_sql() {  # run_sql <file>
  if [[ -n "$TARGET_URL" ]]; then "${PSQL[@]}" "$TARGET_URL" -f "$1"; else sudo -u postgres "${PSQL[@]}" -d "$DB" < "$1"; fi
}

echo "▸ clean database: $DB"
"${ADMIN[@]}" -c "drop database if exists $DB" -c "create database $DB"

echo "▸ Supabase stand-ins (local only)"
run_sql "$ROOT/scripts/db/supabase-stubs.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "▸ migration $(basename "$f")"
  run_sql "$f"
done

echo "▸ production seed"
run_sql "$ROOT/supabase/seed.sql"

echo "▸ pgTAP"
# Tests run from a readable copy. The staging presentation reset is handed to
# its test as the psql variable :staging_reset (supabase/staging/presentation.sql).
tmp="$(mktemp -d)"; cp "$ROOT"/supabase/tests/*.test.sql "$ROOT/supabase/staging/presentation.sql" "$tmp"
printf '\\set staging_reset `cat %s/presentation.sql`\n' "$tmp" > "$tmp/staging_reset.psql"
chmod -R a+rX "$tmp"
if [[ -n "$TARGET_URL" ]]; then
  pg_prove -d "$TARGET_URL" "$tmp"/*.test.sql
else
  # pg_prove needs to read the test files as the postgres user.
  sudo -u postgres pg_prove -d "$DB" "$tmp"/*.test.sql
fi
rm -rf "$tmp"

echo "▸ dev fixtures load check"
run_sql "$ROOT/supabase/fixtures/dev.sql"
count_sql="select count(*) from public.class_sessions s
  where not exists (select 1 from public.coach_activities ca where ca.coach_id = s.coach_id and ca.activity_id = s.activity_id)"
if [[ -n "$TARGET_URL" ]]; then bad=$("${PSQL[@]}" "$TARGET_URL" -At -c "$count_sql"); else bad=$(sudo -u postgres "${PSQL[@]}" -d "$DB" -At -c "$count_sql"); fi
[[ "$bad" == "0" ]] || { echo "✗ $bad fixture sessions pair a coach with a class they don't teach"; exit 1; }
echo "✓ database tests passed"
