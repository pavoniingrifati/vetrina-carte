#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
node scripts/build-special-rules.mjs --check
node scripts/build-cache-busting.mjs --check
node scripts/build-campionati.mjs --check
node scripts/check-gameplay-fixes.mjs
node --check scripts/build-cache-busting.mjs >/dev/null
node --check scripts/lib/cache-busting.mjs >/dev/null
for f in assets/season/rules/*.js; do node --check "$f" >/dev/null; done
echo "Tutti i controlli del refactor sono OK."
