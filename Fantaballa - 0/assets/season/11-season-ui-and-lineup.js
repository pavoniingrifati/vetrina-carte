/* Fantaballa Season Engine — 11-season-ui-and-lineup.js
 * Schermata della stagione, disponibilità, avversari, formazione ed effetti sulla rosa.
 * Modulo classico: l'ordine di caricamento è definito negli HTML del Campionato.
 */
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
