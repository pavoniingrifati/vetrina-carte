/* Responsibility: auction-powers-controller. Only external collaborators use live runtime accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: auction-powers-controller');
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

  function auctionPowerUses(power){ return Number(ensureAuctionPowers().uses?.[power]||0); }

  function consumeAuctionPower(power){
    const powers=ensureAuctionPowers();
    powers.uses[power]=Math.min(auctionPowerMaxUses(power),auctionPowerUses(power)+1);
    if(power in powers) powers[power]=powers.uses[power]>0; // compatibilità salvataggi precedenti
  }

  function canUseOneShot(){
    const a=$runtime.state?.auction, user=$runtime.state?.managers?.find(m=>m.id==='user'), p=a&&$runtime.playerMap.get(a.playerId);
    return !!(a && user && p && $runtime.canOwn(user,p) && $runtime.maxLegalBid(user,p)>=1);
  }

  function renderAuctionPowers(){
    if(!$runtime.$('auctionPowers')) return;
    const powers=ensureAuctionPowers(), a=$runtime.state?.auction;
    const defs=[['block','powerBlockBtn','powerBlockCount'],['scout','powerScoutBtn','powerScoutCount'],['bluff','powerBluffBtn','powerBluffCount'],['observer','powerObserverBtn','powerObserverCount'],['oneShot','powerOneShotBtn','powerOneShotCount']];
    defs.forEach(([key,bid,cid])=>{
      const btn=$runtime.$(bid), count=$runtime.$(cid); if(!btn)return;
      const selected=powers.selected.includes(key);
      const passive=key==='observer';
      const maxUses=passive?0:auctionPowerMaxUses(key);
      const usedCount=passive?0:auctionPowerUses(key);
      const exhausted=!passive && usedCount>=maxUses;
      const alreadyActive=(key==='bluff' && !!a?.bluffActive) || (key==='scout' && !!a?.scoutUsedThisCall);
      const unavailableOneShot=key==='oneShot' && !canUseOneShot();
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
    const powers=ensureAuctionPowers(),a=$runtime.state?.auction;
    if(!powers.selected.includes(power)){$runtime.showToast('Questo Fantapotere non fa parte della tua selezione.',true);return;}
    if(!a || a.awarding || $runtime.autocompleteMode)return;
    if(power!=='observer' && auctionPowerUses(power)>=auctionPowerMaxUses(power)){$runtime.showToast('Hai esaurito gli utilizzi di questo Fantapotere.',true);return;}
    if(power==='oneShot') return useOneShotPower();
    if(power==='bluff') return useBluffPower();
    if(power==='scout') return useScoutPower();
    const targets=auctionPowerTargets();
    if(!targets.length){$runtime.showToast('Non ci sono CPU disponibili per questo potere.',true);return;}
    pauseForAuctionPower();
    const modal=$runtime.$('auctionPowerModal'), p=$runtime.playerMap.get(a.playerId);
    modal.dataset.power=power;
    $runtime.$('auctionPowerIcon').textContent='🔒';
    $runtime.$('auctionPowerTitle').textContent='BLOCCO — scegli l’avversario';
    $runtime.$('auctionPowerDescription').textContent=`Scegli una CPU: non potrà più rilanciare su ${a.arcade?.type==='mystery'?'il Pacco sorpresa':p.name}. Se è in testa, il suo rilancio resta valido ma non potrà contro-rilanciare dopo essere stata superata.`;
    $runtime.$('auctionPowerBody').innerHTML=`<div class="auction-power-targets">${targets.map(m=>{const art=$runtime.RIVAL_ART[$runtime.profileArchetype(m)];return `<button class="auction-power-target" data-power-target="${m.id}">${art?`<img src="assets/rivals/${art}.webp" alt="">`:'<span></span>'}<span><b>${$runtime.escapeHtml(m.profile?.label||m.team)}</b><small>${$runtime.escapeHtml(m.team)} · ${m.budget} cr</small></span><strong>${m.id===a.highBidderId?'IN TESTA':'IN ASTA'}</strong></button>`}).join('')}</div>`;
    modal.querySelectorAll('[data-power-target]').forEach(b=>b.onclick=()=>resolveAuctionPowerTarget(power,b.dataset.powerTarget));
    modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');
  }

  function useScoutPower(){
    const a=$runtime.state?.auction,powers=ensureAuctionPowers(); if(!a||auctionPowerUses('scout')>=5||a.scoutUsedThisCall)return;
    const p=$runtime.playerMap.get(a.playerId); if(!p)return;
    const cpus=($runtime.state.managers||[]).filter(m=>m.id!=='user');
    if(!cpus.length){$runtime.showToast('Non ci sono avversari da analizzare.',true);return;}

    pauseForAuctionPower();
    consumeAuctionPower('scout');
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
    renderAuctionPowers();
    const old=$runtime.$('auctionPowerCancel');
    old.textContent='Continua l’asta';
    old.onclick=()=>closeAuctionPowerModal(true);
    modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');
  }

  function closeAuctionPowerModal(resume=true){
    const modal=$runtime.$('auctionPowerModal'); if(modal){modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');modal.dataset.power='';}
    if(resume && $runtime.state?.auction?.powerPaused) resumeAfterAuctionPower();
  }

  function resolveAuctionPowerTarget(power,cpuId){
    const a=$runtime.state?.auction,m=$runtime.state?.managers?.find(x=>x.id===cpuId),p=a&&$runtime.playerMap.get(a.playerId); if(!a||!m||!p)return;
    const powers=ensureAuctionPowers();
    if(power==='block'){
      if(auctionPowerUses('block')>=5){$runtime.showToast('Hai esaurito i 5 BLOCCO disponibili.',true);return closeAuctionPowerModal(true);}
      consumeAuctionPower('block'); a.blockedCpuIds=Array.isArray(a.blockedCpuIds)?a.blockedCpuIds:[]; if(!a.blockedCpuIds.includes(cpuId))a.blockedCpuIds.push(cpuId);
      if(a.highBidderId!==cpuId) a.activeIds=a.activeIds.filter(id=>id!==cpuId);
      $runtime.addAuctionLog('POTERE', `BLOCCO su ${m.profile?.label||m.team}`, 'status');
      $runtime.showToast(`${m.profile?.label||m.team} è stato bloccato su ${a.arcade?.type==='mystery'?'il Pacco sorpresa':p.name}.`);
      closeAuctionPowerModal(false); $runtime.saveState(); $runtime.renderAuction();
      if(!a.activeIds.filter(id=>id!==a.highBidderId).length){$runtime.clearAuctionRuntimeTimers();return $runtime.awardAuction();}
      return resumeAfterAuctionPower();
    }
  }

  function useBluffPower(){
    const a=$runtime.state?.auction; if(!a||auctionPowerUses('bluff')>=5||a.bluffActive)return;
    consumeAuctionPower('bluff');
    a.bluffActive=true;
    $runtime.addAuctionLog('POTERE','BLUFF ATTIVO','bid');
    $runtime.showToast(`BLUFF attivo: le CPU rivaluteranno al rialzo questo giocatore. Te ne restano ${5-auctionPowerUses('bluff')}.`);
    $runtime.saveState(); $runtime.renderAuction(); $runtime.beginBidRound();
  }

  function useOneShotPower(){
    const a=$runtime.state?.auction, powers=ensureAuctionPowers();
    if(!a || !powers.selected.includes('oneShot') || auctionPowerUses('oneShot')>=1 || a.awarding || $runtime.autocompleteMode)return;
    const p=$runtime.playerMap.get(a.playerId), user=$runtime.state.managers.find(m=>m.id==='user');
    if(!p || !user || !$runtime.canOwn(user,p) || $runtime.maxLegalBid(user,p)<1){
      $runtime.showToast('ONE SHOT non è utilizzabile su questo giocatore: non hai uno slot rosa valido o credito legale sufficiente.',true);
      return;
    }
    $runtime.clearAuctionRuntimeTimers();
    consumeAuctionPower('oneShot');
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
    return Object.freeze({ensureManagerTeamIdentityState,ensureAuctionPowers,auctionPowerMaxUses,auctionPowerUses,consumeAuctionPower,canUseOneShot,renderAuctionPowers,auctionPowerTargets,pauseForAuctionPower,resumeAfterAuctionPower,openAuctionPower,useScoutPower,closeAuctionPowerModal,resolveAuctionPowerTarget,useBluffPower,useOneShotPower});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['auction-powers-controller']=Object.freeze({create});
})();
