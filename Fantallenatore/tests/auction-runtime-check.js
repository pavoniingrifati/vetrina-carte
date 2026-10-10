'use strict';
const assert=require('node:assert/strict');
const {createRuntime}=require('./helpers/auction-runtime');
const seed='audit-runtime-parity',cached=createRuntime(seed),plain=createRuntime(seed,{cache:false});
for(const api of [cached,plain])api.initialize(2,true,seed);
assert.equal(JSON.stringify(cached.state.managers),JSON.stringify(plain.state.managers),'Personalità non riproducibili');
for(let purchase=0;purchase<8;purchase++){
  const id=cached.state.availableIds.filter(id=>cached.canOwn(cached.state.managers[1],cached.playerMap.get(id)))[purchase*7],p=cached.playerMap.get(id),q=plain.playerMap.get(id);
  for(const price of [1,20,100]){
    for(const api of [cached,plain])api.state.auction={playerId:id,nominatorId:'cpu1',price,activeIds:api.state.managers.map(m=>m.id)};
    for(let i=1;i<10;i++)assert.equal(cached.cpuLimit(cached.state.managers[i],p),plain.cpuLimit(plain.state.managers[i],q),'Cache altera la decisione reale');
  }
  for(const api of [cached,plain])api.state.auction=null;
  assert.equal(cached.chooseNomination(cached.state.managers[1]).id,plain.chooseNomination(plain.state.managers[1]).id,'Chiamata non riproducibile');
  for(const api of [cached,plain])assert(api.award(api.playerMap.get(id),'cpu1',1).ok);
}
console.log('OK: stessi semi, personalità e chiamate; limiti CPU identici con/senza cache dopo acquisti e variazioni di prezzo.');
