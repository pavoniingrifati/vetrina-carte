'use strict';

const DIRECTOR_VERSION=14;
const SAVE_KEY='fantaballa_director_sportivo_2026_27_v1';
const INFLUENCE_START=16;
const LEGACY_INFLUENCE_START=8;
const TOTAL_ROUNDS=38;
const DIRECTOR_SUBMISSION_ENDPOINT='https://script.google.com/macros/s/AKfycbwadjpez_e-IXMLupqpISLEZ3rrHhrtF9gk_E9v9HB_YcgkXUneOnrW7iYAdGjqz3_G/exec';
const DIRECTOR_SUBMISSION_PREFIX='direttore_sportivo';
const screen=document.getElementById('screen');
const modalRoot=document.getElementById('modalRoot');
const toastRoot=document.getElementById('toast');
const saveStatus=document.getElementById('saveStatus');
let CLUBS=[];
let PLAYERS=[];
let REGULATIONS=[];
let TEAMS=[];
let TEAM_MAP=new Map();
let PLAYERS_BY_CLUB=new Map();
let state=null;
let commentaryTimer=0;

const REFEREES=[
 {id:'annulla-big',title:'Arbitro annulla-big',effect:'Il primo gol segnato da ciascuna squadra nelle prime 3 posizioni viene annullato, compresa la tua squadra se è nella top 3.',scope:'round',scopeLabel:'Tutta la giornata',rule:'cancelTopThreeFirstGoal'},
 {id:'severo',title:'Arbitro severo',effect:'La capolista riceve un’espulsione garantita e disputa la propria partita in inferiorità numerica.',scope:'round',scopeLabel:'Partita della capolista',rule:'leaderRedCard'},
 {id:'cornuti',title:'Arbitro cornuti',effect:'Ogni gol dell’avversario della squadra favorita ha il 50% di probabilità di essere annullato.',scope:'match',scopeLabel:'Partita scelta',rule:'opponentGoalsHalfCancelled',chooseFavored:true},
 {id:'amico',title:'Arbitro amico',effect:'La squadra favorita non può perdere la partita: se necessario raggiunge almeno il pareggio.',scope:'match',scopeLabel:'Partita scelta',rule:'favoredCannotLose',chooseFavored:true},
 {id:'bollente',title:'Arbitro bollente',effect:'La squadra favorita vince sicuramente, ma c’è il 20% di probabilità che lo scandalo venga scoperto e i punti della tua squadra siano azzerati.',scope:'match',scopeLabel:'Partita scelta · rischio estremo',rule:'favoredGuaranteedWin',chooseFavored:true,danger:true},
 {id:'underdog',title:'Arbitro underdog',effect:'Se la squadra favorita ha un OVR inferiore all’avversaria, riceve un gol garantito.',scope:'match',scopeLabel:'Partita scelta',rule:'underdogGuaranteedGoal',chooseFavored:true},
 {id:'var',title:'Arbitro al VAR',effect:'Negli episodi dubbi favorisce sempre la squadra più in basso in classifica.',scope:'match',scopeLabel:'Partita scelta',rule:'varFavorsLower'},
 {id:'handicap',title:'Arbitro handicap',effect:'Tutte le squadre di casa iniziano la partita con un gol di vantaggio.',scope:'round',scopeLabel:'Tutta la giornata',rule:'homeStartsOne'},
 {id:'fantacalcio',title:'Arbitro fantacalcio',effect:'Il giocatore con l’OVR più alto della squadra favorita segna un gol garantito.',scope:'match',scopeLabel:'Partita scelta',rule:'bestPlayerGuaranteedGoal',chooseFavored:true},
 {id:'trasferta',title:'Arbitro in trasferta',effect:'Tutte le squadre di casa possono segnare al massimo un gol.',scope:'round',scopeLabel:'Tutta la giornata',rule:'homeMaxOneGoal'},
 {id:'annoiato',title:'Arbitro annoiato',effect:'Tutte le partite della giornata terminano dopo appena 5 minuti.',scope:'round',scopeLabel:'Tutta la giornata',rule:'fiveMinuteMatches'},
 {id:'ultimo',title:'Arbitro finché non metti l’ultimo',effect:'La partita non termina finché la squadra favorita non segna almeno un gol.',scope:'match',scopeLabel:'Partita scelta',rule:'playUntilFavoredScores',chooseFavored:true},
 {id:'rimontista',title:'Arbitro rimontista',effect:'Se la squadra favorita va in svantaggio, ottiene un gol garantito per provare a rientrare in partita.',scope:'match',scopeLabel:'Partita scelta',rule:'favoredComebackGoal',chooseFavored:true},
 {id:'anti-bomber',title:'Arbitro anti-bomber',effect:'Il giocatore con l’OVR più alto della squadra avversaria non può segnare: i suoi gol vengono annullati.',scope:'match',scopeLabel:'Partita scelta',rule:'opponentBestPlayerCannotScore',chooseFavored:true},
 {id:'ultimo-assalto',title:'Arbitro ultimo assalto',effect:'Se la squadra favorita è in svantaggio dopo l’85°, riceve tre occasioni extra, ciascuna con il 45% di probabilità di diventare gol.',scope:'match',scopeLabel:'Partita scelta',rule:'favoredFinalAssault',chooseFavored:true},
 {id:'paura-grandi',title:'Arbitro paura dei grandi',effect:'Se una squadra delle prime 3 affronta una squadra dal 15° posto in giù, la squadra più bassa parte con un gol di vantaggio.',scope:'match',scopeLabel:'Partita scelta',rule:'bottomVsTopThreeStartsOne'},
 {id:'senza-pareggi',title:'Arbitro senza pareggi',effect:'Se la partita scelta termina in parità, continua fino al primo gol decisivo.',scope:'match',scopeLabel:'Partita scelta',rule:'selectedMatchNoDraw'},
 {id:'golden-goal-arbitro',title:'Arbitro golden goal',effect:'Tutte le partite della giornata che terminano in parità continuano fino al primo gol decisivo.',scope:'round',scopeLabel:'Tutta la giornata',rule:'roundGoldenGoal'},
 {id:'anti-capolista',title:'Arbitro anti-capolista',effect:'La squadra prima in classifica inizia la propria partita con un gol di svantaggio.',scope:'round',scopeLabel:'Partita della capolista',rule:'leaderStartsBehind'},
 {id:'ultima-classifica',title:'Arbitro ultima in classifica',effect:'La squadra ultima in classifica riceve due gol garantiti nella propria partita.',scope:'round',scopeLabel:'Partita dell’ultima',rule:'lastPlaceGetsTwo'},
 {id:'classifica-rovesciata',title:'Arbitro classifica rovesciata',effect:'In ogni partita, la squadra più in basso in classifica inizia con un gol di vantaggio.',scope:'round',scopeLabel:'Tutta la giornata',rule:'lowerRankStartsOne'},
 {id:'televisivo',title:'Arbitro televisivo',effect:'Le partite tra due squadre nelle prime 6 posizioni assegnano 4 punti alla vincitrice.',scope:'round',scopeLabel:'Tutta la giornata',rule:'topSixWinFourPoints'},
 {id:'rosso-facile',title:'Arbitro rosso facile',effect:'La squadra scelta riceve un’espulsione garantita tra il 20° e il 70° minuto e gioca in inferiorità numerica.',scope:'match',scopeLabel:'Partita scelta · squadra da sfavorire',rule:'targetGuaranteedRed',chooseDisfavored:true},
 {id:'anti-rimonta',title:'Arbitro anti-rimonta',effect:'Se la squadra scelta va in svantaggio, da quel momento può segnare al massimo un solo gol.',scope:'match',scopeLabel:'Partita scelta · squadra da sfavorire',rule:'targetAntiComeback',chooseDisfavored:true},
 {id:'grandi-trasferta',title:'Arbitro grandi in trasferta',effect:'Le squadre della top 5 che giocano in trasferta partono da 0–1 e possono segnare al massimo 2 gol.',scope:'round',scopeLabel:'Tutta la giornata',rule:'topFiveAwayStartsBehind'},
 {id:'provinciali',title:'Arbitro provinciali',effect:'Ogni squadra dall’11° posto in giù riceve un gol garantito quando affronta una squadra della top 6.',scope:'round',scopeLabel:'Tutta la giornata',rule:'bottomHalfVsTopSixGoal'},
 {id:'classifica-corta',title:'Arbitro classifica corta',effect:'Le vittorie delle squadre nelle prime 4 posizioni valgono soltanto 2 punti; per tutte le altre restano da 3.',scope:'round',scopeLabel:'Tutta la giornata',rule:'topFourWinTwoPoints'},
 {id:'giornata-nera',title:'Arbitro giornata nera',effect:'In ogni partita, la squadra meglio classificata riceve un’espulsione garantita.',scope:'round',scopeLabel:'Tutta la giornata',rule:'higherRankGuaranteedRed'},
 {id:'sabotatore',title:'Arbitro sabotatore',effect:'La squadra scelta ha il 75% di probabilità di partire da 0–2; nel 25% dei casi il sabotaggio fallisce e parte da 2–0.',scope:'match',scopeLabel:'Partita scelta · rischio di ritorno',rule:'targetSabotage',chooseDisfavored:true}
];

function esc(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function sum(values){return values.reduce((total,value)=>total+Number(value||0),0)}
function average(values,fallback=70){const clean=values.map(Number).filter(Number.isFinite);return clean.length?sum(clean)/clean.length:fallback}
const MATCH_BALANCE=Object.freeze({roleWeight:.65,overallWeight:.35,strengthDivisor:14,homeBase:1.40,awayBase:1.08,qualityReference:73,qualityDivisor:35});
function directorAttackStrength(team){const chaotic=directorChaoticOvr(team);if(chaotic!==null)return chaotic;return (Number(team?.attack)||70)*MATCH_BALANCE.roleWeight+(Number(team?.rating)||70)*MATCH_BALANCE.overallWeight}
function directorDefenseStrength(team){const chaotic=directorChaoticOvr(team);if(chaotic!==null)return chaotic;return (Number(team?.defense)||70)*MATCH_BALANCE.roleWeight+(Number(team?.rating)||70)*MATCH_BALANCE.overallWeight}
function directorTeamPower(team){return (directorAttackStrength(team)+directorDefenseStrength(team))/2}
function seedNow(){if(globalThis.crypto?.getRandomValues){const values=new Uint32Array(1);globalThis.crypto.getRandomValues(values);return values[0]||0x9e3779b9}return (Date.now()^Math.floor(Math.random()*0xffffffff))>>>0}
function rand(){let x=(state?.rng||0x9e3779b9)>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;x>>>=0;if(state)state.rng=x;return x/4294967296}
function randomInt(min,max){return Math.floor(rand()*(max-min+1))+min}
function pick(list){return list?.length?list[Math.floor(rand()*list.length)]:null}
function shuffle(list){const copy=[...list];for(let index=copy.length-1;index>0;index--){const target=Math.floor(rand()*(index+1));[copy[index],copy[target]]=[copy[target],copy[index]]}return copy}
function hashText(text){let hash=2166136261;for(const char of String(text||'')){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}return hash>>>0}
function shortBadge(name){const words=String(name||'').trim().split(/\s+/).filter(Boolean);if(!words.length)return'FC';if(words.length===1)return words[0].slice(0,3).toUpperCase();return words.slice(0,3).map(word=>word[0]).join('').toUpperCase()}
function teamOf(id){return TEAM_MAP.get(String(id))||null}
function teamStyle(team){const colors=team?.colors||{};return `--target-primary:${colors.primary||'#245786'};--target-secondary:${colors.secondary||'#10243a'};--target-accent:${colors.accent||'#ffe96c'}`}
function teamButtonStyle(team){const colors=team?.colors||{};const background=String(colors.primary||'#10243a');const foreground=String(colors.secondary||'#ffffff');return `--team-bg:${background};--team-fg:${foreground};--team-border:${foreground};--team-shadow:rgba(16,36,58,.18)`}
function playerForAvatar(item={},teamHint=null){
 const playerId=String(item.playerId||item.id||'');
 const team=teamHint||teamOf(item.teamId||item.club||'');
 const source=(team?.players||[]).find(player=>String(player.id)===playerId)||PLAYERS.find(player=>String(player.id)===playerId)||item;
 return {...source,name:String(item.name||source?.name||'Giocatore'),playerId,teamId:team?.id||String(item.teamId||''),club:team?.id||source?.club||'',clubName:team?.name||source?.clubName||'',shortClubName:team?.shortName||'',avatarColors:team?.colors||{}};
}
function renderDirectorPlayerAvatar(item={},teamHint=null,extra='small'){
 const player=playerForAvatar(item,teamHint);
 const rendered=window.FantaballaPlayerAvatars?.renderMiniAvatar?.(player,extra);
 if(rendered)return rendered;
 const initial=String(player.name||'?').trim().charAt(0).toUpperCase()||'?';
 return `<span class="season-mini-avatar ${extra} director-avatar-fallback"><b>${esc(initial)}</b></span>`;
}
function directorDifficultyProfile(expectedRank=state?.startExpectedRank){
 const rank=clamp(Math.round(Number(expectedRank)||1),1,20);
 if(rank<=3)return{key:'easy',label:'Facile',multiplier:1,rank};
 if(rank<=7)return{key:'normal',label:'Normale',multiplier:1.15,rank};
 if(rank<=12)return{key:'challenging',label:'Impegnativa',multiplier:1.35,rank};
 if(rank<=16)return{key:'hard',label:'Difficile',multiplier:1.6,rank};
 return{key:'extreme',label:'Estrema',multiplier:1.9,rank};
}
function directorScoreBreakdown(points=targetRow()?.pts,influenceRemaining=state?.influence,expectedRank=state?.startExpectedRank){
 const profile=directorDifficultyProfile(expectedRank),finalPoints=Number(points)||0,remaining=clamp(Math.round(Number(influenceRemaining)||0),0,INFLUENCE_START),pointsValue=finalPoints*10,influenceValue=remaining*80,base=pointsValue+influenceValue,score=Math.round(base*profile.multiplier);
 return{...profile,finalPoints,remaining,pointsValue,influenceValue,base,score};
}
function formatDirectorMultiplier(value){return `×${Number(value||1).toFixed(2).replace('.',',')}`}
function toast(message){if(!toastRoot)return;toastRoot.textContent=String(message||'');toastRoot.classList.add('show');window.clearTimeout(toastRoot._timer);toastRoot._timer=window.setTimeout(()=>toastRoot.classList.remove('show'),2400)}
function closeModal(){window.clearInterval(commentaryTimer);commentaryTimer=0;modalRoot.innerHTML=''}
function compactHistoryMatch(match={}){
 const compact={homeId:String(match.homeId||''),awayId:String(match.awayId||''),homeGoals:Number(match.homeGoals)||0,awayGoals:Number(match.awayGoals)||0};
 if(match.skipped)compact.skipped=true;
 if(match.winnerId)compact.winnerId=String(match.winnerId);
 if(match.decidedByPenalties)compact.decidedByPenalties=true;
 return compact;
}
function compactRoundReport(report={},index=0){return{round:Number(report.round)||index+1,matches:(Array.isArray(report.matches)?report.matches:[]).map(compactHistoryMatch)}}
function compactRefereeRecord(item={}){
 const compact={id:String(item.id||''),round:Number(item.round)||0};
 for(const key of ['assignmentId','title','scope','fixtureKey','homeId','awayId','favoredTeamId','replaced'])if(item[key])compact[key]=String(item[key]);
 if(item.caught)compact.caught=true;
 if(item.selfDisadvantageReward)compact.selfDisadvantageReward=true;
 return compact;
}
function compactRegulationRecord(item={}){return{id:String(item.id||''),title:String(item.title||''),round:Number(item.round)||0,replaced:String(item.replaced||'')}}
function compactPersistentState(){
 if(!state)return;
 state.history=(Array.isArray(state.history)?state.history:[]).map(compactRoundReport);
 state.refereeHistory=(Array.isArray(state.refereeHistory)?state.refereeHistory:[]).map(compactRefereeRecord);
 state.regulationHistory=(Array.isArray(state.regulationHistory)?state.regulationHistory:[]).map(compactRegulationRecord);
 state.roundReferees=(Array.isArray(state.roundReferees)?state.roundReferees:[]).map(compactRefereeRecord);
 if(state.playoff&&Array.isArray(state.playoff.history))state.playoff.history=state.playoff.history.map((item,index)=>({stage:Number(item?.stage)||index,results:(Array.isArray(item?.results)?item.results:[]).map(compactHistoryMatch)}));
 state.meta=state.meta&&typeof state.meta==='object'?state.meta:{};
 state.meta.storageFormat=2;
}
function isQuotaError(error){return Boolean(error&&(error.name==='QuotaExceededError'||error.name==='NS_ERROR_DOM_QUOTA_REACHED'||error.code===22||error.code===1014))}
function markSaveSuccess(){if(saveStatus){saveStatus.textContent='Salvato';window.clearTimeout(saveStatus._timer);saveStatus._timer=window.setTimeout(()=>saveStatus.textContent='Salvataggio automatico attivo',1100)}}
function save(){
 if(!state)return true;
 state.updatedAt=new Date().toISOString();
 compactPersistentState();
 try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));markSaveSuccess();return true}
 catch(error){
  if(!isQuotaError(error))throw error;
  console.warn('Salvataggio troppo grande: applicata la compattazione di emergenza.',error);
  state.meta=state.meta&&typeof state.meta==='object'?state.meta:{};state.meta.storageRecoveryAt=new Date().toISOString();
  state.seenRegulationIds=[...new Set((state.seenRegulationIds||[]).map(String))].slice(-Math.max(40,REGULATIONS.length));
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));markSaveSuccess();toast('Salvataggio ottimizzato automaticamente.');return true}
  catch(secondError){console.error('Spazio locale insufficiente anche dopo la compattazione.',secondError);if(saveStatus)saveStatus.textContent='Salvataggio non riuscito: spazio locale esaurito';toast('Spazio del browser esaurito: il progresso corrente non è stato salvato.');return false}
 }
}
function loadSaved(){try{const parsed=JSON.parse(localStorage.getItem(SAVE_KEY)||'null'),version=Number(parsed?.version)||0;if(!parsed||version<1||version>DIRECTOR_VERSION)return null;return parsed}catch(error){console.warn('Salvataggio Direttore Sportivo non leggibile',error);return null}}

async function boot(){
 try{
  const [clubs,players,regulations]=await Promise.all([
   fetch('data/club-real.json',{cache:'no-store'}).then(response=>response.ok?response.json():Promise.reject(new Error('Club non disponibili'))),
   fetch('data/giocatori-real.json',{cache:'no-store'}).then(response=>response.ok?response.json():Promise.reject(new Error('Giocatori non disponibili'))),
   fetch('data/events/events-director-regulations.json',{cache:'no-store'}).then(response=>response.ok?response.json():Promise.reject(new Error('Regolamenti non disponibili')))
  ]);
  CLUBS=(Array.isArray(clubs)?clubs:[]).filter(club=>club&&club.id&&club.id!=='fantaballa-real');
  PLAYERS=Array.isArray(players)?players:[];
  REGULATIONS=Array.isArray(regulations?.regulations)?regulations.regulations:[];
  buildDataModel();
  state=loadSaved();
  if(state){repairState();save()}
  render();
  if(state?.pendingRefereeId&&!state.pendingChoiceMinimized)window.setTimeout(renderRefereeAssignment,80);
  else if(state?.pendingChoices?.length&&!state.pendingChoiceMinimized)window.setTimeout(renderInfluenceChoices,80);
 }catch(error){
  console.error(error);
  screen.innerHTML=`<section class="panel"><div class="label">Errore di caricamento</div><h2>La modalità non può essere aperta</h2><p>${esc(error.message||error)}</p><button class="btn primary" type="button" onclick="location.reload()">Riprova</button></section>`;
 }
}

function buildDataModel(){
 PLAYERS_BY_CLUB=new Map();
 for(const player of PLAYERS){const clubId=String(player.club||'');if(!PLAYERS_BY_CLUB.has(clubId))PLAYERS_BY_CLUB.set(clubId,[]);PLAYERS_BY_CLUB.get(clubId).push(player)}
 TEAMS=CLUBS.map(club=>{
  const players=PLAYERS_BY_CLUB.get(String(club.id))||[];
  const sorted=[...players].sort((a,b)=>Number(b.ovr||0)-Number(a.ovr||0));
  const attackers=players.filter(player=>String(player.role||'').toUpperCase()==='A').sort((a,b)=>Number(b.ovr||0)-Number(a.ovr||0));
  const midfielders=players.filter(player=>String(player.role||'').toUpperCase()==='C').sort((a,b)=>Number(b.ovr||0)-Number(a.ovr||0));
  const defenders=players.filter(player=>String(player.role||'').toUpperCase()==='D').sort((a,b)=>Number(b.ovr||0)-Number(a.ovr||0));
  const keepers=players.filter(player=>String(player.role||'').toUpperCase()==='P').sort((a,b)=>Number(b.ovr||0)-Number(a.ovr||0));
  const rating=average(sorted.slice(0,14).map(player=>player.ovr),72);
  const attack=average([...attackers.slice(0,4),...midfielders.slice(0,3)].map(player=>player.ovr),rating);
  const defense=average([...keepers.slice(0,1),...defenders.slice(0,5)].map(player=>player.ovr),rating);
  const deterministic=hashText(club.id);
  const team={id:String(club.id),name:String(club.name),shortName:String(club.shortName||shortBadge(club.name)),colors:club.colorClub||{},rating:Math.round(rating*10)/10,attack:Math.round(attack*10)/10,defense:Math.round(defense*10)/10,discipline:.78+((deterministic%17)/100),lateTrait:.86+(((deterministic>>>8)%29)/100),players};
  team.simulationPower=Math.round(directorTeamPower(team)*10)/10;
  return team;
 });
 TEAM_MAP=new Map(TEAMS.map(team=>[team.id,team]));
}

function repairState(){
 const previousVersion=Number(state.version)||1;
 state.version=DIRECTOR_VERSION;
 state.rng=(Number(state.rng)||seedNow())>>>0;
 const oldInfluence=Math.max(0,Number(state.influence)||0);
 state.influence=previousVersion<8?clamp(oldInfluence+(INFLUENCE_START-LEGACY_INFLUENCE_START),0,INFLUENCE_START):clamp(oldInfluence,0,INFLUENCE_START);
 state.round=clamp(Number(state.round)||0,0,TOTAL_ROUNDS);
 state.pendingChoices=Array.isArray(state.pendingChoices)?state.pendingChoices:[];
 state.pendingChoiceType=state.pendingChoiceType==='referee'?'referee':'regulation';
 state.pendingRefereeId=String(state.pendingRefereeId||'');
 state.pendingChoiceMinimized=Boolean(state.pendingChoiceMinimized);
 sanitizePendingInfluenceState();
 state.refereeHistory=Array.isArray(state.refereeHistory)?state.refereeHistory:[];
 state.regulationHistory=Array.isArray(state.regulationHistory)?state.regulationHistory:[];
 const currentRound=state.round+1;
 const refs=Array.isArray(state.roundReferees)?state.roundReferees.filter(Boolean).map(item=>({...item})):[];
 if(state.roundReferee&&typeof state.roundReferee==='object')refs.push({...state.roundReferee});
 state.roundReferees=refs.map((item,index)=>({...item,assignmentId:String(item.assignmentId||`legacy-${currentRound}-${index}-${item.id||'ref'}`)})).filter(item=>Number(item.round)===currentRound);
 state.roundReferee=null;
 state.refereeHistory=state.refereeHistory.map((item,index)=>({...item,assignmentId:String(item.assignmentId||`history-${Number(item.round)||0}-${index}-${item.id||'ref'}`)}));
 const saved=state.influenceUsageToday&&typeof state.influenceUsageToday==='object'?state.influenceUsageToday:{};
 const savedReg=typeof saved.regulation==='boolean'?(saved.regulation?1:0):Math.max(0,Math.floor(Number(saved.regulation)||0));
 const savedRef=typeof saved.referee==='boolean'?(saved.referee?1:0):Math.max(0,Math.floor(Number(saved.referee)||0));
 const regHistory=state.regulationHistory.filter(item=>Number(item.round)===currentRound).length;
 const refHistory=state.refereeHistory.filter(item=>Number(item.round)===currentRound).length;
 const pendingReg=state.pendingChoices.length&&state.pendingChoiceType==='regulation'?1:0;
 const pendingRef=(state.pendingRefereeId||(state.pendingChoices.length&&state.pendingChoiceType==='referee'))?1:0;
 state.influenceUsageToday={regulation:Math.max(savedReg,regHistory+pendingReg),referee:Math.max(savedRef,refHistory+pendingRef)};
 state.influenceUsedToday=(state.influenceUsageToday.regulation+state.influenceUsageToday.referee)>0;
 state.seenRegulationIds=Array.isArray(state.seenRegulationIds)?state.seenRegulationIds:[];
 state.regulations=(Array.isArray(state.regulations)?state.regulations:[]).map(item=>{const catalog=REGULATIONS.find(regulation=>regulation.id===item.id);const rounds=Number(item.remainingRounds);return{...item,remainingRounds:Number.isFinite(rounds)?Math.max(0,rounds):(Number(catalog?.rounds)||0)}}).filter(item=>!Number(REGULATIONS.find(regulation=>regulation.id===item.id)?.rounds)||Number(item.remainingRounds)>0);
 state.history=(Array.isArray(state.history)?state.history:[]).map(compactRoundReport);
 state.stats=state.stats&&typeof state.stats==='object'?state.stats:{scorers:{},team:{}};
 state.stats.scorers=state.stats.scorers||{}; state.stats.team=state.stats.team||{};
 state.meta=state.meta&&typeof state.meta==='object'?state.meta:{};
 state.directorName=String(state.directorName||''); state.submitted=Boolean(state.submitted);
 if(!state.table||typeof state.table!=='object')state.table=createTable();
 if(!Number(state.startExpectedRank)&&teamOf(state.targetTeamId))state.startExpectedRank=[...TEAMS].sort((a,b)=>directorTeamPower(b)-directorTeamPower(a)).findIndex(team=>team.id===state.targetTeamId)+1;
 state.startExpectedRank=clamp(Math.round(Number(state.startExpectedRank)||1),1,20);
 const invalidSchedule=!Array.isArray(state.schedule)||state.schedule.length!==TOTAL_ROUNDS;
 if(invalidSchedule)state.schedule=generateSchedule(TEAMS.map(team=>team.id)); else if(previousVersion<6)repairLegacyScheduleVenues();
 if(!teamOf(state.targetTeamId)){localStorage.removeItem(SAVE_KEY);state=null}
}

function createTable(){return Object.fromEntries(TEAMS.map(team=>[team.id,{id:team.id,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}]))}
function generateSchedule(teamIds){
 const ordered=shuffle(teamIds);
 if(ordered.length%2)ordered.push('__bye__');
 const teamCount=ordered.length,rotatingCount=teamCount-1,first=[];
 for(let round=0;round<rotatingCount;round++){
  const matches=[];
  for(let matchIndex=0;matchIndex<teamCount/2;matchIndex++){
   let homeIndex=(round+matchIndex)%rotatingCount;
   let awayIndex=(rotatingCount-matchIndex+round)%rotatingCount;
   if(matchIndex===0)awayIndex=teamCount-1;
   let homeId=ordered[homeIndex],awayId=ordered[awayIndex];
   if(round%2===1)[homeId,awayId]=[awayId,homeId];
   if(homeId==='__bye__'||awayId==='__bye__')continue;
   matches.push({homeId,awayId});
  }
  first.push(matches);
 }
 rebalanceFirstLegVenues(first,ordered.filter(id=>id!=='__bye__'));
 const second=first.map(round=>round.map(match=>({homeId:match.awayId,awayId:match.homeId})));
 const reorderedSecond=second.length>1?[...second.slice(1),second[0]]:second;
 return [...first,...reorderedSecond];
}
function venueSequence(schedule,teamId){
 return schedule.map(round=>{const fixture=round.find(match=>match.homeId===teamId||match.awayId===teamId);return fixture?(fixture.homeId===teamId?'H':'A'):''}).filter(Boolean);
}
function maximumVenueRun(schedule,teamId){
 const sequence=venueSequence(schedule,teamId);let best=0,current=0,last='';
 for(const venue of sequence){if(venue===last)current+=1;else{last=venue;current=1}best=Math.max(best,current)}
 return best;
}
function rebalanceFirstLegVenues(first,teamIds){
 const maximumHomes=Math.ceil((teamIds.length-1)/2),minimumHomes=Math.floor((teamIds.length-1)/2);
 const counts=Object.fromEntries(teamIds.map(teamId=>[teamId,venueSequence(first,teamId).filter(venue=>venue==='H').length]));
 const overloaded=teamIds.filter(teamId=>counts[teamId]>maximumHomes);
 const search=(remaining,runLimit)=>{
  if(!remaining.length)return teamIds.every(teamId=>counts[teamId]>=minimumHomes&&counts[teamId]<=maximumHomes);
  let selected='',candidates=[];
  for(const teamId of remaining){
   const options=[];
   first.forEach((round,roundIndex)=>round.forEach((fixture,fixtureIndex)=>{
    if(fixture.homeId===teamId&&counts[fixture.awayId]<maximumHomes)options.push({roundIndex,fixtureIndex,receiver:fixture.awayId});
   }));
   if(!selected||options.length<candidates.length){selected=teamId;candidates=options}
  }
  const next=remaining.filter(teamId=>teamId!==selected);
  for(const candidate of candidates){
   const fixture=first[candidate.roundIndex][candidate.fixtureIndex];
   [fixture.homeId,fixture.awayId]=[fixture.awayId,fixture.homeId];counts[selected]-=1;counts[candidate.receiver]+=1;
   const valid=maximumVenueRun(first,selected)<=runLimit&&maximumVenueRun(first,candidate.receiver)<=runLimit&&search(next,runLimit);
   if(valid)return true;
   counts[selected]+=1;counts[candidate.receiver]-=1;[fixture.homeId,fixture.awayId]=[fixture.awayId,fixture.homeId];
  }
  return false;
 };
 if(!search(overloaded,2))search(overloaded,3);
}
function targetVenueInRound(round){
 const fixture=round?.find(match=>match.homeId===state.targetTeamId||match.awayId===state.targetTeamId);
 return fixture?.homeId===state.targetTeamId?'H':'A';
}
function repairLegacyScheduleVenues(){
 if(!Array.isArray(state.schedule)||state.schedule.length!==TOTAL_ROUNDS||!state.targetTeamId)return;
 if(state.round===0){state.schedule=generateSchedule(TEAMS.map(team=>team.id));return}
 const lockedCount=Math.min(TOTAL_ROUNDS,state.round+1),locked=state.schedule.slice(0,lockedCount),remaining=state.schedule.slice(lockedCount);
 const homeRounds=remaining.filter(round=>targetVenueInRound(round)==='H'),awayRounds=remaining.filter(round=>targetVenueInRound(round)==='A'),ordered=[];
 const lockedVenues=locked.map(targetVenueInRound).filter(Boolean);let last=lockedVenues.at(-1)||'',run=1;
 for(let index=lockedVenues.length-2;index>=0&&lockedVenues[index]===last;index--)run+=1;
 while(homeRounds.length||awayRounds.length){
  let venue;
  if(last==='H'&&run>=2&&awayRounds.length)venue='A';
  else if(last==='A'&&run>=2&&homeRounds.length)venue='H';
  else if(homeRounds.length===awayRounds.length)venue=last==='H'?'A':'H';
  else venue=homeRounds.length>awayRounds.length?'H':'A';
  if(venue==='H'&&!homeRounds.length)venue='A';
  if(venue==='A'&&!awayRounds.length)venue='H';
  const next=venue==='H'?homeRounds.shift():awayRounds.shift();ordered.push(next);
  if(venue===last)run+=1;else{last=venue;run=1}
 }
 state.schedule=[...locked,...ordered];
 state.meta=state.meta&&typeof state.meta==='object'?state.meta:{};
 state.meta.scheduleVenueRepair=6;
}

function startMission(){
 const seed=seedNow();
 state={version:DIRECTOR_VERSION,rng:seed,phase:'briefing',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),targetTeamId:'',influence:INFLUENCE_START,influenceUsedToday:false,influenceUsageToday:{regulation:0,referee:0},round:0,schedule:[],table:{},regulations:[],regulationHistory:[],seenRegulationIds:[],pendingChoices:[],pendingChoiceType:'regulation',pendingRefereeId:'',pendingChoiceMinimized:false,roundReferees:[],roundReferee:null,refereeHistory:[],history:[],stats:{scorers:{},team:{}},playoff:null,championId:'',regularSeasonRank:0,startExpectedRank:0,directorName:'',submitted:false,meta:{}};
 const target=pick(TEAMS);
 state.targetTeamId=target.id;
 state.schedule=generateSchedule(TEAMS.map(team=>team.id));
 state.table=createTable();
 state.startExpectedRank=[...TEAMS].sort((a,b)=>directorTeamPower(b)-directorTeamPower(a)).findIndex(team=>team.id===target.id)+1;
 save();
 render();
}
function beginSeason(){const difficulty=directorDifficultyProfile();state.phase='season';save();render();toast(`Missione ${difficulty.label}: hai ${INFLUENCE_START} punti Influenza per tutta la stagione.`)}

function sortedTable(){return Object.values(state?.table||{}).sort((a,b)=>Number(b.pts)-Number(a.pts)||(Number(b.gf)-Number(b.ga))-(Number(a.gf)-Number(a.ga))||Number(b.gf)-Number(a.gf)||(teamOf(b.id)?.rating||0)-(teamOf(a.id)?.rating||0)||teamOf(a.id)?.name.localeCompare(teamOf(b.id)?.name,'it'))}
function rankOf(teamId){const index=sortedTable().findIndex(row=>row.id===String(teamId));return index<0?0:index+1}
function targetRow(){return state.table[state.targetTeamId]||{p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}}
function gapFromTop(){const table=sortedTable(),target=targetRow();return table.length?Number(target.pts)-Number(table[0].pts):0}
function targetTeam(){return teamOf(state.targetTeamId)}
function currentRoundMatches(){return state.schedule[state.round]||[]}
function currentTargetFixture(){return currentRoundMatches().find(match=>match.homeId===state.targetTeamId||match.awayId===state.targetTeamId)||null}
function activeRegulations(){return (state.regulations||[]).map(item=>{const catalog=REGULATIONS.find(regulation=>regulation.id===item.id)||{},merged={...catalog,...item};if(merged.rule==='chaoticOvr'){const value=Number(item?.chaoticOvrValues?.[state?.targetTeamId]);if(Number.isFinite(value))merged.effect=`${catalog.effect} OVR caotico attuale della tua squadra: ${value}.`}return merged}).filter(item=>item&&(!Number(item.rounds)||Number(item.remainingRounds)>0))}
function activeRegulationByRule(rule){return activeRegulations().find(regulation=>String(regulation.rule)===String(rule))||null}
function directorChaoticOvr(team){if(!state||!team)return null;const regulation=activeRegulationByRule('chaoticOvr');if(!regulation)return null;const source=(state.regulations||[]).find(item=>item.id===regulation.id)||regulation;source.chaoticOvrValues=source.chaoticOvrValues&&typeof source.chaoticOvrValues==='object'?source.chaoticOvrValues:{};const id=String(team.id||'');let value=Number(source.chaoticOvrValues[id]);if(!Number.isFinite(value)||value<5||value>200){value=randomInt(5,200);source.chaoticOvrValues[id]=value}return value}
function directorCurrentOvr(team){const chaotic=directorChaoticOvr(team);return chaotic!==null?chaotic:Number(team?.rating)||70}
function directorRegulationDurationLabel(regulation){const rounds=Number(regulation?.rounds)||0;if(!rounds)return String(regulation?.duration||'Fino a fine stagione');const remaining=Math.max(0,Number(regulation?.remainingRounds)||0);return `${remaining} ${remaining===1?'giornata rimasta':'giornate rimaste'}`}
function tickDirectorRegulations(){state.regulations=(state.regulations||[]).map(item=>{const catalog=REGULATIONS.find(regulation=>regulation.id===item.id);if(!Number(catalog?.rounds))return item;return{...item,remainingRounds:Math.max(0,(Number(item.remainingRounds)||0)-1)}}).filter(item=>{const catalog=REGULATIONS.find(regulation=>regulation.id===item.id);return !Number(catalog?.rounds)||Number(item.remainingRounds)>0})}
function hasRule(rule){return activeRegulations().some(regulation=>regulation.rule===rule)}
function regulationById(id){return REGULATIONS.find(regulation=>regulation.id===id)||null}
function refereeById(id){return REFEREES.find(referee=>referee.id===String(id))||null}
function fixtureKey(fixture){return fixture?`${fixture.homeId}__${fixture.awayId}`:''}
function refereeAssignmentDescription(assignment){
 if(!assignment)return'';
 const referee=refereeById(assignment.id),home=teamOf(assignment.homeId),away=teamOf(assignment.awayId),selected=teamOf(assignment.favoredTeamId);
 if(referee?.scope==='round')return `${referee.title} · ${referee.scopeLabel}`;
 const match=home&&away?`${home.name}–${away.name}`:'partita scelta',verb=referee?.chooseDisfavored?'sfavorisce':'favorisce',reward=assignment.selfDisadvantageReward?' · +1 Influenza per autosabotaggio':'';
 return `${referee?.title||'Arbitro'} · ${match}${selected?` · ${verb} ${selected.name}`:''}${reward}`;
}
function earnsSelfDisadvantageInfluence(referee,selectedTeamId){return Boolean(referee?.chooseDisfavored&&String(selectedTeamId||'')===String(state?.targetTeamId||''))}
function activeRoundReferees(){return (state?.roundReferees||[]).filter(item=>item&&Number(item.round)===Number(state.round)+1)}
function refereeForFixture(fixture){
 const assignments=activeRoundReferees(),key=fixtureKey(fixture);
 const specific=[...assignments].reverse().find(item=>refereeById(item.id)?.scope!=='round'&&item.fixtureKey===key);
 if(specific)return specific;
 return [...assignments].reverse().find(item=>refereeById(item.id)?.scope==='round')||null;
}
function influenceUsageToday(){
 const usage=state?.influenceUsageToday&&typeof state.influenceUsageToday==='object'?state.influenceUsageToday:{};
 return{regulation:Math.max(0,Math.floor(Number(usage.regulation)||0)),referee:Math.max(0,Math.floor(Number(usage.referee)||0))};
}
function influenceModeUsed(type){const usage=influenceUsageToday();return type==='referee'?usage.referee:usage.regulation}
function availableInfluenceModes(){return state?.influence>0?['regulation','referee']:[]}
function markInfluenceModeUsed(type){state.influenceUsageToday=influenceUsageToday();state.influenceUsageToday[type==='referee'?'referee':'regulation']+=1;state.influenceUsedToday=true}
function validPendingChoiceIds(){
 const ids=Array.isArray(state?.pendingChoices)?state.pendingChoices:[],lookup=state?.pendingChoiceType==='referee'?refereeById:regulationById;
 return ids.map(String).filter((id,index,list)=>id&&list.indexOf(id)===index&&Boolean(lookup(id)));
}
function sanitizePendingInfluenceState(){
 if(!state)return false;
 let changed=false;
 const validIds=validPendingChoiceIds();
 if(JSON.stringify(validIds)!==JSON.stringify(state.pendingChoices||[])){state.pendingChoices=validIds;changed=true}
 if(state.pendingRefereeId&&!refereeById(state.pendingRefereeId)){state.pendingRefereeId='';changed=true}
 if(!state.pendingRefereeId&&!state.pendingChoices.length&&state.pendingChoiceMinimized){state.pendingChoiceMinimized=false;changed=true}
 return changed;
}
function hasPendingInfluenceDecision(){
 if(!state)return false;
 return Boolean((state.pendingRefereeId&&refereeById(state.pendingRefereeId))||validPendingChoiceIds().length);
}
function pendingInfluenceSummary(){
 if(state?.pendingRefereeId){const referee=refereeById(state.pendingRefereeId);return{icon:'🟨',title:'Designazione da completare',detail:referee?.title||'Scegli la partita'}}
 if(state?.pendingChoiceType==='referee')return{icon:'🟨',title:'4 arbitri in attesa',detail:'Riapri e scegli la designazione'};
 return{icon:'⚖️',title:'4 regolamenti in attesa',detail:'Riapri e approva una proposta'};
}
function renderPendingInfluenceDock(){if(!state?.pendingChoiceMinimized||!hasPendingInfluenceDecision())return'';const summary=pendingInfluenceSummary();return `<button id="pendingInfluenceDock" class="pending-influence-dock" type="button" aria-label="Riapri le scelte dell'Influenza"><span class="pending-dock-icon">${summary.icon}</span><span class="pending-dock-copy"><b>${esc(summary.title)}</b><small>${esc(summary.detail)}</small></span><span class="pending-dock-badge">Apri</span></button>`}
function minimizePendingInfluence(){if(!hasPendingInfluenceDecision())return;state.pendingChoiceMinimized=true;save();render();toast('Scelte ridotte a icona. Consulta la dashboard e riaprile quando vuoi.')}
function reopenPendingInfluence(){if(!hasPendingInfluenceDecision())return;state.pendingChoiceMinimized=false;save();render();if(state.pendingRefereeId)renderRefereeAssignment();else renderInfluenceChoices()}
function bindMinimizeInfluenceButton(){document.querySelector('[data-minimize-influence]')?.addEventListener('click',minimizePendingInfluence)}

function render(){
 closeModal();
 if(!state){renderSetup();return}
 const target=targetTeam();
 document.documentElement.style.cssText+=`;${teamStyle(target)}`;
 if(state.phase==='briefing'){renderBriefing();return}
 if(state.phase==='season'){renderSeason();return}
 if(state.phase==='playoffs'){renderPlayoffs();return}
 if(state.phase==='finished'){renderFinished();return}
 renderSetup();
}

function renderSetup(){
 screen.innerHTML=`<section class="setup-hero"><div class="setup-copy"><span class="setup-kicker">Nuova modalità · 38 giornate</span><h1>Direttore<br>Sportivo</h1><p>Non controlli una squadra: ne ricevi una casuale e devi portarla al titolo intervenendo su regolamenti e designazioni arbitrali. Nessun mercato, nessun bonus OVR, nessuna Intesa.</p><div class="setup-pills"><span class="setup-pill">⚖️ 16 punti Influenza</span><span class="setup-pill">🎲 Interventi ripetibili nella stessa giornata</span><span class="setup-pill">🎙️ Cronaca o Simula</span><span class="setup-pill">🏆 Obiettivo Scudetto</span></div><div class="setup-actions"><button id="newMissionBtn" class="btn gold" type="button">Assegnami una squadra casuale</button><a class="btn" href="index.html">Torna al menu</a></div></div></section>`;
 document.getElementById('newMissionBtn').onclick=startMission;
}

function renderBriefing(){
 const team=targetTeam(),rank=state.startExpectedRank,attack=Math.round(team.attack),defense=Math.round(team.defense),difficulty=directorDifficultyProfile(rank),profile=rank<=3?'Favorita al titolo':rank<=7?'Squadra da zona europea':rank<=12?'Squadra di metà classifica':rank<=16?'Missione difficile':'Missione estrema';
 screen.innerHTML=`<section class="panel briefing-card" style="${teamStyle(team)}"><div class="club-crest"><span>${esc(team.shortName||shortBadge(team.name))}</span></div><div><div class="label">Missione assegnata casualmente</div><h2>Porta ${esc(team.name)} al titolo</h2><p class="subline">${esc(profile)}. Non potrai modificare la rosa né i valori dei giocatori: il tuo strumento sarà l’Influenza Federale, spendibile per regolamenti o arbitri.</p><div class="dossier-grid"><div class="dossier-stat"><b>${team.rating.toFixed(1)}</b><span>OVR stimato</span></div><div class="dossier-stat"><b>${attack}</b><span>Attacco</span></div><div class="dossier-stat"><b>${defense}</b><span>Difesa</span></div><div class="dossier-stat"><b>${rank}°</b><span>Forza prevista</span></div><div class="dossier-stat difficulty-${difficulty.key}"><b>${esc(difficulty.label)}</b><span>Difficoltà</span></div><div class="dossier-stat"><b>${formatDirectorMultiplier(difficulty.multiplier)}</b><span>Coeff. impresa</span></div><div class="dossier-stat"><b>${INFLUENCE_START}</b><span>Influenza iniziale</span></div><div class="dossier-stat"><b>Pt×10</b><span>Base classifica</span></div></div><div class="director-score-explainer"><b>Come funziona la classifica</b><span>(Punti finali × 10 + Influenza rimasta × 80) × coefficiente difficoltà</span></div><div class="setup-actions"><button id="beginSeasonBtn" class="btn primary" type="button">Inizia la stagione</button><button id="rerollMissionBtn" class="btn gold" type="button">Estrai un’altra missione</button></div></div></section>`;
 document.getElementById('beginSeasonBtn').onclick=beginSeason;
 document.getElementById('rerollMissionBtn').onclick=()=>{localStorage.removeItem(SAVE_KEY);state=null;startMission()};
}

function renderMissionHero(){
 const team=targetTeam(),standing=targetRow(),rank=rankOf(team.id),gap=gapFromTop(),active=activeRegulations();
 const dots=Array.from({length:INFLUENCE_START},(_,index)=>`<span class="influence-dot ${index<state.influence?'active':''}"></span>`).join('');
 return `<section class="mission-hero" style="${teamStyle(team)}"><div class="mission-grid"><div><div class="mission-head"><div class="mission-mini-crest">${esc(team.shortName)}</div><div class="mission-title"><div class="label" style="color:#ffe96c">Missione stagionale</div><h1>Porta ${esc(team.name)} al titolo</h1><p>Non gestisci la rosa: governi regolamenti e designazioni arbitrali.</p></div></div><div class="influence-meter"><div class="influence-head"><span>Influenza Federale disponibile</span><b>${state.influence}/${INFLUENCE_START}</b></div><div class="influence-dots">${dots}</div></div></div><div class="mission-stats"><div class="mission-stat"><b>${rank||'—'}°</b><span>Posizione</span></div><div class="mission-stat"><b>${standing.pts}</b><span>Punti</span></div><div class="mission-stat"><b>${gap===0?'0':gap}</b><span>Dalla vetta</span></div><div class="mission-stat"><b>${active.length}</b><span>Regole attive</span></div><div class="mission-stat"><b>${esc(directorDifficultyProfile().label)}</b><span>Difficoltà</span></div></div></div></section>`;
}
function renderMatchPanel(options={}){
 const playoff=Boolean(options.playoff),fixture=playoff?options.fixture:currentTargetFixture();
 if(!fixture)return`<section class="panel"><div class="empty">Nessuna partita disponibile.</div></section>`;
 const home=teamOf(fixture.homeId),away=teamOf(fixture.awayId),roundLabel=playoff?playoffStageLabel(state.playoff?.stage):`Giornata ${state.round+1}`,pendingDecision=hasPendingInfluenceDecision(),usage=influenceUsageToday(),canUseInfluence=!playoff&&!pendingDecision&&state.influence>0,assignments=activeRoundReferees();
 const used=usage.regulation+usage.referee,buttonCopy=used?'⚖️ Usa ancora 1 Influenza':'⚖️ Usa 1 Influenza';
 let reason=playoff?'L’Influenza non può essere utilizzata durante i play off.':pendingDecision?'Hai una scelta in attesa: riaprila e completala prima di giocare.':state.influence<=0?'Influenza esaurita: puoi continuare normalmente con Cronaca o Simula.':'Puoi usare più volte Consiglio Federale e Designazione arbitrale nella stessa giornata. Ogni utilizzo costa 1 Influenza.';
 const refereeBanner=!playoff&&assignments.length?`<div class="referee-active-banner"><span>🟨 Designazioni attive · ${assignments.length}</span>${assignments.slice(0,4).map(item=>`<b>${esc(refereeAssignmentDescription(item))}</b>`).join('')}${assignments.length>4?`<small>+${assignments.length-4} altre designazioni.</small>`:`<small>Una designazione specifica sostituisce quella globale soltanto nella partita scelta.</small>`}</div>`:'';
 const status=playoff?'':`<div class="influence-round-status"><span class="available">⚖️ Consiglio Federale <b>${usage.regulation} usi</b></span><span class="available">🟨 Designazione arbitrale <b>${usage.referee} usi</b></span></div>`;
 const influenceAction=playoff?'':pendingDecision?`<button id="completePendingInfluenceBtn" class="btn gold influence-button pending" type="button">⚖️ Completa la scelta in attesa</button>`:canUseInfluence?`<button id="useInfluenceBtn" class="btn gold influence-button" type="button">${buttonCopy} · ${state.influence} rimasti</button>`:'';
 const actionClass=!playoff&&!pendingDecision&&state.influence<=0?' no-influence':'';
 return `<section class="panel match-panel"><div class="match-panel-head"><div><div class="label">Prossima partita</div><h2>${esc(roundLabel)}</h2></div><span class="round-badge">${fixture.homeId===state.targetTeamId?'La tua missione gioca in casa':'La tua missione gioca in trasferta'}</span></div><div class="matchup"><div class="match-team"><b>${esc(home.name)}</b><span>Casa · OVR ${home.rating.toFixed(1)}</span><span class="team-rank">${rankOf(home.id)||'—'}° in classifica</span></div><div class="versus">VS</div><div class="match-team"><b>${esc(away.name)}</b><span>Trasferta · OVR ${away.rating.toFixed(1)}</span><span class="team-rank">${rankOf(away.id)||'—'}° in classifica</span></div></div>${refereeBanner}${status}<div class="match-actions${actionClass}">${influenceAction}<button id="playLiveBtn" class="btn primary" type="button" ${pendingDecision?'disabled':''}>🎙️ Gioca con cronaca</button><button id="playInstantBtn" class="btn soft" type="button" ${pendingDecision?'disabled':''}>📯 Simula</button></div><div class="regulation-reminder ${state.influence<=0&&!pendingDecision?'influence-finished':''}">${esc(reason)}</div></section>`;
}

function renderSeason(){
 screen.innerHTML=`${renderMissionHero()}${renderMatchPanel()}<div class="dashboard-grid"><section class="panel"><div class="tabs"><button class="tab active" data-tab="home">Home</button><button class="tab" data-tab="table">Classifica</button><button class="tab" data-tab="calendar">Calendario</button><button class="tab" data-tab="stats">Statistiche</button><button class="tab" data-tab="journey">Percorso</button></div><div id="tab-home" class="tab-view active">${renderHomeTab()}</div><div id="tab-table" class="tab-view">${renderTable()}</div><div id="tab-calendar" class="tab-view">${renderCalendar()}</div><div id="tab-stats" class="tab-view">${renderStats()}</div><div id="tab-journey" class="tab-view">${renderJourney()}</div></section><aside>${renderSidebar()}</aside></div>${renderPendingInfluenceDock()}`;
 bindDashboardTabs();
 document.getElementById('pendingInfluenceDock')?.addEventListener('click',reopenPendingInfluence);
 document.getElementById('completePendingInfluenceBtn')?.addEventListener('click',reopenPendingInfluence);
 document.getElementById('useInfluenceBtn')?.addEventListener('click',openInfluenceConfirm);
 document.getElementById('playLiveBtn')?.addEventListener('click',()=>playCurrentRound('live'));
 document.getElementById('playInstantBtn')?.addEventListener('click',()=>playCurrentRound('instant'));
}
function renderHomeTab(){
 const active=activeRegulations(),last=state.history[state.history.length-1],assignments=activeRoundReferees();
 return `<div class="director-summary-grid">${renderMiniTableBox()}${renderMiniCalendarBox()}${renderMiniPlayersBox()}${renderMiniMissionStatsBox()}${renderMiniInterventionsBox(active,assignments)}${renderMiniRoundResultsBox(last)}</div>`;
}
function renderSummaryBox(title,label,body,tab='',extraClass=''){
 const action=tab?`<button class="summary-link" type="button" data-open-tab="${esc(tab)}">Apri sezione</button>`:'';
 return `<section class="summary-box ${esc(extraClass)}"><div class="summary-box-head"><div><span>${esc(label)}</span><h3>${esc(title)}</h3></div>${action}</div>${body}</section>`;
}
function renderMiniTableBox(){
 const rows=sortedTable(),targetIndex=rows.findIndex(row=>row.id===state.targetTeamId),visible=rows.slice(0,5),targetOutside=targetIndex>=5;
 const rowMarkup=(row,index,forcedRank=null)=>{const team=teamOf(row.id),rank=forcedRank||index+1,target=row.id===state.targetTeamId;return `<div class="mini-standing-row ${target?'target':''}"><b>${rank}°</b><span><i style="--club-color:${team?.colors?.primary||'#777'}"></i>${esc(team?.name||'Squadra')}</span><strong>${formatPoints(row.pts)} pt</strong></div>`};
 const separator=targetOutside?'<div class="mini-standing-separator">•••</div>':'';
 const targetRow=targetOutside?rowMarkup(rows[targetIndex],targetIndex,targetIndex+1):'';
 return renderSummaryBox('Mini classifica','Situazione attuale',`<div class="mini-standing-list">${visible.map((row,index)=>rowMarkup(row,index)).join('')}${separator}${targetRow}</div>`,'table','summary-table');
}
function renderMiniCalendarBox(){
 const start=Math.max(0,state.round-1),end=Math.min(TOTAL_ROUNDS,state.round+4),items=[];
 for(let index=start;index<end;index++){
  const fixture=state.schedule[index]?.find(match=>match.homeId===state.targetTeamId||match.awayId===state.targetTeamId);if(!fixture)continue;
  const targetHome=fixture.homeId===state.targetTeamId,opponent=teamOf(targetHome?fixture.awayId:fixture.homeId),history=state.history[index],played=Boolean(history),match=history?.matches?.find(item=>item.homeId===state.targetTeamId||item.awayId===state.targetTeamId),current=index===state.round;
  const status=played?(match?.skipped?'Riposo':`${match?.homeGoals??0}–${match?.awayGoals??0}`):(current?'Prossima':'Da giocare');
  items.push(`<div class="mini-calendar-row ${current?'current':''} ${played?'played':''}"><strong>G${index+1}</strong><div><b>${esc(opponent?.name||'Avversaria')}</b><span>${targetHome?'Casa':'Trasferta'}</span></div><em>${esc(status)}</em></div>`);
 }
 return renderSummaryBox('Calendario','Ultima e prossime gare',items.length?`<div class="mini-calendar-list">${items.join('')}</div>`:'<div class="empty compact-empty">Calendario non disponibile.</div>','calendar','summary-calendar');
}
function renderMiniPlayersBox(){
 const scorers=Object.values(state.stats.scorers||{}).sort((a,b)=>Number(b.goals||0)-Number(a.goals||0)||String(a.name).localeCompare(String(b.name),'it')).slice(0,5);
 let body='';
 if(scorers.length){body=`<div class="mini-player-list">${scorers.map((item,index)=>{const club=teamOf(item.teamId);return `<div class="mini-player-row"><b>${index+1}</b>${renderDirectorPlayerAvatar(item,club)}<span><strong>${esc(item.name)}</strong><small>${esc(club?.name||'Club')}</small></span><em>${Number(item.goals)||0} gol</em></div>`}).join('')}</div>`}
 else{
  const topPlayers=[...PLAYERS].sort((a,b)=>Number(b.ovr||0)-Number(a.ovr||0)).slice(0,5);
  body=`<div class="mini-player-list">${topPlayers.map((player,index)=>{const club=teamOf(player.club);return `<div class="mini-player-row"><b>${index+1}</b>${renderDirectorPlayerAvatar(player,club)}<span><strong>${esc(player.name||'Giocatore')}</strong><small>${esc(club?.name||'Club')}</small></span><em>OVR ${Number(player.ovr)||0}</em></div>`}).join('')}</div><p class="summary-note">Dopo la prima giornata verranno mostrati i capocannonieri.</p>`;
 }
 return renderSummaryBox(scorers.length?'Capocannonieri':'Giocatori da seguire','Statistiche giocatori',body,'stats','summary-players');
}
function renderMiniMissionStatsBox(){
 const row=targetRow(),history=targetHistory(),scorers=Object.values(state.stats.scorers||{}).filter(item=>item.teamId===state.targetTeamId).sort((a,b)=>Number(b.goals||0)-Number(a.goals||0)),top=scorers[0],cleanSheets=history.filter(item=>{const match=item.match;if(match.skipped)return false;return match.homeId===state.targetTeamId?Number(match.awayGoals)===0:Number(match.homeGoals)===0}).length;
 const values=[['Vittorie',row.w],['Pareggi',row.d],['Sconfitte',row.l],['Gol fatti',row.gf],['Gol subiti',row.ga],['Clean sheet',cleanSheets]];
 const body=`<div class="mini-stat-grid">${values.map(([label,value])=>`<div><b>${value}</b><span>${esc(label)}</span></div>`).join('')}</div><div class="mission-top-scorer">${top?renderDirectorPlayerAvatar(top,targetTeam()):'<span class="season-mini-avatar small director-avatar-empty">—</span>'}<span>Top scorer della missione</span><b>${top?esc(top.name):'—'}</b><strong>${Number(top?.goals)||0} gol</strong></div>`;
 return renderSummaryBox('Numeri della squadra','Rendimento missione',body,'stats','summary-mission');
}
function renderMiniInterventionsBox(active,assignments=[]){
 const cards=[];
 for(const assignment of assignments.slice(0,3)){const referee=refereeById(assignment.id);cards.push(`<div class="mini-intervention referee"><b>${esc(referee?.title||'Designazione arbitrale')}</b><span>${esc(refereeAssignmentDescription(assignment))}</span></div>`)}
 const room=Math.max(0,4-cards.length);for(const regulation of active.slice(0,room))cards.push(`<div class="mini-intervention"><b>${esc(regulation.title)}</b><span>${esc(directorRegulationDurationLabel(regulation))}</span></div>`);
 const hidden=Math.max(0,assignments.length+active.length-cards.length);if(hidden)cards.push(`<div class="mini-intervention more"><b>+${hidden} altri interventi</b><span>Consulta il riepilogo completo</span></div>`);
 const body=cards.length?`<div class="mini-intervention-list">${cards.join('')}</div>`:'<div class="empty compact-empty">Nessun regolamento o arbitro attivo.</div>';
 return renderSummaryBox('Interventi attivi','Influenza Federale',body,'home','summary-interventions');
}

function renderMiniRoundResultsBox(last){
 if(!last)return renderSummaryBox('Ultimo turno','Risultati del campionato','<div class="empty compact-empty">Gioca la prima giornata per vedere i risultati.</div>','','summary-results');
 const targetMatch=last.matches.find(match=>match.homeId===state.targetTeamId||match.awayId===state.targetTeamId),others=last.matches.filter(match=>match!==targetMatch).slice(0,4),ordered=targetMatch?[targetMatch,...others]:others;
 const body=`<div class="mini-results-list">${ordered.map(match=>{const home=teamOf(match.homeId),away=teamOf(match.awayId),target=match.homeId===state.targetTeamId||match.awayId===state.targetTeamId;return `<div class="mini-result-row ${target?'target':''}"><span>${esc(home?.shortName||shortBadge(home?.name))}</span><b>${match.skipped?'RIP':`${match.homeGoals}–${match.awayGoals}`}</b><span>${esc(away?.shortName||shortBadge(away?.name))}</span></div>`}).join('')}</div>`;
 return renderSummaryBox(`Giornata ${last.round}`,'Ultimi risultati',body,'journey','summary-results');
}
function renderRoundResults(matches=[]){return `<div class="round-results">${matches.map(match=>renderResultRow(match)).join('')}</div>`}
function renderResultRow(match){
 const home=teamOf(match.homeId),away=teamOf(match.awayId),target=match.homeId===state.targetTeamId||match.awayId===state.targetTeamId;
 if(match.skipped)return`<div class="result-row rested ${target?'target':''}"><span>${esc(home.name)}</span><b class="result-score">RIPOSO</b><span>${esc(away.name)}</span></div>`;
 const marker=match.decidedByPenalties?' d.c.r.':'';
 return `<div class="result-row ${target?'target':''}"><span>${esc(home.name)}</span><b class="result-score">${match.homeGoals}–${match.awayGoals}${marker}</b><span>${esc(away.name)}</span></div>`;
}
function renderTable(){
 const rows=sortedTable();
 return `<div style="overflow:auto"><table><thead><tr><th>#</th><th>Squadra</th><th>Pt</th><th>G</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th><th>DR</th></tr></thead><tbody>${rows.map((row,index)=>{const team=teamOf(row.id),target=row.id===state.targetTeamId;return`<tr class="${target?'target-row':''} ${index===0?'leader-row':''}"><td>${index+1}</td><td><span class="standing-name"><i class="standing-dot" style="--club-color:${team.colors?.primary||'#777'}"></i>${esc(team.name)}</span></td><td>${formatPoints(row.pts)}</td><td>${row.p}</td><td>${row.w}</td><td>${row.d}</td><td>${row.l}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.gf-row.ga>=0?'+':''}${row.gf-row.ga}</td></tr>`}).join('')}</tbody></table></div>`;
}
function formatPoints(value){const number=Number(value)||0;return Number.isInteger(number)?String(number):number.toFixed(1)}
function renderCalendar(){
 return `<div class="calendar-list">${state.schedule.map((round,index)=>{const fixture=round.find(match=>match.homeId===state.targetTeamId||match.awayId===state.targetTeamId),home=teamOf(fixture.homeId),away=teamOf(fixture.awayId),played=index<state.round,current=index===state.round,history=state.history[index],targetMatch=history?.matches?.find(match=>match.homeId===state.targetTeamId||match.awayId===state.targetTeamId);return`<div class="calendar-round ${played?'played':''} ${current?'current':''}"><b>G${index+1}</b><span>${esc(home.name)} vs ${esc(away.name)}</span><span>${targetMatch?(targetMatch.skipped?'Riposo':`${targetMatch.homeGoals}–${targetMatch.awayGoals}`):current?'Prossima':'Da giocare'}</span></div>`}).join('')}</div>`;
}
function targetHistory(){return state.history.map(round=>{const match=round.matches.find(item=>item.homeId===state.targetTeamId||item.awayId===state.targetTeamId);return match?{round:round.round,match}:null}).filter(Boolean)}
function targetOutcome(match){if(match.skipped)return'R';const targetHome=match.homeId===state.targetTeamId,winner=match.winnerId||(match.homeGoals>match.awayGoals?match.homeId:match.awayGoals>match.homeGoals?match.awayId:'');if(!winner)return'D';return winner===state.targetTeamId?'W':'L'}
function renderJourney(){
 const history=targetHistory();
 return history.length?`<div class="history-list">${history.slice().reverse().map(item=>{const match=item.match,opponent=teamOf(match.homeId===state.targetTeamId?match.awayId:match.homeId),outcome=targetOutcome(match),label=outcome==='W'?'Vittoria':outcome==='D'?'Pareggio':outcome==='L'?'Sconfitta':'Riposo';return`<div class="history-item"><span class="history-day">G${item.round}</span><div><b>${esc(opponent.name)} · ${match.homeId===state.targetTeamId?'Casa':'Trasferta'}</b><small>${match.skipped?'Partita non disputata':`${match.homeGoals}–${match.awayGoals}${match.decidedByPenalties?' dopo i rigori':''}`}</small></div><span class="outcome-pill ${outcome==='W'?'win':outcome==='D'||outcome==='R'?'draw':'loss'}">${label}</span></div>`}).join('')}</div>`:`<div class="empty">Il percorso della squadra-obiettivo comparirà dopo la prima giornata.</div>`;
}
function renderStats(){
 const row=targetRow(),history=targetHistory(),goalsPerGame=row.p?row.gf/row.p:0,against=row.p?row.ga/row.p:0,allScorers=Object.values(state.stats.scorers||{}).sort((a,b)=>Number(b.goals||0)-Number(a.goals||0)||String(a.name).localeCompare(String(b.name),'it')),scorers=allScorers.filter(item=>item.teamId===state.targetTeamId),top=scorers[0],cleanSheets=history.filter(item=>{const match=item.match;if(match.skipped)return false;return match.homeId===state.targetTeamId?Number(match.awayGoals)===0:Number(match.homeGoals)===0}).length;
 const leagueTop=allScorers.length?`<h3 style="margin-top:18px">Capocannonieri del campionato</h3><div class="full-scorer-list">${allScorers.slice(0,10).map((item,index)=>{const club=teamOf(item.teamId);return `<div class="full-scorer-row ${item.teamId===state.targetTeamId?'target':''}"><b>${index+1}</b>${renderDirectorPlayerAvatar(item,club)}<span><strong>${esc(item.name)}</strong><small>${esc(club?.name||'Club')}</small></span><em>${Number(item.goals)||0} gol</em></div>`}).join('')}</div>`:`<div class="empty" style="margin-top:18px">La classifica marcatori comparirà dopo la prima giornata.</div>`;
 return `<div class="stats-grid"><div class="stat-card"><b>${row.gf}</b><span>Gol fatti</span></div><div class="stat-card"><b>${row.ga}</b><span>Gol subiti</span></div><div class="stat-card"><b>${goalsPerGame.toFixed(2)}</b><span>Gol a partita</span></div><div class="stat-card"><b>${against.toFixed(2)}</b><span>Subiti a partita</span></div><div class="stat-card"><b>${cleanSheets}</b><span>Clean sheet</span></div><div class="stat-card"><b>${top?esc(top.name):'—'}</b><span>Capocannoniere squadra</span></div></div>${leagueTop}${scorers.length?`<h3 style="margin-top:18px">Marcatori della missione</h3><div class="mission-scorer-list">${scorers.slice(0,8).map(item=>`<article class="mission-scorer-row">${renderDirectorPlayerAvatar(item,targetTeam())}<span><b>${esc(item.name)}</b><small>${item.goals} gol</small></span></article>`).join('')}</div>`:''}`;
}
function renderSidebar(){
 const team=targetTeam(),form=targetHistory().slice(-5).map(item=>targetOutcome(item.match)),upcoming=[],usage=influenceUsageToday();
 for(let index=state.round+1;index<Math.min(TOTAL_ROUNDS,state.round+5);index++){const fixture=state.schedule[index].find(match=>match.homeId===team.id||match.awayId===team.id),opponent=teamOf(fixture.homeId===team.id?fixture.awayId:fixture.homeId);upcoming.push({round:index+1,opponent,venue:fixture.homeId===team.id?'Casa':'Trasferta'})}
 return `<section class="panel sidebar-card"><div class="label">Stato missione</div><h3>${esc(team.name)}</h3><p class="subline">Forza prevista iniziale: ${state.startExpectedRank}° · ${esc(directorDifficultyProfile().label)} ${formatDirectorMultiplier(directorDifficultyProfile().multiplier)} · OVR ${directorCurrentOvr(team).toFixed(1)}${directorChaoticOvr(team)!==null?' · caotico':''}</p><div class="target-form">${form.length?form.map(value=>`<span class="form-dot ${value}">${value}</span>`).join(''):'<span class="subline">Nessuna partita</span>'}</div></section><section class="panel sidebar-card"><div class="label">Prossime partite</div><div class="next-fixtures">${upcoming.length?upcoming.map(item=>`<div class="fixture-mini"><strong>G${item.round}</strong><b>${esc(item.opponent.name)}</b><span>${item.venue}</span></div>`).join(''):'<div class="empty">Fine calendario</div>'}</div></section><section class="panel sidebar-card"><div class="label">Influenza utilizzata</div><h3>${INFLUENCE_START-state.influence}/${INFLUENCE_START}</h3><p class="subline">In questa giornata: ${usage.regulation} Consigli Federali e ${usage.referee} Designazioni. Puoi continuare finché hai Influenza e non avvii la partita.</p></section>`;
}

function activateDashboardTab(tabName){
 const target=String(tabName||'home');
 document.querySelectorAll('.tab').forEach(item=>item.classList.toggle('active',item.dataset.tab===target));
 document.querySelectorAll('.tab-view').forEach(view=>view.classList.toggle('active',view.id===`tab-${target}`));
 document.querySelector('.tabs')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function bindDashboardTabs(){
 document.querySelectorAll('.tab').forEach(button=>button.addEventListener('click',()=>activateDashboardTab(button.dataset.tab)));
 document.querySelectorAll('[data-open-tab]').forEach(button=>button.addEventListener('click',()=>activateDashboardTab(button.dataset.openTab)));
}

function openInfluenceConfirm(){
 if(state.influence<=0||state.phase!=='season'||hasPendingInfluenceDecision())return;
 const usage=influenceUsageToday();
 modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal influence-hub"><div class="label">Intervento federale</div><h2>Come vuoi usare 1 punto Influenza?</h2><p class="subline">Puoi utilizzare entrambe le categorie più volte nella stessa giornata. Completa sempre la scelta aperta prima di iniziarne un’altra.</p><div class="influence-mode-grid"><button id="chooseRegulationsBtn" class="influence-mode-card" type="button"><span>⚖️</span><b>Consiglio Federale</b><p>Estrai quattro regolamenti casuali e approvane uno.</p><small>Usato ${usage.regulation} volte oggi · Costo 1</small></button><button id="chooseRefereesBtn" class="influence-mode-card referee" type="button"><span>🟨</span><b>Designazione arbitrale</b><p>Estrai quattro arbitri casuali e assegnane uno. Se scegli «Sfavorisci» sulla tua squadra, recuperi 1 Influenza.</p><small>Usata ${usage.referee} volte oggi · Costo 1</small></button></div><div class="modal-actions"><button id="cancelInfluenceBtn" class="btn" type="button">Annulla</button></div></section></div>`;
 document.getElementById('chooseRegulationsBtn')?.addEventListener('click',()=>revealInfluenceChoices('regulation'));document.getElementById('chooseRefereesBtn')?.addEventListener('click',()=>revealInfluenceChoices('referee'));document.getElementById('cancelInfluenceBtn').onclick=closeModal;
}

function availableRegulationPool(){
 const activeIds=new Set((state.regulations||[]).map(item=>item.id));
 let pool=REGULATIONS.filter(regulation=>!activeIds.has(regulation.id)&&!state.seenRegulationIds.includes(regulation.id));
 if(pool.length<4){state.seenRegulationIds=[];pool=REGULATIONS.filter(regulation=>!activeIds.has(regulation.id))}
 return pool;
}
function revealInfluenceChoices(type='regulation'){
 const normalizedType=type==='referee'?'referee':'regulation';if(state.influence<=0||hasPendingInfluenceDecision())return;
 const refereeMode=normalizedType==='referee',pool=shuffle(refereeMode?REFEREES:availableRegulationPool()).slice(0,4);if(pool.length<4){toast(refereeMode?'Catalogo arbitri non sufficiente.':'Catalogo regolamenti non sufficiente.');return}
 state.influence-=1;markInfluenceModeUsed(normalizedType);state.pendingChoiceType=normalizedType;state.pendingChoiceMinimized=false;state.pendingChoices=pool.map(item=>item.id);if(!refereeMode)state.seenRegulationIds=[...new Set([...state.seenRegulationIds,...state.pendingChoices])];save();renderInfluenceChoices();
}

function renderInfluenceChoices(){
 if(state.pendingChoiceType==='referee'){renderRefereeChoices();return}
 renderRegulationChoices();
}
function renderRegulationChoices(){
 const choices=(state.pendingChoices||[]).map(regulationById).filter(Boolean);
 if(!choices.length){state.pendingChoices=[];state.pendingChoiceMinimized=false;save();render();toast('La scelta non era più valida ed è stata rimossa. Puoi continuare la stagione.');return}
 modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal choice-event"><div class="choice-modal-toolbar"><div class="label">Evento decisionale · Consiglio Federale</div><button class="minimize-choice-btn" type="button" data-minimize-influence aria-label="Riduci le scelte a icona"><span>—</span> Riduci a icona</button></div><h2>Il regolamento deve cambiare</h2><p>Hai speso un punto Influenza. Le quattro proposte sono state estratte casualmente: scegline una da applicare all’intero campionato.</p><div class="regulation-choice-grid">${choices.map((regulation,index)=>`<button class="regulation-choice" type="button" data-regulation-id="${esc(regulation.id)}"><span class="choice-number">${index+1}</span><b>${esc(regulation.title)}</b><p>${esc(regulation.effect)}</p><small>${esc(regulation.duration)} · Origine: ${esc(regulation.sourceEvent)}</small></button>`).join('')}</div><p class="subline forced-choice-note">Puoi ridurre le scelte a icona per consultare classifica, calendario e statistiche. Prima di giocare dovrai comunque approvare una proposta. Dopo la scelta potrai usare nuovamente questa categoria oppure l’altra, finché hai Influenza.</p></section></div>`;
 bindMinimizeInfluenceButton();
 document.querySelectorAll('[data-regulation-id]').forEach(button=>button.addEventListener('click',()=>approveRegulation(button.dataset.regulationId)));
}
function approveRegulation(id){
 const regulation=regulationById(id);if(!regulation)return;
 let replaced=null;
 if(regulation.group&&!regulation.instant){const index=state.regulations.findIndex(item=>item.group===regulation.group);if(index>=0){replaced=regulationById(state.regulations[index].id)||state.regulations[index];state.regulations.splice(index,1)}}
 if(regulation.instant){applyInstantRegulation(regulation)}else{const activeEntry={id:regulation.id,group:regulation.group,activatedRound:state.round+1,remainingRounds:Number(regulation.rounds)||0};if(regulation.rule==='chaoticOvr')activeEntry.chaoticOvrValues=Object.fromEntries(TEAMS.map(team=>[team.id,randomInt(5,200)]));state.regulations.push(activeEntry)};
 state.regulationHistory.push({id:regulation.id,title:regulation.title,round:state.round+1,replaced:replaced?.title||''});
 state.pendingChoices=[];
 state.pendingChoiceType='regulation';
 state.pendingChoiceMinimized=false;
 save();
 render();
 modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal"><div class="label">Regolamento approvato</div><h2>${esc(regulation.title)}</h2><p class="subline">${esc(regulation.effect)}</p>${replaced?`<div class="regulation-reminder">Sostituisce: ${esc(replaced.title)}</div>`:''}<div class="modal-actions"><button id="closeApprovedBtn" class="btn primary" type="button">Torna alla partita</button></div></section></div>`;
 document.getElementById('closeApprovedBtn').onclick=closeModal;
}
function applyInstantRegulation(regulation){
 if(regulation.rule==='bottomEqualsLeader'){
  const table=sortedTable();if(table.length){const leader=table[0],bottom=table[table.length-1];bottom.pts=leader.pts;toast(`${teamOf(bottom.id).name} raggiunge la capolista a ${formatPoints(leader.pts)} punti.`)}
 }
}
function renderRefereeChoices(){
 const choices=(state.pendingChoices||[]).map(refereeById).filter(Boolean);
 if(!choices.length){state.pendingChoices=[];state.pendingChoiceType='regulation';state.pendingChoiceMinimized=false;save();render();toast('La designazione non era più valida ed è stata rimossa. Puoi continuare la stagione.');return}
 modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal choice-event referee-choice-event"><div class="choice-modal-toolbar"><div class="label">Designazione arbitrale</div><button class="minimize-choice-btn" type="button" data-minimize-influence aria-label="Riduci le scelte a icona"><span>—</span> Riduci a icona</button></div><h2>Scegli un arbitro</h2><p>Hai speso un punto Influenza. Gli arbitri possono ricomparire in qualsiasi giornata: scegli obbligatoriamente uno dei quattro profili estratti. Se un arbitro permette di sfavorire una squadra e scegli la tua, recuperi 1 Influenza.</p><div class="regulation-choice-grid referee-choice-grid">${choices.map((referee,index)=>`<button class="regulation-choice referee-choice ${referee.danger?'danger':''}" type="button" data-referee-id="${esc(referee.id)}"><span class="choice-number">${index+1}</span><b>${esc(referee.title)}</b><p>${esc(referee.effect)}</p><small>${esc(referee.scopeLabel)}</small></button>`).join('')}</div><p class="subline forced-choice-note">Puoi ridurre le scelte a icona per studiare il turno e la classifica. Prima di giocare dovrai completare la designazione. Dopo la scelta potrai effettuare altre designazioni o convocare nuovamente il Consiglio Federale, finché hai Influenza.</p></section></div>`;
 bindMinimizeInfluenceButton();
 document.querySelectorAll('[data-referee-id]').forEach(button=>button.addEventListener('click',()=>beginRefereeAssignment(button.dataset.refereeId)));
}
function beginRefereeAssignment(id){
 const referee=refereeById(id);if(!referee)return;
 state.pendingRefereeId=referee.id;
 state.pendingChoices=[];
 state.pendingChoiceMinimized=false;
 save();
 if(referee.scope==='round'){assignRoundReferee(referee.id);return}
 renderRefereeAssignment();
}
function renderRefereeAssignment(){
 const referee=refereeById(state.pendingRefereeId);if(!referee){state.pendingRefereeId='';save();closeModal();return}
 const rankMap=Object.fromEntries(sortedTable().map((row,index)=>[row.id,index+1]));
 const fixtures=currentRoundMatches();
 modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal referee-assignment-modal"><div class="choice-modal-toolbar light"><div class="label">${esc(referee.title)}</div><button class="minimize-choice-btn" type="button" data-minimize-influence aria-label="Riduci la designazione a icona"><span>—</span> Riduci a icona</button></div><h2>Scegli la partita${referee.chooseFavored?' e la squadra da favorire':referee.chooseDisfavored?' e la squadra da sfavorire':''}</h2><p class="subline">${esc(referee.effect)}</p>${referee.danger?`<div class="referee-danger-warning"><b>Rischio scandalo:</b> il 20% di probabilità riguarda sempre la tua squadra, anche se usi l’arbitro in un’altra partita.</div>`:''}${referee.chooseDisfavored?`<div class="self-disadvantage-info"><b>Ricompensa autosabotaggio:</b> scegliendo «Sfavorisci ${esc(targetTeam()?.name||'la tua squadra')}» recuperi 1 Influenza.</div>`:''}<div class="referee-fixtures">${fixtures.map(fixture=>{const home=teamOf(fixture.homeId),away=teamOf(fixture.awayId);return`<article class="referee-fixture"><div class="referee-fixture-head"><span>${rankMap[home.id]}°</span><b>${esc(home.name)} – ${esc(away.name)}</b><span>${rankMap[away.id]}°</span></div>${referee.chooseFavored||referee.chooseDisfavored?`<div class="referee-favor-actions"><button class="btn compact team-favor-btn ${referee.chooseDisfavored?'team-disfavor-btn':''}" style="${teamButtonStyle(home)}" type="button" data-assign-referee="1" data-home-id="${esc(home.id)}" data-away-id="${esc(away.id)}" data-favored-id="${esc(home.id)}">${referee.chooseDisfavored?'Sfavorisci':'Favorisci'} ${esc(home.name)}</button><button class="btn compact team-favor-btn ${referee.chooseDisfavored?'team-disfavor-btn':''}" style="${teamButtonStyle(away)}" type="button" data-assign-referee="1" data-home-id="${esc(home.id)}" data-away-id="${esc(away.id)}" data-favored-id="${esc(away.id)}">${referee.chooseDisfavored?'Sfavorisci':'Favorisci'} ${esc(away.name)}</button></div>`:`<button class="btn compact referee-match-select" type="button" data-assign-referee="1" data-home-id="${esc(home.id)}" data-away-id="${esc(away.id)}">Assegna a questa partita</button>`}</article>`}).join('')}</div><p class="subline forced-choice-note">Il punto Influenza è già stato consumato: devi completare la designazione.</p></section></div>`;
 bindMinimizeInfluenceButton();
 document.querySelectorAll('[data-assign-referee]').forEach(button=>button.addEventListener('click',()=>assignRoundReferee(referee.id,{homeId:button.dataset.homeId,awayId:button.dataset.awayId},button.dataset.favoredId||'')));
}
function assignRoundReferee(id,fixture=null,favoredTeamId=''){
 const referee=refereeById(id);if(!referee)return;
 const selfDisadvantageReward=earnsSelfDisadvantageInfluence(referee,favoredTeamId);
 if(selfDisadvantageReward)state.influence=clamp((Number(state.influence)||0)+1,0,INFLUENCE_START);
 const assignment={assignmentId:`ref-${state.round+1}-${Date.now().toString(36)}-${Math.floor(rand()*1000000).toString(36)}`,id:referee.id,round:state.round+1,scope:referee.scope,fixtureKey:fixture?fixtureKey(fixture):'',homeId:fixture?.homeId||'',awayId:fixture?.awayId||'',favoredTeamId:String(favoredTeamId||''),createdAt:new Date().toISOString(),caught:false,selfDisadvantageReward};
 state.roundReferees=Array.isArray(state.roundReferees)?state.roundReferees:[];
 const slot=referee.scope==='round'?'__global__':assignment.fixtureKey,index=state.roundReferees.findIndex(item=>(refereeById(item.id)?.scope==='round'?'__global__':item.fixtureKey)===slot),replaced=index>=0?state.roundReferees[index]:null;
 if(index>=0)state.roundReferees.splice(index,1,assignment);else state.roundReferees.push(assignment);
 state.refereeHistory.push({...assignment,title:referee.title,replaced:replaced?refereeById(replaced.id)?.title||replaced.id:''});
 state.pendingRefereeId='';state.pendingChoices=[];state.pendingChoiceType='regulation';state.pendingChoiceMinimized=false;save();render();
 const rewardBanner=selfDisadvantageReward?`<div class="self-disadvantage-reward"><b>+1 Influenza</b><span>Hai scelto di sfavorire ${esc(targetTeam()?.name||'la tua squadra')}: il punto speso per questa designazione è stato recuperato. Ora hai ${state.influence}/${INFLUENCE_START} Influenza.</span></div>`:'';
 modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal"><div class="label">Designazione confermata</div><h2>${esc(referee.title)}</h2><p class="subline">${esc(refereeAssignmentDescription(assignment))}</p><div class="referee-confirm-effect">${esc(referee.effect)}</div>${rewardBanner}${replaced?`<div class="regulation-reminder">Sostituisce: ${esc(refereeById(replaced.id)?.title||replaced.id)}</div>`:''}<div class="modal-actions"><button id="closeRefereeApprovedBtn" class="btn primary" type="button">Torna alla partita</button></div></section></div>`;document.getElementById('closeRefereeApprovedBtn').onclick=closeModal;
 if(selfDisadvantageReward)toast(`Autosabotaggio: +1 Influenza. Totale ${state.influence}/${INFLUENCE_START}.`);
}

function poisson(lambda){let limit=Math.exp(-Math.max(0,lambda)),product=1,count=0;do{count++;product*=Math.max(.000001,rand())}while(product>limit&&count<12);return count-1}
function pickScorer(teamId){
 const players=PLAYERS_BY_CLUB.get(String(teamId))||[];
 if(!players.length)return{id:`${teamId}-unknown`,name:'Giocatore'};
 const weighted=[];
 for(const player of players){const role=String(player.role||'C').toUpperCase(),copies=role==='A'?5:role==='C'?3:role==='D'?1:0;for(let i=0;i<copies;i++)weighted.push(player)}
 return pick(weighted.length?weighted:players)||players[0];
}
function strongestPlayer(teamId){const players=PLAYERS_BY_CLUB.get(String(teamId))||[];return [...players].sort((a,b)=>Number(b.ovr||0)-Number(a.ovr||0))[0]||pickScorer(teamId)}
function makeRefereeGoal(teamId,minute,scorer=null,label=''){const player=scorer||pickScorer(teamId);return{teamId,minute:Number(minute)||1,playerId:String(player.id||`${teamId}-referee`),playerName:String(player.name||label||'Giocatore'),annulled:false,value:1,refereeGoal:true}}
function addRefereeGoals(goals,teamId,count,startMinute=90,scorer=null){for(let index=0;index<count;index++)goals.push(makeRefereeGoal(teamId,startMinute+index,scorer))}
function generateGoals(teamId,count,duration){const goals=[];for(let index=0;index<count;index++){const scorer=pickScorer(teamId);goals.push({teamId,minute:randomInt(1,duration),playerId:String(scorer.id),playerName:String(scorer.name),annulled:false,value:1})}return goals}
function matchStrength(home,away){const homeAttack=(directorAttackStrength(home)-directorDefenseStrength(away))/MATCH_BALANCE.strengthDivisor,awayAttack=(directorAttackStrength(away)-directorDefenseStrength(home))/MATCH_BALANCE.strengthDivisor,quality=((Number(home.rating)+Number(away.rating))/2-MATCH_BALANCE.qualityReference)/MATCH_BALANCE.qualityDivisor;return{homeLambda:clamp(MATCH_BALANCE.homeBase+homeAttack+quality,.22,3.5),awayLambda:clamp(MATCH_BALANCE.awayBase+awayAttack+quality,.18,3.2)}}
function matchDuration(referee=null){if(refereeById(referee?.id)?.rule==='fiveMinuteMatches')return 5;if(hasRule('duration30'))return 30;if(hasRule('duration120'))return 120;return 90}
function incidentFactor(){let factor=1;if(hasRule('effectiveTime'))factor*=2.15;if(hasRule('duration120'))factor*=1.35;if(hasRule('duration30'))factor*=.55;return factor}
function preRoundBottomIds(){return new Set(sortedTable().slice(9).map(row=>row.id))}
function directorGoalValue(goal){return Math.max(1,Number(goal?.value)||1)}
function directorComebackWinner(goals,winnerId,homeId,awayId){if(!winnerId)return false;let home=0,away=0,trailed=false;for(const goal of [...(goals||[])].sort((a,b)=>Number(a.minute)-Number(b.minute))){if(goal.teamId===homeId)home+=directorGoalValue(goal);else if(goal.teamId===awayId)away+=directorGoalValue(goal);if(winnerId===homeId&&home<away)trailed=true;if(winnerId===awayId&&away<home)trailed=true}return trailed}
function directorLateWinningGoal(goals,winnerId,homeId,awayId,homeScore,awayScore){if(!winnerId||Number(homeScore)===Number(awayScore))return null;const loserFinal=winnerId===homeId?Number(awayScore)||0:Number(homeScore)||0;let running=0;for(const goal of [...(goals||[])].sort((a,b)=>Number(a.minute)-Number(b.minute))){if(goal.teamId!==winnerId)continue;running+=directorGoalValue(goal);if(running>loserFinal)return Number(goal.minute)>=85?goal:null}return null}
function applyDirectorOvrRegulations(goals,home,away,duration,commentary){
 const homeOvr=directorCurrentOvr(home),awayOvr=directorCurrentOvr(away),weaker=homeOvr<awayOvr?home:awayOvr<homeOvr?away:null,stronger=weaker?(weaker.id===home.id?away:home):null;
 if(weaker&&hasRule('underdogGoalChance')&&rand()<.35){const goal=makeRefereeGoal(weaker.id,randomInt(2,Math.max(2,duration)),pickScorer(weaker.id));goal.refereeGoal=false;goal.regulationGoal=true;goals.push(goal);commentary.push({minute:`${goal.minute}’`,text:`La fionda di Ballardini: gol bonus per ${weaker.name}.`,type:'rule'})}
 if(stronger&&hasRule('favoriteFirstGoalSave')&&rand()<.30){const first=goals.filter(goal=>!goal.annulled&&goal.teamId===weaker.id).sort((a,b)=>Number(a.minute)-Number(b.minute))[0];if(first){first.annulled=true;commentary.push({minute:`${first.minute}’`,text:`La corazza di Golia: annullato il primo gol subito da ${stronger.name}.`,type:'rule'})}}
 if(weaker&&stronger&&hasRule('underdogDeficitCap75')){const ordered=goals.filter(goal=>!goal.annulled).sort((a,b)=>Number(a.minute)-Number(b.minute));let homeRun=0,awayRun=0,removed=0;for(const goal of ordered){const value=directorGoalValue(goal),minute=Number(goal.minute)||0;let accepted=value;if(minute<75&&goal.teamId===stronger.id){const strongScore=stronger.id===home.id?homeRun:awayRun,weakScore=weaker.id===home.id?homeRun:awayRun,maxAllowed=Math.max(0,2-(strongScore-weakScore));accepted=Math.min(value,maxAllowed);if(accepted<=0){goal.annulled=true;removed+=value;continue}if(accepted<value){goal.value=accepted;removed+=value-accepted}}if(goal.teamId===home.id)homeRun+=accepted;else if(goal.teamId===away.id)awayRun+=accepted}if(removed)commentary.push({minute:'75’',text:`Partita sempre aperta: ${removed} ${removed===1?'gol annullato':'gol annullati'} prima del 75° per proteggere ${weaker.name}.`,type:'rule'})}
 return{homeOvr,awayOvr,weakerId:String(weaker?.id||''),strongerId:String(stronger?.id||'')};
}

function simulateMatch(fixture,context={}){
 const home=teamOf(fixture.homeId),away=teamOf(fixture.awayId),knockout=Boolean(context.knockout),bottomIds=context.bottomIds||new Set(),leaderId=String(context.leaderId||''),rankMap=context.rankMap||{},pointsMap=context.pointsMap||{},referee=context.refereeAssignment||null,refereeProfile=refereeById(referee?.id),refereeNotes=[];
 const refereeNote=text=>{refereeNotes.push(text)};
 if(context.skipped)return{homeId:home.id,awayId:away.id,homeGoals:0,awayGoals:0,skipped:true,winnerId:'',homePoints:0,awayPoints:0,commentary:[{minute:'—',text:'La capolista e la sua avversaria osservano un turno di riposo imposto dal regolamento.',type:'rule'}],goals:[],homeIncidents:{yellow:0,red:0,injuries:0,missedPenalties:0},awayIncidents:{yellow:0,red:0,injuries:0,missedPenalties:0},refereeId:referee?.id||'',refereeAssignmentId:referee?.assignmentId||'',refereeNotes};
 if(hasRule('penaltiesOnly')&&!referee){
  const homeChance=.5+clamp((directorCurrentOvr(home)-directorCurrentOvr(away))/100,-.15,.15),homeWins=rand()<homeChance,winnerId=homeWins?home.id:away.id;
  return finalizeMatch({home,away,goals:[],homeGoals:0,awayGoals:0,winnerId,decidedByPenalties:true,commentary:[{minute:'0’',text:'Il regolamento manda le squadre direttamente ai calci di rigore.',type:'rule'},{minute:'RIG',text:`${teamOf(winnerId).name} vince la lotteria dei rigori.`,type:'goal'}],homeIncidents:{yellow:0,red:0,injuries:0,missedPenalties:0},awayIncidents:{yellow:0,red:0,injuries:0,missedPenalties:0},bottomIds,knockout,leaderId,rankMap,pointsMap,refereeId:'',refereeNotes:[]});
 }
 const duration=matchDuration(referee),strength=matchStrength(home,away),durationMultiplier=duration/90,formationMultiplier=hasRule('formation444')?1.22:(hasRule('formation333') ? .82 : 1);
 let homeLambda=strength.homeLambda*durationMultiplier*formationMultiplier,awayLambda=strength.awayLambda*durationMultiplier*formationMultiplier;
 const selectedTeamId=String(referee?.favoredTeamId||'');
 if(refereeProfile?.rule==='leaderRedCard'&&leaderId){if(home.id===leaderId){homeLambda*=.62;awayLambda*=1.28}else if(away.id===leaderId){awayLambda*=.62;homeLambda*=1.28}}
 if(refereeProfile?.rule==='targetGuaranteedRed'&&selectedTeamId){if(home.id===selectedTeamId){homeLambda*=.64;awayLambda*=1.25}else if(away.id===selectedTeamId){awayLambda*=.64;homeLambda*=1.25}}
 if(refereeProfile?.rule==='higherRankGuaranteedRed'){const homeRank=Number(rankMap[home.id])||99,awayRank=Number(rankMap[away.id])||99;if(homeRank<awayRank){homeLambda*=.64;awayLambda*=1.25}else if(awayRank<homeRank){awayLambda*=.64;homeLambda*=1.25}}
 let homeCount=poisson(homeLambda),awayCount=poisson(awayLambda);
 let goals=[...generateGoals(home.id,homeCount,duration),...generateGoals(away.id,awayCount,duration)].sort((a,b)=>a.minute-b.minute||rand()-.5);
 const factor=incidentFactor()*(refereeProfile?.rule==='fiveMinuteMatches' ? .08 : 1);
 const makeIncidents=team=>{const yellow=poisson(1.35*factor*(2-team.discipline));let red=rand()<.075*factor?1:0;if(hasRule('yellowEqualsRed'))red=Math.min(3,yellow);return{yellow,red,injuries:rand()<.10*factor?1:0,missedPenalties:rand()<.065*factor?1:0}};
 const homeIncidents=makeIncidents(home),awayIncidents=makeIncidents(away),commentary=[];
 if(refereeProfile?.rule==='leaderRedCard'&&leaderId){if(home.id===leaderId){homeIncidents.red=Math.max(1,homeIncidents.red);homeIncidents.refereeRed=true;commentary.push({minute:`${randomInt(12,Math.max(12,duration))}’`,text:`Arbitro severo: espulsione garantita per la capolista ${home.name}.`,type:'referee'});refereeNote(`${home.name}, capolista, ha ricevuto un’espulsione.`)}else if(away.id===leaderId){awayIncidents.red=Math.max(1,awayIncidents.red);awayIncidents.refereeRed=true;commentary.push({minute:`${randomInt(12,Math.max(12,duration))}’`,text:`Arbitro severo: espulsione garantita per la capolista ${away.name}.`,type:'referee'});refereeNote(`${away.name}, capolista, ha ricevuto un’espulsione.`)}}
 if(refereeProfile?.rule==='targetGuaranteedRed'&&selectedTeamId){const selected=selectedTeamId===home.id?home:selectedTeamId===away.id?away:null,incidents=selected?.id===home.id?homeIncidents:selected?.id===away.id?awayIncidents:null;if(selected&&incidents){incidents.red=Math.max(1,incidents.red);incidents.refereeRed=true;const minute=randomInt(20,Math.max(20,Math.min(70,duration)));commentary.push({minute:`${minute}’`,text:`Arbitro rosso facile: espulsione garantita per ${selected.name}.`,type:'referee'});refereeNote(`${selected.name} ha ricevuto un’espulsione garantita.`)}}
 if(refereeProfile?.rule==='higherRankGuaranteedRed'){const homeRank=Number(rankMap[home.id])||99,awayRank=Number(rankMap[away.id])||99,selected=homeRank<awayRank?home:awayRank<homeRank?away:null,incidents=selected?.id===home.id?homeIncidents:selected?.id===away.id?awayIncidents:null;if(selected&&incidents){incidents.red=Math.max(1,incidents.red);incidents.refereeRed=true;const minute=randomInt(15,Math.max(15,Math.min(75,duration)));commentary.push({minute:`${minute}’`,text:`Arbitro giornata nera: ${selected.name}, meglio classificata, resta in dieci.`,type:'referee'});refereeNote(`${selected.name}, squadra meglio classificata, ha ricevuto un’espulsione.`)}}
 if(refereeProfile?.rule==='homeStartsOne'){const goal=makeRefereeGoal(home.id,0,pickScorer(home.id));goals.push(goal);commentary.push({minute:'0’',text:`Arbitro handicap: ${home.name} parte con un gol di vantaggio.`,type:'referee'});refereeNote(`${home.name} è partita dall’1–0.`)}
 if(refereeProfile?.rule==='topFiveAwayStartsBehind'&&(Number(rankMap[away.id])||99)<=5){goals.push(makeRefereeGoal(home.id,0,pickScorer(home.id)));commentary.push({minute:'0’',text:`Arbitro grandi in trasferta: ${away.name}, squadra della top 5, parte da 0–1.`,type:'referee'});refereeNote(`${away.name} è partita con un gol di svantaggio e non potrà segnare più di due reti.`)}
 if(refereeProfile?.rule==='bottomHalfVsTopSixGoal'){const homeRank=Number(rankMap[home.id])||99,awayRank=Number(rankMap[away.id])||99;let provincial=null;if(homeRank>=11&&awayRank<=6)provincial=home;else if(awayRank>=11&&homeRank<=6)provincial=away;if(provincial){goals.push(makeRefereeGoal(provincial.id,0,pickScorer(provincial.id)));commentary.push({minute:'0’',text:`Arbitro provinciali: ${provincial.name} riceve un gol garantito contro una squadra della top 6.`,type:'referee'});refereeNote(`${provincial.name} ha ricevuto il gol garantito delle provinciali.`)}}
 if(refereeProfile?.rule==='targetSabotage'&&selectedTeamId){const selected=selectedTeamId===home.id?home:selectedTeamId===away.id?away:null;if(selected){const opponent=selected.id===home.id?away:home,success=rand()<.75,beneficiary=success?opponent:selected;addRefereeGoals(goals,beneficiary.id,2,0,pickScorer(beneficiary.id));commentary.push({minute:'0’',text:success?`Arbitro sabotatore: il piano riesce, ${selected.name} parte da 0–2.`:`Arbitro sabotatore: il piano si ritorce contro, ${selected.name} parte da 2–0.`,type:'referee'});refereeNote(success?`${selected.name} ha subito il sabotaggio ed è partita da 0–2.`:`Il sabotaggio è fallito: ${selected.name} è partita da 2–0.`)}}
 if(refereeProfile?.rule==='leaderStartsBehind'&&leaderId&&(home.id===leaderId||away.id===leaderId)){const beneficiary=home.id===leaderId?away:home;goals.push(makeRefereeGoal(beneficiary.id,0,pickScorer(beneficiary.id)));commentary.push({minute:'0’',text:`Arbitro anti-capolista: ${beneficiary.name} parte con un gol di vantaggio contro la capolista.`,type:'referee'});refereeNote(`La capolista ${teamOf(leaderId).name} è partita da 0–1.`)}
 if(refereeProfile?.rule==='lastPlaceGetsTwo'){const lastId=Object.entries(rankMap).find(([,rank])=>Number(rank)===TEAMS.length)?.[0]||'';if(lastId&&(home.id===lastId||away.id===lastId)){addRefereeGoals(goals,lastId,2,0,pickScorer(lastId));commentary.push({minute:'0’',text:`Arbitro ultima in classifica: ${teamOf(lastId).name} riceve due gol garantiti.`,type:'referee'});refereeNote(`${teamOf(lastId).name}, ultima in classifica, è partita con due gol.`)}}
 if(refereeProfile?.rule==='lowerRankStartsOne'){const homeRank=Number(rankMap[home.id])||99,awayRank=Number(rankMap[away.id])||99,lower=homeRank>awayRank?home:awayRank>homeRank?away:null;if(lower){goals.push(makeRefereeGoal(lower.id,0,pickScorer(lower.id)));commentary.push({minute:'0’',text:`Arbitro classifica rovesciata: ${lower.name}, più in basso in classifica, parte con un gol.`,type:'referee'});refereeNote(`${lower.name} ha ricevuto il gol iniziale da classifica rovesciata.`)}}
 if(refereeProfile?.rule==='bottomVsTopThreeStartsOne'){const homeRank=Number(rankMap[home.id])||99,awayRank=Number(rankMap[away.id])||99;let lower=null;if(homeRank<=3&&awayRank>=15)lower=away;else if(awayRank<=3&&homeRank>=15)lower=home;if(lower){goals.push(makeRefereeGoal(lower.id,0,pickScorer(lower.id)));commentary.push({minute:'0’',text:`Arbitro paura dei grandi: ${lower.name} parte con un gol contro una squadra della top 3.`,type:'referee'});refereeNote(`${lower.name} ha iniziato la partita con un gol di vantaggio.`)}else refereeNote('Nessun effetto: la partita non opponeva una top 3 a una squadra dal 15° posto in giù.')}
 if(refereeProfile?.rule==='underdogGuaranteedGoal'){const favored=teamOf(referee.favoredTeamId),opponent=favored?.id===home.id?away:home;if(favored&&opponent&&directorCurrentOvr(favored)<directorCurrentOvr(opponent)){goals.push(makeRefereeGoal(favored.id,randomInt(6,Math.max(6,duration)),pickScorer(favored.id)));commentary.push({minute:'🟨',text:`Arbitro underdog: gol garantito per ${favored.name}, squadra con OVR inferiore.`,type:'referee'});refereeNote(`${favored.name} ha ricevuto un gol garantito da underdog.`)}else refereeNote('Nessun effetto underdog: la squadra favorita non aveva un OVR inferiore.')}
 if(refereeProfile?.rule==='bestPlayerGuaranteedGoal'){const favored=teamOf(referee.favoredTeamId);if(favored){const scorer=strongestPlayer(favored.id);goals.push(makeRefereeGoal(favored.id,randomInt(8,Math.max(8,duration)),scorer));commentary.push({minute:'🟨',text:`Arbitro fantacalcio: gol garantito di ${scorer.name}, il giocatore con OVR più alto di ${favored.name}.`,type:'referee'});refereeNote(`${scorer.name} ha segnato il gol garantito per ${favored.name}.`)}}
 if(hasRule('pinkCardEndsMatch')&&rand()<.16*factor){const minute=randomInt(Math.min(12,Math.max(1,duration)),Math.max(1,duration));goals=goals.filter(goal=>goal.minute<=minute);commentary.push({minute:`${minute}’`,text:'Cartellino rosa! La partita termina immediatamente.',type:'card'})}
 if(hasRule('cancelFirstGoal')&&goals.length){const goal=[...goals].sort((a,b)=>a.minute-b.minute)[0];goal.annulled=true;commentary.push({minute:`${goal.minute}’`,text:`Il VAR annulla il primo gol della partita, segnato da ${goal.playerName}.`,type:'rule'})}
 if(hasRule('cancelLastGoal')){const valid=goals.filter(goal=>!goal.annulled).sort((a,b)=>a.minute-b.minute);if(valid.length){const goal=valid[valid.length-1];goal.annulled=true;commentary.push({minute:`${goal.minute}’`,text:`Il VAR annulla l’ultimo gol della partita, segnato da ${goal.playerName}.`,type:'rule'})}}
 if(refereeProfile?.rule==='cancelTopThreeFirstGoal'){for(const team of [home,away]){if((Number(rankMap[team.id])||99)>3)continue;const goal=goals.filter(item=>item.teamId===team.id&&!item.annulled).sort((a,b)=>a.minute-b.minute)[0];if(goal){goal.annulled=true;commentary.push({minute:`${goal.minute}’`,text:`Arbitro annulla-big: annullato il primo gol di ${team.name}, squadra nella top 3.`,type:'referee'});refereeNote(`Annullato il primo gol di ${team.name}.`)}}}
 if(refereeProfile?.rule==='opponentGoalsHalfCancelled'){const favoredId=String(referee.favoredTeamId||''),opponentId=favoredId===home.id?away.id:home.id;let cancelled=0;for(const goal of goals.filter(item=>item.teamId===opponentId&&!item.annulled)){if(rand()<.5){goal.annulled=true;cancelled+=1;commentary.push({minute:`${goal.minute}’`,text:`Arbitro cornuti: annullato un gol di ${teamOf(opponentId).name}.`,type:'referee'})}}refereeNote(`${cancelled} gol dell’avversario annullati su decisione dell’Arbitro cornuti.`)}
 if(refereeProfile?.rule==='homeMaxOneGoal'){const homeValid=goals.filter(item=>item.teamId===home.id&&!item.annulled).sort((a,b)=>a.minute-b.minute);for(const goal of homeValid.slice(1)){goal.annulled=true;commentary.push({minute:`${goal.minute}’`,text:`Arbitro in trasferta: ${home.name} aveva già segnato il massimo consentito di un gol.`,type:'referee'})}if(homeValid.length>1)refereeNote(`${homeValid.length-1} gol oltre il limite sono stati annullati a ${home.name}.`)}
 if(refereeProfile?.rule==='varFavorsLower'){const homeRank=Number(rankMap[home.id])||99,awayRank=Number(rankMap[away.id])||99,lower=homeRank>=awayRank?home:away,higher=lower.id===home.id?away:home,higherGoal=goals.filter(item=>item.teamId===higher.id&&!item.annulled).sort((a,b)=>a.minute-b.minute)[0];if(higherGoal&&rand()<.5){higherGoal.annulled=true;commentary.push({minute:`${higherGoal.minute}’`,text:`Arbitro al VAR: gol annullato a ${higher.name}, decisione favorevole alla squadra più in basso ${lower.name}.`,type:'referee'});refereeNote(`Il VAR ha annullato un gol a ${higher.name}.`)}else{const scorer=pickScorer(lower.id);goals.push(makeRefereeGoal(lower.id,randomInt(20,Math.max(20,duration)),scorer));commentary.push({minute:'VAR',text:`Arbitro al VAR: rigore concesso a ${lower.name}, la squadra più in basso in classifica.`,type:'referee'});refereeNote(`${lower.name} ha ricevuto un rigore trasformato grazie al VAR.`)}}
 if(refereeProfile?.rule==='opponentBestPlayerCannotScore'){const favoredId=String(referee.favoredTeamId||''),opponentId=favoredId===home.id?away.id:home.id,bomber=strongestPlayer(opponentId);let cancelled=0;for(const goal of goals.filter(item=>item.teamId===opponentId&&!item.annulled&&(String(item.playerId)===String(bomber.id)||String(item.playerName)===String(bomber.name)))){goal.annulled=true;cancelled+=1;commentary.push({minute:`${goal.minute}’`,text:`Arbitro anti-bomber: annullato il gol di ${bomber.name}, giocatore con l’OVR più alto di ${teamOf(opponentId).name}.`,type:'referee'})}refereeNote(cancelled?`${cancelled} gol di ${bomber.name} annullati.`:`${bomber.name} non ha segnato: nessun gol da annullare.`)}
 if(refereeProfile?.rule==='favoredComebackGoal'){const favoredId=String(referee.favoredTeamId||''),ordered=goals.filter(item=>!item.annulled).sort((a,b)=>Number(a.minute)-Number(b.minute));let homeRun=0,awayRun=0,trailMinute=0;for(const goal of ordered){if(goal.teamId===home.id)homeRun+=directorGoalValue(goal);else if(goal.teamId===away.id)awayRun+=directorGoalValue(goal);const favoredTrailing=favoredId===home.id?homeRun<awayRun:awayRun<homeRun;if(favoredTrailing){trailMinute=Number(goal.minute)||1;break}}if(trailMinute){const minute=Math.min(Math.max(trailMinute+1,trailMinute+randomInt(1,8)),Math.max(duration,trailMinute+1));const comebackGoal=makeRefereeGoal(favoredId,minute,pickScorer(favoredId));goals.push(comebackGoal);commentary.push({minute:`${minute}’`,text:`Arbitro rimontista: gol garantito per ${teamOf(favoredId).name} dopo essere andata in svantaggio.`,type:'referee'});refereeNote(`${teamOf(favoredId).name} ha ricevuto un gol per tentare la rimonta.`)}else refereeNote(`${teamOf(favoredId).name} non è mai andata in svantaggio: nessun intervento necessario.`)}
 if(refereeProfile?.rule==='topFiveAwayStartsBehind'&&(Number(rankMap[away.id])||99)<=5){const awayValid=goals.filter(item=>item.teamId===away.id&&!item.annulled).sort((a,b)=>Number(a.minute)-Number(b.minute));for(const goal of awayValid.slice(2)){goal.annulled=true;commentary.push({minute:`${goal.minute}’`,text:`Arbitro grandi in trasferta: ${away.name} aveva già raggiunto il limite massimo di 2 gol.`,type:'referee'})}if(awayValid.length>2)refereeNote(`${awayValid.length-2} gol di ${away.name} sono stati annullati oltre il limite di due.`)}
 if(refereeProfile?.rule==='targetAntiComeback'&&selectedTeamId){const ordered=goals.filter(item=>!item.annulled).sort((a,b)=>Number(a.minute)-Number(b.minute));let homeRun=0,awayRun=0,trailIndex=-1;for(let index=0;index<ordered.length;index++){const goal=ordered[index];if(goal.teamId===home.id)homeRun+=directorGoalValue(goal);else if(goal.teamId===away.id)awayRun+=directorGoalValue(goal);const trailing=selectedTeamId===home.id?homeRun<awayRun:selectedTeamId===away.id?awayRun<homeRun:false;if(trailing){trailIndex=index;break}}if(trailIndex>=0){const later=ordered.slice(trailIndex+1).filter(item=>item.teamId===selectedTeamId&&!item.annulled);for(const goal of later.slice(1)){goal.annulled=true;commentary.push({minute:`${goal.minute}’`,text:`Arbitro anti-rimonta: annullato un gol di ${teamOf(selectedTeamId).name}, che poteva segnarne soltanto uno dopo essere andata in svantaggio.`,type:'referee'})}refereeNote(`${teamOf(selectedTeamId).name} ha potuto segnare al massimo un gol dopo essere andata in svantaggio.`)}else refereeNote(`${teamOf(selectedTeamId)?.name||'La squadra scelta'} non è mai andata in svantaggio: anti-rimonta non attivato.`)}
 const ovrRegulationOutcome=applyDirectorOvrRegulations(goals,home,away,duration,commentary);
 let validGoals=goals.filter(goal=>!goal.annulled);
 if(hasRule('lateGoalsDouble'))for(const goal of validGoals)if(goal.minute>=80){goal.value=2;commentary.push({minute:`${goal.minute}’`,text:`Regolamento attivo: il gol di ${goal.playerName} vale doppio.`,type:'rule'})}
 for(const goal of validGoals)commentary.push({minute:`${goal.minute}’`,text:`Gol di ${goal.playerName} per ${teamOf(goal.teamId).name}${goal.value===2?' (vale doppio)':''}.`,type:goal.refereeGoal?'referee':'goal'});
 commentary.push(...incidentCommentary(home,homeIncidents,duration),...incidentCommentary(away,awayIncidents,duration));
 let homeGoals=sum(validGoals.filter(goal=>goal.teamId===home.id).map(goal=>goal.value)),awayGoals=sum(validGoals.filter(goal=>goal.teamId===away.id).map(goal=>goal.value));
 if(hasRule('goldenGoal')&&validGoals.length){const first=[...validGoals].sort((a,b)=>a.minute-b.minute)[0];homeGoals=first.teamId===home.id?1:0;awayGoals=first.teamId===away.id?1:0;commentary.push({minute:`${first.minute}’`,text:'Golden goal: la partita si chiude sulla prima rete.',type:'rule'})}
 if(hasRule('lastGoalWins')&&validGoals.length){const last=[...validGoals].sort((a,b)=>a.minute-b.minute)[validGoals.length-1];homeGoals=last.teamId===home.id?1:0;awayGoals=last.teamId===away.id?1:0;commentary.push({minute:`${last.minute}’`,text:'Conta soltanto l’ultimo gol: il risultato viene riscritto dal regolamento.',type:'rule'})}
 if(hasRule('redCardGoal')){homeGoals+=homeIncidents.red;awayGoals+=awayIncidents.red;if(homeIncidents.red||awayIncidents.red)commentary.push({minute:'⚖️',text:'Ogni cartellino rosso ricevuto viene convertito in un gol per la stessa squadra.',type:'rule'})}
 if(hasRule('negativeIncidents')){homeGoals-=homeIncidents.red+homeIncidents.injuries+homeIncidents.missedPenalties;awayGoals-=awayIncidents.red+awayIncidents.injuries+awayIncidents.missedPenalties;commentary.push({minute:'⚖️',text:'Rossi, infortuni e rigori sbagliati sottraggono reti dal risultato.',type:'rule'})}
 if(refereeProfile?.rule==='favoredFinalAssault'){const favoredId=String(referee.favoredTeamId||''),scoreAt85={home:sum(validGoals.filter(goal=>goal.teamId===home.id&&Number(goal.minute)<=85).map(goal=>goal.value)),away:sum(validGoals.filter(goal=>goal.teamId===away.id&&Number(goal.minute)<=85).map(goal=>goal.value))},favoredBehind=favoredId===home.id?scoreAt85.home<scoreAt85.away:scoreAt85.away<scoreAt85.home;if(favoredBehind){let converted=0;for(let attempt=0;attempt<3;attempt++){const minute=86+attempt*4;if(rand()<.45){const goal=makeRefereeGoal(favoredId,minute,pickScorer(favoredId));validGoals.push(goal);if(favoredId===home.id)homeGoals+=1;else awayGoals+=1;converted+=1;commentary.push({minute:`${minute}’`,text:`Arbitro ultimo assalto: occasione extra trasformata da ${goal.playerName} per ${teamOf(favoredId).name}.`,type:'referee'})}else commentary.push({minute:`${minute}’`,text:`Arbitro ultimo assalto: ${teamOf(favoredId).name} spreca una delle tre occasioni extra.`,type:'referee'})}refereeNote(`${teamOf(favoredId).name} ha trasformato ${converted} delle 3 occasioni dell’ultimo assalto.`)}else refereeNote(`${teamOf(favoredId).name} non era in svantaggio dopo l’85°: ultimo assalto non attivato.`)}
 if(refereeProfile?.rule==='playUntilFavoredScores'){const favoredId=String(referee.favoredTeamId||''),favoredScore=favoredId===home.id?homeGoals:awayGoals;if(favoredScore<=0){const minute=randomInt(91,120),needed=1-favoredScore;addRefereeGoals(validGoals,favoredId,needed,minute);if(favoredId===home.id)homeGoals=1;else awayGoals=1;commentary.push({minute:`${minute}’`,text:`Arbitro finché non metti l’ultimo: la partita termina soltanto dopo il gol di ${teamOf(favoredId).name}.`,type:'referee'});refereeNote(`${teamOf(favoredId).name} ha segnato nel recupero prolungato.`)}else refereeNote(`${teamOf(favoredId).name} aveva già segnato: nessun recupero infinito necessario.`)}
 let winnerId=homeGoals>awayGoals?home.id:awayGoals>homeGoals?away.id:'';let decidedByPenalties=false;
 if(homeGoals===awayGoals&&(refereeProfile?.rule==='selectedMatchNoDraw'||refereeProfile?.rule==='roundGoldenGoal')){const homeWeight=Math.max(.1,strength.homeLambda),awayWeight=Math.max(.1,strength.awayLambda),homeWins=rand()<homeWeight/(homeWeight+awayWeight),suddenWinner=homeWins?home:away,minute=randomInt(91,105),goal=makeRefereeGoal(suddenWinner.id,minute,pickScorer(suddenWinner.id));validGoals.push(goal);if(homeWins)homeGoals+=1;else awayGoals+=1;winnerId=suddenWinner.id;commentary.push({minute:`${minute}’`,text:`${refereeProfile.rule==='roundGoldenGoal'?'Arbitro golden goal':'Arbitro senza pareggi'}: ${goal.playerName} segna il gol decisivo per ${suddenWinner.name}.`,type:'referee'});refereeNote(`${suddenWinner.name} ha vinto con il primo gol dopo il 90°.`)}
 if((hasRule('noDraws')||knockout||hasRule('penaltiesOnly'))&&homeGoals===awayGoals){const homeChance=.5+clamp((directorCurrentOvr(home)-directorCurrentOvr(away))/100,-.18,.18),homeWins=rand()<homeChance;winnerId=homeWins?home.id:away.id;decidedByPenalties=true;commentary.push({minute:'RIG',text:`${teamOf(winnerId).name} vince dopo supplementari e calci di rigore.`,type:'goal'})}
 if(refereeProfile?.rule==='favoredCannotLose'){const favoredId=String(referee.favoredTeamId||''),favoredHome=favoredId===home.id,favoredScore=favoredHome?homeGoals:awayGoals,otherScore=favoredHome?awayGoals:homeGoals;if(favoredScore<otherScore){const needed=otherScore-favoredScore;addRefereeGoals(validGoals,favoredId,needed,91);if(favoredHome)homeGoals=otherScore;else awayGoals=otherScore;winnerId='';decidedByPenalties=false;commentary.push({minute:'90+’',text:`Arbitro amico: ${teamOf(favoredId).name} raggiunge il pareggio e non perde la partita.`,type:'referee'});refereeNote(`${teamOf(favoredId).name} è stata salvata dalla sconfitta.`)}else if(homeGoals===awayGoals&&winnerId&&winnerId!==favoredId){winnerId=favoredId;commentary.push({minute:'RIG',text:`Arbitro amico: ${teamOf(favoredId).name} non perde nemmeno ai rigori.`,type:'referee'});refereeNote(`${teamOf(favoredId).name} è stata favorita nella decisione ai rigori.`)}else refereeNote(`${teamOf(favoredId).name} non stava perdendo: nessuna correzione necessaria.`)}
 let bollenteCaught=false;
 if(refereeProfile?.rule==='favoredGuaranteedWin'){const favoredId=String(referee.favoredTeamId||''),favoredHome=favoredId===home.id,otherScore=favoredHome?awayGoals:homeGoals,favoredScore=favoredHome?homeGoals:awayGoals,needed=Math.max(0,otherScore-favoredScore+1);if(needed)addRefereeGoals(validGoals,favoredId,needed,88);if(favoredHome)homeGoals=otherScore+1;else awayGoals=otherScore+1;winnerId=favoredId;decidedByPenalties=false;bollenteCaught=rand()<.2;commentary.push({minute:'🔥',text:`Arbitro bollente: vittoria garantita per ${teamOf(favoredId).name}.`,type:'referee'});refereeNote(`${teamOf(favoredId).name} ha ottenuto la vittoria garantita.${bollenteCaught?' Lo scandalo è stato scoperto.':''}`)}
 commentary.sort((a,b)=>(parseInt(a.minute)||999)-(parseInt(b.minute)||999));
 return finalizeMatch({home,away,goals:validGoals,homeGoals,awayGoals,winnerId,decidedByPenalties,commentary,homeIncidents,awayIncidents,bottomIds,knockout,leaderId,rankMap,pointsMap,refereeId:referee?.id||'',refereeAssignmentId:referee?.assignmentId||'',refereeTitle:refereeProfile?.title||'',refereeNotes,bollenteCaught});
}
function incidentCommentary(team,incidents,duration){const lines=[],maxMinute=Math.max(1,Number(duration)||90),minute=min=>randomInt(Math.min(min,maxMinute),maxMinute);if(incidents.red&&!incidents.refereeRed)lines.push({minute:`${minute(12)}’`,text:`Cartellino rosso per ${team.name}.`,type:'card'});if(incidents.injuries)lines.push({minute:`${minute(10)}’`,text:`Infortunio per ${team.name}.`,type:'card'});if(incidents.missedPenalties)lines.push({minute:`${minute(8)}’`,text:`${team.name} sbaglia un calcio di rigore.`,type:'card'});return lines}
function finalizeMatch(data){
 const {home,away,homeGoals,awayGoals,winnerId,decidedByPenalties,bottomIds,knockout,leaderId='',rankMap={},pointsMap={}}=data;
 let homeBase=0,awayBase=0;
 const homeWon=winnerId===home.id||(homeGoals>awayGoals&&!winnerId),awayWon=winnerId===away.id||(awayGoals>homeGoals&&!winnerId),draw=!homeWon&&!awayWon&&homeGoals===awayGoals,winner=homeWon?home.id:awayWon?away.id:'',loser=homeWon?away.id:awayWon?home.id:'';
 const ruleNotes=[],refereeRule=refereeById(data.refereeId)?.rule||'';
 const note=text=>{ruleNotes.push(text);data.commentary=Array.isArray(data.commentary)?data.commentary:[];data.commentary.push({minute:'⚖️',text,type:'rule'})};
 const refereePointNote=text=>{data.refereeNotes=Array.isArray(data.refereeNotes)?data.refereeNotes:[];data.refereeNotes.push(text);data.commentary=Array.isArray(data.commentary)?data.commentary:[];data.commentary.push({minute:'🟨',text,type:'referee'})};
 if(!knockout){
  if(winnerId){homeBase=winnerId===home.id?3:0;awayBase=winnerId===away.id?3:0}else if(homeGoals===awayGoals){homeBase=1;awayBase=1}else{homeBase=homeGoals>awayGoals?3:0;awayBase=awayGoals>homeGoals?3:0}
  if(hasRule('pointsEqualGoals')){homeBase=homeGoals;awayBase=awayGoals}
  if(refereeRule==='topSixWinFourPoints'&&winner&&(Number(rankMap[home.id])||99)<=6&&(Number(rankMap[away.id])||99)<=6){if(homeWon)homeBase=Math.max(homeBase,4);else awayBase=Math.max(awayBase,4);refereePointNote(`Arbitro televisivo: ${teamOf(winner).name} riceve 4 punti per la vittoria nello scontro tra squadre della top 6.`)}
  if(refereeRule==='topFourWinTwoPoints'&&winner&&(Number(rankMap[winner])||99)<=4){if(homeWon)homeBase=2;else awayBase=2;refereePointNote(`Arbitro classifica corta: la vittoria di ${teamOf(winner).name}, squadra della top 4, vale soltanto 2 punti.`)}
  if(!winnerId&&homeGoals===0&&awayGoals===0&&hasRule('zeroZeroNoPoints'))homeBase=awayBase=0;
  if(!winnerId&&homeGoals===0&&awayGoals===0&&hasRule('zeroZeroSeven'))homeBase=awayBase=7;
  if(hasRule('bottomHalfHelp')){
   const apply=(teamId,won,isDraw)=>bottomIds.has(teamId)?won?4:isDraw?2:1:null;
   const homeSpecial=apply(home.id,homeWon,draw),awaySpecial=apply(away.id,awayWon,draw);
   if(homeSpecial!==null)homeBase=homeSpecial;if(awaySpecial!==null)awayBase=awaySpecial;
  }
  if(hasRule('lossMinusThree')){if(homeWon)awayBase=-3;if(awayWon)homeBase=-3}
  if(hasRule('narrowWinFour')&&winner&&Math.abs(Number(homeGoals)-Number(awayGoals))===1){if(homeWon)homeBase=Math.max(homeBase,4);else awayBase=Math.max(awayBase,4);note('Vittoria di misura: la vittoria assegna 4 punti.')}
  if(hasRule('directMatchFour')&&winner&&Math.abs((Number(pointsMap[home.id])||0)-(Number(pointsMap[away.id])||0))<=3){if(homeWon)homeBase=Math.max(homeBase,4);else awayBase=Math.max(awayBase,4);note('Scontro diretto: la vittoria assegna 4 punti.')}
  if(hasRule('leaderWinTwo')&&winner&&winner===leaderId){if(homeWon)homeBase=2;else awayBase=2;note('Pressione da primato: la vittoria della capolista vale soltanto 2 punti.')}
  if(hasRule('underdogTopThreeDrawTwo')&&draw){if((Number(rankMap[home.id])||99)>=11&&(Number(rankMap[away.id])||99)<=3){homeBase=Math.max(homeBase,2);note(`${home.name} ottiene 2 punti grazie al Pareggio d’impresa.`)}if((Number(rankMap[away.id])||99)>=11&&(Number(rankMap[home.id])||99)<=3){awayBase=Math.max(awayBase,2);note(`${away.name} ottiene 2 punti grazie al Pareggio d’impresa.`)}}
 }
 let homeExtra=0,awayExtra=0;
 if(!knockout&&hasRule('concededGoalMinusPoint')){homeExtra-=awayGoals;awayExtra-=homeGoals}
 if(!knockout&&hasRule('cleanSheetBonus')){if(awayGoals===0)homeExtra+=1;if(homeGoals===0)awayExtra+=1}
 if(!knockout&&hasRule('braceBonusPoint')){const homeCounts=scorerCounts(data.goals,home.id),awayCounts=scorerCounts(data.goals,away.id);if(Object.values(homeCounts).some(value=>value>=2))homeExtra+=1;if(Object.values(awayCounts).some(value=>value>=2))awayExtra+=1}
 if(!knockout&&hasRule('spectacleBonus')&&Number(homeGoals)+Number(awayGoals)>=4){homeExtra+=1;awayExtra+=1;note('Calcio spettacolo: entrambe le squadre ricevono +1 punto per i 4 o più gol complessivi.')}
 if(!knockout&&hasRule('lateWinnerBonus')&&winner&&directorLateWinningGoal(data.goals,winner,home.id,away.id,homeGoals,awayGoals)){if(homeWon)homeExtra+=1;else awayExtra+=1;note(`${teamOf(winner).name} riceve +1 punto per il gol decisivo segnato dall’85° minuto.`)}
 if(!knockout&&hasRule('comebackBonus')&&winner&&directorComebackWinner(data.goals,winner,home.id,away.id)){if(homeWon)homeExtra+=1;else awayExtra+=1;note(`${teamOf(winner).name} riceve +1 punto per la vittoria in rimonta.`)}
 if(!knockout&&hasRule('beatLeaderBonus')&&winner&&loser===leaderId){if(homeWon)homeExtra+=2;else awayExtra+=2;note(`${teamOf(winner).name} riceve +2 punti per aver battuto la capolista.`)}
 if(!knockout&&hasRule('underdogTopFiveWinBonus')&&winner&&(Number(rankMap[winner])||99)>=11&&(Number(rankMap[loser])||99)<=5){if(homeWon)homeExtra+=2;else awayExtra+=2;note(`${teamOf(winner).name} riceve +2 punti grazie a Davide contro Golia.`)}
 if(!knockout&&hasRule('awayWinBonus')&&awayWon){awayExtra+=1;note(`${away.name} riceve +1 punto per la vittoria in trasferta.`)}
 return {...data,homeId:home.id,awayId:away.id,homePoints:homeBase+homeExtra,awayPoints:awayBase+awayExtra,homeBasePoints:homeBase,awayBasePoints:awayBase,homeExtraPoints:homeExtra,awayExtraPoints:awayExtra,regulationNotes:ruleNotes,qualityHome:resultQuality(homeGoals,awayGoals,homeWon),qualityAway:resultQuality(awayGoals,homeGoals,awayWon),decidedByPenalties:Boolean(decidedByPenalties)};
}
function scorerCounts(goals,teamId){const counts={};for(const goal of goals||[])if(goal.teamId===teamId)counts[goal.playerId]=(counts[goal.playerId]||0)+1;return counts}
function resultQuality(gf,ga,won){return (won?300:gf===ga?120:0)+(gf-ga)*20+gf*4+rand()}

function playCurrentRound(mode){
 const repaired=sanitizePendingInfluenceState();if(repaired)save();
 if(state.pendingRefereeId&&refereeById(state.pendingRefereeId)){renderRefereeAssignment();return}
 if(validPendingChoiceIds().length){renderInfluenceChoices();return}
 if(state.round>=TOTAL_ROUNDS)return;
 const report=simulateLeagueRound();
 commitLeagueRound(report);
 showRoundModal(report,mode==='live');
}
function simulateLeagueRound(){
 const tableBefore=sortedTable(),bottomIds=preRoundBottomIds(),leaderId=tableBefore[0]?.id||'',rankMap=Object.fromEntries(tableBefore.map((row,index)=>[row.id,index+1])),pointsMap=Object.fromEntries(tableBefore.map(row=>[row.id,Number(row.pts)||0])),matches=currentRoundMatches(),results=[],assignments=activeRoundReferees().map(item=>({...item}));
 for(const fixture of matches){const skipped=hasRule('leaderRests')&&state.round>0&&(fixture.homeId===leaderId||fixture.awayId===leaderId),refereeAssignment=refereeForFixture(fixture);results.push(simulateMatch(fixture,{bottomIds,skipped,leaderId,rankMap,pointsMap,refereeAssignment}))}
 if(hasRule('formulaOne'))applyFormulaOnePoints(results);
 const caught=[...new Set(results.filter(match=>match.bollenteCaught&&match.refereeAssignmentId).map(match=>match.refereeAssignmentId))];
 return {round:state.round+1,matches:results,regulations:activeRegulations().map(rule=>rule.id),refereeAssignments:assignments,refereeAssignment:assignments[0]||null,bollenteCaught:caught.length>0,bollenteCaughtAssignmentIds:caught,createdAt:new Date().toISOString()};
}

function applyFormulaOnePoints(matches){
 const entries=[];
 for(const match of matches){if(match.skipped){entries.push({teamId:match.homeId,quality:-999,match,side:'home'},{teamId:match.awayId,quality:-999,match,side:'away'});continue}entries.push({teamId:match.homeId,quality:match.qualityHome,match,side:'home'},{teamId:match.awayId,quality:match.qualityAway,match,side:'away'})}
 entries.sort((a,b)=>b.quality-a.quality);
 const points=[25,18,15,12,10,8,6,4,2,1];
 entries.forEach((entry,index)=>{const value=points[index]||0;if(entry.side==='home')entry.match.homePoints=value+entry.match.homeExtraPoints;else entry.match.awayPoints=value+entry.match.awayExtraPoints});
}
function commitLeagueRound(report){
 for(const match of report.matches)commitMatchToTable(match);
 if(report.bollenteCaught){state.table[state.targetTeamId].pts=0;state.meta=state.meta&&typeof state.meta==='object'?state.meta:{};state.meta.refereeScandals=(Number(state.meta.refereeScandals)||0)+1;const caught=new Set(report.bollenteCaughtAssignmentIds||[]);for(const item of state.refereeHistory||[])if(caught.has(String(item.assignmentId||'')))item.caught=true}
 state.history.push(compactRoundReport(report,state.history.length));tickDirectorRegulations();state.round+=1;state.influenceUsedToday=false;state.influenceUsageToday={regulation:0,referee:0};state.pendingChoices=[];state.pendingChoiceType='regulation';state.pendingRefereeId='';state.roundReferees=[];state.roundReferee=null;
 if(state.round>=TOTAL_ROUNDS){state.regularSeasonRank=rankOf(state.targetTeamId);if(hasRule('playoffsTopEight'))preparePlayoffs();else finishSeason(sortedTable()[0]?.id||'')}save();if(state.phase==='season')render();
}

function commitMatchToTable(match){
 if(match.skipped)return;
 const home=state.table[match.homeId],away=state.table[match.awayId];
 home.p+=1;away.p+=1;home.gf+=match.homeGoals;home.ga+=match.awayGoals;away.gf+=match.awayGoals;away.ga+=match.homeGoals;
 const winner=match.winnerId||(match.homeGoals>match.awayGoals?match.homeId:match.awayGoals>match.homeGoals?match.awayId:'');
 if(!winner){home.d+=1;away.d+=1}else if(winner===match.homeId){home.w+=1;away.l+=1}else{away.w+=1;home.l+=1}
 home.pts+=Number(match.homePoints)||0;away.pts+=Number(match.awayPoints)||0;
 registerMatchStats(match);
}
function registerMatchStats(match){
 for(const goal of match.goals||[]){const existing=state.stats.scorers[goal.playerId]||{playerId:goal.playerId,name:goal.playerName,teamId:goal.teamId,goals:0};existing.goals+=Number(goal.value)||1;state.stats.scorers[goal.playerId]=existing}
 for(const side of ['home','away']){const teamId=match[`${side}Id`],incidents=match[`${side}Incidents`]||{},stats=state.stats.team[teamId]||{reds:0,injuries:0,yellows:0};stats.reds+=incidents.red||0;stats.injuries+=incidents.injuries||0;stats.yellows+=incidents.yellow||0;state.stats.team[teamId]=stats}
}

function showRoundModal(report,live){
 const targetMatch=report.matches.find(match=>match.homeId===state.targetTeamId||match.awayId===state.targetTeamId),home=teamOf(targetMatch.homeId),away=teamOf(targetMatch.awayId),lines=targetMatch.commentary?.length?targetMatch.commentary:[{minute:'90’',text:'Partita priva di episodi rilevanti.',type:''}];
 const refereeMatches=report.matches.filter(match=>match.refereeId),allRefereeNotes=refereeMatches.flatMap(match=>match.refereeNotes||[]),refereeNotes=allRefereeNotes.slice(0,6),extraRefereeNotes=Math.max(0,allRefereeNotes.length-refereeNotes.length),assignments=Array.isArray(report.refereeAssignments)?report.refereeAssignments:(report.refereeAssignment?[report.refereeAssignment]:[]),summary=assignments.slice(0,4).map(refereeAssignmentDescription).join(' · '),refereeReport=assignments.length?`<section class="referee-round-report ${report.bollenteCaught?'scandal':''}"><b>${report.bollenteCaught?'🚨 SCANDALO ARBITRALE':`🟨 IMPATTO ARBITRALE · ${assignments.length} DESIGNAZIONI`}</b><span>${esc(summary)}${assignments.length>4?` · +${assignments.length-4} altre`:''}</span>${refereeNotes.length?`<small>${refereeNotes.map(esc).join(' · ')}${extraRefereeNotes?` · Altri ${extraRefereeNotes} effetti negli altri campi.`:''}</small>`:''}${report.bollenteCaught?`<strong>I punti in classifica di ${esc(targetTeam().name)} sono stati azzerati.</strong>`:''}</section>`:'';
 modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal result-modal"><div class="label">Risultato finale · Giornata ${report.round}</div><div class="scoreboard"><div class="scoreboard-team">${esc(home.name)}</div><div class="scoreboard-score">${targetMatch.skipped?'RIPOSO':`${targetMatch.homeGoals}–${targetMatch.awayGoals}`}</div><div class="scoreboard-team">${esc(away.name)}</div></div>${refereeReport}<div class="commentary" id="commentaryFeed"></div><section class="other-results-modal hidden" id="otherResultsBlock"><h3>Risultati dagli altri campi</h3><div class="modal-result-grid">${report.matches.map(renderResultRow).join('')}</div></section><div class="modal-actions"><button id="skipCommentaryBtn" class="btn gold ${live?'':'hidden'}" type="button">Mostra tutto</button><button id="continueResultBtn" class="btn primary ${live?'hidden':''}" type="button">Continua</button></div></section></div>`;
 const feed=document.getElementById('commentaryFeed'),others=document.getElementById('otherResultsBlock'),continueButton=document.getElementById('continueResultBtn'),skipButton=document.getElementById('skipCommentaryBtn');
 const appendLine=line=>feed.insertAdjacentHTML('beforeend',`<div class="commentary-line ${esc(line.type||'')}"><b>${esc(line.minute)}</b><span>${esc(line.text)}</span></div>`);
 const finish=()=>{window.clearInterval(commentaryTimer);commentaryTimer=0;others.classList.remove('hidden');continueButton.classList.remove('hidden');skipButton.classList.add('hidden');feed.scrollTop=feed.scrollHeight};
 continueButton.onclick=()=>{closeModal();render()};
 if(!live){lines.forEach(appendLine);others.classList.remove('hidden');return}
 let index=0;commentaryTimer=window.setInterval(()=>{if(index>=lines.length){finish();return}appendLine(lines[index++]);feed.scrollTop=feed.scrollHeight},360);
 skipButton.onclick=()=>{while(index<lines.length)appendLine(lines[index++]);finish()};
}

function preparePlayoffs(){
 const top=sortedTable().slice(0,8).map(row=>row.id);
 state.phase='playoffs';state.playoff={stage:0,contenders:top,fixtures:makePlayoffFixtures(top,0),history:[],championId:''};
 if(!top.includes(state.targetTeamId)){simulateRemainingPlayoffs();finishSeason(state.playoff.championId)}
}
function makePlayoffFixtures(contenders,stage){
 if(stage===0&&contenders.length===8){const pairs=[[0,7],[3,4],[1,6],[2,5]];return pairs.map(([a,b])=>({homeId:contenders[a],awayId:contenders[b]}))}
 const fixtures=[];for(let index=0;index<contenders.length;index+=2)fixtures.push({homeId:contenders[index],awayId:contenders[index+1]});return fixtures;
}
function playoffStageLabel(stage){return stage===0?'Quarti di finale':stage===1?'Semifinale':'Finale Scudetto'}
function renderPlayoffs(){
 const fixture=state.playoff?.fixtures?.find(match=>match.homeId===state.targetTeamId||match.awayId===state.targetTeamId);
 if(!fixture){simulateRemainingPlayoffs();finishSeason(state.playoff.championId);save();render();return}
 screen.innerHTML=`${renderMissionHero()}${renderMatchPanel({playoff:true,fixture})}<div class="dashboard-grid"><section class="panel"><div class="label">Play off Scudetto</div><h2>${esc(playoffStageLabel(state.playoff.stage))}</h2><p class="subline">La squadra meglio classificata nella stagione regolare gioca in casa. In caso di parità si procede ai rigori.</p><div class="round-results">${state.playoff.fixtures.map(match=>`<div class="result-row ${match.homeId===state.targetTeamId||match.awayId===state.targetTeamId?'target':''}"><span>${esc(teamOf(match.homeId).name)}</span><b class="result-score">VS</b><span>${esc(teamOf(match.awayId).name)}</span></div>`).join('')}</div></section><aside><section class="panel sidebar-card"><div class="label">Posizione regular season</div><h3>${state.regularSeasonRank}°</h3><p class="subline">Il titolo viene ora assegnato esclusivamente dai play off.</p></section></aside></div>`;
 document.getElementById('playLiveBtn').onclick=()=>playPlayoffRound('live');
 document.getElementById('playInstantBtn').onclick=()=>playPlayoffRound('instant');
}
function simulatePlayoffFixture(fixture){return simulateMatch(fixture,{knockout:true,bottomIds:new Set()})}
function playPlayoffRound(mode){
 const stage=state.playoff.stage,results=state.playoff.fixtures.map(simulatePlayoffFixture),targetMatch=results.find(match=>match.homeId===state.targetTeamId||match.awayId===state.targetTeamId),winners=results.map(match=>match.winnerId);
 state.playoff.history.push({stage,results});
 if(winners.length===1){state.playoff.championId=winners[0];finishSeason(winners[0])}else{state.playoff.stage+=1;state.playoff.contenders=winners;state.playoff.fixtures=makePlayoffFixtures(winners,state.playoff.stage);if(!winners.includes(state.targetTeamId)){simulateRemainingPlayoffs();finishSeason(state.playoff.championId)}}
 save();
 showPlayoffModal(targetMatch,results,mode==='live',stage);
}
function simulateRemainingPlayoffs(){
 while(state.playoff&&!state.playoff.championId){const stage=state.playoff.stage,results=state.playoff.fixtures.map(simulatePlayoffFixture),winners=results.map(match=>match.winnerId);state.playoff.history.push({stage,results});if(winners.length===1){state.playoff.championId=winners[0];break}state.playoff.stage+=1;state.playoff.contenders=winners;state.playoff.fixtures=makePlayoffFixtures(winners,state.playoff.stage)}
}
function showPlayoffModal(targetMatch,results,live,stage){
 const home=teamOf(targetMatch.homeId),away=teamOf(targetMatch.awayId),lines=targetMatch.commentary||[];
 modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal result-modal"><div class="label">${esc(playoffStageLabel(stage))}</div><div class="scoreboard"><div class="scoreboard-team">${esc(home.name)}</div><div class="scoreboard-score">${targetMatch.homeGoals}–${targetMatch.awayGoals}</div><div class="scoreboard-team">${esc(away.name)}</div></div><div class="commentary" id="commentaryFeed"></div><section class="other-results-modal hidden" id="otherResultsBlock"><h3>Altri risultati</h3><div class="modal-result-grid">${results.map(renderResultRow).join('')}</div></section><div class="modal-actions"><button id="skipCommentaryBtn" class="btn gold ${live?'':'hidden'}" type="button">Mostra tutto</button><button id="continueResultBtn" class="btn primary ${live?'hidden':''}" type="button">Continua</button></div></section></div>`;
 const feed=document.getElementById('commentaryFeed'),others=document.getElementById('otherResultsBlock'),continueButton=document.getElementById('continueResultBtn'),skipButton=document.getElementById('skipCommentaryBtn'),append=line=>feed.insertAdjacentHTML('beforeend',`<div class="commentary-line ${esc(line.type||'')}"><b>${esc(line.minute)}</b><span>${esc(line.text)}</span></div>`),finish=()=>{window.clearInterval(commentaryTimer);others.classList.remove('hidden');continueButton.classList.remove('hidden');skipButton.classList.add('hidden')};
 continueButton.onclick=()=>{closeModal();render()};
 if(!live){lines.forEach(append);others.classList.remove('hidden');return}
 let index=0;commentaryTimer=window.setInterval(()=>{if(index>=lines.length){finish();return}append(lines[index++]);feed.scrollTop=feed.scrollHeight},360);skipButton.onclick=()=>{while(index<lines.length)append(lines[index++]);finish()};
}

function finishSeason(championId){state.championId=championId;state.phase='finished';save()}

function createDirectorSubmissionCode(){
 state.meta=state.meta&&typeof state.meta==='object'?state.meta:{};
 if(state.meta.submissionCode)return String(state.meta.submissionCode);
 const randomPart=(globalThis.crypto&&typeof globalThis.crypto.randomUUID==='function')?globalThis.crypto.randomUUID():`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
 const created=String(state.createdAt||new Date().toISOString()).replace(/[^0-9]/g,'').slice(0,17)||Date.now().toString(36);
 state.meta.submissionCode=`${DIRECTOR_SUBMISSION_PREFIX}-${created}-${randomPart}`;
 return state.meta.submissionCode;
}
function directorSubmissionUrl(params={}){
 const url=new URL(DIRECTOR_SUBMISSION_ENDPOINT,window.location.href);
 Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,String(value)));
 url.searchParams.set('_fb',`${Date.now()}_${Math.floor(Math.random()*1000000)}`);
 return url.toString();
}
function waitForDirectorSubmissionStatus(submissionCode,timeoutMs=6500){
 return new Promise((resolve,reject)=>{
  if(!submissionCode){reject(new Error('Codice univoco della missione mancante'));return}
  const callbackName=`fantaballaDirectorStatus_${Date.now()}_${Math.floor(Math.random()*1000000)}`;
  const script=document.createElement('script');
  let settled=false;
  script.async=true;
  script.referrerPolicy='no-referrer';
  function cleanup(){
   window.clearTimeout(timeout);
   try{delete window[callbackName]}catch(error){window[callbackName]=undefined}
   if(script.parentNode)script.parentNode.removeChild(script);
  }
  function finish(handler,value){if(settled)return;settled=true;cleanup();handler(value)}
  const timeout=window.setTimeout(()=>finish(reject,new Error('Verifica salvataggio scaduta')),timeoutMs);
  window[callbackName]=data=>{
   if(!data||data.ok!==true||typeof data.found!=='boolean'){
    finish(reject,new Error(String(data&&data.error?data.error:'Risposta di verifica non valida')));
    return;
   }
   finish(resolve,data);
  };
  script.onerror=()=>finish(reject,new Error('Verifica Google Apps Script non disponibile'));
  script.src=directorSubmissionUrl({action:'submission_status',codice_vittoria:submissionCode,callback:callbackName,transport:'jsonp'});
  document.body.appendChild(script);
 });
}
function submitDirectorPayloadVerified(payload,timeoutMs=24000){
 return new Promise((resolve,reject)=>{
  if(!DIRECTOR_SUBMISSION_ENDPOINT||!/^https:\/\/script\.google\.com\//i.test(DIRECTOR_SUBMISSION_ENDPOINT)){
   reject(new Error('Endpoint Google Apps Script non configurato'));
   return;
  }
  const requestId=`fb_director_${Date.now()}_${Math.floor(Math.random()*1000000)}`;
  const frameName=`fantaballaDirectorFrame_${requestId}`;
  const iframe=document.createElement('iframe');
  const form=document.createElement('form');
  let settled=false;
  iframe.name=frameName;
  iframe.setAttribute('aria-hidden','true');
  iframe.tabIndex=-1;
  iframe.style.cssText='position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none';
  form.method='POST';
  form.action=DIRECTOR_SUBMISSION_ENDPOINT;
  form.target=frameName;
  form.acceptCharset='UTF-8';
  form.style.display='none';
  [['payload',JSON.stringify(payload)],['transport','iframe'],['requestId',requestId]].forEach(([name,value])=>{
   const input=document.createElement('input');
   input.type='hidden';
   input.name=name;
   input.value=value;
   form.appendChild(input);
  });
  function cleanup(){
   window.clearTimeout(timeout);
   window.removeEventListener('message',onMessage);
   if(form.parentNode)form.parentNode.removeChild(form);
   if(iframe.parentNode)iframe.parentNode.removeChild(iframe);
  }
  function finish(handler,value){if(settled)return;settled=true;cleanup();handler(value)}
  function onMessage(event){
   const message=event&&event.data;
   if(!message||message.type!=='fantaballa-classifica-response-v1'||message.requestId!==requestId)return;
   const origin=String(event.origin||'');
   if(origin!=='null'&&!/^https:\/\/([a-z0-9-]+\.)*(google\.com|googleusercontent\.com)$/i.test(origin))return;
   const result=message.data;
   if(!result||typeof result.ok!=='boolean'){finish(reject,new Error('Risposta non valida da Google Apps Script'));return}
   if(!result.ok){finish(reject,new Error(String(result.error||'Google Apps Script ha rifiutato il risultato')));return}
   finish(resolve,result);
  }
  async function verifySavedRow(){
   await new Promise(done=>window.setTimeout(done,1200));
   while(!settled){
    try{
     const status=await waitForDirectorSubmissionStatus(payload.codice_vittoria||payload.victoryCode,5000);
     if(status.found){finish(resolve,{ok:true,duplicate:Boolean(status.duplicate),saved:status.saved||null,verifiedBy:'status'});return}
    }catch(error){}
    if(!settled)await new Promise(done=>window.setTimeout(done,1100));
   }
  }
  const timeout=window.setTimeout(()=>finish(reject,new Error('Google Apps Script non ha confermato il salvataggio. Puoi riprovare senza creare duplicati.')),timeoutMs);
  window.addEventListener('message',onMessage);
  iframe.onerror=()=>finish(reject,new Error('Impossibile raggiungere Google Apps Script'));
  document.body.appendChild(iframe);
  document.body.appendChild(form);
  verifySavedRow();
  try{form.submit()}catch(error){finish(reject,error)}
 });
}
function buildDirectorVictoryPayload(directorName){
 const target=targetTeam(),row=targetRow(),submissionCode=createDirectorSubmissionCode(),approved=(state.regulationHistory||[]).map(item=>item.title).filter(Boolean),score=directorScoreBreakdown(row.pts,state.influence,state.startExpectedRank);
 return {
  codice_vittoria:submissionCode,
  victoryCode:submissionCode,
  squadra:target.name,
  teamName:target.name,
  allenatore:directorName,
  coachName:directorName,
  direttore:directorName,
  modalita:'Direttore Sportivo',
  modalita_tipo:'direttore_sportivo',
  posizione_finale:1,
  punti:Number(row.pts)||0,
  // Le giornate completate dipendono dall'avanzamento del calendario.
  // Alcuni regolamenti possono far riposare la squadra-obiettivo, quindi row.p
  // può essere inferiore a 38 anche se la stagione è terminata regolarmente.
  giornate:Math.max(Number(state.round)||0,Number(row.p)||0),
  partite_disputate:Number(row.p)||0,
  vittorie:Number(row.w)||0,
  pareggi:Number(row.d)||0,
  sconfitte:Number(row.l)||0,
  gol_fatti:Number(row.gf)||0,
  gol_subiti:Number(row.ga)||0,
  ovr_medio:Number(target.rating)||0,
  posizione_prevista:Number(state.startExpectedRank)||0,
  difficolta_squadra:score.label,
  coefficiente_difficolta:score.multiplier,
  influenze_usate:INFLUENCE_START-score.remaining,
  influenza_rimasta:score.remaining,
  influenza_iniziale:INFLUENCE_START,
  punteggio_ds:score.score,
  regolamenti_approvati:approved.length,
  regolamenti:approved.join(' | '),
  arbitri_designati:(state.refereeHistory||[]).length,
  arbitri:(state.refereeHistory||[]).map(item=>item.title||refereeById(item.id)?.title||item.id).join(' | '),
  scandali_arbitrali:Number(state.meta?.refereeScandals)||0,
  playoff_scudetto:Boolean(state.playoff),
  source:'fantaballa-director-sportivo',
  saveTarget:'google-sheets-classifica',
  privacyNoticeAccepted:true,
  privacyVersion:'2026-08-03',
  sentAtIso:new Date().toISOString()
 };
}
function setDirectorSubmissionMessage(message,type=''){
 const status=document.getElementById('directorSubmissionStatus');
 if(!status)return;
 status.textContent=String(message||'');
 status.className=`director-submit-status${type?` ${type}`:''}`;
}
let directorSubmissionInFlight=false;
async function sendDirectorVictory(){
 if(directorSubmissionInFlight)return;
 const target=targetTeam();
 if(!target||state.championId!==target.id){toast('Puoi inviare il risultato soltanto dopo aver vinto il campionato.');return}
 const input=document.getElementById('directorNameInput');
 const directorName=String(input?.value||state.directorName||'').trim().replace(/\s+/g,' ');
 if(directorName.length<2){setDirectorSubmissionMessage('Inserisci il nome del Direttore Sportivo.','error');input?.focus();return}
 if(directorName.length>40){setDirectorSubmissionMessage('Il nome può contenere al massimo 40 caratteri.','error');input?.focus();return}
 if(state.submitted){setDirectorSubmissionMessage('Questa vittoria è già stata inviata.','ok');return}
 state.directorName=directorName;
 state.meta=state.meta&&typeof state.meta==='object'?state.meta:{};
 state.meta.submissionPendingAt=new Date().toISOString();
 save();
 const payload=buildDirectorVictoryPayload(directorName),button=document.getElementById('sendDirectorVictoryBtn');
 directorSubmissionInFlight=true;
 if(button){button.disabled=true;button.textContent='Invio in corso…';button.setAttribute('aria-busy','true')}
 setDirectorSubmissionMessage('Salvataggio nella classifica Direttore Sportivo…','');
 try{
  const result=await submitDirectorPayloadVerified(payload);
  state.submitted=true;
  state.meta.submittedAt=new Date().toISOString();
  state.meta.submissionPendingAt='';
  state.meta.lastSubmissionError='';
  save();
  render();
  toast(result.duplicate?'Risultato già presente: invio confermato':'Vittoria inviata alla classifica Direttore Sportivo');
 }catch(error){
  state.submitted=false;
  state.meta.submissionPendingAt='';
  state.meta.lastSubmissionError=String(error&&error.message?error.message:error||'Errore sconosciuto');
  save();
  setDirectorSubmissionMessage(`Invio non riuscito: ${state.meta.lastSubmissionError}`,'error');
  if(button){button.disabled=false;button.textContent='Invia vittoria';button.removeAttribute('aria-busy')}
 }finally{directorSubmissionInFlight=false}
}
function renderDirectorSubmissionCard(success){
 if(!success)return'';
 const sent=Boolean(state.submitted),name=String(state.directorName||''),score=directorScoreBreakdown();
 return `<section class="panel director-submit-card"><div class="label">Classifica ufficiale</div><h3>Invia la vittoria Direttore Sportivo</h3><p class="subline">Il piazzamento online è ordinato per <b>Punteggio DS</b>: difficoltà della squadra, punti finali e Influenza non utilizzata.</p><div class="director-submit-score"><div><span>Punteggio DS</span><b>${score.score.toLocaleString('it-IT')}</b></div><p>(${formatPoints(score.finalPoints)} × 10 + ${score.remaining} × 80) × ${String(score.multiplier).replace('.',',')} = <strong>${score.score.toLocaleString('it-IT')}</strong></p></div><div class="director-submit-grid"><label class="director-name-field"><span>Nome Direttore Sportivo</span><input id="directorNameInput" type="text" maxlength="40" autocomplete="nickname" value="${esc(name)}" placeholder="Es. Filba" ${sent?'disabled':''}></label><div class="director-submit-actions"><button id="sendDirectorVictoryBtn" class="btn primary" type="button" ${sent?'disabled':''}>${sent?'Risultato inviato':'Invia vittoria'}</button><a class="btn gold" href="classifica.html?board=director">Vedi classifica</a></div></div><p class="director-privacy-note">Vengono inviati soltanto nome del direttore, squadra assegnata, risultati della stagione, posizione prevista, difficoltà, Influenza e Punteggio DS. Non vengono richiesti login, email o password. <a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy</a></p><div id="directorSubmissionStatus" class="director-submit-status ${sent?'ok':''}">${sent?'Questa vittoria è già presente nella classifica ufficiale.':'Inserisci il tuo nome e invia una sola volta.'}</div></section>`;
}
function renderFinished(){
 const target=targetTeam(),row=targetRow(),rank=rankOf(target.id),playoffUsed=Boolean(state.playoff),success=state.championId===target.id,closeSecond=!success&&!playoffUsed&&rank===2&&Math.abs(gapFromTop())<=3,bronze=!success&&!closeSecond&&rank>0&&state.startExpectedRank-rank>=5,title=success?'MISSIONE COMPIUTA':closeSecond?'ARGENTO':bronze?'BRONZO':'OBIETTIVO MANCATO',position=success?'🏆':`${rank}°`,subtitle=success?`${target.name} è Campione d’Italia grazie al campionato regolamentare che hai costruito.`:closeSecond?`${target.name} ha sfiorato il titolo per non più di tre punti.`:bronze?`${target.name} ha migliorato di almeno cinque posizioni la previsione iniziale.`:`${target.name} non è riuscito a conquistare il campionato.`,score=directorScoreBreakdown(row.pts,state.influence,state.startExpectedRank);
 screen.innerHTML=`<section class="panel" style="${teamStyle(target)}"><div class="finish-hero"><div class="label" style="color:#ffe96c">Direttore Sportivo · Stagione conclusa</div><h1>${esc(title)}</h1><div class="finish-position">${position}</div><p>${esc(subtitle)}</p></div><div class="finish-grid"><div class="finish-stat"><b>${formatPoints(row.pts)}</b><span>Punti</span></div><div class="finish-stat"><b>${row.w}-${row.d}-${row.l}</b><span>V-N-P</span></div><div class="finish-stat"><b>${score.remaining}</b><span>Influenza rimasta</span></div><div class="finish-stat"><b>${esc(score.label)}</b><span>Difficoltà</span></div></div><section class="panel director-score-card difficulty-${score.key}"><div class="director-score-head"><div><div class="label">Punteggio classifica</div><h3>Punteggio Direttore Sportivo</h3></div><strong>${score.score.toLocaleString('it-IT')}</strong></div><div class="director-score-formula"><span><b>${formatPoints(score.finalPoints)} × 10</b><small>${Math.round(score.pointsValue).toLocaleString('it-IT')} dai punti finali</small></span><i>+</i><span><b>${score.remaining} × 80</b><small>${score.influenceValue.toLocaleString('it-IT')} dall’Influenza rimasta</small></span><i>×</i><span><b>${formatDirectorMultiplier(score.multiplier)}</b><small>${esc(score.label)} · prevista ${state.startExpectedRank}ª</small></span><i>=</i><span class="director-score-total"><b>${score.score.toLocaleString('it-IT')}</b><small>Punteggio DS finale</small></span></div></section>${renderDirectorSubmissionCard(success)}<section class="panel"><h3>Regolamenti approvati</h3>${state.regulationHistory.length?`<div class="active-rules">${state.regulationHistory.map(item=>`<article class="rule-card"><b>G${item.round} · ${esc(item.title)}</b><small>${item.replaced?`Ha sostituito ${esc(item.replaced)}.`:'Applicato al campionato.'}</small></article>`).join('')}</div>`:`<div class="empty">Nessun regolamento approvato.</div>`}</section><section class="panel"><h3>Designazioni arbitrali</h3>${state.refereeHistory?.length?`<div class="active-rules">${state.refereeHistory.map(item=>`<article class="rule-card referee-rule-card ${item.caught?'referee-caught':''}"><b>G${item.round} · ${esc(item.title||refereeById(item.id)?.title||item.id)}</b><small>${esc(refereeAssignmentDescription(item))}${item.caught?' · SCANDALO: punti azzerati.':''}</small></article>`).join('')}</div>`:`<div class="empty">Nessun arbitro designato tramite Influenza.</div>`}</section><section class="panel"><h3>Classifica finale</h3>${renderTable()}</section><div class="setup-actions" style="margin-top:16px"><button id="newSeasonBtn" class="btn primary" type="button">Nuova missione casuale</button><a class="btn gold" href="classifica.html?board=director">Classifica Direttore Sportivo</a><a class="btn" href="index.html">Torna al menu</a></div></section>`;
 const nameInput=document.getElementById('directorNameInput');
 if(nameInput)nameInput.addEventListener('input',()=>{state.directorName=String(nameInput.value||'');save()});
 const sendButton=document.getElementById('sendDirectorVictoryBtn');
 if(sendButton)sendButton.onclick=sendDirectorVictory;
 document.getElementById('newSeasonBtn').onclick=()=>{localStorage.removeItem(SAVE_KEY);state=null;render()};
}

function confirmReset(){
 if(!state){renderSetup();return}
 modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal"><div class="label">Azzera stagione</div><h2>Eliminare la missione?</h2><p class="subline">Classifica, regolamenti, arbitri, Influenza e cronologia verranno cancellati definitivamente.</p><div class="modal-actions"><button id="confirmResetBtn" class="btn red" type="button">Sì, azzera tutto</button><button id="cancelResetBtn" class="btn" type="button">Annulla</button></div></section></div>`;
 document.getElementById('confirmResetBtn').onclick=()=>{localStorage.removeItem(SAVE_KEY);state=null;closeModal();render();toast('Stagione azzerata.')};
 document.getElementById('cancelResetBtn').onclick=closeModal;
}
document.getElementById('resetBtn')?.addEventListener('click',confirmReset);
boot();
