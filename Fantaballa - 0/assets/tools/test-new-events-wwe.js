const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/events/events-common.json'),'utf8'));
const event=catalog.decisions.find(item=>item.id==='arriva-la-wwe');
assert(event&&event.choices?.length===2,'Evento Arriva la WWE mancante o incompleto');
assert(event.choices[0].applyHandler==='arriva-la-wwe:0','Handler Watch out mancante');
assert(event.choices[1].applyHandler==='arriva-la-wwe:1','Handler Royal Rumble mancante');

const handlerSource=fs.readFileSync(path.join(root,'assets/season/event-handlers.js'),'utf8');
const handlerContext={
 console,
 state:{seasonRules:{},teams:[{id:'user',name:'User'},{id:'a',name:'A'},{id:'b',name:'B'}],standings:{user:{pts:17}},matchday:9,phase:'season'},
 USER_ID:'user',
 seasonLength:()=>38,
 shuffle:value=>[...value],
 isTeamEliminated:()=>false,
 userStanding:()=>handlerContext.state.standings.user,
 Date
};
vm.createContext(handlerContext);
vm.runInContext(handlerSource,handlerContext);
const watchText=vm.runInContext("SEASON_EVENT_HANDLERS.choiceApply['arriva-la-wwe:0']()",handlerContext);
assert(handlerContext.state.seasonRules.wweRule==='watch-out','Watch out non attivato');
assert(/gol normali non contano/i.test(watchText),'Testo Watch out non coerente');
handlerContext.state.seasonRules={};handlerContext.state.phase='season';
const royalText=vm.runInContext("SEASON_EVENT_HANDLERS.choiceApply['arriva-la-wwe:1']()",handlerContext);
assert(handlerContext.state.phase==='royal-rumble','Fase Royal Rumble non attivata');
assert(handlerContext.state.seasonRules.royalRumble.startingPoints===17,'Punti iniziali Royal Rumble non conservati');
assert(handlerContext.state.seasonRules.royalRumble.queue.length===2,'Coda Royal Rumble errata');
assert(/17 punti/i.test(royalText),'Messaggio Royal Rumble senza punti conservati');

const matchSource=fs.readFileSync(path.join(root,'assets/season/12-match-simulation.js'),'utf8');
const statuses={};
const matchContext={
 console,
 state:{seasonRules:{wweRule:'watch-out'}},
 pick:list=>list[0],
 statusOf:id=>(statuses[id]||(statuses[id]={injury:0,suspension:0})),
 opponentStatusOf:(team,id)=>{team.statuses=team.statuses||{};return team.statuses[id]||(team.statuses[id]={injury:0,suspension:0})}
};
vm.createContext(matchContext);
vm.runInContext(matchSource,matchContext);
matchContext.teamA={id:'user',name:'User'};matchContext.teamB={id:'opp',name:'Opp',statuses:{}};
matchContext.lineupA=[{playerId:'u1',player:{id:'u1',name:'Uno'}},{playerId:'u2',player:{id:'u2',name:'Due'}}];
matchContext.lineupB=[{playerId:'o1',player:{id:'o1',name:'Tre'}}];
matchContext.eventsA=[{player:'Gol normale'}];matchContext.eventsB=[{player:'Gol normale avversario'}];
const outcome=vm.runInContext(`applyWweWatchOutToMatch({teamA,teamB,lineupA,lineupB,eventsA,eventsB,redsA:[lineupA[0]],injuriesA:[{playerId:'u2',name:'Due',duration:2}],redsB:[lineupB[0]],randomIncidents:false})`,matchContext);
assert(outcome.scoreA===2&&outcome.scoreB===1,'Conteggio gol Watch out errato');
assert(matchContext.eventsA.length===2&&matchContext.eventsB.length===1,'I gol normali non sono stati sostituiti');
assert(matchContext.eventsA.every(item=>item.isWweIncidentGoal),'Eventi gol WWE non marcati');

const runtime=fs.readFileSync(path.join(root,'assets/season/14-runtime.js'),'utf8');
const finish=fs.readFileSync(path.join(root,'assets/season/13-market-and-finish.js'),'utf8');
assert(runtime.includes("state.phase==='royal-rumble'"),'Routing Royal Rumble assente');
assert(finish.includes('Campione della Royal Rumble!'),'Finale Royal Rumble assente');

console.log(JSON.stringify({ok:true,checks:['catalogo WWE','attivazione Watch out','attivazione Royal Rumble','punti conservati','conteggio infortuni e rossi','routing e finale']},null,2));
