/* Fantaballa Season Engine — 09-analytics-and-summary.js
 * Risoluzione formazione, potenza, analytics e riepilogo condivisibile della stagione.
 * Modulo classico: l'ordine di caricamento è definito negli HTML del Campionato.
 */
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

