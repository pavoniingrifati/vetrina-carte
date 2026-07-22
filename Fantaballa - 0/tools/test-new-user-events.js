#!/usr/bin/env node
const fs=require('fs');const path=require('path');const vm=require('vm');
const root=path.resolve(__dirname,'..');
function assert(cond,msg){if(!cond)throw new Error(msg)}
function makePlayer(id,name,ovr,Position='CC',role='C'){return{id:String(id),name,ovr,baseOvr:ovr,Position,role,roleLabel:role==='P'?'Portiere':role==='A'?'Attaccante':'Centrocampista',nation:'Italia'}}
function makeState(){
 const players=[
  makePlayer('p1','Portiere',70,'P','P'),makePlayer('p2','Scarso',60,'CC','C'),makePlayer('p3','Attaccante',80,'ATT','A'),makePlayer('p4','Ala',75,'AS','A'),
  ...Array.from({length:7},(_,i)=>makePlayer(`s${i}`,`Titolare ${i}`,72+i,'CC','C')),
  makePlayer('b1','Riserva 1',66,'CC','C'),makePlayer('b2','Riserva 2',67,'ATT','A'),makePlayer('b3','Riserva 3',68,'P','P')
 ];
 const roster=players.map((player,index)=>({playerId:player.id,player:{...player},bench:index>=11,slot:index>=11?`R${index-10}`:(index===0?'P':index===2?'ATT':index===3?'AS':'CC'),slotId:index>=11?`bench-${index-10}`:`starter-${index}`,malus:0}));
 return{matchday:2,formation:'4-3-3',teamName:'Test Team',draft:{roster},statuses:{},playInjured:{},seasonRules:{generatedEventPlayers:[]},teams:[{id:'user',name:'Test Team',roster:[]},{id:'opp1',name:'Avversari',clubId:'opp1',roster:[]}],activeEffects:[]};
}
const context={console,Set,Map,Number,String,Array,Object,Boolean,Date,Error,JSON,Math:Object.create(Math),USER_ID:'user',POSITION_ROLE:{P:'P',CC:'C',ATT:'A',AS:'A',AD:'A',DC:'D',TS:'D',TD:'D',CDC:'C',COC:'C'}};
context.globalThis=context;context.window=context;context.state=makeState();
context.clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
context.pick=list=>Array.isArray(list)&&list.length?list[0]:null;
context.positions=p=>String(p?.Position||'').split(',').map(x=>x.trim()).filter(Boolean);
context.roleOf=p=>p?.role||context.POSITION_ROLE[context.positions(p)[0]]||'C';
context.userCompatible=(p,slot)=>context.positions(p).includes(slot)||context.roleOf(p)===context.POSITION_ROLE[slot];
context.playerById=id=>{
 const sid=String(id);for(const entry of context.state.draft.roster){if(String(entry.playerId)===sid)return entry.player}
 return context.state.seasonRules.generatedEventPlayers.find(p=>String(p.id)===sid)||null;
};
context.rosterEntry=id=>context.state.draft.roster.find(e=>String(e.playerId)===String(id))||null;
context.rosterPlayers=()=>context.state.draft.roster.map(e=>({...e,player:e.player||context.playerById(e.playerId)})).filter(e=>e.player);
context.getStarterEntries=()=>context.rosterPlayers().filter(e=>!e.bench);
context.startingGoalkeeperEntry=()=>context.getStarterEntries().find(e=>context.roleOf(e.player)==='P')||null;
context.seasonLength=()=>38;
context.registerGeneratedEventPlayer=player=>{const p={...player,id:String(player.id)};const i=context.state.seasonRules.generatedEventPlayers.findIndex(x=>String(x.id)===p.id);if(i>=0)context.state.seasonRules.generatedEventPlayers[i]=p;else context.state.seasonRules.generatedEventPlayers.push(p);return p};
context.refreshOpponentClubRosters=()=>{};
context.talentScoutBlocksExternalArrival=()=>false;context.talentScoutBlockMessage=()=>'';
context.clearMandatoryMidseasonPlayer=()=>{};
context.setPermanentRosterOvr=(entry,value)=>{const raw=context.rosterEntry(entry.playerId);if(!raw)return null;const before=Number(raw.player.ovr);raw.player={...raw.player,ovr:Math.max(1,Math.round(value))};return{player:raw.player,before,after:raw.player.ovr}};
context.removeOwnRosterPlayerPermanently=(entry,reason='')=>{const i=context.state.draft.roster.findIndex(x=>String(x.playerId)===String(entry.playerId));if(i<0)return'Non presente';const name=context.state.draft.roster[i].player.name;context.state.draft.roster.splice(i,1);return`${name} lascia definitivamente la squadra${reason?` per ${reason}`:''}.`};
context.pushEffect=(type,value,rounds,extra={})=>{context.state.activeEffects.push({type,value,rounds,...extra});return context.state.activeEffects.at(-1)};
context.buildTeamGoals=(total,lineup,team,opponent)=>Array.from({length:total},(_,i)=>({minute:20+i,playerId:String(lineup[0]?.playerId||''),player:lineup[0]?.player?.name||'Marcatore',teamId:String(team?.id||''),teamName:team?.name||'',goalValue:1,description:'Gol'}));
context.regulationGoalEvent=(team,opponent,duration,label)=>({minute:20,playerId:'',player:label||'Gol',teamId:String(team?.id||''),teamName:team?.name||'',goalValue:1,description:'Gol'});
context.goalValueForMinute=()=>1;
context.boostAllRosterPlayers=delta=>{const names=[];for(const e of context.state.draft.roster){e.player={...e.player,ovr:Number(e.player.ovr)+delta};names.push(e.player.name)}return names};
context.queueChainedAuto=(title,text,result)=>({title,text,result});
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'assets/season/08b-user-events.js'),'utf8'),context,{filename:'08b-user-events.js'});
function reset(){context.state=makeState();context.Math.random=Math.random}
function randomSequence(values){let i=0;context.Math.random=()=>values[Math.min(i++,values.length-1)]}
const tests=[];function test(name,fn){reset();fn();tests.push(name)}

test('rigorista: selezione del titolare più debole e gol +5',()=>{const c=context.improvisedPenaltyContext();assert(c.playerId==='p2','Il rigorista deve essere il titolare con OVR più basso');context.acceptImprovisedPenalty(c);randomSequence([0,0]);const events=[];const out=context.applyImprovisedPenaltyDuringMatch(events,context.getStarterEntries(),{id:'user',name:'Test'},{id:'opp1',name:'Opp'},90);assert(out.awarded&&out.scored,'Il rigore deve essere segnato');assert(events.length===1,'Manca il gol su rigore');assert(context.rosterEntry('p2').player.ovr===65,'Bonus +5 non applicato')});

test('fratello: ingresso in rosa e parte 2',()=>{const c={playerId:'p3',playerName:'Attaccante'};context.acceptWeakBrother(c);const chain=context.weakBrotherState();assert(context.rosterEntry(chain.brotherId),'Il fratello non è entrato in rosa');assert(context.rosterEntry(chain.brotherId).player.ovr===50,'OVR fratello errato');randomSequence([0]);context.resolveWeakBrotherSecondAct();assert(context.rosterEntry('p3').player.ovr===100,'Bonus +20 al giocatore originale non applicato')});

test('fratello rifiutato: gol garantito contro',()=>{const c={playerId:'p3',playerName:'Attaccante'};context.rejectWeakBrother(c);const chain=context.weakBrotherState(),events=[];const target=context.state.teams.find(t=>t.id===chain.targetTeamId);const out=context.applyWeakBrotherOpponentGoal(events,target,{id:'user'},90);assert(out&&events.length===1,'Gol garantito del fratello non applicato')});

test('portiere: gol, contropiede e +10',()=>{const c=context.goalkeeperScorerContext();context.acceptGoalkeeperScorer(c);randomSequence([0,0]);const user=[],opp=[];const outcome=context.applyGoalkeeperScorerDuringMatch(user,opp,context.getStarterEntries(),context.getStarterEntries(),{id:'user',name:'Test'},{id:'opp1',name:'Opp'},90);assert(outcome.scored&&outcome.counterattack,'Esito portiere incompleto');context.tickAdditionalUserEventsAfterMatch({gf:2,ga:1,goalkeeperScorer:outcome,eventUpdates:[]});assert(context.rosterEntry('p1').player.ovr===80,'Bonus +10 al portiere non applicato')});

test('contratto: gol doppio e uscita dopo 3 partite',()=>{context.acceptBadContract({playerId:'p3',playerName:'Attaccante'});const events=[{playerId:'p3',goalValue:1,description:'Gol'}];const outcome=context.applyBadContractGoalRule(events);assert(events[0].goalValue===2&&outcome.doubled===1,'Gol non raddoppiato');for(let i=0;i<3;i++)context.tickAdditionalUserEventsAfterMatch({gf:1,ga:0,badContract:i===0?outcome:{playerId:'p3',playerName:'Attaccante',doubled:0},eventUpdates:[]});assert(!context.rosterEntry('p3'),'Il giocatore non ha lasciato la rosa')});

test('modulo internet: ripristino e bonus vittoria',()=>{const old=context.state.formation;context.acceptInternetFormation();const chosen=context.state.formation;assert(chosen!==old,'Il modulo non è cambiato');const before=context.rosterEntry('p2').player.ovr;context.tickAdditionalUserEventsAfterMatch({gf:2,ga:0,lineup:context.getStarterEntries().map(e=>({playerId:e.playerId})),eventUpdates:[]});assert(context.state.formation===old,'Il modulo originale non è stato ripristinato');assert(context.rosterEntry('p2').player.ovr===before+2,'Bonus rosa +2 non applicato')});

test('sfortuna: panchina e uscita dopo sconfitta',()=>{context.benchBadLuckPlayer({playerId:'p2',playerName:'Scarso'});assert(context.rosterEntry('p2').bench,'Il giocatore non è stato messo in panchina');context.tickAdditionalUserEventsAfterMatch({gf:0,ga:1,eventUpdates:[]});assert(!context.rosterEntry('p2'),'Il giocatore non ha lasciato la rosa dopo la sconfitta')});

console.log(JSON.stringify({ok:true,tests:tests.length,names:tests},null,2));
