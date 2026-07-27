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
function renderNextTeamCard(team,label,ovr){
 const safeTeam=team||{name:state.teamName};
 const average=Math.max(1,Math.round(Number(ovr)||0));
 return `<div class="next-team-card" style="${teamCssVars(safeTeam)}"><span class="next-team-colors"></span><div class="team-name" style="font-size:${teamNameFontSize(safeTeam?.name||state.teamName)}px" title="${esc(safeTeam?.name||state.teamName)}">${esc(safeTeam?.name||state.teamName)}</div><div class="next-team-meta"><div class="subline">${esc(label)}</div><div class="next-team-ovr">OVR <b>${average}</b></div></div></div>`;
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

function seasonHomeFormMarkup(){
 const form=typeof journeyForm==='function'?journeyForm(5):[];
 const items=form.map(item=>`<span class="season-home-form-result ${esc(item.type||'draw')}" title="${item.type==='win'?'Vittoria':item.type==='loss'?'Sconfitta':'Pareggio'}">${esc(item.label||'P')}</span>`).join('');
 return `<div class="season-home-form"><span>Forma</span><div>${items||'<em>Nessuna partita</em>'}</div></div>`;
}
function renderSeasonNearbyStandings(rank){
 const table=sortedTable(),index=Math.max(0,Number(rank)-1),start=Math.max(0,Math.min(table.length-5,index-2)),rows=table.slice(start,start+5);
 return `<section class="panel season-home-card season-home-standings fanta-card fanta-card--table"><div class="season-home-section-head"><div><span>Classifica</span><b>La zona intorno a te</b></div><button type="button" id="openFullTable" class="season-home-text-button">Completa →</button></div><div class="season-home-standing-list">${rows.map(row=>{const position=table.findIndex(item=>String(item.id)===String(row.id))+1,team=teamById(row.id);return `<div class="season-home-standing-row ${String(row.id)===String(USER_ID)?'is-user':''}" style="${teamCssVars(team)}"><span class="season-home-position">${position}</span><span class="season-home-standing-team">${teamColorDot(team)}<b>${esc(row.name)}</b></span><span class="season-home-standing-form">${row.w}-${row.d}-${row.l}</span><strong>${row.pts}</strong></div>`}).join('')}</div></section>`;
}
function renderSeasonUpcomingFixtures(){
 const rounds=(Array.isArray(state.schedule)?state.schedule:[]).slice(state.matchday,state.matchday+3);
 const rows=rounds.map((round,offset)=>{const fixture=(round||[]).find(match=>match.home===USER_ID||match.away===USER_ID);if(!fixture)return'';const home=fixture.home===USER_ID,opponent=teamById(home?fixture.away:fixture.home);return `<div class="season-home-fixture-row ${offset===0?'is-next':''}" style="${teamCssVars(opponent)}"><span><small>${offset===0?'Prossima':`Giornata ${state.matchday+offset+1}`}</small><b>${teamColorDot(opponent)}${esc(opponent?.name||'Avversario')}</b></span><strong>${home?'Casa':'Trasferta'}</strong></div>`}).filter(Boolean).join('');
 return `<section class="panel season-home-card season-home-upcoming fanta-card fanta-card--info"><div class="season-home-section-head"><div><span>Calendario</span><b>Prossimi impegni</b></div><button type="button" id="openCalendarTab" class="season-home-text-button">Tutto →</button></div><div class="season-home-fixture-list">${rows||'<p class="season-home-empty">Nessun altro incontro programmato.</p>'}</div></section>`;
}
function renderSeasonHomeAttention(){
 const blocks=[
  renderParallelCupPanel(),
  typeof renderSeasonInventory==='function'?renderSeasonInventory():'',
  renderActiveQuest(),
  renderError404StoryPanel(),
  renderFantaballopoliPanel(),
  renderMeritStoryPanel(),
  renderEvent()
 ].filter(Boolean).join('');
 return `<section class="panel season-home-card season-home-attention fanta-card fanta-card--story"><div class="season-home-section-head"><div><span>Questa settimana</span><b>${blocks?'Eventi, quest e decisioni':'Settimana tranquilla'}</b></div><i aria-hidden="true">✦</i></div><div class="season-home-attention-content">${blocks||'<div class="season-home-quiet"><span>✓</span><div><b>Nessuna decisione urgente</b><p>La squadra può prepararsi normalmente alla prossima partita.</p></div></div>'}</div></section>`;
}
function renderSeasonHomeStatus(opp){
 const unavailable=unavailableList(),injured=unavailable.filter(entry=>{const status=statusOf(entry.playerId);return Number(status.injury)>0||status.seasonOut}).length,suspended=unavailable.filter(entry=>Number(statusOf(entry.playerId).suspension)>0).length;
 const lineup=resolveLineup(),ovr=resolvedLineupAverage(lineup),chem=typeof draftChemistry==='function'?draftChemistry().score:0,totalRoster=Array.isArray(state.draft?.roster)?state.draft.roster.length:14,available=Math.max(0,totalRoster-unavailable.length);
 return `<section class="panel season-home-card season-home-status fanta-card fanta-card--info"><div class="season-home-section-head"><div><span>Squadra</span><b>Stato per la partita</b></div><span class="season-home-ready ${unavailable.length?'has-alert':''}">${unavailable.length?'Da controllare':'Pronta'}</span></div><div class="season-home-status-metrics"><div><span>OVR partita</span><b>${ovr?ovr.toFixed(1):'—'}</b></div><div><span>Intesa</span><b>${chem}/100</b></div><div><span>Modulo</span><b>${esc(state.formation)}</b></div><div><span>Disponibili</span><b>${available}/${totalRoster}</b></div></div><div class="season-home-availability-summary"><span class="injured">🩹 ${injured} infortunati</span><span class="suspended">🟥 ${suspended} squalificati</span></div>${unavailable.length?`<details class="season-home-details"><summary>Gestisci gli indisponibili</summary>${renderAvailability()}</details>`:'<div class="season-home-ok">✓ Rosa completa e disponibile</div>'}<button type="button" id="openRosterTab" class="season-home-manage-button">Gestisci formazione</button><details class="season-home-details season-home-opponent"><summary>Dettagli avversario · ${esc(opp?.name||'Avversario')}</summary><div class="season-home-opponent-rule">${seasonRuleSummary()}</div>${renderOpponentRoster(opp)}</details></section>`;
}
function renderSeasonHomeChaos(){
 if(!chaosEnabled())return'';
 return `<section class="panel season-home-card season-home-chaos fanta-card fanta-card--info"><details><summary><span>🌀 Caos attivo</span><b>Vedi cosa è successo alle avversarie</b></summary>${renderChaosLeagueFeed()}</details></section>`;
}
function activateSeasonTab(tab){
 const button=document.querySelector(`[data-tab="${tab}"]`),view=document.getElementById(`tab-${tab}`);if(!button||!view)return;
 document.querySelectorAll('.tab').forEach(item=>item.classList.remove('active'));document.querySelectorAll('.tab-view').forEach(item=>item.classList.remove('active'));button.classList.add('active');view.classList.add('active');document.querySelector('.season-tabs-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function showSeason(){
 if(state.matchday>=19&&parallelCupState().status==='pending')initializeParallelCup();
 const pendingCupMatch=parallelCupPendingMatch();
 if(pendingCupMatch){showParallelCupMatch(pendingCupMatch);return}
 prepareEvent();
 const fx=userFixture(),opp=teamById(fx.home===USER_ID?fx.away:fx.home),userTeam=teamById(USER_ID)||{id:USER_ID,name:state.teamName,clubId:state.userClubId,colors:activeUserClub().colorClub},homeTeam=teamById(fx.home),awayTeam=teamById(fx.away),standing=userStanding(),rank=sortedTable().findIndex(x=>x.id===USER_ID)+1,eventPending=Boolean(state.pendingEvent&&!state.pendingEvent.resolved),questSelectionPending=typeof leaderQuestSelectionPending==='function'&&leaderQuestSelectionPending(),matchBlocked=eventPending||questSelectionPending,matchDisabled=matchBlocked?'disabled aria-disabled="true" aria-describedby="matchActionStatus" data-disabled-reason="Completa prima la scelta in attesa."':'',matchStatus=eventPending?'Completa la decisione dell’evento prima di giocare.':questSelectionPending?'Scegli il leader della quest prima di giocare.':'Scegli la cronaca completa oppure la simulazione rapida.';
 const venue=fx.home===USER_ID?'Casa':'Trasferta';
 screen.innerHTML=`<div class="season-home" style="${teamCssVars(userTeam)}"><section class="season-home-topline"><div><span>Giornata</span><b>${state.matchday+1}<small>/38</small></b></div><div><span>Posizione</span><b>${rank}°</b></div><div><span>Punti</span><b>${standing.pts}</b></div>${seasonHomeFormMarkup()}</section><section class="panel season-home-match fanta-card fanta-card--match"><div class="season-home-match-head"><div><span>Prossima partita</span><b>Campionato · Giornata ${state.matchday+1}</b></div><strong>${venue}</strong></div><div class="next-match season-home-next-match">${renderNextTeamCard(homeTeam,'Casa',previewTeamAverageOvr(homeTeam))}<div class="versus">VS</div>${renderNextTeamCard(awayTeam,'Trasferta',previewTeamAverageOvr(awayTeam))}</div>${matchBlocked?`<button type="button" class="season-home-blocked" id="goToPendingDecision">⚠ ${esc(matchStatus)} <span>Vai alla scelta ↓</span></button>`:''}<div class="match-play-actions season-home-match-actions"><button id="playRoundLive" class="btn match-live-button" type="button" data-single-action data-busy-announcement="Partita avviata con cronaca." ${matchDisabled}>🎙️ Gioca con cronaca</button><button id="playRoundInstant" class="btn match-instant-button" type="button" data-single-action data-busy-announcement="Simulazione della giornata avviata." ${matchDisabled}>⚡ Simula subito</button></div><div id="matchActionStatus" class="match-play-note a11y-command-message ${matchBlocked?'is-blocked':''}" role="status" aria-live="polite">${matchStatus}</div></section><div class="season-home-primary-grid">${renderSeasonHomeAttention()}${renderSeasonHomeStatus(opp)}</div><div class="season-home-secondary-grid">${renderSeasonNearbyStandings(rank)}<div class="season-home-secondary-stack">${renderSeasonUpcomingFixtures()}${renderSeasonHomeChaos()}</div></div><section class="panel season-tabs-panel season-home-tabs"><div class="tabs"><button class="tab active" data-tab="table">Classifica</button><button class="tab" data-tab="calendar">Calendario</button><button class="tab" data-tab="roster">Rosa</button><button class="tab" data-tab="stats">Statistiche</button><button class="tab" data-tab="journey">Percorso</button></div><div id="tab-table" class="tab-view active">${renderTable()}</div><div id="tab-calendar" class="tab-view">${renderCalendar()}</div><div id="tab-roster" class="tab-view">${renderSeasonRosterField()}</div><div id="tab-stats" class="tab-view">${renderStats()}</div><div id="tab-journey" class="tab-view">${renderSeasonJourney()}</div></section></div>`;
 document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>resolveDecision(Number(b.dataset.choice)));
 bindSeasonEventControls();
 bindMeritStoryControls();
 bindError404StoryControls();
 bindFantaballopoliControls();
 if(typeof bindSeasonInventoryControls==='function')bindSeasonInventoryControls();
 if(typeof bindLeaderQuestControls==='function')bindLeaderQuestControls();
 document.querySelectorAll('[data-injured]').forEach(b=>b.onclick=()=>{const id=b.dataset.injured;state.playInjured[id]=!state.playInjured[id];save();render()});
 document.getElementById('playRoundLive').onclick=()=>playRound('live');
 document.getElementById('playRoundInstant').onclick=()=>playRound('instant');
 const pendingButton=document.getElementById('goToPendingDecision');if(pendingButton)pendingButton.onclick=()=>document.querySelector('.season-home-attention')?.scrollIntoView({behavior:'smooth',block:'center'});
 const rosterButton=document.getElementById('openRosterTab');if(rosterButton)rosterButton.onclick=()=>activateSeasonTab('roster');
 const tableButton=document.getElementById('openFullTable');if(tableButton)tableButton.onclick=()=>activateSeasonTab('table');
 const calendarButton=document.getElementById('openCalendarTab');if(calendarButton)calendarButton.onclick=()=>activateSeasonTab('calendar');
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>activateSeasonTab(b.dataset.tab));
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
