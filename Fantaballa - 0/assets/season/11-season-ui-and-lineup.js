/* Fantaballa Season Engine — 11-season-ui-and-lineup.js
 * Schermata della stagione, disponibilità, avversari, formazione ed effetti sulla rosa.
 * Modulo classico: l'ordine di caricamento è definito negli HTML del Campionato.
 */
function renderAvailability(){const list=unavailableList();if(!list.length)return'<p>Nessun indisponibile.</p>';return `<div class="availability">${list.map(r=>{const s=statusOf(r.playerId),starter=!r.bench;const statusText=s.suspension>0?`Squalificato: ${s.suspension} giornate`:s.seasonOut?`Fuori fino a fine stagione${s.seasonOutReason?` · ${esc(s.seasonOutReason)}`:''}`:`Infortunato: ${s.injury} giornate`;return `<div class="availability-row"><b>${esc(r.player.name)}</b><small>${statusText}</small>${starter&&s.injury>0&&!s.seasonOut?`<button class="btn ${state.playInjured[r.playerId]?'red':''}" data-injured="${esc(r.playerId)}" type="button" aria-pressed="${state.playInjured[r.playerId]?'true':'false'}">${state.playInjured[r.playerId]?'Gioca infortunato: sì (-20 Intesa)':'Gioca infortunato: no'}</button>`:''}</div>`}).join('')}</div>`}
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

function previewTeamAverageOvr(team){
 if(!team)return 0;
 if(String(team.id||'')===String(USER_ID))return Math.round(resolvedLineupAverage(resolveLineup())||0);
 return Math.round(opponentMatchPower(team)||0);
}
function seasonTeamInitials(name){
 const words=String(name||'Squadra').trim().split(/\s+/).filter(Boolean);
 return (words.length>1?`${words[0][0]||''}${words[1][0]||''}`:(words[0]||'SQ').slice(0,2)).toUpperCase();
}
function renderNextTeamCard(team,label,ovr,options={}){
 const safeTeam=team||{name:state.teamName};
 const average=Math.max(1,Math.round(Number(ovr)||0));
 const side=String(options.side||'').trim();
 const detail=String(options.detail||label||'Squadra');
 return `<div class="next-team-card ${side?`is-${esc(side)}`:''}" style="${teamCssVars(safeTeam)}"><span class="next-team-colors"></span><div class="next-team-identity"><div class="next-team-badge" aria-hidden="true">${esc(seasonTeamInitials(safeTeam?.name||state.teamName))}</div><div class="next-team-copy"><div class="team-name" style="font-size:${teamNameFontSize(safeTeam?.name||state.teamName)}px" title="${esc(safeTeam?.name||state.teamName)}">${esc(safeTeam?.name||state.teamName)}</div><div class="next-team-meta"><div class="subline">${esc(detail)}</div><div class="next-team-ovr">OVR <b>${average}</b></div></div></div></div></div>`;
}
function showParallelCupMatch(pending){
 const cup=parallelCupState(),stage=cup.stages?.[Number(pending.stageIndex)],tie=stage?.ties?.find(item=>String(item.id)===String(pending.tieId));
 if(!stage||!tie){cup.pendingMatch=null;save();render();return}
 const teamA=parallelCupParticipant(tie.teamAId),teamB=parallelCupParticipant(tie.teamBId),homeParticipant=Number(pending.legIndex)===0?teamA:teamB,awayParticipant=Number(pending.legIndex)===0?teamB:teamA;
 const homeTeam=parallelCupParticipantTeam(homeParticipant),awayTeam=parallelCupParticipantTeam(awayParticipant),opponentParticipant=homeParticipant?.user?awayParticipant:homeParticipant,opponentTeam=parallelCupParticipantTeam(opponentParticipant),opponentLineup=parallelCupParticipantLineup(opponentParticipant),event=pending.event||parallelCupDedicatedEvent(Boolean(pending.userHome));
 pending.event=event;
 screen.innerHTML=`<div class="parallel-cup-match-view"><section class="parallel-cup-match-hero"><div class="parallel-cup-match-top"><div><div class="label">🏆 Coppa parallela · prima della giornata ${Number(pending.matchday)}</div><h2>${esc(stage.name)}</h2></div><div class="parallel-cup-leg-badge">${Number(pending.legIndex)===0?'Andata':'Ritorno'}</div></div><div class="next-match">${renderNextTeamCard(homeTeam,'Casa',previewTeamAverageOvr(homeTeam))}<div class="versus">VS</div>${renderNextTeamCard(awayTeam,'Trasferta',previewTeamAverageOvr(awayTeam))}</div><div class="parallel-cup-aggregate"><b>Aggregato attuale:</b> ${Number(tie.aggregateA)||0}-${Number(tie.aggregateB)||0} · Questa partita non fa avanzare la giornata di campionato.</div><div class="parallel-cup-event-card"><span>Evento dedicato alla coppa</span><b>${esc(event.title)}</b><p>${esc(event.description)}</p></div><div class="parallel-cup-match-actions"><button id="playCupLive" class="btn match-live-button" type="button" data-single-action data-busy-announcement="Partita di coppa avviata con cronaca.">🎙️ Gioca con cronaca</button><button id="playCupInstant" class="btn match-instant-button" type="button" data-single-action data-busy-announcement="Simulazione della partita di coppa avviata.">⚡ Simula subito</button></div></section><div class="dashboard-grid season-dashboard-grid"><div class="season-main-column">${renderParallelCupPanel()}<section class="panel"><div class="label">La tua formazione</div>${renderResolvedLineup()}</section></div><aside class="season-sidebar"><section class="panel opponent-club-panel" style="${teamCssVars(opponentTeam)}"><div class="label">Avversario di coppa</div><h3>${esc(opponentTeam.name)}</h3><p>OVR stimato ${parallelCupParticipantPower(opponentParticipant).toFixed(1)}</p>${renderParallelCupOpponentLineup(opponentLineup)}</section><section class="panel season-availability-panel"><div class="label">Indisponibili</div>${renderAvailability()}</section></aside></div></div>`;
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


function seasonHomeForm(limit=5){
 const history=Array.isArray(state.history)?state.history:[];
 const recent=history.slice(-Math.max(1,Number(limit)||5)).map(match=>{
  const outcome=journeyOutcome(match);
  return {type:outcome,label:outcome==='win'?'V':outcome==='draw'?'N':'P',title:outcome==='win'?'Vittoria':outcome==='draw'?'Pareggio':'Sconfitta'};
 });
 while(recent.length<limit)recent.unshift({type:'empty',label:'–',title:'Nessuna partita'});
 return recent;
}
function renderSeasonHomeTopline({rank,standing,lineupOvr,chemistry}){
 const rounds=Math.max(1,Array.isArray(state.schedule)?state.schedule.length:38);
 const form=seasonHomeForm(5);
 return `<section class="season-home-topline" aria-label="Riepilogo stagione"><div><span>Giornata</span><b>${Math.min(rounds,state.matchday+1)}<small>/${rounds}</small></b></div><div><span>Posizione</span><b>${rank}°</b></div><div><span>Punti</span><b>${Number(standing?.pts)||0}</b></div><div class="season-home-form"><span>Ultime cinque</span><div aria-label="Forma recente">${form.map(result=>`<b class="season-home-form-result ${result.type}" title="${esc(result.title)}">${result.label}</b>`).join('')}</div></div><div><span>OVR medio</span><b>${Number(lineupOvr).toFixed(1)}</b></div><div><span>Intesa</span><b>${Number(chemistry?.score)||0}<small>/100</small></b></div></section>`;
}
function seasonMatchDifficulty(userOvr,opponentOvr){
 const delta=(Number(opponentOvr)||0)-(Number(userOvr)||0);
 if(delta>=8)return{label:'Molto difficile',className:'is-extreme',delta};
 if(delta>=4)return{label:'Difficile',className:'is-hard',delta};
 if(delta>=-3)return{label:'Equilibrata',className:'is-balanced',delta};
 return{label:'Favorevole',className:'is-favourable',delta};
}
function renderSeasonHomeAttention(){
 const fragments=[
  renderParallelCupPanel(),
  typeof renderSeasonInventory==='function'?renderSeasonInventory():'',
  renderActiveQuest(),
  renderError404StoryPanel(),
  renderFantaballopoliPanel(),
  renderMeritStoryPanel(),
  renderEvent()
 ].filter(Boolean);
 const pending=Boolean(state.pendingEvent&&!state.pendingEvent.resolved)||(typeof leaderQuestSelectionPending==='function'&&leaderQuestSelectionPending());
 const content=fragments.length?fragments.join(''):`<div class="season-home-quiet"><span aria-hidden="true">✓</span><div><b>Nessuna decisione urgente</b><p>La squadra è pronta. Puoi giocare la prossima partita oppure consultare rosa e statistiche.</p></div></div>`;
 return `<section class="panel season-home-card season-home-attention fanta-card fanta-card--story" id="seasonHomeAttention"><div class="season-home-section-head"><div><span>Richiede la tua attenzione</span><b>${pending?'Completa la scelta prima di giocare':'Decisioni, missioni e storia'}</b></div><i aria-hidden="true">${pending?'!':'✓'}</i></div><div class="season-home-attention-content">${content}</div></section>`;
}
function renderSeasonHomeStatus(opponent){
 const lineup=resolveLineup(),chemistry=draftChemistry(lineup),unavailable=unavailableList();
 const injuries=unavailable.filter(entry=>statusOf(entry.playerId).injury>0).length;
 const suspensions=unavailable.filter(entry=>statusOf(entry.playerId).suspension>0).length;
 const average=resolvedLineupAverage(lineup);
 const ready=unavailable.length===0;
 return `<section class="panel season-home-card season-home-status fanta-card fanta-card--info"><div class="season-home-section-head"><div><span>Stato squadra</span><b>Modulo ${esc(state.formation)} · formazione effettiva</b></div><span class="season-home-ready ${ready?'':'has-alert'}">${ready?'Pronta':`${unavailable.length} indisponibili`}</span></div><div class="season-home-status-metrics"><div><span>OVR partita</span><b>${average.toFixed(1)}</b></div><div><span>Intesa</span><b>${chemistry.score}/100</b></div><div><span>Titolari</span><b>${lineup.length}/${seasonStarterTarget()}</b></div><div><span>Modulo</span><b>${esc(state.formation)}</b></div></div><div class="season-home-availability-summary"><span>Infortunati: ${injuries}</span><span>Squalificati: ${suspensions}</span></div>${ready?'<div class="season-home-ok">Nessun giocatore indisponibile</div>':''}<button id="openSeasonRoster" class="season-home-manage-button" type="button">Apri rosa e formazione</button><details class="season-home-details"><summary>Formazione effettiva della prossima partita</summary>${renderResolvedLineup()}</details><details class="season-home-details"><summary>Gestisci indisponibili</summary>${renderAvailability()}</details><div class="season-home-opponent">${seasonRuleSummary()}${renderOpponentRoster(opponent)}</div></section>`;
}
function renderSeasonNearbyStandings(){
 const table=sortedTable(),userIndex=Math.max(0,table.findIndex(row=>String(row.id)===String(USER_ID))),visibleCount=Math.min(5,table.length);
 const start=Math.max(0,Math.min(userIndex-2,table.length-visibleCount));
 const rows=table.slice(start,start+visibleCount);
 return `<section class="panel season-home-card season-home-standings fanta-card fanta-card--table"><div class="season-home-section-head"><div><span>Situazione campionato</span><b>Le squadre intorno a te</b></div><button class="season-home-text-button" data-open-season-tab="table" type="button">Classifica completa</button></div><div class="season-home-standing-list">${rows.map((row,index)=>{const team=teamById(row.id)||{id:row.id,name:row.name||'Squadra'};const absolutePosition=start+index+1;return `<div class="season-home-standing-row ${String(row.id)===String(USER_ID)?'is-user':''}" style="${teamCssVars(team)}"><span class="season-home-position">${absolutePosition}</span><span class="season-home-standing-team">${teamColorDot(team)}<b>${esc(team.name||row.name||'Squadra')}</b></span><span class="season-home-standing-form">${Number(row.w)||0}V · ${Number(row.d)||0}N · ${Number(row.l)||0}P</span><strong>${Number(row.pts)||0}</strong></div>`}).join('')}</div></section>`;
}
function renderSeasonUpcomingFixtures(){
 const schedule=Array.isArray(state.schedule)?state.schedule:[];
 const fixtures=[];
 for(let index=state.matchday;index<schedule.length&&fixtures.length<4;index++){
  const fixture=(schedule[index]||[]).find(match=>match.home===USER_ID||match.away===USER_ID);if(!fixture)continue;
  const userHome=fixture.home===USER_ID,opponent=teamById(userHome?fixture.away:fixture.home);
  fixtures.push({index,userHome,opponent});
 }
 return `<section class="panel season-home-card season-home-fixtures fanta-card fanta-card--table"><div class="season-home-section-head"><div><span>Prossimi impegni</span><b>Il percorso che ti aspetta</b></div><button class="season-home-text-button" data-open-season-tab="calendar" type="button">Calendario</button></div><div class="season-home-fixture-list">${fixtures.length?fixtures.map((item,index)=>`<div class="season-home-fixture-row ${index===0?'is-next':''}" style="${teamCssVars(item.opponent)}"><span><small>${index===0?'Prossima':`Giornata ${item.index+1}`} · ${item.userHome?'Casa':'Trasferta'}</small><b>${teamColorDot(item.opponent)}${esc(item.opponent?.name||'Avversario')}</b></span><strong>${item.userHome?'CASA':'TRASFERTA'}</strong></div>`).join(''):'<p class="season-home-empty">Nessun altro incontro in calendario.</p>'}</div></section>`;
}
function renderSeasonHomeChaos(){
 const feed=renderChaosLeagueFeed();if(!feed)return'';
 return `<section class="panel season-home-card season-home-chaos"><details><summary>🌀 Attività delle altre squadre</summary>${feed}</details></section>`;
}
function renderSeasonHomeTabs(){
 return `<section class="panel season-tabs-panel season-home-tabs"><div class="tabs" role="tablist" aria-label="Sezioni della stagione"><button class="tab active" data-tab="table" type="button" role="tab" aria-selected="true">Classifica</button><button class="tab" data-tab="calendar" type="button" role="tab" aria-selected="false">Calendario</button><button class="tab" data-tab="roster" type="button" role="tab" aria-selected="false">Rosa</button><button class="tab" data-tab="stats" type="button" role="tab" aria-selected="false">Statistiche</button><button class="tab" data-tab="journey" type="button" role="tab" aria-selected="false">Percorso</button></div><div id="tab-table" class="tab-view active" role="tabpanel">${renderTable()}</div><div id="tab-calendar" class="tab-view" role="tabpanel">${renderCalendar()}</div><div id="tab-roster" class="tab-view" role="tabpanel">${renderSeasonRosterField()}</div><div id="tab-stats" class="tab-view" role="tabpanel">${renderStats()}</div><div id="tab-journey" class="tab-view" role="tabpanel">${renderSeasonJourney()}</div></section>`;
}
function activateSeasonTab(name,{scroll=true}={}){
 const target=document.getElementById(`tab-${name}`);if(!target)return;
 document.querySelectorAll('.season-tabs-panel .tab').forEach(button=>{const active=button.dataset.tab===name;button.classList.toggle('active',active);button.setAttribute('aria-selected',active?'true':'false')});
 document.querySelectorAll('.season-tabs-panel .tab-view').forEach(view=>view.classList.toggle('active',view===target));
 if(scroll)document.querySelector('.season-tabs-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function showSeason(){
 if(state.matchday>=19&&parallelCupState().status==='pending')initializeParallelCup();
 const pendingCupMatch=parallelCupPendingMatch();
 if(pendingCupMatch){showParallelCupMatch(pendingCupMatch);return}
 prepareEvent();
 const fx=userFixture(),opp=teamById(fx.home===USER_ID?fx.away:fx.home),userTeam=teamById(USER_ID)||{id:USER_ID,name:state.teamName,clubId:state.userClubId,colors:activeUserClub().colorClub},homeTeam=teamById(fx.home),awayTeam=teamById(fx.away),standing=userStanding(),rank=sortedTable().findIndex(x=>x.id===USER_ID)+1,userHome=fx.home===USER_ID,lineup=resolveLineup(),lineupOvr=resolvedLineupAverage(lineup),chemistry=draftChemistry(lineup),opponentOvr=previewTeamAverageOvr(opp),difficulty=seasonMatchDifficulty(lineupOvr,opponentOvr),eventPending=Boolean(state.pendingEvent&&!state.pendingEvent.resolved),questSelectionPending=typeof leaderQuestSelectionPending==='function'&&leaderQuestSelectionPending(),matchBlocked=eventPending||questSelectionPending,matchDisabled=matchBlocked?'disabled aria-disabled="true" aria-describedby="matchActionStatus" data-disabled-reason="Completa prima la scelta in attesa."':'',matchStatus=eventPending?'Prima di giocare devi scegliere una delle opzioni dell’evento in attesa.':questSelectionPending?'Prima di giocare devi scegliere il leader della quest.':'Scegli la cronaca completa oppure la simulazione rapida.';
 const venueLabel=userHome?'Partita in casa':'Partita in trasferta';
 screen.innerHTML=`<div class="season-home" style="${teamCssVars(userTeam)}">${renderSeasonHomeTopline({rank,standing,lineupOvr,chemistry})}<div class="season-home-dashboard-grid"><div class="season-home-dashboard-main"><section class="panel season-home-match fanta-card fanta-card--match"><div class="season-home-match-head"><div><span>Giornata ${state.matchday+1} · ${venueLabel}</span><b>${userHome?'Difendi il tuo campo':'Cerca punti lontano da casa'}</b></div><strong class="season-home-difficulty ${difficulty.className}" title="Differenza OVR: ${difficulty.delta>=0?'+':''}${difficulty.delta.toFixed(1)}">${difficulty.label}</strong></div><div class="next-match season-home-next-match">${renderNextTeamCard(homeTeam,userHome?'La tua squadra':'Avversario',previewTeamAverageOvr(homeTeam),{side:'home',detail:userHome?'La tua squadra · Casa':'Avversario · Casa'})}<div class="versus" aria-label="contro">VS</div>${renderNextTeamCard(awayTeam,userHome?'Avversario':'La tua squadra',previewTeamAverageOvr(awayTeam),{side:'away',detail:userHome?'Avversario · Trasferta':'La tua squadra · Trasferta'})}</div>${matchBlocked?`<button class="season-home-blocked" type="button" data-focus-attention><b>Partita bloccata</b><span>Completa la scelta →</span></button>`:''}<div class="season-home-match-actions"><button id="playRoundLive" class="btn match-live-button" type="button" data-single-action data-busy-announcement="Partita avviata con cronaca." ${matchDisabled}>🎙️ Gioca con cronaca</button><button id="playRoundInstant" class="btn match-instant-button" type="button" data-single-action data-busy-announcement="Simulazione della giornata avviata." ${matchDisabled}>⚡ Simula</button></div><div id="matchActionStatus" class="match-play-note a11y-command-message ${matchBlocked?'is-blocked':''}" role="status" aria-live="polite">${matchStatus}</div></section><div class="season-home-dashboard-lower season-home-primary-grid">${renderSeasonHomeAttention()}${renderSeasonHomeStatus(opp)}</div>${renderSeasonHomeTabs()}</div><aside class="season-home-dashboard-side">${renderSeasonNearbyStandings()}${renderSeasonUpcomingFixtures()}${renderSeasonHomeChaos()}</aside></div></div>`;
 document.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>resolveDecision(Number(button.dataset.choice)));
 bindSeasonEventControls();
 bindMeritStoryControls();
 bindError404StoryControls();
 bindFantaballopoliControls();
 if(typeof bindSeasonInventoryControls==='function')bindSeasonInventoryControls();
 if(typeof bindLeaderQuestControls==='function')bindLeaderQuestControls();
 document.querySelectorAll('[data-injured]').forEach(button=>button.onclick=()=>{const id=button.dataset.injured;state.playInjured[id]=!state.playInjured[id];save();render()});
 const liveButton=document.getElementById('playRoundLive'),instantButton=document.getElementById('playRoundInstant');
 if(liveButton)liveButton.onclick=()=>playRound('live');
 if(instantButton)instantButton.onclick=()=>playRound('instant');
 document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>activateSeasonTab(button.dataset.tab,{scroll:false}));
 document.querySelectorAll('[data-open-season-tab]').forEach(button=>button.onclick=()=>activateSeasonTab(button.dataset.openSeasonTab));
 const rosterButton=document.getElementById('openSeasonRoster');if(rosterButton)rosterButton.onclick=()=>activateSeasonTab('roster');
 const attentionButton=document.querySelector('[data-focus-attention]');if(attentionButton)attentionButton.onclick=()=>document.getElementById('seasonHomeAttention')?.scrollIntoView({behavior:'smooth',block:'center'});
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
 return `${emergencyYouthCount?`<div class="season-rules-card"><b>${emergencyYouthCount} Primavera d’emergenza</b><br>Gli slot senza un giocatore reale valgono 50 OVR fisso e non ricevono bonus.</div>`:''}<div class="resolved-lineup-list">${lineup.map(entry=>{const player=entry.player||{};const fx=lineupEffects(entry,lineup);const sub=isSubscriber(player),creator=isCreator(player);const finalOvr=resolvedPlayerFinalOvr(entry,lineup);return `<div class="resolved-player-card ${sub?'subscriber-card':''} ${creator?'creator-card':''}"><span class="slot-code">${esc(entry.slot)}</span>${renderMiniAvatar(player,'small')}<div class="resolved-main"><div class="resolved-name-line"><b>${esc(player.name)}</b>${sub?'<span class="resolved-tag-sub">★ ABB</span>':''}${creator?'<span class="resolved-tag-creator" title="Creator">CR</span>':''}${typeof captainArmbandActive==='function'&&String(captainArmbandActive()?.playerId||'')===String(entry.playerId)?'<span class="resolved-tag-item">© CAPITANO</span>':''}</div><span class="resolved-meta">${entry.replaces?`Al posto di ${esc(entry.replaces)}`:`${esc(player.nation)} · ${esc(player.Position)}`}</span>${fx.effects.length?`<div class="resolved-effects">${fx.effects.map(effect=>`<span class="resolved-effect ${effect.type}">${esc(effect.label)}</span>`).join('')}</div>`:'<div class="resolved-effects"><span class="resolved-effect neutral">Nessun bonus o malus</span></div>'}</div><div class="resolved-ovr-col"><span class="chip ovr">${finalOvr}</span><span class="resolved-total">OVR finale</span></div></div>`}).join('')}</div>`
}
function renderTable(){const rows=sortedTable();return `<div class="season-table-scroll" role="region" aria-label="Classifica del campionato" tabindex="0"><table><thead><tr><th>Squadra</th><th>PG</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th><th>DR</th><th>Pt</th></tr></thead><tbody>${rows.map((r,i)=>{const team=teamById(r.id);return `<tr class="${r.id===USER_ID?'us-row':''}" style="${teamCssVars(team)}"><td><span class="standing-team">${teamColorDot(team)}<span>${i+1}. ${esc(r.name)}</span></span></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gf-r.ga}</td><td>${r.pts}</td></tr>`}).join('')}</tbody></table></div>`}
function renderCalendar(){return `<div class="calendar">${state.schedule.map((rd,i)=>{const fx=rd.find(m=>m.home===USER_ID||m.away===USER_ID),home=teamById(fx.home),away=teamById(fx.away),hist=state.history[i];return `<div class="calendar-row ${i===state.matchday?'current':''} ${i<state.matchday?'done':''}"><b>G ${i+1}</b><span class="calendar-clubs"><span class="calendar-team" style="${teamCssVars(home)}">${teamColorDot(home)}<span>${esc(home?.name||state.teamName)}</span></span><em>–</em><span class="calendar-team" style="${teamCssVars(away)}">${teamColorDot(away)}<span>${esc(away?.name||state.teamName)}</span></span></span><strong>${hist?`${Number.isFinite(Number(hist.displayGf))?Number(hist.displayGf):hist.gf}-${Number.isFinite(Number(hist.displayGa))?Number(hist.displayGa):hist.ga}${hist.penalties?' d.c.r.':''}`:'-'}</strong></div>`}).join('')}</div>`}
function renderStats(){const goals=Object.entries(state.stats.goals).sort((a,b)=>b[1]-a[1]).slice(0,10);const assists=Object.entries(state.stats.assists).sort((a,b)=>b[1]-a[1]).slice(0,10);return `<div class="setup-grid"><div><h3>Marcatori</h3>${goals.length?goals.map(([id,n],i)=>`<p><b>${i+1}. ${esc(statPlayerInfo(id).name)}</b> — ${n}</p>`).join(''):'<p>Nessun gol.</p>'}</div><div><h3>Assist</h3>${assists.length?assists.map(([id,n],i)=>`<p><b>${i+1}. ${esc(statPlayerInfo(id).name)}</b> — ${n}</p>`).join(''):'<p>Nessun assist.</p>'}</div></div>`}
