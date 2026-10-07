'use strict';
const assert=require('node:assert/strict'),{createRuntime}=require('./helpers/auction-runtime');
const api=createRuntime('bundle-values');const state=api.initialize(1,false,'bundle-values'),cpu=state.managers[1];
const attackers=api.players.filter(p=>p.role==='A').sort((a,b)=>api.baseAuctionValue(b)-api.baseAuctionValue(a)),first=attackers[0],good=attackers[1],cheap=attackers.at(-1);
function limit(a,b){state.auction={playerId:a.id,nominatorId:cpu.id,price:2,activeIds:state.managers.map(m=>m.id),arcade:{type:'bundle',secondPlayerId:b.id}};return api.cpuLimit(cpu,a);}
const poorPair=limit(first,cheap),strongPair=limit(first,good);assert(strongPair>poorPair,`Two strong players must cost more: ${strongPair} <= ${poorPair}`);
assert.equal(limit(good,first),strongPair,'Swapping players must preserve total valuation');
assert.equal(limit(cheap,first),poorPair,'Strong second player must contribute even with a weak first player');
assert(strongPair<=api.maxLegalBid(cpu,first));
// The sum cannot spend the money protected for P/D/C.
cpu.budget=320;const capped=limit(first,good);assert(capped<=cpu.budget);assert(capped<=api.cpuAuctionSpendingCap(cpu,first,[first,good]));
// Only one A slot left: package is illegal regardless of combined quality.
cpu.roster=attackers.slice(2,7).map(p=>({...p,price:1}));assert.equal(limit(first,good),0);
// Exact two-credit fund for two last slots is a legal two-player purchase.
cpu.roster=[];cpu.budget=25;assert(limit(first,good)<=2);
// Resolve a CPU contest for two good players at the actual production ceilings.
const auctionState=api.initialize(1,false,'bundle-contest');
auctionState.auction={playerId:first.id,nominatorId:auctionState.managers[1].id,price:2,activeIds:auctionState.managers.map(m=>m.id),arcade:{type:'bundle',secondPlayerId:good.id}};
const bids=auctionState.managers.slice(1).map(m=>({m,limit:api.cpuLimit(m,first)})).sort((a,b)=>b.limit-a.limit);
const winner=bids[0].m,price=Math.min(bids[0].limit,bids[1].limit+1),budget=winner.budget;
assert(api.awardBundle([first,good],winner.id,price).ok);assert.equal(winner.budget,budget-price);assert.equal(winner.roster.length,2);assert.equal(winner.budget+winner.roster.reduce((n,p)=>n+p.price,0),500);
console.log(`OK: both players valued, symmetric package, stronger pair ${strongPair} vs ${poorPair}, budget/slot caps enforced.`);
