/* Responsibility: persistence-controller. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: persistence-controller');
  function freshState(teamName, managerName) {
    $runtime.activateCatalogBase({catalogMode:'base'});
    const marketSeed=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
    return {
      version: 24,
      marketSeed,
      currentRoleIndex: 0,
      startedAt: Date.now(),
      teamName,
      managerName,
      coachAvatar:{...$runtime.COACH_AVATAR_DEFAULT},
      tradeWindows:{},tradeBudgetAdjustments:{},
      managers: $runtime.freshManagers(teamName, managerName, $runtime.GAME_CONFIG.startingDivision),
      availableIds: $runtime.baseSerieAPlayers.map(p => p.id),
      nominationIndex: 0,
      nominationCalls:{},
      auction: null,
      roleTransition: null,
      log: [],
      turbo: false,
      completed: false,
      stats: { purchases:0, totalSpent:0, highest:null },
      auctionEvents: { count:0, lastPurchaseAt:-99, history:[], activeEffects:[], pending:null, relationships:{} },
      auctionPowers: { block:false, scout:false, bluff:false, observer:false, oneShot:false, uses:{block:0,scout:0,bluff:0,oneShot:0}, selected:[] },
      leagueRules: $runtime.defaultLeagueRules(),
      transferMarket: $runtime.TransferEngine.createMarketState(marketSeed),
      sponsorOfferIds: $runtime.shuffledCopy(Object.keys($runtime.SEASON_SPONSORS)).slice(0,3),
      career: { euros:$runtime.CAREER_STARTING_EUROS, startingEuros:$runtime.CAREER_STARTING_EUROS, totalEarned:0, totalSpent:0, fantapoints:0, totalFantapointsEarned:0, totalFantapointsSpent:0, fantapointsHistory:[], seasonNumber:1, division:$runtime.GAME_CONFIG.startingDivision, divisionScaleVersion:2, prizeHistory:[], nextAuctionBonusCredits:0 },
      integrity: { checks:0, repairs:0, warnings:0, lastCheck:null, recent:[] }
    };
  }

  function showPersistenceError(e){
    console.warn('Salvataggio non disponibile',e);
    const now=Date.now();
    if(now-$runtime.saveErrorToastAt<5000) return;
    $runtime.saveErrorToastAt=now;
    const name=String(e?.name||'');
    if(name==='QuotaExceededError' || name==='NS_ERROR_DOM_QUOTA_REACHED'){
      $runtime.showToast('Spazio dati del browser esaurito. Il nuovo salvataggio usa IndexedDB: libera spazio sul dispositivo e riprova.',true);
    }else if(name==='SecurityError'){
      $runtime.showToast('Il browser sta bloccando i dati locali del gioco. Aprilo in una finestra normale e consenti i dati del sito.',true);
    }else{
      $runtime.showToast(`Salvataggio non riuscito${name?` (${name})`:''}.`,true);
    }
  }

  function saveState() {
    if (!$runtime.state) return false;
    $runtime.auditAndRepairState('pre-save');
    if ($runtime.serieALive && !$runtime.serieALive.finalizing && $runtime.state.season &&
        ['multilive','bigmatch'].includes($runtime.serieALive.phase)) {
      $runtime.state.season.activeLive = $runtime.snapshotSerieALive($runtime.serieALive);
    }
    try {
      const json=JSON.stringify($runtime.buildStorageSnapshot($runtime.state));
      $runtime.saveManager.queue($runtime.saveManager.makeRecord(json,$runtime.state.version));
      console.info(`Save IndexedDB in coda: ${Math.round(json.length/1024)} KB`);
      return true;
    } catch (e) {
      $runtime.showPersistenceError(e);
      return false;
    }
  }

  function showToast(message, isError=false) {
    let toast = $runtime.$('gameToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'gameToast';
      toast.setAttribute('role','status');
      toast.setAttribute('aria-live','polite');
      document.body.appendChild(toast);
    }
    clearTimeout($runtime.toastTimer);
    toast.setAttribute('role',isError?'alert':'status');
    toast.setAttribute('aria-live',isError?'assertive':'polite');
    toast.textContent = message;
    toast.className = `game-toast show${isError?' error':''}`;
    $runtime.toastTimer = setTimeout(()=>toast.classList.remove('show'), isError?6000:3200);
  }

  async function saveWithFeedback(buttonId) {
    const button = typeof buttonId==='string' ? $runtime.$(buttonId) : buttonId;
    if (!$runtime.state) { $runtime.showToast('Avvia una partita prima di salvare.'); return; }
    if (!$runtime.saveState()) return;
    const ok=await $runtime.saveManager.flush();
    if(!ok) return;
    if (button) {
      const label = button.textContent;
      button.textContent = 'Salvato ✓';
      setTimeout(()=>{ button.textContent=label; },800);
    }
  }

  function stopGameRuntime() {
    $runtime.clearAuctionRuntimeTimers();
    $runtime.hideRoleTransitionModal();
    $runtime.roleRemainderAutoSim=false;
    $runtime.autocompleteMode=false;
    $runtime.hideRoleRemainderAutoSim();
    $runtime.stopHubNewsCarousel();
    if ($runtime.serieALive?.timer) clearInterval($runtime.serieALive.timer);
    $runtime.hideSerieATvBanner();
    $runtime.serieALive = null;
    $runtime.hideAwardAnimation();
    $runtime.closeAuctionEventModal();
    $runtime.$('arcadeAuctionModal')?.classList.add('hidden');
    $runtime.hideFormationChoiceModal();
    $runtime.hideAdminRuleModal();
    $runtime.lineupDraft=null;
    $runtime.lineupReadOnly=false;
    $runtime.lineupPartialContext=null;
    $runtime.lineupAssistantAdjustments=[];
  }

  function migrateRarityHunterPurchase(source){
    const purchases=source?.season?.shopPurchases;
    const old=purchases?.rarity_hunter;
    if(!old) return false;
    if(!purchases.special_events){
      purchases.special_events={...old,id:'special_events',migratedFrom:'rarity_hunter'};
      if(source.season.sponsor?.freeSubscriptionId==='rarity_hunter') source.season.sponsor.freeSubscriptionId='special_events';
    }else if(source.career){
      // Se erano stati acquistati entrambi, il doppione rimosso viene rimborsato una sola volta.
      const amount=Math.max(0,Number(old.cost||0));
      if(old.currency==='fp'){
        source.career.fantapoints=Number(source.career.fantapoints||0)+amount;
        source.career.totalFantapointsSpent=Math.max(0,Number(source.career.totalFantapointsSpent||0)-amount);
      }else if(old.currency==='eur'){
        source.career.euros=Number(source.career.euros||0)+amount;
        source.career.totalSpent=Math.max(0,Number(source.career.totalSpent||0)-amount);
      }
    }
    delete purchases.rarity_hunter;
    return true;
  }

  function migrateCareerDivisionScale(parsed){
    // Vecchi salvataggi: Amatori=3, C=2, B=1. Aggiungi la A senza cambiare
    // la categoria raggiunta né ripetere la migrazione ai caricamenti futuri.
    if(!parsed?.career || parsed.career.divisionScaleVersion===2) return;
    parsed.career.division=Math.min(4,Math.max(1,Number(parsed.career.division||3)+1));
    for(const item of parsed.career.seasonHistory||[]){
      if(Number.isFinite(Number(item.division))) item.division=Number(item.division)+1;
      if(Number.isFinite(Number(item.nextDivision))) item.nextDivision=Number(item.nextDivision)+1;
    }
    for(const item of parsed.career.prizeHistory||[]){
      if(Number.isFinite(Number(item.division))) item.division=Number(item.division)+1;
    }
    if(parsed.nextSeasonMeta){
      for(const key of ['fromDivision','toDivision']){
        if(Number.isFinite(Number(parsed.nextSeasonMeta[key]))) parsed.nextSeasonMeta[key]=Number(parsed.nextSeasonMeta[key])+1;
      }
    }
    if(parsed.nextSeasonFlow){
      for(const key of ['currentDivision','nextDivision']){
        if(Number.isFinite(Number(parsed.nextSeasonFlow[key]))) parsed.nextSeasonFlow[key]=Number(parsed.nextSeasonFlow[key])+1;
      }
      if(parsed.nextSeasonFlow.champion && Number(parsed.nextSeasonFlow.currentDivision)===2){
        parsed.nextSeasonFlow.champion=false;
        parsed.nextSeasonFlow.promoted=true;
        parsed.nextSeasonFlow.nextDivision=1;
      }
    }
    parsed.career.divisionScaleVersion=2;
  }

  function normalizeSavedState(parsed){
    if (!parsed || ![8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24].includes(parsed.version) || !Array.isArray(parsed.managers)) return null;
    parsed=$runtime.compactLongCareerState(parsed);
    if (parsed.version === 8) { parsed.version=9; parsed.auctionEvents={count:0,lastPurchaseAt:-99,history:[],activeEffects:[],pending:null,relationships:{}}; }
    if (parsed.version === 9) { parsed.version=10; parsed.auctionPowers={block:false,scout:false,bluff:false}; }
    if (parsed.version === 10) parsed.version=11;
    if (parsed.version === 11) parsed.version=12;
    if (parsed.version === 12) parsed.version=13;
    if (parsed.version === 13) parsed.version=14;
    if (parsed.version === 14) {
      // V3.2.13: Assistente Tecnico scende da 15 € a 10 €. Se era già stato acquistato, rimborsa la differenza una sola volta.
      const oldAssistant=parsed.season?.shopPurchases?.assistant_coach;
      if(oldAssistant && Number(oldAssistant.cost||0)>10){
        const refund=Math.max(0,Number(oldAssistant.cost||0)-10);
        parsed.career ||= {euros:$runtime.CAREER_STARTING_EUROS,startingEuros:$runtime.CAREER_STARTING_EUROS,totalEarned:0,totalSpent:0,seasonNumber:1,prizeHistory:[]};
        parsed.career.euros=Number(parsed.career.euros||0)+refund;
        parsed.career.totalSpent=Math.max(0,Number(parsed.career.totalSpent||0)-refund);
        oldAssistant.cost=10;
        oldAssistant.priceAdjustmentRefund=refund;
      }
      parsed.version=15;
    }
    if (parsed.version === 15) {
      // V3.2.14: la formazione persistente include anche l'ordine della panchina.
      if(parsed.season?.assistantCoachLineup && !Array.isArray(parsed.season.assistantCoachLineup.bench)) parsed.season.assistantCoachLineup.bench=[];
      parsed.version=16;
    }
    if (parsed.version === 16) parsed.version=17;
    if (parsed.version === 17) parsed.version=18;
    if (parsed.version === 18) parsed.version=19;
    if (parsed.version === 19) parsed.version=20;
    if (parsed.version === 20) parsed.version=21;
    if (parsed.version === 21) parsed.version=22;
    if (parsed.version === 22) parsed.version=23;
    if (parsed.version === 23) {
      // V3.2.35.56.29: regolamento stagionale sorteggiato pre-asta.
      parsed.leagueRules=$runtime.defaultLeagueRules();
      parsed.version=24;
    }
    if(!parsed.leagueRules || typeof parsed.leagueRules!=='object') parsed.leagueRules=$runtime.defaultLeagueRules();
    if(!parsed.transferMarket || typeof parsed.transferMarket!=='object') parsed.transferMarket=$runtime.TransferEngine.createMarketState(parsed.marketSeed||'career');
    parsed.auctionPowers ||= {block:false,scout:false,bluff:false,observer:false,oneShot:false,uses:{block:0,scout:0,bluff:0,oneShot:0},selected:[]};
    if(parsed.auctionPowers.observer===undefined) parsed.auctionPowers.observer=false;
    if(parsed.auctionPowers.oneShot===undefined) parsed.auctionPowers.oneShot=false;
    if(!parsed.auctionPowers.uses || typeof parsed.auctionPowers.uses!=='object'){
      parsed.auctionPowers.uses={
        block:parsed.auctionPowers.block?1:0,
        scout:parsed.auctionPowers.scout?1:0,
        bluff:parsed.auctionPowers.bluff?1:0,
        oneShot:parsed.auctionPowers.oneShot?1:0
      };
    }
    ['block','scout','bluff','oneShot'].forEach(k=>{
      const max=k==='oneShot'?1:5;
      parsed.auctionPowers.uses[k]=Math.max(0,Math.min(max,Number(parsed.auctionPowers.uses[k]||0)));
    });
    parsed.career=$runtime.CareerEngine.normalizeCareer(parsed.career,$runtime.CAREER_STARTING_EUROS,$runtime.GAME_CONFIG.startingDivision);
    $runtime.migrateCareerDivisionScale(parsed);
    $runtime.migrateRarityHunterPurchase(parsed);
    if(!Array.isArray(parsed.sponsorOfferIds) || parsed.sponsorOfferIds.length<3){
      parsed.sponsorOfferIds = $runtime.shuffledCopy(Object.keys($runtime.SEASON_SPONSORS)).slice(0,3);
    } else {
      parsed.sponsorOfferIds = parsed.sponsorOfferIds.map(id=>String(id)).filter((id,index,list)=>$runtime.SEASON_SPONSORS[id] && list.indexOf(id)===index).slice(0,3);
      if(parsed.sponsorOfferIds.length<3){
        $runtime.shuffledCopy(Object.keys($runtime.SEASON_SPONSORS)).forEach(id=>{
          if(parsed.sponsorOfferIds.length<3 && !parsed.sponsorOfferIds.includes(id)) parsed.sponsorOfferIds.push(id);
        });
      }
    }
    if(parsed.season?.started && (!parsed.season.dashboardReadyDays || typeof parsed.season.dashboardReadyDays!=='object')) parsed.season.dashboardReadyDays={};
    if(parsed.season?.started && (!parsed.season.matchdayFlow || typeof parsed.season.matchdayFlow!=='object')) parsed.season.matchdayFlow={};
    if(parsed.season?.started && (!parsed.season.consumables || typeof parsed.season.consumables!=='object')) parsed.season.consumables={inventory:{},effects:{},usageHistory:[],purchaseHistory:[]};
    if(parsed.season?.started){
      parsed.season.consumables.inventory ||= {};
      parsed.season.consumables.effects ||= {};
      if(!Array.isArray(parsed.season.consumables.usageHistory)) parsed.season.consumables.usageHistory=[];
      if(!Array.isArray(parsed.season.consumables.purchaseHistory)) parsed.season.consumables.purchaseHistory=[];
    }
    if(parsed.season?.started && !Array.isArray(parsed.season.newsFeed)) parsed.season.newsFeed=[];
    if(parsed.season?.started && (!parsed.season.newsGeneratedDays || typeof parsed.season.newsGeneratedDays!=='object')) parsed.season.newsGeneratedDays={};
    if(parsed.season?.started && (!parsed.season.newsMeta || typeof parsed.season.newsMeta!=='object')) parsed.season.newsMeta={};
    if(parsed.season?.started && (!parsed.season.assistantCoachLineup || typeof parsed.season.assistantCoachLineup!=='object')) parsed.season.assistantCoachLineup={enabled:false,formation:null,starters:{},bench:[],updatedAt:0,lastSourceDay:0};
    // Recover a persisted live phase only when there is no match to resume
    // and no result or partially played fantasy round to preserve.
    const savedSeason=parsed.season;
    const savedDay=Number(savedSeason?.currentMatchday||0);
    const savedKey=String(savedDay);
    const savedFlow=savedSeason?.matchdayFlow?.[savedKey];
    const savedRound=savedSeason?.schedule?.[savedDay-1];
    if(savedFlow?.phase==='live' && savedRound?.matches?.length &&
       savedRound.matches.every(match=>!match.played) &&
       !savedSeason.matchdayResults?.[savedKey] &&
       !savedSeason.activeLive && !savedSeason.pendingBigMatch){
      savedFlow.phase='match_ready';
      savedFlow.updatedAt=Date.now();
      savedFlow.recoveredInterruptedLive=true;
      savedSeason.dashboardReadyDays[savedKey]=true;
    }
    return parsed;
  }

  function parseStoredPayload(payload){
    if(!payload) return null;
    try{ return $runtime.normalizeSavedState(JSON.parse($runtime.decodeSavePayload(payload))); }
    catch(e){ console.warn('Salvataggio non leggibile',e); return null; }
  }

  async function loadSaved() {
    const result=await $runtime.saveManager.load({
      parsePayload:$runtime.parseStoredPayload,
      serializeState:savedState=>JSON.stringify($runtime.buildStorageSnapshot(savedState))
    });
    if(result.source==='backup') $runtime.showToast('Recuperato automaticamente il backup precedente del salvataggio.');
    if(result.source==='legacy'&&result.migrated){
      console.info('Salvataggio precedente migrato automaticamente da localStorage a IndexedDB.');
      $runtime.showToast('Salvataggio aggiornato al nuovo sistema IndexedDB ✓');
    }
    return result.state;
  }

  async function clearSaved() {
    await $runtime.saveManager.clear();
  }

  async function initializeSaveSystem(){
    const info=await $runtime.saveManager.initialize();
    if(info.backend==='legacy' && location.protocol==='file:'){
      setTimeout(()=>$runtime.showToast('Per usare il nuovo salvataggio IndexedDB in locale, avvia il gioco con AVVIA_GIOCO.bat invece di aprire index.html direttamente.',true),700);
    }
    if(info.persistent!==null) console.info(`Storage persistente browser: ${info.persistent?'concesso':'non concesso'}`);
  }
    return Object.freeze({freshState,showPersistenceError,saveState,showToast,saveWithFeedback,stopGameRuntime,migrateRarityHunterPurchase,migrateCareerDivisionScale,normalizeSavedState,parseStoredPayload,loadSaved,clearSaved,initializeSaveSystem});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['persistence-controller']=Object.freeze({create});
})();
