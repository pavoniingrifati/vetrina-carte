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
      <div class="evolution-highlight-copy"><div class="evolution-highlight-name"><span class="evolution-avatar">${$runtime.playerAvatarMarkup(item.player,item.player.name)}</span><strong>${$runtime.escapeHtml(item.player.name)}</strong></div><span>${$runtime.escapeHtml($runtime.clubName(item.player.club))} · ${$runtime.escapeHtml(item.player.role)}${mine?' · TUA ROSA':''}</span><small>${$runtime.escapeHtml(lastReason)}</small>${potential}</div>
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
        <span class="evolution-avatar">${$runtime.playerAvatarMarkup(item.player,item.player.name)}</span>
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
    const {scoutSummary,assistantSummary}=$runtime.dataCenterPremiumHtml(ctx);
    body.innerHTML=window.FantaDataOverview.render({ctx,managers:$runtime.state.managers,
      statFor:id=>$runtime.playerSeasonStat(id),avatar:(p,name)=>$runtime.playerAvatarMarkup(p,name),escape:$runtime.escapeHtml})+
      `<section class="dcv-services">${scoutSummary}</section>${assistantSummary}`;
    $runtime.wireSeasonPlayerButtons(body);
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

  const playersTableState={sort:'role',direction:1,query:'',role:''};
  function renderDataCenterPlayersPanel(ctx=$runtime.dataCenterContext()){
    const body=$runtime.$('datacenterPlayersBody');
    if(!body || !ctx) return;
    const columns=[['name','Giocatore'],['club','Squadra'],['price','Costo'],['ovr','OVR'],['appearances','Presenze'],['goals','Gol'],['assists','Assist'],['mv','MV'],['fm','Fantamedia'],['starter','Titolarità']];
    const roleOrder={P:0,D:1,C:2,A:3};
    const rows=ctx.roster.map(p=>{
      const st=$runtime.playerSeasonStat(p.id)||$runtime.emptyPlayerSeasonStat(p);
      const votes=Number(st.voteCount||0);
      return {p,name:p.name,club:p.club||'',role:roleOrder[p.role]??9,price:Number(p.price||0),ovr:$runtime.currentPlayerOvr(p),appearances:Number(st.appearances||0),goals:Number(st.goals||0),assists:Number(st.assists||0),mv:ctx.dataPro&&votes?Number(st.voteSum||0)/votes:null,fm:ctx.dataPro&&votes?Number(st.fantasySum||0)/votes:null,starter:ctx.scoutPlus?$runtime.estimatedStarterProbability(p):null};
    }).filter(x=>(!playersTableState.role||x.p.role===playersTableState.role)&&(`${x.name} ${x.club}`.toLocaleLowerCase('it').includes(playersTableState.query.toLocaleLowerCase('it'))));
    rows.sort((a,b)=>{
      const key=playersTableState.sort,av=a[key],bv=b[key];
      if(av===null&&bv!==null)return 1;if(bv===null&&av!==null)return -1;
      const diff=typeof av==='string'?av.localeCompare(bv,'it'):Number(av)-Number(bv);
      return diff*playersTableState.direction||a.name.localeCompare(b.name,'it');
    });
    const esc=$runtime.escapeHtml;
    const locked=key=>(['mv','fm'].includes(key)&&!ctx.dataPro)||(key==='starter'&&!ctx.scoutPlus);
    const cell=(x,key)=>{
      if(locked(key))return `<span class="dct-lock" title="Manca ${key==='starter'?'Scout Plus':'FantaData Pro'}">🔒</span>`;
      if(x[key]===null)return '—';
      if(key==='mv'||key==='fm')return x[key].toFixed(2);
      if(key==='starter')return `${x[key]}%`;
      return esc(String(x[key]));
    };
    body.innerHTML=`<section class="mc-card dct-card"><div class="mc-card-head"><div><span>LA TUA ROSA</span><strong>Tutti i tuoi giocatori a confronto</strong></div><small>Tocca il nome per aprire la scheda</small></div><div class="dct-toolbar"><label>Cerca giocatore<input type="search" data-dct-search placeholder="Nome o squadra" value="${esc(playersTableState.query)}"></label><div class="dct-roles" aria-label="Filtra per ruolo">${['','P','D','C','A'].map(role=>`<button type="button" data-dct-role="${role}" aria-pressed="${playersTableState.role===role}">${role||'Tutti'}</button>`).join('')}</div></div>${!ctx.dataPro||!ctx.scoutPlus?`<p class="dct-access">${!ctx.dataPro?'🔒 MV e fantamedia: manca FantaData Pro. ':''}${!ctx.scoutPlus?'🔒 Titolarità: manca Scout Plus.':''}</p>`:''}<div class="dct-scroll" tabindex="0" role="region" aria-label="Statistiche della tua rosa, tabella scorrevole"><table class="dct-table"><thead><tr>${columns.map(([key,label])=>`<th scope="col" aria-sort="${playersTableState.sort===key?(playersTableState.direction===1?'ascending':'descending'):'none'}"><button type="button" data-dct-sort="${key}" ${locked(key)?'disabled':''}>${label} ${locked(key)?'🔒':playersTableState.sort===key?(playersTableState.direction===1?'↑':'↓'):'↕'}</button></th>`).join('')}</tr></thead><tbody>${rows.map(x=>`<tr><th scope="row"><button type="button" class="dct-player" data-season-player="${esc(x.p.id)}">${$runtime.playerAvatarMarkup(x.p,x.name)}<span><strong>${esc(x.name)}</strong><small><span class="dct-role role-${esc(x.p.role)}">${esc(x.p.role)}</span></small></span></button></th>${columns.slice(1).map(([key])=>`<td class="dct-${key}">${cell(x,key)}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="10" class="dct-empty">Nessun giocatore trovato.</td></tr>'}</tbody></table></div><small class="dct-hint">Scorri orizzontalmente per vedere tutte le statistiche.</small></section>`;
    $runtime.wireSeasonPlayerButtons(body);
    body.querySelectorAll('[data-dct-sort]').forEach(btn=>btn.addEventListener('click',()=>{
      const key=btn.dataset.dctSort;if(locked(key))return;
      playersTableState.direction=playersTableState.sort===key?-playersTableState.direction:(['name','club'].includes(key)?1:-1);
      playersTableState.sort=key;renderDataCenterPlayersPanel(ctx);
    }));
    body.querySelectorAll('[data-dct-role]').forEach(btn=>btn.addEventListener('click',()=>{playersTableState.role=btn.dataset.dctRole;renderDataCenterPlayersPanel(ctx);}));
    body.querySelector('[data-dct-search]')?.addEventListener('input',event=>{
      const position=event.target.selectionStart;playersTableState.query=event.target.value;renderDataCenterPlayersPanel(ctx);
      const input=body.querySelector('[data-dct-search]');input?.focus();if(input&&position!==null)input.setSelectionRange(position,position);
    });
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
