/* Fantaballa Season Engine — 02-achievements.js
 * Integrazione achievement e controlli di fine partita/stagione.
 * Modulo classico: l'ordine di caricamento è definito negli HTML del Campionato.
 */
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
 if(won&&state.seasonRules.marottaDoubleWins&&String(result?.pointsNote||'').includes('Marotta League'))unlockAchievement('marotta-league');
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
 if(wonTitle&&Number(standing?.l)>Number(standing?.w))unlockAchievement('chi-perde-vince');
 if(wonTitle&&Number(standing?.w)===0)unlockAchievement('zero-vittorie-un-titolo');
 if(cupWon&&!wonTitle)unlockAchievement('coppa-di-consolazione');
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

