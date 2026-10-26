#!/usr/bin/env bash
# Builds the production JS bundles (Android + iOS) and fails if development
# fixtures, the demo/test member, dev credentials, test tokens, Branch test
# keys or a service-role key ended up inside.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

# Canary staging credentials: with the staging flag off they must not reach the
# bundle (proves the staging demo sign-in module is dropped, not just renamed).
CANARY_EMAIL="staging-canary-$RANDOM@invalid.test"; CANARY_PASSWORD="canary-$RANDOM$RANDOM"
EXPO_PUBLIC_STAGING_DEMO_SIGNIN= EXPO_PUBLIC_STAGING_MEMBER_EMAIL="$CANARY_EMAIL" EXPO_PUBLIC_STAGING_MEMBER_PASSWORD="$CANARY_PASSWORD" \
  CI=1 npx expo export --platform android --platform ios --output-dir "$OUT" >/dev/null

# Strings that only exist in src/dev (fixtures, demo member), the dev session
# provider, tests, or secrets.
FORBIDDEN=(
  "challenge-novembre" "Yassine" "Arena Premium" "buildFixtureSessions" "Renforcement musculaire"   # dev fixtures
  "createDevAuthProvider" "arenafit:dev-demo-member" "EXPO_PUBLIC_DEV_MEMBER" "arenafit.local"      # dev/test member
  "AF-NOT-A-RECEPTION-QR" "example.com/promo" "EXPO_PUBLIC_DEV_RECEPTION_QR" "Simulation scanner" "Réseau coupé"                         # dev scan simulator
  "service_role" "key_test_"                                                                        # server key, Branch test key
  "$CANARY_EMAIL" "$CANARY_PASSWORD"                                                                # staging demo sign-in (preview builds only)
  "q3Jx8Yb2mN0pQrStUvWxYz"                                                                          # raw test token (tests/)
)
# Actual secret values when present on this machine (never committed): dev
# credentials, local station QR payloads (raw station tokens), test service key.
if [[ -d ../../.local-stack ]]; then
  for f in ../../.local-stack/reception-qr ../../.local-stack/reception-qr-inactive ../../.local-stack/member-password ../../.local-stack/service-key; do
    [[ -s "$f" ]] && FORBIDDEN+=("$(cat "$f")") && [[ "$f" == *reception-qr* ]] && FORBIDDEN+=("$(cut -c6- "$f")")
  done
fi
for v in "${EXPO_PUBLIC_DEV_MEMBER_PASSWORD:-}" "${SUPABASE_TEST_SERVICE_KEY:-}"; do [[ -n "$v" ]] && FORBIDDEN+=("$v"); done
if [[ -f .env.local ]]; then
  for var in EXPO_PUBLIC_DEV_MEMBER_PASSWORD EXPO_PUBLIC_DEV_RECEPTION_QR EXPO_PUBLIC_DEV_RECEPTION_QR_INACTIVE; do
    v="$(sed -n "s/^$var=//p" .env.local)"
    [[ -n "$v" ]] && FORBIDDEN+=("$v")
  done
fi
# Sanity check that the scan sees app strings at all.
REQUIRED=("Me le rappeler" "Activer mon Pass" "Scanner le QR")

status=0
for bundle in "$OUT"/_expo/static/js/*/entry-*; do
  platform="$(basename "$(dirname "$bundle")")"
  text="$(strings -n 6 "$bundle")"
  for s in "${REQUIRED[@]}"; do
    grep -qF "$s" <<<"$text" || { echo "✗ $platform: expected string missing: $s"; status=1; }
  done
  for s in "${FORBIDDEN[@]}"; do
    if grep -qF "$s" <<<"$text"; then echo "✗ $platform: forbidden string in release bundle: $s"; status=1; fi
  done
  [[ $status -eq 0 ]] && echo "✓ $platform release bundle: no fixtures, no demo/test member or dev credentials, no dev reception QR, no test tokens, no Branch test key, no service-role key, no staging demo sign-in"
done
exit $status
