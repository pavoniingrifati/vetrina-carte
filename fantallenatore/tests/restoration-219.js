const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=require('./helpers/production-source').readProductionSource();
function extract(name){const start=source.indexOf('  function '+name+'(');assert(start>=0,name+' missing');const brace=source.indexOf('{',start);let depth=1,i=brace+1;for(;depth&&i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}')depth--;}return source.slice(start,i);}
const players=['P','D','C','A'].flatMap((role,k)=>Array.from({length:12},(_,i)=>({id:k*20+i,role,ovr:70})));
const context={window:{FANTA_PLAYERS:players},leagueRulesFor:d=>d.leagueRules,ROLE_LIMITS:{P:3,D:8,C:8,A:6},randomHash:s=>Array.from(s).reduce((a,c)=>a+c.charCodeAt(0),0)};vm.createContext(context);vm.runInContext(extract('applyPreAuctionPack'),context);
function draft(active,division=3){return {leagueRules:{packOpening:active},career:{division},managers:Array.from({length:10},(_,i)=>({id:String(i),roster:[],budget:500})),availableIds:players.map(p=>p.id),stats:{purchases:0,totalSpent:0},log:[]};}
let d=draft(true);assert(context.applyPreAuctionPack(d));assert.equal(d.stats.purchases,40);assert.equal(new Set(d.managers.flatMap(m=>m.roster.map(p=>p.id))).size,40);d.managers.forEach(m=>{assert.equal(m.budget,496);assert.deepEqual(m.roster.map(p=>p.role),['P','D','C','A']);});assert.equal(context.applyPreAuctionPack(d),false);assert.equal(context.applyPreAuctionPack(draft(false)),false);assert.equal(context.applyPreAuctionPack(draft(true,4)),false);
assert(!fs.readFileSync('index.html','utf8').includes('mobile-live-controls.js'));
assert(!source.includes('function godFill'));assert(source.includes('openLineupSlotPicker(slotId);'));
console.log('OK: pack ON/OFF, C eligibility, 40 unique allocations, correct budget, idempotency and always-visible live controls.');
