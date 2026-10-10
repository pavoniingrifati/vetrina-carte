'use strict';
// Executes the real shell/domain code to validate fixture integrity without a browser.
// This DOES NOT count as a graphics or browser test.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');const window={addEventListener(){},localStorage:{getItem(){return null},setItem(){},removeItem(){}}};
const document={getElementById(){return null},querySelector(){return null},querySelectorAll(){return []}};
const context=vm.createContext({window,document,console,Math,Date,Blob,TextEncoder,TextDecoder,btoa,atob,setTimeout,clearTimeout,setInterval,clearInterval});
for(const f of ['data_v302.js','js/pokemon-catalog.js','js/serie-b-catalog.js','js/game-rules.js','js/core-utils.js','js/save-codec.js','js/save-manager.js','js/season-engine.js','js/transfer-engine.js','js/career-engine.js','js/auction-engine.js','js/auction-events.js','js/live-match-state.js','js/season-recap.js','js/storage-snapshot.js','js/cpu-lineup-policy.js','js/datacenter-overview.js',...require('./helpers/production-source').domainFiles()])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
const shell=fs.readFileSync(path.join(root,'app_v302.js'),'utf8'),end=shell.indexOf('  // Events\n');assert(end>0);
const bridge=fs.readFileSync(path.join(__dirname,'browser/fixture-bridge.js'),'utf8');
vm.runInContext(shell.slice(0,end)+'\nstopGameRuntime=()=>{};renderAll=()=>{};showScreen=()=>{};renderSeasonDashboard=()=>{};\n'+bridge+'\n})();',context);
const api=window.__fantaBrowserTest;api.nomination();assert.equal(api.inspect().auction,null);
api.auction();const auction=api.inspect();assert.equal(auction.auction.price,12);assert.equal(auction.auction.activeIds.length,10);assert(auction.auction.deadlineAt>Date.now());
api.auction({bundle:true});assert(api.inspect().auction.arcade.secondPlayerId);
api.season();const state=api.inspect();assert.equal(state.managers.length,10);assert.equal(state.captainRule,'seven');assert.equal(state.phase,'match_ready');
const ids=[];for(const m of state.managers){assert.equal(m.roster.length,25);for(const [role,count] of Object.entries({P:3,D:8,C:8,A:6}))assert.equal(m.roster.filter(p=>p.role===role).length,count);ids.push(...m.roster.map(p=>p.id));}assert.equal(new Set(ids).size,250);
const {instrumentShell}=require('./browser/server');assert(instrumentShell(shell,bridge).includes(bridge));assert(!fs.readFileSync(path.join(root,'index.html'),'utf8').includes('fixture-bridge'));assert(!shell.includes('__fantaBrowserTest'));
assert.equal(fs.readFileSync(path.join(root,'app_v302.js'),'utf8'),shell,'Production shell modified by test server');
const {noOverlap}=require('./browser/geometry');noOverlap([{left:0,top:0,right:20,bottom:20},{left:22,top:0,right:42,bottom:20}],'fixture');assert.throws(()=>noOverlap([{left:0,top:0,right:20,bottom:20},{left:10,top:0,right:30,bottom:20}],'fixture'),/overlap/);
console.log('OK: browser fixture legality, source isolation and overlap detector. Graphics NOT executed here.');
