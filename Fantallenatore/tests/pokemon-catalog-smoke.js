'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=require('./helpers/production-source').readProductionSource();
const start=source.indexOf('  function pokemonBasePlayers(');
const end=source.indexOf('\n\n  // V2.1',start);
assert(start>0 && end>start,'Funzioni del catalogo mancanti');
const catalogContext={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/pokemon-catalog.js'),'utf8'),catalogContext);
vm.runInNewContext(fs.readFileSync(path.join(root,'data_v302.js'),'utf8'),catalogContext);
const catalog=catalogContext.window.FANTA_POKEMON_CATALOG;
const supplied=require(path.join(root,'data/pokemon-gen1-4.json')).players;
assert.equal(catalog.length,supplied.length);
for(let i=0;i<supplied.length;i++){
  assert.equal(catalog[i].id,supplied[i].id);
  assert.equal(catalog[i].name,supplied[i].name);
  assert.equal(catalog[i].ovr,supplied[i].ovr);
}
const roles={P:'Portiere',D:'Difensore',C:'Centrocampista',A:'Attaccante'};
const base=[{id:'real-1',name:'Base',role:'P',club:'roma',ovr:70,fvm:10}];
const context={
 window:{FANTA_POKEMON_CATALOG:catalog,FANTA_CLUBS:catalogContext.window.FANTA_CLUBS},
 ROLE_LABELS:roles,originalSerieAClubs:catalogContext.window.FANTA_CLUBS.map(c=>({...c})),serieBPlayers:[],originalSerieAPlayers:base,baseSerieAPlayers:[...base],
 basePlayerValueReference:new Map(base.map(player=>[player.id,player])),activeCatalogKey:'base',
 randomHash(value){let h=2166136261;for(const char of String(value)){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}return ((h>>>0)%100000)/100000;},
 syncRealLeagueClubs:()=>{},ensureRealLeague:draft=>draft.realLeague ||= {serieA:catalogContext.window.FANTA_CLUBS.map(c=>c.id),serieB:[]},
 leagueRulesFor:draft=>draft.leagueRules,TransferEngine:{createMarketState:seed=>({seed,history:[]})},
 syncSerieATransferWorld:draft=>{draft.availableIds=context.baseSerieAPlayers.map(p=>p.id)}
};
vm.createContext(context);
vm.runInContext(source.slice(start,end)+'\nthis.catalogTest={pokemonBasePlayers,activateCatalogBase,applyCatalogDecision};',context);
const {pokemonBasePlayers,applyCatalogDecision}=context.catalogTest;
const players=pokemonBasePlayers('seed-a');
assert.equal(players.length,493);
assert.equal(new Set(players.map(p=>p.id)).size,493);
for(const [role,min] of Object.entries({P:30,D:80,C:80,A:60})) assert(players.filter(p=>p.role===role).length>=min,role);
assert(players.every(p=>p.ovr>=60&&p.ovr<=93&&p.club&&p.fvm>=1));
assert(players.every(p=>p.ovr===supplied.find(entry=>entry.id===p.id).ovr),'OVR alterato rispetto al listone fornito');
const otherSeed=pokemonBasePlayers('seed-b');
assert(otherSeed.every(p=>p.ovr===supplied.find(entry=>entry.id===p.id).ovr),'OVR variabile cambiando carriera');
for(const club of catalogContext.window.FANTA_CLUBS.map(c=>c.id)) for(const role of ['P','D','C','A'])
  assert(players.some(p=>p.club===club&&p.role===role),`${club} senza ${role}`);
assert.equal(JSON.stringify(players),JSON.stringify(pokemonBasePlayers('seed-a')),'Generazione non stabile');
const avatarStart=source.indexOf('  function pixelPlayerAvatarData(');
const avatarEnd=source.indexOf('  function playerAvatarMarkup(',avatarStart);
const avatarContext={PLAYER_AVATAR_CACHE:new Map(),COACH_SHIRTS:{},clubColor:()=> '#584788'};
vm.createContext(avatarContext);
vm.runInContext(source.slice(avatarStart,avatarEnd)+'\nthis.avatar=pixelPlayerAvatarData;',avatarContext);
const avatars=players.map(player=>avatarContext.avatar(player));
assert.equal(new Set(avatars).size,players.length,'Alcuni Pokémon hanno la stessa faccina');
assert(avatars.every(uri=>uri.startsWith('data:image/svg+xml;')&&decodeURIComponent(uri).includes('viewBox="0 0 96 96"')),'Faccina Pokémon non valida');
assert.equal(avatarContext.PLAYER_AVATAR_CACHE.size,493,'Le faccine non vengono riutilizzate dalla cache');
assert.equal(avatarContext.avatar(players[0]),avatars[0],'L’avatar cambia tra due visualizzazioni');
const human=avatarContext.avatar({id:'human-1',name:'Giocatore',role:'C',club:'roma'});
assert.notEqual(human,avatars[0],'Gli avatar umani sono stati sostituiti');
const draft={catalogMode:'base',marketSeed:'seed-a',transferMarket:{seed:'base',history:['old']},playerBaseOvr:{'real-1':77},availableIds:[],leagueRules:{selectedCategories:['alternateCatalog'],catalogDecision:'reject'}};
applyCatalogDecision(draft);
assert.equal(draft.catalogMode,'base');
draft.leagueRules.catalogDecision='accept';applyCatalogDecision(draft);
assert.equal(draft.catalogMode,'pokemon');assert.equal(draft.availableIds.length,493);
assert.equal(draft.catalogWorlds.base.playerBaseOvr['real-1'],77);
draft.transferMarket.history.push('pokemon-transfer');draft.playerBaseOvr['pokemon-001']=91;
applyCatalogDecision(draft);
assert.equal(draft.catalogMode,'base');assert.equal(draft.playerBaseOvr['real-1'],77);assert.equal(draft.transferMarket.history[0],'old');
applyCatalogDecision(draft);
assert.equal(draft.catalogMode,'pokemon');assert.equal(draft.playerBaseOvr['pokemon-001'],91);assert.equal(draft.transferMarket.history[0],'pokemon-transfer');
const engineContext={window:catalogContext.window,console};vm.createContext(engineContext);
for(const file of ['js/auction-engine.js','js/transfer-engine.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),engineContext);
const auction={managers:Array.from({length:10},(_,i)=>({id:i?'cpu'+i:'user',budget:500,roster:[]})),availableIds:players.map(p=>p.id)};
for(const manager of auction.managers) for(const [role,count] of Object.entries({P:3,D:8,C:8,A:6})){
  let taken=0;
  for(const player of players){
    if(taken===count) break;
    if(player.role!==role || !auction.availableIds.includes(player.id)) continue;
    if(engineContext.window.FantaAuctionEngine.awardPlayer(auction,player,manager.id,1,{roleLimits:{P:3,D:8,C:8,A:6}}).ok) taken++;
  }
  assert.equal(taken,count,`${manager.id}: rosa ${role} incompleta`);
}
const transfer=engineContext.window.FantaTransferEngine;
const market=transfer.createMarketState('pokemon-market');
const plan=transfer.planWindow({windowType:'winter',seed:'pokemon-market|winter',players,clubs:catalogContext.window.FANTA_CLUBS,externalPool:market.foreignPool});
assert(plan.operations.length>0,'Mercato Pokémon non genera operazioni');
const world=transfer.materializeWorldPlayers(players,transfer.applyPlan(market,plan));
assert(world.activePlayers.length>0&&world.activePlayers.some(p=>p.id.startsWith('pokemon-')),'I Pokémon spariscono dopo il mercato');
console.log('OK: 493 Pokémon, ruoli sufficienti, valori stabili, rifiuto e alternanza dei mondi con stato preservato.');
