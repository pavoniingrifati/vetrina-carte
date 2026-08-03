#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
rm -f \
  tricolore-pisa.html \
  sfida-settimana.html \
  assets/weekly-leaderboard.js \
  assets/season-config-weekly-pisa.js \
  assets/season/weekly-pisa-mode.js \
  data/classifica-settimana.json \
  data/club-weekly-pisa.json \
  assets/macro-modes/tricolore-pisa.webp
printf '%s\n' 'Patch Direttore Sportivo applicata.'
