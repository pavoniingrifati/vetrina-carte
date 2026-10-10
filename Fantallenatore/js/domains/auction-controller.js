/* Responsibility: auction-controller. Only external collaborators use live runtime accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: auction-controller');
  function addAuctionLog(text, side='', kind='') {
    if (!$runtime.state.auction) return;
    $runtime.state.auction.log.push({text,side,kind});
    if ($runtime.state.auction.log.length > 120) $runtime.state.auction.log = $runtime.state.auction.log.slice(-120);
    $runtime.renderAuction();
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
    registerNominationCall(nom.id,p.role);
    $runtime.tickAuctionEventEffectsOnNomination($runtime.state.auction.playerId);
    const pact = $runtime.state.auction.arcade?null:$runtime.activePactForPlayer(playerId);
    if (pact) $runtime.state.auction.pactActive = {cpuId:pact.cpuId, playerId};
    $runtime.saveState();
    $runtime.renderAll();
    if($runtime.state.auction.arcade){beginBidRound();return;}
    if(!$runtime.autocompleteMode && $runtime.maybeTriggerAuctionEvent()) return;
    beginBidRound();
  }

  function scheduleAdvance() {
    // Compatibility wrapper used by older flow/resume paths.
    beginBidRound();
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
    const score=adminOneShotScore(admin,player);
    if(score<=0) return false;
    let best=score;
    for(const id of $runtime.state.availableIds||[]){
      const candidate=$runtime.playerMap.get(String(id));
      if(candidate) best=Math.max(best,adminOneShotScore(admin,candidate));
    }
    if(score<best*.97) return false;
    $runtime.clearAuctionRuntimeTimers();
    $runtime.state.adminOneShot={used:true,managerId:admin.id,playerId:player.id,usedAt:Date.now()};
    a.price=1;a.highBidderId=admin.id;a.activeIds=[admin.id];
    a.awaitingUser=false;a.powerPaused=false;a.adminOneShotForced=true;
    a.log.push({text:'ADMIN USA ONE SHOT!',side:`${player.name} → 1 cr`,kind:'win'});
    if(a.log.length>120) a.log=a.log.slice(-120);
    $runtime.saveState();$runtime.renderAuction();awardAuction();
    return true;
  }

  function beginBidRound() {
    if (!$runtime.state?.auction || $runtime.state.auction.awarding) return;
    if($runtime.state.auction.arcade?.awaitingAck || $runtime.state.auction.arcade?.type==='sealed') return $runtime.showArcadeModal();
    $runtime.state.auction.presenting=false; // Compatibilità con salvataggi creati prima della rimozione della micro-presentazione.
    $runtime.state.auction.awaitingAuctionEvent=false;
    if(tryAdminOneShot()) return;
    if(autoSkipUserIfCannotBid()) return;
    $runtime.cpuReactionTimers.forEach(t => clearTimeout(t));
    $runtime.cpuReactionTimers = [];
    $runtime.resetBidClock();
    scheduleSuddenInterestEntry();
    scheduleCpuReactions();
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
    const a=$runtime.state?.auction, effect=currentSuddenInterestEffect();
    if(!a||!effect||a.suddenInterestScheduled)return false;
    const cpu=$runtime.state.managers.find(m=>m.id===effect.cpuId);
    if(!cpu||!a.activeIds.includes(cpu.id))return false;
    if(a.highBidderId===cpu.id){
      activateSuddenInterest(effect,{silent:true});
      return false;
    }
    a.suddenInterestScheduled=true;
    const delay=$runtime.autocompleteMode?35:($runtime.state?.turbo?420:1250+Math.floor(Math.random()*750));
    if($runtime.suddenInterestTimer) clearTimeout($runtime.suddenInterestTimer);
    $runtime.suddenInterestTimer=setTimeout(()=>{
      $runtime.suddenInterestTimer=null;
      const live=$runtime.state?.auction;
      if(!live||live.playerId!==effect.playerId||live.awarding)return;
      if(!activateSuddenInterest(effect))return;
      if(live.highBidderId!==cpu.id && live.activeIds.includes(cpu.id)){
        const timer=setTimeout(()=>cpuReact(cpu.id), $runtime.autocompleteMode?20:180+Math.floor(Math.random()*260));
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

    const pendingSudden=currentSuddenInterestEffect();
    challengers.forEach(id => {
      const m = $runtime.state.managers.find(x=>x.id===id);
      if (!m) return;
      if (m.id==='user' && !$runtime.autocompleteMode) return; // Human can bid at any time inside the 5-second window.
      if (pendingSudden && pendingSudden.cpuId===m.id) return; // entrerà più tardi come evento INTERESSE IMPROVVISO.
      const timer = setTimeout(() => cpuReact(m.id), $runtime.cpuReactionDelay(m));
      $runtime.cpuReactionTimers.push(timer);
    });
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
      addAuctionLog(m.team, 'BLOCCATO', 'status'); $runtime.saveState(); $runtime.renderManagers(); $runtime.renderAuction();
      // Anche quando una CPU viene esclusa, il countdown resta vivo: niente chiusure anticipate.
      return;
    }

    const pact = $runtime.activePactForPlayer(p.id);
    if (pact && pact.cpuId===m.id && a.highBidderId==='user' && !pact.cpuBetrayed) {
      if ($runtime.cpuKeepsPact(m,pact)) {
        a.activeIds = a.activeIds.filter(id=>id!==m.id);
        addAuctionLog(m.team, 'PATTO', 'status'); $runtime.saveState(); $runtime.renderManagers();
        // Il patto toglie la CPU dalla chiamata, ma non accelera la chiusura dell'asta.
        return;
      }
      pact.cpuBetrayed=true; $runtime.changeRelationship(m.id,-18,18,'tradimento_cpu');
      $runtime.showToast(`${m.profile?.label||m.team} ha tradito il patto su ${p.name}!`, true);
    }

    const limit = m.id==='user' ? autoUserLimit(m,p) : $runtime.cpuLimit(m,p);
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
    addAuctionLog(m.team, String(target), 'bid');
    if(autoSkipUserIfCannotBid()) return;
    $runtime.renderManagers();
    $runtime.saveState();
    // Fundamental V1.3 rule: every valid raise restarts the full countdown.
    beginBidRound();
  }

  function advanceAuction() {
    // Kept for compatibility with any saved/event path; the live auction is now clock-driven.
    if ($runtime.state?.auction) beginBidRound();
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
    addAuctionLog(me.team, String(target), 'bid');
    $runtime.saveState();
    // Every human raise also restarts the full five seconds.
    beginBidRound();
  }

  function fastForwardCpuAuctionAfterUserPass() {
    if(tryAdminOneShot()) return;
    const a = $runtime.state?.auction;
    if (!a) return;
    const p = $runtime.playerMap.get(a.playerId);
    if (!p) return;

    // The human has left this player permanently: from here on we resolve the
    // CPU-only auction synchronously using the same limits, jump sizes and
    // reaction-priority logic as the timed auction. This preserves the result
    // without forcing the player to watch every CPU-vs-CPU raise.
    const pendingSudden=currentSuddenInterestEffect();
    if(pendingSudden) activateSuddenInterest(pendingSudden,{silent:true});
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
    awardAuction();
  }

  function userPass() {
    const a = $runtime.state?.auction;
    if (!a || a.arcade?.awaitingAck || a.arcade?.type==='sealed' || $runtime.autocompleteMode || !a.activeIds.includes('user') || a.highBidderId==='user') return;
    a.awaitingUser = false;
    a.activeIds = a.activeIds.filter(id=>id!=='user');
    addAuctionLog($runtime.state.managers[0].team, 'PASS', 'pass');

    // Once the user passes, skip all remaining CPU-vs-CPU waiting for this player.
    // The internal auction is still fully simulated, then we jump straight to the
    // final AGGIUDICATO animation.
    fastForwardCpuAuctionAfterUserPass();
  }

  function userCannotBeatCurrentAuction(){
    const a=$runtime.state?.auction,player=a&&$runtime.playerMap.get(String(a.playerId));
    const user=$runtime.state?.managers?.find(manager=>manager.id==='user');
    return !!(a && player && user && !$runtime.autocompleteMode && !a.awarding &&
      a.highBidderId!=='user' && a.activeIds?.includes('user') && $runtime.maxLegalBid(user,player)<=a.price);
  }

  function autoSkipUserIfCannotBid(){
    if(!userCannotBeatCurrentAuction())return false;
    const a=$runtime.state.auction;
    a.awaitingUser=false;
    a.activeIds=a.activeIds.filter(id=>id!=='user');
    addAuctionLog($runtime.state.managers.find(manager=>manager.id==='user')?.team||'Tu','SKIP · CREDITO INSUFFICIENTE','pass');
    fastForwardCpuAuctionAfterUserPass();
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
          if(allRostersComplete()){$runtime.saveState();return finishAuction();}
          $runtime.state.nominationIndex=nextNominatorIndex($runtime.state.nominationIndex);
          $runtime.auditAndRepairState('post-award-open-role');
          $runtime.saveState();$runtime.renderAll();
          if($runtime.autocompleteMode||$runtime.state.managers[$runtime.state.nominationIndex].id!=='user') scheduleNomination();
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

        if ($runtime.state.currentRoleIndex >= $runtime.ROLE_ORDER.length || allRostersComplete()) {
          $runtime.saveState();
          return finishAuction();
        }

        $runtime.state.nominationIndex = nextNominatorIndex($runtime.state.nominationIndex);

        // Il giocatore ha riempito il proprio reparto ma alcune CPU no:
        // da questo momento non deve più assistere a chiamate che non può fare.
        // Attiviamo il motore veloce solo fino alla chiusura di questo reparto.
        if (!$runtime.roleRemainderAutoSim && $runtime.userCompletedCurrentRole(previousRole) && !$runtime.rolePhaseComplete(previousRole)) {
          $runtime.beginRoleRemainderAutoSim(previousRole);
        }

        $runtime.auditAndRepairState('post-award');
        $runtime.saveState();
        $runtime.renderAll();
        if ($runtime.autocompleteMode || $runtime.state.managers[$runtime.state.nominationIndex].id!=='user') scheduleNomination();
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
    $runtime.state.nominationCalls[key][managerId]=nominationCallCount(managerId,role)+1;
  }

  function nextNominatorIndex(from) {
    const role=$runtime.currentAuctionRole();
    const length=$runtime.state.managers.length;
    const candidates=[];
    for(let step=1;step<=length;step++){
      const idx=(Number(from||0)+step)%length;
      const manager=$runtime.state.managers[idx];
      if($runtime.openRoleAuction()?$runtime.managerCanNominate(manager):$runtime.roleSlotsRemaining(manager,role)>0)
        candidates.push({idx,count:nominationCallCount(manager.id,role)});
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
    $runtime.uiTimer = setTimeout(()=>cpuNominateCurrent(), manager ? $runtime.cpuNominationDelay(manager) : 650);
  }

  function cpuNominateCurrent() {
    if (!$runtime.state || $runtime.state.auction || $runtime.state.completed || $runtime.state.roleTransition) return;
    const idx = $runtime.state.nominationIndex;
    const m = $runtime.state.managers[idx];
    if (m.id==='user' && !$runtime.autocompleteMode) { $runtime.renderTurn(); return; }
    const player = chooseNomination(m);
    if (!player) {
      // Defensive fallback: any legal player.
      const role = $runtime.currentAuctionRole();
      const fallback = $runtime.state.availableIds.map(id=>$runtime.playerMap.get(id)).find(p=>p && ($runtime.openRoleAuction()||p.role===role) && $runtime.canOwn(m,p) && $runtime.maxLegalBid(m,p)>=1);
      if (!fallback) return finishAuction(true);
      nominate(fallback.id, idx);
      return;
    }
    nominate(player.id, idx);
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
      const weighted=freeRoleNominationWeights(manager,availableRoles);
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
    return Object.freeze({addAuctionLog,nominate,scheduleAdvance,adminOneShotScore,tryAdminOneShot,beginBidRound,currentSuddenInterestEffect,activateSuddenInterest,scheduleSuddenInterestEntry,scheduleCpuReactions,cpuReact,advanceAuction,autoUserLimit,userBid,fastForwardCpuAuctionAfterUserPass,userPass,userCannotBeatCurrentAuction,autoSkipUserIfCannotBid,awardAuction,nominationCallCount,registerNominationCall,nextNominatorIndex,allRostersComplete,scheduleNomination,cpuNominateCurrent,freeRoleNominationWeights,chooseNomination,finishAuction});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['auction-controller']=Object.freeze({create});
})();
