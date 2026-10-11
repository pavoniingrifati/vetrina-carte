/* Responsibility: auction-feedback. Only external collaborators use live runtime accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: auction-feedback');
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
    const moment = bidCommentMoment(manager, increment, previousLeaderId);
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
    $runtime.$('bidSpotlightReaction').textContent = bidReaction(manager, player);
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
    const data=awardLossReactionData($runtime.state?.auction,player,$runtime.state.managers.find(m=>m.id==='user'),price);
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
    return Object.freeze({flashBidder,bidReaction,bidCommentMoment,showBidSpotlight,showAwardAnimation,hideAwardAnimation,awardLossReactionData,showAwardLossReaction});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['auction-feedback']=Object.freeze({create});
})();
