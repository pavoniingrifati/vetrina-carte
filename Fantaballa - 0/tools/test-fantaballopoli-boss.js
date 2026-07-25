const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const source=fs.readFileSync(require('path').join(__dirname,'../assets/season/06-competitions-and-stories.js'),'utf8');
const marketSource=fs.readFileSync(require('path').join(__dirname,'../assets/season/13-market-and-finish.js'),'utf8');
const fantaDefaults=()=>({
 initialized:false,scheduled:false,triggerMatchday:-1,stage:'idle',path:'',forcedLossPending:false,
 targetPlayerId:'',targetPlayerName:'',targetRole:'',targetTradeOrdered:false,targetTraded:false,targetLocked:false,
 midseasonResolved:false,giudaId:'',power:0,suspicion:0,completed:false,
 cartonati:{arbitro:false,giuda:false,silenzio:false},
 intercettazioni:{arbitro:false,testimone:false,triade:false},
 challenge:{id:'',active:false,status:'idle',matchesPlayed:0,matchesRequired:0,progress:0,scored:false,lastMatchday:-1,resultText:'',nextId:''},
 lastChallengeResult:null,
 finale:{eligible:false,bossId:'',bossName:'',played:false,userGoals:0,opponentGoals:0,won:false,extraTime:false,penalties:null,notes:[],userScorers:[],opponentScorers:[],activePowers:[],pointsApplied:false,rankBeforeBonus:0,rankAfterBonus:0,pointsBeforeBonus:0,pointsAfterBonus:0}
});
const players=[
 {id:'p1',name:'Testimone',ovr:95,Position:'ATT',role:'A'},
 {id:'p2',name:'Secondo',ovr:82,Position:'CC',role:'C'},
 {id:'p3',name:'Terzo',ovr:78,Position:'DC',role:'D'}
];
const makeState=()=>({
 phase:'season',matchday:4,teamName:'Fantaballa FC',meta:{createdAt:'2026-07-25T00:00:00Z'},
 story:{fantaballopoli:fantaDefaults(),merit:{},error404:{}},pendingEvent:null,
 draft:{roster:players.map((player,index)=>({playerId:player.id,player:{...player},slot:player.Position,bench:index>1}))},
 statuses:{},playInjured:{},seasonRules:{mandatoryMidseasonPlayerIds:[],mandatoryMidseasonPlayerId:'',generatedEventPlayers:[]},
 midseason:{changes:[]},standings:{user:{id:'user',pts:60,gf:40,ga:20,w:18,d:6,l:4}},teams:[{id:'user',name:'Fantaballa FC'}],schedule:[]
});
let state=makeState();
const unlocked=[];
const context={
 console,Math,Date,JSON,Object,Array,String,Number,Boolean,Set,Map,
 state,USER_ID:'user',PLAYERS:players,REAL_PLAYERS:[],CLASSIC_PLAYERS:[],OTHER_CLUBS:[],
 freshState:()=>({story:{fantaballopoli:fantaDefaults(),merit:{},error404:{}},cup:{}}),
 rosterPlayers:()=>state.draft.roster,
 activeOvrBonus:()=>0,
 draftChemistry:()=>({score:0,playerBonus:{}}),resolveRosterLineup:entries=>entries.filter(entry=>!entry.bench),resolvedLineupAverage:lineup=>lineup.length?lineup.reduce((sum,entry)=>sum+(Number(entry.player?.ovr)||0),0)/lineup.length:0,effectiveChemistryFromBase:()=>0,
 rosterEntry:id=>state.draft.roster.find(entry=>String(entry.playerId)===String(id))||null,
 playerById:id=>state.draft.roster.find(entry=>String(entry.playerId)===String(id))?.player||state.seasonRules.generatedEventPlayers.find(player=>String(player.id)===String(id))||players.find(player=>String(player.id)===String(id))||null,
 roleOf:player=>player?.role||({P:'P',DC:'D',TD:'D',TS:'D',CC:'C',CDC:'C',COC:'C',AD:'A',AS:'A',ATT:'A'}[player?.Position||player?.position]||'A'),
 refreshOpponentClubRosters:()=>{},
 registerGeneratedEventPlayer:player=>{const i=state.seasonRules.generatedEventPlayers.findIndex(item=>item.id===player.id);if(i>=0)state.seasonRules.generatedEventPlayers[i]={...player};else state.seasonRules.generatedEventPlayers.push({...player});return state.seasonRules.generatedEventPlayers.find(item=>item.id===player.id)},
 coachIs:()=>false,youngBeautifulAllowsPlayer:()=>true,userCompatible:()=>true,requiresEqualOrBetterMidseason:()=>false,coachHighOvrPick:pool=>pool[0]||null,playerAcquisitionBlocked:()=>false,midseasonTarget:()=>1,mandatoryMidseasonPlayerIds:()=>Array.isArray(state.seasonRules.mandatoryMidseasonPlayerIds)?state.seasonRules.mandatoryMidseasonPlayerIds:[],clearMandatoryMidseasonPlayer:id=>{state.seasonRules.mandatoryMidseasonPlayerIds=state.seasonRules.mandatoryMidseasonPlayerIds.filter(item=>String(item)!==String(id));state.seasonRules.mandatoryMidseasonPlayerId=state.seasonRules.mandatoryMidseasonPlayerIds[0]||''},
 setAchievementCareerFlag:()=>{},unlockAchievement:id=>{unlocked.push(id);return true},
 save:()=>{},render:()=>{},toast:()=>{},
 avg:values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0,
 pick:items=>items?.[0],shuffle:items=>[...items],clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),
 matchPower:()=>90,simulateScore:()=>[2,0],simulatePenaltyShootout:()=>({scoreA:5,scoreB:4}),
 sortedTable:()=>Object.values(state.standings).sort((a,b)=>b.pts-a.pts),userStanding:()=>state.standings.user,
 teamById:id=>state.teams.find(team=>team.id===id),isTeamEliminated:()=>false,
 regulationGoalEvent:(team,opponent,duration,label)=>({minute:45,playerId:'',player:label,teamId:String(team?.id||''),goalValue:1,description:'Rigore'}),
 esc:value=>String(value??''),screen:{innerHTML:''},document:{getElementById:()=>({onclick:null}),querySelectorAll:()=>[]},
 seasonEventMinimized:false,seasonEventUiKey:'',window:{},location:{pathname:'/campionato.html'}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'06-competitions-and-stories.js'});
vm.runInContext(marketSource,context,{filename:'13-market-and-finish.js'});

function reset(){state=makeState();context.state=state;unlocked.length=0;}
function resolvedEvent(action){context.resolveFantaballopoliAction(action);assert.equal(state.pendingEvent.resolved,true);state.pendingEvent=null;}

const tests=[];
function test(name,fn){try{reset();fn();tests.push({name,ok:true})}catch(error){tests.push({name,ok:false,error});}}

test('scelta iniziale: rinuncia definitiva',()=>{
 const story=context.fantaballopoliState();story.initialized=true;story.scheduled=true;story.stage='opening';state.pendingEvent={kind:'storyFantaballopoli',storyType:'opening',resolved:false};
 resolvedEvent('optout');assert.equal(story.path,'none');assert.equal(story.completed,true);assert.equal(story.scheduled,false);
});

test('percorso Triade: sconfitta obbligatoria e giocatore scomodo',()=>{
 const story=context.fantaballopoliState();story.initialized=true;story.scheduled=true;story.stage='opening';state.pendingEvent={kind:'storyFantaballopoli',storyType:'opening',resolved:false};
 resolvedEvent('accept');assert.equal(context.fantaballopoliMatchRule().forcedLoss,true);
 context.tickFantaballopoliAfterMatch({gf:0,ga:1,winnerId:'opp'});assert.equal(story.stage,'evil_player_waiting');assert.equal(story.targetPlayerName,'Testimone');
 state.pendingEvent={kind:'storyFantaballopoli',storyType:'evil-player',resolved:false};resolvedEvent('trade');assert.equal(story.stage,'awaiting_midseason');assert.equal(story.targetTradeOrdered,true);assert.equal(story.targetTraded,false);assert(state.seasonRules.mandatoryMidseasonPlayerIds.includes('p1'));
});

test('percorso Triade: Giuda e tre Cartonati',()=>{
 const story=context.fantaballopoliState();story.path='evil';story.scheduled=true;story.stage='awaiting_midseason';story.targetPlayerId='p1';story.targetPlayerName='Testimone';story.targetRole='ATT';
 const giuda=context.createGiudaForEntry(state.draft.roster[0]);state.draft.roster[0]={playerId:giuda.id,player:{...giuda},slot:'ATT',bench:false};state.midseason.changes=[{outId:'p1',incomingId:giuda.id,slot:'ATT'}];
 context.resolveFantaballopoliMidseason();assert.equal(story.stage,'evil_trials_waiting');assert.equal(story.targetTraded,true);
 context.startFantaballopoliChallenge('evil-result');context.tickFantaballopoliChallenge({winnerId:'user',gf:2,ga:1,displayGf:2,displayGa:1,goals:[],lineup:[]});assert.equal(story.cartonati.arbitro,true);
 context.startFantaballopoliChallenge('evil-giuda');context.tickFantaballopoliChallenge({winnerId:'user',gf:1,ga:0,displayGf:1,displayGa:0,goals:[{playerId:story.giudaId}],lineup:[]});assert.equal(story.cartonati.giuda,true);
 context.startFantaballopoliChallenge('evil-dossier');for(let i=0;i<5;i++)context.tickFantaballopoliChallenge({winnerId:i%2?'opp':'user',gf:1,ga:i%2?2:0,displayGf:1,displayGa:i%2?2:0,goals:[],lineup:[]});assert.equal(story.cartonati.silenzio,true);
 assert(context.fantaballopoliBossPowers(story).every(power=>!power.active));
});

test('percorso Resistenza: regole e tre prove',()=>{
 const story=context.fantaballopoliState();story.initialized=true;story.scheduled=true;story.stage='opening';state.pendingEvent={kind:'storyFantaballopoli',storyType:'opening',resolved:false};resolvedEvent('resist');
 state.pendingEvent={kind:'storyFantaballopoli',storyType:'good-witness',resolved:false};resolvedEvent('start');
 const rule=context.fantaballopoliMatchRule();assert.equal(rule.extraOpponentPlayer,true);assert.equal(rule.automaticPenaltyAgainst,true);assert.equal(rule.forceNoDraw,true);
 context.tickFantaballopoliChallenge({winnerId:'user',gf:2,ga:1,displayGf:2,displayGa:1,goals:[],lineup:[]});assert.equal(story.intercettazioni.arbitro,true);
 context.startFantaballopoliChallenge('good-witness');for(let i=0;i<3;i++)context.tickFantaballopoliChallenge({winnerId:'user',gf:1,ga:0,displayGf:1,displayGa:0,ownSuspensionId:'',goals:i===1?[{playerId:'p1'}]:[],lineup:[{playerId:'p1'}]});assert.equal(story.intercettazioni.testimone,true);
 context.startFantaballopoliChallenge('good-dominion');context.tickFantaballopoliChallenge({winnerId:'user',gf:3,ga:2,displayGf:3,displayGa:2,goals:[],lineup:[]});assert.equal(story.intercettazioni.triade,true);
 assert(context.fantaballopoliBossPowers(story).every(power=>!power.active));
});

test('regole partita: dodicesimo, rigore e gol infortunato doppio',()=>{
 const story=context.fantaballopoliState();story.path='resistance';context.startFantaballopoliChallenge('good-twelve');
 const rule=context.fantaballopoliMatchRule(),base=[{playerId:'x',player:{id:'x',name:'Uno',ovr:80}}],twelve=context.fantaballopoliOpponentLineup(base,{id:'opp'},rule);
 assert.equal(twelve.length,2);assert.equal(twelve[1].storyTwelfth,true);
 const opponentGoals=[];assert.equal(context.applyFantaballopoliPenaltyGoal(opponentGoals,{id:'opp'},{id:'user'},90,rule),true);assert.equal(opponentGoals.length,1);
 context.startFantaballopoliChallenge('evil-result');state.statuses.p1={injury:2};state.playInjured.p1=true;const events=[{playerId:'p1',goalValue:1}],count=context.applyFantaballopoliInjuredGoalValues(events,[{playerId:'p1',player:players[0]}],context.fantaballopoliMatchRule());assert.equal(count,1);assert.equal(events[0].goalValue,2);
});

test('boss finale: punti raddoppiati e testimone nell’Inter',()=>{
 const story=context.fantaballopoliState();story.initialized=true;story.scheduled=true;story.path='evil';story.stage='evil_boss_waiting';story.targetTraded=true;story.targetPlayerId='p1';story.targetPlayerName='Testimone';story.cartonati={arbitro:true,giuda:true,silenzio:true};
 assert.equal(context.prepareFantaballopoliFinale(),true);const boss=context.fantaballopoliBossDefinition(story);assert(boss.starters.some(player=>player.name==='Testimone'));
 context.playFantaballopoliFinal();assert.equal(story.finale.won,true);assert.equal(state.standings.user.pts,120);assert(story.finale.notes.some(note=>note.includes('segna sicuramente')));assert(story.finale.opponentScorers.includes('Testimone'));
});



test('draft saltato: lo scambio narrativo consegna comunque Giuda',()=>{
 const story=context.fantaballopoliState();story.path='evil';story.scheduled=true;story.stage='awaiting_midseason';story.targetTradeOrdered=true;story.targetPlayerId='p1';story.targetPlayerName='Testimone';story.targetRole='ATT';state.midseason={changes:[]};state.seasonRules.mandatoryMidseasonPlayerIds=['p1'];state.seasonRules.mandatoryMidseasonPlayerId='p1';
 assert.equal(context.resolveFantaballopoliMidseason(),true);assert.equal(story.targetTraded,true);assert.equal(story.targetTradeOrdered,false);assert.equal(state.draft.roster[0].player.name,'Giuda');assert.equal(state.midseason.changes[0].outId,'p1');
});

test('mercato automatico: lo scambio obbligatorio mostra subito Giuda',()=>{
 const story=context.fantaballopoliState();story.initialized=true;story.scheduled=true;story.path='evil';story.stage='awaiting_midseason';story.targetPlayerId='p1';story.targetPlayerName='Testimone';story.targetRole='ATT';
 state.seasonRules.mandatoryMidseasonPlayerIds=['p1'];state.seasonRules.mandatoryMidseasonPlayerId='p1';state.midseason={target:1,step:0,changes:[],autoCompleted:false,completed:false};
 context.runBotMidseason();
 assert.equal(state.midseason.changes.length,1);assert.equal(state.midseason.changes[0].outId,'p1');assert.equal(state.midseason.changes[0].incoming,'Giuda');assert.equal(state.draft.roster[0].player.name,'Giuda');
});

const failed=tests.filter(test=>!test.ok);
for(const item of tests)console.log(`${item.ok?'PASS':'FAIL'} ${item.name}${item.ok?'':` — ${item.error.stack||item.error}`}`);
console.log(`\n${tests.length-failed.length}/${tests.length} test superati`);
if(failed.length)process.exit(1);
