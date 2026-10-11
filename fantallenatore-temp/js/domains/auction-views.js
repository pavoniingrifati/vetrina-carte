/* Responsibility: auction-views. Only external collaborators use live runtime accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: auction-views');
  function renderAll() {
    if (!$runtime.state) return;
    $runtime.renderVisibleRivals();
    renderRoster();
    renderManagers();
    renderPhaseBanner();
    renderTurn();
    if ($runtime.state.auction) renderAuction();
  }

  function renderPhaseBanner() {
    const el = $runtime.$('phaseBanner');
    if (!el || !$runtime.state || $runtime.state.completed) return;
    if($runtime.openRoleAuction()){
      const bought=$runtime.state.managers.reduce((sum,manager)=>sum+manager.roster.length,0);
      el.innerHTML=`<div><span>REGOLA ADMIN</span><strong>ASTA SENZA REPARTI</strong></div><small>${bought}/${$runtime.TOTAL_SLOTS*$runtime.state.managers.length} posti occupati · chiama qualsiasi ruolo, rispettando i limiti della rosa</small>`;
      return;
    }
    const role = $runtime.currentAuctionRole();
    const idx = Math.min(Number($runtime.state.currentRoleIndex||0), $runtime.ROLE_ORDER.length-1);
    const totalBought = $runtime.state.managers.reduce((sum,m)=>sum+$runtime.roleCount(m,role),0);
    const totalNeeded = $runtime.ROLE_LIMITS[role] * $runtime.state.managers.length;
    el.innerHTML = `<div><span>FASE ${idx+1}/4</span><strong>${$runtime.ROLE_LABELS[role].toUpperCase()}</strong></div><small>${totalBought}/${totalNeeded} ${$runtime.ROLE_PLURALS[role].toLowerCase()} acquistati · si passa al reparto successivo solo quando tutte le rose hanno completato questo ruolo</small>`;
  }

  function renderRoster() {
    const me = $runtime.state.managers[0];
    window.FantaPresentationState?.publishAuction($runtime.state,{totalSlots:$runtime.TOTAL_SLOTS,roleLimits:$runtime.ROLE_LIMITS});
    $runtime.$('myTeamName').textContent = me.team;
    $runtime.$('myBudget').textContent = me.budget;
    $runtime.$('mySlots').textContent = `${me.roster.length} / ${$runtime.TOTAL_SLOTS}`;
    $runtime.$('roleNeed').textContent = `P ${$runtime.roleCount(me,'P')}/3 · D ${$runtime.roleCount(me,'D')}/8 · C ${$runtime.roleCount(me,'C')}/8 · A ${$runtime.roleCount(me,'A')}/6`;
    $runtime.$('myRoster').innerHTML = Object.keys($runtime.ROLE_LIMITS).map(role => {
      const items = me.roster.filter(x => x.role === role);
      const empties = Math.max(0, $runtime.ROLE_LIMITS[role]-items.length);
      return `<div class="roster-role">
        <div class="roster-role-head"><strong>${$runtime.ROLE_LABELS[role]}</strong><span>${items.length}/${$runtime.ROLE_LIMITS[role]}</span></div>
        ${items.map(x=>`<div class="roster-item"><strong>${$runtime.escapeHtml(x.name)}</strong><span class="paid">${x.price}</span></div>`).join('')}
        ${Array.from({length:Math.min(empties, role==='P'?3:2)},()=>'<div class="empty-slot"></div>').join('')}
      </div>`;
    }).join('');
  }

  function managerLiveAuctionBadges(manager, role=$runtime.currentAuctionRole()){
    if(!manager || manager.id==='user' || $runtime.state?.completed) return '';
    const badges=[];
    const urgency=$runtime.cpuRoleUrgencyState(manager,role);
    if(urgency.active) badges.push('<span class="manager-live-badge urgency" title="Ha ancora diversi slot da riempire e poche opzioni valide: tenderà a essere più aggressivo.">URGENZA</span>');
    if($runtime.isHotRival(manager)) badges.push('<span class="manager-live-badge hot" title="Avete accumulato diversi duelli prolungati: tenderà a sfidarti più spesso.">RIVALE CALDO</span>');
    else if($runtime.hasGoodRelations(manager)) badges.push('<span class="manager-live-badge good-relations" title="Avete costruito fiducia e rispettato gli accordi: tenderà a essere leggermente meno aggressivo contro di te.">BUONI RAPPORTI</span>');
    return badges.length?`<div class="manager-live-badges">${badges.join('')}</div>`:'';
  }

  function buildLeagueManagerCards(summaryMode=false) {
    const currentRole = summaryMode ? null : $runtime.currentAuctionRole();
    const auctionLeader = summaryMode ? null : ($runtime.state.auction?.highBidderId || null);
    const auctionActiveIds = summaryMode ? [] : ($runtime.state.auction?.activeIds || []);

    return $runtime.state.managers.map((m,i) => {
      const isNominator = !summaryMode && !$runtime.state.auction && $runtime.state.nominationIndex===i && ($runtime.openRoleAuction()?$runtime.managerCanNominate(m):$runtime.roleSlotsRemaining(m,currentRole)>0);
      const isLeader = !summaryMode && auctionLeader === m.id;
      const isInactive = !summaryMode && !!$runtime.state.auction && !auctionActiveIds.includes(m.id) && !isLeader;
      const hasPassed = isInactive && m.id==='user';
      const isBlocked = isInactive && Array.isArray($runtime.state.auction?.blockedCpuIds) && $runtime.state.auction.blockedCpuIds.includes(m.id);
      const livePact = $runtime.state.auction ? $runtime.activePactForPlayer($runtime.state.auction.playerId) : null;
      const isPactOut = isInactive && m.id!=='user' && livePact?.cpuId===m.id && !livePact?.cpuBetrayed;
      const classes = [
        'manager-card',
        m.id === 'user' ? 'is-user' : '',
        isNominator ? 'active' : '',
        isLeader ? 'leading' : '',
        isInactive ? 'has-passed' : '',
        summaryMode ? 'summary-manager-card' : ''
      ].filter(Boolean).join(' ');

      let status = summaryMode ? 'COMPLETA' : 'ATTESA';
      let statusClass = summaryMode ? 'complete' : 'waiting';
      if (!summaryMode) {
        if (isNominator) { status = 'CHIAMA'; statusClass = 'turn'; }
        if ($runtime.state.auction) {
          if (isLeader) { status = 'IN TESTA'; statusClass = 'leader'; }
          else if (hasPassed) { status = 'PASS'; statusClass = 'passed'; }
          else if (isBlocked) { status = 'BLOCCATO'; statusClass = 'passed'; }
          else if (isPactOut) { status = 'PATTO'; statusClass = 'passed'; }
          else if (isInactive) { status = 'FUORI'; statusClass = 'passed'; }
          else { status = 'IN ASTA'; statusClass = 'bidding'; }
        }
      }

      const roleSections = $runtime.ROLE_ORDER.map(role => {
        const items = m.roster.filter(x => x.role === role);
        const isCurrent = !summaryMode && role === currentRole && !$runtime.state.completed;
        const spend = $runtime.roleSpend(m,role);
        const pct = $runtime.roleSpendPct(m,role);
        const rows = Array.from({length: $runtime.ROLE_LIMITS[role]}, (_,idx) => {
          const x = items[idx];
          if (!x) return `<div class="league-player-row role-player-${role} is-empty"><span>—</span><em></em><b></b></div>`;
          return `<div class="league-player-row role-player-${role} ${summaryMode?'summary-player-row':''}" title="${$runtime.escapeHtml(x.name)} · ${$runtime.escapeHtml($runtime.clubName(x.club))} · ${x.price} crediti">
            <span>${$runtime.escapeHtml(x.name)}</span>${summaryMode?'':`<em>${$runtime.escapeHtml($runtime.clubShort(x.club))}</em>`}<b>${x.price}</b>
          </div>`;
        }).join('');
        return `<div class="league-role-block role-block-${role} ${isCurrent?'current-role':''}">
          <div class="league-role-strip role-strip-${role}">
            <span><strong>${role}</strong><small>${items.length}/${$runtime.ROLE_LIMITS[role]}</small></span>
            <span class="role-spend"><b>${pct}%</b><small>${spend} cr</small></span>
          </div>
          <div class="league-role-players">${rows}</div>
        </div>`;
      }).join('');

      const progress = Math.round(m.roster.length / $runtime.TOTAL_SLOTS * 100);
      return `<div class="${classes}">
        <div class="league-manager-head">
          <div class="manager-title-line">
            <span class="manager-online-dot"></span>
            <div class="manager-identity">
              <div class="manager-name" title="${$runtime.escapeHtml(m.team)}">${$runtime.escapeHtml(m.team)}</div>
              <div class="manager-personality">${m.id==='user' ? $runtime.escapeHtml($runtime.state.managerName || 'Tu')+' · TU' : $runtime.escapeHtml(m.profile.label)}</div>
              ${summaryMode?'':managerLiveAuctionBadges(m,currentRole)}
            </div>
            <span class="manager-status ${statusClass}">${status}</span>
          </div>
          <div class="manager-credit-line">
            <div class="credit-main"><span class="coin">●</span><strong>${m.budget}</strong><small>crediti</small></div>
          </div>
          <div class="manager-progress"><i style="width:${progress}%"></i></div>
          <div class="manager-substats">
            ${summaryMode ? `<span><strong>${TOTAL_BUDGET-m.budget}</strong><small>SPESA</small></span>` : `<span><strong>${$runtime.maxBidNow(m)}</strong><small>MAX</small></span>`}
            <span class="slots"><strong>${m.roster.length}/${$runtime.TOTAL_SLOTS}</strong><small>ROSA</small></span>
            <span><strong>${averageRosterValue(m)}</strong><small>OVR</small></span>
          </div>
        </div>
        <div class="league-roster">${roleSections}</div>
      </div>`;
    }).join('');
  }

  function renderManagers() {
    $runtime.$('managerList').innerHTML = buildLeagueManagerCards(false);
  }

  function averageRosterValue(m) {
    if (!m.roster.length) return '—';
    return (m.roster.reduce((s,x)=>s+Number(x.ovr||0),0)/m.roster.length).toFixed(1);
  }

  function renderTurn() {
    window.FantaPresentationState?.publishAuction($runtime.state,{totalSlots:$runtime.TOTAL_SLOTS,roleLimits:$runtime.ROLE_LIMITS});
    if ($runtime.state.completed) return;
    const auction = $runtime.state.auction;
    if (auction) {
      $runtime.$('nominationBox').classList.add('hidden');
      $runtime.$('liveAuction').classList.remove('hidden');
      return;
    }
    $runtime.$('liveAuction').classList.add('hidden');
    $runtime.$('nominationBox').classList.remove('hidden');
    renderAuctionRoomList('nominationRoomList');
    if($runtime.openRoleAuction()){
      if($runtime.allRostersComplete()) return $runtime.finishAuction();
      const nominator=$runtime.state.managers[$runtime.state.nominationIndex];
      const userTurn=nominator.id==='user';
      const filter=$runtime.$('roleFilter');
      filter?.classList.toggle('hidden',!userTurn||$runtime.autocompleteMode);
      if(filter && !$runtime.ROLE_ORDER.includes(filter.value) && filter.value!=='ALL') filter.value='ALL';
      if($runtime.$('availableRoleCaption')) $runtime.$('availableRoleCaption').textContent='GIOCATORI CHIAMABILI';
      if($runtime.$('nominationCalloutCopy')) $runtime.$('nominationCalloutCopy').textContent='Scegli un giocatore di qualsiasi ruolo e chiamalo all’asta a 1 credito.';
      $runtime.$('turnLabel').textContent=userTurn?'Tocca a te: chiama un giocatore di qualsiasi ruolo.':`${nominator.team} sta scegliendo un giocatore…`;
      if($runtime.$('nominationTitle')) $runtime.$('nominationTitle').textContent=userTurn?'Scegli un giocatore':'Chiamata CPU in corso';
      $runtime.$('playerSearchArea').classList.toggle('hidden',!userTurn||$runtime.autocompleteMode);
      $runtime.$('cpuThinking').classList.toggle('hidden',userTurn&&!$runtime.autocompleteMode);
      if(!userTurn||$runtime.autocompleteMode) $runtime.$('cpuThinkingText').textContent=$runtime.autocompleteMode?'Autocompletamento dell’asta…':`${nominator.team} sta scegliendo un giocatore…`;
      if(userTurn&&!$runtime.autocompleteMode){
        const uiKey=`libera:${$runtime.state.availableIds.length}`;
        if(uiKey!==$runtime.nominationUiKey) $runtime.nominationUiKey=uiKey;
        renderPlayerResults();
      }else{
        if($runtime.$('availableRoleCount')) $runtime.$('availableRoleCount').textContent=$runtime.state.availableIds.length;
        if($runtime.$('nominationRoleLabel')) $runtime.$('nominationRoleLabel').textContent='Tutti i ruoli';
      }
      return;
    }
    $runtime.$('roleFilter')?.classList.add('hidden');
    if($runtime.$('availableRoleCaption')) $runtime.$('availableRoleCaption').textContent='SVINCOLATI NEL REPARTO';
    if($runtime.$('nominationCalloutCopy')) $runtime.$('nominationCalloutCopy').textContent='Scegli un giocatore del reparto e chiamalo all’asta a 1 credito.';
    $runtime.advanceRolePhaseIfNeeded();
    if ($runtime.state.currentRoleIndex >= $runtime.ROLE_ORDER.length) return $runtime.finishAuction();
    const role = $runtime.currentAuctionRole();
    const nominator = $runtime.state.managers[$runtime.state.nominationIndex];
    const userTurn = nominator.id === 'user';
    $runtime.$('roleFilter').value = role;
    $runtime.$('turnLabel').textContent = userTurn
      ? `Tocca a te: scegli un ${$runtime.ROLE_LABELS[role].toLowerCase()} da mettere all'asta a 1 credito.`
      : `${nominator.team} sta scegliendo un ${$runtime.ROLE_LABELS[role].toLowerCase()}…`;
    if ($runtime.$('nominationTitle')) $runtime.$('nominationTitle').textContent = userTurn ? `Chiama un ${$runtime.ROLE_LABELS[role]}` : 'Chiamata CPU in corso';
    if ($runtime.$('nominationRoleLabel')) $runtime.$('nominationRoleLabel').textContent = $runtime.ROLE_PLURALS[role];
    $runtime.$('playerSearchArea').classList.toggle('hidden', !userTurn || $runtime.autocompleteMode);
    $runtime.$('cpuThinking').classList.toggle('hidden', userTurn && !$runtime.autocompleteMode);
    if (!userTurn || $runtime.autocompleteMode) $runtime.$('cpuThinkingText').textContent = $runtime.autocompleteMode ? `Autocompletamento · fase ${$runtime.ROLE_LABELS[role]}…` : `${nominator.team} sta scegliendo un ${$runtime.ROLE_LABELS[role].toLowerCase()}…`;
    if (userTurn && !$runtime.autocompleteMode) {
      const uiKey = `${role}:${$runtime.state.availableIds.length}`;
      if (uiKey !== $runtime.nominationUiKey) {
        $runtime.nominationUiKey = uiKey;
      }
      renderPlayerResults();
    }
  }

  function nominationSort(list, mode) {
    const out = list.slice();
    if ((mode === 'potential' || mode === 'starter') && auctionObserverActive()) {
      const field = mode === 'potential' ? 'potential' : 'starterPct';
      const values = new Map(out.map(p => [p, Number($runtime.auctionPlayerAnalysis(p)[field]) || 0]));
      return out.sort((a,b) => values.get(b)-values.get(a) || Number(b.ovr||0)-Number(a.ovr||0) || $runtime.baseAuctionValue(b)-$runtime.baseAuctionValue(a));
    }
    if (mode === 'ovr') return out.sort((a,b) => Number(b.ovr||0)-Number(a.ovr||0) || $runtime.baseAuctionValue(b)-$runtime.baseAuctionValue(a));
    if (mode === 'quotation') return out.sort((a,b) => Number(b.quotation||0)-Number(a.quotation||0) || Number(b.ovr||0)-Number(a.ovr||0));
    if (mode === 'name') return out.sort((a,b) => String(a.name).localeCompare(String(b.name),'it'));
    return out.sort((a,b) => $runtime.baseAuctionValue(b)-$runtime.baseAuctionValue(a) || Number(b.ovr||0)-Number(a.ovr||0));
  }

  function openNominationModal() {
    const modal = $runtime.$('nominationModal');
    if (!modal || !$runtime.state || $runtime.state.auction) return;
    const isUserTurn = $runtime.state.managers[$runtime.state.nominationIndex]?.id === 'user';
    if (!isUserTurn) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
    renderPlayerResults();
    setTimeout(() => $runtime.$('playerSearch')?.focus(), 20);
  }

  function closeNominationModal() {
    const modal = $runtime.$('nominationModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
  }

  function renderNominationClubFilter(rolePlayers) {
    const select = $runtime.$('clubFilter');
    if (!select) return;
    const current = select.value;
    const clubs = [...new Set(rolePlayers.map(p=>p.club))]
      .map(id=>$runtime.clubMap.get(id)).filter(Boolean)
      .sort((a,b)=>a.name.localeCompare(b.name,'it'));
    select.innerHTML = '<option value="">Tutti i club</option>' + clubs.map(c=>`<option value="${$runtime.escapeHtml(c.id)}">${$runtime.escapeHtml(c.name)}</option>`).join('');
    if ([...select.options].some(o=>o.value===current)) select.value=current;
  }

  function nominationCard(p, rank=0, featured=false) {
    const club = $runtime.clubMap.get(p.club);
    const short = $runtime.clubShort(p.club);
    const color = $runtime.clubColor(p.club);
    const analysis = $runtime.auctionPlayerAnalysis(p);
    const observerActive=auctionObserverActive();
    const potentialChip=observerActive?`<em>Pot. ${$runtime.escapeHtml(analysis.label)}</em>`:'';
    const starterChip=observerActive?`<em>Tit. ${analysis.starterPct}%</em>`:'';
    const observerAnalysis=observerActive?`<div class="nomination-player-analysis">${potentialChip}${starterChip}</div>`:'';
    const roleTag=$runtime.openRoleAuction()?`<span class="nomination-role-tag role-${p.role}">${p.role} · ${$runtime.escapeHtml($runtime.ROLE_LABELS[p.role]||p.role)}</span>`:'';
    if (featured) return `
      <article class="top-player-card role-accent-${p.role}" style="--club-color:${$runtime.escapeHtml(color)}">
        <div class="top-player-rank">#${rank}</div>
        <div class="club-marker">${$runtime.escapeHtml(short)}</div>
        <div class="top-player-copy">
          <span>${$runtime.escapeHtml(club?.name || p.club)}</span>
          <h3>${$runtime.escapeHtml(p.name)}</h3>${roleTag}
          ${observerAnalysis}
        </div>
        <div class="top-player-stats"><span>OVR <strong>${Number(p.ovr||0)}</strong></span><span>QUOT <strong>${Number(p.quotation||0)}</strong></span></div>
        <button class="call-player top-call" data-player="${p.id}">CHIAMA A 1</button>
      </article>`;
    return `
      <article class="free-player-card" style="--club-color:${$runtime.escapeHtml(color)}">
        <div class="free-player-club">${$runtime.escapeHtml(short)}</div>
        <div class="free-player-copy"><strong>${$runtime.escapeHtml(p.name)}</strong>${roleTag}<span>${$runtime.escapeHtml(club?.name || p.club)}</span>${observerAnalysis}</div>
        <div class="free-player-stat"><small>OVR</small><strong>${Number(p.ovr||0)}</strong></div>
        <div class="free-player-stat"><small>QUOT</small><strong>${Number(p.quotation||0)}</strong></div>
        <button class="call-player compact-call" data-player="${p.id}">Chiama 1</button>
      </article>`;
  }

  function auctionObserverActive(){
    const selected=Array.isArray($runtime.state?.auctionPowers?.selected)?$runtime.state.auctionPowers.selected:[];
    return selected.includes('observer');
  }

  function renderPlayerResults() {
    if (!$runtime.state || $runtime.state.auction) return;
    const sortSelect = $runtime.$('sortFilter');
    if (sortSelect) {
      const observerActive = auctionObserverActive();
      for (const [value,label] of [['potential','Potenziale più alto'],['starter','Titolarità più alta']]) {
        const existing = [...sortSelect.options].find(option => option.value === value);
        if (observerActive && !existing) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          sortSelect.appendChild(option);
        } else if (!observerActive && existing) {
          if (sortSelect.value === value) sortSelect.value = 'recommended';
          existing.remove();
        }
      }
    }
    const me = $runtime.state.managers[0];
    const q = $runtime.$('playerSearch').value.trim().toLowerCase();
    const rf = $runtime.openRoleAuction()?($runtime.$('roleFilter')?.value||'ALL'):$runtime.currentAuctionRole();
    const clubFilter = $runtime.$('clubFilter')?.value || '';
    const sortMode = $runtime.$('sortFilter')?.value || 'recommended';

    const rolePlayers = $runtime.state.availableIds.map(id => $runtime.playerMap.get(id)).filter(Boolean)
      .filter(p => $runtime.canOwn(me,p) && (!$runtime.openRoleAuction() || $runtime.maxLegalBid(me,p)>=1) && (rf==='ALL'||p.role===rf));
    renderNominationClubFilter(rolePlayers);

    const currentClub = $runtime.$('clubFilter')?.value || clubFilter;
    const filtered = rolePlayers.filter(p => {
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || $runtime.clubName(p.club).toLowerCase().includes(q) || $runtime.clubShort(p.club).toLowerCase().includes(q);
      const matchesClub = !currentClub || p.club===currentClub;
      return matchesQuery && matchesClub;
    });

    const list = nominationSort(filtered, sortMode).slice(0,120);

    if ($runtime.$('availableRoleCount')) $runtime.$('availableRoleCount').textContent = rolePlayers.length;
    if ($runtime.$('filteredPlayerCount')) $runtime.$('filteredPlayerCount').textContent = `${filtered.length} ${filtered.length===1?'giocatore':'giocatori'}`;
    if ($runtime.$('freeListTitle')) $runtime.$('freeListTitle').textContent = q || currentClub ? 'Risultati della ricerca' : rf==='ALL'?'Tutti i ruoli disponibili':`Tutti i ${$runtime.ROLE_PLURALS[rf].toLowerCase()} liberi`;
    if($runtime.$('nominationRoleLabel')) $runtime.$('nominationRoleLabel').textContent=rf==='ALL'?'Tutti i ruoli':$runtime.ROLE_PLURALS[rf];

    $runtime.$('playerResults').innerHTML = list.length
      ? list.map(p=>nominationCard(p,0,false)).join('')
      : '<div class="nomination-empty">Nessun giocatore disponibile con questi filtri.</div>';

    document.querySelectorAll('.call-player').forEach(btn => btn.addEventListener('click', () => $runtime.nominate(btn.dataset.player, 0)));
  }

  function renderAuctionRoomList(targetId='auctionRoomList') {
    const box = $runtime.$(targetId);
    if (!box) return;
    const a = $runtime.state?.auction;
    const leaderId = a?.arcade?.type==='sealed'&&!a.arcade.resolved?null:a?.highBidderId || null;
    const activeIds = a?.activeIds || [];
    const nominatorId = a?.nominatorId || $runtime.state?.managers?.[$runtime.state.nominationIndex]?.id;
    const rows = $runtime.state.managers.slice().sort((x,y) => y.budget - x.budget).map(m => {
      const classes = ['auction-room-item'];
      if (m.id === 'user') classes.push('is-user');
      if (m.id === nominatorId && !a) classes.push('is-turn');
      if (m.id === leaderId) classes.push('is-leading');
      const inactive = !!a && !activeIds.includes(m.id) && leaderId !== m.id;
      if (inactive) classes.push('is-passed');
      const flashed = $runtime.lastBidFlash && $runtime.lastBidFlash.managerId===m.id && Date.now() < $runtime.lastBidFlash.until;
      if (flashed) classes.push('just-bid');
      let sub = m.id==='user' ? ($runtime.state.managerName || 'Tu') : m.profile.label;
      if (a) {
        const pact=$runtime.activePactForPlayer(a.playerId);
        const blocked=inactive && Array.isArray(a.blockedCpuIds) && a.blockedCpuIds.includes(m.id);
        const pactOut=inactive && m.id!=='user' && pact?.cpuId===m.id && !pact?.cpuBetrayed;
        if (flashed) sub = `+${$runtime.lastBidFlash.increment} → ${$runtime.lastBidFlash.target}`;
        else if (m.id === leaderId) sub = 'In testa';
        else if (inactive && m.id==='user') sub = 'Pass';
        else if (blocked) sub = 'Bloccato';
        else if (pactOut) sub = 'Patto';
        else if (inactive) sub = 'Fuori';
        else sub = 'In asta';
      } else if (m.id === nominatorId) sub = 'Sta chiamando';
      const liveBadges=managerLiveAuctionBadges(m,$runtime.currentAuctionRole());
      return `<div class="${classes.join(' ')}"><div class="name" title="${$runtime.escapeHtml(m.team)}">${$runtime.escapeHtml(m.team)}</div><div class="credits">${m.budget}</div><div class="sub">${$runtime.escapeHtml(sub)}</div>${liveBadges}</div>`;
    }).join('');
    box.innerHTML = rows;
  }

  function auctionBundlePlayerMarkup(player){
    const analysis=$runtime.auctionPlayerAnalysis(player);
    const details=auctionObserverActive()?`<div class="bundle-player-analysis"><div><span>POTENZIALE STAGIONE</span><strong>${$runtime.escapeHtml(analysis.label)}</strong><div class="bundle-analysis-track"><i style="width:${$runtime.clamp(analysis.potential,0,100)}%"></i></div></div><div><span>PROB. TITOLARE</span><strong>${analysis.starterPct}%</strong><div class="bundle-analysis-track starter"><i style="width:${$runtime.clamp(analysis.starterPct,0,100)}%"></i></div></div></div>`:'';
    return `<article class="bundle-player-card" aria-label="${$runtime.escapeHtml(player.name)}"><div class="bundle-player-top"><div class="bundle-player-avatar">${$runtime.playerAvatarMarkup(player,player.name)}</div><div class="bundle-player-identity"><span class="bundle-player-role">${$runtime.escapeHtml($runtime.ROLE_LABELS[player.role])}</span><h3>${$runtime.escapeHtml(player.name)}</h3><span>${$runtime.escapeHtml($runtime.clubName(player.club))}</span></div></div><div class="bundle-player-meta"><strong>OVR ${player.ovr}</strong><span>Quot. ${Number(player.quotation||0)}</span><span class="bundle-player-stars">${$runtime.playerStars(player.ovr)}</span></div>${details}</article>`;
  }

  function renderAuction() {
    const a = $runtime.state.auction;
    if (!a) return;
    const p = $runtime.playerMap.get(a.playerId);
    $runtime.$('auctionClub').textContent = $runtime.clubName(p.club);
    const mystery=a.arcade?.type==='mystery' && !a.awarding;
    const second=a.arcade?.type==='bundle'?$runtime.playerMap.get(a.arcade.secondPlayerId):null;
    $runtime.$('auctionAvatar')?.closest('.auction-player-card')?.classList.toggle('has-bundle-players',!!second);
    if($runtime.$('auctionBundlePlayers')){
      $runtime.$('auctionBundlePlayers').hidden=!second;
      $runtime.$('auctionBundlePlayers').innerHTML=second?`<div class="bundle-auction-heading"><span>DUE AL PREZZO DI UNO</span><small>2 giocatori · un’unica offerta</small></div><div class="bundle-player-grid">${auctionBundlePlayerMarkup(p)}${auctionBundlePlayerMarkup(second)}</div>`:'';
    }
    $runtime.$('auctionName').textContent = mystery?'PACCO SORPRESA':second?`${p.name} + ${second.name}`:p.name;
    $runtime.$('auctionOvr').textContent = mystery?'OVR ???':second?`OVR ${p.ovr} + ${second.ovr}`:`OVR ${p.ovr}`;
    $runtime.$('auctionQuote').textContent = mystery?'Quot. ???':`Quot. ${Number(p.quotation||0)}`;
    if ($runtime.$('auctionClubShort')) $runtime.$('auctionClubShort').textContent = $runtime.clubShort(p.club);
    if ($runtime.$('auctionRoleLabel')) $runtime.$('auctionRoleLabel').textContent = $runtime.ROLE_LABELS[p.role];
    if ($runtime.$('auctionAvatar')) { $runtime.$('auctionAvatar').innerHTML = mystery?'<span class="arcade-silhouette" role="img" aria-label="Giocatore misterioso"><svg viewBox="0 0 64 72" aria-hidden="true" focusable="false"><path d="M20 10H44V16H50V30H44V36H38V42H26V32H32V26H38V20H26V26H14V16H20Z M26 48H38V60H26Z"/></svg></span>':$runtime.playerAvatarMarkup(p,p.name); $runtime.$('auctionAvatar').style.boxShadow = `0 10px 30px ${$runtime.clubColor(p.club)}55`; }
    if ($runtime.$('auctionStars')) $runtime.$('auctionStars').textContent = mystery?'★ ? ★':$runtime.playerStars(p.ovr);
    const analysis=$runtime.auctionPlayerAnalysis(p);
    const observerActive=auctionObserverActive();
    const potentialItem=$runtime.$('auctionPotentialLabel')?.closest('.auction-analysis-item');
    const starterItem=$runtime.$('auctionStarterPct')?.closest('.auction-analysis-item');
    const analysisWrap=potentialItem?.parentElement || starterItem?.parentElement;
    if(potentialItem) potentialItem.hidden=!observerActive;
    if(starterItem) starterItem.hidden=!observerActive;
    if(analysisWrap) analysisWrap.style.display=observerActive?'':'none';
    if($runtime.$('auctionPotentialLabel')) $runtime.$('auctionPotentialLabel').textContent=observerActive?analysis.label:'—';
    if($runtime.$('auctionStarterPct')) $runtime.$('auctionStarterPct').textContent=observerActive?`${analysis.starterPct}%`:'—';
    if($runtime.$('auctionPotentialBar')) $runtime.$('auctionPotentialBar').style.width=observerActive?`${analysis.potential}%`:'0%';
    if($runtime.$('auctionStarterBar')) $runtime.$('auctionStarterBar').style.width=observerActive?`${analysis.starterPct}%`:'0%';
    $runtime.$('currentPrice').textContent = a.arcade?.type==='sealed'&&!a.arcade.resolved?'???':a.price;
    $runtime.renderArcadeBanner();
    const leader = $runtime.state.managers.find(m => m.id===a.highBidderId);
    $runtime.$('currentLeader').textContent = a.arcade?.type==='sealed'&&!a.arcade.resolved?'OFFERTE SEGRETE':leader ? leader.team : '—';
    const leaderImage = $runtime.$('currentLeaderImage');
    const leaderInitials = $runtime.$('currentLeaderInitials');
    const leaderArt = leader && leader.id !== 'user' ? $runtime.RIVAL_ART[$runtime.profileArchetype(leader)] : null;
    if (leaderImage && leaderInitials) {
      if (leaderArt) {
        leaderImage.src = `assets/rivals/${leaderArt}.webp`;
        leaderImage.alt = leader?.profile?.label || leader?.name || 'Allenatore in testa';
        leaderImage.classList.remove('hidden');
        leaderInitials.classList.add('hidden');
      } else {
        leaderImage.classList.add('hidden');
        leaderInitials.classList.remove('hidden');
        leaderInitials.textContent = leader ? $runtime.playerInitials(leader.name || leader.team) : '—';
      }
    }
    const nominator = $runtime.state.managers.find(m => m.id===a.nominatorId);
    if ($runtime.$('auctionNominator')) $runtime.$('auctionNominator').textContent = `Chiamato da ${nominator ? nominator.team : '—'}`;
    if ($runtime.$('auctionActiveCount')) {
      const activeCount = a.activeIds.length;
      const pact = $runtime.activePactForPlayer(p.id);
      $runtime.$('auctionActiveCount').textContent = pact ? `PATTO ATTIVO · ${activeCount} ancora in asta` : `${activeCount} ${activeCount===1 ? 'fantallenatore' : 'fantallenatori'} ancora in asta`;
    }
    const me = $runtime.state.managers[0];
    const myMax = $runtime.maxLegalBid(me,p);

    // In V1.3 the countdown is global: the user can raise at any moment
    // while still active and not already leading.
    const userCanAct = a.arcade?.type!=='sealed' && !a.arcade?.awaitingAck && !a.awarding && !a.awaitingAuctionEvent && !$runtime.autocompleteMode && a.activeIds.includes('user') && a.highBidderId !== 'user';
    window.FantaPresentationState?.publishAuction($runtime.state,{totalSlots:$runtime.TOTAL_SLOTS,roleLimits:$runtime.ROLE_LIMITS,userCanAct});
    $runtime.$('userBidControls').classList.toggle('hidden', !userCanAct);
    $runtime.$('waitingBid').classList.toggle('hidden', userCanAct || !!a.awarding);
    if (userCanAct) {
      const max = myMax;
      document.querySelectorAll('[data-inc]').forEach(btn => {
        const inc = Number(btn.dataset.inc);
        const target = a.price + inc;
        btn.disabled = target > max;
        if (btn.classList.contains('live-bid-btn')) {
          btn.innerHTML = `<span>RILANCIA</span><strong>+${inc}</strong><small>${target<=max ? `vai a ${target}` : 'oltre il max'}</small>`;
        } else {
          btn.textContent = `+${inc}${target<=max?` → ${target}`:''}`;
        }
      });
    }
    $runtime.renderAuctionPowers();
    if ($runtime.$('waitingBid')) {
      $runtime.$('waitingBid').textContent = a.awaitingAuctionEvent
        ? 'Evento asta in corso…'
        : (a.highBidderId==='user'
          ? `Sei in testa. Se nessuno rilancia entro ${a.arcade?.type==='hammer'?2:5} secondi, è tuo.`
          : (a.activeIds.includes('user') ? 'Asta in corso…' : 'Hai passato. Attendi l’aggiudicazione…'));
    }
    renderAuctionRoomList();
    $runtime.renderCountdown();
    const visibleLog = a.log.slice(-60);
    $runtime.$('auctionLog').innerHTML = visibleLog.map(line => `<div class="log-line"><span>${$runtime.escapeHtml(line.text)}</span><span class="${line.kind||''}">${$runtime.escapeHtml(line.side||'')}</span></div>`).join('');
    $runtime.$('auctionLog').scrollTop = $runtime.$('auctionLog').scrollHeight;
    if ($runtime.$('recentBidStrip')) {
      const recent = a.log.slice(-7).reverse();
      $runtime.$('recentBidStrip').innerHTML = recent.length ? recent.map(line => {
        const cls = line.kind==='pass' ? 'pass' : (line.kind==='win' ? 'win' : (line.kind==='status' ? 'status' : 'bid'));
        const label = line.kind==='pass' ? 'PASS' : (line.kind==='win' ? 'AGGIUDICATO' : (line.side || (line.kind==='status' ? 'STATO' : '1')));
        const detail = line.kind==='bid' ? 'rilancio' : line.kind==='pass' ? 'fuori dall’asta' : line.kind==='status' ? 'stato asta' : 'chiusura';
        return `<div class="recent-bid-chip ${cls}"><span>${$runtime.escapeHtml(line.text)}</span><b>${$runtime.escapeHtml(label)}</b><small>${detail}</small></div>`;
      }).join('') : '<div class="recent-bids-empty">Nessun rilancio ancora.</div>';
    }
  }
    return Object.freeze({renderAll,renderPhaseBanner,renderRoster,managerLiveAuctionBadges,buildLeagueManagerCards,renderManagers,averageRosterValue,renderTurn,nominationSort,openNominationModal,closeNominationModal,renderNominationClubFilter,nominationCard,auctionObserverActive,renderPlayerResults,renderAuctionRoomList,auctionBundlePlayerMarkup,renderAuction});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['auction-views']=Object.freeze({create});
})();
