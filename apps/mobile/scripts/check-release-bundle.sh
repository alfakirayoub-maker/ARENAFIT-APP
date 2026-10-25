#!/usr/bin/env bash
# Builds the production JS bundles (Android + iOS) and fails if development
# fixtures, the mock member or a service-role key ended up inside.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

CI=1 npx expo export --platform android --platform ios --output-dir "$OUT" >/dev/null

# Strings that only exist in src/dev/fixtures (mock data) or in secrets.
FORBIDDEN=("challenge-novembre" "Yassine" "Arena Premium" "buildFixtureSessions" "Renforcement musculaire" "service_role")
# Sanity check that the scan sees app strings at all.
REQUIRED=("Me le rappeler")

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
  [[ $status -eq 0 ]] && echo "✓ $platform release bundle: no fixtures, no mock member, no service-role key"
done
exit $status
