import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const VERSIONABLE_URL_RE = /(?:\.\/)?(?:assets|data)\/[A-Za-z0-9_./${}-]+\.(?:json|css|js)(?=\?|[\s\"'`)<]|$)(?:\?[^\s"'`)<]*)?|(?:\.\/)?(?:favicon\.ico|favicon-48x48\.png|site-icon-192\.png|site-icon-512\.png|apple-touch-icon\.png|site\.webmanifest)(?:\?[^\s"'`)<]*)?/g;

const hashCache = new Map();

export async function shortFileHash(filePath) {
  const absolute = resolve(filePath);
  const cached = hashCache.get(absolute);
  if (cached) return cached;
  const data = await readFile(absolute);
  const hash = createHash('sha256').update(data).digest('hex').slice(0, 12);
  hashCache.set(absolute, hash);
  return hash;
}

function splitUrl(url) {
  const q = url.indexOf('?');
  return q === -1 ? { pathname: url, query: '' } : { pathname: url.slice(0, q), query: url.slice(q + 1) };
}

function withVersion(url, hash) {
  const { pathname, query } = splitUrl(url);
  const params = new URLSearchParams(query);
  params.set('v', hash);
  const serialized = params.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

function targetFor(root, url) {
  const { pathname } = splitUrl(url);
  const normalized = pathname.startsWith('./') ? pathname.slice(2) : pathname;
  return resolve(root, normalized);
}

async function existsAsFile(filePath) {
  try { return (await stat(filePath)).isFile(); } catch { return false; }
}

/**
 * Applica ?v=<sha256 breve> ai riferimenti locali versionabili presenti nel testo.
 * I percorsi assets/... e data/... sono intenzionalmente risolti dalla root del sito,
 * perché anche quando compaiono dentro JS vengono risolti dal browser rispetto alla pagina.
 */
export async function versionLocalUrls(text, { root }) {
  const matches = [...text.matchAll(VERSIONABLE_URL_RE)];
  if (!matches.length) return text;

  let out = text;
  const replacements = new Map();
  for (const match of matches) {
    const url = match[0];
    if (url.includes('${')) continue; // template literal dinamico: non è un file determinabile a build time.
    if (replacements.has(url)) continue;
    const target = targetFor(root, url);
    if (!(await existsAsFile(target))) continue;
    const hash = await shortFileHash(target);
    replacements.set(url, withVersion(url, hash));
  }

  // Sostituzione in un singolo passaggio sull'input originale: evita che un URL corto
  // (es. site-icon-512.png) venga applicato dentro un URL appena riscritto con ./ e ?v=.
  out = text.replace(VERSIONABLE_URL_RE, url => replacements.get(url) ?? url);
  return out;
}

export async function expectedVersionedFile(filePath, { root }) {
  const current = await readFile(filePath, 'utf8');
  return versionLocalUrls(current, { root });
}

export async function updateVersionedFile(filePath, { root, checkOnly = false }) {
  const current = await readFile(filePath, 'utf8');
  // Un hash di un file che contiene URL versionati dipende dal testo corrente. Per i file
  // che versionano dipendenze (config/manifest) il chiamante li aggiorna prima dei genitori.
  hashCache.delete(resolve(filePath));
  const expected = await versionLocalUrls(current, { root });
  if (current === expected) return { changed: false, stale: false };
  if (checkOnly) return { changed: false, stale: true };
  await writeFile(filePath, expected, 'utf8');
  hashCache.delete(resolve(filePath));
  return { changed: true, stale: false };
}

export function clearHashCache() {
  hashCache.clear();
}
