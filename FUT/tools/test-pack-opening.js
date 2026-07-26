'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
function test(name, fn){
  try { fn(); console.log(`✓ ${name}`); passed += 1; }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}

function loadConfig(rel){
  const context = { window: {} };
  vm.runInNewContext(read(rel), context, { filename: rel });
  return context.window.FUTTU_CONFIG;
}

const store = read('store.html');
const core = read('assets/js/futtu-core-original-ui.js');
const opening = read('assets/js/futtu-pack-opening.js');
const css = read('assets/css/futtu-pack-opening.css');
const cards = JSON.parse(read('data/cards.json'));
const fantaballa = loadConfig('config/fantaballa.js');
const gotham = loadConfig('config/gotham.js');

test('Store carica CSS, modulo opening e core nell’ordine corretto', () => {
  const cssPos = store.indexOf('futtu-pack-opening.css');
  const openingPos = store.indexOf('futtu-pack-opening.js');
  const corePos = store.indexOf('futtu-core-original-ui.js');
  assert(cssPos > -1 && openingPos > -1 && corePos > -1);
  assert(openingPos < corePos);
});

test('Tutti i riferimenti locali di store.html esistono', () => {
  const refs = [...store.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]);
  for (const ref of refs) {
    if (/^(?:https?:|data:|#|javascript:)/i.test(ref)) continue;
    const clean = decodeURIComponent(ref.split('?')[0]);
    if (/\.(?:png|jpe?g|webp|gif|svg|mp3|wav|ogg)$/i.test(clean)) continue;
    assert(fs.existsSync(path.join(root, clean)), `File mancante: ${clean}`);
  }
});

test('Gli script inline di store.html hanno sintassi valida', () => {
  const scripts = [...store.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  scripts.forEach((match, index) => new vm.Script(match[1], { filename:`store-inline-${index + 1}.js` }));
  assert(scripts.length >= 5);
});

test('Il motore principale usa il reveal premium con fallback originale', () => {
  assert(core.includes("const premiumOpening = window.FUTTU_PACK_OPENING"));
  assert(core.includes('await premiumOpening.play({'));
  assert(core.includes('Fallback: conserva l\'apertura originale'));
});

test('Le carte vengono salvate prima della sequenza cinematografica', () => {
  assert(core.indexOf('await saveInventario(chosen)') < core.indexOf('await premiumOpening.play({'));
});


test('Dopo il reveal premium il motore sblocca una nuova apertura', () => {
  assert(!core.includes('clearResults();'));
  assert(core.includes("GAME_STATE.opening = false;"));
  assert(core.includes("packArea.style.removeProperty('display')"));
  assert(core.includes('applyPackVisual();'));
});

test('Il caricamento immagini carta protegge dai callback della carta precedente', () => {
  assert(opening.includes('let cardImageGeneration = 0'));
  assert(opening.includes('const requestId = ++cardImageGeneration'));
  assert(opening.includes('if (requestId !== cardImageGeneration) return'));
  assert(opening.includes("fallback.style.display = 'none'"));
});

test('Configurazione Fantaballa contiene tema stadio', () => {
  assert.equal(fantaballa.id, 'fantaballa');
  assert.equal(fantaballa.openingTheme.atmosphere, 'stadium');
  assert(fantaballa.openingTheme.walkoutSeries.includes('Dream'));
});

test('Configurazione Gotham contiene tema notte/pioggia', () => {
  assert.equal(gotham.id, 'gotham');
  assert.equal(gotham.openingTheme.atmosphere, 'dark-rain');
  assert(gotham.openingTheme.walkoutSeries.includes('Dark'));
});

test('Il modulo esporta API Base + Premium', () => {
  const localStore = new Map();
  const context = {
    window: { FUTTU_CONFIG: fantaballa, matchMedia: () => ({ matches:false }) },
    localStorage: { getItem:key=>localStore.get(key)||null, setItem:(key,value)=>localStore.set(key,value) },
    document: {},
    console,
    setTimeout,
    clearTimeout
  };
  context.window.window = context.window;
  vm.runInNewContext(opening, context, { filename:'futtu-pack-opening.js' });
  const api = context.window.FUTTU_PACK_OPENING;
  assert(api && typeof api.play === 'function');
  assert.equal(api.version, '1.5.0-default-card-image');
  assert(api.isWalkoutCard({ rarity:'Ultra Rara', series:'Gold' }));
  assert(api.isWalkoutCard({ rarity:'Rara', series:'Dream' }));
  assert(!api.isWalkoutCard({ rarity:'Rara', series:'Gold' }));
});

test('Walkout Gotham riconosce le serie Dark', () => {
  const context = {
    window: { FUTTU_CONFIG: gotham, matchMedia: () => ({ matches:false }) },
    localStorage: { getItem:()=>null, setItem:()=>{} },
    document: {}, console, setTimeout, clearTimeout
  };
  context.window.window = context.window;
  vm.runInNewContext(opening, context, { filename:'futtu-pack-opening.js' });
  assert(context.window.FUTTU_PACK_OPENING.isWalkoutCard({ rarity:'Rara', series:'Dark Souls' }));
  assert(context.window.FUTTU_PACK_OPENING.isWalkoutCard({ rarity:'Rara', series:'Fusion2' }));
});


test('Le carte senza immagine usano la grafica default configurata', () => {
  assert(opening.includes("const DEFAULT_CARD_IMAGE = 'img/nEW%20pLAYER.png'"));
  assert(opening.includes('image.src = primarySrc || DEFAULT_CARD_IMAGE'));
  assert(opening.includes('image.src = DEFAULT_CARD_IMAGE'));
});

test('CSS contiene fasi pack, reveal, walkout e riepilogo', () => {
  ['data-phase="pack"','data-phase="reveal"','data-phase="walkout"','data-phase="summary"'].forEach(token => assert(css.includes(token)));
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal((noComments.match(/\{/g)||[]).length, (noComments.match(/\}/g)||[]).length);
});


test('Il recap mostra solo le carte in tre colonne', () => {
  assert(css.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
  assert(!opening.includes("item.append(media,name,meta)"));
  assert(opening.includes('item.appendChild(media)'));
});

test('La carta resta completamente nascosta durante il tease', () => {
  assert(css.includes('.fo-reveal-phase.is-tease .fo-card-visual{opacity:0!important;visibility:hidden!important'));
  assert(css.includes('.fo-reveal-phase.is-tease .fo-card-frame{opacity:0!important;visibility:hidden!important'));
  assert(opening.includes('clearCardImage();'));
  assert(opening.indexOf('clearCardImage();') < opening.indexOf('setCardImage(card);\n    reveal.classList.add'));
});

test('Database contiene carte per entrambe le modalità', () => {
  const game = value => String(value || '').trim().toLowerCase();
  assert(cards.some(card => game(card.game) === 'fantaballa fc'));
  assert(cards.some(card => ['gotham city','gotham city fc','gotahm city'].includes(game(card.game))));
});

test('I pacchetti configurati restano separati per modalità', () => {
  assert(fantaballa.packs.some(pack => pack.name === 'Fantaballa Tots'));
  assert(!gotham.packs.some(pack => pack.name === 'Fantaballa Tots'));
  assert(gotham.packs.some(pack => pack.name === 'Gotham Tots'));
  assert(!fantaballa.packs.some(pack => pack.name === 'Gotham Tots'));
});

console.log(`\n${passed}/17 test superati.`);
