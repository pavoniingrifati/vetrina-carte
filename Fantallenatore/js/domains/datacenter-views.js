/* Responsibility: datacenter-views. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: datacenter-views');
  function evolutionPlayerData(player,season=$runtime.ensureSeasonState()){
    if(!player||!season) return null;
    const base=Number(player.ovr||player.overall||0);
    const development=season.playerOvrDevelopment?.[String(player.id)]||{delta:0,lastDay:0,history:[]};
    const current=$runtime.currentPlayerOvr(player);
    const delta=current-base;
    const history=Array.isArray(development.history)?development.history:[];
    const last=history.length?history[history.length-1]:null;
    const owner=$runtime.seasonPlayerOwner(player.id);
    const potential=$runtime.auctionObserverActive()?$runtime.playerSeasonPotentialProfile(player):null;
    return {player,base,current,delta,history,last,owner,potential};
  }

  function evolutionPotentialClass(potential){
    if(!potential) return '';
    return ({elite:'elite',high:'high',normal:'normal',low:'low',collapse:'collapse'})[potential.tier]||'normal';
  }

  function evolutionHighlightHtml(item){
    if(!item) return '';
    const direction=item.delta>0?'positive':item.delta<0?'negative':'neutral';
    const lastReason=item.last?`G${item.last.day} · ${item.last.reason}`:'Nessuna variazione registrata';
    const mine=item.owner?.manager?.id==='user';
    const potential=item.potential?`<span class="evolution-potential ${$runtime.evolutionPotentialClass(item.potential)}">POT. ${$runtime.escapeHtml(item.potential.label)}</span>`:'';
    return `<button type="button" class="evolution-highlight-item ${direction}" data-season-player="${$runtime.escapeHtml(item.player.id)}">
      <div class="evolution-highlight-rank">${direction==='positive'?'▲':'▼'}</div>
      <div class="evolution-highlight-copy"><strong>${$runtime.escapeHtml(item.player.name)}</strong><span>${$runtime.escapeHtml($runtime.clubName(item.player.club))} · ${$runtime.escapeHtml(item.player.role)}${mine?' · TUA ROSA':''}</span><small>${$runtime.escapeHtml(lastReason)}</small>${potential}</div>
      <div class="evolution-ovr-mini"><span>${item.base}</span><i>→</i><strong>${item.current}</strong><em class="${direction}">${item.delta>0?'+':''}${item.delta}</em></div>
    </button>`;
  }

  function evolutionPlayerRowHtml(item){
    const mine=item.owner?.manager?.id==='user';
    const ownerLabel=mine?'TUA ROSA':item.owner?.manager?.team?item.owner.manager.team:'SVINCOLATO';
    const direction=item.delta>0?'positive':item.delta<0?'negative':'neutral';
    const recent=item.history.slice(-2).reverse();
    const reasons=recent.length
      ? recent.map(ev=>`<span><b>G${ev.day}</b> ${$runtime.escapeHtml(ev.reason)}</span>`).join('')
      : '<span class="is-empty">Nessuna variazione OVR finora.</span>';
    const potential=item.potential?`<span class="evolution-potential ${$runtime.evolutionPotentialClass(item.potential)}">OSSERVATORE · ${$runtime.escapeHtml(item.potential.label)}</span>`:'';
    return `<button type="button" class="evolution-player-row ${direction} ${mine?'is-mine':''}" data-season-player="${$runtime.escapeHtml(item.player.id)}">
      <div class="evolution-player-main">
        <span class="evolution-role role-${$runtime.escapeHtml(String(item.player.role||'').toLowerCase())}">${$runtime.escapeHtml(item.player.role||'')}</span>
        <div><strong>${$runtime.escapeHtml(item.player.name)}</strong><small>${$runtime.escapeHtml($runtime.clubName(item.player.club))} · ${$runtime.escapeHtml(ownerLabel)}</small>${potential}</div>
      </div>
      <div class="evolution-ovr-flow"><span><small>INIZIO</small><b>${item.base}</b></span><i>→</i><span><small>ORA</small><strong>${item.current}</strong></span><em class="${direction}">${item.delta>0?'+':''}${item.delta}</em></div>
      <div class="evolution-reasons">${reasons}</div>
      <div class="evolution-last-day"><span>ULTIMO MOVIMENTO</span><strong>${item.last?`G${item.last.day}`:'—'}</strong><small>${item.history.length} ${item.history.length===1?'variazione':'variazioni'}</small></div>
    </button>`;
  }

  function dataCenterContext(){
    const season=$runtime.ensureSeasonState(),me=$runtime.managerById('user');
    if(!season || !me) return null;
    const day=Number(season.currentMatchday||1);
    const dataPro=$runtime.shopItemActive('fantadata_pro',season);
    const scoutPlus=$runtime.shopItemActive('scout_plus',season);
    const assistant=$runtime.shopItemActive('assistant_coach',season);
    const roster=(me.roster||[]).slice();
    const available=roster.filter(p=>!$runtime.playerStatusForDay(p.id,day).unavailable);
    const unavailable=roster.filter(p=>$runtime.playerStatusForDay(p.id,day).unavailable);
    const avgOvr=roster.length?roster.reduce((sum,p)=>sum+$runtime.currentPlayerOvr(p),0)/roster.length:0;
    const totals=roster.reduce((acc,p)=>{
      const st=$runtime.playerSeasonStat(p.id)||$runtime.emptyPlayerSeasonStat(p);
      acc.goals+=Number(st.goals||0); acc.assists+=Number(st.assists||0);
      acc.minutes+=Number(st.minutes||0); acc.apps+=Number(st.appearances||0);
      return acc;
    },{goals:0,assists:0,minutes:0,apps:0});
    let assistantFormation=null,assistantXI=new Set();
    if(assistant){
      assistantFormation=$runtime.bestAdvancedFormation(me);
      const built=$runtime.buildAdvancedAutoLineup(me,assistantFormation);
      assistantXI=new Set(Object.values(built.starters||{}).map(String));
    }
    return {season,me,day,dataPro,scoutPlus,assistant,roster,available,unavailable,avgOvr,totals,assistantFormation,assistantXI};
  }

  function dataCenterPremiumHtml(ctx){
    const {season,me,day,dataPro,scoutPlus,assistant,roster,available,assistantFormation,assistantXI}=ctx;
    let scoutSummary='';
    if(scoutPlus){
      const probs=available.map(p=>({p,pct:$runtime.estimatedStarterProbability(p)}));
      const safe=probs.filter(x=>x.pct>=70).length;
      const risk=probs.filter(x=>x.pct<40).length;
      const best=probs.slice().sort((a,b)=>b.pct-a.pct)[0];
      scoutSummary=`<div class="mc-premium active"><div class="mc-premium-head"><div><span>🎯 SCOUT PLUS</span><h3>Titolarità della tua rosa</h3></div><b>ATTIVO</b></div><div class="dc-premium-kpis"><div><strong>${safe}</strong><span>≥70%</span></div><div><strong>${risk}</strong><span>&lt;40%</span></div><div><strong>${best?`${best.pct}%`:'—'}</strong><span>STIMA PIÙ ALTA</span></div></div></div>`;
    }else{
      scoutSummary=`<div class="mc-premium locked"><div class="mc-premium-head"><div><span>🎯 SCOUT PLUS</span><h3>Titolarità stimata</h3></div><b>🔒 NON ATTIVO</b></div><p>Sblocca la probabilità stimata di titolarità per ogni giocatore della tua rosa.</p></div>`;
    }
    let dataSummary='';
    if(dataPro){
      const withVotes=roster.map(p=>{const st=$runtime.playerSeasonStat(p.id)||$runtime.emptyPlayerSeasonStat(p);return {p,st,fm:st.voteCount?Number(st.fantasySum||0)/Number(st.voteCount):null,mv:st.voteCount?Number(st.voteSum||0)/Number(st.voteCount):null,form:$runtime.playerFormMetrics(p.id)}}).filter(x=>x.fm!==null);
      const bestFm=withVotes.slice().sort((a,b)=>b.fm-a.fm)[0];
      const hot=withVotes.slice().sort((a,b)=>b.form.score-a.form.score)[0];
      const teamFm=withVotes.length?withVotes.reduce((s,x)=>s+x.fm,0)/withVotes.length:null;
      const favorableCount=roster.filter(p=>$runtime.serieAMatchupDifficulty(p,day)?.key==='favorable').length;
      dataSummary=`<div class="mc-premium active"><div class="mc-premium-head"><div><span>📊 FANTADATA PRO</span><h3>Rendimento + calendario Serie A</h3></div><b>ATTIVO</b></div><div class="dc-premium-kpis"><div><strong>${teamFm===null?'—':teamFm.toFixed(2)}</strong><span>FM MEDIA</span></div><div><strong>${bestFm?$runtime.escapeHtml(bestFm.p.name):'—'}</strong><span>MIGLIOR FM</span></div><div><strong>${hot?$runtime.escapeHtml(hot.p.name):'—'}</strong><span>PIÙ IN FORMA</span></div><div><strong>${favorableCount}</strong><span>MATCH FAVOREVOLI</span></div></div></div>`;
    }else{
      dataSummary=`<div class="mc-premium locked"><div class="mc-premium-head"><div><span>📊 FANTADATA PRO</span><h3>Rendimento dettagliato</h3></div><b>🔒 NON ATTIVO</b></div><p>Sblocca media voto, fantamedia, forma numerica, ultime 5 prestazioni e difficoltà dell’avversario Serie A.</p></div>`;
    }
    const assistantSummary=assistant
      ? `<div class="mc-premium assistant active"><div class="mc-premium-head"><div><span>🧠 ASSISTENTE TECNICO</span><h3>Selezione automatica</h3></div><b>ATTIVO</b></div><div class="mc-assistant-advice"><strong>Modulo AUTO XI suggerito: ${assistantFormation}</strong><p>${$runtime.assistantAutoLineupAnalysisHtml(season)}</p><span>I giocatori marcati <b>AUTO XI</b> sono quelli che l'Assistente schiererebbe oggi.</span><button id="dataCenterOpenLineup" class="primary">VAI A SCHIERA FORMAZIONE →</button></div></div>`
      : `<div class="mc-premium assistant locked"><div class="mc-premium-head"><div><span>🧠 ASSISTENTE TECNICO</span><h3>AUTO XI e gestione formazione</h3></div><b>🔒 NON ATTIVO</b></div><p>Sblocca il modulo consigliato e l'indicazione dei giocatori che AUTO XI schiererebbe, usando solo i dati degli abbonamenti che possiedi.</p></div>`;
    return {scoutSummary,dataSummary,assistantSummary};
  }

  function renderDataCenterOverviewPanel(ctx=$runtime.dataCenterContext()){
    const body=$runtime.$('datacenterOverviewBody');
    if(!body || !ctx) return;
    const {day,roster,available,unavailable,avgOvr,totals}=ctx;
    const {scoutSummary,dataSummary,assistantSummary}=$runtime.dataCenterPremiumHtml(ctx);
    const moved=roster.map(p=>$runtime.evolutionPlayerData(p,ctx.season)).filter(x=>x&&x.delta!==0);
    const growing=moved.filter(x=>x.delta>0).length;
    const falling=moved.filter(x=>x.delta<0).length;
    body.innerHTML=`
      <section class="mc-hero dc-hero">
        <div class="mc-opponent-identity dc-team-identity"><span class="fixture-tag">LA TUA ROSA</span><h3>${$runtime.escapeHtml($runtime.state.teamName||ctx.me.team)}</h3><p>Dati aggiornati alla giornata ${day}</p></div>
        <div class="mc-kpis dc-kpis"><div><strong>${roster.length}</strong><span>GIOCATORI</span></div><div><strong>${available.length}</strong><span>DISPONIBILI</span></div><div><strong>${unavailable.length}</strong><span>OUT</span></div><div><strong>${avgOvr.toFixed(1)}</strong><span>OVR MEDIO</span></div></div>
      </section>
      <section class="dc-overview-grid">
        <article class="mc-card dc-free-summary"><div class="mc-card-head"><span>DATI BASE · GRATUITI</span><strong>Produzione stagionale della rosa</strong></div><div class="dc-free-kpis"><div><b>${totals.goals}</b><small>GOL ROSA</small></div><div><b>${totals.assists}</b><small>ASSIST ROSA</small></div><div><b>${totals.apps}</b><small>PRESENZE TOTALI</small></div><div><b>${totals.minutes}</b><small>MINUTI TOTALI</small></div></div></article>
        <article class="mc-card dc-evolution-summary"><div class="mc-card-head"><span>EVOLUZIONE ROSA</span><strong>OVR rispetto all'inizio stagione</strong></div><div class="dc-free-kpis"><div><b>${moved.length}</b><small>HANNO CAMBIATO OVR</small></div><div><b class="positive">${growing}</b><small>IN CRESCITA</small></div><div><b class="negative">${falling}</b><small>IN CALO</small></div><div><b>${roster.length-moved.length}</b><small>STABILI</small></div></div></article>
      </section>
      <section class="mc-grid two dc-premium-grid">${scoutSummary}${dataSummary}</section>
      ${assistantSummary}`;
    body.querySelector('#dataCenterOpenLineup')?.addEventListener('click',()=>$runtime.requestOpenLineup());
  }

  function dataCenterPlayerRowHtml(p,ctx){
    const {day,dataPro,scoutPlus,assistant,assistantXI}=ctx;
    const st=$runtime.playerSeasonStat(p.id)||$runtime.emptyPlayerSeasonStat(p);
    const status=$runtime.playerStatusForDay(p.id,day);
    const form=$runtime.playerFormMetrics(p.id);
    const mv=Number(st.voteCount||0)>0?Number(st.voteSum||0)/Number(st.voteCount):null;
    const fm=Number(st.voteCount||0)>0?Number(st.fantasySum||0)/Number(st.voteCount):null;
    const pct=scoutPlus?$runtime.estimatedStarterProbability(p):null;
    const pctClass=pct===null?'':pct>=70?'high':pct>=40?'medium':'low';
    const serieAFixture=$runtime.serieAFixtureForPlayer(p,day);
    const serieADifficulty=dataPro?$runtime.serieAMatchupDifficulty(p,day):null;
    const recent=dataPro&&form.recent.length?form.recent.map(x=>`<span title="G${Number(x.day||0)} · FV ${Number(x.fantasy||0).toFixed(1)}">${Number(x.vote).toFixed(1)}</span>`).join(''):'';
    const assistantLabel=assistant?(assistantXI.has(String(p.id))?'<b class="dc-auto-xi starter">✓ AUTO XI</b>':'<b class="dc-auto-xi bench">PANCHINA</b>'):'<span class="dc-locked">🔒 Assistente</span>';
    const evo=$runtime.evolutionPlayerData(p,ctx.season);
    const evoDir=evo.delta>0?'positive':evo.delta<0?'negative':'neutral';
    return `<button type="button" class="dc-player-row dc-player-row-evolution ${status.unavailable?'is-unavailable':''}" data-season-player="${$runtime.escapeHtml(p.id)}">
      <span class="lineup-role-chip role-${$runtime.escapeHtml(p.role)}">${$runtime.escapeHtml(p.role)}</span>
      <span class="dc-player-name"><strong>${$runtime.escapeHtml(p.name)}</strong><small>${$runtime.escapeHtml(p.club||'')} · OVR ${$runtime.playerOvrLabel(p)}</small><em class="dc-seriea-fixture">${serieAFixture?`vs ${$runtime.escapeHtml(serieAFixture.opponentName)} · ${serieAFixture.home?'Casa':'Trasferta'}`:'Serie A · —'}</em></span>
      <span class="dc-status ${status.className}"><b>${status.unavailable?'OUT':'OK'}</b><small>${$runtime.escapeHtml(status.unavailable?status.label:'Disponibile')}</small></span>
      <span class="dc-base-stats"><b>P ${Number(st.appearances||0)} · T ${Number(st.starts||0)}</b><small>${Number(st.minutes||0)} min · ⚽ ${Number(st.goals||0)} · 🅰 ${Number(st.assists||0)}</small></span>
      <span class="dc-evolution-cell ${evoDir}"><small>EVOLUZIONE</small><b>${evo.base} → ${evo.current}</b><em>${evo.delta>0?'+':''}${evo.delta}</em></span>
      <span class="dc-scout-cell ${scoutPlus?pctClass:'locked'}">${scoutPlus?`<b>${pct}%</b><small>Titolarità stimata</small>`:'<b>🔒</b><small>Scout Plus</small>'}</span>
      <span class="dc-data-cell ${dataPro?'active':'locked'}">${dataPro?`<b>MV ${mv===null?'—':mv.toFixed(2)} · FM ${fm===null?'—':fm.toFixed(2)}</b><small>${form.count?`${form.arrow} forma ${form.avg.toFixed(2)}`:'Forma N/D'}</small>${serieADifficulty?$runtime.serieAMatchupBadgeHtml(p,day):''}${recent?`<em class="dc-recent">${recent}</em>`:''}`:`<b>${$runtime.escapeHtml($runtime.qualitativeFormLabel(form))}</b><small>🔒 numeri + difficoltà partita FantaData</small>`}</span>
      <span class="dc-assistant-cell">${assistantLabel}</span>
      <span class="dc-row-arrow">→</span>
    </button>`;
  }

  function renderDataCenterPlayersPanel(ctx=$runtime.dataCenterContext()){
    const body=$runtime.$('datacenterPlayersBody');
    if(!body || !ctx) return;
    const roleOrder={P:0,D:1,C:2,A:3};
    const rows=ctx.roster.slice().sort((a,b)=>{
      const ar=roleOrder[a.role]??9,br=roleOrder[b.role]??9;
      if(ar!==br) return ar-br;
      return $runtime.currentPlayerOvr(b)-$runtime.currentPlayerOvr(a) || String(a.name).localeCompare(String(b.name),'it');
    });
    body.innerHTML=`<section class="mc-card dc-roster-card dc-embedded-roster"><div class="mc-card-head"><div><span>GIOCATORI</span><strong>Rendimento, disponibilità ed evoluzione in una sola vista</strong></div><small>Clicca un giocatore per la scheda completa</small></div><div class="dc-column-legend dc-column-legend-evolution"><span>BASE</span><span>EVOLUZIONE</span><span>SCOUT PLUS</span><span>FANTADATA</span><span>ASSISTENTE</span></div><div class="dc-player-list">${rows.map(p=>$runtime.dataCenterPlayerRowHtml(p,ctx)).join('')}</div></section>`;
    $runtime.wireSeasonPlayerButtons(body);
  }

  function renderDataCenterEvolutionPanel(){
    const season=$runtime.ensureSeasonState();
    if(!season) return;
    const all=(window.FANTA_PLAYERS||[]).map(p=>$runtime.evolutionPlayerData(p,season)).filter(Boolean);
    const changed=all.filter(x=>x.history.length>0);
    const rising=all.filter(x=>x.delta>0).sort((a,b)=>b.delta-a.delta || Number(b.last?.day||0)-Number(a.last?.day||0));
    const falling=all.filter(x=>x.delta<0).sort((a,b)=>a.delta-b.delta || Number(b.last?.day||0)-Number(a.last?.day||0));
    const myRoster=all.filter(x=>x.owner?.manager?.id==='user');
    const myMoved=myRoster.filter(x=>x.history.length>0);
    const metaTotal=Object.values(season.ovrEvolutionMeta||{}).reduce((sum,m)=>sum+Number(m?.actual||0),0);
    const totalEvents=metaTotal || Number(season.playerDevelopmentEvents?.length||0);
    if($runtime.$('evolutionTotalEvents')) $runtime.$('evolutionTotalEvents').textContent=String(totalEvents);
    if($runtime.$('evolutionGrowingCount')) $runtime.$('evolutionGrowingCount').textContent=String(rising.length);
    if($runtime.$('evolutionFallingCount')) $runtime.$('evolutionFallingCount').textContent=String(falling.length);
    if($runtime.$('evolutionMyMovedCount')) $runtime.$('evolutionMyMovedCount').textContent=String(myMoved.length);
    const emptyHighlight='<div class="evolution-empty-mini">Nessun movimento ancora. Le variazioni appariranno dopo le prime giornate.</div>';
    if($runtime.$('evolutionRisers')) $runtime.$('evolutionRisers').innerHTML=rising.length?rising.slice(0,4).map($runtime.evolutionHighlightHtml).join(''):emptyHighlight;
    if($runtime.$('evolutionFallers')) $runtime.$('evolutionFallers').innerHTML=falling.length?falling.slice(0,4).map($runtime.evolutionHighlightHtml).join(''):emptyHighlight;
    const filterButtons=document.querySelectorAll('#datacenterEvolutionPanel [data-evolution-filter]');
    filterButtons.forEach(btn=>btn.classList.toggle('active',btn.dataset.evolutionFilter===$runtime.evolutionFilter));
    let visible=[];
    if($runtime.evolutionFilter==='mine') visible=myRoster.slice().sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta) || Number(b.last?.day||0)-Number(a.last?.day||0) || b.current-a.current);
    else if($runtime.evolutionFilter==='rising') visible=rising.slice();
    else if($runtime.evolutionFilter==='falling') visible=falling.slice();
    else if($runtime.evolutionFilter==='all') visible=all.slice().sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta) || b.current-a.current);
    else visible=changed.slice().sort((a,b)=>Number(b.last?.day||0)-Number(a.last?.day||0) || Math.abs(b.delta)-Math.abs(a.delta));
    const subtitles={movers:`${visible.length} giocatori hanno già registrato almeno una variazione OVR.`,mine:`La tua rosa: ${myMoved.length} su ${myRoster.length} giocatori hanno già cambiato OVR.`,rising:`${visible.length} giocatori sono sopra il loro OVR iniziale.`,falling:`${visible.length} giocatori sono sotto il loro OVR iniziale.`,all:`Tutti i ${visible.length} giocatori della Serie A virtuale.`};
    if($runtime.$('evolutionListSubtitle')) $runtime.$('evolutionListSubtitle').textContent=subtitles[$runtime.evolutionFilter]||subtitles.movers;
    const list=$runtime.$('evolutionPlayersList');
    if(list){
      list.innerHTML=visible.length?visible.map($runtime.evolutionPlayerRowHtml).join(''):`<div class="evolution-empty-state"><strong>Nessun giocatore in questa categoria.</strong><span>Continua la stagione: crescita, cali, allenamenti e rendimento alimenteranno questa schermata.</span></div>`;
      $runtime.wireSeasonPlayerButtons(list);
    }
    $runtime.wireSeasonPlayerButtons($runtime.$('evolutionRisers'));
    $runtime.wireSeasonPlayerButtons($runtime.$('evolutionFallers'));
    filterButtons.forEach(btn=>{btn.onclick=()=>{$runtime.evolutionFilter=btn.dataset.evolutionFilter||'movers';$runtime.renderDataCenterEvolutionPanel();};});
  }

  function setDataCenterTab(tab){
    if(!['overview','players','evolution'].includes(tab)) tab='overview';
    $runtime.dataCenterTab=tab;
    document.querySelectorAll('#leagueDataCenterScreen [data-datacenter-tab]').forEach(btn=>{
      const active=btn.dataset.datacenterTab===tab;
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-selected',String(active));
    });
    document.querySelectorAll('#leagueDataCenterScreen [data-datacenter-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.datacenterPanel===tab));
    const ctx=$runtime.dataCenterContext();
    if(tab==='overview') $runtime.renderDataCenterOverviewPanel(ctx);
    else if(tab==='players') $runtime.renderDataCenterPlayersPanel(ctx);
    else $runtime.renderDataCenterEvolutionPanel();
  }

  function renderLeagueDataCenterScreen(tab=$runtime.dataCenterTab){
    $runtime.stopHubNewsCarousel();
    if(!$runtime.ensureSeasonState()) return $runtime.renderSummary();
    $runtime.showScreen('leagueDataCenterScreen');
    $runtime.renderLeagueNavActive('datacenter');
    $runtime.renderCareerWallets();
    $runtime.setDataCenterTab(tab);
  }

  function renderLeagueEvolutionScreen(){
    $runtime.renderLeagueDataCenterScreen('evolution');
  }
    return Object.freeze({evolutionPlayerData,evolutionPotentialClass,evolutionHighlightHtml,evolutionPlayerRowHtml,dataCenterContext,dataCenterPremiumHtml,renderDataCenterOverviewPanel,dataCenterPlayerRowHtml,renderDataCenterPlayersPanel,renderDataCenterEvolutionPanel,setDataCenterTab,renderLeagueDataCenterScreen,renderLeagueEvolutionScreen});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['datacenter-views']=Object.freeze({create});
})();
