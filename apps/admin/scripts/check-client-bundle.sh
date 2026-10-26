#!/usr/bin/env bash
# Builds the dashboard for production and fails if anything that must stay
# server-side or local ended up in what the browser downloads (client JS/CSS
# chunks and prerendered HTML): the service-role key, raw station QR payloads
# or tokens, staff/member/test credentials, Branch test keys.
set -euo pipefail
cd "$(dirname "$0")/.."

npx next build >/dev/null

FORBIDDEN=(
  "service_role" "SERVICE_ROLE" "SUPABASE_SERVICE" "SUPABASE_TEST_" "key_test_"   # server key names, test env, Branch test key
  "arenafit.local" "arenafit.test" "staff-password" "member-password"             # local staff/test accounts
  "AF-NOT-A-RECEPTION-QR"                                                         # dev scan fixtures
)
# Actual secret values when present on this machine (never committed).
if [[ -d ../../.local-stack ]]; then
  for f in service-key jwt-secret staff-password member-password reception-qr reception-qr-inactive; do
    p="../../.local-stack/$f"
    [[ -s "$p" ]] || continue
    FORBIDDEN+=("$(cat "$p")")
    [[ "$f" == reception-qr* ]] && FORBIDDEN+=("$(cut -c6- "$p")")
  done
fi
for v in "${SUPABASE_TEST_SERVICE_KEY:-}" "${SUPABASE_SERVICE_ROLE_KEY:-}"; do [[ -n "$v" ]] && FORBIDDEN+=("$v"); done

FILES=()
while IFS= read -r -d '' f; do FILES+=("$f"); done < <(find .next/static .next/server/app -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.rsc' \) -print0)
[[ ${#FILES[@]} -gt 0 ]] || { echo "✗ no client output found"; exit 1; }

status=0
# Sanity check that the scan sees dashboard code at all.
for s in "Cours aujourd" "QR cessera immédiatement de fonctionner"; do
  grep -qF "$s" "${FILES[@]}" || { echo "✗ expected string missing: $s"; status=1; }
done
for s in "${FORBIDDEN[@]}"; do
  if hits="$(grep -lF -- "$s" "${FILES[@]}")"; then
    echo "✗ forbidden string in client output (${s:0:12}…): $hits"
    status=1
  fi
done
[[ $status -eq 0 ]] && echo "✓ dashboard client output (${#FILES[@]} files): no service-role key, no station QR payloads or tokens, no staff/member/test credentials, no mock secrets"
exit $status
