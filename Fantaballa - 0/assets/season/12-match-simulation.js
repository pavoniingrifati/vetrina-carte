/* Fantaballa Season Engine — 12-match-simulation.js
 * Simulazione, gol, statistiche, cronaca live, giornata e risultato partita.
 * Modulo classico: l'ordine di caricamento è definito negli HTML del Campionato.
 */
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

