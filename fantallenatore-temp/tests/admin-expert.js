'use strict';
const assert=require('node:assert/strict');
const {createRuntime}=require('./helpers/auction-runtime');
function setup(division=3,open=false){
 const api=createRuntime('rivale-expert');api.initialize(division,open,'rivale-expert');
 const m=api.state.managers[1];m.profile={id:m.id,archetype:'admin',aggression:1.055,volatility:.018,topBias:1.065,heat:.035,expert:true,valueHunter:true,targets:{P:30,D:64,C:132,A:274}};
 return {api,m};
}
function top(api,role){return api.players.filter(p=>p.role===role).sort((a,b)=>b.ovr-a.ovr)[0];}
for(const division of [4,3,2,1]){
 const {api,m}=setup(division),skill=api.cpuAuctionCompetence(m);
 for(const arch of ['esperto','rivale','fantadata','stratega','squalo']){
  const other={...m,profile:{...m.profile,archetype:arch}};
  assert(skill>=api.cpuAuctionCompetence(other));
  if(division>1)assert(skill>api.cpuAuctionCompetence(other));
 }
 assert.equal(api.cpuAuctionCompetence(api.state.managers[0]),0);
 const savedRival=JSON.parse(JSON.stringify(m));savedRival.profile.archetype='rivale';
 assert.equal(api.cpuAdminPlayerPlan(savedRival,top(api,'A')),null,'Rivale no longer owns the expert strategy');
 const savedAdmin=JSON.parse(JSON.stringify(m));
 assert(api.cpuAdminPlayerPlan(savedAdmin,top(api,'A')),'Saved Admin profiles use the expert strategy without migration');
}
{
 const {api,m}=setup(1,true);
 const p=top(api,'A'),initial=api.cpuAdminPlayerPlan(m,p);
 assert(initial.gain>6);assert.equal(Object.values(initial.shape).reduce((s,n)=>s+n,0),11);
 m.roster=api.players.filter(p=>p.role==='A').sort((a,b)=>b.ovr-a.ovr).slice(0,3).map(p=>({...p,price:1}));
 api.state.availableIds=api.state.availableIds.filter(id=>!m.roster.some(p=>p.id===id));
 const fourth=api.players.filter(p=>p.role==='A'&&api.state.availableIds.includes(p.id)).sort((a,b)=>b.ovr-a.ovr)[0];
 api.state.auction={playerId:fourth.id,nominatorId:m.id,price:1,activeIds:api.state.managers.map(m=>m.id)};
 assert(api.cpuLimit(m,fourth)<=4,'A reserve that does not improve the eleven must not consume starter funds');
 const attacker=api.cpuAdminPlayerPlan(m,fourth),defender=api.cpuAdminPlayerPlan(m,top(api,'D'));
 assert.equal(attacker.gain,0,'Fourth attacker cannot occupy a fourth starting slot');
 assert(defender.gain>attacker.gain&&defender.valueFactor>attacker.valueFactor);
 const weights=api.freeRoleNominationWeights(m,['D','A']);
 assert(weights[0].weight>weights[1].weight*3,'Weak department takes precedence over a fourth star attacker');
 const shapes=[{P:1,D:4,C:3,A:3},{P:1,D:3,C:4,A:3},{P:1,D:3,C:5,A:2},{P:1,D:4,C:4,A:2},{P:1,D:5,C:3,A:2},{P:1,D:4,C:5,A:1},{P:1,D:5,C:4,A:1}];
 assert(shapes.some(shape=>JSON.stringify(shape)===JSON.stringify(defender.shape)));
 // The result respects a lineup of exactly eleven, rather than summing twelve role targets.
 assert.equal(Object.values(defender.shape).reduce((s,n)=>s+n,0),11);
 api.state.leagueRules={formation334Allowed:true};
 assert(api.cpuAdminPlayerPlan(m,fourth).gain>0,'A fourth attacker becomes useful when 3-3-4 is actually allowed');
 api.state.auction={playerId:fourth.id,arcade:{type:'mystery'}};
 assert.equal(api.cpuAdminPlayerPlan(m,fourth),null);
}
for(const division of [3,2,1])for(const open of [false,true]){
 const {api,m}=setup(division,open);if(!open)api.state.currentRoleIndex=3;
 for(let i=0;i<8;i++){
  api.state.auction=null;const p=api.chooseNomination(m);
  assert(p&&api.canOwn(m,p));assert(open||p.role==='A');
  api.state.auction={playerId:p.id,nominatorId:'user',highBidderId:'user',price:1,activeIds:api.state.managers.map(m=>m.id)};
  const plan=api.cpuAdminPlayerPlan(m,p),limit=api.cpuLimit(m,p);
  assert(limit>=1&&limit<=api.maxLegalBid(m,p));assert(limit<=api.cpuAuctionSpendingCap(m,p));
  assert(plan.spendingCap<=api.maxLegalBid(m,p));
  assert(api.cpuReactionDelay(m)<=4550&&api.cpuNominationDelay(m)<=950);
 }
 m.budget=25;
 for(const role of api.ROLE_ORDER)assert(api.cpuLimit(m,top(api,role))<=1);
 assert.equal(m.budget,25);
}
{
 const {api,m}=setup(1),p=top(api,'A');
 const rivalCap=api.cpuAuctionSpendingCap(m,p),rivalLimit=api.cpuLimit(m,p);
 m.profile={...m.profile,archetype:'esperto'};api.state.availableIds=api.state.availableIds.slice();
 assert(rivalCap>api.cpuAuctionSpendingCap(m,p),'Decisive starter can use a larger share while reserving other departments');
 assert(rivalLimit>api.cpuLimit(m,p),'Higher expertise must affect real offers, not only nomination labels');
}
console.log('OK: Admin leads expertise progression, plans exactly eleven starters, prioritizes weak roles over duplicate stars, uses flexible legal reserves, nominates/bids in C/B/A and both modes, respects hidden identity and timed windows.');
