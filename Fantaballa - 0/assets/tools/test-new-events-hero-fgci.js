#!/usr/bin/env node
const fs=require('fs');const path=require('path');const vm=require('vm');
const root=path.resolve(__dirname,'..');
const assetRoot=fs.existsSync(path.join(root,'season','event-handlers.js'))?root:path.join(root,'assets');
function assert(condition,message){if(!condition)throw new Error(message)}
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/events/events-common.json'),'utf8'));
const decisions=catalog.decisions||[];
const hero=decisions.find(event=>event.id==='my-hero-academia-visita');
const fgci=decisions.find(event=>event.id==='nuovo-regolamento-fgci-rigori-tempo');
assert(hero&&hero.choices?.length===2,'Evento My Hero Academia mancante o incompleto');
assert(fgci&&fgci.choices?.length===2,'Evento FGCI rigori/tempo mancante o incompleto');
assert(hero.order===218&&fgci.order===219,'Ordine dei nuovi eventi errato');

const context={
 console,Set,Map,Number,String,Array,Object,Boolean,Date,Error,JSON,
 Math:Object.create(Math),encodeURIComponent,
 state:{teamName:'Test United',competitionVariant:'serie-a',formation:'4-3-3',matchday:12,phase:'season',draft:{roster:[]},teams:[],schedule:[],history:[],gameMode:'normal',teamPaletteId:'x',teamColors:{primary:'#000'},seasonRules:{},activeEffects:[],standings:{user:{id:'user',name:'Test United',pts:27},a:{id:'a',name:'A',pts:31},b:{id:'b',name:'B',pts:14}},seenDecisionEvents:[]},
 SAVE_MODE:'community',USER_ID:'user',AUTO_SAVE_KEY:'test_save',FORMATIONS:{'4-3-3':{}},startupNotice:'',
 localStorage:{data:new Map(),getItem(k){return this.data.has(k)?this.data.get(k):null},setItem(k,v){this.data.set(k,String(v))},removeItem(k){this.data.delete(k)}},
 location:{href:''},setTimeout(fn){context._scheduled=fn},
 pick:list=>Array.isArray(list)?list[0]:null,
 pushSeasonEffect(type,value,extra={}){context.state.activeEffects.push({type,value,rounds:36,untilSeasonEnd:true,...extra});return context.state.activeEffects.at(-1)},
 normalizeCoachType:value=>String(value||'anonymous'),normalizeClubColors:value=>value,
 freshState(){return{teamName:'Fresh',coachName:'',coachType:'anonymous',competitionVariant:'serie-a',formation:'4-3-3',gameMode:'normal',teamPaletteId:'x',teamColors:{},seasonRules:{},seenDecisionEvents:[]}},
 userStanding(){return context.state.standings.user},
 sortedTable(){return Object.values(context.state.standings).sort((x,y)=>Number(y.pts)-Number(x.pts))},
 questCanStart:()=>true,questCurveAvailable:()=>true,leaderQuestCanStart:()=>true,saracinescaQuestAvailable:()=>true,noRigoreQuestAvailable:()=>true,zonaCesariniQuestAvailable:()=>true,internazionaleQuestAvailable:()=>true,
 randomOwnEntry:()=>null,randomRealCurrentLineupEntry:()=>null,startingGoalkeeperEntry:()=>null,mysteryCharacterChain:()=>({}),penguinChain:()=>({}),secretRefereeDealState:()=>({}),realCurrentLineupEntries:()=>[],coachNamedRosterEntry:()=>null,
 formulaOneRuleActive:()=>false,bottomHelpRoundEligible:()=>false,baseLeaguePoints:()=>3,fgciResultRuleTarget:(a,b,v)=>v,fgciPointsAdjustment:()=>0,
 seasonLength:()=>38,rosterPlayers:()=>[],lockerRoomMoleAvailable:()=>false,noMisterMatchAvailable:()=>false,presidentChangeAvailable:()=>false,
 curvaContestCanAppear:()=>false,creatorInUserRoster:()=>false,stefanoFinariChallengeState:()=>({active:false}),improvisedPenaltyAvailable:()=>false,weakBrotherAvailable:()=>false,goalkeeperScorerAvailable:()=>false,badContractAvailable:()=>false,internetFormationAvailable:()=>false,badLuckPlayerAvailable:()=>false,permanentAppealAvailable:()=>false,calabriaArmbandAvailable:()=>false,
 remainingSeasonMatches:()=>36,
};
context.globalThis=context;context.window=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(assetRoot,'season/event-handlers.js'),'utf8'),context,{filename:'event-handlers.js'});
assert(context.myHeroAcademiaEventTitle().includes('Test United'),'Il titolo dinamico non contiene il nome squadra');
context.activateHeroAcademiaFourOneRule();
assert(context.state.seasonRules.heroAcademiaRule==='four-one','Regola 4-1 non attivata');
context.state.seasonRules.heroAcademiaRule='';
const portalMessage=context.openHeroAcademiaPortal();
assert(/portale punta/i.test(portalMessage),'Messaggio del portale non restituito');
const portalPayload=JSON.parse(context.localStorage.getItem('fantaballa_season_portal_transfer_v1')||'null');
assert(portalPayload,'Trasferimento portale non salvato');
assert(portalPayload.currentMatchday===12,'Il Portale non conserva la giornata corrente');
assert(portalPayload.currentLeaderPoints===31,'Il Portale non registra il massimo punti della capolista');
assert(Number(portalPayload.userStanding?.pts)===27,'Il Portale non conserva i punti della squadra utente');
assert(portalPayload.stateSnapshot&&portalPayload.stateSnapshot.teamName==='Test United','Il Portale non conserva il progresso della run');
assert(typeof context._scheduled==='function','Reindirizzamento del portale non programmato');
context.state.seasonRules.fgciDirectMatchRule='';context.activateFgciDirectMatchRule('effective-time');
assert(context.state.seasonRules.fgciDirectMatchRule==='effective-time','Tempo effettivo non attivato');
assert(context.state.activeEffects.some(effect=>effect.type==='injuryRisk'&&effect.chance===.72),'Rischio infortuni del tempo effettivo non applicato');
context.state.seasonRules.fgciDirectMatchRule='';context.activateFgciDirectMatchRule('penalty-lottery');
assert(context.state.seasonRules.fgciDirectMatchRule==='penalty-lottery','Lotteria dei rigori non attivata');

const matchContext={
 console,Set,Map,Number,String,Array,Object,Boolean,Date,Error,JSON,Math:Object.create(Math),
 state:{matchday:0,pendingEvent:null,seasonRules:{heroAcademiaRule:'four-one',fgciDirectMatchRule:'penalty-lottery',marottaDoubleWins:false},schedule:[[{home:'user',away:'opp'}]],teams:[{id:'user',name:'Test United'},{id:'opp',name:'Opponent'}],standings:{user:{id:'user',name:'Test United',pts:10,p:0,w:0,d:0,l:0,gf:0,ga:0},opp:{id:'opp',name:'Opponent',pts:8,p:0,w:0,d:0,l:0,gf:0,ga:0}},history:[],activeEffects:[],statuses:{},playInjured:{}},
 USER_ID:'user',
 currentRound(){return matchContext.state.schedule[matchContext.state.matchday]},userFixture(){return matchContext.currentRound()[0]},teamById(id){return matchContext.state.teams.find(t=>t.id===id)},resolveLineup(){return[]},teamMatchLineup(){return[]},matchPower(){return 80},opponentMatchPower(){return 70},simulatePenaltyShootout(){return{scoreA:5,scoreB:4}},
 currentFgciLeaderRestId(){return''},updateStanding(id,gf,ga,outcome){const s=matchContext.state.standings[id];const won=String(outcome.winnerId)===String(id);s.p++;s.gf+=gf;s.ga+=ga;if(won){s.w++;s.pts+=3}else s.l++},
 recordLeagueMatchPlayerStats(){return{mvpId:'',mvpScore:0,mvpTeamId:''}},safeMatchLineup:x=>x,userStanding(){return matchContext.state.standings.user},postMatch(){matchContext._post=true},save(){matchContext._save=true},showResultModal(){matchContext._modal=true},sortedTable(){return Object.values(matchContext.state.standings).sort((a,b)=>b.pts-a.pts)},
 opponentStatusOf(team,id){team.statuses=team.statuses||{};team.statuses[id]=team.statuses[id]||{injury:0,suspension:0};return team.statuses[id]},pick:list=>list?.[0]||null,
};
matchContext.globalThis=matchContext;matchContext.window=matchContext;
vm.createContext(matchContext);
vm.runInContext(fs.readFileSync(path.join(assetRoot,'season/12-match-simulation.js'),'utf8'),matchContext,{filename:'12-match-simulation.js'});
// Il file definisce alcune funzioni globali del motore: per il test isolato ripristiniamo stub deterministici.
Object.assign(matchContext,{
 currentRound(){return matchContext.state.schedule[matchContext.state.matchday]},
 userFixture(){return matchContext.currentRound()[0]},
 teamById(id){return matchContext.state.teams.find(t=>t.id===id)},
 resolveLineup(){return[]},teamMatchLineup(){return[]},matchPower(){return 80},opponentMatchPower(){return 70},
 simulatePenaltyShootout(){return{scoreA:5,scoreB:4}},currentFgciLeaderRestId(){return''},
 updateStanding(id,gf,ga,outcome){const s=matchContext.state.standings[id];const won=String(outcome.winnerId)===String(id);s.p++;s.gf+=gf;s.ga+=ga;if(won){s.w++;s.pts+=3}else s.l++},
 recordLeagueMatchPlayerStats(){return{mvpId:'',mvpScore:0,mvpTeamId:''}},safeMatchLineup:x=>x,
 userStanding(){return matchContext.state.standings.user},postMatch(){matchContext._post=true},
 save(){matchContext._save=true},showResultModal(){matchContext._modal=true},
 sortedTable(){return Object.values(matchContext.state.standings).sort((a,b)=>b.pts-a.pts)}
});
matchContext.playFgciPenaltyLotteryRound('instant');
assert(matchContext.state.history.length===1,'La lotteria non ha registrato la partita');
const lotteryResult=matchContext.state.history[0];
assert(lotteryResult.gf===0&&lotteryResult.ga===0,'Il risultato regolamentare della lotteria deve essere 0-0');
assert(lotteryResult.penalties.for===5&&lotteryResult.penalties.against===4,'Risultato rigori errato');
assert(lotteryResult.ownRedCard===false&&lotteryResult.opponentRedCard===false,'La lotteria non deve generare rossi');
assert(matchContext.state.standings.user.pts===13,'La vittoria ai rigori deve assegnare i punti della vittoria');

matchContext.state.standings.user.pts=22;matchContext.state.standings.a={id:'a',pts:30};matchContext.state.standings.b={id:'b',pts:11};
let result={displayGf:4,displayGa:1,pointsAdjustment:3,pointsAwarded:3,pointsNote:''};matchContext.applyHeroAcademiaFourOneAfterMatch(result);
assert(matchContext.state.standings.user.pts===0&&result.heroAcademiaOutcome?.type==='win-reset','La vittoria 4-1 deve azzerare i punti utente');
matchContext.state.standings.user.pts=7;matchContext.state.standings.a.pts=20;matchContext.state.standings.b.pts=9;
result={displayGf:1,displayGa:4,pointsAdjustment:0,pointsAwarded:0,pointsNote:''};matchContext.applyHeroAcademiaFourOneAfterMatch(result);
assert(matchContext.state.standings.user.pts===7&&matchContext.state.standings.a.pts===0&&matchContext.state.standings.b.pts===0,'La sconfitta 1-4 deve azzerare soltanto gli altri club');

const handlerSource=fs.readFileSync(path.join(assetRoot,'season/event-handlers.js'),'utf8');
for(const event of [hero,fgci])for(const choice of event.choices)assert(handlerSource.includes(`\"${choice.applyHandler}\"`),`Handler mancante: ${choice.applyHandler}`);
console.log(JSON.stringify({ok:true,checks:['catalogo eventi','titolo dinamico','regola 4-1','portale con punti e giornata conservati','lotteria rigori 0-0','tempo effettivo','handler collegati']},null,2));
