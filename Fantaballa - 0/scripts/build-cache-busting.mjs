#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearHashCache, updateVersionedFile, versionLocalUrls } from './lib/cache-busting.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const dependenciesOnly = process.argv.includes('--dependencies-only');
let stale = false;

// Prima i file che contengono URL verso dipendenze: cambiando i loro URL cambia anche
// il contenuto del file, quindi vanno stabilizzati prima che le pagine ne calcolino l'hash.
const dependencyFiles = [
  'site.webmanifest',
  'assets/season-config-community.js',
  'assets/season-config-real.js'
];

for (const relative of dependencyFiles) {
  const path = resolve(ROOT, relative);
  const result = await updateVersionedFile(path, { root: ROOT, checkOnly });
  if (result.stale) {
    console.error(`✗ cache-busting non aggiornato: ${relative}`);
    stale = true;
  } else if (result.changed) {
    console.log(`✓ aggiornati hash dipendenze: ${relative}`);
  } else {
    console.log(`✓ hash dipendenze OK: ${relative}`);
  }
}

if (!dependenciesOnly) {
  clearHashCache();
  const entries = await readdir(ROOT, { withFileTypes: true });
  const htmlFiles = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
    .map(entry => entry.name)
    .filter(name => name !== 'campionato.html' && name !== 'campionato-real.html');

  for (const relative of htmlFiles) {
    const path = resolve(ROOT, relative);
    const current = await readFile(path, 'utf8');
    const expected = await versionLocalUrls(current, { root: ROOT });
    if (current === expected) {
      console.log(`✓ cache-busting OK: ${relative}`);
      continue;
    }
    if (checkOnly) {
      console.error(`✗ cache-busting non aggiornato: ${relative}`);
      stale = true;
    } else {
      await writeFile(path, expected, 'utf8');
      console.log(`✓ aggiornato cache-busting: ${relative}`);
    }
  }
}

if (stale) process.exitCode = 1;
