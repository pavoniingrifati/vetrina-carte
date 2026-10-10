'use strict';
const assert=require('node:assert/strict');
const {createRuntime}=require('./helpers/auction-runtime');
const api=createRuntime('difficulty-contract');api.initialize(4,false,'difficulty-contract');
const cpu=api.state.managers[1];
// Standard personality progression; Rivale now has a separately tested expert policy.
cpu.profile={...cpu.profile,archetype:'ragioniere'};
const top=api.players.filter(p=>p.role==='A').sort((a,b)=>b.ovr-a.ovr)[0];
const factors=[],caps=[],limits=[];
for(const division of [4,3,2,1]){
 api.state.career.division=division;
 api.state.availableIds=api.state.availableIds.slice();
 limits.push(api.cpuLimit(cpu,top));
 factors.push(api.cpuFootballAuctionFactor(cpu,top));
 caps.push(api.cpuAuctionSpendingCap(cpu,top));
 assert(api.cpuAuctionSpendingCap(cpu,top)<=api.maxLegalBid(cpu,top));
}
assert(limits[0]<limits[1] && limits[2]>1 && limits[3]>1,'I top devono restare contendibili; B/A distribuiscono il budget su tre attaccanti');
assert.equal(factors[0],1,'Amatori deve conservare il modello precedente');
assert(factors[0]<factors[1]&&factors[1]<factors[2]&&factors[2]<factors[3],'Valutazione qualità senza progressione');
assert(caps[0]>caps[1]&&caps[1]>caps[2]&&caps[2]>caps[3],'Credito per gli altri reparti non protetto progressivamente');
assert.equal(api.cpuAuctionCompetence(api.state.managers[0]),0,'La competenza CPU non deve modificare l’utente');
assert(api.state.managers.every(m=>m.budget===500),'Difficoltà ottenuta regalando crediti');
// At exact minimum budget, a legal one-credit purchase must remain possible.
cpu.budget=25;
for(const division of [3,2,1]){api.state.career.division=division;assert.equal(api.cpuAuctionSpendingCap(cpu,top),1);}
// With only attack left, protect other starting attackers, not other departments.
cpu.roster=api.players.filter(p=>p.role!=='A').reduce((rows,p)=>{
 if(rows.filter(x=>x.role===p.role).length<api.ROLE_LIMITS[p.role])rows.push({...p,price:1});return rows;
},[]);
cpu.budget=150;api.state.availableIds=api.state.availableIds.filter(id=>!cpu.roster.some(p=>p.id===id));
assert(api.cpuAuctionSpendingCap(cpu,top)<api.maxLegalBid(cpu,top),'Il primo attaccante deve lasciare crediti per gli altri titolari');
assert(api.cpuAuctionSpendingCap(cpu,top)>1);
// Protect the last goalkeeper slot when better, affordable keepers still exist.
const late=createRuntime('last-slot-quality');late.initialize(1,false,'last-slot-quality');
const lateCpu=late.state.managers[1],keepers=late.players.filter(p=>p.role==='P').sort((a,b)=>b.ovr-a.ovr);
lateCpu.roster=keepers.slice(-2).map(p=>({...p,price:1}));lateCpu.budget=498;
late.state.availableIds=late.state.availableIds.filter(id=>!lateCpu.roster.some(p=>p.id===id));
const weak=keepers[keepers.length-3];
const interest=late.strategicSlotInterest(lateCpu,weak);
assert(interest.passChance>=.98,'La CPU di Serie A chiude il reparto con una riserva evitabile');
console.log('OK: qualità e riserve crescono per divisione; 500 crediti uguali, ultimo slot protetto e completamento legale garantito.');
