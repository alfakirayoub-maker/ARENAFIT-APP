#!/usr/bin/env bash
# LOCAL TESTING ONLY — a Supabase-like API on http://localhost:54321 without
# the Supabase CLI: PostgreSQL (database arenafit_dev) + GoTrue (real Auth,
# anonymous sign-in enabled) + PostgREST + a small gateway. Rebuilds the
# database from supabase/migrations + seed + dev fixtures and creates two test
# members and two reception stations (one deactivated). Secrets are generated
# into .local-stack/ (git-ignored).
#
# With the Supabase CLI, `supabase start` + `supabase db reset` replaces this
# (enable anonymous sign-ins in supabase/config.toml: [auth] enable_anonymous_sign_ins = true).
#
# Requires: local PostgreSQL 16 (sudo -u postgres), Docker, Node.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE="$ROOT/.local-stack"
mkdir -p "$STATE"
[[ -f "$STATE/jwt-secret" ]] || openssl rand -hex 32 > "$STATE/jwt-secret"
# Keys are minted once and kept, so .env.local stays valid across restarts.
[[ -s "$STATE/anon-key" ]] || node "$ROOT/scripts/local-stack/mint-jwt.mjs" "$STATE" anon > "$STATE/anon-key"
[[ -s "$STATE/service-key" ]] || node "$ROOT/scripts/local-stack/mint-jwt.mjs" "$STATE" service_role > "$STATE/service-key"
[[ -f "$STATE/member-password" ]] || openssl rand -hex 12 > "$STATE/member-password"
SECRET="$(cat "$STATE/jwt-secret")"
P=(sudo -u postgres psql -X -q -v ON_ERROR_STOP=1)

docker rm -f arenafit-postgrest arenafit-gotrue >/dev/null 2>&1 || true
fuser -k 54321/tcp >/dev/null 2>&1 || true

"${P[@]}" <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin login superuser password 'auth';
  end if;
end $$;
drop database if exists arenafit_dev;
create database arenafit_dev;
SQL
"${P[@]}" -d arenafit_dev -c "create schema auth authorization supabase_auth_admin"

echo "▸ GoTrue (Auth)"
docker run -d --name arenafit-gotrue --network host \
  -e GOTRUE_DB_DRIVER=postgres \
  -e DATABASE_URL="postgres://supabase_auth_admin:auth@127.0.0.1:5432/arenafit_dev?search_path=auth" \
  -e GOTRUE_DB_NAMESPACE=auth -e API_EXTERNAL_URL=http://localhost:54321/auth/v1 \
  -e GOTRUE_API_HOST=127.0.0.1 -e PORT=9999 -e GOTRUE_SITE_URL=http://localhost:8081 \
  -e GOTRUE_JWT_SECRET="$SECRET" -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_AUD=authenticated \
  -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated -e GOTRUE_JWT_ADMIN_ROLES=service_role \
  -e GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED=true -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true \
  -e GOTRUE_MAILER_AUTOCONFIRM=true -e GOTRUE_DISABLE_SIGNUP=false \
  -e GOTRUE_RATE_LIMIT_ANONYMOUS_USERS=100000 -e GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS=100000 \
  supabase/gotrue:v2.177.0 >/dev/null
for _ in $(seq 1 60); do curl -sf --noproxy '*' http://127.0.0.1:9999/health >/dev/null && break; sleep 1; done
curl -sf --noproxy '*' http://127.0.0.1:9999/health >/dev/null || { docker logs arenafit-gotrue | tail -20; exit 1; }

echo "▸ schema, seed, dev fixtures"
for f in "$ROOT/scripts/db/supabase-stubs.sql" "$ROOT"/supabase/migrations/*.sql "$ROOT/supabase/seed.sql" "$ROOT/supabase/fixtures/dev.sql"; do
  "${P[@]}" -d arenafit_dev < "$f" 2>&1 | grep -v NOTICE || true
done

echo "▸ PostgREST + gateway"
docker run -d --name arenafit-postgrest --network host \
  -e PGRST_DB_URI="postgres://authenticator:authenticator@127.0.0.1:5432/arenafit_dev" \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$SECRET" -e PGRST_SERVER_PORT=3000 \
  postgrest/postgrest:v12.2.3 >/dev/null
setsid nohup node "$ROOT/scripts/local-stack/gateway.mjs" "$STATE" > "$STATE/gateway.log" 2>&1 < /dev/null &
for _ in $(seq 1 30); do curl -sf --noproxy '*' "http://localhost:54321/rest/v1/coaches?select=slug&limit=1" -H "apikey: $(cat "$STATE/anon-key")" >/dev/null && break; sleep 1; done

echo "▸ test members"
SVC="$(cat "$STATE/service-key")"; PW="$(cat "$STATE/member-password")"
for m in "dev.member@arenafit.local:Ayoub" "test.member2@arenafit.local:Karim"; do
  email="${m%%:*}"; first="${m##*:}"
  curl -s --noproxy '*' -X POST http://localhost:54321/auth/v1/admin/users -H "apikey: $SVC" -H "Authorization: Bearer $SVC" \
    -H 'content-type: application/json' -d "{\"email\":\"$email\",\"password\":\"$PW\",\"email_confirm\":true}" >/dev/null
  "${P[@]}" -d arenafit_dev -c "update public.profiles set kind = 'member', first_name = '$first'
      where id = (select id from auth.users where email = '$email');
    insert into public.memberships (profile_id, plan_name, membership_type, starts_on)
      select id, 'Membre test', 'test', current_date - 30 from auth.users where email = '$email';"
done

echo "▸ reception stations"
station() { # name → qr payload
  curl -s --noproxy '*' -X POST http://localhost:54321/rest/v1/rpc/create_reception_station -H "apikey: $SVC" \
    -H "Authorization: Bearer $SVC" -H 'content-type: application/json' -d "{\"p_name\":\"$1\"}" |
    node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);console.log(j.qr_payload+" "+j.station_id)})'
}
read -r MAIN_QR _ <<<"$(station 'Réception principale')"
read -r OFF_QR OFF_ID <<<"$(station 'Réception test (désactivée)')"
"${P[@]}" -d arenafit_dev -c "select public.set_reception_station_active('$OFF_ID', false)" >/dev/null
echo "$MAIN_QR" > "$STATE/reception-qr"; echo "$OFF_QR" > "$STATE/reception-qr-inactive"
node "$ROOT/scripts/reception/station-qr.mjs" "$MAIN_QR" --name "Réception principale" --out "$STATE/print" >/dev/null

cat <<INFO

✓ local API on http://localhost:54321
  apps/mobile/.env.local:
    EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
    EXPO_PUBLIC_SUPABASE_ANON_KEY=$(cat "$STATE/anon-key")
    EXPO_PUBLIC_DEV_MEMBER_EMAIL=dev.member@arenafit.local
    EXPO_PUBLIC_DEV_MEMBER_PASSWORD=$PW
    EXPO_PUBLIC_DEV_RECEPTION_QR=$MAIN_QR
    EXPO_PUBLIC_DEV_RECEPTION_QR_INACTIVE=$OFF_QR
  printable reception QR (local): .local-stack/print/reception-principale-a5.svg / -a6.svg
  integration tests (apps/mobile):
    SUPABASE_TEST_URL=http://localhost:54321 SUPABASE_TEST_ANON_KEY=\$(cat .local-stack/anon-key) \\
    SUPABASE_TEST_SERVICE_KEY=\$(cat .local-stack/service-key) npm test
INFO
