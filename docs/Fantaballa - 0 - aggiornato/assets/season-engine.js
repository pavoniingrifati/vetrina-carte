const SEASON_CONFIG=window.FANTABALLA_SEASON_CONFIG;
if(!SEASON_CONFIG)throw new Error('Configurazione stagione mancante. Caricare il file season-config prima di season-engine.js.');
const DEFAULT_TEAM_NAME=String(SEASON_CONFIG.user.defaultTeamName||'Fantaballa FC');
const DEFAULT_FRESH_USER_CLUB_ID=String(SEASON_CONFIG.user.freshClubId||'fantaballa-fc');
const DEFAULT_NORMALIZED_USER_CLUB_ID=String(SEASON_CONFIG.user.normalizedClubFallback||'fantaballa-fc');
const EXCLUDED_AUTO_EVENT_TITLES=new Set(SEASON_CONFIG.events?.excludedAutoEventTitles||[]);
const EXCLUDED_DECISION_IDS=new Set(SEASON_CONFIG.events?.excludedDecisionIds||[]);
const CURRENT_STATE_VERSION=44;
const SAVE_BASE=SEASON_CONFIG.storage.saveBase;
const AUTO_SAVE_KEY=`${SAVE_BASE}_autosave`;
const LEGACY_SAVE_KEYS=[...(SEASON_CONFIG.storage.legacySaveKeys||[])];
const ACTIVE_SLOT_KEY=SEASON_CONFIG.storage.activeSlotKey;
const SETUP_TEAM_NAME_KEY=SEASON_CONFIG.storage.teamNameKey;
const SETUP_COACH_NAME_KEY=SEASON_CONFIG.storage.coachNameKey;
const SETUP_COACH_TYPE_KEY=SETUP_COACH_NAME_KEY+'_type';
const SETUP_PALETTE_KEY=SEASON_CONFIG.storage.paletteKey;
let startupNotice='';
let dataDiagnostics={fatal:[],warnings:[]};
const legacyActiveSlot=Math.max(1,Math.min(3,Number(localStorage.getItem(ACTIVE_SLOT_KEY))||1));
const activeSaveSlot=1;
function saveKey(){return AUTO_SAVE_KEY}
function legacySlotKey(slot){return `${SAVE_BASE}_slot_${slot}`}
function cleanupLegacySaveArtifacts(){
 try{
  for(let slot=1;slot<=3;slot++){localStorage.removeItem(legacySlotKey(slot));localStorage.removeItem(`${legacySlotKey(slot)}_backup`)}
  localStorage.removeItem(ACTIVE_SLOT_KEY);
  LEGACY_SAVE_KEYS.forEach(key=>localStorage.removeItem(key));
 }catch(error){console.warn('Pulizia vecchi salvataggi non riuscita',error)}
}
const VICTORY_ENDPOINT='https://script.google.com/macros/s/AKfycbwadjpez_e-IXMLupqpISLEZ3rrHhrtF9gk_E9v9HB_YcgkXUneOnrW7iYAdGjqz3_G/exec';
const USER_ID=SEASON_CONFIG.user.teamId;

function achievementModeLabel(){return location.pathname.includes('campionato-real')?'fantacampionato':'campionato'}
function achievementCareerId(){return `${achievementModeLabel()}|${String(state?.meta?.createdAt||state?.meta?.submissionCode||'carriera')}`}
function achievementContext(extra={}){return{mode:achievementModeLabel(),teamName:String(state?.teamName||''),coachName:String(state?.coachName||''),season:1,matchday:Number(state?.matchday)||0,...extra}}
function unlockAchievement(id,extra={}){return Boolean(window.FantaballaAchievements?.unlock?.(id,achievementContext(extra)))}
function addAchievementProgress(id,amount=1,extra={}){return window.FantaballaAchievements?.addProgress?.(id,amount,achievementContext(extra))||0}
function setAchievementCareerFlag(key,value=true){return window.FantaballaAchievements?.setCareerFlag?.(achievementCareerId(),key,value)}
function getAchievementCareerFlag(key){return window.FantaballaAchievements?.getCareerFlag?.(achievementCareerId(),key)}
function clearAchievementCareerFlag(key){return window.FantaballaAchievements?.clearCareerFlag?.(achievementCareerId(),key)}
function achievementFantaballopoliOpeningAccepted(){
 const story=fantaballopoliState();
 return Boolean(getAchievementCareerFlag('fantaballopoliOpeningAccepted')||story.forcedLossPending||story.targetPlayerId||story.giudaId||story.corruptionFull||story.investigatorShown||['forced_loss_pending','part2_waiting','awaiting_midseason','curse','satisfaction_waiting','corruption','investigator_waiting','accusation','juventus_final','restart_message','confessed','ended_denial_no_title'].includes(String(story.stage||'')));
}
function achievementFantaballopoliBetrayal(){
 const story=fantaballopoliState();
 return Boolean(getAchievementCareerFlag('fantaballopoliGiudaBetrayal')||story.giudaId||story.curseMatches>0||story.curseActive||story.corruptionFull);
}
function achievementFantaballopoliAcceptedAll(){
 const story=fantaballopoliState(),opening=achievementFantaballopoliOpeningAccepted(),trade=Boolean(getAchievementCareerFlag('fantaballopoliTradeComplied')||story.giudaId),more=Boolean(getAchievementCareerFlag('fantaballopoliAcceptedMore')||story.corruptionFull||story.investigatorShown||['corruption','investigator_waiting','accusation','juventus_final','restart_message','confessed','ended_denial_no_title'].includes(String(story.stage||'')));
 return opening&&trade&&more;
}
function achievementFantaballopoliUsedAdvantages(matches=[]){
 const story=fantaballopoliState();
 const matchAdvantage=(Array.isArray(matches)?matches:[]).some(match=>Boolean(match?.fantaballopoliForcedWin||match?.fantaballopoliNegativeGoals||(Array.isArray(match?.fantaballopoliExpulsions)&&match.fantaballopoliExpulsions.length)||(Array.isArray(match?.fantaballopoliInjuries)&&match.fantaballopoliInjuries.length)));
 return Boolean(matchAdvantage||story.finale?.pointsApplied);
}
function syncFantaballopoliAchievements(){
 const story=fantaballopoliState(),stage=String(story.stage||'');
 const started=!['','idle','inactive','waiting'].includes(stage);
 if(started)unlockAchievement('benvenuti-a-fantaballopoli');
 if(stage==='rejected'||getAchievementCareerFlag('fantaballopoliOpeningRejected'))unlockAchievement('mani-pulite');
 if(achievementFantaballopoliBetrayal())unlockAchievement('giuda');
 if(achievementFantaballopoliAcceptedAll())unlockAchievement('dentro-fino-al-collo');
 if(story.investigatorShown||getAchievementCareerFlag('fantaballopoliInvestigatorReached')||['investigator_waiting','accusation','juventus_final','restart_message','confessed','ended_denial_no_title'].includes(stage))unlockAchievement('intercettazioni');
}
function achievementGoalValue(event){return Math.max(1,Number(event?.goalValue)||1)}
function achievementWasRemuntada(userGoals=[],opponentGoals=[],gf=0,ga=0){
 if(Number(gf)<=Number(ga))return false;
 const timeline=[
  ...(Array.isArray(userGoals)?userGoals:[]).map((event,index)=>({minute:Number(event?.minute)||0,order:index,delta:achievementGoalValue(event)})),
  ...(Array.isArray(opponentGoals)?opponentGoals:[]).map((event,index)=>({minute:Number(event?.minute)||0,order:index,delta:-achievementGoalValue(event)}))
 ].sort((a,b)=>a.minute-b.minute||(a.delta-b.delta)||a.order-b.order);
 let difference=0,trailedByTwo=false;
 timeline.forEach(event=>{difference+=event.delta;if(difference<=-2)trailedByTwo=true});
 return trailedByTwo;
}
function achievementHasLateWinningGoal(userGoals=[],opponentGoals=[],gf=0,ga=0,duration=90){
 if(Number(gf)<=Number(ga))return false;
 const finalMinute=Math.max(1,Number(duration)||90),lateFrom=Math.max(1,finalMinute-10);
 const timeline=[
  ...(Array.isArray(userGoals)?userGoals:[]).map((event,index)=>({minute:Number(event?.minute)||0,order:index,user:true,delta:achievementGoalValue(event)})),
  ...(Array.isArray(opponentGoals)?opponentGoals:[]).map((event,index)=>({minute:Number(event?.minute)||0,order:index,user:false,delta:-achievementGoalValue(event)}))
 ].sort((a,b)=>a.minute-b.minute||(a.delta-b.delta)||a.order-b.order);
 let difference=0;
 for(let index=0;index<timeline.length;index++){
  const event=timeline[index],before=difference;difference+=event.delta;
  if(!event.user||event.minute<lateFrom||before>0||difference<=0)continue;
  let laterDifference=difference,staysAhead=true;
  for(let later=index+1;later<timeline.length;later++){laterDifference+=timeline[later].delta;if(laterDifference<=0){staysAhead=false;break}}
  if(staysAhead)return true;
 }
 return false;
}
function achievementHasLateEqualizer(userGoals=[],opponentGoals=[],gf=0,ga=0,duration=90){
 if(Number(gf)!==Number(ga))return false;
 const finalMinute=Math.max(1,Number(duration)||90),lateFrom=Math.max(1,finalMinute-10);
 const timeline=[
  ...(Array.isArray(userGoals)?userGoals:[]).map((event,index)=>({minute:Number(event?.minute)||0,order:index,user:true,delta:achievementGoalValue(event)})),
  ...(Array.isArray(opponentGoals)?opponentGoals:[]).map((event,index)=>({minute:Number(event?.minute)||0,order:index,user:false,delta:-achievementGoalValue(event)}))
 ].sort((a,b)=>a.minute-b.minute||a.order-b.order||(a.user?-1:1));
 let difference=0;
 for(const event of timeline){const before=difference;difference+=event.delta;if(event.user&&event.minute>=lateFrom&&before<0&&difference===0)return true}
 return false;
}
function achievementScorerCounts(goals=[]){
 const counts=new Map();
 (Array.isArray(goals)?goals:[]).forEach(event=>{const id=String(event?.playerId||'').trim(),name=String(event?.player||'Marcatore').trim().toLocaleLowerCase('it-IT'),key=id?`id:${id}`:`name:${name}`;counts.set(key,(counts.get(key)||0)+1)});
 return counts;
}
function achievementNaturalGoalkeeperScored(goals=[],lineup=[]){
 const players=new Map((Array.isArray(lineup)?lineup:[]).filter(entry=>entry?.player).map(entry=>[String(entry.playerId||entry.player?.id||''),entry.player]));
 return (Array.isArray(goals)?goals:[]).some(event=>{const player=players.get(String(event?.playerId||''))||playerById(event?.playerId);return player&&roleOf(player)==='P'});
}
function achievementGalacticosLineup(rows=[]){
 const starters=(Array.isArray(rows)?rows:[]).filter(row=>Number.isFinite(Number(row?.finalOvr))).slice(0,11);
 return starters.length===11&&starters.every(row=>Number(row.finalOvr)>=90);
}
function achievementBeatPreviousTeam(result={}){
 const previousId=String(getAchievementCareerFlag('previousControlledTeamId')||''),previousName=String(getAchievementCareerFlag('previousControlledTeamName')||curvaContestState().switchedFromTeamName||'').trim().toLocaleLowerCase('it-IT');
 const opponentId=String(result?.opponentId||''),opponentName=String(result?.opponent||'').trim().toLocaleLowerCase('it-IT');
 return Boolean((previousId&&opponentId===previousId)||(previousName&&opponentName===previousName));
}
function achievementLineupHasOutOfRole(lineup=[]){
 return (Array.isArray(lineup)?lineup:[]).some(entry=>entry?.player&&!isEmergencyYouthEntry(entry)&&!naturalCompatible(entry.player,String(entry.slot||'')));
}
function achievementLineupHasEmergencyGoalkeeper(lineup=[]){
 const goalkeeper=(Array.isArray(lineup)?lineup:[]).find(entry=>String(entry?.slot||'')==='P');
 return Boolean(goalkeeper&&(isEmergencyYouthEntry(goalkeeper)||!naturalCompatible(goalkeeper.player,'P')));
}
function achievementOutOfRoleCount(lineup=[]){
 return (Array.isArray(lineup)?lineup:[]).filter(entry=>entry?.player&&!isEmergencyYouthEntry(entry)&&!naturalCompatible(entry.player,String(entry.slot||''))).length;
}
function achievementBaseOvrInRangeCount(lineup=[],minimum=0,maximum=999){
 return (Array.isArray(lineup)?lineup:[]).filter(entry=>{
  if(!entry?.player||isEmergencyYouthEntry(entry))return false;
  const base=Number(originalBaseOvr(entry.player))||Number(entry.player.ovr)||0;
  return base>=Number(minimum)&&base<=Number(maximum);
 }).length;
}
function achievementAllUsedPlayersUnder76(matches=[]){
 const played=(Array.isArray(matches)?matches:[]).filter(match=>Array.isArray(match?.lineup)&&match.lineup.length);
 return played.length>0&&played.every(match=>match.lineup.every(entry=>{
  const base=Number(entry?.baseOvr)||Number(entry?.ovr)||0;
  return base>0&&base<76;
 }));
}
function achievementInitialRosterIds(){
 const stored=getAchievementCareerFlag('initialRosterIds');
 return Array.isArray(stored)?stored.map(String).filter(Boolean):[];
}
function ensureAchievementInitialRoster(){
 let ids=achievementInitialRosterIds();
 if(!ids.length){ids=currentUserPlayerIds().map(String);if(ids.length)setAchievementCareerFlag('initialRosterIds',ids)}
 return ids;
}
function achievementChangedAtLeastHalfRoster(){
 const initial=achievementInitialRosterIds(),current=new Set(currentUserPlayerIds().map(String));
 if(!initial.length)return false;
 const removed=initial.filter(id=>!current.has(String(id))).length;
 return removed>=Math.ceil(initial.length/2);
}
function achievementLineupReachedHundred(lineup=[]){
 const rows=(Array.isArray(lineup)?lineup:[]).filter(entry=>entry&&entry.player);
 return rows.some(entry=>Number(resolvedPlayerFinalOvr(entry,rows))>=100);
}
function achievementBallariniContribution(entry){
 const player=entry?.player;if(!player)return 0;const id=String(player.id||entry.playerId||'');let value=Math.max(0,Number(state.seasonRules?.ballariniPlayerBonus?.[id])||0);
 state.activeEffects.forEach(effect=>{const extra=Math.max(0,Number(effect?.sponsorExtra)||0);if(!extra)return;if(effect.type==='teamOvr')value+=extra;if(effect.type==='playerOvr'&&String(effect.playerId)===id)value+=extra;if(effect.type==='subscriberOvr'&&isSubscriber(player))value+=extra;if(effect.type==='goalkeeperOvr'&&roleOf(player)==='P')value+=extra});
 return value;
}
function achievementBallariniMadeHundred(lineup=[]){
 const rows=(Array.isArray(lineup)?lineup:[]).filter(entry=>entry&&entry.player);return rows.some(entry=>{const contribution=achievementBallariniContribution(entry),final=Number(resolvedPlayerFinalOvr(entry,rows))||0;return contribution>0&&final>=100&&final-contribution<100});
}
function checkPostMatchAchievements({gf=0,ga=0,userGoals=[],opponentGoals=[],varRandomResult=false,ductilityBoosts=[],lineup=[],lineupFinalOvrs=[],matchDuration=90}={}){
 ensureAchievementInitialRoster();
 const scored=Number(gf)||0,conceded=Number(ga)||0,won=scored>conceded,draw=scored===conceded,result=state.lastResult||{};
 if(state.history.length===1&&won)unlockAchievement('buona-la-prima');
 if(won&&scored-conceded>=5)unlockAchievement('cappotto');
 if(achievementWasRemuntada(userGoals,opponentGoals,scored,conceded))unlockAchievement('remuntada');
 if(won&&conceded===0)unlockAchievement('clin-shit');
 if(won&&scored+conceded>=8)unlockAchievement('partita-pazza');
 if(won&&scored===1&&conceded===0)unlockAchievement('corto-muso');
 if(won&&conceded>=4)unlockAchievement('difesa-allegra');
 if(draw&&scored>=3&&conceded>=3)unlockAchievement('pareggio-spettacolo');
 if(won&&Number(result.opponentPower)-Number(result.power)>=15)unlockAchievement('celtic-vs-barcelona');
 if(achievementHasLateWinningGoal(userGoals,opponentGoals,scored,conceded,matchDuration))unlockAchievement('lha-ripresa-vecino');
 if(won&&achievementLineupHasOutOfRole(lineup))unlockAchievement('ma-e-del-mestiere');
 if(won&&achievementLineupHasEmergencyGoalkeeper(lineup))unlockAchievement('senza-portiere');
 const finalOvrRows=Array.isArray(lineupFinalOvrs)?lineupFinalOvrs:[];
 if(finalOvrRows.some(row=>Number(row?.finalOvr)>=100)||achievementLineupReachedHundred(lineup))unlockAchievement('centenario');
 if(sponsorBallariniActive()&&(finalOvrRows.some(row=>Number(row?.ballariniContribution)>0&&Number(row?.finalOvr)>=100&&Number(row?.finalOvr)-Number(row?.ballariniContribution)<100)||achievementBallariniMadeHundred(lineup)))unlockAchievement('qualita-ballarini');
 if(sponsorFootballManagerActive()&&won){state.seasonRules.fmTacticianWins=Math.max(0,(Number(state.seasonRules.fmTacticianWins)||0)+1);if(state.seasonRules.fmTacticianWins>=10)unlockAchievement('database-umano')}
 const mysteryChain=mysteryCharacterChain();if(won&&mysteryChain.branch==='tearless'&&(Array.isArray(lineup)?lineup:[]).some(entry=>String(entry?.player?.id||entry?.playerId||'')===String(mysteryChain.playerId)&&Number(entry?.player?.ovr)>=150))unlockAchievement('tearless-supremacy');
 if(won&&scored-conceded>=7)unlockAchievement('esagerato');
 if(achievementHasLateEqualizer(userGoals,opponentGoals,scored,conceded,matchDuration))unlockAchievement('zona-cesarini');
 if(won&&Boolean(result?.ownRedCard))unlockAchievement('uno-in-meno-uno-in-piu');
 if(won&&Number(result.opponentPower)-Number(result.power)>=25)unlockAchievement('davide-estremo');
 if(won&&achievementBeatPreviousTeam(result))unlockAchievement('vendetta-perfetta');
 const scorerCounts=achievementScorerCounts(userGoals),bestPersonalGoals=Math.max(0,...scorerCounts.values());
 if(bestPersonalGoals>=3)unlockAchievement('il-pallone-e-mio');
 if(bestPersonalGoals>=5)unlockAchievement('manita-personale');
 if(won&&scorerCounts.size>=3)unlockAchievement('cooperativa-del-gol');
 if(achievementNaturalGoalkeeperScored(userGoals,lineup))unlockAchievement('portiere-goleador');
 if(won&&achievementGalacticosLineup(finalOvrRows))unlockAchievement('galacticos');
 if(won&&state.seasonRules.marottaDoubleWins&&String(result?.pointsNote||'').includes('Vittoria: +6 punti'))unlockAchievement('marotta-league');
 if(won&&scored===1&&conceded===0&&String(result?.pointsNote||'').includes('Vittoria: +9 punti'))unlockAchievement('ippica-italiana');
 if(won&&Boolean(result?.baseOvrOnlyActive))unlockAchievement('nessun-bonus-nessun-problema');
 if(won&&Number(state.seasonRules?.matchDuration)===30)unlockAchievement('trenta-minuti-bastano');
 if(won&&String(state.seasonRules?.userFormationOverride||state.formation)==='2-4-4')unlockAchievement('atakare');
 const redCardGoalValue=(Array.isArray(userGoals)?userGoals:[]).filter(goal=>goal?.isRedCardGoal).reduce((sum,goal)=>sum+achievementGoalValue(goal),0);
 if(won&&redCardGoalValue>0&&scored-redCardGoalValue<=conceded)unlockAchievement('rosso-vincente');
 if(state.seasonRules.pointsEqualGoals&&scored>=6&&Number(result?.pointsAwarded)>=6&&String(result?.pointsNote||'').includes('pari ai gol segnati'))unlockAchievement('i-punti-sono-davvero-i-gol');
 if(finalOvrRows.some(row=>Number(row?.voodooContribution)>=40&&Number(row?.finalOvr)>=100&&Number(row?.finalOvr)-Number(row?.voodooContribution)<100))unlockAchievement('vudu-terapeutico');
 if(coachIs('ductility')&&won)unlockAchievement('zero-intesa');
 if(coachIs('ductility')&&won&&achievementOutOfRoleCount(lineup)>=11)unlockAchievement('tutti-possono-tutto');
 if(coachIs('young-beautiful')&&won&&achievementBaseOvrInRangeCount(lineup,60,69)>=3)unlockAchievement('talento-grezzo');
 const outOfRoleGoals=(Array.isArray(ductilityBoosts)?ductilityBoosts:[]).reduce((sum,item)=>sum+Math.max(0,Number(item?.gain)||Number(item?.goals)||0),0);
 if(outOfRoleGoals>0)addAchievementProgress('fuori-dagli-schemi',outOfRoleGoals);
 if(coachIs('ductility')&&(Array.isArray(ductilityBoosts)?ductilityBoosts:[]).some(item=>Number(item?.total)>=5))unlockAchievement('fuori-ruolo-fuori-controllo');
 const generalStartedAt=Number(getAchievementCareerFlag('generalEventMatchday'));
 if(Number.isFinite(generalStartedAt)&&Number(state.matchday)>generalStartedAt){
  const streak=won?(Math.max(0,Number(getAchievementCareerFlag('generalWinStreak'))||0)+1):0;
  setAchievementCareerFlag('generalWinStreak',streak);
  if(streak>=5)unlockAchievement('sergente-di-ferro');
 }
 if(varRandomResult&&won)unlockAchievement('non-doveva-finire-cosi');
 if(result?.secretRefereeDeal?.discovered)unlockAchievement('arbitro-venduto');
 if(result?.curvaContestSuccess)unlockAchievement('scudetto-sotto-pressione');
 const parityFlag=getAchievementCareerFlag('parityReset');
 if(parityFlag&&Number(state.matchday)>Number(parityFlag.resetMatchday)){
  const rank=sortedTable().findIndex(row=>String(row.id)===String(USER_ID))+1;
  if(rank>0&&rank<=2){unlockAchievement('da-zero-alla-gloria');clearAchievementCareerFlag('parityReset')}
 }
}
function achievementLongestWinStreak(matches=[]){
 let current=0,best=0;
 (Array.isArray(matches)?matches:[]).forEach(match=>{if(Number(match?.gf)>Number(match?.ga)){current++;best=Math.max(best,current)}else current=0});
 return best;
}
function rememberFinalDayLeaderForAchievements(){
 if(Number(state.matchday)!==seasonLength()-1||getAchievementCareerFlag('finalDaySnapshot'))return;
 const table=sortedTable(),leader=table[0]||null,userRank=table.findIndex(row=>String(row.id)===String(USER_ID))+1,standing=userStanding();
 setAchievementCareerFlag('finalDaySnapshot',{matchday:Number(state.matchday)+1,userRank,leaderId:String(leader?.id||''),leaderName:String(leader?.name||''),leaderPoints:Number(leader?.pts)||0,userPoints:Number(standing?.pts)||0});
}
function checkSeasonAchievements(rank,eliminated=false){
 if(eliminated||Number(rank)<=0)return;
 const table=sortedTable(),allStandings=Object.values(state.standings||{}),standing=userStanding(),matches=Array.isArray(state.history)?state.history:[],cupWon=parallelCupState().winnerId===parallelCupUserId();
 const wonTitle=Number(rank)===1,runnerUp=table.find(row=>String(row.id)!==String(USER_ID)),otherStandings=allStandings.filter(row=>String(row?.id)!==String(USER_ID));
 const allWins=matches.length>0&&matches.every(match=>Number(match.gf)>Number(match.ga));
 if(wonTitle)unlockAchievement('campeones');
 if(wonTitle&&cupWon)unlockAchievement('double');
 if(matches.length&&matches.every(match=>Number(match.gf)>=Number(match.ga)))unlockAchievement('invincibili');
 if(Number(standing?.gf)>=100)unlockAchievement('attacco-atomico');
 if(wonTitle&&runnerUp&&Number(standing?.pts)-Number(runnerUp?.pts)<=1)unlockAchievement('fotofinish');
 if(wonTitle&&runnerUp&&Number(standing?.pts)-Number(runnerUp?.pts)>=10)unlockAchievement('dominio-totale');
 if(wonTitle&&Number(standing?.l)===0)unlockAchievement('campione-imbattuto');
 if(otherStandings.length&&otherStandings.every(row=>Number(standing?.gf)>Number(row?.gf)))unlockAchievement('miglior-attacco');
 if(otherStandings.length&&otherStandings.every(row=>Number(standing?.ga)<Number(row?.ga)))unlockAchievement('miglior-difesa');
 if(achievementLongestWinStreak(matches)>=10)unlockAchievement('rullo-compressore');
 const finalDaySnapshot=getAchievementCareerFlag('finalDaySnapshot');
 if(wonTitle&&finalDaySnapshot&&Number(finalDaySnapshot.userRank)>1&&String(finalDaySnapshot.leaderId)!==String(USER_ID))unlockAchievement('ultimo-respiro');
 if(wonTitle&&allWins&&matches.length===Number(standing?.p))unlockAchievement('campionato-perfetto');
 if(Number(standing?.pts)>=100)unlockAchievement('quota-cento');
 if(Number(standing?.gf)>=150)unlockAchievement('attacco-atomico-ii');
 if(matches.length&&Number(standing?.ga)<20)unlockAchievement('difesa-acciaio');
 if(wonTitle&&Number(standing?.pts)<=50)unlockAchievement('campione-al-minimo');
 if(wonTitle&&Number(standing?.gf)<=38)unlockAchievement('attacco-col-contagocce');
 if(wonTitle&&coachIs('young-beautiful'))unlockAchievement('giovani-promesse');
 if(wonTitle&&coachIs('young-beautiful')&&achievementAllUsedPlayersUnder76(matches))unlockAchievement('fascia-verde');
 if(wonTitle&&achievementChangedAtLeastHalfRoster())unlockAchievement('nessuno-indispensabile');
 if(sponsorFootballManagerActive()&&!state.seasonRules.fmInjuryOccurred)unlockAchievement('infermeria-vuota');
 if(wonTitle&&sponsorFootballManagerActive())unlockAchievement('manager-dell-anno');
 if(wonTitle&&cupWon&&sponsorBallariniActive())unlockAchievement('prodotto-premium');
 const mystery=mysteryCharacterChain(),mysteryCategories=mysteryPlayerLeadingBuckets(mystery.playerId),mysteryAppearances=Number(state.stats?.appearances?.[String(mystery.playerId)])||0;
 if(mystery.branch==='tearless'&&mysteryCategories.length)unlockAchievement('da-51-a-leggenda');
 if(wonTitle&&mystery.branch==='champion'&&mysteryAppearances>0)unlockAchievement('campione-del-mondo');
 if(mystery.branch==='champion'&&mysteryCategories.length>=2)unlockAchievement('eroe-nazionale');
 if(wonTitle&&mystery.finale?.won&&mystery.finale?.pointsApplied&&Number(mystery.finale.rankBeforeBonus)>1&&Number(mystery.finale.rankAfterBonus)===1)unlockAchievement('trenta-denari');
 syncFantaballopoliAchievements();
 const fantaballopoliStory=fantaballopoliState();
 if(wonTitle&&achievementFantaballopoliBetrayal())unlockAchievement('il-bacio-di-giuda');
 if(wonTitle&&(String(fantaballopoliStory.stage||'')==='rejected'||getAchievementCareerFlag('fantaballopoliOpeningRejected')))unlockAchievement('sistema-abbattuto');
 if(wonTitle&&achievementFantaballopoliUsedAdvantages(matches))unlockAchievement('scudetto-di-cartone');
 if(allRosterItalian())unlockAchievement('il-generale');
 const contest=curvaContestState();
 if(wonTitle&&contest.status==='lost'&&contest.switchedFromTeamName&&contest.switchedToTeamName)unlockAchievement('cambio-di-panchina');
 if(wonTitle&&Number(standing?.w)===0&&Number(standing?.gf)===0&&Number(standing?.ga)===0)unlockAchievement('zero-zero-zero');
}

const FORMATIONS={
 '4-3-3':['AS','ATT','AD','CC','CDC','CC','TS','DC','DC','TD','P'],
 '4-4-2':['ATT','ATT','AS','CC','CC','AD','TS','DC','DC','TD','P'],
 '4-2-3-1':['ATT','AS','COC','AD','CDC','CDC','TS','DC','DC','TD','P'],
 '4-5-1':['ATT','AS','COC','AD','CC','CC','TS','DC','DC','TD','P'],
 '3-5-2':['ATT','ATT','AS','COC','AD','CC','CDC','DC','DC','DC','P'],
 '5-3-2':['ATT','ATT','CC','CDC','CC','TS','DC','DC','DC','TD','P'],
 '3-4-3':['AS','ATT','AD','AS','CC','CC','AD','DC','DC','DC','P'],
 '4-3-1-2':['ATT','ATT','COC','CC','CDC','CC','TS','DC','DC','TD','P'],
 '2-4-4':['AS','ATT','ATT','AD','CC','CDC','COC','CC','DC','DC','P'],
 '4-4-4':['AS','ATT','ATT','AD','CC','CDC','COC','CC','TS','DC','DC','TD','P','P'],
 '3-3-3':['ATT','ATT','ATT','CC','CDC','CC','DC','DC','DC']
};

const FORMATION_LAYOUTS={
 '4-3-3':[['AS',18,17],['ATT',50,12],['AD',82,17],['CC',27,44],['CDC',50,55],['CC',73,44],['TS',12,68],['DC',32,78],['DC',68,78],['TD',88,68],['P',50,90]],
 '4-4-2':[['ATT',34,15],['ATT',66,15],['AS',13,42],['CC',36,51],['CC',64,51],['AD',87,42],['TS',12,68],['DC',32,78],['DC',68,78],['TD',88,68],['P',50,90]],
 '4-2-3-1':[['ATT',50,11],['AS',16,34],['COC',50,30],['AD',84,34],['CDC',35,54],['CDC',65,54],['TS',12,68],['DC',32,78],['DC',68,78],['TD',88,68],['P',50,90]],
 '4-5-1':[['ATT',50,11],['AS',13,35],['COC',50,30],['AD',87,35],['CC',34,53],['CC',66,53],['TS',12,68],['DC',32,78],['DC',68,78],['TD',88,68],['P',50,90]],
 '3-5-2':[['ATT',34,14],['ATT',66,14],['AS',12,39],['COC',50,31],['AD',88,39],['CC',32,55],['CDC',68,55],['DC',22,79],['DC',50,72],['DC',78,79],['P',50,90]],
 '5-3-2':[['ATT',34,14],['ATT',66,14],['CC',27,45],['CDC',50,52],['CC',73,45],['TS',11,61],['DC',27,79],['DC',50,72],['DC',73,79],['TD',89,61],['P',50,90]],
 '3-4-3':[['AS',18,17],['ATT',50,12],['AD',82,17],['AS',13,43],['CC',34,52],['CC',66,52],['AD',87,43],['DC',22,79],['DC',50,72],['DC',78,79],['P',50,90]],
 '4-3-1-2':[['ATT',34,13],['ATT',66,13],['COC',50,31],['CC',27,50],['CDC',50,58],['CC',73,50],['TS',12,68],['DC',32,78],['DC',68,78],['TD',88,68],['P',50,90]],
 '2-4-4':[['AS',12,16],['ATT',38,10],['ATT',62,10],['AD',88,16],['CC',16,48],['CDC',38,56],['COC',62,50],['CC',84,48],['DC',34,77],['DC',66,77],['P',50,91]],
 '4-4-4':[['AS',10,15],['ATT',36,9],['ATT',64,9],['AD',90,15],['CC',13,43],['CDC',38,52],['COC',62,49],['CC',87,43],['TS',8,69],['DC',31,78],['DC',69,78],['TD',92,69],['P',38,92],['P',62,92]],
 '3-3-3':[['ATT',18,15],['ATT',50,9],['ATT',82,15],['CC',20,48],['CDC',50,55],['CC',80,48],['DC',20,79],['DC',50,73],['DC',80,79]]
};

const TEAM_PALETTES=[
 {id:'fantaballa',name:'Fantaballa',primary:'#173A58',secondary:'#8F60C9',text:'#FFFFFF'},
 {id:'rossonera',name:'Rossonera',primary:'#B3122D',secondary:'#151515',text:'#FFFFFF'},
 {id:'nerazzurra',name:'Nerazzurra',primary:'#0756A5',secondary:'#111827',text:'#FFFFFF'},
 {id:'bianconera',name:'Bianconera',primary:'#171717',secondary:'#F3F4F6',text:'#FFFFFF'},
 {id:'giallorossa',name:'Giallorossa',primary:'#7C1727',secondary:'#F1B928',text:'#FFFFFF'},
 {id:'biancoceleste',name:'Biancoceleste',primary:'#4A9FD8',secondary:'#F7FAFC',text:'#10243A'},
 {id:'viola',name:'Viola',primary:'#5D2E8C',secondary:'#F4ECFA',text:'#FFFFFF'},
 {id:'granata',name:'Granata',primary:'#761C38',secondary:'#E6C79C',text:'#FFFFFF'},
 {id:'verdena',name:'Verde-nera',primary:'#13723D',secondary:'#111111',text:'#FFFFFF'},
 {id:'blugialla',name:'Blu-gialla',primary:'#174EA6',secondary:'#F4D03F',text:'#FFFFFF'},
 {id:'arancioblu',name:'Arancio-blu',primary:'#D85D16',secondary:'#173A61',text:'#FFFFFF'},
 {id:'rosanera',name:'Rosa-nera',primary:'#C83D89',secondary:'#171717',text:'#FFFFFF'}
];
function teamPalettePreset(id){return TEAM_PALETTES.find(item=>item.id===String(id))||TEAM_PALETTES[0]}
function teamColorsForPalette(id){const preset=teamPalettePreset(id);return{primary:preset.primary,secondary:preset.secondary,accent:preset.secondary,text:preset.text||'#FFFFFF'}}

const COACH_PROFILES=[
 {id:'anonymous',name:'Anonimo',icon:'🥷',image:'assets/coach-profiles/anonymous.png',tagline:'Cialtrone',pro:'Nessun effetto.',con:'Nessun effetto.'},
 {id:'talent-scout',name:'Talent scout',icon:'🔎',image:'assets/coach-profiles/talent-scout.png',tagline:'Occhio al talento',pro:'Un re-roll aggiuntivo nei draft, maggiore probabilità di trovare giocatori con OVR alto e primo pack garantito dalla squadra del giocatore con lo stesso nome dell’allenatore.',con:'Nessun nuovo giocatore può arrivare fuori dal draft iniziale e da quello di metà stagione.'},
 {id:'motivator',name:'Motivatore',icon:'📣',image:'assets/coach-profiles/motivator.png',tagline:'Qui si realizzano i sogni',pro:'Dopo 2 sconfitte consecutive, +3 OVR alla squadra nella partita seguente. Ogni nuovo bonus OVR o Intesa riceve anche +1 OVR e +1 Intesa aggiuntivi.',con:'Dopo 3 vittorie consecutive, -3 OVR alla squadra nella partita seguente.'},
 {id:'salvation',name:'Mister salvezza',icon:'🛟',image:'assets/coach-profiles/salvation.png',tagline:'Serenità.',pro:'Con OVR medio della rosa sotto 70, la squadra segna un gol aggiuntivo a partita.',con:'Con OVR medio della rosa sopra 80, la squadra subisce almeno un gol a partita.'},
 {id:'young-beautiful',name:'Giovani e belli',icon:'✨',image:'assets/coach-profiles/giovani-e-belli.webp',tagline:'La meglio gioventù',pro:'I giocatori con OVR base da 60 a 69 ricevono +20 Intesa. Quelli con OVR base da 70 a 75 ricevono +10 Intesa.',con:'Non puoi avere giocatori con OVR base pari o superiore a 85: non appaiono nei draft e ogni loro arrivo durante la stagione viene bloccato.'},
 {id:'ductility',name:'Duttilità',icon:'🔀',image:'assets/coach-profiles/duttilita.webp',tagline:'Tutti dappertutto',pro:'I giocatori possono essere schierati in qualsiasi ruolo senza malus. Ogni gol segnato da un giocatore schierato fuori ruolo gli assegna +1 OVR permanente fino a fine stagione.',con:'I giocatori non ricevono alcun bonus di Intesa e non possono ottenere altri potenziamenti positivi di OVR durante la stagione.'},
 {id:'three-five-two',name:'3-5-2',icon:'🧠',image:'assets/coach-profiles/tre-cinque-due.webp',tagline:'Una sola idea, quattordici uomini',pro:'Il primo club estratto nel draft genera automaticamente una rosa di 14 giocatori casuali. Gli undici titolari vengono scelti prima nei ruoli corretti del 3-5-2; se il club non li possiede, il gioco completa i ruoli con giocatori casuali.',con:'La probabilità degli eventi è dimezzata, puoi utilizzare soltanto il modulo 3-5-2 per tutta la stagione e non hai il draft di metà stagione.'}
];
function normalizeCoachType(value){const id=String(value||'anonymous');return COACH_PROFILES.some(profile=>profile.id===id)?id:'anonymous'}
function coachProfile(value=state?.coachType){return COACH_PROFILES.find(profile=>profile.id===normalizeCoachType(value))||COACH_PROFILES[0]}
function coachIs(value){return normalizeCoachType(state?.coachType)===String(value)}
function syncCoachRestrictions(){
 if(!state)return;
 state.seasonRules=state.seasonRules&&typeof state.seasonRules==='object'?state.seasonRules:{};
 if(coachIs('three-five-two')){state.formation='3-5-2';state.seasonRules.userFormationOverride='3-5-2'}
 else if(state.phase==='setup'&&state.seasonRules.userFormationOverride==='3-5-2')state.seasonRules.userFormationOverride='';
}
function coachEventChanceFactor(){return coachIs('three-five-two')?.5:1}
function youngBeautifulBaseOvr(player){return originalBaseOvr(player)}
function youngBeautifulChemistryBonus(player){if(!coachIs('young-beautiful')||!player)return 0;const base=youngBeautifulBaseOvr(player);return base>=60&&base<=69?20:base>=70&&base<=75?10:0}
function youngBeautifulAllowsPlayer(player){return !coachIs('young-beautiful')||youngBeautifulBaseOvr(player)<85}
function youngBeautifulBlockMessage(player){const name=String(player?.name||'Questo giocatore'),base=youngBeautifulBaseOvr(player);return `Giovani e belli: ${name} ha ${base} OVR base e non può entrare in rosa. Il limite massimo consentito è 84.`}
function initialDraftRerollLimit(value=state?.coachType){return normalizeCoachType(value)==='talent-scout'?4:3}
function talentScoutBlocksExternalArrival(){return coachIs('talent-scout')&&state?.phase==='season'}
function talentScoutBlockMessage(){return 'Talent scout: il contratto impedisce nuovi arrivi fuori dal draft iniziale e dal draft di metà stagione.'}
function coachHighOvrPick(pool){
 const list=(Array.isArray(pool)?pool:[]).filter(Boolean);if(!list.length)return null;if(!coachIs('talent-scout'))return pick(list);
 const sorted=[...list].sort((a,b)=>(Number(b?.ovr)||0)-(Number(a?.ovr)||0));
 const premium=sorted.slice(0,Math.max(1,Math.ceil(sorted.length*.38)));
 return Math.random()<.72?pick(premium):pick(sorted);
}
function coachHighOvrSample(pool,count=1){
 const source=[...(Array.isArray(pool)?pool:[])],out=[];while(source.length&&out.length<count){const chosen=coachHighOvrPick(source);if(!chosen)break;out.push(chosen);source.splice(source.indexOf(chosen),1)}return out;
}
function setupTeamBadge(name){const words=String(name||'FAN').trim().split(/\s+/).filter(Boolean);return (words.length>1?words.slice(0,3).map(word=>word[0]).join(''):words[0]?.slice(0,3)||'FAN').toUpperCase()}

const POSITION_ROLE={P:'P',DC:'D',TS:'D',TD:'D',CDC:'C',CC:'C',COC:'C',AS:'A',AD:'A',ATT:'A'};

const TEARLESS_EVENT_PLAYER={id:'mystery-tearless',name:'Tearless',role:'A',Position:'ATT',roleLabel:'Attaccante',nation:'Italia',ovr:51,baseOvr:51,subscriber:'no',abbonato:'no',club:'tearless-channel'};
const ITALIA_2006_EVENT_PLAYERS=[
 {id:'italia-2006-buffon',name:'Gianluigi Buffon',role:'P',Position:'P',roleLabel:'Portiere',nation:'Italia',ovr:99,baseOvr:99,club:'italia-2006'},
 {id:'italia-2006-peruzzi',name:'Angelo Peruzzi',role:'P',Position:'P',roleLabel:'Portiere',nation:'Italia',ovr:80,baseOvr:80,club:'italia-2006'},
 {id:'italia-2006-amelia',name:'Marco Amelia',role:'P',Position:'P',roleLabel:'Portiere',nation:'Italia',ovr:75,baseOvr:75,club:'italia-2006'},
 {id:'italia-2006-cannavaro',name:'Fabio Cannavaro',role:'D',Position:'DC',roleLabel:'Difensore',nation:'Italia',ovr:99,baseOvr:99,club:'italia-2006'},
 {id:'italia-2006-nesta',name:'Alessandro Nesta',role:'D',Position:'DC',roleLabel:'Difensore',nation:'Italia',ovr:97,baseOvr:97,club:'italia-2006'},
 {id:'italia-2006-materazzi',name:'Marco Materazzi',role:'D',Position:'DC',roleLabel:'Difensore',nation:'Italia',ovr:85,baseOvr:85,club:'italia-2006'},
 {id:'italia-2006-barzagli',name:'Andrea Barzagli',role:'D',Position:'DC',roleLabel:'Difensore',nation:'Italia',ovr:76,baseOvr:76,club:'italia-2006'},
 {id:'italia-2006-grosso',name:'Fabio Grosso',role:'D',Position:'TS',roleLabel:'Difensore',nation:'Italia',ovr:89,baseOvr:89,club:'italia-2006'},
 {id:'italia-2006-zambrotta',name:'Gianluca Zambrotta',role:'D',Position:'TD, TS',roleLabel:'Difensore',nation:'Italia',ovr:90,baseOvr:90,club:'italia-2006'},
 {id:'italia-2006-zaccardo',name:'Cristian Zaccardo',role:'D',Position:'TD, DC',roleLabel:'Difensore',nation:'Italia',ovr:76,baseOvr:76,club:'italia-2006'},
 {id:'italia-2006-oddo',name:'Massimo Oddo',role:'D',Position:'TD',roleLabel:'Difensore',nation:'Italia',ovr:80,baseOvr:80,club:'italia-2006'},
 {id:'italia-2006-pirlo',name:'Andrea Pirlo',role:'C',Position:'CC, CDC, COC',roleLabel:'Centrocampista',nation:'Italia',ovr:99,baseOvr:99,club:'italia-2006'},
 {id:'italia-2006-gattuso',name:'Gennaro Gattuso',role:'C',Position:'CDC, CC',roleLabel:'Centrocampista',nation:'Italia',ovr:99,baseOvr:99,club:'italia-2006'},
 {id:'italia-2006-de-rossi',name:'Daniele De Rossi',role:'C',Position:'CDC, CC',roleLabel:'Centrocampista',nation:'Italia',ovr:92,baseOvr:92,club:'italia-2006'},
 {id:'italia-2006-perrotta',name:'Simone Perrotta',role:'C',Position:'CC, COC',roleLabel:'Centrocampista',nation:'Italia',ovr:81,baseOvr:81,club:'italia-2006'},
 {id:'italia-2006-camoranesi',name:'Mauro German Camoranesi',role:'C',Position:'CC, COC',roleLabel:'Centrocampista',nation:'Italia',ovr:88,baseOvr:88,club:'italia-2006'},
 {id:'italia-2006-barone',name:'Simone Barone',role:'C',Position:'CC',roleLabel:'Centrocampista',nation:'Italia',ovr:75,baseOvr:75,club:'italia-2006'},
 {id:'italia-2006-totti',name:'Francesco Totti',role:'C',Position:'COC, ATT',roleLabel:'Centrocampista',nation:'Italia',ovr:99,baseOvr:99,club:'italia-2006'},
 {id:'italia-2006-toni',name:'Luca Toni',role:'A',Position:'ATT',roleLabel:'Attaccante',nation:'Italia',ovr:95,baseOvr:95,club:'italia-2006'},
 {id:'italia-2006-gilardino',name:'Alberto Gilardino',role:'A',Position:'ATT',roleLabel:'Attaccante',nation:'Italia',ovr:88,baseOvr:88,club:'italia-2006'},
 {id:'italia-2006-del-piero',name:'Alessandro Del Piero',role:'A',Position:'AS, ATT, COC',roleLabel:'Attaccante',nation:'Italia',ovr:99,baseOvr:99,club:'italia-2006'},
 {id:'italia-2006-inzaghi',name:'Filippo Inzaghi',role:'A',Position:'ATT',roleLabel:'Attaccante',nation:'Italia',ovr:99,baseOvr:99,club:'italia-2006'},
 {id:'italia-2006-iaquinta',name:'Vincenzo Iaquinta',role:'A',Position:'ATT, AD',roleLabel:'Attaccante',nation:'Italia',ovr:82,baseOvr:82,club:'italia-2006'}
];
const ITALIA_2006_FINAL_XI=['Gianluigi Buffon','Gianluca Zambrotta','Fabio Cannavaro','Alessandro Nesta','Fabio Grosso','Gennaro Gattuso','Andrea Pirlo','Daniele De Rossi','Francesco Totti','Luca Toni','Alessandro Del Piero'];

let PLAYERS=[];let CLASSIC_PLAYERS=[];let REAL_PLAYERS=[];let CLUBS=[];let OTHER_CLUBS=[];let COMMENTARY=null;let state=loadState()||freshState();let draftRolling=false;let mobileDraftTab='players';let lastPlacedDraftSlotId='';let lastPlacedDraftTimer=null;let setupIdentitySaveTimer=null;let seasonEventMinimized=false;let seasonEventUiKey='';
const screen=document.getElementById('screen'),modalRoot=document.getElementById('modalRoot'),toastEl=document.getElementById('toast');
function freshState(){return{version:CURRENT_STATE_VERSION,meta:{createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),autosave:true,submissionCode:'',submittedAt:''},phase:'setup',userClubId:DEFAULT_FRESH_USER_CLUB_ID,teamName:String(localStorage.getItem(SETUP_TEAM_NAME_KEY)||DEFAULT_TEAM_NAME),coachName:String(localStorage.getItem(SETUP_COACH_NAME_KEY)||''),coachType:normalizeCoachType(localStorage.getItem(SETUP_COACH_TYPE_KEY)||'anonymous'),formation:'4-3-3',gameMode:'normal',setupStep:1,teamPaletteId:String(localStorage.getItem(SETUP_PALETTE_KEY)||'fantaballa'),teamColors:teamColorsForPalette(String(localStorage.getItem(SETUP_PALETTE_KEY)||'fantaballa')),chaos:{lastPreparedMatchday:-1,totalDecisions:0,currentRound:null,latest:[],midseasonDone:false},draft:{roster:[],clubId:'',candidates:[],rerolls:3,pendingPlayerId:'',openingClubShown:false},leagueClubIds:[],teams:[],schedule:[],standings:{},matchday:0,history:[],statuses:{},playInjured:{},pendingEvent:null,seenDecisionEvents:[],activeEffects:[],seasonRules:{midseasonPickDelta:0,midseasonExtraRerolls:0,autoDecisions:false,autoMidseason:false,botMidseason:false,mandatoryMidseasonPlayerId:'',mandatoryMidseasonPlayerIds:[],equalOrBetterMidseasonPlayerIds:[],marottaDoubleWins:false,marottaLossPenalty:0,winPoints:3,drawPoints:1,seasonLength:38,marathon:false,matchDuration:90,longMatchRisk:false,deathMatchClubId:'',deathMatchClubName:'',deathMatchClubBonus:10,sixtyPointFear:false,sixtyPointFearTriggered:false,redCardGoals:false,pointsEqualGoals:false,yellowEqualsRed:false,pinkCardEndsMatch:false,federationGoalRule:'',figcCompetitionRule:'',fgicLeagueRule:'',bottomHelpRoundTeamIds:[],fgciPointsRule:'',fgciResultRule:'',fantaballaVideoRule:'',italiaCatenaccioRule:'',spaceJamRule:'',spaceJamTalentPending:false,spaceJamLastOutcome:'',frenchEventChoice:'',frenchFlyingKeeperId:'',frenchFlyingAttackerId:'',frenchFlyingAttackSlot:'',frenchLateAttackerBoostActive:false,frenchLateAttackerBoostCount:0,frenchLateAttackerBoosts:{},sponsorChoice:'',sponsorOvrExtra:0,sponsorOvrBoostCount:0,ballariniPlayerBonus:{},physioInjuryMultiplier:1,fmTacticianWins:0,fmInjuryOccurred:false,dynamicLeague:'',dynamicLeagueLabel:'',dynamicLeagueAppliedAt:-1,dynamicLeagueTeamIds:[],nonItalianChemZero:false,eventChanceMultiplier:1,leagueFormation:'',userFormationOverride:'',injuredOvrBonus:0,lateGoalsDouble:false,zeroZeroNoPoints:false,topPlayerAfterMandatoryId:'',guaranteedTopPlayerNextMidseason:false,coachTopSwapPlayerId:'',fantaguruBetterMidseason:false,autoOptimizeLineup:false,futureScorerPlayerId:'',futureScorerPlayerName:'',futureInjuryZeroPoints:false,futureInjuryPenaltyNotice:'',hungerGames:false,eliminatedTeamIds:[],generatedEventPlayers:[],laCurvaRewardActive:false,motivatorPermanentChemistry:{},ductilityScorerOvr:{},pendingParityReset:{active:false,parity:'',dueMatchday:-1,scheduledAt:-1,appliedMatchday:-1,lastResult:''},curvaContest:{active:false,mode:'',status:'idle',startedMatchday:-1,deadlineMatchday:-1,pendingTeamId:'',lastResult:'',switchedFromTeamName:'',switchedToTeamName:''},secretRefereeDeal:{active:false,choice:'',startedMatchday:-1,earnedPoints:0,matchesChecked:0,discovered:false,discoveredMatchday:-1,lastAdjustment:0}},quest:{active:false,id:'',title:'',status:'idle',acceptedMatchday:-1,matchesPlayed:0,progress:0,target:0,deadlineMatches:0,targetPlayerId:'',targetPlayerName:'',targetTeamIds:[],facedTeamIds:[],rewardActive:false,objective:'',reward:'',penalty:'',summary:'',notice:''},eventChains:{mentalista:{active:false,stage:0,playerId:'',playerName:'',originalOvr:0,dueMatchday:-1,training:false,nature:false,goals:0,completed:false},general:{active:false,stage:0,dueMatchday:-1,replacements:[],nationalBoostPending:false,completed:false},pinguino:{active:false,stage:0,dueMatchday:-1,mode:'',completed:false,wins:0,nonWins:0},mysteryCharacter:{active:false,stage:0,branch:'',playerId:'',playerName:'',dueMatchday:-1,completed:false,finale:{eligible:false,categories:[],played:false,userGoals:0,opponentGoals:0,won:false,pointsDelta:0,pointsApplied:false,rankBeforeBonus:0,rankAfterBonus:0,pointsBeforeBonus:0}}},analytics:{initialOvr:0,injuries:0,redCards:0,eventLog:[],biggestResult:null},stats:{goals:{},assists:{},appearances:{},cleanSheets:{},mvpVotes:{},mvpPoints:{},playerNames:{},playerTeams:{},playerTeamNames:{}},midseason:{step:0,target:2,outgoingId:'',mandatoryOutgoingId:'',mandatoryOutgoingIds:[],clubId:'',candidates:[],pendingCandidateId:'',drawsUsed:0,completed:false,auto:false,autoCompleted:false,changes:[]},cup:{status:'pending',qualifiedRank:0,currentCompetition:'',otherCompetition:'',participants:[],userParticipantId:'cup-user',userAlive:true,winnerId:'',rewardApplied:false,penaltyApplied:false,rewardType:'',penaltyType:'',notice:'',history:[],stages:[],pendingMatch:null,lastResult:null},story:{merit:{initialized:false,scheduled:false,triggerMatchday:-1,stage:'idle',playerId:'',playerName:'',recipientTeamId:'',recipientTeamName:'',promoted:false,guaranteedGoalPending:false,transferred:false,branch:'',postMidseasonShown:false,challenge:{active:false,status:'idle',attackerId:'',attackerName:'',matchesPlayed:0,goals:0},ovrModifiers:{},finale:{eligible:false,opponent:'',nation:'',played:false,userGoals:0,opponentGoals:0,won:false,pointsDelta:0,pointsApplied:false}},fantaballopoli:{initialized:false,scheduled:false,triggerMatchday:-1,stage:'idle',forcedLossPending:false,targetPlayerId:'',targetPlayerName:'',targetRole:'',midseasonResolved:false,giudaId:'',curseActive:false,negativeOvrAllowed:false,curseMatches:0,satisfactionAfter:0,corruptionFull:false,corruptionMatchIndex:0,investigatorDueMatchday:0,investigatorShown:false,abruptEnd:false,completed:false,finale:{eligible:false,played:false,userGoals:0,opponentGoals:0,won:false,pointsApplied:false,rankBeforeBonus:0,rankAfterBonus:0,pointsBeforeBonus:0}},error404:{initialized:false,scheduled:false,stage:'idle',corrupted:false,technicianDueMatchday:-1,restartDueMatchday:-1,technicianShown:false,restartShown:false,antivirusInstalled:false,completed:false,restarted:false}},playoffs:{initialized:false,status:'idle',stageIndex:0,stageName:'',qualifiers:[],ties:[],history:[],championId:'',userQualified:false,userEliminated:false,lastStageResults:[]},lastResult:null,submitted:false};}
function parseStoredState(raw,key){
 if(!raw)return null;
 try{return JSON.parse(raw)}catch(error){
   try{localStorage.setItem(`${key}_corrotto_${Date.now()}`,raw);localStorage.removeItem(key)}catch{}
   startupNotice='Un salvataggio danneggiato è stato isolato. È stata avviata una nuova stagione.';
   console.error('Salvataggio non leggibile',error);
   return null;
 }
}
function loadState(){
 const direct=parseStoredState(localStorage.getItem(AUTO_SAVE_KEY),AUTO_SAVE_KEY);
 if(direct)return direct;
 const slotOrder=[legacyActiveSlot,1,2,3].filter((slot,index,array)=>array.indexOf(slot)===index);
 for(const slot of slotOrder){
   const key=legacySlotKey(slot),legacySlot=parseStoredState(localStorage.getItem(key),key);
   if(legacySlot){startupNotice='La stagione attiva è stata trasferita al nuovo salvataggio automatico unico.';return legacySlot}
 }
 for(const legacyKey of LEGACY_SAVE_KEYS){
   const legacy=parseStoredState(localStorage.getItem(legacyKey),legacyKey);
   if(legacy){startupNotice='Il vecchio salvataggio è stato trasferito al nuovo salvataggio automatico unico.';return legacy}
 }
 return null;
}
function save(){
 try{
   if(state?.draft?.roster?.length)enforceTipsterStarters();
   if(state?.seasonRules?.autoOptimizeLineup&&state?.draft?.roster?.length)optimizeLineupWithBench();
   const now=new Date().toISOString();
   state.version=CURRENT_STATE_VERSION;
   state.meta=state.meta&&typeof state.meta==='object'?state.meta:{};
   state.meta.createdAt=state.meta.createdAt||now;
   state.meta.updatedAt=now;
   state.meta.autosave=true;
   delete state.meta.saveSlot;
   localStorage.setItem(AUTO_SAVE_KEY,JSON.stringify(state));
   updateSaveStatus();
   return true;
 }catch(error){
   console.error('Salvataggio automatico non riuscito',error);
   try{toast('Salvataggio automatico non riuscito: spazio del browser insufficiente.')}catch{}
   return false;
 }
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}function pick(a){return a[Math.floor(Math.random()*a.length)]}function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function toast(msg){toastEl.textContent=msg;toastEl.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>toastEl.classList.remove('show'),2200)}
function phaseLabel(value){return({setup:'Impostazione',draft:'Draft iniziale',season:'Campionato',midseason:'Mercato di metà stagione',finished:'Stagione conclusa'})[value]||'Stagione'}
function updateSaveStatus(){
 const el=document.getElementById('saveStatus');if(!el)return;
 const phase=phaseLabel(state?.phase);
 const round=state?.phase==='season'?` · G${Math.min(seasonLength(),(Number(state.matchday)||0)+1)}`:'';
 el.textContent=`Salvataggio automatico · ${phase}${round}`;
 el.title='Il gioco salva automaticamente dopo ogni scelta e ogni partita';
}
function closeRobustModal(){modalRoot.innerHTML=''}
function openConfirm({title='Conferma',message='',confirmText='Conferma',cancelText='Annulla',danger=false}={}){
 return new Promise(resolve=>{
   modalRoot.innerHTML=`<div class="robust-modal-backdrop" role="presentation"><section class="robust-modal" role="dialog" aria-modal="true" aria-labelledby="robustConfirmTitle"><div class="robust-modal-head"><div><div class="label">Conferma operazione</div><h2 id="robustConfirmTitle">${esc(title)}</h2></div><button class="robust-close" id="robustConfirmClose" type="button" aria-label="Chiudi">×</button></div><p class="robust-modal-copy">${esc(message)}</p><div class="robust-actions"><button id="robustConfirmCancel" class="btn" type="button">${esc(cancelText)}</button><button id="robustConfirmOk" class="btn ${danger?'red':'primary'}" type="button">${esc(confirmText)}</button></div></section></div>`;
   const finish=value=>{closeRobustModal();resolve(value)};
   document.getElementById('robustConfirmClose').onclick=()=>finish(false);
   document.getElementById('robustConfirmCancel').onclick=()=>finish(false);
   document.getElementById('robustConfirmOk').onclick=()=>finish(true);
   modalRoot.querySelector('.robust-modal-backdrop').onclick=event=>{if(event.target===event.currentTarget)finish(false)};
   document.getElementById('robustConfirmOk').focus();
 });
}
function validateGameData(players,clubs){
 const fatal=[],warnings=[];
 if(!Array.isArray(players))fatal.push(`${SEASON_CONFIG.data.primaryPlayers} deve contenere un array.`);
 if(!Array.isArray(clubs))fatal.push(`${SEASON_CONFIG.data.primaryClubs} deve contenere un array.`);
 if(fatal.length)return{fatal,warnings};
 const clubIds=new Set(),playerIds=new Set();
 clubs.forEach((club,index)=>{
   const id=String(club?.id||'').trim();
   if(!id)fatal.push(`Club ${index+1}: id mancante.`);else if(clubIds.has(id))fatal.push(`ID club duplicato: ${id}.`);else clubIds.add(id);
   if(!String(club?.name||'').trim())fatal.push(`Club ${id||index+1}: nome mancante.`);
   const colors=club?.colorClub||club?.colors||{};
   ['primary','secondary'].forEach(key=>{if(!String(colors[key]||'').trim())warnings.push(`${club?.name||id}: colore ${key} mancante.`)});
 });
 players.forEach((player,index)=>{
   const id=String(player?.id??'').trim();
   if(!id)fatal.push(`Giocatore ${index+1}: id mancante.`);else if(playerIds.has(id))fatal.push(`ID giocatore duplicato: ${id}.`);else playerIds.add(id);
   if(!String(player?.name||'').trim())fatal.push(`Giocatore ${id||index+1}: nome mancante.`);
   if(!String(player?.Position||'').trim())fatal.push(`${player?.name||id}: Position mancante.`);
   const ovr=Number(player?.ovr);if(!Number.isFinite(ovr)||ovr<1||ovr>100)fatal.push(`${player?.name||id}: OVR non valido.`);
   const club=String(player?.club||'').trim();if(!clubIds.has(club))fatal.push(`${player?.name||id}: club “${club||'mancante'}” non presente in club.json.`);
 });
 const validation=SEASON_CONFIG.validation||{};
 if(clubs.length<Number(validation.minimumClubCount||20))fatal.push(String(validation.minimumClubMessage||'Sono presenti soltanto {count} club.').replace('{count}',clubs.length));
 if(Number.isFinite(Number(validation.expectedClubCount))&&clubs.length!==Number(validation.expectedClubCount))warnings.push(String(validation.expectedClubMessage||'Sono presenti {count} club.').replace('{count}',clubs.length));
 const clubsToValidate=validation.excludeClubId?clubs.filter(club=>String(club.id)!==String(validation.excludeClubId)):clubs;
 clubsToValidate.forEach(club=>{
   const roster=players.filter(player=>String(player.club)===String(club.id));
   const roles={P:0,D:0,C:0,A:0};roster.forEach(player=>roles[roleOf(player)]=(roles[roleOf(player)]||0)+1);
   const minimumRosterSize=Number(validation.minimumRosterSize||11),warningRosterUnder=Number(validation.warningRosterUnder||0);
   if(roster.length<minimumRosterSize)fatal.push(`${club.name}: soltanto ${roster.length} giocatori.`);
   else if(warningRosterUnder&&roster.length<warningRosterUnder)warnings.push(`${club.name}: rosa corta (${roster.length} giocatori); in caso di molte assenze verranno usati i valori di riserva.`);
   if(!roles.P)fatal.push(`${club.name}: nessun portiere.`);
   if(roles.D<4||roles.C<3||roles.A<2)warnings.push(`${club.name}: distribuzione ruoli fragile (P ${roles.P}, D ${roles.D}, C ${roles.C}, A ${roles.A}).`);
 });
 return{fatal,warnings};
}
async function fetchJsonResource(url,label,{optional=false}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
   const response=await fetch(url,{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error(`${label}: risposta HTTP ${response.status}`);
   const raw=await response.text();
   try{return JSON.parse(raw)}catch{throw Error(`${label}: il file non contiene JSON valido`)}
 }catch(error){if(optional)return null;throw error}finally{clearTimeout(timer)}
}
function showBootError(error){
 screen.innerHTML=`<section class="panel robust-error"><div class="label">Controllo sicurezza</div><h2>Impossibile aprire il Campionato</h2><p>Il salvataggio non è stato cancellato. Correggi i file indicati e riprova.</p><div class="robust-error-detail">${esc(error?.message||error)}</div><div class="top-actions" style="margin-top:14px"><button class="btn primary" id="retryBootBtn" type="button">Riprova</button><a class="btn" href="index.html">Torna al menu</a></div></section>`;
 const retry=document.getElementById('retryBootBtn');if(retry)retry.onclick=()=>location.reload();
}

function positions(p){return String(p.Position||p.position||p.role||'').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean)}
function naturalCompatible(p,code){return positions(p).includes(code)}
function compatible(p,code){return naturalCompatible(p,code)}
function userCompatible(p,code){return coachIs('ductility')||naturalCompatible(p,code)}
function roleOf(p){return p.role||POSITION_ROLE[positions(p)[0]]||'C'}
const DRAFT_ROLE_ORDER={P:0,D:1,C:2,A:3};
const DRAFT_POSITION_ORDER=['P','DC','TS','TD','DC/TS','DC/TD','TS/TD','CDC','CC','COC','CC/CDC','CC/COC','ATT','AS','AD','AS/ATT','AD/ATT','ATT/COC','AS/COC','AD/COC'];
function comparePlayersByRole(a,b){
 const roleDiff=(DRAFT_ROLE_ORDER[roleOf(a)]??9)-(DRAFT_ROLE_ORDER[roleOf(b)]??9);
 if(roleDiff)return roleDiff;
 const aPosition=String(a?.Position||positions(a).join('/')||'').toUpperCase();
 const bPosition=String(b?.Position||positions(b).join('/')||'').toUpperCase();
 const positionDiff=(DRAFT_POSITION_ORDER.indexOf(aPosition)<0?99:DRAFT_POSITION_ORDER.indexOf(aPosition))-(DRAFT_POSITION_ORDER.indexOf(bPosition)<0?99:DRAFT_POSITION_ORDER.indexOf(bPosition));
 if(positionDiff)return positionDiff;
 const ovrDiff=(Number(b?.ovr)||0)-(Number(a?.ovr)||0);
 if(ovrDiff)return ovrDiff;
 return String(a?.name||'').localeCompare(String(b?.name||''),'it',{sensitivity:'base'});
}
function sortPlayersByRole(players){return [...players].sort(comparePlayersByRole)}
function sortRosterEntriesByRole(entries){return [...entries].sort((a,b)=>comparePlayersByRole(a.player,b.player)||String(a.slot||'').localeCompare(String(b.slot||''),'it'))}
function playerById(id){return PLAYERS.find(p=>String(p.id)===String(id))||(Array.isArray(state?.seasonRules?.generatedEventPlayers)?state.seasonRules.generatedEventPlayers.find(p=>String(p.id)===String(id)):null)}
function clubById(id){return CLUBS.find(club=>String(club.id)===String(id))||null}
function activeUserClub(){const base=clubById(state.userClubId)||CLUBS[0]||SEASON_CONFIG.user.fallbackClub;const colors=normalizeClubColors(state?.teamColors||base.colorClub);return{...base,name:String(state?.teamName||base.name),shortName:setupTeamBadge(state?.teamName||base.shortName),colorClub:colors,colors}}
function normalizeClubColors(source={}){return{primary:source.primary||'#245786',secondary:source.secondary||'#10243A',accent:source.accent||'#FFE96C',text:source.text||'#FFFFFF'}}
function clubPalette(clubOrId){const club=typeof clubOrId==='string'?clubById(clubOrId):clubOrId;const colors=normalizeClubColors(club?.colorClub||club?.colors||{});return{a:colors.primary,b:colors.secondary,c:colors.accent,ink:colors.text,primary:colors.primary,secondary:colors.secondary,accent:colors.accent,text:colors.text}}
function teamPalette(team){if(!team)return clubPalette(activeUserClub());const configured=team.colors||clubById(team.clubId||team.id)?.colorClub;if(configured)return clubPalette({colorClub:configured});const legacy=nationPalette(team.name||'club');return{a:legacy.a,b:legacy.b,c:legacy.c,ink:legacy.ink,primary:legacy.a,secondary:legacy.b,accent:legacy.c,text:'#FFFFFF'}}
function teamCssVars(team){const pal=teamPalette(team);return `--team-primary:${pal.primary};--team-secondary:${pal.secondary};--team-accent:${pal.accent};--team-text:${pal.text}`}
function teamColorDot(team){return `<span class="team-color-dot" style="${teamCssVars(team)}" aria-hidden="true"></span>`}
function rosterEntry(id){return state.draft.roster.find(r=>String(r.playerId)===String(id))}
function rosterPlayers(){return state.draft.roster.map(r=>({...r,player:r.player||playerById(r.playerId)})).filter(r=>r.player)}
function avg(arr){return arr.length?arr.reduce((s,n)=>s+n,0)/arr.length:0}
function normalizeName(s){return String(s||'').trim().toLowerCase().replace(/[^a-z0-9à-ÿ]+/g,'')}
function statusOf(id){
 if(!state.statuses[id])state.statuses[id]={injury:0,suspension:0,seasonOut:false,seasonOutReason:''};
 const status=state.statuses[id];
 status.injury=Math.max(0,Number(status.injury)||0);
 status.suspension=Math.max(0,Number(status.suspension)||0);
 status.seasonOut=Boolean(status.seasonOut);
 status.seasonOutReason=String(status.seasonOutReason||'');
 return status;
}
function seasonLength(source=state){const configured=Math.max(1,Number(source?.seasonRules?.seasonLength)||38),scheduled=Array.isArray(source?.schedule)?source.schedule.length:0;return source?.seasonRules?.dynamicLeague?Math.max(configured,scheduled):Math.max(38,configured,scheduled)}
function remainingSeasonMatches(){return Math.max(1,seasonLength()-(Number(state.matchday)||0))}
const SEASON_LONG_EFFECT_SOURCES=new Set(['quest-like-a-bomber','quest-la-curva-penalty','quest-la-curva-reward','quest-ammazza-grandi','quest-ammazza-grandi-penalty','Controllo dei documenti','Generale cacciato','Ehi ma ti chiami come me','Sconfitta nella Coppa parallela','Vittoria della Coppa parallela']);
function effectLastsUntilSeasonEnd(effect={}){return Boolean(effect?.untilSeasonEnd||Number(effect?.rounds)>=9999||SEASON_LONG_EFFECT_SOURCES.has(String(effect?.source||'')))}
function normalizeActiveEffect(effect={}){const normalized={...effect,rounds:Math.max(1,Number(effect?.rounds)||1)};normalized.untilSeasonEnd=effectLastsUntilSeasonEnd(normalized);return normalized}
function normalizeActiveEffects(effects=[]){const normalized=(Array.isArray(effects)?effects:[]).filter(effect=>effect&&typeof effect==='object').map(normalizeActiveEffect);normalized.forEach((effect,index)=>{if(!effect.motivatorExtra||effect.untilSeasonEnd)return;const parent=normalized.slice(Math.max(0,index-2),index).reverse().find(candidate=>!candidate.motivatorExtra&&candidate.untilSeasonEnd&&Number(candidate.rounds)===Number(effect.rounds)&&String(candidate.playerId||'')===String(effect.playerId||''));if(parent)effect.untilSeasonEnd=true});return normalized}
function futureInjuryPenalty(playerName=''){
 if(!state.seasonRules?.futureInjuryZeroPoints)return false;
 const standing=userStanding();if(standing)standing.pts=0;
 const name=String(playerName||'Un tuo giocatore');
 state.seasonRules.futureInjuryPenaltyNotice=`${name} si è infortunato: per la regola del giocatore dal futuro i tuoi punti sono stati azzerati.`;
 return true;
}
function setOwnPlayerInjury(entry,rounds=1){
 if(!entry)return false;const player=entry.player||playerById(entry.playerId);if(!player)return false;
 if(parallelCupDisciplineImmunity()){const cup=parallelCupState();cup.notice=`Protezione Coppa: evitato l’infortunio di ${player.name}.`;return false;}
 if(state.activeEffects.some(effect=>effect.type==='injuryImmunity')){const q=questState();q.notice=`MilanLab ha evitato l’infortunio di ${player.name}.`;return false;}
 const adjustedRounds=failMilanLabForInjury(entry,rounds),status=statusOf(entry.playerId),before=Number(status.injury)||0;status.injury=Math.max(before,adjustedRounds);
 if(status.injury>before){if(sponsorFootballManagerActive())state.seasonRules.fmInjuryOccurred=true;futureInjuryPenalty(player.name)}
 return true;
}
function startingGoalkeeperEntry(){const starter=getStarterEntries().find(entry=>entry.slot==='P'||roleOf(entry.player)==='P');if(starter)return starter;if(state.formation==='3-3-3')return null;return rosterPlayers().find(entry=>roleOf(entry.player)==='P')||null}
function ruleOutForSeason(entry,reason=''){if(!entry)return 'Nessun giocatore disponibile.';const player=entry.player||playerById(entry.playerId);if(!player)return 'Nessun giocatore disponibile.';if(!setOwnPlayerInjury(entry,remainingSeasonMatches()))return `${player.name} è protetto e non può infortunarsi.`;const status=statusOf(entry.playerId);status.seasonOut=true;status.seasonOutReason=String(reason||'Fuori fino a fine stagione');delete state.playInjured[String(entry.playerId)];return `${player.name} è fuori per il resto della stagione.${state.seasonRules.futureInjuryZeroPoints?' I tuoi punti sono stati azzerati.':''}`}
function mandatoryMidseasonPlayerIds(source=state){
 const rules=source?.seasonRules||{};
 const mid=source?.midseason||{};
 const ids=[...(Array.isArray(mid.mandatoryOutgoingIds)?mid.mandatoryOutgoingIds:[]),mid.mandatoryOutgoingId,...(Array.isArray(rules.mandatoryMidseasonPlayerIds)?rules.mandatoryMidseasonPlayerIds:[]),rules.mandatoryMidseasonPlayerId].map(String).filter(Boolean);
 return [...new Set(ids)].filter(id=>source===state?Boolean(rosterEntry(id)):true);
}
function queueMandatoryMidseasonPlayer(id){
 const playerId=String(id||'');if(!playerId)return false;
 const current=mandatoryMidseasonPlayerIds();
 if(!current.includes(playerId))current.push(playerId);
 state.seasonRules.mandatoryMidseasonPlayerIds=current.slice(0,3);
 state.seasonRules.mandatoryMidseasonPlayerId=state.seasonRules.mandatoryMidseasonPlayerIds[0]||'';
 return true;
}
function equalOrBetterMidseasonPlayerIds(source=state){
 const rules=source?.seasonRules||{};
 return [...new Set((Array.isArray(rules.equalOrBetterMidseasonPlayerIds)?rules.equalOrBetterMidseasonPlayerIds:[]).map(String).filter(Boolean))];
}
function queueEqualOrBetterMidseasonPlayer(id){
 const playerId=String(id||'');if(!playerId)return false;
 queueMandatoryMidseasonPlayer(playerId);
 const ids=equalOrBetterMidseasonPlayerIds();if(!ids.includes(playerId))ids.push(playerId);
 state.seasonRules.equalOrBetterMidseasonPlayerIds=ids.slice(0,3);
 return true;
}
function requiresEqualOrBetterMidseason(id,source=state){return equalOrBetterMidseasonPlayerIds(source).includes(String(id||''))}
function clearMandatoryMidseasonPlayer(id){
 const playerId=String(id||'');
 const remaining=mandatoryMidseasonPlayerIds().filter(item=>item!==playerId);
 state.seasonRules.mandatoryMidseasonPlayerIds=remaining;
 state.seasonRules.mandatoryMidseasonPlayerId=remaining[0]||'';
 state.seasonRules.equalOrBetterMidseasonPlayerIds=equalOrBetterMidseasonPlayerIds().filter(item=>item!==playerId);
 if(state.midseason){state.midseason.mandatoryOutgoingIds=remaining;state.midseason.mandatoryOutgoingId=remaining[0]||'';}
}


function normalizeCampionatoState(input){
 const next=input&&typeof input==='object'?input:freshState();
 next.userClubId=String(next.userClubId||DEFAULT_NORMALIZED_USER_CLUB_ID);
 next.teamName=String(next.teamName||localStorage.getItem(SETUP_TEAM_NAME_KEY)||clubById(next.userClubId)?.name||DEFAULT_TEAM_NAME);
 next.coachName=String(next.coachName||localStorage.getItem(SETUP_COACH_NAME_KEY)||'');
 next.coachType=normalizeCoachType(next.coachType||localStorage.getItem(SETUP_COACH_TYPE_KEY)||'anonymous');
 next.gameMode=next.gameMode==='chaos'?'chaos':'normal';
 next.setupStep=clamp(Number(next.setupStep)||1,1,4);
 const normalizedSetupPalette=teamPalettePreset(next.teamPaletteId||localStorage.getItem(SETUP_PALETTE_KEY)||'fantaballa');
 next.teamPaletteId=normalizedSetupPalette.id;
 const existingUserTeamColors=Array.isArray(next.teams)?next.teams.find(team=>String(team?.id)===String(USER_ID))?.colors:null;
 next.teamColors=normalizeClubColors(next.teamColors||existingUserTeamColors||clubById(next.userClubId)?.colorClub||teamColorsForPalette(normalizedSetupPalette.id));
 if(next.phase&&next.phase!=='setup')next.setupStep=4;
 next.chaos=next.chaos&&typeof next.chaos==='object'?next.chaos:{};
 next.chaos.lastPreparedMatchday=Number.isFinite(Number(next.chaos.lastPreparedMatchday))?Number(next.chaos.lastPreparedMatchday):-1;
 next.chaos.totalDecisions=Math.max(0,Number(next.chaos.totalDecisions)||0);
 next.chaos.currentRound=next.chaos.currentRound&&typeof next.chaos.currentRound==='object'?next.chaos.currentRound:null;
 next.chaos.latest=Array.isArray(next.chaos.latest)?next.chaos.latest:[];
 next.chaos.midseasonDone=Boolean(next.chaos.midseasonDone);
 if(!next.draft||typeof next.draft!=='object')next.draft=freshState().draft;
 next.draft.roster=Array.isArray(next.draft.roster)?next.draft.roster:[];
 const legacyDraftClubKey=String(next.draft.clubId||next.draft.nation||'');
 const migratedDraftClub=clubById(legacyDraftClubKey)||CLUBS.find(club=>normalizeName(club.name)===normalizeName(legacyDraftClubKey))||null;
 next.draft.clubId=migratedDraftClub?String(migratedDraftClub.id):'';
 next.draft.nation='';
 next.draft.candidates=Array.isArray(next.draft.candidates)?next.draft.candidates.map(String):[];
 if(!next.draft.clubId)next.draft.candidates=[];
 next.draft.pendingPlayerId=String(next.draft.pendingPlayerId||'');
 next.draft.openingClubShown=Boolean(next.draft.openingClubShown||next.draft.roster.length||next.draft.clubId);
 const coachDraftLimit=initialDraftRerollLimit(next.coachType);
 next.draft.rerolls=Math.max(0,Math.min(coachDraftLimit,Number.isFinite(Number(next.draft.rerolls))?Number(next.draft.rerolls):coachDraftLimit));
 if(next.coachType==='talent-scout'&&next.phase==='draft'&&!next.draft.roster.length&&!next.draft.clubId&&next.draft.rerolls===3)next.draft.rerolls=4;
 const layouts=formationSlots(next.formation||'4-3-3');
 const used=new Set();
 next.draft.roster.forEach((entry,index)=>{
   entry.playerId=String(entry.playerId||entry.player?.id||'');
   entry.bench=Boolean(entry.bench||String(entry.slot||'').startsWith('PAN'));
   if(entry.bench){entry.slot=entry.slot||`PAN${Math.min(3,index+1)}`;entry.slotId=entry.slotId||`bench-${String(entry.slot).replace(/\D/g,'')||1}`;return}
   let found=layouts.find(slot=>slot.instanceId===entry.slotId&&!used.has(slot.instanceId));
   if(!found)found=layouts.find(slot=>slot.code===entry.slot&&!used.has(slot.instanceId));
   if(!found)found=layouts.find(slot=>!used.has(slot.instanceId));
   if(found){entry.slotId=found.instanceId;entry.slot=found.code;used.add(found.instanceId)}
 });
 next.activeEffects=normalizeActiveEffects(next.activeEffects);
 next.seenDecisionEvents=Array.isArray(next.seenDecisionEvents)?[...new Set(next.seenDecisionEvents.map(String))]:[];
 next.statuses=next.statuses&&typeof next.statuses==='object'?next.statuses:{};
 Object.values(next.statuses).forEach(status=>{if(!status||typeof status!=='object')return;status.injury=Math.max(0,Number(status.injury)||0);status.suspension=Math.max(0,Number(status.suspension)||0);status.seasonOut=Boolean(status.seasonOut);status.seasonOutReason=String(status.seasonOutReason||'');});
 next.playInjured=next.playInjured&&typeof next.playInjured==='object'?next.playInjured:{};
 next.analytics=next.analytics&&typeof next.analytics==='object'?next.analytics:{};
 next.analytics.initialOvr=Math.max(0,Number(next.analytics.initialOvr)||0);
 next.analytics.injuries=Math.max(0,Number(next.analytics.injuries)||0);
 next.analytics.redCards=Math.max(0,Number(next.analytics.redCards)||0);
 next.analytics.eventLog=Array.isArray(next.analytics.eventLog)?next.analytics.eventLog:[];
 next.analytics.biggestResult=next.analytics.biggestResult&&typeof next.analytics.biggestResult==='object'?next.analytics.biggestResult:null;
 if(!next.analytics.initialOvr&&next.draft.roster.length){const initialStarters=next.draft.roster.filter(entry=>!entry.bench),values=initialStarters.map(entry=>Number(entry.player?.ovr)||Number(PLAYERS.find(player=>String(player.id)===String(entry.playerId))?.ovr)||0).filter(Boolean);if(values.length)next.analytics.initialOvr=Math.round((values.reduce((sum,value)=>sum+value,0)/values.length)*10)/10;}
 next.seasonRules=next.seasonRules&&typeof next.seasonRules==='object'?next.seasonRules:{};
 next.seasonRules.midseasonPickDelta=clamp(Number(next.seasonRules.midseasonPickDelta)||0,-1,1);
 next.seasonRules.midseasonExtraRerolls=clamp(Number(next.seasonRules.midseasonExtraRerolls)||0,0,3);
 next.seasonRules.autoDecisions=Boolean(next.seasonRules.autoDecisions);
 next.seasonRules.autoMidseason=Boolean(next.seasonRules.autoMidseason);
 next.seasonRules.botMidseason=Boolean(next.seasonRules.botMidseason);
 next.seasonRules.mandatoryMidseasonPlayerId=String(next.seasonRules.mandatoryMidseasonPlayerId||'');
 next.seasonRules.mandatoryMidseasonPlayerIds=[...new Set([...(Array.isArray(next.seasonRules.mandatoryMidseasonPlayerIds)?next.seasonRules.mandatoryMidseasonPlayerIds:[]),next.seasonRules.mandatoryMidseasonPlayerId].map(String).filter(Boolean))].slice(0,3);
 next.seasonRules.mandatoryMidseasonPlayerId=next.seasonRules.mandatoryMidseasonPlayerIds[0]||'';
 next.seasonRules.equalOrBetterMidseasonPlayerIds=[...new Set((Array.isArray(next.seasonRules.equalOrBetterMidseasonPlayerIds)?next.seasonRules.equalOrBetterMidseasonPlayerIds:[]).map(String).filter(id=>next.seasonRules.mandatoryMidseasonPlayerIds.includes(id)))].slice(0,3);
 next.seasonRules.marottaDoubleWins=Boolean(next.seasonRules.marottaDoubleWins);
 next.seasonRules.marottaLossPenalty=Math.max(0,Number(next.seasonRules.marottaLossPenalty)||0);
 next.seasonRules.winPoints=Number.isFinite(Number(next.seasonRules.winPoints))?Math.max(0,Number(next.seasonRules.winPoints)):3;
 next.seasonRules.drawPoints=Number.isFinite(Number(next.seasonRules.drawPoints))?Math.max(0,Number(next.seasonRules.drawPoints)):1;
 next.seasonRules.seasonLength=clamp(Math.floor(Number(next.seasonRules.seasonLength)||38),1,200);
 next.seasonRules.matchDuration=[30,90,120].includes(Number(next.seasonRules.matchDuration))?Number(next.seasonRules.matchDuration):90;
 next.seasonRules.longMatchRisk=Boolean(next.seasonRules.longMatchRisk);
 next.seasonRules.deathMatchClubId=String(next.seasonRules.deathMatchClubId||'');
 next.seasonRules.deathMatchClubName=String(next.seasonRules.deathMatchClubName||'');
 next.seasonRules.deathMatchClubBonus=Math.max(0,Number(next.seasonRules.deathMatchClubBonus)||10);
 next.seasonRules.sixtyPointFear=Boolean(next.seasonRules.sixtyPointFear);
 next.seasonRules.sixtyPointFearTriggered=Boolean(next.seasonRules.sixtyPointFearTriggered);
 next.seasonRules.redCardGoals=Boolean(next.seasonRules.redCardGoals);
 next.seasonRules.pointsEqualGoals=Boolean(next.seasonRules.pointsEqualGoals);
 next.seasonRules.yellowEqualsRed=Boolean(next.seasonRules.yellowEqualsRed);
 next.seasonRules.pinkCardEndsMatch=Boolean(next.seasonRules.pinkCardEndsMatch);
 next.seasonRules.federationGoalRule=['golden','last'].includes(String(next.seasonRules.federationGoalRule))?String(next.seasonRules.federationGoalRule):'';
 next.seasonRules.figcCompetitionRule=['formula-one','no-draw'].includes(String(next.seasonRules.figcCompetitionRule))?String(next.seasonRules.figcCompetitionRule):'';
 next.seasonRules.fgicLeagueRule=['playoffs','bottom-help'].includes(String(next.seasonRules.fgicLeagueRule))?String(next.seasonRules.fgicLeagueRule):'';
 next.seasonRules.bottomHelpRoundTeamIds=[...new Set((Array.isArray(next.seasonRules.bottomHelpRoundTeamIds)?next.seasonRules.bottomHelpRoundTeamIds:[]).map(String).filter(Boolean))];
 next.seasonRules.fgciPointsRule=['heavy-goals','clean-sheet'].includes(String(next.seasonRules.fgciPointsRule))?String(next.seasonRules.fgciPointsRule):'';
 next.seasonRules.fgciResultRule=['boredom-wins','all-in'].includes(String(next.seasonRules.fgciResultRule))?String(next.seasonRules.fgciResultRule):'';
 next.seasonRules.fantaballaVideoRule=['reverse-points','two-goals-to-win'].includes(String(next.seasonRules.fantaballaVideoRule))?String(next.seasonRules.fantaballaVideoRule):'';
 next.seasonRules.italiaCatenaccioRule=['allegri','goal-disgust'].includes(String(next.seasonRules.italiaCatenaccioRule))?String(next.seasonRules.italiaCatenaccioRule):'';
 next.seasonRules.spaceJamRule=['talent-steal','random-kickoff'].includes(String(next.seasonRules.spaceJamRule))?String(next.seasonRules.spaceJamRule):'';
 next.seasonRules.spaceJamTalentPending=Boolean(next.seasonRules.spaceJamTalentPending&&next.seasonRules.spaceJamRule==='talent-steal');
 next.seasonRules.spaceJamLastOutcome=String(next.seasonRules.spaceJamLastOutcome||'');
 next.seasonRules.frenchEventChoice=['flying-keeper','late-turn'].includes(String(next.seasonRules.frenchEventChoice))?String(next.seasonRules.frenchEventChoice):'';
 next.seasonRules.frenchFlyingKeeperId=String(next.seasonRules.frenchFlyingKeeperId||'');
 next.seasonRules.frenchFlyingAttackerId=String(next.seasonRules.frenchFlyingAttackerId||'');
 next.seasonRules.frenchFlyingAttackSlot=String(next.seasonRules.frenchFlyingAttackSlot||'');
 next.seasonRules.frenchLateAttackerBoostActive=Boolean(next.seasonRules.frenchLateAttackerBoostActive&&next.seasonRules.frenchEventChoice==='late-turn');
 next.seasonRules.frenchLateAttackerBoostCount=Math.max(0,Number(next.seasonRules.frenchLateAttackerBoostCount)||0);
 next.seasonRules.frenchLateAttackerBoosts=next.seasonRules.frenchLateAttackerBoosts&&typeof next.seasonRules.frenchLateAttackerBoosts==='object'?next.seasonRules.frenchLateAttackerBoosts:{};
 Object.keys(next.seasonRules.frenchLateAttackerBoosts).forEach(id=>{next.seasonRules.frenchLateAttackerBoosts[id]=Math.max(0,Number(next.seasonRules.frenchLateAttackerBoosts[id])||0)});
 next.seasonRules.sponsorChoice=['ballarini','football-manager'].includes(String(next.seasonRules.sponsorChoice))?String(next.seasonRules.sponsorChoice):'';
 next.seasonRules.sponsorOvrExtra=next.seasonRules.sponsorChoice==='ballarini'?5:0;
 next.seasonRules.sponsorOvrBoostCount=Math.max(0,Number(next.seasonRules.sponsorOvrBoostCount)||0);
 next.seasonRules.ballariniPlayerBonus=next.seasonRules.ballariniPlayerBonus&&typeof next.seasonRules.ballariniPlayerBonus==='object'?next.seasonRules.ballariniPlayerBonus:{};
 Object.keys(next.seasonRules.ballariniPlayerBonus).forEach(id=>{next.seasonRules.ballariniPlayerBonus[id]=Math.max(0,Number(next.seasonRules.ballariniPlayerBonus[id])||0)});
 next.seasonRules.physioInjuryMultiplier=next.seasonRules.sponsorChoice==='football-manager'?.5:1;
 next.seasonRules.fmTacticianWins=Math.max(0,Number(next.seasonRules.fmTacticianWins)||0);
 next.seasonRules.fmInjuryOccurred=Boolean(next.seasonRules.fmInjuryOccurred);
 next.seasonRules.dynamicLeague=['expanded','elite'].includes(String(next.seasonRules.dynamicLeague))?String(next.seasonRules.dynamicLeague):'';
 next.seasonRules.dynamicLeagueLabel=String(next.seasonRules.dynamicLeagueLabel||'');
 next.seasonRules.dynamicLeagueAppliedAt=Number.isFinite(Number(next.seasonRules.dynamicLeagueAppliedAt))?Number(next.seasonRules.dynamicLeagueAppliedAt):-1;
 const legacyMarathonRules=Number(next.seasonRules.winPoints)===1.5&&Number(next.seasonRules.drawPoints)===0&&next.seasonRules.pointsEqualGoals===false&&Number(next.seasonRules.seasonLength)>=76;
 next.seasonRules.marathon=Boolean(next.seasonRules.marathon||legacyMarathonRules);
 next.seasonRules.dynamicLeagueTeamIds=[...new Set((Array.isArray(next.seasonRules.dynamicLeagueTeamIds)?next.seasonRules.dynamicLeagueTeamIds:[]).map(String).filter(Boolean))];
 next.seasonRules.nonItalianChemZero=Boolean(next.seasonRules.nonItalianChemZero);
 next.seasonRules.eventChanceMultiplier=clamp(Number(next.seasonRules.eventChanceMultiplier)||1,1,2);
 next.seasonRules.leagueFormation=FORMATIONS[String(next.seasonRules.leagueFormation||'')]?String(next.seasonRules.leagueFormation):'';
 next.seasonRules.userFormationOverride=FORMATIONS[String(next.seasonRules.userFormationOverride||'')]?String(next.seasonRules.userFormationOverride):'';
 next.seasonRules.injuredOvrBonus=Math.max(0,Number(next.seasonRules.injuredOvrBonus)||0);
 next.seasonRules.lateGoalsDouble=Boolean(next.seasonRules.lateGoalsDouble);
 next.seasonRules.zeroZeroNoPoints=Boolean(next.seasonRules.zeroZeroNoPoints);
 next.seasonRules.topPlayerAfterMandatoryId=String(next.seasonRules.topPlayerAfterMandatoryId||'');
 next.seasonRules.guaranteedTopPlayerNextMidseason=Boolean(next.seasonRules.guaranteedTopPlayerNextMidseason);
 next.seasonRules.coachTopSwapPlayerId=String(next.seasonRules.coachTopSwapPlayerId||'');
 next.seasonRules.fantaguruBetterMidseason=Boolean(next.seasonRules.fantaguruBetterMidseason);
 next.seasonRules.autoOptimizeLineup=Boolean(next.seasonRules.autoOptimizeLineup);
 next.seasonRules.futureScorerPlayerId=String(next.seasonRules.futureScorerPlayerId||'');
 next.seasonRules.futureScorerPlayerName=String(next.seasonRules.futureScorerPlayerName||'');
 next.seasonRules.futureInjuryZeroPoints=Boolean(next.seasonRules.futureInjuryZeroPoints);
 next.seasonRules.futureInjuryPenaltyNotice=String(next.seasonRules.futureInjuryPenaltyNotice||'');
 next.seasonRules.hungerGames=Boolean(next.seasonRules.hungerGames);
 next.seasonRules.eliminatedTeamIds=[...new Set((Array.isArray(next.seasonRules.eliminatedTeamIds)?next.seasonRules.eliminatedTeamIds:[]).map(String).filter(Boolean))];
 next.seasonRules.generatedEventPlayers=Array.isArray(next.seasonRules.generatedEventPlayers)?next.seasonRules.generatedEventPlayers.filter(player=>player&&player.id).map(player=>({...player,id:String(player.id),ovr:Math.max(1,Number(player.ovr)||60)})):[];
 next.seasonRules.laCurvaRewardActive=Boolean(next.seasonRules.laCurvaRewardActive);
 next.seasonRules.motivatorPermanentChemistry=next.seasonRules.motivatorPermanentChemistry&&typeof next.seasonRules.motivatorPermanentChemistry==='object'?Object.fromEntries(Object.entries(next.seasonRules.motivatorPermanentChemistry).map(([id,value])=>[String(id),Math.max(0,Number(value)||0)]).filter(([,value])=>value>0)):{};
 next.seasonRules.ductilityScorerOvr=next.seasonRules.ductilityScorerOvr&&typeof next.seasonRules.ductilityScorerOvr==='object'?Object.fromEntries(Object.entries(next.seasonRules.ductilityScorerOvr).map(([id,value])=>[String(id),Math.max(0,Math.floor(Number(value)||0))]).filter(([,value])=>value>0)):{};
 const pendingParity=next.seasonRules.pendingParityReset&&typeof next.seasonRules.pendingParityReset==='object'?next.seasonRules.pendingParityReset:{};
 pendingParity.active=Boolean(pendingParity.active);
 pendingParity.parity=['even','odd'].includes(String(pendingParity.parity))?String(pendingParity.parity):'';
 pendingParity.dueMatchday=Number.isFinite(Number(pendingParity.dueMatchday))?Number(pendingParity.dueMatchday):-1;
 pendingParity.scheduledAt=Number.isFinite(Number(pendingParity.scheduledAt))?Number(pendingParity.scheduledAt):-1;
 pendingParity.appliedMatchday=Number.isFinite(Number(pendingParity.appliedMatchday))?Number(pendingParity.appliedMatchday):-1;
 pendingParity.lastResult=String(pendingParity.lastResult||'');
 if(!pendingParity.parity||pendingParity.dueMatchday<0)pendingParity.active=false;
 next.seasonRules.pendingParityReset=pendingParity;
 const curvaContest=next.seasonRules.curvaContest&&typeof next.seasonRules.curvaContest==='object'?next.seasonRules.curvaContest:{};
 curvaContest.active=Boolean(curvaContest.active);
 curvaContest.mode=['title','home','away'].includes(String(curvaContest.mode))?String(curvaContest.mode):'';
 curvaContest.status=['idle','active','won','lost','away'].includes(String(curvaContest.status))?String(curvaContest.status):'idle';
 curvaContest.startedMatchday=Number.isFinite(Number(curvaContest.startedMatchday))?Number(curvaContest.startedMatchday):-1;
 curvaContest.deadlineMatchday=Number.isFinite(Number(curvaContest.deadlineMatchday))?Number(curvaContest.deadlineMatchday):-1;
 curvaContest.pendingTeamId=String(curvaContest.pendingTeamId||'');
 curvaContest.lastResult=String(curvaContest.lastResult||'');
 curvaContest.switchedFromTeamName=String(curvaContest.switchedFromTeamName||'');
 curvaContest.switchedToTeamName=String(curvaContest.switchedToTeamName||'');
 if(!curvaContest.mode)curvaContest.active=false;
 next.seasonRules.curvaContest=curvaContest;
 const secretDeal=next.seasonRules.secretRefereeDeal&&typeof next.seasonRules.secretRefereeDeal==='object'?next.seasonRules.secretRefereeDeal:{};
 secretDeal.active=Boolean(secretDeal.active);
 secretDeal.choice=['accept','refuse'].includes(String(secretDeal.choice))?String(secretDeal.choice):'';
 secretDeal.startedMatchday=Number.isFinite(Number(secretDeal.startedMatchday))?Number(secretDeal.startedMatchday):-1;
 secretDeal.earnedPoints=Math.max(0,Number(secretDeal.earnedPoints)||0);
 secretDeal.matchesChecked=Math.max(0,Number(secretDeal.matchesChecked)||0);
 secretDeal.discovered=Boolean(secretDeal.discovered);
 secretDeal.discoveredMatchday=Number.isFinite(Number(secretDeal.discoveredMatchday))?Number(secretDeal.discoveredMatchday):-1;
 secretDeal.lastAdjustment=Number(secretDeal.lastAdjustment)||0;
 if(!secretDeal.choice)secretDeal.active=false;
 next.seasonRules.secretRefereeDeal=secretDeal;
 next.quest=next.quest&&typeof next.quest==='object'?next.quest:{};
 next.quest.active=Boolean(next.quest.active);next.quest.id=String(next.quest.id||'');next.quest.title=String(next.quest.title||'');next.quest.status=String(next.quest.status||'idle');next.quest.acceptedMatchday=Number.isFinite(Number(next.quest.acceptedMatchday))?Number(next.quest.acceptedMatchday):-1;next.quest.matchesPlayed=Math.max(0,Number(next.quest.matchesPlayed)||0);next.quest.progress=Math.max(0,Number(next.quest.progress)||0);next.quest.target=Math.max(0,Number(next.quest.target)||0);next.quest.deadlineMatches=Math.max(0,Number(next.quest.deadlineMatches)||0);next.quest.targetPlayerId=String(next.quest.targetPlayerId||'');next.quest.targetPlayerName=String(next.quest.targetPlayerName||'');next.quest.targetTeamIds=[...new Set((Array.isArray(next.quest.targetTeamIds)?next.quest.targetTeamIds:[]).map(String))];next.quest.facedTeamIds=[...new Set((Array.isArray(next.quest.facedTeamIds)?next.quest.facedTeamIds:[]).map(String))];next.quest.rewardActive=Boolean(next.quest.rewardActive);next.quest.objective=String(next.quest.objective||'');next.quest.reward=String(next.quest.reward||'');next.quest.penalty=String(next.quest.penalty||'');next.quest.summary=String(next.quest.summary||'');next.quest.notice=String(next.quest.notice||'');
 next.eventChains=next.eventChains&&typeof next.eventChains==='object'?next.eventChains:{};
 next.eventChains.mentalista=next.eventChains.mentalista&&typeof next.eventChains.mentalista==='object'?next.eventChains.mentalista:{};
 next.eventChains.mentalista.active=Boolean(next.eventChains.mentalista.active);
 next.eventChains.mentalista.stage=Math.max(0,Number(next.eventChains.mentalista.stage)||0);
 next.eventChains.mentalista.playerId=String(next.eventChains.mentalista.playerId||'');
 next.eventChains.mentalista.playerName=String(next.eventChains.mentalista.playerName||'');
 next.eventChains.mentalista.originalOvr=Math.max(1,Number(next.eventChains.mentalista.originalOvr)||1);
 next.eventChains.mentalista.dueMatchday=Number.isFinite(Number(next.eventChains.mentalista.dueMatchday))?Number(next.eventChains.mentalista.dueMatchday):-1;
 next.eventChains.mentalista.training=Boolean(next.eventChains.mentalista.training);
 next.eventChains.mentalista.nature=Boolean(next.eventChains.mentalista.nature);
 next.eventChains.mentalista.goals=Math.max(0,Number(next.eventChains.mentalista.goals)||0);
 next.eventChains.mentalista.completed=Boolean(next.eventChains.mentalista.completed);
 next.eventChains.general=next.eventChains.general&&typeof next.eventChains.general==='object'?next.eventChains.general:{};
 next.eventChains.general.active=Boolean(next.eventChains.general.active);
 next.eventChains.general.stage=Math.max(0,Number(next.eventChains.general.stage)||0);
 next.eventChains.general.dueMatchday=Number.isFinite(Number(next.eventChains.general.dueMatchday))?Number(next.eventChains.general.dueMatchday):-1;
 next.eventChains.general.replacements=Array.isArray(next.eventChains.general.replacements)?next.eventChains.general.replacements.filter(item=>item&&item.originalPlayer).map(item=>({...item,replacementId:String(item.replacementId||''),slotId:String(item.slotId||''),originalPlayer:{...item.originalPlayer,id:String(item.originalPlayer.id||'')}})):[];
 next.eventChains.general.nationalBoostPending=Boolean(next.eventChains.general.nationalBoostPending);
 next.eventChains.general.completed=Boolean(next.eventChains.general.completed);
 next.eventChains.pinguino=next.eventChains.pinguino&&typeof next.eventChains.pinguino==='object'?next.eventChains.pinguino:{};
 next.eventChains.pinguino.active=Boolean(next.eventChains.pinguino.active);
 next.eventChains.pinguino.stage=Math.max(0,Number(next.eventChains.pinguino.stage)||0);
 next.eventChains.pinguino.dueMatchday=Number.isFinite(Number(next.eventChains.pinguino.dueMatchday))?Number(next.eventChains.pinguino.dueMatchday):-1;
 next.eventChains.pinguino.mode=['ludopatia','tipster'].includes(String(next.eventChains.pinguino.mode))?String(next.eventChains.pinguino.mode):'';
 next.eventChains.pinguino.completed=Boolean(next.eventChains.pinguino.completed);
 next.eventChains.pinguino.wins=Math.max(0,Number(next.eventChains.pinguino.wins)||0);
 next.eventChains.pinguino.nonWins=Math.max(0,Number(next.eventChains.pinguino.nonWins)||0);

 next.eventChains.mysteryCharacter=next.eventChains.mysteryCharacter&&typeof next.eventChains.mysteryCharacter==='object'?next.eventChains.mysteryCharacter:{};
 const mysteryCharacterState=next.eventChains.mysteryCharacter;
 mysteryCharacterState.active=Boolean(mysteryCharacterState.active);
 mysteryCharacterState.stage=Math.max(0,Number(mysteryCharacterState.stage)||0);
 mysteryCharacterState.branch=['tearless','champion'].includes(String(mysteryCharacterState.branch))?String(mysteryCharacterState.branch):'';
 mysteryCharacterState.playerId=String(mysteryCharacterState.playerId||'');
 mysteryCharacterState.playerName=String(mysteryCharacterState.playerName||'');
 mysteryCharacterState.dueMatchday=Number.isFinite(Number(mysteryCharacterState.dueMatchday))?Number(mysteryCharacterState.dueMatchday):-1;
 mysteryCharacterState.completed=Boolean(mysteryCharacterState.completed);
 mysteryCharacterState.finale=mysteryCharacterState.finale&&typeof mysteryCharacterState.finale==='object'?mysteryCharacterState.finale:{};
 mysteryCharacterState.finale.eligible=Boolean(mysteryCharacterState.finale.eligible);
 mysteryCharacterState.finale.categories=[...new Set((Array.isArray(mysteryCharacterState.finale.categories)?mysteryCharacterState.finale.categories:[]).map(String).filter(Boolean))];
 mysteryCharacterState.finale.played=Boolean(mysteryCharacterState.finale.played);
 mysteryCharacterState.finale.userGoals=Math.max(0,Number(mysteryCharacterState.finale.userGoals)||0);
 mysteryCharacterState.finale.opponentGoals=Math.max(0,Number(mysteryCharacterState.finale.opponentGoals)||0);
 mysteryCharacterState.finale.won=Boolean(mysteryCharacterState.finale.won);
 mysteryCharacterState.finale.pointsDelta=Number(mysteryCharacterState.finale.pointsDelta)||0;
 mysteryCharacterState.finale.pointsApplied=Boolean(mysteryCharacterState.finale.pointsApplied);
 mysteryCharacterState.finale.rankBeforeBonus=Math.max(0,Number(mysteryCharacterState.finale.rankBeforeBonus)||0);
 mysteryCharacterState.finale.rankAfterBonus=Math.max(0,Number(mysteryCharacterState.finale.rankAfterBonus)||0);
 mysteryCharacterState.finale.pointsBeforeBonus=Number(mysteryCharacterState.finale.pointsBeforeBonus)||0;

 (Array.isArray(next.draft?.roster)?next.draft.roster:[]).forEach(entry=>{entry.tipsterForcedMatches=Math.max(0,Number(entry.tipsterForcedMatches)||0);entry.tipsterForced=entry.tipsterForcedMatches>0;});

 next.story=next.story&&typeof next.story==='object'?next.story:{};
 next.story.merit=next.story.merit&&typeof next.story.merit==='object'?next.story.merit:{};
 const meritStoryState=next.story.merit;
 meritStoryState.initialized=Boolean(meritStoryState.initialized);
 meritStoryState.scheduled=Boolean(meritStoryState.scheduled);
 meritStoryState.triggerMatchday=Number.isFinite(Number(meritStoryState.triggerMatchday))?clamp(Number(meritStoryState.triggerMatchday),1,18):-1;
 meritStoryState.stage=String(meritStoryState.stage||'idle');
 meritStoryState.playerId=String(meritStoryState.playerId||'');
 meritStoryState.playerName=String(meritStoryState.playerName||'');
 meritStoryState.recipientTeamId=String(meritStoryState.recipientTeamId||'');
 meritStoryState.recipientTeamName=String(meritStoryState.recipientTeamName||'');
 meritStoryState.promoted=Boolean(meritStoryState.promoted);
 meritStoryState.guaranteedGoalPending=Boolean(meritStoryState.guaranteedGoalPending);
 meritStoryState.transferred=Boolean(meritStoryState.transferred);
 meritStoryState.branch=['traded','kept'].includes(String(meritStoryState.branch))?String(meritStoryState.branch):'';
 meritStoryState.postMidseasonShown=Boolean(meritStoryState.postMidseasonShown);
 meritStoryState.challenge=meritStoryState.challenge&&typeof meritStoryState.challenge==='object'?meritStoryState.challenge:{};
 meritStoryState.challenge.active=Boolean(meritStoryState.challenge.active);
 meritStoryState.challenge.status=['idle','active','won','lost'].includes(String(meritStoryState.challenge.status))?String(meritStoryState.challenge.status):'idle';
 meritStoryState.challenge.attackerId=String(meritStoryState.challenge.attackerId||'');
 meritStoryState.challenge.attackerName=String(meritStoryState.challenge.attackerName||'');
 meritStoryState.challenge.matchesPlayed=Math.max(0,Number(meritStoryState.challenge.matchesPlayed)||0);
 meritStoryState.challenge.goals=Math.max(0,Number(meritStoryState.challenge.goals)||0);
 meritStoryState.ovrModifiers=meritStoryState.ovrModifiers&&typeof meritStoryState.ovrModifiers==='object'?Object.fromEntries(Object.entries(meritStoryState.ovrModifiers).map(([id,value])=>[String(id),Number(value)||0]).filter(([,value])=>value!==0)):{};
 meritStoryState.finale=meritStoryState.finale&&typeof meritStoryState.finale==='object'?meritStoryState.finale:{};
 meritStoryState.finale.eligible=Boolean(meritStoryState.finale.eligible);
 meritStoryState.finale.opponent=String(meritStoryState.finale.opponent||'');
 meritStoryState.finale.nation=String(meritStoryState.finale.nation||'');
 meritStoryState.finale.played=Boolean(meritStoryState.finale.played);
 meritStoryState.finale.userGoals=Math.max(0,Number(meritStoryState.finale.userGoals)||0);
 meritStoryState.finale.opponentGoals=Math.max(0,Number(meritStoryState.finale.opponentGoals)||0);
 meritStoryState.finale.won=Boolean(meritStoryState.finale.won);
 meritStoryState.finale.pointsDelta=Number(meritStoryState.finale.pointsDelta)||0;
 meritStoryState.finale.pointsApplied=Boolean(meritStoryState.finale.pointsApplied);

 next.story.fantaballopoli=next.story.fantaballopoli&&typeof next.story.fantaballopoli==='object'?next.story.fantaballopoli:{};
 const fantaStoryState=next.story.fantaballopoli;
 fantaStoryState.initialized=Boolean(fantaStoryState.initialized);
 fantaStoryState.scheduled=Boolean(fantaStoryState.scheduled);
 fantaStoryState.triggerMatchday=Number.isFinite(Number(fantaStoryState.triggerMatchday))?clamp(Number(fantaStoryState.triggerMatchday),1,18):-1;
 fantaStoryState.stage=String(fantaStoryState.stage||'idle');
 fantaStoryState.forcedLossPending=Boolean(fantaStoryState.forcedLossPending);
 fantaStoryState.targetPlayerId=String(fantaStoryState.targetPlayerId||'');
 fantaStoryState.targetPlayerName=String(fantaStoryState.targetPlayerName||'');
 fantaStoryState.targetRole=String(fantaStoryState.targetRole||'');
 fantaStoryState.midseasonResolved=Boolean(fantaStoryState.midseasonResolved);
 fantaStoryState.giudaId=String(fantaStoryState.giudaId||'');
 fantaStoryState.curseActive=Boolean(fantaStoryState.curseActive);
 fantaStoryState.negativeOvrAllowed=Boolean(fantaStoryState.negativeOvrAllowed);
 fantaStoryState.curseMatches=Math.max(0,Number(fantaStoryState.curseMatches)||0);
 fantaStoryState.satisfactionAfter=clamp(Number(fantaStoryState.satisfactionAfter)||0,0,5);
 fantaStoryState.corruptionFull=Boolean(fantaStoryState.corruptionFull);
 fantaStoryState.corruptionMatchIndex=Math.max(0,Number(fantaStoryState.corruptionMatchIndex)||0);
 fantaStoryState.investigatorDueMatchday=clamp(Number(fantaStoryState.investigatorDueMatchday)||0,0,35);
 fantaStoryState.investigatorShown=Boolean(fantaStoryState.investigatorShown);
 fantaStoryState.abruptEnd=Boolean(fantaStoryState.abruptEnd);
 fantaStoryState.completed=Boolean(fantaStoryState.completed);
 fantaStoryState.finale=fantaStoryState.finale&&typeof fantaStoryState.finale==='object'?fantaStoryState.finale:{};
 fantaStoryState.finale.eligible=Boolean(fantaStoryState.finale.eligible);
 fantaStoryState.finale.played=Boolean(fantaStoryState.finale.played);
 fantaStoryState.finale.userGoals=Math.max(0,Number(fantaStoryState.finale.userGoals)||0);
 fantaStoryState.finale.opponentGoals=Math.max(0,Number(fantaStoryState.finale.opponentGoals)||0);
 fantaStoryState.finale.won=Boolean(fantaStoryState.finale.won);
 fantaStoryState.finale.pointsApplied=Boolean(fantaStoryState.finale.pointsApplied);
 fantaStoryState.finale.rankBeforeBonus=Math.max(0,Number(fantaStoryState.finale.rankBeforeBonus)||0);
 fantaStoryState.finale.rankAfterBonus=Math.max(0,Number(fantaStoryState.finale.rankAfterBonus)||0);
 fantaStoryState.finale.pointsBeforeBonus=Number(fantaStoryState.finale.pointsBeforeBonus)||0;

 next.story.error404=next.story.error404&&typeof next.story.error404==='object'?next.story.error404:{};
 const error404StoryState=next.story.error404;
 error404StoryState.initialized=Boolean(error404StoryState.initialized);
 error404StoryState.scheduled=Boolean(error404StoryState.scheduled);
 error404StoryState.stage=String(error404StoryState.stage||'idle');
 error404StoryState.corrupted=Boolean(error404StoryState.corrupted);
 error404StoryState.technicianDueMatchday=Number.isFinite(Number(error404StoryState.technicianDueMatchday))&&Number(error404StoryState.technicianDueMatchday)>=1?clamp(Number(error404StoryState.technicianDueMatchday),1,3):-1;
 error404StoryState.restartDueMatchday=Number.isFinite(Number(error404StoryState.restartDueMatchday))&&Number(error404StoryState.restartDueMatchday)>=1?Math.max(1,Number(error404StoryState.restartDueMatchday)):-1;
 error404StoryState.technicianShown=Boolean(error404StoryState.technicianShown);
 error404StoryState.restartShown=Boolean(error404StoryState.restartShown);
 error404StoryState.antivirusInstalled=Boolean(error404StoryState.antivirusInstalled);
 error404StoryState.completed=Boolean(error404StoryState.completed);
 error404StoryState.restarted=Boolean(error404StoryState.restarted);
 if((meritStoryState.initialized||fantaStoryState.initialized)&&!error404StoryState.initialized){error404StoryState.initialized=true;error404StoryState.scheduled=false;error404StoryState.stage='inactive'}
 if(meritStoryState.initialized&&!fantaStoryState.initialized){fantaStoryState.initialized=true;fantaStoryState.scheduled=false;fantaStoryState.stage='inactive'}
 if(!meritStoryState.initialized&&!fantaStoryState.initialized&&!error404StoryState.initialized&&next.phase==='season'&&Number(next.matchday)<19){
   const storyRoll=Math.random(),selected=storyRoll<.2?(['merit','fantaballopoli','error404'][Math.floor(Math.random()*3)]):'none';
   meritStoryState.initialized=true;meritStoryState.scheduled=selected==='merit';meritStoryState.triggerMatchday=2+Math.floor(Math.random()*15);meritStoryState.stage=meritStoryState.scheduled?'waiting':'inactive';
   fantaStoryState.initialized=true;fantaStoryState.scheduled=selected==='fantaballopoli';fantaStoryState.triggerMatchday=2+Math.floor(Math.random()*15);fantaStoryState.stage=fantaStoryState.scheduled?'waiting':'inactive';
   error404StoryState.initialized=true;error404StoryState.scheduled=selected==='error404';error404StoryState.stage=error404StoryState.scheduled?'opening_waiting':'inactive';
 }
 next.cup=next.cup&&typeof next.cup==='object'?next.cup:{};
 next.cup.status=['pending','not_qualified','active','completed'].includes(String(next.cup.status))?String(next.cup.status):'pending';
 next.cup.qualifiedRank=Math.max(0,Number(next.cup.qualifiedRank)||0);
 next.cup.currentCompetition=String(next.cup.currentCompetition||'');
 next.cup.otherCompetition=String(next.cup.otherCompetition||'');
 next.cup.participants=Array.isArray(next.cup.participants)?next.cup.participants.map(item=>({...item,id:String(item?.id||''),teamId:String(item?.teamId||''),clubId:String(item?.clubId||''),name:String(item?.name||'Squadra'),origin:item?.origin==='other'?'other':'current',user:Boolean(item?.user),strength:Number(item?.strength)||60})).filter(item=>item.id):[];
 next.cup.userParticipantId=String(next.cup.userParticipantId||'cup-user');
 next.cup.userAlive=next.cup.status==='pending'?true:Boolean(next.cup.userAlive);
 next.cup.winnerId=String(next.cup.winnerId||'');
 next.cup.rewardApplied=Boolean(next.cup.rewardApplied);
 next.cup.penaltyApplied=Boolean(next.cup.penaltyApplied);
 next.cup.rewardType=['ovr_plus_10','chemistry_x2','discipline_immunity'].includes(String(next.cup.rewardType))?String(next.cup.rewardType):'';
 next.cup.penaltyType=['ovr_minus_5','chemistry_zero','none'].includes(String(next.cup.penaltyType))?String(next.cup.penaltyType):'';
 next.cup.notice=String(next.cup.notice||'');
 next.cup.history=Array.isArray(next.cup.history)?next.cup.history:[];
 next.cup.stages=Array.isArray(next.cup.stages)?next.cup.stages.map((stage,index)=>({name:String(stage?.name||PARALLEL_CUP_STAGE_NAMES[index]||'Turno'),matchdays:Array.isArray(stage?.matchdays)?stage.matchdays.map(Number):[...(PARALLEL_CUP_MATCHDAYS[index]||[])],processedLegs:[...new Set((Array.isArray(stage?.processedLegs)?stage.processedLegs:[]).map(Number))],ties:Array.isArray(stage?.ties)?stage.ties.map((tie,tieIndex)=>({id:String(tie?.id||`cup-${index}-${tieIndex}`),teamAId:String(tie?.teamAId||''),teamBId:String(tie?.teamBId||''),legs:Array.isArray(tie?.legs)?tie.legs:[],winnerId:String(tie?.winnerId||''),aggregateA:Number(tie?.aggregateA)||0,aggregateB:Number(tie?.aggregateB)||0,penalties:String(tie?.penalties||'')})).filter(tie=>tie.teamAId&&tie.teamBId):[]})):[];
 next.cup.pendingMatch=next.cup.pendingMatch&&typeof next.cup.pendingMatch==='object'?{stageIndex:Number(next.cup.pendingMatch.stageIndex)||0,legIndex:Number(next.cup.pendingMatch.legIndex)||0,tieId:String(next.cup.pendingMatch.tieId||''),matchday:Number(next.cup.pendingMatch.matchday)||0,userHome:Boolean(next.cup.pendingMatch.userHome),event:next.cup.pendingMatch.event&&typeof next.cup.pendingMatch.event==='object'?next.cup.pendingMatch.event:null}:null;
 next.cup.lastResult=next.cup.lastResult&&typeof next.cup.lastResult==='object'?next.cup.lastResult:null;
 next.midseason=next.midseason&&typeof next.midseason==='object'?next.midseason:{};
 next.midseason.step=Math.max(0,Number(next.midseason.step)||0);
 next.midseason.target=clamp(Number(next.midseason.target)||midseasonTargetFrom(next),1,3);
 next.midseason.outgoingId=String(next.midseason.outgoingId||'');
 next.midseason.mandatoryOutgoingId=String(next.midseason.mandatoryOutgoingId||next.seasonRules.mandatoryMidseasonPlayerId||'');
 next.midseason.mandatoryOutgoingIds=[...new Set([...(Array.isArray(next.midseason.mandatoryOutgoingIds)?next.midseason.mandatoryOutgoingIds:[]),next.midseason.mandatoryOutgoingId,...next.seasonRules.mandatoryMidseasonPlayerIds].map(String).filter(Boolean))].slice(0,3);
 next.midseason.mandatoryOutgoingId=next.midseason.mandatoryOutgoingIds[0]||'';
 const legacyMarketClubKey=String(next.midseason.clubId||next.midseason.nation||'');
 const migratedMarketClub=clubById(legacyMarketClubKey)||CLUBS.find(club=>normalizeName(club.name)===normalizeName(legacyMarketClubKey))||null;
 const fantaballopoliMarket=normalizeName(legacyMarketClubKey)===normalizeName('Fantaballopoli');
 next.midseason.clubId=fantaballopoliMarket?'Fantaballopoli':(migratedMarketClub?String(migratedMarketClub.id):'');
 next.midseason.nation='';
 next.midseason.candidates=Array.isArray(next.midseason.candidates)?next.midseason.candidates.map(String):[];
 if(!next.midseason.clubId)next.midseason.candidates=[];
 next.midseason.pendingCandidateId=String(next.midseason.pendingCandidateId||'');
 next.midseason.drawsUsed=Math.max(0,Number(next.midseason.drawsUsed)||0);
 if(!next.midseason.candidates.includes(next.midseason.pendingCandidateId))next.midseason.pendingCandidateId='';
 next.midseason.completed=Boolean(next.midseason.completed);
 next.midseason.auto=Boolean(next.midseason.auto);
 next.midseason.autoCompleted=Boolean(next.midseason.autoCompleted);
 next.midseason.changes=Array.isArray(next.midseason.changes)?next.midseason.changes:[];
 next.stats=next.stats&&typeof next.stats==='object'?next.stats:{};
 ['goals','assists','appearances','cleanSheets','mvpVotes','mvpPoints','playerNames','playerTeams','playerTeamNames'].forEach(key=>{
   next.stats[key]=next.stats[key]&&typeof next.stats[key]==='object'?next.stats[key]:{};
 });
 next.leagueClubIds=Array.isArray(next.leagueClubIds)?[...new Set(next.leagueClubIds.map(String).filter(id=>clubById(id)))]:[];
 next.teams=Array.isArray(next.teams)?next.teams:[];
 next.teams.forEach(team=>{
   if(!team)return;
   const config=team.id===USER_ID?clubById(next.userClubId):clubById(team.clubId||team.id);
   if(config){
     team.clubId=config.id;
     team.shortName=team.shortName||config.shortName;
     team.colors=team.colors||config.colorClub;
     if(team.id!==USER_ID)team.name=config.name;
   }
   if(team.id===USER_ID)return;
   team.chaos=team.chaos&&typeof team.chaos==='object'?team.chaos:{};
   team.chaos.activeEffects=Array.isArray(team.chaos.activeEffects)?team.chaos.activeEffects:[];
   team.chaos.seenDecisionEvents=[...new Set((Array.isArray(team.chaos.seenDecisionEvents)?team.chaos.seenDecisionEvents:[]).map(String))];
   team.chaos.decisions=Math.max(0,Number(team.chaos.decisions)||0);
   team.chaos.midseasonPickDelta=clamp(Number(team.chaos.midseasonPickDelta)||0,-1,1);
   team.chaos.matchDuration=[30,90,120].includes(Number(team.chaos.matchDuration))?Number(team.chaos.matchDuration):90;
   team.chaos.futureScorerId=String(team.chaos.futureScorerId||'');
   team.chaos.futureInjuryZeroPoints=Boolean(team.chaos.futureInjuryZeroPoints);
   team.chaos.sixtyPointFear=Boolean(team.chaos.sixtyPointFear);
   team.chaos.eventChanceMultiplier=clamp(Number(team.chaos.eventChanceMultiplier)||1,1,2);
   team.chaos.formation=FORMATIONS[String(team.chaos.formation||'')]?String(team.chaos.formation):'';
   team.playerOverrides=team.playerOverrides&&typeof team.playerOverrides==='object'?team.playerOverrides:{};
   team.roster=Array.isArray(team.roster)&&team.roster.length?team.roster.map(String):(config?buildClubRoster(config.id):buildNationRoster(team.name));
   team.statuses=team.statuses&&typeof team.statuses==='object'?team.statuses:{};
   if(team.mascot&&typeof team.mascot==='object'){
     team.mascot.id=String(team.mascot.id||`mascot-${team.id}`);
     team.mascot.ovr=99;
   }
   team.controlSwapLockedRoster=Boolean(team.controlSwapLockedRoster);
   team.strength=Number(team.strength)||(config?clubStrength(config.id):nationalStrength(team.name));
 });
 if(!next.leagueClubIds.length&&next.teams.length)next.leagueClubIds=next.teams.map(team=>String(team.clubId||team.id)).filter(id=>id!==String(next.userClubId)&&clubById(id)).slice(0,19);
 next.playoffs=next.playoffs&&typeof next.playoffs==='object'?next.playoffs:{};
 next.playoffs.initialized=Boolean(next.playoffs.initialized);
 next.playoffs.status=['idle','active','completed'].includes(String(next.playoffs.status))?String(next.playoffs.status):'idle';
 next.playoffs.stageIndex=clamp(Math.floor(Number(next.playoffs.stageIndex)||0),0,2);
 next.playoffs.stageName=String(next.playoffs.stageName||'');
 next.playoffs.qualifiers=Array.isArray(next.playoffs.qualifiers)?next.playoffs.qualifiers.map(item=>({teamId:String(item?.teamId||''),seed:Math.max(1,Number(item?.seed)||99),name:String(item?.name||'')})).filter(item=>item.teamId):[];
 next.playoffs.ties=Array.isArray(next.playoffs.ties)?next.playoffs.ties:[];
 next.playoffs.history=Array.isArray(next.playoffs.history)?next.playoffs.history:[];
 next.playoffs.championId=String(next.playoffs.championId||'');
 next.playoffs.userQualified=Boolean(next.playoffs.userQualified);
 next.playoffs.userEliminated=Boolean(next.playoffs.userEliminated);
 next.playoffs.lastStageResults=Array.isArray(next.playoffs.lastStageResults)?next.playoffs.lastStageResults:[];
 next.version=CURRENT_STATE_VERSION;
 next.meta=next.meta&&typeof next.meta==='object'?next.meta:{};
 next.meta.createdAt=next.meta.createdAt||new Date().toISOString();
 next.meta.updatedAt=next.meta.updatedAt||next.meta.createdAt;
 next.meta.submissionCode=String(next.meta.submissionCode||'');
 next.meta.submittedAt=String(next.meta.submittedAt||'');
 next.submitted=Boolean(next.submitted);
 next.meta.saveSlot=activeSaveSlot;
 if(!FORMATIONS[next.formation])next.formation='4-3-3';
 if(next.coachType==='three-five-two'){next.formation='3-5-2';next.seasonRules.userFormationOverride='3-5-2';if(next.phase==='midseason'){next.midseason.completed=true;next.midseason.autoCompleted=true;next.phase=next.matchday>=Math.max(1,Number(next.seasonRules?.seasonLength)||38)?(next.seasonRules.fgicLeagueRule==='playoffs'?'playoffs':'finished'):'season'}}
 if(!next.seasonRules.leagueFormation)next.seasonRules.leagueFormation=next.formation;
 if(next.seasonRules.userFormationOverride&&next.formation!==next.seasonRules.userFormationOverride)next.formation=next.seasonRules.userFormationOverride;
 if(!['setup','draft','season','midseason','story-final','italia-2006-final','fantaballopoli-final','fantaballopoli-restart','playoffs','finished'].includes(next.phase))next.phase='setup';
 next.schedule=Array.isArray(next.schedule)?next.schedule:[];
 if(next.teams.length&&(next.seasonRules.marathon||next.seasonRules.dynamicLeague)){
   const structuralIds=leagueStructureTeamIds(next);
   if(structuralIds.length>=2){
     if(next.seasonRules.dynamicLeague&&!next.seasonRules.dynamicLeagueTeamIds.length)next.seasonRules.dynamicLeagueTeamIds=[...structuralIds];
     const desiredLength=desiredLeagueSeasonLength(next,structuralIds),completedCount=Math.min(Math.max(0,Number(next.matchday)||0),next.schedule.length),completed=next.schedule.slice(0,completedCount).map(round=>round.map(match=>({...match})));
     if(next.schedule.length!==desiredLength){const base=generateSchedule(structuralIds),remaining=Math.max(0,desiredLength-completed.length),future=[];for(let index=0;base.length&&index<remaining;index++)future.push((base[index%base.length]||[]).map(match=>({...match})));next.schedule=[...completed,...future]}
     next.seasonRules.seasonLength=Math.max(desiredLength,completed.length);
   }
 }
 next.history=Array.isArray(next.history)?next.history:[];
 next.standings=next.standings&&typeof next.standings==='object'?next.standings:{};
 next.matchday=clamp(Number(next.matchday)||0,0,seasonLength(next));
 return next;
}
function formationSlots(key=state.formation){return (FORMATION_LAYOUTS[key]||FORMATION_LAYOUTS['4-3-3']).map((row,index)=>({code:row[0],x:row[1],y:row[2],instanceId:`starter-${index}`}))}
const SEASON_ROSTER_SIZE=14;
function seasonStarterTarget(key=state.formation){return formationSlots(key).length}

function renderPitchBoardStrip(){
 const logo='assets/site-icon-192.png';
 const token=()=>`<span class="season-board-token"><img src="${logo}" alt="" aria-hidden="true"><span class="season-board-word">Fantaballa</span></span>`;
 return `<div class="season-board-strip">${token()}${token()}${token()}</div>`;
}
function renderPitchBoardSide(side='left'){
 const logo='assets/site-icon-192.png';
 const text=`<span class="season-board-side-token"><span class="season-board-vertical">Fantaballa</span></span>`;
 const icon=`<span class="season-board-side-token season-board-side-logo"><img src="${logo}" alt="" aria-hidden="true"></span>`;
 return `<div class="season-board-side ${side}">${text}${icon}${text}</div>`;
}

function seasonBenchTarget(key=state.formation){const rosterSize=state.phase==='draft'?SEASON_ROSTER_SIZE:Math.max(SEASON_ROSTER_SIZE,Array.isArray(state?.draft?.roster)?state.draft.roster.length:SEASON_ROSTER_SIZE);return Math.max(0,rosterSize-seasonStarterTarget(key))}
function seasonBenchNumbers(key=state.formation){return Array.from({length:seasonBenchTarget(key)},(_,index)=>index+1)}
function starterEntries(){return rosterPlayers().filter(r=>!r.bench)}
function benchEntries(){return rosterPlayers().filter(r=>r.bench)}
function draftComplete(){return starterEntries().length>=11&&benchEntries().length>=3}
function benchDraftPhase(){return starterEntries().length>=11}
function usedDraftPlayerIds(){return new Set(state.draft.roster.map(r=>String(r.playerId)))}
function occupiedStarterSlotIds(){return new Set(state.draft.roster.filter(r=>!r.bench).map(r=>String(r.slotId)))}
function openStarterSlots(){const used=occupiedStarterSlotIds();return formationSlots().filter(slot=>!used.has(slot.instanceId))}
function availableStarterSlotsForPlayer(player){return openStarterSlots().filter(slot=>userCompatible(player,slot.code))}
function draftPlayerIsValid(player){if(!player||!youngBeautifulAllowsPlayer(player)||usedDraftPlayerIds().has(String(player.id)))return false;const canStart=availableStarterSlotsForPlayer(player).length>0;const canBench=benchEntries().length<3;return canStart||canBench}
function draftCandidatesForClub(clubId){return PLAYERS.filter(player=>String(player.club)===String(clubId)&&draftPlayerIsValid(player)).sort((a,b)=>{const pa=positions(a)[0]||'',pb=positions(b)[0]||'';return pa.localeCompare(pb,'it')||(Number(b.ovr)||0)-(Number(a.ovr)||0)||String(a.name).localeCompare(String(b.name),'it')})}
function draftPossibleClubs(){const available=new Set();PLAYERS.forEach(player=>{if(player.club&&draftPlayerIsValid(player))available.add(String(player.club))});return CLUBS.map(club=>String(club.id)).filter(id=>available.has(id))}
function threeFiveTwoDraftPick(clubId,used,{slotCode='',role=''}={}){
 const valid=player=>player&&youngBeautifulAllowsPlayer(player)&&!used.has(String(player.id));
 const clubKey=String(clubId||'');
 const macro=slotCode?POSITION_ROLE[slotCode]:role;
 const tests=[];
 if(slotCode){
   tests.push(player=>String(player.club||'')===clubKey&&naturalCompatible(player,slotCode));
   tests.push(player=>naturalCompatible(player,slotCode));
 }
 if(macro){
   tests.push(player=>String(player.club||'')===clubKey&&roleOf(player)===macro);
   tests.push(player=>roleOf(player)===macro);
 }
 tests.push(player=>String(player.club||'')===clubKey);
 tests.push(()=>true);
 for(const test of tests){
   const candidates=shuffle(PLAYERS.filter(player=>valid(player)&&test(player)));
   if(candidates.length)return pick(candidates);
 }
 return null;
}
function buildThreeFiveTwoOpeningRoster(clubId){
 state.formation='3-5-2';
 state.seasonRules=state.seasonRules&&typeof state.seasonRules==='object'?state.seasonRules:{};
 state.seasonRules.userFormationOverride='3-5-2';
 const slots=formationSlots('3-5-2'),used=new Set(),starters=[];
 const ordered=slots.map((slot,index)=>({slot,index,count:PLAYERS.filter(player=>String(player.club||'')===String(clubId||'')&&naturalCompatible(player,slot.code)).length})).sort((a,b)=>a.count-b.count||a.index-b.index);
 for(const item of ordered){
   const player=threeFiveTwoDraftPick(clubId,used,{slotCode:item.slot.code});
   if(!player)return false;
   used.add(String(player.id));
   starters[item.index]={playerId:String(player.id),slotId:item.slot.instanceId,slot:item.slot.code,bench:false,player:{...player}};
 }
 const benchRoles=['P','D','A'],bench=[];
 for(let index=0;index<benchRoles.length;index++){
   const player=threeFiveTwoDraftPick(clubId,used,{role:benchRoles[index]});
   if(!player)return false;
   used.add(String(player.id));
   bench.push({playerId:String(player.id),slotId:`bench-${index+1}`,slot:`PAN${index+1}`,bench:true,player:{...player}});
 }
 state.draft.roster=[...starters,...bench];
 state.draft.clubId=String(clubId||'');
 state.draft.openingClubShown=true;
 state.draft.candidates=[];
 state.draft.pendingPlayerId='';
 state.draft.rerolls=0;
 mobileDraftTab='roster';
 return true;
}
function talentScoutOpeningClub(possibleClubIds=[]){
 if(!coachIs('talent-scout')||state.draft?.openingClubShown)return'';
 const coachKey=normalizeName(state.coachName),allowed=new Set((possibleClubIds||[]).map(String));if(!coachKey||!allowed.size)return'';
 const namesake=PLAYERS.find(player=>normalizeName(player?.name)===coachKey&&allowed.has(String(player?.club||''))&&draftPlayerIsValid(player))||PLAYERS.find(player=>normalizeName(player?.name)===coachKey&&allowed.has(String(player?.club||'')));
 return namesake?String(namesake.club||''):'';
}
function drawnClub(){return clubById(state.draft.clubId)}
function marketClub(){return clubById(state.midseason?.clubId)}
function playerInitials(name){return String(name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'?'}
function formationPositionSummary(key){const counts={};(FORMATIONS[key]||[]).forEach(code=>counts[code]=(counts[code]||0)+1);return Object.entries(counts).map(([code,count])=>count>1?`${code}×${count}`:code).join(' · ')}
function draftAverageOvr(){const list=rosterPlayers();return list.length?avg(list.map(r=>Number(r.player.ovr)||0)):0}
function draftSubscriberCount(){return rosterPlayers().filter(r=>String(r.player.subscriber).toLowerCase()==='si').length}
function formatSignedIntesa(value){const n=Math.round(Number(value)||0);return `${n>=0?'+':''}${n}`}
function isItalianPlayer(player){const nation=normalizeName(player?.nation||'');return nation==='italia'||nation==='italy'||nation==='italiano'||nation==='italiana'}
function closedPortsAffects(player,rules=state?.seasonRules){return Boolean(rules?.nonItalianChemZero)&&Boolean(player)&&!isItalianPlayer(player)}
function playerClubChemistryKey(player){return normalizeName(player&&player.club||'')}
function nationMirrorsClub(player){
 const club=clubById(player&&player.club);
 return !!club&&normalizeName(player&&player.nation||'')===normalizeName(club.name||'');
}
function nationChemistryBonus(player,list){
 if(!player||nationMirrorsClub(player))return 0;
 const playerId=String(player.id);
 const nationKey=normalizeName(player.nation||'');
 if(!nationKey)return 0;
 const sameNation=(list||[]).filter(other=>other&&String(other.id)!==playerId&&normalizeName(other.nation||'')===nationKey).length;
 return Math.min(8,sameNation);
}
function clubChemistryBonus(player,list){
 if(!player)return 0;
 const playerId=String(player.id);
 const clubKey=playerClubChemistryKey(player);
 if(!clubKey)return 0;
 return (list||[]).reduce((total,other)=>{
   if(!other||String(other.id)===playerId||playerClubChemistryKey(other)!==clubKey)return total;
   return total+(roleOf(other)===roleOf(player)?2:1);
 },0);
}
function draftChemistry(source=starterEntries()){
 const entries=(Array.isArray(source)?source:[]).filter(item=>item&&!item.bench);
 const players=entries.map(item=>item.player||item).filter(Boolean);
 const subscriberNationCounts={};
 players.forEach(player=>{if(isSubscriber(player)){const key=normalizeName(player.nation);subscriberNationCounts[key]=(subscriberNationCounts[key]||0)+1}});
 const playerBonus={};
 const playerBaseBonus={};
 const playerClubBonus={};
 const playerSubscriberBonus={};
 const playerCoachBonus={};
 players.forEach(player=>{
   const playerId=String(player.id);
   if(closedPortsAffects(player)){playerBaseBonus[playerId]=0;playerClubBonus[playerId]=0;playerSubscriberBonus[playerId]=0;playerCoachBonus[playerId]=0;playerBonus[playerId]=0;return}
   const base=nationChemistryBonus(player,players);
   const clubBonus=clubChemistryBonus(player,players);
   const nationKey=normalizeName(player.nation);
   const subscriberBase=isSubscriber(player)?5:0;
   const subscriberPair=isSubscriber(player)&&(subscriberNationCounts[nationKey]||0)>=2?10:0;
   const subscriberTotal=subscriberBase+subscriberPair;
   const coachBonus=(normalizeName(player.name)===normalizeName(state.coachName)?10:0)+youngBeautifulChemistryBonus(player);
   playerBaseBonus[playerId]=base;
   playerClubBonus[playerId]=clubBonus;
   playerSubscriberBonus[playerId]=subscriberTotal;
   playerCoachBonus[playerId]=coachBonus;
   playerBonus[playerId]=base+clubBonus+subscriberTotal+coachBonus;
 });
 if(parallelCupChemistryZero()||coachIs('ductility')){
   [playerBonus,playerBaseBonus,playerClubBonus,playerSubscriberBonus,playerCoachBonus].forEach(map=>Object.keys(map).forEach(key=>map[key]=0));
 }else{
   const cupMultiplier=parallelCupChemistryMultiplier();
   if(cupMultiplier!==1)[playerBonus,playerBaseBonus,playerClubBonus,playerSubscriberBonus,playerCoachBonus].forEach(map=>Object.keys(map).forEach(key=>map[key]=(Number(map[key])||0)*cupMultiplier));
 }
 const totalBonus=Object.values(playerBonus).reduce((sum,value)=>sum+value,0);
 const baseTotalBonus=Object.values(playerBaseBonus).reduce((sum,value)=>sum+value,0);
 const clubTotalBonus=Object.values(playerClubBonus).reduce((sum,value)=>sum+value,0);
 const subscriberTotalBonus=Object.values(playerSubscriberBonus).reduce((sum,value)=>sum+value,0);
 const coachTotalBonus=Object.values(playerCoachBonus).reduce((sum,value)=>sum+value,0);
 const averageBonus=players.length?totalBonus/players.length:0;
 const score=players.length?Math.max(0,Math.min(100,Math.round((averageBonus/31)*100))):0;
 return {players,playerBonus,playerBaseBonus,playerClubBonus,playerSubscriberBonus,playerCoachBonus,totalBonus,baseTotalBonus,clubTotalBonus,subscriberTotalBonus,coachTotalBonus,averageBonus,score};
}
function draftEffectiveAverageOvr(chem=draftChemistry()){
 return chem.players.length?avg(chem.players.map(player=>ductilityEffectiveBaseOvr(player)+(chem.playerBonus[String(player.id)]||0))):0;
}
function draftCandidateChemPreview(player){
 if(!player||benchDraftPhase())return 0;
 const previewEntries=[...starterEntries(),{playerId:String(player.id),player,bench:false}];
 const preview=draftChemistry(previewEntries);
 return preview.playerBonus[String(player.id)]||0;
}
function renderDraftChemistryCard(chem=draftChemistry()){
 const effective=draftEffectiveAverageOvr(chem);
 return `<div class="season-chemistry-card"><div class="season-chemistry-head"><span>Intesa titolari</span><b>${chem.score}/100</b></div><div class="season-chemistry-bar"><i style="width:${chem.score}%"></i></div><div class="season-chemistry-total"><span>Bonus totale</span><b>${formatSignedIntesa(chem.totalBonus)}</b></div><div class="season-chemistry-breakdown"><span>NAZ ${formatSignedIntesa(chem.baseTotalBonus)}</span><span>CLUB ${formatSignedIntesa(chem.clubTotalBonus)}</span><span>ABB ${formatSignedIntesa(chem.subscriberTotalBonus)}</span><span>ALL ${formatSignedIntesa(chem.coachTotalBonus)}</span></div><div class="season-chemistry-effective"><span>OVR titolari con intesa</span><b>${chem.players.length?effective.toFixed(1):'—'}</b></div><small>Le 3 riserve non aumentano l’intesa finché restano in panchina.</small></div>`;
}
function remainingSlotSummary(){const counts={};openStarterSlots().forEach(slot=>counts[slot.code]=(counts[slot.code]||0)+1);return Object.entries(counts).map(([code,count])=>count>1?`${code}×${count}`:code).join(' · ')||'Completati'}
function waitDraft(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function packNationFontSize(name){const len=String(name||'').trim().length;if(len<=8)return 30;if(len<=11)return 25;if(len<=15)return 21;if(len<=19)return 18;return 15}
function teamNameFontSize(name){const len=String(name||'').trim().length;if(len<=10)return 34;if(len<=14)return 29;if(len<=18)return 24;if(len<=22)return 20;return 16}
function applyPackNationLabel(el,name){if(!el)return;el.textContent=name;el.style.fontSize=`${packNationFontSize(name)}px`;el.title=name}

function isSubscriber(player){return String(player&&player.subscriber||'').trim().toLowerCase()==='si'}
function isCreator(player){return String(player&&player.creator||'').trim().toLowerCase()==='si'}
function hashString(str){let h=2166136261>>>0;for(const ch of String(str||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function seededChoice(list,seed,shift=0){return list[(Math.floor(seed/Math.pow(7,shift))>>>0)%list.length]}
function avatarHexToRgb(color){
 const value=String(color||'').trim();
 const match=value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
 if(!match)return null;
 let hex=match[1];
 if(hex.length===3)hex=hex.split('').map(ch=>ch+ch).join('');
 return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];
}
function avatarRgbToHex(rgb){return `#${rgb.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')}`}
function avatarMix(a,b,t=.5){
 const ra=avatarHexToRgb(a)||[24,44,74], rb=avatarHexToRgb(b)||[255,255,255];
 return avatarRgbToHex(ra.map((v,i)=>v+(rb[i]-v)*t));
}
function avatarShade(color,amount=.15){return amount>=0?avatarMix(color,'#ffffff',amount):avatarMix(color,'#000000',Math.abs(amount))}
function avatarLuma(color){const rgb=avatarHexToRgb(color)||[255,255,255];return (0.299*rgb[0]+0.587*rgb[1]+0.114*rgb[2])/255}
function avatarTextColor(color){return avatarLuma(color)>.63?'#10243a':'#ffffff'}
function avatarRoleCode(player){return String(player?.Position||player?.role||'').toUpperCase().split(',')[0].trim()||'--'}
function avatarIsGoalkeeper(player){return /^(P|POR|GK)$/.test(avatarRoleCode(player))}
function avatarSourceKey(player){
 const source=player?.clubName||player?.teamName||player?.squadra||player?.team||player?.club||player?.nation||'Fantaballa';
 return String(source);
}
function avatarClubInfo(player){
 const clubId=player?.club||player?.clubId||'';
 const club=clubId&&typeof clubById==='function'?clubById(clubId):null;
 const colors=club?.colorClub||club?.colors||{};
 const primary=colors.primary||'#1769AA';
 const secondary=colors.secondary||avatarShade(primary,.45);
 const accent=colors.accent||avatarMix(primary,secondary,.5);
 const text=colors.text||avatarTextColor(primary);
 return {name:club?.name||avatarSourceKey(player),shortName:club?.shortName||String(club?.name||avatarSourceKey(player)).slice(0,3).toUpperCase(),primary,secondary,accent,text};
}
function avatarTier(player){
 const ovr=Number(player?.ovr)||0;
 if(ovr>=90)return {key:'legend',glow:'#f6d365',rim:'#fff1a8',spark:'#fff8cf',stars:4,label:'LEG'};
 if(ovr>=85)return {key:'elite',glow:'#b993ff',rim:'#eedcff',spark:'#f6efff',stars:3,label:'ELI'};
 if(ovr>=80)return {key:'gold',glow:'#f7c948',rim:'#ffefad',spark:'#fff8da',stars:2,label:'GLD'};
 if(ovr>=75)return {key:'silver',glow:'#b7c5d3',rim:'#eef4f8',spark:'#ffffff',stars:1,label:'SLV'};
 return {key:'base',glow:'#8fb4d8',rim:'rgba(255,255,255,.4)',spark:'rgba(255,255,255,.8)',stars:0,label:'ROO'};
}
function avatarPalette(player){
 const club=avatarClubInfo(player);
 const tier=avatarTier(player);
 const isGoalkeeper=avatarIsGoalkeeper(player);
 const primary=isGoalkeeper?avatarMix(club.primary,'#16a34a',.28):club.primary;
 const secondary=isGoalkeeper?avatarMix(club.secondary,'#facc15',.22):club.secondary;
 const accent=isGoalkeeper?avatarMix(club.accent,'#ffffff',.18):club.accent;
 const bg1=avatarShade(primary,-.16), bg2=avatarShade(secondary,.12), glow=avatarMix(primary,tier.glow,.38);
 return {primary,secondary,accent,bg1,bg2,glow,rim:tier.rim,text:club.text,club};
}
function avatarSeed(player){
 const role=avatarRoleCode(player);
 const source=avatarSourceKey(player);
 const seed=hashString(`${player?.name||''}|${player?.nation||''}|${role}|${source}`);
 const preset={
  seed,
  skin:seededChoice(['#f6caa5','#edb98f','#d99870','#be805b','#915b40','#f0d5bb'],seed,1),
  hair:seededChoice(['#1b1512','#432818','#6f4e37','#c18f59','#d8d8d8','#111827','#7f1d1d','#312e81'],seed,2),
  eyebrows:seededChoice(['#2a1a12','#4a2d1d','#6b4423','#40240f'],seed,3),
  faceShape:seededChoice(['round','oval','square'],seed,4),
  hairStyle:seededChoice(['crop','part','curly','spike','fade','long'],seed,5),
  eyeStyle:seededChoice(['dot','smile','focused','wide'],seed,6),
  mouthStyle:seededChoice(['smile','serious','grin'],seed,7),
  beardStyle:seededChoice(['none','none','stubble','goatee','moustache'],seed,8),
  accessory:seededChoice(['none','none','glasses','headband'],seed,9),
  kitStyle:seededChoice(['stripe','sash','hoops','split','solid'],seed,10)
 };
 const creatorStyle=String(player?.creatorStyle||'').trim().toLowerCase();
 const creatorName=String(player?.name||'').trim().toLowerCase();
 const isBaroneSportivo=creatorStyle==='barone-sportivo'||String(player?.id||'')==='850'||creatorName==='barone sportivo';
 const isStefanoFinari=creatorStyle==='stefano-finari'||String(player?.id||'')==='851'||creatorName==='stefano finari';
 if(isBaroneSportivo){
  preset.skin='#f0d5bb';
  preset.hair='#8a5a33';
  preset.eyebrows='#5a371d';
  preset.faceShape='oval';
  preset.hairStyle='part';
  preset.eyeStyle='focused';
  preset.mouthStyle='serious';
  preset.beardStyle='stubble';
  preset.accessory='topHat';
  preset.kitStyle='solid';
 }
 if(isStefanoFinari){
  preset.skin='#f0c39f';
  preset.hair='#3a241a';
  preset.eyebrows='#251812';
  preset.faceShape='oval';
  preset.hairStyle='fade';
  preset.eyeStyle='wide';
  preset.mouthStyle='smile';
  preset.beardStyle='moustache';
  preset.accessory='none';
  preset.kitStyle='solid';
 }
 return preset;
}
function renderAvatarSvg(player,sub=false){
 const a=avatarSeed(player), p=avatarPalette(player), tier=avatarTier(player), id=`av-${a.seed}`, overall=Number(player?.ovr)||0;
 const face=a.faceShape==='square'
   ? `<rect x="18" y="14" width="48" height="54" rx="16" fill="${a.skin}" stroke="rgba(90,52,31,.18)" stroke-width="1.2"/>`
   : `<ellipse cx="42" cy="41" rx="${a.faceShape==='oval'?23:24}" ry="${a.faceShape==='oval'?28:26}" fill="${a.skin}" stroke="rgba(90,52,31,.18)" stroke-width="1.2"/>`;
 const ears=`<ellipse cx="15.2" cy="41.5" rx="4.8" ry="7.6" fill="${a.skin}"/><ellipse cx="68.8" cy="41.5" rx="4.8" ry="7.6" fill="${a.skin}"/>`;
 const cheeks=`<circle cx="26.5" cy="52.2" r="2.6" fill="rgba(255,147,147,.14)"/><circle cx="57.5" cy="52.2" r="2.6" fill="rgba(255,147,147,.14)"/>`;
 const neck=`<rect x="37.2" y="62" width="9.6" height="9.8" rx="4.2" fill="${a.skin}" opacity=".98"/>`;
 const collar=`<path d="M31 82c1.6-7.6 6.8-13 11-13 4.2 0 9.4 5.4 11 13" fill="rgba(255,255,255,.08)"/>`;
 const hairMap={
   crop:`<path d="M18.5 31c2.6-13.4 12.4-21.4 23.5-21.4 10.8 0 19.8 5.6 23.3 18.8-6.4-2.9-13.8-4.1-23.3-4.1-9.8 0-16.8 2.5-23.5 6.7z" fill="${a.hair}"/>`,
   part:`<path d="M18.4 31c4.8-12.8 14.6-20.8 23.6-20.8 8.6 0 16.6 5.2 21.8 18-5.5-2.4-10.8-3.6-15.7-3.6l-5.8 8-5.8-8c-6.8 0-12.6 2.2-18.1 6.4z" fill="${a.hair}"/>`,
   curly:`<path d="M18.9 32c3.8-12.6 12.2-20.5 22-20.5 10.5 0 18.6 5.4 22.1 16.5-1.4-.6-2.8-.8-4.5-.8 0 0-1.2-5-4.9-5-2.5 0-3.8 2.5-3.8 2.5s-2.3-5-6.5-5-5.4 3.5-5.4 3.5-2.2-3.2-5.9-2.2c-4 1.1-5.4 6-5.4 6s-2.8 1.2-3.7 5z" fill="${a.hair}"/>`,
   spike:`<path d="M19.2 33c1.4-5.2 5.2-12.8 10.2-18.2l5 4.8 5.2-7.6 6.2 7.2 4.8-6c5.2 4 9.2 10.5 10.4 19-6.4-4.2-12.8-6.4-21.6-6.4-8.4 0-14.8 2.4-20.2 7.2z" fill="${a.hair}"/>`,
   fade:`<path d="M22.3 31.5C26 20 33.7 14.2 42 14.2c9.3 0 16.7 5.5 20.3 15.7-4.9-2.1-10.6-3-18.9-3-8.5 0-14.4 1.8-21.1 4.6z" fill="${a.hair}"/><path d="M20.6 32.5c1.3-5 3.5-9.5 6-12-2.3 6.2-2.4 10.5-.9 15.4-1.8.8-3.4 1.4-5.1 2.2z" fill="${a.hair}" opacity=".32"/><path d="M58.8 20.5c2.4 2.8 4.8 7.4 5.7 11.8-1.8-.8-3.7-1.4-5.5-1.8 1-4.7.7-7.6-.2-10z" fill="${a.hair}" opacity=".32"/>`,
   long:`<path d="M18.8 30.5c4.6-13 12.4-20.2 23.2-20.2 10.4 0 18.6 5.5 22 17-5.2-2.2-10.3-3.2-16.2-3.2-10.8 0-18 3.2-24.5 9z" fill="${a.hair}"/><path d="M20.2 33.3c1.2 10.8 1.2 19.2-1.1 28.2 4.8-2.5 8.8-6.8 10.2-14l1.1-14.2z" fill="${a.hair}" opacity=".92"/><path d="M63.8 33.3c-1.2 10.8-1.2 19.2 1.1 28.2-4.8-2.5-8.8-6.8-10.2-14l-1.1-14.2z" fill="${a.hair}" opacity=".92"/>`
 };
 const brows=`<path d="M26.6 34.5c3-1.8 6.2-2.6 9.7-2.4" fill="none" stroke="${a.eyebrows}" stroke-width="2" stroke-linecap="round"/><path d="M47 32.1c3.5-.2 6.7.6 9.7 2.4" fill="none" stroke="${a.eyebrows}" stroke-width="2" stroke-linecap="round"/>`;
 const eyesMap={
   dot:`<circle cx="33.2" cy="42.3" r="2.1" fill="#1b1a17"/><circle cx="50.8" cy="42.3" r="2.1" fill="#1b1a17"/>`,
   smile:`<path d="M30 42.5c1.5 1.9 3 2.6 4.6 2.6 1.5 0 3-.7 4.5-2.6" fill="none" stroke="#1b1a17" stroke-width="1.55" stroke-linecap="round"/><path d="M45 42.5c1.5 1.9 3 2.6 4.6 2.6 1.5 0 3-.7 4.5-2.6" fill="none" stroke="#1b1a17" stroke-width="1.55" stroke-linecap="round"/>`,
   focused:`<path d="M30 42.1h6.8" stroke="#1b1a17" stroke-width="1.65" stroke-linecap="round"/><path d="M47.2 42.1H54" stroke="#1b1a17" stroke-width="1.65" stroke-linecap="round"/><circle cx="33.2" cy="42.8" r="1.2" fill="#1b1a17"/><circle cx="50.8" cy="42.8" r="1.2" fill="#1b1a17"/>`,
   wide:`<ellipse cx="33.2" cy="42.3" rx="3.1" ry="2.6" fill="#fff"/><ellipse cx="50.8" cy="42.3" rx="3.1" ry="2.6" fill="#fff"/><circle cx="33.2" cy="42.3" r="1.5" fill="#1b1a17"/><circle cx="50.8" cy="42.3" r="1.5" fill="#1b1a17"/>`
 };
 const nose=`<path d="M42 45c1.9 2.8 2 5.8-.1 7.4" fill="none" stroke="rgba(119,74,46,.32)" stroke-width="1.45" stroke-linecap="round"/>`;
 const mouthMap={
   smile:`<path d="M33 56c3.3 2.9 6 4 9 4 3 0 5.7-1.1 9-4" fill="none" stroke="rgba(110,47,34,.94)" stroke-width="2" stroke-linecap="round"/>`,
   serious:`<path d="M34.2 56.4h15.6" fill="none" stroke="rgba(110,47,34,.94)" stroke-width="1.95" stroke-linecap="round"/>`,
   grin:`<path d="M32.4 54.8c3 3.8 6.1 5.1 9.6 5.1 3.2 0 6.5-1.3 9.6-5.1" fill="#fff8ef" stroke="rgba(110,47,34,.94)" stroke-width="1.65" stroke-linejoin="round"/>`
 };
 const beardMap={
   none:'',
   stubble:`<path d="M28.2 52.8c3 8.4 8.4 13.2 13.8 13.2 5.5 0 10.8-4.8 13.8-13.2" fill="rgba(138,90,51,.38)"/><path d="M30 55.5c2.8 4.6 7.2 7.5 12 7.5s9.2-2.9 12-7.5" fill="none" stroke="rgba(169,112,65,.72)" stroke-width="1.45" stroke-linecap="round"/>`,
   goatee:`<path d="M37.1 57c1.3 5.6 3 10 4.9 12.3 1.9-2.3 3.6-6.7 4.9-12.3" fill="rgba(58,37,23,.58)"/><path d="M34.4 54.6c2.4 2.3 5.1 3.3 7.6 3.3 2.5 0 5.2-.9 7.6-3.3" fill="rgba(58,37,23,.46)"/>`,
   moustache:`<path d="M33.8 51c1.9 2 4.3 2.8 6.6 2.8 0 0 .5-1.5 1.6-1.5 1.2 0 1.6 1.5 1.6 1.5 2.3 0 4.7-.8 6.6-2.8-1.9 3.2-4.2 4.8-7.4 4.8h-1.6c-3.2 0-5.5-1.6-7.4-4.8z" fill="rgba(58,37,23,.72)"/>`
 };
 const accessoryMap={
   none:'',
   glasses:`<g stroke="#0f172a" stroke-width="1.9" fill="rgba(219,234,254,.25)"><rect x="25.4" y="38.2" width="13.4" height="9.6" rx="3.2"/><rect x="45.2" y="38.2" width="13.4" height="9.6" rx="3.2"/><path d="M38.8 43h6.4"/></g>`,
   headband:`<path d="M23.2 31.4c6-2.8 12-4.1 18.8-4.1 6.8 0 12.8 1.3 18.8 4.1" fill="none" stroke="#ef4444" stroke-width="4.2" stroke-linecap="round" opacity=".92"/>`,
   topHat:`<g><ellipse cx="42" cy="20.2" rx="22.5" ry="5.6" fill="#0f1115" opacity=".98"/><path d="M26 21V9.8c0-2.5 2-4.5 4.5-4.5h23c2.5 0 4.5 2 4.5 4.5V21z" fill="#15171c"/><rect x="24.5" y="19.2" width="35" height="3.6" rx="1.8" fill="#292c32"/><path d="M27 9.6h30" stroke="rgba(255,255,255,.18)" stroke-width="1.1" stroke-linecap="round"/></g>`
 };
 const sparkles=tier.stars?`<g fill="${tier.spark}" opacity=".86"><circle cx="21" cy="15" r="1.4"/><circle cx="61" cy="14" r="1.2"/><path d="M63 26l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/></g>`:'';
 const crown=sub?`<g><circle cx="15" cy="15" r="8.8" fill="#f6c74e" stroke="#fff5bf" stroke-width="1.1"/><path d="M10.2 17.5l1.5-5 3 2.2 2.6-3.3 2.6 3.3 3-2.2 1.5 5z" fill="#8b5a00"/></g>`:'';
 const topMark=overall>=88?`<g><circle cx="68.5" cy="15.5" r="8.2" fill="${tier.glow}"/><text x="68.5" y="18.6" text-anchor="middle" font-size="6.2" font-weight="900" fill="#10243a" font-family="system-ui, sans-serif">TOP</text></g>`:'';
 const rimColor=sub ? '#ffe76a' : tier.rim;
 return `<svg viewBox="0 0 84 84" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${avatarShade(p.bg1,.08)}"/><stop offset="100%" stop-color="${avatarShade(p.bg2,.02)}"/></linearGradient><radialGradient id="${id}-halo" cx="50%" cy="38%" r="60%"><stop offset="0%" stop-color="${avatarShade(p.glow,.42)}" stop-opacity=".82"/><stop offset="100%" stop-color="${avatarShade(p.glow,-.18)}" stop-opacity="0"/></radialGradient><radialGradient id="${id}-shine" cx="28%" cy="18%" r="70%"><stop offset="0%" stop-color="rgba(255,255,255,.38)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient></defs><rect x="4.5" y="4.5" width="75" height="75" rx="22" fill="url(#${id}-bg)"/><circle cx="42" cy="40" r="29" fill="url(#${id}-halo)"/>${collar}${neck}${ears}${face}${hairMap[a.hairStyle]||hairMap.crop}${cheeks}${accessoryMap[a.accessory]||''}${brows}${eyesMap[a.eyeStyle]||eyesMap.dot}${nose}${mouthMap[a.mouthStyle]||mouthMap.smile}${beardMap[a.beardStyle]||''}${sparkles}${crown}${topMark}<rect x="4.5" y="4.5" width="75" height="75" rx="22" fill="url(#${id}-shine)" opacity=".55"/><rect x="4.5" y="4.5" width="75" height="75" rx="22" fill="none" stroke="${rimColor}" stroke-width="${sub?'2.2':overall>=85?'1.7':'1.2'}"/></svg>`;
}
function renderMiniAvatar(player,extra=''){
 const sub=isSubscriber(player), creator=isCreator(player);
 const badge=sub?'<span class="av-subscriber-badge">★</span>':creator?'<span class="av-creator-badge">CR</span>':'';
 return `<span class="season-mini-avatar ${sub?'subscriber':''} ${creator?'creator':''} ${extra}" style="background:transparent!important">${renderAvatarSvg(player,sub)}${badge}</span>`;
}

function nationPalette(name){
 const seed=hashString(name||'nation');
 const hue=seed%360; const hue2=(hue+((seed>>4)%90)+30)%360; const hue3=(hue+((seed>>7)%170)+110)%360;
 const a=`hsl(${hue} 72% 56%)`; const b=`hsl(${hue2} 68% 42%)`; const c=`hsl(${hue3} 82% 92%)`;
 const ink=((seed>>10)%2)?'#10243a':'#1d160e';
 return {a,b,c,ink}
}
function jerseyColorRgb(color){
 const value=String(color||'').trim();
 let match=value.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
 if(match){
  let hex=match[1];
  if(hex.length===3)hex=hex.split('').map(ch=>ch+ch).join('');
  if(hex.length===8)hex=hex.slice(0,6);
  return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];
 }
 match=value.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i);
 if(match)return [Number(match[1]),Number(match[2]),Number(match[3])];
 match=value.match(/^hsla?\(\s*([\d.]+)(?:deg)?[ ,]+([\d.]+)%[ ,]+([\d.]+)%/i);
 if(match){
  const h=((Number(match[1])%360)+360)%360/360,s=Number(match[2])/100,l=Number(match[3])/100;
  const hueToRgb=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p};
  if(s===0){const gray=Math.round(l*255);return[gray,gray,gray]}
  const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;
  return [Math.round(hueToRgb(p,q,h+1/3)*255),Math.round(hueToRgb(p,q,h)*255),Math.round(hueToRgb(p,q,h-1/3)*255)];
 }
 return null;
}
function jerseyNumberColor(color){
 const rgb=jerseyColorRgb(color);
 if(!rgb)return '#111111';
 const brightness=(rgb[0]*299+rgb[1]*587+rgb[2]*114)/1000;
 return brightness<150?'#FFFFFF':'#111111';
}
function renderPlayerJersey(player,extra='',chemistryBonus=0){
 const pal=clubPalette(activeUserClub()); const sub=isSubscriber(player); const currentChem=effectiveChemistryFromBase(player,chemistryBonus); const shownOvr=Math.round(ductilityEffectiveBaseOvr(player)+currentChem+activeOvrBonus(player));
 const numberColor=jerseyNumberColor(pal.b||pal.secondary||pal.a);
 return `<span class="season-jersey-wrap ${sub?'subscriber':''} ${extra}" style="--nation-a:${pal.a};--nation-b:${pal.b};--nation-c:${pal.c};--nation-ink:${pal.ink};--jersey-number-color:${numberColor}" title="OVR base ${Math.round(ductilityEffectiveBaseOvr(player))} · Intesa attuale ${formatSignedIntesa(currentChem)}"><span class="season-jersey"><span class="season-jersey-number">${shownOvr}</span></span>${sub?'<span class="season-jersey-sub-star">★</span>':''}</span>`
}

function persistSetupIdentity(teamInput,coachInput,saveState=true){
 const teamName=String(teamInput?.value??state.teamName??'').trim();
 const coachName=String(coachInput?.value??state.coachName??'').trim();
 state.teamName=teamName||DEFAULT_TEAM_NAME;
 state.coachName=coachName;
 try{
   localStorage.setItem(SETUP_TEAM_NAME_KEY,state.teamName);
   localStorage.setItem(SETUP_COACH_NAME_KEY,state.coachName);
   localStorage.setItem(SETUP_COACH_TYPE_KEY,normalizeCoachType(state.coachType));
   localStorage.setItem(SETUP_PALETTE_KEY,state.teamPaletteId||'fantaballa');
 }catch(error){console.warn('Preferenze squadra non salvate',error)}
 if(saveState)save();
}
function scheduleSetupIdentitySave(teamInput,coachInput){
 persistSetupIdentity(teamInput,coachInput,false);
 clearTimeout(setupIdentitySaveTimer);
 setupIdentitySaveTimer=setTimeout(()=>save(),220);
}
function setupScrollTo(id){requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'}))}
function restoreSetupScroll(scrollTop){const target=Math.max(0,Number(scrollTop)||0),apply=()=>{const root=document.documentElement,previous=root.style.scrollBehavior;root.style.scrollBehavior='auto';window.scrollTo(0,target);root.style.scrollBehavior=previous};requestAnimationFrame(()=>requestAnimationFrame(apply));setTimeout(apply,120)}
function captureCoachSelectorViewport(){const selector=document.querySelector('.season-coach-selector');return selector?selector.getBoundingClientRect().top:null}
function restoreCoachSelectorViewport(previousTop){if(previousTop==null)return;const apply=()=>{const selector=document.querySelector('.season-coach-selector');if(!selector)return;const currentTop=selector.getBoundingClientRect().top;const delta=currentTop-previousTop;if(Math.abs(delta)>1){const root=document.documentElement,prev=root.style.scrollBehavior;root.style.scrollBehavior='auto';window.scrollBy(0,delta);root.style.scrollBehavior=prev}};requestAnimationFrame(()=>requestAnimationFrame(apply));setTimeout(apply,100);setTimeout(apply,260);document.querySelectorAll('.season-coach-selector img').forEach(img=>{if(img.complete)return;img.addEventListener('load',apply,{once:true})})}
function renderSetupProgress(step){return `<div class="season-setup-progress" aria-label="Progresso configurazione">${[1,2,3,4].map(index=>`<span class="${index<=step?'done':''}"></span>`).join('')}</div>`}
function renderPaletteButtons(){return TEAM_PALETTES.map(preset=>`<button type="button" class="season-palette-btn ${state.teamPaletteId===preset.id?'active':''}" data-team-palette="${esc(preset.id)}" aria-pressed="${state.teamPaletteId===preset.id?'true':'false'}"><span class="season-palette-swatch" style="--palette-primary:${preset.primary};--palette-secondary:${preset.secondary}"></span><small>${esc(preset.name)}</small></button>`).join('')}
function coachProfileIndex(value=state?.coachType){return Math.max(0,COACH_PROFILES.findIndex(profile=>profile.id===normalizeCoachType(value)))}
function coachProfileAt(offset=0,value=state?.coachType){const index=coachProfileIndex(value);return COACH_PROFILES[(index+offset+COACH_PROFILES.length)%COACH_PROFILES.length]||COACH_PROFILES[0]}
function renderCoachCarousel(){const current=coachProfile(),prev=coachProfileAt(-1),next=coachProfileAt(1),index=coachProfileIndex()+1;return `<div class="season-coach-carousel"><button type="button" class="season-coach-nav prev" data-coach-nav="-1" aria-label="Allenatore precedente">‹</button><div class="season-coach-peek left" data-coach-type="${esc(prev.id)}" role="button" tabindex="0" aria-label="Seleziona ${esc(prev.name)}"><img src="${esc(prev.image)}" alt=""><span>${esc(prev.name)}</span></div><article class="season-coach-hero active"><div class="season-coach-hero-art"><img src="${esc(current.image)}" alt="${esc(current.name)}"></div><div class="season-coach-hero-copy"><div class="season-coach-card-head"><span class="season-coach-card-icon">${current.icon}</span><div><small>Tipo di allenatore</small><b>${esc(current.name)}</b><em>${esc(current.tagline||'')}</em></div></div><span class="season-coach-index">${index}/${COACH_PROFILES.length}</span><span class="season-coach-effect pro"><strong>Pro</strong>${esc(current.pro)}</span><span class="season-coach-effect con"><strong>Contro</strong>${esc(current.con)}</span></div></article><div class="season-coach-peek right" data-coach-type="${esc(next.id)}" role="button" tabindex="0" aria-label="Seleziona ${esc(next.name)}"><img src="${esc(next.image)}" alt=""><span>${esc(next.name)}</span></div><button type="button" class="season-coach-nav next" data-coach-nav="1" aria-label="Allenatore successivo">›</button></div><div class="season-coach-dots">${COACH_PROFILES.map(profile=>`<button type="button" class="${profile.id===current.id?'active':''}" data-coach-type="${esc(profile.id)}" aria-label="Seleziona ${esc(profile.name)}"></button>`).join('')}</div>`}
function showSetup(){
 const step=clamp(Number(state.setupStep)||1,1,4),userClub=activeUserClub(),userPal=clubPalette(userClub);
 const teamValue=String(state.teamName||localStorage.getItem(SETUP_TEAM_NAME_KEY)||DEFAULT_TEAM_NAME);
 const coachValue=String(state.coachName||localStorage.getItem(SETUP_COACH_NAME_KEY)||'');
 const allFormations=Object.keys(FORMATIONS).filter(form=>!['2-4-4','4-4-4','3-3-3'].includes(form));
 if(coachIs('three-five-two'))state.formation='3-5-2';
 const formations=coachIs('three-five-two')?['3-5-2']:allFormations;
 screen.innerHTML=`<div class="season-setup-flow">${renderSetupProgress(step)}
 <section class="panel season-setup-step" id="setupModeStep" data-step-label="Passo 1 di 4"><div class="season-setup-step-head"><span class="season-setup-step-number">1</span><div><div class="season-setup-kicker">${esc(SEASON_CONFIG.labels.competitionName)}</div><h2>Scegli la modalità</h2><p>Prima di creare la squadra, scegli come devono comportarsi gli eventi durante la stagione.</p></div></div><div class="season-mode-grid"><button type="button" class="season-mode-btn ${step>1&&state.gameMode!=='chaos'?'active':''}" data-game-mode="normal"><b>Normale</b><small>Gli eventi, le quest e le decisioni riguardano <strong>soltanto la tua squadra</strong>. Le 19 avversarie disputano normalmente il campionato.</small></button><button type="button" class="season-mode-btn ${step>1&&state.gameMode==='chaos'?'active':''}" data-game-mode="chaos"><b>🌀 Caos</b><small>Anche le <strong>19 avversarie</strong> ricevono eventi, prendono decisioni e subiscono conseguenze reali sulle proprie rose.</small></button></div></section>
 ${step>=2?`<section class="panel season-setup-step" id="setupIdentityStep" data-step-label="Passo 2 di 4"><div class="season-setup-step-head"><span class="season-setup-step-number">2</span><div><h2>Identità della squadra</h2><p>Scegli nome della squadra, nome dell’allenatore, colori sociali e il profilo con cui affronterai la stagione.</p></div></div><div class="season-identity-grid"><div><div class="season-identity-fields"><div class="field"><label>Nome squadra</label><input id="teamName" maxlength="32" value="${esc(teamValue)}" placeholder="${esc(DEFAULT_TEAM_NAME)}" autocomplete="organization"></div><div class="field"><label>Nome allenatore</label><input id="coachName" maxlength="32" value="${esc(coachValue)}" placeholder="Il tuo nome" autocomplete="name"></div></div><div class="season-setup-tip">Se il nome dell’allenatore coincide con quello di un calciatore scelto, quel giocatore ottiene +10 OVR bonus di Intesa.</div><div class="season-palette-title">Palette sociali</div><div class="season-palette-grid">${renderPaletteButtons()}</div><div class="season-coach-title">Tipo di allenatore</div><div class="season-coach-selector">${renderCoachCarousel()}</div></div><aside class="season-identity-preview"><div class="season-club-preview custom-preview" style="--club-primary:${userPal.primary};--club-secondary:${userPal.secondary};--club-accent:${userPal.accent};--club-text:${userPal.text}"><span class="season-club-preview-badge" id="setupPreviewBadge">${esc(setupTeamBadge(teamValue))}</span><div><small>Anteprima squadra</small><b id="setupPreviewName">${esc(teamValue||DEFAULT_TEAM_NAME)}</b><em id="setupPreviewCoach">Allenatore: ${esc(coachValue||'da inserire')}</em><em class="season-preview-coach-type">Profilo: ${esc(coachProfile().name)}</em></div></div><div class="season-setup-tip secondary">Questi colori verranno usati nei box della tua squadra e sulle maglie dei giocatori posizionati in campo durante il draft e la stagione.</div></aside></div><div class="season-step-actions"><button id="continueIdentity" class="btn primary" type="button">Continua ai moduli →</button></div></section>`:''}
 ${step>=3?`<section class="panel season-setup-step" id="setupFormationStep" data-step-label="Passo 3 di 4"><div class="season-setup-step-head"><span class="season-setup-step-number">3</span><div><h2>Scegli il modulo</h2><p>Il modulo determina gli undici slot da completare e i ruoli richiesti nel draft.</p></div></div><div class="season-formation-grid">${formations.map(form=>`<button type="button" class="season-formation-btn ${state.formation===form?'active':''}" data-form="${form}"><b>${form}</b><small>${esc(formationPositionSummary(form))}</small></button>`).join('')}</div><div class="season-selected-summary"><span>${state.gameMode==='chaos'?'🌀 Caos':'Normale'}</span><span id="setupIdentitySummary">${esc(teamValue)} · ${esc(coachValue)}</span><span>${esc(coachProfile().name)}</span></div></section>`:''}
 ${step>=4?`<section class="panel season-setup-step" id="setupDraftStep" data-step-label="Passo 4 di 4"><div class="season-setup-step-head"><span class="season-setup-step-number">4</span><div><h2>Come vuoi fare il draft?</h2><p>Scegli il controllo completo oppure avvia subito la stagione con una rosa generata casualmente.</p></div></div><div class="season-draft-choice-grid"><button id="startDraft" class="season-draft-choice" type="button"><span class="season-draft-choice-icon">🎯</span><b>Draft manuale</b><p>${coachIs('three-five-two')?'Apri il primo pack club: quel club genera immediatamente i tuoi 14 giocatori, completando casualmente gli eventuali ruoli mancanti.':'Spacchetti i club, scegli ogni giocatore e lo posizioni personalmente in uno slot compatibile. Completi 11 titolari e 3 riserve.'}</p><span>Inizia il draft manuale →</span></button><button id="startRandomDraft" class="season-draft-choice" type="button"><span class="season-draft-choice-icon">🎲</span><b>Draft automatico</b><p>${coachIs('three-five-two')?'Il gioco estrae subito un club e genera i 14 giocatori con le stesse regole del primo pack.':'Il gioco crea subito una rosa casuale. Gli undici titolari rispettano i ruoli del modulo; con Talent scout aumenta la probabilità di ottenere OVR elevati.'}</p><span>Genera e avvia →</span></button></div><div class="season-selected-summary"><span>${state.gameMode==='chaos'?'🌀 Caos':'Normale'}</span><span>${esc(state.formation)}</span><span>${esc(teamValue)}</span><span>${esc(coachProfile().name)}</span></div></section>`:''}
 </div>`;
 const teamInput=document.getElementById('teamName'),coachInput=document.getElementById('coachName');
 const refreshIdentityPreview=()=>{const teamName=String(teamInput?.value||'').trim()||DEFAULT_TEAM_NAME,coachName=String(coachInput?.value||'').trim()||'da inserire';const nameEl=document.getElementById('setupPreviewName'),coachEl=document.getElementById('setupPreviewCoach'),badgeEl=document.getElementById('setupPreviewBadge');if(nameEl)nameEl.textContent=teamName;if(coachEl)coachEl.textContent=`Allenatore: ${coachName}`;if(badgeEl)badgeEl.textContent=setupTeamBadge(teamName)};
 [teamInput,coachInput].filter(Boolean).forEach(input=>input.addEventListener('input',()=>{scheduleSetupIdentitySave(teamInput,coachInput);refreshIdentityPreview()}));
 document.querySelectorAll('[data-game-mode]').forEach(button=>button.onclick=()=>{state.gameMode=button.dataset.gameMode==='chaos'?'chaos':'normal';state.setupStep=Math.max(2,step);save();showSetup();setupScrollTo('setupIdentityStep')});
 document.querySelectorAll('[data-team-palette]').forEach(button=>button.onclick=()=>{persistSetupIdentity(teamInput,coachInput,false);state.teamPaletteId=String(button.dataset.teamPalette||'fantaballa');state.teamColors=teamColorsForPalette(state.teamPaletteId);try{localStorage.setItem(SETUP_PALETTE_KEY,state.teamPaletteId)}catch{}save();showSetup();setupScrollTo('setupIdentityStep')});
 document.querySelectorAll('[data-coach-type]').forEach(button=>{button.onpointerdown=event=>event.preventDefault();button.onclick=event=>{event.preventDefault();const coachScrollTop=window.scrollY;const coachSelectorTop=captureCoachSelectorViewport();persistSetupIdentity(teamInput,coachInput,false);state.coachType=normalizeCoachType(button.dataset.coachType);syncCoachRestrictions();try{localStorage.setItem(SETUP_COACH_TYPE_KEY,state.coachType)}catch{}save();showSetup();restoreSetupScroll(coachScrollTop);restoreCoachSelectorViewport(coachSelectorTop)};button.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();button.click()}}});
 document.querySelectorAll('[data-coach-nav]').forEach(button=>{button.onpointerdown=event=>event.preventDefault();button.onclick=event=>{event.preventDefault();const coachScrollTop=window.scrollY;const coachSelectorTop=captureCoachSelectorViewport();persistSetupIdentity(teamInput,coachInput,false);const direction=Number(button.dataset.coachNav||0)||0;const currentIndex=coachProfileIndex();const nextProfile=COACH_PROFILES[(currentIndex+direction+COACH_PROFILES.length)%COACH_PROFILES.length]||COACH_PROFILES[0];state.coachType=normalizeCoachType(nextProfile.id);syncCoachRestrictions();try{localStorage.setItem(SETUP_COACH_TYPE_KEY,state.coachType)}catch{}save();showSetup();restoreSetupScroll(coachScrollTop);restoreCoachSelectorViewport(coachSelectorTop)}});
 const continueIdentity=document.getElementById('continueIdentity');if(continueIdentity)continueIdentity.onclick=()=>{const teamName=String(teamInput?.value||'').trim(),coachName=String(coachInput?.value||'').trim();if(!teamName||!coachName)return toast('Inserisci sia il nome della squadra sia il nome dell’allenatore.');clearTimeout(setupIdentitySaveTimer);persistSetupIdentity(teamInput,coachInput,false);state.setupStep=3;save();showSetup();setupScrollTo('setupFormationStep')};
 document.querySelectorAll('[data-form]').forEach(button=>button.onclick=()=>{clearTimeout(setupIdentitySaveTimer);persistSetupIdentity(teamInput,coachInput,false);state.formation=coachIs('three-five-two')?'3-5-2':button.dataset.form;state.setupStep=4;save();showSetup();setupScrollTo('setupDraftStep')});
 const beginDraft=automatic=>{clearTimeout(setupIdentitySaveTimer);persistSetupIdentity(teamInput,coachInput,false);if(!String(state.teamName||'').trim()||!String(state.coachName||'').trim())return toast('Completa nome squadra e allenatore prima di iniziare.');state.coachName=String(state.coachName).trim();state.coachType=normalizeCoachType(state.coachType);syncCoachRestrictions();try{localStorage.setItem(SETUP_COACH_NAME_KEY,state.coachName);localStorage.setItem(SETUP_COACH_TYPE_KEY,state.coachType);localStorage.setItem(SETUP_PALETTE_KEY,state.teamPaletteId||'fantaballa')}catch{}if(automatic)return startFullyRandomDraft();state.phase='draft';state.draft=freshState().draft;state.draft.rerolls=initialDraftRerollLimit();save();render()};
 const manual=document.getElementById('startDraft'),automatic=document.getElementById('startRandomDraft');if(manual)manual.onclick=()=>beginDraft(false);if(automatic)automatic.onclick=()=>beginDraft(true);
}


function clubCardRgb(color){
 const value=String(color||'').trim();
 const match=value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
 if(!match)return null;
 let hex=match[1];
 if(hex.length===3)hex=hex.split('').map(char=>char+char).join('');
 return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];
}
function clubCardLuminance(color){
 const rgb=clubCardRgb(color);
 if(!rgb)return .35;
 const linear=rgb.map(channel=>{const value=channel/255;return value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4)});
 return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
}
function clubCardNameTheme(backgroundColor){
 const light=clubCardLuminance(backgroundColor)>.46;
 return light
  ?{ink:'#111111',bg:'rgba(255,255,255,.88)',border:'rgba(17,17,17,.28)',shadow:'0 1px 0 rgba(255,255,255,.8)'}
  :{ink:'#FFFFFF',bg:'rgba(0,0,0,.58)',border:'rgba(255,255,255,.7)',shadow:'0 2px 5px rgba(0,0,0,.72)'};
}

async function playSeasonPackReveal(possibleClubIds,finalClubId,isReroll){
 modalRoot.innerHTML=`<div class="season-pack-reveal" id="seasonPackReveal"><div class="season-pack-stage" role="dialog" aria-live="assertive" aria-label="Apertura pacchetto club campionato"><div class="season-pack-kicker">${esc(SEASON_CONFIG.labels.packKicker)}</div><div class="season-pack-scene" aria-hidden="true"><div class="season-pack-burst"></div><div class="season-pack-card-stack"><div class="season-pack-card-back"></div><div class="season-pack-card-back"></div><div class="season-pack-card-back"></div></div><div class="season-pack-nation-card" id="seasonPackNationCard"><div class="season-pack-card-label" id="seasonPackCardLabel">${isReroll?'Second chance':'Club draft'}</div><div class="season-pack-code" id="seasonPackCode">---</div><div class="season-pack-name" id="seasonPackNation">???</div></div><div class="season-pack-envelope" id="seasonPackEnvelope"><div class="season-pack-lid"></div><div class="season-pack-tear"></div><div class="season-pack-title-badge">FANTABALLA</div><div class="season-pack-seal">⚽</div></div></div><div class="season-pack-caption" id="seasonPackCaption">Scarta il pacchetto...</div></div></div>`;
 const overlay=document.getElementById('seasonPackReveal');
 const label=document.getElementById('seasonPackNation');
 const code=document.getElementById('seasonPackCode');
 const card=document.getElementById('seasonPackNationCard');
 const caption=document.getElementById('seasonPackCaption');
 const cardLabel=document.getElementById('seasonPackCardLabel');
 const applyClub=clubId=>{
   const club=clubById(clubId)||{name:'???',shortName:'---',colorClub:{}};
   const pal=clubPalette(club);
   applyPackNationLabel(label,club.name);
   code.textContent=String(club.shortName||club.name.slice(0,3)).toUpperCase();
   card.style.background=`linear-gradient(135deg,${pal.primary} 0 48%,${pal.secondary} 48% 78%,${pal.accent} 78% 100%)`;
   const nameTheme=clubCardNameTheme(pal.accent);
   card.style.color=nameTheme.ink;
   card.style.setProperty('--pack-name-ink',nameTheme.ink);
   card.style.setProperty('--pack-name-bg',nameTheme.bg);
   card.style.setProperty('--pack-name-border',nameTheme.border);
   card.style.setProperty('--pack-name-shadow',nameTheme.shadow);
   return club;
 };
 cardLabel.textContent=isReroll?'Second chance':'Club draft';
 overlay.classList.add('show');
 void overlay.offsetWidth;
 overlay.classList.add('opening');
 for(let i=0;i<10;i++){
   applyClub(pick(possibleClubIds));
   caption.innerHTML=i<4?'Strappa il bordo...':i<8?'Le figurine stanno uscendo...':'Reveal finale...';
   await waitDraft(80+i*14)
 }
 overlay.classList.remove('opening');
 overlay.classList.add('bursting');
 await waitDraft(360);
 const finalClub=applyClub(finalClubId);
 overlay.classList.add('show-result');
 caption.innerHTML=`<strong>${esc(finalClub.name)}</strong> è il club pescato`;
 await waitDraft(1180);
 modalRoot.innerHTML='';
}
async function drawDraft(useReroll=false){
 if(draftRolling||draftComplete())return;
 primeDraftAudio();
 const savedScrollY=window.scrollY;
 if(useReroll){
   if(state.draft.rerolls<=0)return toast('Re-roll terminati');
   if(state.draft.rerolls===1){const confirmed=await openConfirm({title:'Ultimo re-roll',message:'Questo è l’ultimo re-roll disponibile. Vuoi cambiare davvero il club?',confirmText:'Usa l’ultimo re-roll'});if(!confirmed)return;}
   state.draft.rerolls--
 }
 const possibleBase=draftPossibleClubs();
 const possible=useReroll&&possibleBase.length>1?possibleBase.filter(id=>id!==state.draft.clubId):possibleBase;
 if(!possible.length)return toast('Non ci sono più giocatori validi per gli slot rimasti.');
 const openingClubId=!useReroll?talentScoutOpeningClub(possible):'';
 const finalClubId=openingClubId||(coachIs('talent-scout')?coachHighOvrPick(possible.map(id=>{const candidates=draftCandidatesForClub(id),quality=candidates.length?Math.max(...candidates.map(player=>Number(player.ovr)||0)):0;return{id,ovr:quality}}))?.id:pick(possible));
 const finalClub=clubById(finalClubId);
 draftRolling=true;
 state.draft.pendingPlayerId='';
 state.draft.candidates=[];
 save();
 playDraftPackSound();
 document.querySelectorAll('#draftRollBtn,#draftRollBtnCenter').forEach(button=>{
   button.disabled=true;
   button.setAttribute('aria-busy','true');
 });
 try{
   await playSeasonPackReveal(possible,finalClubId,useReroll);
   if(coachIs('three-five-two')&&!state.draft.roster.length&&!useReroll){
     if(!buildThreeFiveTwoOpeningRoster(finalClubId))throw new Error(`Impossibile generare la rosa 3-5-2 da ${finalClub?.name||finalClubId}`);
     draftRolling=false;
     save();
     render();
     toast(`3-5-2: ${finalClub?.name||'il primo club'} ha generato automaticamente la rosa di 14 giocatori.`);
     return;
   }
   const drawn=draftCandidatesForClub(finalClubId);
   state.draft.clubId=finalClubId;
   state.draft.openingClubShown=true;
   state.draft.candidates=drawn.map(player=>String(player.id));
   if(!state.draft.candidates.length)throw new Error(`Nessun giocatore disponibile per ${finalClub?.name||finalClubId}`);
   mobileDraftTab='players';
   draftRolling=false;
   save();
   render();
   animateDraftCandidateReveal(drawn);
   requestAnimationFrame(()=>window.scrollTo({top:savedScrollY,left:0,behavior:'auto'}));
 }catch(error){
   console.error('Errore apertura pack club campionato',error);
   modalRoot.innerHTML='';
   state.draft.clubId='';
   state.draft.candidates=[];
   if(useReroll)state.draft.rerolls=Math.min(initialDraftRerollLimit(),state.draft.rerolls+1);
   draftRolling=false;
   save();
   render();
   requestAnimationFrame(()=>window.scrollTo({top:savedScrollY,left:0,behavior:'auto'}));
   toast('Errore durante il pack. Riprova senza perdere il re-roll.');
 }
}
function selectDraftCandidate(id){if(draftRolling||draftComplete())return;const p=playerById(id);if(!draftPlayerIsValid(p))return toast('Giocatore non compatibile con gli slot rimasti.');const selecting=state.draft.pendingPlayerId!==String(id);state.draft.pendingPlayerId=selecting?String(id):'';if(selecting)mobileDraftTab='field';save();render()}
function placeDraftStarter(slotId){
 const player=playerById(state.draft.pendingPlayerId),slot=formationSlots().find(s=>s.instanceId===slotId);
 if(!player||!slot||!availableStarterSlotsForPlayer(player).some(s=>s.instanceId===slotId))return;
 if(lastPlacedDraftTimer){clearTimeout(lastPlacedDraftTimer);lastPlacedDraftTimer=null}
 lastPlacedDraftSlotId=slot.instanceId;
 state.draft.roster.push({playerId:String(player.id),slotId:slot.instanceId,slot:slot.code,bench:false,player:{...player}});
 finishDraftPlacement(true)
}
function placeDraftBench(slotId){
 const player=playerById(state.draft.pendingPlayerId);
 if(!player||usedDraftPlayerIds().has(String(player.id)))return;
 const index=Number(String(slotId).replace(/\D/g,''));
 if(!index||state.draft.roster.some(r=>r.bench&&r.slotId===slotId)||benchEntries().length>=3)return;
 state.draft.roster.push({playerId:String(player.id),slotId,slot:`PAN${index}`,bench:true,player:{...player}});
 finishDraftPlacement(false)
}
function finishDraftPlacement(showPitchAnimation=false){
 state.draft.pendingPlayerId='';
 state.draft.clubId='';
 state.draft.candidates=[];
 mobileDraftTab=showPitchAnimation?'pitch':(draftComplete()?'roster':'players');
 save();
 render();
 if(showPitchAnimation&&lastPlacedDraftSlotId){
   const placedId=lastPlacedDraftSlotId;
   lastPlacedDraftTimer=setTimeout(()=>{
     document.querySelectorAll('.season-field-slot.just-placed').forEach(element=>element.classList.remove('just-placed'));
     if(lastPlacedDraftSlotId===placedId)lastPlacedDraftSlotId='';
     lastPlacedDraftTimer=null;
   },900)
 }
 if(draftComplete())toast('Rosa completa: 11 titolari + 3 riserve.')
}
async function resetSeasonDraft(){
 const confirmed=await openConfirm({title:'Azzera il draft',message:'La rosa scelta verrà cancellata, ma squadra, allenatore e modulo resteranno invariati.',confirmText:'Azzera draft',danger:true});if(!confirmed)return;
 if(lastPlacedDraftTimer){clearTimeout(lastPlacedDraftTimer);lastPlacedDraftTimer=null}
 lastPlacedDraftSlotId='';
 state.draft=freshState().draft;
 state.draft.rerolls=initialDraftRerollLimit();
 mobileDraftTab='players';
 save();
 render()
}
async function backToSeasonSetup(){
 if(state.draft.roster.length){const confirmed=await openConfirm({title:'Torna al modulo',message:'Il draft attuale verrà cancellato. Squadra e allenatore resteranno salvati.',confirmText:'Torna al modulo',danger:true});if(!confirmed)return;}
 if(lastPlacedDraftTimer){clearTimeout(lastPlacedDraftTimer);lastPlacedDraftTimer=null}
 lastPlacedDraftSlotId='';
 state.phase='setup';
 state.draft=freshState().draft;
 state.draft.rerolls=initialDraftRerollLimit();
 save();
 render()
}

function renderSeasonPitch(){
 const assigned=new Map(starterEntries().map(r=>[String(r.slotId),r]));
 const pending=playerById(state.draft.pendingPlayerId);
 const available=new Set(pending?availableStarterSlotsForPlayer(pending).map(s=>s.instanceId):[]);
 const chemistry=draftChemistry();
 return `<div class="season-pitch-panel"><div class="season-pitch-title"><b>Formazione ${esc(state.formation)}</b><span>Regole Gary MEDel · Position precise</span></div><div class="season-pitch-shell">${renderPitchBoardStrip()}<div class="season-pitch-middle">${renderPitchBoardSide('left')}<div class="season-pitch-wrap"><svg class="season-pitch-svg" viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true"><rect x="0.8" y="0.8" width="98.4" height="118.4" fill="none" stroke="rgba(255,255,255,.8)" stroke-width=".8"/><rect x="21" y="1" width="58" height="18" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".6"/><rect x="34" y="1" width="32" height="8" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><rect x="43" y="1" width="14" height="3" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".5"/><rect x="21" y="101" width="58" height="18" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".6"/><rect x="34" y="111" width="32" height="8" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><rect x="43" y="116" width="14" height="3" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".5"/><line x1="0.8" y1="60" x2="99.2" y2="60" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><circle cx="50" cy="60" r="12.2" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><circle cx="50" cy="60" r=".7" fill="rgba(255,255,255,.75)"/><circle cx="50" cy="18" r=".7" fill="rgba(255,255,255,.75)"/><circle cx="50" cy="102" r=".7" fill="rgba(255,255,255,.75)"/><path d="M40,19 A10,10 0 0 0 60,19" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><path d="M40,101 A10,10 0 0 1 60,101" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><path d="M0.8,5 A4,4 0 0 0 4.8,0.8" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><path d="M99.2,5 A4,4 0 0 1 95.2,0.8" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><path d="M0.8,115 A4,4 0 0 1 4.8,119.2" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><path d="M99.2,115 A4,4 0 0 0 95.2,119.2" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/></svg>${formationSlots().map(slot=>{const entry=assigned.get(slot.instanceId),isAvailable=available.has(slot.instanceId);const sub=entry&&isSubscriber(entry.player),creator=entry&&isCreator(entry.player);const chemBonus=entry?(chemistry.playerBonus[String(entry.player.id)]||0):0;return `<button type="button" class="season-field-slot ${entry?'filled':''} ${isAvailable?'available':''} ${sub?'subscriber-player':''} ${creator?'creator-player':''} ${slot.instanceId===lastPlacedDraftSlotId?'just-placed':''}" data-starter-slot="${slot.instanceId}" data-position="${slot.code}" style="left:${slot.x}%;top:${slot.y}%">${entry?`${renderPlayerJersey(entry.player,'',chemBonus)}<span class="season-slot-name">${sub?'<span class="season-field-sub-star">★</span>':''}${creator?'<span class="season-inline-creator">CR</span>':''}${esc(entry.player.name)}</span><span class="season-slot-role">${esc(slot.code)}</span><span class="season-slot-chem ${chemBonus>0?'positive':''}">${formatSignedIntesa(chemBonus)} INT</span>`:`<span class="season-slot-badge">${esc(slot.code)}</span><span class="season-slot-name">${esc(slot.code)}</span>`}</button>`}).join('')}</div>${renderPitchBoardSide('right')}</div>${renderPitchBoardStrip()}</div><div class="season-pitch-help">${pending?`Hai scelto <b>${esc(pending.name)}</b>: clicca uno degli slot illuminati compatibili oppure una casella panchina.`:'Rolla un club, scegli un giocatore e poi clicca uno slot del campo o della panchina.'}</div>${renderSeasonBench()}</div>`
}
function renderSeasonBench(){
 const bench=benchEntries(),pending=playerById(state.draft.pendingPlayerId);
 return `<div class="season-bench"><div class="season-bench-head"><span>Panchina</span><span>${bench.length}/3 riserve</span></div><div class="season-bench-grid">${[1,2,3].map(i=>{const id=`bench-${i}`,entry=bench.find(r=>r.slotId===id),available=Boolean(pending&&!entry&&bench.length<3),sub=entry&&isSubscriber(entry.player),creator=entry&&isCreator(entry.player);return `<button type="button" class="season-bench-slot ${entry?'filled':''} ${available?'available':''} ${sub?'subscriber':''} ${creator?'creator':''}" data-bench-slot="${id}">${entry?`<span class="season-bench-player">${renderMiniAvatar(entry.player,'bench')}<span class="season-bench-copy"><b>${sub?'<span class="season-inline-sub-star">★</span>':''}${creator?'<span class="season-inline-creator">CR</span>':''}${esc(entry.player.name)}</b><small>${esc(entry.player.Position)} · OVR ${esc(entry.player.ovr)}</small></span></span>`:`<span>Riserva ${i}</span><small>${available?'Clicca per mandare il giocatore selezionato in panchina':'Slot libero di panchina'}</small>`}</button>`}).join('')}</div></div>`
}


function draftRarityMeta(ovr){
 const value=Number(ovr)||0;
 if(value>=85)return {key:'icon',label:'Icona',sound:4};
 if(value>=80)return {key:'elite',label:'Élite',sound:3};
 if(value>=75)return {key:'gold',label:'Oro',sound:2};
 if(value>=70)return {key:'silver',label:'Argento',sound:1};
 if(value>=65)return {key:'bronze',label:'Bronzo',sound:0};
 return {key:'common',label:'Comune',sound:0};
}
let draftAudioContext=null;
function primeDraftAudio(){
 try{
   const AudioContextClass=window.AudioContext||window.webkitAudioContext;
   if(!AudioContextClass)return null;
   if(!draftAudioContext)draftAudioContext=new AudioContextClass();
   if(draftAudioContext.state==='suspended')draftAudioContext.resume().catch(()=>{});
   return draftAudioContext;
 }catch(error){return null}
}
function draftTone(frequency,start,duration,volume=.035,type='sine'){
 const context=primeDraftAudio();
 if(!context)return;
 const oscillator=context.createOscillator();
 const gain=context.createGain();
 oscillator.type=type;
 oscillator.frequency.setValueAtTime(frequency,start);
 gain.gain.setValueAtTime(.0001,start);
 gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),start+.018);
 gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
 oscillator.connect(gain);gain.connect(context.destination);
 oscillator.start(start);oscillator.stop(start+duration+.025);
}
function playDraftPackSound(){
 const context=primeDraftAudio();if(!context)return;
 const now=context.currentTime+.02;
 draftTone(150,now,.20,.025,'triangle');
 draftTone(230,now+.12,.22,.028,'triangle');
 draftTone(340,now+.25,.28,.032,'sine');
}
function playDraftRaritySound(ovr){
 const context=primeDraftAudio();if(!context)return;
 const tier=draftRarityMeta(ovr).sound;
 if(tier<2)return;
 const now=context.currentTime+.015;
 if(tier===2){draftTone(523.25,now,.18,.03);draftTone(659.25,now+.12,.24,.032);return}
 if(tier===3){draftTone(392,now,.18,.035,'triangle');draftTone(523.25,now+.11,.22,.038,'triangle');draftTone(783.99,now+.24,.34,.042,'sine');return}
 draftTone(392,now,.20,.04,'triangle');draftTone(523.25,now+.09,.24,.042,'triangle');draftTone(659.25,now+.19,.28,.045,'triangle');draftTone(1046.5,now+.34,.48,.052,'sine');
}
function animateDraftCandidateReveal(players){
 const cards=[...document.querySelectorAll('.season-candidate[data-candidate]')];
 if(!cards.length)return;
 const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(reduced)return;
 cards.forEach(card=>card.classList.add('pack-hidden'));
 void cards[0].offsetWidth;
 cards.forEach((card,index)=>{
   setTimeout(()=>{
     card.classList.remove('pack-hidden');
     card.classList.add('pack-revealed');
     const ovr=Number(card.dataset.ovr)||0;
     if(ovr>=75)playDraftRaritySound(ovr);
     setTimeout(()=>card.classList.remove('pack-revealed'),900);
   },120+index*105);
 });
}


function animateMidseasonCandidateReveal(){
 const cards=[...document.querySelectorAll('.midseason-market-player[data-market]')];
 if(!cards.length||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 cards.forEach(card=>{card.classList.add('pack-hidden');card.style.opacity='0';card.style.transform='translateY(14px) scale(.95)'});
 void cards[0].offsetWidth;
 cards.forEach((card,index)=>setTimeout(()=>{
   card.classList.remove('pack-hidden');card.style.opacity='';card.style.transform='';card.classList.add('pack-revealed');
   const ovr=Number(card.dataset.ovr)||0;if(ovr>=75)playDraftRaritySound(ovr);
   setTimeout(()=>card.classList.remove('pack-revealed'),900);
 },100+index*150));
}

function draftCandidateOvrStyle(ovr){
 const value=Math.max(40,Math.min(99,Number(ovr)||40));
 const ratio=Math.max(0,Math.min(1,(value-50)/49));
 const lightness=Math.round(94-ratio*54);
 const saturation=Math.round(34+ratio*38);
 const borderLightness=Math.max(26,lightness-11);
 const dark=lightness<60;
 const veryDark=lightness<47;
 const text=dark?'#ffffff':'#10243a';
 const chipBg=dark?'rgba(255,255,255,.17)':'rgba(255,255,255,.72)';
 const chipText=dark?'#ffffff':'#10243a';
 const positionBg=dark?'rgba(255,233,108,.22)':'rgba(231,216,248,.94)';
 const positionText=dark?'#fff4b0':'#542b82';
 const subBg=dark?'rgba(221,201,255,.24)':'rgba(217,199,255,.95)';
 const subText=dark?'#f5eaff':'#402062';
 const avatarBg=veryDark?'linear-gradient(145deg,#0c1725,#172e49)':dark?'linear-gradient(145deg,#2d1f4d,#10243a)':'linear-gradient(145deg,#304f70,#10243a)';
 const ovrBg=dark?'#ffe96c':'#10243a';
 const ovrText=dark?'#10243a':'#ffffff';
 return `--candidate-bg:hsl(207 ${saturation}% ${lightness}%);--candidate-border:hsl(207 ${Math.min(82,saturation+8)}% ${borderLightness}%);--candidate-text:${text};--candidate-chip-bg:${chipBg};--candidate-chip-text:${chipText};--candidate-position-bg:${positionBg};--candidate-position-text:${positionText};--candidate-sub-bg:${subBg};--candidate-sub-text:${subText};--candidate-avatar-bg:${avatarBg};--candidate-avatar-text:#fff;--candidate-ovr-bg:${ovrBg};--candidate-ovr-text:${ovrText};--candidate-ovr-border:${dark?'rgba(16,36,58,.2)':'rgba(255,255,255,.28)'};--candidate-shadow:${dark?'0 1px 2px rgba(0,0,0,.26)':'none'}`;
}

function renderDraftCandidates(){
 if(draftRolling)return '<div class="season-empty">Apertura del pacchetto club…</div>';
 if(!state.draft.clubId)return '<div class="season-empty">Premi <b>Apri pack club</b>. Verranno mostrati tutti i giocatori compatibili appartenenti al club estratto. Più l’OVR è alto, più il box diventa scuro.</div>';
 const candidates=sortPlayersByRole(state.draft.candidates.map(playerById).filter(Boolean));
 if(!candidates.length)return '<div class="season-empty">Nessun giocatore valido in questo club. Usa il re-roll.</div>';
 return candidates.map((p,index)=>{const ovr=Math.max(0,Math.min(100,Number(p.ovr)||0));const sub=isSubscriber(p),creator=isCreator(p);const chemPreview=draftCandidateChemPreview(p);const rarity=draftRarityMeta(p.ovr);return `<button type="button" class="season-candidate rarity-${rarity.key} ${sub?'subscriber':''} ${creator?'creator':''} ${state.draft.pendingPlayerId===String(p.id)?'active':''}" data-candidate="${esc(p.id)}" data-ovr="${ovr}" style="${draftCandidateOvrStyle(p.ovr)}" aria-label="${esc(p.name)}, overall ${esc(p.ovr)}, rarità ${esc(rarity.label)}, intesa ${chemPreview}"><span class="season-candidate-rank">#${index+1}</span>${renderMiniAvatar(p)}<span class="season-candidate-body"><span class="season-candidate-name">${esc(p.name)}</span><span class="season-candidate-meter" aria-hidden="true"><i style="width:${ovr}%"></i></span><span class="season-candidate-meta"><span class="season-chip position">${esc(p.Position)}</span><span class="season-rarity-badge">${esc(rarity.label)}</span>${sub?'<span class="season-chip sub">ABBONATO</span>':''}${creator?'<span class="season-chip creator">CREATOR</span>':''}<span class="season-chip chemistry ${benchDraftPhase()?'bench':''}">${benchDraftPhase()?'PAN':`${formatSignedIntesa(chemPreview)} INT`}</span></span></span><span class="season-chip ovr">${esc(p.ovr)}</span></button>`}).join('')
}
function renderRosterMini(){
 const rows=rosterPlayers();
 if(state.phase==='draft'){
   const starters=starterEntries();
   const bench=benchEntries();
   const chemistry=draftChemistry(starters);
   const slotRows=formationSlots().map(slot=>({slot:slot.code,slotId:slot.instanceId,bench:false,entry:starters.find(r=>String(r.slotId)===String(slot.instanceId))||null}));
   const benchRows=[1,2,3].map(i=>({slot:`PAN${i}`,slotId:`bench-${i}`,bench:true,entry:bench.find(r=>String(r.slotId)===`bench-${i}`)||null}));
   return `<div class="season-roster-mini">${slotRows.concat(benchRows).map(row=>{const entry=row.entry;const sub=entry&&isSubscriber(entry.player),creator=entry&&isCreator(entry.player);const chemBonus=entry&&!row.bench?(chemistry.playerBonus[String(entry.player.id)]||0):null;return `<div class="season-roster-line ${row.bench?'bench':''} ${entry?'filled':'empty'} ${sub?'subscriber':''} ${creator?'creator':''}"><span class="season-roster-slot">${esc(row.slot)}</span>${entry?renderMiniAvatar(entry.player,'small'):''}<div class="season-roster-player">${entry?`<b>${sub?'<span class="season-inline-sub-star">★</span>':''}${creator?'<span class="season-inline-creator">CR</span>':''}${esc(entry.player.name)}</b><small>${esc(entry.player.nation)} · ${esc(entry.player.Position)}${chemBonus!==null?` · <span class="season-roster-chem">${formatSignedIntesa(chemBonus)} INT</span>`:''}</small>`:`<b>—</b><small>${row.bench?'Riserva da scegliere':'Slot disponibile'}</small>`}</div><span class="season-roster-ovr">${entry?esc(entry.player.ovr):'—'}</span></div>`}).join('')}</div>`;
 }
 return `<div class="roster-list">${rows.length?rows.map(r=>`<div class="roster-row ${r.bench?'bench':''}"><span class="slot-code">${esc(r.slot)}</span>${renderMiniAvatar(r.player,'small')}<div><b>${esc(r.player.name)}</b><small>${esc(r.player.nation)} · ${esc(r.player.Position)}</small></div><span class="chip ovr">${r.player.ovr}</span></div>`).join(''):'<p>Nessun giocatore scelto.</p>'}</div>`
}
function renderSeasonRosterField(){
 const starters=starterEntries();
 const bench=benchEntries();
 const chemistry=draftChemistry(starters),resolvedLineup=resolveLineup();
 const assigned=new Map(starters.map(r=>[String(r.slotId),r]));
 const slots=formationSlots();
 const starterTarget=seasonStarterTarget(),benchTarget=seasonBenchTarget(),benchNumbers=seasonBenchNumbers();
 const avgOverall=resolvedLineup.length?resolvedLineupAverage(resolvedLineup).toFixed(1):'—',emergencyYouthCount=resolvedLineup.filter(isEmergencyYouthEntry).length;
 const benchMarkup=benchTarget?`<div class="season-roster-bench-wrap"><div class="season-roster-bench-title">Panchina</div><div class="season-roster-bench-grid">${benchNumbers.map(i=>{const entry=bench.find(r=>String(r.slotId)===`bench-${i}`);const sub=entry&&isSubscriber(entry.player),creator=entry&&isCreator(entry.player);return `<div class="season-roster-bench-card ${entry?'filled':''} ${sub?'subscriber':''} ${creator?'creator':''}">${entry?`${renderMiniAvatar(entry.player,'small')}<div class="season-roster-bench-copy"><b>${sub?'<span class="season-inline-sub-star">★</span>':''}${creator?'<span class="season-inline-creator">CR</span>':''}${esc(entry.player.name)}</b><small>${esc(entry.player.nation)} · ${esc(entry.player.Position)}</small></div><span class="season-roster-ovr">${esc(entry.player.ovr)}</span>`:`<b>Riserva ${i}</b><small>Slot panchina vuoto</small>`}</div>`}).join('')}</div></div>`:`<div class="season-roster-bench-wrap"><div class="season-roster-bench-title">Panchina</div><div class="season-empty">La regola ${esc(state.formation)} porta tutti i 14 giocatori in campo: nessun panchinaro disponibile.</div></div>`;
 return `<div class="season-roster-board"><div class="season-roster-board-head"><div><div class="label">Rosa titolare</div><h3>Modulo ${esc(state.formation)}</h3></div><div class="season-roster-board-meta"><span class="season-board-pill">OVR partita ${avgOverall}</span><span class="season-board-pill">Intesa ${chemistry.score}/100</span>${emergencyYouthCount?`<span class="season-board-pill">Primavera ${emergencyYouthCount}</span>`:``}<span class="season-board-pill">${starters.length}/${starterTarget} titolari</span><span class="season-board-pill">${bench.length}/${benchTarget} riserve</span></div></div><div class="season-roster-shell">${renderPitchBoardStrip()}<div class="season-roster-middle">${renderPitchBoardSide('left')}<div class="season-roster-pitch"><svg class="season-pitch-svg" viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true"><rect x="1" y="1" width="98" height="118" fill="none" stroke="rgba(255,255,255,.8)" stroke-width=".8"/><rect x="21" y="1" width="58" height="18" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".6"/><rect x="34" y="1" width="32" height="8" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><rect x="21" y="101" width="58" height="18" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".6"/><rect x="34" y="111" width="32" height="8" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><line x1="1" y1="60" x2="99" y2="60" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><circle cx="50" cy="60" r="12" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/></svg>${slots.map(slot=>{const entry=assigned.get(String(slot.instanceId));if(!entry)return `<div class="season-roster-field-slot empty" style="left:${slot.x}%;top:${slot.y}%"><span class="season-slot-badge">${esc(slot.code)}</span><span class="season-slot-name">${esc(slot.code)}</span></div>`;const sub=isSubscriber(entry.player),creator=isCreator(entry.player);const chemBonus=chemistry.playerBonus[String(entry.player.id)]||0;const portsZero=closedPortsAffects(entry.player);return `<div class="season-roster-field-slot filled ${sub?'subscriber-player':''} ${creator?'creator-player':''}" style="left:${slot.x}%;top:${slot.y}%">${renderPlayerJersey(entry.player,'',chemBonus)}<span class="season-slot-name">${sub?'<span class="season-field-sub-star">★</span>':''}${creator?'<span class="season-inline-creator">CR</span>':''}${esc(entry.player.name)}</span><span class="season-slot-role">${esc(slot.code)}</span><span class="season-slot-chem ${portsZero?'zeroed':chemBonus>0?'positive':''}">${portsZero?'⛔ 0 INT':`${formatSignedIntesa(chemBonus)} INT`}</span></div>`}).join('')}</div>${renderPitchBoardSide('right')}</div>${renderPitchBoardStrip()}</div>${benchMarkup}</div>`
}

function setMobileDraftTab(tab,scrollToTabs=true){
 const allowed=['players','field','roster'];
 mobileDraftTab=allowed.includes(tab)?tab:'players';
 document.querySelectorAll('[data-mobile-tab]').forEach(button=>{
   const active=button.dataset.mobileTab===mobileDraftTab;
   button.classList.toggle('active',active);
   button.setAttribute('aria-selected',active?'true':'false');
   button.tabIndex=active?0:-1;
 });
 document.querySelectorAll('[data-mobile-pane]').forEach(panel=>{
   const active=panel.dataset.mobilePane===mobileDraftTab;
   panel.classList.toggle('mobile-active',active);
   panel.hidden=false;
   const mobile=window.matchMedia('(max-width:860px)').matches;
   panel.setAttribute('aria-hidden',mobile&&!active?'true':'false');
 });
 if(scrollToTabs&&window.matchMedia('(max-width:860px)').matches){
   const tabs=document.getElementById('seasonMobileTabs');
   if(tabs)tabs.scrollIntoView({behavior:'smooth',block:'start'});
 }
}
function bindMobileDraftTabs(){
 document.querySelectorAll('[data-mobile-tab]').forEach(button=>{
   button.onclick=()=>setMobileDraftTab(button.dataset.mobileTab,true);
   button.onkeydown=event=>{
     if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
     event.preventDefault();
     const order=['players','field','roster'];
     let index=order.indexOf(mobileDraftTab);
     if(event.key==='ArrowLeft')index=(index+order.length-1)%order.length;
     if(event.key==='ArrowRight')index=(index+1)%order.length;
     if(event.key==='Home')index=0;
     if(event.key==='End')index=order.length-1;
     setMobileDraftTab(order[index],false);
     document.querySelector(`[data-mobile-tab="${order[index]}"]`)?.focus();
   };
 });
 setMobileDraftTab(mobileDraftTab,false);
}

function showDraft(){
 state=normalizeCampionatoState(state);
 const starters=starterEntries().length;
 const bench=benchEntries().length;
 const total=starters+bench;
 const hasPack=state.draft.candidates.length>0;
 const draftRerollLimit=initialDraftRerollLimit();
 const canReroll=hasPack&&state.draft.rerolls>0&&!draftComplete();
 const chemistry=draftChemistry();
 const effectiveAverage=draftEffectiveAverageOvr(chemistry);
 const rollDisabled=draftRolling||draftComplete()||(hasPack&&!canReroll);
 const rerollWord=state.draft.rerolls===1?'RE-ROLL DISPONIBILE':'RE-ROLL DISPONIBILI';
 const rollText=draftRolling?'Apertura pack…':!hasPack?'Rolla il club 🎲':state.draft.rerolls>0?`Re-rolla · ${state.draft.rerolls} rimasti 🎲`:'Re-roll terminati';
 const centerRollTitle=draftRolling?'APERTURA PACK…':!hasPack?'ROLLA IL CLUB':state.draft.rerolls>0?'RE-ROLLA IL CLUB':'RE-ROLL TERMINATI';
 const centerRollSub=draftRolling?'Sto aprendo il pacchetto club':!hasPack?`Estrai uno dei ${CLUBS.length} club`:state.draft.rerolls>0?`${state.draft.rerolls} ${rerollWord}`:'Scegli uno dei giocatori già estratti';
 const currentDrawClub=drawnClub();
 const drawPal=clubPalette(currentDrawClub||activeUserClub());
 const drawStyle=`--draw-a:${drawPal.a};--draw-b:${drawPal.b};--draw-c:${drawPal.c};--draw-ink:${drawPal.ink}`;
 screen.innerHTML=`<div class="season-draft-page">
   <nav class="season-mobile-tabs" id="seasonMobileTabs" role="tablist" aria-label="Sezioni draft">
     <button type="button" class="season-mobile-tab ${mobileDraftTab==='players'?'active':''}" id="seasonMobilePlayers" data-mobile-tab="players" role="tab" aria-controls="seasonPlayersPane" aria-selected="${mobileDraftTab==='players'?'true':'false'}"><span class="season-mobile-tab-icon" aria-hidden="true">👥</span><span>Giocatori</span><b>${state.draft.candidates.length||0}</b></button>
     <button type="button" class="season-mobile-tab ${mobileDraftTab==='field'?'active':''}" id="seasonMobileField" data-mobile-tab="field" role="tab" aria-controls="seasonFieldPane" aria-selected="${mobileDraftTab==='field'?'true':'false'}"><span class="season-mobile-tab-icon" aria-hidden="true">⚽</span><span>Campo</span><b>${starters}/11</b>${state.draft.pendingPlayerId?'<i class="season-mobile-tab-alert" aria-label="Giocatore da posizionare"></i>':''}</button>
     <button type="button" class="season-mobile-tab ${mobileDraftTab==='roster'?'active':''}" id="seasonMobileRoster" data-mobile-tab="roster" role="tab" aria-controls="seasonRosterPane" aria-selected="${mobileDraftTab==='roster'?'true':'false'}"><span class="season-mobile-tab-icon" aria-hidden="true">📋</span><span>Rosa</span><b>${total}/14</b></button>
   </nav>
   <div class="season-draft-shell">
     <aside id="seasonPlayersPane" class="season-draft-panel season-draft-panel-left season-mobile-pane ${mobileDraftTab==='players'?'mobile-active':''}" data-mobile-pane="players" role="tabpanel" aria-labelledby="seasonMobilePlayers">
       <div class="season-draft-identity"><div><span>Squadra</span><b>${esc(state.teamName)}</b></div><div><span>Allenatore</span><b>${esc(state.coachName)} · ${esc(coachProfile().name)}</b></div></div>
       <div class="season-draw-card" style="${drawStyle}"><div class="season-draw-head"><span class="season-draw-mini">Drawn</span><span class="season-draw-pick">Pick ${String(Math.min(14,total+1)).padStart(2,'0')}</span></div><div class="season-draw-row"><div class="season-draw-copy"><div class="season-draw-nation" title="${currentDrawClub?esc(currentDrawClub.name):'Apri il pack'}">${currentDrawClub?esc(currentDrawClub.name):'Apri il pack'}</div></div></div></div>
       <div class="season-roll-actions"><button id="draftRollBtn" class="season-roll-btn" ${rollDisabled?'disabled':''}>${rollText}</button><button id="resetDraftBtnDesktop" class="season-roll-reset" type="button">↺ Reset draft</button></div>
       <div class="season-reroll-note ${hasPack?'active-reroll':'first-roll'}">${hasPack?(state.draft.rerolls>0?`Ti restano ${state.draft.rerolls} re-roll su ${draftRerollLimit}. · `:'Hai terminato i re-roll. · '):''}Le riserve possono essere scelte in qualsiasi momento.</div>
       <div class="season-candidates-head"><span>Scegli un giocatore</span><span>${state.draft.candidates.length||0} validi</span></div>
       <div class="season-candidate-list">${renderDraftCandidates()}</div>
     </aside>
     <main id="seasonFieldPane" aria-labelledby="seasonMobileField" class="season-draft-main season-mobile-pane ${mobileDraftTab==='field'?'mobile-active':''}" data-mobile-pane="field" role="tabpanel">
       <button id="draftRollBtnCenter" class="season-roll-btn season-roll-btn-center ${hasPack?'is-reroll':'is-first-roll'}" ${rollDisabled?'disabled':''} aria-label="${esc(centerRollTitle)}. ${esc(centerRollSub)}"><span class="season-roll-main">${centerRollTitle} <span aria-hidden="true">🎲</span></span><span class="season-roll-sub">${centerRollSub}</span></button>
       ${renderSeasonPitch()}
     </main>
     <aside id="seasonRosterPane" aria-labelledby="seasonMobileRoster" class="season-draft-panel season-draft-panel-right season-mobile-pane ${mobileDraftTab==='roster'?'mobile-active':''}" data-mobile-pane="roster" role="tabpanel">
       <div class="season-box-score-head"><div><strong>Box score · ${starters}/11</strong><small class="season-box-score-label">Overall medio titolari</small></div><span class="season-box-score-number">${starters?Math.round(effectiveAverage):0}</span></div>
       ${renderRosterMini()}
       ${draftComplete()?`<div class="season-draft-complete"><h3>Rosa pronta</h3><div>11 titolari e 3 riserve selezionati con regole Gary MEDel.</div><button id="startSeasonBtn" class="btn primary">Inizia il campionato</button></div>`:''}
     </aside>
   </div>
 </div>`;
 bindMobileDraftTabs();
 document.querySelectorAll('[data-candidate]').forEach(button=>button.onclick=()=>selectDraftCandidate(button.dataset.candidate));
 document.querySelectorAll('.season-field-slot.available').forEach(button=>button.onclick=()=>placeDraftStarter(button.dataset.starterSlot));
 document.querySelectorAll('.season-bench-slot.available').forEach(button=>button.onclick=()=>placeDraftBench(button.dataset.benchSlot));
 const roll=document.getElementById('draftRollBtn');if(roll)roll.onclick=()=>drawDraft(hasPack);
 const rollCenter=document.getElementById('draftRollBtnCenter');if(rollCenter)rollCenter.onclick=()=>drawDraft(hasPack);
 const reset=document.getElementById('resetDraftBtn');if(reset)reset.onclick=resetSeasonDraft;
 const resetDesktop=document.getElementById('resetDraftBtnDesktop');if(resetDesktop)resetDesktop.onclick=resetSeasonDraft;
 const back=document.getElementById('backSetupBtn');if(back)back.onclick=()=>{state.phase='setup';save();render()};
 const start=document.getElementById('startSeasonBtn');if(start)start.onclick=finalizeDraft;
 if(draftComplete())setMobileDraftTab('roster',false);
 else if(state.draft.pendingPlayerId&&window.matchMedia('(max-width:860px)').matches)setMobileDraftTab('field',false);
 else if(!window.matchMedia('(max-width:860px)').matches){
   mobileDraftTab='players';
 }
}

function buildClubRoster(clubId,excludedIds=[]){
 const excluded=new Set((excludedIds||[]).map(String));
 const pool=PLAYERS.filter(player=>String(player.club)===String(clubId)&&!excluded.has(String(player.id))).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0)||String(a.name).localeCompare(String(b.name),'it'));
 const selected=[];const used=new Set();
 [['P',2],['D',5],['C',4],['A',3]].forEach(([role,count])=>{
   pool.filter(player=>roleOf(player)===role).slice(0,count).forEach(player=>{selected.push(player);used.add(String(player.id))});
 });
 pool.filter(player=>!used.has(String(player.id))).slice(0,Math.max(0,14-selected.length)).forEach(player=>selected.push(player));
 return selected.slice(0,14).map(player=>String(player.id));
}
function clubStrength(clubId,excludedIds=[]){
 const ids=buildClubRoster(clubId,excludedIds);
 const values=ids.slice().sort((a,b)=>(Number(playerById(b)?.ovr)||0)-(Number(playerById(a)?.ovr)||0)).slice(0,11).map(id=>Number(playerById(id)?.ovr)||60);
 while(values.length<11)values.push(60);
 return Math.round(avg(values)*10)/10;
}
function currentUserPlayerIds(){return state?.draft?.roster?.map(entry=>String(entry.playerId))||[]}
function refreshOpponentClubRosters(){
 const excluded=currentUserPlayerIds(),meritTransfer=meritStoryState();if(meritTransfer.transferred&&meritTransfer.playerId&&!excluded.includes(String(meritTransfer.playerId)))excluded.push(String(meritTransfer.playerId));
 (state.teams||[]).forEach(team=>{
   if(!team||team.id===USER_ID||!team.clubId||team.externalCompetition||team.controlSwapLockedRoster)return;
   team.roster=buildClubRoster(team.clubId,excluded);
   team.strength=clubStrength(team.clubId,excluded);
 });
 ensureMeritTransferredPlayer();
}
function buildNationRoster(nation){
 const pool=PLAYERS.filter(player=>player.nation===nation).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0)||String(a.name).localeCompare(String(b.name),'it'));
 return pool.slice(0,14).map(player=>String(player.id));
}
function opponentStatusOf(team,id){
 if(!team.statuses||typeof team.statuses!=='object')team.statuses={};
 const key=String(id);
 if(!team.statuses[key])team.statuses[key]={injury:0,suspension:0};
 return team.statuses[key];
}
function opponentRosterPlayers(team){
 if(!team||team.id===USER_ID)return[];
 if(!Array.isArray(team.roster)||!team.roster.length)team.roster=team.clubId?buildClubRoster(team.clubId,currentUserPlayerIds()):buildNationRoster(team.name);
 const players=team.roster.map(id=>chaosPlayer(team,id)).filter(Boolean);
 if(team.mascot)players.push({...team.mascot,role:'A',Position:'ATT',nation:team.name,subscriber:'no',isMascot:true});
 return players;
}
function opponentAvailablePlayers(team){
 return opponentRosterPlayers(team).filter(player=>{
   const status=opponentStatusOf(team,player.id);
   return status.injury<=0&&status.suspension<=0;
 }).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0));
}

function chaosEnabled(){return state.gameMode==='chaos'}
function ensureChaosTeam(team){
 if(!team||team.id===USER_ID)return null;
 team.chaos=team.chaos&&typeof team.chaos==='object'?team.chaos:{};
 team.chaos.activeEffects=Array.isArray(team.chaos.activeEffects)?team.chaos.activeEffects:[];
 team.chaos.seenDecisionEvents=[...new Set((Array.isArray(team.chaos.seenDecisionEvents)?team.chaos.seenDecisionEvents:[]).map(String))];
 team.chaos.decisions=Math.max(0,Number(team.chaos.decisions)||0);
 team.chaos.midseasonPickDelta=clamp(Number(team.chaos.midseasonPickDelta)||0,-1,1);
 team.chaos.matchDuration=[30,90,120].includes(Number(team.chaos.matchDuration))?Number(team.chaos.matchDuration):90;
 team.chaos.futureScorerId=String(team.chaos.futureScorerId||'');
 team.chaos.futureInjuryZeroPoints=Boolean(team.chaos.futureInjuryZeroPoints);
 team.chaos.sixtyPointFear=Boolean(team.chaos.sixtyPointFear);
 team.chaos.eventChanceMultiplier=clamp(Number(team.chaos.eventChanceMultiplier)||1,1,2);
 team.chaos.formation=FORMATIONS[String(team.chaos.formation||'')]?String(team.chaos.formation):'';
 team.chaos.nonItalianChemZero=Boolean(team.chaos.nonItalianChemZero);
 team.chaos.sponsorChoice=['ballarini','football-manager'].includes(String(team.chaos.sponsorChoice))?String(team.chaos.sponsorChoice):'';
 team.chaos.sponsorOvrExtra=team.chaos.sponsorChoice==='ballarini'?5:0;
 team.chaos.physioInjuryMultiplier=team.chaos.sponsorChoice==='football-manager'?.5:1;
 team.chaos.equalOrBetterMidseasonPlayerId=String(team.chaos.equalOrBetterMidseasonPlayerId||'');
 team.chaos.latestDecision=team.chaos.latestDecision&&typeof team.chaos.latestDecision==='object'?team.chaos.latestDecision:null;
 team.playerOverrides=team.playerOverrides&&typeof team.playerOverrides==='object'?team.playerOverrides:{};
 return team.chaos;
}
function pushChaosEffect(team,type,value=0,rounds=1,extra={}){
 const chaos=ensureChaosTeam(team);if(!chaos)return null;
 const effect={type,value:Number(value)||0,rounds:rounds===Infinity?9999:Math.max(1,Number(rounds)||1),...extra};
 chaos.activeEffects.push(effect);return effect;
}
function chaosEffect(team,type){const chaos=ensureChaosTeam(team);return chaos?chaos.activeEffects.filter(effect=>effect.type===type):[]}
function chaosPowerBonus(team){
 const chaos=ensureChaosTeam(team);if(!chaos)return 0;
 return chaos.activeEffects.reduce((sum,effect)=>sum+(effect.type==='power'?(Number(effect.value)||0):0),0);
}
function chaosEffectRounds(text=''){
 const value=String(text).toLowerCase();
 if(value.includes('fino a fine stagione')||value.includes('per tutta la stagione')||value.includes('da ora'))return 9999;
 const match=value.match(/(?:per (?:le prossime )?|per i prossimi )(\d+) (?:giornate|partite)/);if(match)return Math.max(1,Number(match[1])||1);
 if(value.includes('prossima partita')||value.includes('prossima gara'))return 1;
 return 1;
}
function chaosPlayer(team,id){
 const base=playerById(id);if(!base)return null;
 const override=team?.playerOverrides?.[String(id)]||{};return {...base,...override,id:String(base.id)};
}
function chaosSetPlayerOvr(team,id,value){
 if(!team||!id)return null;team.playerOverrides=team.playerOverrides&&typeof team.playerOverrides==='object'?team.playerOverrides:{};
 const player=chaosPlayer(team,id);if(!player)return null;const current=Math.max(1,Number(player.ovr)||60),requested=Math.max(1,Number(value)||60),chaos=ensureChaosTeam(team),after=requested>current&&chaos?.sponsorChoice==='ballarini'?requested+5:requested;team.playerOverrides[String(id)]={...(team.playerOverrides[String(id)]||{}),ovr:after};return chaosPlayer(team,id);
}
function chaosRandomRosterPlayer(team,filterFn=null){const pool=opponentRosterPlayers(team).filter(player=>!filterFn||filterFn(player));return pool.length?pick(pool):null}
function chaosInjure(team,count=1,duration=1){
 const pool=shuffle(opponentRosterPlayers(team).filter(player=>!player.isMascot)).slice(0,Math.max(1,Number(count)||1));
 pool.forEach(player=>{const status=opponentStatusOf(team,player.id);status.injury=Math.max(status.injury,Math.max(1,Number(duration)||1));});
 if(pool.length&&ensureChaosTeam(team)?.futureInjuryZeroPoints&&state.standings?.[team.id])state.standings[team.id].pts=0;
 return pool.map(player=>player.name);
}
function chaosSuspend(team,count=1,duration=1){
 const pool=shuffle(opponentRosterPlayers(team).filter(player=>!player.isMascot)).slice(0,Math.max(1,Number(count)||1));
 pool.forEach(player=>{const status=opponentStatusOf(team,player.id);status.suspension=Math.max(status.suspension,Math.max(1,Number(duration)||1));});return pool.map(player=>player.name);
}
function chaosRegisterGeneratedPlayer(player){
 state.seasonRules.generatedEventPlayers=Array.isArray(state.seasonRules.generatedEventPlayers)?state.seasonRules.generatedEventPlayers:[];
 const copy={...player,id:String(player.id)};const index=state.seasonRules.generatedEventPlayers.findIndex(item=>String(item.id)===copy.id);
 if(index>=0)state.seasonRules.generatedEventPlayers[index]=copy;else state.seasonRules.generatedEventPlayers.push(copy);return copy;
}
function chaosReplaceWeakest(team,pool=PLAYERS,label='mercato parallelo'){
 if(!team||!Array.isArray(team.roster)||!team.roster.length)return '';
 const candidates=opponentRosterPlayers(team).filter(player=>team.roster.map(String).includes(String(player.id))&&!player.isMascot).sort((a,b)=>(Number(a.ovr)||0)-(Number(b.ovr)||0));
 const weakest=candidates[0],available=(Array.isArray(pool)?pool:[]).filter(player=>player&&player.id&&!team.roster.map(String).includes(String(player.id)));
 if(!weakest||!available.length)return '';
 const source=pick(available);const incoming=chaosRegisterGeneratedPlayer({...source,id:`chaos-${team.id}-${state.matchday}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,club:team.id,eventPlayer:true});
 const index=team.roster.findIndex(id=>String(id)===String(weakest.id));if(index>=0)team.roster[index]=String(incoming.id);
 return `${weakest.name} → ${incoming.name} (${label})`;
}
function chaosRebuildWeakest(team,count=3){
 const changes=[];for(let i=0;i<Math.max(1,Number(count)||1);i++){const change=chaosReplaceWeakest(team,PLAYERS,'rebuild');if(change)changes.push(change)}return changes;
}
function chaosNextOpponent(teamId){
 const round=state.schedule?.[state.matchday]||[],fixture=round.find(match=>String(match.home)===String(teamId)||String(match.away)===String(teamId));
 if(!fixture)return null;return teamById(String(fixture.home)===String(teamId)?fixture.away:fixture.home);
}
function chaosApplyGlobalRule(decisionId,choiceIndex){
 if(decisionId==='fantaballa-fa-video'&&choiceIndex===1){state.seasonRules.drawPoints=6;return true}
 if(decisionId==='fgci-regolamento-rossi-punti'){if(choiceIndex===0)state.seasonRules.redCardGoals=true;else state.seasonRules.pointsEqualGoals=true;return true}
 if(decisionId==='fgci-regolamento-gol-tardivi'){if(choiceIndex===0)state.seasonRules.lateGoalsDouble=true;else state.seasonRules.zeroZeroNoPoints=true;return true}
 if(decisionId==='fgci-regole-estreme'){if(choiceIndex===0)extendSeasonTo76();else activateHungerGames();return true}
 if(decisionId==='fgci-formazioni-estreme'){forceSeasonFormation(choiceIndex===0?'4-4-4':'3-3-3');return true}
 if(decisionId==='fgci-cartellini-estremi'){if(choiceIndex===0)activateYellowEqualsRed();else activatePinkCardRule();return true}
 if(decisionId==='figc-regola-gol'){activateFederationGoalRule(choiceIndex===0?'golden':'last');return true}
 if(decisionId==='figc-formula-uno-niente-pareggio'){activateFigcCompetitionRule(choiceIndex===0?'formula-one':'no-draw');return true}
 if(decisionId==='fgci-punti-gol'){activateFgciPointsRule(choiceIndex===0?'heavy-goals':'clean-sheet');return true}
 if(decisionId==='fgci-risultati-estremi'){activateFgciResultRule(choiceIndex===0?'boredom-wins':'all-in');return true}
 if(decisionId==='nuovo-video-fantaballa'){activateFantaballaVideoRule(choiceIndex===0?'reverse-points':'two-goals-to-win');return true}
 if(decisionId==='figura-pelata-misteriosa'){if(choiceIndex===0)activateExpandedLeague();else activateEliteLeague();return true}
 return false;
}
function applyChaosTeamDecision(team,decision,choiceIndex){
 const chaos=ensureChaosTeam(team),choice=decision?.choices?.[choiceIndex];if(!chaos||!choice)return '';
 const id=String(decision.id||''),text=String(choice.effect||''),lower=text.toLowerCase(),rounds=chaosEffectRounds(text);
 chaos.decisions++;chaos.seenDecisionEvents=[...new Set([...chaos.seenDecisionEvents,id])];
 if(chaosApplyGlobalRule(id,choiceIndex))return text;
 if(id==='figura-aldila'&&choiceIndex===0){chaos.formation='2-4-4';return 'ATAKARE: solo questa squadra giocherà con il 2-4-4 fino a fine stagione.'}
 if(id==='figlio-presidente'){if(choiceIndex===0)pushChaosEffect(team,'forcedLoss',1,1);else pushChaosEffect(team,'power',6,1);chaos.midseasonPickDelta=clamp(chaos.midseasonPickDelta+(choiceIndex===0?1:-1),-1,1);return text}
 if(id==='pulmino-bordello'){if(choiceIndex===0){pushChaosEffect(team,'power',1,2);pushChaosEffect(team,'power',-1,1)}else{pushChaosEffect(team,'power',10,1);chaos.midseasonPickDelta=clamp(chaos.midseasonPickDelta-1,-1,1)}return text}
 if(id==='tifoso-formazione'){if(choiceIndex===0&&state.standings?.[team.id])state.standings[team.id].pts-=1;else pushChaosEffect(team,'maxDraw',1,1);return text}
 if(id==='quelli-del-fantacalcio'){pushChaosEffect(team,choiceIndex===0?'noGoals':'baseOnly',1,choiceIndex===0?1:3);return text}
 if(id==='underdog'){if(choiceIndex===1)pushChaosEffect(team,'forcedScore',1,1,{gf:6,ga:0});else{const players=opponentRosterPlayers(team).filter(player=>Number(player.ovr)>=60&&Number(player.ovr)<=70);const best=Math.max(...opponentRosterPlayers(team).map(player=>Number(player.ovr)||60));if(players.length)chaosSetPlayerOvr(team,pick(players).id,best)}return text}
 if(id==='rapito-alieni'){
   const player=chaosRandomRosterPlayer(team);if(!player)return 'Nessun giocatore disponibile.';
   if(choiceIndex===0){chaosSetPlayerOvr(team,player.id,(Number(player.ovr)||60)+5);return `${player.name} riceve +5 OVR fino a fine stagione.`}
   chaos.equalOrBetterMidseasonPlayerId=String(player.id);return `${player.name} dovrà essere scambiato a metà stagione con un giocatore di pari o maggiore OVR.`;
 }
 if(id==='demone-durata-partite'){chaos.matchDuration=choiceIndex===0?30:120;if(choiceIndex===1)pushChaosEffect(team,'injuryRisk',1,9999,{chance:.25});return text}
 if(id==='personaggio-mantello-multiverso'){chaosReplaceWeakest(team,choiceIndex===0?CLASSIC_PLAYERS:REAL_PLAYERS,choice.label);return text}
 if(id==='generale-misterioso'){if(choiceIndex===0)return chaosReplaceNonItalianWithItalians(team);chaos.nonItalianChemZero=true;return 'I giocatori non italiani della squadra avranno 0 Intesa fino a fine stagione.'}
 if(id==='personaggio-misterioso-sosia'){if(choiceIndex===0)chaosReplaceWeakest(team,[...CLASSIC_PLAYERS,...REAL_PLAYERS],choice.label);else{const scorer=chaosRandomRosterPlayer(team);chaos.futureScorerId=String(scorer?.id||'');chaos.futureInjuryZeroPoints=Boolean(scorer)}return text}
 if(id==='personaggio-corona-spine'){if(choiceIndex===0)return reverseStandingsPoints();chaos.eventChanceMultiplier=2;return 'La probabilità di eventi per questa squadra passa dal 45% al 90% fino a fine stagione.'}
 if(id==='nuovo-sponsor'){if(choiceIndex===0){chaos.sponsorChoice='ballarini';chaos.sponsorOvrExtra=5}else{chaos.sponsorChoice='football-manager';chaos.physioInjuryMultiplier=.5}return text}
 if(id==='misterfm-fa-video'){if(choiceIndex===0)chaosRebuildWeakest(team,3);else{const player=chaosRandomRosterPlayer(team);if(player)chaosSetPlayerOvr(team,player.id,(Number(player.ovr)||60)+(Math.random()<.5?20:-20))}return text}
 if(id==='fantaballa-fa-video'&&choiceIndex===0){const attackers=opponentRosterPlayers(team).filter(player=>roleOf(player)==='A');const outgoing=attackers.sort((a,b)=>(Number(a.ovr)||0)-(Number(b.ovr)||0))[0]||chaosRandomRosterPlayer(team);if(outgoing){const maradona=chaosRegisterGeneratedPlayer({id:`chaos-maradona-${team.id}-${Date.now()}`,name:'Diego Armando Maradona',nation:'Argentina',Position:'ATT, AS, AD',role:'A',ovr:120,subscriber:'no',club:team.id,eventPlayer:true});const index=team.roster.findIndex(value=>String(value)===String(outgoing.id));if(index>=0)team.roster[index]=String(maradona.id)}if(state.standings?.[team.id])state.standings[team.id].pts=0;return text}
 if(id==='mago-do-nascimento'){if(choiceIndex===0)pushChaosEffect(team,'injuredBonus',40,9999);else{const player=chaosRandomRosterPlayer(team);if(player)chaosSetPlayerOvr(team,player.id,(Number(player.ovr)||60)+20)}return text}
 if(id==='var-misterioso'){if(choiceIndex===0)zeroFiveTeamsIncluding(team.id);else pushChaosEffect(team,'redRisk',1,2,{chance:.75});return text}
 if(id==='sessanta-sfumature'){if(choiceIndex===0){const roster=opponentRosterPlayers(team);const eligible=roster.filter(player=>{const base=Number(playerById(player.id)?.ovr??player.ovr)||0;return base>=60&&base<=65});const chosen=eligible.length?pick(eligible):null;const best=roster.filter(player=>!chosen||String(player.id)!==String(chosen.id)).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0))[0];if(chosen){const base=Number(playerById(chosen.id)?.ovr??chosen.ovr)||60;chaosSetPlayerOvr(team,chosen.id,base*2)}if(best){team.roster=team.roster.filter(id=>String(id)!==String(best.id));delete team.playerOverrides?.[String(best.id)];delete team.statuses?.[String(best.id)];if(String(chaos.equalOrBetterMidseasonPlayerId||'')===String(best.id))chaos.equalOrBetterMidseasonPlayerId='';}}else chaos.sixtyPointFear=true;return text}
 if(id==='personaggio-capelli-bianchi'){if(choiceIndex===0){if(Math.random()<.5)opponentRosterPlayers(team).forEach(player=>chaosSetPlayerOvr(team,player.id,(Number(player.ovr)||60)+10));else chaosInjure(team,Math.max(1,team.roster.length),9999)}else{const target=chaosNextOpponent(team.id);if(target)pushChaosEffect(target,'power',10,1)}return text}
 if(id==='rissa-mascotte'&&choiceIndex===1){const targets=state.teams.filter(item=>item.id!==USER_ID&&item.id!==team.id);const target=targets.length?pick(targets):team;target.mascot={id:`chaos-mascot-${team.id}-${Date.now()}`,name:`Mascotte di ${team.name}`,ovr:99};return text}
 if(id==='drone-avversario'){const target=chaosNextOpponent(team.id);if(target){if(choiceIndex===0)pushChaosEffect(target,'power',-10,1);else chaosInjure(target,2,1)}return text}
 if(id==='aggiornamento-var'){if(choiceIndex===0)pushChaosEffect(team,'randomResult',1,1);else pushChaosEffect(team,'redRisk',1,1,{chance:.70});return text}
 if(id==='mentalista'){
   if(choiceIndex===0){
     const attacker=chaosRandomRosterPlayer(team,player=>roleOf(player)==='A');
     if(!attacker)return 'Nessun attaccante disponibile da ipnotizzare.';
     if(Math.random()<.25){chaosSetPlayerOvr(team,attacker.id,1);return `Il mentalista sbaglia: ${attacker.name} diventa un pollo da 1 OVR fino a fine stagione.`}
     pushChaosEffect(team,'power',8/11,1);return `${attacker.name} riceve +8 OVR nella prossima partita.`;
   }
   pushChaosEffect(team,'redRisk',1,1,{chance:.35});return text;
 }
 if(lower.includes('perdi sicuramente')||lower.includes('sconfitta obbligatoria'))pushChaosEffect(team,'forcedLoss',1,1);
 if(lower.includes('vittoria assicurata')||lower.includes('vinci sicuramente'))pushChaosEffect(team,'forcedWin',1,1);
 if(lower.includes('al massimo pareggiare'))pushChaosEffect(team,'maxDraw',1,1);
 if(lower.includes('non ti assegnano neanche un gol')||lower.includes('segnerà 0 gol'))pushChaosEffect(team,'noGoals',1,rounds);
 if(lower.includes('1 punto di penalizzazione')&&state.standings?.[team.id])state.standings[team.id].pts-=1;
 if(lower.includes('punti vanno a 0')&&state.standings?.[team.id])state.standings[team.id].pts=0;
 const ovrMatch=text.match(/([+-]\d+)\s*OVR/i);if(ovrMatch){let value=Number(ovrMatch[1])||0;if(lower.includes('un giocatore')||lower.includes('attaccante'))value/=11;pushChaosEffect(team,'power',value,rounds)}
 const chemMatch=text.match(/([+-]\d+)\s*Intesa/i);if(chemMatch)pushChaosEffect(team,'power',(Number(chemMatch[1])||0)/5,rounds);
 if(lower.includes('×2 intesa')||lower.includes('intesa viene moltiplicata'))pushChaosEffect(team,'power',3,rounds);
 if(lower.includes('un giocatore casuale si infortuna')||lower.includes('un giocatore casuale subisce'))chaosInjure(team,1,1);
 if(lower.includes('2 giocatori')&&lower.includes('infortun'))chaosInjure(team,2,1);
 if(lower.includes('tutti gli abbonati sono infortunati')){const ids=opponentRosterPlayers(team).filter(isSubscriber).map(player=>player.id);ids.forEach(id=>opponentStatusOf(team,id).injury=1)}
 if(lower.includes('rischio di infortunio')||lower.includes('aumentano infortuni'))pushChaosEffect(team,'injuryRisk',1,rounds,{chance:.35});
 if(lower.includes('espulsione')||lower.includes('cartellino rosso'))pushChaosEffect(team,'redRisk',1,rounds,{chance:.25});
 if(lower.includes('1 scelta in più'))chaos.midseasonPickDelta=clamp(chaos.midseasonPickDelta+1,-1,1);
 if(lower.includes('1 scelta in meno'))chaos.midseasonPickDelta=clamp(chaos.midseasonPickDelta-1,-1,1);
 return text;
}
function applyChaosAutoEvent(team,event){
 const title=String(event?.title||'Evento casuale');let result='';
 if(title==='Problema muscolare')result=`${chaosInjure(team,1,2).join(', ')}: infortunio di 2 giornate`;
 else if(title==='Contusione')result=`${chaosInjure(team,1,1).join(', ')}: contusione`;
 else if(title==='Settimana perfetta'){pushChaosEffect(team,'power',1,1);result='+5 Intesa nella prossima partita'}
 else if(title==='Sostegno degli abbonati'){pushChaosEffect(team,'power',.6,2);result='+3 Intesa agli abbonati per 2 giornate'}
 else{pushChaosEffect(team,'redRisk',1,1,{chance:.2});result='rischio squalifica aumentato'}
 return result;
}
function prepareChaosOpponentEvents(){
 if(!chaosEnabled()||state.phase!=='season')return;
 state.chaos=state.chaos&&typeof state.chaos==='object'?state.chaos:{};
 if(Number(state.chaos.lastPreparedMatchday)===Number(state.matchday))return;
 const reports=[];let decisions=0,automatic=0,normal=0;
 state.teams.filter(team=>team.id!==USER_ID&&!isTeamEliminated(team.id)).forEach(team=>{
   const chaos=ensureChaosTeam(team),multiplier=clamp(Number(chaos?.eventChanceMultiplier)||1,1,2),normalChance=Math.max(0,1-(.45*multiplier)),autoLimit=normalChance+(.10*multiplier),roll=Math.random();
   if(roll<normalChance){normal++;return}
   if(roll<autoLimit){const event=pick(AUTO_EVENTS),result=applyChaosAutoEvent(team,event);automatic++;reports.push({kind:'auto',teamId:team.id,teamName:team.name,title:event.title,choice:'Evento automatico',effect:result});return}
   const beforeMidseasonOnly=new Set(['pulmino-bordello','figlio-presidente','whatsapp-pubblicato','rissa-mascotte','rapito-alieni','figura-aldila','figura-misteriosa-tattico-fantaguru','figlio-del-mister']);
   let available=DECISIONS.filter(decision=>!decision.chainOnly&&!decision.questEvent&&!decision.userOnly&&!chaos.seenDecisionEvents.includes(String(decision.id))&&(state.matchday<19||!beforeMidseasonOnly.has(String(decision.id))));
   if(!available.length){chaos.seenDecisionEvents=[];available=DECISIONS.filter(decision=>!decision.chainOnly&&!decision.questEvent&&!decision.userOnly&&(state.matchday<19||!beforeMidseasonOnly.has(String(decision.id))))}
   const decision=pick(available),choiceIndex=Math.floor(Math.random()*decision.choices.length),choice=decision.choices[choiceIndex],effect=applyChaosTeamDecision(team,decision,choiceIndex);
   decisions++;const title=typeof decision.title==='string'?decision.title:String(decision.id).replaceAll('-',' ');const report={kind:'decision',teamId:team.id,teamName:team.name,title,choice:choice.label,effect:effect||choice.effect};chaos.latestDecision=report;reports.push(report);
 });
 state.chaos.lastPreparedMatchday=Number(state.matchday);state.chaos.totalDecisions=Math.max(0,Number(state.chaos.totalDecisions)||0)+decisions;
 state.chaos.currentRound={matchday:state.matchday+1,decisions,automatic,normal,total:decisions+automatic+normal};state.chaos.latest=reports.slice(-12);
}
function renderChaosLeagueFeed(){
 if(!chaosEnabled())return '';
 const current=state.chaos?.currentRound||{},reports=Array.isArray(state.chaos?.latest)?state.chaos.latest:[];
 const rows=reports.filter(report=>report.kind==='decision').slice(-6).reverse();
 return `<div class="chaos-feed"><div class="chaos-feed-head"><b>🌀 Modalità Caos</b><span>Giornata ${Number(current.matchday)||state.matchday+1}</span></div><div class="chaos-feed-summary">Le ${Math.max(0,state.teams.filter(team=>team.id!==USER_ID&&!isTeamEliminated(team.id)).length)} avversarie hanno gestito i propri eventi: ${Number(current.decisions)||0} decisioni, ${Number(current.automatic)||0} eventi automatici e ${Number(current.normal)||0} settimane normali.</div><div class="chaos-feed-list">${rows.length?rows.map(report=>`<div class="chaos-feed-row"><b>${esc(report.teamName)}</b><span>${esc(report.title)} — <strong>${esc(report.choice)}</strong></span></div>`).join(''):'<div class="chaos-feed-row"><b>Nessuna scelta</b><span>In questa giornata alle avversarie sono capitati soltanto eventi automatici o settimane normali.</span></div>'}</div></div>`;
}
function chaosTeamMatchRules(team){
 const chaos=ensureChaosTeam(team),has=type=>chaos?.activeEffects.some(effect=>effect.type===type),find=type=>chaos?.activeEffects.find(effect=>effect.type===type)||null;
 return {forcedLoss:has('forcedLoss'),forcedWin:has('forcedWin'),maxDraw:has('maxDraw'),noGoals:has('noGoals'),randomResult:has('randomResult'),forcedScore:find('forcedScore'),futureScorer:Boolean(chaos?.futureScorerId)};
}
function applyChaosScoreRules(homeTeam,awayTeam,homeScore,awayScore){
 let home=Math.max(0,Number(homeScore)||0),away=Math.max(0,Number(awayScore)||0);const hr=chaosTeamMatchRules(homeTeam),ar=chaosTeamMatchRules(awayTeam);
 if(hr.randomResult||ar.randomResult){home=Math.floor(Math.random()*6);away=Math.floor(Math.random()*6)}
 if(hr.futureScorer)home=Math.max(1,home);if(ar.futureScorer)away=Math.max(1,away);if(hr.noGoals)home=0;if(ar.noGoals)away=0;
 if(hr.forcedScore){home=Math.max(0,Number(hr.forcedScore.gf)||6);away=Math.max(0,Number(hr.forcedScore.ga)||0)}
 if(ar.forcedScore){away=Math.max(0,Number(ar.forcedScore.gf)||6);home=Math.max(0,Number(ar.forcedScore.ga)||0)}
 if(hr.forcedWin&&home<=away)home=away+1;if(ar.forcedWin&&away<=home)away=home+1;
 if(hr.forcedLoss&&home>=away)away=home+1;if(ar.forcedLoss&&away>=home)home=away+1;
 if(hr.maxDraw&&home>away)home=away;if(ar.maxDraw&&away>home)away=home;
 return [home,away];
}
function applyChaosOpponentToUserScore(opponent,goalsFor,goalsAgainst){
 const rules=chaosTeamMatchRules(opponent);let gf=Math.max(0,Number(goalsFor)||0),ga=Math.max(0,Number(goalsAgainst)||0);
 if(rules.randomResult){gf=Math.floor(Math.random()*6);ga=Math.floor(Math.random()*6)}
 if(rules.futureScorer)ga=Math.max(1,ga);if(rules.noGoals)ga=0;
 if(rules.forcedScore){ga=Math.max(0,Number(rules.forcedScore.gf)||6);gf=Math.max(0,Number(rules.forcedScore.ga)||0)}
 if(rules.forcedWin&&ga<=gf)ga=gf+1;if(rules.forcedLoss&&ga>=gf)gf=ga+1;if(rules.maxDraw&&ga>gf)ga=gf;
 return [gf,ga];
}
function tickChaosOpponentEffects(){
 if(!chaosEnabled())return;
 state.teams.filter(team=>team.id!==USER_ID).forEach(team=>{const chaos=ensureChaosTeam(team);if(!chaos)return;
   const injuryRisks=chaos.activeEffects.filter(effect=>effect.type==='injuryRisk');injuryRisks.forEach(effect=>{const multiplier=chaos.sponsorChoice==='football-manager'?Math.max(.1,Number(chaos.physioInjuryMultiplier)||.5):1;if(Math.random()<clamp((Number(effect.chance)||.25)*multiplier,0,1))chaosInjure(team,1,1)});
   const redRisks=chaos.activeEffects.filter(effect=>effect.type==='redRisk');redRisks.forEach(effect=>{if(Math.random()<(Number(effect.chance)||.2))chaosSuspend(team,1,1)});
   chaos.activeEffects.forEach(effect=>effect.rounds--);chaos.activeEffects=chaos.activeEffects.filter(effect=>effect.rounds>0);
   if(chaos.sixtyPointFear&&Number(state.standings?.[team.id]?.pts)===60)state.standings[team.id].pts=0;
 });
}
function runChaosOpponentMidseason(){
 if(!chaosEnabled()||state.chaos?.midseasonDone)return;const reports=[];
 state.teams.filter(team=>team.id!==USER_ID&&!isTeamEliminated(team.id)).forEach(team=>{
   const chaos=ensureChaosTeam(team),count=clamp(2+(Number(chaos.midseasonPickDelta)||0),1,3),changes=[];
   const requiredId=String(chaos.equalOrBetterMidseasonPlayerId||''),outgoing=requiredId?chaosPlayer(team,requiredId):null;
   if(outgoing&&team.roster.map(String).includes(requiredId)){
     const used=new Set(team.roster.map(String)),threshold=Number(outgoing.ovr)||60,macro=roleOf(outgoing);
     let pool=PLAYERS.filter(player=>player&&player.id&&!used.has(String(player.id))&&roleOf(player)===macro&&(Number(player.ovr)||0)>=threshold);
     if(!pool.length){const fallback=PLAYERS.filter(player=>player&&player.id&&!used.has(String(player.id))&&roleOf(player)===macro).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0))[0];if(fallback)pool=[chaosRegisterGeneratedPlayer({...fallback,id:`chaos-alien-market-${team.id}-${Date.now()}`,club:team.id,ovr:threshold,eventPlayer:true})]}
     if(pool.length){const incoming=pick(pool),index=team.roster.findIndex(id=>String(id)===requiredId);if(index>=0)team.roster[index]=String(incoming.id);changes.push(`${outgoing.name} → ${incoming.name} (${Number(incoming.ovr)||threshold} OVR, pari o superiore)`);delete team.playerOverrides?.[requiredId];delete team.statuses?.[requiredId];}
     chaos.equalOrBetterMidseasonPlayerId='';
   }
   const remaining=Math.max(0,count-changes.length);if(remaining)changes.push(...chaosRebuildWeakest(team,remaining));
   if(changes.length)reports.push({kind:'decision',teamId:team.id,teamName:team.name,title:'Mercato di metà stagione',choice:`${changes.length} cambi automatici`,effect:changes.join(' · ')});
 });
 state.chaos.midseasonDone=true;if(reports.length)state.chaos.latest=reports.slice(-12);
}

function opponentMatchPower(team){
 if(!team||team.id===USER_ID)return matchPower();
 const lineup=teamMatchLineup(team),target=Math.max(1,activeAiMatchSlots(team).length);
 const values=lineup.map(entry=>isEmergencyYouthEntry(entry)?50:(Number(entry?.player?.ovr)||50));
 while(values.length<target)values.push(50);
 const chaos=ensureChaosTeam(team),nonItalianShare=lineup.length?lineup.filter(entry=>entry?.player&&!isItalianPlayer(entry.player)).length/lineup.length:0;
 const closedPortsPenalty=chaos?.nonItalianChemZero?nonItalianShare*4:0;
 return avg(values)+chaosPowerBonus(team)-closedPortsPenalty;
}
function nationalStrength(nation){
 const ids=buildNationRoster(nation);
 const values=ids.slice(0,11).map(id=>Number(playerById(id)?.ovr)||60);
 return Math.round(avg(values)*10)/10;
}
function buildFullyRandomDraftRoster(){
 const slots=formationSlots();
 const used=new Set();
 const starters=[];
 const orderedSlots=slots.map((slot,index)=>({slot,index,count:PLAYERS.filter(player=>youngBeautifulAllowsPlayer(player)&&userCompatible(player,slot.code)).length})).sort((a,b)=>a.count-b.count||a.index-b.index);
 for(const item of orderedSlots){
   const candidates=shuffle(PLAYERS.filter(player=>youngBeautifulAllowsPlayer(player)&&!used.has(String(player.id))&&userCompatible(player,item.slot.code)));
   const player=coachHighOvrPick(candidates);
   if(!player)return false;
   used.add(String(player.id));
   starters[item.index]={playerId:String(player.id),slotId:item.slot.instanceId,slot:item.slot.code,bench:false,player:{...player}};
 }
 const benchPlayers=coachHighOvrSample(PLAYERS.filter(player=>youngBeautifulAllowsPlayer(player)&&!used.has(String(player.id))),3);
 if(benchPlayers.length<3)return false;
 state.draft=freshState().draft;
 state.draft.rerolls=initialDraftRerollLimit();
 state.draft.roster=[
   ...starters,
   ...benchPlayers.map((player,index)=>({playerId:String(player.id),slotId:`bench-${index+1}`,slot:`PAN${index+1}`,bench:true,player:{...player}}))
 ];
 state.draft.clubId='';
 state.draft.candidates=[];
 state.draft.pendingPlayerId='';
 return true;
}
function startFullyRandomDraft(){
 if(coachIs('three-five-two')){
   const possible=draftPossibleClubs(),clubId=possible.length?pick(possible):'';
   if(!clubId||!buildThreeFiveTwoOpeningRoster(clubId))return toast('Non ci sono abbastanza giocatori per creare la rosa del 3-5-2.');
   const club=clubById(clubId);
   finalizeDraft();
   toast(`3-5-2: rosa automatica generata dal primo club ${club?.name||clubId}. Il campionato è iniziato.`);
   return;
 }
 if(!buildFullyRandomDraftRoster())return toast('Non ci sono abbastanza giocatori per creare una rosa casuale.');
 finalizeDraft();
 toast('Rosa casuale con ruoli corretti generata: il campionato è iniziato.');
}
function finalizeDraft(){
 if(!draftComplete())return toast('Completa 11 titolari e 3 riserve.');
 state.draft.pendingPlayerId='';
 const userClub=activeUserClub();
 state.userClubId=userClub.id;
 state.teamName=String(state.teamName||userClub.name).trim()||userClub.name;
 if(coachIs('three-five-two'))state.formation='3-5-2';
 state.seasonRules.leagueFormation=state.formation;
 state.seasonRules.userFormationOverride=coachIs('three-five-two')?'3-5-2':'';
 const draftedIds=currentUserPlayerIds();
 setAchievementCareerFlag('initialRosterIds',draftedIds.map(String));
 const opponents=shuffle(CLUBS.filter(club=>club.id!==userClub.id)).slice(0,19);
 state.leagueClubIds=opponents.map(club=>String(club.id));
 state.teams=[{
   id:USER_ID,
   clubId:userClub.id,
   name:state.teamName,
   shortName:userClub.shortName,
   colors:userClub.colorClub,
   strength:teamPowerBase()
 }].concat(opponents.map(club=>({
   id:club.id,
   clubId:club.id,
   name:club.name,
   shortName:club.shortName,
   colors:club.colorClub,
   strength:clubStrength(club.id,draftedIds),
   roster:buildClubRoster(club.id,draftedIds),
   statuses:{},
   mascot:null,
   playerOverrides:{},
   chaos:{activeEffects:[],seenDecisionEvents:[],decisions:0,midseasonPickDelta:0,matchDuration:90,futureScorerId:'',futureInjuryZeroPoints:false,sixtyPointFear:false,eventChanceMultiplier:1,nonItalianChemZero:false,formation:'',latestDecision:null}
 })));
 state.chaos={lastPreparedMatchday:-1,totalDecisions:0,currentRound:null,latest:[],midseasonDone:false};
 state.cup=freshState().cup;
 initializeStoryArc();
 state.schedule=generateSchedule(state.teams.map(team=>team.id));
 state.standings={};
 state.teams.forEach(team=>state.standings[team.id]={id:team.id,name:team.name,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});
 resetSeasonAnalytics();
 state.phase='season';
 state.matchday=0;
 state.pendingEvent=null;
 state.draft.candidates=[];
 save();
 prepareEvent();
 render()
}
function generateSchedule(ids){let arr=[...ids],rounds=[];for(let r=0;r<arr.length-1;r++){let matches=[];for(let i=0;i<arr.length/2;i++){let h=arr[i],a=arr[arr.length-1-i];if(r%2&&i===0)[h,a]=[a,h];matches.push({home:h,away:a})}rounds.push(matches);arr=[arr[0],arr[arr.length-1],...arr.slice(1,-1)]}return rounds.concat(rounds.map(rd=>rd.map(m=>({home:m.away,away:m.home}))));}
function sortedTable(){return Object.values(state.standings).filter(team=>!isTeamEliminated(team.id)).sort((a,b)=>b.pts-a.pts||((b.gf-b.ga)-(a.gf-a.ga))||b.gf-a.gf||b.w-a.w)}
function userStanding(){return state.standings[USER_ID]}
function teamById(id){return state.teams.find(t=>t.id===id)}
function currentRound(){return state.schedule[state.matchday]||[]}
function userFixture(){return currentRound().find(m=>m.home===USER_ID||m.away===USER_ID)}

const PARALLEL_CUP_MATCHDAYS=[[20,21],[25,26],[30,31]];
const PARALLEL_CUP_STAGE_NAMES=['Quarti di finale','Semifinali','Finale'];
function parallelCupState(){
 state.cup=state.cup&&typeof state.cup==='object'?state.cup:freshState().cup;
 return state.cup;
}
function parallelCupChemistryMultiplier(){return parallelCupState().rewardType==='chemistry_x2'?2:1}
function parallelCupChemistryZero(){return parallelCupState().penaltyType==='chemistry_zero'}
function parallelCupDisciplineImmunity(){return parallelCupState().rewardType==='discipline_immunity'}
function currentCompetitionName(){return PLAYERS===REAL_PLAYERS?'Fantacampionato del Ca***':'Campionato del Ca***'}
function otherCompetitionName(){return PLAYERS===REAL_PLAYERS?'Campionato del Ca***':'Fantacampionato del Ca***'}
function otherCompetitionPlayers(){return PLAYERS===REAL_PLAYERS?CLASSIC_PLAYERS:REAL_PLAYERS}
function otherClubPlayerPool(clubId){return (otherCompetitionPlayers()||[]).filter(player=>String(player.club)===String(clubId)).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0))}
function otherClubStrength(clubId){const values=otherClubPlayerPool(clubId).slice(0,11).map(player=>Number(player.ovr)||50);while(values.length<11)values.push(50);return Math.round(avg(values)*10)/10}
function parallelCupParticipant(id){return (parallelCupState().participants||[]).find(item=>String(item.id)===String(id))||null}
function parallelCupUserId(){return String(parallelCupState().userParticipantId||'cup-user')}
function parallelCupParticipantName(id){return parallelCupParticipant(id)?.name||'Squadra'}
function parallelCupParticipantPower(participant){
 if(!participant)return 60;
 if(participant.user)return Math.max(35,matchPower());
 if(participant.origin==='current'){
   const team=teamById(participant.teamId);
   return Math.max(35,team?opponentMatchPower(team):(Number(participant.strength)||60));
 }
 return Math.max(35,Number(participant.strength)||60);
}
function makeParallelCupTie(teamAId,teamBId,stageIndex,index){return{id:`cup-${stageIndex}-${index}`,teamAId:String(teamAId),teamBId:String(teamBId),legs:[],winnerId:'',aggregateA:0,aggregateB:0,penalties:''}}
function parallelCupEligibleOtherClubs(){
 const playerClubs=new Set((otherCompetitionPlayers()||[]).map(player=>String(player.club||'')).filter(Boolean));
 return (OTHER_CLUBS||[]).filter(club=>club&&playerClubs.has(String(club.id))&&!/^fantaballa(?:-|$)/i.test(String(club.id)));
}
function initializeParallelCup(){
 const cup=parallelCupState();
 if(cup.status!=='pending')return cup;
 const table=sortedTable(),rank=table.findIndex(row=>String(row.id)===USER_ID)+1;
 cup.qualifiedRank=rank;
 cup.currentCompetition=currentCompetitionName();
 cup.otherCompetition=otherCompetitionName();
 cup.notice='';
 if(rank<1||rank>4){cup.status='not_qualified';cup.userAlive=false;cup.notice=`Qualificazione mancata: al giro di boa eri ${rank>0?`${rank}°`:'fuori classifica'}.`;return cup}
 const currentTop=table.slice(0,4);
 if(currentTop.length<4){cup.status='not_qualified';cup.userAlive=false;cup.notice='Coppa non avviata: al giro di boa erano rimaste meno di quattro squadre disponibili.';return cup}
 const otherClubs=shuffle(parallelCupEligibleOtherClubs()).slice(0,4);
 if(otherClubs.length<4){cup.status='not_qualified';cup.userAlive=false;cup.notice='Coppa non avviata: nell’altro database non ci sono quattro club completi.';return cup}
 const participants=[];
 currentTop.forEach((row,index)=>{
   const team=teamById(row.id)||{};
   const user=String(row.id)===USER_ID;
   participants.push({id:user?'cup-user':`current:${row.id}`,teamId:String(row.id),clubId:String(team.clubId||row.id),name:user?state.teamName:(team.name||row.name),origin:'current',user,seed:index+1,strength:Number(team.strength)||60,colors:team.colors||null});
 });
 otherClubs.forEach((club,index)=>participants.push({id:`other:${club.id}`,teamId:'',clubId:String(club.id),name:club.name,origin:'other',user:false,seed:index+1,strength:otherClubStrength(club.id),colors:club.colorClub||null}));
 cup.participants=participants;
 cup.userParticipantId='cup-user';
 cup.userAlive=true;
 cup.winnerId='';
 cup.rewardApplied=false;
 cup.penaltyApplied=false;
 cup.rewardType='';
 cup.penaltyType='';
 cup.history=[];
 cup.stages=PARALLEL_CUP_STAGE_NAMES.map((name,index)=>({name,matchdays:[...PARALLEL_CUP_MATCHDAYS[index]],processedLegs:[],ties:[]}));
 cup.stages[0].ties=currentTop.map((row,index)=>makeParallelCupTie(String(row.id)===USER_ID?'cup-user':`current:${row.id}`,`other:${otherClubs[index].id}`,0,index));
 cup.status='active';
 cup.notice=`Qualificato da ${rank}°: affronterai quattro club del ${cup.otherCompetition}.`;
 return cup;
}
function parallelCupDedicatedEvent(userHome){
 const events=[
  {title:'Notte magica',description:'+4 OVR alla tua squadra per questa partita di coppa.',userBonus:4,opponentBonus:0},
  {title:'Turnover obbligatorio',description:'Rotazioni forzate: -3 OVR alla tua squadra per questa partita.',userBonus:-3,opponentBonus:0},
  {title:'Dodicesimo uomo',description:userHome?'Il pubblico di casa vale +4 OVR.':'Il settore ospiti vale +2 OVR.',userBonus:userHome?4:2,opponentBonus:0},
  {title:'Viaggio infinito',description:userHome?'L’avversaria arriva stanca: -3 OVR per lei.':'La trasferta pesa: -3 OVR alla tua squadra.',userBonus:userHome?0:-3,opponentBonus:userHome?-3:0},
  {title:'Pressione internazionale',description:'La tensione favorisce l’avversaria: +3 OVR per lei.',userBonus:0,opponentBonus:3}
 ];
 return {...pick(events)};
}
function parallelCupApplyEliminationPenalty(){
 const cup=parallelCupState();if(cup.penaltyApplied)return;
 cup.penaltyApplied=true;cup.userAlive=false;
 const outcomes=[
  {type:'ovr_minus_5',notice:'Eliminato dalla coppa: -5 OVR a tutta la squadra fino a fine stagione.',apply(){pushSeasonEffect('teamOvr',-5,{source:'Sconfitta nella Coppa parallela'})}},
  {type:'chemistry_zero',notice:'Eliminato dalla coppa: Intesa azzerata fino a fine stagione.',apply(){}},
  {type:'none',notice:'Eliminato dalla coppa: nessun malus applicato.',apply(){}}
 ];
 const outcome=pick(outcomes);cup.penaltyType=outcome.type;outcome.apply();cup.notice=outcome.notice;
}
function parallelCupApplyWinnerReward(){
 const cup=parallelCupState();if(cup.rewardApplied)return;
 cup.rewardApplied=true;cup.userAlive=true;
 const outcomes=[
  {type:'ovr_plus_10',notice:'Coppa vinta: +10 OVR a tutta la squadra fino a fine stagione.',apply(){pushSeasonEffect('teamOvr',10,{source:'Vittoria della Coppa parallela'})}},
  {type:'chemistry_x2',notice:'Coppa vinta: Intesa raddoppiata fino a fine stagione.',apply(){}},
  {type:'discipline_immunity',notice:'Coppa vinta: nessun tuo giocatore potrà infortunarsi o essere espulso fino a fine stagione.',apply(){}}
 ];
 const outcome=pick(outcomes);cup.rewardType=outcome.type;outcome.apply();cup.notice=outcome.notice;
}
function parallelCupResolveTie(tie){
 tie.aggregateA=(tie.legs||[]).reduce((sum,leg)=>sum+(Number(leg.aGoals)||0),0);
 tie.aggregateB=(tie.legs||[]).reduce((sum,leg)=>sum+(Number(leg.bGoals)||0),0);
 if(tie.aggregateA>tie.aggregateB)tie.winnerId=tie.teamAId;
 else if(tie.aggregateB>tie.aggregateA)tie.winnerId=tie.teamBId;
 else{
   const a=parallelCupParticipant(tie.teamAId),b=parallelCupParticipant(tie.teamBId),pa=parallelCupParticipantPower(a),pb=parallelCupParticipantPower(b),winner=Math.random()<pa/(pa+pb)?tie.teamAId:tie.teamBId;
   tie.winnerId=winner;tie.penalties=winner===tie.teamAId?'5-4':'4-5';
 }
 const userId=parallelCupUserId();
 if([tie.teamAId,tie.teamBId].includes(userId)&&tie.winnerId!==userId)parallelCupApplyEliminationPenalty();
}
function parallelCupAdvanceStage(stageIndex){
 const cup=parallelCupState(),stage=cup.stages[stageIndex];if(!stage||stageIndex>=cup.stages.length-1)return;
 const winners=stage.ties.map(tie=>tie.winnerId).filter(Boolean),next=cup.stages[stageIndex+1];
 if(stageIndex===0&&winners.length===4)next.ties=[makeParallelCupTie(winners[0],winners[1],1,0),makeParallelCupTie(winners[2],winners[3],1,1)];
 else if(stageIndex===1&&winners.length===2)next.ties=[makeParallelCupTie(winners[0],winners[1],2,0)];
}
function parallelCupFinish(){
 const cup=parallelCupState(),finalStage=cup.stages?.[2],winner=finalStage?.ties?.[0]?.winnerId||'';
 if(!winner)return;cup.winnerId=winner;cup.status='completed';
 if(winner===parallelCupUserId())parallelCupApplyWinnerReward();
 else if(cup.userAlive)parallelCupApplyEliminationPenalty();
}
function parallelCupParticipantTeam(participant){
 if(!participant)return{id:'cup-team',name:'Squadra',colors:null};
 if(participant.user)return teamById(USER_ID)||{id:USER_ID,name:state.teamName,clubId:state.userClubId,colors:activeUserClub().colorClub};
 if(participant.origin==='current')return teamById(participant.teamId)||{id:participant.id,name:participant.name,clubId:participant.clubId,colors:participant.colors||null};
 return{id:participant.id,name:participant.name,clubId:participant.clubId,colors:participant.colors||null};
}
function parallelCupParticipantLineup(participant){
 if(!participant)return[];
 if(participant.user)return resolveLineup();
 if(participant.origin==='current')return teamMatchLineup(teamById(participant.teamId));
 const pool=otherClubPlayerPool(participant.clubId).map(player=>({...player,id:`${participant.id}:${player.id}`}));
 const slots=FORMATIONS[leagueFormationKey()]||AI_MATCH_SLOTS,used=new Set();
 return slots.map((slot,index)=>{
   const role=POSITION_ROLE[slot]||'C';
   let player=pool.find(candidate=>!used.has(String(candidate.id))&&compatible(candidate,slot));
   if(!player)player=pool.find(candidate=>!used.has(String(candidate.id))&&roleOf(candidate)===role);
   if(!player)player=pool.find(candidate=>!used.has(String(candidate.id)));
   if(!player){const youth=makeEmergencyYouthEntry(slot,index,participant.id,`cup-${participant.id}-${index}`);player=youth.player}
   used.add(String(player.id));
   return{playerId:String(player.id),player,slot,slotId:`cup-${participant.id}-${index}`,bench:false,malus:0};
 });
}
function parallelCupPendingMatch(){
 const cup=parallelCupState();
 if(cup.status!=='active'||!cup.userAlive)return null;
 const existing=cup.pendingMatch&&typeof cup.pendingMatch==='object'?cup.pendingMatch:null;
 if(existing){
   const stage=cup.stages?.[Number(existing.stageIndex)],tie=stage?.ties?.find(item=>String(item.id)===String(existing.tieId));
   if(stage&&tie&&!stage.processedLegs.includes(Number(existing.legIndex)))return existing;
   cup.pendingMatch=null;
 }
 const targetMatchday=state.matchday+1;
 for(let stageIndex=0;stageIndex<(cup.stages||[]).length;stageIndex++){
   const stage=cup.stages[stageIndex],legIndex=(stage.matchdays||[]).indexOf(Number(targetMatchday));
   if(legIndex<0||stage.processedLegs.includes(legIndex)||!stage.ties?.length)continue;
   const tie=stage.ties.find(item=>[item.teamAId,item.teamBId].includes(parallelCupUserId()));
   if(!tie)return null;
   const teamA=parallelCupParticipant(tie.teamAId),teamB=parallelCupParticipant(tie.teamBId),home=legIndex===0?teamA:teamB;
   if(!teamA||!teamB)return null;
   cup.pendingMatch={stageIndex,legIndex,tieId:tie.id,matchday:targetMatchday,userHome:Boolean(home.user),event:parallelCupDedicatedEvent(Boolean(home.user))};
   return cup.pendingMatch;
 }
 return null;
}
function parallelCupCompleteLeg(pending,userData){
 const cup=parallelCupState(),stageIndex=Number(pending?.stageIndex),legIndex=Number(pending?.legIndex),stage=cup.stages?.[stageIndex];
 if(!stage||stage.processedLegs.includes(legIndex))return null;
 let userReport=null;
 stage.ties.forEach((tie,tieIndex)=>{
   const teamA=parallelCupParticipant(tie.teamAId),teamB=parallelCupParticipant(tie.teamBId);if(!teamA||!teamB)return;
   const home=legIndex===0?teamA:teamB,away=legIndex===0?teamB:teamA,userInTie=Boolean(teamA.user||teamB.user),userHome=Boolean(home.user);
   let homeGoals=0,awayGoals=0,event=null,homeEvents=[],awayEvents=[],commentary=[];
   if(userInTie&&userData){
     homeGoals=Math.max(0,Number(userData.homeGoals)||0);awayGoals=Math.max(0,Number(userData.awayGoals)||0);event=userData.event||null;homeEvents=Array.isArray(userData.homeEvents)?userData.homeEvents:[];awayEvents=Array.isArray(userData.awayEvents)?userData.awayEvents:[];commentary=Array.isArray(userData.commentary)?userData.commentary:[];
   }else{
     const homePower=parallelCupParticipantPower(home),awayPower=parallelCupParticipantPower(away);[homeGoals,awayGoals]=simulateScore(homePower,awayPower,.14,90);
   }
   const aGoals=legIndex===0?homeGoals:awayGoals,bGoals=legIndex===0?awayGoals:homeGoals;
   const leg={matchday:Number(pending.matchday),leg:legIndex+1,homeId:home.id,awayId:away.id,homeName:home.name,awayName:away.name,homeGoals,awayGoals,aGoals,bGoals,event};
   tie.legs.push(leg);tie.aggregateA=(Number(tie.aggregateA)||0)+aGoals;tie.aggregateB=(Number(tie.aggregateB)||0)+bGoals;
   if(legIndex===1)parallelCupResolveTie(tie);
   if(userInTie){
     const userIsA=Boolean(teamA.user),gf=userIsA?aGoals:bGoals,ga=userIsA?bGoals:aGoals;
     userReport={stage:stage.name,stageIndex,leg:legIndex===0?'Andata':'Ritorno',legIndex,opponent:userIsA?teamB.name:teamA.name,opponentId:userIsA?teamB.id:teamA.id,home:userHome,gf,ga,homeGoals,awayGoals,event,aggregateUser:userIsA?tie.aggregateA:tie.aggregateB,aggregateOpponent:userIsA?tie.aggregateB:tie.aggregateA,decided:legIndex===1,advanced:legIndex===1&&tie.winnerId===parallelCupUserId(),penalties:tie.penalties||'',winner:legIndex===1?parallelCupParticipantName(tie.winnerId):'',homeEvents,awayEvents,commentary,userGoalEvents:userHome?homeEvents:awayEvents,opponentGoalEvents:userHome?awayEvents:homeEvents};
   }
   cup.history.push({stageIndex,tieIndex,...leg});
 });
 stage.processedLegs.push(legIndex);
 if(legIndex===1){if(stageIndex<2)parallelCupAdvanceStage(stageIndex);else parallelCupFinish()}
 cup.pendingMatch=null;cup.lastResult=userReport;
 if(userReport&&cup.status==='active'&&cup.userAlive)cup.notice=userReport.decided?`Turno superato: ${userReport.aggregateUser}-${userReport.aggregateOpponent} nel doppio confronto.`:`Andata completata: aggregato provvisorio ${userReport.aggregateUser}-${userReport.aggregateOpponent}.`;
 return userReport;
}
function parallelCupTieScore(tie){
 if(!tie)return'–';if(!tie.legs?.length)return'–';
 const score=`${Number(tie.aggregateA)||0}-${Number(tie.aggregateB)||0}`;
 return tie.penalties?`${score} (${tie.penalties} dcr)`:score;
}
function parallelCupOutcomeLabel(){
 const cup=parallelCupState();
 if(cup.status==='pending')return'Qualificazione da decidere';
 if(cup.status==='not_qualified')return'Non qualificato';
 if(cup.status==='completed'&&cup.winnerId===parallelCupUserId())return'Vincitore';
 if(!cup.userAlive)return'Eliminato';
 return'In corsa';
}
function parallelCupNextInfo(){
 const cup=parallelCupState();if(cup.status!=='active')return null;
 for(let stageIndex=0;stageIndex<cup.stages.length;stageIndex++){
  const stage=cup.stages[stageIndex];
  for(let legIndex=0;legIndex<stage.matchdays.length;legIndex++){
   if(stage.processedLegs.includes(legIndex)||!stage.ties?.length)continue;
   const userTie=stage.ties.find(tie=>[tie.teamAId,tie.teamBId].includes(parallelCupUserId()));
   return{stage:stage.name,matchday:stage.matchdays[legIndex],leg:legIndex===0?'Andata':'Ritorno',opponent:userTie?parallelCupParticipantName(userTie.teamAId===parallelCupUserId()?userTie.teamBId:userTie.teamAId):'',userPlaying:Boolean(userTie&&cup.userAlive)};
  }
 }
 return null;
}
function renderParallelCupPanel(){
 const cup=parallelCupState();if(cup.status!=='active'||!cup.userAlive)return'';
 const outcome=parallelCupOutcomeLabel(),next=parallelCupNextInfo();
 const stages=(cup.stages||[]).map(stage=>`<div class="parallel-cup-stage"><span>${esc(stage.name)}</span>${stage.ties?.length?stage.ties.map(tie=>`<div class="parallel-cup-tie ${[tie.teamAId,tie.teamBId].includes(parallelCupUserId())?'parallel-cup-user':''}"><b>${esc(parallelCupParticipantName(tie.teamAId))} – ${esc(parallelCupParticipantName(tie.teamBId))}</b><em>${esc(parallelCupTieScore(tie))}</em></div>`).join(''):'<div class="parallel-cup-tie"><b>Da definire</b><em>–</em></div>'}</div>`).join('');
 return `<section class="parallel-cup-panel"><div class="parallel-cup-head"><div><span>🏆 Coppa parallela</span><h3>${esc(cup.currentCompetition||currentCompetitionName())} vs ${esc(cup.otherCompetition||otherCompetitionName())}</h3></div><div class="parallel-cup-status">${esc(outcome)}</div></div><p class="parallel-cup-copy">${esc(cup.notice||'Le prime quattro al giro di boa affrontano quattro club casuali dell’altro campionato, con andata e ritorno.')}</p>${next?`<div class="parallel-cup-next"><b>Prossimo turno:</b> Giornata ${next.matchday} · ${esc(next.stage)} · ${esc(next.leg)}${next.userPlaying&&next.opponent?` contro ${esc(next.opponent)}`:''}</div>`:''}${stages?`<div class="parallel-cup-stages">${stages}</div>`:''}</section>`;
}
function renderParallelCupResult(report){
 if(!report)return'';
 const verdict=report.decided?(report.advanced?'Qualificazione conquistata.':`Eliminazione: ${esc(report.winner)} passa il turno.`):`Aggregato provvisorio ${report.aggregateUser}-${report.aggregateOpponent}.`;
 return `<div class="goal-line cup-result-line"><b>🏆 ${esc(report.stage)} · ${esc(report.leg)}</b><br>${esc(state.teamName)} ${report.gf}-${report.ga} ${esc(report.opponent)}. ${report.event?`Evento coppa: ${esc(report.event.title)} — ${esc(report.event.description)} `:''}${verdict}${report.penalties?` Rigori: ${esc(report.penalties)}.`:''}</div>`;
}
function seasonHonourLabel(rank,eliminated=false){const cupWon=parallelCupState().winnerId===parallelCupUserId();if(rank===1&&!eliminated&&cupWon)return'Double';if(rank===1&&!eliminated)return'Campionato';if(cupWon)return'Coppa parallela';return'Nessun trofeo'}
function seasonFinalHeadline(rank,eliminated=false){const cupWon=parallelCupState().winnerId===parallelCupUserId();if(eliminated)return'Eliminato dagli Hunger Games';if(rank===1&&cupWon)return'Double!';if(cupWon)return'Coppa vinta!';if(rank===1)return'Campioni!';return'Campionato terminato'}



function error404StoryState(){
 state.story=state.story&&typeof state.story==='object'?state.story:{};
 state.story.error404=state.story.error404&&typeof state.story.error404==='object'?state.story.error404:freshState().story.error404;
 return state.story.error404;
}
function initializeError404Story(scheduled=true){
 const story=error404StoryState();Object.assign(story,freshState().story.error404);story.initialized=true;story.scheduled=Boolean(scheduled);story.stage=story.scheduled?'opening_waiting':'inactive';
}
function error404CorruptionActive(){const story=error404StoryState();return Boolean(story.scheduled&&story.corrupted&&!story.antivirusInstalled&&!story.completed)}
function error404RandomScore(){return Math.floor(Math.random()*6)}
function error404Outcome(scoreA,scoreB,teamA,teamB,duration=90){
 const a=Math.max(0,Number(scoreA)||0),b=Math.max(0,Number(scoreB)||0);return{scoreA:a,scoreB:b,outcomeScoreA:a,outcomeScoreB:b,winnerId:a>b?String(teamA?.id||''):b>a?String(teamB?.id||''):'',extraTime:false,penalties:null,note:'',duration:Number(duration)||90,regulationDuration:Number(duration)||90};
}
function prepareError404StoryEvent(){
 const story=error404StoryState();if(state.phase!=='season'||state.pendingEvent||!story.initialized||!story.scheduled||story.completed)return false;
 if(story.stage==='opening_waiting'&&Number(state.matchday)===0){story.stage='opening';state.pendingEvent={kind:'storyError404',storyType:'opening',resolved:false,title:'Errore 404',text:'Riavviare partita'};return true}
 if(story.stage==='technician_waiting'&&!story.technicianShown&&Number(state.matchday)>=Number(story.technicianDueMatchday)){story.technicianShown=true;story.stage='technician';state.pendingEvent={kind:'storyError404',storyType:'technician',resolved:false,title:'È arrivato il tecnico del liceo.',text:'Il sistema continua a restituire errori.'};return true}
 if(story.stage==='restart_waiting'&&!story.restartShown&&Number(state.matchday)>=Number(story.restartDueMatchday)){story.restartShown=true;story.stage='restart_required';state.pendingEvent={kind:'storyError404',storyType:'restart',resolved:false,title:'Gioco corrotto. Riavvio obbligatorio',text:'RIAVVIO DEL SISTEMA NECESSARIO'};return true}
 return false;
}
function forceError404LastPlace(){
 const standing=userStanding();if(standing){const others=Object.values(state.standings||{}).filter(row=>String(row.id)!==USER_ID).map(row=>Number(row.pts)||0);standing.pts=(others.length?Math.min(...others):0)-1000}
 const story=error404StoryState();story.corrupted=false;story.completed=true;story.stage='restarted_to_last';state.pendingEvent=null;state.phase='finished';
}
function restartLeagueAfterError404(){
 const story=error404StoryState(),savedPoints=Object.fromEntries(Object.entries(state.standings||{}).map(([id,row])=>[String(id),Number(row?.pts)||0]));
 Object.entries(state.standings||{}).forEach(([id,row])=>{row.p=0;row.w=0;row.d=0;row.l=0;row.gf=0;row.ga=0;row.pts=Number(savedPoints[String(id)])||0});
 state.stats={goals:{},assists:{},appearances:{},cleanSheets:{},mvpVotes:{},mvpPoints:{},playerNames:{},playerTeams:{},playerTeamNames:{}};
 state.history=[];state.lastResult=null;state.lastRoundResults=[];state.matchday=0;state.pendingEvent=null;state.playInjured={};state.statuses={};
 (state.teams||[]).forEach(team=>{if(String(team.id)!==USER_ID)team.statuses={}});
 const oldEventLog=Array.isArray(state.analytics?.eventLog)?state.analytics.eventLog:[],initialOvr=Number(state.analytics?.initialOvr)||teamPowerBase();state.analytics={initialOvr,injuries:0,redCards:0,eventLog:oldEventLog,biggestResult:null};
 state.schedule=generateSchedule((state.teams||[]).map(team=>team.id));state.cup=freshState().cup;state.midseason=freshState().midseason;state.chaos={...(state.chaos||{}),lastPreparedMatchday:-1,currentRound:null,latest:[],midseasonDone:false};
 story.corrupted=false;story.completed=true;story.restarted=true;story.stage='restarted_clean';state.phase='season';
}
function resolveError404Action(action){
 const event=state.pendingEvent,story=error404StoryState();if(!event||event.kind!=='storyError404'||event.resolved)return;
 if(event.storyType==='opening'){
   if(action==='restart'){forceError404LastPlace()}
   else if(action==='continue'){story.corrupted=true;story.technicianDueMatchday=1+Math.floor(Math.random()*3);story.stage='technician_waiting';state.pendingEvent=null}
   else return;
 }else if(event.storyType==='technician'){
   if(action==='install'){story.antivirusInstalled=true;story.corrupted=false;story.completed=true;story.stage='antivirus_installed';state.pendingEvent=null}
   else if(action==='ignore'){const first=Math.max(Number(state.matchday)+1,4),last=Math.max(first,seasonLength()-1);story.restartDueMatchday=first+Math.floor(Math.random()*(last-first+1));story.stage='restart_waiting';state.pendingEvent=null}
   else return;
 }else if(event.storyType==='restart'){
   if(action!=='restart')return;restartLeagueAfterError404();
 }
 seasonEventMinimized=false;seasonEventUiKey='';save();render();
}
function renderError404StoryEvent(event){
 const key=JSON.stringify(['error404',event.storyType,state.matchday]);if(seasonEventUiKey!==key){seasonEventUiKey=key;seasonEventMinimized=false}
 let choices='';
 if(event.storyType==='opening')choices=`<button class="choice season-event-choice tone-red" data-error404-action="restart"><b>RIAVVIA LA PARTITA</b></button><button class="choice season-event-choice tone-blue" data-error404-action="continue"><b>CONTINUA COMUNQUE</b></button>`;
 else if(event.storyType==='technician')choices=`<button class="choice season-event-choice tone-blue" data-error404-action="install"><b>INSTALLA L’ANTIVIRUS</b></button><button class="choice season-event-choice tone-red" data-error404-action="ignore"><b>NON DARE ASCOLTO AL TECNICO</b></button>`;
 else choices=`<button class="choice season-event-choice tone-red" data-error404-action="restart"><b>RIAVVIA</b></button>`;
 return `<div class="season-event-overlay" role="presentation" ${seasonEventMinimized?'hidden':''}><section class="season-event-dialog story-event-dialog error404-story-dialog" role="dialog" aria-modal="true" aria-labelledby="seasonEventTitle" aria-describedby="seasonEventCopy"><button class="season-event-minimize" data-event-minimize type="button" aria-label="Riduci l’evento e consulta la pagina">━ Riduci</button><div class="season-event-head"><div class="season-event-kicker">Evento storia · sistema</div><h2 class="season-event-title" id="seasonEventTitle">${esc(event.title)}</h2><p class="season-event-copy" id="seasonEventCopy">${esc(event.text)}</p></div><div class="choice-grid season-event-choice-grid">${choices}</div><p class="season-event-hint">ERR_CODE: 404_STORY_ARC</p></section></div><aside class="season-event-dock story-event-dock" ${seasonEventMinimized?'':'hidden'} aria-label="Evento storia in attesa"><button class="season-event-dock-button" data-event-expand type="button"><span class="season-event-dock-pulse" aria-hidden="true"></span><span class="season-event-dock-copy"><span>Evento storia</span><b>${esc(event.title)}</b></span><span class="season-event-dock-open">Riapri ↑</span></button></aside>`;
}
function bindError404StoryControls(){document.querySelectorAll('[data-error404-action]').forEach(button=>button.onclick=()=>resolveError404Action(button.dataset.error404Action))}
function renderError404StoryPanel(){
 const story=error404StoryState();if(!story.scheduled||story.completed||!story.corrupted)return'';
 return `<section class="event-card"><div class="label">Storia · Errore 404</div><h3>⚠ Sistema corrotto</h3><p>I file della stagione non rispondono correttamente.</p></section>`;
}
function corruptError404Text(value){
 const text=String(value||'');if(text.length<4)return text;const swaps=[['a','@'],['e','3'],['i','1'],['o','0'],['s','$'],['r','Я']];let out=text;const [from,to]=swaps[Math.floor(Math.random()*swaps.length)];const index=out.toLowerCase().indexOf(from);if(index>=0)out=out.slice(0,index)+to+out.slice(index+1);else{const cut=Math.max(1,Math.min(out.length-1,Math.floor(Math.random()*out.length)));out=out.slice(0,cut)+out[cut]+out.slice(cut)}return out;
}
function applyError404VisualState(){
 const active=error404CorruptionActive();document.body.classList.toggle('error404-corrupted',active);if(!active)return;
 const root=document.documentElement;root.style.setProperty('--error404-x',`${-3+Math.floor(Math.random()*7)}px`);root.style.setProperty('--error404-y',`${-2+Math.floor(Math.random()*5)}px`);root.style.setProperty('--error404-r',`${(-.45+Math.random()*.9).toFixed(2)}deg`);root.style.setProperty('--error404-skew',`${(-.8+Math.random()*1.6).toFixed(2)}deg`);
 const panels=[...document.querySelectorAll('#screen .panel')];if(panels.length){panels[Math.floor(Math.random()*panels.length)]?.classList.add('glitch-panel-a');panels[Math.floor(Math.random()*panels.length)]?.classList.add('glitch-panel-b')}
 const labels=[...document.querySelectorAll('#screen .label, #screen .calendar-row b')].filter(node=>node&&node.textContent&&node.textContent.trim().length>3&&!node.closest('.error404-story-dialog'));
 labels.sort(()=>Math.random()-.5).slice(0,Math.min(4,labels.length)).forEach(node=>{node.textContent=corruptError404Text(node.textContent);node.classList.add('error404-glitch-word')});
}

function fantaballopoliState(){
 state.story=state.story&&typeof state.story==='object'?state.story:{};
 state.story.fantaballopoli=state.story.fantaballopoli&&typeof state.story.fantaballopoli==='object'?state.story.fantaballopoli:freshState().story.fantaballopoli;
 return state.story.fantaballopoli;
}
function initializeFantaballopoliStory(scheduled=true){
 const story=fantaballopoliState();Object.assign(story,freshState().story.fantaballopoli);story.initialized=true;story.scheduled=Boolean(scheduled);story.triggerMatchday=2+Math.floor(Math.random()*15);story.stage=story.scheduled?'waiting':'inactive';
}
function initializeStoryArc(){
 initializeMeritStory(false);initializeFantaballopoliStory(false);initializeError404Story(false);
 const storyChance=.2*coachEventChanceFactor();
 if(Math.random()>=storyChance)return;
 const selected=Math.floor(Math.random()*3);if(selected===0)initializeMeritStory(true);else if(selected===1)initializeFantaballopoliStory(true);else initializeError404Story(true);
}
function fantaballopoliAllowsNegativeOvr(){return Boolean(fantaballopoliState().negativeOvrAllowed)}
function fantaballopoliHighestRosterEntry(){
 return [...rosterPlayers()].sort((a,b)=>{const av=(Number(a.player?.ovr)||0)+activeOvrBonus(a.player),bv=(Number(b.player?.ovr)||0)+activeOvrBonus(b.player);return bv-av||String(a.player?.name||'').localeCompare(String(b.player?.name||''),'it')})[0]||null;
}
function prepareFantaballopoliStoryEvent(){
 const story=fantaballopoliState();if(state.phase!=='season'||state.pendingEvent||!story.initialized||!story.scheduled||story.completed)return false;
 if(story.stage==='waiting'&&Number(state.matchday)>=Number(story.triggerMatchday)&&Number(state.matchday)<19){story.stage='opening';state.pendingEvent={kind:'storyFantaballopoli',storyType:'opening',resolved:false,title:'Fantaballopoli',text:'Un personaggio misterioso ti chiede di perdere la prossima partita.'};setAchievementCareerFlag('fantaballopoliStarted',true);unlockAchievement('benvenuti-a-fantaballopoli');return true}
 if(story.stage==='part2_waiting'){
   const target=rosterEntry(story.targetPlayerId);if(!target){story.stage='ended';story.completed=true;return false}
   state.pendingEvent={kind:'storyFantaballopoli',storyType:'part2',resolved:false,title:'Il giocatore scomodo',text:`Il personaggio misterioso ritorna. «${story.targetPlayerName} è scomodo ai poteri forti. Scambialo al prossimo draft di metà campionato.»`};return true
 }
 if(story.stage==='curse'&&story.curseMatches>=story.satisfactionAfter){story.stage='satisfaction_waiting'}
 if(story.stage==='satisfaction_waiting'){state.pendingEvent={kind:'storyFantaballopoli',storyType:'satisfaction',resolved:false,title:'Sei soddisfatto?',text:'Il personaggio misterioso ritorna. «Sei soddisfatto del nostro accordo?»'};return true}
 if(story.stage==='corruption'&&!story.investigatorShown&&Number(state.matchday)>=Number(story.investigatorDueMatchday||30))story.stage='investigator_waiting';
 if(story.stage==='investigator_waiting'){story.investigatorShown=true;state.pendingEvent={kind:'storyFantaballopoli',storyType:'investigator',resolved:false,title:'L’investigatore',text:'Un investigatore arriva nel tuo ufficio. «Forse questo campionato è truccato.»'};setAchievementCareerFlag('fantaballopoliInvestigatorReached',true);unlockAchievement('intercettazioni');return true}
 return false;
}
function fantaballopoliForcesLoss(){const story=fantaballopoliState();return Boolean(story.forcedLossPending&&story.stage==='forced_loss_pending')}
function fantaballopoliMatchRule(){
 const story=fantaballopoliState();const active=story.corruptionFull&&story.stage==='corruption';
 return {forcedLoss:fantaballopoliForcesLoss(),forcedWin:Boolean(active&&story.corruptionMatchIndex<=1),tenExpulsions:Boolean(active&&story.corruptionMatchIndex===0),negativeOpponentGoals:Boolean(active&&story.corruptionMatchIndex===1),extremeOpponentRisk:Boolean(active)};
}
function applyFantaballopoliOpponentRisks(opponent,lineup,rule){
 const result={expelled:[],injured:[],powerPenalty:0};if(!opponent||!rule)return result;
 const entries=(Array.isArray(lineup)?lineup:[]).filter(entry=>entry?.player),expelled=new Map(),injured=new Map();
 if(rule.tenExpulsions)shuffle(entries).slice(0,10).forEach(entry=>expelled.set(String(entry.playerId),entry));
 if(rule.extremeOpponentRisk)entries.forEach(entry=>{if(Math.random()<.60)expelled.set(String(entry.playerId),entry);if(Math.random()<physioAdjustedInjuryChance(.60))injured.set(String(entry.playerId),entry)});
 expelled.forEach(entry=>{const status=opponentStatusOf(opponent,entry.playerId);status.suspension=Math.max(2,Number(status.suspension)||0)});
 injured.forEach(entry=>{const status=opponentStatusOf(opponent,entry.playerId);status.injury=Math.max(2,Number(status.injury)||0)});
 result.expelled=[...expelled.values()];result.injured=[...injured.values()];result.powerPenalty=Math.min(55,result.expelled.length*4+result.injured.length*2);return result;
}
function createGiudaForEntry(entry){
 if(!entry)return null;const story=fantaballopoliState(),target=story.targetPlayerId?playerById(story.targetPlayerId):null,source=target||entry.player||playerById(entry.playerId)||{};
 const id=story.giudaId||`story-giuda-${String(state.meta?.createdAt||Date.now()).replace(/[^0-9]/g,'')}-${Date.now()}`;
 const giudaOvr=coachIs('young-beautiful')?84:666;
 const giuda=registerGeneratedEventPlayer({...source,baseOvr:giudaOvr,id,name:'Giuda',ovr:giudaOvr,club:'fantaballopoli',Position:source.Position||story.targetRole||entry.slot,role:source.role||roleOf(source),roleLabel:source.roleLabel||'',subscriber:'no',eventPlayer:true,fantaballopoli:true});
 story.giudaId=String(giuda.id);story.targetRole=String(entry.slot||source.Position||'');return giuda;
}
function fantaballopoliRequiresGiuda(playerId){const story=fantaballopoliState();return story.stage==='awaiting_midseason'&&String(playerId||'')===String(story.targetPlayerId||'')}
function removeGiudaFromRoster(){
 const story=fantaballopoliState(),id=String(story.giudaId||'');if(!id)return false;const index=state.draft.roster.findIndex(entry=>String(entry.playerId)===id);if(index<0)return false;state.draft.roster.splice(index,1);delete state.statuses[id];delete state.playInjured[id];return true;
}
function resolveFantaballopoliMidseason(){
 const story=fantaballopoliState();if(story.midseasonResolved||story.stage!=='awaiting_midseason')return false;story.midseasonResolved=true;
 const change=(state.midseason?.changes||[]).find(item=>String(item.outId)===String(story.targetPlayerId));
 if(!change){story.stage='ended_not_traded';story.completed=true;return false}
 let index=state.draft.roster.findIndex(entry=>String(entry.playerId)===String(change.incomingId));
 if(index<0)index=state.draft.roster.findIndex(entry=>String(entry.slot)===String(change.slot));
 if(index<0){story.stage='ended_not_traded';story.completed=true;return false}
 const giuda=createGiudaForEntry(state.draft.roster[index]);if(!giuda)return false;
 state.draft.roster[index].playerId=String(giuda.id);state.draft.roster[index].player={...giuda};
 change.incomingId=String(giuda.id);change.incoming='Giuda';change.incomingOvr=Number(giuda.ovr)||666;
 story.curseActive=true;story.negativeOvrAllowed=true;story.curseMatches=0;story.satisfactionAfter=3+Math.floor(Math.random()*3);story.stage='curse';story.completed=false;setAchievementCareerFlag('fantaballopoliTradeComplied',true);setAchievementCareerFlag('fantaballopoliGiudaBetrayal',true);unlockAchievement('giuda');refreshOpponentClubRosters();return true;
}
function applyFantaballopoliCurse(result){
 const story=fantaballopoliState();if(!story.curseActive||!story.giudaId)return;
 const affected=[];rosterPlayers().forEach(entry=>{if(String(entry.playerId)===String(story.giudaId))return;const player=entry.player||playerById(entry.playerId)||{};const before=Number.isFinite(Number(player.ovr))?Number(player.ovr):0,after=before-20;entry.player={...player,ovr:after};affected.push({id:String(entry.playerId),name:player.name||'Giocatore',before,after})});
 story.curseMatches++;if(result)result.fantaballopoliCurse={count:affected.length,hidden:true};
 if(story.stage==='curse'&&story.curseMatches>=story.satisfactionAfter)story.stage='satisfaction_waiting';
}
function tickFantaballopoliAfterMatch(result){
 const story=fantaballopoliState();if(!result||story.completed)return;
 if(story.forcedLossPending&&story.stage==='forced_loss_pending'){
   story.forcedLossPending=false;const target=fantaballopoliHighestRosterEntry();
   if(target){story.targetPlayerId=String(target.playerId);story.targetPlayerName=String(target.player?.name||'Il giocatore più forte');story.targetRole=String(target.slot||target.player?.Position||'');story.stage='part2_waiting'}else{story.stage='ended';story.completed=true}
 }
 if(story.curseActive)applyFantaballopoliCurse(result);
 if(story.corruptionFull&&story.stage==='corruption')story.corruptionMatchIndex++;
}
function restartLeagueAfterFantaballopoli(){
 const story=fantaballopoliState();removeGiudaFromRoster();story.curseActive=false;story.corruptionFull=false;story.forcedLossPending=false;story.scheduled=false;story.completed=true;story.stage='completed';
 const generated=(state.seasonRules?.generatedEventPlayers||[]).filter(player=>String(player.id)!==String(story.giudaId));
 const formation=state.seasonRules?.leagueFormation||state.formation;const currentTeams=(state.teams||[]).filter(team=>team&&team.id);const draftedIds=currentUserPlayerIds();
 state.seasonRules={...freshState().seasonRules,leagueFormation:formation,generatedEventPlayers:generated};
 state.activeEffects=[];state.statuses={};state.playInjured={};state.pendingEvent=null;state.history=[];state.lastResult=null;state.lastRoundResults=[];state.stats=freshState().stats;state.quest=freshState().quest;state.eventChains=freshState().eventChains;state.cup=freshState().cup;state.midseason=freshState().midseason;state.seenDecisionEvents=[];state.analytics=freshState().analytics;state.chaos=freshState().chaos;state.submitted=false;
 state.meta.submissionCode='';state.meta.submittedAt='';state.meta.submissionPendingAt='';state.meta.lastSubmissionError='';
 currentTeams.forEach(team=>{if(team.id===USER_ID){team.strength=teamPowerBase();return}team.roster=buildClubRoster(team.clubId||team.id,draftedIds);team.statuses={};team.playerOverrides={};team.chaos=freshState().teams?.[0]?.chaos||{activeEffects:[],seenDecisionEvents:[],decisions:0,midseasonPickDelta:0,matchDuration:90,futureScorerId:'',futureInjuryZeroPoints:false,sixtyPointFear:false,eventChanceMultiplier:1,nonItalianChemZero:false,formation:'',latestDecision:null}});
 state.teams=currentTeams;state.schedule=generateSchedule(state.teams.map(team=>team.id));state.seasonRules.seasonLength=state.schedule.length;state.standings={};state.teams.forEach(team=>state.standings[team.id]={id:team.id,name:team.name,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});state.matchday=0;state.phase='season';resetSeasonAnalytics();save();prepareEvent();render();toast('Fantaballopoli conclusa. Il campionato riparte dalla giornata 1.');
}
function resolveFantaballopoliAction(action){
 const event=state.pendingEvent,story=fantaballopoliState();if(!event||event.kind!=='storyFantaballopoli'||event.resolved)return;
 if(event.storyType==='opening'){
   if(action==='accept'){setAchievementCareerFlag('fantaballopoliOpeningAccepted',true);story.forcedLossPending=true;story.stage='forced_loss_pending';event.result='Accordo accettato. La prossima partita è già decisa.'}
   else{setAchievementCareerFlag('fantaballopoliOpeningRejected',true);story.stage='rejected';story.completed=true;unlockAchievement('mani-pulite');event.result='Hai rifiutato. La storia Fantaballopoli termina qui.'}
   event.resolved=true;
 }else if(event.storyType==='part2'){
   story.stage='awaiting_midseason';event.resolved=true;event.result=`Al draft di metà campionato potrai decidere se scambiare ${story.targetPlayerName}.`;
 }else if(event.storyType==='satisfaction'){
   if(action==='stop'){removeGiudaFromRoster();story.curseActive=false;story.stage='ended_deal';story.completed=true;event.result='Giuda scompare e la maledizione termina. Il suo posto resta vuoto.'}
   else{setAchievementCareerFlag('fantaballopoliAcceptedMore',true);story.corruptionFull=true;story.corruptionMatchIndex=0;story.investigatorDueMatchday=29+Math.floor(Math.random()*6);story.stage='corruption';if(achievementFantaballopoliAcceptedAll())unlockAchievement('dentro-fino-al-collo');event.result='Hai chiesto di più. Il personaggio misterioso sorride.'}
   event.resolved=true;
 }else if(event.storyType==='investigator'){
   if(action==='confess'){if(userStanding())userStanding().pts=-30;story.stage='confessed';story.completed=true;story.curseActive=false;story.corruptionFull=false;event.resolved=true;event.result='Hai ammesso le tue colpe: la squadra scende a -30 punti. La storia termina.'}
   else{
     story.abruptEnd=true;const rank=sortedTable().findIndex(row=>row.id===USER_ID)+1;
     if(rank!==1){story.stage='ended_denial_no_title';story.completed=true;story.curseActive=false;story.corruptionFull=false;state.pendingEvent=null;state.phase='finished'}
     else{story.stage='accusation';state.pendingEvent={kind:'storyFantaballopoli',storyType:'accusation',resolved:false,title:'L’accusa',text:`Il personaggio misterioso arriva con l’investigatore. «È lui, Mister ${state.coachName||'Mister'}! Ha corrotto questo campionato e ha provato a corrompere anche me.»`}}
   }
 }else if(event.storyType==='accusation'){
   state.pendingEvent=null;
   if(action==='blame'){story.finale={eligible:true,played:false,userGoals:0,opponentGoals:0,won:false,pointsApplied:false};story.stage='juventus_final';state.phase='fantaballopoli-final'}
   else{story.stage='restart_message';state.phase='fantaballopoli-restart'}
 }
 seasonEventMinimized=false;seasonEventUiKey='';save();render();
}
function renderFantaballopoliEvent(event){
 const key=JSON.stringify(['fantaballopoli',event.storyType,state.matchday]);if(seasonEventUiKey!==key){seasonEventUiKey=key;seasonEventMinimized=false}
 let choices='';
 if(event.storyType==='opening')choices=`<button class="choice season-event-choice tone-blue" data-fanta-action="accept"><b>Accetta</b><small>La prossima partita verrà persa automaticamente.</small></button><button class="choice season-event-choice tone-red" data-fanta-action="reject"><b>Rifiuta</b><small>La storia termina immediatamente.</small></button>`;
 else if(event.storyType==='part2')choices=`<button class="choice season-event-choice tone-blue" data-fanta-action="ack"><b>Ho capito</b><small>La decisione verrà presa al draft di metà campionato.</small></button>`;
 else if(event.storyType==='satisfaction')choices=`<button class="choice season-event-choice tone-red" data-fanta-action="stop"><b>No</b><small>Perdi Giuda, il suo slot resta vuoto e la maledizione termina.</small></button><button class="choice season-event-choice tone-blue" data-fanta-action="more"><b>Ne voglio di più</b><small>Accetta un nuovo accordo con i poteri forti.</small></button>`;
 else if(event.storyType==='investigator')choices=`<button class="choice season-event-choice tone-red" data-fanta-action="confess"><b>Ammetti le tue colpe</b><small>Perdi tutti i punti e vai a -30 in campionato.</small></button><button class="choice season-event-choice tone-blue" data-fanta-action="deny"><b>Nega tutto</b><small>Il campionato termina immediatamente.</small></button>`;
 else choices=`<button class="choice season-event-choice tone-blue" data-fanta-action="blame"><b>Nega e incolpa il personaggio misterioso</b><small>Nessuno ti crede: affronterai la Juventus 05/06.</small></button><button class="choice season-event-choice tone-red" data-fanta-action="admit-both"><b>Ammetti la colpa, ma coinvolgi il personaggio misterioso</b><small>Ti verrà chiesto di dimostrare il tuo valore.</small></button>`;
 return `<div class="season-event-overlay" role="presentation" ${seasonEventMinimized?'hidden':''}><section class="season-event-dialog story-event-dialog" role="dialog" aria-modal="true" aria-labelledby="seasonEventTitle" aria-describedby="seasonEventCopy"><button class="season-event-minimize" data-event-minimize type="button" aria-label="Riduci l’evento e consulta la pagina">━ Riduci</button><div class="season-event-head"><div class="season-event-kicker">Evento storia</div><h2 class="season-event-title" id="seasonEventTitle">${esc(event.title)}</h2><p class="season-event-copy" id="seasonEventCopy">${esc(event.text)}</p></div><div class="choice-grid season-event-choice-grid">${choices}</div><p class="season-event-hint">Fantaballopoli è una storia alternativa e indipendente dagli altri percorsi narrativi.</p></section></div><aside class="season-event-dock story-event-dock" ${seasonEventMinimized?'':'hidden'} aria-label="Evento storia in attesa"><button class="season-event-dock-button" data-event-expand type="button"><span class="season-event-dock-pulse" aria-hidden="true"></span><span class="season-event-dock-copy"><span>Storia in attesa</span><b>${esc(event.title)}</b></span><span class="season-event-dock-open">Riapri ↑</span></button></aside>`;
}
function bindFantaballopoliControls(){document.querySelectorAll('[data-fanta-action]').forEach(button=>button.onclick=()=>resolveFantaballopoliAction(button.dataset.fantaAction))}
function renderFantaballopoliPanel(){
 const story=fantaballopoliState();syncFantaballopoliAchievements();if(!story.scheduled||story.completed||['idle','inactive','waiting','opening','rejected'].includes(story.stage))return'';
 if(story.stage==='awaiting_midseason'||story.stage==='part2_waiting')return `<section class="event-card"><div class="label">Storia · Fantaballopoli</div><h3>${esc(story.targetPlayerName||'Il giocatore scomodo')}</h3><p>I poteri forti vogliono che venga scambiato al draft di metà campionato.</p></section>`;
 if(['curse','satisfaction_waiting'].includes(story.stage))return `<section class="event-card"><div class="label">Storia · Fantaballopoli</div><h3>Giuda · OVR 666</h3><p>Il nuovo giocatore è entrato nella rosa. Il personaggio misterioso tornerà presto.</p></section>`;
 if(['corruption','investigator_waiting'].includes(story.stage))return `<section class="event-card"><div class="label">Storia · Fantaballopoli</div><h3>L’accordo con i poteri forti</h3><p>Il campionato sta prendendo una piega sempre più sospetta.</p></section>`;
 return'';
}
function showFantaballopoliRestart(){
 screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Fantaballopoli</div><h2>Allora dimostra il tuo valore</h2><div class="final-position">↻</div><p>Giuda scomparirà. Il resto della squadra rimarrà con te e il campionato ripartirà dalla giornata 1. La storia sarà conclusa.</p></div><button id="restartAfterFantaballopoli" class="btn primary">Ricomincia il campionato</button></section>`;
 document.getElementById('restartAfterFantaballopoli').onclick=restartLeagueAfterFantaballopoli;
}
function playFantaballopoliJuventusFinal(){
 const story=fantaballopoliState(),finale=story.finale;if(!finale?.eligible||finale.played)return;
 const tableBefore=sortedTable();finale.rankBeforeBonus=tableBefore.findIndex(row=>String(row.id)===String(USER_ID))+1;finale.pointsBeforeBonus=Number(userStanding()?.pts)||0;
 let [gf,ga]=simulateScore(Math.max(35,matchPower()),105,.02,90);if(gf===ga){if(Math.random()<.42)gf++;else ga++}finale.played=true;finale.userGoals=gf;finale.opponentGoals=ga;finale.won=gf>ga;
 if(finale.won){
   if(!finale.pointsApplied&&userStanding()){userStanding().pts+=38;finale.pointsApplied=true}
   unlockAchievement('juve-battuta');
 }else if(userStanding()){const others=Object.values(state.standings||{}).filter(row=>row.id!==USER_ID).map(row=>Number(row.pts)||0);userStanding().pts=(others.length?Math.min(...others):0)-1000}
 finale.rankAfterBonus=sortedTable().findIndex(row=>String(row.id)===String(USER_ID))+1;
 if(finale.won&&finale.pointsApplied&&Number(finale.rankBeforeBonus)>1&&Number(finale.rankAfterBonus)===1)unlockAchievement('trentotto-denari');
 story.curseActive=false;story.corruptionFull=false;story.completed=true;save();render();
}
function finishFantaballopoliJuventusFinal(){state.phase='finished';save();render()}
function showFantaballopoliFinal(){
 const finale=fantaballopoliState().finale;if(!finale.played){screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Sfida finale · Fantaballopoli</div><h2>Juventus 05/06</h2><div class="final-position">VS</div><p>Nessuno crede alla tua versione dei fatti. Devi affrontare una delle squadre più temute.</p></div><div class="panel"><p>Vittoria: <b>+38 punti</b> in campionato. Sconfitta: <b>ultimo posto</b>.</p><button id="playFantaballopoliFinal" class="btn primary">Gioca la sfida</button></div></section>`;document.getElementById('playFantaballopoliFinal').onclick=playFantaballopoliJuventusFinal;return}
 screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Fantaballopoli conclusa</div><h2>${finale.won?'Hai sconfitto la Juventus 05/06':'La Juventus 05/06 ti ha condannato'}</h2><div class="final-position">${finale.userGoals}–${finale.opponentGoals}</div><p>${finale.won?'Sono stati aggiunti 38 punti alla classifica.':'La tua squadra è stata portata all’ultimo posto.'}</p></div><button id="finishFantaballopoliFinal" class="btn primary">Vai al recap finale</button></section>`;document.getElementById('finishFantaballopoliFinal').onclick=finishFantaballopoliJuventusFinal;
}

function meritStoryState(){
 state.story=state.story&&typeof state.story==='object'?state.story:{};
 state.story.merit=state.story.merit&&typeof state.story.merit==='object'?state.story.merit:freshState().story.merit;
 return state.story.merit;
}
function initializeMeritStory(scheduled=true){
 const story=meritStoryState();
 Object.assign(story,freshState().story.merit);
 story.initialized=true;
 story.scheduled=Boolean(scheduled);
 story.triggerMatchday=2+Math.floor(Math.random()*15);
 story.stage=story.scheduled?'waiting':'inactive';
}
function meritStoryOvrModifier(player){return Number(meritStoryState().ovrModifiers?.[String(player?.id||'')])||0}
function addMeritStoryOvrModifier(playerId,value){
 const story=meritStoryState(),id=String(playerId||'');if(!id||!Number(value))return 0;
 story.ovrModifiers=story.ovrModifiers&&typeof story.ovrModifiers==='object'?story.ovrModifiers:{};
 const sponsorExtra=Number(value)>0?sponsorOvrExtraFor(value):0,adjusted=Number(value)>0?Number(value)+sponsorExtra:Number(value);
 if(sponsorExtra)recordBallariniPlayerBonus(id,sponsorExtra);
 story.ovrModifiers[id]=(Number(story.ovrModifiers[id])||0)+adjusted;
 return story.ovrModifiers[id];
}
function meritLowestBenchEntry(){return [...benchEntries()].sort((a,b)=>(Number(a.player?.ovr)||0)-(Number(b.player?.ovr)||0)||String(a.player?.name||'').localeCompare(String(b.player?.name||''),'it'))[0]||null}
function meritCompatibleStarters(){
 const story=meritStoryState(),player=rosterEntry(story.playerId)?.player||playerById(story.playerId);
 if(!player)return[];
 const starters=starterEntries();
 const compatibleStarters=starters.filter(entry=>userCompatible(player,entry.slot));
 return (compatibleStarters.length?compatibleStarters:starters).sort((a,b)=>(Number(a.player?.ovr)||0)-(Number(b.player?.ovr)||0));
}
function prepareMeritStoryEvent(){
 const story=meritStoryState();
 if(state.phase!=='season'||state.pendingEvent||!story.initialized||!story.scheduled||story.stage!=='waiting'||Number(state.matchday)<Number(story.triggerMatchday)||Number(state.matchday)>=19)return false;
 const entry=meritLowestBenchEntry();
 if(!entry){if(Number(state.matchday)<18)story.triggerMatchday=Math.min(18,Number(state.matchday)+1);else story.stage='missed';return false}
 story.playerId=String(entry.playerId);story.playerName=String(entry.player?.name||'Il panchinaro');story.stage='opening';
 state.pendingEvent={kind:'storyMerit',storyType:'opening',resolved:false,title:'Merito di più!',text:`${story.playerName} ti si avvicina. «Sono stufo di fare la panchina!»`,context:{selectingStarter:false}};
 return true;
}
function promoteMeritPlayer(starterId){
 const story=meritStoryState(),benchIndex=state.draft.roster.findIndex(entry=>String(entry.playerId)===String(story.playerId)),starterIndex=state.draft.roster.findIndex(entry=>String(entry.playerId)===String(starterId)&&!entry.bench);
 if(benchIndex<0||starterIndex<0)return false;
 const benchEntry=state.draft.roster[benchIndex],starterEntry=state.draft.roster[starterIndex];
 state.draft.roster[benchIndex]={...benchEntry,slotId:starterEntry.slotId,slot:starterEntry.slot,bench:false};
 state.draft.roster[starterIndex]={...starterEntry,slotId:benchEntry.slotId,slot:benchEntry.slot,bench:true};
 const promotedStatus=statusOf(story.playerId);promotedStatus.injury=0;promotedStatus.suspension=0;promotedStatus.seasonOut=false;promotedStatus.seasonOutReason='';
 story.promoted=true;story.guaranteedGoalPending=true;story.stage='promoted';
 unlockAchievement('la-grande-occasione');
 state.pendingEvent.resolved=true;state.pendingEvent.result=`${story.playerName} entra in campo al posto di ${starterEntry.player?.name||'un titolare'}.`;
 save();render();return true;
}
function transferMeritPlayer(){
 const story=meritStoryState(),index=state.draft.roster.findIndex(entry=>String(entry.playerId)===String(story.playerId));
 if(index<0)return false;
 const entry=state.draft.roster[index],recipient=pick((state.teams||[]).filter(team=>team&&team.id!==USER_ID&&!isTeamEliminated(team.id)));
 state.draft.roster.splice(index,1);
 if(recipient){recipient.roster=Array.isArray(recipient.roster)?recipient.roster:[];if(!recipient.roster.map(String).includes(String(story.playerId)))recipient.roster.push(String(story.playerId));story.recipientTeamId=String(recipient.id);story.recipientTeamName=String(recipient.name||'un’altra squadra')}
 story.transferred=true;story.stage='ended_transferred';
 state.pendingEvent.resolved=true;state.pendingEvent.result=`${story.playerName} lascia immediatamente la rosa e viene ceduto a ${story.recipientTeamName||'un’altra squadra del campionato'}.`;
 save();render();return true;
}
function ensureMeritTransferredPlayer(){
 const story=meritStoryState();if(!story.transferred||!story.recipientTeamId||!story.playerId)return;
 const team=teamById(story.recipientTeamId);if(!team)return;team.roster=Array.isArray(team.roster)?team.roster:[];if(!team.roster.map(String).includes(String(story.playerId)))team.roster.push(String(story.playerId));
}
function chooseMeritOpeningAction(action){
 const event=state.pendingEvent;if(!event||event.kind!=='storyMerit'||event.storyType!=='opening'||event.resolved)return;
 if(action==='reject'){transferMeritPlayer();return}
 const starters=meritCompatibleStarters();if(!starters.length){event.resolved=true;event.result='Non ci sono titolari disponibili da sostituire.';save();render();return}
 event.context=event.context&&typeof event.context==='object'?event.context:{};event.context.selectingStarter=true;save();render();
}
function strongestMeritAttacker(){
 const attackers=rosterPlayers().filter(entry=>roleOf(entry.player)==='A');
 const pool=attackers.length?attackers:rosterPlayers();
 return [...pool].sort((a,b)=>((Number(b.player?.ovr)||0)+activeOvrBonus(b.player))-((Number(a.player?.ovr)||0)+activeOvrBonus(a.player)))[0]||null;
}
function prepareMeritPostMidseasonEvent(){
 const story=meritStoryState();if(!story.promoted||story.postMidseasonShown||story.transferred)return false;
 const entry=rosterEntry(story.playerId),kept=Boolean(entry&&!entry.bench);
 story.postMidseasonShown=true;story.branch=kept?'kept':'traded';story.stage=kept?'kept_pending':'traded_pending';
 state.pendingEvent=kept
  ?{kind:'storyMerit',storyType:'kept',resolved:false,title:'La fiducia',text:`${story.playerName} bussa al tuo ufficio. «Grazie mille della fiducia, Mister ${state.coachName||'Mister'}.»`}
  :{kind:'storyMerit',storyType:'traded',resolved:false,title:'Sei un infame!',text:`Un uomo palesemente ubriaco ti si avvicina. È ${story.playerName}. «Sei un infame! Mi hai rovinato la carriera, pensavo che credessi in me!»`};
 return true;
}
function acknowledgeMeritPostEvent(){
 const event=state.pendingEvent,story=meritStoryState();if(!event||event.kind!=='storyMerit'||event.resolved)return;
 if(event.storyType==='traded'){
   const attacker=strongestMeritAttacker();
   story.challenge={active:Boolean(attacker),status:attacker?'active':'lost',attackerId:String(attacker?.playerId||''),attackerName:String(attacker?.player?.name||''),matchesPlayed:0,goals:0};
   story.stage=attacker?'challenge':'challenge_lost';
   event.result=attacker?`${attacker.player.name}, il tuo attaccante più forte, deve segnare almeno 3 gol nelle prossime 3 partite.`:'Non hai un attaccante disponibile: la storia termina.';
 }else{
   story.stage='loyalty';
   event.result=`Da ora ${story.playerName} guadagna +5 OVR dopo ogni vittoria e perde 3 OVR dopo ogni sconfitta.`;
 }
 event.resolved=true;save();render();
}
function renderMeritStoryEvent(event){
 const story=meritStoryState(),eventKey=JSON.stringify(['merit',event.storyType,event.context||{},state.matchday]);if(seasonEventUiKey!==eventKey){seasonEventUiKey=eventKey;seasonEventMinimized=false}
 let choices='';
 if(event.storyType==='opening'){
   if(event.context?.selectingStarter){
     choices=meritCompatibleStarters().map(entry=>`<div class="season-event-choice-float"><button class="choice season-event-choice tone-blue" data-merit-starter="${esc(entry.playerId)}" type="button"><span class="season-event-option-label">Titolare da sostituire</span><b>${esc(entry.player?.name||'Giocatore')}</b><small>${esc(entry.slot)} · OVR ${Number(entry.player?.ovr)||0}</small></button></div>`).join('');
   }else choices=`<div class="season-event-choice-float"><button class="choice season-event-choice tone-blue" data-merit-action="promote" type="button"><span class="season-event-option-label">Opzione A</span><b>Mettilo in campo</b><small>Prenderà il posto di un tuo titolare.</small></button></div><div class="season-event-choice-float"><button class="choice season-event-choice tone-red" data-merit-action="reject" type="button"><span class="season-event-option-label">Opzione B</span><b>Sei un bidone!</b><small>Fallo marcire in panchina.</small></button></div>`;
 }else{
   const copy=event.storyType==='traded'?'Accetta la sfida':'Continua';
   const effect=event.storyType==='traded'?'Il tuo attaccante più forte dovrà segnare 3 gol in 3 partite.':'Ogni vittoria darà +5 OVR al giocatore; ogni sconfitta gli toglierà 3 OVR.';
   choices=`<div class="season-event-choice-float"><button class="choice season-event-choice tone-blue" data-merit-ack type="button"><span class="season-event-option-label">Storia</span><b>${copy}</b><small>${effect}</small></button></div>`;
 }
 return `<div class="season-event-overlay" role="presentation" ${seasonEventMinimized?'hidden':''}><section class="season-event-dialog story-event-dialog" role="dialog" aria-modal="true" aria-labelledby="seasonEventTitle" aria-describedby="seasonEventCopy"><button class="season-event-minimize" data-event-minimize type="button" aria-label="Riduci l’evento e consulta la pagina">━ Riduci</button><div class="season-event-head"><div class="season-event-kicker">Evento storia</div><h2 class="season-event-title" id="seasonEventTitle">${esc(event.title)}</h2><p class="season-event-copy" id="seasonEventCopy">${esc(event.text)}</p></div><div class="choice-grid season-event-choice-grid">${choices}</div><p class="season-event-hint">Questa scelta può modificare il percorso narrativo della stagione.</p></section></div><aside class="season-event-dock story-event-dock" ${seasonEventMinimized?'':'hidden'} aria-label="Evento storia in attesa"><button class="season-event-dock-button" data-event-expand type="button"><span class="season-event-dock-pulse" aria-hidden="true"></span><span class="season-event-dock-copy"><span>Storia in attesa</span><b>${esc(event.title)}</b></span><span class="season-event-dock-open">Riapri ↑</span></button></aside>`;
}
function bindMeritStoryControls(){
 document.querySelectorAll('[data-merit-action]').forEach(button=>button.onclick=()=>chooseMeritOpeningAction(button.dataset.meritAction));
 document.querySelectorAll('[data-merit-starter]').forEach(button=>button.onclick=()=>promoteMeritPlayer(button.dataset.meritStarter));
 document.querySelectorAll('[data-merit-ack]').forEach(button=>button.onclick=acknowledgeMeritPostEvent);
}
function renderMeritStoryPanel(){
 const story=meritStoryState();
 if(!story.promoted||story.transferred||['opening','waiting','inactive','idle','missed'].includes(story.stage))return'';
 if(story.challenge?.status==='active')return `<section class="event-card"><div class="label">Storia · Merito di più!</div><h3>Sfida di ${esc(story.challenge.attackerName)}</h3><p>Segnare 3 gol in 3 partite: <b>${story.challenge.goals}/3 gol</b> · <b>${story.challenge.matchesPlayed}/3 partite</b>.</p></section>`;
 if(story.challenge?.status==='won')return `<section class="event-card"><div class="label">Storia · Sfida completata</div><h3>${esc(story.challenge.attackerName)} ha mantenuto la promessa</h3><p>Ha ottenuto <b>+10 OVR</b> fino a fine stagione. Se sarà capocannoniere potrà sbloccare l’Argentina.</p></section>`;
 if(story.challenge?.status==='lost')return `<section class="event-card"><div class="label">Storia conclusa</div><h3>Sfida fallita</h3><p>${esc(story.challenge.attackerName||'L’attaccante')} ha ricevuto <b>−10 OVR</b> fino a fine stagione.</p></section>`;
 if(story.branch==='kept'&&story.stage==='loyalty')return `<section class="event-card"><div class="label">Storia · Fiducia</div><h3>${esc(story.playerName)}</h3><p>Modificatore accumulato: <b>${(Number(story.ovrModifiers?.[story.playerId])||0)>=0?'+':''}${Number(story.ovrModifiers?.[story.playerId])||0} OVR</b>. Vittoria +5, sconfitta −3.</p></section>`;
 return'';
}
function applyMeritGuaranteedGoal(events,lineup,team,opponent,duration){
 const story=meritStoryState();if(!story.guaranteedGoalPending||story.stage!=='promoted')return false;
 const scorer=(lineup||[]).find(entry=>String(entry.playerId||entry.player?.id)===String(story.playerId));if(!scorer)return false;
 let goal=(events||[]).find(event=>String(event.playerId)===String(story.playerId));
 if(!goal){const others=(lineup||[]).filter(entry=>entry?.player&&String(entry.playerId)!==String(story.playerId)),assist=Math.random()<.72&&others.length?pick(others):null,minute=Math.max(3,Math.min(Number(duration)||90,Math.floor(6+Math.random()*Math.max(1,(Number(duration)||90)-10))));if((events||[]).length){goal=events[0];goal.playerId=String(story.playerId);goal.player=scorer.player.name;goal.assistId=String(assist?.playerId||'');goal.assist=assist?.player?.name||'';goal.description=goalDescription(scorer.player,assist?.player,team?.name||'',opponent?.name||'avversario');goal.isMeritStoryGoal=true}else{goal={minute,playerId:String(story.playerId),assistId:String(assist?.playerId||''),player:scorer.player.name,assist:assist?.player?.name||'',teamId:String(team?.id||USER_ID),teamName:team?.name||state.teamName,goalValue:goalValueForMinute(minute),isMeritStoryGoal:true,description:goalDescription(scorer.player,assist?.player,team?.name||'',opponent?.name||'avversario')};events.push(goal)}}else goal.isMeritStoryGoal=true;
 story.guaranteedGoalPending=false;return true;
}
function tickMeritStoryAfterMatch(result){
 const story=meritStoryState();if(!result)return;
 result.storyUpdates=Array.isArray(result.storyUpdates)?result.storyUpdates:[];
 if(story.challenge?.active&&story.challenge.status==='active'){
   const scored=(result.goals||[]).filter(goal=>String(goal.playerId)===String(story.challenge.attackerId)).length;
   story.challenge.goals+=scored;story.challenge.matchesPlayed++;
   result.storyUpdates.push({title:'Sfida 3 gol in 3 partite',message:`${story.challenge.attackerName}: ${story.challenge.goals}/3 gol dopo ${story.challenge.matchesPlayed}/3 partite.`,success:true});
   if(story.challenge.matchesPlayed>=3){
     story.challenge.active=false;
     const success=story.challenge.goals>=3;story.challenge.status=success?'won':'lost';story.stage=success?'challenge_won':'challenge_lost';addMeritStoryOvrModifier(story.challenge.attackerId,success?10:-10);
     result.storyUpdates.push({title:success?'Sfida vinta':'Sfida persa',message:success?`${story.challenge.attackerName} riceve +10 OVR fino a fine stagione.`:`${story.challenge.attackerName} perde 10 OVR fino a fine stagione. La storia termina qui.`,success});
   }
 }
 if(story.branch==='kept'&&story.stage==='loyalty'&&rosterEntry(story.playerId)){
   const delta=Number(result.gf)>Number(result.ga)?5:Number(result.gf)<Number(result.ga)?-3:0;
   if(delta){const total=addMeritStoryOvrModifier(story.playerId,delta);result.storyUpdates.push({title:'La fiducia',message:`${story.playerName} ${delta>0?'guadagna +5':'perde 3'} OVR. Modificatore totale: ${total>=0?'+':''}${total}.`,success:delta>0})}
 }
}
function meritPlayerLeadsBucket(playerId,bucket){
 const values=Object.values(state.stats?.[bucket]||{}).map(Number).filter(Number.isFinite),best=values.length?Math.max(...values):0,value=Number(state.stats?.[bucket]?.[String(playerId)])||0;return best>0&&value===best;
}
function prepareMeritStoryFinale(){
 const story=meritStoryState();if(isTeamEliminated(USER_ID)||story.finale?.played||story.finale?.eligible)return false;
 let nation='',opponent='';
 if(story.branch==='traded'&&story.challenge?.status==='won'&&meritPlayerLeadsBucket(story.challenge.attackerId,'goals')){nation='Argentina';opponent='Nazionale Argentina'}
 if(story.branch==='kept'&&['goals','assists','mvpVotes','cleanSheets'].some(bucket=>meritPlayerLeadsBucket(story.playerId,bucket))){nation='Brasile';opponent='Nazionale Brasile'}
 if(!nation)return false;
 story.finale={eligible:true,opponent,nation,played:false,userGoals:0,opponentGoals:0,won:false,pointsDelta:0,pointsApplied:false};state.phase='story-final';return true;
}
function playMeritStoryFinale(){
 const story=meritStoryState(),finale=story.finale;if(!finale?.eligible||finale.played)return;
 const userPower=Math.max(35,matchPower()),opponentPower=Math.max(82,nationalStrength(finale.nation)+8);let [gf,ga]=simulateScore(userPower,opponentPower,.05,90);if(gf===ga){if(Math.random()<.5)gf++;else ga++}
 finale.played=true;finale.userGoals=gf;finale.opponentGoals=ga;finale.won=gf>ga;finale.pointsDelta=finale.won?20:-20;
 if(!finale.pointsApplied&&userStanding()){userStanding().pts+=finale.pointsDelta;finale.pointsApplied=true}
 save();render();
}
function finishMeritStoryFinale(){state.phase='finished';save();render()}
function showMeritStoryFinale(){
 const story=meritStoryState(),finale=story.finale,branch=story.branch==='traded'?'Il tuo attaccante è diventato capocannoniere. La sfida promessa è arrivata.':`${story.playerName} ha chiuso al primo posto in una classifica individuale.`;
 if(!finale.played){screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Finale segreto della storia</div><h2>${esc(finale.opponent)}</h2><div class="final-position">VS</div><p>${esc(branch)}</p></div><div class="panel"><h3>Partita speciale</h3><p>La sfida viene giocata prima del recap finale. Vittoria: <b>+20 punti</b>. Sconfitta: <b>−20 punti</b>.</p><button id="playMeritFinale" class="btn primary">Gioca contro ${esc(finale.opponent)}</button></div></section>`;document.getElementById('playMeritFinale').onclick=playMeritStoryFinale;return}
 screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Finale segreto concluso</div><h2>${finale.won?'Impresa completata!':'Sfida persa'}</h2><div class="final-position">${finale.userGoals}–${finale.opponentGoals}</div><p>${esc(state.teamName)} contro ${esc(finale.opponent)}.</p></div><div class="panel"><h3>${finale.pointsDelta>0?'+20':'−20'} punti in campionato</h3><p>Il risultato è stato applicato alla classifica prima del recap finale.</p><button id="finishMeritFinale" class="btn primary">Vai al recap finale</button></div></section>`;document.getElementById('finishMeritFinale').onclick=finishMeritStoryFinale;
}

function getStarterEntries(){return rosterPlayers().filter(r=>!r.bench)}function getBenchEntries(){return rosterPlayers().filter(r=>r.bench)}
function motivatorPermanentChemistryBonus(player){return coachIs('motivator')?Math.max(0,Number(state.seasonRules?.motivatorPermanentChemistry?.[String(player?.id||'')])||0):0}
function addMotivatorPermanentChemistry(playerId,value=1){if(!coachIs('motivator')||!playerId||Number(value)<=0)return 0;state.seasonRules.motivatorPermanentChemistry=state.seasonRules.motivatorPermanentChemistry&&typeof state.seasonRules.motivatorPermanentChemistry==='object'?state.seasonRules.motivatorPermanentChemistry:{};const id=String(playerId),next=Math.max(0,(Number(state.seasonRules.motivatorPermanentChemistry[id])||0)+Number(value));state.seasonRules.motivatorPermanentChemistry[id]=next;return next}
function chemistryBaseRaw(player,list){if(coachIs('ductility'))return 0;const players=Array.isArray(list)?list:[];let v=nationChemistryBonus(player,players)+clubChemistryBonus(player,players)+youngBeautifulChemistryBonus(player);if(isSubscriber(player))v+=5;const subs=players.filter(o=>o.nation===player.nation&&isSubscriber(o)).length;if(isSubscriber(player)&&subs>=2)v+=10;if(normalizeName(player.name)===normalizeName(state.coachName))v+=10;v+=motivatorPermanentChemistryBonus(player);return v}
function chemistryBase(player,list){return coachIs('ductility')||closedPortsAffects(player)?0:chemistryBaseRaw(player,list)}
function activeChemistryEventBonus(player){
 if(coachIs('ductility'))return 0;
 let value=0;
 state.activeEffects.forEach(effect=>{
   if(effect.type==='teamChem')value+=Number(effect.value)||0;
   if(effect.type==='subscriberChem'&&isSubscriber(player))value+=Number(effect.value)||0;
   if(effect.type==='playerChem'&&String(effect.playerId)===String(player.id))value+=Number(effect.value)||0;
 });
 return value;
}
function activeOvrBonus(player){
 if(state.activeEffects.some(effect=>effect.type==='baseOvrOnly'))return 0;
 const ductility=coachIs('ductility');let value=0;
 const include=amount=>{const number=Number(amount)||0;if(!ductility||number<0)value+=number};
 state.activeEffects.forEach(effect=>{
   if(effect.type==='teamOvr')include(effect.value);
   if(effect.type==='subscriberOvr'&&isSubscriber(player))include(effect.value);
   if(effect.type==='playerOvr'&&String(effect.playerId)===String(player.id))include(effect.value);
   if(effect.type==='goalkeeperOvr'&&roleOf(player)==='P')include(effect.value);
 });
 include(meritStoryOvrModifier(player));
 const status=state.statuses?.[String(player?.id||'')];
 if(status&&Number(status.injury)>0&&!ductility)value+=Math.max(0,Number(state.seasonRules.injuredOvrBonus)||0);
 return value;
}
function activeChemistryMultiplier(player){
 if(coachIs('ductility'))return 1;
 let multiplier=parallelCupChemistryMultiplier();
 state.activeEffects.forEach(effect=>{
   if(effect.type==='teamChemMultiplier')multiplier*=Math.max(.1,Number(effect.value)||1);
   if(effect.type==='subscriberChemMultiplier'&&isSubscriber(player))multiplier*=Math.max(.1,Number(effect.value)||1);
   if(effect.type==='playerChemMultiplier'&&String(effect.playerId)===String(player?.id||''))multiplier*=Math.max(.1,Number(effect.value)||1);
 });
 return clamp(multiplier,.1,6);
}
function chemistryIsZeroed(){return coachIs('ductility')||parallelCupChemistryZero()||state.activeEffects.some(effect=>effect.type==='teamChemZero')}
function effectiveChemistryFromBase(player,baseChem=0){
 if(coachIs('ductility')||state.activeEffects.some(effect=>effect.type==='baseOvrOnly'))return 0;
 if(chemistryIsZeroed()||closedPortsAffects(player))return 0;
 const raw=(Number(baseChem)||0)+activeChemistryEventBonus(player);
 const multiplier=activeChemistryMultiplier(player);
 return raw>0?raw*multiplier:raw;
}
function effectiveChemistryBonus(player,players){return effectiveChemistryFromBase(player,chemistryBase(player,players||starterEntries().map(entry=>entry.player).filter(Boolean)))}
function activeEffectBonus(player,baseChem=0){return activeOvrBonus(player)+(effectiveChemistryFromBase(player,baseChem)-(Number(baseChem)||0))}
function sponsorBallariniActive(){return String(state.seasonRules?.sponsorChoice||'')==='ballarini'}
function sponsorFootballManagerActive(){return String(state.seasonRules?.sponsorChoice||'')==='football-manager'}
function recordBallariniPlayerBonus(playerId,value=0){
 const id=String(playerId||''),amount=Math.max(0,Number(value)||0);if(!id||!amount)return 0;
 state.seasonRules.ballariniPlayerBonus=state.seasonRules.ballariniPlayerBonus&&typeof state.seasonRules.ballariniPlayerBonus==='object'?state.seasonRules.ballariniPlayerBonus:{};
 const next=Math.max(0,(Number(state.seasonRules.ballariniPlayerBonus[id])||0)+amount);state.seasonRules.ballariniPlayerBonus[id]=next;return next;
}
function recordBallariniBoostApplication(){
 if(!sponsorBallariniActive())return 0;
 const next=Math.max(0,(Number(state.seasonRules.sponsorOvrBoostCount)||0)+1);state.seasonRules.sponsorOvrBoostCount=next;if(next>=5)unlockAchievement('non-si-attacca-niente');return next;
}
function sponsorOvrExtraFor(value=0,extra={}){
 const applies=sponsorBallariniActive()&&Number(value)>0&&!extra?.sponsorExtra&&!extra?.motivatorExtra;if(!applies)return 0;
 const bonus=Math.max(0,Number(state.seasonRules?.sponsorOvrExtra)||5);if(bonus&&!extra?.skipAchievementTracking)recordBallariniBoostApplication();return bonus;
}
function physioAdjustedInjuryChance(chance=0){return clamp((Number(chance)||0)*(sponsorFootballManagerActive()?Math.max(.1,Number(state.seasonRules?.physioInjuryMultiplier)||.5):1),0,1)}
function activateBallariniSponsor(){state.seasonRules.sponsorChoice='ballarini';state.seasonRules.sponsorOvrExtra=5;state.seasonRules.sponsorOvrBoostCount=0;state.seasonRules.ballariniPlayerBonus={};state.seasonRules.physioInjuryMultiplier=1;state.seasonRules.fmTacticianWins=0;state.seasonRules.fmInjuryOccurred=false;return 'Padelle Ballarini è il nuovo sponsor: ogni bonus OVR positivo ottenuto dagli eventi riceverà +5 OVR aggiuntivi.'}
function activateFootballManagerSponsor(){state.seasonRules.sponsorChoice='football-manager';state.seasonRules.sponsorOvrExtra=0;state.seasonRules.sponsorOvrBoostCount=0;state.seasonRules.ballariniPlayerBonus={};state.seasonRules.physioInjuryMultiplier=.5;state.seasonRules.fmTacticianWins=0;state.seasonRules.fmInjuryOccurred=false;const tactician=activatePersistentTactician();return `${tactician} Il fisioterapista dimezza la probabilità degli infortuni casuali fino a fine stagione.`}
function motivatorBonusScope(type){
 const scopes={teamOvr:{ovr:'teamOvr',chem:'teamChem',kind:'ovr'},playerOvr:{ovr:'playerOvr',chem:'playerChem',kind:'ovr'},teamChem:{ovr:'teamOvr',chem:'teamChem',kind:'chem'},subscriberChem:{ovr:'subscriberOvr',chem:'subscriberChem',kind:'chem'},playerChem:{ovr:'playerOvr',chem:'playerChem',kind:'chem'},teamChemMultiplier:{ovr:'teamOvr',chem:'teamChem',kind:'multiplier'},subscriberChemMultiplier:{ovr:'subscriberOvr',chem:'subscriberChem',kind:'multiplier'},playerChemMultiplier:{ovr:'playerOvr',chem:'playerChem',kind:'multiplier'}};
 return scopes[String(type||'')]||null;
}
function pushEffect(type,value,rounds,extra={}){
 const scope=motivatorBonusScope(type),ovrTypes=new Set(['teamOvr','playerOvr','subscriberOvr','goalkeeperOvr']),sponsorExtra=ovrTypes.has(String(type))?sponsorOvrExtraFor(value,extra):0,sponsoredValue=Number(value)+sponsorExtra,enhance=coachIs('motivator')&&!extra?.motivatorExtra&&scope&&sponsoredValue>0;
 const adjusted=enhance&&scope.kind!=='multiplier'?sponsoredValue+1:sponsoredValue,untilSeasonEnd=Boolean(extra?.untilSeasonEnd),duration=Math.max(1,Number(rounds)||(untilSeasonEnd?remainingSeasonMatches():1));
 state.activeEffects.push({type,value:adjusted,rounds:duration,...extra,untilSeasonEnd,sponsorExtra});
 if(!enhance)return;
 const companionBase={rounds:duration,source:'Motivatore',motivatorExtra:true,untilSeasonEnd};
 if(extra?.playerId)companionBase.playerId=String(extra.playerId);
 if(scope.kind==='ovr')state.activeEffects.push({type:scope.chem,value:1,...companionBase});
 else if(scope.kind==='chem')state.activeEffects.push({type:scope.ovr,value:1,...companionBase});
 else{state.activeEffects.push({type:scope.ovr,value:1,...companionBase});state.activeEffects.push({type:scope.chem,value:1,...companionBase})}
}
function pushSeasonEffect(type,value,extra={}){return pushEffect(type,value,remainingSeasonMatches(),{...extra,untilSeasonEnd:true})}
function applyCreatorMvpBoostAfterMatch(result){
 if(!result)return;
 const mvpId=String(result?.mvpId||'').trim();
 if(!mvpId)return;
 const userIds=new Set(rosterPlayers().map(entry=>String(entry.playerId||'')));
 if(!userIds.has(mvpId))return;
 const player=playerById(mvpId)||statPlayerInfo(mvpId);
 if(!player||!isCreator(player))return;
 state.activeEffects=state.activeEffects.filter(effect=>String(effect?.source||'')!=='creator-mvp-boost');
 pushEffect('teamOvr',1,2,{source:'creator-mvp-boost',label:'Uomo immagine'});
 result.creatorMvpBoost={active:true,playerId:mvpId,playerName:String(player.name||'Creator'),value:1};
}
function midseasonTargetFrom(source=state){
 const delta=Number(source?.seasonRules?.midseasonPickDelta)||0;
 const mandatoryCount=[...new Set([...(Array.isArray(source?.seasonRules?.mandatoryMidseasonPlayerIds)?source.seasonRules.mandatoryMidseasonPlayerIds:[]),source?.seasonRules?.mandatoryMidseasonPlayerId].map(String).filter(Boolean))].length;
 return clamp(Math.max(2+delta,mandatoryCount),1,3);
}
function midseasonTarget(){return midseasonTargetFrom(state)}
function changeMidseasonPicks(delta){
 state.seasonRules.midseasonPickDelta=clamp((Number(state.seasonRules.midseasonPickDelta)||0)+delta,-1,1);
 return `Il draft di metà stagione avrà ${midseasonTarget()} ${midseasonTarget()===1?'cambio':'cambi'}.`;
}
function randomOwnEntry(filter=()=>true){
 const entries=rosterPlayers().filter(filter);
 return entries.length?pick(entries):null;
}
function nextOpponentTeam(){
 if(state.phase!=='season')return null;
 const fixture=userFixture();
 if(!fixture)return null;
 return teamById(fixture.home===USER_ID?fixture.away:fixture.home);
}
function applyPlayerEffect(type,value,rounds,filter=()=>true){
 const entry=randomOwnEntry(filter);
 if(!entry)return 'Nessun giocatore disponibile.';
 pushEffect(type,value,rounds,{playerId:entry.playerId});
 return `${entry.player.name} riceve ${value>=0?'+':''}${value} per ${rounds===1?'la prossima partita':`${rounds} giornate`}.`;
}

function temporaryEventBlocksPlayer(playerId){
 const id=String(playerId||'');
 if(!id)return false;
 return state.activeEffects.some(effect=>['playerUnavailable','playerRest'].includes(String(effect.type||''))&&String(effect.playerId||'')===id&&Number(effect.rounds)>0);
}
function realCurrentLineupEntries(){return resolveLineup().filter(entry=>entry?.player&&!isEmergencyYouthEntry(entry))}
function randomRealCurrentLineupEntry(){const entries=realCurrentLineupEntries();return entries.length?pick(entries):null}
function applyWrongShirtSwap(lineup){
 const rows=(Array.isArray(lineup)?lineup:[]).map(entry=>({...entry}));
 const effect=state.activeEffects.find(item=>item.type==='wrongShirts'&&Number(item.rounds)>0);
 if(!effect)return rows;
 const first=rows.find(entry=>String(entry.playerId||entry.player?.id||'')===String(effect.firstPlayerId||''));
 const second=rows.find(entry=>String(entry.playerId||entry.player?.id||'')===String(effect.secondPlayerId||''));
 if(!first||!second)return rows;
 const firstSlot=first.slot,firstSlotId=first.slotId;
 first.slot=second.slot;first.slotId=second.slotId;
 second.slot=firstSlot;second.slotId=firstSlotId;
 first.wrongShirtSwap=true;second.wrongShirtSwap=true;
 if(!userCompatible(first.player,first.slot))first.malus=(Number(first.malus)||0)-5;
 if(!userCompatible(second.player,second.slot))second.malus=(Number(second.malus)||0)-5;
 return rows;
}
function startWrongShirtsEvent(){
 const candidates=realCurrentLineupEntries();
 if(candidates.length<2)return 'Non ci sono almeno due giocatori reali nella formazione effettiva.';
 const selected=shuffle(candidates).slice(0,2),first=selected[0],second=selected[1];
 [first,second].forEach(item=>{const entry=rosterEntry(item.playerId);if(entry){entry.tipsterForced=true;entry.tipsterForcedMatches=Math.max(1,Number(entry.tipsterForcedMatches)||0)}});
 pushEffect('wrongShirts',1,1,{firstPlayerId:String(first.playerId),secondPlayerId:String(second.playerId),firstPlayerName:first.player.name,secondPlayerName:second.player.name,source:'Maglie con i nomi sbagliati'});
 const firstPenalty=userCompatible(first.player,second.slot)?0:-5,secondPenalty=userCompatible(second.player,first.slot)?0:-5;
 const details=[`${first.player.name} va in ${second.slot}${firstPenalty?' e riceve -5 OVR':''}`,`${second.player.name} va in ${first.slot}${secondPenalty?' e riceve -5 OVR':''}`];
 return `${details.join(' · ')} nella prossima partita.`;
}
function printLastMinuteShirts(){
 const entry=randomRealCurrentLineupEntry();
 if(!entry)return 'Non c’è un giocatore reale disponibile da escludere.';
 pushEffect('playerUnavailable',1,1,{playerId:String(entry.playerId),playerName:entry.player.name,source:'Maglie stampate all’ultimo secondo'});
 pushEffect('teamChem',3,1,{source:'Maglie stampate all’ultimo secondo'});
 return `${entry.player.name} salta la prossima partita. Tutti gli altri giocatori schierati ricevono +3 Intesa.`;
}
function acceptSmallGoalMatch(){
 pushEffect('smallGoals',.65,1,{source:'Porta da calcetto'});
 pushEffect('goalkeeperOvr',10,1,{source:'Porta da calcetto'});
 return 'Nella prossima partita la probabilità di segnare è ridotta per entrambe le squadre e il tuo portiere riceve +10 OVR.';
}
function secretRefereeDealState(source=state){
 const rules=source?.seasonRules||(source.seasonRules={});
 const deal=rules.secretRefereeDeal&&typeof rules.secretRefereeDeal==='object'?rules.secretRefereeDeal:(rules.secretRefereeDeal={});
 deal.active=Boolean(deal.active);deal.choice=['accept','refuse'].includes(String(deal.choice))?String(deal.choice):'';
 deal.startedMatchday=Number.isFinite(Number(deal.startedMatchday))?Number(deal.startedMatchday):-1;
 deal.earnedPoints=Math.max(0,Number(deal.earnedPoints)||0);deal.matchesChecked=Math.max(0,Number(deal.matchesChecked)||0);
 deal.discovered=Boolean(deal.discovered);deal.discoveredMatchday=Number.isFinite(Number(deal.discoveredMatchday))?Number(deal.discoveredMatchday):-1;deal.lastAdjustment=Number(deal.lastAdjustment)||0;
 if(!deal.choice)deal.active=false;
 return deal;
}
function startSecretRefereeDeal(choice){
 const selected=choice==='refuse'?'refuse':'accept',deal=secretRefereeDealState();
 Object.assign(deal,{active:true,choice:selected,startedMatchday:Number(state.matchday)||0,earnedPoints:0,matchesChecked:0,discovered:false,discoveredMatchday:-1,lastAdjustment:0});
 return selected==='accept'?'L’accordo è attivo: riceverai un rigore a favore in ogni partita.':'Hai rifiutato: riceverai un rigore contro in ogni partita.';
}
function secretRefereePenaltyEvent(lineup,team,opponent,duration=90,favour=true){
 const safe=(Array.isArray(lineup)?lineup:[]).filter(entry=>entry&&entry.player),scorer=safe.length?weightedScorer(safe):null;
 const total=Math.max(30,Number(duration)||90),minute=Math.max(2,Math.min(total-1,8+Math.floor(Math.random()*Math.max(1,total-12))));
 const playerId=String(scorer?.playerId||scorer?.player?.id||''),playerName=scorer?.player?.name||'Rigore dell’arbitro ecuadoriano';
 return {minute,playerId,assistId:'',player:playerName,assist:'',teamId:String(team?.id||''),teamName:team?.name||'',goalValue:1,isSecretRefereePenalty:true,description:favour?`L’arbitro ecuadoriano concede un rigore molto generoso a ${team?.name||'questa squadra'}.`:`L’arbitro ecuadoriano assegna un rigore contro ${opponent?.name||'la tua squadra'}.`};
}
function applySecretRefereePenalty(userEvents,opponentEvents,lineup,opponentLineup,userTeam,opponent,duration=90){
 const deal=secretRefereeDealState();if(!deal.active)return'';
 if(deal.choice==='accept'){userEvents.push(secretRefereePenaltyEvent(lineup,userTeam,opponent,duration,true));return'for'}
 if(deal.choice==='refuse'){opponentEvents.push(secretRefereePenaltyEvent(opponentLineup,opponent,userTeam,duration,false));return'against'}
 return'';
}
function resolveSecretRefereeAfterMatch(result){
 const deal=secretRefereeDealState();if(!deal.active||!result)return;
 const gained=Math.max(0,Number(result.pointsAwarded)||0);deal.earnedPoints+=gained;deal.matchesChecked++;
 result.secretRefereeDeal={active:true,choice:deal.choice,earnedPoints:deal.earnedPoints,matchesChecked:deal.matchesChecked,discovered:false};
 if(Math.random()>=.10)return;
 const amount=Math.max(0,Number(deal.earnedPoints)||0),standing=userStanding();
 const adjustment=deal.choice==='accept'?-amount:amount;if(standing)standing.pts+=adjustment;
 deal.active=false;deal.discovered=true;deal.discoveredMatchday=(Number(state.matchday)||0)+1;deal.lastAdjustment=adjustment;
 result.secretRefereeDeal={active:false,choice:deal.choice,earnedPoints:amount,matchesChecked:deal.matchesChecked,discovered:true,adjustment};
 result.eventUpdates=Array.isArray(result.eventUpdates)?result.eventUpdates:[];
 if(deal.choice==='accept')result.eventUpdates.push({success:false,title:'Intercettazioni: accordo scoperto',message:`L’accordo con l’arbitro ecuadoriano è stato scoperto. Perdi ${amount} ${amount===1?'punto':'punti'}, cioè tutti quelli conquistati nelle partite giocate dopo l’accordo. Da ora i rigori pilotati terminano.`});
 else result.eventUpdates.push({success:true,title:'Intercettazioni: proposta scoperta',message:`Le intercettazioni confermano che avevi rifiutato l’accordo. Ottieni altri ${amount} ${amount===1?'punto':'punti'}: i punti conquistati da allora vengono raddoppiati. Da ora tutto torna normale.`});
 const note=deal.choice==='accept'?`Intercettazioni: -${amount} punti, annullati tutti i punti conquistati dopo l’accordo.`:`Intercettazioni: +${amount} punti, raddoppiati i punti conquistati dopo il rifiuto.`;
 result.pointsNote=[result.pointsNote,note].filter(Boolean).join(' ');
}
function insomniacContextEntry(context={}){
 const requested=context?.playerId?rosterEntry(context.playerId):null;
 if(requested&&requested.player)return requested;
 return randomRealCurrentLineupEntry();
}
function sendInsomniacOnField(context={}){
 const entry=insomniacContextEntry(context);if(!entry)return 'Nessun titolare reale disponibile.';
 entry.tipsterForced=true;entry.tipsterForcedMatches=Math.max(1,Number(entry.tipsterForcedMatches)||0);
 pushEffect('playerOvr',-12,1,{playerId:String(entry.playerId),playerName:entry.player.name,insomniacRewardChem:15,source:'Giocatore insonne'});
 return `${entry.player.name} riceve -12 OVR nella prossima partita. Se segna, otterrà +15 Intesa fino a fine stagione.`;
}
function restInsomniacPlayer(context={}){
 const entry=insomniacContextEntry(context);if(!entry)return 'Nessun titolare reale disponibile.';
 pushEffect('playerRest',1,1,{playerId:String(entry.playerId),playerName:entry.player.name,afterRestOvr:5,afterRestRounds:2,source:'Giocatore insonne'});
 return `${entry.player.name} salta la prossima partita. Al rientro riceverà +5 OVR per 2 giornate.`;
}
function resolveClassicEventAfterMatch(result){
 const restRewards=state.activeEffects.filter(effect=>effect.type==='playerRest'&&Number(effect.rounds)<=1).map(effect=>({playerId:String(effect.playerId||''),playerName:String(effect.playerName||playerById(effect.playerId)?.name||'Giocatore'),value:Math.max(1,Number(effect.afterRestOvr)||5),rounds:Math.max(1,Number(effect.afterRestRounds)||2)}));
 if(!result)return restRewards;
 result.eventUpdates=Array.isArray(result.eventUpdates)?result.eventUpdates:[];
 state.activeEffects.filter(effect=>effect.type==='playerOvr'&&Number(effect.insomniacRewardChem)>0&&Number(effect.rounds)>0).forEach(effect=>{
   const id=String(effect.playerId||''),name=String(effect.playerName||playerById(id)?.name||'Il giocatore insonne');
   const scored=(result.goals||[]).some(goal=>String(goal.playerId||'')===id);
   if(scored&&rosterEntry(id)){
     pushSeasonEffect('playerChem',Number(effect.insomniacRewardChem)||15,{playerId:id,source:'Giocatore insonne'});
     unlockAchievement('nottata-produttiva');
     result.eventUpdates.push({success:true,title:'Il giocatore insonne',message:`${name} ha segnato e ottiene +15 Intesa fino a fine stagione.`});
   }else result.eventUpdates.push({success:false,title:'Il giocatore insonne',message:`${name} non ha segnato: il bonus permanente non viene assegnato.`});
 });
 return restRewards;
}
function activateRestRewards(restRewards=[],result=null){
 if(result)result.eventUpdates=Array.isArray(result.eventUpdates)?result.eventUpdates:[];
 restRewards.forEach(reward=>{
   if(!reward.playerId||!rosterEntry(reward.playerId))return;
   pushEffect('playerOvr',reward.value,reward.rounds,{playerId:reward.playerId,playerName:reward.playerName,source:'Rientro del giocatore insonne'});
   if(result)result.eventUpdates.push({success:true,title:'Rientro dopo il riposo',message:`${reward.playerName} rientra con +${reward.value} OVR per ${reward.rounds} giornate.`});
 });
}

function hypnotizeRandomAttacker(){
 const entry=randomOwnEntry(item=>roleOf(item.player)==='A');
 if(!entry)return 'Nessun attaccante disponibile da ipnotizzare.';
 if(Math.random()<.25){
   const rosterEntry=state.draft.roster.find(item=>String(item.playerId)===String(entry.playerId));
   if(rosterEntry){const current=rosterEntry.player||entry.player||playerById(entry.playerId),originalOvr=Math.max(1,Number(current?.ovr)||1);rosterEntry.player={...current,ovr:1,isChicken:true,chickenOriginalOvr:originalOvr};beginMentalistaChicken(rosterEntry,originalOvr);}
   return `Il mentalista sbaglia: ${entry.player.name} viene trasformato in un pollo da 1 OVR. Tra alcune giornate inizierà il Richiamo del pollaio.`;
 }
 pushEffect('playerOvr',8,1,{playerId:entry.playerId});
 return `${entry.player.name} viene ipnotizzato correttamente e riceve +8 OVR nella prossima partita.`;
}

function mentalistaChain(){
 state.eventChains=state.eventChains&&typeof state.eventChains==='object'?state.eventChains:{};
 state.eventChains.mentalista=state.eventChains.mentalista&&typeof state.eventChains.mentalista==='object'?state.eventChains.mentalista:{active:false,stage:0,playerId:'',playerName:'',originalOvr:1,dueMatchday:-1,training:false,nature:false,goals:0,completed:false};
 return state.eventChains.mentalista;
}
function generalChain(){
 state.eventChains=state.eventChains&&typeof state.eventChains==='object'?state.eventChains:{};
 state.eventChains.general=state.eventChains.general&&typeof state.eventChains.general==='object'?state.eventChains.general:{active:false,stage:0,dueMatchday:-1,replacements:[],nationalBoostPending:false,completed:false};
 return state.eventChains.general;
}

function penguinChain(){
 state.eventChains=state.eventChains&&typeof state.eventChains==='object'?state.eventChains:{};
 state.eventChains.pinguino=state.eventChains.pinguino&&typeof state.eventChains.pinguino==='object'?state.eventChains.pinguino:{active:false,stage:0,dueMatchday:-1,mode:'',completed:false,wins:0,nonWins:0};
 return state.eventChains.pinguino;
}

function mysteryCharacterChain(){
 state.eventChains=state.eventChains&&typeof state.eventChains==='object'?state.eventChains:{};
 state.eventChains.mysteryCharacter=state.eventChains.mysteryCharacter&&typeof state.eventChains.mysteryCharacter==='object'?state.eventChains.mysteryCharacter:{active:false,stage:0,branch:'',playerId:'',playerName:'',dueMatchday:-1,completed:false,finale:{eligible:false,categories:[],played:false,userGoals:0,opponentGoals:0,won:false,pointsDelta:0,pointsApplied:false,rankBeforeBonus:0,rankAfterBonus:0,pointsBeforeBonus:0}};
 const chain=state.eventChains.mysteryCharacter;
 chain.finale=chain.finale&&typeof chain.finale==='object'?chain.finale:{eligible:false,categories:[],played:false,userGoals:0,opponentGoals:0,won:false,pointsDelta:0,pointsApplied:false};
 return chain;
}
function mysteryGeneratedPlayer(source,tag='guest'){
 const stamp=`${Date.now()}-${Math.floor(Math.random()*1000000)}`;
 return registerGeneratedEventPlayer({...source,id:`event-${tag}-${String(source.id||'player')}-${stamp}`,baseOvr:Math.max(1,Number(source.baseOvr??source.ovr)||60),eventPlayer:true,eventUniverse:tag,club:String(source.club||tag)});
}
function replaceRandomRosterWithMysteryPlayer(source,tag){
 if(talentScoutBlocksExternalArrival())return{blocked:true,message:talentScoutBlockMessage()};
 if(!youngBeautifulAllowsPlayer(source))return{blocked:true,message:youngBeautifulBlockMessage(source)};
 const candidates=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player);
 if(!candidates.length)return{blocked:true,message:'Nessun giocatore disponibile da sostituire.'};
 const target=pick(candidates),incoming=mysteryGeneratedPlayer(source,tag),change=replaceUserRosterPlayer(target.index,incoming);
 if(!change||change.blocked)return{blocked:true,message:change?.message||'Il nuovo giocatore non può essere registrato.'};
 refreshOpponentClubRosters();
 return{...change,index:target.index};
}
function randomFutureMysteryMatchday(){
 const first=Math.min(seasonLength()-1,Number(state.matchday)+1),last=Math.max(first,seasonLength()-1);
 return first+Math.floor(Math.random()*Math.max(1,last-first+1));
}
function recruitTearless(){
 const change=replaceRandomRosterWithMysteryPlayer(TEARLESS_EVENT_PLAYER,'tearless');
 if(change.blocked)return change.message;
 const chain=mysteryCharacterChain();
 Object.assign(chain,{active:true,stage:1,branch:'tearless',playerId:String(change.incoming.id),playerName:String(change.incoming.name),dueMatchday:randomFutureMysteryMatchday(),completed:false,finale:{eligible:false,categories:[],played:false,userGoals:0,opponentGoals:0,won:false,pointsDelta:0,pointsApplied:false,rankBeforeBonus:0,rankAfterBonus:0,pointsBeforeBonus:0}});
 return `${change.outgoing?.name||'Un giocatore casuale'} lascia il posto a Tearless (51 OVR). Il suo futuro nella squadra si deciderà in un momento casuale della stagione.`;
}
function recruitWorldChampion(){
 if(talentScoutBlocksExternalArrival())return talentScoutBlockMessage();
 const available=ITALIA_2006_EVENT_PLAYERS.filter(player=>youngBeautifulAllowsPlayer(player));
 if(!available.length)return 'Nessun campione del mondo è compatibile con le regole del tuo allenatore.';
 const source=pick(available),change=replaceRandomRosterWithMysteryPlayer(source,'italia-2006');
 if(change.blocked)return change.message;
 const chain=mysteryCharacterChain();
 Object.assign(chain,{active:true,stage:2,branch:'champion',playerId:String(change.incoming.id),playerName:String(change.incoming.name),dueMatchday:-1,completed:false,finale:{eligible:false,categories:[],played:false,userGoals:0,opponentGoals:0,won:false,pointsDelta:0,pointsApplied:false,rankBeforeBonus:0,rankAfterBonus:0,pointsBeforeBonus:0}});
 return `${change.outgoing?.name||'Un giocatore casuale'} lascia la rosa: arriva ${change.incoming.name} (${Number(change.incoming.ovr)||0} OVR), campione del mondo 2006.`;
}
function updateMysteryGeneratedPlayerOvr(playerId,value){
 const id=String(playerId||''),entry=rosterEntry(id),player=entry?.player||playerById(id);if(!entry||!player)return null;
 const before=Math.max(1,Number(player.ovr)||60),requested=Math.max(1,Math.round(Number(value)||before)),sponsorExtra=requested>before?sponsorOvrExtraFor(requested-before):0,after=requested>before?requested+sponsorExtra:requested;entry.player={...player,ovr:after};if(sponsorExtra)recordBallariniPlayerBonus(id,sponsorExtra);
 const generated=(state.seasonRules.generatedEventPlayers||[]).find(item=>String(item.id)===id);if(generated)generated.ovr=after;
 return entry.player;
}
function resolveTearlessSecondAct(){
 const chain=mysteryCharacterChain(),entry=rosterEntry(chain.playerId);
 chain.active=false;chain.stage=3;chain.dueMatchday=-1;chain.completed=true;
 if(!entry)return{title:'Tearless è introvabile',text:'Il misterioso YouTuber non è più presente nella rosa.',result:'Tearless era già uscito dalla squadra: nessun effetto.'};
 if(Math.random()<.5){
   if(coachIs('ductility'))return{title:'Tearless sa giocare molto bene a 0-0-0',text:'Tearless sostiene di essersi potenziato fino a 150 OVR.',result:'Duttilità impedisce qualsiasi potenziamento esterno: Tearless resta a 51 OVR.'};
   const boosted=updateMysteryGeneratedPlayerOvr(chain.playerId,150);
   return{title:'Tearless sa giocare molto bene a 0-0-0',text:'Tearless ha finalmente capito tutti i segreti del gioco.',result:`${boosted?.name||'Tearless'} si potenzia fino a 150 OVR per il resto della stagione!`};
 }
 const neverPlayed=(Number(state.stats?.appearances?.[String(chain.playerId)])||0)===0;
 const result=removeOwnRosterPlayerPermanently(entry,'la sua completa avversione per 0-0-0');
 if(neverPlayed)unlockAchievement('questo-gioco-fa-schifo');
 return{title:'A Tearless fa schifo questo gioco',text:'Tearless non vuole più sentir parlare di 0-0-0.',result};
}
function mysteryPlayerLeadingBuckets(playerId){
 const labels={goals:'Capocannonieri',assists:'Assist',mvpVotes:'MVP',cleanSheets:'Porte inviolate'};
 return Object.keys(labels).filter(bucket=>meritPlayerLeadsBucket(playerId,bucket)).map(bucket=>labels[bucket]);
}
function prepareMysteryCharacterFinale(){
 const chain=mysteryCharacterChain();
 if(isTeamEliminated(USER_ID)||chain.branch!=='champion'||chain.finale?.played||chain.finale?.eligible)return false;
 const categories=mysteryPlayerLeadingBuckets(chain.playerId);
 if(!categories.length){chain.active=false;chain.completed=true;return false}
 if(categories.length>=2)unlockAchievement('eroe-nazionale');
 chain.active=false;chain.stage=3;chain.finale={eligible:true,categories,played:false,userGoals:0,opponentGoals:0,won:false,pointsDelta:0,pointsApplied:false,rankBeforeBonus:0,rankAfterBonus:0,pointsBeforeBonus:0};
 state.phase='italia-2006-final';return true;
}
function italia2006OpponentPower(){
 const lineup=ITALIA_2006_FINAL_XI.map(name=>ITALIA_2006_EVENT_PLAYERS.find(player=>player.name===name)).filter(Boolean);
 return lineup.length?lineup.reduce((sum,player)=>sum+(Number(player.ovr)||0),0)/lineup.length:96;
}
function italia2006RosterHtml(){
 const groups=[['Portieri','P'],['Difensori','D'],['Centrocampisti','C'],['Attaccanti','A']];
 return `<div class="final-player-stats-grid">${groups.map(([title,role])=>`<div class="season-report-item"><span>${title}</span><small>${ITALIA_2006_EVENT_PLAYERS.filter(player=>player.role===role).map(player=>`${esc(player.name)} <b>${Number(player.ovr)||0}</b>`).join(' · ')}</small></div>`).join('')}</div>`;
}
function playItalia2006Final(){
 const chain=mysteryCharacterChain(),finale=chain.finale;if(!finale?.eligible||finale.played)return;
 const tableBefore=sortedTable();finale.rankBeforeBonus=tableBefore.findIndex(row=>String(row.id)===String(USER_ID))+1;finale.pointsBeforeBonus=Number(userStanding()?.pts)||0;
 let [gf,ga]=simulateScore(Math.max(35,matchPower()),Math.max(35,italia2006OpponentPower()),.03,90);if(gf===ga){if(Math.random()<.5)gf++;else ga++}
 finale.played=true;finale.userGoals=gf;finale.opponentGoals=ga;finale.won=gf>ga;finale.pointsDelta=finale.won?30:0;
 if(finale.won&&!finale.pointsApplied&&userStanding()){userStanding().pts+=30;finale.pointsApplied=true;unlockAchievement('berlino-ancora-azzurra')}
 finale.rankAfterBonus=sortedTable().findIndex(row=>String(row.id)===String(USER_ID))+1;
 save();render();
}
function finishItalia2006Final(){
 const chain=mysteryCharacterChain();chain.completed=true;
 if(!prepareMeritStoryFinale())state.phase='finished';
 save();render();
}
function showItalia2006Final(){
 const chain=mysteryCharacterChain(),finale=chain.finale,categories=(finale.categories||[]).join(', ')||'classifica individuale';
 if(!finale.played){screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Sfida speciale · Italia 2006</div><h2>Campioni del mondo</h2><div class="final-position">VS</div><p>${esc(chain.playerName||'Il giocatore ricevuto')} ha chiuso al primo posto in: <b>${esc(categories)}</b>.</p></div><div class="panel"><h3>Affronta l’Italia del 2006</h3><p>Se vinci, ottieni <b>+30 punti</b> nella classifica del campionato appena concluso. Una sconfitta non assegna penalità.</p>${italia2006RosterHtml()}<button id="playItalia2006Final" class="btn primary">Gioca la sfida</button></div></section>`;document.getElementById('playItalia2006Final').onclick=playItalia2006Final;return}
 screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Sfida Italia 2006 conclusa</div><h2>${finale.won?'Hai battuto i campioni del mondo!':'L’Italia 2006 resiste'}</h2><div class="final-position">${finale.userGoals}–${finale.opponentGoals}</div><p>${esc(state.teamName)} contro l’Italia campione del mondo.</p></div><div class="panel"><h3>${finale.won?'+30 punti in campionato':'Nessun punto bonus'}</h3><p>${finale.won?'Il premio è stato aggiunto alla classifica prima del riepilogo finale.':'La classifica del campionato non viene modificata.'}</p><button id="finishItalia2006Final" class="btn primary">Vai al recap finale</button></div></section>`;document.getElementById('finishItalia2006Final').onclick=finishItalia2006Final;
}

function normalizeTipsterBenchSlots(){
 const bench=state.draft.roster.filter(entry=>entry&&entry.bench);
 bench.forEach((entry,index)=>{entry.slot=`PAN${index+1}`;entry.slotId=`bench-${index+1}`});
}
function enforceTipsterStarters(){
 if(!Array.isArray(state?.draft?.roster)||!state.draft.roster.length)return;
 const forced=state.draft.roster.filter(entry=>entry&&entry.bench&&Number(entry.tipsterForcedMatches)>0);
 forced.forEach(entry=>{
   const player=entry.player||playerById(entry.playerId);if(!player)return;
   const used=new Set(state.draft.roster.filter(item=>item&&!item.bench).map(item=>String(item.slotId)));
   const empty=formationSlots().find(slot=>!used.has(String(slot.instanceId))&&userCompatible(player,slot.code));
   if(empty){entry.bench=false;entry.slot=empty.code;entry.slotId=empty.instanceId;return}
   const starters=state.draft.roster.filter(item=>item&&!item.bench&&Number(item.tipsterForcedMatches)<=0).map(item=>({entry:item,player:item.player||playerById(item.playerId)})).filter(item=>item.player);
   let target=starters.filter(item=>userCompatible(player,item.entry.slot)).sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0))[0];
   if(!target)target=starters.filter(item=>roleOf(item.player)===roleOf(player)).sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0))[0];
   if(!target)target=starters.sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0))[0];
   if(!target)return;
   const benchSlot={slot:entry.slot,slotId:entry.slotId},starterSlot={slot:target.entry.slot,slotId:target.entry.slotId};
   Object.assign(entry,{bench:false,...starterSlot});Object.assign(target.entry,{bench:true,...benchSlot});
 });
 normalizeTipsterBenchSlots();
}
function decrementTipsterObligations(){
 state.draft.roster.forEach(entry=>{if(Number(entry.tipsterForcedMatches)>0){entry.tipsterForcedMatches=Math.max(0,Number(entry.tipsterForcedMatches)-1);entry.tipsterForced=entry.tipsterForcedMatches>0;}});
}
function acceptCassaaaBet(){
 const chain=penguinChain();
 Object.assign(chain,{active:true,stage:1,dueMatchday:Number(state.matchday)+chainedDelay(1,3),mode:'',completed:false});
 pushEffect('forcedScore',1,1,{gf:3,ga:2,source:'Cassaaa'});
 return 'Il pinguino sistema la prossima partita sul 3-2 per te. In cambio prometti di iscriverti al suo canale. Il Capitolo 2 comparirà tra 1 e 3 giornate.';
}
function scrollPenguin(){Object.assign(penguinChain(),{active:false,stage:0,dueMatchday:-1,mode:'',completed:true});return'Ignori il pinguino e ti concentri sulla prossima partita. Nessun effetto.'}
function resolvePenguinLudopatia(){
 const chain=penguinChain();chain.active=true;chain.stage=2;chain.dueMatchday=-1;chain.completed=false;
 if(Math.random()<.5){chain.mode='ludopatia';return 'Scatta la ludopatia: da ora, dopo ogni partita non vinta, perdi definitivamente un giocatore casuale della rosa.'}
 chain.mode='tipster';return 'Diventi un esperto Tipster: dopo ogni vittoria arriva un giocatore casuale, obbligato titolare nella partita successiva al posto di un tuo titolare.';
}
function removeGamblingPlayer(){
 const items=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player);
 if(items.length<=1)return{type:'ludopatia',message:'La ludopatia vorrebbe portarti via un altro giocatore, ma in rosa ne è rimasto soltanto uno.'};
 const chosen=pick(items),lost=chosen.player,lostEntry=chosen.entry;
 if(!lostEntry.bench){
   const bench=items.filter(item=>item.entry.bench&&item.index!==chosen.index);
   let replacement=bench.filter(item=>userCompatible(item.player,lostEntry.slot)).sort((a,b)=>(Number(b.player.ovr)||0)-(Number(a.player.ovr)||0))[0];
   if(!replacement)replacement=bench.filter(item=>roleOf(item.player)===POSITION_ROLE[lostEntry.slot]).sort((a,b)=>(Number(b.player.ovr)||0)-(Number(a.player.ovr)||0))[0];
   if(!replacement)replacement=bench.sort((a,b)=>(Number(b.player.ovr)||0)-(Number(a.player.ovr)||0))[0];
   if(replacement)Object.assign(replacement.entry,{bench:false,slot:lostEntry.slot,slotId:lostEntry.slotId});
 }
 state.draft.roster.splice(chosen.index,1);delete state.statuses[String(lost.id)];delete state.playInjured[String(lost.id)];clearMandatoryMidseasonPlayer(String(lost.id));
 const mental=mentalistaChain();if(String(mental.playerId)===String(lost.id))Object.assign(mental,{active:false,stage:0,dueMatchday:-1,training:false,nature:false,completed:true});
 if(String(state.seasonRules.futureScorerPlayerId||'')===String(lost.id)){state.seasonRules.futureScorerPlayerId='';state.seasonRules.futureScorerPlayerName='';state.seasonRules.futureInjuryZeroPoints=false;}
 normalizeTipsterBenchSlots();refreshOpponentClubRosters();
 return{type:'ludopatia',playerName:lost.name,message:`Ludopatia: ${lost.name} lascia definitivamente la rosa perché non hai vinto la partita.`};
}
function tipsterVictoryPlayer(){
 if(talentScoutBlocksExternalArrival())return{type:'tipster',blocked:true,message:talentScoutBlockMessage()};
 const starters=state.draft.roster.filter(entry=>entry&&!entry.bench).map(entry=>({entry,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player);
 if(!starters.length)return{type:'tipster',message:'Il Tipster non trova un titolare da sostituire.'};
 const freeTargets=starters.filter(item=>Number(item.entry.tipsterForcedMatches)<=0),target=pick(freeTargets.length?freeTargets:starters),rosterIds=new Set(state.draft.roster.map(entry=>String(entry.playerId))),rosterNames=new Set(rosterPlayers().map(item=>normalizeName(item.player.name)));
 let candidates=(PLAYERS||[]).filter(player=>player&&player.id&&youngBeautifulAllowsPlayer(player)&&!rosterIds.has(String(player.id))&&!rosterNames.has(normalizeName(player.name))&&userCompatible(player,target.entry.slot));
 if(!candidates.length)candidates=(PLAYERS||[]).filter(player=>player&&player.id&&youngBeautifulAllowsPlayer(player)&&!rosterIds.has(String(player.id))&&!rosterNames.has(normalizeName(player.name))&&roleOf(player)===POSITION_ROLE[target.entry.slot]);
 if(!candidates.length)candidates=(PLAYERS||[]).filter(player=>player&&player.id&&youngBeautifulAllowsPlayer(player)&&!rosterIds.has(String(player.id))&&!rosterNames.has(normalizeName(player.name)));
 if(!candidates.length)return{type:'tipster',message:'Il Tipster non trova nuovi giocatori disponibili nel database.'};
 const source=pick(candidates),incoming=eventPlayerClone(source,'tipster'),outgoing={...target.entry,player:{...target.player},bench:true,tipsterForced:false,tipsterForcedMatches:0};
 state.draft.roster.push(outgoing);target.entry.playerId=String(incoming.id);target.entry.player={...incoming,tipsterPlayer:true};target.entry.bench=false;target.entry.tipsterForced=true;target.entry.tipsterForcedMatches=1;
 state.statuses[String(incoming.id)]={injury:0,suspension:0,seasonOut:false,seasonOutReason:''};normalizeTipsterBenchSlots();enforceTipsterStarters();refreshOpponentClubRosters();
 return{type:'tipster',playerName:incoming.name,replacedName:target.player.name,message:`Tipster: arriva ${incoming.name} (${Number(incoming.ovr)||60} OVR), obbligato titolare nella prossima partita. ${target.player.name} va in panchina.`};
}
function tickPenguinAfterMatch(result){
 decrementTipsterObligations();
 const chain=penguinChain();if(!result||!chain.active||chain.stage!==2||!chain.mode)return;
 const won=Number(result.gf)>Number(result.ga);let update=null;
 if(chain.mode==='ludopatia'&&!won){chain.nonWins=Math.max(0,Number(chain.nonWins)||0)+1;update=removeGamblingPlayer()}
 if(chain.mode==='tipster'&&won){chain.wins=Math.max(0,Number(chain.wins)||0)+1;update=tipsterVictoryPlayer()}
 if(update){result.penguinUpdate=update;recordSeasonEvent({kind:'auto',title:chain.mode==='ludopatia'?'Ludopatia':'Esperto Tipster',choice:won?'Vittoria':'Partita non vinta',effect:update.message,result:update.message,automatic:true},analyticsSnapshot())}
}

function questState(){
 state.quest=state.quest&&typeof state.quest==='object'?state.quest:{active:false,id:'',title:'',status:'idle',acceptedMatchday:-1,matchesPlayed:0,progress:0,target:0,deadlineMatches:0,targetPlayerId:'',targetPlayerName:'',targetTeamIds:[],facedTeamIds:[],rewardActive:false,objective:'',reward:'',penalty:'',summary:'',notice:''};
 return state.quest;
}
function questIsActive(id=''){const q=questState();return Boolean(q.active&&(!id||String(q.id)===String(id)))}
function questCanStart(matches=1){return !questState().active&&Number(state.matchday)+Math.max(1,Number(matches)||1)<=seasonLength()}
function questPermanentRounds(){return 9999}
function questBestAttacker(){return [...rosterPlayers()].filter(entry=>roleOf(entry.player)==='A').sort((a,b)=>(Number(b.player?.ovr)||0)-(Number(a.player?.ovr)||0))[0]||null}
function questBestPlayer(){return [...rosterPlayers()].sort((a,b)=>(Number(b.player?.ovr)||0)-(Number(a.player?.ovr)||0))[0]||null}
function questRivalKey(name=''){
 const normalized=normalizeName(name);
 if(normalized.includes('juventus'))return'juventus';
 if(normalized==='milan'||normalized.includes('ac milan'))return'milan';
 if(normalized==='inter'||normalized.includes('internazionale')||normalized.startsWith('inter '))return'inter';
 return'';
}
function questCurveTeams(){const found={};state.teams.filter(team=>team.id!==USER_ID).forEach(team=>{const key=questRivalKey(team.name);if(key&&!found[key])found[key]=team});return['juventus','milan','inter'].map(key=>found[key]).filter(Boolean)}
function questCurveAvailable(){
 if(!questCanStart(1))return false;
 const rivals=questCurveTeams();if(rivals.length!==3)return false;
 const future=(state.schedule||[]).slice(Number(state.matchday)||0).flat();
 return rivals.every(team=>future.some(match=>String(match.home)===String(team.id)||String(match.away)===String(team.id)));
}
function startSeasonQuest(config={}){
 const q=questState();if(q.active)return'Hai già una quest attiva: completala prima di accettarne un’altra.';
 Object.assign(q,{active:true,id:String(config.id||''),title:String(config.title||'Quest'),status:'active',acceptedMatchday:Number(state.matchday),matchesPlayed:0,progress:0,target:Math.max(0,Number(config.target)||0),deadlineMatches:Math.max(0,Number(config.deadlineMatches)||0),targetPlayerId:String(config.targetPlayerId||''),targetPlayerName:String(config.targetPlayerName||''),targetTeamIds:(config.targetTeamIds||[]).map(String),facedTeamIds:[],rewardActive:false,objective:String(config.objective||''),reward:String(config.reward||''),penalty:String(config.penalty||''),summary:'',notice:''});
 return `Quest accettata: ${q.title}. ${q.objective}`;
}
function finishSeasonQuest(success,message,result=null){
 const q=questState();q.active=false;q.status=success?'success':'failure';q.summary=String(message||'');q.completedMatchday=Number(state.matchday)+1;
 const update={success:Boolean(success),title:q.title,message:q.summary};
 if(success){
   const achievementByQuest={
     'like-a-bomber':'like-a-bomber',
     'fair-play-finanziario':'conti-in-ordine',
     'la-curva':'tre-classiche',
     'milanlab':'milanlab-certificato',
     'calcio-champagne':'calcio-champagne'
   };
   const achievementId=achievementByQuest[String(q.id||'')];if(achievementId)unlockAchievement(achievementId);
 }
 const target=result||((state.lastResult&&Number(state.lastResult.matchday)===Number(state.matchday)+1)?state.lastResult:null);
 if(target){target.questUpdates=Array.isArray(target.questUpdates)?target.questUpdates:[];target.questUpdates.push(update)}
 recordSeasonEvent({kind:'quest',title:q.title,choice:success?'Quest completata':'Quest fallita',effect:success?q.reward:q.penalty,result:q.summary,automatic:true},analyticsSnapshot());
 return q.summary;
}
function acceptLikeBomberQuest(){const attacker=questBestAttacker();if(!attacker)return'Nessun attaccante disponibile.';return startSeasonQuest({id:'like-a-bomber',title:'Like a bomber',target:10,deadlineMatches:5,targetPlayerId:attacker.playerId,targetPlayerName:attacker.player.name,objective:'Segna almeno 10 gol nelle prossime 5 partite.',reward:`${attacker.player.name} ottiene +8 OVR fino a fine stagione.`,penalty:`${attacker.player.name} viene portato a 50 OVR fino a fine stagione.`})}
function acceptFairPlayQuest(){return startSeasonQuest({id:'fair-play-finanziario',title:'Fair play finanziario',target:9,deadlineMatches:4,objective:'Conquista almeno 9 punti nelle prossime 4 giornate.',reward:'Sei pulito: nessuna penalizzazione.',penalty:'Penalizzazione di 6 punti.'})}
function rejectFairPlayQuest(){const standing=userStanding();if(standing)standing.pts-=1;return'Patteggi: perdi immediatamente 1 punto e la missione non parte.'}
function acceptCurvaQuest(){const rivals=questCurveTeams();if(rivals.length!==3)return'Juventus, Milan e Inter non sono tutte presenti tra le avversarie disponibili.';return startSeasonQuest({id:'la-curva',title:'La curva',target:3,targetTeamIds:rivals.map(team=>team.id),objective:'Non perdere contro Juventus, Milan e Inter.',reward:'+5 OVR a tutta la squadra finché non perdi una partita.',penalty:'-5 OVR a tutta la squadra fino a fine stagione.'})}
function acceptAmmazzaGrandiQuest(){return startSeasonQuest({id:'ammazza-grandi',title:'Ammazza grandi',target:1,deadlineMatches:6,objective:'Nelle prossime 6 giornate batti almeno una squadra che, prima della partita, si trova nelle prime 3 posizioni.',reward:'+5 OVR fino a fine stagione a tutti i giocatori con OVR base inferiore a 80.',penalty:'Il tuo miglior giocatore perde 6 OVR fino a fine stagione.'})}
function acceptMilanLabQuest(){return startSeasonQuest({id:'milanlab',title:'MilanLab',target:5,deadlineMatches:5,objective:'Completa 5 giornate senza nuovi infortuni.',reward:'Immunità dagli infortuni per le successive 5 giornate.',penalty:'Il primo infortunio dura il doppio del previsto.'})}
function acceptChampagneQuest(){return startSeasonQuest({id:'calcio-champagne',title:'Calcio champagne',target:3,deadlineMatches:3,objective:'Segna almeno 2 gol in ciascuna delle prossime 3 partite.',reward:'Ogni vittoria nelle successive 6 giornate vale 1 punto aggiuntivo.',penalty:'Ogni pareggio nelle successive 6 giornate viene trasformato in sconfitta.'})}
function questTargetRosterEntry(q=questState(),fallback=questBestAttacker()){return rosterEntry(q.targetPlayerId)||fallback||null}
function questOpponentIsTopThree(opponentId){return questIsActive('ammazza-grandi')&&sortedTable().slice(0,3).some(row=>String(row.id)===String(opponentId))}
function questProgressText(q=questState()){
 if(q.id==='like-a-bomber')return `${q.progress}/${q.target} gol · ${q.matchesPlayed}/${q.deadlineMatches} partite`;
 if(q.id==='fair-play-finanziario')return `${q.progress}/${q.target} punti · ${q.matchesPlayed}/${q.deadlineMatches} giornate`;
 if(q.id==='la-curva')return `${q.facedTeamIds.length}/${q.targetTeamIds.length} grandi rivali affrontate`;
 if(q.id==='ammazza-grandi')return `${q.matchesPlayed}/${q.deadlineMatches} giornate · ${q.progress}/${q.target} vittorie contro una top 3`;
 if(q.id==='milanlab')return `${q.matchesPlayed}/${q.deadlineMatches} giornate senza infortuni`;
 if(q.id==='calcio-champagne')return `${q.progress}/${q.target} partite con almeno 2 gol`;
 return `${q.matchesPlayed}/${q.deadlineMatches}`;
}
function renderActiveQuest(){
 const q=questState();if(!q.active)return'';
 const ratio=q.id==='la-curva'?(q.targetTeamIds.length?q.facedTeamIds.length/q.targetTeamIds.length:0):(q.target?Math.min(1,q.progress/q.target):(q.deadlineMatches?Math.min(1,q.matchesPlayed/q.deadlineMatches):0));
 return `<div class="quest-card"><div class="quest-card-head"><span>🎯 Quest attiva</span><b>${esc(q.title)}</b></div><p>${esc(q.objective)}</p><div class="quest-progress"><span style="width:${Math.round(clamp(ratio,0,1)*100)}%"></span></div><div class="quest-progress-copy"><strong>${esc(questProgressText(q))}</strong>${q.deadlineMatches?`<span>${Math.max(0,q.deadlineMatches-q.matchesPlayed)} giornate rimaste</span>`:''}</div><div class="quest-stakes"><small><b>Successo:</b> ${esc(q.reward)}</small><small><b>Fallimento:</b> ${esc(q.penalty)}</small></div>${q.notice?`<div class="quest-notice">${esc(q.notice)}</div>`:''}</div>`;
}
function failMilanLabForInjury(entry,rounds){
 const q=questState();if(!questIsActive('milanlab'))return Math.max(1,Number(rounds)||1);
 const doubled=Math.max(2,(Math.max(1,Number(rounds)||1))*2),name=entry?.player?.name||playerById(entry?.playerId)?.name||'Il giocatore';
 finishSeasonQuest(false,`${name} si è infortunato: la durata passa da ${Math.max(1,Number(rounds)||1)} a ${doubled} giornate.`);
 return doubled;
}
function tickSeasonQuestAfterMatch(result){
 if(!result)return;
 if(state.seasonRules.laCurvaRewardActive&&Number(result.gf)<Number(result.ga)){
   state.activeEffects=state.activeEffects.filter(effect=>String(effect.source||'')!=='quest-la-curva-reward');state.seasonRules.laCurvaRewardActive=false;
   result.questUpdates=Array.isArray(result.questUpdates)?result.questUpdates:[];result.questUpdates.push({success:false,title:'La curva',message:'La serie positiva è terminata: rimosso il bonus di +5 OVR.'});
 }
 const q=questState();if(!q.active)return;
 if(q.id==='like-a-bomber'){
   q.matchesPlayed++;q.progress+=Math.max(0,Number(result.gf)||0);
   if(q.progress>=q.target){const entry=questTargetRosterEntry(q);if(entry)pushSeasonEffect('playerOvr',8,{playerId:String(entry.playerId),source:'quest-like-a-bomber'});finishSeasonQuest(true,`${entry?.player?.name||q.targetPlayerName||'Il miglior attaccante'} ottiene +8 OVR fino a fine stagione.`,result)}
   else if(q.matchesPlayed>=q.deadlineMatches){const entry=questTargetRosterEntry(q);if(entry)entry.player={...(entry.player||playerById(entry.playerId)),ovr:50,questOvrLock:50};finishSeasonQuest(false,`${entry?.player?.name||q.targetPlayerName||'Il miglior attaccante'} viene portato a 50 OVR fino a fine stagione.`,result)}
   return;
 }
 if(q.id==='fair-play-finanziario'){
   q.matchesPlayed++;q.progress+=Math.max(0,Number(result.pointsAwarded)||0);
   if(q.progress>=q.target)finishSeasonQuest(true,'Sei pulito: il controllo si chiude senza penalizzazioni.',result);
   else if(q.matchesPlayed>=q.deadlineMatches){if(userStanding())userStanding().pts-=6;finishSeasonQuest(false,'Fair play finanziario fallito: penalizzazione di 6 punti.',result)}
   return;
 }
 if(q.id==='la-curva'){
   const opponentId=String(result.opponentId||'');
   if(q.targetTeamIds.includes(opponentId)&&!q.facedTeamIds.includes(opponentId)){
     if(Number(result.gf)<Number(result.ga)){pushSeasonEffect('teamOvr',-5,{source:'quest-la-curva-penalty'});finishSeasonQuest(false,'Hai perso contro una delle tre grandi: -5 OVR a tutta la squadra fino a fine stagione.',result);return}
     q.facedTeamIds.push(opponentId);q.progress=q.facedTeamIds.length;
     if(q.facedTeamIds.length>=q.targetTeamIds.length){pushSeasonEffect('teamOvr',5,{source:'quest-la-curva-reward'});state.seasonRules.laCurvaRewardActive=true;finishSeasonQuest(true,'Fedeltà dimostrata: +5 OVR a tutta la squadra finché non perderai una partita.',result)}
   }
   return;
 }
 if(q.id==='ammazza-grandi'){
   q.matchesPlayed++;
   if(result.questOpponentTop3Before&&Number(result.gf)>Number(result.ga)){
     q.progress=1;rosterPlayers().forEach(entry=>{const base=Number(playerById(entry.playerId)?.ovr??entry.player?.ovr)||0;if(base<80)pushSeasonEffect('playerOvr',5,{playerId:String(entry.playerId),source:'quest-ammazza-grandi'})});finishSeasonQuest(true,'Impresa riuscita: tutti i giocatori con OVR base inferiore a 80 ricevono +5 OVR fino a fine stagione.',result);
   }else if(q.matchesPlayed>=q.deadlineMatches){const entry=questBestPlayer();if(entry)pushSeasonEffect('playerOvr',-6,{playerId:String(entry.playerId),source:'quest-ammazza-grandi-penalty'});finishSeasonQuest(false,`${entry?.player?.name||'Il miglior giocatore'} perde 6 OVR fino a fine stagione.`,result)}
   return;
 }
 if(q.id==='milanlab'){
   q.matchesPlayed++;q.progress=q.matchesPlayed;
   if(q.matchesPlayed>=q.deadlineMatches){pushEffect('injuryImmunity',1,6,{source:'quest-milanlab'});finishSeasonQuest(true,'MilanLab approva il lavoro: immunità dagli infortuni per le prossime 5 giornate.',result)}
   return;
 }
 if(q.id==='calcio-champagne'){
   q.matchesPlayed++;
   if(Number(result.gf)<2){pushEffect('drawBecomesLoss',1,7,{source:'quest-calcio-champagne-penalty'});finishSeasonQuest(false,'Spettacolo insufficiente: per le prossime 6 giornate ogni pareggio verrà trasformato in sconfitta.',result);return}
   q.progress++;
   if(q.progress>=q.target){pushEffect('extraWinPoint',1,7,{source:'quest-calcio-champagne-reward'});finishSeasonQuest(true,'Calcio champagne completato: per le prossime 6 giornate ogni vittoria vale 1 punto aggiuntivo.',result)}
 }
}

function chainedDelay(min=2,max=5){return Math.max(1,Math.floor(min+Math.random()*(Math.max(min,max)-min+1)))}
function chickenRosterEntry(){const chain=mentalistaChain();return state.draft.roster.find(entry=>String(entry.playerId)===String(chain.playerId))||null}
function beginMentalistaChicken(entry,originalOvr){
 const chain=mentalistaChain();
 Object.assign(chain,{active:true,stage:1,playerId:String(entry.playerId),playerName:String(entry.player?.name||''),originalOvr:Math.max(1,Number(originalOvr)||1),dueMatchday:Number(state.matchday)+chainedDelay(2,5),training:false,nature:false,goals:0,completed:false});
}
function trainChicken(){
 const chain=mentalistaChain(),entry=chickenRosterEntry();if(!entry){Object.assign(chain,{active:false,stage:0,dueMatchday:-1,training:false,nature:false,completed:true});return 'Il pollo non è più presente in rosa.';}
 chain.active=true;chain.stage=2;chain.training=true;chain.nature=false;chain.dueMatchday=-1;
 entry.player={...(entry.player||playerById(entry.playerId)),ovr:Math.max(1,Number(entry.player?.ovr)||1),isChicken:true,chickenOriginalOvr:chain.originalOvr};
 return `${chain.playerName||entry.player.name} resta un pollo, ma da ora guadagnerà tra 1 e 5 OVR dopo ogni giornata.`;
}
function veterinarianChicken(){
 const chain=mentalistaChain(),entry=chickenRosterEntry();if(!entry){Object.assign(chain,{active:false,stage:0,dueMatchday:-1,training:false,nature:false,completed:true});return 'Il pollo non è più presente in rosa.';}
 const current=entry.player||playerById(entry.playerId);entry.player={...current,ovr:chain.originalOvr,isChicken:false,isChickenKing:false};
 const injured=setOwnPlayerInjury(entry,5);const status=statusOf(entry.playerId);status.seasonOut=false;status.seasonOutReason='';
 Object.assign(chain,{active:false,stage:0,training:false,nature:false,dueMatchday:-1,completed:true});
 return injured?`${entry.player.name} torna umano e recupera ${chain.originalOvr} OVR, ma salterà le prossime 5 partite.`:`${entry.player.name} torna umano e recupera ${chain.originalOvr} OVR. La protezione della Coppa evita l’infortunio.`;
}
function acceptChickenNature(){
 const chain=mentalistaChain(),entry=chickenRosterEntry();if(!entry){Object.assign(chain,{active:false,stage:0,dueMatchday:-1,training:false,nature:false,completed:true});return 'Il pollo non è più presente in rosa.';}
 chain.active=true;chain.stage=2;chain.training=false;chain.nature=true;chain.dueMatchday=-1;
 entry.player={...(entry.player||playerById(entry.playerId)),ovr:1,isChicken:true,chickenOriginalOvr:chain.originalOvr};
 return `${chain.playerName||entry.player.name} resta a 1 OVR. Da ora ogni suo gol vale doppio.`;
}
function applyChickenGoalRule(events){
 const chain=mentalistaChain();if(!chain.active||chain.stage!==2||!chain.nature)return;
 (events||[]).forEach(event=>{if(String(event.playerId)===String(chain.playerId)){event.goalValue=Math.max(1,Number(event.goalValue)||1)*2;event.isChickenDoubleGoal=true;event.description=`${event.description||''} Il gol del pollo vale doppio.`.trim();}});
}
function crownChickenKing(){
 const chain=mentalistaChain(),entry=chickenRosterEntry();if(!entry){Object.assign(chain,{active:false,completed:true});return 'Il pollo non è più presente in rosa.'}
 const current=entry.player||playerById(entry.playerId),newOvr=Math.max(Number(current?.ovr)||1,chain.originalOvr+10);
 entry.player={...current,ovr:newOvr,isChicken:false,isChickenKing:true,chickenOriginalOvr:chain.originalOvr};
 Object.assign(chain,{active:false,stage:0,training:false,nature:false,dueMatchday:-1,completed:true});
 return `${entry.player.name} torna umano come Re del Pollaio: ${newOvr} OVR, superiore al suo valore originale di ${chain.originalOvr}.`;
}
function collaborateWithGeneral(){
 const chain=generalChain(),italians=rosterPlayers().filter(entry=>isItalianPlayer(entry.player));
 italians.forEach(entry=>pushSeasonEffect('playerChem',3,{playerId:String(entry.playerId),source:'Controllo dei documenti'}));
 chain.active=true;chain.stage=2;chain.dueMatchday=Number(state.matchday)+chainedDelay(3,6);chain.completed=false;
 return `${italians.length} giocatori italiani ricevono +3 Intesa fino a fine stagione. Il generale continuerà a osservare la squadra.`;
}
function findGeneralReplacementEntry(record){
 let index=state.draft.roster.findIndex(entry=>String(entry.playerId)===String(record.replacementId));
 if(index<0&&record.slotId)index=state.draft.roster.findIndex(entry=>String(entry.slotId)===String(record.slotId));
 return index;
}
function hideForeignPlayerFromGeneral(){
 const chain=generalChain(),records=(chain.replacements||[]).filter(record=>record?.originalPlayer&&!record.recovered);
 if(!records.length){chain.active=false;chain.completed=true;return 'Non ci sono giocatori stranieri sostituiti da recuperare.'}
 const record=[...records].sort((a,b)=>(Number(b.originalPlayer?.ovr)||0)-(Number(a.originalPlayer?.ovr)||0))[0],index=findGeneralReplacementEntry(record);
 if(index<0){chain.active=false;chain.completed=true;return `${record.originalPlayer.name} non può più essere reinserito perché il suo posto in rosa è cambiato.`}
 replaceUserRosterPlayer(index,{...record.originalPlayer,id:String(record.originalPlayer.id)});record.recovered=true;
 if(record.originalStatus)state.statuses[String(record.originalPlayer.id)]={...record.originalStatus};
 const discovered=Math.random()<.5;if(discovered&&state.standings?.[USER_ID])state.standings[USER_ID].pts-=3;
 chain.active=false;chain.stage=0;chain.completed=true;chain.dueMatchday=-1;refreshOpponentClubRosters();
 return discovered?`${record.originalPlayer.name} torna in rosa, ma il generale scopre l’inganno: -3 punti in classifica.`:`${record.originalPlayer.name} torna in rosa e il generale non scopre nulla.`;
}
function dismissGeneral(){
 const chain=generalChain();let restored=0;
 (chain.replacements||[]).forEach(record=>{const index=findGeneralReplacementEntry(record);if(index<0||!record.originalPlayer)return;replaceUserRosterPlayer(index,{...record.originalPlayer,id:String(record.originalPlayer.id)});if(record.originalStatus)state.statuses[String(record.originalPlayer.id)]={...record.originalStatus};restored++;});
 pushSeasonEffect('teamChemMultiplier',.5,{source:'Generale cacciato'});
 Object.assign(chain,{active:false,stage:0,dueMatchday:-1,nationalBoostPending:false,completed:true});refreshOpponentClubRosters();
 return `Il generale viene cacciato: ${restored} giocatori originali tornano in rosa, ma l’Intesa della squadra è dimezzata fino a fine stagione.`;
}
function activateNationalFantaballa(){
 const chain=generalChain();
 pushEffect('forcedScore',1,1,{gf:0,ga:3,source:'Nazionale Fantaballa'});
 chain.nationalBoostPending=true;chain.active=false;chain.stage=0;chain.dueMatchday=-1;chain.completed=true;
 return 'La rosa tutta italiana viene convocata dalla Nazionale Fantaballa: salterà la prossima partita di campionato. Dopo il rientro avrà +5 OVR per 3 giornate.';
}
function activatePendingNationalBoost(){
 const chain=generalChain();if(!chain.nationalBoostPending)return;
 chain.nationalBoostPending=false;pushEffect('teamOvr',5,3,{source:'Nazionale Fantaballa'});
}
function allRosterItalian(){const entries=rosterPlayers();return Boolean(entries.length)&&entries.every(entry=>isItalianPlayer(entry.player))}
function queueChainedDecision(decisionId){
 const decision=DECISIONS.find(item=>item.id===decisionId);if(!decision)return false;
 const context=decision.createContext?decision.createContext():{},eventTitle=typeof decision.title==='function'?decision.title(context):decision.title,eventText=decision.describe?decision.describe(context):decision.text,decisionIndex=DECISIONS.indexOf(decision);
 if(state.seasonRules.autoDecisions){const choiceIndex=Math.floor(Math.random()*decision.choices.length),choice=decision.choices[choiceIndex],before=analyticsSnapshot(),result=applyDecisionChoice(decisionIndex,choiceIndex,context,decision.id);recordSeasonEvent({kind:'decision',title:eventTitle,choice:choice?.label||'',effect:choice?.effect||'',result,automatic:true},before);state.pendingEvent={kind:'decision',chained:true,resolved:true,title:eventTitle,text:eventText,decisionId:decision.id,decisionIndex,context,result:`Decisione automatica. ${result}`};}
 else state.pendingEvent={kind:'decision',chained:true,resolved:false,title:eventTitle,text:eventText,decisionId:decision.id,decisionIndex,context};
 return true;
}
function queueChainedAuto(title,text,result){
 const before=analyticsSnapshot();recordSeasonEvent({kind:'auto',title,choice:'Evento concatenato',effect:text,result,automatic:true},before);state.pendingEvent={kind:'auto',chained:true,resolved:true,title,text,result};return true;
}
function prepareChainedEvent(){
 const mental=mentalistaChain(),general=generalChain(),penguin=penguinChain(),mystery=mysteryCharacterChain(),day=Number(state.matchday);
 if(mental.active&&mental.stage===3&&day>=Number(mental.dueMatchday)){return queueChainedAuto('Il re del pollaio','Il pollo ha segnato almeno tre gol e completa la sua trasformazione.',crownChickenKing())}
 if(mystery.active&&mystery.branch==='tearless'&&mystery.stage===1&&day>=Number(mystery.dueMatchday)){const outcome=resolveTearlessSecondAct();return queueChainedAuto(outcome.title,outcome.text,outcome.result)}
 if(mental.active&&mental.stage===1&&day>=Number(mental.dueMatchday)){if(!chickenRosterEntry()){Object.assign(mental,{active:false,stage:0,dueMatchday:-1,completed:true});return false}return queueChainedDecision('mentalista-pollaio')}
 if(penguin.active&&penguin.stage===1&&day>=Number(penguin.dueMatchday))return queueChainedAuto('Ludopatia','Il misterioso pinguino torna per rivelare le conseguenze della scommessa.',resolvePenguinLudopatia());
 if(general.active&&general.stage===1&&day>=Number(general.dueMatchday))return queueChainedDecision('generale-documenti');
 if(general.active&&general.stage===2&&day>=Number(general.dueMatchday)){
   if(allRosterItalian())return queueChainedAuto('La nazionale Fantaballa','La rosa è ancora interamente italiana e riceve una convocazione inattesa.',activateNationalFantaballa());
   Object.assign(general,{active:false,stage:0,dueMatchday:-1,completed:true});
 }
 return false;
}
function tickEventChainsAfterMatch(result){
 const chain=mentalistaChain();
 if(chain.active&&chain.stage===2){
   const goals=(Array.isArray(result?.goals)?result.goals:[]).filter(goal=>String(goal.playerId)===String(chain.playerId)).length;
   if(goals){chain.goals+=goals;if(result)result.chickenGoals={playerName:chain.playerName,count:goals,total:chain.goals,double:Boolean(chain.nature)};}
   const entry=chickenRosterEntry();
   if(!entry){Object.assign(chain,{active:false,stage:0,dueMatchday:-1,training:false,nature:false,completed:true});return}
   if(goals&&entry.player?.isChicken&&Number(entry.player?.ovr)===1)unlockAchievement('il-pollo-d-oro');
   if(chain.training&&entry){const baseGain=1+Math.floor(Math.random()*5),sponsorExtra=sponsorOvrExtraFor(baseGain),gain=baseGain+sponsorExtra,current=entry.player||playerById(entry.playerId);entry.player={...current,ovr:Math.max(1,Number(current?.ovr)||1)+gain,isChicken:true,chickenOriginalOvr:chain.originalOvr};if(sponsorExtra)recordBallariniPlayerBonus(entry.playerId,sponsorExtra);if(result)result.chickenTraining={playerName:entry.player.name,gain,newOvr:entry.player.ovr};}
   if(chain.goals>=3){chain.stage=3;chain.dueMatchday=Number(state.matchday)+1;chain.training=false;chain.nature=false;}
 }
 tickPenguinAfterMatch(result);
}

function injureOwnPlayers(entries,rounds=1){
 const valid=(entries||[]).filter(Boolean);
 valid.forEach(entry=>setOwnPlayerInjury(entry,rounds));
 return valid.map(entry=>entry.player.name);
}
function injureNextOpponentPlayers(count=1){
 const team=nextOpponentTeam();
 if(!team)return 'Nessun avversario disponibile.';
 const candidates=shuffle(opponentRosterPlayers(team).filter(player=>!player.isMascot&&opponentStatusOf(team,player.id).injury<=0)).slice(0,count);
 candidates.forEach(player=>opponentStatusOf(team,player.id).injury=Math.max(opponentStatusOf(team,player.id).injury,1));
 return candidates.length?`${candidates.map(player=>player.name).join(' e ')} salteranno la prossima partita con ${team.name}.`:'Nessun giocatore avversario disponibile.';
}
function addMascotToRandomTeam(){
 const candidates=state.teams.filter(team=>team.id!==USER_ID&&!team.mascot);
 const team=pick(candidates.length?candidates:state.teams.filter(team=>team.id!==USER_ID));
 if(!team)return 'Nessuna squadra avversaria disponibile.';
 team.mascot={id:`mascot-${team.id}`,name:'Mascotte della squadra',ovr:99,Position:'ATT',role:'A',nation:team.name,subscriber:'no',isMascot:true};
 return `La mascotte firma per ${team.name} con 99 OVR.`;
}
function replaceUserRosterPlayer(index,replacement){
 const entry=state.draft.roster[index];
 if(!entry||!replacement)return null;
 const outgoing=entry.player||playerById(entry.playerId);
 if(talentScoutBlocksExternalArrival())return{blocked:true,outgoing,incoming:null,slot:entry.slot,bench:Boolean(entry.bench),message:talentScoutBlockMessage()};
 if(!youngBeautifulAllowsPlayer(replacement))return{blocked:true,outgoing,incoming:null,slot:entry.slot,bench:Boolean(entry.bench),message:youngBeautifulBlockMessage(replacement)};
 const outgoingId=String(entry.playerId||outgoing?.id||'');
 const incoming={...replacement,id:String(replacement.id)};
 entry.playerId=String(incoming.id);
 entry.player=incoming;
 if(outgoingId){delete state.playInjured[outgoingId];delete state.statuses[outgoingId];clearMandatoryMidseasonPlayer(outgoingId)}
 state.statuses[String(incoming.id)]={injury:0,suspension:0,seasonOut:false,seasonOutReason:''};
 return {outgoing,incoming,slot:entry.slot,bench:Boolean(entry.bench)};
}
function weakestRosterItem(){return state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player).sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0))[0]||null}
function eventPlayerClone(player,universe='multiverso'){
 if(!player)return null;const stamp=`${Date.now()}-${Math.floor(Math.random()*100000)}`;
 return registerGeneratedEventPlayer({...player,baseOvr:originalBaseOvr(player),id:`event-${universe}-${String(player.id||'x')}-${stamp}`,club:USER_ID,eventPlayer:true,eventUniverse:universe});
}
function replaceWeakestWithUniverse(pool,label,universe){
 if(talentScoutBlocksExternalArrival())return talentScoutBlockMessage();
 const weakest=weakestRosterItem(),candidates=(Array.isArray(pool)?pool:[]).filter(player=>player&&player.id&&player.name&&youngBeautifulAllowsPlayer(player));
 if(!weakest)return 'Nessun giocatore disponibile da sostituire.';if(!candidates.length)return `Il portale verso ${label} non ha trovato giocatori.`;
 const source=pick(candidates),incoming=eventPlayerClone(source,universe),change=replaceUserRosterPlayer(weakest.index,incoming);refreshOpponentClubRosters();
 return `${change?.outgoing?.name||'Il giocatore più scarso'} lascia la rosa: dal ${label} arriva ${incoming.name} (${Number(incoming.ovr)||0} OVR).`;
}
function multiverseClassic(){return replaceWeakestWithUniverse(CLASSIC_PLAYERS,'Campionato del Ca***','classic')}
function multiverseReal(){return replaceWeakestWithUniverse(REAL_PLAYERS,'Fantacampionato del Ca***','real')}
function italianPlayerPools(){const pools=[PLAYERS,PLAYERS===CLASSIC_PLAYERS?REAL_PLAYERS:CLASSIC_PLAYERS,CLASSIC_PLAYERS,REAL_PLAYERS];const seen=new Set();return pools.map(pool=>(Array.isArray(pool)?pool:[]).filter(player=>{const key=`${String(player?.id||'')}|${normalizeName(player?.name||'')}|${normalizeName(player?.nation||'')}`;if(!player||!player.id||!isItalianPlayer(player)||!youngBeautifulAllowsPlayer(player)||seen.has(key))return false;seen.add(key);return true})).filter(pool=>pool.length)}
function italianReplacementForEntry(entry,usedSources=new Set()){
 const pools=italianPlayerPools();
 const chooseFrom=pool=>{let candidates=pool.filter(player=>!usedSources.has(`${String(player.id)}|${normalizeName(player.name)}`));if(!entry?.bench)candidates=candidates.filter(player=>userCompatible(player,entry.slot));if(!candidates.length&&!entry?.bench)candidates=pool.filter(player=>!usedSources.has(`${String(player.id)}|${normalizeName(player.name)}`)&&roleOf(player)===POSITION_ROLE[entry.slot]);return candidates.length?pick(candidates):null};
 for(const pool of pools){const found=chooseFrom(pool);if(found)return found}return null;
}
function replaceNonItalianWithItalians(){
 if(talentScoutBlocksExternalArrival())return talentScoutBlockMessage();
 const targets=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player&&!isItalianPlayer(item.player));
 if(!targets.length)return 'La rosa è già composta soltanto da giocatori italiani.';
 const usedSources=new Set(),changes=[],records=[];
 targets.forEach(item=>{
   const source=italianReplacementForEntry(item.entry,usedSources);if(!source)return;
   usedSources.add(`${String(source.id)}|${normalizeName(source.name)}`);
   const originalStatus=state.statuses?.[String(item.entry.playerId)]?{...state.statuses[String(item.entry.playerId)]}:null;
   const incoming=eventPlayerClone(source,'rimmigrazione'),change=replaceUserRosterPlayer(item.index,incoming);
   if(change){changes.push(`${change.outgoing?.name||'Giocatore'} → ${incoming.name}`);records.push({replacementId:String(incoming.id),slotId:String(item.entry.slotId||''),slot:String(item.entry.slot||''),bench:Boolean(item.entry.bench),originalPlayer:{...change.outgoing,id:String(change.outgoing?.id||item.entry.playerId)},originalStatus});}
 });
 refreshOpponentClubRosters();
 let generalWillReturn=false;
 if(records.length){
   generalWillReturn=Math.random()<.5;
   const chain=generalChain();
   Object.assign(chain,{active:generalWillReturn,stage:generalWillReturn?1:0,dueMatchday:generalWillReturn?Number(state.matchday)+chainedDelay(3,6):-1,replacements:records,nationalBoostPending:false,completed:!generalWillReturn});
 }
 const returnNotice=generalWillReturn?'Il generale tornerà a controllare i documenti tra alcune giornate.':'Il generale se ne va: potrebbe non tornare.';
 return changes.length===targets.length?`Rimmigrazione completata: ${changes.length} giocatori non italiani sono stati sostituiti. ${returnNotice} ${changes.join(' · ')}`:`Sostituiti ${changes.length} giocatori non italiani su ${targets.length}. ${returnNotice} ${changes.join(' · ')}`;
}
function chaosReplaceNonItalianWithItalians(team){
 if(!team||!Array.isArray(team.roster))return 'Nessuna rosa disponibile.';
 const usedSources=new Set(),changes=[];
 [...team.roster].forEach((playerId,index)=>{const outgoing=chaosPlayer(team,playerId);if(!outgoing||isItalianPlayer(outgoing)||outgoing.isMascot)return;const pools=italianPlayerPools();let source=null;for(const pool of pools){let candidates=pool.filter(player=>!usedSources.has(`${String(player.id)}|${normalizeName(player.name)}`)&&roleOf(player)===roleOf(outgoing));if(!candidates.length)candidates=pool.filter(player=>!usedSources.has(`${String(player.id)}|${normalizeName(player.name)}`));if(candidates.length){source=pick(candidates);break}}if(!source)return;usedSources.add(`${String(source.id)}|${normalizeName(source.name)}`);const incoming=chaosRegisterGeneratedPlayer({...source,id:`chaos-rimmigrazione-${team.id}-${state.matchday}-${index}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,club:team.id,eventPlayer:true});team.roster[index]=String(incoming.id);changes.push(`${outgoing.name} → ${incoming.name}`)});
 return changes.length?`Rimmigrazione completata: ${changes.length} sostituzioni. ${changes.join(' · ')}`:'La rosa è già tutta italiana.';
}
function activateClosedPorts(){state.seasonRules.nonItalianChemZero=true;const affected=rosterPlayers().filter(entry=>!isItalianPlayer(entry.player)).map(entry=>entry.player.name);return affected.length?`Chiusi i porti è attivo: ${affected.length} ${affected.length===1?'giocatore non italiano ha':'giocatori non italiani hanno'} ora 0 Intesa fino a fine stagione (${affected.join(', ')}).`:'Chiusi i porti è attivo, ma al momento la rosa è composta soltanto da giocatori italiani.'}
function activateYellowEqualsRed(){state.seasonRules.yellowEqualsRed=true;return 'Da ora ogni cartellino giallo porta direttamente all’espulsione.'}
function activatePinkCardRule(){state.seasonRules.pinkCardEndsMatch=true;return 'Da ora ogni partita termina immediatamente quando compare il cartellino rosa, a un minuto casuale.'}
function activateFederationGoalRule(rule='golden'){
 const normalized=rule==='last'?'last':'golden';
 state.seasonRules.federationGoalRule=normalized;
 return normalized==='golden'?'Da ora e fino a fine stagione il primo gol conclude immediatamente la partita e assegna la vittoria.':'Da ora e fino a fine stagione la squadra che segna l’ultimo gol della partita ottiene la vittoria.';
}
function federationGoalRuleLabel(rule=state.seasonRules?.federationGoalRule){return rule==='golden'?'Golden goal':rule==='last'?'Chi segna per ultimo vince':''}
const FORMULA_ONE_POINTS=[25,18,15,12,10,8,6,4,2,1];
function activateFigcCompetitionRule(rule='formula-one'){
 const normalized=rule==='no-draw'?'no-draw':'formula-one';
 state.seasonRules.figcCompetitionRule=normalized;
 return normalized==='formula-one'
  ?'Formato Formula 1 attivo fino a fine stagione: al termine di ogni giornata le squadre vengono ordinate per qualità del risultato e le prime dieci ricevono 25, 18, 15, 12, 10, 8, 6, 4, 2 e 1 punto. Tutte le altre ricevono 0 punti. Inoltre, una squadra con almeno un giocatore infortunato perde automaticamente 0-3 a tavolino la partita successiva. Espulsioni e squalifiche non provocano la sconfitta a tavolino.'
  :'Niente pareggio attivo fino a fine stagione: ogni partita in parità continua ai supplementari e, se serve, ai calci di rigore.';
}
function figcCompetitionRuleLabel(rule=state.seasonRules?.figcCompetitionRule){return rule==='formula-one'?'Formato Formula 1':rule==='no-draw'?'Niente pareggio':''}
function formulaOneRuleActive(){return String(state.seasonRules?.figcCompetitionRule)==='formula-one'}
function noDrawRuleActive(){return String(state.seasonRules?.figcCompetitionRule)==='no-draw'}

function fgicLeagueRuleActive(rule=''){const current=String(state.seasonRules?.fgicLeagueRule||'');return rule?current===String(rule):Boolean(current)}
function bottomHelpRuleActive(){return fgicLeagueRuleActive('bottom-help')}
function leaguePlayoffsRuleActive(){return fgicLeagueRuleActive('playoffs')}
function fgicLeagueRuleLabel(rule=state.seasonRules?.fgicLeagueRule){return rule==='playoffs'?'Play off scudetto':rule==='bottom-help'?'Aiuto dal fondo':''}
function activateFgicLeagueRule(rule='playoffs'){
 const normalized=rule==='bottom-help'?'bottom-help':'playoffs';
 state.seasonRules.fgicLeagueRule=normalized;
 state.seasonRules.bottomHelpRoundTeamIds=[];
 if(normalized==='playoffs')return 'Play off scudetto attivi: al termine della stagione regolare le prime 8 si affrontano a eliminazione diretta in partita secca. La squadra meglio classificata gioca in casa.';
 return 'Aiuto dal fondo attivo: prima di ogni giornata, le squadre dal 10° posto in giù ricevono 4 punti per una vittoria, 2 per un pareggio e 1 anche in caso di sconfitta.';
}
function prepareBottomHelpRound(){state.seasonRules.bottomHelpRoundTeamIds=bottomHelpRuleActive()?sortedTable().slice(9).map(row=>String(row.id)):[];return state.seasonRules.bottomHelpRoundTeamIds}
function bottomHelpRoundEligible(teamId){return bottomHelpRuleActive()&&(state.seasonRules.bottomHelpRoundTeamIds||[]).map(String).includes(String(teamId||''))}
function bottomHelpPoints(gf,ga,winnerId='',teamId=''){
 const result=matchOutcomeScores(gf,ga,winnerId,teamId);return result.gf>result.ga?4:result.gf===result.ga?2:1;
}
function leaguePlayoffState(){
 state.playoffs=state.playoffs&&typeof state.playoffs==='object'?state.playoffs:{};
 const p=state.playoffs;
 p.initialized=Boolean(p.initialized);p.status=['idle','active','completed'].includes(String(p.status))?String(p.status):'idle';p.stageIndex=clamp(Math.floor(Number(p.stageIndex)||0),0,2);p.stageName=String(p.stageName||'');p.qualifiers=Array.isArray(p.qualifiers)?p.qualifiers:[];p.ties=Array.isArray(p.ties)?p.ties:[];p.history=Array.isArray(p.history)?p.history:[];p.championId=String(p.championId||'');p.userQualified=Boolean(p.userQualified);p.userEliminated=Boolean(p.userEliminated);p.lastStageResults=Array.isArray(p.lastStageResults)?p.lastStageResults:[];
 return p;
}
function leaguePlayoffStageName(index=leaguePlayoffState().stageIndex){return ['Quarti di finale','Semifinali','Finale'][clamp(Math.floor(Number(index)||0),0,2)]}
function leaguePlayoffSeed(teamId){const row=leaguePlayoffState().qualifiers.find(item=>String(item.teamId)===String(teamId||''));return Math.max(1,Number(row?.seed)||99)}
function leaguePlayoffTie(teamAId,teamBId,index=0){
 const seedA=leaguePlayoffSeed(teamAId),seedB=leaguePlayoffSeed(teamBId),homeId=seedA<=seedB?String(teamAId):String(teamBId),awayId=homeId===String(teamAId)?String(teamBId):String(teamAId);
 return{id:`playoff-${leaguePlayoffState().stageIndex}-${index}-${homeId}-${awayId}`,homeId,awayId,homeSeed:leaguePlayoffSeed(homeId),awaySeed:leaguePlayoffSeed(awayId)};
}
function initializeLeaguePlayoffs(){
 const p=leaguePlayoffState();if(p.initialized&&p.status!=='idle'){state.phase=p.status==='completed'?'finished':'playoffs';return p.status==='active'}
 const qualifiers=sortedTable().filter(row=>!isTeamEliminated(row.id)).slice(0,8).map((row,index)=>({teamId:String(row.id),seed:index+1,name:String(row.name||teamById(row.id)?.name||'Squadra')}));
 p.initialized=true;p.qualifiers=qualifiers;p.history=[];p.lastStageResults=[];p.championId='';p.userQualified=qualifiers.some(row=>row.teamId===String(USER_ID));p.userEliminated=!p.userQualified;
 if(qualifiers.length<2){p.status='completed';p.championId=String(qualifiers[0]?.teamId||sortedTable()[0]?.id||'');return false}
 if(qualifiers.length<8){
   p.status='completed';p.championId=String(qualifiers[0]?.teamId||'');return false;
 }
 p.status='active';p.stageIndex=0;p.stageName=leaguePlayoffStageName(0);
 const ids=qualifiers.map(row=>row.teamId);p.ties=[leaguePlayoffTie(ids[0],ids[7],0),leaguePlayoffTie(ids[3],ids[4],1),leaguePlayoffTie(ids[1],ids[6],2),leaguePlayoffTie(ids[2],ids[5],3)];state.phase='playoffs';return true;
}
function playoffTeamLineup(team){return String(team?.id||'')===String(USER_ID)?resolveLineup():teamMatchLineup(team)}
function playoffTeamPower(team){return String(team?.id||'')===String(USER_ID)?matchPower():opponentMatchPower(team)}
function simulateLeaguePlayoffTie(tie){
 const home=teamById(tie.homeId),away=teamById(tie.awayId),homeLineup=playoffTeamLineup(home),awayLineup=playoffTeamLineup(away),homePower=Math.max(35,playoffTeamPower(home)),awayPower=Math.max(35,playoffTeamPower(away));
 let [homeGoals,awayGoals]=simulateScore(homePower,awayPower,.16,90),extraTime=false,penalties=null,duration=90;
 if(homeGoals===awayGoals){const extra=simulateScore(homePower,awayPower,.08,30,.62);homeGoals+=Number(extra[0])||0;awayGoals+=Number(extra[1])||0;extraTime=true;duration=120}
 let winnerId='';if(homeGoals!==awayGoals)winnerId=String(homeGoals>awayGoals?tie.homeId:tie.awayId);else{const shootout=simulatePenaltyShootout(homePower,awayPower),homeWins=shootout.scoreA>shootout.scoreB;winnerId=String(homeWins?tie.homeId:tie.awayId);penalties={home:shootout.scoreA,away:shootout.scoreB,winnerId}}
 return{...tie,homeName:String(home?.name||'Squadra'),awayName:String(away?.name||'Squadra'),homeGoals,awayGoals,winnerId,extraTime,duration,penalties};
}
function buildNextLeaguePlayoffTies(winners=[]){
 if(winners.length===4)return[leaguePlayoffTie(winners[0],winners[1],0),leaguePlayoffTie(winners[2],winners[3],1)];if(winners.length===2)return[leaguePlayoffTie(winners[0],winners[1],0)];return[];
}
function finishAfterLeaguePlayoffs(){if(!prepareMysteryCharacterFinale()&&!prepareMeritStoryFinale())state.phase='finished'}
function advanceAfterRegularSeason(){
 if(Number(state.matchday)>=seasonLength()&&leaguePlayoffsRuleActive()){
   const p=leaguePlayoffState();if(p.status!=='completed'&&initializeLeaguePlayoffs())return;
 }
 finishAfterLeaguePlayoffs();
}
function playLeaguePlayoffStage(){
 const p=leaguePlayoffState();if(p.status!=='active'||!p.ties.length)return;
 const stageName=leaguePlayoffStageName(p.stageIndex),results=p.ties.map(simulateLeaguePlayoffTie),winners=results.map(result=>String(result.winnerId));
 p.lastStageResults=results;p.history.push({stageIndex:p.stageIndex,stageName,results});
 const userTie=results.find(result=>[String(result.homeId),String(result.awayId)].includes(String(USER_ID)));if(userTie&&String(userTie.winnerId)!==String(USER_ID))p.userEliminated=true;
 if(p.stageIndex>=2){p.status='completed';p.championId=String(winners[0]||'');p.ties=[];p.stageName='Play off conclusi';}
 else{p.stageIndex++;p.stageName=leaguePlayoffStageName(p.stageIndex);p.ties=buildNextLeaguePlayoffTies(winners)}
 save();
 const rows=results.map(result=>`<div class="goal-line"><b>${result.homeSeed}ª ${esc(result.homeName)} ${Number(result.homeGoals)}–${Number(result.awayGoals)} ${esc(result.awayName)} ${result.awaySeed}ª</b>${result.penalties?`<br>Rigori: ${Number(result.penalties.home)}–${Number(result.penalties.away)}.`:result.extraTime?'<br>Decisa dopo i tempi supplementari.':''}</div>`).join('');
 const completed=p.status==='completed',champion=teamById(p.championId);
 modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal result-modal-expanded"><div class="label">🏆 ${esc(stageName)}</div><h2>${completed?`${esc(champion?.name||'La squadra vincitrice')} è campione`:'Turno completato'}</h2>${rows}<button id="continueLeaguePlayoffs" class="btn primary">${completed?'Vai al finale di stagione':'Continua i play off'}</button></div></div>`;
 document.getElementById('continueLeaguePlayoffs').onclick=()=>{modalRoot.innerHTML='';if(completed)finishAfterLeaguePlayoffs();save();render()};
}
function renderLeaguePlayoffHistory(){
 const p=leaguePlayoffState();if(!p.history.length)return'';
 return p.history.map(stage=>`<section class="panel"><div class="label">${esc(stage.stageName)}</div>${(stage.results||[]).map(result=>`<div class="goal-line"><b>${result.homeSeed}ª ${esc(result.homeName)}</b> ${Number(result.homeGoals)}–${Number(result.awayGoals)} <b>${esc(result.awayName)} ${result.awaySeed}ª</b>${result.penalties?` · rigori ${Number(result.penalties.home)}–${Number(result.penalties.away)}`:result.extraTime?' · d.t.s.':''}</div>`).join('')}</section>`).join('');
}
function showLeaguePlayoffs(){
 const p=leaguePlayoffState();if(!p.initialized)initializeLeaguePlayoffs();if(p.status==='completed'){finishAfterLeaguePlayoffs();save();render();return}
 const qualified=p.qualifiers.map(item=>`${item.seed}ª ${esc(item.name)}`).join(' · '),ties=p.ties.map(tie=>{const home=teamById(tie.homeId),away=teamById(tie.awayId);return `<div class="goal-line"><b>${tie.homeSeed}ª ${esc(home?.name||'Squadra')}</b> vs <b>${esc(away?.name||'Squadra')} ${tie.awaySeed}ª</b><br>Partita secca in casa della squadra meglio classificata.</div>`}).join('');
 screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Nuova regola FGIC</div><h2>Play off scudetto</h2><div class="final-position">TOP 8</div><p>${p.userQualified?'Sei qualificato: affronta il tabellone fino alla finale.':'Non sei tra le prime otto: puoi seguire la simulazione del tabellone.'}</p></div><section class="panel"><h3>${esc(leaguePlayoffStageName(p.stageIndex))}</h3><p class="subline">Qualificate: ${qualified}</p>${ties}<button id="playLeaguePlayoffStage" class="btn primary">${p.userQualified&&!p.userEliminated?'Gioca il turno':'Simula il turno'}</button></section>${renderLeaguePlayoffHistory()}</section>`;
 document.getElementById('playLeaguePlayoffStage').onclick=playLeaguePlayoffStage;
}
function leaguePlayoffChampionId(){return leaguePlayoffsRuleActive()?String(leaguePlayoffState().championId||''):''}
function leaguePlayoffTitleWon(){return leaguePlayoffsRuleActive()&&leaguePlayoffState().status==='completed'&&leaguePlayoffChampionId()===String(USER_ID)}
function leaguePlayoffFinalNote(){if(!leaguePlayoffsRuleActive()||leaguePlayoffState().status!=='completed')return'';const champion=teamById(leaguePlayoffChampionId());return `Play off scudetto: ${champion?.name||'Squadra vincitrice'} campione.`}

function formulaOneInjuredRoster(teamId){
 const id=String(teamId||''),team=teamById(id),isUser=id===String(USER_ID);
 const rosterIds=(isUser?(state.draft?.roster||[]).map(entry=>String(entry?.playerId||entry?.player?.id||'')):(Array.isArray(team?.roster)?team.roster:[]).map(String)).filter(Boolean);
 const statuses=isUser?(state.statuses||{}):(team?.statuses||{});
 return rosterIds.map(playerId=>{
   const status=statuses[String(playerId)]||{};
   const hasInjury=Boolean(status.seasonOut)||Number(status.injury)>0;
   if(!hasInjury)return null; // Espulsioni e squalifiche non causano il tavolino.
   const player=isUser?(rosterEntry(playerId)?.player||playerById(playerId)):chaosPlayer(team,playerId);
   return{playerId:String(playerId),name:String(player?.name||'Giocatore'),injury:Math.max(0,Number(status.injury)||0),seasonOut:Boolean(status.seasonOut)};
 }).filter(Boolean);
}
function formulaOneInjuryWalkoverForMatch(homeId,awayId){
 if(!formulaOneRuleActive())return null;
 const homeInjured=formulaOneInjuredRoster(homeId),awayInjured=formulaOneInjuredRoster(awayId),homeForfeit=homeInjured.length>0,awayForfeit=awayInjured.length>0;
 if(!homeForfeit&&!awayForfeit)return null;
 const doubleForfeit=homeForfeit&&awayForfeit,winnerId=doubleForfeit?'':String(homeForfeit?awayId:homeId);
 return{active:true,homeId:String(homeId||''),awayId:String(awayId||''),homeForfeit,awayForfeit,doubleForfeit,homeInjured,awayInjured,homeScore:doubleForfeit?0:(homeForfeit?0:3),awayScore:doubleForfeit?0:(awayForfeit?0:3),winnerId};
}
function formulaOneWalkoverUserView(walkover,userHome){
 if(!walkover?.active)return null;
 const userForfeit=Boolean(userHome?walkover.homeForfeit:walkover.awayForfeit),opponentForfeit=Boolean(userHome?walkover.awayForfeit:walkover.homeForfeit),userInjured=userHome?walkover.homeInjured:walkover.awayInjured,opponentInjured=userHome?walkover.awayInjured:walkover.homeInjured;
 return{active:true,userForfeit,opponentForfeit,doubleForfeit:Boolean(walkover.doubleForfeit),userInjured:userInjured||[],opponentInjured:opponentInjured||[],gf:userForfeit?0:3,ga:opponentForfeit&&!userForfeit?0:3,winnerId:walkover.doubleForfeit?'':String(walkover.winnerId||'')};
}
function formulaOneApplyDoubleForfeitStanding(teamId){
 const standing=state.standings?.[String(teamId||'')];if(!standing)return;standing.p++;standing.l++;standing.ga+=3;
}
function emptyLeagueMatchAwards(){return{homeGoalkeeperId:'',awayGoalkeeperId:'',homeCleanSheet:false,awayCleanSheet:false,mvpId:'',mvpScore:0,mvpTeamId:'',ductilityBoosts:[]}}
function simulatePenaltyShootout(powerA=70,powerB=70){
 let a=0,b=0,kicksA=0,kicksB=0;
 const chanceA=clamp(.73+(Number(powerA)-Number(powerB))/450,.58,.88),chanceB=clamp(.73+(Number(powerB)-Number(powerA))/450,.58,.88);
 for(let round=0;round<5;round++){
   kicksA++;if(Math.random()<chanceA)a++;
   if(a>b+(5-round))break;
   kicksB++;if(Math.random()<chanceB)b++;
   if(b>a+(4-round))break;
 }
 let sudden=0;while(a===b&&sudden<12){kicksA++;kicksB++;const hitA=Math.random()<chanceA,hitB=Math.random()<chanceB;if(hitA)a++;if(hitB)b++;sudden++;}
 if(a===b){if(Math.random()<.5)a++;else b++;}
 return{scoreA:a,scoreB:b,kicksA,kicksB};
}
function appendExtraTimeGoalEvents(total,lineup,team,opponent,events,startMinute=90){
 const additions=buildTeamGoals(Math.max(0,Number(total)||0),lineup,team,opponent,[],30).map(event=>{const minute=Math.max(1,Number(event.minute)||1)+Math.max(0,Number(startMinute)||90);return{...event,minute,goalValue:Math.max(1,Number(goalValueForMinute(minute))||1),description:`Supplementari: ${event.description||'la palla finisce in rete.'}`}});
 if(Array.isArray(events)){events.push(...additions);events.sort((a,b)=>(Number(a?.minute)||0)-(Number(b?.minute)||0));}
 return additions;
}
function resolveNoDrawMatch({scoreA=0,scoreB=0,eventsA=[],eventsB=[],lineupA=[],lineupB=[],teamA=null,teamB=null,powerA=70,powerB=70,duration=90}={}){
 let a=Number(scoreA)||0,b=Number(scoreB)||0;const regulationDuration=Math.max(30,Number(duration)||90),base={scoreA:a,scoreB:b,outcomeScoreA:a,outcomeScoreB:b,winnerId:a>b?String(teamA?.id||''):b>a?String(teamB?.id||''):'',extraTime:false,penalties:null,duration:regulationDuration,regulationDuration,note:''};
 if(!noDrawRuleActive()||a!==b)return base;
 const extra=simulateScore(Math.max(35,Number(powerA)||70),Math.max(35,Number(powerB)||70),0,30,.62),addedA=appendExtraTimeGoalEvents(extra[0],lineupA,teamA,teamB,eventsA,regulationDuration),addedB=appendExtraTimeGoalEvents(extra[1],lineupB,teamB,teamA,eventsB,regulationDuration);
 a+=scoreGoalEvents(addedA);b+=scoreGoalEvents(addedB);base.extraTime=true;base.duration=regulationDuration+30;base.scoreA=a;base.scoreB=b;base.outcomeScoreA=a;base.outcomeScoreB=b;
 if(a!==b){base.winnerId=String((a>b?teamA:teamB)?.id||'');base.note=`Niente pareggio: ${a>b?teamA?.name:teamB?.name} vince dopo i tempi supplementari.`;return base;}
 const shootout=simulatePenaltyShootout(powerA,powerB),winnerA=shootout.scoreA>shootout.scoreB;base.penalties={home:shootout.scoreA,away:shootout.scoreB,winnerId:String((winnerA?teamA:teamB)?.id||'')};base.winnerId=base.penalties.winnerId;base.outcomeScoreA=a+(winnerA?1:0);base.outcomeScoreB=b+(winnerA?0:1);base.note=`Niente pareggio: ${winnerA?teamA?.name:teamB?.name} vince ${shootout.scoreA}-${shootout.scoreB} ai calci di rigore.`;return base;
}
function matchOutcomeScores(gf,ga,winnerId='',teamId=''){
 let scored=Number(gf)||0,conceded=Number(ga)||0;const winner=String(winnerId||''),team=String(teamId||'');
 if(scored===conceded&&winner){if(winner===team)scored++;else conceded++;}
 return{gf:scored,ga:conceded};
}
function formulaOnePerformanceEntries(roundResults=[]){
 const entries=[];
 (roundResults||[]).forEach(result=>{
   const winner=String(result?.winnerId||''),homeId=String(result?.homeId||''),awayId=String(result?.awayId||''),homeScore=Number(result?.homeScore)||0,awayScore=Number(result?.awayScore)||0,walkover=result?.formulaOneInjuryWalkover||null;
   [[homeId,String(result?.homeName||''),awayId,homeScore,awayScore,'home'],[awayId,String(result?.awayName||''),homeId,awayScore,homeScore,'away']].forEach(([teamId,name,opponentId,gf,ga,side])=>{
     if(!teamId||isTeamEliminated(teamId))return;
     const doubleForfeit=Boolean(walkover?.doubleForfeit),forfeited=Boolean(side==='home'?walkover?.homeForfeit:walkover?.awayForfeit);
     if(doubleForfeit){gf=0;ga=3;}
     const outcome=doubleForfeit||forfeited?0:winner?(winner===teamId?3:0):(gf>ga?3:gf===ga?1:0),opponent=teamById(opponentId),opponentPower=Math.round((opponentMatchPower(opponent)||0)*10)/10;
     entries.push({teamId,name:name||teamById(teamId)?.name||teamId,opponentId,gf,ga,goalDifference:gf-ga,outcome,opponentPower,points:0,position:0,walkover:Boolean(walkover?.active),forfeited,doubleForfeit});
   });
 });
 return entries.sort((a,b)=>b.outcome-a.outcome||b.goalDifference-a.goalDifference||b.gf-a.gf||a.ga-b.ga||b.opponentPower-a.opponentPower||String(a.name).localeCompare(String(b.name),'it'));
}
function applyFormulaOneRoundPoints(roundResults=[]){
 if(!formulaOneRuleActive())return{ranking:[],user:null};
 const ranking=formulaOnePerformanceEntries(roundResults);ranking.forEach((entry,index)=>{entry.position=index+1;entry.points=Number(FORMULA_ONE_POINTS[index]||0);if(state.standings?.[entry.teamId])state.standings[entry.teamId].pts+=entry.points;});
 return{ranking,user:ranking.find(entry=>String(entry.teamId)===String(USER_ID))||null};
}
function formulaOneRankingSummary(ranking=[]){return(ranking||[]).slice(0,10).map(entry=>`${entry.position}. ${entry.name} +${entry.points}`).join(' · ')}
function activateFgciPointsRule(rule='heavy-goals'){
 const normalized=rule==='clean-sheet'?'clean-sheet':'heavy-goals';
 state.seasonRules.fgciPointsRule=normalized;
 return normalized==='heavy-goals'?'Da ora e fino a fine stagione ogni squadra perde 1 punto per ogni gol subito.':'Da ora e fino a fine stagione ogni squadra guadagna 1 punto quando mantiene la porta inviolata.';
}
function fgciPointsRuleLabel(rule=state.seasonRules?.fgciPointsRule){return rule==='heavy-goals'?'Gol pesanti':rule==='clean-sheet'?'Porta inviolata':''}
function activateFgciResultRule(rule='boredom-wins'){
 const normalized=rule==='all-in'?'all-in':'boredom-wins';
 state.seasonRules.fgciResultRule=normalized;
 return normalized==='boredom-wins'?'Da ora e fino a fine stagione ogni 0-0 assegna 7 punti a entrambe le squadre.':'Da ora e fino a fine stagione ogni squadra sconfitta perde 3 punti in classifica.';
}
function fgciResultRuleLabel(rule=state.seasonRules?.fgciResultRule){return rule==='boredom-wins'?'Vince la noia':rule==='all-in'?'Tutto per tutto':''}
function fgciResultRuleTarget(gf,ga,basePoints=0,rule=state.seasonRules?.fgciResultRule){
 const normalized=String(rule||''),scored=Number(gf)||0,conceded=Number(ga)||0;
 if(normalized==='boredom-wins'&&scored===0&&conceded===0)return 7;
 if(normalized==='all-in'&&scored<conceded)return-3;
 return Number(basePoints)||0;
}
function fgciResultRuleNote(gf,ga,rule=state.seasonRules?.fgciResultRule){
 const normalized=String(rule||'');
 if(normalized==='boredom-wins'&&Number(gf)===0&&Number(ga)===0)return'Vince la noia: lo 0-0 assegna 7 punti a entrambe le squadre.';
 if(normalized==='all-in'&&Number(gf)<Number(ga))return'Tutto per tutto: la sconfitta vale -3 punti.';
 return'';
}
function activateFantaballaVideoRule(rule='reverse-points'){
 const normalized=rule==='two-goals-to-win'?'two-goals-to-win':'reverse-points';
 state.seasonRules.fantaballaVideoRule=normalized;
 return normalized==='reverse-points'
  ?'Chi vince perde! è attivo: fino a fine stagione le sconfitte valgono 3 punti, i pareggi 1 e le vittorie 0.'
  :'Segna o non vinci è attivo: fino a fine stagione una squadra deve segnare almeno 2 gol per ottenere una vittoria; ogni 1-0 viene trasformato in 1-1.';
}
function fantaballaVideoRuleLabel(rule=state.seasonRules?.fantaballaVideoRule){return rule==='reverse-points'?'Chi vince perde!':rule==='two-goals-to-win'?'Segna o non vinci':''}
function fantaballaVideoPointsNote(gf,ga,rule=state.seasonRules?.fantaballaVideoRule){
 if(String(rule||'')!=='reverse-points')return'';
 const scored=Number(gf)||0,conceded=Number(ga)||0;
 if(scored>conceded)return'Chi vince perde!: la vittoria assegna 0 punti.';
 if(scored===conceded)return'Chi vince perde!: il pareggio assegna 1 punto.';
 return'Chi vince perde!: la sconfitta assegna 3 punti.';
}
function applyFantaballaVideoScoreRule(scoreA,scoreB,eventsA,eventsB,teamA,teamB,duration=90,rule=state.seasonRules?.fantaballaVideoRule){
 let a=Number(scoreA)||0,b=Number(scoreB)||0,changed=false,note='';
 if(String(rule||'')!=='two-goals-to-win')return{scoreA:a,scoreB:b,changed,note};
 if(a===1&&b===0){
  const equalizer=regulationGoalEvent(teamB,teamA,duration,'Segna o non vinci');
  equalizer.minute=Math.max(1,Number(duration)||90);equalizer.description=`Segna o non vinci: ${teamA?.name||'la squadra in vantaggio'} non ha segnato almeno 2 gol. Il risultato diventa 1-1.`;
  if(Array.isArray(eventsB))eventsB.push(equalizer);b=1;changed=true;note=equalizer.description;
 }else if(b===1&&a===0){
  const equalizer=regulationGoalEvent(teamA,teamB,duration,'Segna o non vinci');
  equalizer.minute=Math.max(1,Number(duration)||90);equalizer.description=`Segna o non vinci: ${teamB?.name||'la squadra in vantaggio'} non ha segnato almeno 2 gol. Il risultato diventa 1-1.`;
  if(Array.isArray(eventsA))eventsA.push(equalizer);a=1;changed=true;note=equalizer.description;
 }
 if(Array.isArray(eventsA))eventsA.sort((x,y)=>(Number(x?.minute)||0)-(Number(y?.minute)||0));
 if(Array.isArray(eventsB))eventsB.sort((x,y)=>(Number(x?.minute)||0)-(Number(y?.minute)||0));
 return{scoreA:a,scoreB:b,changed,note};
}
function activateItaliaCatenaccioRule(rule='allegri'){
 const normalized=rule==='goal-disgust'?'goal-disgust':'allegri';
 state.seasonRules.italiaCatenaccioRule=normalized;
 return normalized==='allegri'?'Allegri insegna è attivo: fino a fine stagione la tua squadra può segnare al massimo un gol per partita.':'Il gol? Che schifo! è attivo: ogni volta che segni più di 3 gol perdi 6 punti in classifica.';
}
function italiaCatenaccioRuleLabel(rule=state.seasonRules?.italiaCatenaccioRule){return rule==='allegri'?'Allegri insegna':rule==='goal-disgust'?'Il gol? Che schifo!':''}
function capGoalEvents(events,maxGoals=1){
 const source=Array.isArray(events)?events:[],limit=Math.max(0,Math.floor(Number(maxGoals)||0)),kept=[];let remaining=limit;
 source.sort((a,b)=>(Number(a?.minute)||0)-(Number(b?.minute)||0));
 for(const event of source){if(remaining<=0)break;const value=Math.max(1,Number(event?.goalValue)||1),accepted=Math.min(value,remaining);event.goalValue=accepted;kept.push(event);remaining-=accepted;}
 source.splice(0,source.length,...kept);return limit-remaining;
}
function applyItaliaCatenaccioPointPenalty(gf){
 if(String(state.seasonRules?.italiaCatenaccioRule)!=='goal-disgust'||Number(gf)<=3)return 0;
 const standing=userStanding();if(standing)standing.pts-=6;return-6;
}
function parityResetState(source=state){
 const rules=source?.seasonRules||(source.seasonRules={});
 const pending=rules.pendingParityReset&&typeof rules.pendingParityReset==='object'?rules.pendingParityReset:(rules.pendingParityReset={});
 pending.active=Boolean(pending.active);
 pending.parity=['even','odd'].includes(String(pending.parity))?String(pending.parity):'';
 pending.dueMatchday=Number.isFinite(Number(pending.dueMatchday))?Number(pending.dueMatchday):-1;
 pending.scheduledAt=Number.isFinite(Number(pending.scheduledAt))?Number(pending.scheduledAt):-1;
 pending.appliedMatchday=Number.isFinite(Number(pending.appliedMatchday))?Number(pending.appliedMatchday):-1;
 pending.lastResult=String(pending.lastResult||'');
 if(!pending.parity||pending.dueMatchday<0)pending.active=false;
 return pending;
}
function scheduleStandingsResetByParity(parity='even'){
 const normalized=parity==='odd'?'odd':'even',label=normalized==='even'?'pari':'dispari';
 const pending=parityResetState(),dueMatchday=Math.min(seasonLength(),(Number(state.matchday)||0)+1);
 Object.assign(pending,{active:true,parity:normalized,dueMatchday,scheduledAt:Number(state.matchday)||0,appliedMatchday:-1,lastResult:''});
 return `La scelta ${label} è stata registrata. La classifica resta invariata: l’azzeramento verrà applicato soltanto dopo la giornata ${dueMatchday}.`;
}
function resetStandingsByParity(parity='even'){
 const normalized=parity==='odd'?'odd':'even',wanted=normalized==='even'?0:1;
 const ids=Array.isArray(state.teams)&&state.teams.length?state.teams.map(team=>String(team.id||'')):Object.keys(state.standings||{});
 let matching=0,reset=0;
 [...new Set(ids)].forEach(id=>{
   const standing=state.standings?.[id],points=Number(standing?.pts);
   if(!standing||!Number.isFinite(points)||!Number.isInteger(points)||Math.abs(points)%2!==wanted)return;
   matching++;
   if(points!==0){if(String(id)===String(USER_ID))setAchievementCareerFlag('parityReset',{resetMatchday:(Number(state.matchday)||0)+1,parity:normalized});standing.pts=0;reset++}
 });
 const label=normalized==='even'?'pari':'dispari';
 if(!matching)return`Nessuna squadra aveva un punteggio ${label}: la classifica non cambia.`;
 if(!reset)return`Le ${matching} squadre con punti ${label} erano già a 0: la classifica non cambia.`;
 const alreadyZero=matching-reset;
 return`${reset} ${reset===1?'squadra è stata portata':'squadre sono state portate'} a 0 perché ${reset===1?'aveva':'avevano'} punti ${label}.${alreadyZero>0?` Altre ${alreadyZero} erano già a 0.`:''}`;
}
function resolvePendingParityResetAfterRound(result){
 const pending=parityResetState(),completedMatchday=(Number(state.matchday)||0)+1;
 if(!pending.active||completedMatchday<Number(pending.dueMatchday))return'';
 const parity=pending.parity,label=parity==='odd'?'Dispari':'Pari',detail=resetStandingsByParity(parity);
 pending.active=false;pending.appliedMatchday=completedMatchday;pending.lastResult=detail;
 const notice=`${label}: ${detail}`;
 if(result){result.parityResetNotice=notice;result.parityResetChoice=label;result.parityResetMatchday=completedMatchday;}
 return notice;
}
function fgciPointsAdjustment(gf,ga,rule=state.seasonRules?.fgciPointsRule){
 const normalized=String(rule||'');
 if(normalized==='heavy-goals')return-Math.max(0,Number(ga)||0);
 if(normalized==='clean-sheet'&&Math.max(0,Number(ga)||0)===0)return 1;
 return 0;
}
function fgciPointsRuleNote(gf,ga,rule=state.seasonRules?.fgciPointsRule){
 const adjustment=fgciPointsAdjustment(gf,ga,rule),label=fgciPointsRuleLabel(rule);if(!label)return'';
 if(String(rule)==='heavy-goals')return`${label}: ${Math.max(0,Number(ga)||0)} ${Math.max(0,Number(ga)||0)===1?'gol subito':'gol subiti'}, ${adjustment} ${Math.abs(adjustment)===1?'punto':'punti'}.`;
 return adjustment>0?`${label}: porta inviolata, +1 punto.`:`${label}: nessun punto bonus perché hai subito gol.`;
}
function applyFederationGoalRuleToEvents(teamAEvents,teamBEvents,teamA,teamB){
 const rule=String(state.seasonRules?.federationGoalRule||'');if(!['golden','last'].includes(rule))return null;
 const a=Array.isArray(teamAEvents)?teamAEvents:[],b=Array.isArray(teamBEvents)?teamBEvents:[];
 const timeline=[...a.map(event=>({event,side:'a',tie:Math.random()})),...b.map(event=>({event,side:'b',tie:Math.random()}))].sort((x,y)=>(Number(x.event?.minute)||0)-(Number(y.event?.minute)||0)||x.tie-y.tie);
 if(!timeline.length)return{rule,scoreA:0,scoreB:0,winnerId:'',endedMinute:0,note:`${federationGoalRuleLabel(rule)}: nessuna squadra ha segnato, quindi la partita termina in pareggio.`};
 if(rule==='golden'){
   const first=timeline[0];first.event.goalValue=1;
   a.splice(0,a.length,...(first.side==='a'?[first.event]:[]));b.splice(0,b.length,...(first.side==='b'?[first.event]:[]));
   const winner=first.side==='a'?teamA:teamB;
   return{rule,scoreA:first.side==='a'?1:0,scoreB:first.side==='b'?1:0,winnerId:String(winner?.id||''),endedMinute:Number(first.event?.minute)||1,note:`Golden goal: ${winner?.name||'la squadra che ha segnato'} vince con il primo gol al ${Number(first.event?.minute)||1}′.`};
 }
 const last=timeline[timeline.length-1],actualA=scoreGoalEvents(a),actualB=scoreGoalEvents(b),winner=last.side==='a'?teamA:teamB;
 let scoreA=actualA,scoreB=actualB;
 if(last.side==='a'&&scoreA<=scoreB)scoreA=scoreB+1;
 if(last.side==='b'&&scoreB<=scoreA)scoreB=scoreA+1;
 return{rule,scoreA,scoreB,winnerId:String(winner?.id||''),endedMinute:Number(last.event?.minute)||90,note:`Chi segna per ultimo vince: ${winner?.name||'la squadra dell’ultimo marcatore'} ottiene la vittoria grazie al gol del ${Number(last.event?.minute)||90}′.`};
}
function leagueScheduleCycle(teamIds,roundCount){
 const ids=[...new Set((teamIds||[]).map(String).filter(Boolean))];if(ids.length<2)return[];
 const base=generateSchedule(ids),rounds=[];for(let index=0;index<Math.max(0,Number(roundCount)||0);index++)rounds.push((base[index%base.length]||[]).map(match=>({...match})));
 return rounds;
}
function leagueStructureTeamIds(source=state){
 const teams=Array.isArray(source?.teams)?source.teams:[],knownIds=new Set(teams.map(team=>String(team?.id||'')).filter(Boolean)),rules=source?.seasonRules||{};
 const explicit=[...new Set((Array.isArray(rules.dynamicLeagueTeamIds)?rules.dynamicLeagueTeamIds:[]).map(String).filter(id=>knownIds.has(id)))];if(explicit.length>=2)return explicit;
 if(rules.dynamicLeague==='elite'){
   const futureIds=new Set();(Array.isArray(source?.schedule)?source.schedule:[]).slice(Math.max(0,Number(source?.matchday)||0)).forEach(round=>(round||[]).forEach(match=>{if(knownIds.has(String(match?.home||'')))futureIds.add(String(match.home));if(knownIds.has(String(match?.away||'')))futureIds.add(String(match.away))}));
   const scheduled=teams.map(team=>String(team.id)).filter(id=>futureIds.has(id));if(scheduled.length>=2)return scheduled;
   const removed=new Set((Array.isArray(rules.eliminatedTeamIds)?rules.eliminatedTeamIds:[]).map(String)),qualified=teams.map(team=>String(team.id)).filter(id=>!removed.has(id));if(qualified.length>=2)return qualified;
 }
 return teams.map(team=>String(team.id)).filter(Boolean);
}
function regularLeagueSeasonLength(teamIds){const count=[...new Set((teamIds||[]).map(String).filter(Boolean))].length;return count>=2?(count-1)*2:0}
function desiredLeagueSeasonLength(source=state,teamIds=leagueStructureTeamIds(source)){
 const regular=regularLeagueSeasonLength(teamIds),marathon=Boolean(source?.seasonRules?.marathon),played=Math.max(0,Number(source?.matchday)||0);
 if(!regular)return Math.max(1,Number(source?.seasonRules?.seasonLength)||38);
 if(source?.seasonRules?.dynamicLeague==='elite')return Math.max(marathon?76:38,played+regular*(marathon?2:1));
 return regular*(marathon?2:1);
}
function rebuildRemainingLeagueSchedule(teamIds,targetLength){
 const completed=(state.schedule||[]).slice(0,Math.max(0,Number(state.matchday)||0)).map(round=>round.map(match=>({...match})));
 const total=Math.max(completed.length,Math.floor(Number(targetLength)||38)),remaining=Math.max(0,total-completed.length);
 state.schedule=[...completed,...leagueScheduleCycle(teamIds,remaining)];state.seasonRules.seasonLength=state.schedule.length;return state.schedule.length;
}
function expandedLeagueClubPool(){
 const playerClubs=new Set((otherCompetitionPlayers()||[]).map(player=>String(player?.club||'')).filter(Boolean));
 return shuffle((OTHER_CLUBS||[]).filter(club=>club&&playerClubs.has(String(club.id))&&!/^fantaballa(?:-|$)/i.test(String(club.id))));
}
function expandedLeagueRoster(club,sourceKey,teamId){
 const pool=(otherCompetitionPlayers()||[]).filter(player=>String(player?.club)===String(club.id)).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0)||String(a.name).localeCompare(String(b.name),'it'));
 const selected=[],used=new Set();[['P',2],['D',5],['C',4],['A',3]].forEach(([role,count])=>pool.filter(player=>roleOf(player)===role).slice(0,count).forEach(player=>{if(!used.has(String(player.id))){selected.push(player);used.add(String(player.id))}}));
 pool.filter(player=>!used.has(String(player.id))).slice(0,Math.max(0,14-selected.length)).forEach(player=>selected.push(player));
 return selected.slice(0,14).map(player=>chaosRegisterGeneratedPlayer({...player,id:`league-${sourceKey}-${club.id}-${player.id}`,club:teamId,originalClub:String(club.id),externalCompetition:sourceKey,eventPlayer:true})).map(player=>String(player.id));
}
function createExpandedLeagueTeam(club,index){
 const sourceKey=PLAYERS===REAL_PLAYERS?'classic':'real',teamId=`expanded-${sourceKey}-${club.id}`,roster=expandedLeagueRoster(club,sourceKey,teamId),values=roster.slice(0,11).map(id=>Number(playerById(id)?.ovr)||60);
 while(values.length<11)values.push(60);
 return{id:teamId,clubId:teamId,originalClubId:String(club.id),name:String(club.name||`Nuova squadra ${index+1}`),shortName:String(club.shortName||club.name||'NEW').slice(0,4).toUpperCase(),colors:club.colorClub||null,strength:Math.round(avg(values)*10)/10,roster,statuses:{},mascot:null,playerOverrides:{},externalCompetition:sourceKey,chaos:{activeEffects:[],seenDecisionEvents:[],decisions:0,midseasonPickDelta:0,matchDuration:90,futureScorerId:'',futureInjuryZeroPoints:false,sixtyPointFear:false,eventChanceMultiplier:1,nonItalianChemZero:false,formation:'',latestDecision:null}};
}
function activateExpandedLeague(){
 if(state.seasonRules.dynamicLeague)return `La struttura della lega è già stata modificata da ${state.seasonRules.dynamicLeagueLabel||'un altro evento'}.`;
 const clubs=expandedLeagueClubPool().slice(0,20);if(clubs.length<20)return `Nell’altro database sono disponibili soltanto ${clubs.length} club completi: il campionato non può essere allargato a 40 squadre.`;
 const leaderPoints=Math.max(0,...Object.values(state.standings||{}).map(row=>Number(row?.pts)||0));
 const pointCap=Math.max(0,Math.floor(leaderPoints));
 const additions=clubs.map(createExpandedLeagueTeam);additions.forEach(team=>{
  const startingPoints=pointCap>0?Math.floor(Math.random()*(pointCap+1)):0;
  state.teams.push(team);
  state.standings[team.id]={id:team.id,name:team.name,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:startingPoints};
 });
 state.seasonRules.dynamicLeague='expanded';state.seasonRules.dynamicLeagueLabel='Campionato allargato';state.seasonRules.dynamicLeagueAppliedAt=Number(state.matchday)||0;
 const activeIds=state.teams.map(team=>String(team.id));state.seasonRules.dynamicLeagueTeamIds=[...activeIds];
 const target=desiredLeagueSeasonLength(state,activeIds);rebuildRemainingLeagueSchedule(activeIds,target);
 return `Campionato allargato attivato: entrano 20 club casuali da ${otherCompetitionName()} con punti iniziali casuali da 0 a ${pointCap}, il punteggio della capolista al momento dell'evento. Ora partecipano ${activeIds.length} squadre e la stagione arriverà a ${state.schedule.length} giornate${state.seasonRules.marathon?' perché la Maratona raddoppia anche il nuovo campionato':''}.`;
}
function activateEliteLeague(){
 if(state.seasonRules.dynamicLeague)return `La struttura della lega è già stata modificata da ${state.seasonRules.dynamicLeagueLabel||'un altro evento'}.`;
 const fullTable=Object.values(state.standings||{}).sort((a,b)=>b.pts-a.pts||((b.gf-b.ga)-(a.gf-a.ga))||b.gf-a.gf||b.w-a.w);if(fullTable.length<11)return 'Non ci sono abbastanza squadre per creare il Campionato élite.';
 const qualified=fullTable.slice(0,10).map(row=>String(row.id)),removed=fullTable.slice(10).map(row=>String(row.id));
 state.seasonRules.dynamicLeague='elite';state.seasonRules.dynamicLeagueLabel='Campionato élite';state.seasonRules.dynamicLeagueAppliedAt=Number(state.matchday)||0;state.seasonRules.dynamicLeagueTeamIds=[...qualified];state.seasonRules.eliminatedTeamIds=[...new Set([...(state.seasonRules.eliminatedTeamIds||[]).map(String),...removed])];
 const target=desiredLeagueSeasonLength(state,qualified);rebuildRemainingLeagueSchedule(qualified,target);
 const removedNames=removed.map(id=>teamById(id)?.name||state.standings?.[id]?.name||id);
 if(removed.includes(USER_ID)){state.phase='finished';return `Campionato élite attivato: le ultime ${removed.length} squadre vengono escluse. La tua squadra non era nelle prime 10 e la stagione termina qui.`}
 return `Campionato élite attivato: restano soltanto le prime 10. Sono state escluse ${removedNames.join(', ')}. Il calendario è stato ricostruito fino alla giornata ${state.schedule.length}.`;
}
function pinkCardMatchDuration(baseDuration=90){const base=Math.max(30,Number(baseDuration)||90);if(!state.seasonRules?.pinkCardEndsMatch)return base;return Math.max(30,Math.min(base,30+Math.floor(Math.random()*Math.max(1,base-29))))}
function coachNamesakePools(){const active=Array.isArray(PLAYERS)?PLAYERS:[],other=PLAYERS===REAL_PLAYERS?CLASSIC_PLAYERS:REAL_PLAYERS;return [active,Array.isArray(other)?other:[]]}
function coachNamesakeSource(){
 const coach=normalizeName(state.coachName);if(!coach)return null;
 const usedNames=new Set(rosterPlayers().map(entry=>normalizeName(entry.player.name)));
 for(const pool of coachNamesakePools()){const available=pool.find(player=>youngBeautifulAllowsPlayer(player)&&normalizeName(player?.name)===coach&&!usedNames.has(normalizeName(player?.name)));if(available)return available}
 for(const pool of coachNamesakePools()){const match=pool.find(player=>youngBeautifulAllowsPlayer(player)&&normalizeName(player?.name)===coach);if(match)return match}
 return null;
}
function bringCoachNamesake(){
 if(talentScoutBlocksExternalArrival())return talentScoutBlockMessage();
 const weakest=weakestRosterItem(),source=coachNamesakeSource();if(!weakest)return 'Nessun giocatore disponibile da sostituire.';if(!source)return `Non esiste né nel database del campionato attivo né in quello dell’altro campionato un giocatore chiamato ${state.coachName||'come il tuo allenatore'}.`;
 const incoming=eventPlayerClone(source,'te-stesso'),change=replaceUserRosterPlayer(weakest.index,incoming);refreshOpponentClubRosters();return `${change?.outgoing?.name||'Il giocatore più scarso'} lascia la rosa: arriva ${incoming.name}, il tuo omonimo trovato nei database dei due campionati.`;
}
function reverseStandingsPoints(){
 const table=sortedTable();if(table.length<2)return 'Non ci sono abbastanza squadre per capovolgere la classifica.';
 const oldPoints=table.map(row=>Number(row.pts)||0),first=table[0],last=table[table.length-1];
 table.forEach((row,index)=>{row.pts=oldPoints[oldPoints.length-1-index]});
 return `Classifica capovolta: ${first.name} prende ${oldPoints[oldPoints.length-1]} punti, mentre ${last.name} prende ${oldPoints[0]} punti. Tutte le altre squadre ricevono i punti della posizione opposta.`;
}
function doubleEventAppearanceRate(){state.seasonRules.eventChanceMultiplier=2;return 'La probabilità complessiva che compaia un evento passa dal 45% al 90% per tutte le prossime giornate.'}
function activateFutureScorer(){
 const entry=randomOwnEntry();if(!entry)return 'Nessun giocatore disponibile.';
 state.seasonRules.futureScorerPlayerId=String(entry.playerId);state.seasonRules.futureScorerPlayerName=String(entry.player.name);state.seasonRules.futureInjuryZeroPoints=true;state.seasonRules.futureInjuryPenaltyNotice='';
 return `${entry.player.name} arriva dal futuro: segnerà almeno un gol in ogni partita. Ogni nuovo infortunio nella tua rosa azzererà i punti in classifica.`;
}
function futureScorerGoalEvent(team,opponent,duration=90){
 const id=String(state.seasonRules.futureScorerPlayerId||''),entry=rosterEntry(id),player=entry?.player||playerById(id);if(!player)return null;
 const minute=Math.max(2,Math.min(Number(duration)||90,Math.floor(5+Math.random()*Math.max(1,(Number(duration)||90)-8))));
 return {minute,playerId:String(player.id),assistId:'',player:player.name,assist:'',teamId:String(team?.id||USER_ID),teamName:team?.name||state.teamName,goalValue:1,isFutureGoal:true,description:'Conosceva già il risultato: il giocatore dal futuro segna come previsto.'};
}
function extendSeasonTo76(){
 state.seasonRules.marathon=true;state.seasonRules.winPoints=1.5;state.seasonRules.drawPoints=0;state.seasonRules.pointsEqualGoals=false;
 const activeIds=leagueStructureTeamIds(state);if(state.seasonRules.dynamicLeague&&!state.seasonRules.dynamicLeagueTeamIds.length)state.seasonRules.dynamicLeagueTeamIds=[...activeIds];
 const target=desiredLeagueSeasonLength(state,activeIds);rebuildRemainingLeagueSchedule(activeIds,target);
 return `Maratona attivata: con ${activeIds.length} squadre la stagione dura il doppio e arriva a ${state.schedule.length} giornate. Le giornate già disputate e i risultati restano invariati. Ogni vittoria vale 1,5 punti e ogni pareggio vale 0 punti.`;
}
function isTeamEliminated(id){return Boolean((state.seasonRules?.eliminatedTeamIds||[]).map(String).includes(String(id)))}
function activateHungerGames(){state.seasonRules.hungerGames=true;state.seasonRules.eliminatedTeamIds=Array.isArray(state.seasonRules.eliminatedTeamIds)?state.seasonRules.eliminatedTeamIds:[];return 'Da ora chi perde una partita viene eliminato fino al termine della stagione e scompare dalla classifica. Le gare future contro squadre eliminate diventano vittorie a tavolino.'}
function applyHungerGamesResult(homeId,awayId,homeScore,awayScore){
 if(!state.seasonRules.hungerGames||Number(homeScore)===Number(awayScore))return '';
 const loserId=Number(homeScore)<Number(awayScore)?String(homeId):String(awayId);if(isTeamEliminated(loserId))return '';
 state.seasonRules.eliminatedTeamIds=[...new Set([...(state.seasonRules.eliminatedTeamIds||[]).map(String),loserId])];const loser=teamById(loserId);return `${loser?.name||'La squadra sconfitta'} è stata eliminata dagli Hunger Games.`;
}
function addMaradonaEventPlayer(){
 if(talentScoutBlocksExternalArrival())return talentScoutBlockMessage();
 if(coachIs('young-beautiful'))return youngBeautifulBlockMessage({name:'Diego Armando Maradona',ovr:120,baseOvr:120});
 const attackingIndexes=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player&&roleOf(item.player)==='A');
 if(!attackingIndexes.length)return 'Nessun attaccante disponibile da sostituire.';
 const selected=pick(attackingIndexes);
 const maradona={id:`event-maradona-${state.meta?.createdAt||Date.now()}`,name:'Diego Armando Maradona',nation:'Argentina',Position:'ATT, AS, AD',role:'A',ovr:120,subscriber:'no',club:USER_ID,eventPlayer:true};
 const change=replaceUserRosterPlayer(selected.index,maradona);
 refreshOpponentClubRosters();
 if(state.standings?.[USER_ID])state.standings[USER_ID].pts=0;
 return `${change?.outgoing?.name||'Un attaccante'} lascia il posto a Maradona da 120 OVR. I punti in classifica sono stati azzerati.`;
}
function rebuildWeakestStarters(){
 if(talentScoutBlocksExternalArrival())return talentScoutBlockMessage();
 const starters=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player&&!item.entry.bench).sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0)).slice(0,3);
 if(!starters.length)return 'Nessun titolare disponibile per il rebuild.';
 const used=new Set(state.draft.roster.map(entry=>String(entry.playerId)));
 const changes=[];
 starters.forEach(item=>{
   let pool=PLAYERS.filter(player=>youngBeautifulAllowsPlayer(player)&&!used.has(String(player.id))&&userCompatible(player,item.entry.slot));
   if(!pool.length)pool=PLAYERS.filter(player=>youngBeautifulAllowsPlayer(player)&&!used.has(String(player.id))&&roleOf(player)===POSITION_ROLE[item.entry.slot]);
   const replacement=pool.length?pick(pool):null;
   if(!replacement)return;
   const change=replaceUserRosterPlayer(item.index,replacement);
   used.add(String(replacement.id));
   if(change)changes.push(change);
 });
 refreshOpponentClubRosters();
 return changes.length?`Rebuild completato: ${changes.map(change=>`${change.outgoing?.name||'Giocatore'} → ${change.incoming.name}`).join(' · ')}.`:'Non sono stati trovati sostituti compatibili.';
}
function runMisterFmExperiment(){
 const candidates=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player);
 if(!candidates.length)return 'Nessun giocatore disponibile per l’esperimento.';
 const selected=pick(candidates);
 const delta=Math.random()<.5?20:-20;
 const before=Number(selected.player.ovr)||60;
 const change=setPermanentRosterOvr(selected.entry,before+delta),after=change?.after??Math.max(1,before+delta);
 if(!change&&delta<0)selected.entry.player={...selected.player,ovr:after};
 return `${selected.player.name}: OVR ${before} → ${after} (${after-before>=0?'+':''}${after-before}) fino al termine della stagione.`;
}
function tacticianPlayerOvr(player){return Math.max(1,ductilityEffectiveBaseOvr(player)+activeOvrBonus(player))}
function optimizeLineupWithBench(){
 const roster=state.draft.roster;
 const changes=[];
 let guard=0;
 while(guard++<20){
   const benches=roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.entry.bench&&item.player).sort((a,b)=>tacticianPlayerOvr(b.player)-tacticianPlayerOvr(a.player));
   let swap=null;
   for(const bench of benches){
     const benchOvr=tacticianPlayerOvr(bench.player);
     const targets=roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>!item.entry.bench&&Number(item.entry.tipsterForcedMatches)<=0&&item.player&&userCompatible(bench.player,item.entry.slot)&&tacticianPlayerOvr(item.player)<benchOvr).sort((a,b)=>tacticianPlayerOvr(a.player)-tacticianPlayerOvr(b.player));
     if(targets.length){swap={bench,target:targets[0]};break}
   }
   if(!swap)break;
   const benchEntry={...swap.bench.entry},targetEntry={...swap.target.entry};
   roster[swap.target.index]={...benchEntry,bench:false,slot:targetEntry.slot,slotId:targetEntry.slotId};
   roster[swap.bench.index]={...targetEntry,bench:true,slot:benchEntry.slot,slotId:benchEntry.slotId};
   changes.push(`${swap.bench.player.name} entra al posto di ${swap.target.player.name} nello slot ${targetEntry.slot}`);
 }
 return changes.length?`Formazione ottimizzata: ${changes.join(' · ')}.`:'La formazione era già la migliore possibile con i panchinari disponibili.';
}
function activatePersistentTactician(){
 state.seasonRules.autoOptimizeLineup=true;
 const result=optimizeLineupWithBench();
 return `${result} Il tattico controllerà nuovamente la formazione dopo ogni cambiamento di OVR o di giocatori, fino a fine stagione.`;
}
function activateFantaguru(){
 state.seasonRules.fantaguruBetterMidseason=true;
 return 'Al draft di metà stagione ogni pack conterrà almeno un giocatore con OVR superiore a quello che stai cedendo.';
}
function registerGeneratedEventPlayer(player){
 state.seasonRules.generatedEventPlayers=Array.isArray(state.seasonRules.generatedEventPlayers)?state.seasonRules.generatedEventPlayers:[];
 const id=String(player.id),index=state.seasonRules.generatedEventPlayers.findIndex(item=>String(item.id)===id);
 if(index>=0)state.seasonRules.generatedEventPlayers[index]={...player,id};else state.seasonRules.generatedEventPlayers.push({...player,id});
 return state.seasonRules.generatedEventPlayers.find(item=>String(item.id)===id);
}
function fantaguruCandidate(outgoing,pool){
 const list=(pool||[]).filter(Boolean);
 if(!list.length)return null;
 const outgoingPlayer=outgoing?.player||playerById(outgoing?.playerId),outgoingOvr=Number(outgoingPlayer?.ovr)||0;
 const stronger=[...list].filter(player=>(Number(player.ovr)||0)>outgoingOvr).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0))[0];
 if(stronger)return stronger;
 const strongest=[...list].sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0))[0];
 if(!strongest)return null;
 const boosted={...strongest,baseOvr:originalBaseOvr(strongest),id:`event-fantaguru-${state.meta?.createdAt||Date.now()}-${state.midseason?.step||0}-${Date.now()}`,ovr:Math.max(outgoingOvr+1,(Number(strongest.ovr)||0)+1),eventPlayer:true,fantaguru:true};
 return registerGeneratedEventPlayer(boosted);
}
function currentMatchDuration(){return [30,90,120].includes(Number(state.seasonRules?.matchDuration))?Number(state.seasonRules.matchDuration):90}
function goalValueForMinute(minute){return state.seasonRules?.lateGoalsDouble&&Number(minute)>=80?2:1}
function scoreGoalEvents(events){return (Array.isArray(events)?events:[]).reduce((sum,event)=>sum+Math.max(1,Number(event?.goalValue)||1),0)}
function regulationGoalEvent(team,opponent,duration=90,label='Regolamento FGCI'){
 const minute=Math.max(2,Math.min(Number(duration)||90,Math.floor(8+Math.random()*Math.max(1,(Number(duration)||90)-12))));
 return {minute,playerId:'',assistId:'',player:label,assist:'',teamId:String(team?.id||''),teamName:team?.name||'',goalValue:1,isRuleGoal:true,description:`Il regolamento assegna un gol a ${team?.name||'questa squadra'}.`};
}
function coachGuaranteedGoalEvent(lineup,team,opponent,duration,reason){
 const generated=buildTeamGoals(1,lineup,team,opponent,[],duration)?.[0]||regulationGoalEvent(team,opponent,duration,'Mister salvezza');
 generated.isCoachGoal=true;generated.description=`${reason} ${generated.description||''}`.trim();return generated;
}
function applyCoachGoalGuarantees(userEvents,opponentEvents,lineup,opponentLineup,userTeam,opponent,duration){
 const result={for:false,against:false,average:coachRosterAverageOvr()};if(!coachIs('salvation'))return result;
 if(result.average<70){userEvents.push(coachGuaranteedGoalEvent(lineup,userTeam,opponent,duration,'Mister salvezza: con una rosa sotto 70 OVR, viene aggiunto un gol alla squadra.'));result.for=true}
 if(result.average>80&&scoreGoalEvents(opponentEvents)<1){opponentEvents.push(coachGuaranteedGoalEvent(opponentLineup,opponent,userTeam,duration,'Mister salvezza: con una rosa sopra 80 OVR, almeno un gol subito è garantito.'));result.against=true}
 return result;
}
function boostAllRosterPlayers(delta){
 const names=[];
 state.draft.roster.forEach(entry=>{const player=entry.player||playerById(entry.playerId);if(!player)return;const before=Number(player.ovr)||60,change=setPermanentRosterOvr(entry,before+delta);if(change)names.push(change.player.name)});
 refreshOpponentClubRosters();
 return names;
}
function ruleOutAllRosterPlayers(reason='Bevanda energetica'){
 const names=[];rosterPlayers().forEach(entry=>{ruleOutForSeason(entry,reason);names.push(entry.player.name)});return names;
}
function coachNamedRosterEntry(){const coach=normalizeName(state.coachName);return coach?rosterPlayers().find(entry=>normalizeName(entry.player?.name)===coach)||null:null}
function centralDefenderRosterEntry(){return rosterPlayers().find(entry=>!entry.bench&&(entry.slot==='DC'||positions(entry.player).includes('DC')))||rosterPlayers().find(entry=>entry.slot==='DC'||positions(entry.player).includes('DC'))||null}
function applyUserFormationLayout(key){
 if(coachIs('three-five-two'))key='3-5-2';
 if(!FORMATION_LAYOUTS[key])return 'Modulo non disponibile.';
 const slots=formationSlots(key),all=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player);
 if(all.length<slots.length)return `Non ci sono abbastanza giocatori per applicare il ${key}.`;
 const unused=[...all],assignments=[];
 const orderedSlots=slots.map((slot,index)=>({slot,index,compatibleCount:unused.filter(item=>userCompatible(item.player,slot.code)).length})).sort((a,b)=>a.compatibleCount-b.compatibleCount||a.index-b.index);
 orderedSlots.forEach(item=>{
   const byOvr=(a,b)=>(Number(b.player.ovr)||0)-(Number(a.player.ovr)||0);
   let candidates=unused.filter(candidate=>userCompatible(candidate.player,item.slot.code)).sort(byOvr);
   if(!candidates.length)candidates=unused.filter(candidate=>roleOf(candidate.player)===POSITION_ROLE[item.slot.code]).sort(byOvr);
   if(!candidates.length)candidates=[...unused].sort(byOvr);
   const selected=candidates[0];if(!selected)return;
   assignments.push({selected,slot:item.slot});
   unused.splice(unused.indexOf(selected),1);
 });
 assignments.forEach(({selected,slot})=>Object.assign(selected.entry,{bench:false,slot:slot.code,slotId:slot.instanceId}));
 unused.sort((a,b)=>(Number(b.player.ovr)||0)-(Number(a.player.ovr)||0)).forEach((item,index)=>Object.assign(item.entry,{bench:true,slot:`PAN${index+1}`,slotId:`bench-${index+1}`}));
 state.formation=key;
 if(state.seasonRules?.autoOptimizeLineup)optimizeLineupWithBench();
 enforceFrenchFlyingPositions();
 const benchCount=Math.max(0,all.length-slots.length);
 return {players:slots.length,bench:benchCount};
}
function forceSeasonFormation(key){
 if(!FORMATION_LAYOUTS[key])return 'Modulo non disponibile.';
 state.seasonRules.leagueFormation=key;
 const userKey=FORMATIONS[state.seasonRules.userFormationOverride]?state.seasonRules.userFormationOverride:key;
 const result=applyUserFormationLayout(userKey);
 if(typeof result==='string')return result;
 const exception=userKey!==key?` La tua squadra mantiene l’eccezione ${userKey}.`:'';
 return `Nuova regola ${key}: le squadre giocano con ${(FORMATION_LAYOUTS[key]||[]).length} giocatori in campo.${exception}`;
}
function forceUserFormation(key){
 if(coachIs('three-five-two')){
   state.seasonRules.userFormationOverride='3-5-2';
   const locked=applyUserFormationLayout('3-5-2');
   return typeof locked==='string'?locked:'3-5-2: il contratto dell’allenatore impedisce qualsiasi cambio di modulo.';
 }
 if(!FORMATION_LAYOUTS[key])return 'Modulo non disponibile.';
 state.seasonRules.userFormationOverride=key;
 const result=applyUserFormationLayout(key);
 if(typeof result==='string')return result;
 return `ATAKARE: solo la tua squadra passa al ${key}, con ${result.players} giocatori in campo e ${result.bench} ${result.bench===1?'panchinaro':'panchinari'}.`;
}
function activateDeathMatchClub(){
 const active=(state.teams||[]).filter(team=>team.id!==USER_ID);
 let target=active.find(team=>normalizeName(team.name).includes('atalanta'))||null;
 const isAtalanta=Boolean(target);
 if(!target)target=active.length?pick(active):null;
 if(!target)return 'Nessun avversario disponibile.';
 state.seasonRules.deathMatchClubId=String(target.id);
 state.seasonRules.deathMatchClubName=String(target.name||'Atalanta');
 state.seasonRules.deathMatchClubBonus=10;
 return isAtalanta?'L’Atalanta riceverà +10 OVR ogni volta che ti affronterà.':`L’Atalanta non partecipa a questa stagione: ${target.name} ne prende il posto e riceverà +10 OVR contro di te.`;
}
function permanentRandomPlayerBoost(delta,source='Magia nera'){
 const entry=randomOwnEntry();if(!entry)return 'Nessun giocatore disponibile.';
 const player=entry.player||playerById(entry.playerId),before=Number(player?.ovr)||60,change=setPermanentRosterOvr(entry,before+delta);
 return change?`${change.player.name}: OVR ${change.before} → ${change.after} per il resto della stagione (${source}).`:'Il bonus OVR non è stato applicato.';
}
function originalBaseOvr(player){
 const explicit=Number(player?.baseOvr);if(Number.isFinite(explicit)&&explicit>0)return Math.max(1,explicit);
 const original=playerById(player?.id);
 const stored=Number(original?.baseOvr);if(Number.isFinite(stored)&&stored>0)return Math.max(1,stored);
 return Math.max(1,Number(original?.ovr??player?.ovr)||60);
}
function ductilityScorerOvrBonus(player){if(!coachIs('ductility')||!player)return 0;return Math.max(0,Math.floor(Number(state.seasonRules?.ductilityScorerOvr?.[String(player.id||'')])||0))}
function ductilityEffectiveBaseOvr(player){const current=Math.max(1,Number(player?.ovr)||originalBaseOvr(player)),base=originalBaseOvr(player);if(!coachIs('ductility'))return current;return Math.max(1,Math.min(current,base)+ductilityScorerOvrBonus(player))}
function ductilityEntryIsOutOfRole(entry){return Boolean(coachIs('ductility')&&entry?.player&&!isEmergencyYouthEntry(entry)&&entry.slot&&!naturalCompatible(entry.player,entry.slot))}
function addDuctilityScorerOvr(playerId,value=1){if(!coachIs('ductility')||!playerId||Number(value)<=0)return 0;state.seasonRules.ductilityScorerOvr=state.seasonRules.ductilityScorerOvr&&typeof state.seasonRules.ductilityScorerOvr==='object'?state.seasonRules.ductilityScorerOvr:{};const id=String(playerId),next=Math.max(0,(Number(state.seasonRules.ductilityScorerOvr[id])||0)+Math.floor(Number(value)||0));state.seasonRules.ductilityScorerOvr[id]=next;return next}
function rosterEntryIndex(entry){return state.draft.roster.findIndex(item=>String(item.playerId)===String(entry?.playerId||''))}
function setPermanentRosterOvr(entry,value){
 if(!entry)return null;
 const index=rosterEntryIndex(entry),player=entry.player||playerById(entry.playerId);
 if(index<0||!player)return null;
 const before=Number(player.ovr)||60,requested=Math.max(1,Math.round(Number(value)||before)),isPositive=requested>before;
 if(isPositive&&coachIs('ductility'))return null;
 const sponsorExtra=isPositive?sponsorOvrExtraFor(requested-before):0,sponsoredRequested=isPositive?requested+sponsorExtra:requested;
 const after=isPositive&&coachIs('motivator')?sponsoredRequested+1:sponsoredRequested;
 state.draft.roster[index].player={...player,ovr:after};
 if(sponsorExtra){recordBallariniPlayerBonus(player.id,sponsorExtra);if(after>=100&&after-sponsorExtra<100)unlockAchievement('qualita-ballarini')}
 if(isPositive&&coachIs('motivator'))addMotivatorPermanentChemistry(player.id,1);
 return {player:state.draft.roster[index].player,before,after};
}
function empowerUnderdog(){
 const entries=rosterPlayers().filter(entry=>entry?.player);
 const eligible=entries.filter(entry=>{const base=originalBaseOvr(entry.player);return base>=60&&base<=70});
 if(!eligible.length)return 'Non hai giocatori con OVR base compreso tra 60 e 70.';
 const selected=pick(eligible),highest=Math.max(...entries.map(entry=>originalBaseOvr(entry.player)));
 const change=setPermanentRosterOvr(selected,highest);
 return change?`${change.player.name} passa da ${change.before} a ${change.after} OVR, quanto il tuo giocatore con l’OVR base più alto, fino a fine stagione.`:'Il potenziamento non è stato applicato.';
}
function guaranteeSixNil(){
 pushEffect('forcedScore',1,1,{gf:6,ga:0,source:'Favoriti'});
 return 'La prossima partita terminerà con una tua vittoria per 6-0.';
}
function zeroFiveTeamsIncluding(){
 const standings=state.standings||{},allIds=Object.keys(standings).filter(id=>standings[id]);
 if(!allIds.length)return [];
 const selected=shuffle(allIds).slice(0,Math.min(5,allIds.length));
 selected.forEach(id=>{if(standings[id])standings[id].pts=0});
 return selected.map(id=>standings[id]?.name||teamById(id)?.name||id);
}
function removeOwnRosterPlayerPermanently(entry,reason=''){ 
 if(!entry)return 'Nessun giocatore disponibile.';
 const index=rosterEntryIndex(entry),player=entry.player||playerById(entry.playerId);if(index<0||!player)return 'Nessun giocatore disponibile.';
 if(!entry.bench){
   const bench=state.draft.roster.map((item,itemIndex)=>({entry:item,index:itemIndex,player:item.player||playerById(item.playerId)})).filter(item=>item.player&&item.entry.bench&&item.index!==index);
   let replacement=bench.filter(item=>userCompatible(item.player,entry.slot)).sort((a,b)=>(Number(b.player.ovr)||0)-(Number(a.player.ovr)||0))[0];
   if(!replacement)replacement=bench.filter(item=>roleOf(item.player)===POSITION_ROLE[entry.slot]).sort((a,b)=>(Number(b.player.ovr)||0)-(Number(a.player.ovr)||0))[0];
   if(!replacement)replacement=bench.sort((a,b)=>(Number(b.player.ovr)||0)-(Number(a.player.ovr)||0))[0];
   if(replacement)Object.assign(replacement.entry,{bench:false,slot:entry.slot,slotId:entry.slotId});
 }
 state.draft.roster.splice(index,1);delete state.statuses[String(player.id)];delete state.playInjured[String(player.id)];clearMandatoryMidseasonPlayer(String(player.id));
 const mental=mentalistaChain();if(String(mental.playerId)===String(player.id))Object.assign(mental,{active:false,stage:0,dueMatchday:-1,training:false,nature:false,completed:true});
 if(String(state.seasonRules.futureScorerPlayerId||'')===String(player.id)){state.seasonRules.futureScorerPlayerId='';state.seasonRules.futureScorerPlayerName='';state.seasonRules.futureInjuryZeroPoints=false;}
 normalizeTipsterBenchSlots();refreshOpponentClubRosters();
 return `${player.name} lascia definitivamente la squadra${reason?` per ${reason}`:''}.`;
}

function activateSpaceJamTalentChallenge(){
 state.seasonRules.spaceJamRule='talent-steal';state.seasonRules.spaceJamTalentPending=true;state.seasonRules.spaceJamLastOutcome='';
 return 'La sfida di Space Jam vale per la prossima partita: una vittoria trasferirà il miglior giocatore avversario nella tua rosa; una sconfitta ti farà perdere il tuo miglior giocatore.';
}
function activateSpaceJamRandomKickoff(){
 state.seasonRules.spaceJamRule='random-kickoff';state.seasonRules.spaceJamTalentPending=false;state.seasonRules.spaceJamLastOutcome='';
 return 'Bib Bip! attivo fino a fine stagione: ogni partita di campionato verrà caricata da un minuto casuale compreso tra 0 e la durata prevista dal regolamento.';
}
function spaceJamRandomKickoffActive(){return String(state.seasonRules?.spaceJamRule)==='random-kickoff'}
function spaceJamMatchTiming(totalDuration=90){
 const total=Math.max(0,Math.floor(Number(totalDuration)||0));if(!spaceJamRandomKickoffActive())return{active:false,totalMinutes:total,startMinute:0,remainingMinutes:total};
 const startMinute=Math.floor(Math.random()*(total+1));return{active:true,totalMinutes:total,startMinute,remainingMinutes:Math.max(0,total-startMinute)};
}
function normalizeGoalEventsToWindow(events,startMinute=0,endMinute=90){
 const start=clamp(Math.floor(Number(startMinute)||0),0,Math.max(0,Math.floor(Number(endMinute)||90))),end=Math.max(start,Math.floor(Number(endMinute)||90));
 (Array.isArray(events)?events:[]).forEach(event=>{const minute=Math.floor(Number(event?.minute)||start);if(minute<start||minute>end){event.minute=start>=end?end:start+Math.floor(Math.random()*Math.max(1,end-start+1));event.goalValue=Math.max(1,Number(goalValueForMinute(event.minute))||1)}});
 return events;
}
function spaceJamOpponentBestPlayer(team){return [...opponentRosterPlayers(team).filter(player=>player&&!player.isMascot)].sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0)||originalBaseOvr(b)-originalBaseOvr(a)||String(a.name).localeCompare(String(b.name),'it'))[0]||null}
function spaceJamReplacementTarget(incoming){
 const rows=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player),incomingRole=roleOf(incoming);
 const correct=rows.filter(item=>item.entry.bench?roleOf(item.player)===incomingRole:userCompatible(incoming,item.entry.slot));
 const sameRole=rows.filter(item=>roleOf(item.player)===incomingRole),pool=correct.length?correct:sameRole.length?sameRole:rows;
 return [...pool].sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0)||Number(a.entry.bench)-Number(b.entry.bench))[0]||null;
}
function spaceJamStealBestOpponentPlayer(opponent){
 const incoming=spaceJamOpponentBestPlayer(opponent),target=incoming?spaceJamReplacementTarget(incoming):null;if(!incoming||!target)return 'La distorsione non trova giocatori validi da trasferire.';
 const outgoing=target.player,outgoingId=String(target.entry.playerId||outgoing.id||''),incomingId=String(incoming.id||'');
 target.entry.playerId=incomingId;target.entry.player={...incoming,id:incomingId,club:USER_ID,spaceJamStolen:true,spaceJamFromTeamId:String(opponent?.id||''),spaceJamFromTeamName:String(opponent?.name||'')};
 if(outgoingId){delete state.playInjured[outgoingId];delete state.statuses[outgoingId];clearMandatoryMidseasonPlayer(outgoingId)}
 state.statuses[incomingId]={injury:0,suspension:0,seasonOut:false,seasonOutReason:''};
 if(opponent){opponent.roster=(Array.isArray(opponent.roster)?opponent.roster:[]).filter(id=>String(id)!==incomingId);if(opponent.playerOverrides)delete opponent.playerOverrides[incomingId];if(opponent.statuses)delete opponent.statuses[incomingId]}
 if(state.stats?.playerTeams){state.stats.playerTeams[incomingId]=USER_ID;state.stats.playerTeamNames[incomingId]=state.teamName}
 normalizeTipsterBenchSlots();refreshOpponentClubRosters();
 return `${incoming.name} (${Number(incoming.ovr)||0} OVR) viene rubato a ${opponent?.name||'gli avversari'} e prende il posto di ${outgoing.name} nel ruolo ${target.entry.slot||incoming.Position||roleOf(incoming)}.`;
}
function spaceJamLoseBestPlayer(){
 const entries=rosterPlayers().filter(entry=>entry?.player),best=[...entries].sort((a,b)=>(ductilityEffectiveBaseOvr(b.player)+activeOvrBonus(b.player))-(ductilityEffectiveBaseOvr(a.player)+activeOvrBonus(a.player))||String(a.player.name).localeCompare(String(b.player.name),'it'))[0];
 return best?removeOwnRosterPlayerPermanently(best,'la sconfitta nella sfida di Space Jam'):'Nessun giocatore disponibile da perdere.';
}
function resolveSpaceJamTalentChallenge(result){
 if(!state.seasonRules?.spaceJamTalentPending||String(state.seasonRules?.spaceJamRule)!=='talent-steal'||!result)return'';
 const opponent=teamById(result.opponentId),won=String(result.winnerId||'')===String(USER_ID)||Number(result.gf)>Number(result.ga),lost=String(result.winnerId||'')===String(result.opponentId)||Number(result.gf)<Number(result.ga);let message='La partita termina in pareggio: Space Jam non trasferisce nessun giocatore.';
 if(won)message=spaceJamStealBestOpponentPlayer(opponent);else if(lost)message=spaceJamLoseBestPlayer();
 state.seasonRules.spaceJamTalentPending=false;state.seasonRules.spaceJamLastOutcome=message;result.spaceJamOutcome=message;result.spaceJamWon=won;result.spaceJamLost=lost;return message;
}

function frenchFlyingRuleActive(){return String(state.seasonRules?.frenchEventChoice)==='flying-keeper'&&Boolean(state.seasonRules?.frenchFlyingKeeperId)&&Boolean(state.seasonRules?.frenchFlyingAttackerId)}
function frenchLateTurnRuleActive(){return String(state.seasonRules?.frenchEventChoice)==='late-turn'&&Boolean(state.seasonRules?.frenchLateAttackerBoostActive)}
function frenchRosterLocation(entry){return entry?{bench:Boolean(entry.bench),slot:String(entry.slot||''),slotId:String(entry.slotId||'')}:null}
function assignFrenchRosterLocation(entry,location){if(!entry||!location)return;entry.bench=Boolean(location.bench);entry.slot=String(location.slot||'');entry.slotId=String(location.slotId||'')}
function frenchAttackFormationSlot(){
 const slots=formationSlots(),preferred=String(state.seasonRules?.frenchFlyingAttackSlot||'');
 return slots.find(slot=>String(slot.code)===preferred&&POSITION_ROLE[slot.code]==='A')||slots.find(slot=>String(slot.code)==='ATT')||slots.find(slot=>POSITION_ROLE[slot.code]==='A')||null;
}
function enforceFrenchFlyingPositions(){
 if(!frenchFlyingRuleActive()||!Array.isArray(state?.draft?.roster))return false;
 const keeper=rosterEntry(state.seasonRules.frenchFlyingKeeperId),attacker=rosterEntry(state.seasonRules.frenchFlyingAttackerId),goalSlot=formationSlots().find(slot=>String(slot.code)==='P'),attackSlot=frenchAttackFormationSlot();
 if(!keeper||!attacker||!goalSlot||!attackSlot||keeper===attacker)return false;
 state.seasonRules.frenchFlyingAttackSlot=String(attackSlot.code||'ATT');
 const targetGoal={bench:false,slot:String(goalSlot.code),slotId:String(goalSlot.instanceId)},targetAttack={bench:false,slot:String(attackSlot.code),slotId:String(attackSlot.instanceId)};
 const occupantGoal=state.draft.roster.find(entry=>entry!==keeper&&entry!==attacker&&!entry.bench&&String(entry.slotId)===targetGoal.slotId)||null;
 const occupantAttack=state.draft.roster.find(entry=>entry!==keeper&&entry!==attacker&&!entry.bench&&String(entry.slotId)===targetAttack.slotId)||null;
 const oldKeeper=frenchRosterLocation(keeper),oldAttacker=frenchRosterLocation(attacker),displaced=[occupantGoal,occupantAttack].filter(Boolean),available=[oldKeeper,oldAttacker].filter(location=>location&&![targetGoal.slotId,targetAttack.slotId].includes(String(location.slotId)));
 assignFrenchRosterLocation(attacker,targetGoal);assignFrenchRosterLocation(keeper,targetAttack);
 displaced.forEach((entry,index)=>{const location=available[index];if(location)assignFrenchRosterLocation(entry,location);else{entry.bench=true;entry.slot=`PAN${index+1}`;entry.slotId=`bench-${index+1}`;}});
 normalizeTipsterBenchSlots();return true;
}
function activateFrenchFlyingGoalkeeper(){
 const starters=rosterPlayers().filter(entry=>entry?.player&&!entry.bench),keeper=starters.find(entry=>String(entry.slot)==='P'&&roleOf(entry.player)==='P')||starters.find(entry=>roleOf(entry.player)==='P'),attackers=starters.filter(entry=>roleOf(entry.player)==='A'&&entry!==keeper);
 if(!keeper||!attackers.length)return 'Servono un portiere e almeno un attaccante titolare per applicare Portiere volante.';
 const attacker=pick(attackers.filter(entry=>POSITION_ROLE[String(entry.slot||'')]==='A').length?attackers.filter(entry=>POSITION_ROLE[String(entry.slot||'')]==='A'):attackers),keeperName=keeper.player.name,attackerName=attacker.player.name;
 const keeperLocation=frenchRosterLocation(keeper),attackerLocation=frenchRosterLocation(attacker);assignFrenchRosterLocation(keeper,attackerLocation);assignFrenchRosterLocation(attacker,keeperLocation);
 state.seasonRules.frenchEventChoice='flying-keeper';state.seasonRules.frenchFlyingKeeperId=String(keeper.playerId);state.seasonRules.frenchFlyingAttackerId=String(attacker.playerId);state.seasonRules.frenchFlyingAttackSlot=String(keeper.slot||attackerLocation?.slot||'ATT');state.seasonRules.frenchLateAttackerBoostActive=false;
 const keeperBefore=Number(keeper.player?.ovr)||60,attackerBefore=Number(attacker.player?.ovr)||60,keeperChange=setPermanentRosterOvr(keeper,keeperBefore+10),attackerChange=setPermanentRosterOvr(attacker,attackerBefore+10);enforceFrenchFlyingPositions();
 const keeperGain=keeperChange?keeperChange.after-keeperChange.before:0,attackerGain=attackerChange?attackerChange.after-attackerChange.before:0,blocked=!keeperChange||!attackerChange;
 return `${keeperName} va in attacco e ${attackerName} va in porta. ${blocked?'Il profilo dell’allenatore ha bloccato almeno uno dei bonus OVR.':`${keeperName} ottiene +${keeperGain} OVR e ${attackerName} ottiene +${attackerGain} OVR.`}`;
}
function activateFrenchLateTurn(){
 state.seasonRules.frenchEventChoice='late-turn';state.seasonRules.frenchLateAttackerBoostActive=true;state.seasonRules.frenchLateAttackerBoostCount=0;state.seasonRules.frenchLateAttackerBoosts={};state.seasonRules.frenchFlyingKeeperId='';state.seasonRules.frenchFlyingAttackerId='';state.seasonRules.frenchFlyingAttackSlot='';
 return 'Si è girato è attivo fino a fine stagione: ogni attaccante che segna dopo l’80° minuto riceve +5 OVR permanente.';
}
function applyFrenchLateAttackerBoosts(events=[],lineup=[]){
 if(!frenchLateTurnRuleActive())return[];
 const playerMap=new Map((Array.isArray(lineup)?lineup:[]).filter(entry=>entry?.player).map(entry=>[String(entry.playerId||entry.player.id),entry])),boosts=[];
 (Array.isArray(events)?events:[]).filter(event=>Number(event?.minute)>80).forEach(event=>{
   const id=String(event?.playerId||''),lineupEntry=playerMap.get(id),entry=rosterEntry(id)||lineupEntry;if(!entry?.player||roleOf(entry.player)!=='A')return;
   const before=Number((rosterEntry(id)?.player||entry.player)?.ovr)||60,change=setPermanentRosterOvr(rosterEntry(id)||entry,before+5),after=change?change.after:before,gain=change?after-change.before:0;
   state.seasonRules.frenchLateAttackerBoostCount=Math.max(0,(Number(state.seasonRules.frenchLateAttackerBoostCount)||0)+1);state.seasonRules.frenchLateAttackerBoosts=state.seasonRules.frenchLateAttackerBoosts&&typeof state.seasonRules.frenchLateAttackerBoosts==='object'?state.seasonRules.frenchLateAttackerBoosts:{};state.seasonRules.frenchLateAttackerBoosts[id]=Math.max(0,(Number(state.seasonRules.frenchLateAttackerBoosts[id])||0)+gain);
   boosts.push({playerId:id,playerName:entry.player.name,minute:Number(event.minute)||0,gain,newOvr:after,blocked:!change});
 });
 return boosts;
}

function sixtyShadesSacrifice(){
 const entries=rosterPlayers().filter(entry=>entry?.player);
 const eligible=entries.filter(entry=>{const base=originalBaseOvr(entry.player);return base>=60&&base<=65});
 if(!eligible.length)return 'Non hai un giocatore con OVR base compreso tra 60 e 65.';
 const chosen=pick(eligible);
 const bestPool=entries.filter(entry=>String(entry.playerId)!==String(chosen.playerId));
 const best=[...bestPool].sort((a,b)=>(Number(b.player?.ovr)||originalBaseOvr(b.player))-(Number(a.player?.ovr)||originalBaseOvr(a.player)))[0];
 const base=originalBaseOvr(chosen),change=setPermanentRosterOvr(chosen,base*2);
 let sacrifice='Nessun altro giocatore disponibile da sacrificare.';
 if(best)sacrifice=removeOwnRosterPlayerPermanently(best,'il piccolo sacrificio');
 return change?`${change.player.name}, con ${base} OVR base, raddoppia la propria forza fino a ${change.after} per tutta la stagione. ${sacrifice}`:sacrifice;
}
function activateSixtyPointFear(){
 state.seasonRules.sixtyPointFear=true;
 state.seasonRules.sixtyPointFearTriggered=false;
 return 'Se la tua squadra raggiungerà esattamente 60 punti, il punteggio verrà immediatamente azzerato.';
}
function applySixtyPointFear(){
 const standing=userStanding();
 if(!state.seasonRules.sixtyPointFear||state.seasonRules.sixtyPointFearTriggered||!standing||Number(standing.pts)!==60)return '';
 standing.pts=0;state.seasonRules.sixtyPointFear=false;state.seasonRules.sixtyPointFearTriggered=true;
 return '60 la paura: hai raggiunto esattamente 60 punti e la classifica ti ha azzerato il punteggio.';
}
function doubleCoachNamesakeChemistry(){
 const entry=coachNamedRosterEntry();
 if(!entry)return 'Non hai in rosa un giocatore con lo stesso nome dell’allenatore.';
 pushSeasonEffect('playerChemMultiplier',2,{playerId:String(entry.playerId),source:'Ehi ma ti chiami come me'});
 return `${entry.player.name} avrà Intesa ×2 fino al termine della stagione.`;
}
function doubleTeamChemistryTwoMatches(){
 pushEffect('teamChemMultiplier',2,2,{source:'Che nome del ca***'});
 return 'L’Intesa positiva di tutta la squadra sarà raddoppiata per le prossime 2 partite.';
}
function activateMandatoryDcTopSwap(){
 const entry=centralDefenderRosterEntry();if(!entry)return 'Non è presente alcun difensore centrale da indicare.';
 queueMandatoryMidseasonPlayer(entry.playerId);
 state.seasonRules.topPlayerAfterMandatoryId=String(entry.playerId);
 return `${entry.player.name} dovrà essere scambiato al draft di metà stagione. Dopo questo cambio, il pack successivo conterrà un top player compatibile.`;
}
function activateCoachTopSwap(){
 const entry=coachNamedRosterEntry();if(!entry)return 'Non è presente in rosa un giocatore con lo stesso nome dell’allenatore.';
 state.seasonRules.coachTopSwapPlayerId=String(entry.playerId);
 return `${entry.player.name} potrà essere scambiato al draft di metà stagione con un top player garantito del suo macro-ruolo.`;
}
function boostCoachNamedPlayer(){
 const entry=coachNamedRosterEntry();if(!entry)return 'Non è presente in rosa un giocatore con lo stesso nome dell’allenatore.';
 const player=entry.player||playerById(entry.playerId),before=Number(player.ovr)||60,change=setPermanentRosterOvr(entry,before+10);
 return change?`${change.player.name} riceve +${change.after-change.before} OVR fino al termine della stagione.`:'Il bonus OVR non è stato applicato.';
}

function curvaContestState(source=state){
 const rules=source?.seasonRules||(source.seasonRules={});
 const contest=rules.curvaContest&&typeof rules.curvaContest==='object'?rules.curvaContest:(rules.curvaContest={});
 contest.active=Boolean(contest.active);
 contest.mode=['title','home','away'].includes(String(contest.mode))?String(contest.mode):'';
 contest.status=['idle','active','won','lost','away'].includes(String(contest.status))?String(contest.status):'idle';
 contest.startedMatchday=Number.isFinite(Number(contest.startedMatchday))?Number(contest.startedMatchday):-1;
 contest.deadlineMatchday=Number.isFinite(Number(contest.deadlineMatchday))?Number(contest.deadlineMatchday):-1;
 contest.pendingTeamId=String(contest.pendingTeamId||'');
 contest.lastResult=String(contest.lastResult||'');
 contest.switchedFromTeamName=String(contest.switchedFromTeamName||'');
 contest.switchedToTeamName=String(contest.switchedToTeamName||'');
 if(!contest.mode)contest.active=false;
 rules.curvaContest=contest;
 return contest;
}
function curvaContestCanAppear(){
 const completed=Math.max(0,Number(state.matchday)||0),total=seasonLength(),contest=curvaContestState();
 if(contest.active||contest.pendingTeamId)return false;
 if(completed+5>=total)return false;
 if(completed<19&&completed+5>=19)return false;
 return true;
}
function activateCurvaTitleChallenge(){
 const contest=curvaContestState();
 contest.active=true;contest.mode='title';contest.status='active';contest.startedMatchday=Math.max(0,Number(state.matchday)||0);contest.deadlineMatchday=contest.startedMatchday+5;contest.pendingTeamId='';contest.lastResult='';contest.switchedFromTeamName='';contest.switchedToTeamName='';
 return `Sfida accettata: al termine della giornata ${contest.deadlineMatchday} dovrai essere tra le prime 2. Durante la sfida non riceverai alcun vantaggio speciale; se riuscirai nell’impresa, tutte le partite successive saranno trattate come gare in casa fino a fine stagione.`;
}
function activateCurvaAwayPenalty(){
 const contest=curvaContestState();
 contest.active=true;contest.mode='away';contest.status='away';contest.startedMatchday=Math.max(0,Number(state.matchday)||0);contest.deadlineMatchday=seasonLength();contest.pendingTeamId='';contest.lastResult='Ogni partita sarà trattata come una trasferta fino a fine stagione.';contest.switchedFromTeamName='';contest.switchedToTeamName='';
 return 'Ignori la contestazione: da questo momento ogni partita di campionato avrà lo svantaggio di una gara in trasferta fino a fine stagione.';
}
function curvaContestVenueMode(){const contest=curvaContestState();return contest.active&&['home','away'].includes(contest.mode)?contest.mode:''}
function curvaContestHomeAdvantage(userHome){
 const mode=curvaContestVenueMode();
 if(mode==='home')return userHome?.18:-.18;
 if(mode==='away')return userHome?-.18:.18;
 return .18;
}
function curvaContestFutureTeamCandidates(){
 const futureIds=new Set();
 (state.schedule||[]).slice(Math.max(0,(Number(state.matchday)||0)+1)).forEach(round=>(round||[]).forEach(match=>{futureIds.add(String(match?.home||''));futureIds.add(String(match?.away||''))}));
 return (state.teams||[]).filter(team=>team&&String(team.id)!==USER_ID&&!isTeamEliminated(team.id)&&(!futureIds.size||futureIds.has(String(team.id))));
}
function resolveCurvaContestAfterRound(result){
 const contest=curvaContestState();if(!contest.active||contest.mode!=='title'||!result)return '';
 const completedMatchday=(Number(state.matchday)||0)+1;if(completedMatchday<contest.deadlineMatchday)return '';
 const rank=sortedTable().findIndex(row=>String(row.id)===USER_ID)+1;
 if(rank>0&&rank<=2){
   contest.active=true;contest.mode='home';contest.status='won';contest.deadlineMatchday=seasonLength();contest.lastResult=`Obiettivo raggiunto: ${state.teamName} è ${rank}ª in classifica dopo 5 giornate. Da ora e fino al termine della stagione ogni partita sarà trattata come una gara in casa.`;
   result.curvaContestNotice=contest.lastResult;result.curvaContestSuccess=true;return contest.lastResult;
 }
 contest.active=false;
 const candidates=curvaContestFutureTeamCandidates(),target=candidates.length?pick(candidates):null;
 contest.status='lost';contest.pendingTeamId=String(target?.id||'');contest.switchedFromTeamName=String(state.teamName||'La tua squadra');contest.switchedToTeamName=String(target?.name||'');
 contest.lastResult=target?`Obiettivo fallito: ${state.teamName} è ${rank>0?`${rank}ª`:'fuori dalle prime 2'}. Dopo il riepilogo perderai la squadra e prenderai il controllo di ${target.name}.`:`Obiettivo fallito: ${state.teamName} non è tra le prime 2, ma non esiste un'altra squadra disponibile da controllare.`;
 result.curvaContestNotice=contest.lastResult;result.curvaContestSuccess=false;result.curvaContestPendingTeamId=contest.pendingTeamId;return contest.lastResult;
}
function plainClone(value,fallback={}){try{return JSON.parse(JSON.stringify(value??fallback))}catch{return fallback}}
function userRosterOverridesForBot(entries){
 const overrides={};(entries||[]).forEach(entry=>{const id=String(entry?.playerId||entry?.player?.id||''),player=entry?.player||playerById(id),base=playerById(id);if(!id||!player)return;const currentOvr=Number(player.ovr),baseOvr=Number(base?.ovr);if(Number.isFinite(currentOvr)&&(!Number.isFinite(baseOvr)||currentOvr!==baseOvr))overrides[id]={ovr:currentOvr}});return overrides;
}
function buildControlledRosterEntries(players){
 const source=(Array.isArray(players)?players:[]).filter(Boolean).slice(0,14),slots=formationSlots(),unused=[...source],entries=[];
 const ordered=slots.map((slot,index)=>({slot,index,count:unused.filter(player=>userCompatible(player,slot.code)).length})).sort((a,b)=>a.count-b.count||a.index-b.index);
 const assigned=new Map();
 ordered.forEach(item=>{const byOvr=(a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0);let candidates=unused.filter(player=>userCompatible(player,item.slot.code)).sort(byOvr);if(!candidates.length)candidates=unused.filter(player=>roleOf(player)===POSITION_ROLE[item.slot.code]).sort(byOvr);if(!candidates.length)candidates=[...unused].sort(byOvr);const selected=candidates[0];if(!selected)return;assigned.set(item.slot.instanceId,selected);unused.splice(unused.indexOf(selected),1)});
 slots.forEach(slot=>{const player=assigned.get(slot.instanceId);if(player)entries.push({playerId:String(player.id),slotId:slot.instanceId,slot:slot.code,bench:false,player:{...player}})});
 unused.sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0)).forEach((player,index)=>entries.push({playerId:String(player.id),slotId:`bench-${index+1}`,slot:`PAN${index+1}`,bench:true,player:{...player}}));
 return entries;
}
function swapFutureScheduleControl(targetId){
 const id=String(targetId||'');if(!id)return;
 for(let index=Math.max(0,Number(state.matchday)||0);index<(state.schedule||[]).length;index++){
   (state.schedule[index]||[]).forEach(match=>{if(String(match.home)===USER_ID)match.home=id;else if(String(match.home)===id)match.home=USER_ID;if(String(match.away)===USER_ID)match.away=id;else if(String(match.away)===id)match.away=USER_ID});
 }
}
function performPendingCurvaTeamSwitch(){
 const contest=curvaContestState(),targetId=String(contest.pendingTeamId||'');if(!targetId)return null;
 const userTeam=teamById(USER_ID),target=teamById(targetId);if(!userTeam||!target){contest.pendingTeamId='';return null}
 const oldUserEntries=rosterPlayers(),oldUserIds=oldUserEntries.map(entry=>String(entry.playerId)),oldUserStatuses=plainClone(state.statuses,{}),oldUserOverrides=userRosterOverridesForBot(oldUserEntries),oldUserStrength=teamPowerBase();
 const oldIdentity={clubId:String(userTeam.clubId||state.userClubId||''),name:String(userTeam.name||state.teamName||'Squadra'),shortName:String(userTeam.shortName||''),colors:plainClone(userTeam.colors||state.teamColors||null,null),externalCompetition:String(userTeam.externalCompetition||''),originalClubId:String(userTeam.originalClubId||'')};
 const targetPlayers=opponentRosterPlayers(target).filter(player=>!player?.isMascot).map(player=>({...player})),targetStatuses=plainClone(target.statuses,{}),targetStrength=Number(target.strength)||avg(targetPlayers.slice(0,11).map(player=>Number(player.ovr)||60));
 const newIdentity={clubId:String(target.clubId||target.id||''),name:String(target.name||'Nuova squadra'),shortName:String(target.shortName||''),colors:plainClone(target.colors||null,null),externalCompetition:String(target.externalCompetition||''),originalClubId:String(target.originalClubId||'')};
 const oldStanding=plainClone(state.standings?.[USER_ID],{id:USER_ID,name:oldIdentity.name,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}),targetStanding=plainClone(state.standings?.[targetId],{id:targetId,name:newIdentity.name,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});
 swapFutureScheduleControl(targetId);
 state.standings[USER_ID]={...targetStanding,id:USER_ID,name:newIdentity.name};state.standings[targetId]={...oldStanding,id:targetId,name:oldIdentity.name};
 target.clubId=oldIdentity.clubId;target.name=oldIdentity.name;target.shortName=oldIdentity.shortName;target.colors=oldIdentity.colors;target.strength=oldUserStrength;target.roster=oldUserIds;target.statuses=oldUserStatuses;target.playerOverrides=oldUserOverrides;target.mascot=null;target.externalCompetition=oldIdentity.externalCompetition;target.originalClubId=oldIdentity.originalClubId;target.controlSwapLockedRoster=true;target.chaos={activeEffects:[],seenDecisionEvents:[],decisions:0,midseasonPickDelta:0,matchDuration:90,futureScorerId:'',futureInjuryZeroPoints:false,sixtyPointFear:false,eventChanceMultiplier:1,nonItalianChemZero:false,formation:'',latestDecision:null};
 userTeam.clubId=newIdentity.clubId;userTeam.name=newIdentity.name;userTeam.shortName=newIdentity.shortName;userTeam.colors=newIdentity.colors;userTeam.strength=targetStrength;userTeam.externalCompetition=newIdentity.externalCompetition;userTeam.originalClubId=newIdentity.originalClubId;delete userTeam.roster;delete userTeam.statuses;delete userTeam.playerOverrides;delete userTeam.mascot;delete userTeam.chaos;delete userTeam.controlSwapLockedRoster;
 state.userClubId=newIdentity.clubId;state.teamName=newIdentity.name;if(newIdentity.colors)state.teamColors=normalizeClubColors(newIdentity.colors);state.statuses=targetStatuses;state.playInjured={};state.draft.roster=buildControlledRosterEntries(targetPlayers);state.draft.clubId='';state.draft.candidates=[];state.draft.pendingPlayerId='';
 if(state.stats?.playerTeams){oldUserIds.forEach(id=>{state.stats.playerTeams[id]=targetId;state.stats.playerTeamNames[id]=oldIdentity.name});targetPlayers.forEach(player=>{const id=String(player.id);state.stats.playerTeams[id]=USER_ID;state.stats.playerTeamNames[id]=newIdentity.name})}
 (state.cup?.participants||[]).forEach(participant=>{if(String(participant.teamId)===USER_ID){participant.name=newIdentity.name;participant.clubId=newIdentity.clubId;participant.strength=targetStrength}else if(String(participant.teamId)===targetId){participant.name=oldIdentity.name;participant.clubId=oldIdentity.clubId;participant.strength=oldUserStrength}});
 contest.pendingTeamId='';contest.switchedFromTeamName=oldIdentity.name;contest.switchedToTeamName=newIdentity.name;contest.lastResult=`Hai perso il controllo di ${oldIdentity.name}. Ora alleni ${newIdentity.name}, mantenendo la sua posizione in classifica e il suo calendario.`;
 setAchievementCareerFlag('previousControlledTeamId',targetId);setAchievementCareerFlag('previousControlledTeamName',oldIdentity.name);
 return{from:oldIdentity.name,to:newIdentity.name};
}

function seasonRuleSummary(){
 const target=midseasonTarget();
 const decisionMode=state.seasonRules.autoDecisions?'Mascotte / bot':'Allenatore';
 const marketMode=(state.seasonRules.autoMidseason||state.seasonRules.botMidseason)?'Automatico':'Manuale';
 const extras=[`Allenatore: ${coachProfile().name}`,coachCurrentEffectLabel()];
 const refereeDeal=secretRefereeDealState();if(refereeDeal.active)extras.push(`Arbitro ecuadoriano: rigore ${refereeDeal.choice==='accept'?'a favore':'contro'} ogni partita`);
 const curvaContest=curvaContestState();if(curvaContest.active&&curvaContest.mode==='title')extras.push(`Contestazione curva: obiettivo top 2 entro la giornata ${curvaContest.deadlineMatchday}; nessun vantaggio durante la sfida`);if(curvaContest.active&&curvaContest.mode==='home')extras.push('Contestazione curva superata: ogni gara vale come in casa fino a fine stagione');if(curvaContest.active&&curvaContest.mode==='away')extras.push('Contestazione curva: ogni gara vale come in trasferta fino a fine stagione');
 if(state.seasonRules.marottaDoubleWins)extras.push('Marotta League attiva: vittoria +6, sconfitta -100');
 if(Number(state.seasonRules.winPoints)!==3||Number(state.seasonRules.drawPoints)!==1)extras.push(`Punteggio: vittoria +${Number(state.seasonRules.winPoints)} · pareggio +${Number(state.seasonRules.drawPoints)}`);
 if(currentMatchDuration()!==90)extras.push(`Durata tue partite: ${currentMatchDuration()} minuti`);
 if(state.seasonRules.deathMatchClubId)extras.push(`${state.seasonRules.deathMatchClubName||'Club speciale'}: +${Number(state.seasonRules.deathMatchClubBonus)||10} OVR contro di te`);
 if(state.seasonRules.redCardGoals)extras.push('Ogni rosso vale un gol per la squadra che lo riceve');
 if(state.seasonRules.pointsEqualGoals)extras.push('Punti in classifica uguali ai gol segnati');
 if(state.seasonRules.yellowEqualsRed)extras.push('Giallo = espulsione diretta');
 if(state.seasonRules.pinkCardEndsMatch)extras.push('Cartellino rosa: partita conclusa a un minuto casuale');
 if(state.seasonRules.federationGoalRule)extras.push(`Regola FIGC: ${federationGoalRuleLabel()}`);
 if(state.seasonRules.figcCompetitionRule)extras.push(state.seasonRules.figcCompetitionRule==='formula-one'?`Regolamento FIGC: ${figcCompetitionRuleLabel()} · tavolino solo per infortuni, non per espulsioni o squalifiche`:`Regolamento FIGC: ${figcCompetitionRuleLabel()}`);
 if(state.seasonRules.fgicLeagueRule)extras.push(`Regola FGIC: ${fgicLeagueRuleLabel()}`);
 if(state.seasonRules.fgciPointsRule)extras.push(`Regola FGCI: ${fgciPointsRuleLabel()}`);
 if(state.seasonRules.fgciResultRule)extras.push(`Regola FGCI: ${fgciResultRuleLabel()}`);
 if(state.seasonRules.fantaballaVideoRule)extras.push(`Video di Fantaballa: ${fantaballaVideoRuleLabel()}`);
 if(state.seasonRules.italiaCatenaccioRule)extras.push(`Italia, pizza e catenaccio: ${italiaCatenaccioRuleLabel()}`);
 if(state.seasonRules.spaceJamTalentPending)extras.push('Space Jam · Che succede amico?: sfida attiva per la prossima partita');
 if(spaceJamRandomKickoffActive())extras.push('Space Jam · Bib Bip!: inizio delle partite a un minuto casuale');
 if(frenchFlyingRuleActive()){const keeper=rosterEntry(state.seasonRules.frenchFlyingKeeperId)?.player?.name||'Portiere',attacker=rosterEntry(state.seasonRules.frenchFlyingAttackerId)?.player?.name||'Attaccante';extras.push(`Portiere volante: ${keeper} in attacco e ${attacker} in porta, entrambi potenziati`)}
 if(frenchLateTurnRuleActive())extras.push(`Si è girato: +5 OVR agli attaccanti per ogni gol dopo l’80° (${Number(state.seasonRules.frenchLateAttackerBoostCount)||0} bonus applicati)`);
 if(state.seasonRules.dynamicLeague)extras.push(`${state.seasonRules.dynamicLeagueLabel||'Lega modificata'}: ${state.teams.filter(team=>!isTeamEliminated(team.id)).length} squadre attive`);
 if(state.seasonRules.nonItalianChemZero)extras.push('0 Intesa ai giocatori non italiani');
 if(Number(state.seasonRules.eventChanceMultiplier)>1)extras.push('La moltiplicazione: probabilità eventi al 90%');
 if(Number(state.seasonRules.injuredOvrBonus)>0)extras.push(`Infortunati schierati: +${state.seasonRules.injuredOvrBonus} OVR`);
 if(state.seasonRules.futureScorerPlayerId)extras.push(`${state.seasonRules.futureScorerPlayerName||'Giocatore dal futuro'}: almeno 1 gol a partita; un infortunio azzera i punti`);
 if(state.seasonRules.marathon)extras.push(`Maratona: ${seasonLength()} giornate`);
 if(state.seasonRules.hungerGames)extras.push(`Hunger Games: ${(state.seasonRules.eliminatedTeamIds||[]).length} squadre eliminate`);
 if(state.seasonRules.lateGoalsDouble)extras.push('Gol dall’80°: valore doppio');
 if(state.seasonRules.zeroZeroNoPoints)extras.push('0-0: nessun punto');
 if(state.seasonRules.sixtyPointFear&&!state.seasonRules.sixtyPointFearTriggered)extras.push('60 la paura: a 60 punti il punteggio viene azzerato');
 if(state.seasonRules.guaranteedTopPlayerNextMidseason)extras.push('Prossimo pack mercato: top player garantito');
 if(state.seasonRules.coachTopSwapPlayerId)extras.push('Scambio speciale del figlio del mister disponibile');
 if(state.seasonRules.autoOptimizeLineup)extras.push('Il tattico aggiorna automaticamente i titolari fino a fine stagione');
 if(state.seasonRules.sponsorChoice==='ballarini')extras.push('Sponsor Padelle Ballarini: +5 a ogni bonus OVR positivo degli eventi');
 if(state.seasonRules.sponsorChoice==='football-manager')extras.push('Sponsor Football Manager: Tattico automatico e rischio infortuni dimezzato');
 const penguin=penguinChain();if(penguin.active&&penguin.stage===2&&penguin.mode==='ludopatia')extras.push(`Ludopatia: ${Number(penguin.nonWins)||0} giocatori persi dopo partite non vinte`);if(penguin.active&&penguin.stage===2&&penguin.mode==='tipster')extras.push(`Esperto Tipster: ${Number(penguin.wins)||0} nuovi giocatori ottenuti dopo le vittorie`);
 const leagueFormation=FORMATIONS[state.seasonRules.leagueFormation]?state.seasonRules.leagueFormation:state.formation;
 if(leagueFormation==='4-4-4')extras.push('Regola FGCI 4-4-4: le squadre giocano in 14');
 if(leagueFormation==='3-3-3')extras.push('Regola FGCI 3-3-3: le squadre giocano in 9');
 if(state.seasonRules.userFormationOverride)extras.push(`Eccezione personale ATAKARE: la tua squadra gioca con il ${state.seasonRules.userFormationOverride}`);
 const mandatoryNames=mandatoryMidseasonPlayerIds().map(id=>playerById(id)?.name).filter(Boolean);if(mandatoryNames.length)extras.push(`Scambi obbligatori: ${mandatoryNames.join(', ')}`)
 return `<div class="season-rules-card"><b>Regole alterate dagli eventi</b><br>Modalità: ${chaosEnabled()?'Caos (19 avversarie attive)':'Normale'} · Draft di metà stagione: ${target} ${target===1?'cambio':'cambi'} · Decisioni: ${decisionMode} · Draft: ${marketMode} · Eventi unici: ${(state.seenDecisionEvents||[]).length}/${DECISIONS.length}${extras.length?`<br>${extras.map(esc).join(' · ')}`:''}</div>`;
}
function isEmergencyYouthEntry(entry){return Boolean(entry?.emergencyYouth||entry?.player?.emergencyYouth)}
function makeEmergencyYouthEntry(slot,index=0,owner='user',slotId=''){
 const code=String(slot?.code||slot||'CC'),resolvedSlotId=String(slotId||slot?.instanceId||`starter-${index}`),role=POSITION_ROLE[code]||'C',id=`${owner}:primavera:${resolvedSlotId}`;
 return {playerId:id,slot:code,slotId:resolvedSlotId,bench:false,malus:0,replaces:'',emergencyYouth:true,player:{id,name:`Primavera ${index+1}`,nation:'Primavera',Position:code,role,roleLabel:role==='P'?'Portiere':role==='D'?'Difensore':role==='A'?'Attaccante':'Centrocampista',ovr:50,subscriber:'no',emergencyYouth:true}};
}
function resolveRosterLineup(entries=rosterPlayers(),options={}){
 const source=(Array.isArray(entries)?entries:[]).filter(entry=>entry&&entry.player),slots=formationSlots(options.formation||state.formation),starters=source.filter(entry=>!entry.bench),bench=source.filter(entry=>entry.bench),usedPlayers=new Set(),usedStarters=new Set(),out=[],ignoreStatuses=Boolean(options.ignoreStatuses);
 const entryStatus=entry=>ignoreStatuses?{injury:0,suspension:0,seasonOut:false}:statusOf(entry.playerId||entry.player?.id);
 const temporarilyBlocked=entry=>!ignoreStatuses&&temporaryEventBlocksPlayer(entry.playerId||entry.player?.id);
 const availableEntry=entry=>{const st=entryStatus(entry);return !temporarilyBlocked(entry)&&!st.seasonOut&&Number(st.suspension)<=0&&Number(st.injury)<=0};
 const chooseBench=slot=>{const available=bench.filter(entry=>!usedPlayers.has(String(entry.playerId))&&availableEntry(entry));let sub=available.find(entry=>userCompatible(entry.player,slot.code));if(!sub)sub=available.find(entry=>roleOf(entry.player)===POSITION_ROLE[slot.code]);if(!sub)sub=available[0];return sub||null};
 slots.forEach((slot,index)=>{
   let starter=starters.find(entry=>!usedStarters.has(entry)&&String(entry.slotId)===String(slot.instanceId));
   if(!starter)starter=starters.find(entry=>!usedStarters.has(entry)&&String(entry.slot)===String(slot.code));
   if(starter)usedStarters.add(starter);
   const st=starter?entryStatus(starter):null,starterUnavailable=Boolean(starter&&(temporarilyBlocked(starter)||st.seasonOut||Number(st.suspension)>0||(Number(st.injury)>0&&!state.playInjured[String(starter.playerId)])));
   if(starter&&!starterUnavailable&&!usedPlayers.has(String(starter.playerId))){usedPlayers.add(String(starter.playerId));out.push({...starter,slot:slot.code,slotId:slot.instanceId,bench:false,malus:Number(st.injury)>0?-20:0,replaces:''});return}
   const sub=chooseBench(slot);
   if(sub){usedPlayers.add(String(sub.playerId));out.push({...sub,slot:slot.code,slotId:slot.instanceId,bench:false,malus:userCompatible(sub.player,slot.code)?0:-10,replaces:starter?.player?.name||''});return}
   const youth=makeEmergencyYouthEntry(slot,index,'user',slot.instanceId);youth.replaces=starter?.player?.name||'';out.push(youth);
 });
 return out;
}
function resolveLineup(){enforceTipsterStarters();if(state.seasonRules?.autoOptimizeLineup)optimizeLineupWithBench();enforceFrenchFlyingPositions();return applyWrongShirtSwap(resolveRosterLineup(rosterPlayers()))}
function coachRosterAverageOvr(){const values=rosterPlayers().map(entry=>ductilityEffectiveBaseOvr(entry?.player)).filter(value=>value>0);return values.length?avg(values):0}
function coachTrailingStreak(){const history=Array.isArray(state?.history)?state.history:[];if(!history.length)return{type:'',count:0};const result=history[history.length-1],type=Number(result.gf)>Number(result.ga)?'win':Number(result.gf)<Number(result.ga)?'loss':'draw';let count=0;for(let index=history.length-1;index>=0;index--){const item=history[index],current=Number(item.gf)>Number(item.ga)?'win':Number(item.gf)<Number(item.ga)?'loss':'draw';if(current!==type)break;count++}return{type,count}}
function coachMatchOvrModifier(){if(!coachIs('motivator'))return 0;const streak=coachTrailingStreak();if(streak.type==='loss'&&streak.count===2)return 3;if(streak.type==='win'&&streak.count===3)return-3;return 0}
function coachCurrentEffectLabel(){if(coachIs('motivator')){const value=coachMatchOvrModifier(),boost='bonus OVR/Intesa potenziati di +1 OVR e +1 Intesa';return value>0?`Motivatore: +3 OVR nella prossima partita · ${boost}`:value<0?`Motivatore: -3 OVR nella prossima partita · ${boost}`:`Motivatore: ${boost}`}if(coachIs('salvation')){const value=coachRosterAverageOvr();return value<70?`Mister salvezza: +1 gol aggiuntivo a ogni partita (OVR rosa ${value.toFixed(1)})`:value>80?`Mister salvezza: gol subito garantito (OVR rosa ${value.toFixed(1)})`:`Mister salvezza: fascia neutra (OVR rosa ${value.toFixed(1)})`}if(coachIs('talent-scout'))return'Talent scout: primo pack dalla squadra dell’omonimo, scouting potenziato e mercato esterno bloccato';if(coachIs('young-beautiful'))return'Giovani e belli: +20 Intesa agli OVR base 60–69, +10 agli OVR base 70–75, vietati gli OVR base da 85 in su';if(coachIs('ductility'))return'Duttilità: nessun malus fuori ruolo, Intesa sempre 0, nessun altro bonus OVR; chi segna fuori ruolo guadagna +1 OVR fino a fine stagione';if(coachIs('three-five-two'))return'3-5-2: rosa di 14 giocatori generata dal primo club del draft, modulo bloccato sul 3-5-2, probabilità eventi dimezzata e nessun draft di metà stagione';return'Anonimo: nessun effetto'}
function teamPowerBase(){return resolvedLineupAverage(resolveRosterLineup(rosterPlayers(),{ignoreStatuses:true}))}
function matchPower(){return resolvedLineupAverage(resolveLineup())}
function unavailableList(){return rosterPlayers().filter(r=>{const s=statusOf(r.playerId);return s.injury>0||s.suspension>0})}

function ensureSeasonAnalytics(){
 state.analytics=state.analytics&&typeof state.analytics==='object'?state.analytics:{};
 state.analytics.initialOvr=Math.max(0,Number(state.analytics.initialOvr)||0);
 state.analytics.injuries=Math.max(0,Number(state.analytics.injuries)||0);
 state.analytics.redCards=Math.max(0,Number(state.analytics.redCards)||0);
 state.analytics.eventLog=Array.isArray(state.analytics.eventLog)?state.analytics.eventLog:[];
 state.analytics.biggestResult=state.analytics.biggestResult&&typeof state.analytics.biggestResult==='object'?state.analytics.biggestResult:null;
 return state.analytics;
}
function resetSeasonAnalytics(){state.analytics={initialOvr:Math.round(teamPowerBase()*10)/10,injuries:0,redCards:0,eventLog:[],biggestResult:null};return state.analytics}
function analyticsStatusSnapshot(){const map={};Object.entries(state.statuses||{}).forEach(([id,status])=>{map[String(id)]=Boolean(status&&(Number(status.injury)>0||status.seasonOut))});return map}
function analyticsSnapshot(){return{ovr:Math.round(teamPowerBase()*10)/10,pts:Number(userStanding()?.pts)||0,statuses:analyticsStatusSnapshot()}}
function countNewInjuryEpisodes(before={}){const after=analyticsStatusSnapshot();return Object.keys(after).filter(id=>after[id]&&!before[id]).length}
function seasonEventImpact(before,after,result='',effect=''){
 let score=((Number(after?.ovr)||0)-(Number(before?.ovr)||0))*2+((Number(after?.pts)||0)-(Number(before?.pts)||0))*2;
 const text=`${effect} ${result}`.toLowerCase();
 const rules=[
  [/pollo da 1|1 ovr/,-22],[/punt[ei].*azzerat|0 punti/,-18],[/perdi sicuramente|sconfitta obbligatoria/,-14],[/fuori fino a fine stagione|perdi il tuo miglior/,-12],[/infortun/,-5],[/espuls|cartellino rosso/,-4],[/-\s?\d+\s?ovr/,-5],[/-\s?\d+\s?intesa/,-3],
  [/vittoria assicurata|vittoria per 6-0|segna sempre un gol/,+14],[/top player|maradona|120 ovr/,+13],[/raddoppia la forza|\+20 ovr|\+40 ovr/,+11],[/\+10 ovr/,+8],[/\+\d+ ovr/,+5],[/intesa.*raddopp|\+10 intesa/,+5],[/scelta in più|cambio in più/,+4]
 ];
 rules.forEach(([pattern,value])=>{if(pattern.test(text))score+=value});
 return Math.round(score*10)/10;
}
function recordSeasonEvent({kind='auto',title='',choice='',effect='',result='',automatic=false}={},before=analyticsSnapshot()){
 const analytics=ensureSeasonAnalytics(),after=analyticsSnapshot(),injuries=countNewInjuryEpisodes(before.statuses||{});
 analytics.injuries+=injuries;
 analytics.eventLog.push({matchday:Math.min(seasonLength(),(Number(state.matchday)||0)+1),kind:String(kind),title:String(title||'Evento'),choice:String(choice||''),effect:String(effect||''),result:String(result||''),automatic:Boolean(automatic),score:seasonEventImpact(before,after,result,effect),ovrDelta:Math.round((after.ovr-before.ovr)*10)/10,pointsDelta:Math.round((after.pts-before.pts)*10)/10,injuries,createdAt:new Date().toISOString()});
 if(analytics.eventLog.length>500)analytics.eventLog=analytics.eventLog.slice(-500);
}
function updateSeasonMatchAnalytics(result,beforeStatuses={}){
 const analytics=ensureSeasonAnalytics();analytics.injuries+=countNewInjuryEpisodes(beforeStatuses);if(result?.ownRedCard)analytics.redCards++;
 if(!result)return;
 const candidate={matchday:Number(result.matchday)||state.matchday,opponent:String(result.opponent||''),gf:Number(result.gf)||0,ga:Number(result.ga)||0,home:Boolean(result.home)};
 const current=analytics.biggestResult,margin=Math.abs(candidate.gf-candidate.ga),total=candidate.gf+candidate.ga,currentMargin=current?Math.abs(Number(current.gf)-Number(current.ga)):-1,currentTotal=current?(Number(current.gf)||0)+(Number(current.ga)||0):-1;
 if(!current||margin>currentMargin||(margin===currentMargin&&total>currentTotal))analytics.biggestResult=candidate;
}
function seasonBestPlayer(){
 const ids=new Set(currentUserPlayerIds().map(String));Object.entries(state.stats?.playerTeams||{}).forEach(([id,teamId])=>{if(String(teamId)===USER_ID)ids.add(String(id))});
 let best=null;ids.forEach(id=>{const player=statPlayerInfo(id),goals=Number(state.stats?.goals?.[id])||0,assists=Number(state.stats?.assists?.[id])||0,mvps=Number(state.stats?.mvpVotes?.[id])||0,clean=Number(state.stats?.cleanSheets?.[id])||0,apps=Number(state.stats?.appearances?.[id])||0,score=goals*5+assists*3+mvps*4+clean*2+apps*.08+(Number(player.ovr)||0)*.03;const row={id,player,goals,assists,mvps,clean,apps,score};if(!best||row.score>best.score)best=row});
 if(!best){const entry=[...rosterPlayers()].sort((a,b)=>(Number(b.player?.ovr)||0)-(Number(a.player?.ovr)||0))[0];if(entry)best={id:String(entry.playerId),player:entry.player,goals:0,assists:0,mvps:0,clean:0,apps:0,score:Number(entry.player.ovr)||0}}
 return best;
}
function biggestSeasonResult(){
 const stored=ensureSeasonAnalytics().biggestResult;if(stored)return stored;let best=null;(state.history||[]).forEach(match=>{const candidate={matchday:Number(match.matchday)||0,opponent:String(match.opponent||''),gf:Number(match.gf)||0,ga:Number(match.ga)||0,home:Boolean(match.home)},margin=Math.abs(candidate.gf-candidate.ga),total=candidate.gf+candidate.ga,currentMargin=best?Math.abs(best.gf-best.ga):-1,currentTotal=best?best.gf+best.ga:-1;if(!best||margin>currentMargin||(margin===currentMargin&&total>currentTotal))best=candidate});return best;
}
function decisiveSeasonEvent(){const logs=ensureSeasonAnalytics().eventLog||[];return [...logs].sort((a,b)=>Math.abs(Number(b.score)||0)-Math.abs(Number(a.score)||0)||Number(b.matchday)-Number(a.matchday))[0]||null}
function worstSeasonDecision(){const logs=(ensureSeasonAnalytics().eventLog||[]).filter(item=>item.kind==='decision'&&!item.automatic);return [...logs].sort((a,b)=>(Number(a.score)||0)-(Number(b.score)||0)||Number(a.matchday)-Number(b.matchday))[0]||null}
function seasonGrade(rank,eliminated=false){
 const standing=userStanding()||{p:0,w:0,d:0,gf:0,ga:0},played=Math.max(1,Number(standing.p)||Number(state.history?.length)||1),rankScore=rank>0?((20-rank)/19)*55:0,resultScore=((Number(standing.w)||0)*3+(Number(standing.d)||0))/(played*3)*20,gdPerGame=((Number(standing.gf)||0)-(Number(standing.ga)||0))/played,goalScore=((clamp(gdPerGame,-1,1)+1)/2)*15,analytics=ensureSeasonAnalytics(),initial=Number(analytics.initialOvr)||teamPowerBase(),delta=teamPowerBase()-initial,ovrScore=((clamp(delta,-10,10)+10)/20)*10;
 let score=Math.round(rankScore+resultScore+goalScore+ovrScore);if(rank===1)score=Math.max(92,score);if(eliminated)score=Math.min(24,score);score=clamp(score,0,100);
 const table=[[92,'S+','Stagione leggendaria'],[85,'S','Dominio assoluto'],[75,'A','Stagione eccellente'],[65,'B','Stagione molto buona'],[55,'C','Stagione positiva'],[45,'D','Stagione complicata'],[35,'E','Stagione deludente'],[0,'F','Stagione da dimenticare']];const found=table.find(([min])=>score>=min)||table[table.length-1];return{score,label:found[1],description:found[2]}
}
function seasonEventChoices(){
 return (ensureSeasonAnalytics().eventLog||[]).filter(item=>item&&item.kind==='decision'&&String(item.choice||'').trim()).map((item,index)=>({index:index+1,matchday:Math.max(1,Number(item.matchday)||1),title:String(item.title||'Evento'),choice:String(item.choice||'Scelta non disponibile'),effect:String(item.effect||''),result:String(item.result||''),automatic:Boolean(item.automatic),score:Number(item.score)||0,createdAt:String(item.createdAt||'')}));
}
function renderSeasonEventChoices(summary){
 const choices=Array.isArray(summary.eventChoices)?summary.eventChoices:[];
 const rows=choices.map((item,index)=>{const score=Number(item.score)||0,impactClass=score>0?'positive':score<0?'negative':'neutral',effect=String(item.effect||'').trim(),result=String(item.result||'').trim();return `<article class="season-event-history-row ${impactClass}"><div class="season-event-history-day"><small>G</small><b>${Math.max(1,Number(item.matchday)||1)}</b></div><div class="season-event-history-copy"><div class="season-event-history-head"><b>${index+1}. ${esc(item.title||'Evento')}</b>${item.automatic?'<span class="season-event-history-badge">Scelta automatica</span>':'<span class="season-event-history-badge">Tua scelta</span>'}</div><span class="season-event-history-choice">→ ${esc(item.choice||'Scelta non disponibile')}</span>${effect?`<span class="season-event-history-detail"><strong>Effetto previsto:</strong> ${esc(effect)}</span>`:''}${result?`<span class="season-event-history-detail"><strong>Conseguenza applicata:</strong> ${esc(result)}</span>`:''}</div></article>`}).join('');
 return `<details class="season-event-history" open><summary><span class="season-event-history-title"><span>🧭</span><b>Scelte prese durante gli eventi</b><em>${choices.length} ${choices.length===1?'scelta registrata':'scelte registrate'}</em></span></summary>${choices.length?`<div class="season-event-history-list">${rows}</div>`:'<p class="season-event-history-empty">Nessuna scelta evento è stata registrata in questa stagione.</p>'}</details>`;
}
function buildSeasonSummary(rank,eliminated=false){
 const standing=userStanding()||{pts:0,w:0,d:0,l:0,gf:0,ga:0},analytics=ensureSeasonAnalytics(),best=seasonBestPlayer(),top=teamTopScorer(),topPlayer=top?statPlayerInfo(top[0]):null,decisive=decisiveSeasonEvent(),worst=worstSeasonDecision(),biggest=biggestSeasonResult(),initial=Number(analytics.initialOvr)||teamPowerBase(),final=Math.round(teamPowerBase()*10)/10,grade=seasonGrade(rank,eliminated),mode=String(SAVE_BASE).includes('real')?'Fantacampionato del Ca***':'Campionato del Ca***';
 return{teamName:state.teamName,coachName:state.coachName,mode,gameMode:chaosEnabled()?'Caos':'Normale',rank,rankLabel:eliminated?'Eliminato':`${rank}°`,played:Number(standing.p)||state.matchday,points:Number(standing.pts)||0,record:`${standing.w}-${standing.d}-${standing.l}`,bestPlayer:best?best.player.name:'Nessun dato',bestPlayerDetail:best?`${best.goals} gol · ${best.assists} assist · ${best.mvps} MVP`:'Statistiche non disponibili',topScorer:topPlayer?topPlayer.name:'Nessun marcatore',topScorerGoals:top?Number(top[1])||0:0,decisive,worst,eventChoices:seasonEventChoices(),initialOvr:Math.round(initial*10)/10,finalOvr:final,injuries:Number(analytics.injuries)||0,redCards:Number(analytics.redCards)||0,biggest,grade,gf:Number(standing.gf)||0,ga:Number(standing.ga)||0,cupResult:parallelCupOutcomeLabel(),honour:seasonHonourLabel(rank,eliminated)};
}
function seasonResultLabel(result){if(!result)return'Nessun risultato disponibile';const outcome=result.gf>result.ga?'Vittoria':result.gf<result.ga?'Sconfitta':'Pareggio',gf=Number.isFinite(Number(result.displayGf))?Number(result.displayGf):result.gf,ga=Number.isFinite(Number(result.displayGa))?Number(result.displayGa):result.ga;return `${gf}–${ga}${result.penalties?' d.c.r.':''} vs ${result.opponent} · ${outcome}`}
function renderSeasonSummaryCard(summary){
 const decisive=summary.decisive,worst=summary.worst,eventClass=decisive?(Number(decisive.score)>=0?'positive':'negative'):'';
 return `<section class="season-report-card" id="seasonSummaryCard"><div class="season-report-head"><div><div class="season-report-kicker">Riepilogo completo · ${esc(summary.mode)} · ${esc(summary.gameMode)}</div><h2>${esc(summary.teamName)}</h2><p>${esc(summary.coachName||'Allenatore senza nome')} · ${summary.played} giornate · ${summary.points} punti</p></div><div class="season-grade"><span>Voto</span><b>${esc(summary.grade.label)}</b></div></div><div class="season-report-grid"><div class="season-report-item"><span>Posizione finale</span><b>${esc(summary.rankLabel)}</b><small>${summary.record} · ${summary.gf} gol fatti, ${summary.ga} subiti</small></div><div class="season-report-item ${summary.honour!=='Nessun trofeo'?'positive':''}"><span>Trofei e coppa</span><b>${esc(summary.honour)}</b><small>Coppa parallela: ${esc(summary.cupResult)}</small></div><div class="season-report-item"><span>Miglior giocatore</span><b>${esc(summary.bestPlayer)}</b><small>${esc(summary.bestPlayerDetail)}</small></div><div class="season-report-item"><span>Capocannoniere</span><b>${esc(summary.topScorer)}</b><small>${summary.topScorerGoals} ${summary.topScorerGoals===1?'gol':'gol'} con la tua squadra</small></div><div class="season-report-item wide ${eventClass}"><span>Evento più decisivo</span><b>${decisive?esc(decisive.title):'Nessun evento registrato'}</b><small>${decisive?`${decisive.choice?`${esc(decisive.choice)} · `:''}Giornata ${decisive.matchday} · impatto ${Number(decisive.score)>=0?'+':''}${Number(decisive.score)||0}`:'Il tracciamento partirà dal prossimo evento della stagione.'}</small></div><div class="season-report-item ${worst&&Number(worst.score)<0?'negative':''}"><span>Peggior decisione</span><b>${worst?esc(worst.choice||worst.title):'Nessuna decisione negativa'}</b><small>${worst?`${esc(worst.title)} · Giornata ${worst.matchday}`:'Nessuna scelta manuale registrata.'}</small></div><div class="season-report-item"><span>OVR iniziale → finale</span><b>${summary.initialOvr.toFixed(1)} → ${summary.finalOvr.toFixed(1)}</b><small>${summary.finalOvr-summary.initialOvr>=0?'+':''}${(summary.finalOvr-summary.initialOvr).toFixed(1)} OVR nel corso della stagione</small></div><div class="season-report-item"><span>Infortuni ed espulsioni</span><b>${summary.injuries} · ${summary.redCards}</b><small>Infortuni subiti · cartellini rossi ricevuti</small></div><div class="season-report-item wide"><span>Risultato più largo</span><b>${esc(seasonResultLabel(summary.biggest))}</b><small>${summary.biggest?`Giornata ${summary.biggest.matchday} · ${summary.biggest.home?'in casa':'in trasferta'}`:'Nessuna partita disputata.'}</small></div><div class="season-report-item positive"><span>Valutazione stagione</span><b>${esc(summary.grade.description)}</b><small>${summary.grade.score}/100 · voto ${esc(summary.grade.label)}</small></div></div>${renderSeasonEventChoices(summary)}<div class="season-report-actions"><button id="shareSeasonCard" class="btn gold" type="button">📤 Condividi scheda</button><button id="downloadSeasonCard" class="btn" type="button">🖼️ Scarica PNG</button></div></section>`;
}
function seasonSummaryText(summary){const choices=(Array.isArray(summary.eventChoices)?summary.eventChoices:[]).map((item,index)=>`${index+1}. G${item.matchday} · ${item.title}: ${item.choice}${item.automatic?' (automatica)':''}${item.result?` → ${item.result}`:''}`);return [`⚽ ${summary.teamName}`,`${summary.mode} · ${summary.gameMode}`,`Posizione: ${summary.rankLabel} · ${summary.points} punti`,`Trofei: ${summary.honour} · Coppa: ${summary.cupResult}`,`Voto stagione: ${summary.grade.label} (${summary.grade.score}/100)`,`Miglior giocatore: ${summary.bestPlayer}`,`Capocannoniere: ${summary.topScorer} (${summary.topScorerGoals} gol)`,`OVR: ${summary.initialOvr.toFixed(1)} → ${summary.finalOvr.toFixed(1)}`,`Risultato più largo: ${seasonResultLabel(summary.biggest)}`,choices.length?'SCELTE EVENTI:':'SCELTE EVENTI: nessuna',...choices,'#Fantaballa'].join('\n')}
function roundedCanvasRect(ctx,x,y,w,h,r){const radius=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+radius,y);ctx.arcTo(x+w,y,x+w,y+h,radius);ctx.arcTo(x+w,y+h,x,y+h,radius);ctx.arcTo(x,y+h,x,y,radius);ctx.arcTo(x,y,x+w,y,radius);ctx.closePath()}
function canvasWrappedText(ctx,text,x,y,maxWidth,lineHeight,maxLines=2){const words=String(text||'').split(/\s+/),lines=[];let line='';for(const word of words){const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;if(lines.length>=maxLines-1)break}else line=test}if(line&&lines.length<maxLines)lines.push(line);lines.forEach((value,index)=>ctx.fillText(value,x,y+index*lineHeight));return lines.length}
function createSeasonSummaryCanvas(summary){
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=675;const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,1200,675);gradient.addColorStop(0,'#10243a');gradient.addColorStop(.58,'#214f77');gradient.addColorStop(1,'#5b347c');ctx.fillStyle=gradient;ctx.fillRect(0,0,1200,675);ctx.fillStyle='rgba(255,233,108,.10)';ctx.beginPath();ctx.arc(1110,60,230,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#f7d85d';ctx.font='900 24px system-ui,sans-serif';ctx.fillText('FANTABALLA · RIEPILOGO STAGIONE',62,62);ctx.fillStyle='#ffffff';ctx.font='1000 50px system-ui,sans-serif';ctx.fillText(String(summary.teamName).slice(0,30),62,125);ctx.fillStyle='#e6f0f8';ctx.font='800 23px system-ui,sans-serif';ctx.fillText(`${summary.mode} · ${summary.gameMode} · ${summary.points} punti`,62,162);
 roundedCanvasRect(ctx,974,46,164,146,28);ctx.fillStyle='#fff8d5';ctx.fill();ctx.strokeStyle='#ffe96c';ctx.lineWidth=5;ctx.stroke();ctx.fillStyle='#10243a';ctx.textAlign='center';ctx.font='900 18px system-ui,sans-serif';ctx.fillText('VOTO',1056,86);ctx.font='1000 70px system-ui,sans-serif';ctx.fillText(summary.grade.label,1056,158);ctx.textAlign='left';
 const cards=[['POSIZIONE',summary.rankLabel,`${summary.record} · ${summary.gf}-${summary.ga} gol`],['MIGLIOR GIOCATORE',summary.bestPlayer,summary.bestPlayerDetail],['CAPOCANNONIERE',summary.topScorer,`${summary.topScorerGoals} gol`],['OVR',`${summary.initialOvr.toFixed(1)} → ${summary.finalOvr.toFixed(1)}`,`${summary.finalOvr-summary.initialOvr>=0?'+':''}${(summary.finalOvr-summary.initialOvr).toFixed(1)} in stagione`],['INFORTUNI / ROSSI',`${summary.injuries} / ${summary.redCards}`,'Episodi della tua squadra'],['RISULTATO PIÙ LARGO',seasonResultLabel(summary.biggest),summary.biggest?`Giornata ${summary.biggest.matchday}`:'—']];
 cards.forEach((card,index)=>{const col=index%3,row=Math.floor(index/3),x=62+col*370,y=222+row*164;roundedCanvasRect(ctx,x,y,340,136,22);ctx.fillStyle='rgba(255,255,255,.11)';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.22)';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#ffe96c';ctx.font='900 15px system-ui,sans-serif';ctx.fillText(card[0],x+20,y+29);ctx.fillStyle='#fff';ctx.font='1000 26px system-ui,sans-serif';canvasWrappedText(ctx,card[1],x+20,y+66,300,29,2);ctx.fillStyle='#dce8f0';ctx.font='800 16px system-ui,sans-serif';canvasWrappedText(ctx,card[2],x+20,y+117,300,20,1)});
 ctx.fillStyle='#ffe96c';ctx.font='900 20px system-ui,sans-serif';ctx.fillText(`${summary.grade.description} · ${summary.grade.score}/100`,62,628);ctx.textAlign='right';ctx.fillStyle='#fff';ctx.font='900 18px system-ui,sans-serif';ctx.fillText('fantaballa.it',1138,628);ctx.textAlign='left';return canvas;
}
function downloadSeasonSummary(summary){const canvas=createSeasonSummaryCanvas(summary),link=document.createElement('a');link.download=`fantaballa-riepilogo-${String(summary.teamName||'stagione').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'stagione'}.png`;link.href=canvas.toDataURL('image/png');link.click();toast('Scheda riepilogo scaricata.')}
async function shareSeasonSummary(summary){
 const canvas=createSeasonSummaryCanvas(summary),text=seasonSummaryText(summary);canvas.toBlob(async blob=>{try{const file=blob?new File([blob],'fantaballa-riepilogo.png',{type:'image/png'}):null;if(file&&navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:'La mia stagione su Fantaballa',text,files:[file]});return}if(navigator.share){await navigator.share({title:'La mia stagione su Fantaballa',text});return}await navigator.clipboard.writeText(text);toast('Riepilogo copiato negli appunti.')}catch(error){if(error?.name!=='AbortError'){try{await navigator.clipboard.writeText(text);toast('Riepilogo copiato negli appunti.')}catch{downloadSeasonSummary(summary)}}}},'image/png');
}

const AUTO_EVENTS=[
 {title:'Problema muscolare',text:'Un titolare casuale si infortuna.',apply(){const r=pick(getStarterEntries());if(r){setOwnPlayerInjury(r,2);return `${r.player.name} è infortunato per 2 giornate.${state.seasonRules.futureInjuryZeroPoints?' Punti azzerati dalla regola del futuro.':''}`}return 'Nessun titolare disponibile.'}},
 {title:'Contusione',text:'Un giocatore casuale della rosa non è al meglio.',apply(){const r=pick(rosterPlayers());if(r){setOwnPlayerInjury(r,1);return `${r.player.name} è infortunato per 1 giornata.${state.seasonRules.futureInjuryZeroPoints?' Punti azzerati dalla regola del futuro.':''}`}return 'Nessun giocatore disponibile.'}},
 {title:'Settimana perfetta',text:'La squadra si allena alla grande.',apply(){state.activeEffects.push({type:'teamChem',value:5,rounds:1});return '+5 Intesa per la prossima partita.'}},
 {title:'Sostegno degli abbonati',text:'Gli abbonati trascinano il gruppo.',apply(){state.activeEffects.push({type:'subscriberChem',value:3,rounds:2});return '+3 Intesa agli abbonati per 2 giornate.'}},
 {title:'Arbitraggio severo',text:'La prossima gara si preannuncia nervosa.',apply(){state.activeEffects.push({type:'cards',value:1,rounds:1});return 'Probabilità di squalifica aumentata per la prossima partita.'}}
].filter(event=>!EXCLUDED_AUTO_EVENT_TITLES.has(String(event?.title||'')));
const DECISIONS=[
 {id:'nuovo-sponsor',title:'Arriva un nuovo sponsor!',text:'Scegli quello che preferisci.',choices:[
  {label:'Padelle Ballarini',effect:'Che prodotto di qualità! Le uova non si attaccano alla padella: ogni bonus OVR positivo ottenuto dagli eventi riceve +5 OVR aggiuntivi',apply(){return activateBallariniSponsor()}},
  {label:'Football Manager',effect:'Il miglior manageriale del mondo! Ottieni un Tattico che schiera automaticamente la formazione migliore e un fisioterapista che dimezza il rischio di infortunio',apply(){return activateFootballManagerSponsor()}}
 ]},

 {id:'quest-like-a-bomber',questEvent:true,title:'Un misterioso bomber ti si avvicina',text:'Sostiene che la tua squadra debba dimostrare di saper segnare come una vera macchina da gol.',available(){return questCanStart(5)},choices:[
  {label:'Accetta: Like a bomber',effect:'Segna almeno 10 gol nelle prossime 5 partite. Successo: +8 OVR al miglior attaccante fino a fine stagione. Fallimento: il miglior attaccante passa a 50 OVR fino a fine stagione.',apply(){return acceptLikeBomberQuest()}},
  {label:'Rifiuta',effect:'Nessun effetto.',apply(){return'Rifiuti la sfida. Nessun effetto.'}}
 ]},
 {id:'quest-fair-play-finanziario',questEvent:true,title:'Un funzionario con una valigetta sostiene che la tua squadra abbia dei debiti',text:'Ti propone un controllo sportivo immediato sui risultati delle prossime giornate.',available(){return questCanStart(4)},choices:[
  {label:'Accetta: Fair play finanziario',effect:'Conquista almeno 9 punti nelle prossime 4 giornate. Fallimento: -6 punti.',apply(){return acceptFairPlayQuest()}},
  {label:'Patteggia',effect:'Perdi subito 1 punto, ma la missione non parte.',apply(){return rejectFairPlayQuest()}}
 ]},
 {id:'quest-la-curva',questEvent:true,title:'I tifosi pretendono una dimostrazione di fedeltà',text:'La curva vuole che la squadra non perda contro Juventus, Milan e Inter.',available(){return questCurveAvailable()},choices:[
  {label:'Accetta: La curva',effect:'Non perdere contro Juventus, Milan e Inter. Successo: +5 OVR finché non perdi. Fallimento: -5 OVR fino a fine stagione.',apply(){return acceptCurvaQuest()}},
  {label:'Rifiuta',effect:'Nessun effetto.',apply(){return'Rifiuti la richiesta della curva. Nessun effetto.'}}
 ]},
 {id:'quest-ammazza-grandi',questEvent:true,title:'Un vecchio allenatore ti sfida',text:'Vuole vedere se sei capace di abbattere una delle squadre che guidano il campionato.',available(){return questCanStart(6)},choices:[
  {label:'Accetta: Ammazza grandi',effect:'Nelle prossime 6 giornate batti almeno una squadra che si trova nelle prime 3. Successo: +5 OVR agli under 80. Fallimento: -6 OVR al miglior giocatore.',apply(){return acceptAmmazzaGrandiQuest()}},
  {label:'Rifiuta',effect:'Nessun effetto.',apply(){return'Rifiuti la sfida del vecchio allenatore. Nessun effetto.'}}
 ]},
 {id:'quest-milanlab',questEvent:true,title:'Un medico rossonero sostiene di poter rendere la tua squadra indistruttibile',text:'Il suo laboratorio vuole sottoporre la rosa a una prova di resistenza.',available(){return questCanStart(5)},choices:[
  {label:'Accetta: MilanLab',effect:'Completa 5 giornate senza nuovi infortuni. Successo: immunità per 5 giornate. Fallimento: il primo infortunio dura il doppio.',apply(){return acceptMilanLabQuest()}},
  {label:'Rifiuta',effect:'Nessun effetto.',apply(){return'Non affidi la squadra al medico rossonero. Nessun effetto.'}}
 ]},
 {id:'quest-calcio-champagne',questEvent:true,title:'Una società sconosciuta vuole investire nella tua squadra, ma pretende spettacolo',text:'Lo sponsor vuole almeno due gol in ciascuna delle prossime tre partite.',available(){return questCanStart(3)},choices:[
  {label:'Accetta: Calcio champagne',effect:'Segna almeno 2 gol in ognuna delle prossime 3 partite. Successo: +1 punto per vittoria per 6 giornate. Fallimento: i pareggi diventano sconfitte per 6 giornate.',apply(){return acceptChampagneQuest()}},
  {label:'Rifiuta',effect:'Nessun effetto.',apply(){return'Rifiuti l’investimento. Nessun effetto.'}}
 ]},
 {id:'pulmino-bordello',title:'Il pulmino della squadra finisce in un bordello',text:"L’autista ha seguito il navigatore sbagliato e la squadra si ritrova in uno strip club.",available(){return Number(state.matchday)<19},choices:[
  {label:'Restate per lo spettacolo',effect:'+5 Intesa alla squadra per 2 giornate, ma -10 OVR a un giocatore casuale nella prossima partita',apply(){pushEffect('teamChem',5,2);return applyPlayerEffect('playerOvr',-10,1)}},
  {label:'Prendete subito un taxi',effect:'+10 OVR nella prossima partita, ma 1 scelta in meno al draft di metà stagione',apply(){pushEffect('teamOvr',10,1);return changeMidseasonPicks(-1)}}
 ]},
 {id:'figlio-presidente',title:'Il figlio del presidente contesta la formazione',text:'Il figlio del presidente pretende di decidere la formazione.',available(){return Number(state.matchday)<19},choices:[
  {label:'Segui i consigli del figlio',effect:'Perdi sicuramente la prossima partita, ma ricevi 1 scelta in più al draft di metà stagione',apply(){pushEffect('forcedLoss',1,1);return changeMidseasonPicks(1)}},
  {label:'Difendi le tue idee tattiche',effect:'+6 OVR nella prossima partita, ma 1 scelta in meno al draft di metà stagione',apply(){pushEffect('teamOvr',6,1);return changeMidseasonPicks(-1)}}
 ]},
 {id:'gol-tre-due',title:'La tua squadra ha appena segnato il gol del 3-2',text:'Cosa decidi di fare?',choices:[
  {label:'Rimani pacato in panca, applaudendo',effect:'+5 OVR a un giocatore casuale per la prossima partita',apply(){return applyPlayerEffect('playerOvr',5,1)}},
  {label:'Vai sotto la curva avversaria',effect:'+5 OVR a tutta la squadra, ma un giocatore casuale si infortuna',apply(){pushEffect('teamOvr',5,1);const entry=randomOwnEntry();if(!entry)return 'Nessun giocatore disponibile.';injureOwnPlayers([entry],1);return `${entry.player.name} si infortuna per 1 giornata.`}}
 ]},
 {id:'whatsapp-pubblicato',title:'Il gruppo WhatsApp della squadra viene pubblicato online',text:'Sono usciti gli screen delle vostre chat. E ora?',available(){return Number(state.matchday)<19},choices:[
  {label:'Dici che sei stato hackerato',effect:'+10 Intesa agli abbonati nella prossima partita, ma il draft di metà stagione viene fatto casualmente dal bot',apply(){pushEffect('subscriberChem',10,1);state.seasonRules.botMidseason=true;return 'Il bot controllerà casualmente tutte le entrate e le uscite del draft di metà stagione.'}},
  {label:'Chiedi pubblicamente scusa dicendo che hai un sacco di amici di colore',effect:'-5 Intesa a tutta la squadra per 2 giornate',apply(){pushEffect('teamChem',-5,2);return '-5 Intesa alla squadra per 2 giornate.'}}
 ]},
 {id:'rissa-mascotte',title:'Scoppia una rissa tra te e la mascotte della squadra',text:"La mascotte sostiene d’allenare meglio di te.",available(){return Number(state.matchday)<19},choices:[
  {label:'Allena lui la squadra',effect:'Non avrai più il controllo delle decisioni né del draft di metà stagione',apply(){state.seasonRules.autoDecisions=true;state.seasonRules.autoMidseason=true;state.seasonRules.botMidseason=true;return 'Da ora tutte le decisioni e il draft di metà stagione saranno gestiti casualmente dalla mascotte.'}},
  {label:'Lo fai licenziare',effect:'La mascotte appare come calciatore da 99 OVR in una squadra casuale',apply(){return addMascotToRandomTeam()}}
 ]},
 {id:'cuggino-influencer',title:'Il presidente ingaggia suo cuggino influencer',text:'Non ha mai giocato a calcio, ma ha due milioni di follower e una videocamera sempre accesa.',choices:[
  {label:'Lo mandi a fare contenuti con gli abbonati',effect:'+10 Intesa a tutti gli abbonati per 1 giornata',apply(){pushEffect('subscriberChem',10,1);return '+10 Intesa agli abbonati nella prossima partita.'}},
  {label:'Lo fai partecipare all’allenamento',effect:'+5 OVR a tutta la squadra nella prossima partita, ma tutti gli abbonati sono infortunati',apply(){pushEffect('teamOvr',5,1);const entries=rosterPlayers().filter(entry=>isSubscriber(entry.player));const names=injureOwnPlayers(entries,1);return names.length?`Abbonati infortunati per 1 giornata: ${names.join(', ')}.`:'Non ci sono abbonati in rosa.'}}
 ]},
 {id:'drone-avversario',title:'Un drone avversario spia l’allenamento',text:'Il drone è fermo sopra il campo e sta trasmettendo in diretta tutte le tattiche.',choices:[
  {label:'Gli mostri deliberatamente una tattica falsa',effect:'OVR del prossimo avversario ridotto di 10 punti',apply(){pushEffect('opponentOvr',-10,1);const opponent=nextOpponentTeam();return opponent?`${opponent.name} riceve -10 OVR nella prossima partita.`:'Il prossimo avversario riceve -10 OVR.'}},
  {label:'Lo abbatti con un pallone',effect:'2 giocatori casuali del prossimo avversario saranno infortunati',apply(){return injureNextOpponentPlayers(2)}}
 ]},
 {id:'aggiornamento-var',title:'Il VAR deve installare un aggiornamento',text:'Il sistema operativo segnala: “Tempo rimanente: 4 ore e 37 minuti”.',choices:[
  {label:'Giochi col VAR non aggiornato',effect:'Nella prossima partita il risultato è totalmente casuale e non dipende dall’OVR.',apply(){pushEffect('varRandomResult',1,1,{source:'VAR non aggiornato'});return 'La prossima partita avrà un risultato completamente casuale, indipendente dall’OVR delle due squadre.'}},
  {label:'Spegni il VAR',effect:'Nella prossima partita aumenta il rischio di espulsioni a sfavore.',apply(){pushEffect('refChaos',1,1,{opponentRedChance:0,ownRedChance:.70,source:'VAR spento'});return 'Nella prossima partita aumenta fortemente il rischio di un’espulsione per la tua squadra.'}}
 ]},
 {id:'crescita-personale',title:'Il capitano apre un corso di crescita personale',text:'Per tre ore ripete frasi come “il fuorigioco esiste solo nella tua mente”.',choices:[
  {label:'Obblighi tutti a partecipare',effect:'×2 Intesa per 1 giornata',apply(){pushEffect('teamChemMultiplier',2,1);return 'Tutti i bonus Intesa positivi dei titolari vengono raddoppiati nella prossima partita.'}},
  {label:'Interrompi il seminario e fate allenamento',effect:'+6 OVR, ma Intesa azzerata nella prossima partita',apply(){pushEffect('teamOvr',6,1);pushEffect('teamChemZero',1,1);return '+6 OVR alla squadra e Intesa azzerata nella prossima partita.'}}
 ]},

 {id:'personaggio-misterioso-tearless-italia-2006',userOnly:true,title:'Un misterioso personaggio ti si avvicina',text:'«Ehi, sai chi sono?»',available(){const chain=mysteryCharacterChain();return Number(state.matchday)<seasonLength()-2&&!chain.active&&!chain.completed},choices:[
  {label:'Ah sì, sei un famoso YouTuber!',effect:'Tearless (51 OVR) arriva in squadra al posto di un giocatore casuale.',apply(){return recruitTearless()}},
  {label:'Non sei un campione del mondo?',effect:'Uno dei campioni del mondo 2006 arriva in squadra al posto di un giocatore casuale.',apply(){return recruitWorldChampion()}}
 ]},
 {id:'cassaaa-pinguino',userOnly:true,title:'Capitolo 1: Cassaaa',text:'Arriva un misterioso pinguino e ti propone una scommessa decisamente sospetta.',available(){return Number(state.matchday)<seasonLength()-3&&!penguinChain().active&&!penguinChain().completed},choices:[
  {label:'1+over 5,3 x Steell cage',effect:'La prossima partita finisce 3-2 per te, ma devi iscriverti al suo canale. In seguito si attiverà il Capitolo 2.',apply(){return acceptCassaaaBet()}},
  {label:'Scrolla',effect:'Non lo ascolti e ti concentri sulla prossima partita',apply(){return scrollPenguin()}}
 ]},
 {id:'mentalista',title:'Arriva un mentalista nello spogliatoio',text:'Dice di poter far credere agli avversari che il pallone sia invisibile.',available(){return Number(state.matchday)<seasonLength()-6},choices:[
  {label:'Gli permetti di ipnotizzare l’attaccante',effect:'75%: +8 OVR nella prossima partita. 25%: il mentalista sbaglia e lo trasforma in un pollo da 1 OVR',apply(){return hypnotizeRandomAttacker()}},
  {label:'Gli chiedi di confondere l’arbitro',effect:'Possibile cartellino rosso avversario, ma rischio di espulsione per un tuo giocatore',apply(){pushEffect('refChaos',1,1,{opponentRedChance:.45,ownRedChance:.30,source:'Mentalista'});return 'Nella prossima partita: 45% rosso avversario e 30% rosso per la tua squadra.'}}
 ]},
 {id:'mentalista-pollaio',chainOnly:true,title:'Il richiamo del pollaio',text:'Il pollo sembra ricordare vagamente come si gioca a calcio.',choices:[
  {label:'Continua ad allenarlo',effect:'Dopo ogni giornata guadagna casualmente da 1 a 5 OVR',apply(){return trainChicken()}},
  {label:'Portalo dal veterinario',effect:'Torna subito al suo OVR originale, ma resta fuori per 5 partite',apply(){return veterinarianChicken()}},
  {label:'Accetta la sua nuova natura',effect:'Resta a 1 OVR, ma ogni suo gol vale doppio',apply(){return acceptChickenNature()}}
 ]},
 {id:'grigliata-ultras',title:"L’allenamento viene invaso da una grigliata degli ultras",text:'Fumo, salsicce e cori impediscono qualsiasi esercitazione tattica.',choices:[
  {label:'Partecipate alla grigliata',effect:'×2 Intesa nella prossima partita',apply(){pushEffect('teamChemMultiplier',2,1);return 'Tutti i bonus Intesa positivi dei titolari vengono raddoppiati nella prossima partita.'}},
  {label:'Continuate ad allenarvi nel fumo',effect:'+7 OVR, ma un giocatore casuale subisce una contusione di 1 giornata',apply(){pushEffect('teamOvr',7,1);const entry=randomOwnEntry();if(!entry)return 'Nessun giocatore disponibile.';injureOwnPlayers([entry],1);return `${entry.player.name} subisce una contusione di 1 giornata.`}}
 ]},
 {id:'rapito-alieni',title:'Un giocatore sostiene di essere stato rapito dagli alieni',text:'È tornato all’allenamento con una pettinatura diversa e nuove convinzioni tattiche.',available(){return Number(state.matchday)<19},createContext(){const entry=randomOwnEntry();return entry?{playerId:String(entry.playerId),playerName:entry.player.name}:{}},describe(context){return context?.playerName?`${this.text} Il giocatore coinvolto è ${context.playerName}.`:this.text},choices:[
  {label:'Credi alla sua storia',effect:'+5 OVR a quel giocatore fino a fine stagione',apply(context){const entry=context?.playerId?rosterEntry(context.playerId):null;if(!entry)return 'Nessun giocatore disponibile.';const current=Number(entry.player?.ovr||playerById(entry.playerId)?.ovr)||60,change=setPermanentRosterOvr(entry,current+5);return change?`${change.player.name} sale da ${change.before} a ${change.after} OVR fino a fine stagione.`:'Il bonus OVR non è stato applicato.'}},
  {label:'È un povero pazzo',effect:'Al draft di metà stagione devi scambiarlo con un giocatore di pari o maggiore OVR',apply(context){if(!context?.playerId)return 'Nessun giocatore disponibile.';queueEqualOrBetterMidseasonPlayer(context.playerId);return `${context.playerName} dovrà essere scambiato al draft di metà stagione con un giocatore di pari o maggiore OVR.`}}
 ]},

 {id:'arbitro-ecuadoriano',userOnly:true,title:'Un misterioso arbitro ecuadoriano ti si avvicina',text:'Ti propone il suo aiuto per le prossime partite.',available(){return !secretRefereeDealState().active},choices:[
  {label:'Accetta il suo aiuto',effect:'Riceverai un rigore a favore in ogni partita.',apply(){return startSecretRefereeDeal('accept')}},
  {label:'Rifiuta il suo aiuto',effect:'Riceverai un rigore contro in ogni partita.',apply(){return startSecretRefereeDeal('refuse')}}
 ]},
 {id:'maglie-nomi-sbagliati',userOnly:true,title:'Maglie con i nomi sbagliati',text:'Il magazziniere ha scambiato tutte le divise.',available(){return realCurrentLineupEntries().length>=2},choices:[
  {label:'Giocate comunque',effect:'Due titolari casuali si scambiano posizione. Entrambi ricevono -5 OVR se finiscono fuori ruolo.',apply(){return startWrongShirtsEvent()}},
  {label:'Stampate nuove maglie all’ultimo secondo',effect:'Un giocatore casuale perde la prossima partita. Gli altri ricevono +3 Intesa.',apply(){return printLastMinuteShirts()}}
 ]},
 {id:'porta-calcetto',userOnly:true,title:'La porta è più piccola del regolamento',text:'Lo stadio avversario monta per errore una porta da calcetto.',choices:[
  {label:'Protestate',effect:'La partita viene giocata normalmente. La squadra riceve -3 OVR per il nervosismo.',apply(){pushEffect('teamOvr',-3,1,{source:'Protesta per la porta da calcetto'});return 'La squadra riceve -3 OVR nella prossima partita per il nervosismo.'}},
  {label:'Accettate',effect:'Entrambe le squadre hanno meno probabilità di segnare. Il vostro portiere riceve +10 OVR.',apply(){return acceptSmallGoalMatch()}}
 ]},
 {id:'giocatore-insonne',userOnly:true,title:'Il giocatore insonne',text:'Un titolare ha passato la notte a giocare a 0-0-0.',available(){return realCurrentLineupEntries().length>0},createContext(){const entry=randomRealCurrentLineupEntry();return entry?{playerId:String(entry.playerId),playerName:entry.player.name}:{}},describe(context){return context?.playerName?`${this.text} Il giocatore coinvolto è ${context.playerName}.`:this.text},choices:[
  {label:'Mandatelo comunque in campo',effect:'-12 OVR per una partita. Se segna, ottiene +15 Intesa fino a fine stagione.',apply(context){return sendInsomniacOnField(context)}},
  {label:'Lasciatelo riposare',effect:'Non disponibile per una giornata. Al rientro: +5 OVR per 2 giornate.',apply(context){return restInsomniacPlayer(context)}}
 ]},
 {id:'maglie-novanta',title:'Il magazziniere lava tutte le maglie a 90 gradi',text:'Le divise ora sembrano adatte a una squadra Pulcini.',choices:[
  {label:'Giocate comunque con le maglie strette',effect:'+5 OVR nella prossima partita, ma rischio di infortunio aumentato',apply(){pushEffect('teamOvr',5,1);pushEffect('injuryRisk',1,1,{chance:.45,count:1,duration:1,source:'Maglie strette'});return '+5 OVR, con il 45% di rischio che un giocatore si infortuni.'}},
  {label:'Usate le vecchie maglie degli anni Novanta',effect:'+5 Intesa per 2 giornate',apply(){pushEffect('teamChem',5,2);return '+5 Intesa alla squadra per 2 giornate.'}}
 ]},
 {id:'tifoso-formazione',title:'Un tifoso vince il diritto di fare la formazione',text:'Ha vinto il concorso comprando 600 pacchetti di patatine.',choices:[
  {label:'Ti rifiuti di fare sta pagliacciata',effect:'1 punto di penalizzazione in classifica',apply(){const standing=userStanding();if(standing)standing.pts-=1;return 'È stato applicato 1 punto di penalizzazione in classifica.'}},
  {label:'Accetti ma il tifoso è Gullo',effect:'Nella prossima partita puoi al massimo pareggiare',apply(){pushEffect('maxDraw',1,1);return 'La prossima partita non potrà essere vinta: il risultato massimo sarà un pareggio.'}}
 ]},
 {id:'tiktok-boomer',title:'Il preparatore atletico boomer scopre TikTok',text:'Sostituisce l’allenamento con balletti sincronizzati e challenge.',choices:[
  {label:'Registrate la challenge',effect:'Abbonati ×2 Intesa per 2 giornate, squadra -5 OVR per 2 giornate',apply(){pushEffect('subscriberChemMultiplier',2,2);pushEffect('teamOvr',-5,2);return 'Intesa positiva degli abbonati raddoppiata e -5 OVR alla squadra per 2 giornate.'}},
  {label:'Lo fai tornare su Facebook',effect:'+5 OVR alla squadra, ma Intesa azzerata per 1 giornata',apply(){pushEffect('teamOvr',5,1);pushEffect('teamChemZero',1,1);return '+5 OVR alla squadra e Intesa azzerata nella prossima partita.'}}
 ]},
 {id:'marotta-league',title:'La Marotta League',text:'Un misterioso personaggio ti si avvicina.',choices:[
  {label:'Le vittorie valgono doppio',effect:'Ogni vittoria vale 6 punti fino a fine stagione, ma ogni sconfitta comporta 100 punti di penalità',apply(){state.seasonRules.marottaDoubleWins=true;state.seasonRules.marottaLossPenalty=100;return 'Da ora fino a fine stagione: +6 punti per ogni vittoria e -100 punti per ogni sconfitta.'}},
  {label:'Vittoria assicurata',effect:'Vinci sicuramente la prossima partita, ma aumenta drasticamente la probabilità di infortunio',apply(){pushEffect('forcedWin',1,1);pushEffect('injuryRisk',1,1,{chance:.80,count:1,duration:2,source:'Vittoria assicurata'});return 'La prossima partita sarà vinta, ma c’è l’80% di rischio di un infortunio da 2 giornate.'}}
 ]},
 {id:'corto-muso',title:'Corto Muso',text:'Un misterioso personaggio ti si avvicina.',choices:[
  {label:'Te ne intendi di ippica?',effect:'Puoi segnare al massimo 1 gol nella prossima partita, ma se vinci ottieni 9 punti',apply(){pushEffect('goalCap',1,1);pushEffect('winPoints',9,1);return 'Nella prossima partita massimo 1 gol segnato; un’eventuale vittoria vale 9 punti.'}},
  {label:'Il miglior attacco è la difesa',effect:'Non subisci gol per le prossime 2 partite, ma tutti i tuoi attaccanti sono squalificati',apply(){pushEffect('cleanSheet',1,2);const entries=rosterPlayers().filter(entry=>roleOf(entry.player)==='A');entries.forEach(entry=>statusOf(entry.playerId).suspension=Math.max(statusOf(entry.playerId).suspension,1));return entries.length?`Porta inviolata garantita per 2 partite. Attaccanti squalificati per la prossima giornata: ${entries.map(entry=>entry.player.name).join(', ')}.`:'Porta inviolata garantita per 2 partite.'}}
 ]},
 {id:'ma-che-mollo',title:'Ma che mollo',text:'Un misterioso personaggio ti si avvicina.',choices:[
  {label:'Siamo pazzi qua?',effect:'×3 Intesa nella prossima partita, ma subisci almeno 1 gol per 2 partite',apply(){pushEffect('teamChemMultiplier',3,1);pushEffect('minimumGoalsAgainst',1,2);return 'Intesa positiva triplicata nella prossima partita; almeno 1 gol subito nelle prossime 2.'}},
  {label:'Chi fa sto mestiere non è mollo',effect:'Segnano tutti gli abbonati nella prossima partita e perdi il controllo delle decisioni fino a fine stagione',apply(){pushEffect('forceSubscriberGoals',1,1);state.seasonRules.autoDecisions=true;return 'Nella prossima partita ogni abbonato presente in campo segnerà almeno un gol. Le decisioni future saranno automatiche.'}}
 ]},
 {id:'var-misterioso',title:'VAR',text:'Un misterioso personaggio ti si avvicina.',choices:[
  {label:'Favori rischiosi',effect:'5 squadre casuali tra tutte le partecipanti vanno a 0 punti; la tua può essere sorteggiata',apply(){const names=zeroFiveTeamsIncluding(USER_ID);return names.length?`${names.join(', ')} vanno a 0 punti in classifica.`:'Nessuna squadra disponibile.'}},
  {label:'Video Assistant Referee',effect:'Aumentano drasticamente le probabilità di espulsioni per le prossime 2 partite',apply(){pushEffect('refChaos',1,2,{opponentRedChance:.75,ownRedChance:.60,source:'VAR misterioso'});return 'Per 2 partite: 75% di rosso avversario e 60% di rosso per la tua squadra.'}}
 ]},
 {id:'milan-lab',title:'Milan Lab',text:'Lo staff medico presenta un piano di recupero decisamente poco rassicurante.',choices:[
  {label:'Catena di infortuni',effect:'Per le prossime 3 partite aumenta drasticamente il rischio di infortunio',apply(){pushEffect('injuryRisk',1,3,{chance:.80,count:1,duration:2,source:'Milan Lab'});return 'Per le prossime 3 partite c’è l’80% di rischio che un giocatore subisca un infortunio di 2 giornate.'}},
  {label:'Competenza',effect:'Un giocatore casuale è fuori per tutta la stagione',apply(){const entry=randomOwnEntry(item=>!statusOf(item.playerId).seasonOut)||randomOwnEntry();return ruleOutForSeason(entry,'Milan Lab')}}
 ]},
 {id:'anvedi-goicoechea',title:'Anvedi Goicoechea',text:'Il reparto portieri entra improvvisamente in una situazione d’emergenza.',available(){return Number(state.matchday)<19},createContext(){const entry=startingGoalkeeperEntry();return entry?{goalkeeperId:String(entry.playerId),goalkeeperName:entry.player.name}:{}},describe(context){return context?.goalkeeperName?`${this.text} Il portiere coinvolto è ${context.goalkeeperName}.`:this.text},choices:[
  {label:'Che ha combinato?',effect:'Perdi il portiere per il resto della stagione',apply(context){const entry=context?.goalkeeperId?rosterEntry(context.goalkeeperId):startingGoalkeeperEntry();return ruleOutForSeason(entry,'Anvedi Goicoechea')}},
  {label:'Nonno Ballotta',effect:'Nel draft di metà stagione sei costretto a cambiare il portiere',apply(context){const entry=context?.goalkeeperId?rosterEntry(context.goalkeeperId):startingGoalkeeperEntry();if(!entry)return 'Nessun portiere disponibile.';queueMandatoryMidseasonPlayer(entry.playerId);return `${entry.player.name} dovrà essere obbligatoriamente scambiato al draft di metà stagione.`}}
 ]},
 {id:'quelli-del-fantacalcio',title:'Quelli del Fantacalcio',text:'I voti sono usciti, ma qualcuno ha deciso di cambiare le regole dei bonus.',choices:[
  {label:'I pagellisti',effect:'Nella prossima partita non ti assegnano neanche un gol',apply(){pushEffect('noGoals',1,1);return 'Nella prossima partita la tua squadra segnerà 0 gol, qualunque cosa accada.'}},
  {label:'No bonus',effect:'Per le prossime 3 partite giochi con gli OVR base, senza Intesa né altri bonus',apply(){pushEffect('baseOvrOnly',1,3);return 'Per 3 partite saranno usati solo gli OVR base. Intesa e modificatori OVR saranno ignorati.'}}
 ]},
 {id:'fantaballa-fa-video',title:'Fantaballa fa un video',text:'È arrivato il momento di scegliere il prossimo format da pubblicare.',choices:[
  {label:'Maradona ma...',effect:'Ricevi Maradona con 120 OVR al posto di un attaccante, ma i tuoi punti vanno a 0',apply(){return addMaradonaEventPlayer()}},
  {label:'Campionato italiano ma...',effect:'Da ora in poi ogni pareggio del campionato vale 6 punti per entrambe le squadre',apply(){state.seasonRules.drawPoints=6;return 'Da questo momento e fino a fine stagione ogni pareggio del campionato assegna 6 punti a entrambe le squadre.'}}
 ]},
 {id:'misterfm-fa-video',title:'MisterFM fa un video',text:'MisterFM entra nello spogliatoio con una nuova idea per rivoluzionare la rosa.',choices:[
  {label:'Rebuild della squadra',effect:'I 3 titolari con OVR più basso vengono sostituiti da 3 giocatori casuali compatibili',apply(){return rebuildWeakestStarters()}},
  {label:'Experiment',effect:'Un giocatore casuale può ricevere +20 oppure -20 OVR per tutta la stagione',apply(){return runMisterFmExperiment()}}
 ]},
 {id:'demone-durata-partite',title:'Un demone si avvicina',text:'Ti propone di cambiare per sempre la durata delle tue partite.',choices:[
  {label:'Breve ma intenso',effect:'Le tue partite durano soltanto 30 minuti',apply(){state.seasonRules.matchDuration=30;state.seasonRules.longMatchRisk=false;return 'Da ora tutte le tue partite termineranno al 30° minuto.'}},
  {label:'Lungo e godurioso',effect:'Le tue partite durano 120 minuti, ma aumentano infortuni e squalifiche',apply(){state.seasonRules.matchDuration=120;state.seasonRules.longMatchRisk=true;return 'Da ora le tue partite dureranno 120 minuti, con rischio maggiore di infortuni ed espulsioni.'}}
 ]},
 {id:'personaggio-capelli-bianchi',title:'Un personaggio dai capelli bianchi si avvicina con una bevanda in mano',text:'La bottiglia non ha etichetta, ma emette una luce decisamente sospetta.',choices:[
  {label:'Bevanda energetica',effect:'50%: tutta la rosa +10 OVR. 50%: tutta la rosa fuori fino a fine stagione',apply(){if(Math.random()<.5){const names=boostAllRosterPlayers(10);return `${names.length} giocatori ricevono +10 OVR fino a fine stagione.`}const names=ruleOutAllRosterPlayers('Bevanda energetica');unlockAchievement('era-meglio-l-acqua');return `${names.length} giocatori sono infortunati fino al termine della stagione.`}},
  {label:'Rifiuto la bevanda',effect:'L’Atalanta riceve +10 OVR ogni volta che ti affronta',apply(){return activateDeathMatchClub()}}
 ]},
 {id:'figura-aldila',title:'Una figura dall’aldilà si avvicina',text:'Pronuncia poche parole e pretende una rivoluzione tattica.',available(){return Number(state.matchday)<19},choices:[
  {label:'ATAKARE',effect:'Solo la tua squadra cambia modulo e gioca con un 2-4-4',apply(){return forceUserFormation('2-4-4')}},
  {label:'Mi consenta',effect:'Al draft di metà stagione devi scambiare un difensore centrale; il pack successivo avrà un top player',apply(){return activateMandatoryDcTopSwap()}}
 ]},
 {id:'fgci-regolamento-rossi-punti',title:'FGCI',text:'La federazione presenta un nuovo regolamento con effetto immediato.',choices:[
  {label:'Ogni rosso è un gol',effect:'Ogni cartellino rosso ricevuto equivale a un gol a favore fino a fine stagione',apply(){state.seasonRules.redCardGoals=true;return 'Da ora ogni squadra che riceve un rosso ottiene anche un gol a favore.'}},
  {label:'I punti sono i gol',effect:'I punti guadagnati in classifica corrispondono ai gol segnati',apply(){state.seasonRules.pointsEqualGoals=true;return 'Da ora ogni squadra ottiene in classifica tanti punti quanti sono i gol segnati nella partita.'}}
 ]},
 {id:'mago-do-nascimento',title:'Mago do Nascimento',text:'Il mago assicura che ogni problema fisico può diventare un vantaggio.',choices:[
  {label:'Magia wodu',effect:'Finché un tuo giocatore è infortunato riceve +40 OVR',apply(){state.seasonRules.injuredOvrBonus=40;return 'Da ora ogni giocatore infortunato schierato riceve +40 OVR finché resta infortunato.'}},
  {label:'Magia nera',effect:'Un giocatore casuale riceve +20 OVR fino a fine stagione',apply(){return permanentRandomPlayerBoost(20,'Magia nera')}}
 ]},
 {id:'fgci-regolamento-gol-tardivi',title:'FGCI',text:'La federazione cambia nuovamente il regolamento del campionato.',choices:[
  {label:'Dal 80’ i gol valgono doppio',effect:'Ogni gol segnato dall’80° in poi vale due reti fino a fine stagione',apply(){state.seasonRules.lateGoalsDouble=true;return 'Da ora i gol segnati dall’80° minuto in poi valgono doppio per tutte le squadre.'}},
  {label:'Zero a zero, zero punti',effect:'Se una partita finisce 0-0 nessuna squadra ottiene punti',apply(){state.seasonRules.zeroZeroNoPoints=true;return 'Da ora ogni 0-0 assegna 0 punti a entrambe le squadre.'}}
 ]},
 {id:'underdog',title:'Underdog',text:'Il destino mette alla prova il rapporto tra favoriti e giocatori dimenticati.',choices:[
  {label:'I primi saranno gli ultimi',effect:'Un giocatore con OVR base tra 60 e 70 diventa forte quanto il tuo giocatore con l’OVR base più alto fino a fine stagione',apply(){return empowerUnderdog()}},
  {label:'Favoriti',effect:'La prossima partita è vinta automaticamente per 6-0',apply(){return guaranteeSixNil()}}
 ]},
 {id:'sessanta-sfumature',title:'60 sfumature di ca***',text:'Il numero 60 assume improvvisamente un significato molto pericoloso.',choices:[
  {label:'Un piccolo sacrificio',effect:'Un giocatore con OVR base tra 60 e 65 raddoppia la forza per tutta la stagione, ma perdi il tuo miglior giocatore',apply(){return sixtyShadesSacrifice()}},
  {label:'60 la paura',effect:'Se raggiungi esattamente 60 punti in classifica, perdi tutti i punti',apply(){return activateSixtyPointFear()}}
 ]},
 {id:'omonimo-allenatore',get title(){return `Ti si avvicina un tipo di nome ${String(state.coachName||'misterioso')}`},text:'Il tipo sostiene che condividere un nome crei un legame tattico inspiegabile.',available(){return Boolean(String(state.coachName||'').trim())},choices:[
  {label:'Ehi ma ti chiami come me',effect:'Se hai un giocatore con lo stesso nome dell’allenatore, la sua Intesa viene moltiplicata ×2 fino a fine stagione',apply(){return doubleCoachNamesakeChemistry()}},
  {label:'Che nome del ca***',effect:'L’Intesa di tutta la squadra viene moltiplicata ×2 per le prossime 2 partite',apply(){return doubleTeamChemistryTwoMatches()}}
 ]},
 {id:'figura-misteriosa-tattico-fantaguru',title:'Ti si avvicina una figura misteriosa',text:'La figura sostiene di poter sistemare la formazione oppure prevedere ogni affare del mercato.',available(){return Number(state.matchday)<19},choices:[
  {label:'Il tattico',effect:'Sistema la formazione mettendo in campo i panchinari più forti dei titolari e la aggiorna automaticamente fino a fine stagione',apply(){return activatePersistentTactician()}},
  {label:'Il fantaguru',effect:'Nel draft di metà stagione avrai sempre almeno una scelta migliore del giocatore che stai offrendo',apply(){return activateFantaguru()}}
 ]},
 {id:'figlio-del-mister',title:'Il figlio del mister',text:'In rosa c’è un giocatore con lo stesso nome dell’allenatore.',available(){return Number(state.matchday)<19&&Boolean(coachNamedRosterEntry())},choices:[
  {label:'Talento di famiglia',effect:'Il giocatore con il tuo stesso nome riceve +10 OVR fino a fine stagione',apply(){return boostCoachNamedPlayer()}},
  {label:'Scambio assicurato',effect:'Al draft puoi scambiarlo con un top player garantito del suo ruolo',apply(){return activateCoachTopSwap()}}
 ]},
 {id:'personaggio-mantello-multiverso',title:'Un personaggio misterioso col mantello ti si avvicina',text:'Apre due portali verso campionati paralleli e ti offre un nuovo giocatore.',choices:[
  {label:'Multiverso',effect:'Un giocatore casuale del Campionato del Ca*** sostituisce il tuo giocatore con OVR più basso',apply(){return multiverseClassic()}},
  {label:'Multiverso2',effect:'Un giocatore casuale del Fantacampionato del Ca*** sostituisce il tuo giocatore con OVR più basso',apply(){return multiverseReal()}}
 ]},
 {id:'personaggio-misterioso-sosia',title:'Un personaggio misterioso che ti assomiglia ti si avvicina',text:'Dice di conoscere ogni versione possibile della tua carriera da allenatore.',choices:[
  {label:'Il te stesso',effect:'Un giocatore con lo stesso nome dell’allenatore viene cercato prima nel database attivo e poi nell’altro campionato, quindi arriva al posto del giocatore più scarso',apply(){return bringCoachNamesake()}},
  {label:'Benvenuto nel mondo del domani!',effect:'Un tuo giocatore segna sempre un gol, ma ogni nuovo infortunio azzera i tuoi punti',apply(){return activateFutureScorer()}}
 ]},
 {id:'personaggio-corona-spine',title:'Si avvicina un misterioso personaggio con una corona di spine',text:'Il personaggio propone di rovesciare ogni gerarchia oppure di moltiplicare gli imprevisti della stagione.',choices:[
  {label:'Gli ultimi saranno i primi',effect:'La classifica si capovolge: il primo prende i punti dell’ultimo, il secondo quelli del penultimo e così via',apply(){return reverseStandingsPoints()}},
  {label:'La moltiplicazione',effect:'La probabilità di apparizione di un evento raddoppia fino a fine stagione',apply(){return doubleEventAppearanceRate()}}
 ]},
 {id:'fgci-regole-estreme',title:'Nuova regola FGCI',text:'La federazione propone due riforme estreme con effetto immediato.',choices:[
  {label:'Maratona',effect:'Il campionato dura il doppio rispetto al numero attuale di squadre; vittorie da 1,5 punti e pareggi da 0',apply(){return extendSeasonTo76()}},
  {label:'Hunger Games',effect:'Chi perde viene eliminato fino a fine stagione e scompare dalla classifica',apply(){return activateHungerGames()}}
 ]},
 {id:'fgci-formazioni-estreme',title:'Nuova regola FGCI',text:'La federazione cambia il numero di calciatori ammessi contemporaneamente in campo.',choices:[
  {label:'4-4-4',effect:'Ora in campo vanno 14 giocatori, con 0 panchinari',apply(){return forceSeasonFormation('4-4-4')}},
  {label:'3-3-3',effect:'Ora in campo vanno 9 giocatori, con 5 panchinari',apply(){return forceSeasonFormation('3-3-3')}}
 ]},
 {id:'generale-misterioso',title:'Si avvicina un generale misterioso',text:'Il generale vuole rivoluzionare la composizione della rosa e i rapporti tra i giocatori.',available(){return Number(state.matchday)<seasonLength()-6},choices:[
  {label:'Rimmigrazione!',effect:'Tutti i giocatori non italiani vengono scambiati con giocatori italiani compatibili; se necessario si pesca anche dall’altro campionato. Il generale ha il 50% di probabilità di tornare per il controllo dei documenti',apply(){return replaceNonItalianWithItalians()}},
  {label:'Chiusi i porti',effect:'0 Intesa per tutti i giocatori non italiani fino a fine stagione',apply(){return activateClosedPorts()}}
 ]},
 {id:'generale-documenti',chainOnly:true,title:'Controllo dei documenti',text:'Dopo alcune giornate il generale torna a controllare la rosa.',choices:[
  {label:'Collabori',effect:'Tutti gli italiani ricevono +3 Intesa fino a fine stagione',apply(){return collaborateWithGeneral()}},
  {label:'Nascondi un giocatore straniero',effect:'Recuperi il più forte tra gli stranieri sostituiti; 50% di rischio di essere scoperto e perdere 3 punti',apply(){return hideForeignPlayerFromGeneral()}},
  {label:'Cacci il generale',effect:'Recuperi la rosa originale, ma l’Intesa viene dimezzata fino a fine stagione',apply(){return dismissGeneral()}}
 ]},
 {id:'figc-regola-gol',title:'Nuova regola FIGC',text:'La federazione vuole rivoluzionare il modo in cui viene deciso il vincitore delle partite.',available(){return !state.seasonRules.federationGoalRule},choices:[
  {label:'Golden goal',effect:'Il primo che segna vince la partita. La regola resta attiva fino a fine stagione.',apply(){return activateFederationGoalRule('golden')}},
  {label:'Chi segna questo vince',effect:'Chi segna per ultimo vince la partita. La regola resta attiva fino a fine stagione.',apply(){return activateFederationGoalRule('last')}}
 ]},
 {id:'space-jam',userOnly:true,title:'Space Jam',text:'La partita sta per diventare molto meno normale.',available(){return !state.seasonRules.spaceJamRule&&!state.seasonRules.spaceJamTalentPending},choices:[
  {label:'Che succede amico?',effect:'Nella prossima partita, se vinci rubi il miglior giocatore degli avversari e lo inserisci al posto del tuo peggior giocatore compatibile con il suo ruolo. Se perdi, perdi il tuo miglior giocatore.',apply(){return activateSpaceJamTalentChallenge()}},
  {label:'Bib Bip!',effect:'Fino a fine stagione ogni partita inizia da un minuto casuale tra 0 e la durata prevista: 30, 90 o 120 minuti in base agli altri regolamenti.',apply(){return activateSpaceJamRandomKickoff()}}
 ]},
 {id:'misterioso-francese',userOnly:true,title:'Un misterioso francese si gira e ti si avvicina',text:'Con uno sguardo enigmatico ti propone due idee capaci di stravolgere la squadra.',available(){return !state.seasonRules.frenchEventChoice},choices:[
  {label:'Portiere volante',effect:'Il portiere titolare viene messo in attacco e un attaccante titolare viene messo in porta. Entrambi ottengono +10 OVR.',apply(){return activateFrenchFlyingGoalkeeper()}},
  {label:'Si è girato',effect:'Fino a fine stagione, per ogni gol segnato dopo l’80° minuto, l’attaccante autore del gol riceve +5 OVR permanente.',apply(){return activateFrenchLateTurn()}}
 ]},
 {id:'figc-formula-uno-niente-pareggio',title:'Nuovo regolamento FIGC',text:'La federazione presenta due nuovi modi di assegnare vittorie e punti, con effetto immediato fino a fine stagione.',available(){return !state.seasonRules.figcCompetitionRule&&!state.seasonRules.fgicLeagueRule},choices:[
  {label:'Formato Formula 1',effect:'Ogni giornata le squadre vengono ordinate per qualità del risultato: 25, 18, 15, 12, 10, 8, 6, 4, 2 e 1 punto alle prime 10. Con anche un solo infortunato, la partita successiva è persa 0-3 a tavolino. Espulsioni e squalifiche non fanno perdere a tavolino.',apply(){return activateFigcCompetitionRule('formula-one')}},
  {label:'Niente pareggio',effect:'Ogni partita pari continua con i tempi supplementari e, se resta in parità, con i calci di rigore.',apply(){return activateFigcCompetitionRule('no-draw')}}
 ]},
 {id:'fgic-playoff-aiuto-fondo',title:'Nuova regola FGIC',text:'La federazione propone una nuova struttura per il titolo e un aiuto speciale alle squadre in difficoltà.',available(){return !state.seasonRules.fgicLeagueRule&&!state.seasonRules.figcCompetitionRule},choices:[
  {label:'Play off',effect:'A fine campionato le prime 8 disputano i play off scudetto a eliminazione diretta, in partita secca. La squadra meglio classificata gioca in casa.',apply(){return activateFgicLeagueRule('playoffs')}},
  {label:'Aiuto dal fondo',effect:'Prima di ogni giornata, le squadre dal 10° posto in giù ricevono 4 punti per vittoria, 2 per pareggio e 1 per sconfitta.',apply(){return activateFgicLeagueRule('bottom-help')}}
 ]},
 {id:'figura-pelata-misteriosa',title:'Una figura pelata misteriosa ti si avvicina',text:'Con aria solenne propone di cambiare immediatamente il numero delle squadre che partecipano al campionato.',available(){return !state.seasonRules.dynamicLeague},choices:[
  {label:'Campionato allargato',effect:'Entrano altre 20 squadre casuali prese dall’altra modalità. Ognuna parte con punti casuali, fino al punteggio attuale della capolista.',apply(){return activateExpandedLeague()}},
  {label:'Campionato élite',effect:'Le ultime 10 vengono rimosse: da questo momento partecipano soltanto le prime 10.',apply(){return activateEliteLeague()}}
 ]},
 {id:'fgci-risultati-estremi',title:'Nuova regola FGCI',text:'La federazione cambia il valore degli 0-0 e delle sconfitte per tutte le squadre fino a fine stagione.',available(){return !state.seasonRules.fgciResultRule},choices:[
  {label:'Vince la noia',effect:'Ogni 0-0 assegna 7 punti a entrambe le squadre.',apply(){return activateFgciResultRule('boredom-wins')}},
  {label:'Tutto per tutto',effect:'Ogni sconfitta vale -3 punti per la squadra sconfitta.',apply(){return activateFgciResultRule('all-in')}}
 ]},
 {id:'nuovo-video-fantaballa',title:'Esce un nuovo video di Fantaballa',text:'Il nuovo video ispira una regola assurda che cambia tutte le partite del campionato fino a fine stagione.',available(){return !state.seasonRules.fantaballaVideoRule},choices:[
  {label:'Chi vince perde!',effect:'3 punti per chi perde, 1 punto per il pareggio e 0 punti per chi vince.',apply(){return activateFantaballaVideoRule('reverse-points')}},
  {label:'Segna o non vinci',effect:'Devi segnare almeno 2 gol per vincere la partita; altrimenti il risultato diventa un pareggio.',apply(){return activateFantaballaVideoRule('two-goals-to-win')}}
 ]},
 {id:'italia-pizza-catenaccio',userOnly:true,title:'Italia, pizza e catenaccio',text:'Due filosofie difensive possono cambiare il resto della tua stagione.',available(){return !state.seasonRules.italiaCatenaccioRule},choices:[
  {label:'Allegri insegna',effect:'Fino a fine stagione puoi segnare al massimo un gol per partita.',apply(){return activateItaliaCatenaccioRule('allegri')}},
  {label:'Il gol? Che schifo!',effect:'Fino a fine stagione, ogni volta che segni più di 3 gol perdi 6 punti in classifica.',apply(){return activateItaliaCatenaccioRule('goal-disgust')}}
 ]},
 {id:'fgci-punti-gol',title:'Nuova regola FGCI',text:'La federazione introduce una nuova regola di classifica che colpisce tutte le squadre fino a fine stagione.',available(){return !state.seasonRules.fgciPointsRule},choices:[
  {label:'Gol pesanti',effect:'Ogni gol subito vale -1 punto in classifica per tutte le squadre.',apply(){return activateFgciPointsRule('heavy-goals')}},
  {label:'Porta inviolata',effect:'Ogni squadra che non subisce gol ottiene +1 punto in classifica.',apply(){return activateFgciPointsRule('clean-sheet')}}
 ]},
 {id:'curva-contestazione',userOnly:true,title:'La curva sta contestando',describe(){const mister=String(state.coachName||'Mister').trim()||'Mister';return `${mister}, devi vendere! Vattene, vattene!`},available(){return curvaContestCanAppear()},choices:[
  {label:'Puntiamo allora allo scudetto',effect:'Entro 5 giornate devi essere tra le prime 2. Durante la sfida giochi normalmente. Se riesci, tutte le partite successive saranno trattate come gare in casa fino a fine stagione. Se fallisci, perdi la squadra e passi a una squadra casuale del campionato.',apply(){return activateCurvaTitleChallenge()}},
  {label:'Non ascoltarli',effect:'Ogni partita di campionato è trattata come una gara in trasferta fino a fine stagione.',apply(){return activateCurvaAwayPenalty()}}
 ]},
 {id:'punti-pari-dispari',title:'Punti pari o dispari',text:'Una nuova regola straordinaria colpirà la classifica soltanto dopo la prossima giornata.',available(){return Number(state.matchday)>0&&Number(state.matchday)<seasonLength()},choices:[
  {label:'Pari',effect:'Dopo la prossima giornata, le squadre con punti pari verranno portate a 0. Fino ad allora la classifica resta invariata.',apply(){return scheduleStandingsResetByParity('even')}},
  {label:'Dispari',effect:'Dopo la prossima giornata, le squadre con punti dispari verranno portate a 0. Fino ad allora la classifica resta invariata.',apply(){return scheduleStandingsResetByParity('odd')}}
 ]},
 {id:'fgci-cartellini-estremi',title:'Nuova regola FGCI',text:'La federazione introduce due cartellini capaci di cambiare completamente le partite.',choices:[
  {label:'Giallo=Rosso',effect:'Il cartellino giallo porta direttamente all’espulsione',apply(){return activateYellowEqualsRed()}},
  {label:'Cartellino Rosa',effect:'Quando compare, la partita finisce all’istante e resta valido il risultato maturato',apply(){return activatePinkCardRule()}}
 ]}
].filter(decision=>!EXCLUDED_DECISION_IDS.has(String(decision?.id||'')));
function decisionFromPending(event){
 if(!event)return null;
 return DECISIONS.find(decision=>decision.id===event.decisionId)||DECISIONS[event.decisionIndex]||null;
}
function applyDecisionChoice(decisionIndex,choiceIndex,context={},decisionId=''){
 const decision=DECISIONS.find(item=>item.id===decisionId)||DECISIONS[decisionIndex];
 const choice=decision?.choices?.[choiceIndex];
 if(!choice)return 'Scelta non disponibile.';
 const detail=choice.apply(context||{});
 if(String(decision?.id||'')==='generale-misterioso'){
  setAchievementCareerFlag('generalEventMatchday',Number(state.matchday)||0);
  setAchievementCareerFlag('generalWinStreak',0);
 }
 return `Scelta: ${choice.label}. ${detail||choice.effect}`;
}
function prepareEvent(){
 if(state.phase!=='season'||state.pendingEvent)return;
 if(prepareError404StoryEvent()||prepareFantaballopoliStoryEvent()||prepareMeritStoryEvent()){save();return}
 questState().notice='';
 if(chaosEnabled())prepareChaosOpponentEvents();
 if(prepareChainedEvent()){save();return;}
 const multiplier=clamp((Number(state.seasonRules.eventChanceMultiplier)||1)*coachEventChanceFactor(),.25,2),normalChance=Math.max(0,1-(.45*multiplier)),autoLimit=normalChance+(.10*multiplier),roll=Math.random();
 if(roll<normalChance){
   state.pendingEvent={kind:'none',resolved:true,title:'Settimana normale',text:'Nessun evento particolare. La squadra pensa solo alla partita.'};
 }else if(roll<autoLimit){
   const event=pick(AUTO_EVENTS),before=analyticsSnapshot();
   const result=event.apply();
   recordSeasonEvent({kind:'auto',title:event.title,choice:'Evento automatico',effect:event.text,result,automatic:true},before);
   state.pendingEvent={kind:'auto',resolved:true,title:event.title,text:event.text,result};
 }else{
   const seen=new Set((state.seenDecisionEvents||[]).map(String));
   const available=DECISIONS.map((decision,index)=>({decision,index})).filter(item=>!item.decision.chainOnly&&!seen.has(item.decision.id)&&(!item.decision.available||item.decision.available()));
   if(!available.length){
     state.pendingEvent={kind:'none',resolved:true,title:'Settimana normale',text:'Gli imprevisti disponibili sono già comparsi: la squadra pensa solo alla partita.'};
   }else{
     const selected=pick(available),decision=selected.decision,decisionIndex=selected.index;
     const context=decision.createContext?decision.createContext():{};
     const eventTitle=typeof decision.title==='function'?decision.title(context):decision.title;
     const eventText=decision.describe?decision.describe(context):decision.text;
     state.seenDecisionEvents=[...seen,decision.id];
     if(state.seasonRules.autoDecisions){
       const choiceIndex=Math.floor(Math.random()*decision.choices.length),choice=decision.choices[choiceIndex],before=analyticsSnapshot();
       const result=applyDecisionChoice(decisionIndex,choiceIndex,context,decision.id);
       recordSeasonEvent({kind:'decision',title:eventTitle,choice:choice?.label||'',effect:choice?.effect||'',result,automatic:true},before);
       state.pendingEvent={kind:'decision',resolved:true,title:eventTitle,text:eventText,decisionId:decision.id,decisionIndex,context,result:`Decisione automatica. ${result}`};
     }else{
       state.pendingEvent={kind:'decision',resolved:false,title:eventTitle,text:eventText,decisionId:decision.id,decisionIndex,context};
     }
   }
 }
 save();
}
function resolveDecision(i){
 if(!state.pendingEvent||state.pendingEvent.resolved)return;
 const pendingDecision=decisionFromPending(state.pendingEvent);
 if(pendingDecision&&!state.seenDecisionEvents.includes(pendingDecision.id))state.seenDecisionEvents.push(pendingDecision.id);
 const choice=pendingDecision?.choices?.[i],before=analyticsSnapshot();
 state.pendingEvent.result=applyDecisionChoice(state.pendingEvent.decisionIndex,i,state.pendingEvent.context||{},state.pendingEvent.decisionId||'');
 recordSeasonEvent({kind:'decision',title:state.pendingEvent.title||pendingDecision?.title||'Decisione',choice:choice?.label||'',effect:choice?.effect||'',result:state.pendingEvent.result,automatic:false},before);
 state.pendingEvent.resolved=true;
 seasonEventMinimized=false;seasonEventUiKey='';
 save();
 render();
}
function setSeasonEventMinimized(minimized,{focus=true}={}){
 seasonEventMinimized=Boolean(minimized);
 const overlay=document.querySelector('.season-event-overlay'),dock=document.querySelector('.season-event-dock');
 if(overlay){
   overlay.hidden=seasonEventMinimized;
   overlay.classList.toggle('is-event-hidden',seasonEventMinimized);
   overlay.setAttribute('aria-hidden',seasonEventMinimized?'true':'false');
   overlay.style.setProperty('display',seasonEventMinimized?'none':'grid','important');
 }
 if(dock){
   dock.hidden=!seasonEventMinimized;
   dock.classList.toggle('is-event-hidden',!seasonEventMinimized);
   dock.classList.toggle('is-event-visible',seasonEventMinimized);
   dock.setAttribute('aria-hidden',seasonEventMinimized?'false':'true');
   dock.style.setProperty('display',seasonEventMinimized?'block':'none','important');
 }
 if(!focus)return;
 const target=seasonEventMinimized?dock?.querySelector('[data-event-expand]'):overlay?.querySelector('[data-event-minimize]');
 try{target?.focus({preventScroll:true})}catch{target?.focus()}
}
function bindSeasonEventControls(){
 const minimize=document.querySelector('[data-event-minimize]'),expand=document.querySelector('[data-event-expand]');
 if(minimize)minimize.onclick=event=>{
   event.preventDefault();
   event.stopPropagation();
   setSeasonEventMinimized(true);
 };
 if(expand)expand.onclick=event=>{
   event.preventDefault();
   event.stopPropagation();
   setSeasonEventMinimized(false);
 };
 /* Allinea sempre DOM e variabile, anche sui browser che ignorano [hidden]. */
 setSeasonEventMinimized(seasonEventMinimized,{focus:false});
}
function renderEvent(){
 const e=state.pendingEvent;
 if(!e)return'';
 if(e.kind==='storyError404'&&!e.resolved)return renderError404StoryEvent(e);
 if(e.kind==='storyError404')return `<div class="event-card"><div class="label">Storia</div><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></div>`;
 if(e.kind==='storyFantaballopoli'&&!e.resolved)return renderFantaballopoliEvent(e);
 if(e.kind==='storyFantaballopoli')return `<div class="event-card"><div class="label">Storia</div><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p>${e.result?`<b>${esc(e.result)}</b>`:''}</div>`;
 if(e.kind==='storyMerit'&&!e.resolved)return renderMeritStoryEvent(e);
 if(e.kind==='storyMerit')return `<div class="event-card"><div class="label">Storia</div><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p>${e.result?`<b>${esc(e.result)}</b>`:''}</div>`;
 if(e.kind==='decision'&&!e.resolved){
   const d=decisionFromPending(e);
   if(!d)return'';
   const eventLabel=d.questEvent?'Evento quest':(e.chained?'Evento concatenato':'Decisione casuale · evento unico');
   const eventKey=JSON.stringify([e.decisionId||'',e.decisionIndex??'',e.title||'',e.text||'',state.matchday,e.chained||false,e.context||{}]);
   if(seasonEventUiKey!==eventKey){seasonEventUiKey=eventKey;seasonEventMinimized=false}
   const choices=d.choices.map((c,i)=>`<div class="season-event-choice-float"><button class="choice season-event-choice ${i%2===0?'tone-blue':'tone-red'}" data-choice="${i}" type="button"><span class="season-event-option-label">Opzione ${String.fromCharCode(65+i)}</span><b>${esc(c.label)}</b><small>${esc(c.effect)}</small></button></div>`).join('');
   return `<div class="season-event-overlay" role="presentation" ${seasonEventMinimized?'hidden':''}><section class="season-event-dialog" role="dialog" aria-modal="true" aria-labelledby="seasonEventTitle" aria-describedby="seasonEventCopy"><button class="season-event-minimize" data-event-minimize type="button" aria-label="Riduci l’evento e consulta la pagina">━ Riduci</button><div class="season-event-head"><div class="season-event-kicker">${esc(eventLabel)}</div><h2 class="season-event-title" id="seasonEventTitle">${esc(e.title)}</h2><p class="season-event-copy" id="seasonEventCopy">${esc(e.text)}</p></div><div class="choice-grid season-event-choice-grid">${choices}</div><p class="season-event-hint">Riduci il box per consultare Rosa, Classifica, Calendario e Statistiche; potrai riaprirlo in qualsiasi momento.</p></section></div><aside class="season-event-dock" ${seasonEventMinimized?'':'hidden'} aria-label="Evento in attesa di una decisione"><button class="season-event-dock-button" data-event-expand type="button"><span class="season-event-dock-pulse" aria-hidden="true"></span><span class="season-event-dock-copy"><span>Evento in attesa</span><b>${esc(e.title)}</b></span><span class="season-event-dock-open">Riapri ↑</span></button></aside>`;
 }
 const notice=questState().notice;
 return `<div class="event-card"><div class="label">${e.chained?'Evento concatenato':(e.kind==='auto'?'Evento casuale':'Settimana')}</div><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p>${e.result?`<b>${esc(e.result)}</b>`:''}${notice?`<div class="quest-notice">${esc(notice)}</div>`:''}</div>`
}
function renderAvailability(){const list=unavailableList();if(!list.length)return'<p>Nessun indisponibile.</p>';return `<div class="availability">${list.map(r=>{const s=statusOf(r.playerId),starter=!r.bench;const statusText=s.suspension>0?`Squalificato: ${s.suspension} giornate`:s.seasonOut?`Fuori fino a fine stagione${s.seasonOutReason?` · ${esc(s.seasonOutReason)}`:''}`:`Infortunato: ${s.injury} giornate`;return `<div class="availability-row"><b>${esc(r.player.name)}</b><small>${statusText}</small>${starter&&s.injury>0&&!s.seasonOut?`<button class="btn ${state.playInjured[r.playerId]?'red':''}" data-injured="${esc(r.playerId)}">${state.playInjured[r.playerId]?'Giocherà infortunato (-20)':'Fallo giocare (-20)'}</button>`:''}</div>`}).join('')}</div>`}
function renderOpponentRoster(team){
 const players=opponentRosterPlayers(team);
 const rows=players.map(player=>{
   const status=opponentStatusOf(team,player.id);
   const unavailable=status.injury>0||status.suspension>0;
   const statusText=status.injury>0?`Infortunato: ${status.injury}`:status.suspension>0?`Squalificato: ${status.suspension}`:`${player.Position||roleOf(player)} · OVR ${player.ovr}`;
   return `<div class="opponent-roster-row ${unavailable?'is-out':''} ${player.isMascot?'is-mascot':''}"><div><b>${player.isMascot?'⭐ ':''}${esc(player.name)}</b><small>${esc(statusText)}</small></div><span class="chip ovr">${esc(player.ovr)}</span></div>`;
 }).join('');
 return `<details class="opponent-roster-details"><summary>${teamColorDot(team)}<span>Rosa di ${esc(team.name)} · ${players.length} giocatori</span></summary><div class="opponent-roster-list">${rows}</div></details>`;
}

function renderParallelCupOpponentLineup(lineup){
 const rows=(Array.isArray(lineup)?lineup:[]).map(entry=>`<div class="parallel-cup-opponent-player"><b>${esc(entry.player?.name||'Giocatore')}</b><span>${esc(entry.slot||entry.player?.Position||'')} · ${Number(entry.player?.ovr)||60} OVR</span></div>`).join('');
 return `<div class="parallel-cup-opponent-list">${rows||'<p>Rosa non disponibile.</p>'}</div>`;
}
function showParallelCupMatch(pending){
 const cup=parallelCupState(),stage=cup.stages?.[Number(pending.stageIndex)],tie=stage?.ties?.find(item=>String(item.id)===String(pending.tieId));
 if(!stage||!tie){cup.pendingMatch=null;save();render();return}
 const teamA=parallelCupParticipant(tie.teamAId),teamB=parallelCupParticipant(tie.teamBId),homeParticipant=Number(pending.legIndex)===0?teamA:teamB,awayParticipant=Number(pending.legIndex)===0?teamB:teamA;
 const homeTeam=parallelCupParticipantTeam(homeParticipant),awayTeam=parallelCupParticipantTeam(awayParticipant),opponentParticipant=homeParticipant?.user?awayParticipant:homeParticipant,opponentTeam=parallelCupParticipantTeam(opponentParticipant),opponentLineup=parallelCupParticipantLineup(opponentParticipant),event=pending.event||parallelCupDedicatedEvent(Boolean(pending.userHome));
 pending.event=event;
 screen.innerHTML=`<div class="parallel-cup-match-view"><section class="parallel-cup-match-hero"><div class="parallel-cup-match-top"><div><div class="label">🏆 Coppa parallela · prima della giornata ${Number(pending.matchday)}</div><h2>${esc(stage.name)}</h2></div><div class="parallel-cup-leg-badge">${Number(pending.legIndex)===0?'Andata':'Ritorno'}</div></div><div class="next-match"><div class="next-team-card" style="${teamCssVars(homeTeam)}"><span class="next-team-colors"></span><div class="team-name" style="font-size:${teamNameFontSize(homeTeam.name)}px">${esc(homeTeam.name)}</div><div class="subline">Casa</div></div><div class="versus">VS</div><div class="next-team-card" style="${teamCssVars(awayTeam)}"><span class="next-team-colors"></span><div class="team-name" style="font-size:${teamNameFontSize(awayTeam.name)}px">${esc(awayTeam.name)}</div><div class="subline">Trasferta</div></div></div><div class="parallel-cup-aggregate"><b>Aggregato attuale:</b> ${Number(tie.aggregateA)||0}-${Number(tie.aggregateB)||0} · Questa partita non fa avanzare la giornata di campionato.</div><div class="parallel-cup-event-card"><span>Evento dedicato alla coppa</span><b>${esc(event.title)}</b><p>${esc(event.description)}</p></div><div class="parallel-cup-match-actions"><button id="playCupLive" class="btn match-live-button">🎙️ Gioca con cronaca</button><button id="playCupInstant" class="btn match-instant-button">⚡ Simula subito</button></div></section><div class="dashboard-grid season-dashboard-grid"><div class="season-main-column">${renderParallelCupPanel()}<section class="panel"><div class="label">La tua formazione</div>${renderResolvedLineup()}</section></div><aside class="season-sidebar"><section class="panel opponent-club-panel" style="${teamCssVars(opponentTeam)}"><div class="label">Avversario di coppa</div><h3>${esc(opponentTeam.name)}</h3><p>OVR stimato ${parallelCupParticipantPower(opponentParticipant).toFixed(1)}</p>${renderParallelCupOpponentLineup(opponentLineup)}</section><section class="panel season-availability-panel"><div class="label">Indisponibili</div>${renderAvailability()}</section></aside></div></div>`;
 document.querySelectorAll('[data-injured]').forEach(button=>button.onclick=()=>{const id=button.dataset.injured;state.playInjured[id]=!state.playInjured[id];save();render()});
 document.getElementById('playCupLive').onclick=()=>playParallelCupMatch('live');
 document.getElementById('playCupInstant').onclick=()=>playParallelCupMatch('instant');
 save();
}
function playParallelCupMatch(mode='instant'){
 const pending=parallelCupPendingMatch();if(!pending)return render();
 const cup=parallelCupState(),stage=cup.stages?.[Number(pending.stageIndex)],tie=stage?.ties?.find(item=>String(item.id)===String(pending.tieId));if(!stage||!tie)return;
 const teamA=parallelCupParticipant(tie.teamAId),teamB=parallelCupParticipant(tie.teamBId),homeParticipant=Number(pending.legIndex)===0?teamA:teamB,awayParticipant=Number(pending.legIndex)===0?teamB:teamA,userHome=Boolean(homeParticipant?.user),homeTeam=parallelCupParticipantTeam(homeParticipant),awayTeam=parallelCupParticipantTeam(awayParticipant),homeLineup=parallelCupParticipantLineup(homeParticipant),awayLineup=parallelCupParticipantLineup(awayParticipant),event=pending.event||parallelCupDedicatedEvent(userHome);
 const duration=pinkCardMatchDuration(currentMatchDuration()),pinkCardMinute=state.seasonRules?.pinkCardEndsMatch?duration:0,chaos=state.activeEffects.filter(effect=>effect.type==='refChaos'),longRisk=Boolean(state.seasonRules.longMatchRisk&&duration===120),opponentYellowRed=Boolean(state.seasonRules?.yellowEqualsRed&&Math.random()<.45),ownYellowRed=Boolean(!parallelCupDisciplineImmunity()&&state.seasonRules?.yellowEqualsRed&&Math.random()<.45),opponentRedChance=Math.min(1,Math.max(0,...chaos.map(effect=>Number(effect.opponentRedChance)||0))+(longRisk?0.15:0)),ownRedChance=Math.min(1,Math.max(0,...chaos.map(effect=>Number(effect.ownRedChance??effect.ownSuspensionChance)||0))+(longRisk?0.25:0));
 const opponentLineup=userHome?awayLineup:homeLineup,userLineup=userHome?homeLineup:awayLineup,redCandidate=(opponentYellowRed||Math.random()<opponentRedChance)?pick(opponentLineup.map(entry=>entry.player).filter(Boolean)):null,ownRedEntry=parallelCupDisciplineImmunity()?null:((ownYellowRed||Math.random()<ownRedChance)?pick(userLineup.filter(entry=>entry?.player)):null);
 let homePower=parallelCupParticipantPower(homeParticipant),awayPower=parallelCupParticipantPower(awayParticipant);if(userHome){homePower+=Number(event.userBonus)||0;awayPower+=Number(event.opponentBonus)||0}else{awayPower+=Number(event.userBonus)||0;homePower+=Number(event.opponentBonus)||0}if(redCandidate){if(userHome)awayPower-=10;else homePower-=10}if(ownRedEntry){if(userHome)homePower-=10;else awayPower-=10}homePower=Math.max(35,homePower);awayPower=Math.max(35,awayPower);
 let [homeGoals,awayGoals]=simulateScore(homePower,awayPower,.18,duration),homeEvents=buildTeamGoals(homeGoals,homeLineup,homeTeam,awayTeam,[],duration),awayEvents=buildTeamGoals(awayGoals,awayLineup,awayTeam,homeTeam,[],duration);homeGoals=scoreGoalEvents(homeEvents);awayGoals=scoreGoalEvents(awayEvents);
 const commentary=buildMatchCommentary({homeTeam,awayTeam,homeLineup,awayLineup,homeEvents,awayEvents,homePower,awayPower,redCandidate,ownRedEntry,userHome,duration,pinkCard:Boolean(pinkCardMinute),opponentYellowRed,ownYellowRed});
 const finishCup=()=>{
   if(ownRedEntry){const status=statusOf(ownRedEntry.playerId);status.suspension=Math.max(1,status.suspension)}
   if(redCandidate){const opponentParticipant=userHome?awayParticipant:homeParticipant;if(opponentParticipant?.origin==='current'){const opponent=teamById(opponentParticipant.teamId),status=opponentStatusOf(opponent,redCandidate.id);status.suspension=Math.max(1,status.suspension)}}
   const report=parallelCupCompleteLeg(pending,{homeGoals,awayGoals,event,homeEvents,awayEvents,commentary});if(report)tickPenguinAfterMatch(report);save();showParallelCupResultModal(report,homeTeam,awayTeam);
 };
 if(mode==='live')playLiveMatch({commentary,homeTeam,awayTeam,homeGoals,awayGoals,matchday:pending.matchday,duration,label:`Coppa · ${stage.name} · ${Number(pending.legIndex)===0?'Andata':'Ritorno'}`},finishCup);
 else{modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="label">Coppa parallela</div><h2>${esc(stage.name)} · ${Number(pending.legIndex)===0?'Andata':'Ritorno'}</h2><div class="sim"><span></span></div><p>La partita di coppa viene simulata separatamente dal campionato.</p></div></div>`;setTimeout(finishCup,1250)}
}
function showParallelCupResultModal(report,homeTeam,awayTeam){
 if(!report){modalRoot.innerHTML='';render();return}
 const commentaryHtml=(report.commentary||[]).map(event=>commentaryRowHtml(event,homeTeam,awayTeam)).join('')||'<div class="goal-line">Partita senza azioni registrate.</div>',verdict=report.decided?(report.advanced?(Number(report.stageIndex)===2?'Coppa vinta!':'Qualificazione conquistata.'):`Eliminazione: ${esc(report.winner)} passa il turno.`):`Aggregato provvisorio ${report.aggregateUser}-${report.aggregateOpponent}.`,outcomeNotice=report.decided?String(parallelCupState().notice||''):'';
 modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal result-modal-expanded"><div class="label">🏆 Coppa parallela · ${esc(report.stage)} · ${esc(report.leg)}</div><div class="match-result"><div class="team-name">${esc(state.teamName)} vs ${esc(report.opponent)}</div><div class="score">${Number(report.gf)}–${Number(report.ga)}</div><button id="closeCupResult" class="btn primary result-continue-top">Continua</button><div class="goal-line cup-result-line"><b>${esc(report.event?.title||'Evento coppa')}</b><br>${esc(report.event?.description||'Nessun modificatore speciale.')}</div><div class="goal-line"><b>Risultato del doppio confronto</b><br>${verdict}${report.penalties?` Rigori: ${esc(report.penalties)}.`:''}</div>${outcomeNotice?`<div class="goal-line cup-result-line"><b>Esito della Coppa</b><br>${esc(outcomeNotice)}</div>`:''}${report.penguinUpdate?`<div class="goal-line ${report.penguinUpdate.type==='ludopatia'?'red-card-event':''}"><b>🐧 ${report.penguinUpdate.type==='ludopatia'?'Ludopatia':'Esperto Tipster'}</b><br>${esc(report.penguinUpdate.message)}</div>`:''}<div class="result-scorers">${renderResultScorers(report.userGoalEvents,state.teamName)}${renderResultScorers(report.opponentGoalEvents,report.opponent)}</div><div class="match-highlights-title">Cronaca della partita</div><div class="goals match-highlights">${commentaryHtml}</div></div></div></div>`;
 document.getElementById('closeCupResult').onclick=()=>{modalRoot.innerHTML='';render()};
}

function showSeason(){
 if(state.matchday>=19&&parallelCupState().status==='pending')initializeParallelCup();
 const pendingCupMatch=parallelCupPendingMatch();
 if(pendingCupMatch){showParallelCupMatch(pendingCupMatch);return}
 prepareEvent();
 const fx=userFixture(),opp=teamById(fx.home===USER_ID?fx.away:fx.home),userTeam=teamById(USER_ID)||{id:USER_ID,name:state.teamName,clubId:state.userClubId,colors:activeUserClub().colorClub},homeTeam=teamById(fx.home),awayTeam=teamById(fx.away),standing=userStanding(),rank=sortedTable().findIndex(x=>x.id===USER_ID)+1;
 screen.innerHTML=`<section class="panel season-overview-panel" style="${teamCssVars(userTeam)}"><div class="season-strip"><div class="stat"><b>${state.matchday+1}</b><span>Giornata</span></div><div class="stat"><b>${rank}°</b><span>Posizione</span></div><div class="stat"><b>${standing.pts}</b><span>Punti</span></div><div class="stat"><b>${standing.gf}</b><span>Gol fatti</span></div><div class="stat"><b>${standing.ga}</b><span>Gol subiti</span></div></div></section><div class="dashboard-grid season-dashboard-grid"><div class="season-main-column"><section class="panel season-match-panel"><div class="label">Prossima partita</div><div class="next-match"><div class="next-team-card" style="${teamCssVars(homeTeam)}"><span class="next-team-colors"></span><div class="team-name" style="font-size:${teamNameFontSize(homeTeam?.name||state.teamName)}px" title="${esc(homeTeam?.name||state.teamName)}">${esc(homeTeam?.name||state.teamName)}</div><div class="subline">${fx.home===USER_ID?'Casa':'Avversario'}</div></div><div class="versus">VS</div><div class="next-team-card" style="${teamCssVars(awayTeam)}"><span class="next-team-colors"></span><div class="team-name" style="font-size:${teamNameFontSize(awayTeam?.name||state.teamName)}px" title="${esc(awayTeam?.name||state.teamName)}">${esc(awayTeam?.name||state.teamName)}</div><div class="subline">${fx.away===USER_ID?'Trasferta':'Avversario'}</div></div></div><div style="margin-top:14px">${renderParallelCupPanel()}${renderActiveQuest()}${renderError404StoryPanel()}${renderFantaballopoliPanel()}${renderMeritStoryPanel()}${renderEvent()}${renderChaosLeagueFeed()}</div><div class="match-play-actions"><button id="playRoundLive" class="btn match-live-button" ${state.pendingEvent&&!state.pendingEvent.resolved?'disabled':''}>🎙️ Gioca con cronaca</button><button id="playRoundInstant" class="btn match-instant-button" ${state.pendingEvent&&!state.pendingEvent.resolved?'disabled':''}>⚡ Simula subito</button></div><div class="match-play-note">La simulazione rapida mantiene il comportamento attuale.</div></section><section class="panel season-tabs-panel"><div class="tabs"><button class="tab active" data-tab="table">Classifica</button><button class="tab" data-tab="calendar">Calendario</button><button class="tab" data-tab="roster">Rosa</button><button class="tab" data-tab="stats">Statistiche</button></div><div id="tab-table" class="tab-view active">${renderTable()}</div><div id="tab-calendar" class="tab-view">${renderCalendar()}</div><div id="tab-roster" class="tab-view">${renderSeasonRosterField()}</div><div id="tab-stats" class="tab-view">${renderStats()}</div></section></div><aside class="season-sidebar"><section class="panel season-availability-panel"><div class="label">Indisponibili</div><h3>Gestione formazione</h3>${renderAvailability()}<p style="font-size:12px"><b>Squalificato:</b> sostituzione automatica. <b>Infortunato:</b> può giocare con -20 Intesa oppure essere sostituito. Panchinaro fuori ruolo: -10 Intesa.</p></section><section class="panel season-lineup-panel"><div class="label">Formazione effettiva</div>${renderResolvedLineup()}</section><section class="panel opponent-club-panel season-opponent-panel" style="${teamCssVars(opp)}"><div class="label">Avversario reale</div><h3>${teamColorDot(opp)}${esc(opp.name)}</h3>${seasonRuleSummary()}${renderOpponentRoster(opp)}</section></aside></div>`;
 document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>resolveDecision(Number(b.dataset.choice)));
 bindSeasonEventControls();
 bindMeritStoryControls();
 bindError404StoryControls();
 bindFantaballopoliControls();
 document.querySelectorAll('[data-injured]').forEach(b=>b.onclick=()=>{const id=b.dataset.injured;state.playInjured[id]=!state.playInjured[id];save();render()});
 document.getElementById('playRoundLive').onclick=()=>playRound('live');
 document.getElementById('playRoundInstant').onclick=()=>playRound('instant');
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tab-view').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById('tab-'+b.dataset.tab).classList.add('active')})
}
function lineupEffects(entry,lineup){
 const player=entry.player||{};
 if(isEmergencyYouthEntry(entry))return {baseChem:0,eventChem:0,effectiveChem:0,active:0,malus:0,total:0,effects:[{label:'Primavera d’emergenza · OVR fisso 50',value:0,type:'neutral'}]};
 const players=(lineup||resolveLineup()).filter(item=>!isEmergencyYouthEntry(item)).map(item=>item.player).filter(Boolean);
 const closedPorts=closedPortsAffects(player);
 const rawBaseChem=Math.round(chemistryBaseRaw(player,players)||0);
 const baseChem=closedPorts?0:rawBaseChem;
 const eventChem=Math.round(activeChemistryEventBonus(player)||0);
 const multiplier=activeChemistryMultiplier(player);
 const zeroed=chemistryIsZeroed();
 const effectiveChem=Math.round(effectiveChemistryFromBase(player,baseChem)||0);
 const activeOvr=Math.round(activeOvrBonus(player)||0),coachOvr=Math.round(coachMatchOvrModifier()||0);
 const malus=Math.round(Number(entry.malus)||0);
 const effects=[];
 if(!closedPorts&&baseChem)effects.push({label:`Intesa base ${formatSignedIntesa(baseChem)}`,value:baseChem,type:baseChem>=0?'plus':'minus'});
 if(!closedPorts&&eventChem)effects.push({label:`Intesa evento ${formatSignedIntesa(eventChem)}`,value:eventChem,type:eventChem>=0?'plus':'minus'});
 if(closedPorts)effects.push({label:'Chiusi i porti · Intesa 0',value:-(rawBaseChem+eventChem),type:'minus'});
 else if(zeroed)effects.push({label:'Intesa azzerata',value:-baseChem-eventChem,type:'minus'});
 else if(multiplier>1)effects.push({label:`Intesa ×${multiplier}`,value:effectiveChem-(baseChem+eventChem),type:'plus'});
 if(activeOvr)effects.push({label:`OVR evento ${formatSignedIntesa(activeOvr)}`,value:activeOvr,type:activeOvr>=0?'plus':'minus'});
 if(coachOvr)effects.push({label:`Motivatore ${formatSignedIntesa(coachOvr)} OVR`,value:coachOvr,type:coachOvr>=0?'plus':'minus'});
 if(malus){
   const desc=malus===-20?'Infortunato':malus===-10?'Fuori ruolo':malus<0?'Malus':'Bonus';
   effects.push({label:`${desc} ${formatSignedIntesa(malus)}`,value:malus,type:malus>=0?'plus':'minus'});
 }
 const total=effectiveChem+activeOvr+coachOvr+malus;
 return {baseChem,eventChem,effectiveChem,active:activeOvr,coach:coachOvr,malus,total,effects};
}
function resolvedPlayerFinalOvr(entry,lineup){
 if(isEmergencyYouthEntry(entry))return 50;
 const player=entry?.player||{};
 const fx=lineupEffects(entry,lineup);
 const rawFinalOvr=Math.round(ductilityEffectiveBaseOvr(player)+fx.total);
 return fantaballopoliAllowsNegativeOvr()?rawFinalOvr:Math.max(1,rawFinalOvr);
}
function resolvedLineupAverage(lineup){const rows=(Array.isArray(lineup)?lineup:[]).filter(entry=>entry&&entry.player);return rows.length?avg(rows.map(entry=>resolvedPlayerFinalOvr(entry,rows))):0}
function renderResolvedLineup(){
 const lineup=resolveLineup(),emergencyYouthCount=lineup.filter(isEmergencyYouthEntry).length;
 return `${emergencyYouthCount?`<div class="season-rules-card"><b>${emergencyYouthCount} Primavera d’emergenza</b><br>Gli slot senza un giocatore reale valgono 50 OVR fisso e non ricevono bonus.</div>`:''}<div class="resolved-lineup-list">${lineup.map(entry=>{const player=entry.player||{};const fx=lineupEffects(entry,lineup);const sub=isSubscriber(player),creator=isCreator(player);const finalOvr=resolvedPlayerFinalOvr(entry,lineup);return `<div class="resolved-player-card ${sub?'subscriber-card':''} ${creator?'creator-card':''}"><span class="slot-code">${esc(entry.slot)}</span>${renderMiniAvatar(player,'small')}<div class="resolved-main"><div class="resolved-name-line"><b>${esc(player.name)}</b>${sub?'<span class="resolved-tag-sub">★ ABB</span>':''}${creator?'<span class="resolved-tag-creator">CREATOR</span>':''}</div><span class="resolved-meta">${entry.replaces?`Al posto di ${esc(entry.replaces)}`:`${esc(player.nation)} · ${esc(player.Position)}`}</span>${fx.effects.length?`<div class="resolved-effects">${fx.effects.map(effect=>`<span class="resolved-effect ${effect.type}">${esc(effect.label)}</span>`).join('')}</div>`:'<div class="resolved-effects"><span class="resolved-effect neutral">Nessun bonus o malus</span></div>'}</div><div class="resolved-ovr-col"><span class="chip ovr">${finalOvr}</span><span class="resolved-total">OVR finale</span></div></div>`}).join('')}</div>`
}
function renderTable(){const rows=sortedTable();return `<div class="season-table-scroll" role="region" aria-label="Classifica del campionato" tabindex="0"><table><thead><tr><th>Squadra</th><th>PG</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th><th>DR</th><th>Pt</th></tr></thead><tbody>${rows.map((r,i)=>{const team=teamById(r.id);return `<tr class="${r.id===USER_ID?'us-row':''}" style="${teamCssVars(team)}"><td><span class="standing-team">${teamColorDot(team)}<span>${i+1}. ${esc(r.name)}</span></span></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gf-r.ga}</td><td>${r.pts}</td></tr>`}).join('')}</tbody></table></div>`}
function renderCalendar(){return `<div class="calendar">${state.schedule.map((rd,i)=>{const fx=rd.find(m=>m.home===USER_ID||m.away===USER_ID),home=teamById(fx.home),away=teamById(fx.away),hist=state.history[i];return `<div class="calendar-row ${i===state.matchday?'current':''} ${i<state.matchday?'done':''}"><b>G ${i+1}</b><span class="calendar-clubs"><span class="calendar-team" style="${teamCssVars(home)}">${teamColorDot(home)}<span>${esc(home?.name||state.teamName)}</span></span><em>–</em><span class="calendar-team" style="${teamCssVars(away)}">${teamColorDot(away)}<span>${esc(away?.name||state.teamName)}</span></span></span><strong>${hist?`${Number.isFinite(Number(hist.displayGf))?Number(hist.displayGf):hist.gf}-${Number.isFinite(Number(hist.displayGa))?Number(hist.displayGa):hist.ga}${hist.penalties?' d.c.r.':''}`:'-'}</strong></div>`}).join('')}</div>`}
function renderStats(){const goals=Object.entries(state.stats.goals).sort((a,b)=>b[1]-a[1]).slice(0,10);const assists=Object.entries(state.stats.assists).sort((a,b)=>b[1]-a[1]).slice(0,10);return `<div class="setup-grid"><div><h3>Marcatori</h3>${goals.length?goals.map(([id,n],i)=>`<p><b>${i+1}. ${esc(statPlayerInfo(id).name)}</b> — ${n}</p>`).join(''):'<p>Nessun gol.</p>'}</div><div><h3>Assist</h3>${assists.length?assists.map(([id,n],i)=>`<p><b>${i+1}. ${esc(statPlayerInfo(id).name)}</b> — ${n}</p>`).join(''):'<p>Nessun assist.</p>'}</div></div>`}
function poisson(lambda){let L=Math.exp(-lambda),p=1,k=0;do{k++;p*=Math.random()}while(p>L&&k<12);return k-1}
function simulateScore(powerA,powerB,homeAdv=0,duration=90,scoringMultiplier=1){const minutes=Number(duration);if(Number.isFinite(minutes)&&minutes<=0)return[0,0];const scale=clamp((Number.isFinite(minutes)?minutes:90)/90,0,1.5)*clamp(Number(scoringMultiplier)||1,.1,2),la=clamp((1.25+(powerA-powerB)/18+homeAdv)*scale,.08,6),lb=clamp((1.15+(powerB-powerA)/18-homeAdv)*scale,.08,6);return[poisson(la),poisson(lb)]}
function weightedScorer(line){const pool=[];line.forEach(r=>{const role=roleOf(r.player),w=role==='A'?7:role==='C'?4:role==='D'?1:.15;for(let i=0;i<Math.ceil(w);i++)pool.push(r)});return pick(pool)}
function goalDescription(player,assist,teamName=state.teamName,opponentName='avversario'){
 const pos=positions(player)[0]||'ATT';
 const pool=(COMMENTARY?.positions?.[pos]||COMMENTARY?.positions?.ATT||['{marcatore} trova la rete.']);
 let sentence=pick(pool);
 if(!assist)sentence=pool.find(item=>!item.includes('{assist}'))||sentence;
 return String(sentence)
   .replaceAll('{marcatore}',player.name)
   .replaceAll('{assist}',assist?.name||'')
   .replaceAll('{squadra}',teamName||'squadra')
   .replaceAll('{avversario}',opponentName||'avversario');
}
function buildTeamGoals(total,lineup,team,opponent,forcedScorerIds=[],maxMinute=90,minMinute=0){
 const events=[];
 const safeLineup=(Array.isArray(lineup)?lineup:[]).filter(entry=>entry&&entry.player);
 const addGoal=scorer=>{
   if(!scorer)return;
   const others=safeLineup.filter(entry=>String(entry.playerId)!==String(scorer.playerId));
   const assist=Math.random()<.72&&others.length?pick(others):null;
   const scorerId=String(scorer.playerId||scorer.player?.id||'');
   const assistId=assist?String(assist.playerId||assist.player?.id||''):'';
   const end=Math.max(0,Math.floor(Number(maxMinute)||90)),start=clamp(Math.floor(Number(minMinute)||0),0,end),lower=Math.min(end,Math.max(1,start+1)),upper=Math.max(lower,end-2),minute=lower+Math.floor(Math.random()*Math.max(1,upper-lower+1));
   events.push({minute,playerId:scorerId,assistId,player:scorer.player.name,assist:assist?.player?.name||'',teamId:String(team?.id||''),teamName:team?.name||'',goalValue:goalValueForMinute(minute),description:goalDescription(scorer.player,assist?.player,team?.name||'',opponent?.name||'avversario')});
 };
 const forced=[...new Set((forcedScorerIds||[]).map(String))].map(id=>safeLineup.find(entry=>String(entry.playerId||entry.player?.id)===id)).filter(Boolean);
 forced.slice(0,Number(total||0)).forEach(addGoal);
 for(let index=events.length;index<Number(total||0);index++)addGoal(safeLineup.length?weightedScorer(safeLineup):null);
 return events.sort((a,b)=>a.minute-b.minute);
}
function buildUserGoals(total,lineup){
 const opponent=nextOpponentTeam();
 return buildTeamGoals(total,lineup,teamById(USER_ID)||{id:USER_ID,name:state.teamName},opponent||{name:'avversario'});
}

function incrementPlayerStat(bucket,id,amount=1){
 const key=String(id||'');
 if(!key)return;
 if(!state.stats||typeof state.stats!=='object')state.stats={};
 if(!state.stats[bucket]||typeof state.stats[bucket]!=='object')state.stats[bucket]={};
 state.stats[bucket][key]=(Number(state.stats[bucket][key])||0)+amount;
}
function rememberPlayerStatIdentity(player,team){
 const id=String(player?.id||'');
 if(!id)return;
 state.stats.playerNames[id]=player.name||state.stats.playerNames[id]||id;
 if(team){
   state.stats.playerTeams[id]=String(team.id||'');
   state.stats.playerTeamNames[id]=team.name||'';
 }
}
function safeMatchLineup(lineup){
 return (Array.isArray(lineup)?lineup:[]).map(entry=>({
   playerId:String(entry.playerId||entry.player?.id||''),
   name:entry.player?.name||'',
   slot:entry.slot||'',
   ovr:Number(entry.player?.ovr)||0,
   baseOvr:Number(originalBaseOvr(entry.player))||Number(entry.player?.ovr)||0
 }));
}
const AI_MATCH_SLOTS=['P','TS','DC','DC','TD','CDC','CC','COC','AS','ATT','AD'];
function leagueFormationKey(){const key=String(state.seasonRules?.leagueFormation||'');return FORMATIONS[key]?key:(FORMATIONS[state.formation]?state.formation:'4-3-3')}
function activeAiMatchSlots(team=null){const personal=String(team?.chaos?.formation||'');const key=FORMATIONS[personal]?personal:leagueFormationKey();return FORMATIONS[key]||AI_MATCH_SLOTS}
function teamMatchLineup(team){
 if(!team)return[];
 if(team.id===USER_ID)return resolveLineup();
 const pool=opponentAvailablePlayers(team);
 const used=new Set();
 return activeAiMatchSlots(team).map((slot,index)=>{
   const role=POSITION_ROLE[slot]||'C';
   let player=pool.find(candidate=>!used.has(String(candidate.id))&&compatible(candidate,slot));
   if(!player)player=pool.find(candidate=>!used.has(String(candidate.id))&&roleOf(candidate)===role);
   if(!player)player=pool.find(candidate=>!used.has(String(candidate.id)));
   if(!player)return makeEmergencyYouthEntry(slot,index,`ai-${team.id}`,`ai-${team.id}-${index}`);
   used.add(String(player.id));
   return {playerId:String(player.id),player,slot,slotId:`ai-${team.id}-${index}`,bench:false,malus:0};
 });
}
function playerPerformanceScores(lineup,goalsFor,goalsAgainst,events,won){
 const safeLineup=(Array.isArray(lineup)?lineup:[]).filter(entry=>entry&&entry.player);
 const goalCount={},assistCount={};
 (events||[]).forEach(event=>{
   if(event.playerId)goalCount[String(event.playerId)]=(goalCount[String(event.playerId)]||0)+1;
   if(event.assistId)assistCount[String(event.assistId)]=(assistCount[String(event.assistId)]||0)+1;
 });
 const cleanSheet=Number(goalsAgainst)===0;
 return safeLineup.map(entry=>{
   const id=String(entry.playerId||entry.player.id||'');
   const role=roleOf(entry.player);
   const goals=goalCount[id]||0;
   const assists=assistCount[id]||0;
   const cleanBonus=cleanSheet?(role==='P'?5:role==='D'?2:role==='C'?0.5:0):0;
   const resultBonus=won===true?1.5:won===null?0.5:0;
   const qualityTie=(Number(entry.player.ovr)||60)/100;
   const score=goals*6+assists*4+cleanBonus+resultBonus+qualityTie+Math.random()*.08;
   return {id,player:entry.player,entry,score,goals,assists};
 });
}
function applyDuctilityOutOfRoleGoalBoosts(team,lineup,events){
 if(!coachIs('ductility')||String(team?.id||'')!==String(USER_ID))return[];
 const safeLineup=(Array.isArray(lineup)?lineup:[]).filter(entry=>entry&&entry.player),counts={};
 (events||[]).forEach(event=>{const id=String(event?.playerId||'');if(id)counts[id]=(counts[id]||0)+1});
 const updates=[];
 Object.entries(counts).forEach(([id,count])=>{const entry=safeLineup.find(item=>String(item.playerId||item.player?.id||'')===id);if(!entry||!ductilityEntryIsOutOfRole(entry))return;const total=addDuctilityScorerOvr(id,count);updates.push({playerId:id,playerName:String(entry.player?.name||'Giocatore'),goals:count,gain:count,total,slot:String(entry.slot||''),naturalPositions:positions(entry.player).join(', ')});});
 return updates;
}
function recordTeamPlayerStats(team,lineup,goalsFor,goalsAgainst,events){
 const safeLineup=(Array.isArray(lineup)?lineup:[]).filter(entry=>entry&&entry.player);
 safeLineup.forEach(entry=>{
   const id=String(entry.playerId||entry.player.id||'');
   if(!id)return;
   incrementPlayerStat('appearances',id,1);
   rememberPlayerStatIdentity(entry.player,team);
 });
 (events||[]).forEach(event=>{
   if(event.playerId){incrementPlayerStat('goals',event.playerId,1);const player=safeLineup.find(item=>String(item.playerId)===String(event.playerId))?.player||playerById(event.playerId);rememberPlayerStatIdentity(player||{id:event.playerId,name:event.player},team)}
   if(event.assistId){incrementPlayerStat('assists',event.assistId,1);const player=safeLineup.find(item=>String(item.playerId)===String(event.assistId))?.player||playerById(event.assistId);rememberPlayerStatIdentity(player||{id:event.assistId,name:event.assist},team)}
 });
 const goalkeeper=safeLineup.find(entry=>entry.slot==='P'||roleOf(entry.player)==='P')||null;
 if(Number(goalsAgainst)===0&&goalkeeper)incrementPlayerStat('cleanSheets',goalkeeper.playerId||goalkeeper.player.id,1);
 const ductilityBoosts=applyDuctilityOutOfRoleGoalBoosts(team,safeLineup,events);
 return {goalkeeperId:goalkeeper?String(goalkeeper.playerId||goalkeeper.player.id||''):'',cleanSheet:Number(goalsAgainst)===0,ductilityBoosts};
}
function recordLeagueMatchPlayerStats({homeTeam,awayTeam,homeLineup,awayLineup,homeScore,awayScore,homeEvents,awayEvents}){
 const homeBase=recordTeamPlayerStats(homeTeam,homeLineup,homeScore,awayScore,homeEvents);
 const awayBase=recordTeamPlayerStats(awayTeam,awayLineup,awayScore,homeScore,awayEvents);
 const homeWon=homeScore>awayScore?true:homeScore===awayScore?null:false;
 const awayWon=awayScore>homeScore?true:awayScore===homeScore?null:false;
 const candidates=[
   ...playerPerformanceScores(homeLineup,homeScore,awayScore,homeEvents,homeWon).map(item=>({...item,team:homeTeam})),
   ...playerPerformanceScores(awayLineup,awayScore,homeScore,awayEvents,awayWon).map(item=>({...item,team:awayTeam}))
 ];
 const best=candidates.sort((a,b)=>b.score-a.score)[0]||null;
 if(best){
   incrementPlayerStat('mvpVotes',best.id,1);
   incrementPlayerStat('mvpPoints',best.id,Math.round(best.score*10)/10);
   rememberPlayerStatIdentity(best.player,best.team);
 }
 return {
   homeGoalkeeperId:homeBase.goalkeeperId,
   awayGoalkeeperId:awayBase.goalkeeperId,
   homeCleanSheet:homeBase.cleanSheet,
   awayCleanSheet:awayBase.cleanSheet,
   mvpId:best?.id||'',
   mvpScore:best?Math.round(best.score*10)/10:0,
   mvpTeamId:String(best?.team?.id||''),
   ductilityBoosts:String(homeTeam?.id||'')===String(USER_ID)?homeBase.ductilityBoosts:String(awayTeam?.id||'')===String(USER_ID)?awayBase.ductilityBoosts:[]
 };
}
function recordMatchPlayerStats(lineup,goalsFor,goalsAgainst,goalEvents){
 const team=teamById(USER_ID)||{id:USER_ID,name:state.teamName};
 const base=recordTeamPlayerStats(team,lineup,goalsFor,goalsAgainst,goalEvents);
 const best=playerPerformanceScores(lineup,goalsFor,goalsAgainst,goalEvents,goalsFor>goalsAgainst?true:goalsFor===goalsAgainst?null:false).sort((a,b)=>b.score-a.score)[0]||null;
 if(best){incrementPlayerStat('mvpVotes',best.id,1);incrementPlayerStat('mvpPoints',best.id,Math.round(best.score*10)/10);rememberPlayerStatIdentity(best.player,team)}
 return {goalkeeperId:base.goalkeeperId,cleanSheet:base.cleanSheet,mvpId:best?.id||'',mvpScore:best?Math.round(best.score*10)/10:0};
}
function statPlayerInfo(id){
 const key=String(id||'');
 const player=playerById(key)||rosterPlayers().find(entry=>String(entry.playerId)===key)?.player;
 if(player)return player;
 return {id:key,name:state.stats?.playerNames?.[key]||key||'Giocatore',nation:'',Position:'',role:'C',ovr:0,subscriber:'no'};
}
function statPlayerTeam(id){
 const key=String(id||'');
 const storedId=String(state.stats?.playerTeams?.[key]||'');
 const storedName=state.stats?.playerTeamNames?.[key]||'';
 const team=teamById(storedId);
 if(team)return team;
 const player=playerById(key);
 if(currentUserPlayerIds().includes(key))return teamById(USER_ID)||{id:USER_ID,name:state.teamName,colors:activeUserClub().colorClub};
 const club=clubById(player?.club||'');
 return club?{id:club.id,name:club.name,colors:club.colorClub}:storedName?{id:storedId,name:storedName}:null;
}
function rankedPlayerStat(bucket,limit=5,tieBucket=''){
 let source=state.stats?.[bucket]||{};
 const tie=state.stats?.[tieBucket]||{};
 if(bucket==='mvpVotes'&&!Object.values(source).some(value=>Number(value)>0)){
   const fallback={};
   const ids=new Set([...Object.keys(state.stats?.goals||{}),...Object.keys(state.stats?.assists||{})]);
   ids.forEach(id=>fallback[id]=(Number(state.stats?.goals?.[id])||0)*6+(Number(state.stats?.assists?.[id])||0)*4);
   source=fallback;
 }
 return Object.entries(source)
   .filter(([,value])=>Number(value)>0)
   .sort((a,b)=>(Number(b[1])||0)-(Number(a[1])||0)||(Number(tie[b[0]])||0)-(Number(tie[a[0]])||0)||String(statPlayerInfo(a[0]).name).localeCompare(String(statPlayerInfo(b[0]).name),'it'))
   .slice(0,limit);
}
function renderFinalStatList({title,icon,bucket,unit,tieBucket='',empty='Nessun dato disponibile.'}){
 const entries=rankedPlayerStat(bucket,5,tieBucket);
 const hasRealMvpVotes=Object.values(state.stats?.mvpVotes||{}).some(value=>Number(value)>0);
 const listHtml=entries.length?entries.map(([id,value],index)=>{
   const player=statPlayerInfo(id);
   const team=statPlayerTeam(id);
   const mvpFallback=bucket==='mvpVotes'&&!hasRealMvpVotes;
   const roleText=bucket==='cleanSheets'?'Portiere':esc(player.Position||roleOf(player));
   const teamLine=team?`${teamColorDot(team)}<span>${esc(team.name)}</span>`:'<span>Club non disponibile</span>';
   const extra=bucket==='mvpVotes'?(mvpFallback?'Indice calcolato da gol e assist':`Punteggio ${Number(state.stats.mvpPoints?.[id]||0).toFixed(1)}`):roleText;
   const shownUnit=mvpFallback?'pt':unit;
   return `<div class="final-player-stat-row ${index===0?'winner':''}"><span class="final-player-rank">${index+1}</span>${renderMiniAvatar(player,'small')}<div class="final-player-copy"><b>${esc(player.name)}</b><small class="final-player-team">${teamLine}</small><small>${extra}</small></div><strong>${Math.round(Number(value)||0)} <em>${esc(shownUnit)}</em></strong></div>`;
 }).join(''):`<div class="final-player-stat-empty">${esc(empty)}</div>`;
 return `<section class="final-player-stat-card"><div class="final-player-stat-head"><span class="final-player-stat-icon">${icon}</span><div><span>Top 5 campionato</span><h3>${esc(title)}</h3></div></div><div class="final-player-stat-list">${listHtml}</div></section>`;
}
function renderFinalPlayerStats(){
 return `<section class="final-player-stats"><div class="final-player-stats-title"><div><span>Premi individuali</span><h2>Statistiche generali</h2></div><p>Dati di tutti i giocatori dei ${state.teams.filter(team=>!isTeamEliminated(team.id)).length} club attivi in questa stagione nelle ${seasonLength()} giornate.</p></div><div class="final-player-stats-grid">${renderFinalStatList({title:'Capocannonieri',icon:'⚽',bucket:'goals',unit:'gol'})}${renderFinalStatList({title:'Assist-man',icon:'🎯',bucket:'assists',unit:'assist'})}${renderFinalStatList({title:'MVP',icon:'⭐',bucket:'mvpVotes',tieBucket:'mvpPoints',unit:'MVP',empty:'Nessun MVP assegnato.'})}${renderFinalStatList({title:'Porte inviolate',icon:'🧤',bucket:'cleanSheets',unit:'clean sheet',empty:'Nessuna porta inviolata.'})}</div></section>`;
}

function baseLeaguePoints(gf,ga){
 const scored=Number(gf)||0,conceded=Number(ga)||0;
 if(String(state.seasonRules?.fantaballaVideoRule)==='reverse-points'){if(scored>conceded)return 0;if(scored===conceded)return 1;return 3;}
 if(state.seasonRules.pointsEqualGoals)return Math.max(0,scored);
 const winPoints=Number.isFinite(Number(state.seasonRules.winPoints))?Math.max(0,Number(state.seasonRules.winPoints)):3;
 const drawPoints=Number.isFinite(Number(state.seasonRules.drawPoints))?Math.max(0,Number(state.seasonRules.drawPoints)):1;
 if(scored>conceded)return winPoints;
 if(scored===conceded)return state.seasonRules.zeroZeroNoPoints&&scored===0&&conceded===0?0:drawPoints;
 return 0;
}
function updateStanding(id,gf,ga,outcome={}){
 const s=state.standings[id];if(!s)return;const officialGf=Number(gf)||0,officialGa=Number(ga)||0,winnerId=String(outcome?.winnerId||''),resolved=matchOutcomeScores(officialGf,officialGa,winnerId,id);s.p++;s.gf+=officialGf;s.ga+=officialGa;if(resolved.gf>resolved.ga)s.w++;else if(resolved.gf===resolved.ga)s.d++;else s.l++;
 if(formulaOneRuleActive())return;
 if(bottomHelpRoundEligible(id)){s.pts+=bottomHelpPoints(officialGf,officialGa,winnerId,id);return;}
 const base=baseLeaguePoints(resolved.gf,resolved.ga),resultPoints=fgciResultRuleTarget(resolved.gf,resolved.ga,base);
 s.pts+=resultPoints+fgciPointsAdjustment(resolved.gf,resolved.ga);
}
function applyUserPointRules(gf,ga){
 if(formulaOneRuleActive())return{adjustment:0,awarded:0,note:'Formato Formula 1: i punti vengono assegnati dopo la simulazione completa della giornata.'};
 if(bottomHelpRoundEligible(USER_ID)){const points=bottomHelpPoints(gf,ga,state.lastResult?.winnerId||'',USER_ID);return{adjustment:0,awarded:points,note:`Aiuto dal fondo: eri dal 10° posto in giù prima della giornata e ricevi +${points} ${points===1?'punto':'punti'}.`};}
 const standing=userStanding(),base=baseLeaguePoints(gf,ga),standard=fgciResultRuleTarget(gf,ga,base),fgciAdjustment=fgciPointsAdjustment(gf,ga),fgciNote=fgciPointsRuleNote(gf,ga),resultRuleNote=fgciResultRuleNote(gf,ga),videoRuleNote=fantaballaVideoPointsNote(gf,ga);
 if(state.seasonRules.pointsEqualGoals&&String(state.seasonRules?.fantaballaVideoRule)!=='reverse-points')return{adjustment:0,awarded:standard+fgciAdjustment,note:[`Regolamento FGCI: ${base} punti, pari ai gol segnati.`,resultRuleNote,videoRuleNote,fgciNote].filter(Boolean).join(' ')};
 const globalWinPoints=Number.isFinite(Number(state.seasonRules.winPoints))?Math.max(0,Number(state.seasonRules.winPoints)):3;
 const globalDrawPoints=Number.isFinite(Number(state.seasonRules.drawPoints))?Math.max(0,Number(state.seasonRules.drawPoints)):1,zeroZero=Boolean(state.seasonRules.zeroZeroNoPoints&&Number(gf)===0&&Number(ga)===0);
 if(!standing)return{adjustment:0,awarded:standard+fgciAdjustment,note:[resultRuleNote,videoRuleNote,fgciNote].filter(Boolean).join(' ')};
 let target=standard,note=zeroZero&&!resultRuleNote?'Pareggio 0-0: nessun punto assegnato.':'';
 if(gf>ga){if(state.seasonRules.marottaDoubleWins)target=Math.max(target,6);const special=Math.max(0,...state.activeEffects.filter(effect=>effect.type==='winPoints').map(effect=>Number(effect.value)||0));target=Math.max(target,special);const questExtra=state.activeEffects.filter(effect=>effect.type==='extraWinPoint').reduce((sum,effect)=>sum+(Number(effect.value)||0),0);if(questExtra>0)target+=questExtra;if(target!==standard||globalWinPoints!==3)note=`Vittoria: +${target} punti${questExtra>0?' (bonus Calcio champagne incluso)':''}.`;}
 else if(gf===ga&&!zeroZero&&globalDrawPoints!==1&&!resultRuleNote){target=globalDrawPoints;note=`Pareggio: +${target} punti a entrambe le squadre.`;}
 else if(gf<ga&&Number(state.seasonRules.marottaLossPenalty)>0){target=-Number(state.seasonRules.marottaLossPenalty);note=`Penalità Marotta League: -${state.seasonRules.marottaLossPenalty} punti.`;}
 const adjustment=target-standard;standing.pts+=adjustment;return{adjustment,awarded:target+fgciAdjustment,note:[note,resultRuleNote,videoRuleNote,fgciNote].filter(Boolean).join(' ')};
}
function uniqueMatchMinute(min,max,used){
 const low=Math.max(1,Math.floor(min));
 const high=Math.max(low,Math.floor(max));
 for(let attempt=0;attempt<60;attempt++){
   const minute=low+Math.floor(Math.random()*(high-low+1));
   if(!used.has(minute)){used.add(minute);return minute;}
 }
 return low+Math.floor(Math.random()*(high-low+1));
}
function matchCommentaryPlayer(lineup,preferAttack=false){
 const safe=(Array.isArray(lineup)?lineup:[]).filter(entry=>entry&&entry.player);
 if(!safe.length)return null;
 if(preferAttack){
   const attack=safe.filter(entry=>['A','C'].includes(roleOf(entry.player)));
   if(attack.length)return weightedScorer(attack);
 }
 return pick(safe);
}
function matchGoalkeeper(lineup){
 const safe=(Array.isArray(lineup)?lineup:[]).filter(entry=>entry&&entry.player);
 return safe.find(entry=>entry.slot==='P'||roleOf(entry.player)==='P')||safe[0]||null;
}
function buildMatchCommentary({homeTeam,awayTeam,homeLineup,awayLineup,homeEvents,awayEvents,homePower,awayPower,redCandidate,ownRedEntry,userHome,duration=90,startMinute=0,pinkCard=false,opponentYellowRed=false,ownYellowRed=false,noDrawOutcome=null}){
 const totalMinutes=Math.max(30,Number(duration)||90),regulationMinutes=Math.max(30,Number(noDrawOutcome?.regulationDuration)||totalMinutes),hasExtraTime=Boolean(noDrawOutcome?.extraTime),half=Math.floor(regulationMinutes/2),restart=Math.min(regulationMinutes,half+1),matchStart=clamp(Math.floor(Number(startMinute)||0),0,regulationMinutes),kickoffMinute=matchStart>0?matchStart:1;
 const used=new Set([kickoffMinute,half,restart,totalMinutes]);
 [...(homeEvents||[]),...(awayEvents||[])].forEach(event=>used.add(Number(event.minute)||0));
 const timeline=[
   {minute:kickoffMinute,type:'kickoff',icon:matchStart>0?'⏩':'▶️',title:matchStart>0?'Bib Bip!':'Calcio d’inizio',text:matchStart>0?`La partita viene caricata direttamente al ${matchStart}° minuto: restano ${Math.max(0,regulationMinutes-matchStart)} minuti regolamentari.`:`Comincia ${homeTeam.name} – ${awayTeam.name}.`,teamId:''},
   ...(matchStart<half?[{minute:half,type:'halftime',icon:'⏸️',title:'Intervallo',text:'Le squadre rientrano negli spogliatoi.',teamId:''}]:[]),
   ...(matchStart<restart?[{minute:restart,type:'restart',icon:'▶️',title:'Secondo tempo',text:`Si riparte per gli ultimi ${Math.max(1,regulationMinutes-half)} minuti regolamentari.`,teamId:''}]:[]),
   ...(hasExtraTime?[{minute:regulationMinutes,type:'extra-time',icon:'⏱️',title:'Tempi supplementari',text:'La parità fa scattare altri 30 minuti.',teamId:''},{minute:regulationMinutes+15,type:'extra-half',icon:'⏸️',title:'Intervallo supplementari',text:'Finisce il primo tempo supplementare.',teamId:''},{minute:Math.min(totalMinutes,regulationMinutes+16),type:'extra-restart',icon:'▶️',title:'Secondo tempo supplementare',text:'Ultimi 15 minuti prima degli eventuali rigori.',teamId:''}]:[]),
   ...(noDrawOutcome?.penalties?[{minute:totalMinutes,type:'penalties',icon:'🎯',title:'Calci di rigore',text:`${homeTeam.name} ${Number(noDrawOutcome.penalties.home)||0}-${Number(noDrawOutcome.penalties.away)||0} ${awayTeam.name}: vince ${String(noDrawOutcome.penalties.winnerId)===String(homeTeam.id)?homeTeam.name:awayTeam.name}.`,teamId:''}]:[]),
   {minute:totalMinutes,type:pinkCard?'pink':'fulltime',icon:pinkCard?'🩷':'🏁',title:pinkCard?'Cartellino rosa':'Triplice fischio',text:pinkCard?'L’arbitro mostra il cartellino rosa: la partita termina immediatamente.':'La partita è terminata.',teamId:''}
 ];
 const addGoal=event=>timeline.push({
   minute:Number(event.minute)||kickoffMinute,
   type:'goal',icon:'⚽',teamId:String(event.teamId||''),goalValue:Math.max(1,Number(event.goalValue)||1),
   title:`${Number(event.goalValue)>1?'Gol doppio':'Gol'} di ${event.player}`,
   text:`${event.assist?`Assist di ${event.assist}. `:''}${event.description||'La palla finisce in rete.'}${Number(event.goalValue)>1?' Il gol vale doppio per il regolamento FGCI.':''}`,
   player:event.player||'',assist:event.assist||''
 });
 (homeEvents||[]).forEach(addGoal);(awayEvents||[]).forEach(addGoal);
 const homeGk=matchGoalkeeper(homeLineup)?.player,awayGk=matchGoalkeeper(awayLineup)?.player;
 const totalPower=Math.max(1,(Number(homePower)||60)+(Number(awayPower)||60)),remainingMinutes=Math.max(0,totalMinutes-matchStart);
 const actionCount=remainingMinutes<=0?0:Math.max(2,Math.min(13,Math.round((7+(homeEvents||[]).length+(awayEvents||[]).length)*(remainingMinutes/90))));
 const actionTypes=state.seasonRules?.yellowEqualsRed?['save','shot','corner','post','save','shot','var']:['save','shot','corner','post','save','shot','var','yellow'];
 for(let index=0;index<actionCount;index++){
   const homeAction=Math.random()<(Number(homePower)||60)/totalPower,team=homeAction?homeTeam:awayTeam,opponent=homeAction?awayTeam:homeTeam;
   const attackingLineup=homeAction?homeLineup:awayLineup,defendingLineup=homeAction?awayLineup:homeLineup;
   const attacker=matchCommentaryPlayer(attackingLineup,true)?.player,defender=matchCommentaryPlayer(defendingLineup,false)?.player,goalkeeper=homeAction?awayGk:homeGk;
   const min=Math.min(totalMinutes,Math.max(1,matchStart+1)),max=Math.max(min,totalMinutes-2),minute=uniqueMatchMinute(min,max,used),type=pick(actionTypes);
   if(type==='save')timeline.push({minute,type,icon:'🧤',teamId:String(team.id),title:'Parata decisiva',text:`${attacker?.name||team.name} trova lo spazio, ma ${goalkeeper?.name||'il portiere'} respinge.`});
   else if(type==='shot')timeline.push({minute,type,icon:'💨',teamId:String(team.id),title:'Occasione',text:`Conclusione di ${attacker?.name||team.name}: il pallone termina fuori di poco.`});
   else if(type==='corner')timeline.push({minute,type,icon:'🚩',teamId:String(team.id),title:'Calcio d’angolo',text:`Pressione di ${team.name}: la difesa di ${opponent.name} si rifugia in corner.`});
   else if(type==='post')timeline.push({minute,type,icon:'💥',teamId:String(team.id),title:'Legno!',text:`${attacker?.name||team.name} colpisce il palo. ${opponent.name} si salva.`});
   else if(type==='yellow')timeline.push({minute,type:'yellow',icon:'🟨',teamId:String(opponent.id),title:'Ammonizione',text:`Cartellino giallo per ${defender?.name||'un giocatore'} dopo un intervento in ritardo.`});
   else timeline.push({minute,type:'var',icon:'📺',teamId:'',title:'Controllo VAR',text:`Controllo su un contatto nell’area di ${opponent.name}: l’arbitro lascia proseguire.`});
 }
 const redMin=Math.min(totalMinutes,Math.max(1,matchStart+1)),redMax=Math.max(redMin,totalMinutes-1);
 if(redCandidate){const minute=uniqueMatchMinute(redMin,redMax,used);timeline.push({minute,type:'red',icon:'🟥',teamId:String(userHome?awayTeam.id:homeTeam.id),title:opponentYellowRed?'Giallo trasformato in rosso':'Espulsione',text:opponentYellowRed?`Cartellino giallo per ${redCandidate.name}: con la nuova regola diventa espulsione immediata.`:`Rosso diretto per ${redCandidate.name}. ${redCandidate.name} lascia la propria squadra in dieci.`});}
 if(ownRedEntry){const minute=uniqueMatchMinute(redMin,redMax,used);timeline.push({minute,type:'red',icon:'🟥',teamId:String(userHome?homeTeam.id:awayTeam.id),title:ownYellowRed?'Giallo trasformato in rosso':'Espulsione',text:ownYellowRed?`Cartellino giallo per ${ownRedEntry.player?.name||'un giocatore'}: la regola Giallo=Rosso provoca l’espulsione.`:`Cartellino rosso per ${ownRedEntry.player?.name||'un giocatore'}.`});}
 const priority={kickoff:0,goal:2,red:3,yellow:4,save:5,post:5,shot:5,corner:5,var:6,halftime:9,restart:10,'extra-time':11,'extra-half':12,'extra-restart':13,penalties:97,pink:98,fulltime:99};
 timeline.sort((a,b)=>a.minute-b.minute||((priority[a.type]??5)-(priority[b.type]??5)));
 let homeScore=0,awayScore=0;
 timeline.forEach(event=>{if(event.type==='goal'){const value=Math.max(1,Number(event.goalValue)||1);if(String(event.teamId)===String(homeTeam.id))homeScore+=value;else if(String(event.teamId)===String(awayTeam.id))awayScore+=value;event.scoreAfter=`${homeScore}–${awayScore}`;}else if(['halftime','extra-time','extra-half','penalties','pink','fulltime'].includes(event.type))event.scoreAfter=`${homeScore}–${awayScore}`;});
 return timeline;
}
function commentaryEventTeam(event,homeTeam,awayTeam){
 if(String(event?.teamId)===String(homeTeam?.id))return homeTeam;
 if(String(event?.teamId)===String(awayTeam?.id))return awayTeam;
 return null;
}
function commentaryRowHtml(event,homeTeam,awayTeam){
 const team=commentaryEventTeam(event,homeTeam,awayTeam);
 const neutral=!team;
 const eventClass=event.type==='goal'?'goal-event':['red','yellow','pink'].includes(event.type)?'card-event':'';
 return `<article class="match-commentary-row ${neutral?'neutral-event':''} ${eventClass}" style="${team?teamCssVars(team):''}"><span class="commentary-minute">${esc(event.minute)}'</span><span class="commentary-icon">${event.icon||'•'}</span><div class="commentary-copy"><b>${esc(event.title||'Azione')}</b><span>${esc(event.text||'')}</span></div>${event.scoreAfter?`<strong class="commentary-score">${esc(event.scoreAfter)}</strong>`:''}</article>`;
}
function playLiveMatch({commentary,homeTeam,awayTeam,homeGoals,awayGoals,matchday,duration=90,startMinute=0,label=''},finishRound){
 let index=0,timer=null,closed=false,paused=false,homeScore=0,awayScore=0,currentMinute=0;
 const totalMinutes=Math.max(30,Number(duration)||90),openingMinute=clamp(Math.floor(Number(startMinute)||0),0,totalMinutes);
 modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal live-match-modal" role="dialog" aria-modal="true"><header class="live-match-head"><div class="live-match-headline"><div><div class="label">${esc(label||`Giornata ${matchday}`)}</div><b>Cronaca della partita</b></div><span class="live-status">Live</span></div></header><div class="live-scoreboard"><div class="live-team" style="${teamCssVars(homeTeam)}"><span class="live-team-colors"></span><b title="${esc(homeTeam.name)}">${esc(homeTeam.name)}</b></div><div class="live-score"><span id="liveHomeScore">0</span><em>–</em><span id="liveAwayScore">0</span></div><div class="live-team" style="${teamCssVars(awayTeam)}"><span class="live-team-colors"></span><b title="${esc(awayTeam.name)}">${esc(awayTeam.name)}</b></div></div><div class="live-clock-wrap"><span id="liveClock" class="live-clock">0'</span><div class="live-progress"><i id="liveProgress"></i></div></div><div id="liveCommentary" class="live-commentary"><div class="live-empty">La partita sta per iniziare…</div></div><footer class="live-match-controls"><button id="pauseLiveMatch" class="btn secondary-strong" type="button">⏸ Pausa</button><button id="skipLiveMatch" class="btn match-instant-button" type="button">⚡ Simula il resto</button></footer></section></div>`;
 const commentaryBox=document.getElementById('liveCommentary'),clock=document.getElementById('liveClock'),progress=document.getElementById('liveProgress'),homeScoreNode=document.getElementById('liveHomeScore'),awayScoreNode=document.getElementById('liveAwayScore'),pauseButton=document.getElementById('pauseLiveMatch');
 currentMinute=openingMinute;
 const schedule=(callback,delay)=>{if(closed||paused)return;if(timer)clearTimeout(timer);timer=setTimeout(callback,delay)};
 const updateClock=minute=>{currentMinute=clamp(Math.floor(Number(minute)||0),0,totalMinutes);clock.textContent=`${currentMinute}'`;progress.style.width=`${currentMinute/totalMinutes*100}%`};
 const complete=()=>{if(closed)return;closed=true;if(timer)clearTimeout(timer);homeScoreNode.textContent=String(homeGoals);awayScoreNode.textContent=String(awayGoals);updateClock(totalMinutes);pauseButton.disabled=true;setTimeout(finishRound,1500)};
 const eventReadingDelay=event=>event.type==='goal'?3600:event.type==='red'?3200:event.type==='yellow'||event.type==='var'?2800:event.type==='halftime'||event.type==='pink'||event.type==='fulltime'?3000:2500;
 const clockTickDelay=()=>150;
 const showEvent=event=>{if(index===1)commentaryBox.innerHTML='';if(event.type==='goal'){const value=Math.max(1,Number(event.goalValue)||1);if(String(event.teamId)===String(homeTeam.id))homeScore+=value;else if(String(event.teamId)===String(awayTeam.id))awayScore+=value;homeScoreNode.textContent=String(homeScore);awayScoreNode.textContent=String(awayScore)}updateClock(event.minute);commentaryBox.insertAdjacentHTML('beforeend',commentaryRowHtml(event,homeTeam,awayTeam));commentaryBox.scrollTop=commentaryBox.scrollHeight;schedule(advanceClock,eventReadingDelay(event))};
 function advanceClock(){if(closed||paused)return;const event=commentary[index];if(!event){if(currentMinute<totalMinutes){updateClock(currentMinute+1);schedule(advanceClock,clockTickDelay())}else complete();return}const eventMinute=clamp(Math.floor(Number(event.minute)||currentMinute),0,totalMinutes);if(currentMinute<eventMinute){updateClock(currentMinute+1);schedule(advanceClock,clockTickDelay());return}index++;showEvent(event)}
 pauseButton.onclick=()=>{paused=!paused;if(paused){if(timer)clearTimeout(timer);pauseButton.textContent='▶ Riprendi'}else{pauseButton.textContent='⏸ Pausa';schedule(advanceClock,500)}};
 updateClock(openingMinute);document.getElementById('skipLiveMatch').onclick=complete;schedule(advanceClock,900);
}
function playRound(mode='instant'){
 if(state.pendingEvent&&!state.pendingEvent.resolved)return;
 prepareBottomHelpRound();
 rememberFinalDayLeaderForAchievements();
 const fixture=userFixture(),error404Corrupted=error404CorruptionActive(),formulaOneInjuryWalkover=formulaOneInjuryWalkoverForMatch(fixture.home,fixture.away),baseMatchMinutes=currentMatchDuration();let matchMinutes=pinkCardMatchDuration(baseMatchMinutes);const spaceJamTiming=spaceJamMatchTiming(matchMinutes),matchStartMinute=spaceJamTiming.startMinute,matchSimulationMinutes=spaceJamTiming.remainingMinutes,spaceJamScheduledDuration=matchMinutes,pinkCardMinute=!error404Corrupted&&state.seasonRules?.pinkCardEndsMatch?matchMinutes:0;
 const userTeam=teamById(USER_ID)||{id:USER_ID,name:state.teamName,colors:activeUserClub().colorClub};
 const opponent=teamById(fixture.home===USER_ID?fixture.away:fixture.home),questOpponentTop3Before=questOpponentIsTopThree(opponent?.id),lineup=resolveLineup(),opponentLineup=teamMatchLineup(opponent),baseUserPower=matchPower(),userHome=fixture.home===USER_ID,hungerWalkover=!error404Corrupted&&isTeamEliminated(opponent?.id);
 const fantaballopoliRule=fantaballopoliMatchRule(),fantaballopoliRisks=formulaOneInjuryWalkover?{expelled:[],injured:[],powerPenalty:0}:applyFantaballopoliOpponentRisks(opponent,opponentLineup,fantaballopoliRule);
 const guaranteedRed=state.activeEffects.some(effect=>effect.type==='opponentRedCard'),chaos=state.activeEffects.filter(effect=>effect.type==='refChaos'),longRisk=Boolean(state.seasonRules.longMatchRisk&&matchMinutes===120);
 const opponentRedChance=Math.min(1,(guaranteedRed?1:Math.max(0,...chaos.map(effect=>Number(effect.opponentRedChance)||0)))+(longRisk?0.15:0));
 const ownRedChance=Math.min(1,Math.max(0,...chaos.map(effect=>Number(effect.ownRedChance??effect.ownSuspensionChance)||0))+(longRisk?0.25:0));
 const opponentYellowRed=Boolean(!formulaOneInjuryWalkover&&state.seasonRules?.yellowEqualsRed&&Math.random()<.45),ownYellowRed=Boolean(!formulaOneInjuryWalkover&&!parallelCupDisciplineImmunity()&&state.seasonRules?.yellowEqualsRed&&Math.random()<.45);
 const redCandidate=formulaOneInjuryWalkover?null:(fantaballopoliRisks.expelled[0]?.player||((opponentYellowRed||Math.random()<opponentRedChance)?pick(opponentLineup.map(entry=>entry.player).filter(Boolean)):null)),ownRedEntry=formulaOneInjuryWalkover||parallelCupDisciplineImmunity()?null:((ownYellowRed||Math.random()<ownRedChance)?pick(lineup.filter(entry=>entry&&entry.player)):null);
 if(opponentYellowRed&&redCandidate){const status=opponentStatusOf(opponent,redCandidate.id);status.suspension=Math.max(2,status.suspension)}
 const opponentEventOvr=state.activeEffects.filter(effect=>effect.type==='opponentOvr').reduce((sum,effect)=>sum+(Number(effect.value)||0),0);
 const deathMatchBonus=String(state.seasonRules.deathMatchClubId||'')===String(opponent?.id||'')?Math.max(0,Number(state.seasonRules.deathMatchClubBonus)||10):0;
 const opponentPower=Math.max(1,opponentMatchPower(opponent)+opponentEventOvr+deathMatchBonus-(redCandidate?10:0)-fantaballopoliRisks.powerPenalty),userPower=Math.max(35,baseUserPower-(ownRedEntry?10:0));
 const smallGoalMultiplier=state.activeEffects.filter(effect=>effect.type==='smallGoals').reduce((value,effect)=>value*clamp(Number(effect.value)||.65,.1,1),1);
 const varRandomResult=error404Corrupted||state.activeEffects.some(effect=>effect.type==='varRandomResult');
 let [homeBase,awayBase]=varRandomResult
   ? [Math.floor(Math.random()*6),Math.floor(Math.random()*6)]
   : simulateScore(userHome?userPower:opponentPower,userHome?opponentPower:userPower,curvaContestHomeAdvantage(userHome),matchSimulationMinutes,smallGoalMultiplier);
 let goalsFor=userHome?homeBase:awayBase,goalsAgainst=userHome?awayBase:homeBase;
 const forcedLoss=!error404Corrupted&&(state.activeEffects.some(effect=>effect.type==='forcedLoss')||fantaballopoliRule.forcedLoss),forcedWin=!error404Corrupted&&(state.activeEffects.some(effect=>effect.type==='forcedWin')||fantaballopoliRule.forcedWin),maxDraw=!error404Corrupted&&state.activeEffects.some(effect=>effect.type==='maxDraw'),forcedScoreEffect=!error404Corrupted?(state.activeEffects.find(effect=>effect.type==='forcedScore')||null):null;
 const capValues=state.activeEffects.filter(effect=>effect.type==='goalCap').map(effect=>Number(effect.value)).filter(Number.isFinite);
 if(capValues.length)goalsFor=Math.min(goalsFor,Math.min(...capValues));
 const forcedSubscribers=!error404Corrupted&&state.activeEffects.some(effect=>effect.type==='forceSubscriberGoals')?lineup.filter(entry=>isSubscriber(entry.player)).map(entry=>String(entry.playerId)):[];
 if(forcedSubscribers.length)goalsFor=Math.max(goalsFor,forcedSubscribers.length);
 const defensiveRules=state.activeEffects.filter(effect=>effect.type==='cleanSheet'||effect.type==='minimumGoalsAgainst');if(defensiveRules.length){const lastRule=defensiveRules[defensiveRules.length-1];goalsAgainst=lastRule.type==='cleanSheet'?0:Math.max(goalsAgainst,Number(lastRule.value)||1)}
 if(forcedWin&&goalsFor<=goalsAgainst)goalsFor=goalsAgainst+1;if(forcedLoss&&goalsFor>=goalsAgainst)goalsAgainst=goalsFor+1;if(maxDraw&&goalsFor>goalsAgainst)goalsAgainst=goalsFor;if(state.activeEffects.some(effect=>effect.type==='noGoals'))goalsFor=0;
 if(forcedScoreEffect){goalsFor=Math.max(0,Number.isFinite(Number(forcedScoreEffect.gf))?Number(forcedScoreEffect.gf):6);goalsAgainst=Math.max(0,Number.isFinite(Number(forcedScoreEffect.ga))?Number(forcedScoreEffect.ga):0)}
 if(hungerWalkover){goalsFor=3;goalsAgainst=0}
 if(chaosEnabled()&&!hungerWalkover&&!error404Corrupted)[goalsFor,goalsAgainst]=applyChaosOpponentToUserScore(opponent,goalsFor,goalsAgainst);
 if(error404Corrupted){goalsFor=error404RandomScore();goalsAgainst=error404RandomScore()}
 const userGoalEvents=buildTeamGoals(goalsFor,lineup,userTeam,opponent,forcedSubscribers,matchMinutes,matchStartMinute),opponentGoalEvents=buildTeamGoals(goalsAgainst,opponentLineup,opponent,userTeam,[],matchMinutes,matchStartMinute);
 const futureGoal=!formulaOneInjuryWalkover&&!error404Corrupted?futureScorerGoalEvent(userTeam,opponent,matchMinutes):null;if(futureGoal&&!hungerWalkover&&!forcedScoreEffect)userGoalEvents.push(futureGoal);
 const meritStoryGoal=!formulaOneInjuryWalkover&&!error404Corrupted&&!hungerWalkover?applyMeritGuaranteedGoal(userGoalEvents,lineup,userTeam,opponent,matchMinutes):false;
 if(!formulaOneInjuryWalkover&&!error404Corrupted)applyChickenGoalRule(userGoalEvents);
 if(forcedScoreEffect){userGoalEvents.forEach(event=>event.goalValue=1);opponentGoalEvents.forEach(event=>event.goalValue=1)}
 if(!error404Corrupted&&state.seasonRules.redCardGoals&&!forcedScoreEffect){if(ownRedEntry){const redGoal=regulationGoalEvent(userTeam,opponent,matchMinutes,'Gol da espulsione');redGoal.isRedCardGoal=true;userGoalEvents.push(redGoal)}if(redCandidate){const redGoal=regulationGoalEvent(opponent,userTeam,matchMinutes,'Gol da espulsione');redGoal.isRedCardGoal=true;opponentGoalEvents.push(redGoal)}}
 const coachGuarantees=(formulaOneInjuryWalkover||hungerWalkover||error404Corrupted)?{for:false,against:false,average:coachRosterAverageOvr()}:applyCoachGoalGuarantees(userGoalEvents,opponentGoalEvents,lineup,opponentLineup,userTeam,opponent,matchMinutes);
 const secretRefereePenalty=!formulaOneInjuryWalkover&&!hungerWalkover&&!error404Corrupted?applySecretRefereePenalty(userGoalEvents,opponentGoalEvents,lineup,opponentLineup,userTeam,opponent,matchMinutes):'';
 normalizeGoalEventsToWindow(userGoalEvents,matchStartMinute,matchMinutes);normalizeGoalEventsToWindow(opponentGoalEvents,matchStartMinute,matchMinutes);userGoalEvents.sort((a,b)=>a.minute-b.minute);opponentGoalEvents.sort((a,b)=>a.minute-b.minute);
 const federationOutcome=(!formulaOneInjuryWalkover&&!error404Corrupted&&!hungerWalkover&&!forcedScoreEffect)?applyFederationGoalRuleToEvents(userGoalEvents,opponentGoalEvents,userTeam,opponent):null;
 goalsFor=federationOutcome?federationOutcome.scoreA:scoreGoalEvents(userGoalEvents);goalsAgainst=federationOutcome?federationOutcome.scoreB:scoreGoalEvents(opponentGoalEvents);
 if(capValues.length)goalsFor=Math.min(goalsFor,Math.min(...capValues));
 if(forcedWin&&goalsFor<=goalsAgainst)goalsFor=goalsAgainst+1;if(forcedLoss&&goalsFor>=goalsAgainst)goalsAgainst=goalsFor+1;if(maxDraw&&goalsFor>goalsAgainst)goalsAgainst=goalsFor;
 if(forcedScoreEffect){goalsFor=Math.max(0,Number.isFinite(Number(forcedScoreEffect.gf))?Number(forcedScoreEffect.gf):6)+(secretRefereePenalty==='for'?1:0);goalsAgainst=Math.max(0,Number.isFinite(Number(forcedScoreEffect.ga))?Number(forcedScoreEffect.ga):0)+(secretRefereePenalty==='against'?1:0)}
 if(meritStoryGoal)goalsFor=Math.max(goalsFor,scoreGoalEvents(userGoalEvents));
 if(hungerWalkover){goalsFor=3;goalsAgainst=0}
 if(!formulaOneInjuryWalkover&&!error404Corrupted&&!federationOutcome&&!hungerWalkover&&coachIs('salvation')){
   const coachAverage=coachRosterAverageOvr();
   if(coachAverage<70){
     if(!userGoalEvents.some(event=>event?.isCoachGoal))userGoalEvents.push(coachGuaranteedGoalEvent(lineup,userTeam,opponent,matchMinutes,'Mister salvezza aggiunge un gol alla squadra.'));
     userGoalEvents.sort((a,b)=>a.minute-b.minute);goalsFor=scoreGoalEvents(userGoalEvents);coachGuarantees.for=true;
   }
   if(coachAverage>80&&goalsAgainst<1){
     if(scoreGoalEvents(opponentGoalEvents)<1)opponentGoalEvents.push(coachGuaranteedGoalEvent(opponentLineup,opponent,userTeam,matchMinutes,'Il malus di Mister salvezza garantisce almeno un gol subito.'));
     opponentGoalEvents.sort((a,b)=>a.minute-b.minute);goalsAgainst=Math.max(1,scoreGoalEvents(opponentGoalEvents));coachGuarantees.against=true;
   }
 }
 let champagneDrawLoss=false;if(!formulaOneInjuryWalkover&&!error404Corrupted&&!hungerWalkover&&goalsFor===goalsAgainst&&state.activeEffects.some(effect=>effect.type==='drawBecomesLoss')){const punishmentGoal=regulationGoalEvent(opponent,userTeam,matchMinutes);opponentGoalEvents.push(punishmentGoal);opponentGoalEvents.sort((a,b)=>a.minute-b.minute);goalsAgainst=scoreGoalEvents(opponentGoalEvents);champagneDrawLoss=true;}
 let allegriGoalsRemoved=0;if(!formulaOneInjuryWalkover&&!error404Corrupted&&!hungerWalkover&&String(state.seasonRules?.italiaCatenaccioRule)==='allegri'){const before=Math.max(goalsFor,scoreGoalEvents(userGoalEvents));goalsFor=capGoalEvents(userGoalEvents,1);allegriGoalsRemoved=Math.max(0,before-goalsFor);}
 if(!formulaOneInjuryWalkover&&!error404Corrupted&&fantaballopoliRule.negativeOpponentGoals){goalsAgainst=-1;opponentGoalEvents.length=0;}
 normalizeGoalEventsToWindow(userGoalEvents,matchStartMinute,matchMinutes);normalizeGoalEventsToWindow(opponentGoalEvents,matchStartMinute,matchMinutes);const fantaballaVideoOutcome=formulaOneInjuryWalkover||error404Corrupted?{scoreA:goalsFor,scoreB:goalsAgainst,note:''}:applyFantaballaVideoScoreRule(goalsFor,goalsAgainst,userGoalEvents,opponentGoalEvents,userTeam,opponent,matchMinutes);goalsFor=fantaballaVideoOutcome.scoreA;goalsAgainst=fantaballaVideoOutcome.scoreB;
 const formulaOneWalkoverView=formulaOneWalkoverUserView(formulaOneInjuryWalkover,userHome);let noDrawOutcome,officialGoalsFor,officialGoalsAgainst;
 if(formulaOneWalkoverView){userGoalEvents.length=0;opponentGoalEvents.length=0;goalsFor=formulaOneWalkoverView.gf;goalsAgainst=formulaOneWalkoverView.ga;noDrawOutcome={scoreA:goalsFor,scoreB:goalsAgainst,outcomeScoreA:goalsFor,outcomeScoreB:goalsAgainst,winnerId:String(formulaOneWalkoverView.winnerId||''),extraTime:false,penalties:null,duration:matchMinutes,regulationDuration:matchMinutes,note:''};officialGoalsFor=goalsFor;officialGoalsAgainst=goalsAgainst;}
 else{noDrawOutcome=error404Corrupted?error404Outcome(goalsFor,goalsAgainst,userTeam,opponent,matchMinutes):resolveNoDrawMatch({scoreA:goalsFor,scoreB:goalsAgainst,eventsA:userGoalEvents,eventsB:opponentGoalEvents,lineupA:lineup,lineupB:opponentLineup,teamA:userTeam,teamB:opponent,powerA:userPower,powerB:opponentPower,duration:matchMinutes});officialGoalsFor=noDrawOutcome.scoreA;officialGoalsAgainst=noDrawOutcome.scoreB;goalsFor=noDrawOutcome.outcomeScoreA;goalsAgainst=noDrawOutcome.outcomeScoreB;matchMinutes=noDrawOutcome.duration;}
 let homeGoals=userHome?officialGoalsFor:officialGoalsAgainst,awayGoals=userHome?officialGoalsAgainst:officialGoalsFor;
 const homeTeam=userHome?userTeam:opponent,awayTeam=userHome?opponent:userTeam,homeLineup=userHome?lineup:opponentLineup,awayLineup=userHome?opponentLineup:lineup,homeEvents=userHome?userGoalEvents:opponentGoalEvents,awayEvents=userHome?opponentGoalEvents:userGoalEvents;
 const homeNoDrawOutcome={...noDrawOutcome,scoreA:homeGoals,scoreB:awayGoals,outcomeScoreA:userHome?noDrawOutcome.outcomeScoreA:noDrawOutcome.outcomeScoreB,outcomeScoreB:userHome?noDrawOutcome.outcomeScoreB:noDrawOutcome.outcomeScoreA,penalties:noDrawOutcome.penalties?(userHome?noDrawOutcome.penalties:{home:noDrawOutcome.penalties.away,away:noDrawOutcome.penalties.home,winnerId:noDrawOutcome.penalties.winnerId}):null};
 const commentary=formulaOneWalkoverView?[{minute:0,type:'fulltime',icon:'🚑',title:'Partita non disputata',text:formulaOneWalkoverView.doubleForfeit?'Entrambe le squadre hanno almeno un infortunato: doppia sconfitta 0-3 a tavolino.':formulaOneWalkoverView.userForfeit?'La tua squadra ha almeno un infortunato e perde 0-3 a tavolino.':'Gli avversari hanno almeno un infortunato: vittoria 3-0 a tavolino.',teamId:'',scoreAfter:`${homeGoals}–${awayGoals}`}]:buildMatchCommentary({homeTeam,awayTeam,homeLineup,awayLineup,homeEvents,awayEvents,homePower:userHome?userPower:opponentPower,awayPower:userHome?opponentPower:userPower,redCandidate,ownRedEntry,userHome,duration:matchMinutes,startMinute:matchStartMinute,pinkCard:Boolean(pinkCardMinute),opponentYellowRed,ownYellowRed,noDrawOutcome:homeNoDrawOutcome});
 let committed=false;
 const finishRound=()=>{
   if(committed)return;committed=true;const roundResults=[];let userAwards=null,userPoints={adjustment:0,awarded:0,note:''},formulaOneRound={ranking:[],user:null};
   currentRound().forEach(match=>{
     const roundHomeTeam=teamById(match.home),roundAwayTeam=teamById(match.away),roundFormulaWalkover=match===fixture?formulaOneInjuryWalkover:formulaOneInjuryWalkoverForMatch(match.home,match.away);let homeScore,awayScore,roundHomeLineup,roundAwayLineup,roundHomeEvents,roundAwayEvents,roundWinnerId='',roundNoDrawOutcome=null,roundDurationUsed=90,roundStartMinute=0;
     if(match===fixture){homeScore=homeGoals;awayScore=awayGoals;roundHomeLineup=homeLineup;roundAwayLineup=awayLineup;roundHomeEvents=homeEvents;roundAwayEvents=awayEvents;roundWinnerId=String(noDrawOutcome.winnerId||'');roundNoDrawOutcome=homeNoDrawOutcome;roundDurationUsed=spaceJamScheduledDuration;roundStartMinute=matchStartMinute;}
     else{
       roundHomeLineup=teamMatchLineup(roundHomeTeam);roundAwayLineup=teamMatchLineup(roundAwayTeam);
       const homeEliminated=isTeamEliminated(match.home),awayEliminated=isTeamEliminated(match.away);
       if(roundFormulaWalkover){homeScore=roundFormulaWalkover.homeScore;awayScore=roundFormulaWalkover.awayScore;roundHomeEvents=[];roundAwayEvents=[];roundWinnerId=String(roundFormulaWalkover.winnerId||'');roundNoDrawOutcome={scoreA:homeScore,scoreB:awayScore,outcomeScoreA:homeScore,outcomeScoreB:awayScore,winnerId:roundWinnerId,extraTime:false,penalties:null,duration:90,regulationDuration:90,note:''};}
       else if(error404Corrupted){homeScore=error404RandomScore();awayScore=error404RandomScore();roundHomeEvents=buildTeamGoals(homeScore,roundHomeLineup,roundHomeTeam,roundAwayTeam,[],90);roundAwayEvents=buildTeamGoals(awayScore,roundAwayLineup,roundAwayTeam,roundHomeTeam,[],90);roundNoDrawOutcome=error404Outcome(homeScore,awayScore,roundHomeTeam,roundAwayTeam,90);roundWinnerId=String(roundNoDrawOutcome.winnerId||'');}
       else if(homeEliminated||awayEliminated){homeScore=homeEliminated&&!awayEliminated?0:awayEliminated&&!homeEliminated?3:0;awayScore=awayEliminated&&!homeEliminated?0:homeEliminated&&!awayEliminated?3:0;roundHomeEvents=homeScore?buildTeamGoals(homeScore,roundHomeLineup,roundHomeTeam,roundAwayTeam,[],90):[];roundAwayEvents=awayScore?buildTeamGoals(awayScore,roundAwayLineup,roundAwayTeam,roundHomeTeam,[],90):[];}
       else{const roundDuration=pinkCardMatchDuration(90),roundTiming=spaceJamMatchTiming(roundDuration),roundSimulationDuration=roundTiming.remainingMinutes;roundDurationUsed=roundDuration;roundStartMinute=roundTiming.startMinute;const homeYellowRed=Boolean(state.seasonRules?.yellowEqualsRed&&Math.random()<.45),awayYellowRed=Boolean(state.seasonRules?.yellowEqualsRed&&Math.random()<.45);let base=simulateScore(Math.max(35,opponentMatchPower(roundHomeTeam)-(homeYellowRed?10:0)),Math.max(35,opponentMatchPower(roundAwayTeam)-(awayYellowRed?10:0)),.18,roundSimulationDuration);if(chaosEnabled())base=applyChaosScoreRules(roundHomeTeam,roundAwayTeam,base[0],base[1]);roundHomeEvents=buildTeamGoals(base[0],roundHomeLineup,roundHomeTeam,roundAwayTeam,[],roundDuration,roundStartMinute);roundAwayEvents=buildTeamGoals(base[1],roundAwayLineup,roundAwayTeam,roundHomeTeam,[],roundDuration,roundStartMinute);if(homeYellowRed){const sentOff=pick(roundHomeLineup.filter(entry=>entry?.player));if(sentOff)opponentStatusOf(roundHomeTeam,sentOff.playerId).suspension=Math.max(2,opponentStatusOf(roundHomeTeam,sentOff.playerId).suspension)}if(awayYellowRed){const sentOff=pick(roundAwayLineup.filter(entry=>entry?.player));if(sentOff)opponentStatusOf(roundAwayTeam,sentOff.playerId).suspension=Math.max(2,opponentStatusOf(roundAwayTeam,sentOff.playerId).suspension)}if(state.seasonRules.redCardGoals){if(homeYellowRed||Math.random()<.07)roundHomeEvents.push(regulationGoalEvent(roundHomeTeam,roundAwayTeam,roundDuration));if(awayYellowRed||Math.random()<.07)roundAwayEvents.push(regulationGoalEvent(roundAwayTeam,roundHomeTeam,roundDuration));}normalizeGoalEventsToWindow(roundHomeEvents,roundStartMinute,roundDuration);normalizeGoalEventsToWindow(roundAwayEvents,roundStartMinute,roundDuration);roundHomeEvents.sort((a,b)=>a.minute-b.minute);roundAwayEvents.sort((a,b)=>a.minute-b.minute);const federationRound=applyFederationGoalRuleToEvents(roundHomeEvents,roundAwayEvents,roundHomeTeam,roundAwayTeam);homeScore=federationRound?federationRound.scoreA:scoreGoalEvents(roundHomeEvents);awayScore=federationRound?federationRound.scoreB:scoreGoalEvents(roundAwayEvents);}
     }
     const videoRound=roundFormulaWalkover||error404Corrupted?{scoreA:homeScore,scoreB:awayScore}:applyFantaballaVideoScoreRule(homeScore,awayScore,roundHomeEvents,roundAwayEvents,roundHomeTeam,roundAwayTeam,roundDurationUsed);homeScore=videoRound.scoreA;awayScore=videoRound.scoreB;
     if(match!==fixture&&!error404Corrupted&&!roundFormulaWalkover){const aiPowerHome=opponentMatchPower(roundHomeTeam),aiPowerAway=opponentMatchPower(roundAwayTeam);roundNoDrawOutcome=resolveNoDrawMatch({scoreA:homeScore,scoreB:awayScore,eventsA:roundHomeEvents,eventsB:roundAwayEvents,lineupA:roundHomeLineup,lineupB:roundAwayLineup,teamA:roundHomeTeam,teamB:roundAwayTeam,powerA:aiPowerHome,powerB:aiPowerAway,duration:roundDurationUsed});homeScore=roundNoDrawOutcome.scoreA;awayScore=roundNoDrawOutcome.scoreB;roundWinnerId=String(roundNoDrawOutcome.winnerId||'');}
     const homeWasEliminated=isTeamEliminated(match.home),awayWasEliminated=isTeamEliminated(match.away),homeOutcome=matchOutcomeScores(homeScore,awayScore,roundWinnerId,match.home),awayOutcome=matchOutcomeScores(awayScore,homeScore,roundWinnerId,match.away);
     if(roundFormulaWalkover?.doubleForfeit){if(!homeWasEliminated)formulaOneApplyDoubleForfeitStanding(match.home);if(!awayWasEliminated)formulaOneApplyDoubleForfeitStanding(match.away);}else{if(!homeWasEliminated)updateStanding(match.home,homeScore,awayScore,{winnerId:roundWinnerId});if(!awayWasEliminated)updateStanding(match.away,awayScore,homeScore,{winnerId:roundWinnerId});}if(match===fixture)userPoints=applyUserPointRules(goalsFor,goalsAgainst);
     const eliminationNote=(!roundFormulaWalkover&&!homeWasEliminated&&!awayWasEliminated)?applyHungerGamesResult(match.home,match.away,homeOutcome.gf,homeOutcome.ga):'';
     const awards=roundFormulaWalkover?emptyLeagueMatchAwards():recordLeagueMatchPlayerStats({homeTeam:roundHomeTeam,awayTeam:roundAwayTeam,homeLineup:roundHomeLineup,awayLineup:roundAwayLineup,homeScore,awayScore,homeEvents:roundHomeEvents,awayEvents:roundAwayEvents});
     roundResults.push({matchday:state.matchday+1,homeId:match.home,awayId:match.away,homeName:roundHomeTeam?.name||'',awayName:roundAwayTeam?.name||'',homeScore,awayScore,winnerId:roundWinnerId,noDrawOutcome:roundNoDrawOutcome,spaceJamStartMinute:roundStartMinute,spaceJamScheduledDuration:roundDurationUsed,homeGoals:roundHomeEvents,awayGoals:roundAwayEvents,mvpId:awards.mvpId,mvpScore:awards.mvpScore,mvpTeamId:awards.mvpTeamId,formulaOneInjuryWalkover:roundFormulaWalkover?{...roundFormulaWalkover}:null,eliminationNote});if(match===fixture){userAwards=awards;if(eliminationNote)userPoints.note=[userPoints.note,eliminationNote].filter(Boolean).join(' ')};
   });
   formulaOneRound=applyFormulaOneRoundPoints(roundResults);if(formulaOneRuleActive()){const earned=Number(formulaOneRound.user?.points)||0,position=Number(formulaOneRound.user?.position)||0;userPoints={adjustment:0,awarded:earned,note:`Formato Formula 1: ${position?`${position}° posto di giornata, +${earned} punti.`:'fuori dalla classifica di giornata, 0 punti.'} ${formulaOneRankingSummary(formulaOneRound.ranking)}`};}
   const italiaCatenaccioPenalty=applyItaliaCatenaccioPointPenalty(officialGoalsFor);if(italiaCatenaccioPenalty){userPoints.adjustment+=italiaCatenaccioPenalty;userPoints.awarded+=italiaCatenaccioPenalty;userPoints.note=[userPoints.note,`Il gol? Che schifo!: hai segnato più di 3 gol e perdi 6 punti.`].filter(Boolean).join(' ');}
   const sixtyFearNote=applySixtyPointFear();if(sixtyFearNote)userPoints.note=[userPoints.note,sixtyFearNote].filter(Boolean).join(' ');
   const frenchLateBoosts=!formulaOneWalkoverView?applyFrenchLateAttackerBoosts(userGoalEvents,lineup):[];
   const allHighlights=[...userGoalEvents,...opponentGoalEvents].sort((a,b)=>a.minute-b.minute);state.lastRoundResults=roundResults;
   state.history.push({matchday:state.matchday+1,opponent:opponent.name,opponentId:opponent.id,home:userHome,gf:goalsFor,ga:goalsAgainst,displayGf:officialGoalsFor,displayGa:officialGoalsAgainst,winnerId:String(noDrawOutcome.winnerId||''),extraTime:Boolean(noDrawOutcome.extraTime),penalties:noDrawOutcome.penalties?{for:Number(noDrawOutcome.penalties.home)||0,against:Number(noDrawOutcome.penalties.away)||0,winnerId:String(noDrawOutcome.penalties.winnerId||'')}:null,noDrawRuleNote:String(noDrawOutcome.note||''),formulaOnePosition:Number(formulaOneRound.user?.position)||0,formulaOnePoints:Number(formulaOneRound.user?.points)||0,formulaOneRanking:formulaOneRound.ranking||[],goals:userGoalEvents,opponentGoals:opponentGoalEvents,highlights:allHighlights,commentary,power:Math.round(userPower*10)/10,opponentPower:Math.round(opponentPower*10)/10,opponentRedCard:Boolean(redCandidate),opponentRedPlayer:redCandidate?.name||'',ownRedCard:Boolean(ownRedEntry),ownSuspensionId:ownRedEntry?.playerId||'',ownSuspensionPlayer:ownRedEntry?.player?.name||'',goalkeeperId:userHome?userAwards?.homeGoalkeeperId:userAwards?.awayGoalkeeperId,opponentGoalkeeperId:userHome?userAwards?.awayGoalkeeperId:userAwards?.homeGoalkeeperId,cleanSheet:!formulaOneWalkoverView&&Number(officialGoalsAgainst)===0,opponentCleanSheet:!formulaOneWalkoverView&&Number(officialGoalsFor)===0,mvpId:userAwards?.mvpId||'',mvpScore:userAwards?.mvpScore||0,mvpTeamId:userAwards?.mvpTeamId||'',lineup:safeMatchLineup(lineup),opponentLineup:safeMatchLineup(opponentLineup),baseOvrOnlyActive:Boolean(state.activeEffects.some(effect=>effect.type==='baseOvrOnly')),forcedLoss,forcedWin,maxDraw,forcedScore:Boolean(forcedScoreEffect),forcedScoreData:forcedScoreEffect?{gf:Math.max(0,Number(forcedScoreEffect.gf)||0),ga:Math.max(0,Number(forcedScoreEffect.ga)||0),source:String(forcedScoreEffect.source||'')}:null,pointsAwarded:userPoints.awarded,pointsAdjustment:userPoints.adjustment,pointsNote:userPoints.note,forcedSubscriberGoals:forcedSubscribers.length,playMode:mode,matchDuration:matchMinutes,pinkCardMinute,opponentYellowRed,ownYellowRed,deathMatchBonus,hungerWalkover,futureScorerGoal:Boolean(futureGoal),meritStoryGoal:Boolean(meritStoryGoal),fantaballopoliForcedLoss:Boolean(fantaballopoliRule.forcedLoss),fantaballopoliForcedWin:Boolean(fantaballopoliRule.forcedWin),fantaballopoliNegativeGoals:Boolean(fantaballopoliRule.negativeOpponentGoals),fantaballopoliExpulsions:fantaballopoliRisks.expelled.map(entry=>entry.player?.name||'Giocatore'),fantaballopoliInjuries:fantaballopoliRisks.injured.map(entry=>entry.player?.name||'Giocatore'),coachType:normalizeCoachType(state.coachType),coachOvrModifier:coachMatchOvrModifier(),coachGoalForGuaranteed:Boolean(coachGuarantees.for),coachGoalAgainstGuaranteed:Boolean(coachGuarantees.against),coachRosterAverage:Math.round(Number(coachGuarantees.average||coachRosterAverageOvr())*10)/10,ductilityBoosts:Array.isArray(userAwards?.ductilityBoosts)?userAwards.ductilityBoosts:[],curvaContestVenueMode:curvaContestVenueMode(),secretRefereePenalty,questOpponentTop3Before,champagneDrawLoss,italiaCatenaccioRule:String(state.seasonRules?.italiaCatenaccioRule||''),italiaCatenaccioPenalty,allegriGoalsRemoved,fantaballaVideoRule:String(state.seasonRules?.fantaballaVideoRule||''),fantaballaVideoRuleNote:String(fantaballaVideoOutcome?.note||''),federationGoalRule:federationOutcome?.rule||'',federationGoalRuleNote:federationOutcome?.note||'',federationGoalWinnerId:federationOutcome?.winnerId||'',error404Corrupted:Boolean(error404Corrupted),formulaOneInjuryWalkover:formulaOneWalkoverView?{...formulaOneWalkoverView}:null,spaceJamRandomKickoff:Boolean(spaceJamTiming.active),spaceJamStartMinute:Number(matchStartMinute)||0,spaceJamScheduledDuration:Number(spaceJamScheduledDuration)||90,frenchLateBoosts:Array.isArray(frenchLateBoosts)?frenchLateBoosts:[]});
   state.lastResult=state.history[state.history.length-1];const analyticsBeforePostMatch=analyticsStatusSnapshot(),achievementLineupFinalOvrs=(Array.isArray(lineup)?lineup:[]).map(entry=>{const playerId=String(entry?.player?.id||entry?.playerId||''),status=state.statuses?.[playerId],voodooContribution=(!coachIs('ductility')&&!state.activeEffects.some(effect=>effect.type==='baseOvrOnly')&&(Boolean(status?.seasonOut)||Number(status?.injury)>0))?Math.max(0,Number(state.seasonRules?.injuredOvrBonus)||0):0;return{playerId,finalOvr:Number(resolvedPlayerFinalOvr(entry,lineup))||0,ballariniContribution:achievementBallariniContribution(entry),voodooContribution}});postMatch();if(!formulaOneWalkoverView)checkPostMatchAchievements({gf:goalsFor,ga:goalsAgainst,userGoals:userGoalEvents,opponentGoals:opponentGoalEvents,varRandomResult:Boolean(varRandomResult),ductilityBoosts:Array.isArray(userAwards?.ductilityBoosts)?userAwards.ductilityBoosts:[],lineup,lineupFinalOvrs:achievementLineupFinalOvrs,matchDuration:matchMinutes});updateSeasonMatchAnalytics(state.lastResult,analyticsBeforePostMatch);save();showResultModal();
 };
 if(formulaOneWalkoverView){const names=formulaOneWalkoverView.userInjured.map(item=>item.name).join(', ');modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="label">Formato Formula 1</div><h2>Partita non disputata</h2><p>${formulaOneWalkoverView.doubleForfeit?'Entrambe le squadre hanno almeno un giocatore infortunato: doppia sconfitta a tavolino.':formulaOneWalkoverView.userForfeit?`Hai almeno un giocatore infortunato${names?`: ${esc(names)}`:''}. La partita è persa 0-3 a tavolino.`:'Gli avversari hanno almeno un giocatore infortunato. Vinci 3-0 a tavolino.'}</p><div class="sim"><span></span></div></div></div>`;setTimeout(finishRound,1000)}
 else if(mode==='live')playLiveMatch({commentary,homeTeam,awayTeam,homeGoals,awayGoals,matchday:state.matchday+1,duration:matchMinutes,startMinute:matchStartMinute},finishRound);
 else{modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="label">Giornata ${state.matchday+1}</div><h2>Partita in corso...</h2><div class="sim"><span></span></div><p>Il campionato sta simulando tutte le partite della giornata usando le rose reali dei club.</p></div></div>`;setTimeout(finishRound,1250)}
}
function postMatch(){
 const cardEffect=state.activeEffects.some(effect=>effect.type==='cards');
 Object.values(state.statuses).forEach(status=>{if(status.seasonOut)status.injury=Math.max(1,Number(status.injury)||1);else if(status.injury>0)status.injury--;if(status.suspension>0)status.suspension--;if(!status.seasonOut&&status.injury<=0){status.seasonOut=false;status.seasonOutReason='';}});
 state.teams.filter(team=>team.id!==USER_ID).forEach(team=>{Object.values(team.statuses||{}).forEach(status=>{if(status.injury>0)status.injury--;if(status.suspension>0)status.suspension--;});});
 const result=state.lastResult,matchWasFormulaOneWalkover=Boolean(result?.formulaOneInjuryWalkover?.active);if(!matchWasFormulaOneWalkover&&!parallelCupDisciplineImmunity()&&result?.ownSuspensionId)statusOf(result.ownSuspensionId).suspension=Math.max(1,statusOf(result.ownSuspensionId).suspension);
 if(!matchWasFormulaOneWalkover&&!parallelCupDisciplineImmunity()&&Math.random()<(cardEffect?.18:.07)){const entry=pick(rosterPlayers());if(entry)statusOf(entry.playerId).suspension=Math.max(1,statusOf(entry.playerId).suspension);}
 if(!matchWasFormulaOneWalkover&&!parallelCupDisciplineImmunity()&&state.seasonRules.longMatchRisk&&Number(result?.matchDuration)===120&&Math.random()<.35){const entry=randomOwnEntry();if(entry){statusOf(entry.playerId).suspension=Math.max(1,statusOf(entry.playerId).suspension);result.longMatchSuspension={playerId:String(entry.playerId),name:entry.player.name};}}
 const risks=state.activeEffects.filter(effect=>effect.type==='injuryRisk');
 if(!matchWasFormulaOneWalkover&&risks.length){const chance=physioAdjustedInjuryChance(1-risks.reduce((remaining,effect)=>remaining*(1-clamp(Number(effect.chance)||0,0,1)),1));if(Math.random()<chance){const count=Math.max(1,...risks.map(effect=>Number(effect.count)||1)),duration=Math.max(1,...risks.map(effect=>Number(effect.duration)||1)),candidates=shuffle(rosterPlayers()).slice(0,count);candidates.forEach(entry=>setOwnPlayerInjury(entry,duration));if(result)result.eventInjuries=candidates.map(entry=>({playerId:String(entry.playerId),name:entry.player.name,duration}));}}
 if(!matchWasFormulaOneWalkover&&state.seasonRules.longMatchRisk&&Number(result?.matchDuration)===120&&Math.random()<physioAdjustedInjuryChance(.55)){const entry=randomOwnEntry();if(entry){setOwnPlayerInjury(entry,2);result.longMatchInjury={playerId:String(entry.playerId),name:entry.player.name,duration:2};}}
 if(result&&state.seasonRules.futureInjuryPenaltyNotice){if(state.standings?.[USER_ID])state.standings[USER_ID].pts=0;result.futureInjuryPenalty=state.seasonRules.futureInjuryPenaltyNotice;state.seasonRules.futureInjuryPenaltyNotice=''}
 const classicRestRewards=resolveClassicEventAfterMatch(result);
 tickMeritStoryAfterMatch(result);
 tickFantaballopoliAfterMatch(result);
 tickEventChainsAfterMatch(result);
 tickSeasonQuestAfterMatch(result);
 resolveSecretRefereeAfterMatch(result);
 if(!matchWasFormulaOneWalkover)resolveSpaceJamTalentChallenge(result);
 if(!matchWasFormulaOneWalkover)applyCreatorMvpBoostAfterMatch(result);
 state.activeEffects.forEach(effect=>{if(!effectLastsUntilSeasonEnd(effect))effect.rounds--});state.activeEffects=state.activeEffects.filter(effect=>effectLastsUntilSeasonEnd(effect)||effect.rounds>0);activateRestRewards(classicRestRewards,result);activatePendingNationalBoost();state.playInjured={};tickChaosOpponentEffects();resolvePendingParityResetAfterRound(result);resolveCurvaContestAfterRound(result);state.matchday++;state.pendingEvent=null;
 if(state.matchday===19){runChaosOpponentMidseason();if(coachIs('three-five-two')){state.midseason={...state.midseason,step:0,target:0,outgoingId:'',mandatoryOutgoingId:'',mandatoryOutgoingIds:[],clubId:'',nation:'',candidates:[],pendingCandidateId:'',drawsUsed:0,completed:true,auto:false,autoCompleted:true,changes:[]};if(isTeamEliminated(USER_ID)||state.matchday>=seasonLength()){advanceAfterRegularSeason()}else if(!curvaContestState().pendingTeamId)prepareEvent();}else{const target=midseasonTarget(),auto=Boolean(state.seasonRules.autoMidseason||state.seasonRules.botMidseason),mandatoryIds=mandatoryMidseasonPlayerIds().filter(id=>rosterEntry(id)).slice(0,3),mandatory=mandatoryIds[0]||'';state.midseason={step:0,target:clamp(Math.max(target,mandatoryIds.length),1,3),outgoingId:mandatory,mandatoryOutgoingId:mandatory,mandatoryOutgoingIds:mandatoryIds,clubId:'',nation:'',candidates:[],pendingCandidateId:'',drawsUsed:0,completed:false,auto,autoCompleted:false,changes:[]};state.phase='midseason';}}
 else if(isTeamEliminated(USER_ID)||state.matchday>=seasonLength()){advanceAfterRegularSeason()}else if(!curvaContestState().pendingTeamId)prepareEvent();
}
function renderResultScorers(goals,teamName){
 const grouped=new Map();(Array.isArray(goals)?goals:[]).forEach(goal=>{const name=String(goal?.player||'Marcatore');if(!grouped.has(name))grouped.set(name,[]);grouped.get(name).push({minute:Number(goal?.minute)||0,value:Math.max(1,Number(goal?.goalValue)||1)});});
 const rows=[...grouped.entries()].map(([name,items])=>`<div class="result-scorer-line"><span>⚽ ${esc(name)}</span><small>${items.sort((a,b)=>a.minute-b.minute).map(item=>`${item.minute}′${item.value>1?' ×2':''}`).join(', ')}</small></div>`).join('');
 return `<div class="result-scorers-team"><strong>${esc(teamName)}</strong>${rows||'<span class="result-scorers-empty">Nessun marcatore</span>'}</div>`;
}
function showResultModal(){
 const result=state.lastResult;
 const userTeam=teamById(USER_ID)||{id:USER_ID,name:state.teamName,colors:activeUserClub().colorClub};
 const opponent=teamById(result.opponentId)||{id:result.opponentId,name:result.opponent};
 const homeTeam=result.home?userTeam:opponent;
 const awayTeam=result.home?opponent:userTeam;
 const redLine=result.opponentRedCard?`<div class="goal-line red-card-event"><b>🟥 ${result.opponentYellowRed?'Giallo trasformato in rosso':'Espulsione avversaria'}: ${esc(result.opponentRedPlayer||'giocatore avversario')}</b><br>${esc(result.opponent)} ha giocato parte della gara in inferiorità numerica.</div>`:'';
 const suspensionLine=result.ownSuspensionPlayer?`<div class="goal-line red-card-event"><b>🟥 ${result.ownYellowRed?'Giallo trasformato in rosso':'Espulsione'}: ${esc(result.ownSuspensionPlayer)}</b><br>Sarà squalificato per la prossima giornata.</div>`:'';
 const pinkLine=result.pinkCardMinute?`<div class="goal-line"><b>🩷 Cartellino rosa al ${Number(result.pinkCardMinute)}′</b><br>La partita è terminata immediatamente con il risultato maturato fino a quel minuto.</div>`:'';
 const forcedLine=result.forcedScoreData?.source==='Nazionale Fantaballa'?`<div class="goal-line"><b>🇮🇹 Convocazione della Nazionale Fantaballa</b><br>La squadra ha saltato la partita: sconfitta a tavolino ${Number(result.forcedScoreData.gf)||0}-${Number(result.forcedScoreData.ga)||3}. Ora parte il bonus di +5 OVR per 3 giornate.</div>`:result.forcedScoreData?.source==='Cassaaa'?`<div class="goal-line"><b>🐧 Cassaaa</b><br>Il pinguino mantiene la promessa: partita chiusa ${Number(result.forcedScoreData.gf)||3}-${Number(result.forcedScoreData.ga)||2} per te.</div>`:result.forcedScore?`<div class="goal-line"><b>✅ Risultato garantito</b><br>La partita è terminata ${Number(result.forcedScoreData?.gf)||6}-${Number(result.forcedScoreData?.ga)||0} come previsto dall’evento.</div>`:result.forcedLoss?`<div class="goal-line"><b>📋 Sconfitta obbligatoria</b><br>La sconfitta prevista dall’evento è stata applicata.</div>`:result.forcedWin?`<div class="goal-line"><b>✅ Vittoria assicurata</b><br>La vittoria prevista dall’evento è stata applicata.</div>`:result.maxDraw?`<div class="goal-line"><b>🤝 Risultato limitato</b><br>La squadra non poteva ottenere più di un pareggio.</div>`:'';
 const fantaballopoliMatchLine=result.fantaballopoliForcedLoss?`<div class="goal-line red-card-event"><b>🕴️ Fantaballopoli</b><br>La sconfitta ordinata dal personaggio misterioso è stata applicata.</div>`:result.fantaballopoliNegativeGoals?`<div class="goal-line"><b>🕴️ Risultato impossibile</b><br>L’avversario chiude con <b>-1 gol</b>.</div>`:result.fantaballopoliForcedWin?`<div class="goal-line"><b>🕴️ Vittoria pilotata</b><br>I poteri forti hanno garantito la vittoria.</div>`:'';
 const fantaballopoliDisciplineLine=(result.fantaballopoliExpulsions?.length||result.fantaballopoliInjuries?.length)?`<div class="goal-line red-card-event"><b>🟥 Fantaballopoli sugli avversari</b><br>${Number(result.fantaballopoliExpulsions?.length)||0} espulsioni · ${Number(result.fantaballopoliInjuries?.length)||0} infortuni.</div>`:'';
 const error404Line=result.error404Corrupted?`<div class="goal-line red-card-event"><b>⚠ ERRORE 404</b><br>Il file del risultato è stato generato senza dati leggibili.</div>`:'';
 const spaceJamStartLine=result.spaceJamRandomKickoff?`<div class="goal-line"><b>⏩ Space Jam · Bib Bip!</b><br>La partita è iniziata al ${Number(result.spaceJamStartMinute)||0}° minuto su ${Number(result.spaceJamScheduledDuration)||90}: tempo regolamentare realmente giocato ${Math.max(0,(Number(result.spaceJamScheduledDuration)||90)-(Number(result.spaceJamStartMinute)||0))} minuti.</div>`:'';
 const spaceJamOutcomeLine=result.spaceJamOutcome?`<div class="goal-line ${result.spaceJamLost?'red-card-event':''}"><b>🏀 Space Jam · Che succede amico?</b><br>${esc(result.spaceJamOutcome)}</div>`:'';
 const frenchLateBoostLine=Array.isArray(result.frenchLateBoosts)&&result.frenchLateBoosts.length?`<div class="goal-line"><b>🇫🇷 Si è girato</b><br>${result.frenchLateBoosts.map(item=>item.blocked?`${esc(item.playerName)} segna al ${Number(item.minute)}°, ma il bonus OVR viene bloccato dal profilo dell’allenatore.`:`${esc(item.playerName)} segna al ${Number(item.minute)}° e ottiene +${Number(item.gain)||0} OVR: nuovo OVR ${Number(item.newOvr)||0}.`).join('<br>')}</div>`:'';
 const federationLine=result.federationGoalRuleNote?`<div class="goal-line"><b>⚽ Regola FIGC · ${esc(federationGoalRuleLabel(result.federationGoalRule))}</b><br>${esc(result.federationGoalRuleNote)}</div>`:'';
 const pointsLine=result.pointsNote?`<div class="goal-line"><b>🏆 Punti campionato</b><br>${esc(result.pointsNote)}</div>`:'';
 const noDrawLine=result.noDrawRuleNote?`<div class="goal-line"><b>🎯 Niente pareggio</b><br>${esc(result.noDrawRuleNote)}</div>`:'';
 const formulaOneLine=result.formulaOnePosition?`<div class="goal-line"><b>🏎️ Formato Formula 1</b><br>${Number(result.formulaOnePosition)}° posto nella giornata: +${Number(result.formulaOnePoints)||0} punti.<br>${esc(formulaOneRankingSummary(result.formulaOneRanking||[]))}</div>`:'';
 const formulaOneWalkoverLine=result.formulaOneInjuryWalkover?.active?`<div class="goal-line"><b>🚑 Partita a tavolino</b><br>${result.formulaOneInjuryWalkover.doubleForfeit?'Entrambe le squadre avevano almeno un infortunato: doppia sconfitta 0-3.':result.formulaOneInjuryWalkover.userForfeit?'Avevi almeno un giocatore infortunato: partita non disputata e sconfitta 0-3.':'Gli avversari avevano almeno un infortunato: vittoria 3-0 a tavolino.'}</div>`:'';
 const italiaCatenaccioLine=Number(result.italiaCatenaccioPenalty)<0?`<div class="goal-line red-card-event"><b>🍕 Il gol? Che schifo!</b><br>Hai segnato più di 3 gol: -6 punti in classifica.</div>`:Number(result.allegriGoalsRemoved)>0?`<div class="goal-line"><b>🧱 Allegri insegna</b><br>${Number(result.allegriGoalsRemoved)} ${Number(result.allegriGoalsRemoved)===1?'gol è stato annullato':'gol sono stati annullati'} dal limite di un gol a partita.</div>`:'';
 const parityResetLine=result.parityResetNotice?`<div class="goal-line red-card-event"><b>🔢 Punti pari o dispari · effetto applicato</b><br>${esc(result.parityResetNotice)} La classifica è stata aggiornata al termine della giornata ${Number(result.parityResetMatchday)||Number(state.matchday)||0}.</div>`:'';
 const curvaContestLine=result.curvaContestNotice?`<div class="goal-line ${result.curvaContestSuccess?'':'red-card-event'}"><b>📣 La curva sta contestando</b><br>${esc(result.curvaContestNotice)}</div>`:'';
 const curvaVenueLine=result.curvaContestVenueMode?`<div class="goal-line"><b>🏟️ Pressione della curva</b><br>${result.curvaContestVenueMode==='home'?'Questa gara è stata simulata con il vantaggio di una partita in casa.':'Questa gara è stata simulata con lo svantaggio di una partita in trasferta.'}</div>`:'';
 const injuryLine=result.eventInjuries?.length?`<div class="goal-line"><b>🚑 Conseguenza dell’imprevisto</b><br>${result.eventInjuries.map(item=>`${esc(item.name)}: ${item.duration} ${item.duration===1?'giornata':'giornate'}`).join(' · ')}</div>`:'';
 const ductilityLine=Array.isArray(result.ductilityBoosts)&&result.ductilityBoosts.length?`<div class="goal-line"><b>🔀 Duttilità · bonus fuori ruolo</b><br>${result.ductilityBoosts.map(item=>`${esc(item.playerName)}: +${Number(item.gain)||1} OVR permanente (totale +${Number(item.total)||0})`).join(' · ')}</div>`:'';
 const secretRefereeLine=result.secretRefereePenalty?`<div class="goal-line"><b>⚖️ Arbitro ecuadoriano</b><br>${result.secretRefereePenalty==='for'?'Rigore garantito a favore applicato in questa partita.':'Rigore garantito contro applicato in questa partita.'}</div>`:'';
 const classicEventLine=(Array.isArray(result.eventUpdates)?result.eventUpdates:[]).map(update=>`<div class="goal-line ${update.success?'':'red-card-event'}"><b>${update.success?'✨':'🌙'} ${esc(update.title||'Evento')}</b><br>${esc(update.message||'')}</div>`).join('');
 const futurePenaltyLine=result.futureInjuryPenalty?`<div class="goal-line red-card-event"><b>⏳ Paradosso temporale</b><br>${esc(result.futureInjuryPenalty)}</div>`:'';
 const chickenTrainingLine=result.chickenTraining?`<div class="goal-line"><b>🐔 Allenamento del pollo</b><br>${esc(result.chickenTraining.playerName)} guadagna +${Number(result.chickenTraining.gain)||0} OVR e sale a ${Number(result.chickenTraining.newOvr)||1}.</div>`:'';
 const chickenGoalLine=result.chickenGoals?`<div class="goal-line"><b>🐔 Progresso del pollaio</b><br>${esc(result.chickenGoals.playerName)} ha segnato ${Number(result.chickenGoals.count)||0} ${Number(result.chickenGoals.count)===1?'gol':'gol'}${result.chickenGoals.double?' dal valore doppio':''}. Totale: ${Number(result.chickenGoals.total)||0}/3.</div>`:'';
 const penguinLine=result.penguinUpdate?`<div class="goal-line ${result.penguinUpdate.type==='ludopatia'?'red-card-event':''}"><b>🐧 ${result.penguinUpdate.type==='ludopatia'?'Ludopatia':'Esperto Tipster'}</b><br>${esc(result.penguinUpdate.message)}</div>`:'';
 const storyLine=(Array.isArray(result.storyUpdates)?result.storyUpdates:[]).map(update=>`<div class="goal-line ${update.success?'':'red-card-event'}"><b>${update.success?'📖':'📕'} ${esc(update.title||'Storia')}</b><br>${esc(update.message||'')}</div>`).join('');
 const questLine=(Array.isArray(result.questUpdates)?result.questUpdates:[]).map(update=>`<div class="goal-line ${update.success?'':'red-card-event'}"><b>${update.success?'✅':'❌'} Quest: ${esc(update.title||'Missione')}</b><br>${esc(update.message||'')}</div>`).join('');
 const cupLine=renderParallelCupResult(result.cupReport);
 const champagneLine=result.champagneDrawLoss?`<div class="goal-line red-card-event"><b>🥂 Calcio champagne</b><br>Il pareggio è stato trasformato in sconfitta dalla penalità della quest.</div>`:'';
 const hungerLine=result.hungerWalkover?`<div class="goal-line"><b>🏹 Vittoria a tavolino</b><br>L’avversario era già stato eliminato dagli Hunger Games.</div>`:'';
 const subscriberLine=result.forcedSubscriberGoals?`<div class="goal-line"><b>⚽ Abbonati scatenati</b><br>${result.forcedSubscriberGoals} ${result.forcedSubscriberGoals===1?'abbonato ha':'abbonati hanno'} segnato almeno un gol.</div>`:'';
 const creatorBoostLine=result.creatorMvpBoost?.active?`<div class="goal-line"><b>🎬 Uomo immagine</b><br>${esc(result.creatorMvpBoost.playerName)} è stato nominato MVP: tutta la squadra riceve +${Number(result.creatorMvpBoost.value)||1} OVR per la prossima partita.</div>`:'';
 const coachResultLine=result.coachOvrModifier||result.coachGoalForGuaranteed||result.coachGoalAgainstGuaranteed?`<div class="goal-line"><b>${esc(coachProfile(result.coachType).icon)} ${esc(coachProfile(result.coachType).name)}</b><br>${result.coachOvrModifier?`${result.coachOvrModifier>0?'+':''}${Number(result.coachOvrModifier)} OVR applicato alla squadra. `:''}${result.coachGoalForGuaranteed?'Gol segnato garantito attivato. ':''}${result.coachGoalAgainstGuaranteed?'Gol subito garantito attivato. ':''}</div>`:'';
 let commentary=Array.isArray(result.commentary)?result.commentary:[];
 if(!commentary.length){
   commentary=(result.highlights||[...(result.goals||[]),...(result.opponentGoals||[])]).sort((a,b)=>a.minute-b.minute).map(goal=>({minute:goal.minute,type:'goal',icon:'⚽',teamId:goal.teamId||((result.goals||[]).includes(goal)?USER_ID:result.opponentId),title:`Gol di ${goal.player}`,text:`${goal.assist?`Assist di ${goal.assist}. `:''}${goal.description||''}`}));
 }
 const commentaryHtml=commentary.length?commentary.map(event=>commentaryRowHtml(event,homeTeam,awayTeam)).join(''):'<div class="goal-line">Partita senza azioni registrate.</div>';
 const mvpPlayer=result.mvpId?statPlayerInfo(result.mvpId):null;
 const mvpTeam=result.mvpTeamId?teamById(result.mvpTeamId):null;
 const mvpLine=mvpPlayer?`<div class="match-mvp" style="${teamCssVars(mvpTeam)}">${renderMiniAvatar(mvpPlayer,'small')}<div><span>⭐ MVP della partita</span><b>${esc(mvpPlayer.name)}</b><small>${mvpTeam?`${teamColorDot(mvpTeam)}${esc(mvpTeam.name)}`:''}</small></div></div>`:'';
 const scorersLine=`<div class="result-scorers">${renderResultScorers(result.goals,state.teamName)}${renderResultScorers(result.opponentGoals,result.opponent)}</div>`;
 modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal result-modal-expanded"><div class="label">Risultato finale</div><div class="match-result"><div class="team-name">${esc(state.teamName)} vs ${esc(result.opponent)}</div><div class="score">${Number.isFinite(Number(result.displayGf))?Number(result.displayGf):result.gf}–${Number.isFinite(Number(result.displayGa))?Number(result.displayGa):result.ga}${result.penalties?` <small>(${Number(result.penalties.for)||0}–${Number(result.penalties.against)||0} d.c.r.)</small>`:''}</div><button id="closeResult" class="btn primary result-continue-top">Continua</button>${scorersLine}${pinkLine}${redLine}${suspensionLine}${forcedLine}${fantaballopoliMatchLine}${fantaballopoliDisciplineLine}${error404Line}${spaceJamStartLine}${spaceJamOutcomeLine}${frenchLateBoostLine}${federationLine}${pointsLine}${noDrawLine}${formulaOneWalkoverLine}${formulaOneLine}${italiaCatenaccioLine}${parityResetLine}${curvaContestLine}${curvaVenueLine}${injuryLine}${ductilityLine}${secretRefereeLine}${classicEventLine}${futurePenaltyLine}${chickenTrainingLine}${chickenGoalLine}${penguinLine}${storyLine}${questLine}${cupLine}${champagneLine}${hungerLine}${subscriberLine}${creatorBoostLine}${coachResultLine}<div class="match-highlights-title">Cronaca della partita</div><div class="goals match-highlights">${commentaryHtml}</div>${mvpLine}</div></div></div>`;
 document.getElementById('closeResult').onclick=()=>{modalRoot.innerHTML='';const switched=performPendingCurvaTeamSwitch();if(switched){state.pendingEvent=null;if(state.phase==='season')prepareEvent();save();toast(`Ora alleni ${switched.to}.`)}render()};
}

function isFlexibleMidseason(){return !state.midseason?.auto&&!state.seasonRules.autoMidseason&&!state.seasonRules.botMidseason&&mandatoryMidseasonPlayerIds().filter(id=>rosterEntry(id)).length===0}
function midseasonMetricsForRoster(entries){
 const starters=(entries||[]).filter(entry=>entry&&!entry.bench&&entry.player);
 const chemistry=draftChemistry(starters),lineup=resolveRosterLineup(entries,{ignoreStatuses:true});
 return {starters,chemistry,lineup,overall:resolvedLineupAverage(lineup)};
}
function midseasonProjection(outgoingId,incomingId){
 const roster=rosterPlayers();
 const outgoing=roster.find(entry=>String(entry.playerId)===String(outgoingId));
 const incoming=playerById(incomingId);
 if(!outgoing||!incoming)return null;
 const current=midseasonMetricsForRoster(roster);
 const projectedRoster=roster.map(entry=>String(entry.playerId)===String(outgoing.playerId)?{...entry,playerId:String(incoming.id),player:incoming}:entry);
 const projected=midseasonMetricsForRoster(projectedRoster);
 const outgoingBonus=outgoing.bench?0:(current.chemistry.playerBonus[String(outgoing.player.id)]||0);
 const incomingBonus=outgoing.bench?0:(projected.chemistry.playerBonus[String(incoming.id)]||0);
 const outgoingOvr=Math.round((Number(outgoing.player.ovr)||0)+effectiveChemistryFromBase(outgoing.player,outgoingBonus)+activeOvrBonus(outgoing.player));
 const incomingOvr=Math.round((Number(incoming.ovr)||0)+effectiveChemistryFromBase(incoming,incomingBonus)+activeOvrBonus(incoming));
 return {
   outgoing,incoming,current,projected,
   outgoingOvr,incomingOvr,
   deltaPlayer:incomingOvr-outgoingOvr,
   deltaOverall:projected.overall-current.overall,
   deltaChemistry:projected.chemistry.score-current.chemistry.score
 };
}
function midseasonDeltaClass(value){const n=Number(value)||0;return n>0?'positive':n<0?'negative':'neutral'}
function midseasonDeltaLabel(value,digits=1){const n=Number(value)||0;const formatted=digits?Math.abs(n).toFixed(digits):String(Math.abs(Math.round(n)));return `${n>0?'+':n<0?'−':''}${formatted}`}
function renderMidseasonComparison(projection){
 if(!projection)return'';
 const {outgoing,incoming,current,projected,outgoingOvr,incomingOvr,deltaPlayer,deltaOverall,deltaChemistry}=projection;
 const sourceClub=clubById(incoming.club);
 const clubStyle=teamCssVars({colors:sourceClub?.colorClub});
 return `<div class="midseason-comparison" style="${clubStyle}"><div class="midseason-comparison-title"><span>Confronto prima della conferma</span><b>${esc(outgoing.slot)}${outgoing.bench?' · Panchina':''}</b></div><div class="midseason-versus-grid"><div class="midseason-versus-player outgoing-player">${renderMiniAvatar(outgoing.player)}<span>IN USCITA</span><b>${esc(outgoing.player.name)}</b><small>${esc(outgoing.player.Position)} · OVR ${outgoingOvr}</small></div><div class="midseason-swap-arrow">→</div><div class="midseason-versus-player incoming-player">${renderMiniAvatar(incoming)}<span>IN ENTRATA</span><b>${esc(incoming.name)}</b><small>${esc(incoming.Position)} · OVR ${incomingOvr}</small><em>${sourceClub?esc(sourceClub.name):'Club non indicato'}</em></div></div><div class="midseason-impact-grid"><div class="midseason-impact"><span>OVR giocatore</span><b>${outgoingOvr} → ${incomingOvr}</b><strong class="${midseasonDeltaClass(deltaPlayer)}">${midseasonDeltaLabel(deltaPlayer,0)}</strong></div><div class="midseason-impact"><span>OVR medio titolari</span><b>${current.overall.toFixed(1)} → ${projected.overall.toFixed(1)}</b><strong class="${midseasonDeltaClass(deltaOverall)}">${midseasonDeltaLabel(deltaOverall,1)}</strong></div><div class="midseason-impact"><span>Intesa squadra</span><b>${current.chemistry.score} → ${projected.chemistry.score}</b><strong class="${midseasonDeltaClass(deltaChemistry)}">${midseasonDeltaLabel(deltaChemistry,0)}</strong></div></div><div class="midseason-confirm-actions"><button id="confirmMarketChange" class="btn primary">Conferma il cambio</button></div></div>`;
}
function renderMidseasonChanges(changes,finalView=false){
 const list=Array.isArray(changes)?changes:[];
 if(!list.length)return `<div class="midseason-no-changes">Nessun cambio effettuato.</div>`;
 return `<div class="midseason-changes ${finalView?'final':''}">${list.map((change,index)=>{const oldPlayer=change.outId?playerById(change.outId):null;const newPlayer=change.incomingId?playerById(change.incomingId):null;const sourceClub=clubById(change.clubId||newPlayer?.club);const clubStyle=teamCssVars({colors:sourceClub?.colorClub});return `<div class="midseason-change-card" style="${clubStyle}"><div class="midseason-change-number">${index+1}</div><div class="midseason-change-person">${oldPlayer?renderMiniAvatar(oldPlayer,'small'):''}<span><small>Uscita · ${esc(change.slot||'')}</small><b>${esc(change.out||oldPlayer?.name||'Giocatore')}</b></span></div><div class="midseason-change-arrow">→</div><div class="midseason-change-person incoming">${newPlayer?renderMiniAvatar(newPlayer,'small'):''}<span><small>${sourceClub?esc(sourceClub.name):'Entrata'}</small><b>${esc(change.incoming||newPlayer?.name||'Giocatore')}</b></span></div><div class="midseason-change-deltas"><span class="${midseasonDeltaClass(change.deltaOverall)}">OVR ${midseasonDeltaLabel(change.deltaOverall,1)}</span><span class="${midseasonDeltaClass(change.deltaChemistry)}">INT ${midseasonDeltaLabel(change.deltaChemistry,0)}</span></div></div>`}).join('')}</div>`;
}
function renderMidseasonFinalSummary(ms,bot=false){
 const changes=Array.isArray(ms.changes)?ms.changes:[];
 const first=changes[0]||null,last=changes[changes.length-1]||null;
 const totalOvr=first&&last?(Number(last.afterOverall)-Number(first.beforeOverall)):0;
 const totalChem=first&&last?(Number(last.afterChemistry)-Number(first.beforeChemistry)):0;
 return `<section class="panel midseason-final-view"><div class="label">Giro di boa</div><h2 class="midseason-title">${bot?'Mercato completato dal bot':'Mercato completato'}</h2><p class="midseason-copy">${changes.length?`${changes.length} ${changes.length===1?'cambio confermato':'cambi confermati'}. Controlla il riepilogo prima di tornare al campionato.`:'Hai scelto di proseguire senza modificare la rosa.'}</p><div class="midseason-final-stats"><div><span>Cambi</span><b>${changes.length}</b></div><div><span>OVR medio</span><b class="${midseasonDeltaClass(totalOvr)}">${midseasonDeltaLabel(totalOvr,1)}</b></div><div><span>Intesa</span><b class="${midseasonDeltaClass(totalChem)}">${midseasonDeltaLabel(totalChem,0)}</b></div></div>${renderMidseasonChanges(changes,true)}<button id="continueMidseasonSummary" class="btn primary midseason-continue-btn">Continua il campionato</button></section>`;
}
function finishMidseasonEarly(){
 const ms=state.midseason;
 const mandatory=mandatoryMidseasonPlayerIds()[0]||'';
 if(mandatory&&rosterEntry(mandatory))return toast('Devi prima completare tutti gli scambi obbligatori indicati dagli eventi.');
 if(!isFlexibleMidseason()&&ms.step<ms.target)return toast(`Devi completare ${ms.target} ${ms.target===1?'cambio':'cambi'}.`);
 ms.outgoingId='';
 ms.clubId='';
 ms.nation='';
 ms.candidates=[];
 ms.pendingCandidateId='';
 ms.drawsUsed=0;
 ms.completed=true;
 save();
 render();
}
function continueAfterMidseasonSummary(){
 state.midseason.completed=false;
 state.midseason.pendingCandidateId='';
 state.phase='season';
 state.seasonRules.botMidseason=false;
 initializeParallelCup();
 resolveFantaballopoliMidseason();
 const meritPostEvent=prepareMeritPostMidseasonEvent();
 const remainingMandatory=mandatoryMidseasonPlayerIds().filter(id=>rosterEntry(id));state.seasonRules.mandatoryMidseasonPlayerIds=remainingMandatory;state.seasonRules.mandatoryMidseasonPlayerId=remainingMandatory[0]||'';
 if(!meritPostEvent)prepareEvent();
 save();
 render();
 toast(state.midseason.step?`Mercato concluso con ${state.midseason.step} ${state.midseason.step===1?'cambio':'cambi'}`:'Nessun cambio effettuato');
}
function runBotMidseason(){
 const ms=state.midseason;
 if(ms.autoCompleted)return;
 const target=clamp(Number(ms.target)||midseasonTarget(),1,3);
 const changedSlots=new Set();
 const changes=[];
 for(let step=0;step<target;step++){
   const possibleIndexes=state.draft.roster.map((entry,index)=>({entry,index})).filter(item=>!changedSlots.has(item.index));
   if(!possibleIndexes.length)break;
   const mandatoryId=mandatoryMidseasonPlayerIds()[0]||'';
   const selected=mandatoryId?(possibleIndexes.find(item=>String(item.entry.playerId)===mandatoryId)||pick(possibleIndexes)):pick(possibleIndexes);
   const outgoing=selected.entry;
   const usedIds=new Set(state.draft.roster.map(entry=>String(entry.playerId)));
   let pool=PLAYERS.filter(player=>youngBeautifulAllowsPlayer(player)&&!usedIds.has(String(player.id))&&(outgoing.bench||userCompatible(player,outgoing.slot)));
   if(requiresEqualOrBetterMidseason(outgoing.playerId)){
     const compatiblePool=[...pool],threshold=Number(outgoing.player?.ovr||playerById(outgoing.playerId)?.ovr)||0;pool=pool.filter(player=>(Number(player.ovr)||0)>=threshold);
     if(!pool.length&&compatiblePool.length){const source=[...compatiblePool].sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0))[0],boosted=registerGeneratedEventPlayer({...source,baseOvr:originalBaseOvr(source),id:`event-alien-auto-${source.id}-${Date.now()}`,ovr:threshold,eventPlayer:true,eventUniverse:'alien-market'});pool=[boosted];}
   }
   if(!pool.length)continue;
   const replacement=coachHighOvrPick(pool);
   const projection=midseasonProjection(outgoing.playerId,replacement.id);
   const oldPlayer=outgoing.player||playerById(outgoing.playerId);
   state.draft.roster[selected.index].playerId=String(replacement.id);
   state.draft.roster[selected.index].player={...replacement};
   changedSlots.add(selected.index);
   changes.push({outId:String(oldPlayer?.id||outgoing.playerId),incomingId:String(replacement.id),out:oldPlayer?.name||'Giocatore',incoming:replacement.name,slot:outgoing.slot,clubId:String(replacement.club||''),beforeOverall:projection?.current.overall||0,afterOverall:projection?.projected.overall||0,deltaOverall:projection?.deltaOverall||0,beforeChemistry:projection?.current.chemistry.score||0,afterChemistry:projection?.projected.chemistry.score||0,deltaChemistry:projection?.deltaChemistry||0});
 }
 refreshOpponentClubRosters();
 ms.step=changes.length;
 ms.changes=changes;
 ms.autoCompleted=true;
 ms.completed=true;
 changes.forEach(change=>clearMandatoryMidseasonPlayer(change.outId));
 save();
}
function continueAfterBotMarket(){continueAfterMidseasonSummary()}
function midseasonDrawLimit(){return 1+Math.max(0,Number(state.seasonRules?.midseasonExtraRerolls)||0)+(coachIs('talent-scout')?1:0)}
function midseasonCanDraw(){return Math.max(0,Number(state.midseason?.drawsUsed)||0)<midseasonDrawLimit()}
function midseasonDisplayedOvr(player,entry=null){
 const base=Math.round(ductilityEffectiveBaseOvr(player));
 const starters=starterEntries().map(item=>item.player).filter(Boolean);
 const baseChem=entry&&!entry.bench?Math.round(chemistryBase(player,starters)||0):0;
 const value=Math.round(base+effectiveChemistryFromBase(player,baseChem)+activeOvrBonus(player));return fantaballopoliAllowsNegativeOvr()?value:Math.max(1,value);
}
function showMidseason(){
 if(coachIs('three-five-two')){state.midseason.completed=true;state.midseason.autoCompleted=true;if(state.matchday>=seasonLength())advanceAfterRegularSeason();else state.phase='season';save();render();return}
 const ms=state.midseason;
 ms.target=clamp(Number(ms.target)||midseasonTarget(),1,3);
 ms.pendingCandidateId=String(ms.pendingCandidateId||'');
 const mandatoryId=mandatoryMidseasonPlayerIds()[0]||'';
 const mandatoryActive=Boolean(mandatoryId&&rosterEntry(mandatoryId));
 if(mandatoryActive)ms.outgoingId=mandatoryId;
 ms.completed=Boolean(ms.completed);
 const flexible=isFlexibleMidseason();
 if(ms.auto){
   runBotMidseason();
   screen.innerHTML=renderMidseasonFinalSummary(ms,true);
   const cont=document.getElementById('continueMidseasonSummary');if(cont)cont.onclick=continueAfterBotMarket;
   return;
 }
 if(ms.completed){
   screen.innerHTML=renderMidseasonFinalSummary(ms,false);
   const cont=document.getElementById('continueMidseasonSummary');if(cont)cont.onclick=continueAfterMidseasonSummary;
   return;
 }
 const selected=ms.outgoingId?rosterEntry(ms.outgoingId):null;
 const pendingPlayer=ms.pendingCandidateId?playerById(ms.pendingCandidateId):null;
 const projection=selected&&pendingPlayer?midseasonProjection(selected.playerId,pendingPlayer.id):null;
 const remaining=Math.max(0,ms.target-ms.step);
 const drawLocked=Boolean(ms.clubId)&&!midseasonCanDraw();
 const outgoingLocked=mandatoryActive||Boolean(ms.outgoingId);
 const extraDrawsRemaining=Math.max(0,midseasonDrawLimit()-Number(ms.drawsUsed||0));
 const confirmedHtml=ms.changes.length?`<div class="midseason-confirmed-box"><div class="midseason-tip">Cambi già confermati</div>${renderMidseasonChanges(ms.changes)}</div>`:'';
 const coachSwapEntry=state.seasonRules.coachTopSwapPlayerId?rosterEntry(state.seasonRules.coachTopSwapPlayerId):null;
 const equalSwapEntry=mandatoryId&&requiresEqualOrBetterMidseason(mandatoryId)?rosterEntry(mandatoryId):null;
 const specialMarketNotice=equalSwapEntry?`<div class="midseason-draw-lock"><b>È un povero pazzo.</b> ${esc(equalSwapEntry.player.name)} può essere sostituito soltanto da un giocatore con OVR pari o superiore al suo.</div>`:coachSwapEntry?`<div class="midseason-draw-lock"><b>Figlio del mister.</b> Se scegli ${esc(coachSwapEntry.player.name)} come giocatore in uscita, il pack conterrà un top player garantito del suo macro-ruolo.</div>`:state.seasonRules.guaranteedTopPlayerNextMidseason?`<div class="midseason-draw-lock"><b>Top player garantito.</b> Il prossimo pack del mercato conterrà almeno un giocatore di alto livello compatibile.</div>`:'';
 screen.innerHTML=`<section class="panel"><div class="label">Giro di boa</div><h2 class="midseason-title">Draft di metà campionato</h2><p class="midseason-copy">${flexible?`Puoi scegliere liberamente se fare <b>da 0 a ${ms.target} ${ms.target===1?'cambio':'cambi'}</b>.`:`In questa stagione devi effettuare <b>${ms.target}</b> ${ms.target===1?'cambio':'cambi'} per effetto degli eventi.`} Prima di confermare vedrai l’impatto previsto su OVR medio e Intesa. <b>${coachIs('talent-scout')?'Con Talent scout hai un re-roll aggiuntivo per ogni cambio.':'Ogni cambio ha una sola estrazione del club.'} Dopo aver scelto il giocatore da cedere, lo scambio diventa obbligatorio.</b></p>${mandatoryActive?`<div class="midseason-draw-lock"><b>Scambio obbligatorio.</b> Devi sostituire ${esc(rosterEntry(mandatoryId)?.player?.name||'il giocatore indicato')} prima di poter chiudere il mercato.</div>`:''}${specialMarketNotice}${confirmedHtml}<div class="midseason-shell ${selected?'has-selection':''}"><div class="midseason-panel midseason-outgoing-panel"><div class="midseason-tip">1. scegli chi lascia la rosa</div><div class="midseason-count"><span class="chip">Fatti: ${ms.step}</span><span class="chip">Disponibili: ${remaining}</span>${flexible?`<span class="chip">Scelta libera 0–${ms.target}</span>`:''}</div><div class="outgoing-list">${sortRosterEntriesByRole(rosterPlayers()).map(entry=>{const currentOvr=midseasonDisplayedOvr(entry.player,entry);const sub=isSubscriber(entry.player),creator=isCreator(entry.player);return `<button class="outgoing midseason-player-row ${ms.outgoingId===entry.playerId?'active':''} ${sub?'subscriber':''} ${creator?'creator':''}" data-out="${esc(entry.playerId)}" ${outgoingLocked?'disabled':''}>${renderMiniAvatar(entry.player,'small')}<span class="midseason-player-copy"><b>${sub?'<span class="midseason-sub-star">★</span>':''}${creator?'<span class="season-inline-creator">CR</span>':''}${esc(entry.player.name)}</b><small>${esc(entry.slot)} · ${esc(entry.player.Position)}${entry.bench?' · Panchina':''}</small></span><span class="midseason-current-ovr"><strong>${currentOvr}</strong><small>OVR attuale</small></span></button>`}).join('')}</div></div><div class="midseason-panel midseason-substitute-panel"><div class="midseason-tip">2. scegli il sostituto ${ms.target>1?`(${Math.min(ms.step+1,ms.target)}/${ms.target})`:''}</div><div class="midseason-choice-note">${selected?`Stai sostituendo <b>${esc(selected.player.name)}</b> nello slot <b>${esc(selected.slot)}</b>. ${coachIs('talent-scout')?'Hai a disposizione anche il re-roll aggiuntivo del Talent scout.':'L’estrazione del club è definitiva.'} Scegli con attenzione uno dei candidati disponibili.`:flexible?`Puoi chiudere il mercato senza cambi oppure fermarti dopo qualsiasi cambio confermato, fino a un massimo di ${ms.target}.`:'Seleziona un giocatore dalla rosa per iniziare il cambio.'}</div>${selected?`<div class="midseason-draw-actions">${!ms.clubId?'<button id="drawMarket" class="btn gold">Estrai club</button>':midseasonCanDraw()?`<button id="drawMarket" class="btn gold">Re-roll imprevisto (${extraDrawsRemaining})</button>`:''}</div>${selected?`<div class="midseason-draw-lock"><b>Scambio avviato.</b> Non puoi più annullare o cambiare il giocatore in uscita: devi scegliere e confermare uno dei candidati proposti.</div>`:''}${ms.clubId?`<div class="midseason-summary-card" style="${teamCssVars({colors:marketClub()?.colorClub})}"><div class="need">Club estratto</div><div class="nation-name">${esc(marketClub()?.name||ms.clubId)}</div></div><div class="candidate-grid midseason-candidate-grid">${sortPlayersByRole(ms.candidates.map(playerById).filter(Boolean)).map(player=>{const id=String(player.id);const currentOvr=midseasonDisplayedOvr(player);const sub=isSubscriber(player),creator=isCreator(player);const rarity=draftRarityMeta(currentOvr);return `<button class="candidate midseason-market-player rarity-${rarity.key} ${sub?'subscriber':''} ${creator?'creator':''} ${ms.pendingCandidateId===String(id)?'active':''}" data-market="${id}" data-ovr="${currentOvr}">${renderMiniAvatar(player,'small')}<span class="midseason-player-copy"><span class="name">${sub?'<span class="midseason-sub-star">★</span>':''}${creator?'<span class="season-inline-creator">CR</span>':''}${esc(player.name)} <span class="season-rarity-badge">${esc(rarity.label)}</span></span><span class="meta"><span class="chip">${esc(player.Position)}</span>${sub?'<span class="chip sub">ABB</span>':''}${creator?'<span class="season-chip creator">CREATOR</span>':''}</span></span><span class="midseason-current-ovr"><strong>${currentOvr}</strong><small>OVR base</small></span></button>`}).join('')}</div>${renderMidseasonComparison(projection)}`:''}`:`<div class="midseason-actions">${flexible&&!mandatoryActive?'<button id="finishMidseasonNow" class="btn secondary-strong">Nessun cambio, continua</button>':''}</div>`}${flexible&&ms.step>0&&ms.step<ms.target?`<div class="midseason-actions"><button id="finishAfterOne" class="btn primary">Concludi con ${ms.step} ${ms.step===1?'cambio':'cambi'}</button></div>`:''}</div></div></section>`;
 document.querySelectorAll('[data-out]').forEach(button=>button.onclick=()=>{
   if(mandatoryActive&&String(button.dataset.out)!==mandatoryId)return toast('Questo mercato richiede lo scambio obbligatorio del giocatore indicato.');
   if(ms.outgoingId)return toast('Hai già avviato questo scambio: devi scegliere e confermare uno dei candidati proposti.');
   ms.outgoingId=button.dataset.out;
   ms.clubId='';
   ms.candidates=[];
   ms.pendingCandidateId='';
   ms.drawsUsed=0;
   save();
   render();
   if(window.matchMedia&&window.matchMedia('(max-width:760px)').matches){
     requestAnimationFrame(()=>document.querySelector('.midseason-substitute-panel')?.scrollIntoView({behavior:'smooth',block:'start'}));
   }
 });
 const draw=document.getElementById('drawMarket');if(draw)draw.onclick=drawMarket;
 const fin=document.getElementById('finishMidseasonNow');if(fin)fin.onclick=finishMidseasonEarly;
 const finOne=document.getElementById('finishAfterOne');if(finOne)finOne.onclick=finishMidseasonEarly;
 document.querySelectorAll('[data-market]').forEach(button=>button.onclick=()=>selectMarketCandidate(button.dataset.market));
 const confirm=document.getElementById('confirmMarketChange');if(confirm)confirm.onclick=()=>completeMarket(ms.pendingCandidateId);
}
function drawMarket(){
 primeDraftAudio();
 const ms=state.midseason,outgoing=rosterEntry(ms.outgoingId);
 if(!outgoing)return toast('Scegli prima il giocatore da sostituire.');
 if(fantaballopoliRequiresGiuda(outgoing.playerId)){
   const giuda=createGiudaForEntry(outgoing);if(!giuda)return toast('Il giocatore misterioso non è disponibile.');
   ms.clubId='Fantaballopoli';ms.candidates=[String(giuda.id)];ms.pendingCandidateId='';ms.drawsUsed=midseasonDrawLimit();playDraftPackSound();save();render();animateMidseasonCandidateReveal();return;
 }
 if(!midseasonCanDraw())return toast(coachIs('talent-scout')?'Hai già utilizzato anche il re-roll aggiuntivo del Talent scout.':'L’estrazione è definitiva: non puoi cambiare club.');
 const used=new Set(state.draft.roster.map(entry=>String(entry.playerId)));
 let base=PLAYERS.filter(player=>player.club&&youngBeautifulAllowsPlayer(player)&&!used.has(String(player.id))&&(outgoing.bench||userCompatible(player,outgoing.slot)));
 const equalStrengthRequired=requiresEqualOrBetterMidseason(outgoing.playerId),outgoingOvr=Number(outgoing.player?.ovr||playerById(outgoing.playerId)?.ovr)||0;
 if(equalStrengthRequired){
   const compatiblePool=[...base];base=base.filter(player=>(Number(player.ovr)||0)>=outgoingOvr);
   if(!base.length&&compatiblePool.length){const source=[...compatiblePool].sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0))[0],boosted=registerGeneratedEventPlayer({...source,baseOvr:originalBaseOvr(source),id:`event-alien-market-${source.id}-${Date.now()}`,ovr:outgoingOvr,eventPlayer:true,eventUniverse:'alien-market'});base=[boosted];}
 }
 const coachSpecial=String(state.seasonRules.coachTopSwapPlayerId||'')===String(outgoing.playerId);
 const oneTimeGuaranteed=Boolean(state.seasonRules.guaranteedTopPlayerNextMidseason||coachSpecial);
 const fantaguruActive=Boolean(state.seasonRules.fantaguruBetterMidseason);
 if(coachSpecial)base=base.filter(player=>roleOf(player)===roleOf(outgoing.player));
 let guaranteedPlayer=null;
 if(oneTimeGuaranteed&&base.length){
   const top=base.filter(player=>(Number(player.ovr)||0)>=80).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0));
   guaranteedPlayer=(top[0]||[...base].sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0))[0])||null;
 }
 if(fantaguruActive&&base.length){
   const guru=fantaguruCandidate(outgoing,base);
   if(guru){
     if(!base.some(player=>String(player.id)===String(guru.id)))base.push(guru);
     const outgoingOvr=Number(outgoing.player?.ovr||playerById(outgoing.playerId)?.ovr)||0;
     if(!guaranteedPlayer||(Number(guaranteedPlayer.ovr)||0)<=outgoingOvr)guaranteedPlayer=guru;
   }
 }
 const groups={};
 base.forEach(player=>(groups[String(player.club)]??=[]).push(player));
 const previousClub=String(ms.clubId||'');
 if(guaranteedPlayer)ms.clubId=String(guaranteedPlayer.club);
 else{
   const preferred=Object.keys(groups).filter(clubId=>groups[clubId].length>=2&&clubById(clubId)&&clubId!==previousClub),fallback=Object.keys(groups).filter(clubId=>clubById(clubId)&&clubId!==previousClub),clubPool=preferred.length?preferred:(fallback.length?fallback:Object.keys(groups).filter(clubId=>clubById(clubId)));
   ms.clubId=(coachIs('talent-scout')?coachHighOvrPick(clubPool.map(clubId=>({id:clubId,ovr:Math.max(...(groups[clubId]||[]).map(player=>Number(player.ovr)||0),0)})))?.id:pick(clubPool))||'';
 }
 const clubPlayers=groups[ms.clubId]||[];
 ms.candidates=guaranteedPlayer?[String(guaranteedPlayer.id),...coachHighOvrSample(clubPlayers.filter(player=>String(player.id)!==String(guaranteedPlayer.id)),3).map(player=>String(player.id))]:coachHighOvrSample(clubPlayers,4).map(player=>String(player.id));
 ms.pendingCandidateId='';
 playDraftPackSound();
 ms.drawsUsed=Math.max(0,Number(ms.drawsUsed)||0)+1;
 if(state.seasonRules.guaranteedTopPlayerNextMidseason)state.seasonRules.guaranteedTopPlayerNextMidseason=false;
 if(coachSpecial)state.seasonRules.coachTopSwapPlayerId='';
 save();render();animateMidseasonCandidateReveal();
 if(fantaguruActive&&guaranteedPlayer)toast(`Fantaguru: ${guaranteedPlayer.name} (${guaranteedPlayer.ovr} OVR) è migliore del giocatore ceduto.`);
 else if(guaranteedPlayer)toast(`Top player garantito nel pack: ${guaranteedPlayer.name}.`);
}
function selectMarketCandidate(id){
 const ms=state.midseason;
 if(!ms.candidates.includes(String(id)))return;
 ms.pendingCandidateId=String(id);
 save();
 render();
}
function completeMarket(id){
 const ms=state.midseason;
 const index=state.draft.roster.findIndex(entry=>String(entry.playerId)===String(ms.outgoingId));
 if(index<0)return;
 const replacement=playerById(id);
 if(!replacement||!ms.candidates.includes(String(id)))return toast('Scegli un candidato valido.');
 if(!youngBeautifulAllowsPlayer(replacement))return toast(youngBeautifulBlockMessage(replacement));
 const oldEntry=rosterEntry(ms.outgoingId);
 const oldPlayer=oldEntry?.player||playerById(ms.outgoingId);
 const projection=midseasonProjection(ms.outgoingId,id);
 if(!projection)return toast('Confronto non disponibile.');
 state.draft.roster[index].playerId=String(id);
 state.draft.roster[index].player={...replacement};
 delete state.playInjured[String(ms.outgoingId)];
 const fulfilledMandatory=mandatoryMidseasonPlayerIds().includes(String(ms.outgoingId));
 if(fulfilledMandatory)clearMandatoryMidseasonPlayer(ms.outgoingId);
 if(String(state.seasonRules.topPlayerAfterMandatoryId||'')===String(ms.outgoingId)){state.seasonRules.guaranteedTopPlayerNextMidseason=true;state.seasonRules.topPlayerAfterMandatoryId='';}
 refreshOpponentClubRosters();
 ms.step++;
 ms.changes.push({outId:String(oldPlayer?.id||ms.outgoingId),incomingId:String(replacement.id),out:oldPlayer?.name||'Giocatore',incoming:replacement.name,slot:oldEntry?.slot||state.draft.roster[index].slot,clubId:String(replacement.club||''),beforeOverall:projection.current.overall,afterOverall:projection.projected.overall,deltaOverall:projection.deltaOverall,beforeChemistry:projection.current.chemistry.score,afterChemistry:projection.projected.chemistry.score,deltaChemistry:projection.deltaChemistry,outgoingOvr:projection.outgoingOvr,incomingOvr:projection.incomingOvr});
 ms.outgoingId=mandatoryMidseasonPlayerIds()[0]||'';
 ms.clubId='';
 ms.candidates=[];
 ms.pendingCandidateId='';
 ms.drawsUsed=0;
 const flexible=isFlexibleMidseason();
 if(ms.step>=ms.target)ms.completed=true;
 save();
 render();
 if(!ms.completed&&flexible)toast(`Cambio ${ms.step} confermato. Puoi fermarti qui oppure farne un altro.`);
}

function rankedGoalStats(){return Object.entries(state.stats?.goals||{}).filter(([,goals])=>Number(goals)>0).sort((a,b)=>Number(b[1]||0)-Number(a[1]||0)||String(statPlayerInfo(a[0]).name).localeCompare(String(statPlayerInfo(b[0]).name),'it'))}
function userTeamGoalStats(){const totals={};(state.history||[]).forEach(match=>(match.goals||[]).forEach(goal=>{const id=String(goal.playerId||'');if(id)totals[id]=(totals[id]||0)+1}));const exact=Object.entries(totals).filter(([,goals])=>Number(goals)>0).sort((a,b)=>Number(b[1])-Number(a[1])||String(statPlayerInfo(a[0]).name).localeCompare(String(statPlayerInfo(b[0]).name),'it'));return exact.length?exact:rankedGoalStats().filter(([id])=>String(statPlayerTeam(id)?.id||'')===USER_ID)}
function teamTopScorer(){return userTeamGoalStats()[0]||null}
function showFinished(){
 const table=sortedTable(),eliminated=isTeamEliminated(USER_ID),regularRank=eliminated?0:table.findIndex(x=>x.id===USER_ID)+1,p=leaguePlayoffState(),playoffTitle=leaguePlayoffTitleWon(),playoffActive=leaguePlayoffsRuleActive()&&p.status==='completed',achievementRank=playoffActive?(playoffTitle?1:Math.max(2,regularRank||2)):regularRank,rankLabel=eliminated?'—':playoffTitle?'🏆':playoffActive?`${regularRank}° REG.`:`${regularRank}°`,s=userStanding(),rankedGoals=rankedGoalStats(),top=rankedGoals[0],topPlayer=top?statPlayerInfo(top[0]):null,userTop=teamTopScorer(),userTopPlayer=userTop?statPlayerInfo(userTop[0]):null,canSubmit=(playoffActive?playoffTitle:regularRank===1)&&!eliminated,summary=buildSeasonSummary(playoffActive?(playoffTitle?1:regularRank):regularRank,eliminated),finalHeadline=playoffActive?(playoffTitle?'Campione dei play off!':!p.userQualified?'Non qualificato ai play off':p.userEliminated?'Eliminato dai play off':'Play off conclusi'):seasonFinalHeadline(regularRank,eliminated),playoffNote=leaguePlayoffFinalNote();
 checkSeasonAchievements(achievementRank,eliminated);
 screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Stagione conclusa</div><h2>${finalHeadline}</h2><div class="final-position">${rankLabel}</div><p>${esc(state.teamName)} chiude la stagione dopo ${state.matchday} giornate.${playoffNote?` ${esc(playoffNote)}`:''}</p></div><div class="final-grid"><div class="stat"><b>${s.pts}</b><span>Punti</span></div><div class="stat"><b>${s.w}-${s.d}-${s.l}</b><span>V-N-P</span></div><div class="stat"><b>${s.gf}</b><span>Gol fatti</span></div><div class="stat"><b>${s.ga}</b><span>Gol subiti</span></div></div>${renderSeasonSummaryCard(summary)}<section class="panel"><h3>Capocannonieri</h3><p><b>Campionato:</b> ${topPlayer?`${esc(topPlayer.name)} — ${Number(top[1])||0} gol`:'Nessun marcatore'}</p><p><b>${esc(state.teamName)}:</b> ${userTopPlayer?`${esc(userTopPlayer.name)} — ${Number(userTop[1])||0} gol`:'Nessun marcatore'}</p>${canSubmit?`<p class="subline">La vittoria del Campionato può essere inviata alla classifica generale. Il miglior marcatore della tua squadra verrà sommato alla tabella Capocannonieri.</p>`:`<p class="subline"><b>Invio non disponibile:</b> può inviare il risultato soltanto chi vince il Campionato o i play off scudetto.</p>`}<div class="top-actions">${canSubmit?`<button id="sendSeason" class="btn primary" ${state.submitted?'disabled':''}>${state.submitted?'Risultati inviati':'Invia vittoria'}</button>`:''}<button id="exportSeason" class="btn gold">Esporta risultati JSON</button></div></section>${renderFinalPlayerStats()}<div class="season-finished-table">${renderTable()}</div></section>`;
 const sendButton=document.getElementById('sendSeason');if(sendButton)sendButton.onclick=sendSeason;document.getElementById('exportSeason').onclick=exportSeason;document.getElementById('shareSeasonCard').onclick=()=>shareSeasonSummary(summary);document.getElementById('downloadSeasonCard').onclick=()=>downloadSeasonSummary(summary);
}

let seasonSendInFlight=false;
function createSeasonSubmissionCode(){
 state.meta=state.meta&&typeof state.meta==='object'?state.meta:{};
 if(state.meta.submissionCode)return String(state.meta.submissionCode);
 const randomPart=(globalThis.crypto&&typeof globalThis.crypto.randomUUID==='function')?globalThis.crypto.randomUUID():`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
 const created=String(state.meta.createdAt||new Date().toISOString()).replace(/[^0-9]/g,'').slice(0,17)||Date.now().toString(36);
 state.meta.submissionCode=`${SEASON_CONFIG.submission.prefix}-${created}-${randomPart}`;
 return state.meta.submissionCode;
}
function googleScriptRequestUrl(params={}){
 const url=new URL(VICTORY_ENDPOINT,window.location.href);
 Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,String(value)));
 url.searchParams.set('_fb',`${Date.now()}_${Math.floor(Math.random()*1000000)}`);
 return url.toString();
}
function waitForSeasonSubmissionStatus(submissionCode,timeoutMs=6500){
 return new Promise((resolve,reject)=>{
   if(!submissionCode){reject(new Error('Codice univoco della stagione mancante'));return}
   const callbackName=`fantaballaSubmissionStatus_${Date.now()}_${Math.floor(Math.random()*1000000)}`;
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
   script.src=googleScriptRequestUrl({action:'submission_status',codice_vittoria:submissionCode,callback:callbackName,transport:'jsonp'});
   document.body.appendChild(script);
 });
}
function submitSeasonPayloadVerified(payload,timeoutMs=22000){
 return new Promise((resolve,reject)=>{
   if(!VICTORY_ENDPOINT||!/^https:\/\/script\.google\.com\//i.test(VICTORY_ENDPOINT)){
     reject(new Error('Endpoint Google Apps Script non configurato'));
     return;
   }
   const requestId=`fb_submit_${Date.now()}_${Math.floor(Math.random()*1000000)}`;
   const frameName=`fantaballaSubmitFrame_${requestId}`;
   const iframe=document.createElement('iframe');
   const form=document.createElement('form');
   let settled=false;
   iframe.name=frameName;
   iframe.setAttribute('aria-hidden','true');
   iframe.tabIndex=-1;
   iframe.style.cssText='position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none';
   form.method='POST';
   form.action=VICTORY_ENDPOINT;
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
   function finish(handler,value){
     if(settled)return;
     settled=true;
     cleanup();
     handler(value);
   }
   function onMessage(event){
     const message=event&&event.data;
     if(!message||message.type!=='fantaballa-classifica-response-v1'||message.requestId!==requestId)return;
     const origin=String(event.origin||'');
     if(origin!=='null'&&!/^https:\/\/([a-z0-9-]+\.)*(google\.com|googleusercontent\.com)$/i.test(origin))return;
     const result=message.data;
     if(!result||typeof result.ok!=='boolean'){
       finish(reject,new Error('Risposta non valida da Google Apps Script'));
       return;
     }
     if(!result.ok){
       finish(reject,new Error(String(result.error||'Google Apps Script ha rifiutato il risultato')));
       return;
     }
     finish(resolve,result);
   }
   async function verifySavedRow(){
     await new Promise(done=>window.setTimeout(done,1200));
     while(!settled){
       try{
         const status=await waitForSeasonSubmissionStatus(payload.codice_vittoria||payload.victoryCode,5000);
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
async function sendSeason(){
 const s=userStanding(),regularRank=sortedTable().findIndex(row=>row.id===USER_ID)+1,titleWon=leaguePlayoffsRuleActive()?leaguePlayoffTitleWon():regularRank===1;
 if(!titleWon){toast('Puoi inviare il risultato solo vincendo il Campionato');return}
 if(state.submitted||seasonSendInFlight){toast(state.submitted?'Risultato già inviato':'Invio già in corso');return}
 const sendButton=document.getElementById('sendSeason');
 seasonSendInFlight=true;
 if(sendButton){sendButton.disabled=true;sendButton.textContent='Invio in corso…';sendButton.setAttribute('aria-busy','true')}
 const rankedGoals=rankedGoalStats(),top=rankedGoals[0],topGoals=top?Number(top[1])||0:0,p=top?statPlayerInfo(top[0]):null,userTop=teamTopScorer(),userTopGoals=userTop?Number(userTop[1])||0:0,userTopPlayer=userTop?statPlayerInfo(userTop[0]):null;
 const userScorerText=userTopPlayer?`${userTopPlayer.name} (${userTopGoals})`:'';
 const leagueScorerText=p?`${p.name} (${topGoals})`:'';
 const submissionCode=createSeasonSubmissionCode();
 const payload={codice_vittoria:submissionCode,victoryCode:submissionCode,squadra:state.teamName,allenatore:state.coachName,tipo_allenatore:coachProfile().name,modalita:chaosEnabled()?SEASON_CONFIG.submission.chaosLabel:SEASON_CONFIG.submission.standardLabel,modalita_tipo:chaosEnabled()?SEASON_CONFIG.submission.chaosType:SEASON_CONFIG.submission.standardType,posizione_finale:1,punti:s.pts,giornate:seasonLength(),vittorie:s.w,pareggi:s.d,sconfitte:s.l,gol_fatti:s.gf,gol_subiti:s.ga,modulo:state.formation,ovr_medio:Math.round(teamPowerBase()*10)/10,capocannoniere:userScorerText,capocannoniere_giocatore:userScorerText,capocannoniere_campionato:leagueScorerText};
 state.meta.submissionPendingAt=new Date().toISOString();
 save();
 try{
   const result=await submitSeasonPayloadVerified(payload);
   state.submitted=true;
   state.meta.submittedAt=new Date().toISOString();
   state.meta.submissionPendingAt='';
   state.meta.lastSubmissionError='';
   save();
   render();
   toast(result.duplicate?'Risultato già presente: invio confermato':'Vittoria e miglior marcatore della squadra inviati');
 }catch(error){
   state.submitted=false;
   state.meta.submittedAt='';
   state.meta.submissionPendingAt='';
   state.meta.lastSubmissionError=String(error&&error.message?error.message:error||'Errore sconosciuto');
   save();
   toast(`Invio non riuscito: ${state.meta.lastSubmissionError}`);
 }finally{
   seasonSendInFlight=false;
   const currentButton=document.getElementById('sendSeason');
   if(!state.submitted&&currentButton){currentButton.disabled=false;currentButton.textContent='Invia vittoria';currentButton.removeAttribute('aria-busy')}
 }
}
function exportSeason(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='fantaballa-campionato-risultati.json';a.click();URL.revokeObjectURL(a.href)}
function render(){updateSaveStatus();if(!PLAYERS.length||!CLUBS.length){screen.innerHTML='<section class="panel"><h2>Caricamento database giocatori...</h2></section>';applyError404VisualState();return}if(state.phase==='setup')showSetup();else if(state.phase==='draft')showDraft();else if(state.phase==='season')showSeason();else if(state.phase==='midseason')showMidseason();else if(state.phase==='story-final')showMeritStoryFinale();else if(state.phase==='italia-2006-final')showItalia2006Final();else if(state.phase==='fantaballopoli-final')showFantaballopoliFinal();else if(state.phase==='fantaballopoli-restart')showFantaballopoliRestart();else if(state.phase==='playoffs')showLeaguePlayoffs();else if(state.phase==='finished')showFinished();applyError404VisualState();updateSaveStatus()}
async function boot(){
 try{
   const [primaryPlayers,primaryClubs,commentary,secondaryPlayers,secondaryClubs]=await Promise.all([
     fetchJsonResource(SEASON_CONFIG.data.primaryPlayers,SEASON_CONFIG.data.primaryPlayers),
     fetchJsonResource(SEASON_CONFIG.data.primaryClubs,SEASON_CONFIG.data.primaryClubs),
     fetchJsonResource(SEASON_CONFIG.data.commentary,SEASON_CONFIG.data.commentary,{optional:true}),
     fetchJsonResource(SEASON_CONFIG.data.secondaryPlayers,SEASON_CONFIG.data.secondaryPlayers,{optional:true}),
     fetchJsonResource(SEASON_CONFIG.data.secondaryClubs,SEASON_CONFIG.data.secondaryClubs,{optional:true})
   ]);
   PLAYERS=primaryPlayers;CLUBS=primaryClubs;COMMENTARY=commentary;OTHER_CLUBS=Array.isArray(secondaryClubs)?secondaryClubs:[];
   if(SEASON_CONFIG.mode==='real'){REAL_PLAYERS=PLAYERS;CLASSIC_PLAYERS=Array.isArray(secondaryPlayers)?secondaryPlayers:[]}
   else{CLASSIC_PLAYERS=PLAYERS;REAL_PLAYERS=Array.isArray(secondaryPlayers)?secondaryPlayers:[]}
   dataDiagnostics=validateGameData(PLAYERS,CLUBS);
   if(dataDiagnostics.fatal.length)throw Error(dataDiagnostics.fatal.slice(0,12).join(' | ')+(dataDiagnostics.fatal.length>12?` | Altri ${dataDiagnostics.fatal.length-12} errori.`:''));
 }catch(error){
   console.error('Errore caricamento database',error);showBootError(error);return;
 }
 try{
   state=normalizeCampionatoState(state);save();cleanupLegacySaveArtifacts();render();
   if(startupNotice)toast(startupNotice);
   else if(dataDiagnostics.warnings.length)toast(`Database caricato con ${dataDiagnostics.warnings.length} avvisi.`);
 }catch(error){
   console.error(`Errore interfaccia ${SEASON_CONFIG.labels.competitionName}`,error);
   screen.innerHTML=`<section class="panel robust-error"><div class="label">Ripristino interfaccia</div><h2>La schermata non si è aperta</h2><p>Il salvataggio automatico è ancora presente e non è stato cancellato.</p><div class="robust-error-detail">${esc(error&&error.message?error.message:error)}</div><div class="top-actions" style="margin-top:14px"><button id="recoverInterfaceBtn" class="btn primary" type="button">Riprova senza cancellare</button><button id="recoverDraftViewBtn" class="btn gold" type="button">Apri il draft in modalità sicura</button></div></section>`;
   const recover=document.getElementById('recoverInterfaceBtn');if(recover)recover.onclick=()=>{state=normalizeCampionatoState(state);render()};
   const safeDraft=document.getElementById('recoverDraftViewBtn');if(safeDraft)safeDraft.onclick=()=>{state=normalizeCampionatoState(state);state.phase='draft';mobileDraftTab='players';save();render()};
 }
}
document.getElementById('resetBtn').onclick=async()=>{
 const confirmed=await openConfirm({title:'Azzera stagione',message:'La stagione corrente verrà cancellata definitivamente. Non esistono backup o possibilità di ripristino.',confirmText:'Azzera definitivamente',danger:true});
 if(!confirmed)return;
 localStorage.removeItem(AUTO_SAVE_KEY);state=freshState();save();render();toast('Stagione azzerata definitivamente.')
};
window.addEventListener('pagehide',()=>save());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save()});
window.addEventListener('error',event=>{console.error('Errore JavaScript non gestito',event.error||event.message)});
window.addEventListener('unhandledrejection',event=>{console.error('Promise non gestita',event.reason)});
boot();
