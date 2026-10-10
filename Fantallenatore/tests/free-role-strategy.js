const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const src=require('./helpers/production-source').readProductionSource();
const players=new Map();for(const role of ['D','A'])for(let i=0;i<20;i++)players.set(role+i,{id:role+i,role,value:role==='A'?100:20});
const manager={budget:150};const context={profileArchetype:()=> 'ragioniere',state:{availableIds:[...players.keys()],managers:[manager]},playerMap:players,roleSlotsRemaining:()=>4,slotsRemaining:()=>8,canOwn:()=>true,maxLegalBid:()=>100,baseAuctionValue:p=>p.value,TOP_VALUE_THRESHOLD:{D:40,A:100},targetFor:()=>100,roleSpend:()=>0,clamp:(n,a,b)=>Math.max(a,Math.min(b,n))};
vm.createContext(context);vm.runInContext(src.slice(src.indexOf('  function freeRoleNominationWeights('),src.indexOf('  function chooseNomination(')),context);
const weights=context.freeRoleNominationWeights(manager,['D','A']);assert(weights.every(x=>x.weight>0));assert(weights[1].weight>weights[0].weight,'Qualità disponibile ignorata');
const before=weights[1].weight;context.targetFor=(m,r)=>r==='A'?4:100;assert(context.freeRoleNominationWeights(manager,['A'])[0].weight<before,'Budget reparto ignorato');
console.log('OK: scelta ruolo sensibile a qualità e budget; probabilità positiva per tutti i ruoli.');
