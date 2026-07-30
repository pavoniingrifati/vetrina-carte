#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/events/events-common.json'),'utf8'));
const namecc=catalog.decisions.find(event=>event.id==='campionato-a-namecc');
const cell=catalog.decisions.find(event=>event.id==='arriva-cell-sulla-terra');
assert(namecc&&namecc.choices?.length===2,'Evento Namecc mancante o incompleto');
assert(cell&&cell.choices?.length===2,'Evento Cell mancante o incompleto');
assert(namecc.order===221&&cell.order===222,'Ordine eventi Namecc/Cell errato');
assert(namecc.choices[0].applyHandler==='campionato-a-namecc:0','Handler Squadra Gimenez mancante');
assert(namecc.choices[1].applyHandler==='campionato-a-namecc:1','Handler Cahill mancante');
assert(cell.choices[0].applyHandler==='arriva-cell-sulla-terra:0','Handler Essere perfetto mancante');
assert(cell.choices[1].applyHandler==='arriva-cell-sulla-terra:1','Handler Cyborg mancante');

const players={p1:{id:'p1',name:'Uno',ovr:80},p2:{id:'p2',name:'Due',ovr:100}};
const context={
 console,Set,Map,Number,String,Array,Object,Boolean,Date,Error,JSON,Math:Object.create(Math),
 state:{seasonRules:{},teams:[{id:'user',name:'User',strength:75},{id:'a',name:'A',strength:70},{id:'b',name:'B',strength:80},{id:'c',name:'C',strength:90}],draft:{roster:[{playerId:'p1',player:{...players.p1}},{playerId:'p2',player:{...players.p2}}]},activeEffects:[],standings:{user:{pts:10}},matchday:4,phase:'season'},
 USER_ID:'user',SAVE_MODE:'community',FORMATIONS:{},startupNotice:'',
 playerById:id=>players[id]||null,
 rosterPlayers(){return context.state.draft.roster.map(entry=>({...entry,player:entry.player||players[entry.playerId]}))},
 refreshOpponentClubRosters(){context._refreshed=(context._refreshed||0)+1},
 seasonLength:()=>38,shuffle:list=>[...list],isTeamEliminated:()=>false,userStanding:()=>context.state.standings.user,
 pick:list=>list?.[0]||null,pushSeasonEffect(){},setTimeout(){},localStorage:{setItem(){},getItem(){return null},removeItem(){}},location:{href:''}
};
context.globalThis=context;context.window=context;
vm.createContext(context);
const handlerSource=fs.readFileSync(path.join(root,'assets/season/event-handlers.js'),'utf8');
vm.runInContext(handlerSource,context,{filename:'event-handlers.js'});

context.activateNameccOpponentRule('gimenez');
assert(context.state.seasonRules.nameccOpponentRule==='gimenez','Squadra Gimenez non attivata');
for(const team of context.state.teams.filter(team=>team.id!=='user')){
 const value=Number(context.state.seasonRules.nameccOpponentOvrs[team.id]);
 assert(Number.isInteger(value)&&value>=50&&value<=200,`OVR Namecc fuori intervallo per ${team.id}`);
 assert(context.nameccOpponentRuleOvr(team)===value,`OVR Namecc non stabile per ${team.id}`);
}
context.state.seasonRules={};
context.activateNameccOpponentRule('cahill');
assert(context.state.teams.filter(team=>team.id!=='user').every(team=>context.nameccOpponentRuleOvr(team)===90),'Cahill non fissa tutti gli avversari a 90 OVR');

context.state.seasonRules={};
context.state.draft.roster=[{playerId:'p1',player:{...players.p1}},{playerId:'p2',player:{...players.p2}}];
context.activateCellPerfect();
let result={winnerId:'user',eventUpdates:[]};
context.applyCellPerfectAfterMatch(result);
assert(context.state.draft.roster[0].player.ovr===81&&context.state.draft.roster[1].player.ovr===101,'La vittoria con Essere perfetto non assegna +1 OVR esatto');
assert(result.cellPerfectOutcome?.type==='victory-boost','Esito vittoria Cell non registrato');
result={winnerId:'a',eventUpdates:[]};
context.applyCellPerfectAfterMatch(result);
assert(context.state.draft.roster.every(entry=>entry.player.ovr===60),'La sconfitta con Essere perfetto non porta tutti a 60 OVR');
assert(result.cellPerfectOutcome?.type==='defeat-reset','Esito sconfitta Cell non registrato');

context.state.seasonRules={};
context.state.draft.roster=[{playerId:'p1',player:{...players.p1}},{playerId:'p2',player:{...players.p2}}];
context.state.activeEffects=[{type:'teamOvr',value:-8,rounds:4},{type:'teamChem',value:-5,rounds:3},{type:'teamChemMultiplier',value:.5,rounds:6},{type:'teamOvr',value:4,rounds:2}];
context.activateCellCyborg();
assert(context.state.activeEffects.length===1&&context.state.activeEffects[0].value===4,'Cyborg non neutralizza i malus già attivi');
assert(context.cyborgBlocksTeamEffect('teamOvr',-3)===true,'Cyborg non blocca un malus OVR');
assert(context.cyborgBlocksTeamEffect('teamChem',-2)===true,'Cyborg non blocca un malus Intesa');
assert(context.cyborgBlocksTeamEffect('teamOvr',3)===false,'Cyborg blocca erroneamente un bonus positivo');
context.state.draft.roster[0].player.ovr=25;
const restored=context.cyborgRestoreProtectedRoster();
assert(restored.length===1&&context.state.draft.roster[0].player.ovr===80,'Cyborg non ripristina un OVR abbassato direttamente');

const source05=fs.readFileSync(path.join(root,'assets/season/05-opponents-and-chaos.js'),'utf8');
const source07=fs.readFileSync(path.join(root,'assets/season/07-effects-quests-chains.js'),'utf8');
const source08=fs.readFileSync(path.join(root,'assets/season/08-special-rules.js'),'utf8');
const source10=fs.readFileSync(path.join(root,'assets/season/10-events.js'),'utf8');
const source12=fs.readFileSync(path.join(root,'assets/season/12-match-simulation.js'),'utf8');
assert(source05.includes("nameccOpponentRuleOvr(team)"),'Override OVR Namecc non collegato alla potenza avversaria');
assert(source07.includes("cyborgBlocksTeamEffect(type,value)"),'Blocco Cyborg non collegato agli effetti temporanei');
assert(source08.includes("recordCyborgBlockedMalus"),'Blocco Cyborg non collegato ai malus permanenti');
assert(source10.includes("cyborgRestoreProtectedRoster"),'Ripristino Cyborg non collegato alle scelte evento');
assert(source12.includes("applyCellPerfectAfterMatch(result)"),'Regola Essere perfetto non collegata al post-partita');

console.log(JSON.stringify({ok:true,checks:[
 'catalogo eventi Namecc e Cell',
 'Squadra Gimenez 50-200 con valore stabile',
 'Cahill 90 OVR',
 'Essere perfetto: +1 dopo vittoria',
 'Essere perfetto: 60 OVR dopo sconfitta',
 'Cyborg: blocco malus OVR e Intesa',
 'Cyborg: ripristino OVR diretto',
 'collegamenti al motore partita'
]},null,2));
