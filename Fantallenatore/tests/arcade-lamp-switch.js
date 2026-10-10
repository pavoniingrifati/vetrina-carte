'use strict';
const assert=require('node:assert/strict'),{createRuntime}=require('./helpers/season-runtime');
const api=createRuntime('lamp-switch'),els={};
function el(id){return els[id]||=( {textContent:'',innerHTML:'',value:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},querySelector(){return null;},focus(){}} );}
api.noticeTestElements(new Proxy({},{get:(_,id)=>el(id)}));
let state=api.arcadeInitialize(),player=api.players().find(p=>p.role==='P'),a=api.arcadePrepare(player,3);
assert.equal(a.arcade.type,'hammer');assert(a.arcade.awaitingAck);assert.equal(api.arcadeWindow(),2000);
for(let i=0;i<40;i++){const delay=api.arcadeDelay(state.managers[1]);assert(delay>0&&delay<2000);}
api.arcadeShow();assert(el('arcadeAuctionBody').innerHTML.includes('2 secondi'));
state.auction=null;assert.equal(api.arcadeWindow(),5000,'Timer resets on next auction');
state=api.arcadeInitialize();a=api.arcadePrepare(player,4);assert.equal(a.arcade.type,'switch');assert.equal(a.arcade.originalRole,'P');
assert.notEqual(api.players().find(p=>p.id===a.playerId).role,'P');assert.equal(state.currentRoleIndex,0);
const ids=JSON.stringify(a.arcade.crossRoleIds),selected=a.playerId;api.arcadeShow();api.arcadeShow();assert.equal(a.playerId,selected);assert.equal(JSON.stringify(a.arcade.crossRoleIds),ids);
api.arcadeNoTimers();el('arcadeCrossRolePlayer').value=player.id;api.arcadeAction('start');assert(a.arcade.awaitingAck,'Original role cannot be selected');
const attacker=api.players().find(p=>p.role==='A'&&a.arcade.crossRoleIds.includes(p.id));el('arcadeCrossRolePlayer').value=attacker.id;api.arcadeAction('start');assert.equal(a.playerId,attacker.id);assert(!a.arcade.awaitingAck);assert.equal(state.currentRoleIndex,0);assert(a.activeIds.includes('user'));
assert.equal(api.storageSnapshot().auction.arcade.originalRole,'P');
state=api.arcadeInitialize();state.leagueRules.freeRoleAuction=true;a=api.arcadePrepare(player,4);assert.notEqual(a.arcade.type,'switch','No redundant role switch in free-role mode');
console.log('OK: 2-second timer, fair CPU reaction windows, warning, timer reset, saved role switch and legal user selection.');
