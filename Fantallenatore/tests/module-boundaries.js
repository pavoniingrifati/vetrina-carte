'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ctx=vm.createContext({window:{}});
for(const file of ['storage-snapshot','cpu-lineup-policy'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),ctx,{filename:file});
assert.throws(()=>ctx.window.FantaStorageSnapshot.create({}),/compactMarketState/);
const storage=ctx.window.FantaStorageSnapshot.create({compactMarketState:m=>m});
for(const {input,expected} of JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/storage-snapshot-v161.json'))).cases){const before=JSON.stringify(input);assert.equal(JSON.stringify(storage.buildStorageSnapshot(input)),JSON.stringify(expected));assert.equal(JSON.stringify(input),before);}
const cases=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/cpu-lineup-v161.json'))).cases;
for(const {input,expected} of cases){const before=JSON.stringify(input);const deps={...input,lineupPlayerValue:()=>input.baseValue,leagueRulesFor:()=>input.rules,cpuLeagueRuleSensitivity:()=>input.sensitivity,estimatedStarterProbability:()=>input.starterPct,currentPlayerOvr:p=>p.ovr,playerFormMetrics:()=>input.form,playerSeasonStat:()=>input.stat,serieAMatchupDifficulty:()=>input.matchup,clamp:(n,a,b)=>Math.max(a,Math.min(b,n))};assert.equal(ctx.window.FantaCpuLineupPolicy.playerValue(deps),expected);assert.equal(JSON.stringify(input),before);}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'app_v302.js'),'utf8');
for(const file of ['storage-snapshot','cpu-lineup-policy']){assert(html.indexOf('js/'+file+'.js')>=0 && html.indexOf('js/'+file+'.js')<html.indexOf('src="app_v302.js"'));const body=fs.readFileSync(path.join(root,'js',file+'.js'),'utf8');assert(!/\b(document|localStorage|indexedDB|setTimeout|setInterval)\b/.test(body),'Moduli di politica non devono gestire UI o persistenza');}
assert(!app.includes('function compactPerformanceForSave('));assert(!app.includes('function compactFantasyMatchForSave('));assert(!app.includes('const historical=sample?'),'Politica CPU duplicata nell’app');
console.log(`OK: snapshot identici alla V161, ${cases.length} punteggi CPU identici, input non mutati e confini moduli.`);
