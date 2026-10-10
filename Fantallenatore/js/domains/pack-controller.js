/* Responsibility: pack-controller. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: pack-controller');
  function applyPreAuctionPack(draft){
    if(!draft || draft.preAuctionPack || !$runtime.leagueRulesFor(draft).packOpening || Number(draft.career?.division||4)>3) return false;
    const occupied=new Set(draft.managers.flatMap(m=>m.roster.map(p=>String(p.id))));
    const available=new Set(draft.availableIds.map(String));
    const seed=String(draft.marketSeed||draft.startedAt||'pack');
    const allocations=[];
    for(const role of ['P','D','C','A']){
      const pool=(window.FANTA_PLAYERS||[]).filter(p=>p.role===role && available.has(String(p.id)) && !occupied.has(String(p.id)))
        .sort((a,b)=>$runtime.randomHash(`${seed}|pack|${a.id}`)-$runtime.randomHash(`${seed}|pack|${b.id}`));
      if(pool.length<draft.managers.length) throw new Error('Listone insufficiente per Spacchettamento');
      draft.managers.forEach((manager,index)=>{
        if(manager.budget<4 || manager.roster.filter(p=>p.role===role).length>=$runtime.ROLE_LIMITS[role]) throw new Error('Rosa o budget incompatibili con Spacchettamento');
        allocations.push({manager,player:pool[index]});
      });
    }
    const assignments={};
    allocations.forEach(({manager,player})=>{
      manager.roster.push({...player,price:1});manager.budget-=1;
      occupied.add(String(player.id));
      (assignments[manager.id]||=[]).push(String(player.id));
      draft.stats.purchases++;draft.stats.totalSpent++;
    });
    draft.availableIds=draft.availableIds.filter(id=>!occupied.has(String(id)));
    draft.preAuctionPack={assignments,presented:false};
    draft.log.unshift('SPACCHETTAMENTO · 4 giocatori a 1 credito per ogni allenatore');
    return true;
  }

  function showPreAuctionPack(){
    const pack=$runtime.state?.preAuctionPack;
    if(!pack || pack.presented) return false;
    document.getElementById('preAuctionPackModal')?.remove();
    const modal=document.createElement('div');modal.id='preAuctionPackModal';modal.className='pack-opening-modal';
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Spacchettamento');
    const players=(pack.assignments.user||[]).map(id=>$runtime.playerMap.get(id)).filter(Boolean);
    modal.innerHTML=`<section class="pack-opening-dialog"><h2>SPACCHETTAMENTO</h2><p>Il tuo pacchetto · 1 P, 1 D, 1 C, 1 A · 4 crediti totali</p><div class="pixel-pack"><span class="pixel-pack-edition">FANTALLENATORE PACK</span><img class="pixel-pack-brand" src="assets/pack-fantallenatore-logo.webp" alt="Fantallenatore Approved"><span class="pixel-pack-roles"><i>P</i><i>D</i><i>C</i><i>A</i></span><strong>4 GIOCATORI · 1 CREDITO</strong></div><div class="pack-opening-cards"></div><div class="pack-opening-actions"><button class="secondary" data-pack-skip> SALTA ANIMAZIONE </button><button class="primary big" data-pack-next>APRI PACCHETTO</button></div></section>`;
    document.body.appendChild(modal);
    const grid=modal.querySelector('.pack-opening-cards'),next=modal.querySelector('[data-pack-next]');
    let revealed=0,opened=false;
    const reveal=()=>{
      if(!opened) modal.classList.add('is-pack-burst');
      opened=true;modal.querySelector('.pixel-pack').classList.add('is-open');
      if(revealed<players.length){
        const p=players[revealed++],analysis=$runtime.auctionPlayerAnalysis(p);
        const card=document.createElement('article');card.className=`pack-player-card ${$runtime.currentPlayerOvr(p)>=85?'is-top':''}`;
        card.innerHTML=`<span>${$runtime.escapeHtml(p.role)} · OVR ${$runtime.currentPlayerOvr(p)}</span><div class="pack-player-face">${$runtime.playerAvatarMarkup(p,p.name)}</div><strong>${$runtime.escapeHtml(p.name)}</strong><small>${$runtime.escapeHtml($runtime.clubShort(p.club))}</small><b>1 CREDITO</b>${$runtime.auctionObserverActive()?`<small>Pot. ${$runtime.escapeHtml(analysis.label)} · Tit. ${analysis.starterPct}%</small>`:''}`;
        grid.appendChild(card);card.scrollIntoView?.({block:'nearest',behavior:'smooth'});
      }
      next.textContent=revealed===players.length?'CONTINUA ALL’ASTA':`SCOPRI GIOCATORE ${revealed+1}/4`;
    };
    next.onclick=()=>{
      if(opened && revealed===players.length){pack.presented=true;$runtime.saveState();modal.remove();$runtime.renderAll();if($runtime.state.managers[$runtime.state.nominationIndex]?.id!=='user')$runtime.scheduleNomination();return;}
      reveal();
    };
    modal.querySelector('[data-pack-skip]').onclick=()=>{while(revealed<players.length)reveal();next.focus();};
    modal.onkeydown=e=>{if(e.key==='Tab'){const skip=modal.querySelector('[data-pack-skip]');if(e.shiftKey&&document.activeElement===skip){e.preventDefault();next.focus();}else if(!e.shiftKey&&document.activeElement===next){e.preventDefault();skip.focus();}}};
    next.focus();return true;
  }
    return Object.freeze({applyPreAuctionPack,showPreAuctionPack});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['pack-controller']=Object.freeze({create});
})();
