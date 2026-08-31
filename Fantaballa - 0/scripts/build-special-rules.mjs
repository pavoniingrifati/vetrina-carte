#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RULES_DIR = resolve(ROOT, 'assets/season/rules');
const LEGACY_OUTPUT = resolve(ROOT, 'assets/season/08-special-rules.js');

// Ordine volutamente identico al vecchio 08-special-rules.js.
// Non riordinare i moduli senza una verifica funzionale completa.
const modules = [
  '01-roster-and-creators.js',
  '02-federation-and-playoffs.js',
  '03-competition-formats.js',
  '04-special-events.js',
  '05-tactics-and-modifiers.js',
  '06-crossover-and-curva.js',
  '07-shared-regulations.js'
];

const chunks = await Promise.all(modules.map(name => readFile(resolve(RULES_DIR, name), 'utf8')));
const generated = chunks.join('');
const checkOnly = process.argv.includes('--check');

if (checkOnly) {
  let current = '';
  try { current = await readFile(LEGACY_OUTPUT, 'utf8'); } catch {}
  if (current !== generated) {
    console.error('✗ assets/season/08-special-rules.js non è sincronizzato con assets/season/rules/*.js');
    process.exitCode = 1;
  } else {
    console.log('✓ 08-special-rules.js sincronizzato con i moduli tematici');
  }
} else {
  await writeFile(LEGACY_OUTPUT, generated, 'utf8');
  console.log(`✓ generato 08-special-rules.js legacy da ${modules.length} moduli`);
}
