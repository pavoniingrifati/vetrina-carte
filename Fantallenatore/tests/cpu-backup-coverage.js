'use strict';
const assert=require('node:assert/strict');
const {createRuntime}=require('./helpers/auction-runtime');
const api=createRuntime('coverage-contract');let state=api.initialize(2,false,'coverage-contract'),cpu=state.managers[1];
const keeper=api.players.find(p=>p.role==='P' && api.cpuClubRoleHierarchy(p.club,'P')[0]?.id===p.id && api.starterEstimates.get(p.id)>=55 && api.cpuClubRoleHierarchy(p.club,'P').length>=3);
assert(keeper);const [first,second,third]=api.cpuClubRoleHierarchy(keeper.club,'P');
assert(api.award(first,cpu.id,20).ok);
assert.equal(api.cpuCoverInfo(cpu,second).kind,'keeper');assert.equal(api.cpuCoverInfo(cpu,third),null);
assert.equal(api.strategicSlotInterest(cpu,second).willing,true,'Backup must escape the generic low-quality rejection');
assert(api.cpuLimit(cpu,second)>=2);assert(api.cpuLimit(cpu,second)<=4);
const striker=api.players.find(p=>p.role==='A');assert(api.cpuKeeperReserve(cpu,striker)>=2);
state.career.division=1;assert(api.cpuLimit(cpu,second)<=6);cpu.profile={...cpu.profile,id:'admin'};assert.equal(api.chooseNomination(cpu).id,second.id,'Admin nominates the real second keeper');assert(api.cpuLimit(cpu,second)<=7);
for(const division of [3,4]){state.career.division=division;assert.equal(api.cpuCoverInfo(cpu,second),null);assert.equal(api.cpuMissingKeeperCover(cpu),null);assert.equal(api.cpuKeeperReserve(cpu,striker),0);}
state.career.division=2;assert.equal(api.cpuCoverInfo(state.managers[0],second),null,'User choices must remain manual');
// The remaining keeper slot belongs to the pending backup rather than a third starter.
const other=api.players.find(p=>p.role==='P' && p.club!==keeper.club && p.ovr<keeper.ovr);assert(api.award(other,cpu.id,1).ok);
assert.equal(api.roleSlotsRemaining(cpu,'P'),1);assert.equal(api.strategicSlotInterest(cpu,third).willing,false);
assert(api.award(second,cpu.id,2).ok);assert.equal(api.cpuMissingKeeperCover(cpu),null);assert.equal(api.cpuKeeperReserve(cpu,striker),0);
// Another owner securing the backup releases the reservation without seeking the third.
state=api.initialize(2,false,'lost-cover');cpu=state.managers[1];assert(api.award(first,cpu.id,20).ok);assert(api.award(second,state.managers[2].id,1).ok);assert.equal(api.cpuMissingKeeperCover(cpu),null);
// Mystery auctions cannot identify the hidden player as a backup.
state=api.initialize(2,false,'mystery-cover');cpu=state.managers[1];assert(api.award(first,cpu.id,20).ok);state.auction={playerId:second.id,arcade:{type:'mystery'}};assert.equal(api.cpuCoverInfo(cpu,second),null);state.auction=null;
// Outfield coverage requires an actual probable starter and the first rotation option.
let rotationPair;
for(const starter of api.players.filter(p=>p.role!=='P' && api.starterEstimates.get(p.id)>=55)){
 cpu.roster=[{...starter,price:10}];
 for(const candidate of api.players.filter(p=>p.role===starter.role&&p.club===starter.club)){
  if(api.cpuCoverInfo(cpu,candidate)?.kind==='rotation'){rotationPair={starter,candidate};break;}
 }
 if(rotationPair)break;
}
assert(rotationPair,'Baseline must offer a realistic rotation pair');assert(api.cpuCoverInfo(cpu,rotationPair.candidate).factor<1.2);
const unrelated=api.players.find(p=>p.role===rotationPair.candidate.role && p.club!==rotationPair.candidate.club);assert.equal(api.cpuCoverInfo(cpu,unrelated),null);
console.log('OK: B/A only, manual user, true second keeper, capped bidding, reserved slot/budget, rotation and mystery protection.');
