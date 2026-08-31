#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
node scripts/build-campionati.mjs
