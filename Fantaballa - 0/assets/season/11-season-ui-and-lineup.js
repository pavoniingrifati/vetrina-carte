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

function seasonTopTeamInitials(name){
 const words=String(name||'Squadra').trim().split(/\s+/).filter(Boolean);
 return (words.length>1?`${words[0][0]||''}${words[1][0]||''}`:(words[0]||'SQ').slice(0,2)).toUpperCase();
}
function seasonTopRecentForm(limit=5){
 const history=Array.isArray(state.history)?state.history:[];
 const recent=history.slice(-Math.max(1,Number(limit)||5)).map(match=>{
  const gf=Number(match?.gf)||0,ga=Number(match?.ga)||0;
  if(gf>ga)return{type:'win',label:'V',title:'Vittoria'};
  if(gf<ga)return{type:'loss',label:'P',title:'Sconfitta'};
  return{type:'draw',label:'N',title:'Pareggio'};
 });
 while(recent.length<limit)recent.unshift({type:'empty',label:'–',title:'Nessuna partita'});
 return recent;
}
function renderSeasonTopSummary({rank,standing,lineupOvr,chemistry}){
 const rounds=Math.max(1,Array.isArray(state.schedule)?state.schedule.length:38),form=seasonTopRecentForm(5);
 return `<section class="season-top-summary" aria-label="Riepilogo stagione"><div class="season-top-stat"><span>Giornata</span><b>${Math.min(rounds,state.matchday+1)}<small>/${rounds}</small></b></div><div class="season-top-stat"><span>Posizione</span><b>${rank}°</b></div><div class="season-top-stat"><span>Punti</span><b>${Number(standing?.pts)||0}</b></div><div class="season-top-stat season-top-form"><span>Ultime cinque</span><div>${form.map(result=>`<b class="season-top-form-result ${result.type}" title="${esc(result.title)}">${result.label}</b>`).join('')}</div></div><div class="season-top-stat"><span>OVR medio</span><b>${Number(lineupOvr||0).toFixed(1)}</b></div><div class="season-top-stat"><span>Intesa</span><b>${Number(chemistry?.score)||0}<small>/100</small></b></div></section>`;
}
function seasonTopDifficulty(userOvr,opponentOvr){
 const delta=(Number(opponentOvr)||0)-(Number(userOvr)||0);
 if(delta>=8)return{label:'Molto difficile',className:'extreme',delta};
 if(delta>=4)return{label:'Difficile',className:'hard',delta};
 if(delta>=-3)return{label:'Equilibrata',className:'balanced',delta};
 return{label:'Favorevole',className:'favourable',delta};
}
function renderSeasonTopTeam(team,{role,venue,ovr,side}){
 const safeTeam=team||{name:'Squadra'},name=safeTeam.name||'Squadra';
 const badge=typeof teamColorDot==='function'?teamColorDot(safeTeam):esc(seasonTopTeamInitials(name));
 return `<div class="season-top-team ${esc(side||'')}" style="${teamCssVars(safeTeam)}"><span class="season-top-team-colors" aria-hidden="true"></span><div class="season-top-team-badge season-top-team-badge--flag" aria-hidden="true">${badge}</div><div class="season-top-team-copy"><strong title="${esc(name)}">${esc(name)}</strong></div><div class="season-top-team-ovr" aria-label="Overall ${Math.max(1,Math.round(Number(ovr)||0))}"><span>OVR</span><b>${Math.max(1,Math.round(Number(ovr)||0))}</b></div></div>`;
}

function ensureSeasonHomeStyles(){
 if(document.getElementById('seasonHomeDashboardStyles'))return;
 const style=document.createElement('style');
 style.id='seasonHomeDashboardStyles';
 style.textContent=`
 .season-home-dashboard{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
 .season-home-card{position:relative;min-width:0;min-height:260px;padding:18px 18px 16px;border:1px solid rgba(16,36,58,.15);border-radius:26px;background:linear-gradient(180deg,#fffefb 0%,#f7f0e2 100%);box-shadow:0 14px 30px rgba(16,36,58,.08),inset 0 1px 0 rgba(255,255,255,.85);overflow:hidden}
 .season-home-card::before{content:"";position:absolute;left:16px;right:16px;top:0;height:4px;border-radius:0 0 999px 999px;background:linear-gradient(90deg,#e5cb58,#f7e9ae 52%,#d1b045)}
 .season-home-card::after{content:"";position:absolute;top:-52px;right:-34px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,rgba(255,233,108,.22) 0%,rgba(255,233,108,.07) 44%,transparent 72%);pointer-events:none}
 .season-home-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid rgba(16,36,58,.10)}
 .season-home-card-title{min-width:0}
 .season-home-card-kicker{display:block;margin-bottom:6px;color:#8f5b22;font-size:10px;font-weight:1000;letter-spacing:.16em;text-transform:uppercase}
 .season-home-card h3{margin:0;text-align:left;font-size:clamp(20px,2vw,28px);line-height:1.02;text-transform:uppercase;color:#0f2339;letter-spacing:.02em}
 .season-home-card-icon{display:inline-flex;align-items:center;justify-content:center;min-width:54px;height:38px;padding:0 14px;border-radius:999px;background:#10243a;color:#fff;font-size:11px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;box-shadow:0 8px 18px rgba(16,36,58,.18)}
 .season-home-card p{margin:0;color:#564f45;font-weight:800;line-height:1.45}
 .season-home-card .muted{color:#726959;font-size:12px}
 .season-home-list{display:grid;gap:10px}.season-home-standings-summary{margin-top:12px;padding:12px 14px;border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.82),rgba(244,237,223,.92));border:1px solid rgba(16,36,58,.08);box-shadow:0 6px 14px rgba(16,36,58,.05),inset 0 1px 0 rgba(255,255,255,.75)}.season-home-standings-summary b{display:block;color:#10243a;font-size:14px}.season-home-standings-summary span{display:block;margin-top:4px;color:#5f574c;font-size:12px;font-weight:850;line-height:1.35}
 .season-home-row,.season-home-fixture-item,.season-home-status,.season-home-stat-leader,.season-home-rule{position:relative;background:linear-gradient(180deg,rgba(255,255,255,.86),rgba(244,237,223,.92));border:1px solid rgba(16,36,58,.08);box-shadow:0 6px 14px rgba(16,36,58,.05),inset 0 1px 0 rgba(255,255,255,.75)}
 .season-home-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;padding:11px 13px;border-radius:18px}
 .season-home-row.is-user{background:linear-gradient(90deg,rgba(255,232,108,.58),rgba(255,255,255,.96));border-color:rgba(212,178,47,.50)}
 .season-home-rank,.season-home-value{font-weight:1000;color:#10243a;white-space:nowrap}
 .season-home-team{display:flex;align-items:center;gap:8px;min-width:0;font-weight:950;color:#10243a}
 .season-home-team > span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .season-home-fixture{display:grid;gap:10px}
 .season-home-fixture-item{padding:14px 14px 15px;border-radius:20px}
 .season-home-fixture-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
 .season-home-badge{display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border-radius:999px;background:#10243a;color:#fff;font-size:10px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 6px 14px rgba(16,36,58,.14)}
 .season-home-badge.gold{background:#e4c84e;color:#10243a}
 .season-home-vs{display:grid;grid-template-columns:minmax(0,1fr) auto auto;column-gap:14px;row-gap:10px;align-items:center}
 .season-home-match-teams{display:grid;gap:10px;min-width:0}
 .season-home-team-row{display:flex;align-items:center;gap:8px;min-width:0;font-weight:950;color:#10243a;line-height:1.1;padding:2px 0}
 .season-home-team-name{flex:1;min-width:0;white-space:nowrap}
 .season-home-vs-mark{display:flex;align-items:center;justify-content:center;align-self:stretch;min-width:28px;color:#8c8475;font-weight:1000;font-size:14px;letter-spacing:.08em;text-transform:uppercase}
 .season-home-side-badge{display:inline-flex;align-items:center;justify-content:center;align-self:center;justify-self:end;min-width:86px;padding:9px 13px;border-radius:999px;background:#10243a;color:#fff;font-size:11px;font-weight:1000;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;box-shadow:0 6px 14px rgba(16,36,58,.14)}
 .season-home-status-list{display:grid;gap:10px}
 .season-home-status{padding:12px 13px;border-radius:18px}
 .season-home-status b{display:block;color:#10243a;font-size:14px}
 .season-home-status span{display:block;margin-top:4px;color:#5f574c;font-size:12px;font-weight:850;line-height:1.35}
 .season-home-empty{display:grid;place-items:center;min-height:160px;padding:16px;border:2px dashed rgba(16,36,58,.14);border-radius:18px;text-align:center;color:#6b6357;font-weight:900;background:linear-gradient(180deg,rgba(255,255,255,.72),rgba(247,240,226,.76))}
 .season-home-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
 .season-home-stat-leader{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;padding:12px 13px;border-radius:18px}
 .season-home-stat-copy{min-width:0}
 .season-home-stat-copy small{display:block;margin-bottom:4px;color:#8f5b22;font-size:10px;font-weight:1000;letter-spacing:.1em;text-transform:uppercase}
 .season-home-stat-copy b{display:block;color:#10243a;font-size:15px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .season-home-stat-copy span{display:block;margin-top:4px;color:#5f574c;font-size:12px;font-weight:850;line-height:1.35}
 .season-home-stat-score{display:inline-flex;align-items:center;justify-content:center;min-width:60px;padding:8px 10px;border-radius:999px;background:#10243a;color:#fff;font-size:12px;font-weight:1000;white-space:nowrap;box-shadow:0 6px 14px rgba(16,36,58,.14)}
 .season-home-stat-empty{grid-column:1/-1;display:grid;place-items:center;min-height:180px;padding:16px;border:2px dashed rgba(16,36,58,.14);border-radius:18px;text-align:center;color:#6b6357;font-weight:900;background:linear-gradient(180deg,rgba(255,255,255,.72),rgba(247,240,226,.76))}
 .season-home-rules{display:grid;gap:10px}
 .season-home-rule{padding:12px 13px;border-radius:18px;font-size:13px;font-weight:900;color:#10243a;line-height:1.38}
 .season-home-rule strong{color:#8f5b22}
 .season-home-card--span-2{grid-column:span 2}
 .season-home-card--standings::before{background:linear-gradient(90deg,#d9ba44,#f4e39a 52%,#b88a27)}
 .season-home-card--upcoming::before{background:linear-gradient(90deg,#214a78,#5b86b5 52%,#1a3554)}
 .season-home-card--availability::before{background:linear-gradient(90deg,#7f5cc2,#b08cf0 52%,#6943a7)}
 .season-home-card--stats::before{background:linear-gradient(90deg,#0f2339,#32577f 52%,#17375a)}
 .season-home-card--rules::before{background:linear-gradient(90deg,#8f5b22,#d39b42 52%,#7b4418)}

 /* HOME — micro-interazioni eleganti */
 .season-home-card,
 .season-home-card h3,
 .season-home-row,
 .season-home-fixture-item,
 .season-home-status,
 .season-home-stat-leader,
 .season-home-rule,
 .season-home-stat-leader .mini-avatar,
 .season-home-rank,
 .season-home-value,
 .season-home-badge,
 .season-home-stat-score{
   transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease,background .22s ease,color .22s ease,filter .22s ease,letter-spacing .22s ease;
 }
 .season-home-card{position:relative;isolation:isolate;overflow:hidden;transform:translateZ(0);display:flex;flex-direction:column}
 .season-home-card::after{
   content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:0;
   background:radial-gradient(circle at 18% 0%,rgba(255,233,108,.16),transparent 44%),linear-gradient(135deg,rgba(255,255,255,.18),transparent 58%);
   transition:opacity .22s ease;
 }
 @media(hover:hover) and (pointer:fine){
   .season-home-card:hover{
     transform:translateY(-6px) scale(1.01);
     border-color:#d7b932;
     box-shadow:0 20px 38px rgba(16,36,58,.18),0 0 0 3px rgba(242,211,86,.14);
     background:linear-gradient(180deg,#fffefa,#fbf4e3);
   }
   .season-home-card:hover::after{opacity:1}
   .season-home-card:hover>h3{
     transform:scale(1.035);
     color:#16395d;
     letter-spacing:.025em;
   }
   .season-home-row:hover,
   .season-home-fixture-item:hover,
   .season-home-status:hover,
   .season-home-stat-leader:hover,
   .season-home-rule:hover{
     transform:translateX(4px) scale(1.006);
     border-color:rgba(205,168,48,.48);
     background:linear-gradient(90deg,rgba(255,235,139,.35),rgba(255,255,255,.92));
     box-shadow:0 8px 18px rgba(16,36,58,.10);
   }
   .season-home-row:hover .season-home-rank,
   .season-home-row:hover .season-home-value,
   .season-home-fixture-item:hover .season-home-badge,
   .season-home-stat-leader:hover .season-home-stat-score{
     transform:scale(1.10);
     filter:brightness(1.08);
   }
   .season-home-stat-leader:hover .mini-avatar{
     transform:scale(1.14) rotate(-2deg);
     filter:brightness(1.06) saturate(1.08);
     box-shadow:0 7px 16px rgba(16,36,58,.20),0 0 0 3px rgba(242,211,86,.32);
   }
   .season-home-stat-leader:hover .season-home-stat-copy b{color:#173f66}
   .season-home-rule:hover strong{color:#6e3f16}
 }
 @keyframes seasonHomeCardIn{
   from{opacity:0;transform:translateY(8px)}
   to{opacity:1;transform:translateY(0)}
 }
 .season-home-dashboard>.season-home-card{animation:seasonHomeCardIn .34s ease both}
 .season-home-dashboard>.season-home-card:nth-child(2){animation-delay:.035s}
 .season-home-dashboard>.season-home-card:nth-child(3){animation-delay:.07s}
 .season-home-dashboard>.season-home-card:nth-child(4){animation-delay:.105s}
 .season-home-dashboard>.season-home-card:nth-child(5){animation-delay:.14s}
 @media(prefers-reduced-motion:reduce){
   .season-home-card,
   .season-home-card h3,
   .season-home-row,
   .season-home-fixture-item,
   .season-home-status,
   .season-home-stat-leader,
   .season-home-rule,
   .season-home-stat-leader .mini-avatar,
   .season-home-rank,
   .season-home-value,
   .season-home-badge,
   .season-home-stat-score{
     transition:none!important;animation:none!important;transform:none!important;
   }
 }


 /* MICRO-INTERAZIONI COERENTI — TUTTE LE SEZIONI */
 .season-tabs-panel .tab,
 .season-table-scroll tbody td,
 .season-table-scroll .standing-team,
 .season-tabs-panel .calendar-row,
 .season-tabs-panel .calendar-team,
 .season-roster-field-slot .season-jersey-wrap,
 .season-roster-field-slot .season-slot-name,
 .season-roster-field-slot .season-slot-role,
 .season-roster-field-slot .season-slot-chem,
 .season-roster-bench-card,
 .season-roster-bench-card .mini-avatar,
 .season-board-pill,
 .season-stats-kpi,
 .final-player-stat-card,
 .final-player-stat-row,
 .final-player-stat-row .mini-avatar,
 .final-player-rank,
 .final-player-stat-row>strong,
 .journey-overview>div,
 .journey-form i,
 .journey-last,
 .journey-last>strong,
 .journey-details,
 .journey-details>summary,
 .journey-row,
 .journey-event-row,
 .journey-day,
 .journey-outcome,
 .journey-event-kind,
 .resolved-player-card,
 .resolved-player-card .mini-avatar,
 .resolved-player-card .chip.ovr,
 .opponent-roster-row,
 .opponent-roster-row .chip.ovr{
   transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease,background .2s ease,color .2s ease,filter .2s ease,opacity .2s ease;
 }
 .season-tabs-panel .tab{position:relative;isolation:isolate;overflow:hidden}
 .season-tabs-panel .tab::after{
   content:"";position:absolute;inset:auto 18% 2px;height:2px;border-radius:999px;
   background:#f2d356;opacity:0;transform:scaleX(.3);transition:opacity .2s ease,transform .2s ease;
 }
 .final-player-stat-row>strong,
 .journey-last>strong,
 .resolved-player-card .chip.ovr,
 .opponent-roster-row .chip.ovr{display:inline-flex;align-items:center;justify-content:center}
 .season-roster-bench-card,
 .season-stats-kpi,
 .final-player-stat-card,
 .journey-overview>div,
 .journey-last,
 .journey-details{transform:translateZ(0)}

 @media(hover:hover) and (pointer:fine){
   /* Navigazione delle sezioni */
   .season-tabs-panel .tab:hover{
     transform:translateY(-2px) scale(1.025);
     background:#233d5b;
     color:#fff;
     box-shadow:0 8px 16px rgba(16,36,58,.16);
   }
   .season-tabs-panel .tab:hover::after,
   .season-tabs-panel .tab.active::after{opacity:1;transform:scaleX(1)}
   .season-tabs-panel .tab.active:hover{background:#10243a}

   /* Classifica: hover leggibile, chiaro e ad alto contrasto */
   .season-table-scroll tbody tr:hover td{
     background:linear-gradient(180deg,#fff9df,#fff0ad)!important;
     color:#10243a!important;
     filter:none!important;
     text-shadow:none!important;
   }
   .season-table-scroll tbody tr:hover td:first-child{
     background:linear-gradient(180deg,#fff8d2,#ffe78b)!important;
     color:#10243a!important;
     box-shadow:inset 5px 0 0 var(--team-accent,#d4a900),8px 0 16px rgba(16,36,58,.15)!important;
   }
   .season-table-scroll tbody tr:hover .standing-team,
   .season-table-scroll tbody tr:hover .standing-team span{
     color:#10243a!important;
   }
   .season-table-scroll tbody tr:hover .standing-team{transform:translateX(4px)}
   /* Calendario */
   .season-tabs-panel .calendar-row:hover{
     transform:translateY(-3px) scale(1.006);
     opacity:1!important;
     border-color:#d7b932!important;
     box-shadow:0 11px 24px rgba(16,36,58,.15),0 0 0 2px rgba(242,211,86,.10);
     filter:brightness(1.05);
   }
   .season-tabs-panel .calendar-row:hover .calendar-team{transform:scale(1.035)}
   .season-tabs-panel .calendar-row:hover>strong{
     transform:scale(1.12);
     color:#10243a!important;
     text-shadow:none;
   }

   /* Rosa, campo e panchina */
   .season-roster-field-slot.filled:hover .season-jersey-wrap{
     transform:translateY(-4px) scale(1.13) rotate(-1.5deg);
     filter:brightness(1.07) saturate(1.07);
   }
   .season-roster-field-slot.filled:hover .season-slot-name{
     transform:translateY(-2px) scale(1.045);
     box-shadow:0 7px 15px rgba(16,36,58,.18);
   }
   .season-roster-field-slot.filled:hover .season-slot-role,
   .season-roster-field-slot.filled:hover .season-slot-chem{transform:scale(1.06)}
   .season-roster-field-slot.filled:hover .season-slot-chem{
     color:#fff2a8!important;
     box-shadow:0 0 0 2px rgba(242,211,86,.20),0 7px 16px rgba(16,36,58,.16);
   }
   .season-roster-bench-card:hover{
     transform:translateY(-3px) scale(1.012);
     border-color:#d7b932!important;
     box-shadow:0 12px 25px rgba(16,36,58,.15),0 0 0 2px rgba(242,211,86,.11);
   }
   .season-roster-bench-card:hover .mini-avatar{
     transform:scale(1.13) rotate(-2deg);
     filter:brightness(1.07) saturate(1.08);
     box-shadow:0 7px 16px rgba(16,36,58,.20),0 0 0 3px rgba(242,211,86,.28);
   }
   .season-roster-bench-card:hover .season-chip.ovr{transform:scale(1.10)}
   .season-board-pill:hover{
     transform:translateY(-2px) scale(1.025);
     filter:brightness(1.12);
     box-shadow:0 13px 25px rgba(16,36,58,.22),0 0 0 2px rgba(242,211,86,.13);
   }

   /* Statistiche */
   .season-stats-kpi:hover{
     transform:translateY(-4px) scale(1.012);
     border-color:#d7b932;
     background:linear-gradient(180deg,#fffefa,#fff4d3);
     box-shadow:0 13px 27px rgba(16,36,58,.14),0 0 0 2px rgba(242,211,86,.11);
   }
   .season-stats-kpi:hover b{color:#173f66}
   .final-player-stat-card:hover{
     transform:translateY(-4px) scale(1.008);
     border-color:#ffe96c;
     box-shadow:0 16px 32px rgba(0,0,0,.22),0 0 0 2px rgba(255,233,108,.14);
   }
   .final-player-stat-row:hover{
     transform:translateX(4px) scale(1.004);
     background:linear-gradient(90deg,#fff0a6,#fffdf7 72%);
   }
   .final-player-stat-row:hover .mini-avatar{
     transform:scale(1.14) rotate(-2deg);
     filter:brightness(1.06) saturate(1.08);
     box-shadow:0 6px 14px rgba(16,36,58,.18),0 0 0 3px rgba(242,211,86,.26);
   }
   .final-player-stat-row:hover .final-player-rank,
   .final-player-stat-row:hover>strong{transform:scale(1.12)}
   .final-player-stat-row:hover>strong{color:#173f66!important}

   /* Percorso */
   .journey-overview>div:hover{
     transform:translateY(-3px) scale(1.025);
     border-color:#d7b932;
     background:linear-gradient(180deg,#fffefa,#fff4d8);
     box-shadow:0 10px 22px rgba(16,36,58,.13);
   }
   .journey-overview>div:hover>b{color:#173f66}
   .journey-overview>div:hover .journey-form i{transform:scale(1.12)}
   .journey-last:hover{
     transform:translateY(-3px) scale(1.008);
     box-shadow:0 12px 25px rgba(16,36,58,.14);
   }
   .journey-last:hover>strong{transform:scale(1.08);filter:brightness(1.12)}
   .journey-details:hover{
     border-color:#d7b932;
     box-shadow:0 10px 22px rgba(16,36,58,.11);
   }
   .journey-details>summary:hover{background:rgba(242,211,86,.16)}
   .journey-row:hover,
   .journey-event-row:hover{
     transform:translateX(4px) scale(1.004);
     border-color:rgba(215,185,50,.72);
     box-shadow:0 8px 17px rgba(16,36,58,.10);
   }
   .journey-row:hover .journey-day,
   .journey-event-row:hover .journey-day,
   .journey-row:hover .journey-outcome,
   .journey-event-row:hover .journey-event-kind{transform:scale(1.08);filter:brightness(1.09)}

   /* Formazione effettiva e avversario */
   .resolved-player-card:hover,
   .opponent-roster-row:hover{
     transform:translateX(4px) scale(1.005);
     border-color:#d7b932!important;
     box-shadow:0 9px 20px rgba(16,36,58,.12);
     filter:brightness(1.05);
   }
   .resolved-player-card:hover .mini-avatar{
     transform:scale(1.12) rotate(-2deg);
     box-shadow:0 6px 15px rgba(16,36,58,.20),0 0 0 3px rgba(242,211,86,.25);
   }
   .resolved-player-card:hover .chip.ovr,
   .opponent-roster-row:hover .chip.ovr{transform:scale(1.10);filter:brightness(1.10)}
 }

 .season-tabs-panel .tab:focus-visible,
 .journey-details>summary:focus-visible{
   outline:3px solid #7b4cb8;
   outline-offset:3px;
 }
 .tab-view.active>.season-table-scroll,
 .tab-view.active>.calendar,
 .tab-view.active>.season-roster-board,
 .tab-view.active>.season-stats-shell,
 .tab-view.active>.season-journey{animation:seasonSectionEnter .28s ease both}
 @keyframes seasonSectionEnter{
   from{opacity:0;transform:translateY(7px)}
   to{opacity:1;transform:translateY(0)}
 }

 @media(prefers-reduced-motion:reduce){
   .season-tabs-panel .tab,
   .season-table-scroll tbody td,
   .season-table-scroll .standing-team,
   .season-tabs-panel .calendar-row,
   .season-tabs-panel .calendar-team,
   .season-roster-field-slot .season-jersey-wrap,
   .season-roster-field-slot .season-slot-name,
   .season-roster-field-slot .season-slot-role,
   .season-roster-field-slot .season-slot-chem,
   .season-roster-bench-card,
   .season-roster-bench-card .mini-avatar,
   .season-board-pill,
   .season-stats-kpi,
   .final-player-stat-card,
   .final-player-stat-row,
   .final-player-stat-row .mini-avatar,
   .final-player-rank,
   .final-player-stat-row>strong,
   .journey-overview>div,
   .journey-form i,
   .journey-last,
   .journey-last>strong,
   .journey-details,
   .journey-details>summary,
   .journey-row,
   .journey-event-row,
   .journey-day,
   .journey-outcome,
   .journey-event-kind,
   .resolved-player-card,
   .resolved-player-card .mini-avatar,
   .resolved-player-card .chip.ovr,
   .opponent-roster-row,
   .opponent-roster-row .chip.ovr,
   .tab-view.active>.season-table-scroll,
   .tab-view.active>.calendar,
   .tab-view.active>.season-roster-board,
   .tab-view.active>.season-stats-shell,
   .tab-view.active>.season-journey{
     transition:none!important;animation:none!important;transform:none!important;
   }
 }

 @media(max-width:1100px){.season-home-dashboard{grid-template-columns:repeat(2,minmax(0,1fr))}.season-home-card--span-2{grid-column:span 2}}
 @media(max-width:700px){.season-home-dashboard{grid-template-columns:1fr}.season-home-card,.season-home-card--span-2{grid-column:auto;min-height:auto;padding:14px;border-radius:20px}.season-home-card::before{left:12px;right:12px}.season-home-card-head{gap:10px;margin-bottom:12px;padding-bottom:10px}.season-home-card h3{font-size:20px}.season-home-card-icon{min-width:50px;height:34px;padding:0 10px;font-size:10px}.season-home-row{grid-template-columns:auto minmax(0,1fr) auto;padding:9px 10px}.season-home-vs{grid-template-columns:1fr}.season-home-side-badge{justify-self:start;min-width:auto}.season-home-stats{grid-template-columns:1fr}}
 `;
 document.head.appendChild(style);
}
function seasonHomeCurrentTeamPlayerIds(){
 const ids=new Set();
 if(typeof currentUserPlayerIds==='function')currentUserPlayerIds().forEach(id=>ids.add(String(id)));
 (rosterPlayers()||[]).forEach(entry=>{if(entry&&entry.playerId!=null)ids.add(String(entry.playerId)); if(entry?.player?.id!=null)ids.add(String(entry.player.id));});
 Object.entries(state.stats?.playerTeams||{}).forEach(([id,teamId])=>{if(String(teamId)===String(USER_ID))ids.add(String(id))});
 return [...ids];
}
function seasonHomeTopTeamStat(statKey){
 const ids=seasonHomeCurrentTeamPlayerIds();
 let best=null;
 ids.forEach(id=>{
  const value=Number(state.stats?.[statKey]?.[id])||0;
  if(value<=0)return;
  const player=statPlayerInfo(id);
  if(!player)return;
  const row={id,player,value};
  if(!best||row.value>best.value||(row.value===best.value&&String(row.player?.name||'')<String(best.player?.name||'')))best=row;
 });
 return best;
}
function renderSeasonHomeStandings(){
 const rows=sortedTable(), userIndex=rows.findIndex(row=>String(row.id)===String(USER_ID));
 if(!rows.length||userIndex<0)return `<div class="season-home-empty">Classifica non disponibile.</div>`;
 const windowSize=Math.min(rows.length,7);
 let start=Math.max(0,userIndex-3);
 let end=Math.min(rows.length,start+windowSize);
 start=Math.max(0,end-windowSize);
 const compact=rows.slice(start,end).map((row,index)=>{
  const absoluteIndex=start+index, team=teamById(row.id);
  return `<div class="season-home-row ${String(row.id)===String(USER_ID)?'is-user':''}"><span class="season-home-rank">${absoluteIndex+1}°</span><span class="season-home-team">${teamColorDot(team)}<span>${esc(row.name)}</span></span><span class="season-home-value">${Number(row.pts)||0} pt</span></div>`;
 }).join('');
 return `<p class="muted" style="margin-bottom:10px">Vedi solo le squadre vicine alla tua posizione attuale.</p><div class="season-home-list">${compact}</div>`;
}
function renderSeasonHomeUpcoming(limit=3){
 const fixtures=[];
 const schedule=Array.isArray(state.schedule)?state.schedule:[];
 const compactNameSize=name=>{
  const fallback=14;
  const base=typeof teamNameFontSize==='function'?Number(teamNameFontSize(name)||fallback):fallback;
  return Math.max(12,Math.min(15,base-1));
 };
 for(let roundIndex=Number(state.matchday)||0; roundIndex<schedule.length&&fixtures.length<Math.max(1,Number(limit)||3); roundIndex++){
  const round=schedule[roundIndex]||[];
  const fixture=round.find(match=>String(match.home)===String(USER_ID)||String(match.away)===String(USER_ID));
  if(fixture)fixtures.push({round:roundIndex+1,fixture});
 }
 if(!fixtures.length)return `<div class="season-home-empty">Nessuna prossima partita disponibile.</div>`;
 return `<div class="season-home-fixture">${fixtures.map(item=>{
  const home=teamById(item.fixture.home), away=teamById(item.fixture.away), isHome=String(item.fixture.home)===String(USER_ID);
  const homeName=esc(home?.name||state.teamName), awayName=esc(away?.name||state.teamName);
  const venueLabel=isHome?'In casa':'In trasferta';
  const sideBadge=isHome?'Casa':'Trasf.';
  return `<div class="season-home-fixture-item"><div class="season-home-fixture-top"><span class="season-home-badge gold">Giornata ${item.round}</span><span class="muted">${venueLabel}</span></div><div class="season-home-vs"><div class="season-home-match-teams"><div class="season-home-team-row" style="font-size:${compactNameSize(home?.name||state.teamName)}px">${teamColorDot(home)}<span class="season-home-team-name" title="${homeName}">${homeName}</span></div><div class="season-home-team-row" style="font-size:${compactNameSize(away?.name||state.teamName)}px">${teamColorDot(away)}<span class="season-home-team-name" title="${awayName}">${awayName}</span></div></div><div class="season-home-vs-mark">VS</div><span class="season-home-side-badge">${sideBadge}</span></div></div>`;
 }).join('')}</div>`;
}
function renderSeasonHomeAvailabilitySummary(){
 const list=unavailableList();
 if(!list.length)return `<div class="season-home-empty">Nessun indisponibile: rosa al completo.</div>`;
 const rows=list.slice(0,4).map(item=>{
  const status=statusOf(item.playerId);
  const reason=status.suspension>0?`Squalifica: ${status.suspension} giornate`:status.seasonOut?`Fuori stagione${status.seasonOutReason?` · ${esc(status.seasonOutReason)}`:''}`:`Infortunio: ${status.injury} giornate`;
  return `<div class="season-home-status"><b>${esc(item.player?.name||'Giocatore')}</b><span>${reason}</span></div>`;
 }).join('');
 const extra=list.length>4?`<p class="muted" style="margin-top:10px;text-align:center">+ altri ${list.length-4} indisponibili nella sezione completa.</p>`:'';
 return `<div class="season-home-status-list">${rows}</div>${extra}`;
}
function renderSeasonHomeStatsSummary(){
 const hasRealMvpVotes=Object.values(state.stats?.mvpVotes||{}).some(value=>Number(value)>0);
 const categories=[
  {label:'Capocannoniere',bucket:'goals',unit:'gol',emptyTitle:'Nessun gol registrato',emptyNote:'La stagione è appena iniziata.'},
  {label:'Assist-man',bucket:'assists',unit:'assist',emptyTitle:'Nessun assist registrato',emptyNote:'Aspettiamo la prossima giornata.'},
  {label:'Più presenti',bucket:'appearances',unit:'pres.',emptyTitle:'Nessuna presenza registrata',emptyNote:'Le presenze compariranno dopo le prime partite.'},
  {label:'MVP squadra',bucket:hasRealMvpVotes?'mvpVotes':'mvpPoints',unit:hasRealMvpVotes?'MVP':'pt',tieBucket:hasRealMvpVotes?'mvpPoints':'',emptyTitle:'Nessun MVP disponibile',emptyNote:'I premi individuali si popolano giornata dopo giornata.'}
 ];
 const cards=categories.map(category=>{
  const entry=seasonStatsEntries(category.bucket,{limit:1,teamId:USER_ID,tieBucket:category.tieBucket||''})[0]||null;
  if(!entry)return `<div class="season-home-stat-leader"><div class="season-home-stat-copy"><small>${esc(category.label)}</small><b>${esc(category.emptyTitle)}</b><span>${esc(category.emptyNote)}</span></div><span class="season-home-stat-score">—</span></div>`;
  const player=statPlayerInfo(entry[0]);
  const value=Number(entry[1])||0;
  const note=category.bucket==='appearances'
   ? `${Math.round(value)} ${Math.round(value)===1?'presenza':'presenze'}`
   : category.bucket==='mvpVotes'
     ? `${Math.round(value)} MVP · ${Number(state.stats?.mvpPoints?.[entry[0]]||0).toFixed(1)} pt`
     : category.bucket==='mvpPoints'
       ? `${value.toFixed(1)} punti MVP calcolati`
       : `${Math.round(value)} ${esc(category.unit)}`;
  const scoreLabel=category.bucket==='mvpPoints'?value.toFixed(1):`${Math.round(value)}`;
  return `<div class="season-home-stat-leader">${renderMiniAvatar(player,'small')}<div class="season-home-stat-copy"><small>${esc(category.label)}</small><b>${esc(player?.name||'Giocatore')}</b><span>${note}</span></div><span class="season-home-stat-score">${esc(scoreLabel)} ${esc(category.unit)}</span></div>`;
 });
 return `<p class="muted" style="margin-bottom:10px;text-align:center">Solo i leader della tua rosa: una faccina per ogni categoria chiave.</p><div class="season-home-stats">${cards.join('')}</div>`;
}
function seasonHomeRuleHighlights(){
 const rules=[];
 if(state.pendingEvent && !state.pendingEvent.resolved)rules.push({label:'Evento in attesa',value:state.pendingEvent.title||'Scegli prima di giocare'});
 if(typeof coachCurrentEffectLabel==='function')rules.push({label:'Allenatore',value:coachCurrentEffectLabel()});
 if(typeof chaosEnabled==='function'&&chaosEnabled())rules.push({label:'Modalità',value:'Caos attivo con eventi sulle 19 avversarie'});
 if(currentMatchDuration()!==90)rules.push({label:'Durata partite',value:`Le tue partite durano ${currentMatchDuration()} minuti`});
 if(state.seasonRules?.marketBlocked)rules.push({label:'Mercato',value:'Mercato bloccato: nessun nuovo acquisto consentito'});
 if(state.seasonRules?.federationGoalRule && typeof federationGoalRuleLabel==='function')rules.push({label:'Regola FIGC',value:federationGoalRuleLabel()});
 if(state.seasonRules?.figcCompetitionRule && typeof figcCompetitionRuleLabel==='function')rules.push({label:'Regolamento FIGC',value:figcCompetitionRuleLabel()});
 if(state.seasonRules?.fgicLeagueRule && typeof fgicLeagueRuleLabel==='function')rules.push({label:'Regola FGIC',value:fgicLeagueRuleLabel()});
 if(state.seasonRules?.fantaballaVideoRule && typeof fantaballaVideoRuleLabel==='function')rules.push({label:'Video di Fantaballa',value:fantaballaVideoRuleLabel()});
 if(state.seasonRules?.stadiumHomeAdvantageBonus>0)rules.push({label:'Nuovo stadio',value:'Vantaggio casalingo aumentato fino a fine stagione'});
 return rules.filter(item=>item&&item.value).slice(0,4);
}
function renderSeasonHomeRulesSummary(){
 const rules=seasonHomeRuleHighlights();
 if(!rules.length)return `<div class="season-home-empty">Nessuna regola speciale attiva al momento.</div>`;
 return `<div class="season-home-rules">${rules.map(item=>`<div class="season-home-rule"><strong>${esc(item.label)}:</strong> ${esc(item.value)}</div>`).join('')}</div>`;
}
function renderSeasonHome(){
 ensureSeasonHomeStyles();
 return `<div class="season-home-dashboard"><section class="season-home-card season-home-card--standings"><div class="season-home-card-head"><div class="season-home-card-title"><span class="season-home-card-kicker">Home overview</span><h3>Classifica</h3></div><span class="season-home-card-icon">TOP</span></div>${renderSeasonHomeStandings()}</section><section class="season-home-card season-home-card--upcoming"><div class="season-home-card-head"><div class="season-home-card-title"><span class="season-home-card-kicker">Focus match</span><h3>Prossime partite</h3></div><span class="season-home-card-icon">CAL</span></div>${renderSeasonHomeUpcoming(3)}</section><section class="season-home-card season-home-card--availability"><div class="season-home-card-head"><div class="season-home-card-title"><span class="season-home-card-kicker">Squadra</span><h3>Infortuni e squalifiche</h3></div><span class="season-home-card-icon">INFO</span></div>${renderSeasonHomeAvailabilitySummary()}</section><section class="season-home-card season-home-card--span-2 season-home-card--stats"><div class="season-home-card-head"><div class="season-home-card-title"><span class="season-home-card-kicker">Top performers</span><h3>Statistiche</h3></div><span class="season-home-card-icon">STAT</span></div>${renderSeasonHomeStatsSummary()}</section><section class="season-home-card season-home-card--rules"><div class="season-home-card-head"><div class="season-home-card-title"><span class="season-home-card-kicker">Aggiornamenti</span><h3>Nuove regole</h3></div><span class="season-home-card-icon">NEW</span></div>${renderSeasonHomeRulesSummary()}</section></div>`;
}

function showParallelCupMatch(pending){
 const cup=parallelCupState(),stage=cup.stages?.[Number(pending.stageIndex)],tie=stage?.ties?.find(item=>String(item.id)===String(pending.tieId));
 if(!stage||!tie){cup.pendingMatch=null;save();render();return}
 const teamA=parallelCupParticipant(tie.teamAId),teamB=parallelCupParticipant(tie.teamBId),homeParticipant=Number(pending.legIndex)===0?teamA:teamB,awayParticipant=Number(pending.legIndex)===0?teamB:teamA;
 const homeTeam=parallelCupParticipantTeam(homeParticipant),awayTeam=parallelCupParticipantTeam(awayParticipant),opponentParticipant=homeParticipant?.user?awayParticipant:homeParticipant,opponentTeam=parallelCupParticipantTeam(opponentParticipant),opponentLineup=parallelCupParticipantLineup(opponentParticipant),event=pending.event||parallelCupDedicatedEvent(Boolean(pending.userHome));
 pending.event=event;
 screen.innerHTML=`<div class="parallel-cup-match-view"><section class="parallel-cup-match-hero"><div class="parallel-cup-match-top"><div><div class="label">🏆 Coppa parallela · prima della giornata ${Number(pending.matchday)}</div><h2>${esc(stage.name)}</h2></div><div class="parallel-cup-leg-badge">${Number(pending.legIndex)===0?'Andata':'Ritorno'}</div></div><div class="next-match">${renderNextTeamCard(homeTeam,'Casa',previewTeamAverageOvr(homeTeam))}<div class="versus">VS</div>${renderNextTeamCard(awayTeam,'Trasferta',previewTeamAverageOvr(awayTeam))}</div><div class="parallel-cup-aggregate"><b>Aggregato attuale:</b> ${Number(tie.aggregateA)||0}-${Number(tie.aggregateB)||0} · Questa partita non fa avanzare la giornata di campionato.</div><div class="parallel-cup-event-card"><span>Evento dedicato alla coppa</span><b>${esc(event.title)}</b><p>${esc(event.description)}</p></div><div class="parallel-cup-match-actions"><button id="playCupLive" class="btn match-live-button" type="button" data-single-action data-busy-announcement="Partita di coppa avviata con cronaca.">🎙️ Gioca con cronaca</button><button id="playCupInstant" class="btn match-instant-button" type="button" data-single-action data-busy-announcement="Simulazione della partita di coppa avviata.">📯 Simula subito</button></div></section><div class="dashboard-grid season-dashboard-grid"><div class="season-main-column">${renderParallelCupPanel()}<section class="panel"><div class="label">La tua formazione</div>${renderResolvedLineup()}</section></div><aside class="season-sidebar"><section class="panel opponent-club-panel" style="${teamCssVars(opponentTeam)}"><div class="label">Avversario di coppa</div><h3>${esc(opponentTeam.name)}</h3><p>OVR stimato ${parallelCupParticipantPower(opponentParticipant).toFixed(1)}</p>${renderParallelCupOpponentLineup(opponentLineup)}</section></aside></div></div>`;
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
 const fx=userFixture(),opp=teamById(fx.home===USER_ID?fx.away:fx.home),userTeam=teamById(USER_ID)||{id:USER_ID,name:state.teamName,clubId:state.userClubId,colors:activeUserClub().colorClub},homeTeam=teamById(fx.home),awayTeam=teamById(fx.away),standing=userStanding(),rank=sortedTable().findIndex(x=>x.id===USER_ID)+1,userHome=fx.home===USER_ID,lineup=resolveLineup(),lineupOvr=resolvedLineupAverage(lineup),chemistry=draftChemistry(lineup),eventPending=Boolean(state.pendingEvent&&!state.pendingEvent.resolved),questSelectionPending=typeof leaderQuestSelectionPending==='function'&&leaderQuestSelectionPending(),matchBlocked=eventPending||questSelectionPending,matchDisabled=matchBlocked?'disabled aria-disabled="true" aria-describedby="matchActionStatus" data-disabled-reason="Completa prima la scelta in attesa."':'',matchStatus=eventPending?'Prima di giocare devi scegliere una delle opzioni dell’evento in attesa.':questSelectionPending?'Prima di giocare devi scegliere il leader della quest.':'';
 const venueLabel=userHome?'Partita in casa':'Partita in trasferta';
 ensureSeasonHomeStyles();
 screen.innerHTML=`<div class="season-top-shell" style="${teamCssVars(userTeam)}">${renderSeasonTopSummary({rank,standing,lineupOvr,chemistry})}<section class="panel season-match-panel season-top-match"><div class="season-top-match-head"><div class="season-top-match-kicker"><span>Giornata ${state.matchday+1} · ${venueLabel}</span></div></div><div class="season-top-matchup">${renderSeasonTopTeam(homeTeam,{role:userHome?'La tua squadra':'Avversario',venue:'Casa',ovr:previewTeamAverageOvr(homeTeam),side:'home'})}<div class="season-top-versus" aria-label="contro">VS</div>${renderSeasonTopTeam(awayTeam,{role:userHome?'Avversario':'La tua squadra',venue:'Trasferta',ovr:previewTeamAverageOvr(awayTeam),side:'away'})}</div><div class="season-top-actions"><button id="playRoundLive" class="btn match-live-button" type="button" data-single-action data-busy-announcement="Partita avviata con cronaca." ${matchDisabled}>🎙️ Gioca con cronaca</button><button id="playRoundInstant" class="btn match-instant-button" type="button" data-single-action data-busy-announcement="Simulazione della giornata avviata." ${matchDisabled}>📯 Simula</button></div><div id="matchActionStatus" class="match-play-note a11y-command-message ${matchBlocked?'is-blocked':''}" role="status" aria-live="polite">${matchStatus}</div><div class="season-top-existing-content">${renderParallelCupPanel()}${typeof renderSeasonInventory==='function'?renderSeasonInventory():''}${renderActiveQuest()}${renderError404StoryPanel()}${renderFantaballopoliPanel()}${renderMeritStoryPanel()}${renderEvent()}${renderChaosLeagueFeed()}</div></section></div><div class="dashboard-grid season-dashboard-grid"><div class="season-main-column"><section class="panel season-tabs-panel"><div class="tabs"><button class="tab active" data-tab="home">Home</button><button class="tab" data-tab="table">Classifica</button><button class="tab" data-tab="calendar">Calendario</button><button class="tab" data-tab="roster">Rosa</button><button class="tab" data-tab="stats">Statistiche</button><button class="tab" data-tab="journey">Percorso</button></div><div id="tab-home" class="tab-view active">${renderSeasonHome()}</div><div id="tab-table" class="tab-view">${renderTable()}</div><div id="tab-calendar" class="tab-view">${renderCalendar()}</div><div id="tab-roster" class="tab-view">${renderSeasonRosterField()}</div><div id="tab-stats" class="tab-view">${renderStats()}</div><div id="tab-journey" class="tab-view">${renderSeasonJourney()}</div></section></div><aside class="season-sidebar"><section class="panel season-lineup-panel"><div class="label">Formazione effettiva</div>${renderResolvedLineup()}</section><section class="panel opponent-club-panel season-opponent-panel" style="${teamCssVars(opp)}"><div class="label">Avversario reale</div><h3>${teamColorDot(opp)}${esc(opp.name)}</h3>${seasonRuleSummary()}${renderOpponentRoster(opp)}</section></aside></div>`;
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
 return `${emergencyYouthCount?`<div class="season-rules-card"><b>${emergencyYouthCount} Primavera d’emergenza</b><br>Gli slot senza un giocatore reale valgono 50 OVR fisso e non ricevono bonus.</div>`:''}<div class="resolved-lineup-list">${lineup.map(entry=>{const player=entry.player||{};const fx=lineupEffects(entry,lineup);const sub=isSubscriber(player),creator=isCreator(player);const finalOvr=resolvedPlayerFinalOvr(entry,lineup);return `<div class="resolved-player-card ${sub?'subscriber-card':''} ${creator?'creator-card':''}"><span class="slot-code">${esc(entry.slot)}</span>${renderMiniAvatar(player,'small')}<div class="resolved-main"><div class="resolved-name-line"><b>${esc(player.name)}</b>${sub?'<span class="resolved-tag-sub">★ ABB</span>':''}${creator?'<span class="resolved-tag-creator" title="Creator">CR</span>':''}${typeof captainArmbandActive==='function'&&String(captainArmbandActive()?.playerId||'')===String(entry.playerId)?'<span class="resolved-tag-item">© CAPITANO</span>':''}</div><span class="resolved-meta">${entry.replaces?`Al posto di ${esc(entry.replaces)}`:`${esc(player.nation)} · ${esc(player.Position)}`}</span>${fx.effects.length?`<div class="resolved-effects">${fx.effects.map(effect=>`<span class="resolved-effect ${effect.type}">${esc(effect.label)}</span>`).join('')}</div>`:'<div class="resolved-effects"><span class="resolved-effect neutral">Nessun bonus o malus</span></div>'}</div><div class="resolved-ovr-col"><span class="chip ovr">${finalOvr}</span><span class="resolved-total">OVR finale</span></div></div>`}).join('')}</div>`
}
function renderTable(){const rows=sortedTable();return `<div class="season-table-scroll" role="region" aria-label="Classifica del campionato" tabindex="0"><table><thead><tr><th>Squadra</th><th>PG</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th><th>DR</th><th>Pt</th></tr></thead><tbody>${rows.map((r,i)=>{const team=teamById(r.id);return `<tr class="${r.id===USER_ID?'us-row':''}" style="${teamCssVars(team)}"><td><span class="standing-team">${teamColorDot(team)}<span>${i+1}. ${esc(r.name)}</span></span></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gf-r.ga}</td><td>${r.pts}</td></tr>`}).join('')}</tbody></table></div>`}
function renderCalendar(){return `<div class="calendar">${state.schedule.map((rd,i)=>{const fx=rd.find(m=>m.home===USER_ID||m.away===USER_ID),home=teamById(fx.home),away=teamById(fx.away),hist=state.history[i];return `<div class="calendar-row ${i===state.matchday?'current':''} ${i<state.matchday?'done':''}"><b>G ${i+1}</b><span class="calendar-clubs"><span class="calendar-team" style="${teamCssVars(home)}">${teamColorDot(home)}<span>${esc(home?.name||state.teamName)}</span></span><em>–</em><span class="calendar-team" style="${teamCssVars(away)}">${teamColorDot(away)}<span>${esc(away?.name||state.teamName)}</span></span></span><strong>${hist?`${Number.isFinite(Number(hist.displayGf))?Number(hist.displayGf):hist.gf}-${Number.isFinite(Number(hist.displayGa))?Number(hist.displayGa):hist.ga}${hist.penalties?' d.c.r.':''}`:'-'}</strong></div>`}).join('')}</div>`}
function ensureSeasonStatsStyles(){
 if(document.getElementById('seasonStatsDashboardStyles'))return;
 const style=document.createElement('style');
 style.id='seasonStatsDashboardStyles';
 style.textContent=`
 .season-stats-shell{display:grid;gap:14px}
 .season-stats-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
 .season-stats-kpi{min-width:0;padding:14px 16px;border-radius:18px;background:linear-gradient(180deg,#fffdf7,#f8f0df);border:1px solid rgba(212,192,136,.78);box-shadow:0 7px 18px rgba(16,36,58,.08)}
 .season-stats-kpi span{display:block;color:#8f5b22;font-size:10px;font-weight:1000;letter-spacing:.12em;text-transform:uppercase}
 .season-stats-kpi b{display:block;margin-top:6px;color:#10243a;font-size:20px;line-height:1.08;word-break:break-word}
 .season-stats-kpi small{display:block;margin-top:5px;color:#5f574c;font-size:12px;font-weight:850;line-height:1.35}
 .season-stats-banner{padding:14px 16px;border-radius:18px;background:linear-gradient(135deg,rgba(16,36,58,.06),rgba(242,211,86,.28));border:1px solid rgba(16,36,58,.12);color:#10243a}
 .season-stats-banner b{display:block;margin-bottom:4px;font-size:13px;text-transform:uppercase;letter-spacing:.08em}
 .season-stats-banner p{margin:0;color:#5b564e;font-size:12px;font-weight:850;line-height:1.45}
 .season-stats-shell .final-player-stats{margin:0}
 .season-stats-shell .final-player-stats-title p{max-width:none}
 @media(max-width:980px){.season-stats-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
 @media(max-width:820px){.season-stats-shell .final-player-stats-grid{grid-template-columns:1fr}}
 @media(max-width:620px){.season-stats-kpis{grid-template-columns:1fr}.season-stats-kpi{padding:13px 14px;border-radius:16px}}
 `;
 document.head.appendChild(style);
}
function seasonStatsEntries(bucket,{limit=5,teamId=null,tieBucket=''}={}){
 const source=state.stats?.[bucket]||{};
 const tieSource=state.stats?.[tieBucket]||{};
 return Object.entries(source)
  .filter(([,value])=>Number(value)>0)
  .filter(([id])=>!teamId||String(statPlayerTeam(id)?.id||'')===String(teamId))
  .sort((a,b)=>(Number(b[1])||0)-(Number(a[1])||0)||(Number(tieSource[b[0]])||0)-(Number(tieSource[a[0]])||0)||String(statPlayerInfo(a[0]).name||'').localeCompare(String(statPlayerInfo(b[0]).name||''),'it'))
  .slice(0,limit);
}
function seasonStatsBestEntry(bucket,teamId=USER_ID,tieBucket=''){
 return seasonStatsEntries(bucket,{limit:1,teamId,tieBucket})[0]||null;
}
function renderSeasonStatsKpi(label,value,note=''){
 return `<div class="season-stats-kpi"><span>${esc(label)}</span><b>${value}</b>${note?`<small>${note}</small>`:''}</div>`;
}
function renderStatsLeagueCard({title,icon,bucket,unit,tieBucket='',empty='Nessun dato disponibile.'}){
 const entries=seasonStatsEntries(bucket,{limit:5,tieBucket});
 const hasRealMvpVotes=Object.values(state.stats?.mvpVotes||{}).some(value=>Number(value)>0);
 const listHtml=entries.length?entries.map(([id,value],index)=>{
   const player=statPlayerInfo(id);
   const team=statPlayerTeam(id);
   const mvpFallback=bucket==='mvpVotes'&&!hasRealMvpVotes;
   const shownUnit=mvpFallback?'pt':unit;
   const roleText=bucket==='cleanSheets'?'Portiere':esc(player.Position||roleOf(player));
   const extra=bucket==='mvpVotes'?(mvpFallback?'Indice calcolato da gol e assist':`Punteggio ${Number(state.stats?.mvpPoints?.[id]||0).toFixed(1)}`):roleText;
   const teamLine=team?`${teamColorDot(team)}<span>${esc(team.name)}</span>`:'<span>Club non disponibile</span>';
   return `<div class="final-player-stat-row ${index===0?'winner':''}"><span class="final-player-rank">${index+1}</span>${renderMiniAvatar(player,'small')}<div class="final-player-copy"><b>${esc(player.name)}</b><small class="final-player-team">${teamLine}</small><small>${extra}</small></div><strong>${Math.round(Number(value)||0)} <em>${esc(shownUnit)}</em></strong></div>`;
  }).join(''):`<div class="final-player-stat-empty">${esc(empty)}</div>`;
 return `<section class="final-player-stat-card"><div class="final-player-stat-head"><span class="final-player-stat-icon">${icon}</span><div><span>Top 5 campionato</span><h3>${esc(title)}</h3></div></div><div class="final-player-stat-list">${listHtml}</div></section>`;
}
function renderStatsTeamCard({title,icon,bucket,unit,tieBucket='',empty='Nessun dato disponibile.'}){
 const entries=seasonStatsEntries(bucket,{limit:5,teamId:USER_ID,tieBucket});
 const hasRealMvpVotes=Object.values(state.stats?.mvpVotes||{}).some(value=>Number(value)>0);
 const listHtml=entries.length?entries.map(([id,value],index)=>{
   const player=statPlayerInfo(id);
   const mvpFallback=bucket==='mvpVotes'&&!hasRealMvpVotes;
   const shownUnit=mvpFallback?'pt':unit;
   const roleText=bucket==='appearances'?'Presenze stagionali':bucket==='mvpVotes'?(mvpFallback?'Indice calcolato da gol e assist':`Punteggio ${Number(state.stats?.mvpPoints?.[id]||0).toFixed(1)}`):esc(player.Position||roleOf(player));
   return `<div class="final-player-stat-row ${index===0?'winner':''}"><span class="final-player-rank">${index+1}</span>${renderMiniAvatar(player,'small')}<div class="final-player-copy"><b>${esc(player.name)}</b><small>${roleText}</small></div><strong>${Math.round(Number(value)||0)} <em>${esc(shownUnit)}</em></strong></div>`;
  }).join(''):`<div class="final-player-stat-empty">${esc(empty)}</div>`;
 return `<section class="final-player-stat-card"><div class="final-player-stat-head"><span class="final-player-stat-icon">${icon}</span><div><span>Top 5 della tua rosa</span><h3>${esc(title)}</h3></div></div><div class="final-player-stat-list">${listHtml}</div></section>`;
}
function renderStats(){
 ensureSeasonStatsStyles();
 const standing=userStanding()||{pts:0,w:0,d:0,l:0,gf:0,ga:0};
 const ranking=sortedTable();
 const rankIndex=ranking.findIndex(row=>row.id===USER_ID);
 const rank=rankIndex>=0?rankIndex+1:1;
 const topScorer=seasonStatsBestEntry('goals',null);
 const topAssist=seasonStatsBestEntry('assists',null);
 const userTopScorer=seasonStatsBestEntry('goals',USER_ID);
 const userTopAssist=seasonStatsBestEntry('assists',USER_ID);
 const topScorerPlayer=userTopScorer?statPlayerInfo(userTopScorer[0]):null;
 const topAssistPlayer=userTopAssist?statPlayerInfo(userTopAssist[0]):null;
 const totalTeams=state.teams.filter(team=>!isTeamEliminated(team.id)).length;
 const roundsPlayed=Math.min(seasonLength(),state.matchday);
 const topLeagueScorer=topScorer?`${esc(statPlayerInfo(topScorer[0]).name)} · ${Math.round(Number(topScorer[1])||0)} gol`:'Nessun gol registrato';
 const topLeagueAssist=topAssist?`${esc(statPlayerInfo(topAssist[0]).name)} · ${Math.round(Number(topAssist[1])||0)} assist`:'Nessun assist registrato';
 const goalDiff=(Number(standing.gf)||0)-(Number(standing.ga)||0);
 return `<div class="season-stats-shell"><div class="season-stats-kpis">${renderSeasonStatsKpi('Posizione attuale',`${rank}°`,`${Number(standing.pts)||0} punti · ${Number(standing.w)||0}-${Number(standing.d)||0}-${Number(standing.l)||0}`)}${renderSeasonStatsKpi('Gol squadra',`${Number(standing.gf)||0}`,`${Number(standing.ga)||0} subiti · diff. reti ${goalDiff>=0?'+':''}${goalDiff}`)}${renderSeasonStatsKpi('Capocannoniere squadra',userTopScorer&&topScorerPlayer?esc(topScorerPlayer.name):'—',userTopScorer?`${Math.round(Number(userTopScorer[1])||0)} gol`:'Nessun gol segnato')}${renderSeasonStatsKpi('Assist-man squadra',userTopAssist&&topAssistPlayer?esc(topAssistPlayer.name):'—',userTopAssist?`${Math.round(Number(userTopAssist[1])||0)} assist`:'Nessun assist registrato')}</div><div class="season-stats-banner"><b>Statistiche in stile recap finale</b><p>Qui trovi una versione più ricca e leggibile delle statistiche, con classifiche individuali della tua rosa e del campionato. Dati aggiornati dopo ${roundsPlayed} ${roundsPlayed===1?'giornata':'giornate'} su ${seasonLength()} · ${totalTeams} squadre attive.</p></div><section class="final-player-stats"><div class="final-player-stats-title"><div><span>La tua squadra</span><h2>Focus rosa</h2></div><p>Riepilogo dei migliori giocatori di ${esc(state.teamName)}. In alto vedi chi sta incidendo di più su gol, assist, presenze e premi MVP.</p></div><div class="final-player-stats-grid">${renderStatsTeamCard({title:'Capocannonieri squadra',icon:'⚽',bucket:'goals',unit:'gol',empty:'Nessun gol nella tua squadra.'})}${renderStatsTeamCard({title:'Assist-man squadra',icon:'🎯',bucket:'assists',unit:'assist',empty:'Nessun assist nella tua squadra.'})}${renderStatsTeamCard({title:'Più presenti',icon:'🗓️',bucket:'appearances',unit:'pres.',empty:'Nessuna presenza registrata.'})}${renderStatsTeamCard({title:'MVP squadra',icon:'⭐',bucket:'mvpVotes',tieBucket:'mvpPoints',unit:'MVP',empty:'Nessun MVP nella tua squadra.'})}</div></section><section class="final-player-stats"><div class="final-player-stats-title"><div><span>Campionato</span><h2>Classifiche generali</h2></div><p>I leader dell'intera stagione: ${topLeagueScorer}. Assist leader: ${topLeagueAssist}. Stessa grafica del recap finale, ma sempre consultabile durante l'anno.</p></div><div class="final-player-stats-grid">${renderStatsLeagueCard({title:'Capocannonieri',icon:'⚽',bucket:'goals',unit:'gol'})}${renderStatsLeagueCard({title:'Assist-man',icon:'🎯',bucket:'assists',unit:'assist'})}${renderStatsLeagueCard({title:'MVP',icon:'⭐',bucket:'mvpVotes',tieBucket:'mvpPoints',unit:'MVP',empty:'Nessun MVP assegnato.'})}${renderStatsLeagueCard({title:'Porte inviolate',icon:'🧤',bucket:'cleanSheets',unit:'clean sheet',empty:'Nessuna porta inviolata.'})}</div></section></div>`;
}
