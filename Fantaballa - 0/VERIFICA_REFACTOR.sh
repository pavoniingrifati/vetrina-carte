#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
node scripts/build-champions-data.mjs --check
node scripts/build-special-rules.mjs --check
node scripts/build-cache-busting.mjs --check
node scripts/build-campionati.mjs --check
node scripts/check-gameplay-fixes.mjs
node scripts/check-champions-mode.mjs
node scripts/check-champions-positions.mjs
node scripts/check-player-database-champions.mjs
node --check scripts/build-champions-data.mjs >/dev/null
node --check scripts/check-champions-mode.mjs >/dev/null
node --check scripts/check-champions-positions.mjs >/dev/null
node --check scripts/check-player-database-champions.mjs >/dev/null
node --check scripts/build-cache-busting.mjs >/dev/null
node --check scripts/lib/cache-busting.mjs >/dev/null
for f in assets/season/*.js assets/season/rules/*.js; do node --check "$f" >/dev/null; done
echo "Tutti i controlli del refactor e della Champions sono OK."
