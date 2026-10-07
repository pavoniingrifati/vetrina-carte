/* Responsibility: result-controller. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: result-controller');
  function finalizeSerieALiveMatchday({directToResult=false}={}){
    if(!$runtime.serieALive || $runtime.serieALive.finalizing) return;
    if($runtime.serieALive.phase!=='bigmatch') return;
    $runtime.serieALive.finalizing=true;
    const season=$runtime.ensureSeasonState(); if(!season) return;
    const day=$runtime.serieALive.day, round=season.schedule[day-1], lineups=$runtime.serieALive.lineups;
    if(!round || season.matchdayResults[String(day)]) {
      if($runtime.serieALive.timer) clearInterval($runtime.serieALive.timer);
      $runtime.serieALive=null;
      season.activeLive=null;
      $runtime.renderSeasonDashboard();
      return;
    }
    season.pendingBigMatch=null;
    season.activeLive=null;
    const preDayStandings=season.standings.map(row=>({...row}));
    const dayResult={
      day,
      matches:[],
      createdAt:Date.now(),
      formationChoice:$runtime.activeFormationChoice(day)?JSON.parse(JSON.stringify($runtime.activeFormationChoice(day))):null,
      userBenchIds:(lineups?.user?.bench||[]).map(String)
    };
    round.matches.forEach(match=>{
      const hm=$runtime.managerById(match.homeId), am=$runtime.managerById(match.awayId);
      const hs=$runtime.simulateFantasyTeamFromSerieA(hm,lineups[match.homeId],$runtime.serieALive.perfMap,90);
      const as=$runtime.simulateFantasyTeamFromSerieA(am,lineups[match.awayId],$runtime.serieALive.perfMap,90);
      match.homeScore=hs.fantasyGoals; match.awayScore=as.fantasyGoals; match.played=true;
      match.homeFantasy=hs.fantasyPoints; match.awayFantasy=as.fantasyPoints;
      const detail={
        homeId:match.homeId,awayId:match.awayId,homeScore:match.homeScore,awayScore:match.awayScore,
        homeFantasy:hs.fantasyPoints,awayFantasy:as.fantasyPoints,homeTeam:hm.team,awayTeam:am.team,
        homePerformances:hs.performances,awayPerformances:as.performances,
        homeSubstitutions:hs.substitutions||[],awaySubstitutions:as.substitutions||[],
        homeSubsUsed:hs.subsUsed||0,awaySubsUsed:as.subsUsed||0,
        homeDefenseModifierBonus:Number(hs.defenseModifierBonus||0),awayDefenseModifierBonus:Number(as.defenseModifierBonus||0),
        homeDefenseModifierAverage:hs.defenseModifierAverage??null,awayDefenseModifierAverage:as.defenseModifierAverage??null
      };
      dayResult.matches.push(detail); $runtime.updateStandingsFromMatch(match);
    });
    $runtime.updateSerieASeasonWorld(day,$runtime.serieALive);

    season.serieAResults[String(day)]={
      day,
      matches:$runtime.serieALive.matches.map(m=>({
        homeClub:m.homeClub,awayClub:m.awayClub,homeScore:m.homeScore,awayScore:m.awayScore,
        homeFormation:m.homeFormation,awayFormation:m.awayFormation,
        scorers:(m.scorers||[]).map(s=>({...s}))
      })),
      events:($runtime.serieALive.allFeed||$runtime.serieALive.feed).slice().reverse()
    };
    season.matchdayResults[String(day)]=dayResult;
    $runtime.grantMatchdayFantapoints(season,day,dayResult);
    season.lastCompletedMatchday=day;
    const sponsorWinReward=$runtime.grantWinSponsorReward(season,day,dayResult);
    const sponsorBigMatchReward=$runtime.grantBigMatchSponsorReward(season,day,dayResult,preDayStandings);
    const sponsorStreakReward=$runtime.grantStreakSponsorReward(season,day,dayResult);
    const sponsorMidseasonReward=$runtime.CareerEngine.grantMidseasonSponsorBonus($runtime.ensureCareerEconomy(),season,day,$runtime.sortedStandings());
    $runtime.generatePostMatchNews(day,dayResult,$runtime.serieALive);
    $runtime.setMatchdayFlowPhase(season,day,'completed',{completedAt:Date.now()});
    season.dayPhase='ready';
    if(day>=$runtime.FANTASY_SEASON_MATCHDAYS) { season.completed=true; $runtime.grantSeasonPrizeIfNeeded(season); $runtime.grantFutureAuctionSponsorBonus(season); }
    else {
      season.currentMatchday=day+1;
      $runtime.ensureMatchdayFlowEntry(season,season.currentMatchday);
      $runtime.seedAssistantCoachLineupForDay(season.currentMatchday,season);
    }
    $runtime.activateWinterTransferWindowIfNeeded();
    if($runtime.serieALive.timer) clearInterval($runtime.serieALive.timer);
    $runtime.serieALive.timer=null;
    $runtime.serieALive.minute=90;
    $runtime.serieALive.manualPaused=true;
    $runtime.serieALive.autoPauseUntil=0;
    $runtime.serieALive.reviewComplete=true;
    $runtime.serieALive.finalizing=false;
    const sponsorRewards=[];
    if(sponsorWinReward) sponsorRewards.push(`+${sponsorWinReward} € vittoria`);
    if(sponsorBigMatchReward) sponsorRewards.push(`+${sponsorBigMatchReward} € Big Match`);
    if(sponsorStreakReward) sponsorRewards.push(`+${sponsorStreakReward} € Serie Positiva`);
    if(sponsorMidseasonReward) sponsorRewards.push(`+${sponsorMidseasonReward} € Amauri · Top 2 G19`);

    $runtime.hideSerieATvBanner();
    if(directToResult){
      season.activeLive=null;
      const completedDay=day;
      $runtime.serieALive=null;
      $runtime.saveState();
      $runtime.renderMatchdayResult(completedDay);
      $runtime.showToast(sponsorRewards.length
        ? `Giornata simulata · Sponsor: ${sponsorRewards.join(' · ')}.`
        : 'Giornata simulata.');
      return;
    }

    season.activeLive=$runtime.snapshotSerieALive($runtime.serieALive);
    $runtime.saveState();
    $runtime.showScreen('serieALiveScreen');
    $runtime.renderSerieALive();
    $runtime.showToast(sponsorRewards.length?`Giornata conclusa · Sponsor: ${sponsorRewards.join(' · ')}. Controlla la Diretta Gol e poi premi VEDI RISULTATO.`:'Giornata conclusa. Controlla la Diretta Gol e poi premi VEDI RISULTATO.');
  }

  function renderMatchdayResult(day) {
    const season=$runtime.ensureSeasonState();
    const result=season?.matchdayResults?.[String(day)]; if(!result) return $runtime.renderSeasonDashboard();
    const match=result.matches.find(m=>m.homeId==='user'||m.awayId==='user'); if(!match) return $runtime.renderSeasonDashboard();
    const userHome=match.homeId==='user';
    const userScore=userHome?match.homeScore:match.awayScore, oppScore=userHome?match.awayScore:match.homeScore;
    const userFantasy=userHome?match.homeFantasy:match.awayFantasy, oppFantasy=userHome?match.awayFantasy:match.homeFantasy;
    const userPerf=userHome?match.homePerformances:match.awayPerformances;
    const userSubs=userHome?(match.homeSubstitutions||[]):(match.awaySubstitutions||[]);
    const userDefenseModifier=Number(userHome?match.homeDefenseModifierBonus:match.awayDefenseModifierBonus)||0;
    const opponentTeam=userHome?match.awayTeam:match.homeTeam;
    $runtime.showScreen('matchdayResultScreen');
    $runtime.$('resultMatchdayNo').textContent=day;
    $runtime.$('resultTitle').textContent=`${$runtime.state.teamName} ${userScore} - ${oppScore} ${opponentTeam}`;
    $runtime.$('resultSubtitle').textContent=`${userFantasy.toFixed(1)} fantapunti contro ${oppFantasy.toFixed(1)} · voti generati dalla giornata Serie A${userDefenseModifier>0?` · Mod. difesa +${userDefenseModifier}`:''}`;
    if($runtime.$('resultFantasyRulesSummary')) $runtime.$('resultFantasyRulesSummary').textContent=`Gol +3 · Assist +1 · Amm. -0,5 (doppio giallo -1) · Esp. diretta -1 · Autogol -2 · Rigore sbagliato -3 · Rigore parato +3 · Gol subito P -1 · ${$runtime.leagueRulesSummary($runtime.state)}`;
    $runtime.$('resultUserTeam').textContent=$runtime.state.teamName; $runtime.$('resultOpponentTeam').textContent=opponentTeam;
    $runtime.$('resultUserFantasy').textContent=`${userFantasy.toFixed(1)} pt`; $runtime.$('resultOpponentFantasy').textContent=`${oppFantasy.toFixed(1)} pt`;
    $runtime.$('resultScore').textContent=`${userScore} - ${oppScore}`;
    $runtime.$('resultOutcome').textContent=userScore>oppScore?'VITTORIA':userScore<oppScore?'SCONFITTA':'PAREGGIO';
    $runtime.$('resultOutcome').className=userScore>oppScore?'win':userScore<oppScore?'loss':'draw';
    const scoreboard=$runtime.$('resultScore').closest('.result-scoreboard');
    scoreboard.dataset.outcome=userScore>oppScore?'win':userScore<oppScore?'loss':'draw';
    scoreboard.querySelectorAll('.result-team-emblem,.result-coach-portrait').forEach(node=>node.remove());
    for(const [id,managerId] of [['resultUserTeam','user'],['resultOpponentTeam',userHome?match.awayId:match.homeId]]){
      const portrait=document.createElement('span');
      portrait.className='result-coach-portrait';portrait.id=`${id}Portrait`;
      $runtime.$(id).parentElement.prepend(portrait);
      const manager=$runtime.managerById(managerId);
      $runtime.renderFixtureCoachPortrait(portrait.id,manager,$runtime.seasonFixtureTheme(manager,managerId==='user'));
    }
    $runtime.renderCareerWallets();
    if($runtime.$('resultContinueBtn')) $runtime.$('resultContinueBtn').textContent=day>=$runtime.FANTASY_SEASON_MATCHDAYS?'TORNA ALLA DASHBOARD':'CONTINUA';
    $runtime.renderMatchdayFantapointsReward(result);
    if($runtime.$('resultCareerPrize')){ const prize=season.careerPrize; $runtime.$('resultCareerPrize').style.display=(day>=$runtime.FANTASY_SEASON_MATCHDAYS&&prize)?'flex':'none'; if(day>=$runtime.FANTASY_SEASON_MATCHDAYS&&prize){ $runtime.$('resultCareerPrize').innerHTML=`<span>FINE STAGIONE · ${prize.position}° POSTO</span><strong>${prize.amount>0?`+${prize.amount} €`:'NESSUN PREMIO'}</strong><small>Saldo carriera: ${$runtime.careerEuros()} €</small>`; } }
    const ro={P:0,D:1,C:2,A:3};
    if($runtime.$('resultSubstitutions')){
      $runtime.$('resultSubstitutions').innerHTML=userSubs.length
        ? `<strong>${userSubs.length} sostituzion${userSubs.length===1?'e':'i'}</strong>${userSubs.map(s=>`<span><i class="lineup-role-chip role-${s.role}">${s.role}</i>${$runtime.escapeHtml(s.outPlayerName)} <b>→</b> ${$runtime.escapeHtml(s.inPlayerName)}</span>`).join('')}`
        : `<strong>0 sostituzioni</strong><span>${userPerf.some(p=>p.noVote)?'Restano giocatori senza voto: nessun sostituto utilizzabile.':'Tutti gli 11 titolari hanno portato voto.'}</span>`;
    }
    $runtime.$('resultRatingsBody').innerHTML=userPerf.slice().sort((a,b)=>ro[a.role]-ro[b.role]).map(p=>`<tr class="${p.noVote?'no-vote-row':''} ${p.lineupSource==='substitute'?'substitute-row':''}"><td><span class="lineup-role-chip role-${p.role}">${p.role}</span></td><td><strong>${$runtime.escapeHtml(p.name)}</strong><small>${$runtime.escapeHtml($runtime.clubShort(p.club))}${p.lineupSource==='substitute'&&p.replacedPlayerName?` · ↳ per ${$runtime.escapeHtml(p.replacedPlayerName)}`:''}</small></td><td>${p.noVote?'SV':p.vote.toFixed(1)}</td><td>${$runtime.escapeHtml($runtime.performanceText(p))}</td><td><b>${p.noVote?'—':p.fantasy.toFixed(1)}</b></td></tr>`).join('');
    $runtime.$('resultTotalFantasy').textContent=userFantasy.toFixed(1);
    $runtime.$('resultOtherMatches').innerHTML=result.matches.filter(m=>m!==match).map(m=>`<div class="result-other-row"><span>${$runtime.escapeHtml(m.homeTeam)}</span><b>${m.homeScore} - ${m.awayScore}</b><span>${$runtime.escapeHtml(m.awayTeam)}</span><small>${m.homeFantasy.toFixed(1)} - ${m.awayFantasy.toFixed(1)} pt</small></div>`).join('');
  }

  function closeMatchdayFantapointsReward(){
    const modal=$runtime.$('matchdayRewardModal');
    if(!modal) return;
    modal.dataset.animationToken='';
    modal.classList.remove('show','is-awarding');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('matchday-reward-open');
  }

  function animateMatchdayRewardNumber(from,to,duration,onValue,isCurrent){
    return new Promise(resolve=>{
      if(duration<=0){onValue(to);resolve();return;}
      const started=performance.now();
      const tick=now=>{
        if(isCurrent && !isCurrent()){resolve();return;}
        const progress=Math.min(1,(now-started)/duration);
        const eased=1-Math.pow(1-progress,3);
        onValue(Math.round(from+(to-from)*eased));
        if(progress<1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  function renderMatchdayFantapointsReward(result){
    const reward=result?.fantapointsReward;
    const modal=$runtime.$('matchdayRewardModal');
    if(!modal||!reward){$runtime.closeMatchdayFantapointsReward();return;}
    const parts=reward.parts||{};
    const rows=[
      ['Partita disputata',parts.participation],
      [parts.outcome===8?'Vittoria':parts.outcome===3?'Pareggio':'Risultato',parts.outcome],
      [`${Number(parts.goals||0)/2} gol fantasy`,parts.goals],
      ['Porta inviolata',parts.cleanSheet],
      ['Bonus Fantapoteri',parts.powers],
      ['Sponsor McTominasy’s',parts.sponsor]
    ].filter(([,value])=>Number(value)>0);
    $runtime.$('resultFantapointsBreakdown').innerHTML=rows.map(([label,value],index)=>`<span class="matchday-reward-row" data-reward-row="${index}" data-reward-target="${Number(value)}"><small>${$runtime.escapeHtml(label)}</small><b>+<i>0</i> FP</b></span>`).join('');
    const earned=$runtime.$('resultFantapointsEarned'),balance=$runtime.$('resultFantapointsBalance');
    const continueBtn=$runtime.$('resultFantapointsContinueBtn');
    const animate=!result.fantapointsPresented;
    const total=Number(reward.total||0),before=Number(reward.balanceBefore||0),after=Number(reward.balanceAfter||0);
    if(earned) earned.textContent=animate?'0':String(total);
    if(balance) balance.textContent=String(animate?before:after);
    if(animate) document.querySelectorAll('[data-fantapoints-value]').forEach(el=>el.textContent=String(before));
    if(!animate){$runtime.closeMatchdayFantapointsReward();return;}

    modal.classList.add('show','is-awarding');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('matchday-reward-open');
    if(continueBtn) continueBtn.disabled=true;
    result.fantapointsPresented=true;
    $runtime.saveState();

    const token=`reward-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    modal.dataset.animationToken=token;
    const isCurrent=()=>modal.dataset.animationToken===token && modal.classList.contains('show');
    const delay=ms=>new Promise(resolve=>window.setTimeout(resolve,ms));
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    (async()=>{
      let accumulated=0;
      const rowEls=[...modal.querySelectorAll('[data-reward-row]')];
      for(const row of rowEls){
        if(!isCurrent()) return;
        const target=Number(row.dataset.rewardTarget||0);
        const valueEl=row.querySelector('b i');
        row.classList.add('is-active');
        await $runtime.animateMatchdayRewardNumber(0,target,reduced?0:520,value=>{
          if(valueEl) valueEl.textContent=String(value);
          if(earned) earned.textContent=String(accumulated+value);
        },isCurrent);
        if(!isCurrent()) return;
        accumulated+=target;
        if(earned) earned.textContent=String(accumulated);
        row.classList.remove('is-active');
        row.classList.add('is-complete');
        if(!reduced) await delay(180);
      }

      if(!isCurrent()) return;
      modal.classList.add('is-balance-awarding');
      if(after>before) $runtime.animateMatchParticles(modal.querySelector('.matchday-reward-dialog'),earned,balance);
      await $runtime.animateMatchdayRewardNumber(before,after,reduced?0:850,value=>{
        if(balance) balance.textContent=String(value);
        document.querySelectorAll('[data-fantapoints-value]').forEach(el=>el.textContent=String(value));
      },isCurrent);
      if(!isCurrent()) return;
      if(balance) balance.textContent=String(after);
      document.querySelectorAll('[data-fantapoints-value]').forEach(el=>el.textContent=String(after));
      modal.classList.remove('is-awarding','is-balance-awarding');
      if(continueBtn){
        continueBtn.disabled=false;
        continueBtn.focus();
      }
    })();
  }
    return Object.freeze({finalizeSerieALiveMatchday,renderMatchdayResult,closeMatchdayFantapointsReward,animateMatchdayRewardNumber,renderMatchdayFantapointsReward});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['result-controller']=Object.freeze({create});
})();
