/* Fantaballa Season Engine — 08-special-rules.js
 * Azioni degli eventi, regolamenti speciali, playoff e modificatori persistenti.
 * Modulo classico: l'ordine di caricamento è definito negli HTML del Campionato.
 */
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

