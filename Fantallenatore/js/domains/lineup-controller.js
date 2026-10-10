/* Responsibility: lineup-controller. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: lineup-controller');
  function lineupDayKey() {
    const season = $runtime.ensureSeasonState();
    return String(season?.currentMatchday || 1);
  }

  function ensureLineupDayStore() {
    const season = $runtime.ensureSeasonState();
    if (!season) return null;
    if (!season.lineups || typeof season.lineups !== 'object') season.lineups = {};
    const key = $runtime.lineupDayKey();
    if (!season.lineups[key] || typeof season.lineups[key] !== 'object') season.lineups[key] = {};
    return season.lineups[key];
  }

  function lineupSlots(key) {
    return $runtime.LINEUP_FORMATIONS[key] || $runtime.LINEUP_FORMATIONS['4-3-3'];
  }

  function lineupRequiredStarters(formation){
    return $runtime.lineupSlots(formation).length;
  }

  function lineupPlayerValue(player) {
    const form=$runtime.playerFormMetrics(player?.id);
    const status=$runtime.playerStatusForDay(player?.id,$runtime.state?.season?.currentMatchday||1);
    const statusPenalty=status.unavailable?-4500:0;
    return $runtime.currentPlayerOvr(player) * 100 + Number(player?.fvm || 0) * .2 + Number(player?.quotation || 0) * .1 + form.score*160 + statusPenalty;
  }

  function cpuLeagueRuleLineupValue(manager,player,day=$runtime.state?.season?.currentMatchday||1){
    return window.FantaCpuLineupPolicy.playerValue({manager,player,day,state:$runtime.state,lineupPlayerValue:$runtime.lineupPlayerValue,leagueRulesFor:$runtime.leagueRulesFor,cpuLeagueRuleSensitivity:$runtime.cpuLeagueRuleSensitivity,estimatedStarterProbability:$runtime.estimatedStarterProbability,currentPlayerOvr:$runtime.currentPlayerOvr,playerFormMetrics:$runtime.playerFormMetrics,playerSeasonStat:$runtime.playerSeasonStat,serieAMatchupDifficulty:$runtime.serieAMatchupDifficulty,clamp:$runtime.clamp});
  }

  function cpuLeagueFormationBias(manager,key,day=$runtime.state?.season?.currentMatchday||1){
    if(!manager || manager.id==='user') return 0;
    const rules=$runtime.leagueRulesFor($runtime.state);
    const sensitivity=$runtime.cpuLeagueRuleSensitivity(manager);
    const counts=$runtime.lineupCountsForFormation(key);
    let bonus=0;
    if(rules.defenseModifier==='classic' && counts.D>=4){
      bonus+=135*sensitivity;
      if(counts.D>=5) bonus+=40*sensitivity;
    }
    if(Number(rules.firstGoalThreshold)===65 && counts.A>=3) bonus+=70*sensitivity;
    if(Number(rules.firstGoalThreshold)===67 && counts.D>=4) bonus+=35*sensitivity;
    return bonus;
  }

  function lineupCountsForFormation(key) {
    return $runtime.lineupSlots(key).reduce((acc,s)=>(acc[s.role]=(acc[s.role]||0)+1,acc),{P:0,D:0,C:0,A:0});
  }

  function normalizeSavedLineup(saved, manager) {
    const formation = $runtime.allowedLineupFormation(saved?.formation) ? saved.formation : '4-3-3';
    const roster=(manager?.roster||[]);
    const validPlayers = new Set(roster.map(p=>String(p.id)));
    const slotMap = new Map($runtime.lineupSlots(formation).map(s=>[s.instanceId,s]));
    const starters = {};
    const used = new Set();
    const wildcardLimit=String(manager?.id||'')==='user' ? $runtime.adminWildcardStartingSlotLimit() : 0;
    let wildcardUsed=0;
    const adminBlockedId=$runtime.adminBlockedStarterForManager(manager?.id);
    Object.entries(saved?.starters || {}).forEach(([slotId,playerId]) => {
      const slot = slotMap.get(slotId);
      const player = roster.find(p=>String(p.id)===String(playerId));
      if(adminBlockedId && String(player?.id||'')===String(adminBlockedId)) return;
      const sameRole=!!slot && !!player && player.role===slot.role;
      const legalWildcard=!!slot && !!player && wildcardUsed<wildcardLimit && $runtime.wildcardSlotCompatible(player.role,slot.role);
      if (!slot || !player || (!sameRole && !legalWildcard) || used.has(String(player.id)) || !validPlayers.has(String(player.id))) return;
      starters[slotId] = String(player.id);
      used.add(String(player.id));
      if(!sameRole) wildcardUsed++;
    });
    const bench=[];
    const benchSeen=new Set();
    (Array.isArray(saved?.bench)?saved.bench:[]).map(String).forEach(id=>{
      if(!validPlayers.has(id)||used.has(id)||benchSeen.has(id)) return;
      bench.push(id); benchSeen.add(id);
    });
    const ro={P:0,D:1,C:2,A:3};
    roster.filter(p=>!used.has(String(p.id))&&!benchSeen.has(String(p.id))).slice().sort((a,b)=>ro[a.role]-ro[b.role] || $runtime.lineupPlayerValue(b)-$runtime.lineupPlayerValue(a)).forEach(p=>{
      const id=String(p.id); bench.push(id); benchSeen.add(id);
    });
    const captainId=String(saved?.captainId||'');
    return { formation, starters, bench, captainId:used.has(captainId)?captainId:null, confirmed:!!saved?.confirmed };
  }

  function syncDraftBenchOrder(){
    const manager=$runtime.managerById('user');
    if(!$runtime.lineupDraft || !manager) return [];
    const normalized=$runtime.normalizeSavedLineup($runtime.lineupDraft,manager);
    $runtime.lineupDraft.bench=normalized.bench.slice();
    $runtime.enforceAdminLastReserve($runtime.lineupDraft,manager.id);
    return $runtime.lineupDraft.bench;
  }

  function draftBenchPlayers(){
    const manager=$runtime.managerById('user');
    if(!manager || !$runtime.lineupDraft) return [];
    $runtime.syncDraftBenchOrder();
    return $runtime.lineupDraft.bench.map(id=>manager.roster.find(p=>String(p.id)===String(id))).filter(Boolean);
  }

  function moveBenchPlayer(playerId,delta){
    if($runtime.lineupReadOnly || !$runtime.lineupDraft) return;
    $runtime.syncDraftBenchOrder();
    const id=String(playerId), idx=$runtime.lineupDraft.bench.indexOf(id);
    if(idx<0 || id===String($runtime.adminBlockedStarterForManager('user')||'')) return;
    const lastLocked=!!$runtime.adminBlockedStarterForManager('user');
    const next=$runtime.clamp(idx+Number(delta||0),0,$runtime.lineupDraft.bench.length-1-(lastLocked?1:0));
    if(next===idx) return;
    const [item]=$runtime.lineupDraft.bench.splice(idx,1);
    $runtime.lineupDraft.bench.splice(next,0,item);
    $runtime.lineupDraft.confirmed=false;
    $runtime.renderLineupScreen();
  }

  function openLineupScreen() {
    $runtime.stopHubNewsCarousel();
    const season = $runtime.ensureSeasonState();
    const manager = $runtime.managerById('user');
    if (!season || !manager) return;
    let saved = season.lineups?.[$runtime.lineupDayKey()]?.user;
    if(!saved && $runtime.assistantCoachCarryEnabled(season)){
      $runtime.seedAssistantCoachLineupForDay(season.currentMatchday,season);
      saved=season.lineups?.[$runtime.lineupDayKey()]?.user;
      if(saved) $runtime.saveState();
    }
    $runtime.lineupDraft = $runtime.normalizeSavedLineup(saved || {formation:'4-3-3',starters:{},bench:[]}, manager);
    $runtime.ensureForcedFormationDraft();
    $runtime.lineupSelectedPlayerId = null;
    $runtime.lineupAssistantAdjustments = [];

    const ctx=$runtime.pendingBigMatchContext();
    $runtime.lineupReadOnly=!!ctx;
    $runtime.lineupPartialContext=$runtime.lineupReadOnly ? {
      ctx,
      user:$runtime.pendingPartialFantasySnapshot('user'),
      opponent:(()=>{
        const fixture=$runtime.currentUserFixture();
        const oppId=fixture?.homeId==='user'?fixture.awayId:fixture?.homeId;
        return oppId?$runtime.pendingPartialFantasySnapshot(oppId):null;
      })()
    } : null;

    if(!$runtime.lineupReadOnly && saved?.inheritedFromAssistant && $runtime.shopItemActive('assistant_coach',season)){
      const changes=$runtime.repairUnavailableStartersInDraft({silent:true,render:false,preserveConfirmed:true});
      if(changes.length){
        $runtime.lineupDraft.confirmed=true;
        $runtime.saveLineupDraft(false);
      }
    }

    $runtime.showScreen('lineupScreen');
    $runtime.renderLineupScreen();
  }

  function draftStarterIds() {
    return new Set(Object.values($runtime.lineupDraft?.starters || {}).map(String));
  }

  function draftSlotForPlayer(playerId) {
    if (!$runtime.lineupDraft) return null;
    return Object.keys($runtime.lineupDraft.starters).find(slotId=>String($runtime.lineupDraft.starters[slotId])===String(playerId)) || null;
  }

  function draftPlayerById(playerId) {
    return $runtime.managerById('user')?.roster?.find(p=>String(p.id)===String(playerId)) || null;
  }

  function setDraftFormation(key) {
    if ($runtime.lineupReadOnly) return;
    const forced=$runtime.forcedFormationRuleForDay();
    if(forced && key!==forced){
      $runtime.showToast(`Regolamento Admin: per questa giornata puoi usare solo il modulo ${forced}.`, true);
      return;
    }
    if (!$runtime.allowedLineupFormation(key) || !$runtime.lineupDraft) return;
    if ($runtime.lineupDraft.formation===key) return;
    const currentPlayers = Object.values($runtime.lineupDraft.starters).map($runtime.draftPlayerById).filter(Boolean);
    const next = {};
    ['P','D','C','A'].forEach(role => {
      const ids = currentPlayers.filter(p=>p.role===role).map(p=>String(p.id));
      const slots = $runtime.lineupSlots(key).filter(s=>s.role===role);
      ids.slice(0,slots.length).forEach((id,idx)=>{ next[slots[idx].instanceId]=id; });
    });
    $runtime.lineupDraft.formation = key;
    $runtime.lineupDraft.starters = next;
    if($runtime.lineupDraft.captainId && !Object.values(next).map(String).includes(String($runtime.lineupDraft.captainId))) $runtime.lineupDraft.captainId=null;
    $runtime.syncDraftBenchOrder();
    $runtime.lineupDraft.confirmed = false;
    $runtime.lineupSelectedPlayerId = null;
    $runtime.renderLineupScreen();
  }

  function selectLineupPlayer(playerId) {
    if ($runtime.lineupReadOnly) return;
    if (!$runtime.draftPlayerById(playerId)) return;
    $runtime.lineupSelectedPlayerId = String(playerId);
    $runtime.renderLineupScreen();
  }

  function nominateLineupCaptain(){
    if($runtime.lineupReadOnly || !$runtime.lineupDraft || !$runtime.lineupSelectedPlayerId || !$runtime.draftSlotForPlayer($runtime.lineupSelectedPlayerId)) return;
    $runtime.lineupDraft.captainId=String($runtime.lineupSelectedPlayerId);
    $runtime.lineupDraft.confirmed=false;
    $runtime.renderLineupScreen();
  }

  function placePlayerInSlot(playerId, slotId, {render=true}={}) {
    if ($runtime.lineupReadOnly || !$runtime.lineupDraft || !playerId || !slotId) return false;
    const slot = $runtime.lineupSlots($runtime.lineupDraft.formation).find(s=>s.instanceId===slotId);
    const player = $runtime.draftPlayerById(playerId);
    if (!slot || !player) return false;
    if (!$runtime.canPlacePlayerInLineupSlot(player,slot,$runtime.lineupDraft)) {
      const blockedId=$runtime.adminBlockedStarterForManager('user');
      const wildcardLimit=$runtime.adminWildcardStartingSlotLimit();
      const message=blockedId && String(player.id)===String(blockedId)
        ? `${player.name}: il Top Player deve partire dalla panchina per questa giornata.`
        : wildcardLimit>0
          ? `${player.name}: puoi usare al massimo ${wildcardLimit} ${window.FantaCareerEngine.findSeasonSponsor($runtime.state?.season,'fantacana')?'titolari fuori ruolo tra D, C e A':'Jolly fuori ruolo e soltanto tra D↔C o C↔A'}.`
          : `${player.name} può essere inserito solo in uno slot ${$runtime.ROLE_LABELS[player.role]||player.role}.`;
      $runtime.showToast(message, true);
      return false;
    }

    $runtime.syncDraftBenchOrder();
    const selectedId=String(player.id);
    const selectedBenchIndex=$runtime.lineupDraft.bench.indexOf(selectedId);
    const oldSlot = $runtime.draftSlotForPlayer(selectedId);
    const displaced = $runtime.lineupDraft.starters[slotId] ? String($runtime.lineupDraft.starters[slotId]) : null;

    // Trascinando/cliccando sullo stesso slot non serve modificare nulla.
    if (oldSlot===slotId) {
      $runtime.lineupSelectedPlayerId=null;
      if(render) $runtime.renderLineupScreen();
      return true;
    }

    if (oldSlot) delete $runtime.lineupDraft.starters[oldSlot];
    $runtime.lineupDraft.starters[slotId] = selectedId;

    // Se il giocatore arriva da un altro slot dello stesso ruolo, scambia i due titolari.
    if (displaced && displaced!==selectedId && oldSlot) {
      const displacedPlayer = $runtime.draftPlayerById(displaced);
      const old = $runtime.lineupSlots($runtime.lineupDraft.formation).find(s=>s.instanceId===oldSlot);
      if (displacedPlayer && old && displacedPlayer.role===old.role) $runtime.lineupDraft.starters[oldSlot]=displaced;
      else $runtime.lineupDraft.bench.push(displaced);
    // Se arriva dalla panchina, il giocatore sostituito prende il suo posto nella panchina.
    } else if(displaced && displaced!==selectedId) {
      if(selectedBenchIndex>=0) $runtime.lineupDraft.bench[selectedBenchIndex]=displaced;
      else $runtime.lineupDraft.bench.push(displaced);
    }

    $runtime.syncDraftBenchOrder();
    if($runtime.lineupDraft.captainId && !$runtime.draftSlotForPlayer($runtime.lineupDraft.captainId)) $runtime.lineupDraft.captainId=null;
    $runtime.lineupDraft.confirmed = false;
    $runtime.lineupSelectedPlayerId = null;
    if(render) $runtime.renderLineupScreen();
    return true;
  }

  function openLineupSlotPicker(slotId){
    if($runtime.lineupReadOnly||!$runtime.lineupDraft)return;
    const slot=$runtime.lineupSlots($runtime.lineupDraft.formation).find(x=>x.instanceId===slotId);
    if(!slot)return;
    document.getElementById('lineupSlotPicker')?.remove();
    const day=$runtime.ensureSeasonState()?.currentMatchday,current=$runtime.lineupDraft.starters[slotId],starters=$runtime.draftStarterIds();
    const players=($runtime.managerById('user')?.roster||[]).filter(p=>$runtime.canPlacePlayerInLineupSlot(p,slot,$runtime.lineupDraft,day)).sort((a,b)=>$runtime.lineupPlayerValue(b)-$runtime.lineupPlayerValue(a));
    const dialog=document.createElement('dialog');dialog.id='lineupSlotPicker';dialog.className='lineup-slot-picker';
    dialog.setAttribute('aria-labelledby','lineupSlotPickerTitle');
    dialog.innerHTML=`<header><h3 id="lineupSlotPickerTitle">Scegli ${$runtime.escapeHtml(slot.role)} · ${$runtime.escapeHtml(slot.key||slotId)}</h3><button type="button" data-picker-close aria-label="Chiudi">×</button></header><div class="lineup-slot-picker-list">${players.map(p=>{
      const status=$runtime.playerStatusForDay(p.id,day),placed=starters.has(String(p.id));
      const fixture=$runtime.serieAFixtureForPlayer(p,day);
      return `<button type="button" class="${placed?'is-already-starter':''}" data-picker-player="${$runtime.escapeHtml(p.id)}" ${status.unavailable?'disabled':''}>${$runtime.lineupPlayerFaceMarkup(p,'roster')}<strong>${$runtime.escapeHtml(p.name)}</strong><small>${$runtime.escapeHtml($runtime.clubShort(p.club))} · ${p.role} · OVR ${$runtime.currentPlayerOvr(p)}</small>${fixture?`<small class="lineup-picker-fixture">vs ${$runtime.escapeHtml(fixture.opponentName)} · ${fixture.home?'CASA':'TRASFERTA'}</small>`:''}${$runtime.shopItemActive('scout_plus')||$runtime.starterReportActive(day)?$runtime.scoutStarterBadge(p):''}<em>${status.unavailable?$runtime.escapeHtml(status.label):placed?'Già in formazione':'Disponibile'}</em></button>`;
    }).join('')||'<p>Nessun giocatore disponibile.</p>'}</div><footer>${current?'<button type="button" data-picker-empty>Svuota posizione</button>':''}<button type="button" data-picker-close>Annulla</button></footer>`;
    document.body.appendChild(dialog);dialog.addEventListener('close',()=>dialog.remove());
    dialog.querySelectorAll('[data-picker-close]').forEach(b=>b.onclick=()=>dialog.close());
    dialog.querySelectorAll('[data-picker-player]').forEach(b=>b.onclick=()=>{$runtime.placePlayerInSlot(b.dataset.pickerPlayer,slotId);dialog.close();});
    dialog.querySelector('[data-picker-empty]')?.addEventListener('click',()=>{delete $runtime.lineupDraft.starters[slotId];if(String($runtime.lineupDraft.captainId)===String(current))$runtime.lineupDraft.captainId=null;$runtime.lineupDraft.confirmed=false;$runtime.syncDraftBenchOrder();$runtime.renderLineupScreen();dialog.close();});
    dialog.showModal();
  }

  function placeSelectedInSlot(slotId) {
    if (!$runtime.lineupSelectedPlayerId) return;
    $runtime.placePlayerInSlot($runtime.lineupSelectedPlayerId, slotId);
  }

  function benchSelectedPlayer() {
    if ($runtime.lineupReadOnly) return;
    if (!$runtime.lineupSelectedPlayerId || !$runtime.lineupDraft) return;
    const slotId = $runtime.draftSlotForPlayer($runtime.lineupSelectedPlayerId);
    if (slotId) delete $runtime.lineupDraft.starters[slotId];
    if(String($runtime.lineupDraft.captainId)===String($runtime.lineupSelectedPlayerId)) $runtime.lineupDraft.captainId=null;
    $runtime.syncDraftBenchOrder();
    $runtime.lineupDraft.confirmed = false;
    $runtime.lineupSelectedPlayerId = null;
    $runtime.renderLineupScreen();
  }

  function clearLineupDragVisuals(){
    document.querySelectorAll('#lineupScreen .is-dragging,#lineupScreen .drag-valid,#lineupScreen .drag-invalid,#lineupScreen .bench-drop-active').forEach(el=>{
      el.classList.remove('is-dragging','drag-valid','drag-invalid','bench-drop-active');
    });
  }

  function beginLineupDrag(playerId, sourceEl, ev){
    if($runtime.lineupReadOnly || !$runtime.draftPlayerById(playerId)) return;
    $runtime.lineupDragPlayerId=String(playerId);
    $runtime.lineupSelectedPlayerId=String(playerId);
    $runtime.clearLineupDragVisuals();
    sourceEl?.classList.add('is-dragging');
    const player=$runtime.draftPlayerById(playerId);
    document.querySelectorAll('#lineupPitchSlots [data-lineup-slot]').forEach(el=>{
      const slot=$runtime.lineupSlots($runtime.lineupDraft.formation).find(s=>s.instanceId===el.dataset.lineupSlot);
      el.classList.add(slot&&player&&$runtime.canPlacePlayerInLineupSlot(player,slot,$runtime.lineupDraft)?'drag-valid':'drag-invalid');
    });
    if(ev?.dataTransfer){
      ev.dataTransfer.effectAllowed='move';
      try{ ev.dataTransfer.setData('text/plain',String(playerId)); }catch(_e){}
    }
  }

  function endLineupDrag(){
    $runtime.lineupDragPlayerId=null;
    $runtime.clearLineupDragVisuals();
  }

  function bindLineupDragDrop(){
    if($runtime.lineupReadOnly || !$runtime.lineupDraft) return;
    const draggableEls=document.querySelectorAll('#lineupRosterList [data-lineup-player], #lineupBenchList [data-bench-player], #lineupPitchSlots [data-lineup-slot].filled');
    draggableEls.forEach(el=>{
      el.setAttribute('draggable','true');
      el.addEventListener('dragstart',ev=>{
        const playerId=el.dataset.lineupPlayer || el.dataset.benchPlayer || $runtime.lineupDraft.starters[el.dataset.lineupSlot];
        if(!playerId){ ev.preventDefault(); return; }
        $runtime.beginLineupDrag(playerId,el,ev);
      });
      el.addEventListener('dragend',$runtime.endLineupDrag);
    });

    document.querySelectorAll('#lineupPitchSlots [data-lineup-slot]').forEach(slotEl=>{
      slotEl.addEventListener('dragover',ev=>{
        if(!$runtime.lineupDragPlayerId) return;
        const slot=$runtime.lineupSlots($runtime.lineupDraft.formation).find(s=>s.instanceId===slotEl.dataset.lineupSlot);
        const player=$runtime.draftPlayerById($runtime.lineupDragPlayerId);
        if(slot && player && $runtime.canPlacePlayerInLineupSlot(player,slot,$runtime.lineupDraft)){
          ev.preventDefault();
          if(ev.dataTransfer) ev.dataTransfer.dropEffect='move';
        }
      });
      slotEl.addEventListener('dragenter',()=>{
        if(!$runtime.lineupDragPlayerId) return;
        const slot=$runtime.lineupSlots($runtime.lineupDraft.formation).find(s=>s.instanceId===slotEl.dataset.lineupSlot);
        const player=$runtime.draftPlayerById($runtime.lineupDragPlayerId);
        if(slot && player && $runtime.canPlacePlayerInLineupSlot(player,slot,$runtime.lineupDraft)) slotEl.classList.add('drag-hover');
      });
      slotEl.addEventListener('dragleave',()=>slotEl.classList.remove('drag-hover'));
      slotEl.addEventListener('drop',ev=>{
        ev.preventDefault();
        slotEl.classList.remove('drag-hover');
        const playerId=$runtime.lineupDragPlayerId || (()=>{try{return ev.dataTransfer?.getData('text/plain')}catch(_e){return null}})();
        if(playerId) $runtime.placePlayerInSlot(playerId,slotEl.dataset.lineupSlot);
        $runtime.endLineupDrag();
      });
    });

    // Un titolare può essere trascinato direttamente nella panchina.
    const benchDrop=$runtime.$('lineupBenchList');
    if(benchDrop){
      benchDrop.addEventListener('dragover',ev=>{
        if(!$runtime.lineupDragPlayerId || !$runtime.draftSlotForPlayer($runtime.lineupDragPlayerId)) return;
        ev.preventDefault();
        benchDrop.classList.add('bench-drop-active');
      });
      benchDrop.addEventListener('dragleave',ev=>{
        if(!benchDrop.contains(ev.relatedTarget)) benchDrop.classList.remove('bench-drop-active');
      });
      benchDrop.addEventListener('drop',ev=>{
        ev.preventDefault();
        const playerId=$runtime.lineupDragPlayerId;
        benchDrop.classList.remove('bench-drop-active');
        if(playerId && $runtime.draftSlotForPlayer(playerId)){
          $runtime.lineupSelectedPlayerId=String(playerId);
          $runtime.benchSelectedPlayer();
        }
        $runtime.endLineupDrag();
      });
    }
  }

  function clearDraftLineup() {
    if ($runtime.lineupReadOnly) return;
    if (!$runtime.lineupDraft) return;
    $runtime.lineupDraft.starters = {};
    $runtime.lineupDraft.captainId=null;
    $runtime.lineupDraft.bench=[];
    $runtime.syncDraftBenchOrder();
    $runtime.lineupDraft.confirmed = false;
    $runtime.lineupSelectedPlayerId = null;
    $runtime.renderLineupScreen();
  }

  function bestPlayersForRole(manager, role, count) {
    const day=$runtime.state?.season?.currentMatchday||1;
    const blockedId=$runtime.adminBlockedStarterForManager(manager?.id,day);
    const candidates=(manager.roster||[]).filter(p=>p.role===role && (!blockedId || String(p.id)!==String(blockedId))).slice().sort((a,b)=>{
      const aUnavailable=$runtime.playerStatusForDay(a.id,day).unavailable?1:0;
      const bUnavailable=$runtime.playerStatusForDay(b.id,day).unavailable?1:0;
      const av=manager?.id==='user'?$runtime.lineupPlayerValue(a):$runtime.cpuLeagueRuleLineupValue(manager,a,day);
      const bv=manager?.id==='user'?$runtime.lineupPlayerValue(b):$runtime.cpuLeagueRuleLineupValue(manager,b,day);
      return aUnavailable-bUnavailable || bv-av || String(a.name).localeCompare(String(b.name),'it');
    });
    return candidates.slice(0,count);
  }

  function buildAutoLineup(manager, formationKey) {
    if(!$runtime.allowedLineupFormation(formationKey)) formationKey='4-3-3';
    const starters = {};
    const counts = $runtime.lineupCountsForFormation(formationKey);
    ['P','D','C','A'].forEach(role => {
      const players = $runtime.bestPlayersForRole(manager,role,counts[role]);
      const slots = $runtime.lineupSlots(formationKey).filter(s=>s.role===role);
      players.forEach((p,idx)=>{ if(slots[idx]) starters[slots[idx].instanceId]=String(p.id); });
    });
    const used = new Set(Object.values(starters).map(String));
    const day=$runtime.state?.season?.currentMatchday||1;
    const bench = (manager.roster||[]).filter(p=>!used.has(String(p.id))).slice().sort((a,b)=>{
      const ro={P:0,D:1,C:2,A:3};
      const av=manager?.id==='user'?$runtime.lineupPlayerValue(a):$runtime.cpuLeagueRuleLineupValue(manager,a,day);
      const bv=manager?.id==='user'?$runtime.lineupPlayerValue(b):$runtime.cpuLeagueRuleLineupValue(manager,b,day);
      return ro[a.role]-ro[b.role] || (manager?.id==='user'?0:Number($runtime.playerStatusForDay(a.id,day).unavailable)-Number($runtime.playerStatusForDay(b.id,day).unavailable)) || bv-av;
    }).map(p=>String(p.id));
    const captainId=manager?.id!=='user' && $runtime.leagueRulesFor($runtime.state).captainBonus!=='off'
      ? String((manager.roster||[]).filter(p=>used.has(String(p.id))).sort((a,b)=>$runtime.cpuLeagueRuleLineupValue(manager,b,day)-$runtime.cpuLeagueRuleLineupValue(manager,a,day))[0]?.id||'')
      : null;
    const lineup={formation:formationKey,starters,bench,captainId,confirmed:true,updatedAt:Date.now()};
    const blockedId=$runtime.adminBlockedStarterForManager(manager?.id,day);
    if(blockedId) $runtime.enforcePlayerBenchedInLineup(manager,lineup,blockedId,day);
    if(manager?.id==='user') $runtime.enforceFaithReserveStarterInLineup(manager,lineup,day);
    return lineup;
  }

  function formationCpuBias(manager, key, day=$runtime.state?.season?.currentMatchday||1) {
    const counts = $runtime.lineupCountsForFormation(key);
    const type = manager.profile?.archetype || '';
    let bonus = 0;
    if (['bomber','collezionista','spendaccione'].includes(type)) bonus += counts.A===3 ? 180 : 0;
    if (['ragioniere','tirchio','esperto'].includes(type)) bonus += counts.D>=4 ? 90 : 0;
    if (type==='moneyball') bonus += counts.C>=4 ? 110 : 0;
    if (type==='pazzo') bonus += (Math.random()-.5)*220;
    bonus += $runtime.cpuLeagueFormationBias(manager,key,day);
    return bonus;
  }

  function chooseCpuFormation(manager) {
    return window.FantaCpuLineupPolicy.chooseFormation(manager,{state:$runtime.state,availableLineupFormations:$runtime.availableLineupFormations,lineupCountsForFormation:$runtime.lineupCountsForFormation,bestPlayersForRole:$runtime.bestPlayersForRole,cpuLeagueRuleLineupValue:$runtime.cpuLeagueRuleLineupValue,formationCpuBias:$runtime.formationCpuBias});
  }

  function tacticalExpectedPlayerPoints(player,day){
    if(!player || $runtime.playerStatusForDay(player.id,day).unavailable) return {points:0,vote:0};
    const caps=$runtime.assistantAutoLineupCapabilities();
    const quality=$runtime.clamp(($runtime.currentPlayerOvr(player)-60)/35,0,1);
    const priors={P:[0,0,.10],D:[.035,.045,.11],C:[.13,.14,.10],A:[.32,.12,.08]};
    const rates=priors[player.role]||priors.C;
    let vote=5.7+quality*.8,goals=rates[0]*(.65+quality*.7),assists=rates[1]*(.65+quality*.7),malus=rates[2];
    if(caps.fantadata){
      const stat=$runtime.playerSeasonStat(player.id),n=Number(stat?.voteCount||0);
      if(n){const weight=n/(n+8);vote=vote*(1-weight)+Number(stat.voteSum||0)/n*weight;goals=goals*(1-weight)+Number(stat.goals||0)/n*weight;assists=assists*(1-weight)+Number(stat.assists||0)/n*weight;malus=malus*(1-weight)+(Number(stat.yellow||0)*.5+Number(stat.red||0)+Number(stat.ownGoal||0)*2+Number(stat.missedPenalty||0)*3)/n*weight;}
      const matchup=$runtime.serieAMatchupDifficulty(player,day);const factor=matchup?.key==='favorable'?1.15:matchup?.key==='hard'?.85:1;goals*=factor;assists*=factor;
    }
    const effect=$runtime.activeFormationChoice(day)?.effect;
    if(String(effect?.targetPlayerId||'')===String(player.id)){
      if(['player_vote','locker_vote','world_player'].includes(effect.kind))vote+=Number(effect.delta||effect.voteDelta||0);
      if(effect.kind==='goal_weight'||effect.goalMultiplier)goals*=Number(effect.multiplier||effect.goalMultiplier||1);
      if(effect.kind==='assist_weight'||effect.assistMultiplier)assists*=Number(effect.multiplier||effect.assistMultiplier||1);
    }
    const probability=caps.scout?$runtime.clamp($runtime.estimatedStarterProbability(player,day)/100,.05,1):.9;
    const multiplier=Number($runtime.activeAdminRuleEffect(day)?.positiveBonusMultiplier||1);
    return {vote,points:probability*(vote+(goals*3+assists)*multiplier-malus)};
  }

  function tacticalExpectedLineupPoints(manager,lineup,day){
    const players=Object.values(lineup.starters).map(id=>manager.roster.find(p=>String(p.id)===String(id))).filter(Boolean);
    let score=players.reduce((sum,p)=>sum+$runtime.tacticalExpectedPlayerPoints(p,day).points,0);
    const rules=$runtime.fantasyRuleForDay(day);
    const defenders=players.filter(p=>p.role==='D');
    const keeper=players.find(p=>p.role==='P');
    if(rules.defenseModifier==='classic'&&defenders.length>=4&&keeper){
      const votes=defenders.map(p=>$runtime.tacticalExpectedPlayerPoints(p,day).vote).sort((a,b)=>b-a).slice(0,3);
      const avg=(votes.reduce((a,b)=>a+b,0)+$runtime.tacticalExpectedPlayerPoints(keeper,day).vote)/4;
      score+=(avg>=7?6:avg>=6.5?3:avg>=6?1:0)*Number($runtime.activeAdminRuleEffect(day)?.positiveBonusMultiplier||1);
    }
    return score;
  }

  function adaptTacticalProLineup(manager,lineup,day){
    const effect=$runtime.activeAdminRuleEffect(day);
    const forced=effect?.userPlayerId;
    if(effect?.ruleId==='forced_starter_pair') $runtime.enforceStarterInLineup(manager,lineup,forced);
    const previous=new Set(Object.values($runtime.ensureSeasonState()?.lineups?.[String(day-1)]?.user?.starters||{}).map(String));
    const required=effect?.ruleId==='forced_turnover_5'?5:effect?.ruleId==='forced_turnover_3'?3:0;
    const blocked=String($runtime.adminBlockedStarterForManager('user',day)||'');
    const slots=$runtime.lineupSlots(lineup.formation);
    const changes=[];
    for(let round=0;round<required && !$runtime.lineupTurnoverDeltaFromPrevious(lineup,day,required).ok;round++){
      const used=new Set(Object.values(lineup.starters).map(String));
      const options=[];
      for(const slot of slots){
        const old=manager.roster.find(p=>String(p.id)===String(lineup.starters[slot.instanceId]));
        if(!old || !previous.has(String(old.id)) || String(old.id)===String(forced||''))continue;
        for(const p of manager.roster)if(p.role===slot.role&&!used.has(String(p.id))&&!previous.has(String(p.id))&&String(p.id)!==blocked&&!$runtime.playerStatusForDay(p.id,day).unavailable)options.push({slot,p,old,gain:$runtime.advancedAutoLineupValue(p)-$runtime.advancedAutoLineupValue(old)});
      }
      options.sort((a,b)=>b.gain-a.gain);const pick=options[0];if(!pick)break;
      lineup.starters[pick.slot.instanceId]=String(pick.p.id);changes.push(`Turnover: ${pick.p.name} per ${pick.old.name}`);
    }
    if($runtime.adminWildcardStartingSlotLimit(day)>0){
      const used=new Set(Object.values(lineup.starters).map(String));const options=[];
      for(const slot of slots){
        const old=manager.roster.find(p=>String(p.id)===String(lineup.starters[slot.instanceId]));
        if(!old || slot.role==='P'||String(old.id)===String(forced||''))continue;
        for(const p of manager.roster){
          if(p.role===slot.role||used.has(String(p.id))||String(p.id)===blocked||$runtime.playerStatusForDay(p.id,day).unavailable||!$runtime.wildcardSlotCompatible(p.role,slot.role))continue;
          const trial={...lineup,starters:{...lineup.starters,[slot.instanceId]:String(p.id)}};
          if($runtime.lineupOutOfRoleEntries(trial,manager).length>$runtime.adminWildcardStartingSlotLimit(day)||!$runtime.lineupTurnoverDeltaFromPrevious(trial,day,required).ok)continue;
          const gain=$runtime.tacticalExpectedLineupPoints(manager,trial,day)-$runtime.tacticalExpectedLineupPoints(manager,lineup,day);if(gain>0)options.push({slot,p,old,gain});
        }
      }
      options.sort((a,b)=>b.gain-a.gain);const pick=options[0];if(pick){lineup.starters[pick.slot.instanceId]=String(pick.p.id);changes.push(`Fuori ruolo: ${pick.p.name} per ${pick.old.name}`);}
    }
    const used=new Set(Object.values(lineup.starters).map(String));
    lineup.bench=manager.roster.filter(p=>!used.has(String(p.id))).sort((a,b)=>$runtime.advancedAutoLineupValue(b)-$runtime.advancedAutoLineupValue(a)).map(p=>String(p.id));
    $runtime.enforceAdminLastReserve(lineup,'user',day);
    if(lineup.captainId&&!used.has(String(lineup.captainId)))lineup.captainId=null;
    lineup.tacticalProNotes=changes;
    lineup.confirmed=$runtime.validateAdminRuleLineup(lineup,day).ok && Object.keys(lineup.starters).length===$runtime.lineupRequiredStarters(lineup.formation);
    return lineup;
  }

  function autoFillUserLineup() {
    if ($runtime.lineupReadOnly) return;
    if (!$runtime.lineupDraft) return;
    if(!$runtime.shopItemActive('assistant_coach')){
      $runtime.showToast("AUTO XI è una funzione dell'Assistente Tecnico.",true);
      return;
    }
    const manager=$runtime.managerById('user');
    const formation=$runtime.bestAdvancedFormation(manager);
    const auto=$runtime.buildAdvancedAutoLineup(manager,formation);
    $runtime.lineupDraft.formation=formation;
    $runtime.lineupDraft.starters=auto.starters;
    $runtime.lineupDraft.bench=auto.bench.slice();
    if($runtime.lineupDraft.captainId && !Object.values(auto.starters).map(String).includes(String($runtime.lineupDraft.captainId))) $runtime.lineupDraft.captainId=null;
    $runtime.lineupDraft.confirmed=false;
    $runtime.lineupSelectedPlayerId=null;
    $runtime.renderLineupScreen();
    const caps=$runtime.assistantAutoLineupCapabilities();
    const extras=[caps.scout?'Scout Plus':null,caps.fantadata?'FantaData Pro':null].filter(Boolean);
    if($runtime.shopItemActive('assistant_tactical_pro') && auto.tacticalProNotes?.length){$runtime.showToast(auto.tacticalProNotes.join(' · '));return;}
    $runtime.showToast(`Assistente Tecnico: modulo ${formation} e XI ottimizzati${extras.length?` usando anche ${extras.join(' + ')}`:' su OVR e disponibilità'}.`);
  }

  function ensureAssistantCoachLineup(season=$runtime.ensureSeasonState()){
    if(!season) return null;
    if(!season.assistantCoachLineup || typeof season.assistantCoachLineup!=='object') season.assistantCoachLineup={enabled:false,formation:null,starters:{},bench:[],updatedAt:0,lastSourceDay:0};
    const t=season.assistantCoachLineup;
    if(typeof t.enabled!=='boolean') t.enabled=false;
    if(!t.starters || typeof t.starters!=='object') t.starters={};
    if(!Array.isArray(t.bench)) t.bench=[];
    return t;
  }

  function assistantCoachCarryEnabled(season=$runtime.ensureSeasonState()){
    return !!$runtime.ensureAssistantCoachLineup(season)?.enabled;
  }

  function saveAssistantCoachTemplateFromDraft(){
    const season=$runtime.ensureSeasonState(), manager=$runtime.managerById('user');
    if(!season || !manager || !$runtime.lineupDraft) return false;
    if($runtime.lineupDraft.formation==='5-5-5'){
      $runtime.showToast('Il modulo a farfalla vale solo oggi: la formazione persistente rimane quella delle giornate normali.',true);
      return false;
    }
    if(Object.keys($runtime.lineupDraft.starters||{}).length!==11){
      $runtime.showToast('Completa gli 11 titolari prima di salvare la formazione per le prossime giornate.',true);
      return false;
    }
    if($runtime.lineupOutOfRoleEntries($runtime.lineupDraft,manager).length){
      $runtime.showToast("La Wildcard dell'Admin vale solo per questa giornata: la formazione con un fuori ruolo non può essere salvata come formazione persistente.",true);
      return false;
    }
    const normalized=$runtime.normalizeSavedLineup({formation:$runtime.lineupDraft.formation,starters:$runtime.lineupDraft.starters,bench:$runtime.lineupDraft.bench,captainId:$runtime.lineupDraft.captainId,confirmed:false},manager);
    const template=$runtime.ensureAssistantCoachLineup(season);
    template.enabled=true;
    template.formation=normalized.formation;
    template.starters={...normalized.starters};
    template.bench=normalized.bench.slice();
    template.captainId=normalized.captainId;
    template.updatedAt=Date.now();
    template.lastSourceDay=Number(season.currentMatchday||1);
    $runtime.saveState();
    $runtime.renderLineupScreen();
    $runtime.showToast('Formazione completa salvata: titolari, capitano e panchina verranno riproposti nelle prossime giornate.');
    return true;
  }

  function toggleAssistantCoachCarry(){
    const season=$runtime.ensureSeasonState();
    if(!season) return;
    const template=$runtime.ensureAssistantCoachLineup(season);
    if(template.enabled){
      template.enabled=false;
      $runtime.saveState();
      $runtime.renderLineupScreen();
      $runtime.showToast('Formazione persistente disattivata.');
      return;
    }
    $runtime.saveAssistantCoachTemplateFromDraft();
  }

  function assistantCoachTemplateForDay(day,season=$runtime.ensureSeasonState()){
    const manager=$runtime.managerById('user');
    const template=$runtime.ensureAssistantCoachLineup(season);
    if(!season || !manager || !template?.enabled) return null;
    const normalized=$runtime.normalizeSavedLineup({formation:template.formation,starters:template.starters,bench:template.bench,captainId:template.captainId,confirmed:false},manager);
    if(Object.keys(normalized.starters||{}).length!==11) return null;
    return {formation:normalized.formation,starters:{...normalized.starters},bench:normalized.bench.slice(),captainId:normalized.captainId,confirmed:true,inheritedFromAssistant:true,autoConfirmedByAssistant:true,sourceDay:Number(template.lastSourceDay||0),updatedAt:Date.now()};
  }

  function repairAssistantInheritedLineup(lineup,day,season=$runtime.ensureSeasonState()){
    const manager=$runtime.managerById('user');
    if(!lineup || !manager || !season || !$runtime.shopItemActive('assistant_coach',season)) return {lineup,changes:[]};
    if($runtime.shopItemActive('assistant_tactical_pro',season)){
      const auto=$runtime.buildAdvancedAutoLineup(manager,$runtime.bestAdvancedFormation(manager));
      auto.inheritedFromAssistant=true;auto.autoConfirmedByAssistant=auto.confirmed;
      return {lineup:auto,changes:auto.tacticalProNotes||[]};
    }
    const normalized=$runtime.normalizeSavedLineup(lineup,manager);
    const starters={...normalized.starters};
    const bench=normalized.bench.slice();
    const changes=[];

    Object.entries(starters).forEach(([slotId,playerId])=>{
      const outPlayer=(manager.roster||[]).find(p=>String(p.id)===String(playerId));
      if(!outPlayer || !$runtime.playerStatusForDay(outPlayer.id,day).unavailable) return;
      const candidateIds=bench.filter(id=>{
        const p=(manager.roster||[]).find(x=>String(x.id)===String(id));
        return p && p.role===outPlayer.role && !$runtime.playerStatusForDay(p.id,day).unavailable;
      });
      const incomingId=candidateIds.sort((a,b)=>{
        const pa=(manager.roster||[]).find(x=>String(x.id)===String(a));
        const pb=(manager.roster||[]).find(x=>String(x.id)===String(b));
        return $runtime.advancedAutoLineupValue(pb)-$runtime.advancedAutoLineupValue(pa);
      })[0];
      if(!incomingId) return;
      const incoming=(manager.roster||[]).find(p=>String(p.id)===String(incomingId));
      const benchIndex=bench.indexOf(String(incomingId));
      starters[slotId]=String(incomingId);
      if(benchIndex>=0) bench[benchIndex]=String(outPlayer.id);
      changes.push({outId:String(outPlayer.id),outName:outPlayer.name,inId:String(incoming.id),inName:incoming.name,role:outPlayer.role});
    });

    const repaired=$runtime.normalizeSavedLineup({formation:normalized.formation,starters,bench,captainId:normalized.captainId,confirmed:true},manager);
    repaired.confirmed=Object.keys(repaired.starters||{}).length===11;
    repaired.inheritedFromAssistant=true;
    repaired.autoConfirmedByAssistant=repaired.confirmed;
    repaired.assistantAdjustments=changes;
    repaired.updatedAt=Date.now();
    return {lineup:repaired,changes};
  }

  function seedAssistantCoachLineupForDay(day,season=$runtime.ensureSeasonState()){
    if(!season || !day || season.completed) return false;
    if(!season.lineups || typeof season.lineups!=='object') season.lineups={};
    const key=String(day);
    if(!season.lineups[key] || typeof season.lineups[key]!=='object') season.lineups[key]={};
    if(season.lineups[key].user) return false;
    const inherited=$runtime.assistantCoachTemplateForDay(day,season);
    if(!inherited) return false;
    const prepared=$runtime.repairAssistantInheritedLineup(inherited,Number(day),season);
    season.lineups[key].user=prepared.lineup;
    return true;
  }

  function unavailableDraftStarters(){
    const day=$runtime.ensureSeasonState()?.currentMatchday||1;
    if(!$runtime.lineupDraft) return [];
    return Object.entries($runtime.lineupDraft.starters||{}).map(([slotId,id])=>({slotId,player:$runtime.draftPlayerById(id)})).filter(x=>x.player && $runtime.playerStatusForDay(x.player.id,day).unavailable);
  }

  function repairUnavailableStartersInDraft({silent=false,render=true,preserveConfirmed=false}={}){
    const season=$runtime.ensureSeasonState(), manager=$runtime.managerById('user');
    if(!season || !manager || !$runtime.lineupDraft || !$runtime.shopItemActive('assistant_coach',season)) return [];
    $runtime.syncDraftBenchOrder();
    const day=Number(season.currentMatchday||1);
    const changes=[];
    const outs=$runtime.unavailableDraftStarters();
    outs.forEach(({slotId,player:outPlayer})=>{
      const candidates=$runtime.draftBenchPlayers().filter(p=>p.role===outPlayer.role && !$runtime.playerStatusForDay(p.id,day).unavailable).sort((a,b)=>$runtime.advancedAutoLineupValue(b)-$runtime.advancedAutoLineupValue(a));
      const incoming=candidates[0];
      if(!incoming) return;
      const inId=String(incoming.id), outId=String(outPlayer.id);
      const benchIndex=$runtime.lineupDraft.bench.indexOf(inId);
      $runtime.lineupDraft.starters[slotId]=inId;
      if(benchIndex>=0) $runtime.lineupDraft.bench[benchIndex]=outId;
      else $runtime.lineupDraft.bench.push(outId);
      changes.push({outId,outName:outPlayer.name,inId,inName:incoming.name,role:outPlayer.role});
      $runtime.syncDraftBenchOrder();
    });
    if(changes.length){
      if(!preserveConfirmed) $runtime.lineupDraft.confirmed=false;
      $runtime.lineupAssistantAdjustments=changes;
      if(!silent) $runtime.showToast(`Assistente Tecnico: ${changes.length} indisponibil${changes.length===1?'e sostituito':'i sostituiti'}.`);
    } else if(!silent && outs.length){
      $runtime.showToast('Assistente Tecnico: nessun sostituto disponibile nello stesso ruolo.',true);
    }
    if(render) $runtime.renderLineupScreen();
    return changes;
  }

  function saveLineupDraft(confirm=false) {
    if ($runtime.lineupReadOnly) return false;
    if (!$runtime.lineupDraft) return false;
    if (!$runtime.allowedLineupFormation($runtime.lineupDraft.formation)) return false;
    const manager=$runtime.managerById('user');
    const store=$runtime.ensureLineupDayStore();
    if (!manager || !store) return false;
    const startersCount=Object.keys($runtime.lineupDraft.starters).length;
    if (confirm && startersCount!==$runtime.lineupRequiredStarters($runtime.lineupDraft.formation)) return false;
    $runtime.syncDraftBenchOrder();
    const bench=$runtime.lineupDraft.bench.slice();
    store.user={formation:$runtime.lineupDraft.formation,starters:{...$runtime.lineupDraft.starters},bench,captainId:Object.values($runtime.lineupDraft.starters).map(String).includes(String($runtime.lineupDraft.captainId))?String($runtime.lineupDraft.captainId):null,confirmed:confirm || !!$runtime.lineupDraft.confirmed,updatedAt:Date.now()};
    if (confirm && $runtime.lineupDraft.formation!=='5-5-5' && $runtime.assistantCoachCarryEnabled() && $runtime.lineupOutOfRoleEntries($runtime.lineupDraft,manager).length===0) {
      const template=$runtime.ensureAssistantCoachLineup();
      template.formation=$runtime.lineupDraft.formation;
      template.starters={...$runtime.lineupDraft.starters};
      template.bench=bench.slice();
      template.captainId=store.user.captainId;
      template.updatedAt=Date.now();
      template.lastSourceDay=Number($runtime.ensureSeasonState()?.currentMatchday||1);
    }
    if (confirm) {
      const day=Number($runtime.ensureSeasonState()?.currentMatchday||1);
      const forced=$runtime.forcedFormationRuleForDay(day);
      const opponentId=$runtime.userOpponentIdForDay(day);
      $runtime.state.managers.filter(m=>m.id!=='user').forEach(m=>{
        const mustMirrorForced=!!forced && (forced==='5-5-5' || String(m.id)===String(opponentId)) && String(store[m.id]?.formation||'')!==forced;
        const forcedStarterId=$runtime.adminForcedStarterForManager(m.id,day);
        const blockedStarterId=$runtime.adminBlockedStarterForManager(m.id,day);
        const starterIds=Object.values(store[m.id]?.starters||{}).map(String);
        const hasForcedStarter=!forcedStarterId || starterIds.includes(String(forcedStarterId));
        const hasBlockedStarter=!!blockedStarterId && starterIds.includes(String(blockedStarterId));
        if (!store[m.id]?.confirmed || !$runtime.allowedLineupFormation(store[m.id]?.formation) || mustMirrorForced || !hasForcedStarter || hasBlockedStarter){
          store[m.id]=$runtime.buildAutoLineup(m,$runtime.cpuFormationForDay(m,day));
          if(forcedStarterId) $runtime.enforceStarterInLineup(m,store[m.id],forcedStarterId);
          if(blockedStarterId) $runtime.enforcePlayerBenchedInLineup(m,store[m.id],blockedStarterId,day);
        }
      });
      $runtime.lineupDraft.confirmed=true;
    }
    return $runtime.saveState();
  }

  function confirmUserLineup() {
    if ($runtime.lineupReadOnly) return $runtime.renderSeasonDashboard();
    const adminValidation=$runtime.validateAdminRuleLineup($runtime.lineupDraft, $runtime.ensureSeasonState()?.currentMatchday||1);
    if(!adminValidation.ok){
      if ($runtime.$('lineupValidationText')) $runtime.$('lineupValidationText').textContent=adminValidation.message;
      $runtime.showToast(adminValidation.message, true);
      return;
    }
    if (!$runtime.saveLineupDraft(true)) {
      if ($runtime.$('lineupValidationText')) $runtime.$('lineupValidationText').textContent=Object.keys($runtime.lineupDraft?.starters||{}).length===$runtime.lineupRequiredStarters($runtime.lineupDraft?.formation)?'Salvataggio non riuscito: riprova.':`Servono tutti i ${$runtime.lineupRequiredStarters($runtime.lineupDraft?.formation)} titolari.`;
      return;
    }
    $runtime.renderSeasonDashboard();
  }

  function closeConsumableModal(){
    const modal=$runtime.$('consumableModal');
    if(!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    $runtime.$('consumableTargetPanel')?.classList.add('hidden');
    $runtime.$('consumableInventoryGrid')?.classList.remove('hidden');
  }

  function lineupConsumableActionState(id,day=$runtime.ensureSeasonState()?.currentMatchday){
    const season=$runtime.ensureSeasonState(),effect=$runtime.consumableDayEffect(day,season);
    if(!season) return {usable:false,label:'NON DISPONIBILE'};
    if($runtime.lineupReadOnly) return {usable:false,label:'FORMAZIONE BLOCCATA'};
    if(id==='cons_celebrity'){
      const seasonNumber=Number($runtime.state.career?.seasonNumber||1);
      return {usable:$runtime.consumableQuantity(id,season)>0 && Number($runtime.state.career?.nextSponsorSeason)!==seasonNumber+1,label:Number($runtime.state.career?.nextSponsorSeason)===seasonNumber+1?'GIÀ ATTIVA PER LA PROSSIMA STAGIONE':'ATTIVA PER LA PROSSIMA STAGIONE'};
    }
    if(id==='cons_starter_report'){
      if($runtime.shopItemActive('scout_plus',season)) return {usable:false,label:'SCOUT PLUS ATTIVO'};
      if(effect.starterReport) return {usable:false,label:'GIÀ USATO OGGI'};
      return {usable:$runtime.consumableQuantity(id,season)>0,label:'USA ORA'};
    }
    if(id==='cons_training'){
      const trained=new Set($runtime.specialTrainingPlayerIds(day));
      const eligible=($runtime.managerById('user')?.roster||[]).some(player=>!$runtime.playerStatusForDay(player.id,day).unavailable && !trained.has(String(player.id)));
      if(!eligible) return {usable:false,label:'TUTTI GIÀ ALLENATI'};
      return {usable:$runtime.consumableQuantity(id,season)>0,label:'SCEGLI GIOCATORE'};
    }
    if(id==='cons_opponent_block'){
      const used=$runtime.blockedOpponentPlayerIds(day).length,limit=window.FantaCareerEngine.opponentBlockLimit(season);
      if(used>=limit) return {usable:false,label:'BLOCCHI ESAURITI OGGI'};
      return {usable:$runtime.consumableQuantity(id,season)>0,label:`SCEGLI AVVERSARIO · ${used}/${limit}`};
    }
    if(id==='cons_reroll_rules') return {usable:false,label:'USA PRIMA DELL’ASTA'};
    if(id==='cons_reroll_admin') return {usable:false,label:'USA SULLA CARTA ADMIN'};
    if(id==='cons_reroll_event') return {usable:false,label:'USA SULLE CARTE EVENTO'};
    if(id==='cons_guaranteed_sale') return {usable:false,label:'USA NEL MERCATO INVERNALE'};
    return {usable:false,label:'NON DISPONIBILE'};
  }

  function renderConsumableInventory(){
    const grid=$runtime.$('consumableInventoryGrid'),season=$runtime.ensureSeasonState();
    if(!grid||!season) return;
    const day=season.currentMatchday;
    const ids=['cons_celebrity','cons_starter_report','cons_training','cons_opponent_block','cons_reroll_event','cons_reroll_admin','cons_reroll_rules','cons_guaranteed_sale'];
    grid.innerHTML=ids.map(id=>{
      const item=$runtime.SHOP_ITEMS[id],qty=$runtime.consumableQuantity(id,season),action=$runtime.lineupConsumableActionState(id,day);
      const canUse=qty>0&&action.usable;
      return `<article class="consumable-inventory-item ${qty<=0?'is-empty':''}">
        <span class="consumable-inventory-icon">${item.icon}</span>
        <div><strong>${$runtime.escapeHtml(item.name)}</strong><small>${$runtime.escapeHtml(item.description)}</small></div>
        <b>×${qty}</b>
        <button type="button" class="${canUse?'primary':'ghost'}" data-use-consumable="${$runtime.escapeHtml(id)}" ${canUse?'':'disabled'}>${qty<=0&&!(id==='cons_celebrity'&&Number($runtime.state.career?.nextSponsorSeason)===Number($runtime.state.career?.seasonNumber||1)+1)?'ESAURITO':$runtime.escapeHtml(action.label)}</button>
      </article>`;
    }).join('');
    if(!ids.some(id=>$runtime.consumableQuantity(id,season)>0)) grid.insertAdjacentHTML('beforeend','<p class="mobile-inventory-empty">Non hai oggetti disponibili nell’inventario.</p>');
    grid.querySelectorAll('[data-use-consumable]').forEach(btn=>btn.addEventListener('click',()=>$runtime.beginConsumableUse(btn.dataset.useConsumable)));
    const total=$runtime.totalConsumablesOwned(season);
    if($runtime.$('consumableModalTitle')) $runtime.$('consumableModalTitle').textContent=`Consumabili · ${total} in inventario`;
    if($runtime.$('consumableModalText')) $runtime.$('consumableModalText').textContent='Gli oggetti disponibili qui si usano prima della Diretta Gol. Reroll e Cessione Garantita compaiono automaticamente nel loro momento specifico.';
  }

  function openConsumableInventory(){
    const modal=$runtime.$('consumableModal');
    if(!modal||!$runtime.ensureSeasonState()) return;
    $runtime.$('consumableTargetPanel')?.classList.add('hidden');
    $runtime.$('consumableInventoryGrid')?.classList.remove('hidden');
    $runtime.renderConsumableInventory();
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
  }

  function beginConsumableUse(id){
    const season=$runtime.ensureSeasonState(),day=season?.currentMatchday;
    if(!season||!day||$runtime.consumableQuantity(id,season)<=0) return;
    if(id==='cons_celebrity'){
      if(!$runtime.lineupConsumableActionState(id,day).usable) return;
      if(!$runtime.consumeConsumable(id,{day,note:'celebrity_next_season'})) return;
      $runtime.state.career.nextSponsorSeason=Number($runtime.state.career.seasonNumber||1)+1;
      $runtime.saveState();
      $runtime.renderConsumableInventory();
      $runtime.showToast('Celebrità attiva: la prossima stagione scegli 2 sponsor su 3.');
      return;
    }
    if(id==='cons_starter_report'){
      if($runtime.shopItemActive('scout_plus',season)||$runtime.starterReportActive(day)) return;
      if(!$runtime.consumeConsumable(id,{day,note:'starter_report'})) return;
      $runtime.consumableDayEffect(day,season).starterReport=true;
      $runtime.saveState();
      $runtime.closeConsumableModal();
      $runtime.renderLineupScreen();
      $runtime.showToast('Report Titolarità attivo: percentuali visibili per tutta la giornata.');
      return;
    }
    if(id==='cons_training' || id==='cons_opponent_block') $runtime.showConsumableTargets(id);
  }

  function showConsumableTargets(id){
    const season=$runtime.ensureSeasonState(),day=season?.currentMatchday;
    if(!season||!day) return;
    const panel=$runtime.$('consumableTargetPanel'),grid=$runtime.$('consumableInventoryGrid'),list=$runtime.$('consumableTargetList');
    if(!panel||!grid||!list) return;
    const own=id==='cons_training';
    const opponentId=$runtime.userOpponentIdForDay(day);
    const manager=own?$runtime.managerById('user'):$runtime.managerById(opponentId);
    const roster=(manager?.roster||[]).filter(player=>!$runtime.playerStatusForDay(player.id,day).unavailable).slice().sort((a,b)=>$runtime.ROLE_ORDER.indexOf(a.role)-$runtime.ROLE_ORDER.indexOf(b.role)||$runtime.currentPlayerOvr(b)-$runtime.currentPlayerOvr(a));
    const trained=own?new Set($runtime.specialTrainingPlayerIds(day)):new Set();
    const blocked=new Set($runtime.blockedOpponentPlayerIds(day));
    if($runtime.$('consumableTargetKicker')) $runtime.$('consumableTargetKicker').textContent=own?'ALLENAMENTO SPECIALE':'BLOCCO AVVERSARIO';
    if($runtime.$('consumableTargetTitle')) $runtime.$('consumableTargetTitle').textContent=own?'Scegli un tuo giocatore · ogni giocatore può riceverlo una sola volta':`Scegli chi bloccare · ${manager?.team||'Avversario'} · ${blocked.size}/${window.FantaCareerEngine.opponentBlockLimit(season)} blocchi usati`;
    list.innerHTML=roster.map(player=>{
      const alreadyTrained=own&&trained.has(String(player.id));
      const alreadyBlocked=!own&&blocked.has(String(player.id));
      const disabled=alreadyTrained||alreadyBlocked||(!own&&blocked.size>=window.FantaCareerEngine.opponentBlockLimit(season));
      return `<button type="button" class="consumable-target-player ${disabled?'is-disabled':''}" data-consumable-target="${$runtime.escapeHtml(String(player.id))}" data-consumable-type="${$runtime.escapeHtml(id)}" ${disabled?'disabled':''}><span class="lineup-role-chip role-${player.role}">${player.role}</span><span><strong>${$runtime.escapeHtml(player.name)}</strong><small>${$runtime.escapeHtml($runtime.clubShort(player.club))} · OVR ${$runtime.playerOvrLabel(player)}${!own&&$runtime.shopItemActive('scout_plus',season)?` · Tit. ${$runtime.estimatedStarterProbability(player,day)}%`:''}</small></span><b>${alreadyTrained?'GIÀ ALLENATO':alreadyBlocked?'GIÀ BLOCCATO':own?'ALLENA':'BLOCCA'}</b></button>`;
    }).join('') || '<div class="consumable-target-empty">Nessun giocatore disponibile.</div>';
    list.querySelectorAll('[data-consumable-target]').forEach(btn=>btn.addEventListener('click',()=>$runtime.applyTargetedConsumable(btn.dataset.consumableType,btn.dataset.consumableTarget)));
    grid.classList.add('hidden');
    panel.classList.remove('hidden');
  }

  function applyTargetedConsumable(id,playerId){
    const season=$runtime.ensureSeasonState(),day=season?.currentMatchday;
    if(!season||!day||$runtime.consumableQuantity(id,season)<=0) return;
    const effect=$runtime.consumableDayEffect(day,season);
    if(id==='cons_training'){
      if($runtime.specialTrainingUsedForPlayer(day,playerId)) return;
      const player=$runtime.managerById('user')?.roster?.find(p=>String(p.id)===String(playerId));
      if(!player || $runtime.playerStatusForDay(player.id,day).unavailable) return;
      if(!$runtime.consumeConsumable(id,{day,note:'special_training',targetPlayerId:player.id})) return;
      const ids=$runtime.specialTrainingPlayerIds(day);
      ids.push(String(player.id));
      effect.trainingPlayerIds=[...new Set(ids)];
      // Campo legacy mantenuto per compatibilità con salvataggi/versioni precedenti.
      effect.trainingPlayerId=effect.trainingPlayerIds[0]||null;
      effect.trainingAppliedAtByPlayer ||= {};
      effect.trainingAppliedAtByPlayer[String(player.id)]=Date.now();
      effect.trainingAppliedAt=Date.now();
      $runtime.saveState();
      $runtime.closeConsumableModal();
      $runtime.renderLineupScreen();
      $runtime.showToast(`Allenamento Speciale: ${player.name} riceve il boost per la giornata. Puoi usarne un altro su un giocatore diverso.`);
      return;
    }
    if(id==='cons_opponent_block'){
      if($runtime.lineupReadOnly) return;
      const ids=$runtime.blockedOpponentPlayerIds(day);
      if(ids.length>=window.FantaCareerEngine.opponentBlockLimit(season) || ids.includes(String(playerId))) return;
      const opponentId=$runtime.userOpponentIdForDay(day),opponent=$runtime.managerById(opponentId);
      const player=(opponent?.roster||[]).find(p=>String(p.id)===String(playerId));
      if(!player || $runtime.playerStatusForDay(player.id,day).unavailable) return;
      if(!$runtime.consumeConsumable(id,{day,note:'opponent_block',targetPlayerId:player.id})) return;
      effect.blockedOpponentPlayerIds=[...ids,String(player.id)];
      effect.blockedOpponentPlayerId=effect.blockedOpponentPlayerIds[0];
      effect.blockedOpponentManagerId=String(opponentId||'');
      effect.blockedAt=Date.now();
      if(season.lineups?.[String(day)]?.[opponentId]) delete season.lineups[String(day)][opponentId];
      $runtime.saveState();
      $runtime.closeConsumableModal();
      $runtime.renderLineupScreen();
      $runtime.showToast(`Blocco Avversario: ${player.name} non potrà essere schierato da ${opponent?.team||'l’avversario'}. Blocchi usati: ${effect.blockedOpponentPlayerIds.length}/${window.FantaCareerEngine.opponentBlockLimit(season)}.`);
    }
  }

  function enforceOpponentConsumableBlock(manager,lineup,day){
    const blockedIds=new Set($runtime.blockedOpponentPlayerIds(day)),opponentId=$runtime.userOpponentIdForDay(day);
    if(!blockedIds.size||!manager||String(manager.id)!==String(opponentId)||!lineup) return lineup;
    lineup.bench=(lineup.bench||[]).map(String).filter(id=>!blockedIds.has(id));
    for(const [slotId,playerId] of Object.entries(lineup.starters||{})){
      if(!blockedIds.has(String(playerId))) continue;
      const blocked=(manager.roster||[]).find(p=>String(p.id)===String(playerId));
      const used=new Set(Object.values(lineup.starters||{}).map(String));
      const replacement=(manager.roster||[]).filter(p=>p.role===blocked?.role&&!blockedIds.has(String(p.id))&&!used.has(String(p.id))&&!$runtime.playerStatusForDay(p.id,day).unavailable).sort((a,b)=>$runtime.cpuLeagueRuleLineupValue(manager,b,day)-$runtime.cpuLeagueRuleLineupValue(manager,a,day))[0];
      if(replacement){
        lineup.starters[slotId]=String(replacement.id);
        lineup.bench=lineup.bench.filter(id=>id!==String(replacement.id));
      }else delete lineup.starters[slotId];
    }
    const used=new Set(Object.values(lineup.starters||{}).map(String));
    const ro={P:0,D:1,C:2,A:3};
    (manager.roster||[]).filter(p=>!blockedIds.has(String(p.id))&&!used.has(String(p.id))&&!lineup.bench.includes(String(p.id))).slice().sort((a,b)=>ro[a.role]-ro[b.role]||$runtime.cpuLeagueRuleLineupValue(manager,b,day)-$runtime.cpuLeagueRuleLineupValue(manager,a,day)).forEach(p=>lineup.bench.push(String(p.id)));
    if(blockedIds.has(String(lineup.captainId||''))) lineup.captainId=null;
    lineup.blockedByConsumable=[...blockedIds][0];
    lineup.blockedByConsumables=[...blockedIds];
    return lineup;
  }

  function renderLineupScreen() {
    const season=$runtime.ensureSeasonState();
    const scoutPlusActive=$runtime.shopItemActive('scout_plus',season);
    const dataProActive=$runtime.shopItemActive('fantadata_pro',season);
    $runtime.renderCareerWallets();
    const manager=$runtime.managerById('user');
    if (!season || !manager || !$runtime.lineupDraft) return;
    const day=season.currentMatchday;
    const captainActive=$runtime.leagueRulesFor($runtime.state).captainBonus!=='off';
    const captainId=captainActive?String($runtime.lineupDraft.captainId||''):'';
    const starterInsightActive=scoutPlusActive||$runtime.starterReportActive(day);
    const fixture=$runtime.currentUserFixture();
    const opponentId=fixture?.homeId==='user'?fixture?.awayId:fixture?.homeId;
    const opponent=$runtime.managerById(opponentId);
    if ($runtime.$('lineupMatchdayNo')) $runtime.$('lineupMatchdayNo').textContent=day;
    if ($runtime.$('lineupPageTitle')) $runtime.$('lineupPageTitle').textContent=`${manager.team} · ${$runtime.lineupDraft.formation}`;
    if ($runtime.$('lineupOpponentText')) $runtime.$('lineupOpponentText').textContent=$runtime.lineupReadOnly
      ? `G${day} · formazione bloccata · parziale contro ${opponent?.team||'—'}`
      : `G${day} · ${fixture?.homeId==='user'?'Casa':'Trasferta'} contro ${opponent?.team||'—'}`;

    const consumableBtn=$runtime.$('lineupConsumablesBtn');
    if(consumableBtn){
      const qty=$runtime.totalConsumablesOwned(season);
      consumableBtn.disabled=$runtime.lineupReadOnly;
      consumableBtn.classList.toggle('has-items',qty>0);
      consumableBtn.title=$runtime.lineupReadOnly?'Consumabili non disponibili durante la Diretta Gol':'Apri inventario consumabili';
      if($runtime.$('lineupConsumablesCount')) $runtime.$('lineupConsumablesCount').textContent=String(qty);
    }

    const activeTwist=$runtime.activeAdminRule(day) || $runtime.activeFormationChoice(day) || $runtime.activeOpponentMalus(day);
    const twistBanner=$runtime.$('lineupTwistBanner');
    if(twistBanner){
      twistBanner.style.display=activeTwist?'':'none';
      if(activeTwist){
        if($runtime.$('lineupTwistType')) $runtime.$('lineupTwistType').textContent=$runtime.formationChoiceCategoryLabel(activeTwist.category);
        if($runtime.$('lineupTwistTitle')) $runtime.$('lineupTwistTitle').textContent=activeTwist.title;
        if($runtime.$('lineupTwistText')) $runtime.$('lineupTwistText').textContent=activeTwist.text;
        if($runtime.$('lineupTwistBadge')){
          $runtime.$('lineupTwistBadge').textContent=activeTwist.category==='rule'?'REGOLA ATTIVA':'EFFETTO ATTIVO';
          $runtime.$('lineupTwistBadge').className=`lineup-twist-badge type-${$runtime.formationChoiceCategoryClass(activeTwist.category)}`;
        }
      }
    }

    const readonlyBanner=$runtime.$('lineupReadOnlyBanner');
    if(readonlyBanner){
      readonlyBanner.style.display=$runtime.lineupReadOnly?'':'none';
      if($runtime.lineupReadOnly && $runtime.lineupPartialContext?.user){
        const u=$runtime.lineupPartialContext.user, o=$runtime.lineupPartialContext.opponent;
        if($runtime.$('lineupPartialScore')) $runtime.$('lineupPartialScore').textContent=o
          ? `${manager.team} ${u.fantasyPoints.toFixed(1)} - ${o.fantasyPoints.toFixed(1)} ${opponent?.team||'Avversario'}`
          : `${u.fantasyPoints.toFixed(1)} fantapunti parziali`;
        if($runtime.$('lineupPartialBadge')) $runtime.$('lineupPartialBadge').textContent=`${u.votedCount}/11 CON VOTO`;
        if($runtime.$('lineupPartialNote')) $runtime.$('lineupPartialNote').textContent=
          `${u.pendingCount} titolar${u.pendingCount===1?'e deve':'i devono'} ancora giocare il Big Match. La rosa è consultabile ma completamente bloccata.`;
      }
    }

    if($runtime.$('lineupSaveBtn')){
      $runtime.$('lineupSaveBtn').disabled=$runtime.lineupReadOnly;
      $runtime.$('lineupSaveBtn').textContent=$runtime.lineupReadOnly?'BLOCCATA':'Salva';
    }
    const assistantCoachActive=$runtime.shopItemActive('assistant_coach',season);
    if($runtime.$('autoLineupBtn')) {
      $runtime.$('autoLineupBtn').classList.toggle('hidden',false);
      $runtime.$('autoLineupBtn').disabled=$runtime.lineupReadOnly || !assistantCoachActive;
      $runtime.$('autoLineupBtn').textContent='AUTO XI';
      const caps=$runtime.assistantAutoLineupCapabilities(season);
      $runtime.$('autoLineupBtn').title=`Assistente Tecnico: OVR + disponibilità${caps.scout?' + titolarità Scout Plus':''}${caps.fantadata?' + forma/rendimento + avversario Serie A FantaData':''}`;
    }
    const autoXiInfo=$runtime.$('autoXiAnalysisInfo');
    if(autoXiInfo){
      autoXiInfo.classList.toggle('hidden',false);
      if(assistantCoachActive) autoXiInfo.innerHTML=$runtime.assistantAutoLineupAnalysisHtml(season);
    }
    if($runtime.$('carryLineupBtn')){
      const carry=$runtime.assistantCoachCarryEnabled(season);
      $runtime.$('carryLineupBtn').classList.toggle('hidden',false);
      $runtime.$('carryLineupBtn').disabled=$runtime.lineupReadOnly;
      $runtime.$('carryLineupBtn').classList.toggle('active',carry);
      $runtime.$('carryLineupBtn').textContent=carry?'✓ MANTIENI FORMAZIONE · ON':'MANTIENI FORMAZIONE · OFF';
      $runtime.$('carryLineupBtn').title=carry?'Titolari, capitano e ordine della panchina verranno riproposti nelle prossime giornate. Clicca per disattivare.':'Salva titolari, capitano e ordine della panchina per le prossime giornate.';
    }
    const unavailableNow=$runtime.unavailableDraftStarters();
    if($runtime.$('assistantFixOutBtn')){
      const showFix=assistantCoachActive && unavailableNow.length>0 && !$runtime.lineupReadOnly;
      $runtime.$('assistantFixOutBtn').classList.toggle('hidden',!showFix);
      $runtime.$('assistantFixOutBtn').disabled=!showFix;
      $runtime.$('assistantFixOutBtn').textContent=`SISTEMA OUT${unavailableNow.length?` · ${unavailableNow.length}`:''}`;
    }
    const assistantBanner=$runtime.$('assistantCoachBanner');
    if(assistantBanner){
      const show=assistantCoachActive && $runtime.lineupAssistantAdjustments.length>0;
      assistantBanner.style.display=show?'':'none';
      if(show && $runtime.$('assistantCoachBannerText')) $runtime.$('assistantCoachBannerText').textContent=$runtime.lineupAssistantAdjustments.map(x=>`${x.outName} → ${x.inName}`).join(' · ');
    }
    if($runtime.$('clearLineupBtn')) $runtime.$('clearLineupBtn').disabled=$runtime.lineupReadOnly;

    const forcedFormation=$runtime.forcedFormationRuleForDay(day);
    $runtime.$('formationButtons').innerHTML=$runtime.availableLineupFormations().map(key=>`<button class="formation-choice ${key===$runtime.lineupDraft.formation?'active':''} ${forcedFormation&&key===forcedFormation?'is-forced':''}" data-lineup-formation="${key}" ${($runtime.lineupReadOnly || (forcedFormation && key!==forcedFormation)) ? 'disabled' : ''}>${key}</button>`).join('');
    if(!$runtime.lineupReadOnly) $runtime.$('formationButtons').querySelectorAll('[data-lineup-formation]').forEach(btn=>btn.addEventListener('click',()=>$runtime.setDraftFormation(btn.dataset.lineupFormation)));

    const starterIds=$runtime.draftStarterIds();
    const lineupAdminEffect=$runtime.activeAdminRuleEffect(day);
    const adminBlockedUserId=!$runtime.lineupReadOnly?$runtime.adminBlockedStarterForManager('user',day):null;
    const faithReserveIds=!$runtime.lineupReadOnly?new Set($runtime.adminFaithReserveEligibleIds(day)):new Set();
    const roleOrder=['P','D','C','A'];
    $runtime.$('lineupRosterList').innerHTML=roleOrder.map(role=>{
      const items=(manager.roster||[]).filter(p=>p.role===role).slice().sort((a,b)=>$runtime.lineupPlayerValue(b)-$runtime.lineupPlayerValue(a));
      return `<section class="lineup-role-group"><div class="lineup-role-head"><strong>${$runtime.ROLE_PLURALS[role]}</strong><span>${items.filter(p=>starterIds.has(String(p.id))).length}/${$runtime.lineupCountsForFormation($runtime.lineupDraft.formation)[role]}</span></div>${items.map(p=>{
        const starter=starterIds.has(String(p.id)), selected=String(p.id)===String($runtime.lineupSelectedPlayerId);
        const adminBlocked=!!adminBlockedUserId && String(adminBlockedUserId)===String(p.id);
        const faithReserve=faithReserveIds.has(String(p.id));
        const partial=$runtime.lineupReadOnly?$runtime.pendingPartialPlayerInfo(p):null;
        const availability=!$runtime.lineupReadOnly?$runtime.playerStatusForDay(p.id,day):null;
        const form=!$runtime.lineupReadOnly?$runtime.playerFormMetrics(p.id):null;
        const formText=!$runtime.lineupReadOnly?$runtime.visibleFormLabel(p.id,1,season):'';
        const seasonExtra=!$runtime.lineupReadOnly?` · ${formText}${availability?.unavailable?` · ${availability.label}`:''}`:'';
        const serieAFixture=!$runtime.lineupReadOnly?$runtime.serieAFixtureForPlayer(p,day):null;
        const serieADifficulty=!$runtime.lineupReadOnly&&dataProActive?$runtime.serieAMatchupDifficulty(p,day):null;
        return `<button class="lineup-roster-player ${starter?'is-starter':''} ${selected?'is-selected':''} ${partial?.className||''} ${availability?.unavailable?'is-unavailable':''} ${adminBlocked?'is-admin-blocked':''} ${faithReserve?'is-admin-reserve':''}" data-lineup-player="${$runtime.escapeHtml(p.id)}" ${$runtime.lineupReadOnly||adminBlocked?'disabled':'draggable="true"'}><span class="lineup-roster-leading">${$runtime.lineupPlayerFaceMarkup(p,'roster')}<span class="lineup-role-chip role-${p.role}">${p.role}</span></span><span class="lineup-roster-copy"><strong>${$runtime.escapeHtml(p.name)}${!$runtime.lineupReadOnly&&lineupAdminEffect?.ruleId==='forced_starter_pair'&&String(lineupAdminEffect?.userPlayerId||'')===String(p.id)?'<span class="admin-forced-player-badge">📌 ADMIN</span>':''}${adminBlocked?'<span class="admin-forced-player-badge">🔒 PANCHINA</span>':''}${faithReserve?'<span class="admin-forced-player-badge">🌱 RISERVA</span>':''}</strong><small>${$runtime.escapeHtml($runtime.clubShort(p.club))} · OVR ${$runtime.playerOvrLabel(p)}${partial?` · ${$runtime.escapeHtml(partial.label)}`:''}${$runtime.escapeHtml(seasonExtra)}</small>${serieAFixture?`<em class="lineup-seriea-fixture">vs ${$runtime.escapeHtml(serieAFixture.opponentShort)} · ${serieAFixture.home?'CASA':'TRASF.'}${serieADifficulty?` · ${serieADifficulty.icon} ${serieADifficulty.label}`:''}</em>`:''}${!$runtime.lineupReadOnly&&starterInsightActive?$runtime.scoutStarterBadge(p,day):''}</span><span class="lineup-roster-state">${$runtime.lineupReadOnly?(partial?.pending?'POST':partial?.noVote?'SV':starter?'TIT':'ROS'):(adminBlocked?'LOCK':availability?.unavailable?'OUT':starter?'TIT':'+')}</span></button>`;
      }).join('')}</section>`;
    }).join('');
    if(!$runtime.lineupReadOnly) $runtime.$('lineupRosterList').querySelectorAll('[data-lineup-player]').forEach(btn=>btn.addEventListener('click',()=>$runtime.selectLineupPlayer(btn.dataset.lineupPlayer)));

    const lineupIndicators=(player,difficulty,side)=>{
      if($runtime.lineupReadOnly)return '';
      if(side==='left'){
        if(!dataProActive)return '';
        const st=$runtime.playerSeasonStat(player.id);
        const mv=Number(st?.voteCount||0)>0?(Number(st.voteSum||0)/Number(st.voteCount)).toFixed(2):'—';
        return `<span class="lineup-metric-left ${mv!=='—'?(Number(mv)>=7?'mv-high':Number(mv)>=6?'mv-medium':'mv-low'):'mv-neutral'}"><small>MV</small><b>${mv}</b></span>`;
      }
      if(!dataProActive&&!starterInsightActive)return '';
      const starterPct=starterInsightActive?$runtime.estimatedStarterProbability(player,day):null;
      const starterLevel=starterPct>=70?'high':starterPct>=40?'medium':'low';
      return `<span class="lineup-metric-right">${dataProActive?`<span title="${difficulty?$runtime.escapeHtml(difficulty.label):'Difficoltà partita'}">${difficulty?.icon||'—'}</span>`:''}${starterInsightActive?`<b class="lineup-starter-probability ${starterLevel}" title="Titolarità stimata">${starterPct}%</b>`:''}</span>`;
    };
    const selectedPlayer=$runtime.draftPlayerById($runtime.lineupSelectedPlayerId);
    const slots=$runtime.lineupSlots($runtime.lineupDraft.formation);
    $runtime.$('lineupPitch')?.classList.toggle('is-dense-formation',['P','D','C','A'].some(role=>slots.filter(slot=>slot.role===role).length>=5));
    $runtime.$('lineupPitch')?.classList.toggle('is-formation-334',$runtime.lineupDraft.formation==='3-3-4');
    $runtime.$('lineupPitch')?.classList.toggle('is-formation-555',$runtime.lineupDraft.formation==='5-5-5');
    $runtime.$('lineupPitchSlots').innerHTML=slots.map(slot=>{
      const roleSlots=slots.filter(item=>item.role===slot.role);
      const roleIndex=roleSlots.findIndex(item=>item.instanceId===slot.instanceId);
      const portraitX=roleSlots.length===1?50:slot.role==='A'&&roleSlots.length===2?36+roleIndex*28:14+roleIndex*72/(roleSlots.length-1);
      const portraitY=({A:15,C:40,D:65,P:87})[slot.role]??slot.y;
      const pid=$runtime.lineupDraft.starters[slot.instanceId];
      const p=pid?$runtime.draftPlayerById(pid):null;
      const available=selectedPlayer && $runtime.canPlacePlayerInLineupSlot(selectedPlayer,slot,$runtime.lineupDraft,day);
      const selected=p && String(p.id)===String($runtime.lineupSelectedPlayerId);
      const partial=p&&$runtime.lineupReadOnly?$runtime.pendingPartialPlayerInfo(p):null;
      const pitchFixture=p&&!$runtime.lineupReadOnly?$runtime.serieAFixtureForPlayer(p,day):null;
      const pitchDifficulty=p&&!$runtime.lineupReadOnly&&dataProActive?$runtime.serieAMatchupDifficulty(p,day):null;
      const wildcardRole=p && p.role!==slot.role;
      return `<button class="lineup-slot ${p?'filled':''} role-${slot.role} ${available&&!$runtime.lineupReadOnly?'available':''} ${selected?'selected-slot':''} ${wildcardRole?'is-admin-wildcard':''} ${partial?.className||''}" data-lineup-slot="${slot.instanceId}" ${!$runtime.lineupReadOnly&&p?'draggable="true"':''} style="left:${portraitX}%;top:${portraitY}%" ${$runtime.lineupReadOnly?'disabled':''}><span class="slot-pos">${slot.key}</span>${p?`${lineupIndicators(p,pitchDifficulty,'left')}${$runtime.lineupPlayerFaceMarkup(p,'pitch')}${lineupIndicators(p,pitchDifficulty,'right')}${String(p.id)===captainId?'<span class="lineup-captain-badge" title="Capitano">C</span>':''}<span class="lineup-slot-copy"><strong title="${$runtime.escapeHtml(p.name)}">${$runtime.escapeHtml($runtime.compactLineupPlayerName(p.name))}</strong><small>${$runtime.escapeHtml($runtime.clubShort(p.club))} · ${partial?$runtime.escapeHtml(partial.label):$runtime.playerOvrLabel(p)}${wildcardRole?' · 🃏 JOLLY':''}${pitchFixture?` · vs ${$runtime.escapeHtml(pitchFixture.opponentShort)}${pitchDifficulty?` ${pitchDifficulty.icon}`:''}`:''}</small></span>`:'<strong>+</strong><small>vuoto</small>'}</button>`;
    }).join('');
    if(!$runtime.lineupReadOnly) $runtime.$('lineupPitchSlots').querySelectorAll('[data-lineup-slot]').forEach(btn=>btn.addEventListener('click',()=>{
      const slotId=btn.dataset.lineupSlot;
      const playerId=$runtime.lineupDraft.starters[slotId];
      if(playerId)$runtime.selectLineupPlayer(playerId);
      else $runtime.openLineupSlotPicker(slotId);
    }));

    const bench=$runtime.draftBenchPlayers();
    $runtime.$('lineupBenchList').innerHTML=bench.map((p,idx)=>{
      const partial=$runtime.lineupReadOnly?$runtime.pendingPartialPlayerInfo(p):null;
      const availability=!$runtime.lineupReadOnly?$runtime.playerStatusForDay(p.id,day):null;
      return `<div class="bench-player-row ${availability?.unavailable?'is-unavailable':''}">
        <button class="bench-player ${String(p.id)===String($runtime.lineupSelectedPlayerId)?'is-selected':''} ${partial?.className||''}" data-bench-player="${$runtime.escapeHtml(p.id)}" title="${$runtime.escapeHtml(p.name)}" aria-label="${$runtime.escapeHtml(p.name)} · ${$runtime.escapeHtml(p.role)} · riserva ${idx+1}" ${$runtime.lineupReadOnly?'disabled':'draggable="true"'}><span class="bench-order-badge">${String(idx+1).padStart(2,'0')}</span><span class="lineup-bench-leading">${$runtime.lineupPlayerFaceMarkup(p,'bench')}<i class="lineup-role-chip role-${p.role}">${p.role}</i></span><span class="lineup-bench-name">${$runtime.escapeHtml(p.name)}</span></button>
        ${$runtime.lineupReadOnly?'':`<div class="bench-order-controls"><button type="button" data-bench-up="${$runtime.escapeHtml(p.id)}" ${idx===0?'disabled':''} title="Sposta prima">▲</button><button type="button" data-bench-down="${$runtime.escapeHtml(p.id)}" ${idx===bench.length-1?'disabled':''} title="Sposta dopo">▼</button></div>`}
      </div>`;
    }).join('');
    if(!$runtime.lineupReadOnly){
      $runtime.$('lineupBenchList').querySelectorAll('[data-bench-player]').forEach(btn=>btn.addEventListener('click',()=>$runtime.selectLineupPlayer(btn.dataset.benchPlayer)));
      $runtime.$('lineupBenchList').querySelectorAll('[data-bench-up]').forEach(btn=>btn.addEventListener('click',()=>$runtime.moveBenchPlayer(btn.dataset.benchUp,-1)));
      $runtime.$('lineupBenchList').querySelectorAll('[data-bench-down]').forEach(btn=>btn.addEventListener('click',()=>$runtime.moveBenchPlayer(btn.dataset.benchDown,1)));
      $runtime.bindLineupDragDrop();
    }

    const count=starterIds.size;
    const required=slots.length;
    const adminValidation=$runtime.validateAdminRuleLineup($runtime.lineupDraft,day);
    $runtime.$('lineupStarterCount').textContent=`${count}/${required}`;
    $runtime.$('benchCount').textContent=String(bench.length);
    $runtime.$('lineupReadyText').textContent=`${count} / ${required}`;
    const baseValidationText=$runtime.lineupReadOnly
      ? 'Sola lettura: la formazione della giornata è già bloccata.'
      : (count===required?'Formazione valida. Le CPU prepareranno automaticamente i titolari.':`Mancano ${required-count} titolari.`);
    let extraRuleText='';
    const adminEffect=$runtime.activeAdminRuleEffect(day);
    if(!$runtime.lineupReadOnly && (adminEffect?.ruleId==='forced_formation' || adminEffect?.ruleId==='butterfly_555')) extraRuleText=` Regola Admin: modulo obbligatorio ${adminEffect.formation}.`;
    if(!$runtime.lineupReadOnly && (adminEffect?.ruleId==='forced_turnover_3' || adminEffect?.ruleId==='forced_turnover_5')){
      const required=adminEffect.ruleId==='forced_turnover_5'?5:3;
      const turnover=$runtime.lineupTurnoverDeltaFromPrevious($runtime.lineupDraft,day,required);
      extraRuleText=` Regola Admin: cambi titolari ${turnover.changed}/${required} rispetto alla giornata precedente.`;
    }
    if(!$runtime.lineupReadOnly && adminEffect?.ruleId==='forced_starter_pair'){
      const forcedPlayer=$runtime.draftPlayerById(adminEffect.userPlayerId);
      const isStarter=Object.values($runtime.lineupDraft?.starters||{}).map(String).includes(String(adminEffect.userPlayerId||''));
      extraRuleText=` Regola Admin: ${forcedPlayer?.name||adminEffect.userPlayerName||'giocatore imposto'} deve essere titolare ${isStarter?'✓':'· NON ANCORA SCHIERATO'}.`;
    }
    if(!$runtime.lineupReadOnly && adminEffect?.ruleId==='top_player_bench'){
      extraRuleText=` Regola Admin: 🔒 ${adminEffect.userPlayerName||'Top Player'} deve partire dalla panchina.`;
    }
    if(!$runtime.lineupReadOnly && adminEffect?.ruleId==='faith_reserve'){
      const eligible=new Set((adminEffect.eligiblePlayerIds||[]).map(String));
      const used=Object.values($runtime.lineupDraft?.starters||{}).map(String).some(id=>eligible.has(id));
      extraRuleText=` Regola Admin: 🌱 schiera almeno una riserva non entrata nella giornata precedente ${used?'✓':'· NON ANCORA SCHIERATA'}.`;
    }
    if(!$runtime.lineupReadOnly && (adminEffect?.ruleId==='wildcard_starting_slot' || adminEffect?.ruleId==='double_wildcard_starting_slot')){
      const wildcardCount=$runtime.lineupOutOfRoleEntries($runtime.lineupDraft).length;
      const wildcardLimit=adminEffect.ruleId==='double_wildcard_starting_slot'?2:1;
      extraRuleText=` Regola Admin: ${wildcardLimit===2?'Doppio Jolly':'Wildcard'} fuori ruolo ${wildcardCount}/${wildcardLimit} usat${wildcardCount===1?'o':'i'} · compatibilità D↔C e C↔A.`;
    }
    if(!$runtime.lineupReadOnly && window.FantaCareerEngine.findSeasonSponsor($runtime.state?.season,'fantacana') && !extraRuleText){
      extraRuleText=` Sponsor Haaland Rover: ${$runtime.lineupOutOfRoleEntries($runtime.lineupDraft).length}/${$runtime.adminWildcardStartingSlotLimit()} titolare fuori ruolo tra D, C e A.`;
    }
    if(!$runtime.lineupReadOnly && adminEffect?.ruleId==='no_substitutions') extraRuleText=' Regola Admin: niente sostituzioni dalla panchina in questa giornata.';
    $runtime.$('lineupValidationText').textContent = (!$runtime.lineupReadOnly && count===required && !adminValidation.ok)
      ? adminValidation.message
      : `${baseValidationText}${extraRuleText}`.trim();
    const changePlayerButton=$runtime.$('changeSelectedPlayerBtn');
    if(changePlayerButton){
      changePlayerButton.disabled=$runtime.lineupReadOnly||!selectedPlayer||!starterIds.has(String(selectedPlayer.id));
      changePlayerButton.onclick=()=>{
        const slotId=$runtime.draftSlotForPlayer($runtime.lineupSelectedPlayerId);
        if(slotId&&!$runtime.lineupReadOnly)$runtime.openLineupSlotPicker(slotId);
      };
    }
    if($runtime.$('captainSelectedBtn')){
      $runtime.$('captainSelectedBtn').style.display=captainActive?'':'none';
      $runtime.$('captainSelectedBtn').disabled=$runtime.lineupReadOnly || !selectedPlayer || !starterIds.has(String(selectedPlayer.id));
      $runtime.$('captainSelectedBtn').textContent=selectedPlayer && String(selectedPlayer.id)===captainId?'© CAPITANO SCELTO':'© NOMINA CAPITANO';
    }
    if($runtime.$('lineupCaptainText')){
      const captain=$runtime.draftPlayerById(captainId);
      $runtime.$('lineupCaptainText').style.display=captainActive?'':'none';
      $runtime.$('lineupCaptainText').textContent=`Capitano: ${captain?.name||'da scegliere'} · ${$runtime.leagueRulesFor($runtime.state).captainBonus==='seven'?'+1 con voto ≥ 7':'+2 con voto ≥ 8'}`;
    }
    $runtime.$('confirmLineupBtn').disabled=$runtime.lineupReadOnly || count!==required || !adminValidation.ok;
    $runtime.$('confirmLineupBtn').classList.toggle('lineup-ready', !$runtime.lineupReadOnly && count===required && adminValidation.ok);
    $runtime.$('confirmLineupBtn').textContent=$runtime.lineupReadOnly?'FORMAZIONE BLOCCATA':'CONFERMA FORMAZIONE';
    $runtime.$('lineupSelectedText').textContent=$runtime.lineupReadOnly
      ? 'Consulta i voti parziali: nessuna modifica consentita'
      : (selectedPlayer?`${selectedPlayer.name} · ${$runtime.ROLE_LABELS[selectedPlayer.role]} · scegli uno slot`:'Seleziona un giocatore dalla rosa');
    $runtime.$('benchSelectedBtn').disabled=$runtime.lineupReadOnly || !selectedPlayer || !starterIds.has(String(selectedPlayer.id));
  }
    return Object.freeze({lineupDayKey,ensureLineupDayStore,lineupSlots,lineupRequiredStarters,lineupPlayerValue,cpuLeagueRuleLineupValue,cpuLeagueFormationBias,lineupCountsForFormation,normalizeSavedLineup,syncDraftBenchOrder,draftBenchPlayers,moveBenchPlayer,openLineupScreen,draftStarterIds,draftSlotForPlayer,draftPlayerById,setDraftFormation,selectLineupPlayer,nominateLineupCaptain,placePlayerInSlot,openLineupSlotPicker,placeSelectedInSlot,benchSelectedPlayer,clearLineupDragVisuals,beginLineupDrag,endLineupDrag,bindLineupDragDrop,clearDraftLineup,bestPlayersForRole,buildAutoLineup,formationCpuBias,chooseCpuFormation,tacticalExpectedPlayerPoints,tacticalExpectedLineupPoints,adaptTacticalProLineup,autoFillUserLineup,ensureAssistantCoachLineup,assistantCoachCarryEnabled,saveAssistantCoachTemplateFromDraft,toggleAssistantCoachCarry,assistantCoachTemplateForDay,repairAssistantInheritedLineup,seedAssistantCoachLineupForDay,unavailableDraftStarters,repairUnavailableStartersInDraft,saveLineupDraft,confirmUserLineup,closeConsumableModal,lineupConsumableActionState,renderConsumableInventory,openConsumableInventory,beginConsumableUse,showConsumableTargets,applyTargetedConsumable,enforceOpponentConsumableBlock,renderLineupScreen});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['lineup-controller']=Object.freeze({create});
})();
