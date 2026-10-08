/* Responsibility: live-controller. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: live-controller');
  function ensureCpuLineupsForDay(day) {
    const season=$runtime.ensureSeasonState(); if(!season) return null;
    if(!season.lineups[String(day)]) season.lineups[String(day)]={};
    const store=season.lineups[String(day)];
    const forced=$runtime.forcedFormationRuleForDay(day);
    const opponentId=$runtime.userOpponentIdForDay(day);
    const blockedId=$runtime.blockedOpponentPlayerId(day);
    $runtime.state.managers.filter(m=>m.id!=='user').forEach(m=>{
      const mustMirrorForced=!!forced && (forced==='5-5-5' || String(m.id)===String(opponentId)) && String(store[m.id]?.formation||'')!==forced;
      const forcedStarterId=$runtime.adminForcedStarterForManager(m.id,day);
      const adminBlockedStarterId=$runtime.adminBlockedStarterForManager(m.id,day);
      const cpuStarterIds=Object.values(store[m.id]?.starters||{}).map(String);
      const hasForcedStarter=!forcedStarterId || cpuStarterIds.includes(String(forcedStarterId));
      const hasAdminBlockedStarter=!!adminBlockedStarterId && cpuStarterIds.includes(String(adminBlockedStarterId));
      const hasBlockedPlayer=!!blockedId && String(m.id)===String(opponentId) && (cpuStarterIds.includes(String(blockedId)) || (store[m.id]?.bench||[]).map(String).includes(String(blockedId)));
      if(!store[m.id]?.confirmed || !$runtime.allowedLineupFormation(store[m.id]?.formation) || mustMirrorForced || !hasForcedStarter || hasAdminBlockedStarter || hasBlockedPlayer){
        store[m.id]=$runtime.buildAutoLineup(m,$runtime.cpuFormationForDay(m,day));
        if(forcedStarterId && String(forcedStarterId)!==String(blockedId||'')) $runtime.enforceStarterInLineup(m,store[m.id],forcedStarterId);
        if(adminBlockedStarterId) $runtime.enforcePlayerBenchedInLineup(m,store[m.id],adminBlockedStarterId,day);
        $runtime.enforceOpponentConsumableBlock(m,store[m.id],day);
      }
    });
    return store;
  }

  function serieALiveTickBase(){
    return $runtime.serieALive?.phase==='bigmatch'?520:460;
  }

  function serieALiveTickDelay(){
    const speed=Number($runtime.serieALive?.speed||1);
    return Math.max(120,Math.round($runtime.serieALiveTickBase()/speed));
  }

  function restartSerieALiveTimer(){
    if(!$runtime.serieALive) return;
    if($runtime.serieALive.timer){clearInterval($runtime.serieALive.timer);$runtime.serieALive.timer=null;}
    if($runtime.serieALive.manualPaused) return;
    $runtime.serieALive.timer=window.setInterval($runtime.tickSerieALive,$runtime.serieALiveTickDelay());
  }

  function setSerieALiveSpeed(value){
    if(!$runtime.serieALive || $runtime.serieALive.reviewComplete || $runtime.serieALive.phase==='between') return;
    const speed=Number(value);
    if(!$runtime.SERIEA_LIVE_SPEEDS[speed]) return;
    $runtime.serieALive.speed=speed;
    $runtime.serieALive.manualPaused=false;
    $runtime.restartSerieALiveTimer();
    $runtime.renderSerieALiveSpeedControls();
  }

  function toggleSerieALivePause(){
    if(!$runtime.serieALive || $runtime.serieALive.reviewComplete || $runtime.serieALive.phase==='between') return;
    $runtime.serieALive.manualPaused=!$runtime.serieALive.manualPaused;
    if($runtime.serieALive.manualPaused){
      if($runtime.serieALive.timer){clearInterval($runtime.serieALive.timer);$runtime.serieALive.timer=null;}
    }else $runtime.restartSerieALiveTimer();
    $runtime.renderSerieALiveSpeedControls();
  }

  function jumpToNextSerieAEvent(){
    if(!$runtime.serieALive || $runtime.serieALive.reviewComplete || $runtime.serieALive.phase==='between') return;
    const events=$runtime.serieALive.phaseEvents||[];
    const remaining=events.slice($runtime.serieALive.eventIndex);
    const target=remaining.find(event=>$runtime.serieAEventTouchesFantasyMatch(event)) || remaining[0];
    if(!target){$runtime.skipSerieALive();return;}
    if($runtime.serieALive.timer){clearInterval($runtime.serieALive.timer);$runtime.serieALive.timer=null;}
    $runtime.serieALive.manualPaused=false;
    $runtime.serieALive.autoPauseUntil=0;
    $runtime.serieALive.tvToken=($runtime.serieALive.tvToken||0)+1;
    $runtime.hideSerieATvBanner();
    $runtime.serieALive.minute=Math.max($runtime.serieALive.minute,Math.max(0,Number(target.minute||1)-1));
    $runtime.tickSerieALive();
    if($runtime.serieALive && !$runtime.serieALive.reviewComplete && $runtime.serieALive.phase!=='between'){
      $runtime.serieALive.manualPaused=true;
      if($runtime.serieALive.timer){clearInterval($runtime.serieALive.timer);$runtime.serieALive.timer=null;}
      $runtime.renderSerieALiveSpeedControls();
    }
  }

  function renderSerieALiveSpeedControls(){
    if(!$runtime.serieALive) return;
    const controlsLocked=!!$runtime.serieALive.reviewComplete || $runtime.serieALive.phase==='between';
    document.querySelectorAll('[data-live-speed]').forEach(btn=>{
      btn.classList.toggle('active',!controlsLocked && !$runtime.serieALive.manualPaused && Number(btn.dataset.liveSpeed)===Number($runtime.serieALive.speed||1));
      btn.disabled=controlsLocked;
    });
    const pause=$runtime.$('serieAPauseBtn');
    if(pause){
      pause.classList.toggle('active',!!$runtime.serieALive.manualPaused && !controlsLocked);
      pause.textContent=controlsLocked?'FT':($runtime.serieALive.manualPaused?'RIPRENDI':'PAUSA');
      pause.disabled=controlsLocked;
    }
  }

  function serieAEventFantasySide(event){
    const ctx=$runtime.serieALiveFantasyContext();
    if(!ctx) return '';
    const ids=[event.playerId,event.assistId,event.keeperId,event.inPlayerId,event.outPlayerId].filter(v=>v!==null&&v!==undefined).map(String);
    const userIds=new Set((ctx.userAllPlayers||ctx.userPlayers).map(p=>String(p.id)));
    const oppIds=new Set((ctx.oppAllPlayers||ctx.oppPlayers).map(p=>String(p.id)));
    if(ids.some(id=>userIds.has(id))) return 'user';
    if(ids.some(id=>oppIds.has(id))) return 'opponent';
    return '';
  }

  function captureWatchedVoteSnapshot(){
    const ctx=$runtime.serieALiveFantasyContext();
    const map=new Map();
    if(!ctx || !$runtime.serieALive) return map;
    ctx.watchedIds.forEach(id=>{
      const perf=$runtime.serieALive.perfMap.get(String(id));
      if(perf) map.set(String(id),$runtime.halfPoint(perf.liveVote));
    });
    return map;
  }

  function updateWatchedVoteFlashes(before){
    if(!$runtime.serieALive || !before) return;
    if(!($runtime.serieALive.voteFlashes instanceof Map)) $runtime.serieALive.voteFlashes=new Map();
    const now=Date.now();
    before.forEach((oldVote,id)=>{
      const perf=$runtime.serieALive.perfMap.get(String(id));
      if(!perf) return;
      const next=$runtime.halfPoint(perf.liveVote);
      if(next!==oldVote){
        $runtime.serieALive.voteFlashes.set(String(id),{
          from:oldVote,to:next,dir:next>oldVote?'up':'down',until:now+2200
        });
      }
    });
  }

  function tvEventClass(event){
    if(event.type==='own_goal') return 'red';
    if(event.type==='goal'||event.type==='penalty_goal') return 'goal';
    if(event.type==='penalty_miss') return 'penalty-miss';
    if(event.type==='red') return 'red';
    if(event.type==='injury') return 'injury';
    if(event.type==='substitution') return 'substitution';
    return 'generic';
  }

  function tvFinalTitle(event){
    if(event.type==='own_goal') return 'AUTOGOL!';
    if(event.type==='goal') return 'GOOOOL!';
    if(event.type==='penalty_goal') return 'RIGORE SEGNATO!';
    if(event.type==='penalty_miss') return 'RIGORE SBAGLIATO!';
    if(event.type==='red') return 'CARTELLINO ROSSO!';
    if(event.type==='injury') return 'INFORTUNIO';
    if(event.type==='substitution') return 'CAMBIO';
    return 'NOTIZIA DAL CAMPO';
  }

  function tvEventDetail(event){
    if(event.type==='own_goal') return `🎂 Compleanno amaro · punto per ${$runtime.clubName(event.side==='home'?event.awayClub:event.homeClub)}`;
    const match=$runtime.serieALive?.matches?.[event.matchIndex];
    const team=event.side==='home'?event.homeClub:event.awayClub;
    if(event.type==='goal'||event.type==='penalty_goal'){
      return `${$runtime.clubName(team)} · ${match?`${match.homeScore} - ${match.awayScore}`:''}${event.assistName?` · Assist ${event.assistName}`:''}`;
    }
    if(event.type==='penalty_miss') return `${$runtime.clubName(team)}${event.keeperName?` · Para ${event.keeperName}`:''}`;
    if(event.type==='red') return `${$runtime.clubName(team)} · squadra in 10`;
    if(event.type==='injury') return `${$runtime.clubName(team)} · possibile sostituzione`;
    if(event.type==='substitution') return `${$runtime.clubName(team)} · ${event.outPlayerName} → ${event.inPlayerName}`;
    return $runtime.clubName(team);
  }

  function tvFantasyFocus(event){
    const fallback={
      kind:'event',playerId:event.playerId,playerName:event.playerName,
      title:$runtime.tvFinalTitle(event),confirmedTitle:'GOL CONFERMATO!',
      kicker:$runtime.serieALive?.phase==='bigmatch'?'BIG MATCH':'DIRETTA GOL',detail:$runtime.tvEventDetail(event)
    };
    const ctx=$runtime.serieALiveFantasyContext();
    if(!ctx) return fallback;
    const userIds=new Set((ctx.userAllPlayers||ctx.userPlayers||[]).map(p=>String(p.id)));
    const oppIds=new Set((ctx.oppAllPlayers||ctx.oppPlayers||[]).map(p=>String(p.id)));
    const sideFor=id=>userIds.has(String(id))?'user':oppIds.has(String(id))?'opponent':'';
    if(event.type==='penalty_miss' && event.keeperId && sideFor(event.keeperId) && !sideFor(event.playerId)){
      const own=sideFor(event.keeperId)==='user';
      return {kind:'save',playerId:event.keeperId,playerName:$runtime.playerMap.get(String(event.keeperId))?.name||event.keeperName||'Portiere',title:'RIGORE PARATO!',confirmedTitle:'RIGORE PARATO!',kicker:own?'⭐ TUO PORTIERE':'⚔ PORTIERE AVVERSARIO',detail:`${own?'Bonus per il tuo portiere':'Bonus avversario'}: +3 · Rigore di ${event.playerName}`};
    }
    const candidates=[];
    if(event.type==='goal'||event.type==='penalty_goal'){
      candidates.push({kind:'goal',id:event.playerId,name:event.playerName,side:sideFor(event.playerId),bonus:'+3'});
      if(event.assistId) candidates.push({kind:'assist',id:event.assistId,name:event.assistName,side:sideFor(event.assistId),bonus:'+1'});
      if(event.keeperId){
        const keeper=$runtime.playerMap.get(String(event.keeperId));
        candidates.push({kind:'conceded',id:event.keeperId,name:keeper?.name||event.keeperName||'Portiere',side:sideFor(event.keeperId),bonus:'-1'});
      }
    }
    const chosen=candidates.find(item=>item.side==='user') || candidates.find(item=>item.side==='opponent');
    if(!chosen) return fallback;
    const owner=chosen.side==='user'?(ctx.user?.team||$runtime.state.teamName||'La tua squadra'):(ctx.opp?.team||'Avversario');
    const own=chosen.side==='user';
    if(chosen.kind==='assist') return {
      kind:'assist',playerId:chosen.id,playerName:chosen.name,title:'ASSIST!',confirmedTitle:'ASSIST CONFERMATO!',
      kicker:own?'⭐ TUO ASSISTMAN':'⚔ ASSIST AVVERSARIO',
      detail:`${own?'Bonus per':'Bonus avversario'} ${owner}: ${chosen.bonus} · Gol di ${event.playerName}`
    };
    if(chosen.kind==='conceded') return {
      kind:'conceded',playerId:chosen.id,playerName:chosen.name,title:'GOL SUBITO · −1',confirmedTitle:'GOL SUBITO · −1',
      kicker:own?'⚠ TUO PORTIERE':'PORTIERE AVVERSARIO',
      detail:`${own?'Malus per':'Malus avversario'} ${owner}: ${chosen.bonus} · Gol di ${event.playerName}`
    };
    return {
      kind:'goal',playerId:chosen.id,playerName:chosen.name,title:$runtime.tvFinalTitle(event),confirmedTitle:'GOL CONFERMATO!',
      kicker:own?'⭐ TUO MARCATORE':'⚔ MARCATORE AVVERSARIO',
      detail:`${own?'Bonus per':'Bonus avversario'} ${owner}: ${chosen.bonus}${event.assistName?` · Assist ${event.assistName}`:''}`
    };
  }

  function animateMatchParticles(container, source, destination=null){
    if(!container || !source || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || !source.animate) return;
    container.querySelectorAll('.match-pixel-particle').forEach(node=>node.remove());
    const bounds=container.getBoundingClientRect(), start=source.getBoundingClientRect();
    const end=destination?.getBoundingClientRect();
    const x=start.left+start.width/2-bounds.left, y=start.top+start.height/2-bounds.top;
    const count=window.matchMedia?.('(max-width: 780px)')?.matches?8:14;
    for(let i=0;i<count;i++){
      const particle=document.createElement('span');
      particle.className='match-pixel-particle'+(end?' is-football':'');
      particle.setAttribute('aria-hidden','true');
      particle.style.left=`${x}px`; particle.style.top=`${y}px`;
      if(end){
        particle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#fff" stroke="#172033" stroke-width="1.5"/><path d="M12 7 17 11 15 17H9L7 11Z M8 2 6 6 2 8 3 4Z M16 2 18 6 22 8 21 4Z M2 15 6 16 8 21 4 20Z M22 15 18 16 16 21 20 20Z" fill="#172033"/><path d="M12 7V1 M7 11 2 8 M17 11 22 8 M9 17 8 22 M15 17 16 22" fill="none" stroke="#172033" stroke-width="1"/></svg>';
      }else particle.style.background=['#ffd84d','#82f0ba','#ffffff'][i%3];
      container.appendChild(particle);
      const angle=i/count*Math.PI*2;
      const dx=end?end.left+end.width/2-bounds.left-x:Math.cos(angle)*(45+i%4*12);
      const dy=end?end.top+end.height/2-bounds.top-y:Math.sin(angle)*45-35;
      const animation=particle.animate([
        {transform:'translate(-50%, -50%) scale(.5) rotate(0deg)',opacity:0},
        {transform:`translate(calc(-50% + ${Math.cos(angle)*24}px), calc(-50% - 22px)) scale(1)`,opacity:1,offset:.25},
        {transform:`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.3) rotate(${end?240:0}deg)`,opacity:0}
      ],{duration:end?680:800,delay:i*8,easing:'ease-out'});
      animation.finished.then(()=>particle.remove(),()=>particle.remove());
    }
  }

  function setSerieATvBanner({kicker,title,player,playerId,minute,detail,type='generic',focused=false,fantasySide='',focusKind=''}){
    const box=$runtime.$('serieATvEvent');
    if(!box) return;
    if(type==='goal' && focusKind==='conceded') type='conceded';
    if(type==='goal' && focusKind==='assist') type='assist';
    if(type==='penalty-miss' && focusKind==='save') type='penalty-save';
    const relationClass=fantasySide==='user'?'side-user':(fantasySide==='opponent'?'side-opponent':'side-neutral');
    box.className=`seriea-tv-event show type-${type} ${focused?'is-focused':''} ${relationClass}`.trim();
    const celebrating=type==='goal' && fantasySide==='user' && focusKind==='goal';
    box.classList.toggle('is-goal-celebration',celebrating);
    box.querySelector('.tv-feedback-scene')?.remove();
    const feedback=type==='assist'&&fantasySide==='user'?'assist':type==='penalty'?'penalty':type==='penalty-miss'?'miss':type==='penalty-save'?'save':type==='injury'?'injury':type==='substitution'?'replacement':'';
    if(feedback){
      const scene=document.createElement('div');
      scene.className=`tv-feedback-scene feedback-${feedback}`;
      scene.setAttribute('aria-hidden','true');
      scene.innerHTML=feedback==='assist'?'<span class="tv-floating-bonus">+1</span>':feedback==='penalty'?'<span class="tv-penalty-spot"></span><span class="tv-penalty-ball">⚽</span>':feedback==='save'?'<span class="tv-floating-bonus">🧤 +3</span>':feedback==='miss'?'<span class="tv-penalty-ball">⚽</span><b>✕</b>':feedback==='injury'?'<span class="tv-injury-cross">✚</span>':'<span class="tv-replacement-arrow">↔</span>';
      box.querySelector('.seriea-tv-event-card')?.appendChild(scene);
    }
    box.style.setProperty('--goal-team-color',$runtime.COACH_SHIRTS[$runtime.normalizedCoachAvatar($runtime.state.coachAvatar).shirt]||'#5542a8');
    box.setAttribute('aria-hidden','false');
    const kickerNode=$runtime.$('serieATvKicker');
    if(kickerNode){
      kickerNode.textContent=kicker||'DIRETTA GOL';
      kickerNode.dataset.side=fantasySide||'neutral';
    }
    $runtime.$('serieATvTitle').textContent=celebrating?'GOOOL!':title||'EVENTO';
    $runtime.$('serieATvPlayer').textContent=player||'—';
    $runtime.$('serieATvDetail').textContent=detail||'';
    if($runtime.$('serieATvMinute')) $runtime.$('serieATvMinute').textContent=`${Number(minute ?? $runtime.serieALive?.minute ?? 0)}'`;
    const avatarPlayer=$runtime.playerMap.get(String(playerId||''));
    if($runtime.$('serieATvAvatar')) $runtime.$('serieATvAvatar').innerHTML=avatarPlayer?$runtime.playerAvatarMarkup(avatarPlayer,avatarPlayer.name):'';
    if(celebrating){
      $runtime.animateMatchParticles(box.querySelector('.seriea-tv-event-card'),$runtime.$('serieATvAvatar'));
      if(!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) $runtime.$('fantasyLiveScore')?.animate?.([{transform:'scale(1)'},{transform:'scale(1.12)',color:'#ffd84d'},{transform:'scale(1)'}],{duration:420,easing:'ease-out'});
    }
  }

  function hideSerieATvBanner(token){
    if(!$runtime.serieALive || (token!==undefined && token!==$runtime.serieALive.tvToken)) return;
    const box=$runtime.$('serieATvEvent');
    if(box){
      box.classList.remove('show');
      box.setAttribute('aria-hidden','true');
    }
  }

  function triggerSerieATvPresentation(event){
    if(!$runtime.serieALive) return false;

    // V2.7.2: la regia TV è filtrata esattamente come il feed.
    // Nessun banner o micro-pausa per eventi estranei alla sfida fantasy.
    const focused=$runtime.serieAEventTouchesFantasyMatch(event);
    if(!focused) return false;

    const important=['goal','penalty_goal','own_goal','penalty_miss','red','injury'];
    if(!important.includes(event.type) && !(event.type==='substitution' && event.reason==='injury')) return false;

    const side=$runtime.serieAEventFantasySide(event);
    const focus=$runtime.tvFantasyFocus(event);
    const kicker=event.birthday?'🎂 COMPLEANNO':(event.type==='goal'||event.type==='penalty_goal')?focus.kicker:(side==='user'?'⭐ TUO GIOCATORE':side==='opponent'?'⚔ AVVERSARIO':$runtime.serieALive.phase==='bigmatch'?'BIG MATCH':'DIRETTA GOL');
    const speed=Number($runtime.serieALive.speed||1);
    const token=($runtime.serieALive.tvToken||0)+1;
    $runtime.serieALive.tvToken=token;

    const baseDuration=focused?1800:1250;
    const speedAdjustedDuration=Math.max(700,Math.round(baseDuration/(speed===2?1.35:speed===0.5?.88:1)));
    // V3.2.35.56.19: gli eventi che toccano la sfida fantasy restano visibili 2 secondi in più.
    // Il clock della Diretta Gol rimane fermo finché il banner è a schermo.
    const duration=speedAdjustedDuration+(focused?2000:0);
    $runtime.serieALive.autoPauseUntil=Date.now()+duration;

    const isGoal=event.type==='goal'||event.type==='penalty_goal';
    const hasVar=isGoal && $runtime.seededSerieRand($runtime.serieALive.day,`tv-var|${event.matchIndex}|${event.minute}|${event.playerId}`)<.18;
    const isPenalty=event.type==='penalty_goal'||event.type==='penalty_miss';

    if(event.type==='substitution'){
      $runtime.setSerieATvBanner({kicker:'CAMBIO PER INFORTUNIO',title:'ENTRA IL SOSTITUTO',player:event.inPlayerName,playerId:event.inPlayerId,minute:event.minute,detail:`${event.outPlayerName} → ${event.inPlayerName}`,type:'substitution',focused,fantasySide:side});
    }else if(isPenalty){
      $runtime.setSerieATvBanner({kicker,title:'RIGORE!',player:focus.playerName,playerId:focus.playerId,minute:event.minute,detail:$runtime.clubName(event.side==='home'?event.homeClub:event.awayClub),type:'penalty',focused,fantasySide:side,focusKind:focus.kind});
      window.setTimeout(()=>{
        if(!$runtime.serieALive || token!==$runtime.serieALive.tvToken) return;
        $runtime.setSerieATvBanner({kicker,title:focus.title,player:focus.playerName,playerId:focus.playerId,minute:event.minute,detail:focus.detail,type:$runtime.tvEventClass(event),focused,fantasySide:side,focusKind:focus.kind});
      },Math.min(650,Math.round(duration*.38)));
    }else if(hasVar){
      $runtime.setSerieATvBanner({kicker:'VAR CHECK',title:'CONTROLLO VAR...',player:focus.playerName,playerId:focus.playerId,minute:event.minute,detail:focus.kind==='assist'?`Verifica del gol di ${event.playerName}`:'Verifica del gol in corso',type:'var',focused,fantasySide:side,focusKind:focus.kind});
      window.setTimeout(()=>{
        if(!$runtime.serieALive || token!==$runtime.serieALive.tvToken) return;
        $runtime.setSerieATvBanner({kicker,title:focus.confirmedTitle,player:focus.playerName,playerId:focus.playerId,minute:event.minute,detail:focus.detail,type:'goal',focused,fantasySide:side,focusKind:focus.kind});
      },Math.min(700,Math.round(duration*.42)));
    }else{
      $runtime.setSerieATvBanner({kicker,title:(event.type==='goal'||event.type==='penalty_goal')?focus.title:$runtime.tvFinalTitle(event),player:(event.type==='goal'||event.type==='penalty_goal')?focus.playerName:event.playerName,playerId:(event.type==='goal'||event.type==='penalty_goal')?focus.playerId:event.playerId,minute:event.minute,detail:(event.type==='goal'||event.type==='penalty_goal')?focus.detail:$runtime.tvEventDetail(event),type:$runtime.tvEventClass(event),focused,fantasySide:side,focusKind:focus.kind});
    }

    window.setTimeout(()=>$runtime.hideSerieATvBanner(token),duration);
    return true;
  }

  function eventHeadline(event){
    const team=event.side==='home'?event.homeClub:event.awayClub;
    if(event.type==='goal') return `⚽ ${event.birthday?'🎂 COMPLEANNO · ':''}GOL ${$runtime.clubName(team)} · ${event.playerName}${event.assistName?` · assist ${event.assistName}`:''}`;
    if(event.type==='own_goal') return `↩ 🎂 AUTOGOL ${event.playerName} · punto per ${$runtime.clubName(event.side==='home'?event.awayClub:event.homeClub)}`;
    if(event.type==='penalty_goal') return `⚽ RIGORE SEGNATO ${$runtime.clubName(team)} · ${event.playerName}`;
    if(event.type==='penalty_miss') return `❌ RIGORE SBAGLIATO ${$runtime.clubName(team)} · ${event.playerName}${event.keeperName?` · para ${event.keeperName}`:''}`;
    if(event.type==='red') return `🟥 ROSSO ${$runtime.clubName(team)} · ${event.playerName}`;
    if(event.type==='injury') return `✚ INFORTUNIO ${$runtime.clubName(team)} · ${event.playerName}`;
    if(event.type==='yellow') return `🟨 AMMONITO ${$runtime.clubName(team)} · ${event.playerName}`;
    if(event.type==='substitution') return `↔ CAMBIO ${$runtime.clubName(team)} · ${event.outPlayerName} → ${event.inPlayerName}${event.reason==='injury'?' · per infortunio':''}`;
    return `${$runtime.clubName(team)} · ${event.playerName}`;
  }

  function serieALiveFantasyContext(){
    if(!$runtime.serieALive) return null;
    const fantasyRound=$runtime.ensureSeasonState()?.schedule?.[$runtime.serieALive.day-1];
    const fantasyMatch=fantasyRound?.matches?.find(m=>m.homeId==='user'||m.awayId==='user');
    if(!fantasyMatch) return null;
    const oppId=fantasyMatch.homeId==='user'?fantasyMatch.awayId:fantasyMatch.homeId;
    const user=$runtime.managerById('user'), opp=$runtime.managerById(oppId);
    const userLineup=$runtime.serieALive.lineups?.user;
    const oppLineup=$runtime.serieALive.lineups?.[oppId];
    const userPlayers=$runtime.lineupPlayersForManager(user,userLineup);
    const oppPlayers=$runtime.lineupPlayersForManager(opp,oppLineup);
    const userBench=$runtime.lineupBenchPlayers(user,userLineup);
    const oppBench=$runtime.lineupBenchPlayers(opp,oppLineup);
    const userAllPlayers=[...userPlayers,...userBench];
    const oppAllPlayers=[...oppPlayers,...oppBench];
    const watchedIds=new Set([...userAllPlayers,...oppAllPlayers].map(p=>String(p.id)));
    return {fantasyMatch,oppId,user,opp,userPlayers,oppPlayers,userBench,oppBench,userAllPlayers,oppAllPlayers,watchedIds};
  }

  function serieAEventTouchesFantasyMatch(event){
    const ctx=$runtime.serieALiveFantasyContext();
    if(!ctx) return false;
    return [event.playerId,event.assistId,event.keeperId,event.inPlayerId,event.outPlayerId]
      .filter(v=>v!==null && v!==undefined)
      .some(id=>ctx.watchedIds.has(String(id)));
  }

  function fantasyFocusedEventHeadline(event){
    let text=$runtime.eventHeadline(event);
    const ctx=$runtime.serieALiveFantasyContext();
    if(!ctx) return text;
    if((event.type==='goal'||event.type==='penalty_goal') && event.keeperId && ctx.watchedIds.has(String(event.keeperId))){
      const keeper=$runtime.serieALive?.perfMap?.get(String(event.keeperId));
      if(keeper && !text.includes(keeper.name)) text += ` · gol subito da ${keeper.name}`;
    }
    return text;
  }

  function applySerieAEvent(event){
    if(!$runtime.serieALive) return;
    const watchedVoteBefore=$runtime.captureWatchedVoteSnapshot();
    const match=$runtime.serieALive.matches[event.matchIndex];
    const perf=$runtime.serieALive.perfMap.get(String(event.playerId));
    if(!match || !perf) return;
    const ownPerfs=event.side==='home'?match.homePerfs:match.awayPerfs;
    const opponentPerfs=event.side==='home'?match.awayPerfs:match.homePerfs;
    const clampVote=p=>{if(p) p.liveVote=$runtime.clamp(Number(p.liveVote||6),4,9);};

    if(event.type==='goal' || event.type==='penalty_goal'){
      if(event.side==='home') match.homeScore++; else match.awayScore++;
      match.scorers = Array.isArray(match.scorers) ? match.scorers : [];
      match.scorers.push({side:event.side,minute:event.minute,playerName:event.playerName,penalty:event.type==='penalty_goal'});
      perf.goals++;
      if(Number(event.minute)>=85) perf.lateGoals=Number(perf.lateGoals||0)+1;
      perf.liveVote+=event.type==='penalty_goal'?.68:.82;
      if(event.assistId){
        const a=$runtime.serieALive.perfMap.get(String(event.assistId));
        if(a){a.assists++;a.liveVote+=.34;clampVote(a);}
      }
      $runtime.activePerformances(ownPerfs,event.minute).forEach(p=>{if(p.playerId!==perf.playerId)p.liveVote+=.035;clampVote(p);});
      $runtime.activePerformances(opponentPerfs,event.minute).forEach(p=>{p.liveVote-=.025;clampVote(p);});
      const keeper=event.keeperId?$runtime.serieALive.perfMap.get(String(event.keeperId)):$runtime.activePerformances(opponentPerfs,event.minute).find(p=>p.role==='P');
      if(keeper){keeper.goalsConceded++;keeper.liveVote-=.22;clampVote(keeper);}
    } else if(event.type==='own_goal'){
      if(event.side==='home')match.awayScore++;else match.homeScore++;
      match.scorers=Array.isArray(match.scorers)?match.scorers:[];
      match.scorers.push({side:event.side==='home'?'away':'home',minute:event.minute,playerName:event.playerName,ownGoal:true});
      perf.ownGoal++;perf.liveVote-=.55;
      const ownKeeper=$runtime.activePerformances(ownPerfs,event.minute).find(p=>p.role==='P');
      if(ownKeeper){ownKeeper.goalsConceded++;ownKeeper.liveVote-=.22;clampVote(ownKeeper);}
    } else if(event.type==='penalty_miss'){
      perf.missedPenalty++; perf.liveVote-=1.0;
      if(event.keeperId){
        const k=$runtime.serieALive.perfMap.get(String(event.keeperId));
        if(k){k.savedPenalty++;k.liveVote+=.9;clampVote(k);}
      }
    } else if(event.type==='yellow') { perf.yellow++; perf.liveVote-=.14; }
    else if(event.type==='red') {
      perf.red=1;
      if(event.secondYellow){perf.secondYellow=true;perf.yellow=Math.max(2,Number(perf.yellow||0)+1);}
      perf.liveVote-=1.05;
    }
    else if(event.type==='injury') {
      perf.injury=true; perf.injuryMinute=event.minute;
      if(event.minute<25 && !$runtime.decisivePerformance(perf)) perf.liveVote-=.12;
    } else if(event.type==='substitution') {
      // Nessun bonus/malus: il cambio serve a rendere realistica la presenza in campo.
    }
    clampVote(perf);

    const fullItem={minute:event.minute,text:$runtime.eventHeadline(event),type:event.type,playerId:event.playerId};
    $runtime.serieALive.allFeed=Array.isArray($runtime.serieALive.allFeed)?$runtime.serieALive.allFeed:[];
    $runtime.serieALive.allFeed.unshift(fullItem);
    $runtime.serieALive.allFeed=$runtime.serieALive.allFeed.slice(0,180);
    if($runtime.serieAEventTouchesFantasyMatch(event)){
      $runtime.serieALive.feed.unshift({minute:event.minute,text:$runtime.fantasyFocusedEventHeadline(event),type:event.type,playerId:event.playerId});
      $runtime.serieALive.feed=$runtime.serieALive.feed.slice(0,90);
    }
    $runtime.updateWatchedVoteFlashes(watchedVoteBefore);
  }

  function serieABigMatch(){
    return $runtime.serieALive?.matches?.[$runtime.serieALive.bigMatchIndex]||null;
  }

  function isBigMatchClub(clubId){
    const big=$runtime.serieABigMatch();
    return !!big && (clubId===big.homeClub || clubId===big.awayClub);
  }

  function serieAMinuteForPlayer(player){
    if(!$runtime.serieALive || !player) return 0;
    const bigClub=$runtime.isBigMatchClub(player.club);
    if($runtime.serieALive.phase==='multilive') return bigClub?0:$runtime.serieALive.minute;
    if($runtime.serieALive.phase==='between') return bigClub?0:90;
    if($runtime.serieALive.phase==='bigmatch') return bigClub?$runtime.serieALive.minute:90;
    return $runtime.serieALive.minute;
  }

  function serieALiveSnapshotForManager(managerId){
    const manager=$runtime.managerById(managerId), lineup=$runtime.serieALive?.lineups?.[managerId];
    if(!manager || !lineup || !$runtime.serieALive) return {fantasyPoints:0,fantasyGoals:0,performances:[]};
    const players=$runtime.lineupPlayersForManager(manager,lineup);
    const performances=players.map(player=>$runtime.currentFantasyPerformance(player,$runtime.serieALive.perfMap,$runtime.serieAMinuteForPlayer(player)));
    if(managerId==='user') performances.forEach(perf=>{
      if(perf.noVote) return;
      const riskDelta=$runtime.riskAdjustmentForPerformance(perf,$runtime.serieALive.day);
      perf.riskDelta=riskDelta;
      perf.fantasy=$runtime.halfPoint(perf.fantasy+riskDelta);
    });
    const captainId=String(lineup?.captainId || (manager.id!=='user' && $runtime.leagueRulesFor($runtime.state).captainBonus!=='off'
      ? players.slice().sort((a,b)=>$runtime.cpuLeagueRuleLineupValue(manager,b,$runtime.serieALive.day)-$runtime.cpuLeagueRuleLineupValue(manager,a,$runtime.serieALive.day))[0]?.id
      : '') || '');
    const rule=$runtime.leagueRulesFor($runtime.state).captainBonus;
    const captain=performances.find(p=>String(p.playerId)===captainId && !p.noVote);
    if(rule!=='off' && captain && Number(captain.vote)>=(rule==='eight'?8:7)){
      captain.captainBonus=rule==='eight'?2:1;
      captain.fantasy=$runtime.halfPoint(captain.fantasy+captain.captainBonus);
    }
    const fantasyPoints=$runtime.halfPoint(performances.reduce((s,p)=>s+Number(p.fantasy||0),0));
    return {managerId:manager.id,team:manager.team,fantasyPoints,fantasyGoals:$runtime.fantasyGoals(fantasyPoints,$runtime.serieALive?.day||$runtime.state?.season?.currentMatchday||1),performances};
  }

  function startSerieABigMatchPhase(){
    $runtime.startPendingBigMatchFromHub();
  }

  function snapshotSerieALive(live) {
    return window.FantaLiveState.snapshot(live);
  }

  function hydrateSerieALive(snapshot, phase=null) {
    return window.FantaLiveState.hydrate(snapshot,phase);
  }

  function finishSerieAMultiLivePhase(){
    if(!$runtime.serieALive || $runtime.serieALive.phase!=='multilive') return;
    if($runtime.serieALive.timer){clearInterval($runtime.serieALive.timer);$runtime.serieALive.timer=null;}
    $runtime.hideSerieATvBanner();
    const season=$runtime.ensureSeasonState();
    if(!season) return;
    $runtime.serieALive.phase='between';
    $runtime.serieALive.minute=90;
    $runtime.serieALive.manualPaused=true;
    $runtime.serieALive.autoPauseUntil=0;

    const betweenSnapshot=$runtime.snapshotSerieALive($runtime.serieALive);
    season.pendingBigMatch={
      day:$runtime.serieALive.day,
      bigMatchIndex:$runtime.serieALive.bigMatchIndex,
      snapshot:JSON.parse(JSON.stringify(betweenSnapshot))
    };
    // Conserviamo anche la schermata intermedia nel salvataggio:
    // se il browser viene chiuso qui, il Big Match riparte direttamente al resume.
    season.activeLive=JSON.parse(JSON.stringify(betweenSnapshot));
    $runtime.saveState();

    $runtime.showScreen('serieALiveScreen');
    $runtime.renderSerieALive();
    $runtime.showToast('Diretta Gol conclusa. Premi INIZIA BIG MATCH quando sei pronto.');
  }

  function fantasyLiveSnapshot(managerId){
    return $runtime.serieALiveSnapshotForManager(managerId);
  }

  function setSerieAMatchesExpanded(expanded,{render=false}={}){
    $runtime.serieAMatchesExpanded=true;
    const panel=$runtime.$('serieAScoreboardPanel');
    if(panel){
      panel.classList.toggle('is-expanded',$runtime.serieAMatchesExpanded);
      panel.classList.toggle('is-collapsed',!$runtime.serieAMatchesExpanded);
    }
    if(render && $runtime.serieALive) $runtime.renderSerieALive();
  }

  function renderSerieALive(){
    if(!$runtime.serieALive) return;
    $runtime.renderSerieALiveSpeedControls();
    $runtime.$('serieALiveDay').textContent=$runtime.serieALive.day;

    const phase=$runtime.serieALive.phase||'multilive';
    const big=$runtime.serieABigMatch();
    const bigLabel=big?`${$runtime.clubName(big.homeClub)} - ${$runtime.clubName(big.awayClub)}`:'Big Match';
    const reviewComplete=!!$runtime.serieALive.reviewComplete;
    const scoreboardPanel=$runtime.$('serieAScoreboardPanel');
    if(scoreboardPanel){
      scoreboardPanel.classList.remove('is-collapsible');
      scoreboardPanel.classList.add('is-static');
    }
    $runtime.setSerieAMatchesExpanded(true);

    const commandBar=document.querySelector('#serieALiveScreen .fantasy-live-controls-compact');
    if(commandBar) commandBar.dataset.phase=reviewComplete?'complete':phase;
    if(reviewComplete){
      $runtime.$('serieALiveMinute').textContent='FT';
      $runtime.$('serieALiveClockLabel').textContent='FINALE';
      $runtime.$('serieAPhaseBadge').textContent='GIORNATA CONCLUSA';
      $runtime.$('serieALiveTitle').textContent='Diretta Gol conclusa';
      $runtime.$('serieALiveSubtitle').textContent='Tutte le partite sono terminate. Puoi controllare risultati, fantapunti, voti ed eventi prima di proseguire.';
      $runtime.$('serieAMatchesEyebrow').textContent='10 RISULTATI FINALI';
      $runtime.$('serieAMatchesTitle').textContent='Risultati Serie A';
      $runtime.$('skipSerieALiveBtn').disabled=false;
      $runtime.$('skipSerieALiveBtn').textContent='VEDI RISULTATO';
    } else if(phase==='between'){
      $runtime.$('serieALiveMinute').textContent='FT';
      $runtime.$('serieALiveClockLabel').textContent='DIRETTA';
      $runtime.$('serieAPhaseBadge').textContent='BIG MATCH';
      $runtime.$('serieALiveTitle').textContent='Diretta Gol conclusa';
      $runtime.$('serieALiveSubtitle').textContent=`Le altre 9 partite sono finite. Premi INIZIA BIG MATCH per giocare ${bigLabel}.`;
      $runtime.$('serieAMatchesEyebrow').textContent='9 RISULTATI FINALI';
      $runtime.$('serieAMatchesTitle').textContent='Diretta Gol conclusa';
      $runtime.$('skipSerieALiveBtn').disabled=false;
      $runtime.$('skipSerieALiveBtn').textContent='INIZIA BIG MATCH';
    } else if(phase==='bigmatch'){
      $runtime.$('serieALiveMinute').textContent=`${$runtime.serieALive.minute}'`;
      $runtime.$('serieALiveClockLabel').textContent='MINUTO';
      $runtime.$('serieAPhaseBadge').textContent='BIG MATCH';
      $runtime.$('serieALiveTitle').textContent='Big Match';
      $runtime.$('serieALiveSubtitle').textContent=`${bigLabel} · l'ultima partita della giornata si gioca da sola.`;
      $runtime.$('serieAMatchesEyebrow').textContent='1 PARTITA LIVE';
      $runtime.$('serieAMatchesTitle').textContent='Big Match';
      $runtime.$('skipSerieALiveBtn').disabled=false;
      $runtime.$('skipSerieALiveBtn').textContent='SALTA AL 90°';
    } else {
      $runtime.$('serieALiveMinute').textContent=`${$runtime.serieALive.minute}'`;
      $runtime.$('serieALiveClockLabel').textContent='MINUTO';
      $runtime.$('serieAPhaseBadge').textContent='DIRETTA GOL';
      $runtime.$('serieALiveTitle').textContent='Diretta Gol';
      $runtime.$('serieALiveSubtitle').textContent=`9 partite in contemporanea. ${bigLabel} è il Big Match e si giocherà per ultimo.`;
      $runtime.$('serieAMatchesEyebrow').textContent='9 PARTITE LIVE';
      $runtime.$('serieAMatchesTitle').textContent='Campi Serie A';
      $runtime.$('skipSerieALiveBtn').disabled=false;
      $runtime.$('skipSerieALiveBtn').textContent='SALTA AL 90°';
    }

    if($runtime.$('nextSerieAEventBtn')){
      const noMoreEvents=$runtime.serieALive.eventIndex>=($runtime.serieALive.phaseEvents||[]).length;
      $runtime.$('nextSerieAEventBtn').disabled=reviewComplete || phase==='between' || noMoreEvents;
      $runtime.$('nextSerieAEventBtn').textContent=noMoreEvents?'NESSUN ALTRO EVENTO':'PROSSIMO EVENTO';
    }

    if($runtime.$('serieABigMatchTeaser')){
      if(reviewComplete){
        $runtime.$('serieABigMatchTeaser').innerHTML='';
        $runtime.$('serieABigMatchTeaser').classList.remove('is-live');
      } else if(phase==='multilive'){
        $runtime.$('serieABigMatchTeaser').innerHTML=big?`<span>BIG MATCH · POSTICIPO</span><strong>${$runtime.escapeHtml($runtime.clubName(big.homeClub))} vs ${$runtime.escapeHtml($runtime.clubName(big.awayClub))}</strong><small>Si giocherà da solo al termine della Diretta Gol</small>`:'';
        $runtime.$('serieABigMatchTeaser').classList.remove('is-live');
      } else if(phase==='between'){
        $runtime.$('serieABigMatchTeaser').innerHTML=big?`<span>PROSSIMA</span><strong>${$runtime.escapeHtml($runtime.clubName(big.homeClub))} vs ${$runtime.escapeHtml($runtime.clubName(big.awayClub))}</strong><small>Premi il pulsante qui sotto quando sei pronto.</small>`:'';
        $runtime.$('serieABigMatchTeaser').classList.remove('is-live');
      } else {
        $runtime.$('serieABigMatchTeaser').innerHTML='';
        $runtime.$('serieABigMatchTeaser').classList.add('is-live');
      }
    }

    const visibleMatches=reviewComplete?$runtime.serieALive.matches:(phase==='bigmatch'?(big?[big]:[]):$runtime.serieALive.matches.filter((_,i)=>i!==$runtime.serieALive.bigMatchIndex));
    $runtime.$('serieAMatchesGrid').classList.toggle('single-big-match',phase==='bigmatch' && !reviewComplete);
    $runtime.$('serieAMatchesGrid').innerHTML=visibleMatches.map(m=>{
      const homeScorers=(m.scorers||[]).filter(s=>s.side==='home').map(s=>`${$runtime.escapeHtml(s.playerName)} ${s.minute}'${s.penalty?' (R)':''}`).join('<br>');
      const awayScorers=(m.scorers||[]).filter(s=>s.side==='away').map(s=>`${$runtime.escapeHtml(s.playerName)} ${s.minute}'${s.penalty?' (R)':''}`).join('<br>');
      return `<div class="seriea-live-match ${phase==='bigmatch'?'is-big-match':''}"><span>${$runtime.escapeHtml($runtime.clubShort(m.homeClub))}</span><strong>${m.homeScore} - ${m.awayScore}</strong><span>${$runtime.escapeHtml($runtime.clubShort(m.awayClub))}</span><small>${$runtime.escapeHtml($runtime.clubName(m.homeClub))} · ${$runtime.escapeHtml($runtime.clubName(m.awayClub))}</small><div class="seriea-match-scorers"><span>${homeScorers||'—'}</span><span>${awayScorers||'—'}</span></div></div>`;
    }).join('');

    const fantasyRound=$runtime.ensureSeasonState()?.schedule?.[$runtime.serieALive.day-1];
    const fantasyMatch=fantasyRound?.matches?.find(m=>m.homeId==='user'||m.awayId==='user');
    let us=null, them=null, liveOpponentName='Avversario';
    let finalUserPerformances=null, finalOpponentPerformances=null;
    if(fantasyMatch){
      const oppId=fantasyMatch.homeId==='user'?fantasyMatch.awayId:fantasyMatch.homeId;
      const completedDay=$runtime.ensureSeasonState()?.matchdayResults?.[String($runtime.serieALive.day)];
      const completedMatch=completedDay?.matches?.find(m=>m.homeId==='user'||m.awayId==='user');
      if(reviewComplete && completedMatch){
        const userHome=completedMatch.homeId==='user';
        finalUserPerformances=userHome?completedMatch.homePerformances:completedMatch.awayPerformances;
        finalOpponentPerformances=userHome?completedMatch.awayPerformances:completedMatch.homePerformances;
        const userPoints=Number(userHome?completedMatch.homeFantasy:completedMatch.awayFantasy)||0;
        const opponentPoints=Number(userHome?completedMatch.awayFantasy:completedMatch.homeFantasy)||0;
        us={fantasyPoints:userPoints,fantasyGoals:Number(userHome?completedMatch.homeScore:completedMatch.awayScore)||0,performances:finalUserPerformances};
        them={fantasyPoints:opponentPoints,fantasyGoals:Number(userHome?completedMatch.awayScore:completedMatch.homeScore)||0,performances:finalOpponentPerformances};
      }else{
        us=$runtime.fantasyLiveSnapshot('user');
        them=$runtime.fantasyLiveSnapshot(oppId);
      }
      liveOpponentName=$runtime.managerById(oppId)?.team||'Avversario';
      $runtime.$('fantasyLiveUserTeam').textContent=$runtime.state.teamName;
      $runtime.$('fantasyLiveOppTeam').textContent=liveOpponentName;
      $runtime.$('fantasyLiveUserPoints').textContent=us.fantasyPoints.toFixed(1);
      $runtime.$('fantasyLiveOppPoints').textContent=them.fantasyPoints.toFixed(1);
      $runtime.$('fantasyLiveScore').textContent=`${us.fantasyGoals} - ${them.fantasyGoals}`;
    }

    const latestFantasyEvent=($runtime.serieALive.feed||[]).find(item=>item.type!=='substitution') || ($runtime.serieALive.allFeed||[]).find(item=>item.type!=='substitution') || null;
    const latestText=latestFantasyEvent?.text || (phase==='between' ? 'Le partite principali sono finite.' : phase==='bigmatch' ? 'Big Match in corso.' : "Calcio d'inizio, nessun evento rilevante ancora.");
    if($runtime.$('serieALastEventTitle')) $runtime.$('serieALastEventTitle').textContent = latestFantasyEvent ? `${latestFantasyEvent.minute}' · ${latestText}` : 'Nessun evento ancora';
    if($runtime.$('serieALastEventDetail')) $runtime.$('serieALastEventDetail').textContent = latestFantasyEvent ? 'Aggiornamento rapido sugli eventi che toccano la tua sfida fantasy.' : latestText;

    if($runtime.$('serieALiveDuelTitle')){
      if(us && them){
        const delta = $runtime.halfPoint(Number(us.fantasyPoints||0) - Number(them.fantasyPoints||0));
        const scoreText = `${$runtime.state.teamName} ${us.fantasyGoals} - ${them.fantasyGoals} ${liveOpponentName}`;
        let duelTitle = 'Partita in equilibrio';
        let duelDetail = `${scoreText} · Fantapunti ${us.fantasyPoints.toFixed(1)} - ${them.fantasyPoints.toFixed(1)}`;
        if(delta > 0) duelTitle = `${$runtime.state.teamName} avanti di ${delta.toFixed(1)} pt`;
        else if(delta < 0) duelTitle = `${liveOpponentName} avanti di ${Math.abs(delta).toFixed(1)} pt`;
        $runtime.$('serieALiveDuelTitle').textContent = duelTitle;
        $runtime.$('serieALiveDuelDetail').textContent = duelDetail;
      }else{
        $runtime.$('serieALiveDuelTitle').textContent = 'Partita in equilibrio';
        $runtime.$('serieALiveDuelDetail').textContent = 'I fantapunti si aggiorneranno minuto dopo minuto.';
      }
    }

    if($runtime.$('serieALiveStatusTitle')){
      const completed = (visibleMatches||[]).filter(m=>Number(m.homeScore)+Number(m.awayScore)>=0 && ($runtime.serieALive.minute>=90 || phase==='between')).length;
      let statusTitle = 'Diretta Gol in corso';
      let statusDetail = `${visibleMatches.length} campi monitorati · minuto ${phase==='between' ? 'FT' : `${$runtime.serieALive.minute}'`}`;
      if(reviewComplete){
        statusTitle = 'Giornata conclusa';
        statusDetail = 'Tutti i campi sono al 90°. Puoi rivedere con calma risultati ed eventi.';
      }else if(phase==='between'){
        statusTitle = 'Big Match in arrivo';
        statusDetail = 'Le 9 partite live sono finite. Manca solo il posticipo.';
      }else if(phase==='bigmatch'){
        statusTitle = 'Big Match sotto i riflettori';
        statusDetail = `${bigLabel} · minuto ${$runtime.serieALive.minute}'`;
      }
      $runtime.$('serieALiveStatusTitle').textContent = statusTitle;
      $runtime.$('serieALiveStatusDetail').textContent = statusDetail;
    }

    const ctx=$runtime.serieALiveFantasyContext();
    if(ctx){
      $runtime.renderFixtureCoachPortrait('liveUserCoachPortrait',ctx.user,$runtime.seasonFixtureTheme(ctx.user,true));
      const rival=$runtime.managerById(ctx.oppId);
      $runtime.renderFixtureCoachPortrait('liveOppCoachPortrait',rival,$runtime.seasonFixtureTheme(rival,false));
    }
    const ro={P:0,D:1,C:2,A:3};

    const livePlayerRow=(player,isFantasyBench=false,finalPerformance=null)=>{
      const sideId=(ctx?.user?.roster||[]).some(p=>String(p.id)===String(player.id))?'user':ctx?.oppId;
      const isCaptain=$runtime.leagueRulesFor($runtime.state).captainBonus!=='off' && String($runtime.serieALive.lineups?.[sideId]?.captainId||'')===String(player.id);
      const fullName=String(player.name||'Giocatore');
      const parts=fullName.trim().split(/\s+/);
      const shortName=fullName.length>13 && parts.length>1?`${parts[0][0]}. ${parts.slice(1).join(' ')}`:fullName;
      const nameMarkup=`<span class="live-name-full">${$runtime.escapeHtml(fullName)}</span><span class="live-name-short">${$runtime.escapeHtml(shortName)}</span>`;
      const captainIcon=isCaptain?'<span title="Capitano della giornata">©️ </span>':'';
      if(finalPerformance){
        const noVote=!!finalPerformance.noVote;
        const substituted=finalPerformance.lineupSource==='substitute';
        const status=finalPerformance.lineupSource==='replaced'?`SOSTITUITO DA ${finalPerformance.replacementName||'PANCHINARO'}`:noVote?'SV':substituted?`ENTRATO PER ${finalPerformance.replacedPlayerName||'TITOLARE'}`:'FT';
        const vote=noVote?'—':Number(finalPerformance.vote||0).toFixed(1);
        const fv=noVote?'—':Number(finalPerformance.fantasy||0).toFixed(1);
        return {
          hasPlayed:!noVote,active:false,vote,fv,status,
          html:`<div class="seriea-user-player ${isFantasyBench?'is-fantasy-bench':''} ${substituted?'is-fantasy-substitute':''} ${noVote?'is-sv':''}"><i class="seriea-player-face">${$runtime.playerAvatarMarkup(player,player.name||'Giocatore')}</i><span class="lineup-role-chip role-${player.role}">${player.role}</span><div><strong title="${$runtime.escapeHtml(fullName)}">${captainIcon}${nameMarkup}</strong><small>${$runtime.escapeHtml($runtime.clubShort(player.club))} · ${$runtime.escapeHtml(status)}</small></div><span class="seriea-live-events">${noVote?'<span class="live-event-empty">SV</span>':$runtime.liveEventBadgesMarkup(finalPerformance)}</span><b class="live-base-vote" title="Voto base"><small>V</small>${vote}</b><em class="live-total-vote" title="Fantavoto totale"><small>FV</small>${fv}</em></div>`
        };
      }
      const perf=$runtime.serieALive.perfMap.get(String(player.id));
      const playerMinute=$runtime.serieAMinuteForPlayer(player);
      const hasPlayed=perf && perf.entryMinute<=playerMinute && playerMinute>0;
      const active=hasPlayed && (!perf.plannedExitMinute || playerMinute<=perf.plannedExitMinute);
      const vote=hasPlayed?$runtime.halfPoint(perf.liveVote).toFixed(1):'—';
      const fv=hasPlayed?$runtime.liveFantasyValue(perf,playerMinute).toFixed(1):'—';

      let status='SV';
      if($runtime.isBigMatchClub(player.club) && phase!=='bigmatch') status=phase==='between'?'BIG MATCH':'POSTICIPO';
      else if(perf){
        if(!hasPlayed) status='PANCHINA';
        else if(perf.red) status='ESPULSO';
        else if(perf.injury) status='INFORTUNATO';
        else if(!active && Number(perf.plannedExitMinute||90)<playerMinute) status=`USCITO ${perf.plannedExitMinute}'`;
        else if(!perf.starter) status=`ENTRATO ${perf.entryMinute}'`;
        else status=playerMinute>=90?'FT':'LIVE';
      }

      const voteFlash=$runtime.serieALive.voteFlashes instanceof Map?$runtime.serieALive.voteFlashes.get(String(player.id)):null;
      const flashActive=voteFlash && voteFlash.until>Date.now();
      if(voteFlash && !flashActive) $runtime.serieALive.voteFlashes.delete(String(player.id));
      const flashClass=flashActive?`vote-${voteFlash.dir}`:'';
      const delta=flashActive?`<span class="live-vote-delta" aria-label="Voto da ${voteFlash.from} a ${voteFlash.to}"><span class="live-vote-direction">${voteFlash.dir==='up'?'▲':'▼'}</span><span class="live-vote-from">${Number(voteFlash.from)}</span><span class="live-vote-to">→${Number(voteFlash.to)}</span></span>`:'';

      return {
        hasPlayed,active,vote,fv,status,
        html:`<div class="seriea-user-player ${isFantasyBench?'is-fantasy-bench':''} ${active?'is-live':''} ${perf?.red?'is-red':''} ${perf?.injury?'is-injured':''} ${status==='POSTICIPO'||status==='BIG MATCH'?'is-posticipo':''} ${flashClass}"><i class="seriea-player-face">${$runtime.playerAvatarMarkup(player,player.name||'Giocatore')}</i><span class="lineup-role-chip role-${player.role}">${player.role}</span><div><strong title="${$runtime.escapeHtml(fullName)}">${captainIcon}${nameMarkup}</strong><small>${$runtime.escapeHtml($runtime.clubShort(player.club))} · ${$runtime.escapeHtml(status)}</small></div><span class="seriea-live-events">${hasPlayed?$runtime.liveEventBadgesMarkup(perf):'<span class="live-event-empty">—</span>'}</span><b class="live-base-vote" title="Voto base"><small>V</small>${vote}${delta}</b><em class="live-total-vote" title="Fantavoto totale"><small>FV</small>${fv}</em></div>`
      };
    };

    const renderLiveFantasySide=(manager,starters,bench,starterContainerId,benchContainerId,countId,benchCountId,teamLabelId,effectivePerformances=null)=>{
      if(!manager || !$runtime.$(starterContainerId)) return;

      let starterLiveCount=0;
      const finalRows=Array.isArray(effectivePerformances)
        ? effectivePerformances.map(performance=>({performance,player:(manager.roster||[]).find(p=>String(p.id)===String(performance.playerId))})).filter(x=>x.player)
        : starters.map(player=>({player,performance:null}));
      finalRows.sort((a,b)=>ro[a.player.role]-ro[b.player.role] || String(a.player.name).localeCompare(String(b.player.name),'it'));
      $runtime.$(starterContainerId).innerHTML=finalRows.map(({player,performance})=>{
        const row=livePlayerRow(player,false,performance);
        if(row.active) starterLiveCount++;
        return row.html;
      }).join('');

      let benchWithVote=0;
      const effectiveIds=new Set(finalRows.map(x=>String(x.player.id)));
      const replacedStarters=Array.isArray(effectivePerformances)?starters.filter(player=>!effectiveIds.has(String(player.id))):[];
      const orderedBench=[...bench,...replacedStarters].filter((player,index,all)=>!effectiveIds.has(String(player.id)) && all.findIndex(p=>String(p.id)===String(player.id))===index);
      if($runtime.$(benchContainerId)){
        $runtime.$(benchContainerId).innerHTML=orderedBench.map(player=>{
          const replacement=Array.isArray(effectivePerformances)?effectivePerformances.find(p=>String(p.replacedPlayerId||'')===String(player.id)):null;
          const replacedPerformance=replacement?{noVote:true,lineupSource:'replaced',replacementName:(manager.roster||[]).find(p=>String(p.id)===String(replacement.playerId))?.name}:null;
          const row=livePlayerRow(player,true,replacedPerformance);
          if(row.hasPlayed && row.vote!=='—') benchWithVote++;
          return row.html;
        }).join('');
      }

      if($runtime.$(countId)) $runtime.$(countId).textContent=Array.isArray(effectivePerformances)
        ? `${effectivePerformances.filter(p=>!p.noVote).length}/11 CON VOTO`
        : `${starterLiveCount}/11 LIVE`;
      if($runtime.$(benchCountId)) $runtime.$(benchCountId).textContent=`${benchWithVote}/${orderedBench.length} CON VOTO`;
      if($runtime.$(teamLabelId)) $runtime.$(teamLabelId).textContent=manager.team||'—';
    };

    if(ctx){
      renderLiveFantasySide(ctx.user,ctx.userPlayers,ctx.userBench,'serieAUserPlayers','serieAUserBench','serieAUserLiveCount','serieAUserBenchCount','serieAUserTeamLabel',finalUserPerformances);
      renderLiveFantasySide(ctx.opp,ctx.oppPlayers,ctx.oppBench,'serieAOppPlayers','serieAOppBench','serieAOppLiveCount','serieAOppBenchCount','serieAOppTeamLabel',finalOpponentPerformances);
    }

    const emptyText=phase==='bigmatch'
      ? 'Big Match iniziato. Qui compaiono solo eventi che coinvolgono giocatori della tua partita fantasy.'
      : phase==='between'
        ? 'Le 9 partite sono terminate. Preparati al Big Match.'
        : 'Nessun evento finora per i giocatori della tua partita fantasy.';
    $runtime.$('serieANewsFeed').innerHTML=$runtime.serieALive.feed.length?$runtime.serieALive.feed.map(item=>{
      const player=$runtime.playerMap.get(String(item.playerId||''));
      return `<div class="seriea-feed-item type-${item.type}"><b>${item.minute}'</b><i class="seriea-feed-avatar">${player?$runtime.playerAvatarMarkup(player,''):''}</i><span>${$runtime.escapeHtml(item.text)}</span></div>`;
    }).join(''):`<div class="seriea-feed-empty">${$runtime.escapeHtml(emptyText)}</div>`;
  }

  function tickSerieALive(){
    if(!$runtime.serieALive || $runtime.serieALive.phase==='between' || $runtime.serieALive.manualPaused) return;
    if($runtime.serieALive.autoPauseUntil && Date.now()<$runtime.serieALive.autoPauseUntil) return;
    if($runtime.serieALive.autoPauseUntil && Date.now()>=$runtime.serieALive.autoPauseUntil){
      $runtime.serieALive.autoPauseUntil=0;
      $runtime.hideSerieATvBanner();
    }

    $runtime.serieALive.minute=Math.min(90,$runtime.serieALive.minute+1);
    const events=$runtime.serieALive.phaseEvents||[];

    while($runtime.serieALive.eventIndex<events.length && events[$runtime.serieALive.eventIndex].minute<=$runtime.serieALive.minute){
      const event=events[$runtime.serieALive.eventIndex];
      $runtime.applySerieAEvent(event);
      $runtime.serieALive.eventIndex++;

      if($runtime.triggerSerieATvPresentation(event)){
        $runtime.renderSerieALive();
        return;
      }
    }

    if($runtime.serieALive.minute>=90) $runtime.finalizeSerieAPhaseRatings();
    if($runtime.serieALive.minute<90 && $runtime.serieALive.minute%5===0) $runtime.saveState();
    $runtime.renderSerieALive();

    if($runtime.serieALive.minute>=90){
      if($runtime.serieALive.phase==='multilive') $runtime.finishSerieAMultiLivePhase();
      else {
        if($runtime.serieALive.timer){clearInterval($runtime.serieALive.timer);$runtime.serieALive.timer=null;}
        window.setTimeout($runtime.finalizeSerieALiveMatchday,850);
      }
    }
  }

  function simulateFullMatchdayDirectly(){
    const season=$runtime.ensureSeasonState();
    if(!season || season.completed || $runtime.weekendArrivalLoading) return;
    const day=season.currentMatchday||1;
    const round=season.schedule?.[day-1];
    const flow=$runtime.ensureMatchdayFlowEntry(season,day);
    const savedLineup=season.lineups?.[String(day)]?.user;
    if(!round || round.matches?.every(m=>m.played) || flow?.phase!=='match_ready' || !savedLineup?.confirmed || season.pendingBigMatch?.day===day) return;

    if($runtime.showOpponentMalusNotice(day)) return;
    const lineups=$runtime.ensureCpuLineupsForDay(day);
    if(!lineups?.user?.confirmed){$runtime.requestOpenLineup();return;}

    $runtime.setMatchdayFlowPhase(season,day,'live',{liveStartedAt:Date.now(),directSimulation:true});
    season.dayPhase='match';
    $runtime.saveState();

    const built=$runtime.buildSerieADay(day);
    if(!built) return;
    if($runtime.serieALive?.timer) clearInterval($runtime.serieALive.timer);

    $runtime.serieALive={
      ...built,
      phase:'multilive',
      phaseEvents:built.mainEvents,
      minute:90,
      eventIndex:0,
      feed:[],
      allFeed:[],
      timer:null,
      lineups,
      speed:1,
      manualPaused:true,
      autoPauseUntil:0,
      tvToken:0,
      voteFlashes:new Map()
    };

    // 9 partite della Diretta Gol.
    while($runtime.serieALive.eventIndex<$runtime.serieALive.phaseEvents.length){
      $runtime.applySerieAEvent($runtime.serieALive.phaseEvents[$runtime.serieALive.eventIndex]);
      $runtime.serieALive.eventIndex++;
    }
    $runtime.finalizeSerieAPhaseRatings();

    // Big Match, subito dopo e senza passaggio intermedio.
    $runtime.serieALive.phase='bigmatch';
    $runtime.serieALive.phaseEvents=built.bigMatchEvents;
    $runtime.serieALive.minute=90;
    $runtime.serieALive.eventIndex=0;
    while($runtime.serieALive.eventIndex<$runtime.serieALive.phaseEvents.length){
      $runtime.applySerieAEvent($runtime.serieALive.phaseEvents[$runtime.serieALive.eventIndex]);
      $runtime.serieALive.eventIndex++;
    }
    $runtime.finalizeSerieAPhaseRatings();

    $runtime.finalizeSerieALiveMatchday({directToResult:true});
  }

  function startSerieALiveMatchday(){
    $runtime.serieAMatchesExpanded=true;
    const season=$runtime.ensureSeasonState(); if(!season || season.completed) return;
    if(season.pendingBigMatch?.snapshot){
      $runtime.renderSeasonDashboard();
      $runtime.showToast('Prima devi giocare il Big Match in attesa.');
      return;
    }
    const day=season.currentMatchday;
    const round=season.schedule[day-1];
    if(!round || round.matches.every(m=>m.played)) return;
    const flow=$runtime.ensureMatchdayFlowEntry(season,day);
    if(flow?.phase!=='match_ready'){
      $runtime.renderSeasonDashboard();
      $runtime.showToast('Premi CONTINUA e completa l’eventuale scelta prima della Diretta Gol.');
      return;
    }
    const lineups=$runtime.ensureCpuLineupsForDay(day);
    if(!lineups?.user?.confirmed){$runtime.requestOpenLineup();return;}
    $runtime.setMatchdayFlowPhase(season,day,'live',{liveStartedAt:Date.now()});
    season.dayPhase='match';
    $runtime.saveState();
    const built=$runtime.buildSerieADay(day); if(!built) return;
    if($runtime.serieALive?.timer) clearInterval($runtime.serieALive.timer);
    $runtime.serieALive={
      ...built,
      phase:'multilive',
      phaseEvents:built.mainEvents,
      minute:0,
      eventIndex:0,
      feed:[],
      allFeed:[],
      timer:null,
      lineups,
      speed:1,
      manualPaused:false,
      autoPauseUntil:0,
      tvToken:0,
      voteFlashes:new Map()
    };
    $runtime.saveState();
    $runtime.showScreen('serieALiveScreen');
    $runtime.renderSerieALive();
    $runtime.restartSerieALiveTimer();
  }

  function skipSerieALive(){
    if(!$runtime.serieALive) return;
    if($runtime.serieALive.reviewComplete){
      const day=$runtime.serieALive.day;
      $runtime.serieALive=null;
      const season=$runtime.ensureSeasonState();
      if(season) season.activeLive=null;
      $runtime.saveState();
      $runtime.renderMatchdayResult(day);
      return;
    }
    if($runtime.serieALive.phase==='between'){
      $runtime.startPendingBigMatchFromHub();
      return;
    }
    if($runtime.serieALive.timer){clearInterval($runtime.serieALive.timer);$runtime.serieALive.timer=null;}
    $runtime.serieALive.manualPaused=false;
    $runtime.serieALive.autoPauseUntil=0;
    $runtime.serieALive.tvToken=($runtime.serieALive.tvToken||0)+1;
    $runtime.hideSerieATvBanner();
    $runtime.serieALive.minute=90;
    const events=$runtime.serieALive.phaseEvents||[];
    while($runtime.serieALive.eventIndex<events.length){
      $runtime.applySerieAEvent(events[$runtime.serieALive.eventIndex]);
      $runtime.serieALive.eventIndex++;
    }
    $runtime.finalizeSerieAPhaseRatings();
    $runtime.renderSerieALive();
    if($runtime.serieALive.phase==='multilive') window.setTimeout($runtime.finishSerieAMultiLivePhase,260);
    else window.setTimeout($runtime.finalizeSerieALiveMatchday,260);
  }

  function startPendingBigMatchFromHub(){
    const season=$runtime.ensureSeasonState();
    if(!season) return;

    const pending=season.pendingBigMatch;
    let snapshot=null;

    // Flusso normale: passaggio diretto dalla Diretta Gol al Big Match
    // senza mai tornare in Dashboard.
    if($runtime.serieALive?.phase==='between'){
      snapshot=$runtime.snapshotSerieALive($runtime.serieALive);
    } else if(!$runtime.serieALive && pending?.snapshot){
      // Fallback per vecchi salvataggi o resume.
      snapshot=pending.snapshot;
    } else {
      return;
    }

    $runtime.serieALive=$runtime.hydrateSerieALive(snapshot,'bigmatch');
    season.pendingBigMatch=null;
    season.activeLive=$runtime.snapshotSerieALive($runtime.serieALive);
    $runtime.saveState();

    $runtime.showScreen('serieALiveScreen');
    $runtime.renderSerieALive();
    $runtime.restartSerieALiveTimer();
  }
    return Object.freeze({ensureCpuLineupsForDay,serieALiveTickBase,serieALiveTickDelay,restartSerieALiveTimer,setSerieALiveSpeed,toggleSerieALivePause,jumpToNextSerieAEvent,renderSerieALiveSpeedControls,serieAEventFantasySide,captureWatchedVoteSnapshot,updateWatchedVoteFlashes,tvEventClass,tvFinalTitle,tvEventDetail,tvFantasyFocus,animateMatchParticles,setSerieATvBanner,hideSerieATvBanner,triggerSerieATvPresentation,eventHeadline,serieALiveFantasyContext,serieAEventTouchesFantasyMatch,fantasyFocusedEventHeadline,applySerieAEvent,serieABigMatch,isBigMatchClub,serieAMinuteForPlayer,serieALiveSnapshotForManager,startSerieABigMatchPhase,snapshotSerieALive,hydrateSerieALive,finishSerieAMultiLivePhase,fantasyLiveSnapshot,setSerieAMatchesExpanded,renderSerieALive,tickSerieALive,simulateFullMatchdayDirectly,startSerieALiveMatchday,skipSerieALive,startPendingBigMatchFromHub});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['live-controller']=Object.freeze({create});
})();
