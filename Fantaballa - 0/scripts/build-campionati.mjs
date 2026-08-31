#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_PATH = resolve(ROOT, 'src/campionato.template.html');

const variants = {
  community: {
    output: 'campionato.html',
    values: {
      BACKGROUND_IMAGE: 'assets/macro-modes/season-bg.webp',
      PAGE_TITLE: 'Campionato di 0-0-0 – Roguelike sul calcio | Fantaballa',
      PAGE_DESCRIPTION: 'Gioca al Campionato di 0-0-0: crea la rosa con il draft, scegli un allenatore e affronta una stagione calcistica roguelike con eventi e decisioni casuali.',
      CANONICAL_URL: 'https://fantaballa.it/Fantaballa%20-%200/campionato.html',
      HERO_DESKTOP_POSITION: 'right center',
      HERO_MIN_HEIGHT: '238px',
      HERO_MOBILE_POSITION: 'center',
      BODY_CLASS: 'page-season',
      BRAND_TITLE: 'Campionato del Ca***',
      HEADER_META_ID: '',
      HEADER_META: 'Una stagione · 38 giornate · Regole Gary MEDel',
      HERO_TEXT_ID: '',
      HERO_TEXT: 'Draft iniziale, 11 titolari e 3 panchinari. Posizioni precise, infortuni, squalifiche, eventi e decisioni casuali. Dopo la giornata 19 il draft permette da 1 a 3 cambi, in base agli eventi della stagione.',
      CONFIG_SCRIPT: 'assets/season-config-community.js?v=20260722-1'
    }
  },
  real: {
    output: 'campionato-real.html',
    values: {
      BACKGROUND_IMAGE: 'assets/macro-modes/fantacampionato-real-bg.webp',
      PAGE_TITLE: 'Fantacampionato di 0-0-0 | Fantaballa',
      PAGE_DESCRIPTION: 'Gioca al Fantacampionato di 0-0-0 con calciatori reali: draft, allenatori, OVR, Intesa ed eventi casuali in una stagione sempre diversa.',
      CANONICAL_URL: 'https://fantaballa.it/Fantaballa%20-%200/campionato-real.html',
      HERO_DESKTOP_POSITION: 'center 46%',
      HERO_MIN_HEIGHT: '270px',
      HERO_MOBILE_POSITION: 'center 48%',
      BODY_CLASS: 'page-season page-season-real',
      BRAND_TITLE: 'Fantacampionato del Ca***',
      HEADER_META_ID: ' id="competitionHeaderMeta"',
      HEADER_META: 'Serie A · 38 giornate · 20 club · 494 calciatori reali',
      HERO_TEXT_ID: ' id="competitionHeroText"',
      HERO_TEXT: 'I calciatori e i club della stagione 2026/2027 dentro il Campionato di Fantaballa: draft, 38 giornate, eventi, infortuni, squalifiche e mercato di metà stagione.',
      CONFIG_SCRIPT: 'assets/season-config-real.js?v=20260805-season2627full1'
    }
  }
};

function render(template, variant) {
  let output = template.replace('<!-- SORGENTE UNICA: modifica questo file e rigenera con scripts/build-campionati.mjs -->\n', '');

  for (const [key, value] of Object.entries(variant.values)) {
    output = output.replaceAll(`{{${key}}}`, value);
  }

  const unresolved = [...output.matchAll(/\{\{[^}]+\}\}/g)].map(match => match[0]);
  if (unresolved.length) {
    throw new Error(`Placeholder non risolti: ${[...new Set(unresolved)].join(', ')}`);
  }
  return output;
}

const template = await readFile(TEMPLATE_PATH, 'utf8');
const checkOnly = process.argv.includes('--check');
let stale = false;

for (const [name, variant] of Object.entries(variants)) {
  const outputPath = resolve(ROOT, variant.output);
  const generated = render(template, variant);
  if (checkOnly) {
    let current = '';
    try { current = await readFile(outputPath, 'utf8'); } catch {}
    if (current !== generated) {
      console.error(`✗ ${variant.output} non è aggiornato (variante ${name})`);
      stale = true;
    } else {
      console.log(`✓ ${variant.output} aggiornato`);
    }
  } else {
    await writeFile(outputPath, generated, 'utf8');
    console.log(`✓ generato ${variant.output} (${name})`);
  }
}

if (stale) process.exitCode = 1;
