/* Fantaballa Season Engine — event-handlers.js
 * Logica eseguibile degli eventi. Testi, ordine, modalità e opzioni vivono nei cataloghi JSON.
 * I riferimenti sono espliciti e validati: nessun nome proveniente dai JSON viene valutato come codice.
 */

function activateExtremeVarRule(mode){
 state.seasonRules.extremeVarRule=mode==='last'?'last':'first';
 return state.seasonRules.extremeVarRule==='last'
  ? 'Da ora l’ultimo gol di ogni tua partita viene annullato dal VAR, indipendentemente dalla squadra che lo segna.'
  : 'Da ora il primo gol di ogni tua partita viene annullato dal VAR, indipendentemente dalla squadra che lo segna.';
}
function hornedEntityEventAvailable(){
 const remaining=Math.max(0,seasonLength()-Number(state.matchday||0));
 return !state.seasonRules.soulEventChoice&&remaining>0&&remaining<=14&&rosterPlayers().length>0;
}
function removeFourteenSoulPlayers(){
 const ids=shuffle(rosterPlayers()).slice(0,14).map(entry=>String(entry.playerId));
 const removed=[];
 ids.forEach(id=>{
  const entry=rosterEntry(id);
  const name=entry?.player?.name||playerById(id)?.name||'Giocatore';
  if(entry){removeOwnRosterPlayerPermanently(entry,'il patto con l’essere misterioso');removed.push(name)}
 });
 return removed;
}
function simulateSoulSkippedAiRound(round,restLeaderId=''){
 const results=[];
 (Array.isArray(round)?round:[]).forEach(match=>{
  const homeId=String(match?.home||''),awayId=String(match?.away||'');
  if(!homeId||!awayId||homeId===USER_ID||awayId===USER_ID)return;
  if(restLeaderId&&(homeId===restLeaderId||awayId===restLeaderId)){results.push({homeId,awayId,rested:true});return;}
  const home=teamById(homeId),away=teamById(awayId);
  if(!home||!away)return;
  let [homeScore,awayScore]=simulateScore(Math.max(35,opponentMatchPower(home)),Math.max(35,opponentMatchPower(away)),.18,90);
  if(chaosEnabled())[homeScore,awayScore]=applyChaosScoreRules(home,away,homeScore,awayScore);
  updateStanding(homeId,homeScore,awayScore);
  updateStanding(awayId,awayScore,homeScore);
  results.push({homeId,awayId,homeScore,awayScore});
 });
 return results;
}
function sellSoulAndSkipMatches(){
 state.seasonRules.soulEventChoice='sold';
 const removed=removeFourteenSoulPlayers();
 const total=Math.min(14,Math.max(0,seasonLength()-Number(state.matchday||0)));
 let skipped=0,totalPoints=0;
 for(let i=0;i<total;i++){
  const round=state.schedule?.[Number(state.matchday)||0]||[];
  const userMatch=round.find(match=>String(match.home)===USER_ID||String(match.away)===USER_ID);
  const leaderRestId=state.seasonRules.fgciLeaderRestRule?String(sortedTable()[0]?.id||''):'';
  const aiResults=simulateSoulSkippedAiRound(round,leaderRestId);
  const standing=userStanding();if(standing)standing.pts=(Number(standing.pts)||0)+2;
  totalPoints+=2;skipped++;
  const opponentId=userMatch?String(userMatch.home===USER_ID?userMatch.away:userMatch.home):'';
  const opponent=teamById(opponentId);
  state.history.push({matchday:Number(state.matchday)+1,opponent:opponent?.name||'Partita saltata',opponentId,home:Boolean(userMatch&&String(userMatch.home)===USER_ID),gf:0,ga:0,displayGf:0,displayGa:0,winnerId:'',goals:[],opponentGoals:[],highlights:[],commentary:[],soulSkipped:true,matchNotPlayed:true,pointsAwarded:2,pointsAdjustment:2,pointsNote:'Patto dell’anima: partita non disputata e +2 punti amministrativi.'});
  state.lastRoundResults=aiResults;
  state.matchday=(Number(state.matchday)||0)+1;
 }
 state.lastResult=state.history[state.history.length-1]||null;
 state.seasonRules.soulSkippedMatches=skipped;
 state.seasonRules.soulSoldPlayers=removed;
 if(Number(state.matchday)>=seasonLength()){
  if(typeof advanceAfterRegularSeason==='function')advanceAfterRegularSeason();else state.phase='finished';
 }
 return `Patto concluso: ${skipped} ${skipped===1?'partita saltata':'partite saltate'}, +${totalPoints} punti e ${removed.length} giocatori hanno lasciato definitivamente la squadra.`;
}
function keepSoulDoubleMatch(){
 state.seasonRules.soulEventChoice='kept';
 state.seasonRules.soulDoubleMatchPending=true;
 return 'La prossima giornata verrà giocata due volte contro lo stesso avversario. Ottieni 6 punti solo vincendo entrambe le simulazioni; in ogni altro caso ottieni 0 punti.';
}
function activateFgciLeaderRestRule(){
 state.seasonRules.fgciLeaderRestRule=true;
 return 'Da questa giornata la squadra prima in classifica resta a riposo. Quando viene superata, il riposo passa automaticamente alla nuova capolista.';
}
function giveLastTeamLeaderPoints(){
 const table=sortedTable();if(table.length<2)return 'Non ci sono abbastanza squadre in classifica.';
 const leader=table[0],last=table[table.length-1],before=Number(last.pts)||0,target=Number(leader.pts)||0;
 last.pts=target;state.seasonRules.fgciLastPointsApplied=true;
 return `${last.name||'L’ultima in classifica'} passa da ${before} a ${target} punti, raggiungendo ${leader.name||'la capolista'}.`;
}


const SEASON_PORTAL_TRANSFER_KEY='fantaballa_season_portal_transfer_v1';
function portalDeepClone(value,fallback=null){
 try{return JSON.parse(JSON.stringify(value))}catch{return fallback}
}
function myHeroAcademiaEventTitle(){
 return `My Hero Academia è venuta a fare visita al centro d’allenamento del ${String(state.teamName||'tuo club')}`;
}
function myHeroAcademiaEventAvailable(){
 return !state.seasonRules.heroAcademiaRule&&!state.seasonRules.heroAcademiaPortalUsed;
}
function activateHeroAcademiaFourOneRule(){
 state.seasonRules.heroAcademiaRule='four-one';
 return 'All 4 1 & 1 4 all è attivo fino a fine stagione: una tua vittoria 4-1 azzera i tuoi punti; una tua sconfitta 1-4 azzera i punti di tutte le altre squadre.';
}
function currentPortalCompetitionId(){
 if(SAVE_MODE==='real')return String(state.competitionVariant||'serie-a')==='legend'?'legend':'serie-a';
 return 'community';
}
function randomPortalDestination(){
 const current=currentPortalCompetitionId();
 const all=[
  {id:'community',mode:'community',variant:'serie-a',label:'Campionato del Ca***',url:'campionato.html'},
  {id:'serie-a',mode:'real',variant:'serie-a',label:'Fantacampionato del Ca*** · Serie A',url:'campionato-real.html'},
  {id:'legend',mode:'real',variant:'legend',label:'Fantacampionato Legend',url:'campionato-real.html'}
 ];
 const available=all.filter(item=>item.id!==current);
 return pick(available)||all[0];
}
function portalRandomStanding(team,played,maxPoints){
 const rounds=Math.max(0,Math.floor(Number(played)||0));
 const ceiling=Math.max(0,Math.floor(Number(maxPoints)||0));
 const points=ceiling>0?Math.floor(Math.random()*(ceiling+1)):0;
 const competitivePoints=Math.min(points,rounds*3);
 let wins=Math.min(rounds,Math.floor(competitivePoints/3)),draws=0;
 while(wins>=0){
  draws=competitivePoints-(wins*3);
  if(draws>=0&&wins+draws<=rounds)break;
  wins--;
 }
 if(wins<0){wins=0;draws=Math.min(rounds,competitivePoints)}
 const losses=Math.max(0,rounds-wins-draws);
 const goalLimit=Math.max(1,rounds*2+1);
 return{
  id:String(team.id),name:String(team.name||''),p:rounds,w:wins,d:draws,l:losses,
  gf:Math.floor(Math.random()*goalLimit),ga:Math.floor(Math.random()*goalLimit),pts:points
 };
}
function openHeroAcademiaPortal(){
 const target=randomPortalDestination();
 const leader=typeof sortedTable==='function'?sortedTable()[0]:null;
 const currentUser=state?.standings?.[USER_ID]||(typeof userStanding==='function'?userStanding():null)||{};
 const snapshot=portalDeepClone(state,{})||{};
 snapshot.seasonRules=snapshot.seasonRules&&typeof snapshot.seasonRules==='object'?snapshot.seasonRules:{};
 snapshot.seasonRules.heroAcademiaPortalUsed=true;
 snapshot.seasonRules.heroAcademiaPortalDestination=target.id;
 const payload={
  version:2,targetMode:target.mode,targetVariant:target.variant,targetId:target.id,targetLabel:target.label,
  sourceMode:SAVE_MODE,sourceVariant:String(state.competitionVariant||'serie-a'),createdAt:Date.now(),
  teamName:String(state.teamName||''),coachName:String(state.coachName||''),coachType:String(state.coachType||''),
  formation:String(state.formation||'4-3-3'),gameMode:String(state.gameMode||'normal'),
  teamPaletteId:String(state.teamPaletteId||''),teamColors:state.teamColors&&typeof state.teamColors==='object'?{...state.teamColors}:null,
  currentMatchday:Math.max(0,Number(state.matchday)||0),
  currentLeaderPoints:Math.max(0,Number(leader?.pts)||0),
  userStanding:portalDeepClone(currentUser,{}),
  stateSnapshot:snapshot
 };
 try{localStorage.setItem(SEASON_PORTAL_TRANSFER_KEY,JSON.stringify(payload))}catch(error){console.error('Portale non salvato',error);return 'Il portale non riesce ad aprirsi perché il browser ha bloccato il salvataggio locale.'}
 state.seasonRules.heroAcademiaPortalUsed=true;
 state.seasonRules.heroAcademiaPortalDestination=target.id;
 if(typeof save==='function')save();
 setTimeout(()=>{try{location.href=`${target.url}?portal=${encodeURIComponent(target.variant)}&from=${encodeURIComponent(SAVE_MODE)}`}catch(error){console.error('Portale non aperto',error)}},1100);
 const points=Math.max(0,Number(currentUser?.pts)||0),played=Math.max(0,Number(state.matchday)||0);
 return `Il portale punta verso ${target.label}. Mantieni ${points} punti e ${played} giornate disputate; le nuove avversarie riceveranno punti casuali da 0 a ${Math.max(0,Number(leader?.pts)||0)}.`;
}
function consumeSeasonPortalTransfer(){
 let payload=null;
 try{payload=JSON.parse(localStorage.getItem(SEASON_PORTAL_TRANSFER_KEY)||'null')}catch{payload=null}
 if(!payload||![1,2].includes(Number(payload.version))||String(payload.targetMode||'')!==SAVE_MODE)return null;
 const targetVariant=SAVE_MODE==='real'?(String(payload.targetVariant)==='legend'?'legend':'serie-a'):'serie-a';
 try{
  const existing=localStorage.getItem(AUTO_SAVE_KEY);
  if(existing)localStorage.setItem(`${AUTO_SAVE_KEY}_portal_backup_${Date.now()}`,existing);
 }catch(error){console.warn('Backup pre-portale non riuscito',error)}
 const sourceSnapshot=payload.stateSnapshot&&typeof payload.stateSnapshot==='object'?portalDeepClone(payload.stateSnapshot,null):null;
 const next=sourceSnapshot||freshState();
 next.competitionVariant=targetVariant;
 next.teamName=String(payload.teamName||next.teamName);
 next.coachName=String(payload.coachName||next.coachName);
 next.coachType=normalizeCoachType(payload.coachType||next.coachType);
 next.formation=FORMATIONS[String(payload.formation||'')]?String(payload.formation):next.formation;
 next.gameMode=String(payload.gameMode)==='chaos'?'chaos':'normal';
 next.teamPaletteId=String(payload.teamPaletteId||next.teamPaletteId);
 if(payload.teamColors&&typeof payload.teamColors==='object')next.teamColors=normalizeClubColors(payload.teamColors);
 state=next;
 if(typeof applyCompetitionVariantData==='function')applyCompetitionVariantData(targetVariant);
 const oldUserTeam=(Array.isArray(next.teams)?next.teams:[]).find(team=>String(team?.id)===String(USER_ID))||{};
 const userClub=(Array.isArray(CLUBS)?CLUBS:[]).find(club=>String(club?.id)===String(typeof DEFAULT_FRESH_USER_CLUB_ID!=='undefined'?DEFAULT_FRESH_USER_CLUB_ID:''))||(Array.isArray(CLUBS)?CLUBS[0]:null);
 const currentMatchday=Math.max(0,Math.floor(Number(payload.currentMatchday??next.matchday)||0));
 const leaderPoints=Math.max(0,Math.floor(Number(payload.currentLeaderPoints)||0));
 const sourceUser=payload.userStanding&&typeof payload.userStanding==='object'?payload.userStanding:(next.standings?.[USER_ID]||{});
 const draftedIds=Array.isArray(next.draft?.roster)?next.draft.roster.map(entry=>String(entry?.playerId||'')).filter(Boolean):[];
 const opponentClubs=shuffle((Array.isArray(CLUBS)?CLUBS:[]).filter(club=>!userClub||String(club.id)!==String(userClub.id))).slice(0,19);
 next.userClubId=String(userClub?.id||next.userClubId||'');
 next.leagueClubIds=opponentClubs.map(club=>String(club.id));
 next.teams=[{
  id:USER_ID,clubId:next.userClubId,name:next.teamName,
  shortName:String(oldUserTeam.shortName||userClub?.shortName||next.teamName.slice(0,3)).toUpperCase(),
  colors:next.teamColors||userClub?.colorClub||oldUserTeam.colors,
  strength:Number(oldUserTeam.strength)||75
 }].concat(opponentClubs.map(club=>({
  id:String(club.id),clubId:String(club.id),name:String(club.name||club.id),shortName:String(club.shortName||club.name||'').slice(0,5),colors:club.colorClub,
  strength:typeof clubStrength==='function'?clubStrength(club.id,draftedIds):75,
  roster:typeof buildClubRoster==='function'?buildClubRoster(club.id,draftedIds):[],statuses:{},mascot:null,playerOverrides:{},
  chaos:{activeEffects:[],seenDecisionEvents:[],decisions:0,midseasonPickDelta:0,matchDuration:90,futureScorerId:'',futureInjuryZeroPoints:false,sixtyPointFear:false,eventChanceMultiplier:1,nonItalianChemZero:false,formation:'',latestDecision:null}
 })));
 next.schedule=typeof generateSchedule==='function'?generateSchedule(next.teams.map(team=>team.id)):[];
 next.matchday=Math.min(currentMatchday,next.schedule.length||currentMatchday);
 next.standings={};
 next.standings[USER_ID]={
  id:USER_ID,name:next.teamName,p:Math.max(0,Number(sourceUser.p)||next.matchday),
  w:Math.max(0,Number(sourceUser.w)||0),d:Math.max(0,Number(sourceUser.d)||0),l:Math.max(0,Number(sourceUser.l)||0),
  gf:Math.max(0,Number(sourceUser.gf)||0),ga:Math.max(0,Number(sourceUser.ga)||0),pts:Math.max(0,Number(sourceUser.pts)||0)
 };
 next.teams.filter(team=>team.id!==USER_ID).forEach(team=>{next.standings[team.id]=portalRandomStanding(team,next.matchday,leaderPoints)});
 next.phase='season';
 next.pendingEvent=null;
 next.lastRoundResults=[];
 next.seenDecisionEvents=[...new Set([...(Array.isArray(next.seenDecisionEvents)?next.seenDecisionEvents:[]),'my-hero-academia-visita'])];
 next.seasonRules=next.seasonRules&&typeof next.seasonRules==='object'?next.seasonRules:{};
 next.seasonRules.heroAcademiaPortalUsed=true;
 next.seasonRules.heroAcademiaPortalDestination=String(payload.targetId||targetVariant);
 next.seasonRules.seasonLength=Math.max(38,next.schedule.length||38);
 next.seasonRules.dynamicLeague='';next.seasonRules.dynamicLeagueLabel='';next.seasonRules.dynamicLeagueTeamIds=[];
 next.seasonRules.deathMatchClubId='';next.seasonRules.deathMatchClubName='';next.seasonRules.bottomHelpRoundTeamIds=[];
 next.seasonRules.eliminatedTeamIds=[];next.seasonRules.hungerGames=false;
 next.chaos=next.chaos&&typeof next.chaos==='object'?next.chaos:{};
 next.chaos.currentRound=null;next.chaos.latest=[];next.chaos.lastPreparedMatchday=next.matchday-1;
 try{localStorage.removeItem(SEASON_PORTAL_TRANSFER_KEY)}catch{}
 startupNotice=`Portale completato: sei arrivato in ${String(payload.targetLabel||'un nuovo campionato')} con ${next.standings[USER_ID].pts} punti dopo ${next.matchday} giornate. Le nuove avversarie hanno punti casuali compresi tra 0 e ${leaderPoints}.`;
 return next;
}

function activateFgciDirectMatchRule(mode){
 const normalized=mode==='effective-time'?'effective-time':'penalty-lottery';
 state.seasonRules.fgciDirectMatchRule=normalized;
 if(normalized==='penalty-lottery'){
  state.seasonRules.figcCompetitionRule='';
  return 'Lotteria dei rigori attiva fino a fine stagione: tutte le partite iniziano direttamente dal dischetto, il risultato resta 0-0 e durante la gara non possono verificarsi infortuni o cartellini rossi.';
 }
 if(!state.activeEffects.some(effect=>effect.type==='injuryRisk'&&String(effect.source||'')==='Tempo effettivo FGCI')){
  pushSeasonEffect('injuryRisk',1,{chance:.72,count:2,duration:2,source:'Tempo effettivo FGCI'});
 }
 return 'Tempo effettivo attivo fino a fine stagione: ogni partita dura 90 minuti effettivi, senza recupero, con un aumento drastico di infortuni ed espulsioni.';
}

const SEASON_EVENT_HANDLERS=Object.freeze({
 autoApply:Object.freeze({
"auto-1":function(){const r=pick(getStarterEntries());if(r){setOwnPlayerInjury(r,2);return `${r.player.name} è infortunato per 2 giornate.${state.seasonRules.futureInjuryZeroPoints?' Punti azzerati dalla regola del futuro.':''}`}return 'Nessun titolare disponibile.'},
"auto-2":function(){const r=pick(rosterPlayers());if(r){setOwnPlayerInjury(r,1);return `${r.player.name} è infortunato per 1 giornata.${state.seasonRules.futureInjuryZeroPoints?' Punti azzerati dalla regola del futuro.':''}`}return 'Nessun giocatore disponibile.'},
"auto-3":function(){state.activeEffects.push({type:'teamChem',value:5,rounds:1});return '+5 Intesa per la prossima partita.'},
"auto-4":function(){state.activeEffects.push({type:'subscriberChem',value:3,rounds:2});return '+3 Intesa agli abbonati per 2 giornate.'},
"auto-5":function(){state.activeEffects.push({type:'cards',value:1,rounds:1});return 'Probabilità di squalifica aumentata per la prossima partita.'}
 }),
 available:Object.freeze({
"quest-like-a-bomber":function(){return questCanStart(5)},
"quest-fair-play-finanziario":function(){return questCanStart(4)},
"quest-la-curva":function(){return questCurveAvailable()},
"quest-ammazza-grandi":function(){return questCanStart(6)},
"quest-milanlab":function(){return questCanStart(5)},
"quest-calcio-champagne":function(){return questCanStart(3)},
"quest-un-leader":function(){return leaderQuestCanStart()},
"quest-saracinesca":function(){return saracinescaQuestAvailable()},
"quest-non-era-mai-rigore":function(){return noRigoreQuestAvailable()},
"quest-zona-cesarini":function(){return zonaCesariniQuestAvailable()},
"quest-internazionale":function(){return internazionaleQuestAvailable()},
"pulmino-bordello":function(){return Number(state.matchday)<19},
"figlio-presidente":function(){return Number(state.matchday)<19},
"whatsapp-pubblicato":function(){return Number(state.matchday)<19},
"rissa-mascotte":function(){return Number(state.matchday)<19},
"personaggio-misterioso-tearless-italia-2006":function(){const chain=mysteryCharacterChain();return Number(state.matchday)<seasonLength()-2&&!chain.active&&!chain.completed},
"cassaaa-pinguino":function(){return Number(state.matchday)<seasonLength()-3&&!penguinChain().active&&!penguinChain().completed},
"mentalista":function(){return Number(state.matchday)<seasonLength()-6},
"rapito-alieni":function(){return Number(state.matchday)<19},
"arbitro-ecuadoriano":function(){return !secretRefereeDealState().active},
"maglie-nomi-sbagliati":function(){return realCurrentLineupEntries().length>=2},
"giocatore-insonne":function(){return realCurrentLineupEntries().length>0},
"anvedi-goicoechea":function(){return Number(state.matchday)<19},
"figura-aldila":function(){return Number(state.matchday)<19},
"omonimo-allenatore":function(){return Boolean(String(state.coachName||'').trim())},
"figura-misteriosa-tattico-fantaguru":function(){return Number(state.matchday)<19},
"figlio-del-mister":function(){return Number(state.matchday)<19&&Boolean(coachNamedRosterEntry())},
"generale-misterioso":function(){return Number(state.matchday)<seasonLength()-6},
"figc-regola-gol":function(){return !state.seasonRules.federationGoalRule},
"figc-regola-episodi":function(){return !state.seasonRules.figcIncidentRule},
"space-jam":function(){return !state.seasonRules.spaceJamRule&&!state.seasonRules.spaceJamTalentPending},
"misterioso-francese":function(){return !state.seasonRules.frenchEventChoice},
"figc-formula-uno-niente-pareggio":function(){return !state.seasonRules.figcCompetitionRule&&!state.seasonRules.fgicLeagueRule},
"fgic-playoff-aiuto-fondo":function(){return !state.seasonRules.fgicLeagueRule&&!state.seasonRules.figcCompetitionRule},
"figura-pelata-misteriosa":function(){return !state.seasonRules.dynamicLeague},
"fgci-risultati-estremi":function(){return !state.seasonRules.fgciResultRule},
"nuovo-video-fantaballa":function(){return !state.seasonRules.fantaballaVideoRule},
"italia-pizza-catenaccio":function(){return !state.seasonRules.italiaCatenaccioRule},
"fgci-punti-gol":function(){return !state.seasonRules.fgciPointsRule},
"curva-contestazione":function(){return curvaContestCanAppear()},
"punti-pari-dispari":function(){return Number(state.matchday)>0&&Number(state.matchday)<seasonLength()},
"barone-sportivo-sfida":function(){return questCanStart(3)&&!creatorInUserRoster('850')},
"stefano-finari-roma":function(){return Number(state.matchday)<seasonLength()&&!creatorInUserRoster('851')&&!stefanoFinariChallengeState().active},
"rigorista-improvvisato":function(){return improvisedPenaltyAvailable()},
"fratello-scarso":function(){return weakBrotherAvailable()},
"portiere-vuole-segnare":function(){return goalkeeperScorerAvailable()},
"contratto-scritto-male":function(){return badContractAvailable()},
"modulo-football-manager":function(){return internetFormationAvailable()},
"giocatore-porta-sfortuna":function(){return badLuckPlayerAvailable()},
"ricorso-permanente":function(){return permanentAppealAvailable()},
"punti-gol-subiti":function(){return concededGoalPointsAvailable()},
"designazione-arbitrale":function(){return refereeDesignationAvailable()},
"posto-fisso":function(){return fixedJobAvailable()},
"pillola-rossa-pillola-blu":function(){return pillInventoryEventAvailable()},
"misterioso-lakaka-lukaku":function(){return mysteriousLakakaEventAvailable()},
"presidente-tirchio":function(){return thriftyPresidentEventAvailable()},
"procuratore-invadente":function(){return intrusiveAgentAvailable()},
"fascia-di-calabria":function(){return calabriaArmbandAvailable()},
"talpa-spogliatoio":function(){return lockerRoomMoleAvailable()},
"partita-senza-mister":function(){return noMisterMatchAvailable()},
"cambio-presidente":function(){return presidentChangeAvailable()},
"var-estremamente-severo":function(){return !state.seasonRules.extremeVarRule},
"essere-misterioso-con-corna":function(){return hornedEntityEventAvailable()},
"nuovo-regolamento-fgci-riposo":function(){return !state.seasonRules.fgciLeaderRestRule&&!state.seasonRules.fgciLastPointsApplied},
"my-hero-academia-visita":function(){return myHeroAcademiaEventAvailable()},
"nuovo-regolamento-fgci-rigori-tempo":function(){return !state.seasonRules.fgciDirectMatchRule}
 }),
 title:Object.freeze({
"omonimo-allenatore":function(){return `Ti si avvicina un tipo di nome ${String(state.coachName||'misterioso')}`},
"cambio-stadio":function(){return `Il presidente del ${String(state.teamName||'tuo club')} ti chiede se è una buona idea cambiare stadio`},
"partita-senza-mister":function(context){return noMisterMatchTitle(context)},
"my-hero-academia-visita":function(){return myHeroAcademiaEventTitle()}
 }),
 describe:Object.freeze({
"rapito-alieni":function(context){return context?.playerName?`${this.text} Il giocatore coinvolto è ${context.playerName}.`:this.text},
"giocatore-insonne":function(context){return context?.playerName?`${this.text} Il giocatore coinvolto è ${context.playerName}.`:this.text},
"anvedi-goicoechea":function(context){return context?.goalkeeperName?`${this.text} Il portiere coinvolto è ${context.goalkeeperName}.`:this.text},
"curva-contestazione":function(){const mister=String(state.coachName||'Mister').trim()||'Mister';return `${mister}, devi vendere! Vattene, vattene!`},
"stefano-finari-roma":function(){return `Stefano Finari arriva con la sciarpa giallorossa. «${String(state.teamName||'La tua squadra')} è la mia seconda squadra preferita!»`},
"rigorista-improvvisato":function(context){return improvisedPenaltyDescription(context)},
"fratello-scarso":function(context){return weakBrotherDescription(context)},
"portiere-vuole-segnare":function(context){return goalkeeperScorerDescription(context)},
"contratto-scritto-male":function(context){return badContractDescription(context)},
"giocatore-porta-sfortuna":function(context){return badLuckPlayerDescription(context)},
"procuratore-invadente":function(context){return intrusiveAgentDescription(context)},
"fascia-di-calabria":function(context){return calabriaArmbandDescription(context)},
"talpa-spogliatoio":function(context){return lockerRoomMoleDescription(context)},
"partita-senza-mister":function(context){return noMisterMatchDescription(context)}
 }),
 createContext:Object.freeze({
"rapito-alieni":function(){const entry=randomOwnEntry();return entry?{playerId:String(entry.playerId),playerName:entry.player.name}:{}},
"giocatore-insonne":function(){const entry=randomRealCurrentLineupEntry();return entry?{playerId:String(entry.playerId),playerName:entry.player.name}:{}},
"anvedi-goicoechea":function(){const entry=startingGoalkeeperEntry();return entry?{goalkeeperId:String(entry.playerId),goalkeeperName:entry.player.name}:{}},
"rigorista-improvvisato":function(){return improvisedPenaltyContext()},
"fratello-scarso":function(){return weakBrotherContext()},
"portiere-vuole-segnare":function(){return goalkeeperScorerContext()},
"contratto-scritto-male":function(){return badContractContext()},
"giocatore-porta-sfortuna":function(){return badLuckPlayerContext()},
"procuratore-invadente":function(){return intrusiveAgentContext()},
"fascia-di-calabria":function(){return calabriaArmbandContext()},
"talpa-spogliatoio":function(){return lockerRoomMoleContext()},
"partita-senza-mister":function(){return noMisterMatchContext()}
 }),
 choiceApply:Object.freeze({
"nuovo-sponsor:0":function(){return activateBallariniSponsor()},
"nuovo-sponsor:1":function(){return activateFootballManagerSponsor()},
"quest-like-a-bomber:0":function(){return acceptLikeBomberQuest()},
"quest-like-a-bomber:1":function(){return'Rifiuti la sfida. Nessun effetto.'},
"quest-fair-play-finanziario:0":function(){return acceptFairPlayQuest()},
"quest-fair-play-finanziario:1":function(){return rejectFairPlayQuest()},
"quest-la-curva:0":function(){return acceptCurvaQuest()},
"quest-la-curva:1":function(){return'Rifiuti la richiesta della curva. Nessun effetto.'},
"quest-ammazza-grandi:0":function(){return acceptAmmazzaGrandiQuest()},
"quest-ammazza-grandi:1":function(){return'Rifiuti la sfida del vecchio allenatore. Nessun effetto.'},
"quest-milanlab:0":function(){return acceptMilanLabQuest()},
"quest-milanlab:1":function(){return'Non affidi la squadra al medico rossonero. Nessun effetto.'},
"quest-calcio-champagne:0":function(){return acceptChampagneQuest()},
"quest-calcio-champagne:1":function(){return'Rifiuti l’investimento. Nessun effetto.'},
"quest-un-leader:0":function(){return acceptLeaderQuest()},
"quest-un-leader:1":function(){return'Rinunci a cercare un leader. Nessun effetto.'},
"quest-saracinesca:0":function(){return acceptSaracinescaQuest()},
"quest-saracinesca:1":function(){return'Rinunci alla prova della saracinesca. Nessun effetto.'},
"quest-non-era-mai-rigore:0":function(){return acceptNoRigoreQuest()},
"quest-non-era-mai-rigore:1":function(){return'Rinunci alla prova arbitrale. Nessun effetto.'},
"quest-zona-cesarini:0":function(){return acceptZonaCesariniQuest()},
"quest-zona-cesarini:1":function(){return'Rinunci alla sfida del finale di partita. Nessun effetto.'},
"quest-internazionale:0":function(){return acceptInternazionaleQuest()},
"quest-internazionale:1":function(){return'Rinunci alla collezione internazionale. Nessun effetto.'},
"pulmino-bordello:0":function(){pushEffect('teamChem',5,2);return applyPlayerEffect('playerOvr',-10,1)},
"pulmino-bordello:1":function(){pushEffect('teamOvr',10,1);return changeMidseasonPicks(-1)},
"figlio-presidente:0":function(){pushEffect('forcedLoss',1,1);return changeMidseasonPicks(1)},
"figlio-presidente:1":function(){pushEffect('teamOvr',6,1);return changeMidseasonPicks(-1)},
"gol-tre-due:0":function(){return applyPlayerEffect('playerOvr',5,1)},
"gol-tre-due:1":function(){pushEffect('teamOvr',5,1);const entry=randomOwnEntry();if(!entry)return 'Nessun giocatore disponibile.';injureOwnPlayers([entry],1);return `${entry.player.name} si infortuna per 1 giornata.`},
"whatsapp-pubblicato:0":function(){pushEffect('subscriberChem',10,1);state.seasonRules.botMidseason=true;return 'Il bot controllerà casualmente tutte le entrate e le uscite del draft di metà stagione.'},
"whatsapp-pubblicato:1":function(){pushEffect('teamChem',-5,2);return '-5 Intesa alla squadra per 2 giornate.'},
"rissa-mascotte:0":function(){state.seasonRules.autoDecisions=true;state.seasonRules.autoMidseason=true;state.seasonRules.botMidseason=true;return 'Da ora tutte le decisioni e il draft di metà stagione saranno gestiti casualmente dalla mascotte.'},
"rissa-mascotte:1":function(){return addMascotToRandomTeam()},
"cuggino-influencer:0":function(){pushEffect('subscriberChem',10,1);return '+10 Intesa agli abbonati nella prossima partita.'},
"cuggino-influencer:1":function(){pushEffect('teamOvr',5,1);const entries=rosterPlayers().filter(entry=>isSubscriber(entry.player));const names=injureOwnPlayers(entries,1);return names.length?`Abbonati infortunati per 1 giornata: ${names.join(', ')}.`:'Non ci sono abbonati in rosa.'},
"drone-avversario:0":function(){pushEffect('opponentOvr',-10,1);const opponent=nextOpponentTeam();return opponent?`${opponent.name} riceve -10 OVR nella prossima partita.`:'Il prossimo avversario riceve -10 OVR.'},
"drone-avversario:1":function(){return injureNextOpponentPlayers(2)},
"aggiornamento-var:0":function(){pushEffect('varRandomResult',1,1,{source:'VAR non aggiornato'});return 'La prossima partita avrà un risultato completamente casuale, indipendente dall’OVR delle due squadre.'},
"aggiornamento-var:1":function(){pushEffect('refChaos',1,1,{opponentRedChance:0,ownRedChance:.70,source:'VAR spento'});return 'Nella prossima partita aumenta fortemente il rischio di un’espulsione per la tua squadra.'},
"crescita-personale:0":function(){pushEffect('teamChemMultiplier',2,1);return 'Tutti i bonus Intesa positivi dei titolari vengono raddoppiati nella prossima partita.'},
"crescita-personale:1":function(){pushEffect('teamOvr',6,1);pushEffect('teamChemZero',1,1);return '+6 OVR alla squadra e Intesa azzerata nella prossima partita.'},
"personaggio-misterioso-tearless-italia-2006:0":function(){return recruitTearless()},
"personaggio-misterioso-tearless-italia-2006:1":function(){return recruitWorldChampion()},
"cassaaa-pinguino:0":function(){return acceptCassaaaBet()},
"cassaaa-pinguino:1":function(){return scrollPenguin()},
"mentalista:0":function(){return hypnotizeRandomAttacker()},
"mentalista:1":function(){pushEffect('refChaos',1,1,{opponentRedChance:.45,ownRedChance:.30,source:'Mentalista'});return 'Nella prossima partita: 45% rosso avversario e 30% rosso per la tua squadra.'},
"mentalista-pollaio:0":function(){return trainChicken()},
"mentalista-pollaio:1":function(){return veterinarianChicken()},
"mentalista-pollaio:2":function(){return acceptChickenNature()},
"grigliata-ultras:0":function(){pushEffect('teamChemMultiplier',2,1);return 'Tutti i bonus Intesa positivi dei titolari vengono raddoppiati nella prossima partita.'},
"grigliata-ultras:1":function(){pushEffect('teamOvr',7,1);const entry=randomOwnEntry();if(!entry)return 'Nessun giocatore disponibile.';injureOwnPlayers([entry],1);return `${entry.player.name} subisce una contusione di 1 giornata.`},
"rapito-alieni:0":function(context){const entry=context?.playerId?rosterEntry(context.playerId):null;if(!entry)return 'Nessun giocatore disponibile.';const current=Number(entry.player?.ovr||playerById(entry.playerId)?.ovr)||60,change=setPermanentRosterOvr(entry,current+5);return change?`${change.player.name} sale da ${change.before} a ${change.after} OVR fino a fine stagione.`:'Il bonus OVR non è stato applicato.'},
"rapito-alieni:1":function(context){if(!context?.playerId)return 'Nessun giocatore disponibile.';queueEqualOrBetterMidseasonPlayer(context.playerId);return `${context.playerName} dovrà essere scambiato al draft di metà stagione con un giocatore di pari o maggiore OVR.`},
"arbitro-ecuadoriano:0":function(){return startSecretRefereeDeal('accept')},
"arbitro-ecuadoriano:1":function(){return startSecretRefereeDeal('refuse')},
"maglie-nomi-sbagliati:0":function(){return startWrongShirtsEvent()},
"maglie-nomi-sbagliati:1":function(){return printLastMinuteShirts()},
"porta-calcetto:0":function(){pushEffect('teamOvr',-3,1,{source:'Protesta per la porta da calcetto'});return 'La squadra riceve -3 OVR nella prossima partita per il nervosismo.'},
"porta-calcetto:1":function(){return acceptSmallGoalMatch()},
"giocatore-insonne:0":function(context){return sendInsomniacOnField(context)},
"giocatore-insonne:1":function(context){return restInsomniacPlayer(context)},
"maglie-novanta:0":function(){pushEffect('teamOvr',5,1);pushEffect('injuryRisk',1,1,{chance:.45,count:1,duration:1,source:'Maglie strette'});return '+5 OVR, con il 45% di rischio che un giocatore si infortuni.'},
"maglie-novanta:1":function(){pushEffect('teamChem',5,2);return '+5 Intesa alla squadra per 2 giornate.'},
"tifoso-formazione:0":function(){const standing=userStanding();if(standing)standing.pts-=1;return 'È stato applicato 1 punto di penalizzazione in classifica.'},
"tifoso-formazione:1":function(){pushEffect('maxDraw',1,1);return 'La prossima partita non potrà essere vinta: il risultato massimo sarà un pareggio.'},
"tiktok-boomer:0":function(){pushEffect('subscriberChemMultiplier',2,2);pushEffect('teamOvr',-5,2);return 'Intesa positiva degli abbonati raddoppiata e -5 OVR alla squadra per 2 giornate.'},
"tiktok-boomer:1":function(){pushEffect('teamOvr',5,1);pushEffect('teamChemZero',1,1);return '+5 OVR alla squadra e Intesa azzerata nella prossima partita.'},
"marotta-league:0":function(){state.seasonRules.marottaDoubleWins=true;state.seasonRules.marottaLossPenalty=100;return 'Da ora fino a fine stagione ogni vittoria assegna il doppio dei punti previsti in quel momento; ogni sconfitta comporta -100 punti.'},
"marotta-league:1":function(){pushEffect('forcedWin',1,1);pushEffect('injuryRisk',1,1,{chance:.80,count:1,duration:2,source:'Vittoria assicurata'});return 'La prossima partita sarà vinta, ma c’è l’80% di rischio di un infortunio da 2 giornate.'},
"corto-muso:0":function(){pushEffect('goalCap',1,1);pushEffect('winPoints',9,1);return 'Nella prossima partita massimo 1 gol segnato; un’eventuale vittoria vale 9 punti.'},
"corto-muso:1":function(){pushEffect('cleanSheet',1,2);const entries=rosterPlayers().filter(entry=>roleOf(entry.player)==='A');entries.forEach(entry=>statusOf(entry.playerId).suspension=Math.max(statusOf(entry.playerId).suspension,1));return entries.length?`Porta inviolata garantita per 2 partite. Attaccanti squalificati per la prossima giornata: ${entries.map(entry=>entry.player.name).join(', ')}.`:'Porta inviolata garantita per 2 partite.'},
"ma-che-mollo:0":function(){pushEffect('teamChemMultiplier',3,1);pushEffect('minimumGoalsAgainst',1,2);return 'Intesa positiva triplicata nella prossima partita; almeno 1 gol subito nelle prossime 2.'},
"ma-che-mollo:1":function(){pushEffect('forceSubscriberGoals',1,1);state.seasonRules.autoDecisions=true;return 'Nella prossima partita ogni abbonato presente in campo segnerà almeno un gol. Le decisioni future saranno automatiche.'},
"var-misterioso:0":function(){const names=zeroFiveTeamsIncluding(USER_ID);return names.length?`${names.join(', ')} vanno a 0 punti in classifica.`:'Nessuna squadra disponibile.'},
"var-misterioso:1":function(){pushEffect('refChaos',1,2,{opponentRedChance:.75,ownRedChance:.60,source:'VAR misterioso'});return 'Per 2 partite: 75% di rosso avversario e 60% di rosso per la tua squadra.'},
"milan-lab:0":function(){pushEffect('injuryRisk',1,3,{chance:.80,count:1,duration:2,source:'Milan Lab'});return 'Per le prossime 3 partite c’è l’80% di rischio che un giocatore subisca un infortunio di 2 giornate.'},
"milan-lab:1":function(){const entry=randomOwnEntry(item=>!statusOf(item.playerId).seasonOut)||randomOwnEntry();return ruleOutForSeason(entry,'Milan Lab')},
"anvedi-goicoechea:0":function(context){const entry=context?.goalkeeperId?rosterEntry(context.goalkeeperId):startingGoalkeeperEntry();return ruleOutForSeason(entry,'Anvedi Goicoechea')},
"anvedi-goicoechea:1":function(context){const entry=context?.goalkeeperId?rosterEntry(context.goalkeeperId):startingGoalkeeperEntry();if(!entry)return 'Nessun portiere disponibile.';queueMandatoryMidseasonPlayer(entry.playerId);return `${entry.player.name} dovrà essere obbligatoriamente scambiato al draft di metà stagione.`},
"quelli-del-fantacalcio:0":function(){pushEffect('noGoals',1,1);return 'Nella prossima partita la tua squadra segnerà 0 gol, qualunque cosa accada.'},
"quelli-del-fantacalcio:1":function(){pushEffect('baseOvrOnly',1,3);return 'Per 3 partite saranno usati solo gli OVR base. Intesa e modificatori OVR saranno ignorati.'},
"fantaballa-fa-video:0":function(){return addMaradonaEventPlayer()},
"fantaballa-fa-video:1":function(){state.seasonRules.drawPoints=6;return 'Da questo momento e fino a fine stagione ogni pareggio del campionato assegna 6 punti a entrambe le squadre.'},
"misterfm-fa-video:0":function(){return rebuildWeakestStarters()},
"misterfm-fa-video:1":function(){return runMisterFmExperiment()},
"demone-durata-partite:0":function(){state.seasonRules.matchDuration=30;state.seasonRules.longMatchRisk=false;return 'Da ora tutte le tue partite termineranno al 30° minuto.'},
"demone-durata-partite:1":function(){state.seasonRules.matchDuration=120;state.seasonRules.longMatchRisk=true;return 'Da ora le tue partite dureranno 120 minuti, con rischio maggiore di infortuni ed espulsioni.'},
"personaggio-capelli-bianchi:0":function(){if(Math.random()<.5){const names=boostAllRosterPlayers(10);return `${names.length} giocatori ricevono +10 OVR fino a fine stagione.`}const names=ruleOutAllRosterPlayers('Bevanda energetica');unlockAchievement('era-meglio-l-acqua');return `${names.length} giocatori sono infortunati fino al termine della stagione.`},
"personaggio-capelli-bianchi:1":function(){return activateDeathMatchClub()},
"figura-aldila:0":function(){return forceUserFormation('2-4-4')},
"figura-aldila:1":function(){return activateMandatoryDcTopSwap()},
"fgci-regolamento-rossi-punti:0":function(){state.seasonRules.redCardGoals=true;return 'Da ora ogni squadra che riceve un rosso ottiene anche un gol a favore.'},
"fgci-regolamento-rossi-punti:1":function(){state.seasonRules.pointsEqualGoals=true;return 'Da ora ogni squadra ottiene in classifica tanti punti quanti sono i gol segnati nella partita.'},
"mago-do-nascimento:0":function(){state.seasonRules.injuredOvrBonus=40;return 'Da ora ogni giocatore infortunato schierato riceve +40 OVR finché resta infortunato.'},
"mago-do-nascimento:1":function(){return applyBlackMagicBoost()},
"fgci-regolamento-gol-tardivi:0":function(){state.seasonRules.lateGoalsDouble=true;return 'Da ora i gol segnati dall’80° minuto in poi valgono doppio per tutte le squadre.'},
"fgci-regolamento-gol-tardivi:1":function(){state.seasonRules.zeroZeroNoPoints=true;return 'Da ora ogni 0-0 assegna 0 punti a entrambe le squadre.'},
"underdog:0":function(){return empowerUnderdog()},
"underdog:1":function(){return guaranteeSixNil()},
"sessanta-sfumature:0":function(){return sixtyShadesSacrifice()},
"sessanta-sfumature:1":function(){return activateSixtyPointFear()},
"omonimo-allenatore:0":function(){return doubleCoachNamesakeChemistry()},
"omonimo-allenatore:1":function(){return doubleTeamChemistryTwoMatches()},
"figura-misteriosa-tattico-fantaguru:0":function(){return activatePersistentTactician()},
"figura-misteriosa-tattico-fantaguru:1":function(){return activateFantaguru()},
"figlio-del-mister:0":function(){return boostCoachNamedPlayer()},
"figlio-del-mister:1":function(){return activateCoachTopSwap()},
"personaggio-mantello-multiverso:0":function(){return multiverseClassic()},
"personaggio-mantello-multiverso:1":function(){return multiverseReal()},
"personaggio-misterioso-sosia:0":function(){return bringCoachNamesake()},
"personaggio-misterioso-sosia:1":function(){return activateFutureScorer()},
"personaggio-corona-spine:0":function(){return reverseStandingsPoints()},
"personaggio-corona-spine:1":function(){return doubleEventAppearanceRate()},
"fgci-regole-estreme:0":function(){return extendSeasonTo76()},
"fgci-regole-estreme:1":function(){return activateHungerGames()},
"fgci-formazioni-estreme:0":function(){return forceSeasonFormation('4-4-4')},
"fgci-formazioni-estreme:1":function(){return forceSeasonFormation('3-3-3')},
"generale-misterioso:0":function(){return replaceNonItalianWithItalians()},
"generale-misterioso:1":function(){return activateClosedPorts()},
"generale-documenti:0":function(){return collaborateWithGeneral()},
"generale-documenti:1":function(){return hideForeignPlayerFromGeneral()},
"generale-documenti:2":function(){return dismissGeneral()},
"figc-regola-gol:0":function(){return activateFederationGoalRule('golden')},
"figc-regola-gol:1":function(){return activateFederationGoalRule('last')},
"figc-regola-episodi:0":function(){return activateFigcIncidentRule('negative')},
"figc-regola-episodi:1":function(){return activateFigcIncidentRule('positive')},
"space-jam:0":function(){return activateSpaceJamTalentChallenge()},
"space-jam:1":function(){return activateSpaceJamRandomKickoff()},
"misterioso-francese:0":function(){return activateFrenchFlyingGoalkeeper()},
"misterioso-francese:1":function(){return activateFrenchLateTurn()},
"figc-formula-uno-niente-pareggio:0":function(){return activateFigcCompetitionRule('formula-one')},
"figc-formula-uno-niente-pareggio:1":function(){return activateFigcCompetitionRule('no-draw')},
"fgic-playoff-aiuto-fondo:0":function(){return activateFgicLeagueRule('playoffs')},
"fgic-playoff-aiuto-fondo:1":function(){return activateFgicLeagueRule('bottom-help')},
"figura-pelata-misteriosa:0":function(){return activateExpandedLeague()},
"figura-pelata-misteriosa:1":function(){return activateEliteLeague()},
"fgci-risultati-estremi:0":function(){return activateFgciResultRule('boredom-wins')},
"fgci-risultati-estremi:1":function(){return activateFgciResultRule('all-in')},
"nuovo-video-fantaballa:0":function(){return activateFantaballaVideoRule('reverse-points')},
"nuovo-video-fantaballa:1":function(){return activateFantaballaVideoRule('two-goals-to-win')},
"italia-pizza-catenaccio:0":function(){return activateItaliaCatenaccioRule('allegri')},
"italia-pizza-catenaccio:1":function(){return activateItaliaCatenaccioRule('goal-disgust')},
"fgci-punti-gol:0":function(){return activateFgciPointsRule('heavy-goals')},
"fgci-punti-gol:1":function(){return activateFgciPointsRule('clean-sheet')},
"curva-contestazione:0":function(){return activateCurvaTitleChallenge()},
"curva-contestazione:1":function(){return activateCurvaAwayPenalty()},
"punti-pari-dispari:0":function(){return scheduleStandingsResetByParity('even')},
"punti-pari-dispari:1":function(){return scheduleStandingsResetByParity('odd')},
"fgci-cartellini-estremi:0":function(){return activateYellowEqualsRed()},
"fgci-cartellini-estremi:1":function(){return activatePinkCardRule()},
"barone-sportivo-sfida:0":function(){return acceptBaroneSportivoChallenge()},
"barone-sportivo-sfida:1":function(){return sendBaroneSportivoToRandomTeam()},
"stefano-finari-roma:0":function(){return acceptStefanoFinariChallenge()},
"stefano-finari-roma:1":function(){return guaranteeNextMatchExpulsion()},
"rigorista-improvvisato:0":function(context){return acceptImprovisedPenalty(context)},
"rigorista-improvvisato:1":function(context){return rejectImprovisedPenalty(context)},
"fratello-scarso:0":function(context){return acceptWeakBrother(context)},
"fratello-scarso:1":function(context){return rejectWeakBrother(context)},
"portiere-vuole-segnare:0":function(context){return acceptGoalkeeperScorer(context)},
"portiere-vuole-segnare:1":function(context){return rejectGoalkeeperScorer(context)},
"contratto-scritto-male:0":function(context){return acceptBadContract(context)},
"contratto-scritto-male:1":function(context){return rejectBadContract(context)},
"modulo-football-manager:0":function(){return acceptInternetFormation()},
"modulo-football-manager:1":function(){return rejectInternetFormation()},
"giocatore-porta-sfortuna:0":function(context){return benchBadLuckPlayer(context)},
"giocatore-porta-sfortuna:1":function(context){return startBadLuckPlayer(context)},
"ricorso-permanente:0":function(){return acceptPermanentAppeal()},
"ricorso-permanente:1":function(){return rejectPermanentAppeal()},
"punti-gol-subiti:0":function(){return acceptConcededGoalPoints()},
"punti-gol-subiti:1":function(){return rejectConcededGoalPoints()},
"designazione-arbitrale:0":function(){return acceptMariaSoleDesignation()},
"designazione-arbitrale:1":function(){return acceptRosarioDesignation()},
"posto-fisso:0":function(){return applyFixedJobRoleRule()},
"posto-fisso:1":function(){return retireSingleRolePlayers()},
"pillola-rossa-pillola-blu:0":function(){return receivePillItem('red-pill')},
"pillola-rossa-pillola-blu:1":function(){return receivePillItem('blue-pill')},
"misterioso-lakaka-lukaku:0":function(){return receiveMysteriousLakakaPlayer('lakaka')},
"misterioso-lakaka-lukaku:1":function(){return receiveMysteriousLakakaPlayer('lukaku')},
"presidente-tirchio:0":function(){return activateThriftyPresidentCuts()},
"presidente-tirchio:1":function(){return activateThriftyPresidentMarketBlock()},
"procuratore-invadente:0":function(context){return acceptIntrusiveAgent(context)},
"procuratore-invadente:1":function(context){return rejectIntrusiveAgent(context)},
"fascia-di-calabria:0":function(context){return assignCalabriaArmband(context)},
"fascia-di-calabria:1":function(){return destroyCalabriaArmband()},
"talpa-spogliatoio:0":function(context){return accuseLockerRoomMole(context,0)},
"talpa-spogliatoio:1":function(context){return accuseLockerRoomMole(context,1)},
"talpa-spogliatoio:2":function(context){return accuseLockerRoomMole(context,2)},
"talpa-spogliatoio:3":function(){return ignoreLockerRoomMole()},
"partita-senza-mister:0":function(context){return chooseCaptainNoMister(context)},
"partita-senza-mister:1":function(context){return trustViceNoMister(context)},
"cambio-presidente:0":function(){return startErichToirChallenge()},
"cambio-presidente:1":function(){return startSylvioBerlusoniChallenge()},
"cambio-presidente:2":function(){return startGianpietroPozzuoloChallenge()},
"cambio-stadio:0":function(){state.seasonRules.stadiumHomeAdvantageBonus=Math.max(Number(state.seasonRules.stadiumHomeAdvantageBonus)||0,.06);return "Trasloco completato: il nuovo stadio aumenta leggermente il vantaggio nelle partite casalinghe fino al termine della stagione."},
"cambio-stadio:1":function(){const names=boostAllRosterPlayers(1);return `${names.length} giocatori della rosa ricevono +1 OVR permanente.`},
"var-estremamente-severo:0":function(){return activateExtremeVarRule('first')},
"var-estremamente-severo:1":function(){return activateExtremeVarRule('last')},
"essere-misterioso-con-corna:0":function(){return sellSoulAndSkipMatches()},
"essere-misterioso-con-corna:1":function(){return keepSoulDoubleMatch()},
"nuovo-regolamento-fgci-riposo:0":function(){return activateFgciLeaderRestRule()},
"nuovo-regolamento-fgci-riposo:1":function(){return giveLastTeamLeaderPoints()},
"my-hero-academia-visita:0":function(){return activateHeroAcademiaFourOneRule()},
"my-hero-academia-visita:1":function(){return openHeroAcademiaPortal()},
"nuovo-regolamento-fgci-rigori-tempo:0":function(){return activateFgciDirectMatchRule('penalty-lottery')},
"nuovo-regolamento-fgci-rigori-tempo:1":function(){return activateFgciDirectMatchRule('effective-time')}
 })
});
const SEASON_EVENT_HANDLER_IDS=Object.freeze({
 autoApply:Object.freeze(Object.keys(SEASON_EVENT_HANDLERS.autoApply)),
 available:Object.freeze(Object.keys(SEASON_EVENT_HANDLERS.available)),
 title:Object.freeze(Object.keys(SEASON_EVENT_HANDLERS.title)),
 describe:Object.freeze(Object.keys(SEASON_EVENT_HANDLERS.describe)),
 createContext:Object.freeze(Object.keys(SEASON_EVENT_HANDLERS.createContext)),
 choiceApply:Object.freeze(Object.keys(SEASON_EVENT_HANDLERS.choiceApply))
});
