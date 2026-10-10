'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const window={};
for(const file of ['js/career-engine.js','js/storage-snapshot.js',...['shop-controller','lineup-controller','matchday-events-controller','live-controller'].map(name=>'js/domains/'+name+'.js')])vm.runInNewContext(fs.readFileSync(file,'utf8'),{window,Date,console,document:{querySelectorAll:()=>[]}});
const engine=window.FantaCareerEngine;
const roster=Array.from({length:6},(_,i)=>({id:'p'+i,role:'D',name:'Player '+i,ovr:90-i}));
const rival={id:'cpu',team:'Rival',roster};const other={id:'other',roster:[{id:'x',role:'D'}]};
let saves=0,builds=0;
const rt={state:{career:engine.normalizeCareer({seasonNumber:1}),managers:[{id:'user',roster:[]},rival,other]},CareerEngine:engine,
 ensureSeasonState:()=>rt.state.season,managerById:id=>rt.state.managers.find(m=>m.id===id),userOpponentIdForDay:()=>rival.id,saveState:()=>saves++,showToast:()=>{},$:()=>null,
 closeConsumableModal:()=>{},renderLineupScreen:()=>{},playerStatusForDay:()=>({unavailable:false}),lineupReadOnly:false,cpuLeagueRuleLineupValue:(m,p)=>p.ovr};
Object.assign(rt,window.FantaDomains['shop-controller'].create(rt),window.FantaDomains['matchday-events-controller'].create(rt),window.FantaDomains['lineup-controller'].create(rt));
Object.assign(rt,{renderLineupScreen:()=>{},closeConsumableModal:()=>{},cpuLeagueRuleLineupValue:(m,p)=>p.ovr});
const reset=(sponsor=null)=>{rt.state.season={currentMatchday:1,started:true,sponsor,consumables:{inventory:{cons_opponent_block:4}},lineups:{'1':{}}};};
reset();rt.applyTargetedConsumable('cons_opponent_block','p0');rt.applyTargetedConsumable('cons_opponent_block','p1');assert.equal(rt.consumableQuantity('cons_opponent_block'),3);assert.deepEqual([...rt.blockedOpponentPlayerIds()],['p0']);
for(const second of [false,true]){
 const sponsor=engine.createSeasonSponsor({id:second?'win_bonus':'double_block'});if(second)sponsor.additionalSponsors=[engine.createSeasonSponsor({id:'double_block'})];reset(sponsor);
 rt.applyTargetedConsumable('cons_opponent_block','p0');rt.applyTargetedConsumable('cons_opponent_block','p0');assert.equal(rt.consumableQuantity('cons_opponent_block'),3);
 rt.applyTargetedConsumable('cons_opponent_block','x');assert.equal(rt.consumableQuantity('cons_opponent_block'),3);
 rt.lineupReadOnly=true;rt.applyTargetedConsumable('cons_opponent_block','p1');rt.lineupReadOnly=false;assert.equal(rt.consumableQuantity('cons_opponent_block'),3);
 rt.applyTargetedConsumable('cons_opponent_block','p1');assert.equal(rt.consumableQuantity('cons_opponent_block'),2);assert.equal(rt.lineupConsumableActionState('cons_opponent_block').usable,false);
 rt.applyTargetedConsumable('cons_opponent_block','p2');assert.equal(rt.consumableQuantity('cons_opponent_block'),2);
 assert.deepEqual([...rt.blockedOpponentPlayerIds()],['p0','p1']);assert.equal(rt.state.season.consumables.usageHistory.length,2);
 const lineup={formation:'4-4-2',confirmed:true,starters:{D1:'p0',D2:'p1'},bench:['p2','p3','p4','p5'],captainId:'p0'};
 rt.enforceOpponentConsumableBlock(rival,lineup,1);assert.deepEqual(Object.values(lineup.starters),['p2','p3']);assert.ok(!lineup.bench.includes('p0')&&!lineup.bench.includes('p1'));assert.equal(lineup.captainId,null);
 const untouched=JSON.stringify(lineup);rt.enforceOpponentConsumableBlock(other,lineup,1);assert.equal(JSON.stringify(lineup),untouched);
 const storage=window.FantaStorageSnapshot.create({compactMarketState:x=>x});rt.state=JSON.parse(JSON.stringify(storage.buildStorageSnapshot(rt.state)));assert.deepEqual([...rt.blockedOpponentPlayerIds()],['p0','p1']);
 // The live controller must rebuild even if only the second blocked player is in a cached lineup.
 rt.state.season.lineups['1']={cpu:{formation:'4-4-2',confirmed:true,starters:{D1:'p1',D2:'p4'},bench:['p5']},other:{formation:'4-4-2',confirmed:true,starters:{D1:'x'},bench:[]}};
 Object.assign(rt,{forcedFormationRuleForDay:()=>null,adminForcedStarterForManager:()=>null,adminBlockedStarterForManager:()=>null,allowedLineupFormation:()=>true,cpuFormationForDay:()=> '4-4-2',buildAutoLineup:()=>{builds++;return {formation:'4-4-2',confirmed:true,starters:{D1:'p0',D2:'p1'},bench:['p2','p3','p4','p5']};}});
 const live=window.FantaDomains['live-controller'].create(rt);const store=live.ensureCpuLineupsForDay(1);
 assert.ok(![...Object.values(store.cpu.starters),...store.cpu.bench].some(id=>['p0','p1'].includes(id)));assert.equal(store.other.starters.D1,'x');
 assert.equal(live.ensureCpuLineupsForDay(1),store);
 rt.state.season.currentMatchday=2;assert.equal(rt.blockedOpponentPlayerIds().length,0);assert.equal(rt.lineupConsumableActionState('cons_opponent_block').usable,true);
}
// A legacy save with only the singular field already used one of its two blocks.
reset(engine.createSeasonSponsor({id:'double_block'}));rt.consumableDayEffect().blockedOpponentPlayerId='p0';rt.applyTargetedConsumable('cons_opponent_block','p1');assert.deepEqual([...rt.blockedOpponentPlayerIds()],['p0','p1']);
assert.ok(saves>0&&builds===2);
console.log('OK: one/two blocks, two distinct rivals’ players, inventory debit, duplicate/third/wrong-team/read-only guards, both starters and bench excluded, live cache rebuild, save/reload, legacy save, next day, Celebrità second sponsor.');
