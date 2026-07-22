#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/season/07b-items.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'assets/season/08b-user-events.js'),'utf8')+`
globalThis.__api={seasonItemQuantity,seasonInventoryUsedSlots,collinaWhistleCanSkipEvent,useCollinaWhistleToSkipEvent,refereeDesignationState,refereeDesignationAvailable,acceptMariaSoleDesignation,acceptRosarioDesignation,resolveRefereeDesignationAfterMatch};`;
function createContext(){
 const players={10:{id:'10',name:'Giocatore Test',ovr:80,Position:'CC'}};
 const state={matchday:4,seasonRules:{},inventory:{capacity:3,items:[],active:null},pendingEvent:null,activeEffects:[],statuses:{10:{injury:0,suspension:0,seasonOut:false}},draft:{roster:[]}};
 const eventLog=[];
 const ctx={console,state,USER_ID:'user',seasonEventMinimized:false,seasonEventUiKey:'',
  clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),
  pick:arr=>(arr||[])[0]||null,
  seasonLength:()=>38,
  remainingSeasonMatches:()=>34,
  pushEffect:(type,value,rounds,extra={})=>state.activeEffects.push({type,value,rounds,...extra}),
  pushSeasonEffect:(type,value,extra={})=>state.activeEffects.push({type,value,rounds:34,untilSeasonEnd:true,...extra}),
  analyticsSnapshot:()=>({}),recordSeasonEvent:e=>eventLog.push(e),
  decisionFromPending:e=>e?.kind==='decision'?{id:e.decisionId||'test',choices:[{apply:()=>{throw new Error('La scelta non deve essere applicata')}}]}:null,
  playerById:id=>players[String(id)]||null,statusOf:id=>state.statuses[String(id)]||(state.statuses[String(id)]={injury:0,suspension:0,seasonOut:false}),
  getStarterEntries:()=>[],rosterPlayers:()=>[],rosterEntry:()=>null,temporaryEventBlocksPlayer:()=>false,userCompatible:()=>true,
  esc:String,document:{querySelectorAll:()=>[]},save:()=>{},render:()=>{},toast:()=>{},unlockAchievement:()=>{},
  questState:()=>({}),startSeasonQuest:()=>'',finishSeasonQuest:()=>{},recordSeasonEvent:e=>eventLog.push(e),
  userStanding:()=>null,sortedTable:()=>[],teamById:()=>null,statusOfOpponent:()=>null,
  Math,Number,String,Array,Object,Boolean,JSON,Set,Map
 };
 ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'items-user-events.js'});
 return {ctx,state,api:ctx.__api,eventLog};
}
function assert(v,m){if(!v)throw new Error(m)}
const tests=[];function test(name,fn){try{fn();tests.push({name,ok:true})}catch(error){tests.push({name,ok:false,error:error.message})}}

test('Maria Sole riserva il premio e garantisce il rosso per 3 partite',()=>{
 const {api,state}=createContext();const message=api.acceptMariaSoleDesignation();
 assert(message.includes('prossime 3 partite'),'Messaggio errato');
 assert(api.seasonItemQuantity('collina-whistle-reserved')===1,'Slot premio non riservato');
 const effect=state.activeEffects.find(e=>e.source?.includes('Maria Sole'));
 assert(effect&&effect.rounds===3&&effect.ownRedChance===1,'Rosso garantito non configurato');
});

test('Tre partite senza sconfitte assegnano il Fischietto',()=>{
 const {api,state}=createContext();api.acceptMariaSoleDesignation();
 for(let i=0;i<3;i++)api.resolveRefereeDesignationAfterMatch({gf:i===0?1:0,ga:0,lineup:[{playerId:'10',name:'Giocatore Test'}],ownRedCard:false,eventUpdates:[]});
 assert(api.seasonItemQuantity('collina-whistle')===1,'Fischietto non assegnato');
 assert(api.seasonItemQuantity('collina-whistle-reserved')===0,'Prenotazione non rimossa');
 assert(api.refereeDesignationState().rewardGranted===true,'Premio non registrato');
 assert(state.statuses['10'].suspension>=1,'Espulsione garantita non applicata');
});

test('Una sconfitta fa fallire la prova',()=>{
 const {api}=createContext();api.acceptMariaSoleDesignation();
 api.resolveRefereeDesignationAfterMatch({gf:0,ga:1,lineup:[{playerId:'10',name:'Giocatore Test'}],ownRedCard:true,ownSuspensionPlayer:'Giocatore Test',eventUpdates:[]});
 api.resolveRefereeDesignationAfterMatch({gf:1,ga:1,lineup:[{playerId:'10',name:'Giocatore Test'}],ownRedCard:true,ownSuspensionPlayer:'Giocatore Test',eventUpdates:[]});
 api.resolveRefereeDesignationAfterMatch({gf:2,ga:1,lineup:[{playerId:'10',name:'Giocatore Test'}],ownRedCard:true,ownSuspensionPlayer:'Giocatore Test',eventUpdates:[]});
 assert(api.seasonItemQuantity('collina-whistle')===0,'Fischietto assegnato dopo una sconfitta');
 assert(api.seasonItemQuantity('collina-whistle-reserved')===0,'Prenotazione non liberata dopo fallimento');
});

test('Rosario aumenta leggermente i rossi fino a fine stagione',()=>{
 const {api,state}=createContext();api.acceptRosarioDesignation();
 const effect=state.activeEffects.find(e=>e.source?.includes('Rosario'));
 assert(effect&&effect.ownRedChance===.12&&effect.untilSeasonEnd===true,'Effetto Rosario errato');
});

test('Il Fischietto salta una decisione e viene consumato',()=>{
 const {api,state,eventLog}=createContext();state.inventory.items=[{id:'collina-whistle',quantity:1}];
 state.pendingEvent={kind:'decision',resolved:false,title:'Evento sgradito',decisionId:'test',decisionIndex:0,context:{}};
 assert(api.collinaWhistleCanSkipEvent(state.pendingEvent),'Evento compatibile non riconosciuto');
 const message=api.useCollinaWhistleToSkipEvent();
 assert(message.includes('nessuna opzione'),'Messaggio salto errato');
 assert(state.pendingEvent.resolved===true&&state.pendingEvent.skippedWithItem==='collina-whistle','Evento non risolto come saltato');
 assert(api.seasonItemQuantity('collina-whistle')===0,'Fischietto non consumato');
 assert(eventLog.length===1&&eventLog[0].choice==='Fischietto di Collina','Uso oggetto non registrato');
});

test('Gli eventi concatenati non sono saltabili',()=>{
 const {api,state}=createContext();state.inventory.items=[{id:'collina-whistle',quantity:1}];
 state.pendingEvent={kind:'decision',resolved:false,chained:true,title:'Evento concatenato',decisionId:'test'};
 assert(!api.collinaWhistleCanSkipEvent(state.pendingEvent),'Evento concatenato considerato compatibile');
});

const report={ok:tests.every(x=>x.ok),summary:{total:tests.length,passed:tests.filter(x=>x.ok).length,failed:tests.filter(x=>!x.ok).length},tests};
console.log(JSON.stringify(report,null,2));
fs.writeFileSync(path.join(root,'TEST-FISCHIETTO-COLLINA.json'),JSON.stringify(report,null,2));
process.exitCode=report.ok?0:1;
