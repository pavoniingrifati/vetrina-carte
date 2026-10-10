/* Responsibility: auction-clock. Only external collaborators use live runtime accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: auction-clock');
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
    const windowMs = Math.max(1, Number(a.windowMs || auctionWindowMs()));
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
    $runtime.auctionClockEvents.publish('tick');
    renderCountdown();
    $runtime.countdownTimer = setInterval(() => {
      if (!$runtime.state?.auction) {
        clearInterval($runtime.countdownTimer);
        $runtime.countdownTimer = null;
        return;
      }
      $runtime.auctionClockEvents.publish('tick');
    renderCountdown();
      if (Date.now() >= Number($runtime.state.auction.deadlineAt||0)) {
        clearAuctionRuntimeTimers();
        $runtime.auctionClockEvents.publish('expired');
      }
    }, $runtime.autocompleteMode ? 25 : 50);
  }

  function resetBidClock({logReset=false}={}) {
    if (!$runtime.state?.auction) return;
    const a = $runtime.state.auction;
    a.windowMs = auctionWindowMs();
    a.deadlineAt = Date.now() + a.windowMs;
    if (logReset && !$runtime.autocompleteMode) {
      // No extra log line: the visual timer itself communicates the reset.
    }
    startCountdownTicker();
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
    return Object.freeze({auctionWindowMs,clearAuctionRuntimeTimers,renderCountdown,startCountdownTicker,resetBidClock,nextDelay,cpuNominationDelay,cpuReactionDelay});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['auction-clock']=Object.freeze({create});
})();
