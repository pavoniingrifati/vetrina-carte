/* Responsibility: auction-arcade-controller. Only external collaborators use live runtime accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: auction-arcade-controller');
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
          resolveSealedAuction();
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
      resolveSealedAuction();$runtime.renderAuction();return showArcadeModal();
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
    return Object.freeze({prepareArcadeAuction,renderArcadeBanner,showArcadeModal,resolveSealedAuction,handleArcadeAction});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['auction-arcade-controller']=Object.freeze({create});
})();
