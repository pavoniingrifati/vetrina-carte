/* Responsibility: trade-roster-controller. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: trade-roster-controller');
  function currentTradeWindow(kind){
    const seasonNumber=Math.max(1,Number($runtime.state?.career?.seasonNumber||1));
    const key=`${kind}|S${seasonNumber}`;
    $runtime.state.tradeWindows ||= {};
    return $runtime.state.tradeWindows[key] ||= {kind,seasonNumber,stage:'open',completed:0,attempts:0,history:[],pending:null,notice:''};
  }

  function tradeOfferSelection(){
    const me=$runtime.managerById('user'),rival=$runtime.managerById($runtime.$('tradeOpponent')?.value);
    const outgoing=me?.roster?.find(p=>String(p.id)===$runtime.$('tradeOutgoing')?.value);
    const incoming=rival?.roster?.find(p=>String(p.id)===$runtime.$('tradeIncoming')?.value);
    const raw=String($runtime.$('tradeCredits')?.value??'0').trim();
    const credits=/^\d+$/.test(raw)?Number(raw):NaN;
    return {me,rival,outgoing,incoming,credits};
  }

  function tradeOfferValid(offer){
    return !!(offer?.me && offer.rival && offer.outgoing && offer.incoming &&
      offer.me.id==='user' && offer.rival.id!=='user' && offer.me.id!==offer.rival.id &&
      offer.me.roster.includes(offer.outgoing) && offer.rival.roster.includes(offer.incoming) &&
      offer.outgoing.role===offer.incoming.role && Number.isSafeInteger(offer.credits) &&
      offer.credits>=0 && offer.credits<=Number(offer.me.budget||0));
  }

  function tradeAvailabilityFactor(player,kind){
    if(kind!=='winter') return 1;
    const day=Number($runtime.state?.season?.currentMatchday||20);
    const status=$runtime.playerStatusForDay(player.id,day);
    if(!status.unavailable) return 1;
    if(status.type==='abroad') return 0;
    const record=$runtime.playerSeasonStatus(player.id);
    const remaining=Math.max(1,39-day);
    const missed=Math.max(1,Math.min(remaining,Math.max(Number(record.injuryUntil||0),Number(record.suspensionUntil||0))-day+1));
    return Math.max(0,1-missed/remaining);
  }

  function tradeLineupStrength(roster,role,kind){
    // Protect the best usable players plus one cover, not just the first name.
    const counts={P:1,D:4,C:4,A:3};
    const values=roster.filter(p=>p.role===role).map(p=>$runtime.tradePlayerWorth(p,kind)).sort((a,b)=>b-a);
    const starters=counts[role]||3;
    return values.slice(0,starters).reduce((sum,value)=>sum+value,0)+(values[starters]||0)*.35;
  }

  function tradePlayerWorth(player,kind){
    const ovr=$runtime.currentPlayerOvr(player);
    // Il valore di mercato riflette anche il ruolo e la rarità dei migliori,
    // mentre il costo pagato all'asta non determina il valore di uno scambio.
    const base=Math.max(1,$runtime.baseAuctionValue(player))*.90+Math.max(0,ovr-60)*.55;
    if(kind!=='winter') return base;
    const form=$runtime.playerFormMetrics(player.id);
    const stat=$runtime.playerSeasonStat(player.id);
    const healthy=Math.max(1,base+form.score*7+Math.min(14,Number(stat?.goals||0)*1.5+Number(stat?.assists||0)*.8));
    return healthy*$runtime.tradeAvailabilityFactor(player,kind);
  }

  function tradeCpuDecision(offer,windowState){
    const ours=$runtime.tradePlayerWorth(offer.outgoing,windowState.kind);
    const theirs=$runtime.tradePlayerWorth(offer.incoming,windowState.kind);
    const role=offer.outgoing.role;
    const rivalAlternatives=offer.rival.roster.filter(p=>p.role===role);
    const otherValues=rivalAlternatives.filter(p=>p!==offer.incoming).map(p=>$runtime.tradePlayerWorth(p,windowState.kind));
    const bestInRole=!otherValues.length || theirs>=Math.max(...otherValues);
    const starPremium=bestInRole?Math.max(3,Math.ceil(theirs*.12)):0;
    const before=$runtime.tradeLineupStrength(offer.rival.roster,role,windowState.kind);
    const after=$runtime.tradeLineupStrength(offer.rival.roster.map(p=>p===offer.incoming?offer.outgoing:p),role,windowState.kind);
    const loss=Math.max(0,before-after);
    const archetype=String(offer.rival.profile?.archetype||'');
    const firmness={squalo:.12,camaleonte:.06,fantadata:.15,predatore:.12,broker:.18,admin:.22,ragioniere:.07,tirchio:.10,moneyball:.08,pazzo:-.04}[archetype]||0;
    // Cash cannot compensate for an unusable replacement or a gutted starting unit.
    if(windowState.kind==='winter' && $runtime.tradeAvailabilityFactor(offer.outgoing,windowState.kind)===0 && theirs>0) return {type:'reject'};
    if(loss>before*.25 && ours<theirs*.65) return {type:'reject'};
    const request=Math.max(0,Math.ceil((theirs-ours)*(1.15+firmness)+starPremium+loss*.15));
    const disposition=$runtime.careerHash(`trade|${windowState.seasonNumber}|${windowState.kind}|${offer.rival.id}|${offer.outgoing.id}|${offer.incoming.id}`);
    const willingness=Math.max(.35,(theirs>ours? .62 : bestInRole? .68 : .76)-firmness);
    if(offer.credits>=request) return disposition<willingness?{type:'accept',credits:offer.credits}:{type:'reject'};
    const counter=request+Math.ceil(disposition*3);
    if(counter<=Number(offer.me.budget||0) && counter-offer.credits<=Math.max(6,Math.ceil(theirs*.20)) && disposition<willingness){
      const reason=bestInRole
        ? `È uno dei migliori ${$runtime.ROLE_PLURALS[role]?.toLowerCase()||'giocatori'} della sua rosa: vuole un conguaglio per cederlo.`
        : theirs>ours+5
          ? 'Il giocatore che chiedi ha una valutazione maggiore di quello che offri.'
          : 'Le valutazioni sono vicine, ma il rivale vuole un conguaglio per chiudere.';
      return {type:'counter',credits:counter,reason};
    }
    return {type:'reject'};
  }

  function completeTrade(offer,windowState){
    if(!$runtime.tradeOfferValid(offer) || windowState.stage!=='open' || windowState.completed>=(windowState.kind==='winter'?3:2)) return false;
    const {me,rival,outgoing,incoming,credits}=offer;
    me.roster.splice(me.roster.indexOf(outgoing),1,incoming);
    rival.roster.splice(rival.roster.indexOf(incoming),1,outgoing);
    me.budget=Number(me.budget)-credits;
    rival.budget=Number(rival.budget)+credits;
    $runtime.state.tradeBudgetAdjustments ||= {};
    const priceDelta=Number(incoming.price||0)-Number(outgoing.price||0);
    $runtime.state.tradeBudgetAdjustments[me.id]=Number($runtime.state.tradeBudgetAdjustments[me.id]||0)+priceDelta-credits;
    $runtime.state.tradeBudgetAdjustments[rival.id]=Number($runtime.state.tradeBudgetAdjustments[rival.id]||0)-priceDelta+credits;
    if(windowState.kind==='winter'){
      $runtime.winterLedgerFor(me.id).tradeCashDelta=Number($runtime.winterLedgerFor(me.id).tradeCashDelta||0)-credits;
      $runtime.winterLedgerFor(rival.id).tradeCashDelta=Number($runtime.winterLedgerFor(rival.id).tradeCashDelta||0)+credits;
      $runtime.state.winterMarketFlow.finalBudgets[me.id]=me.budget;
      $runtime.state.winterMarketFlow.finalBudgets[rival.id]=rival.budget;
      if($runtime.state.season?.lineups) delete $runtime.state.season.lineups[String($runtime.state.season.currentMatchday||20)];
      if($runtime.state.season?.assistantCoachLineup) $runtime.state.season.assistantCoachLineup={enabled:!!$runtime.state.season.assistantCoachLineup.enabled,formation:null,starters:{},bench:[],updatedAt:Date.now(),lastSourceDay:0};
    }
    windowState.completed++;
    windowState.pending=null;
    windowState.history.unshift(`${outgoing.name} → ${rival.team} · ${incoming.name} → ${me.team}${credits?` · ${credits} cr`:''}`);
    windowState.notice=`Scambio concluso: ${incoming.name} entra nella tua rosa.`;
    $runtime.saveState();
    return true;
  }

  function tradeActiveKind(){
    return $runtime.state?.winterMarketFlow?.stage==='trades'?'winter':'summer';
  }

  function tradeCreditsValue(){
    const raw=String($runtime.$('tradeCredits')?.value??'0').trim();
    return /^\d+$/.test(raw)?Number(raw):0;
  }

  function tradeSetSelection(field,value){
    const el=$runtime.$(field);
    if(!el) return;
    el.value=value?String(value):'';
    const trade=$runtime.currentTradeWindow($runtime.tradeActiveKind());
    trade.notice='Proposta modificata.';
    $runtime.renderTradeWindow(trade.kind);
  }

  function adjustTradeCredits(delta){
    const input=$runtime.$('tradeCredits');
    if(!input) return;
    const max=Math.max(0,Number(input.max||0));
    const next=$runtime.clamp($runtime.tradeCreditsValue()+Number(delta||0),0,max);
    input.value=String(next);
    const trade=$runtime.currentTradeWindow($runtime.tradeActiveKind());
    trade.notice='Proposta modificata.';
    $runtime.renderTradeWindow(trade.kind);
  }

  function tradeRosterPlayerMarkup(player,{selected=false,disabled=false,action='outgoing'}={}){
    const price=Number(player?.price||player?.quotation||0);
    return `<button type="button" class="trade-roster-row ${selected?'is-selected':''} ${disabled?'is-disabled':''}" data-trade-${$runtime.escapeHtml(action)}="${$runtime.escapeHtml(String(player.id))}" ${disabled?'disabled':''}>
      <span class="trade-roster-face">${$runtime.playerAvatarMarkup(player,player.name)}</span>
      <span class="trade-roster-copy"><strong>${$runtime.escapeHtml(player.name)}</strong><small>${$runtime.escapeHtml($runtime.clubName(player.club))}</small></span>
      <span class="trade-roster-meta"><i class="lineup-role-chip role-${player.role}">${$runtime.escapeHtml(player.role)}</i><b>OVR ${$runtime.escapeHtml($runtime.playerOvrLabel(player))}</b><em>${price} cr</em></span>
    </button>`;
  }

  function tradePlayerCardMarkup(player,{emptyText='Seleziona un giocatore dalla lista.'}={}){
    if(!player) return `<div class="trade-player-card is-empty"><div class="trade-player-empty-icon">+</div><div class="trade-player-copy"><strong>Nessun giocatore selezionato</strong><small>${$runtime.escapeHtml(emptyText)}</small></div></div>`;
    const price=Number(player?.price||player?.quotation||0);
    return `<article class="trade-player-card">
      <div class="trade-player-avatar">${$runtime.playerAvatarMarkup(player,player.name)}</div>
      <div class="trade-player-copy"><strong>${$runtime.escapeHtml(player.name)}</strong><small>${$runtime.escapeHtml($runtime.clubName(player.club))}</small></div>
      <div class="trade-player-stats"><i class="lineup-role-chip role-${player.role}">${$runtime.escapeHtml(player.role)}</i><span><small>OVR</small><b>${$runtime.escapeHtml($runtime.playerOvrLabel(player))}</b></span><span><small>Quota</small><b>${price}</b></span></div>
    </article>`;
  }

  function tradeFilteredRoster(roster,role='all',sort='ovr',compatibleRole=''){
    const price=p=>Number(p?.price||p?.quotation||0);
    const selectedRole=role==='compatible'?compatibleRole:role;
    return (roster||[]).filter(p=>!selectedRole||selectedRole==='all'||p.role===selectedRole).slice().sort((a,b)=>{
      if(sort==='price') return price(b)-price(a)||$runtime.currentPlayerOvr(b)-$runtime.currentPlayerOvr(a);
      if(sort==='price-low') return price(a)-price(b)||$runtime.currentPlayerOvr(b)-$runtime.currentPlayerOvr(a);
      if(sort==='name') return String(a.name||'').localeCompare(String(b.name||''),'it');
      return $runtime.currentPlayerOvr(b)-$runtime.currentPlayerOvr(a)||price(b)-price(a);
    });
  }

  function renderTradeRosterChoices(offer=$runtime.tradeOfferSelection()){
    const mine=$runtime.tradeFilteredRoster(offer.me?.roster,$runtime.$('tradeMyRole')?.value||'all',$runtime.$('tradeMySort')?.value||'ovr');
    const theirs=$runtime.tradeFilteredRoster(offer.rival?.roster,$runtime.$('tradeRivalRole')?.value||'compatible',$runtime.$('tradeRivalSort')?.value||'ovr',offer.outgoing?.role||'');
    if($runtime.$('tradeMyRosterCount')) $runtime.$('tradeMyRosterCount').textContent=`${mine.length} / ${(offer.me?.roster||[]).length} giocatori`;
    if($runtime.$('tradeRivalRosterCount')) $runtime.$('tradeRivalRosterCount').textContent=`${theirs.length} / ${(offer.rival?.roster||[]).length} giocatori`;
    if($runtime.$('tradeMyRosterList')) $runtime.$('tradeMyRosterList').innerHTML=mine.map(player=>$runtime.tradeRosterPlayerMarkup(player,{selected:String(player.id)===String(offer.outgoing?.id||''),disabled:!!offer.incoming&&offer.incoming.role!==player.role,action:'outgoing'})).join('')||'<p class="trade-roster-empty">Nessun giocatore per questo ruolo.</p>';
    if($runtime.$('tradeRivalRosterList')) $runtime.$('tradeRivalRosterList').innerHTML=theirs.map(player=>$runtime.tradeRosterPlayerMarkup(player,{selected:String(player.id)===String(offer.incoming?.id||''),disabled:!!offer.outgoing&&offer.outgoing.role!==player.role,action:'incoming'})).join('')||'<p class="trade-roster-empty">Nessun giocatore per questo ruolo.</p>';
  }

  function renderTradeWindow(kind){
    if(!$runtime.state?.completed || (kind==='winter' && $runtime.state.winterMarketFlow?.stage!=='trades')) return;
    const trade=$runtime.currentTradeWindow(kind);
    if(trade.stage==='completed') return kind==='winter'?$runtime.renderSeasonDashboard():$runtime.renderSummary();
    const limit=kind==='winter'?3:2,maxAttempts=limit*3;
    $runtime.showScreen('tradeWindowScreen');
    $runtime.$('tradeWindowEyebrow').textContent=kind==='winter'?'FINE ASTA DI GENNAIO · TRATTATIVE':'FINE ASTA INIZIALE · TRATTATIVE';
    $runtime.$('tradeWindowProgress').textContent=`${trade.completed} / ${limit} SCAMBI · ${trade.attempts} / ${maxAttempts} PROPOSTE`;
    const me=$runtime.managerById('user');
    const previousOutgoing=$runtime.$('tradeOutgoing').value,previousRival=$runtime.$('tradeOpponent').value,previousIncoming=$runtime.$('tradeIncoming').value;
    $runtime.$('tradeOutgoing').innerHTML=`<option value="">Seleziona un tuo giocatore</option>`+(me?.roster||[]).map(p=>`<option value="${$runtime.escapeHtml(String(p.id))}">${$runtime.escapeHtml(p.role)} · ${$runtime.escapeHtml(p.name)} · OVR ${$runtime.playerOvrLabel(p)}</option>`).join('');
    if((me?.roster||[]).some(p=>String(p.id)===previousOutgoing)) $runtime.$('tradeOutgoing').value=previousOutgoing;
    $runtime.$('tradeOpponent').innerHTML=$runtime.state.managers.filter(m=>m.id!=='user').map(m=>`<option value="${$runtime.escapeHtml(String(m.id))}">${$runtime.escapeHtml(m.team)} · ${$runtime.escapeHtml(m.name||m.profile?.label||'Rivale')}</option>`).join('');
    if($runtime.state.managers.some(m=>m.id===previousRival && m.id!=='user')) $runtime.$('tradeOpponent').value=previousRival;
    if(!$runtime.$('tradeOpponent').value && $runtime.$('tradeOpponent').options.length) $runtime.$('tradeOpponent').selectedIndex=0;
    const preIncomingOffer=$runtime.tradeOfferSelection();
    $runtime.$('tradeIncoming').innerHTML=`<option value="">Seleziona il giocatore richiesto</option>`+(preIncomingOffer.rival?.roster||[]).filter(p=>!preIncomingOffer.outgoing || p.role===preIncomingOffer.outgoing.role).map(p=>`<option value="${$runtime.escapeHtml(String(p.id))}">${$runtime.escapeHtml(p.role)} · ${$runtime.escapeHtml(p.name)} · OVR ${$runtime.playerOvrLabel(p)}</option>`).join('');
    if((preIncomingOffer.rival?.roster||[]).some(p=>String(p.id)===previousIncoming && (!preIncomingOffer.outgoing || p.role===preIncomingOffer.outgoing.role))) $runtime.$('tradeIncoming').value=previousIncoming;
    $runtime.$('tradeCredits').max=String(Math.max(0,Number(me?.budget||0)));
    if($runtime.tradeCreditsValue()>Number($runtime.$('tradeCredits').max||0)) $runtime.$('tradeCredits').value=$runtime.$('tradeCredits').max;

    const offer=$runtime.tradeOfferSelection();
    const rival=offer.rival;
    const userTheme=$runtime.seasonFixtureTheme(me,true);
    const rivalTheme=$runtime.seasonFixtureTheme(rival,false);
    $runtime.renderFixtureCoachPortrait('tradeUserAvatar', me||{id:'user',name:$runtime.state?.managerName||'Mister'}, userTheme);
    $runtime.renderFixtureCoachPortrait('tradeRivalAvatar', rival, rivalTheme);
    if($runtime.$('tradeUserTeamName')) $runtime.$('tradeUserTeamName').textContent=me?.team||$runtime.state?.teamName||'La tua squadra';
    if($runtime.$('tradeUserManagerName')) $runtime.$('tradeUserManagerName').textContent=me?.name||$runtime.state?.managerName||'Il tuo fantallenatore';
    if($runtime.$('tradeRivalManagerName')) $runtime.$('tradeRivalManagerName').textContent=rival?.name||rival?.profile?.label||'Allenatore rivale';
    if($runtime.$('tradeMyRosterTitle')) $runtime.$('tradeMyRosterTitle').textContent=`I tuoi giocatori (${me?.team||'Tu'})`;
    if($runtime.$('tradeRivalRosterTitle')) $runtime.$('tradeRivalRosterTitle').textContent=`I suoi giocatori (${rival?.team||'Rivale'})`;
    if($runtime.$('tradeBudgetHint')) $runtime.$('tradeBudgetHint').textContent=`${Number(me?.budget||0)} crediti disponibili`;
    if($runtime.$('tradeOutgoingCard')) $runtime.$('tradeOutgoingCard').innerHTML=$runtime.tradePlayerCardMarkup(offer.outgoing,{emptyText:'Scegli il giocatore che vuoi offrire.'});
    if($runtime.$('tradeIncomingCard')) $runtime.$('tradeIncomingCard').innerHTML=$runtime.tradePlayerCardMarkup(offer.incoming,{emptyText:offer.outgoing?'Scegli il giocatore avversario dello stesso ruolo.':'Seleziona prima il giocatore che vuoi offrire.'});
    $runtime.renderTradeRosterChoices(offer);

    $runtime.$('tradeResponse').textContent=trade.notice||'Scegli due giocatori per preparare lo scambio.';
    $runtime.$('tradeHistory').innerHTML=trade.history.length?`<h4>Scambi conclusi</h4><div class="trade-history-list">${trade.history.map(line=>`<p>${$runtime.escapeHtml(line)}</p>`).join('')}</div>`:'';
    const exhausted=trade.completed>=limit||trade.attempts>=maxAttempts;
    $runtime.$('tradeOfferBtn').disabled=exhausted||!$runtime.tradeOfferValid(offer);
    $runtime.$('tradeCounterBtn').classList.toggle('hidden',!trade.pending);
    $runtime.$('tradeCounterBtn').disabled=!trade.pending||Number(me?.budget||0)<Number(trade.pending?.credits||0);
    $runtime.$('tradeCounterBtn').textContent=trade.pending?`ACCETTA CONTROPROPOSTA · ${trade.pending.credits} CR`:'ACCETTA CONTROPROPOSTA';
    $runtime.$('tradeFinishBtn').textContent=kind==='winter'?'TERMINA E RIPRENDI IL CAMPIONATO':'TERMINA E VAI AL RIEPILOGO';
  }

  function submitTradeOffer(){
    const kind=$runtime.state?.winterMarketFlow?.stage==='trades'?'winter':'summer',trade=$runtime.currentTradeWindow(kind);
    const offer=$runtime.tradeOfferSelection(),limit=kind==='winter'?3:2;
    if(trade.stage!=='open'||trade.completed>=limit||trade.attempts>=limit*3||!$runtime.tradeOfferValid(offer)) return;
    const pending=trade.pending;
    const agreed=pending && pending.rivalId===offer.rival.id && pending.outgoingId===String(offer.outgoing.id) && pending.incomingId===String(offer.incoming.id) && offer.credits>=Number(pending.credits);
    trade.attempts++;
    const decision=agreed?{type:'accept',credits:offer.credits}:$runtime.tradeCpuDecision(offer,trade);
    trade.pending=null;
    if(decision.type==='accept') $runtime.completeTrade(offer,trade);
    else if(decision.type==='counter'){
      trade.pending={rivalId:offer.rival.id,outgoingId:String(offer.outgoing.id),incomingId:String(offer.incoming.id),credits:decision.credits,reason:decision.reason};
      trade.notice=`${offer.rival.team} chiede ${decision.credits} crediti per accettare lo scambio. ${decision.reason}`;
      $runtime.saveState();
    } else {trade.notice=`${offer.rival.team} rifiuta la proposta.`;$runtime.saveState();}
    $runtime.renderTradeWindow(kind);
  }

  function acceptTradeCounter(){
    const kind=$runtime.state?.winterMarketFlow?.stage==='trades'?'winter':'summer',trade=$runtime.currentTradeWindow(kind),pending=trade.pending;
    if(!pending || trade.stage!=='open') return;
    const me=$runtime.managerById('user'),rival=$runtime.managerById(pending.rivalId);
    const offer={me,rival,outgoing:me?.roster?.find(p=>String(p.id)===pending.outgoingId),incoming:rival?.roster?.find(p=>String(p.id)===pending.incomingId),credits:pending.credits};
    if(!$runtime.completeTrade(offer,trade)){trade.pending=null;trade.notice='Controproposta non più disponibile.';$runtime.saveState();}
    $runtime.renderTradeWindow(kind);
  }

  function finishTradeWindow(){
    const kind=$runtime.state?.winterMarketFlow?.stage==='trades'?'winter':'summer',trade=$runtime.currentTradeWindow(kind);
    trade.stage='completed';trade.pending=null;
    if(kind==='winter') $runtime.state.winterMarketFlow.stage='completed';
    $runtime.saveState();
    if(kind==='winter') $runtime.renderSeasonDashboard(); else $runtime.renderSummary();
  }

  function leagueRoleAverage(role) {
    if (!$runtime.state?.managers?.length) return 0;
    return $runtime.state.managers.reduce((sum,m)=>sum+$runtime.roleSpend(m,role),0) / $runtime.state.managers.length;
  }

  function calibrationStatus(actual,target) {
    const delta = actual-target;
    const abs = Math.abs(delta);
    if (abs <= 8) return {label:'IN TARGET', cls:'good'};
    if (abs <= 18) return {label:'ACCETTABILE', cls:'warn'};
    return {label: delta>0?'ALTO':'BASSO', cls:'bad'};
  }

  function compactLineupPlayerName(name) {
    const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
    return parts[0]||'—';
  }

  function bestTheoreticalLineup(manager) {
    if(!manager?.roster?.length) return null;
    let best=null;
    $runtime.availableLineupFormations().forEach(formation=>{
      const lineup=$runtime.buildAutoLineup(manager,formation);
      const starters=Object.values(lineup.starters||{}).map(id=>(manager.roster||[]).find(p=>String(p.id)===String(id))).filter(Boolean);
      const score=starters.reduce((sum,p)=>sum+$runtime.lineupPlayerValue(p),0);
      const ovr=starters.reduce((sum,p)=>sum+$runtime.currentPlayerOvr(p),0);
      const unavailable=starters.filter(p=>$runtime.playerStatusForDay(p.id,$runtime.state?.season?.currentMatchday||1).unavailable).length;
      const candidate={formation,lineup,starters,score,ovr,unavailable};
      if(!best || candidate.score>best.score || (candidate.score===best.score && candidate.ovr>best.ovr) || (candidate.score===best.score && candidate.ovr===best.ovr && formation.localeCompare(best.formation)<0)) best=candidate;
    });
    return best;
  }

  function bestXIHtml(manager) {
    const best=$runtime.bestTheoreticalLineup(manager);
    if(!best) return '<div class="best-xi-empty">Formazione non disponibile.</div>';
    const day=Number($runtime.state?.season?.currentMatchday||1);
    const playersById=new Map((manager.roster||[]).map(p=>[String(p.id),p]));
    const avg=best.starters.length ? (best.ovr/best.starters.length).toFixed(1) : '—';
    const slots=$runtime.lineupSlots(best.formation).map(slot=>{
      const p=playersById.get(String(best.lineup.starters?.[slot.instanceId]||''));
      if(!p) return '';
      const form=$runtime.playerFormMetrics(p.id);
      const status=$runtime.playerStatusForDay(p.id,day);
      const formText=$runtime.visibleFormLabel(p.id,1);
      return `<button type="button" class="best-xi-player role-${p.role} ${status.unavailable?'is-unavailable':''}" style="left:${slot.x}%;top:${slot.y}%" data-season-player="${$runtime.escapeHtml(String(p.id))}" title="${$runtime.escapeHtml(p.name)} · ${$runtime.escapeHtml($runtime.clubName(p.club))} · OVR ${$runtime.playerOvrLabel(p)}${status.unavailable?` · ${$runtime.escapeHtml(status.label||'Indisponibile')}`:''}">
        <span>${$runtime.escapeHtml(slot.key)}</span><strong>${$runtime.escapeHtml($runtime.compactLineupPlayerName(p.name))}</strong><small>OVR ${$runtime.playerOvrLabel(p)} · ${$runtime.escapeHtml(formText)}</small>
      </button>`;
    }).join('');
    return `<section class="manager-best-xi">
      <div class="best-xi-summary">
        <div><span>MODULO</span><strong>${$runtime.escapeHtml(best.formation)}</strong></div>
        <div><span>OVR XI</span><strong>${avg}</strong></div>
        <div><span>GIORNATA</span><strong>${day}</strong></div>
      </div>
      <div class="best-xi-note">Miglior XI teorico calcolato su qualità, forma e disponibilità attuale.</div>
      <div class="best-xi-pitch" aria-label="Miglior formazione di ${$runtime.escapeHtml(manager.team)}">
        <i class="best-xi-half"></i><i class="best-xi-circle"></i><i class="best-xi-box best-xi-box-top"></i><i class="best-xi-box best-xi-box-bottom"></i>
        ${slots}
      </div>
      ${best.unavailable?`<div class="best-xi-warning">⚠ ${best.unavailable} titolare${best.unavailable===1?'':'i'} attualmente indisponibile${best.unavailable===1?'':'i'}: il sistema ha scelto la miglior alternativa possibile per ruolo.</div>`:''}
    </section>`;
  }

  function wireLeagueRosterViewToggles(root) {
    if(!root) return;
    root.querySelectorAll('[data-roster-view]').forEach(btn=>btn.addEventListener('click',()=>{
      const card=btn.closest('[data-roster-manager]');
      if(!card) return;
      const target=btn.dataset.rosterView;
      card.querySelectorAll('[data-roster-view]').forEach(x=>x.classList.toggle('active',x===btn));
      card.querySelector('.manager-roster-view')?.classList.toggle('hidden',target!=='roster');
      card.querySelector('.manager-bestxi-view')?.classList.toggle('hidden',target!=='bestxi');
    }));
  }

  function buildFinalLeagueRosterCards(options={}) {
    if (!$runtime.state?.managers?.length) return '';
    const withBestXI=!!options.withBestXI;
    return $runtime.state.managers.map((m) => {
      const roleSections = $runtime.ROLE_ORDER.map(role => {
        const items = Array.isArray(m.roster) ? m.roster.filter(x => x.role === role) : [];
        const spend = items.reduce((sum,x)=>sum + Number(x.price||0),0);
        const pct = Math.round(spend / $runtime.INITIAL_BUDGET * 100);
        const rows = Array.from({length: $runtime.ROLE_LIMITS[role]}, (_,idx) => {
          const x = items[idx];
          if (!x) return `<div class="league-player-row role-player-${role} is-empty"><span>—</span><em></em><b></b></div>`;
          return `<button type="button" class="league-player-row role-player-${role} season-player-open summary-player-row" data-season-player="${$runtime.escapeHtml(String(x.id))}" title="${$runtime.escapeHtml(x.name)} · ${$runtime.escapeHtml($runtime.clubName(x.club))} · ${Number(x.price||0)} crediti">
            <span>${$runtime.escapeHtml(x.name)}</span><b>${Number(x.price||0)}</b>
          </button>`;
        }).join('');
        return `<div class="league-role-block role-block-${role}">
          <div class="league-role-strip role-strip-${role}">
            <span><strong>${role}</strong><small>${items.length}/${$runtime.ROLE_LIMITS[role]}</small></span>
            <span class="role-spend"><b>${pct}%</b><small>${spend} cr</small></span>
          </div>
          <div class="league-role-players">${rows}</div>
        </div>`;
      }).join('');

      const roster = Array.isArray(m.roster) ? m.roster : [];
      const spent = roster.reduce((sum,x)=>sum+Number(x.price||0),0);
      const progress = Math.round(roster.length / $runtime.TOTAL_SLOTS * 100);
      const avgOvr = roster.length ? (roster.reduce((s,x)=>s+Number(x.ovr||0),0)/roster.length).toFixed(1) : '—';
      const personality = m.id==='user'
        ? `${$runtime.escapeHtml($runtime.state.managerName || 'Tu')} · TU`
        : $runtime.escapeHtml(m.profile?.label || m.name || 'CPU');

      return `<div class="manager-card summary-manager-card ${m.id==='user'?'is-user':''}" data-roster-manager="${$runtime.escapeHtml(String(m.id))}">
        <div class="league-manager-head">
          <div class="manager-title-line">
            <span class="manager-online-dot"></span>
            <div class="manager-identity">
              <div class="manager-name" title="${$runtime.escapeHtml(m.team)}">${$runtime.escapeHtml(m.team)}</div>
              <div class="manager-personality">${personality}</div>
            </div>
            <span class="manager-status complete">COMPLETA</span>
          </div>
          <div class="manager-credit-line">
            <div class="credit-main"><span class="coin">●</span><strong>${Number(m.budget||0)}</strong><small>crediti</small></div>
          </div>
          <div class="manager-progress"><i style="width:${progress}%"></i></div>
          <div class="manager-substats">
            <span><strong>${spent}</strong><small>SPESA</small></span>
            <span class="slots"><strong>${roster.length}/${$runtime.TOTAL_SLOTS}</strong><small>ROSA</small></span>
            <span><strong>${avgOvr}</strong><small>OVR</small></span>
          </div>
        </div>
        ${withBestXI?`<div class="manager-roster-tabs" role="tablist" aria-label="Vista ${$runtime.escapeHtml(m.team)}">
          <button type="button" class="active" data-roster-view="roster">ROSA COMPLETA</button>
          <button type="button" data-roster-view="bestxi">MIGLIOR XI</button>
        </div>`:''}
        <div class="manager-roster-view"><div class="league-roster">${roleSections}</div></div>
        ${withBestXI?`<div class="manager-bestxi-view hidden">${$runtime.bestXIHtml(m)}</div>`:''}
      </div>`;
    }).join('');
  }

  function renderSummary(forced=false) {
    $runtime.showScreen('summaryScreen');
    $runtime.$('summaryTitle').textContent = forced ? 'Asta terminata con un controllo di sicurezza.' : 'Le 10 rose sono pronte.';
    const highest = $runtime.state.stats.highest;
    const avgSpend = $runtime.state.stats.purchases ? ($runtime.state.stats.totalSpent/$runtime.state.stats.purchases).toFixed(1) : '0';
    $runtime.$('summaryStats').innerHTML = `
      <div class="summary-stat"><strong>${$runtime.state.stats.purchases}</strong><span>acquisti</span></div>
      <div class="summary-stat"><strong>${avgSpend}</strong><span>prezzo medio</span></div>
      <div class="summary-stat"><strong>${highest?highest.price:'—'}</strong><span>acquisto più caro</span></div>
      <div class="summary-stat"><strong>${highest?$runtime.escapeHtml(highest.playerName):'—'}</strong><span>${highest?$runtime.escapeHtml(highest.team):'top acquisto'}</span></div>
      <div class="summary-stat"><strong>${$runtime.state.integrity?.repairs||0}</strong><span>correzioni integrità</span></div>`;
    const roleCards = Object.keys($runtime.ROLE_LIMITS).map(role => {
      const actual = $runtime.leagueRoleAverage(role);
      const target = $runtime.MARKET_ROLE_TARGET[role];
      const status = $runtime.calibrationStatus(actual,target);
      const diff = actual-target;
      return `<div class="calibration-role">
        <div class="calibration-role-head"><strong>${role}</strong><span class="cal-${status.cls}">${status.label}</span></div>
        <div class="calibration-values"><b>${actual.toFixed(1)}</b><span>benchmark ${target}</span></div>
        <small>${diff>=0?'+':''}${diff.toFixed(1)} crediti</small>
      </div>`;
    }).join('');
    $runtime.$('calibrationPanel').innerHTML = `<div class="calibration-title"><div><span class="muted">DIAGNOSTICA ECONOMIA</span><h3>Spesa media della lega per reparto</h3></div><div class="benchmark-chip">P30 · D60 · C120 · A290</div></div><div class="calibration-grid">${roleCards}</div><p class="calibration-copy">Non è un vincolo: le singole CPU possono sbilanciarsi molto. Serve a verificare che, nel complesso, il mercato resti dentro fasce credibili.</p>`;
    const summaryGrid = $runtime.$('summaryTeams');
    $runtime.renderSponsorSelection();
    if (summaryGrid) {
      summaryGrid.innerHTML = $runtime.buildFinalLeagueRosterCards();
      // Defensive fallback: a completed league with managers should never show an empty recap.
      if (!summaryGrid.children.length && $runtime.state?.managers?.length) {
        summaryGrid.innerHTML = $runtime.state.managers.map(m => `<div class="manager-card summary-manager-card"><div class="league-manager-head"><div class="manager-name">${$runtime.escapeHtml(m.team)}</div></div></div>`).join('');
      }
    }
  }

  function teamPreviewScore(m) {
    if (!m.roster.length) return 0;
    const values = m.roster.map(x=>$runtime.baseAuctionValue(x));
    const quality = values.reduce((a,b)=>a+b,0) / Math.max(1,values.length);
    const ovr = m.roster.reduce((s,x)=>s+Number(x.ovr||0),0)/m.roster.length;
    return Math.round((quality*.42 + ovr*.58)*10)/10;
  }
    return Object.freeze({currentTradeWindow,tradeOfferSelection,tradeOfferValid,tradeAvailabilityFactor,tradeLineupStrength,tradePlayerWorth,tradeCpuDecision,completeTrade,tradeActiveKind,tradeCreditsValue,tradeSetSelection,adjustTradeCredits,tradeRosterPlayerMarkup,tradePlayerCardMarkup,tradeFilteredRoster,renderTradeRosterChoices,renderTradeWindow,submitTradeOffer,acceptTradeCounter,finishTradeWindow,leagueRoleAverage,calibrationStatus,compactLineupPlayerName,bestTheoreticalLineup,bestXIHtml,wireLeagueRosterViewToggles,buildFinalLeagueRosterCards,renderSummary,teamPreviewScore});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['trade-roster-controller']=Object.freeze({create});
})();
