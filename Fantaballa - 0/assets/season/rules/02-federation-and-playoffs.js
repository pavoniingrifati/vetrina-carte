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
function activateFigcIncidentRule(rule='negative'){
 const normalized=rule==='positive'?'positive':'negative';
 state.seasonRules.figcIncidentRule=normalized;
 return normalized==='negative'
  ?'Regola negativa attiva: ogni rosso, nuovo infortunio o rigore sbagliato sottrae un gol alla squadra coinvolta. Il risultato può diventare negativo.'
  :'Regola positiva attiva: ogni giocatore autore di almeno una doppietta assegna un punto aggiuntivo alla propria squadra.';
}
function figcIncidentRuleLabel(rule=state.seasonRules?.figcIncidentRule){return rule==='negative'?'Penalità episodi':rule==='positive'?'Premio doppietta':''}
function figcNegativeIncidentRuleActive(){return String(state.seasonRules?.figcIncidentRule)==='negative'}
function figcPositiveBraceRuleActive(){return String(state.seasonRules?.figcIncidentRule)==='positive'}
function figcBraceScorers(events=[]){
 const counts=new Map(),names=new Map();
 (Array.isArray(events)?events:[]).forEach(event=>{
  const key=String(event?.playerId||'');if(!key)return;
  counts.set(key,(counts.get(key)||0)+1);names.set(key,String(event?.player||event?.playerName||'Marcatore'));
 });
 return [...counts.entries()].filter(([,count])=>count>=2).map(([playerId,count])=>({playerId,playerName:names.get(playerId)||'Marcatore',goals:count}));
}
function figcBraceBonus(events=[]){return figcPositiveBraceRuleActive()?figcBraceScorers(events).length:0}
function figcIncidentCount(incidents={}){return Math.max(0,Number(incidents.redCards)||0)+Math.max(0,Number(incidents.injuries)||0)+Math.max(0,Number(incidents.missedPenalties)||0)}
function applyFigcNegativeGoalPenalty(score,events,incidents={}){
 const before=Number(score)||0,penalty=figcNegativeIncidentRuleActive()?figcIncidentCount(incidents):0;
 if(!penalty)return{before,after:before,penalty:0,incidents:{...incidents}};
 const after=before-penalty,eventScore=scoreGoalEvents(events);
 if(eventScore>Math.max(0,after))capGoalEvents(events,Math.max(0,after));
 return{before,after,penalty,rawPenalty:penalty,incidents:{...incidents}};
}
function applyFigcBraceBonusesToRound(roundResults=[]){
 const details=[];if(!figcPositiveBraceRuleActive())return details;
 (Array.isArray(roundResults)?roundResults:[]).forEach(result=>{
  [['homeId','homeName','homeGoals'],['awayId','awayName','awayGoals']].forEach(([idKey,nameKey,goalsKey])=>{
   const teamId=String(result?.[idKey]||''),standing=state.standings?.[teamId],scorers=figcBraceScorers(result?.[goalsKey]||[]),bonus=scorers.length;
   if(!teamId||!standing||!bonus||isTeamEliminated(teamId))return;
   standing.pts=(Number(standing.pts)||0)+bonus;
   details.push({teamId,teamName:String(result?.[nameKey]||standing.name||teamId),bonus,scorers});
  });
 });
 return details;
}

function activateFigcCompetitionRule(rule='formula-one'){
 const normalized=rule==='no-draw'?'no-draw':'formula-one';
 state.seasonRules.figcCompetitionRule=normalized;
 return normalized==='formula-one'
  ?'Formato Formula 1 attivo fino a fine stagione: al termine di ogni giornata le squadre vengono ordinate per qualità del risultato e le prime dieci ricevono 25, 18, 15, 12, 10, 8, 6, 4, 2 e 1 punto. Tutte le altre ricevono 0 punti. Inoltre, una squadra con almeno un giocatore infortunato perde automaticamente 0-3 a tavolino la partita successiva. Espulsioni e squalifiche non provocano la sconfitta a tavolino.'
  :'Niente pareggio attivo fino a fine stagione: ogni partita in parità continua ai supplementari e, se serve, ai calci di rigore.';
}
function figcCompetitionRuleLabel(rule=state.seasonRules?.figcCompetitionRule){return rule==='formula-one'?'Formato Formula 1':rule==='no-draw'?'Niente pareggio':''}
function formulaOneRuleActive(){return String(state.seasonRules?.figcCompetitionRule)==='formula-one'}
function noDrawRuleActive(){return !(typeof wweWatchOutActive==='function'&&wweWatchOutActive())&&String(state.seasonRules?.figcCompetitionRule)==='no-draw'}

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
function finishAfterLeaguePlayoffs(){if(!prepareFantaballopoliFinale()&&!prepareMysteryCharacterFinale()&&!prepareMeritStoryFinale())state.phase='finished'}
function advanceAfterRegularSeason(){
 if(Number(state.matchday)>=seasonLength()&&leaguePlayoffsRuleActive()){
   const p=leaguePlayoffState();if(p.status!=='completed'&&initializeLeaguePlayoffs())return;
 }
 finishAfterLeaguePlayoffs();
}
function playoffStageResultRow(result,index=0){
 return `<div class="playoff-stage-row is-revealed" style="--playoff-row-delay:${Math.max(0,index)*90}ms"><div class="playoff-stage-score"><span>${result.homeSeed}ª ${esc(result.homeName)}</span><strong>${Number(result.homeGoals)}–${Number(result.awayGoals)}</strong><span>${esc(result.awayName)} ${result.awaySeed}ª</span></div><small>${result.penalties?`Rigori: ${Number(result.penalties.home)}–${Number(result.penalties.away)}.`:result.extraTime?'Decisa dopo i tempi supplementari.':'Partita decisa nei tempi regolamentari.'}</small></div>`;
}
function playoffStageLiveRow(tie,index=0){
 const home=teamById(tie.homeId),away=teamById(tie.awayId);
 return `<div class="playoff-stage-row is-live" id="playoffLiveRow"><div class="playoff-stage-score"><span>${tie.homeSeed}ª ${esc(home?.name||'Squadra')}</span><strong><span class="playoff-sim-ball">⚽</span></strong><span>${esc(away?.name||'Squadra')} ${tie.awaySeed}ª</span></div><small>Simulazione della partita ${index+1} in corso…</small><div class="playoff-sim-progress"><i></i></div></div>`;
}
function playLeaguePlayoffStage(){
 const p=leaguePlayoffState();if(p.status!=='active'||!p.ties.length)return;
 const stageName=leaguePlayoffStageName(p.stageIndex),ties=p.ties.slice(),results=[];
 modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal result-modal-expanded playoff-stage-modal playoff-stage-live"><div class="label">🏆 ${esc(stageName)}</div><h2>Simulazione del turno</h2><p class="playoff-stage-intro">Le partite vengono disputate una alla volta. I risultati appariranno al termine di ogni simulazione.</p><div id="playoffStageLiveArea" class="playoff-stage-rows"></div><button class="btn primary" disabled>Simulazione in corso…</button></div></div>`;
 const area=document.getElementById('playoffStageLiveArea'),button=modalRoot.querySelector('.playoff-stage-modal .btn.primary');
 let index=0;
 const simulateNext=()=>{
   if(index>=ties.length){
     const winners=results.map(result=>String(result.winnerId));
     p.lastStageResults=results;p.history.push({stageIndex:p.stageIndex,stageName,results});
     const userTie=results.find(result=>[String(result.homeId),String(result.awayId)].includes(String(USER_ID)));if(userTie&&String(userTie.winnerId)!==String(USER_ID))p.userEliminated=true;
     if(p.stageIndex>=2){p.status='completed';p.championId=String(winners[0]||'');p.ties=[];p.stageName='Play off conclusi';}
     else{p.stageIndex++;p.stageName=leaguePlayoffStageName(p.stageIndex);p.ties=buildNextLeaguePlayoffTies(winners)}
     save();
     const completed=p.status==='completed',champion=teamById(p.championId),modal=modalRoot.querySelector('.playoff-stage-modal');
     modal.classList.remove('playoff-stage-live');
     modal.querySelector('h2').textContent=completed?`${champion?.name||'La squadra vincitrice'} è campione`:'Turno completato';
     modal.querySelector('.playoff-stage-intro').textContent=completed?'Il tabellone dei play off scudetto è terminato.':'Tutte le partite del turno sono state simulate.';
     button.disabled=false;button.textContent=completed?'Vai al finale di stagione':'Continua i play off';
     button.id='continueLeaguePlayoffs';
     button.onclick=()=>{modalRoot.innerHTML='';if(completed)finishAfterLeaguePlayoffs();save();render()};
     return;
   }
   const tie=ties[index];
   area.insertAdjacentHTML('beforeend',playoffStageLiveRow(tie,index));
   setTimeout(()=>{
     const result=simulateLeaguePlayoffTie(tie);results.push(result);
     const live=document.getElementById('playoffLiveRow');if(live)live.outerHTML=playoffStageResultRow(result,index);
     index++;
     setTimeout(simulateNext,500);
   },950);
 };
 setTimeout(simulateNext,250);
}

function renderLeaguePlayoffHistory(){
 const p=leaguePlayoffState();if(!p.history.length)return'';
 return p.history.map(stage=>`<section class="panel"><div class="label">${esc(stage.stageName)}</div>${(stage.results||[]).map(result=>`<div class="goal-line"><b>${result.homeSeed}ª ${esc(result.homeName)}</b> ${Number(result.homeGoals)}–${Number(result.awayGoals)} <b>${esc(result.awayName)} ${result.awaySeed}ª</b>${result.penalties?` · rigori ${Number(result.penalties.home)}–${Number(result.penalties.away)}`:result.extraTime?' · d.t.s.':''}</div>`).join('')}</section>`).join('');
}
function showLeaguePlayoffs(){
 const p=leaguePlayoffState();if(!p.initialized)initializeLeaguePlayoffs();if(p.status==='completed'){finishAfterLeaguePlayoffs();save();render();return}
 const qualified=p.qualifiers.map(item=>`${item.seed}ª ${esc(item.name)}`).join(' · '),ties=p.ties.map(tie=>{const home=teamById(tie.homeId),away=teamById(tie.awayId);return `<div class="goal-line"><b>${tie.homeSeed}ª ${esc(home?.name||'Squadra')}</b> vs <b>${esc(away?.name||'Squadra')} ${tie.awaySeed}ª</b><br>Partita secca in casa della squadra meglio classificata.</div>`}).join('');
 screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Nuova regola FGIC</div><h2>Play off scudetto</h2><div class="final-position">TOP 8</div><p>${p.userQualified?'Sei qualificato: affronta il tabellone fino alla finale.':'Non sei tra le prime otto: puoi seguire la simulazione del tabellone.'}</p></div><section class="panel"><h3>${esc(leaguePlayoffStageName(p.stageIndex))}</h3><p class="subline">Qualificate: ${qualified}</p>${ties}<button id="playLeaguePlayoffStage" type="button" data-single-action data-busy-announcement="Sfida avviata." class="btn primary">${p.userQualified&&!p.userEliminated?'Gioca il turno':'Simula il turno'}</button></section>${renderLeaguePlayoffHistory()}</section>`;
 document.getElementById('playLeaguePlayoffStage').onclick=playLeaguePlayoffStage;
}
function leaguePlayoffChampionId(){return leaguePlayoffsRuleActive()?String(leaguePlayoffState().championId||''):''}
function leaguePlayoffTitleWon(){return leaguePlayoffsRuleActive()&&leaguePlayoffState().status==='completed'&&leaguePlayoffChampionId()===String(USER_ID)}
function leaguePlayoffFinalNote(){if(!leaguePlayoffsRuleActive()||leaguePlayoffState().status!=='completed')return'';const champion=teamById(leaguePlayoffChampionId());return `Play off scudetto: ${champion?.name||'Squadra vincitrice'} campione.`}

