#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
node scripts/build-special-rules.mjs
node scripts/build-cache-busting.mjs
node scripts/build-campionati.mjs
