'use strict';
const assert=require('node:assert/strict');
const {createRuntime}=require('./helpers/auction-runtime');
const api=createRuntime('attack-budget');const state=api.initialize(1,false,'attack-budget');const cpu=state.managers[1];
const defender=api.players.find(p=>p.role==='D');
const attacks=api.players.filter(p=>p.role==='A'&&api.starterEstimates.get(p.id)>=45).sort((a,b)=>b.ovr-a.ovr);
const originalAttackTarget=cpu.profile.targets.A;
// Fake filled P/C departments: each legal remaining defender purchase must
// preserve the planned attack fund even after repeated D expenditure.
for(const role of ['P','C']){for(const p of api.players.filter(p=>p.role===role).slice(0,api.ROLE_LIMITS[role]))cpu.roster.push({...p,price:1});}
cpu.budget=350;
for(let i=0;i<4;i++){
 const p=api.players.filter(p=>p.role==='D')[i];
 const cap=api.cpuAuctionSpendingCap(cpu,p);
 assert(cpu.budget-cap>=Math.floor(originalAttackTarget*.97));
 cpu.roster.push({...p,price:cap});cpu.budget-=cap;
 state.availableIds=state.availableIds.filter(id=>id!==p.id);
}
const a=api.initialize(1,false,'attack-budget');const m=a.managers[1];
for(const role of ['P','D','C'])for(const p of api.players.filter(p=>p.role===role).slice(0,api.ROLE_LIMITS[role]))m.roster.push({...p,price:1});
m.budget=270;
const firstCap=api.cpuAuctionSpendingCap(m,attacks[0]);
assert(firstCap<=146,'First striker must leave funds for other starters');
m.roster.push({...attacks[0],price:firstCap});m.budget-=firstCap;
a.availableIds=a.availableIds.filter(id=>id!==attacks[0].id);
assert(api.cpuAuctionSpendingCap(m,attacks[1])>1,'Second strong striker remains affordable');
console.log('OK: attack reserve survives repeated defender spending; first striker leaves funds for the next.');
