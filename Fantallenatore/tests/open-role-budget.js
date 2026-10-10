'use strict';
const assert=require('node:assert/strict');
const {createRuntime}=require('./helpers/auction-runtime');
for(const division of [3,2,1]){
 const api=createRuntime('open-role-budget'),s=api.initialize(division,true,'open-role-budget');
 const cpu=s.managers[1];cpu.profile.archetype='rivale'; // Test ordinary reserves; Admin has a dedicated flexible plan.
 const tops=Object.fromEntries(api.ROLE_ORDER.map(role=>[role,api.players.filter(p=>p.role===role).sort((a,b)=>api.baseAuctionValue(b)-api.baseAuctionValue(a))]));
 assert(api.cpuAuctionSpendingCap(cpu,tops.P[0])<100,'Portiere non deve consumare 200 crediti');
 assert(api.cpuAuctionSpendingCap(cpu,tops.C[0])<90,'Primo centrocampista lascia fondi agli altri titolari');
 for(const role of ['C','P','A','D','C','A','D','C','A','D','C','D']){
  const player=tops[role].find(p=>s.availableIds.includes(p.id)&&api.canOwn(cpu,p));
  const cap=api.cpuAuctionSpendingCap(cpu,player);
  assert(cap>=1&&cap<=api.maxLegalBid(cpu,player));
  assert(api.award(player,cpu.id,cap).ok);
  assert(cpu.budget>api.slotsRemaining(cpu)+25,'Crediti non esauriti nei primi 12 acquisti');
 }
}
console.log('OK: C/B/A, budget portieri e centrocampo, riserva durante 12 acquisti misti, contabilità e limiti legali.');
