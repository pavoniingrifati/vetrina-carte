/* Responsibility: auction-controller. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: auction-controller');
  function renderAll() {
    if (!$runtime.state) return;
    $runtime.renderVisibleRivals();
    $runtime.renderRoster();
    $runtime.renderManagers();
    $runtime.renderPhaseBanner();
    $runtime.renderTurn();
    if ($runtime.state.auction) $runtime.renderAuction();
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
              ${summaryMode?'':$runtime.managerLiveAuctionBadges(m,currentRole)}
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
            <span><strong>${$runtime.averageRosterValue(m)}</strong><small>OVR</small></span>
          </div>
        </div>
        <div class="league-roster">${roleSections}</div>
      </div>`;
    }).join('');
  }

  function renderManagers() {
    $runtime.$('managerList').innerHTML = $runtime.buildLeagueManagerCards(false);
  }

  function averageRosterValue(m) {
    if (!m.roster.length) return '—';
    return (m.roster.reduce((s,x)=>s+Number(x.ovr||0),0)/m.roster.length).toFixed(1);
  }

  function renderTurn() {
    if ($runtime.state.completed) return;
    const auction = $runtime.state.auction;
    if (auction) {
      $runtime.$('nominationBox').classList.add('hidden');
      $runtime.$('liveAuction').classList.remove('hidden');
      return;
    }
    $runtime.$('liveAuction').classList.add('hidden');
    $runtime.$('nominationBox').classList.remove('hidden');
    $runtime.renderAuctionRoomList('nominationRoomList');
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
        if(uiKey!==$runtime.nominationUiKey){$runtime.nominationUiKey=uiKey;$runtime.$('playerSearch').value='';$runtime.$('clubFilter').value='';$runtime.$('sortFilter').value='recommended';}
        $runtime.renderPlayerResults();
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
        $runtime.$('playerSearch').value = '';
        $runtime.$('clubFilter').value = '';
        $runtime.$('sortFilter').value = 'recommended';
      }
      $runtime.renderPlayerResults();
    }
  }

  function nominationSort(list, mode) {
    const out = list.slice();
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
    $runtime.renderPlayerResults();
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
    const observerActive=$runtime.auctionObserverActive();
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

  function playerSeasonPotentialProfile(player){
    if(!player) return {label:'NORMALE',trend:0,potential:55,tier:'normal'};
    const seasonNo=Math.max(1,Number($runtime.state?.career?.seasonNumber||1));
    const roll=$runtime.careerHash(`season-potential-tier|${seasonNo}|${player.id}`);
    const strength=$runtime.careerHash(`season-potential-strength|${seasonNo}|${player.id}`);
    if(roll<.03){
      return {label:'ELITE',trend:8+Math.floor(strength*3),potential:94+Math.floor(strength*5),tier:'elite'};
    }
    if(roll<.14){
      return {label:'ALTO',trend:4+Math.floor(strength*4),potential:78+Math.floor(strength*10),tier:'high'};
    }
    if(roll>=.97){
      return {label:'RISCHIO CALO',trend:-(8+Math.floor(strength*3)),potential:12+Math.floor(strength*10),tier:'collapse'};
    }
    if(roll>=.84){
      return {label:'BASSO',trend:-(3+Math.floor(strength*4)),potential:28+Math.floor(strength*14),tier:'low'};
    }
    const neutralTrend=-1+Math.floor(strength*5); // da -1 a +3: giocatore normalmente stabile.
    return {label:'NORMALE',trend:neutralTrend,potential:50+Math.floor(strength*17),tier:'normal'};
  }

  function clubRoleStarterSlots(clubId,role){
    const formation=String($runtime.clubMap.get(clubId)?.defaultFormation||'4-3-3').split('-').map(Number);
    return Math.max(1,Number({P:1,D:formation[0]||4,C:formation[1]||3,A:formation[2]||3}[role]||3));
  }

  function starterHierarchyBias(role,rank,slots){
    if(role==='P'){
      if(rank<=0) return 8;
      if(rank===1) return 0;
      return -5-Math.max(0,rank-2)*2;
    }
    return $runtime.clamp((Number(slots||1)-Number(rank)-.5)*1.45,-5.5,5.5);
  }

  function normalizedStarterProbability(entries,targetId,slots,temperature){
    const engine=window.FantaSeasonEngine;
    if(engine?.normalizeStarterProbabilities){
      const probabilities=engine.normalizeStarterProbabilities(entries,slots,{cap:96,floor:1,temperature});
      return Number(probabilities[String(targetId)]||0);
    }
    const row=(entries||[]).find(entry=>String(entry.id)===String(targetId));
    return row?.unavailable?0:50;
  }

  function auctionStarterProbability(player){
    if(!player) return 0;
    const slots=$runtime.clubRoleStarterSlots(player.club,player.role);
    const peers=(window.FANTA_PLAYERS||[])
      .filter(p=>p.club===player.club&&p.role===player.role&&p.marketStatus!=='abroad')
      .slice()
      .sort((a,b)=>{
        const av=Number(a.ovr||0)*100+Number(a.fvm||0)*.22+Number(a.quotation||0)*.4;
        const bv=Number(b.ovr||0)*100+Number(b.fvm||0)*.22+Number(b.quotation||0)*.4;
        return bv-av;
      });
    const entries=peers.map((candidate,rank)=>({
      id:candidate.id,
      score:Number(candidate.ovr||0)+Number(candidate.fvm||0)*.008+Number(candidate.quotation||0)*.025+$runtime.starterHierarchyBias(candidate.role,rank,slots),
      unavailable:false
    }));
    return $runtime.normalizedStarterProbability(entries,player.id,slots,player.role==='P'?2.4:4.4);
  }

  function auctionPlayerAnalysis(player){
    if(!player) return {potential:0,label:'—',starterPct:0,trend:0,tier:'normal'};
    const profile=$runtime.playerSeasonPotentialProfile(player);

    const starterPct=$runtime.auctionStarterProbability(player);
    return {potential:profile.potential,label:profile.label,starterPct,trend:profile.trend,tier:profile.tier};
  }

  function renderPlayerResults() {
    if (!$runtime.state || $runtime.state.auction) return;
    const me = $runtime.state.managers[0];
    const q = $runtime.$('playerSearch').value.trim().toLowerCase();
    const rf = $runtime.openRoleAuction()?($runtime.$('roleFilter')?.value||'ALL'):$runtime.currentAuctionRole();
    const clubFilter = $runtime.$('clubFilter')?.value || '';
    const sortMode = $runtime.$('sortFilter')?.value || 'recommended';

    const rolePlayers = $runtime.state.availableIds.map(id => $runtime.playerMap.get(id)).filter(Boolean)
      .filter(p => $runtime.canOwn(me,p) && (!$runtime.openRoleAuction() || $runtime.maxLegalBid(me,p)>=1) && (rf==='ALL'||p.role===rf));
    $runtime.renderNominationClubFilter(rolePlayers);

    const currentClub = $runtime.$('clubFilter')?.value || clubFilter;
    const filtered = rolePlayers.filter(p => {
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || $runtime.clubName(p.club).toLowerCase().includes(q) || $runtime.clubShort(p.club).toLowerCase().includes(q);
      const matchesClub = !currentClub || p.club===currentClub;
      return matchesQuery && matchesClub;
    });

    const list = $runtime.nominationSort(filtered, sortMode).slice(0,120);

    if ($runtime.$('availableRoleCount')) $runtime.$('availableRoleCount').textContent = rolePlayers.length;
    if ($runtime.$('filteredPlayerCount')) $runtime.$('filteredPlayerCount').textContent = `${filtered.length} ${filtered.length===1?'giocatore':'giocatori'}`;
    if ($runtime.$('freeListTitle')) $runtime.$('freeListTitle').textContent = q || currentClub ? 'Risultati della ricerca' : rf==='ALL'?'Tutti i ruoli disponibili':`Tutti i ${$runtime.ROLE_PLURALS[rf].toLowerCase()} liberi`;
    if($runtime.$('nominationRoleLabel')) $runtime.$('nominationRoleLabel').textContent=rf==='ALL'?'Tutti i ruoli':$runtime.ROLE_PLURALS[rf];

    $runtime.$('playerResults').innerHTML = list.length
      ? list.map(p=>$runtime.nominationCard(p,0,false)).join('')
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
      const liveBadges=$runtime.managerLiveAuctionBadges(m,$runtime.currentAuctionRole());
      return `<div class="${classes.join(' ')}"><div class="name" title="${$runtime.escapeHtml(m.team)}">${$runtime.escapeHtml(m.team)}</div><div class="credits">${m.budget}</div><div class="sub">${$runtime.escapeHtml(sub)}</div>${liveBadges}</div>`;
    }).join('');
    box.innerHTML = rows;
  }

  function auctionBundlePlayerMarkup(player){
    const analysis=$runtime.auctionPlayerAnalysis(player);
    const details=$runtime.auctionObserverActive()?`<div class="bundle-player-analysis"><div><span>POTENZIALE STAGIONE</span><strong>${$runtime.escapeHtml(analysis.label)}</strong><div class="bundle-analysis-track"><i style="width:${$runtime.clamp(analysis.potential,0,100)}%"></i></div></div><div><span>PROB. TITOLARE</span><strong>${analysis.starterPct}%</strong><div class="bundle-analysis-track starter"><i style="width:${$runtime.clamp(analysis.starterPct,0,100)}%"></i></div></div></div>`:'';
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
      $runtime.$('auctionBundlePlayers').innerHTML=second?`<div class="bundle-auction-heading"><span>DUE AL PREZZO DI UNO</span><small>2 giocatori · un’unica offerta</small></div><div class="bundle-player-grid">${$runtime.auctionBundlePlayerMarkup(p)}${$runtime.auctionBundlePlayerMarkup(second)}</div>`:'';
    }
    $runtime.$('auctionName').textContent = mystery?'PACCO SORPRESA':second?`${p.name} + ${second.name}`:p.name;
    $runtime.$('auctionOvr').textContent = mystery?'OVR ???':second?`OVR ${p.ovr} + ${second.ovr}`:`OVR ${p.ovr}`;
    $runtime.$('auctionQuote').textContent = mystery?'Quot. ???':`Quot. ${Number(p.quotation||0)}`;
    if ($runtime.$('auctionClubShort')) $runtime.$('auctionClubShort').textContent = $runtime.clubShort(p.club);
    if ($runtime.$('auctionRoleLabel')) $runtime.$('auctionRoleLabel').textContent = $runtime.ROLE_LABELS[p.role];
    if ($runtime.$('auctionAvatar')) { $runtime.$('auctionAvatar').innerHTML = mystery?'<span class="arcade-silhouette" role="img" aria-label="Giocatore misterioso"><svg viewBox="0 0 64 72" aria-hidden="true" focusable="false"><path d="M20 10H44V16H50V30H44V36H38V42H26V32H32V26H38V20H26V26H14V16H20Z M26 48H38V60H26Z"/></svg></span>':$runtime.playerAvatarMarkup(p,p.name); $runtime.$('auctionAvatar').style.boxShadow = `0 10px 30px ${$runtime.clubColor(p.club)}55`; }
    if ($runtime.$('auctionStars')) $runtime.$('auctionStars').textContent = mystery?'★ ? ★':$runtime.playerStars(p.ovr);
    const analysis=$runtime.auctionPlayerAnalysis(p);
    const observerActive=$runtime.auctionObserverActive();
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
    $runtime.renderAuctionRoomList();
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

  function addAuctionLog(text, side='', kind='') {
    if (!$runtime.state.auction) return;
    $runtime.state.auction.log.push({text,side,kind});
    if ($runtime.state.auction.log.length > 120) $runtime.state.auction.log = $runtime.state.auction.log.slice(-120);
    $runtime.renderAuction();
  }

  function auctionWindowMs() {
    // Autocomplete is a diagnostic shortcut. Manual play always uses the full 5 seconds.
    return $runtime.autocompleteMode ? 180 : $runtime.state?.auction?.arcade?.type==='hammer'?2000:$runtime.BID_WINDOW_MS;
  }

  function clearAuctionRuntimeTimers() {
    clearTimeout($runtime.uiTimer);
    $runtime.uiTimer = null;
    if ($runtime.countdownTimer) clearInterval($runtime.countdownTimer);
    $runtime.countdownTimer = null;
    $runtime.cpuReactionTimers.forEach(t => clearTimeout(t));
    $runtime.cpuReactionTimers = [];
    if ($runtime.bidFlashTimer) clearTimeout($runtime.bidFlashTimer);
    $runtime.bidFlashTimer = null;
    if ($runtime.bidSpotlightTimer) clearTimeout($runtime.bidSpotlightTimer);
    $runtime.bidSpotlightTimer = null;
    $runtime.$('bidSpotlight')?.classList.add('hidden');
    if ($runtime.awardAnimationTimer) clearTimeout($runtime.awardAnimationTimer);
    $runtime.awardAnimationTimer = null;
    if ($runtime.suddenInterestTimer) clearTimeout($runtime.suddenInterestTimer);
    $runtime.suddenInterestTimer = null;
  }

  function renderCountdown() {
    if (!$runtime.$('bidCountdown')) return;
    const a = $runtime.state?.auction;
    if (!a) {
      $runtime.$('bidCountdown').textContent = '5';
      $runtime.$('countdownBar').style.width = '100%';
      return;
    }
    if (a.arcade?.awaitingAck || (a.arcade?.type==='sealed'&&!a.arcade.resolved)) {
      $runtime.$('bidCountdown').textContent='—';$runtime.$('countdownBar').style.width='100%';return;
    }
    if (a.awaitingAuctionEvent) {
      $runtime.$('bidCountdown').textContent = '5';
      $runtime.$('countdownBar').style.width = '100%';
      $runtime.$('countdownBox').style.setProperty('--timer-progress','360deg');
      $runtime.$('countdownBox').classList.remove('warning','urgent');
      return;
    }
    const windowMs = Math.max(1, Number(a.windowMs || $runtime.auctionWindowMs()));
    const left = Math.max(0, Number(a.deadlineAt||0) - Date.now());
    const sec = left <= 0 ? 0 : Math.ceil(left / 1000);
    $runtime.$('bidCountdown').textContent = String(sec);
    const progress = $runtime.clamp(left/windowMs*100,0,100);
    $runtime.$('countdownBar').style.width = `${progress}%`;
    $runtime.$('countdownBox').style.setProperty('--timer-progress', `${progress * 3.6}deg`);
    $runtime.$('countdownBox').classList.toggle('warning', !$runtime.autocompleteMode && left <= 3000 && left > 1500);
    $runtime.$('countdownBox').classList.toggle('urgent', !$runtime.autocompleteMode && left <= 1500);
  }

  function startCountdownTicker() {
    if ($runtime.countdownTimer) clearInterval($runtime.countdownTimer);
    $runtime.renderAuctionRoomList();
    $runtime.renderCountdown();
    $runtime.countdownTimer = setInterval(() => {
      if (!$runtime.state?.auction) {
        clearInterval($runtime.countdownTimer);
        $runtime.countdownTimer = null;
        return;
      }
      $runtime.renderAuctionRoomList();
    $runtime.renderCountdown();
      if (Date.now() >= Number($runtime.state.auction.deadlineAt||0)) {
        $runtime.clearAuctionRuntimeTimers();
        $runtime.awardAuction();
      }
    }, $runtime.autocompleteMode ? 25 : 50);
  }

  function resetBidClock({logReset=false}={}) {
    if (!$runtime.state?.auction) return;
    const a = $runtime.state.auction;
    a.windowMs = $runtime.auctionWindowMs();
    a.deadlineAt = Date.now() + a.windowMs;
    if (logReset && !$runtime.autocompleteMode) {
      // No extra log line: the visual timer itself communicates the reset.
    }
    $runtime.startCountdownTicker();
  }

  function nextDelay() { return $runtime.state?.turbo || $runtime.autocompleteMode ? 35 : 420; }

  function cpuNominationDelay(manager) {
    if ($runtime.autocompleteMode) return 25 + Math.floor(Math.random()*65);
    if ($runtime.state?.turbo) return 100 + Math.floor(Math.random()*260);
    const archetype = $runtime.profileArchetype(manager);
    let min=520,max=1250;
    if (['spendaccione','bomber','collezionista'].includes(archetype)) { min=330; max=900; }
    if (['ragioniere','moneyball','esperto'].includes(archetype)) { min=700; max=1550; }
    if (archetype==='tirchio') { min=900; max=1800; }
    if (archetype==='pazzo') { min=280; max=1650; }
    return Math.round(min + Math.random()*(max-min));
  }

  function cpuReactionDelay(manager) {
    if ($runtime.autocompleteMode) return 20 + Math.floor(Math.random()*80);
    if ($runtime.state?.turbo) return 110 + Math.floor(Math.random()*420);

    const a = $runtime.state?.auction;
    const p = a ? $runtime.playerMap.get(a.playerId) : null;
    const profile = manager.profile || {};
    const archetype = $runtime.profileArchetype(manager);
    const limit = p ? $runtime.cpuLimit(manager,p) : 1;
    const headroom = a ? Math.max(0, limit - a.price) : limit;
    const roomRatio = $runtime.clamp(headroom / Math.max(8,limit),0,1);

    // Each archetype has a recognisable rhythm, while still varying every bid.
    let min = 700, max = 2700, sniperChance = .08;
    if (archetype === 'bomber')       { min=380; max=1550; sniperChance=.04; }
    if (archetype === 'spendaccione') { min=300; max=1450; sniperChance=.03; }
    if (archetype === 'collezionista'){ min=420; max=1650; sniperChance=.04; }
    if (archetype === 'ragioniere')   { min=1150; max=3000; sniperChance=.13; }
    if (archetype === 'tirchio')      { min=1500; max=3500; sniperChance=.18; }
    if (archetype === 'moneyball')    { min=950; max=2800; sniperChance=.12; }
    if (archetype === 'esperto')      { min=800; max=2600; sniperChance=.20; }
    if (archetype === 'pazzo')        { min=250; max=3600; sniperChance=.16; }
    if (archetype === 'tifoso') {
      const fav = p && profile.favoriteClub === p.club;
      min = fav ? 280 : 850; max = fav ? 1350 : 2750; sniperChance = fav ? .03 : .10;
    }

    if($runtime.isHotRival(manager) && a?.activeIds?.includes('user')) { min*=.88; max*=.90; sniperChance+=.03; }
    if($runtime.hasGoodRelations(manager) && a?.activeIds?.includes('user')) { min*=1.06; max*=1.08; sniperChance=Math.max(0,sniperChance-.02); }
    if($runtime.cpuRoleUrgencyState(manager,p?.role).active) { min*=.86; max*=.88; }

    // Lots of headroom -> instinctive fast raise. Close to the ceiling -> hesitation.
    if (roomRatio > .55) { min *= .72; max *= .78; }
    if (roomRatio < .18) { min *= 1.18; max *= 1.20; sniperChance += .08; }

    // Occasionally hold the bid until the last second. This is bounded below the 5s deadline.
    if(a?.arcade?.type==='hammer'){
      if(Math.random()<sniperChance)return Math.round(1500+Math.random()*300);
      return Math.round($runtime.clamp((min+Math.random()*(max-min))*.40,180,1650));
    }
    if (Math.random() < sniperChance) return Math.round(3650 + Math.random()*900);
    return Math.round($runtime.clamp(min + Math.random()*(max-min), 280, 4550));
  }

  function prepareArcadeAuction(nom,calledPlayer){
    const a=$runtime.state.auction;
    const types=['sealed','mystery'];
    const reserves=$runtime.state.availableIds.map(id=>$runtime.playerMap.get(id)).filter(p=>p && p.id!==calledPlayer.id && p.role===calledPlayer.role).sort((x,y)=>x.ovr-y.ovr);
    const second=reserves.slice(0,Math.max(1,Math.ceil(reserves.length/2)))[Math.floor(Math.random()*Math.max(1,Math.ceil(reserves.length/2)))];
    const bundleEligible=second?$runtime.state.managers.filter(m=>$runtime.AuctionEngine.maxBundleBid(m,[calledPlayer,second],$runtime.ROLE_LIMITS,$runtime.TOTAL_SLOTS)>=2):[];
    if(second && bundleEligible.length>=3 && bundleEligible.some(m=>m.id===nom.id)) types.push('bundle');
    if(a.activeIds.length<3) types.splice(types.indexOf('sealed'),1);
    types.push('hammer');
    const crossRolePool=!$runtime.openRoleAuction()?$runtime.state.availableIds.map(id=>$runtime.playerMap.get(id)).filter(p=>p && p.role!==calledPlayer.role && $runtime.canOwn(nom,p) && $runtime.maxLegalBid(nom,p)>=1):[];
    if(crossRolePool.length)types.push('switch');
    const type=window.FantaAuctionEvents.rollArcade(types);
    if(!type)return;
    a.arcade={type,awaitingAck:true};
    if(type==='mystery'){
      const pool=$runtime.state.availableIds.map(id=>$runtime.playerMap.get(id)).filter(p=>p && p.role===calledPlayer.role && $runtime.canOwn(nom,p));
      const chosen=pool[Math.floor(Math.random()*pool.length)];
      a.playerId=chosen.id;
      a.log=[{text:`${nom.team} chiama il Pacco sorpresa · ${$runtime.ROLE_LABELS[chosen.role]} · ${$runtime.clubName(chosen.club)}`,side:'1',kind:'status'}];
    } else if(type==='bundle'){
      a.arcade.secondPlayerId=second.id;
      a.activeIds=bundleEligible.map(m=>m.id);
      a.price=2;
      a.log=[{text:`${nom.team} chiama ${calledPlayer.name} + ${second.name}`,side:'2',kind:'status'}];
    } else if(type==='hammer'){
      a.arcade.windowMs=2000;
      a.log.push({text:'MARTELLO LAMPO · 2 secondi dopo ogni rilancio',side:'',kind:'status'});
    } else if(type==='switch'){
      a.arcade.originalRole=calledPlayer.role;
      a.arcade.crossRoleIds=crossRolePool.map(p=>p.id);
      const chosen=crossRolePool.slice().sort((x,y)=>$runtime.strategicPlayerScore(nom,y)-$runtime.strategicPlayerScore(nom,x) || String(x.id).localeCompare(String(y.id)))[0];
      a.playerId=chosen.id;
      a.activeIds=$runtime.state.managers.filter(m=>$runtime.canOwn(m,chosen)&&$runtime.maxLegalBid(m,chosen)>=1).map(m=>m.id);
      a.log=[{text:`Cambio di programma · ${nom.team} chiama ${chosen.name}`,side:'1',kind:'bid'}];
    } else {
      a.arcade.tieOrder=Array.from({length:$runtime.state.managers.length},(_,i)=>$runtime.state.managers[($runtime.state.nominationIndex+i)%$runtime.state.managers.length].id).filter(id=>a.activeIds.includes(id));
      // Generate each private offer once and persist it before displaying the form.
      a.arcade.offers=a.activeIds.filter(id=>id!=='user').map(id=>{
        const manager=$runtime.state.managers.find(m=>m.id===id);
        const limit=$runtime.cpuLimit(manager,calledPlayer);
        return {managerId:id,amount:Math.max(1,Math.min($runtime.maxLegalBid(manager,calledPlayer),Math.floor(limit*(.80+Math.random()*.20))))};
      });
      a.log=[{text:'Una sola offerta segreta a testa. Parità: precedenza al primo nell’ordine di chiamata.',side:'',kind:'status'}];
    }
  }

  function renderArcadeBanner(){
    let banner=$runtime.$('arcadeAuctionBanner');
    if(!banner){
      banner=document.createElement('div');banner.id='arcadeAuctionBanner';banner.className='arcade-auction-banner';
      $runtime.$('auctionName')?.parentElement?.appendChild(banner);
    }
    if(!banner)return;
    banner.hidden=!$runtime.state?.auction?.arcade;
    if($runtime.state?.auction?.arcade) banner.textContent=$runtime.ARCADE_AUCTION_LABELS[$runtime.state.auction.arcade.type];
  }

  function showArcadeModal(){
    const a=$runtime.state?.auction, ev=a?.arcade;
    if(!ev)return;
    $runtime.clearAuctionRuntimeTimers();
    if($runtime.autocompleteMode){
      ev.awaitingAck=false;
      if(ev.type==='sealed'){
        if(!ev.resolved){
          const user=$runtime.state.managers.find(m=>m.id==='user'),p=$runtime.playerMap.get(a.playerId);
          if(ev.tieOrder.includes('user'))ev.offers.push({managerId:'user',amount:Math.max(1,Math.min($runtime.maxLegalBid(user,p),$runtime.autoUserLimit(user,p)))});
          $runtime.resolveSealedAuction();
        }
        return $runtime.awardAuction();
      }
      $runtime.saveState();return $runtime.beginBidRound();
    }
    const modal=$runtime.$('arcadeAuctionModal'),p=$runtime.playerMap.get(a.playerId);
    modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');
    $runtime.$('arcadeAuctionTitle').textContent=$runtime.ARCADE_AUCTION_LABELS[ev.type];
    let body='',buttons='';
    if(ev.type==='sealed' && ev.resolved){
      body='<p>OFFERTE SVELATE</p>'+ev.offers.map(o=>`<p>${$runtime.escapeHtml($runtime.state.managers.find(m=>m.id===o.managerId)?.team||o.managerId)}: <strong>${o.amount?`${o.amount} crediti`:'PASS'}</strong></p>`).join('');
      buttons='<button type="button" class="primary" data-arcade-action="award">CONTINUA</button>';
    } else if(ev.type==='sealed'){
      const user=$runtime.state.managers.find(m=>m.id==='user'),max=$runtime.maxLegalBid(user,p);
      const participates=ev.tieOrder.includes('user') && max>=1;
      body='<p>Una sola offerta segreta per squadra. Chi offre di più prende il giocatore e paga la propria offerta. Le CPU hanno già preparato le loro: nessuno vede quelle degli altri.</p><p>In parità ha precedenza chi è prima nell’ordine di chiamata, a partire da chi ha chiamato.</p>';
      if(participates){
        body+=`<label for="arcadeSealedAmount">La tua offerta · da 1 a ${max} crediti</label><input id="arcadeSealedAmount" type="number" min="1" max="${max}" step="1" value="1" inputmode="numeric"><p id="arcadeSealedError" role="alert"></p>`;
        buttons='<button type="button" class="primary" data-arcade-action="submit">INVIA OFFERTA</button><button type="button" class="secondary" data-arcade-action="pass">PASSO</button>';
      } else {body+='<p>Non hai posti o crediti per partecipare a questa chiamata.</p>';buttons='<button type="button" class="primary" data-arcade-action="pass">SVELA OFFERTE</button>';}
    } else if(ev.type==='mystery'){
      body=`<p>L’admin ha estratto un giocatore: <strong>${$runtime.escapeHtml($runtime.ROLE_LABELS[p.role])} · ${$runtime.escapeHtml($runtime.clubName(p.club))}</strong>.</p><p>Nome, volto, OVR e quotazione verranno svelati all’aggiudicazione. Anche le CPU valutano solo ruolo e club.</p><p>${$runtime.auctionObserverActive()?'Il tuo Osservatore continua a mostrarti potenziale e probabilità di titolarità.':'Potenziale e probabilità di titolarità sono visibili con Osservatore.'} Scout non è utilizzabile su questa chiamata.</p>`;
      buttons='<button type="button" class="primary" data-arcade-action="start">INIZIA ASTA</button>';
    } else if(ev.type==='hammer'){
      body='<div class="arcade-lamp-clock">2<span>SECONDI</span></div><p>Il martello batte più in fretta! Hai <strong>2 secondi dopo ogni rilancio</strong>, invece di 5. Ogni nuova offerta riavvia i 2 secondi.</p><p>Le CPU reagiscono più velocemente. Il timer parte soltanto quando premi INIZIA ASTA; dalla prossima chiamata torna normale.</p>';
      buttons='<button type="button" class="primary" data-arcade-action="start">INIZIA ASTA</button>';
    } else if(ev.type==='switch'){
      const nom=$runtime.state.managers.find(m=>m.id===a.nominatorId);
      body=`<p>Per questa chiamata puoi uscire dal reparto <strong>${$runtime.escapeHtml($runtime.ROLE_LABELS[ev.originalRole])}</strong>. Dopo l’aggiudicazione si torna allo stesso reparto.</p>`;
      if(nom.id==='user'){
        body+=`<label for="arcadeCrossRolePlayer">Scegli un giocatore di un altro ruolo</label><select id="arcadeCrossRolePlayer">${ev.crossRoleIds.map(id=>$runtime.playerMap.get(id)).filter(p=>p&&$runtime.state.availableIds.includes(p.id)&&$runtime.canOwn(nom,p)&&$runtime.maxLegalBid(nom,p)>=1).map(candidate=>`<option value="${$runtime.escapeHtml(candidate.id)}" ${candidate.id===p.id?'selected':''}>${$runtime.escapeHtml($runtime.ROLE_LABELS[candidate.role])} · ${$runtime.escapeHtml(candidate.name)} · ${$runtime.escapeHtml($runtime.clubName(candidate.club))} · OVR ${candidate.ovr}</option>`).join('')}</select><p id="arcadeCrossRoleError" role="alert"></p>`;
      } else {body+=`<p><strong>${$runtime.escapeHtml(nom.team)}</strong> chiama:</p>${$runtime.auctionBundlePlayerMarkup(p)}`;}
      body+='<p>Partecipano solo le squadre con un posto libero nel ruolo scelto e crediti sufficienti.</p>';
      buttons='<button type="button" class="primary" data-arcade-action="start">INIZIA ASTA</button>';
    } else {
      const second=$runtime.playerMap.get(ev.secondPlayerId);
      body=`<div class="bundle-player-grid bundle-modal-preview">${$runtime.auctionBundlePlayerMarkup(p)}${$runtime.auctionBundlePlayerMarkup(second)}</div><p>Un’unica offerta acquista entrambi. Occorrono due posti liberi nel ruolo; partecipano solo le squadre che possono accoglierli e pagarli.</p><p>Base d’asta: 2 crediti. Per il costo individuale, 1 credito va alla riserva e il resto al primo giocatore. One Shot non è utilizzabile su questa chiamata.</p>`;
      buttons='<button type="button" class="primary" data-arcade-action="start">INIZIA ASTA</button>';
    }
    if(p && ['sealed','hammer'].includes(ev.type)){
      body=`<div class="arcade-called-player"><span>GIOCATORE IN ASTA</span><strong>${$runtime.escapeHtml(p.name)}</strong><small>${$runtime.escapeHtml($runtime.ROLE_LABELS[p.role])} · ${$runtime.escapeHtml($runtime.clubName(p.club))}</small></div>`+body;
    }
    $runtime.$('arcadeAuctionBody').innerHTML=body;
    $runtime.$('arcadeAuctionActions').innerHTML=buttons;
    (modal.querySelector('input,select')||modal.querySelector('button'))?.focus();
  }

  function resolveSealedAuction(){
    const a=$runtime.state.auction,ev=a.arcade;
    if(ev.resolved)return;
    const winner=window.FantaAuctionEvents.sealedWinner(ev.offers,ev.tieOrder);
    if(!winner)return;
    a.highBidderId=winner.managerId;a.price=winner.amount;ev.resolved=true;ev.awaitingAck=false;
    a.log=ev.offers.map(o=>({text:$runtime.state.managers.find(m=>m.id===o.managerId)?.team||o.managerId,side:o.amount?String(o.amount):'PASS',kind:'bid'}));
    $runtime.saveState();
  }

  function handleArcadeAction(action){
    const a=$runtime.state?.auction,ev=a?.arcade;
    if(!ev || a.awarding)return;
    if(ev.type==='sealed' && !ev.resolved && ['submit','pass'].includes(action)){
      const p=$runtime.playerMap.get(a.playerId),user=$runtime.state.managers.find(m=>m.id==='user');
      const amount=action==='pass'?0:Number($runtime.$('arcadeSealedAmount')?.value);
      if(action==='submit' && (!ev.tieOrder.includes('user') || !Number.isInteger(amount) || amount<1 || amount>$runtime.maxLegalBid(user,p))){
        if($runtime.$('arcadeSealedError'))$runtime.$('arcadeSealedError').textContent='Inserisci un’offerta intera entro il massimo consentito.';
        return;
      }
      if(ev.tieOrder.includes('user'))ev.offers.push({managerId:'user',amount});
      $runtime.resolveSealedAuction();$runtime.renderAuction();return $runtime.showArcadeModal();
    }
    if(action==='start' && ev.type!=='sealed'){
      if(ev.type==='switch' && a.nominatorId==='user' && !$runtime.autocompleteMode){
        const chosen=$runtime.playerMap.get($runtime.$('arcadeCrossRolePlayer')?.value),nom=$runtime.state.managers.find(m=>m.id===a.nominatorId);
        if(!chosen || !ev.crossRoleIds.includes(chosen.id) || chosen.role===ev.originalRole || !$runtime.state.availableIds.includes(chosen.id) || !$runtime.canOwn(nom,chosen) || $runtime.maxLegalBid(nom,chosen)<1){
          if($runtime.$('arcadeCrossRoleError'))$runtime.$('arcadeCrossRoleError').textContent='Scegli un giocatore disponibile con un posto libero nel suo ruolo.';return;
        }
        a.playerId=chosen.id;a.price=1;a.highBidderId=nom.id;
        a.activeIds=$runtime.state.managers.filter(m=>$runtime.canOwn(m,chosen)&&$runtime.maxLegalBid(m,chosen)>=1).map(m=>m.id);
        a.log=[{text:`Cambio di programma · ${nom.team} chiama ${chosen.name}`,side:'1',kind:'bid'}];
      }
      ev.awaitingAck=false;$runtime.saveState();$runtime.$('arcadeAuctionModal').classList.add('hidden');$runtime.$('arcadeAuctionModal').setAttribute('aria-hidden','true');return $runtime.beginBidRound();
    }
    if(action==='award' && ev.resolved){
      $runtime.$('arcadeAuctionModal').classList.add('hidden');$runtime.$('arcadeAuctionModal').setAttribute('aria-hidden','true');$runtime.awardAuction();
    }
  }

  function nominate(playerId, managerIndex) {
    if (!$runtime.state || $runtime.state.auction || $runtime.state.completed) return;
    $runtime.auditAndRepairState('pre-nomination');
    if ($runtime.state.nominationIndex !== managerIndex) return;
    const p = $runtime.playerMap.get(playerId);
    const nom = $runtime.state.managers[managerIndex];
    if (!p || (!$runtime.openRoleAuction() && p.role !== $runtime.currentAuctionRole()) || !$runtime.state.availableIds.includes(playerId) || !$runtime.canOwn(nom,p) || $runtime.maxLegalBid(nom,p)<1) return;
    const activeIds = $runtime.state.managers.filter(m => $runtime.canOwn(m,p) && $runtime.maxLegalBid(m,p)>=1).map(m=>m.id);
    if (!activeIds.includes(nom.id)) return;
    $runtime.closeNominationModal();
    $runtime.state.auction = {
      playerId,
      nominatorId: nom.id,
      price: 1,
      highBidderId: nom.id,
      activeIds,
      awaitingUser:false,
      log:[{text:`${nom.team} chiama ${p.name}`,side:'1',kind:'bid'}],
      deadlineAt:0,
      windowMs:$runtime.BID_WINDOW_MS,
      bidCount: 1,
      commentMoments:[],
      commentCount:0,
      lastCommentAt:0,
      userDuelCpuIds:[],
      lastDirectCpuId:null
    };
    $runtime.prepareArcadeAuction(nom,p);
    $runtime.registerNominationCall(nom.id,p.role);
    $runtime.tickAuctionEventEffectsOnNomination($runtime.state.auction.playerId);
    const pact = $runtime.state.auction.arcade?null:$runtime.activePactForPlayer(playerId);
    if (pact) $runtime.state.auction.pactActive = {cpuId:pact.cpuId, playerId};
    $runtime.saveState();
    $runtime.renderAll();
    if($runtime.state.auction.arcade){$runtime.beginBidRound();return;}
    if(!$runtime.autocompleteMode && $runtime.maybeTriggerAuctionEvent()) return;
    $runtime.beginBidRound();
  }

  function scheduleAdvance() {
    // Compatibility wrapper used by older flow/resume paths.
    $runtime.beginBidRound();
  }

  function adminOneShotScore(manager,player){
    if(!$runtime.canOwn(manager,player) || $runtime.maxLegalBid(manager,player)<1) return 0;
    const desired={P:1,D:4,C:4,A:3}[player.role]||1;
    const owned=(manager.roster||[]).filter(p=>p.role===player.role).map($runtime.currentPlayerOvr).sort((a,b)=>b-a);
    const ovr=$runtime.currentPlayerOvr(player);
    if(owned.length>=desired && ovr<=owned[desired-1]+2) return 0;
    return Math.max(1,$runtime.baseAuctionValue(player))*({P:.85,D:1,C:1.2,A:1.65}[player.role]||1)*Math.max(.5,1+(ovr-75)/100);
  }

  function tryAdminOneShot(){
    const a=$runtime.state?.auction;
    if(!a || a.awarding || a.powerPaused || a.awaitingAuctionEvent || a.arcade?.awaitingAck || $runtime.state.adminOneShot?.used || Number($runtime.state.career?.division)!==1 || $runtime.state.winterMarketFlow?.stage==='auction') return false;
    // Hidden identity, sealed offers and two-player packages retain their own rules.
    if(['mystery','sealed','bundle'].includes(a.arcade?.type)) return false;
    const admin=$runtime.state.managers.find(m=>m.id!=='user' && $runtime.profileArchetype(m)==='admin');
    const player=$runtime.playerMap.get(String(a.playerId));
    if(!admin || !player || !a.activeIds?.includes(admin.id) || a.blockedCpuIds?.includes(admin.id) || (a.highBidderId===admin.id && Number(a.price)===1)) return false;
    const score=$runtime.adminOneShotScore(admin,player);
    if(score<=0) return false;
    let best=score;
    for(const id of $runtime.state.availableIds||[]){
      const candidate=$runtime.playerMap.get(String(id));
      if(candidate) best=Math.max(best,$runtime.adminOneShotScore(admin,candidate));
    }
    if(score<best*.97) return false;
    $runtime.clearAuctionRuntimeTimers();
    $runtime.state.adminOneShot={used:true,managerId:admin.id,playerId:player.id,usedAt:Date.now()};
    a.price=1;a.highBidderId=admin.id;a.activeIds=[admin.id];
    a.awaitingUser=false;a.powerPaused=false;a.adminOneShotForced=true;
    a.log.push({text:'ADMIN USA ONE SHOT!',side:`${player.name} → 1 cr`,kind:'win'});
    if(a.log.length>120) a.log=a.log.slice(-120);
    $runtime.saveState();$runtime.renderAuction();$runtime.awardAuction();
    return true;
  }

  function beginBidRound() {
    if (!$runtime.state?.auction || $runtime.state.auction.awarding) return;
    if($runtime.state.auction.arcade?.awaitingAck || $runtime.state.auction.arcade?.type==='sealed') return $runtime.showArcadeModal();
    $runtime.state.auction.presenting=false; // Compatibilità con salvataggi creati prima della rimozione della micro-presentazione.
    $runtime.state.auction.awaitingAuctionEvent=false;
    if($runtime.tryAdminOneShot()) return;
    if($runtime.autoSkipUserIfCannotBid()) return;
    $runtime.cpuReactionTimers.forEach(t => clearTimeout(t));
    $runtime.cpuReactionTimers = [];
    $runtime.resetBidClock();
    $runtime.scheduleSuddenInterestEntry();
    $runtime.scheduleCpuReactions();
    $runtime.renderAuction();
  }

  function currentSuddenInterestEffect(){
    const a=$runtime.state?.auction;
    if(!a)return null;
    return $runtime.auctionEffects('sudden_interest').find(e=>e.playerId===a.playerId && !e.activated) || null;
  }

  function activateSuddenInterest(effect,{silent=false}={}){
    const a=$runtime.state?.auction;
    if(!a||!effect||effect.playerId!==a.playerId)return false;
    const cpu=$runtime.state.managers.find(m=>m.id===effect.cpuId), p=$runtime.playerMap.get(a.playerId);
    if(!cpu||!p||!a.activeIds.includes(cpu.id))return false;
    effect.activated=true;
    a.suddenInterestActivated=true;
    if(!silent) $runtime.showToast(`⚡ INTERESSE IMPROVVISO: ${cpu.profile?.label||cpu.team} entra forte su ${p.name}!`);
    $runtime.saveState();
    $runtime.renderAuction();
    return true;
  }

  function scheduleSuddenInterestEntry(){
    const a=$runtime.state?.auction, effect=$runtime.currentSuddenInterestEffect();
    if(!a||!effect||a.suddenInterestScheduled)return false;
    const cpu=$runtime.state.managers.find(m=>m.id===effect.cpuId);
    if(!cpu||!a.activeIds.includes(cpu.id))return false;
    if(a.highBidderId===cpu.id){
      $runtime.activateSuddenInterest(effect,{silent:true});
      return false;
    }
    a.suddenInterestScheduled=true;
    const delay=$runtime.autocompleteMode?35:($runtime.state?.turbo?420:1250+Math.floor(Math.random()*750));
    if($runtime.suddenInterestTimer) clearTimeout($runtime.suddenInterestTimer);
    $runtime.suddenInterestTimer=setTimeout(()=>{
      $runtime.suddenInterestTimer=null;
      const live=$runtime.state?.auction;
      if(!live||live.playerId!==effect.playerId||live.awarding)return;
      if(!$runtime.activateSuddenInterest(effect))return;
      if(live.highBidderId!==cpu.id && live.activeIds.includes(cpu.id)){
        const timer=setTimeout(()=>$runtime.cpuReact(cpu.id), $runtime.autocompleteMode?20:180+Math.floor(Math.random()*260));
        $runtime.cpuReactionTimers.push(timer);
      }
    },delay);
    return true;
  }

  function scheduleCpuReactions() {
    const a = $runtime.state?.auction;
    if (!a) return;
    const p = $runtime.playerMap.get(a.playerId);
    if (!p) return;

    // V3.2.35.41: nessuna chiusura anticipata perché le CPU sembrano aver finito.
    // Tutte le CPU ancora formalmente nella chiamata possono avere il loro momento
    // di reazione; quelle che non rilanciano semplicemente fanno scorrere il tempo.
    // L'aggiudicazione normale avviene solo allo scadere del countdown.
    const challengers = a.activeIds.filter(id=>id!==a.highBidderId);

    const pendingSudden=$runtime.currentSuddenInterestEffect();
    challengers.forEach(id => {
      const m = $runtime.state.managers.find(x=>x.id===id);
      if (!m) return;
      if (m.id==='user' && !$runtime.autocompleteMode) return; // Human can bid at any time inside the 5-second window.
      if (pendingSudden && pendingSudden.cpuId===m.id) return; // entrerà più tardi come evento INTERESSE IMPROVVISO.
      const timer = setTimeout(() => $runtime.cpuReact(m.id), $runtime.cpuReactionDelay(m));
      $runtime.cpuReactionTimers.push(timer);
    });
  }

  function flashBidder(managerId, increment, target) {
    if(!$runtime.autocompleteMode && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){
      $runtime.$('currentPrice')?.animate?.([{transform:'translateY(4px) scale(.9)',color:'#ffffff'},{transform:'translateY(-3px) scale(1.1)',color:'#ffd84d'},{transform:'translateY(0) scale(1)'}],{duration:260,easing:'ease-out'});
    }
    $runtime.lastBidFlash = {managerId, increment, target, until: Date.now() + 1250};
    if ($runtime.bidFlashTimer) clearTimeout($runtime.bidFlashTimer);
    $runtime.renderAuctionRoomList();
    $runtime.bidFlashTimer = setTimeout(() => {
      $runtime.lastBidFlash = null;
      $runtime.bidFlashTimer = null;
      if ($runtime.state?.auction) $runtime.renderAuctionRoomList();
    }, 1280);
  }

  function bidReaction(manager, player) {
    if (manager?.id === 'user') return 'Hai rilanciato. Ora tocca agli avversari.';
    const archetype = $runtime.profileArchetype(manager);
    if (archetype === 'tifoso' && manager?.profile?.favoriteClub === player?.club) return 'È uno dei miei: non posso lasciarlo!';
    const lines = $runtime.RIVAL_BID_REACTIONS[archetype] || ['Non mi tiro indietro.'];
    return lines[Number($runtime.state?.auction?.bidCount || 0) % lines.length];
  }

  function bidCommentMoment(manager, increment, previousLeaderId) {
    const a = $runtime.state?.auction;
    if (!a || $runtime.autocompleteMode || manager?.id === 'user') return null;
    a.commentMoments = Array.isArray(a.commentMoments) ? a.commentMoments : [];
    a.commentCount = Number(a.commentCount || 0);
    a.lastCommentAt = Number(a.lastCommentAt || 0);
    if (a.commentCount >= 2 || Date.now() - a.lastCommentAt < 4000) return null;

    const archetype = $runtime.profileArchetype(manager);
    let moment = null;
    if (archetype === 'rivale' && previousLeaderId === 'user') moment = 'rivalry';
    else if (a.activeIds.length <= 2 && Number(a.bidCount||0) >= 4) moment = 'duel';
    else if (increment >= 10 && Number(a.bidCount||0) >= 3) moment = 'big';
    else if (Number(a.bidCount||0) === 2) moment = 'opening';

    if (!moment || a.commentMoments.includes(moment)) return null;
    a.commentMoments.push(moment);
    a.commentCount += 1;
    a.lastCommentAt = Date.now();
    return moment;
  }

  function showBidSpotlight(manager, player, target, increment, previousLeaderId) {
    const box = $runtime.$('bidSpotlight');
    if (!box || $runtime.autocompleteMode || $runtime.state?.auction?.arcade?.type==='mystery') return;
    const moment = $runtime.bidCommentMoment(manager, increment, previousLeaderId);
    if (!moment) return;
    const archetype = $runtime.profileArchetype(manager);
    const art = manager?.id === 'user' ? null : $runtime.RIVAL_ART[archetype];
    const image = $runtime.$('bidSpotlightImage');
    const initials = $runtime.$('bidSpotlightInitials');
    if (art) {
      image.src = `assets/rivals/${art}.webp`;
      image.alt = manager?.profile?.label || manager?.name || 'Allenatore';
      image.classList.remove('hidden');
      initials.classList.add('hidden');
    } else {
      image.classList.add('hidden');
      initials.classList.remove('hidden');
      initials.textContent = $runtime.playerInitials(manager?.name || 'Tu');
    }
    const momentLabels = {opening:'PRIMO RILANCIO',big:'RILANCIO PESANTE',duel:'DUELLO FINALE',rivalry:'SFIDA DIRETTA'};
    $runtime.$('bidSpotlightLabel').textContent = momentLabels[moment] || 'MOMENTO DELL’ASTA';
    $runtime.$('bidSpotlightName').textContent = manager?.profile?.label || manager?.team || 'Allenatore';
    $runtime.$('bidSpotlightReaction').textContent = $runtime.bidReaction(manager, player);
    const priceCaption=box.querySelector('.bid-spotlight-price small'); if(priceCaption) priceCaption.textContent='NUOVA OFFERTA';
    box.classList.remove('loss-reaction');
    $runtime.$('bidSpotlightPrice').textContent = String(target);
    $runtime.$('bidSpotlightIncrement').textContent = `+${increment}`;
    box.classList.remove('hidden','show');
    void box.offsetWidth;
    box.classList.add('show');
    if ($runtime.bidSpotlightTimer) clearTimeout($runtime.bidSpotlightTimer);
    $runtime.bidSpotlightTimer = setTimeout(() => {
      box.classList.remove('show');
      $runtime.bidSpotlightTimer = setTimeout(() => { box.classList.add('hidden'); $runtime.bidSpotlightTimer=null; }, 220);
    }, 1450);
  }

  function showAwardAnimation(player, winner, price) {
    const overlay = $runtime.$('awardOverlay');
    if (!overlay) return;
    if($runtime.$('awardPlayerAvatar')) $runtime.$('awardPlayerAvatar').innerHTML=$runtime.playerAvatarMarkup(player,player?.name||'Giocatore');
    if($runtime.$('awardTransferTeam')) $runtime.$('awardTransferTeam').textContent=winner?.team||'Squadra';
    const adminPower=!!$runtime.state?.auction?.adminOneShotForced;
    if($runtime.$('awardBannerTitle')) $runtime.$('awardBannerTitle').textContent=adminPower?'ADMIN USA ONE SHOT!':'AGGIUDICATO!';
    if($runtime.$('awardAdminPortrait')) $runtime.$('awardAdminPortrait').hidden=!adminPower;
    overlay.classList.toggle('is-admin-one-shot',adminPower);
    if ($runtime.$('awardPlayerName')) $runtime.$('awardPlayerName').textContent = player?.name || 'Giocatore';
    if ($runtime.$('awardWinnerName')) $runtime.$('awardWinnerName').textContent = winner?.team || 'Squadra';
    if ($runtime.$('awardPrice')) $runtime.$('awardPrice').textContent = String(price ?? '');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  function hideAwardAnimation() {
    const overlay = $runtime.$('awardOverlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    overlay.classList.add('hidden');
  }

  function awardLossReactionData(auction,player,winner,price){
    if($runtime.autocompleteMode || winner?.id!=='user' || !auction || !player) return null;
    const duelIds=Array.isArray(auction.userDuelCpuIds)?auction.userDuelCpuIds:[];
    if(!duelIds.length || Number(auction.bidCount||0)<5) return null;
    const cpuId=auction.lastDirectCpuId && duelIds.includes(auction.lastDirectCpuId)?auction.lastDirectCpuId:duelIds[duelIds.length-1];
    const cpu=$runtime.state.managers.find(m=>m.id===cpuId);
    if(!cpu) return null;
    const market=$runtime.baseAuctionValue(player), top=$runtime.TOP_VALUE_THRESHOLD[player.role]||20;
    const important=market>=top*.65 || Number(price||0)>=Math.max(12,Math.round(market*.85));
    if(!important) return null;
    let chance=.48;
    if($runtime.isHotRival(cpu)) chance+=.18;
    if($runtime.hasGoodRelations(cpu)) chance-=.22;
    if(Number(auction.bidCount||0)>=8) chance+=.10;
    if($runtime.careerHash(`loss-reaction|${cpu.id}|${player.id}`)>=$runtime.clamp(chance,.12,.82)) return null;
    const lines=$runtime.hasGoodRelations(cpu)
      ? ['Ci sta. Affare tuo.','Nessun problema, si va avanti.','Questa te la lascio.']
      : ($runtime.RIVAL_LOSS_REACTIONS[$runtime.profileArchetype(cpu)]||['Me lo ricorderò.','Te lo lascio, stavolta.']);
    return {cpu,text:lines[Math.floor($runtime.careerHash(`loss-reaction-line|${cpu.id}|${player.id}`)*lines.length)%lines.length]};
  }

  function showAwardLossReaction(cpu,player,price){
    const box=$runtime.$('bidSpotlight'); if(!box || !cpu || !player || $runtime.autocompleteMode) return false;
    const art=$runtime.RIVAL_ART[$runtime.profileArchetype(cpu)], image=$runtime.$('bidSpotlightImage'), initials=$runtime.$('bidSpotlightInitials');
    if(art){ image.src=`assets/rivals/${art}.webp`; image.alt=cpu.profile?.label||cpu.name||'Allenatore'; image.classList.remove('hidden'); initials.classList.add('hidden'); }
    else { image.classList.add('hidden'); initials.classList.remove('hidden'); initials.textContent=$runtime.playerInitials(cpu.name||cpu.team); }
    const data=$runtime.awardLossReactionData($runtime.state?.auction,player,$runtime.state.managers.find(m=>m.id==='user'),price);
    if(!data) return false;
    $runtime.$('bidSpotlightLabel').textContent='REAZIONE DOPO IL DUELLO';
    $runtime.$('bidSpotlightName').textContent=cpu.profile?.label||cpu.team;
    $runtime.$('bidSpotlightReaction').textContent=data.text;
    const priceCaption=box.querySelector('.bid-spotlight-price small'); if(priceCaption) priceCaption.textContent='AGGIUDICATO';
    $runtime.$('bidSpotlightPrice').textContent=String(price);
    $runtime.$('bidSpotlightIncrement').textContent='DUELLO PERSO';
    box.classList.add('loss-reaction');
    box.classList.remove('hidden','show'); void box.offsetWidth; box.classList.add('show');
    if($runtime.bidSpotlightTimer) clearTimeout($runtime.bidSpotlightTimer);
    $runtime.bidSpotlightTimer=setTimeout(()=>{box.classList.remove('show'); $runtime.bidSpotlightTimer=setTimeout(()=>{box.classList.add('hidden');box.classList.remove('loss-reaction');$runtime.bidSpotlightTimer=null;},180);},980);
    return true;
  }

  function cpuReact(managerId) {
    $runtime.auditAndRepairState('pre-cpu-bid');
    const a = $runtime.state?.auction;
    if (!a || a.arcade?.awaitingAck || a.arcade?.type==='sealed' || Date.now() >= Number(a.deadlineAt||0)) return;
    if (!a.activeIds.includes(managerId) || a.highBidderId===managerId) return;
    const m = $runtime.state.managers.find(x=>x.id===managerId);
    const p = $runtime.playerMap.get(a.playerId);
    if (!m || !p) return;
    if (Array.isArray(a.blockedCpuIds) && a.blockedCpuIds.includes(m.id)) {
      a.activeIds = a.activeIds.filter(id=>id!==m.id);
      $runtime.addAuctionLog(m.team, 'BLOCCATO', 'status'); $runtime.saveState(); $runtime.renderManagers(); $runtime.renderAuction();
      // Anche quando una CPU viene esclusa, il countdown resta vivo: niente chiusure anticipate.
      return;
    }

    const pact = $runtime.activePactForPlayer(p.id);
    if (pact && pact.cpuId===m.id && a.highBidderId==='user' && !pact.cpuBetrayed) {
      if ($runtime.cpuKeepsPact(m,pact)) {
        a.activeIds = a.activeIds.filter(id=>id!==m.id);
        $runtime.addAuctionLog(m.team, 'PATTO', 'status'); $runtime.saveState(); $runtime.renderManagers();
        // Il patto toglie la CPU dalla chiamata, ma non accelera la chiusura dell'asta.
        return;
      }
      pact.cpuBetrayed=true; $runtime.changeRelationship(m.id,-18,18,'tradimento_cpu');
      $runtime.showToast(`${m.profile?.label||m.team} ha tradito il patto su ${p.name}!`, true);
    }

    const limit = m.id==='user' ? $runtime.autoUserLimit(m,p) : $runtime.cpuLimit(m,p);
    if (limit <= a.price || $runtime.maxLegalBid(m,p) <= a.price) {
      // V3.2.35.41: le CPU non dichiarano più PASS durante la chiamata.
      // Se non vogliono/possono rilanciare, restano silenziose e lasciano scorrere
      // il timer fino alla fine. In questo modo un'altra CPU può ancora entrare
      // con un rilancio tardivo e la chiamata non si chiude in anticipo.
      return;
    }

    const oldPrice = a.price;
    const previousLeaderId = a.highBidderId;
    if(previousLeaderId==='user') $runtime.registerDirectAuctionDuel(m.id);
    const inc = Math.min($runtime.jumpSize(m,a.price,limit,p), limit-a.price);
    const target = Math.min(limit, a.price + Math.max(1,inc));
    a.price = target;
    a.highBidderId = m.id;
    a.bidCount = Number(a.bidCount||0) + 1;
    $runtime.flashBidder(m.id, target-oldPrice, target);
    $runtime.showBidSpotlight(m, p, target, target-oldPrice, previousLeaderId);
    $runtime.addAuctionLog(m.team, String(target), 'bid');
    if($runtime.autoSkipUserIfCannotBid()) return;
    $runtime.renderManagers();
    $runtime.saveState();
    // Fundamental V1.3 rule: every valid raise restarts the full countdown.
    $runtime.beginBidRound();
  }

  function advanceAuction() {
    // Kept for compatibility with any saved/event path; the live auction is now clock-driven.
    if ($runtime.state?.auction) $runtime.beginBidRound();
  }

  function ensureManagerTeamIdentityState(){
    if(!$runtime.state?.managers) return;
    $runtime.state.managers.forEach(m=>{
      if(m.id==='user') return;
      if(!m.teamColors){
        const fallback=$runtime.FIXTURE_TEAM_COLORS?.[$runtime.profileArchetype(m)] || {primary:'#3d7dff',secondary:'#1b2238'};
        m.teamColors={primary:fallback.primary,secondary:fallback.secondary};
      }
    });
  }

  function ensureAuctionPowers(){
    if(!$runtime.state.auctionPowers) $runtime.state.auctionPowers={block:false,scout:false,bluff:false,observer:false,oneShot:false,uses:{block:0,scout:0,bluff:0,oneShot:0},selected:[]};
    // I vecchi salvataggi avevano automaticamente tutti e tre i poteri.
    if(!Array.isArray($runtime.state.auctionPowers.selected)) $runtime.state.auctionPowers.selected=['block','scout','bluff'];
    if($runtime.state.auctionPowers.oneShot===undefined) $runtime.state.auctionPowers.oneShot=false;
    if(!$runtime.state.auctionPowers.uses || typeof $runtime.state.auctionPowers.uses!=='object'){
      $runtime.state.auctionPowers.uses={
        block:$runtime.state.auctionPowers.block?1:0,
        scout:$runtime.state.auctionPowers.scout?1:0,
        bluff:$runtime.state.auctionPowers.bluff?1:0,
        oneShot:$runtime.state.auctionPowers.oneShot?1:0
      };
    }
    ['block','scout','bluff','oneShot'].forEach(k=>{
      const max=k==='oneShot'?1:5;
      $runtime.state.auctionPowers.uses[k]=Math.max(0,Math.min(max,Number($runtime.state.auctionPowers.uses[k]||0)));
    });
    return $runtime.state.auctionPowers;
  }

  function auctionPowerMaxUses(power){ return power==='oneShot'?1:5; }

  function auctionPowerUses(power){ return Number($runtime.ensureAuctionPowers().uses?.[power]||0); }

  function consumeAuctionPower(power){
    const powers=$runtime.ensureAuctionPowers();
    powers.uses[power]=Math.min($runtime.auctionPowerMaxUses(power),$runtime.auctionPowerUses(power)+1);
    if(power in powers) powers[power]=powers.uses[power]>0; // compatibilità salvataggi precedenti
  }

  function canUseOneShot(){
    const a=$runtime.state?.auction, user=$runtime.state?.managers?.find(m=>m.id==='user'), p=a&&$runtime.playerMap.get(a.playerId);
    return !!(a && user && p && $runtime.canOwn(user,p) && $runtime.maxLegalBid(user,p)>=1);
  }

  function renderAuctionPowers(){
    if(!$runtime.$('auctionPowers')) return;
    const powers=$runtime.ensureAuctionPowers(), a=$runtime.state?.auction;
    const defs=[['block','powerBlockBtn','powerBlockCount'],['scout','powerScoutBtn','powerScoutCount'],['bluff','powerBluffBtn','powerBluffCount'],['observer','powerObserverBtn','powerObserverCount'],['oneShot','powerOneShotBtn','powerOneShotCount']];
    defs.forEach(([key,bid,cid])=>{
      const btn=$runtime.$(bid), count=$runtime.$(cid); if(!btn)return;
      const selected=powers.selected.includes(key);
      const passive=key==='observer';
      const maxUses=passive?0:$runtime.auctionPowerMaxUses(key);
      const usedCount=passive?0:$runtime.auctionPowerUses(key);
      const exhausted=!passive && usedCount>=maxUses;
      const alreadyActive=(key==='bluff' && !!a?.bluffActive) || (key==='scout' && !!a?.scoutUsedThisCall);
      const unavailableOneShot=key==='oneShot' && !$runtime.canUseOneShot();
      btn.disabled=!!a?.arcade?.awaitingAck || a?.arcade?.type==='sealed' || (a?.arcade?.type==='mystery'&&key==='scout') || (a?.arcade?.type==='bundle'&&key==='oneShot') || passive || !selected || exhausted || alreadyActive || unavailableOneShot || !a || !!a.awarding || $runtime.autocompleteMode;
      btn.classList.toggle('used',exhausted);
      btn.classList.toggle('power-not-selected',!selected);
      btn.classList.toggle('passive-power',passive&&selected);
      btn.classList.toggle('active-power', (key==='bluff' && !!a?.bluffActive) || (passive&&selected));
      if(count) count.textContent=!selected?'NON SCELTO':(passive?'ATTIVO':`${Math.max(0,maxUses-usedCount)}/${maxUses}`);
    });
  }

  function auctionPowerTargets(){
    const a=$runtime.state?.auction; if(!a)return [];
    return $runtime.state.managers.filter(m=>m.id!=='user' && a.activeIds.includes(m.id));
  }

  function pauseForAuctionPower(){
    if(!$runtime.state?.auction)return;
    $runtime.clearAuctionRuntimeTimers();
    $runtime.state.auction.powerPaused=true;
    $runtime.state.auction.deadlineAt=0;
    $runtime.renderCountdown();
  }

  function resumeAfterAuctionPower(){
    if(!$runtime.state?.auction)return;
    $runtime.state.auction.powerPaused=false;
    $runtime.saveState(); $runtime.renderAuction(); $runtime.beginBidRound();
  }

  function openAuctionPower(power){
    const powers=$runtime.ensureAuctionPowers(),a=$runtime.state?.auction;
    if(!powers.selected.includes(power)){$runtime.showToast('Questo Fantapotere non fa parte della tua selezione.',true);return;}
    if(!a || a.awarding || $runtime.autocompleteMode)return;
    if(power!=='observer' && $runtime.auctionPowerUses(power)>=$runtime.auctionPowerMaxUses(power)){$runtime.showToast('Hai esaurito gli utilizzi di questo Fantapotere.',true);return;}
    if(power==='oneShot') return $runtime.useOneShotPower();
    if(power==='bluff') return $runtime.useBluffPower();
    if(power==='scout') return $runtime.useScoutPower();
    const targets=$runtime.auctionPowerTargets();
    if(!targets.length){$runtime.showToast('Non ci sono CPU disponibili per questo potere.',true);return;}
    $runtime.pauseForAuctionPower();
    const modal=$runtime.$('auctionPowerModal'), p=$runtime.playerMap.get(a.playerId);
    modal.dataset.power=power;
    $runtime.$('auctionPowerIcon').textContent='🔒';
    $runtime.$('auctionPowerTitle').textContent='BLOCCO — scegli l’avversario';
    $runtime.$('auctionPowerDescription').textContent=`Scegli una CPU: non potrà più rilanciare su ${a.arcade?.type==='mystery'?'il Pacco sorpresa':p.name}. Se è in testa, il suo rilancio resta valido ma non potrà contro-rilanciare dopo essere stata superata.`;
    $runtime.$('auctionPowerBody').innerHTML=`<div class="auction-power-targets">${targets.map(m=>{const art=$runtime.RIVAL_ART[$runtime.profileArchetype(m)];return `<button class="auction-power-target" data-power-target="${m.id}">${art?`<img src="assets/rivals/${art}.webp" alt="">`:'<span></span>'}<span><b>${$runtime.escapeHtml(m.profile?.label||m.team)}</b><small>${$runtime.escapeHtml(m.team)} · ${m.budget} cr</small></span><strong>${m.id===a.highBidderId?'IN TESTA':'IN ASTA'}</strong></button>`}).join('')}</div>`;
    modal.querySelectorAll('[data-power-target]').forEach(b=>b.onclick=()=>$runtime.resolveAuctionPowerTarget(power,b.dataset.powerTarget));
    modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');
  }

  function useScoutPower(){
    const a=$runtime.state?.auction,powers=$runtime.ensureAuctionPowers(); if(!a||$runtime.auctionPowerUses('scout')>=5||a.scoutUsedThisCall)return;
    const p=$runtime.playerMap.get(a.playerId); if(!p)return;
    const cpus=($runtime.state.managers||[]).filter(m=>m.id!=='user');
    if(!cpus.length){$runtime.showToast('Non ci sono avversari da analizzare.',true);return;}

    $runtime.pauseForAuctionPower();
    $runtime.consumeAuctionPower('scout');
    a.scoutUsedThisCall=true;

    const modal=$runtime.$('auctionPowerModal');
    modal.dataset.power='scout';
    $runtime.$('auctionPowerIcon').textContent='👁️';
    $runtime.$('auctionPowerTitle').textContent='SCOUT — analisi completa';
    $runtime.$('auctionPowerDescription').textContent=`Stima del limite di spesa di tutti gli avversari su ${p.name}. Gli intervalli sono indicativi e possono cambiare durante il duello.`;

    $runtime.$('auctionPowerBody').innerHTML=`<div class="auction-scout-all">${cpus.map(m=>{
      const exact=$runtime.cpuLimit(m,p);
      const low=exact<=0?0:Math.max(1,Math.floor((exact-3)/5)*5);
      const high=exact<=0?0:Math.max(low+2,Math.ceil((exact+3)/5)*5);
      const active=a.activeIds.includes(m.id);
      const status=m.id===a.highBidderId?'IN TESTA':(active?'IN ASTA':'FUORI');
      const limitText=exact<=0?'NON INTERESSATO':`${low}–${high} cr`;
      const art=$runtime.RIVAL_ART[$runtime.profileArchetype(m)];
      return `<div class="auction-scout-row ${active?'is-active':'is-out'}">
        <div class="auction-scout-avatar">${art?`<img src="assets/rivals/${art}.webp" alt="">`:`<span>${$runtime.escapeHtml($runtime.playerInitials(m.name||'?'))}</span>`}</div>
        <div class="auction-scout-copy"><b>${$runtime.escapeHtml(m.profile?.label||m.team)}</b><small>${$runtime.escapeHtml(m.team)} · ${m.budget} cr</small></div>
        <div class="auction-scout-limit"><strong>${limitText}</strong><small>${status}</small></div>
      </div>`;
    }).join('')}</div>`;

    $runtime.saveState();
    $runtime.renderAuctionPowers();
    const old=$runtime.$('auctionPowerCancel');
    old.textContent='Continua l’asta';
    old.onclick=()=>$runtime.closeAuctionPowerModal(true);
    modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');
  }

  function closeAuctionPowerModal(resume=true){
    const modal=$runtime.$('auctionPowerModal'); if(modal){modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');modal.dataset.power='';}
    if(resume && $runtime.state?.auction?.powerPaused) $runtime.resumeAfterAuctionPower();
  }

  function resolveAuctionPowerTarget(power,cpuId){
    const a=$runtime.state?.auction,m=$runtime.state?.managers?.find(x=>x.id===cpuId),p=a&&$runtime.playerMap.get(a.playerId); if(!a||!m||!p)return;
    const powers=$runtime.ensureAuctionPowers();
    if(power==='block'){
      if($runtime.auctionPowerUses('block')>=5){$runtime.showToast('Hai esaurito i 5 BLOCCO disponibili.',true);return $runtime.closeAuctionPowerModal(true);}
      $runtime.consumeAuctionPower('block'); a.blockedCpuIds=Array.isArray(a.blockedCpuIds)?a.blockedCpuIds:[]; if(!a.blockedCpuIds.includes(cpuId))a.blockedCpuIds.push(cpuId);
      if(a.highBidderId!==cpuId) a.activeIds=a.activeIds.filter(id=>id!==cpuId);
      $runtime.addAuctionLog('POTERE', `BLOCCO su ${m.profile?.label||m.team}`, 'status');
      $runtime.showToast(`${m.profile?.label||m.team} è stato bloccato su ${a.arcade?.type==='mystery'?'il Pacco sorpresa':p.name}.`);
      $runtime.closeAuctionPowerModal(false); $runtime.saveState(); $runtime.renderAuction();
      if(!a.activeIds.filter(id=>id!==a.highBidderId).length){$runtime.clearAuctionRuntimeTimers();return $runtime.awardAuction();}
      return $runtime.resumeAfterAuctionPower();
    }
  }

  function useBluffPower(){
    const a=$runtime.state?.auction; if(!a||$runtime.auctionPowerUses('bluff')>=5||a.bluffActive)return;
    $runtime.consumeAuctionPower('bluff');
    a.bluffActive=true;
    $runtime.addAuctionLog('POTERE','BLUFF ATTIVO','bid');
    $runtime.showToast(`BLUFF attivo: le CPU rivaluteranno al rialzo questo giocatore. Te ne restano ${5-$runtime.auctionPowerUses('bluff')}.`);
    $runtime.saveState(); $runtime.renderAuction(); $runtime.beginBidRound();
  }

  function useOneShotPower(){
    const a=$runtime.state?.auction, powers=$runtime.ensureAuctionPowers();
    if(!a || !powers.selected.includes('oneShot') || $runtime.auctionPowerUses('oneShot')>=1 || a.awarding || $runtime.autocompleteMode)return;
    const p=$runtime.playerMap.get(a.playerId), user=$runtime.state.managers.find(m=>m.id==='user');
    if(!p || !user || !$runtime.canOwn(user,p) || $runtime.maxLegalBid(user,p)<1){
      $runtime.showToast('ONE SHOT non è utilizzabile su questo giocatore: non hai uno slot rosa valido o credito legale sufficiente.',true);
      return;
    }
    $runtime.clearAuctionRuntimeTimers();
    $runtime.consumeAuctionPower('oneShot');
    a.price=1;
    a.highBidderId='user';
    a.activeIds=['user'];
    a.awaitingUser=false;
    a.powerPaused=false;
    a.oneShotForced=true;
    a.log.push({text:'ONE SHOT',side:`${p.name} → 1 cr`,kind:'win'});
    if(a.log.length>120) a.log=a.log.slice(-120);
    $runtime.showToast(`ONE SHOT! ${p.name} è tuo per 1 credito.`);
    $runtime.saveState();
    $runtime.renderAuction();
    $runtime.awardAuction();
  }

  function autoUserLimit(manager,p) {
    const synthetic = {...manager, profile:{...$runtime.PERSONALITIES[0], id:'autouser', label:'CPU neutrale'}};
    let limit = $runtime.cpuLimit(synthetic,p);
    const info = $runtime.auctionEffects('reserved_info').find(e=>e.playerId===p.id);
    if (info && info.trusted) limit = Math.max(1, Math.floor(limit * .72));
    return limit;
  }

  function userBid(increment) {
    $runtime.auditAndRepairState('pre-user-bid');
    const a = $runtime.state?.auction;
    if (!a || a.arcade?.awaitingAck || a.arcade?.type==='sealed' || $runtime.autocompleteMode || !a.activeIds.includes('user') || a.highBidderId==='user') return;
    if (Date.now() >= Number(a.deadlineAt||0)) return;
    const me = $runtime.state.managers[0];
    const p = $runtime.playerMap.get(a.playerId);
    const pact = $runtime.activePactForPlayer(p.id);
    if (pact && a.highBidderId===pact.cpuId && !pact.userBetrayed) {
      return $runtime.showPactBetrayPrompt(pact, increment);
    }
    const target = a.price + increment;
    if (target > $runtime.maxLegalBid(me,p)) return;
    a.awaitingUser = false;
    const oldPrice = a.price;
    const previousLeaderId = a.highBidderId;
    if(previousLeaderId && previousLeaderId!=='user') $runtime.registerDirectAuctionDuel(previousLeaderId);
    a.price = target;
    a.highBidderId = 'user';
    a.bidCount = Number(a.bidCount||0) + 1;
    $runtime.flashBidder('user', target-oldPrice, target);
    $runtime.showBidSpotlight(me, p, target, target-oldPrice, previousLeaderId);
    $runtime.addAuctionLog(me.team, String(target), 'bid');
    $runtime.saveState();
    // Every human raise also restarts the full five seconds.
    $runtime.beginBidRound();
  }

  function fastForwardCpuAuctionAfterUserPass() {
    if($runtime.tryAdminOneShot()) return;
    const a = $runtime.state?.auction;
    if (!a) return;
    const p = $runtime.playerMap.get(a.playerId);
    if (!p) return;

    // The human has left this player permanently: from here on we resolve the
    // CPU-only auction synchronously using the same limits, jump sizes and
    // reaction-priority logic as the timed auction. This preserves the result
    // without forcing the player to watch every CPU-vs-CPU raise.
    const pendingSudden=$runtime.currentSuddenInterestEffect();
    if(pendingSudden) $runtime.activateSuddenInterest(pendingSudden,{silent:true});
    $runtime.clearAuctionRuntimeTimers();
    $runtime.auditAndRepairState('pre-fast-forward-after-user-pass');

    const pushLog = (text, side='', kind='') => {
      a.log.push({text,side,kind});
      if (a.log.length > 120) a.log = a.log.slice(-120);
    };

    let guard = 0;
    const MAX_STEPS = 600;
    while ($runtime.state?.auction === a && guard++ < MAX_STEPS) {
      // Drop CPUs that can no longer legally or strategically beat the price.
      const stillActive = [];
      for (const id of a.activeIds) {
        if (id === a.highBidderId) {
          stillActive.push(id);
          continue;
        }
        const m = $runtime.state.managers.find(x => x.id === id);
        if (!m || id === 'user') continue;
        const limit = $runtime.cpuLimit(m,p);
        if (limit <= a.price || $runtime.maxLegalBid(m,p) <= a.price) {
          // Eliminazione interna e silenziosa: le CPU non mostrano più PASS.
          continue;
        }
        stillActive.push(id);
      }
      a.activeIds = stillActive;

      const challengers = a.activeIds
        .filter(id => id !== a.highBidderId && id !== 'user')
        .map(id => {
          const m = $runtime.state.managers.find(x => x.id === id);
          return m ? {m, limit:$runtime.cpuLimit(m,p), delay:$runtime.cpuReactionDelay(m)} : null;
        })
        .filter(Boolean)
        .filter(x => x.limit > a.price && $runtime.maxLegalBid(x.m,p) > a.price);

      if (!challengers.length) break;

      // In the live auction, the first CPU timer to fire gets the next action.
      // Reproduce that priority instantly rather than waiting in real time.
      challengers.sort((x,y) => x.delay - y.delay);
      const {m,limit} = challengers[0];
      const oldPrice = a.price;
      const inc = Math.min($runtime.jumpSize(m,a.price,limit,p), limit-a.price);
      const target = Math.min(limit, a.price + Math.max(1,inc));

      if (target <= oldPrice) {
        a.activeIds = a.activeIds.filter(id => id !== m.id);
        // Nessun PASS visibile: in fast-forward la CPU viene solo esclusa internamente.
        continue;
      }

      a.price = target;
      a.highBidderId = m.id;
      a.bidCount = Number(a.bidCount||0) + 1;
      pushLog(m.team, String(target), 'bid');
    }

    if (guard >= MAX_STEPS) {
      console.warn('Fast-forward asta interrotto dal safety guard', {player:p.name, price:a.price});
    }

    $runtime.saveState();
    $runtime.renderAuction();
    $runtime.awardAuction();
  }

  function userPass() {
    const a = $runtime.state?.auction;
    if (!a || a.arcade?.awaitingAck || a.arcade?.type==='sealed' || $runtime.autocompleteMode || !a.activeIds.includes('user') || a.highBidderId==='user') return;
    a.awaitingUser = false;
    a.activeIds = a.activeIds.filter(id=>id!=='user');
    $runtime.addAuctionLog($runtime.state.managers[0].team, 'PASS', 'pass');

    // Once the user passes, skip all remaining CPU-vs-CPU waiting for this player.
    // The internal auction is still fully simulated, then we jump straight to the
    // final AGGIUDICATO animation.
    $runtime.fastForwardCpuAuctionAfterUserPass();
  }

  function userCannotBeatCurrentAuction(){
    const a=$runtime.state?.auction,player=a&&$runtime.playerMap.get(String(a.playerId));
    const user=$runtime.state?.managers?.find(manager=>manager.id==='user');
    return !!(a && player && user && !$runtime.autocompleteMode && !a.awarding &&
      a.highBidderId!=='user' && a.activeIds?.includes('user') && $runtime.maxLegalBid(user,player)<=a.price);
  }

  function autoSkipUserIfCannotBid(){
    if(!$runtime.userCannotBeatCurrentAuction())return false;
    const a=$runtime.state.auction;
    a.awaitingUser=false;
    a.activeIds=a.activeIds.filter(id=>id!=='user');
    $runtime.addAuctionLog($runtime.state.managers.find(manager=>manager.id==='user')?.team||'Tu','SKIP · CREDITO INSUFFICIENTE','pass');
    $runtime.fastForwardCpuAuctionAfterUserPass();
    return true;
  }

  function awardAuction() {
    $runtime.clearAuctionRuntimeTimers();
    $runtime.auditAndRepairState('pre-award');
    const a = $runtime.state?.auction;
    if (!a || a.awarding || a.arcade?.awaitingAck || (a.arcade?.type==='sealed'&&!a.arcade.resolved)) return;
    const p = $runtime.playerMap.get(a.playerId);
    const winner = $runtime.state.managers.find(m=>m.id===a.highBidderId);
    if (!p || !winner) return;

    a.awarding = true;
    $runtime.renderAuction();
    const bundlePlayer=a.arcade?.type==='bundle'?$runtime.playerMap.get(a.arcade.secondPlayerId):null;
    $runtime.showAwardAnimation(bundlePlayer?{...p,name:`${p.name} + ${bundlePlayer.name}`} :p, winner, a.price);

    const capturedAuction = a;
    $runtime.awardAnimationTimer = setTimeout(() => {
      $runtime.awardAnimationTimer = null;
      if (!$runtime.state?.auction || $runtime.state.auction !== capturedAuction || !capturedAuction.awarding) return;

      const finalPrice = capturedAuction.price;
      const finalWinner = $runtime.state.managers.find(m=>m.id===capturedAuction.highBidderId);
      const finalPlayer = $runtime.playerMap.get(capturedAuction.playerId);
      if (!finalPlayer || !finalWinner) { $runtime.hideAwardAnimation(); return; }

      const reactionData=$runtime.awardLossReactionData(capturedAuction,finalPlayer,finalWinner,finalPrice);
      $runtime.resolveRespectedAuctionPact(finalPlayer.id);
      const untouchableEffect=$runtime.auctionEffects('untouchable_player').find(e=>e.playerId===finalPlayer.id);
      if(untouchableEffect && finalWinner.id==='user'){
        const rival=$runtime.state.managers.find(m=>m.id===untouchableEffect.cpuId);
        if(rival){
          $runtime.changeRelationship(rival.id,-3,16,'intoccabile_soffiato');
          $runtime.showToast(`🔥 Hai soffiato ${finalPlayer.name} a ${rival.profile?.label||rival.team}: rivalità in aumento!`);
        }
      }

      const bundlePlayer=capturedAuction.arcade?.type==='bundle'?$runtime.playerMap.get(capturedAuction.arcade.secondPlayerId):null;
      const awardedPlayers=bundlePlayer?[finalPlayer,bundlePlayer]:[finalPlayer];
      const awardResult=bundlePlayer
        ? $runtime.AuctionEngine.awardBundle($runtime.state,awardedPlayers,finalWinner.id,finalPrice,{roleLimits:$runtime.ROLE_LIMITS,totalSlots:$runtime.TOTAL_SLOTS})
        : $runtime.AuctionEngine.awardPlayer($runtime.state,finalPlayer,finalWinner.id,finalPrice,{roleLimits:$runtime.ROLE_LIMITS,totalSlots:$runtime.TOTAL_SLOTS});
      if(!awardResult.ok){
        $runtime.hideAwardAnimation();
        $runtime.state.auction=null;
        $runtime.integrityNote('warning',`Aggiudicazione annullata: ${awardResult.reason}`,'award');
        $runtime.showToast('Aggiudicazione non valida annullata in sicurezza.',true);
        $runtime.saveState();$runtime.renderAll();
        return;
      }
      awardedPlayers.forEach(player=>$runtime.recordUserAuctionPick(player,finalWinner.id));
      if($runtime.state.winterMarketFlow?.stage==='auction'){
        const ledger=$runtime.winterLedgerFor(finalWinner.id);
        ledger.winterSpent=Number(ledger.winterSpent||0)+Number(finalPrice||0);
        for(const player of awardedPlayers){
          const acquired=(finalWinner.roster||[]).find(item=>String(item.id)===String(player.id));
          if(acquired){ acquired.acquisitionWindow='winter'; acquired.acquisitionSeason=$runtime.state.winterMarketFlow.seasonNumber; }
        }
      }

      $runtime.hideAwardAnimation();
      $runtime.renderRoster(); $runtime.renderManagers();

      const finishAwardFlow=()=>{
        if($runtime.state?.auction!==capturedAuction) return;
        $runtime.state.auction = null;
        if($runtime.openRoleAuction()){
          if($runtime.allRostersComplete()){$runtime.saveState();return $runtime.finishAuction();}
          $runtime.state.nominationIndex=$runtime.nextNominatorIndex($runtime.state.nominationIndex);
          $runtime.auditAndRepairState('post-award-open-role');
          $runtime.saveState();$runtime.renderAll();
          if($runtime.autocompleteMode||$runtime.state.managers[$runtime.state.nominationIndex].id!=='user') $runtime.scheduleNomination();
          return;
        }
        const previousRole = $runtime.currentAuctionRole();
        const phaseFinished = $runtime.rolePhaseComplete(previousRole);
        if (phaseFinished) $runtime.state.currentRoleIndex++;

        // Se il giocatore aveva già completato il reparto, le aste CPU residue
        // vengono accelerate automaticamente. Appena anche le CPU terminano,
        // torniamo al normale flusso con la schermata di passaggio reparto.
        if (phaseFinished && $runtime.roleRemainderAutoSim) {
          $runtime.endRoleRemainderAutoSim();
          $runtime.auditAndRepairState('post-role-autosim');
          $runtime.saveState();
          return $runtime.beginRoleTransition(previousRole);
        }

        // Fine reparto: in modalità normale l'asta si ferma qui.
        if (phaseFinished && !$runtime.autocompleteMode) {
          return $runtime.beginRoleTransition(previousRole);
        }

        if ($runtime.state.currentRoleIndex >= $runtime.ROLE_ORDER.length || $runtime.allRostersComplete()) {
          $runtime.saveState();
          return $runtime.finishAuction();
        }

        $runtime.state.nominationIndex = $runtime.nextNominatorIndex($runtime.state.nominationIndex);

        // Il giocatore ha riempito il proprio reparto ma alcune CPU no:
        // da questo momento non deve più assistere a chiamate che non può fare.
        // Attiviamo il motore veloce solo fino alla chiusura di questo reparto.
        if (!$runtime.roleRemainderAutoSim && $runtime.userCompletedCurrentRole(previousRole) && !$runtime.rolePhaseComplete(previousRole)) {
          $runtime.beginRoleRemainderAutoSim(previousRole);
        }

        $runtime.auditAndRepairState('post-award');
        $runtime.saveState();
        $runtime.renderAll();
        if ($runtime.autocompleteMode || $runtime.state.managers[$runtime.state.nominationIndex].id!=='user') $runtime.scheduleNomination();
      };

      if(reactionData && !$runtime.autocompleteMode){
        $runtime.showAwardLossReaction(reactionData.cpu,finalPlayer,finalPrice);
        $runtime.awardAnimationTimer=setTimeout(()=>{$runtime.awardAnimationTimer=null;finishAwardFlow();},1120);
        return;
      }
      finishAwardFlow();
    }, $runtime.autocompleteMode ? 120 : capturedAuction.adminOneShotForced ? 2400 : 1050);
  }

  function nominationCallCount(managerId,role){
    const key=$runtime.openRoleAuction()?'ALL':role;
    return Math.max(0,Number($runtime.state?.nominationCalls?.[key]?.[managerId]||0));
  }

  function registerNominationCall(managerId,role){
    if(!$runtime.state || !managerId)return;
    $runtime.state.nominationCalls ||= {};
    const key=$runtime.openRoleAuction()?'ALL':role;
    $runtime.state.nominationCalls[key] ||= {};
    $runtime.state.nominationCalls[key][managerId]=$runtime.nominationCallCount(managerId,role)+1;
  }

  function nextNominatorIndex(from) {
    const role=$runtime.currentAuctionRole();
    const length=$runtime.state.managers.length;
    const candidates=[];
    for(let step=1;step<=length;step++){
      const idx=(Number(from||0)+step)%length;
      const manager=$runtime.state.managers[idx];
      if($runtime.openRoleAuction()?$runtime.managerCanNominate(manager):$runtime.roleSlotsRemaining(manager,role)>0)
        candidates.push({idx,count:$runtime.nominationCallCount(manager.id,role)});
    }
    if(!candidates.length)return 0;
    const minimum=Math.min(...candidates.map(candidate=>candidate.count));
    return candidates.find(candidate=>candidate.count===minimum).idx;
  }

  function allRostersComplete() { return $runtime.state.managers.every(m=>m.roster.length>=$runtime.TOTAL_SLOTS); }

  function scheduleNomination() {
    if ($runtime.state?.roleTransition) return;
    clearTimeout($runtime.uiTimer);
    $runtime.renderTurn();
    const manager = $runtime.state?.managers?.[$runtime.state.nominationIndex];
    $runtime.uiTimer = setTimeout(()=>$runtime.cpuNominateCurrent(), manager ? $runtime.cpuNominationDelay(manager) : 650);
  }

  function cpuNominateCurrent() {
    if (!$runtime.state || $runtime.state.auction || $runtime.state.completed || $runtime.state.roleTransition) return;
    const idx = $runtime.state.nominationIndex;
    const m = $runtime.state.managers[idx];
    if (m.id==='user' && !$runtime.autocompleteMode) { $runtime.renderTurn(); return; }
    const player = $runtime.chooseNomination(m);
    if (!player) {
      // Defensive fallback: any legal player.
      const role = $runtime.currentAuctionRole();
      const fallback = $runtime.state.availableIds.map(id=>$runtime.playerMap.get(id)).find(p=>p && ($runtime.openRoleAuction()||p.role===role) && $runtime.canOwn(m,p) && $runtime.maxLegalBid(m,p)>=1);
      if (!fallback) return $runtime.finishAuction(true);
      $runtime.nominate(fallback.id, idx);
      return;
    }
    $runtime.nominate(player.id, idx);
  }

  function freeRoleNominationWeights(manager,roles){
    return roles.map(role=>{
      const left=$runtime.roleSlotsRemaining(manager,role);
      const pool=$runtime.state.availableIds.map(id=>$runtime.playerMap.get(id)).filter(p=>p?.role===role && $runtime.canOwn(manager,p) && $runtime.maxLegalBid(manager,p)>=1);
      const values=pool.map(p=>Math.max(1,$runtime.baseAuctionValue(p))).sort((a,b)=>b-a);
      const threshold=$runtime.TOP_VALUE_THRESHOLD[role]||30;
      const strong=values.filter(value=>value>=threshold*.75).length;
      const demand=$runtime.state.managers.reduce((sum,m)=>sum+$runtime.roleSlotsRemaining(m,role),0);
      const scarcity=strong?$runtime.clamp(demand/Math.max(1,strong),.7,2):.65;
      const quality=$runtime.clamp((values[0]||1)/threshold,.5,1.6);
      const room=Math.max(left,Math.min($runtime.targetFor(manager,role)-$runtime.roleSpend(manager,role),Number(manager.budget||0)-Math.max(0,$runtime.slotsRemaining(manager)-left)));
      const affordability=$runtime.clamp(room/Math.max(left,(values[0]||1)),.4,1.25);
      // Every unfinished role keeps a positive chance; strategy biases the draw.
      const weight=left*(.55+quality*.25+scarcity*.25)*(.65+affordability*.35);
      return {role,weight};
    });
  }

  function chooseNomination(manager) {
    const open=$runtime.openRoleAuction();
    const keeperCover=$runtime.cpuMissingKeeperCover(manager);
    if(keeperCover && (open || $runtime.currentAuctionRole()==='P') && $runtime.maxLegalBid(manager,keeperCover)>=1 &&
       Math.random()<($runtime.profileArchetype(manager)==='admin'?1:Number($runtime.state.career.division)===1?.90:.75))return keeperCover;
    const availableRoles=$runtime.ROLE_ORDER.filter(role=>$runtime.roleSlotsRemaining(manager,role)>0 && $runtime.state.availableIds.some(id=>{
      const player=$runtime.playerMap.get(id);
      return player?.role===role && $runtime.canOwn(manager,player) && $runtime.maxLegalBid(manager,player)>=1;
    }));
    let role=$runtime.currentAuctionRole();
    if(open && availableRoles.length){
      const weighted=$runtime.freeRoleNominationWeights(manager,availableRoles);
      let roll=Math.random()*weighted.reduce((sum,item)=>sum+item.weight,0);
      role=(weighted.find(item=>(roll-=item.weight)<0)||weighted[0]).role;
    }
    const candidates = $runtime.state.availableIds.map(id=>$runtime.playerMap.get(id))
      .filter(p=>p && p.role===role && $runtime.canOwn(manager,p) && $runtime.maxLegalBid(manager,p)>=1);
    if (!candidates.length) return null;

    const archetype = $runtime.profileArchetype(manager);
    const profile = manager.profile || {};
    const me = $runtime.state.managers[0];
    const roleSlots = Math.max(1, $runtime.roleSlotsRemaining(manager,role));
    const spent = $runtime.roleSpend(manager,role);
    const budgetRoom = Math.max(roleSlots, $runtime.targetFor(manager,role)-spent);
    const avgRoom = budgetRoom / roleSlots;

    // Build role-relative ranks once. These are used differently by each nomination style.
    const rankedByMarket = candidates.slice().sort((a,b)=>$runtime.baseAuctionValue(b)-$runtime.baseAuctionValue(a));
    const rankMap = new Map(rankedByMarket.map((p,i)=>[p.id,i]));
    const n = Math.max(1, rankedByMarket.length-1);

    let topChance=.38, valueChance=.30, targetChance=.22, chaosChance=.10;
    if (archetype==='bomber')        { topChance=.56; valueChance=.15; targetChance=.24; chaosChance=.05; }
    if (archetype==='spendaccione')  { topChance=.60; valueChance=.12; targetChance=.20; chaosChance=.08; }
    if (archetype==='collezionista') { topChance=.68; valueChance=.08; targetChance=.19; chaosChance=.05; }
    if (archetype==='ragioniere')    { topChance=.22; valueChance=.48; targetChance=.26; chaosChance=.04; }
    if (archetype==='tirchio')       { topChance=.13; valueChance=.58; targetChance=.23; chaosChance=.06; }
    if (archetype==='moneyball')     { topChance=.16; valueChance=.58; targetChance=.23; chaosChance=.03; }
    if (archetype==='esperto')       { topChance=.34; valueChance=.36; targetChance=.27; chaosChance=.03; }
    if (archetype==='pazzo')         { topChance=.30; valueChance=.18; targetChance=.18; chaosChance=.34; }
    if (archetype==='tifoso')        { topChance=.30; valueChance=.23; targetChance=.39; chaosChance=.08; }
    if (archetype==='admin')         { topChance=.52; valueChance=.22; targetChance=.23; chaosChance=.03; }

    const competence=$runtime.cpuAuctionCompetence(manager);
    const competitiveDivision=competence>0;
    chaosChance*=1-competence*.70;
    // Later in the role phase, CPUs become more need-driven and less obsessed with the top name.
    const phaseCompletion = 1 - ($runtime.state.managers.reduce((s,m)=>s+$runtime.roleSlotsRemaining(m,role),0) / ($runtime.ROLE_LIMITS[role]*$runtime.state.managers.length));
    if (phaseCompletion > .55 && !competitiveDivision) { topChance *= .78; valueChance += .08; targetChance += .10; }
    // From Serie C onward the caller should expose strong players while the
    // league can still compete for them, even when its own budget is modest.
    if (competitiveDivision && phaseCompletion > .55) { topChance += .16; valueChance *= .75; }

    const total = topChance+valueChance+targetChance+chaosChance;
    let roll = Math.random()*total;
    let mode='top';
    if ((roll-=topChance) <= 0) mode='top';
    else if ((roll-=valueChance) <= 0) mode='value';
    else if ((roll-=targetChance) <= 0) mode='target';
    else mode='chaos';

    const scored = candidates.map(p => {
      const market = $runtime.baseAuctionValue(p);
      const rankNorm = 1 - (rankMap.get(p.id)||0)/n; // 1 top, 0 bottom
      const limit = Math.max(1,$runtime.cpuLimit(manager,p));
      const ovr = Number(p.ovr||70);
      const quote = Math.max(1,Number(p.quotation||1));
      const legacyEfficiency=ovr/Math.max(1,market);
      const footballEfficiency=Math.max(1,$runtime.currentPlayerOvr(p)-55)*Math.max(.15,$runtime.cpuAuctionStarterEstimate(p)/100)/Math.sqrt(Math.max(1,market));
      const efficiency=competence>0 ? Math.min(12,legacyEfficiency)*(1-competence)+footballEfficiency*competence : legacyEfficiency;
      const affordableFit = 1 / (1 + Math.abs(market-avgRoom)/Math.max(5,avgRoom));
      const favorite = profile.favoriteClub===p.club ? 1 : 0;
      const personalTaste = .82 + $runtime.careerHash(`nom|${manager.id}|${p.id}`)*.36;
      const slotInterest = $runtime.strategicSlotInterest(manager,p);
      const rankIndex = rankMap.get(p.id)||0;
      const outstanding = $runtime.state.managers.reduce((sum,m)=>sum+$runtime.roleSlotsRemaining(m,role),0);
      const viableCut = Math.min(candidates.length, Math.max(12, outstanding + 8));
      let score = 0;

      if (mode==='top') {
        score = 20 + rankNorm*72 + Math.min(18,limit/5) + favorite*16;
      } else if (mode==='value') {
        score = 18 + efficiency*9 + affordableFit*42 + (ovr/100)*15 + favorite*8;
        if (market > avgRoom*1.65) score *= .72;
      } else if (mode==='target') {
        score = 18 + (limit/Math.max(1,market))*28 + affordableFit*28 + favorite*34 + rankNorm*18;
      } else {
        score = 15 + Math.random()*58 + rankNorm*12 + favorite*10;
      }

      // User-pressure calls exist, but are rare and contextual rather than a permanent cheat.
      if (manager.id!=='user' && $runtime.roleSlotsRemaining(me,role)<=2 && me.budget > manager.budget*.72 && rankNorm>.65) {
        if (Math.random()<.08) score += 12;
      }

      // Deep reserves should not become routine opening calls. They remain possible
      // in Chaos mode and naturally enter the viable pool later in the role phase.
      if (rankIndex >= viableCut) score *= mode==='chaos' ? .62 : .20;
      if (competitiveDivision && mode!=='chaos' && rankedByMarket.length>1) {
        const bestMarket=$runtime.baseAuctionValue(rankedByMarket[0]);
        const strongCutoff=Math.max($runtime.TOP_VALUE_THRESHOLD[role]*.75,bestMarket*.70);
        const strongStillAvailable=bestMarket>=$runtime.TOP_VALUE_THRESHOLD[role]*.75;
        if (strongStillAvailable && market<strongCutoff) score*=.32;
      }
      if (!slotInterest.willing) score *= mode==='chaos' ? .34 : .08;
      else score *= .90 + slotInterest.factor*.10;
      if(manager.id!=='user') score *= $runtime.auctionReputationMultiplier(p);
      score *= personalTaste;
      score *= $runtime.cpuFootballAuctionFactor(manager,p);
      score *= .90 + Math.random()*.20;
      return {p,score,mode,willing:slotInterest.willing};
    }).sort((a,b)=>b.score-a.score);

    // Broader shortlist than before: the best candidate is favoured, never guaranteed.
    const willingCandidates=scored.filter(item=>item.willing);
    const selection=competence>=.75 && willingCandidates.length ? willingCandidates : scored;
    const shortlist=Math.max(5,Math.round(14-competence*9));
    const poolSize=mode==='chaos' ? Math.min(Math.round(22-competence*12),selection.length) : Math.min(shortlist,selection.length);
    const pool = selection.slice(0,poolSize);
    const exponent = mode==='top' ? 1.20 : mode==='value' ? .92 : mode==='target' ? 1.02 : .60;
    const weights = pool.map((_,i)=>1/Math.pow(i+1,exponent));
    let weightedRoll = Math.random()*weights.reduce((a,b)=>a+b,0);
    for (let i=0;i<pool.length;i++) {
      weightedRoll -= weights[i];
      if (weightedRoll<=0) return pool[i].p;
    }
    return pool[0].p;
  }

  function finishAuction(forced=false) {
    $runtime.clearAuctionRuntimeTimers();
    $runtime.hideRoleTransitionModal();
    $runtime.state.roleTransition = null;
    $runtime.state.completed = true;
    $runtime.state.auction = null;
    $runtime.roleRemainderAutoSim = false;
    $runtime.autocompleteMode = false;
    $runtime.hideRoleRemainderAutoSim();
    if($runtime.state.winterMarketFlow?.stage==='auction'){
      $runtime.state.winterMarketFlow.stage='trades';
      $runtime.state.winterMarketFlow.completedAt=Date.now();
      $runtime.state.winterMarketFlow.finalBudgets=Object.fromEntries($runtime.state.managers.map(manager=>[manager.id,Number(manager.budget||0)]));
      $runtime.saveState();
      return $runtime.renderTradeWindow('winter');
    }
    $runtime.saveState();
    $runtime.renderTradeWindow('summer');
  }
    return Object.freeze({renderAll,renderPhaseBanner,renderRoster,managerLiveAuctionBadges,buildLeagueManagerCards,renderManagers,averageRosterValue,renderTurn,nominationSort,openNominationModal,closeNominationModal,renderNominationClubFilter,nominationCard,auctionObserverActive,playerSeasonPotentialProfile,clubRoleStarterSlots,starterHierarchyBias,normalizedStarterProbability,auctionStarterProbability,auctionPlayerAnalysis,renderPlayerResults,renderAuctionRoomList,auctionBundlePlayerMarkup,renderAuction,addAuctionLog,auctionWindowMs,clearAuctionRuntimeTimers,renderCountdown,startCountdownTicker,resetBidClock,nextDelay,cpuNominationDelay,cpuReactionDelay,prepareArcadeAuction,renderArcadeBanner,showArcadeModal,resolveSealedAuction,handleArcadeAction,nominate,scheduleAdvance,adminOneShotScore,tryAdminOneShot,beginBidRound,currentSuddenInterestEffect,activateSuddenInterest,scheduleSuddenInterestEntry,scheduleCpuReactions,flashBidder,bidReaction,bidCommentMoment,showBidSpotlight,showAwardAnimation,hideAwardAnimation,awardLossReactionData,showAwardLossReaction,cpuReact,advanceAuction,ensureManagerTeamIdentityState,ensureAuctionPowers,auctionPowerMaxUses,auctionPowerUses,consumeAuctionPower,canUseOneShot,renderAuctionPowers,auctionPowerTargets,pauseForAuctionPower,resumeAfterAuctionPower,openAuctionPower,useScoutPower,closeAuctionPowerModal,resolveAuctionPowerTarget,useBluffPower,useOneShotPower,autoUserLimit,userBid,fastForwardCpuAuctionAfterUserPass,userPass,userCannotBeatCurrentAuction,autoSkipUserIfCannotBid,awardAuction,nominationCallCount,registerNominationCall,nextNominatorIndex,allRostersComplete,scheduleNomination,cpuNominateCurrent,freeRoleNominationWeights,chooseNomination,finishAuction});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['auction-controller']=Object.freeze({create});
})();
