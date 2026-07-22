#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const context = { window: {} };
context.window = context;
vm.createContext(context);
let handlers = fs.readFileSync(path.join(root, 'assets/season/event-handlers.js'), 'utf8');
handlers += '\nwindow.SEASON_EVENT_HANDLER_IDS = SEASON_EVENT_HANDLER_IDS;';
vm.runInContext(handlers, context, { filename: 'event-handlers.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'assets/event-validator.js'), 'utf8'), context, { filename: 'event-validator.js' });
const original = ['common','community','real'].map(name => JSON.parse(fs.readFileSync(path.join(root,`data/events/events-${name}.json`),'utf8')));
const clone = value => JSON.parse(JSON.stringify(value));
const tests = [];
function test(name, fn) {
  try { fn(); tests.push({name, ok:true}); }
  catch (error) { tests.push({name, ok:false, error:String(error.message || error)}); }
}
function assert(value, message) { if (!value) throw new Error(message); }
const validate = (catalogs, policy={}) => context.FantaballaEventValidator.validateCatalogs(catalogs, context.SEASON_EVENT_HANDLER_IDS, policy);

test('Cataloghi originali validi', () => assert(validate(original).ok, 'I cataloghi originali non sono validi.'));
test('Modalità baseline esatta valida', () => assert(validate(original,{strictCounts:true}).ok, 'La baseline esatta non è valida.'));
test('Nuova decisione comune consentita', () => {
  const catalogs=clone(original);
  catalogs[0].decisions.push({id:'evento-editor-test',order:69,title:'Evento editor test',text:'Evento generato dal test.',choices:[{label:'A',effect:'A',applyHandler:'nuovo-sponsor:0'},{label:'B',effect:'B',applyHandler:'nuovo-sponsor:1'}]});
  const report=validate(catalogs);
  assert(report.ok, report.errors.join(' | '));
  assert(report.stats.communityDecisions===70 && report.stats.realDecisions===66,'Conteggi nuova decisione errati.');
});
test('Handler inesistente bloccato', () => {
  const catalogs=clone(original);
  catalogs[0].decisions[0].choices[0].applyHandler='handler-inesistente';
  const report=validate(catalogs);
  assert(!report.ok && report.errors.some(x=>x.includes('handler scelta mancante')),'Handler inesistente non rilevato.');
});
test('Ordine duplicato bloccato', () => {
  const catalogs=clone(original);
  catalogs[0].decisions[1].order=catalogs[0].decisions[0].order;
  const report=validate(catalogs);
  assert(!report.ok && report.errors.some(x=>x.includes('Ordine decisione duplicato')),'Ordine duplicato non rilevato.');
});
test('Disattivazione accettata dal formato', () => {
  const catalogs=clone(original);
  catalogs[0].decisions[0].disabled=true;
  const report=validate(catalogs);
  assert(report.ok,'Evento disattivato non valido.');
  assert(report.stats.disabledDecisions===1,'Conteggio disattivati errato.');
});
test('Motore filtra eventi disattivati', () => {
  const source=fs.readFileSync(path.join(root,'assets/season/10-events.js'),'utf8');
  const matches=source.match(/filter\(item=>item\?\.disabled!==true\)/g)||[];
  assert(matches.length===2,'Filtro disabled mancante per decisioni o automatici.');
});
test('Editor collegato e senza eval', () => {
  const html=fs.readFileSync(path.join(root,'event-editor.html'),'utf8');
  const js=fs.readFileSync(path.join(root,'assets/event-editor.js'),'utf8');
  assert(html.includes('assets/event-editor.js'),'Script editor non collegato.');
  assert(!/\beval\s*\(/.test(js),'Uso di eval rilevato.');
});
const failed=tests.filter(item=>!item.ok);
const report={ok:failed.length===0,tests,summary:{total:tests.length,passed:tests.length-failed.length,failed:failed.length}};
console.log(JSON.stringify(report,null,2));
process.exitCode=failed.length?1:0;
