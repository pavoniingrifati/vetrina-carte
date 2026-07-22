#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/season/07b-items.js'),'utf8')+`
globalThis.__items={seasonInventory,seasonItemQuantity,addSeasonItem,useCaptainArmband,resolveCaptainArmbandAfterMatch,captainArmbandActive,acceptLeaderQuest,chooseLeaderQuestPlayer,tickLeaderQuestAfterMatch};`;

function createContext(){
  const player={id:'10',name:'Capitano Test',ovr:80,Position:'CC'};
  const entry={playerId:'10',player,bench:false,slot:'CC',slotId:'CC1',captainForcedMatches:0,leaderQuestForcedMatches:0,tipsterForcedMatches:0};
  const state={matchday:4,inventory:{capacity:3,items:[{id:'captain-armband',quantity:1}],active:null},activeEffects:[],roster:[entry],quest:{active:false}};
  let lastFinish=null;
  const unlocked=[];
  const context={
    console,state,USER_ID:'user',
    clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),
    getStarterEntries:()=>state.roster.filter(x=>!x.bench),
    statusOf:()=>({seasonOut:false,injury:0,suspension:0}),
    temporaryEventBlocksPlayer:()=>false,
    rosterEntry:id=>state.roster.find(x=>String(x.playerId)===String(id))||null,
    rosterPlayers:()=>state.roster,
    userCompatible:()=>true,
    playerById:id=>String(id)==='10'?player:null,
    unlockAchievement:id=>unlocked.push(id),
    recordSeasonEvent:()=>{},analyticsSnapshot:()=>({}),
    esc:value=>String(value),document:{querySelectorAll:()=>[]},save:()=>{},render:()=>{},toast:()=>{},
    questState:()=>state.quest,startSeasonQuest:data=>{state.quest={active:true,status:'active',matchesPlayed:0,progress:0,targetPlayerId:'',targetPlayerName:'',...data};return 'Quest avviata.'},finishSeasonQuest:(success,message)=>{lastFinish={success,message};state.quest.active=false},
    Math,Number,String,Array,Object,Boolean,JSON,Set,Map
  };
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(source,context,{filename:'07b-items.js'});
  return {context,state,entry,unlocked,api:context.__items,getLastFinish:()=>lastFinish};
}
function assert(value,message){if(!value)throw new Error(message)}
const tests=[];
function test(name,fn){try{fn();tests.push({name,ok:true})}catch(error){tests.push({name,ok:false,error:error.message})}}

test('Uso: assegna +5 OVR, forza il titolare e sblocca achievement',()=>{
  const {api,state,entry,unlocked}=createContext();
  const message=api.useCaptainArmband('10');
  assert(message.includes('+5 OVR'),'Messaggio uso non corretto');
  assert(api.seasonItemQuantity('captain-armband')===0,'Oggetto non rimosso dall’inventario durante l’uso');
  assert(api.captainArmbandActive()?.playerId==='10','Oggetto attivo assente');
  assert(state.activeEffects.some(x=>x.itemId==='captain-armband'&&x.value===5&&x.rounds===1),'Bonus +5 non applicato');
  assert(entry.captainForcedMatches===1,'Capitano non forzato titolare');
  assert(unlocked.includes('capitano-mio-capitano'),'Achievement non sbloccato');
});

test('Gol del capitano: fascia restituita',()=>{
  const {api}=createContext();api.useCaptainArmband('10');
  const result={lineup:[{playerId:'10'}],goals:[{playerId:'10'}],mvpId:'20',mvpTeamId:'user'};
  const update=api.resolveCaptainArmbandAfterMatch(result);
  assert(update?.success===true,'Esito conservazione non positivo');
  assert(api.seasonItemQuantity('captain-armband')===1,'Fascia non restituita dopo il gol');
  assert(!api.captainArmbandActive(),'Fascia rimasta attiva');
});

test('MVP del capitano: fascia restituita',()=>{
  const {api}=createContext();api.useCaptainArmband('10');
  const result={lineup:[{playerId:'10'}],goals:[],mvpId:'10',mvpTeamId:'user'};
  api.resolveCaptainArmbandAfterMatch(result);
  assert(api.seasonItemQuantity('captain-armband')===1,'Fascia non restituita dopo MVP');
});

test('Né gol né MVP: fascia consumata',()=>{
  const {api}=createContext();api.useCaptainArmband('10');
  const result={lineup:[{playerId:'10'}],goals:[],mvpId:'20',mvpTeamId:'user'};
  const update=api.resolveCaptainArmbandAfterMatch(result);
  assert(update?.success===false,'Esito consumo non negativo');
  assert(api.seasonItemQuantity('captain-armband')===0,'Fascia non consumata');
});

test('Partita non disputata dal capitano: fascia restituita',()=>{
  const {api}=createContext();api.useCaptainArmband('10');
  const result={lineup:[],goals:[],mvpId:'',mvpTeamId:'user'};
  api.resolveCaptainArmbandAfterMatch(result);
  assert(api.seasonItemQuantity('captain-armband')===1,'Fascia persa senza utilizzo effettivo');
});


test('Quest leader: due titolarità e due punti assegnano la fascia',()=>{
  const {api,state,entry,getLastFinish}=createContext();
  state.inventory.items=[];
  api.acceptLeaderQuest();
  assert(state.quest.awaitingPlayerSelection===true,'La quest non richiede la scelta del leader');
  api.chooseLeaderQuestPlayer('10');
  assert(entry.leaderQuestForcedMatches===2,'Leader non forzato per due partite');
  api.tickLeaderQuestAfterMatch({lineup:[{playerId:'10'}],pointsAwarded:1,ownSuspensionId:''});
  assert(state.quest.active===true&&state.quest.progress===1,'Progresso prima partita errato');
  api.tickLeaderQuestAfterMatch({lineup:[{playerId:'10'}],pointsAwarded:1,ownSuspensionId:''});
  assert(getLastFinish()?.success===true,'Quest non completata con successo');
  assert(api.seasonItemQuantity('captain-armband')===1,'Fascia non assegnata come ricompensa');
  assert(entry.leaderQuestForcedMatches===0,'Vincolo del leader non rimosso');
});

test('Quest leader: cartellino rosso causa fallimento senza ricompensa',()=>{
  const {api,state,getLastFinish}=createContext();
  state.inventory.items=[];
  api.acceptLeaderQuest();api.chooseLeaderQuestPlayer('10');
  api.tickLeaderQuestAfterMatch({lineup:[{playerId:'10'}],pointsAwarded:3,ownSuspensionId:'10'});
  assert(getLastFinish()?.success===false,'Quest non fallita dopo il rosso');
  assert(api.seasonItemQuantity('captain-armband')===0,'Ricompensa assegnata nonostante il fallimento');
});

const report={ok:tests.every(x=>x.ok),summary:{total:tests.length,passed:tests.filter(x=>x.ok).length,failed:tests.filter(x=>!x.ok).length},tests};
console.log(JSON.stringify(report,null,2));
fs.writeFileSync(path.join(root,'TEST-OGGETTI-FASCIA.json'),JSON.stringify(report,null,2));
process.exitCode=report.ok?0:1;
