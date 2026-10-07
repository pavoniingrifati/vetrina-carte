/* Responsibility: ready-rosters-controller. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: ready-rosters-controller');
  function quickReadyYield(ms=0){
    return new Promise(resolve=>{
      requestAnimationFrame(()=>window.setTimeout(resolve,ms));
    });
  }

  function setQuickReadyLoading(active,{title,text,step,progress}={}){
    const overlay=$runtime.$('quickReadyLoading');
    if(!overlay) return;
    overlay.classList.toggle('show',!!active);
    overlay.setAttribute('aria-hidden',active?'false':'true');
    document.body.classList.toggle('quick-ready-busy',!!active);

    const btn=$runtime.$('quickReadyBtn');
    if(btn) btn.disabled=!!active;

    if(title!==undefined && $runtime.$('quickReadyLoadingTitle')) $runtime.$('quickReadyLoadingTitle').textContent=title;
    if(text!==undefined && $runtime.$('quickReadyLoadingText')) $runtime.$('quickReadyLoadingText').textContent=text;
    if(step!==undefined && $runtime.$('quickReadyProgressStep')) $runtime.$('quickReadyProgressStep').textContent=step;

    if(progress!==undefined){
      const pct=Math.max(0,Math.min(100,Math.round(Number(progress)||0)));
      if($runtime.$('quickReadyProgressBar')) $runtime.$('quickReadyProgressBar').style.width=`${pct}%`;
      if($runtime.$('quickReadyProgressPct')) $runtime.$('quickReadyProgressPct').textContent=`${pct}%`;
    }
  }

  function updateQuickReadyProgress(role,extra=''){
    if(!$runtime.state) return;
    const total=$runtime.TOTAL_SLOTS*$runtime.state.managers.length;
    const done=Math.max(0,Math.min(total,Number($runtime.state.stats?.purchases||0)));
    const pct=8+(done/total)*87;
    const roleName=$runtime.QUICK_ROLE_NAMES[role]||'Rose';
    $runtime.setQuickReadyLoading(true,{
      title:`Generazione ${roleName.toLowerCase()}...`,
      text:`${done} / ${total} giocatori assegnati${extra?` · ${extra}`:''}`,
      step:roleName,
      progress:pct
    });
  }

  function quickAwardGeneratedPlayer(player, nominator) {
    if (!player || !nominator) return false;
    const legalBidders = $runtime.state.managers.map(m => {
      if (!$runtime.canOwn(m,player) || $runtime.maxLegalBid(m,player)<1) return null;
      let ceiling = m.id==='user' ? $runtime.autoUserLimit(m,player) : $runtime.cpuLimit(m,player);
      // The manager who called the player must always be willing to open at 1.
      if (m.id===nominator.id && ceiling<1) ceiling=1;
      if (ceiling<1) return null;
      const mood = .90 + Math.random()*.18;
      const effective = Math.max(1,Math.min($runtime.maxLegalBid(m,player),Math.round(ceiling*mood)));
      return {m,ceiling,effective};
    }).filter(Boolean).sort((a,b)=>b.effective-a.effective || Math.random()-.5);

    if (!legalBidders.length) return false;
    const winnerEntry = legalBidders[0];
    const runnerUp = legalBidders[1];
    const winner = winnerEntry.m;
    let price = 1;
    if (runnerUp) {
      const steps=[1,1,1,2,2,3,5];
      const inc=steps[Math.floor(Math.random()*steps.length)];
      price=Math.min(winnerEntry.effective,runnerUp.effective+inc);
    }
    price=Math.max(1,Math.min(price,$runtime.maxLegalBid(winner,player)));

    winner.budget-=price;
    winner.roster.push({
      id:player.id,name:player.name,role:player.role,club:player.club,
      ovr:player.ovr,quotation:player.quotation,fvm:player.fvm,price
    });
    $runtime.recordUserAuctionPick(player,winner.id);
    $runtime.state.availableIds=$runtime.state.availableIds.filter(id=>id!==player.id);
    $runtime.state.stats.purchases++;
    $runtime.state.stats.totalSpent+=price;
    if (!$runtime.state.stats.highest || price>$runtime.state.stats.highest.price) {
      $runtime.state.stats.highest={playerId:player.id,playerName:player.name,managerId:winner.id,team:winner.team,price};
    }
    return true;
  }

  async function generateReadyRosters(fromCareer=false) {

    $runtime.setQuickReadyLoading(true,{
      title:'Preparazione rose...',
      text:'Inizializzo i 10 fantallenatori e il mercato.',
      step:'Avvio',
      progress:3
    });

    // Fondamentale: lascia al browser il tempo di disegnare davvero l'overlay
    // prima di iniziare il calcolo pesante.
    await $runtime.quickReadyYield(40);

    try {
      $runtime.prepareNewGame(fromCareer);
      $runtime.state.quickStart=true;
      $runtime.state.turbo=true;
      $runtime.selectedPlayerId=null;
      $runtime.autocompleteMode=false;

      $runtime.setQuickReadyLoading(true,{
        title:'Analisi strategie CPU...',
        text:'Calcolo budget, priorità e obiettivi delle 10 squadre.',
        step:'Strategie',
        progress:7
      });
      await $runtime.quickReadyYield(20);

      let globalGuard=0;
      const MAX_GENERATED=$runtime.TOTAL_SLOTS*$runtime.state.managers.length+20;

      if($runtime.openRoleAuction()){
        $runtime.setQuickReadyLoading(true,{title:'Generazione rosa a ruoli liberi...',text:'Assegno giocatori di tutti i ruoli.',step:'Asta libera',progress:8});
        while(!$runtime.allRostersComplete() && globalGuard++<$runtime.TOTAL_SLOTS*$runtime.state.managers.length*5){
          const nominator=$runtime.state.managers[$runtime.state.nominationIndex];
          const player=$runtime.chooseNomination(nominator)||$runtime.state.availableIds.map(id=>$runtime.playerMap.get(id)).find(item=>item&&$runtime.canOwn(nominator,item)&&$runtime.maxLegalBid(nominator,item)>=1);
          if(!player || !$runtime.quickAwardGeneratedPlayer(player,nominator)) break;
          $runtime.registerNominationCall(nominator.id,player.role);
          $runtime.state.nominationIndex=$runtime.nextNominatorIndex($runtime.state.nominationIndex);
          if(globalGuard%4===0){
            const done=$runtime.state.managers.reduce((sum,manager)=>sum+manager.roster.length,0);
            $runtime.setQuickReadyLoading(true,{text:`${done} / ${$runtime.TOTAL_SLOTS*$runtime.state.managers.length} giocatori assegnati`,step:'Asta libera',progress:8+done/($runtime.TOTAL_SLOTS*$runtime.state.managers.length)*87});
            await $runtime.quickReadyYield(0);
          }
        }
      }else for (let roleIndex=0; roleIndex<$runtime.ROLE_ORDER.length; roleIndex++) {
        $runtime.state.currentRoleIndex=roleIndex;
        const role=$runtime.ROLE_ORDER[roleIndex];
        let roleGuard=0;
        let chunkCounter=0;

        $runtime.updateQuickReadyProgress(role,'avvio reparto');
        await $runtime.quickReadyYield(12);

        while (!$runtime.rolePhaseComplete(role) && roleGuard++<$runtime.ROLE_LIMITS[role]*$runtime.state.managers.length*4) {
          globalGuard++;
          if (globalGuard>MAX_GENERATED) break;

          let idx=$runtime.state.nominationIndex;
          if ($runtime.roleSlotsRemaining($runtime.state.managers[idx],role)<=0) idx=$runtime.nextNominatorIndex(idx);
          $runtime.state.nominationIndex=idx;
          const nominator=$runtime.state.managers[idx];

          let player=$runtime.chooseNomination(nominator);
          if (!player) {
            player=$runtime.state.availableIds
              .map(id=>$runtime.playerMap.get(id))
              .find(p=>p && p.role===role && $runtime.canOwn(nominator,p));
          }
          if (!player) break;

          if (!$runtime.quickAwardGeneratedPlayer(player,nominator)) {
            // Absolute fallback: assign the called player to its nominator at the minimum legal price.
            if ($runtime.canOwn(nominator,player) && $runtime.maxLegalBid(nominator,player)>=1) {
              const price=1;
              nominator.budget-=price;
              nominator.roster.push({
                id:player.id,name:player.name,role:player.role,club:player.club,
                ovr:player.ovr,quotation:player.quotation,fvm:player.fvm,price
              });
              $runtime.recordUserAuctionPick(player,nominator.id);
              $runtime.state.availableIds=$runtime.state.availableIds.filter(id=>id!==player.id);
              $runtime.state.stats.purchases++;
              $runtime.state.stats.totalSpent+=price;
            } else break;
          }

          $runtime.registerNominationCall(nominator.id,player.role);

          if (!$runtime.rolePhaseComplete(role)) $runtime.state.nominationIndex=$runtime.nextNominatorIndex(idx);

          // Spezza il calcolo in piccoli blocchi: la UI resta viva e leggibile.
          chunkCounter++;
          if (chunkCounter>=4) {
            chunkCounter=0;
            $runtime.updateQuickReadyProgress(role,player?.name||'');
            await $runtime.quickReadyYield(0);
          }
        }

        $runtime.updateQuickReadyProgress(role,'reparto completato');
        await $runtime.quickReadyYield(25);

        if (!$runtime.rolePhaseComplete(role)) {
          console.warn('Generazione rose rapide incompleta nel reparto',role);
          break;
        }
        $runtime.state.nominationIndex=0;
      }

      $runtime.setQuickReadyLoading(true,{
        title:'Controllo finale...',
        text:'Verifico rose, budget e assegnazioni.',
        step:'Controllo integrità',
        progress:97
      });
      await $runtime.quickReadyYield(35);

      $runtime.state.currentRoleIndex=$runtime.ROLE_ORDER.length;
      $runtime.state.auction=null;
      $runtime.state.completed=$runtime.allRostersComplete();
      $runtime.auditAndRepairState('quick-ready-rosters');
      $runtime.saveState();

      if ($runtime.state.completed) {
        $runtime.setQuickReadyLoading(true,{
          title:'Rose pronte!',
          text:'Tutte le 10 squadre sono state generate correttamente.',
          step:'Completato',
          progress:100
        });
        await $runtime.quickReadyYield(260);
        $runtime.setQuickReadyLoading(false);
        $runtime.renderSummary();
      } else {
        $runtime.setQuickReadyLoading(false);
        await window.PixelDialog.alert({eyebrow:'GENERAZIONE ROSE',title:'Rose incomplete',message:'Non sono riuscito a generare tutte le rose. Riprova con un nuovo salvataggio.',confirmLabel:'TORNA AL MENU',tone:'danger'});
        $runtime.showScreen('setupScreen');
      }
    } catch (err) {
      console.error('Errore generazione rose rapide',err);
      $runtime.setQuickReadyLoading(false);
      await window.PixelDialog.alert({eyebrow:'ERRORE',title:'Generazione interrotta',message:'Si è verificato un errore durante la generazione delle rose. Riprova.',confirmLabel:'TORNA AL MENU',tone:'danger'});
      $runtime.showScreen('setupScreen');
    }
  }
    return Object.freeze({quickReadyYield,setQuickReadyLoading,updateQuickReadyProgress,quickAwardGeneratedPlayer,generateReadyRosters});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['ready-rosters-controller']=Object.freeze({create});
})();
