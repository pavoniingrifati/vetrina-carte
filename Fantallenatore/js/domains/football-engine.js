/* Domain service: football-engine. No DOM, timers, or persistence; state accessors remain live. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: football-engine');
  function halfPoint(value) { return Math.round(value * 2) / 2; }

  function serieAFixtureCompactText(player,day=$runtime.ensureSeasonState()?.currentMatchday||1){
    const fixture=$runtime.serieAFixtureForPlayer(player,day);
    if(!fixture) return 'Serie A: —';
    return `vs ${fixture.opponentShort} · ${fixture.home?'CASA':'TRASF.'}`;
  }

  function serieAFixtureFullText(player,day=$runtime.ensureSeasonState()?.currentMatchday||1){
    const fixture=$runtime.serieAFixtureForPlayer(player,day);
    if(!fixture) return 'Avversario Serie A non disponibile';
    return `vs ${fixture.opponentName} · ${fixture.venue}`;
  }

  function serieAMatchupBadgeHtml(player,day=$runtime.ensureSeasonState()?.currentMatchday||1){
    const info=$runtime.serieAMatchupDifficulty(player,day);
    if(!info) return '';
    return `<span class="seriea-matchup-badge ${info.key}" title="FantaData Pro · avversario ${$runtime.escapeHtml(info.opponentName)} · ${info.venue}">${info.icon} ${info.label}</span>`;
  }

  function baseLivePerformance(item,day,clubId){
    const p=item.player, ovr=$runtime.currentPlayerOvr(p);
    const quality=$runtime.clamp((ovr-75)/20,-1,1);
    const noise=($runtime.seededSerieRand(day,`${clubId}|basevote|${p.id}`)-.5)*.78;
    const matchFeel=($runtime.seededSerieRand(day,`${clubId}|matchfeel|${p.id}`)-.5)*.32;
    const voteEffect=$runtime.formationPlayerModifier(day,p.id,'player_vote');
    const worldEffect=$runtime.worldPlayerModifier(day,p.id);
    const socialMotivation=$runtime.socialMotivationForPlayer(p.id,day);
    const socialMotivationDelta=Number(socialMotivation?.voteDelta||0);
    const lockerDelta=lockerVoteModifier(day,p.id);
    const injuryRisk=$runtime.formationPlayerModifier(day,p.id,'risk_injury');
    const base=Number(injuryRisk?.voteDelta||0)+$runtime.clamp($runtime.clamp(6 + quality*.16 + noise + matchFeel + Number(voteEffect?.delta||0) + Number(worldEffect?.voteDelta||0) + socialMotivationDelta,4.75,7.25) + lockerDelta,4,8);
    return {
      day,
      playerId:String(p.id),name:p.name,role:p.role,club:p.club,entryMinute:item.entryMinute,
      plannedExitMinute:item.plannedExitMinute||90,
      starter:item.starter,baseVote:base,liveVote:base,startingVoteBonus:Number(injuryRisk?.voteDelta||0),goals:0,assists:0,yellow:0,red:0,
      ownGoal:0,missedPenalty:0,savedPenalty:0,goalsConceded:0,injury:false,injuryMinute:null,
      ratingsFinalized:false,
      socialMotivationDelta,
      socialMotivationOutcome:socialMotivation?.outcome||null
    };
  }

  function lockerVoteModifier(day,playerId){
    const id=String(playerId),season=$runtime.ensureSeasonState();
    const starters=Object.values(season?.lineups?.[String(day)]?.user?.starters||{}).map(String);
    const choice=$runtime.activeFormationChoice(day);
    const effect=choice?.effect||{};
    let delta=0;
    if(effect.kind==='locker_vote' && String(effect.targetPlayerId)===id && starters.includes(id)) delta+=Number(effect.delta||0);
    if(effect.kind==='locker_team' && starters.includes(id)){
      const captainReady=!!effect.role || starters.includes(String(season?.lineups?.[String(day)]?.user?.captainId||''));
      const candidates=starters.filter(candidate=>!effect.role || $runtime.playerMap.get(candidate)?.role===effect.role)
        .sort((a,b)=>$runtime.careerHash(`locker-team|${day}|${a}`)-$runtime.careerHash(`locker-team|${day}|${b}`));
      if(captainReady && candidates.slice(0,Number(effect.maxPlayers||3)).includes(id)) delta+=Number(effect.delta||0);
    }
    const yesterday=$runtime.activeFormationChoice(Number(day)-1)?.effect;
    if(yesterday?.kind==='locker_vote' && yesterday.nextDayPenalty && String(yesterday.targetPlayerId)===id){
      const priorResult=season?.matchdayResults?.[String(day-1)];
      const priorMatch=(priorResult?.matches||[]).find(m=>m.homeId==='user'||m.awayId==='user');
      const priorPerfs=priorMatch?(priorMatch.homeId==='user'?priorMatch.homePerformances:priorMatch.awayPerformances):[];
      const appeared=(priorPerfs||[]).some(p=>String(p.playerId)===id && p.lineupSource==='starter');
      if(priorMatch && !appeared) delta+=Number(yesterday.nextDayPenalty);
    }
    return delta;
  }

  function participantWeight(perf,kind='goal'){
    const role=perf.role;
    let weight;
    if(kind==='assist') weight=({P:.05,D:.8,C:2.6,A:2.2}[role]||1) * (.65+$runtime.currentPlayerOvr($runtime.playerMap.get(perf.playerId))/100);
    else if(kind==='card') weight=({P:.35,D:2.4,C:1.8,A:1.1}[role]||1);
    else weight=({P:.03,D:.55,C:1.7,A:4.2}[role]||1) * (.55+$runtime.currentPlayerOvr($runtime.playerMap.get(perf.playerId))/100);

    const day=perf.day||$runtime.state?.season?.currentMatchday;
    const effect=$runtime.formationPlayerModifier(day,perf.playerId,kind==='assist'?'assist_weight':kind==='goal'?'goal_weight':'');
    if(effect?.multiplier) weight*=Number(effect.multiplier);
    const worldEffect=$runtime.worldPlayerModifier(day,perf.playerId);
    if(kind==='goal' && worldEffect?.goalMultiplier) weight*=Number(worldEffect.goalMultiplier);
    else if(kind==='assist' && worldEffect?.assistMultiplier) weight*=Number(worldEffect.assistMultiplier);
    else if(kind==='card' && worldEffect?.cardMultiplier) weight*=Number(worldEffect.cardMultiplier);
    return weight;
  }

  function weightedPerformancePick(list,day,key,kind='goal'){
    if(!list.length) return null;
    const weights=list.map(p=>Math.max(.01,participantWeight(p,kind)));
    const total=weights.reduce((a,b)=>a+b,0);
    let target=$runtime.seededSerieRand(day,key)*total;
    for(let i=0;i<list.length;i++){target-=weights[i];if(target<=0)return list[i];}
    return list[list.length-1];
  }

  function activePerformances(perfs,minute){
    return perfs.filter(p=>p.entryMinute<=minute && (!p.plannedExitMinute || minute<=p.plannedExitMinute));
  }

  function serieAGoalProbability(ownProfile,oppProfile,isHome=false){
    const own=ownProfile||{attack:72,control:72,activeCount:11};
    const opp=oppProfile||{defense:72,control:72,activeCount:11};
    const attackingForce=Number(own.attack||72)*.72+Number(own.control||72)*.28;
    const resistingForce=Number(opp.defense||72)*.78+Number(opp.control||72)*.22;
    const diff=attackingForce-resistingForce;
    const extra=Math.max(0,Math.abs(diff)-4)*.00008*Math.sign(diff||0);
    const qualityEffect=diff*.00055+extra;
    const numericalEdge=(Number(own.activeCount||11)-Number(opp.activeCount||11))*.00035;
    const homeEffect=isHome?.0016:0;
    return $runtime.clamp(.0132+qualityEffect+numericalEdge+homeEffect,.0032,.033);
  }

  function buildSerieAMatch(day,idx,spec){
    const homeSel=$runtime.buildSerieAClubSelection(spec.homeClub,day);
    const awaySel=$runtime.buildSerieAClubSelection(spec.awayClub,day);
    const homePerfs=homeSel.participants.map(x=>baseLivePerformance(x,day,spec.homeClub));
    const awayPerfs=awaySel.participants.map(x=>baseLivePerformance(x,day,spec.awayClub));
    const perfMap=new Map([...homePerfs,...awayPerfs].map(p=>[p.playerId,p]));
    const events=[], redSeen=new Set(), injurySeen=new Set(), yellowCount=new Map();
    const subPlans={home:homeSel.substitutions.map(x=>({...x})),away:awaySel.substitutions.map(x=>({...x}))};

    const subCount=side=>subPlans[side].filter(x=>!x.cancelled).length;
    const cancelFutureSubFor=(side,playerId)=>{
      const plan=subPlans[side].find(s=>!s.cancelled && s.outPlayerId===String(playerId));
      if(!plan) return null;
      plan.cancelled=true;
      const incoming=perfMap.get(String(plan.inPlayerId));
      if(incoming) incoming.entryMinute=999;
      return plan;
    };
    const emergencyReplace=(side,hurt,minute)=>{
      const plans=subPlans[side];
      let existing=plans.find(s=>!s.cancelled && s.outPlayerId===hurt.playerId && s.minute>minute);
      if(existing){
        existing.minute=Math.min(89,minute+1);
        existing.reason='injury';
        const incoming=perfMap.get(String(existing.inPlayerId));
        if(incoming) incoming.entryMinute=existing.minute;
        hurt.plannedExitMinute=minute;
        return;
      }
      // Le sostituzioni reali di Serie A restano a cinque; la regola fantasy ne consente tre di default.
      if(subCount(side)>=5) return;
      const perfs=side==='home'?homePerfs:awayPerfs;
      const incoming=perfs.filter(p=>!p.starter && p.role===hurt.role && p.entryMinute>90 && !plans.some(s=>!s.cancelled&&s.inPlayerId===p.playerId))
        .sort((a,b)=>$runtime.currentPlayerOvr($runtime.playerMap.get(b.playerId))-$runtime.currentPlayerOvr($runtime.playerMap.get(a.playerId)))[0];
      if(!incoming) return;
      incoming.entryMinute=Math.min(89,minute+1);
      hurt.plannedExitMinute=minute;
      plans.push({
        outPlayerId:hurt.playerId,outPlayerName:hurt.name,inPlayerId:incoming.playerId,inPlayerName:incoming.name,
        role:hurt.role,minute:incoming.entryMinute,reason:'injury',cancelled:false
      });
    };

    const addGoal=(minute,team,penalty=false)=>{
      const own=team==='home'?homePerfs:awayPerfs;
      const opp=team==='home'?awayPerfs:homePerfs;
      const active=activePerformances(own,minute);
      const scorer=weightedPerformancePick(active,day,`${idx}|${minute}|${team}|scorer|${events.length}`,'goal');
      if(!scorer) return;
      let assist=null;
      if(!penalty && $runtime.seededSerieRand(day,`${idx}|${minute}|${team}|assistchance|${events.length}`)<.72){
        assist=weightedPerformancePick(active.filter(p=>p.playerId!==scorer.playerId),day,`${idx}|${minute}|${team}|assist|${events.length}`,'assist');
      }
      const keeper=activePerformances(opp,minute).find(p=>p.role==='P') || opp.find(p=>p.role==='P'&&p.entryMinute<=minute);
      events.push({minute,type:penalty?'penalty_goal':'goal',side:team,playerId:scorer.playerId,playerName:scorer.name,assistId:assist?.playerId||null,assistName:assist?.name||null,keeperId:keeper?.playerId||null});
    };

    const riskEffect=$runtime.activeFormationChoice(day)?.effect;
    const riskTarget=riskEffect?.kind==='risk_injury'?perfMap.get(String(riskEffect.targetPlayerId)):null;
    const riskFirst=Math.max(2,Number(riskTarget?.entryMinute||0));
    const riskLast=Math.min(89,Number(riskTarget?.plannedExitMinute||90));
    const riskMinute=riskTarget && riskFirst<=riskLast && $runtime.seededSerieRand(day,`risk-injury-outcome|${riskTarget.playerId}`)<.5
      ? riskFirst+Math.floor($runtime.seededSerieRand(day,`risk-injury-minute|${riskTarget.playerId}`)*(riskLast-riskFirst+1)):null;
    for(let minute=2;minute<=90;minute++){
      for(const team of ['home','away']){
        const own=team==='home'?homePerfs:awayPerfs;
        const opp=team==='home'?awayPerfs:homePerfs;
        // Ricalcolo minuto per minuto: sostituzioni, espulsioni e infortuni
        // modificano immediatamente la forza dei due reparti e quindi la chance gol.
        const ownProfile=$runtime.serieATeamUnitProfile(activePerformances(own,minute));
        const oppProfile=$runtime.serieATeamUnitProfile(activePerformances(opp,minute));
        const goalP=serieAGoalProbability(ownProfile,oppProfile,team==='home');
        const prefix=`${idx}|${minute}|${team}`;

        if($runtime.seededSerieRand(day,`${prefix}|penalty`)<.00145){
          const active=activePerformances(own,minute);
          const taker=weightedPerformancePick(active.filter(p=>p.role==='A'||p.role==='C'),day,`${prefix}|pentaker`,'goal') || weightedPerformancePick(active,day,`${prefix}|pentaker2`,'goal');
          if(taker){
            const keeper=activePerformances(opp,minute).find(p=>p.role==='P') || opp.find(p=>p.role==='P'&&p.entryMinute<=minute);
            const takerOvr=$runtime.currentPlayerOvr($runtime.playerMap.get(String(taker.playerId)));
            const keeperOvr=keeper?$runtime.currentPlayerOvr($runtime.playerMap.get(String(keeper.playerId))):72;
            const penaltyConversion=$runtime.clamp(.76+(takerOvr-keeperOvr)*.003,.64,.86);
            if($runtime.seededSerieRand(day,`${prefix}|penoutcome`)<penaltyConversion) {
              events.push({minute,type:'penalty_goal',side:team,playerId:taker.playerId,playerName:taker.name,assistId:null,assistName:null,keeperId:keeper?.playerId||null});
            } else {
              const saved=!!keeper && $runtime.seededSerieRand(day,`${prefix}|pensaved`)<$runtime.clamp(.68+(keeperOvr-takerOvr)*.004,.48,.82);
              events.push({minute,type:'penalty_miss',side:team,playerId:taker.playerId,playerName:taker.name,keeperId:saved?keeper.playerId:null,keeperName:saved?keeper.name:null});
            }
          }
        } else if($runtime.seededSerieRand(day,`${prefix}|goal`)<goalP) addGoal(minute,team,false);

        if($runtime.seededSerieRand(day,`${prefix}|yellow`)<.021){
          const active=activePerformances(own,minute);
          const booked=weightedPerformancePick(active,day,`${prefix}|yellowwho`,'card');
          if(booked){
            const yc=(yellowCount.get(booked.playerId)||0)+1; yellowCount.set(booked.playerId,yc);
            if(yc>=2 && !redSeen.has(booked.playerId)){
              redSeen.add(booked.playerId);
              booked.plannedExitMinute=Math.min(booked.plannedExitMinute||90,minute);
              cancelFutureSubFor(team,booked.playerId);
              events.push({minute,type:'red',side:team,playerId:booked.playerId,playerName:booked.name,secondYellow:true});
            } else events.push({minute,type:'yellow',side:team,playerId:booked.playerId,playerName:booked.name});
          }
        }
        if($runtime.seededSerieRand(day,`${prefix}|red`)<.00048){
          const active=activePerformances(own,minute).filter(p=>!redSeen.has(p.playerId));
          const sent=weightedPerformancePick(active,day,`${prefix}|redwho`,'card');
          if(sent){
            redSeen.add(sent.playerId);
            sent.plannedExitMinute=Math.min(sent.plannedExitMinute||90,minute);
            cancelFutureSubFor(team,sent.playerId);
            events.push({minute,type:'red',side:team,playerId:sent.playerId,playerName:sent.name,secondYellow:false});
          }
        }
        const forcedRisk=minute===riskMinute?activePerformances(own,minute).find(p=>p.playerId===riskTarget?.playerId):null;
        if(forcedRisk || $runtime.seededSerieRand(day,`${prefix}|injury`)<.00135){
          const active=activePerformances(own,minute).filter(p=>!injurySeen.has(p.playerId) && p.playerId!==riskTarget?.playerId);
          const hurt=forcedRisk || weightedPerformancePick(active,day,`${prefix}|injurywho`,'card');
          if(hurt){
            injurySeen.add(hurt.playerId);
            hurt.plannedExitMinute=Math.min(hurt.plannedExitMinute||90,minute);
            emergencyReplace(team,hurt,minute);
            events.push({minute,type:'injury',side:team,playerId:hurt.playerId,playerName:hurt.name});
          }
        }
      }
    }

    const birthday=$runtime.activeFormationChoice(day)?.effect;
    if(birthday?.kind==='birthday'){
      const celebrant=perfMap.get(String(birthday.targetPlayerId));
      const side=celebrant?.club===spec.homeClub?'home':celebrant?.club===spec.awayClub?'away':null;
      if(side){
        const first=Math.max(15,Number(celebrant.entryMinute||999));
        const last=Math.min(85,Number(celebrant.plannedExitMinute||90));
        if(first<=last){
          const minute=first+Math.floor($runtime.seededSerieRand(day,`birthday-minute|${celebrant.playerId}`)*(last-first+1));
          const ownGoal=$runtime.seededSerieRand(day,`birthday-outcome|${celebrant.playerId}`)<.5;
          const opposition=side==='home'?awayPerfs:homePerfs;
          const keeper=activePerformances(opposition,minute).find(p=>p.role==='P');
          events.push({minute,type:ownGoal?'own_goal':'goal',side,playerId:celebrant.playerId,
            playerName:celebrant.name,keeperId:ownGoal?null:keeper?.playerId||null,birthday:true});
        }
      }
    }

    // Gli eventi cambio vengono aggiunti dopo aver gestito eventuali rossi/infortuni,
    // così non rientra un giocatore al posto di un espulso.
    for(const side of ['home','away']){
      subPlans[side].filter(s=>!s.cancelled && s.minute<=90).forEach(s=>{
        const outPerf=perfMap.get(String(s.outPlayerId)), inPerf=perfMap.get(String(s.inPlayerId));
        if(outPerf) outPerf.plannedExitMinute=Math.min(outPerf.plannedExitMinute||90,s.minute-1);
        if(inPerf) inPerf.entryMinute=s.minute;
        events.push({
          minute:s.minute,type:'substitution',side,
          playerId:s.inPlayerId,playerName:s.inPlayerName,
          inPlayerId:s.inPlayerId,inPlayerName:s.inPlayerName,
          outPlayerId:s.outPlayerId,outPlayerName:s.outPlayerName,
          reason:s.reason
        });
      });
    }

    const goals=events.filter(e=>e.type==='goal'||e.type==='penalty_goal'||e.type==='own_goal');
    const homeGoals=goals.filter(e=>(e.type==='own_goal'?e.side!=='home':e.side==='home')),
      awayGoals=goals.filter(e=>(e.type==='own_goal'?e.side!=='away':e.side==='away'));
    if(homeGoals.length>awayGoals.length) homeGoals[awayGoals.length].decisiveGoal=true;
    if(awayGoals.length>homeGoals.length) awayGoals[homeGoals.length].decisiveGoal=true;
    events.sort((a,b)=>a.minute-b.minute || (a.type==='substitution'?1:0) - (b.type==='substitution'?1:0) || String(a.type).localeCompare(String(b.type)));
    return {
      index:idx,homeClub:spec.homeClub,awayClub:spec.awayClub,
      homeFormation:homeSel.formation,awayFormation:awaySel.formation,
      homeScore:0,awayScore:0,homePerfs,awayPerfs,perfMap,events,scorers:[],
      substitutions:subPlans
    };
  }

  function selectSerieABigMatch(matches,day){
    let bestIndex=0, bestScore=-Infinity;
    matches.forEach((m,index)=>{
      const home=$runtime.serieAClubStrength(m.homeClub,day);
      const away=$runtime.serieAClubStrength(m.awayClub,day);
      // Premia soprattutto due rose forti; un piccolo bonus va agli scontri equilibrati.
      const combined=home+away;
      const balance=Math.max(0,6-Math.abs(home-away))*.18;
      const score=combined+balance;
      if(score>bestScore){bestScore=score;bestIndex=index;}
    });
    return bestIndex;
  }

  function buildSerieADay(day){
    const season=$runtime.ensureSeasonState();
    const round=season?.serieASchedule?.[day-1];
    if(!round) return null;
    const matches=round.matches.map((m,i)=>buildSerieAMatch(day,i,m));
    const bigMatchIndex=selectSerieABigMatch(matches,day);
    const perfMap=new Map();
    const events=[];
    matches.forEach(match=>{
      match.perfMap.forEach((v,k)=>perfMap.set(k,v));
      match.events.forEach(e=>events.push({...e,matchIndex:match.index,homeClub:match.homeClub,awayClub:match.awayClub}));
    });
    events.sort((a,b)=>a.minute-b.minute || a.matchIndex-b.matchIndex);
    const mainEvents=events.filter(e=>e.matchIndex!==bigMatchIndex);
    const bigMatchEvents=events.filter(e=>e.matchIndex===bigMatchIndex);
    return {day,matches,perfMap,events,mainEvents,bigMatchEvents,bigMatchIndex};
  }

  function playedMinutes(perf,minute=90){
    if(!perf || perf.entryMinute>minute) return 0;
    const exit=Math.min(minute,Number(perf.plannedExitMinute||90));
    return Math.max(0,exit-Number(perf.entryMinute||1)+1);
  }

  function decisivePerformance(perf){
    return !!(perf && (perf.goals||perf.assists||perf.red||perf.ownGoal||perf.missedPenalty||perf.savedPenalty));
  }

  function finalizeSerieAMatchRatings(match){
    if(!match || match.ratingsFinalized) return;
    const applySide=(perfs,goalsFor,goalsAgainst)=>{
      const resultMod=goalsFor>goalsAgainst?.12:goalsFor<goalsAgainst?-.12:.02;
      perfs.forEach(perf=>{
        const mins=playedMinutes(perf,90);
        if(!mins) return;
        let mod=resultMod*(mins/90);
        if((perf.role==='P'||perf.role==='D') && goalsAgainst===0 && mins>=60) mod+=perf.role==='P'?.28:.16;
        if((perf.role==='P'||perf.role==='D') && goalsAgainst>=3 && mins>=45) mod-=.16;
        if((perf.role==='C'||perf.role==='A') && goalsFor>=3 && mins>=45) mod+=.07;
        if(perf.injury && Number(perf.injuryMinute||90)<30 && !decisivePerformance(perf)) mod-=.10;
        perf.liveVote=$runtime.clamp(perf.liveVote+mod,4,9);
        perf.ratingsFinalized=true;
      });
    };
    applySide(match.homePerfs,match.homeScore,match.awayScore);
    applySide(match.awayPerfs,match.awayScore,match.homeScore);
    match.ratingsFinalized=true;
    const decisive=match.events.find(e=>e.decisiveGoal);
    if(decisive){
      const scorer=match.perfMap.get(String(decisive.playerId));
      if(scorer) scorer.decisiveGoals=1;
    }
  }

  function finalizeSerieAPhaseRatings(){
    if(!$runtime.serieALive) return;
    if($runtime.serieALive.phase==='multilive'){
      $runtime.serieALive.matches.forEach((m,i)=>{if(i!==$runtime.serieALive.bigMatchIndex) finalizeSerieAMatchRatings(m);});
    }else if($runtime.serieALive.phase==='bigmatch'){
      finalizeSerieAMatchRatings($runtime.serieABigMatch());
    }
  }

  function liveFantasyValue(perf,minute=90){
    if(!perf || perf.entryMinute>minute) return 0;
    const rules=$runtime.fantasyRuleForDay(perf.day||$runtime.state?.season?.currentMatchday||1);
    const mins=playedMinutes(perf,minute);
    // V3.2.35.56.56: qualsiasi calciatore che chiude SV è sostituibile nel fantacalcio,
    // anche se era titolare reale. Gli eventi decisivi continuano a garantire il voto.
    if(minute>=90 && mins<rules.minVoteMinutes && !decisivePerformance(perf)) return 0;
    const choice=$runtime.activeFormationChoice(perf.day||$runtime.state?.season?.currentMatchday||1);
    const doubleEvents=choice?.effect?.kind==='risk_double_events' &&
      String(choice.effect.targetPlayerId||'')===String(perf.playerId);

    const eventFactor=doubleEvents?2:1;

    return halfPoint(
      perf.liveVote +
      perf.goals*rules.goalBonus*eventFactor +
      (rules.cesarini?Number(perf.lateGoals||0)*eventFactor:0) +
      (rules.decisiveGoalBonus?Number(perf.decisiveGoals||0):0) +
      perf.assists*rules.assistBonus*eventFactor -
      perf.yellow*rules.yellowMalus*eventFactor -
      perf.red*(perf.secondYellow?0:rules.redMalus)*eventFactor -
      perf.ownGoal*rules.ownGoalMalus*eventFactor -
      perf.missedPenalty*rules.missedPenaltyMalus*eventFactor +
      perf.savedPenalty*rules.savedPenaltyBonus*eventFactor -
      perf.goalsConceded*rules.goalConcededMalus*eventFactor +
      ((minute>=90 && perf.role==='P' && Number(perf.goalsConceded||0)===0)?rules.cleanSheetBonus:0)
    );
  }

  function perfEventText(perf){
    if(!perf) return '—';
    const bits=[];
    if(perf.goals) bits.push(`⚽ ${perf.goals}`);
    if(perf.cesariniBonus) bits.push(`⏱ +${perf.cesariniBonus}`);
    if(perf.goldenBenchBonus) bits.push('🪑 +1');
    if(perf.underdogBonus) bits.push('🌟 +0,5');
    if(perf.assists) bits.push(`👟 ${perf.assists}`);
    if(perf.yellow) bits.push(perf.yellow>1?`🟨 ${perf.yellow}`:'🟨');
    if(perf.red) bits.push('🟥');
    if(perf.ownGoal) bits.push(`↩ ${perf.ownGoal}`);
    if(perf.missedPenalty) bits.push('RIG-');
    if(perf.savedPenalty) bits.push('RIG+');
    if(perf.injury) bits.push('INF');
    if(perf.goalsConceded && perf.role==='P') bits.push(`${perf.goalsConceded}GS`);
    if(Number(perf.socialMotivationDelta||0)>0) bits.push('💬 MOT+');
    if(Number(perf.socialMotivationDelta||0)<0) bits.push('💬 MOT-');
    return bits.length?bits.join(' · '):'—';
  }

  function liveEventBadgesMarkup(perf, emptyText='—'){
    if(!perf) return `<span class="live-event-empty">${$runtime.escapeHtml(emptyText)}</span>`;
    const chips=[];
    const addChip=(type,icon,count,title,polarity='neutral')=>{
      const qty=Number(count||0);
      if(!qty && qty!==0) return;
      if(qty<=0 && !['injury','mot-plus','mot-minus'].includes(type)) return;
      const countMarkup=(qty>1 || ['conceded','yellow','own-goal','pen-miss','pen-save'].includes(type))
        ? `<span class="chip-count">${qty}</span>`
        : '';
      chips.push(`<span class="live-event-chip type-${type} polarity-${polarity}" title="${$runtime.escapeHtml(title)}">`+
        `<span class="chip-icon">${icon}</span>${countMarkup}</span>`);
    };

    addChip('goal','⚽',perf.goals,`Gol x${Number(perf.goals||0)}`,'positive');
    addChip('starting-vote','🩹',perf.startingVoteBonus,'Oltre il limite: voto base +1','positive');
    addChip('cesarini','⏱️',perf.cesariniBonus,'Zona Cesarini +1 per gol dall’85°','positive');
    addChip('golden-bench','🪑',perf.goldenBenchBonus,'Panchina d’oro +1','positive');
    if(perf.underdogBonus) addChip('underdog','🌟',1,'Underdog +0,5','positive');
    addChip('assist','👟',perf.assists,`Assist x${Number(perf.assists||0)}`,'positive');
    addChip('yellow','🟨',perf.yellow,`Ammonizione x${Number(perf.yellow||0)}`,'negative');
    addChip('red','🟥',perf.red,perf.secondYellow?'Espulsione per doppia ammonizione':'Espulsione diretta','negative');
    addChip('own-goal','↩',perf.ownGoal,`Autogol x${Number(perf.ownGoal||0)}`,'negative');
    addChip('pen-miss','❌',perf.missedPenalty,`Rigore sbagliato x${Number(perf.missedPenalty||0)}`,'negative');
    addChip('pen-save','🧤',perf.savedPenalty,`Rigore parato x${Number(perf.savedPenalty||0)}`,'positive');
    if(Number(perf.decisiveGoalBonus||0)>0) addChip('decisive-goal','🏆',1,'Gol decisivo +1','positive');
    if(Number(perf.captainBonus||0)>0) addChip('captain','©️',1,`Capitano +${perf.captainBonus}`,'positive');
    if(Number(perf.cleanSheetBonus||0)>0) addChip('clean-sheet','🧱',1,`Porta inviolata +${Number(perf.cleanSheetBonus)}`,'positive');
    addChip('conceded','🥅',perf.goalsConceded,`Gol subiti x${Number(perf.goalsConceded||0)}`,'negative');
    if(perf.injury) addChip('injury','🤕',1,'Infortunio','negative');
    if(Number(perf.socialMotivationDelta||0)>0) addChip('mot-plus','💬+',1,'Motivazione extra','positive');
    if(Number(perf.socialMotivationDelta||0)<0) addChip('mot-minus','💬−',1,'Pressione social','negative');
    if(Number(perf.riskDelta||0)>0) addChip('risk-plus','🎲+',1,'Bonus rischio','positive');
    if(Number(perf.riskDelta||0)<0) addChip('risk-minus','🎲−',1,'Malus rischio','negative');

    return chips.length ? chips.join('') : `<span class="live-event-empty">${$runtime.escapeHtml(emptyText)}</span>`;
  }

  function performanceText(p) {
    if(!p || p.noVote || p.vote===null) return 'SV';
    const day=p.day||$runtime.state?.season?.lastCompletedMatchday||$runtime.state?.season?.currentMatchday||1;
    const rules={...$runtime.fantasyRuleForDay(day)};
    if($runtime.formationPlayerModifier(day,p.playerId,'risk_double_events')) {
      ['goalBonus','assistBonus','yellowMalus','redMalus','ownGoalMalus','missedPenaltyMalus','savedPenaltyBonus','goalConcededMalus']
        .forEach(key=>{rules[key]*=2;});
    }
    const fmt=n=>Number(n).toLocaleString('it-IT',{maximumFractionDigits:1});
    const bits=[];
    if(p.goals) bits.push(`⚽ ${p.goals} +${fmt(p.goals*rules.goalBonus)}`);
    if(p.assists) bits.push(`👟 ${p.assists} +${fmt(p.assists*rules.assistBonus)}`);
    if(p.yellow) bits.push(`🟨 ${p.yellow>1?p.yellow+' ':''}-${fmt(p.yellow*rules.yellowMalus)}`);
    if(p.red) bits.push(p.secondYellow?'🟥 doppio giallo':`🟥 -${fmt(p.red*rules.redMalus)}`);
    if(p.ownGoal) bits.push(`↩ ${p.ownGoal>1?p.ownGoal+' ':''}-${fmt(p.ownGoal*rules.ownGoalMalus)}`);
    if(p.missedPenalty) bits.push(`❌ ${p.missedPenalty>1?p.missedPenalty+' ':''}-${fmt(p.missedPenalty*rules.missedPenaltyMalus)}`);
    if(p.savedPenalty) bits.push(`🧤 ${p.savedPenalty>1?p.savedPenalty+' ':''}+${fmt(p.savedPenalty*rules.savedPenaltyBonus)}`);
    if(Number(p.decisiveGoalBonus||0)>0) bits.push(`🏆 GOL DECISIVO +${fmt(p.decisiveGoalBonus)}`);
    if(Number(p.captainBonus||0)>0) bits.push(`©️ CAPITANO +${p.captainBonus}`);
    if(Number(p.cesariniBonus||0)>0) bits.push(`⏱ CESARINI +${fmt(p.cesariniBonus)}`);
    if(Number(p.goldenBenchBonus||0)>0) bits.push(`🪑 PANCHINA D’ORO +${fmt(p.goldenBenchBonus)}`);
    if(Number(p.underdogBonus||0)>0) bits.push(`⭐ UNDERDOG +${fmt(p.underdogBonus)}`);
    if(Number(p.cleanSheetBonus||0)>0) bits.push(`🧱 +${fmt(p.cleanSheetBonus)}`);
    if(p.goalsConceded) bits.push(`🥅 ${p.goalsConceded} -${fmt(p.goalsConceded*rules.goalConcededMalus)}`);
    if(p.injury) bits.push('🤕');
    if(Number(p.riskDelta||0)!==0) bits.push(`🎲 ${Number(p.riskDelta)>0?'+':''}${Number(p.riskDelta).toLocaleString('it-IT',{maximumFractionDigits:1})}`);
    if(Number(p.socialMotivationDelta||0)>0) bits.push('💬 MOTIVATO');
    if(Number(p.socialMotivationDelta||0)<0) bits.push('💬 PRESSIONE');
    return bits.length ? bits.join(' · ') : '—';
  }

  function fantasyGoals(points,day=$runtime.state?.season?.currentMatchday||1) {
    const p = Number(points||0);
    const rules=$runtime.fantasyRuleForDay(day);
    const threshold=Number(rules.firstGoalThreshold||66);
    if (p < threshold) return 0;
    const step=rules.goalStep;
    return Math.max(1, 1 + Math.floor((p - threshold) / step));
  }

  function lineupPlayersForManager(manager, savedLineup) {
    const ids = Object.values(savedLineup?.starters || {}).map(String);
    return ids.map(id => (manager.roster||[]).find(p=>String(p.id)===id)).filter(Boolean);
  }

  function currentFantasyPerformance(player,perfMap,minute=90){
    const perf=perfMap.get(String(player.id));
    if(!perf || perf.entryMinute>minute){
      return {day:$runtime.state?.season?.currentMatchday||1,playerId:String(player.id),name:player.name,role:player.role,club:player.club,vote:null,fantasy:0,noVote:true,minutes:0,goals:0,assists:0,yellow:0,red:0,ownGoal:0,missedPenalty:0,savedPenalty:0,goalsConceded:0,injury:false};
    }
    const minutes=playedMinutes(perf,minute);
    const rules=$runtime.fantasyRuleForDay(perf.day||$runtime.state?.season?.currentMatchday||1);
    const noVote=minute>=90 && minutes<rules.minVoteMinutes && !decisivePerformance(perf);
    const cleanSheetBonus=(!noVote && minute>=90 && perf.role==='P' && Number(perf.goalsConceded||0)===0)
      ? Number(rules.cleanSheetBonus||0)
      : 0;
    return {
      ...perf,
      vote:noVote?null:halfPoint(perf.liveVote),
      fantasy:noVote?0:liveFantasyValue(perf,minute),
      cleanSheetBonus,
      cesariniBonus:!noVote && rules.cesarini?Number(perf.lateGoals||0):0,
      decisiveGoalBonus:!noVote && rules.decisiveGoalBonus?Number(perf.decisiveGoals||0):0,
      noVote,
      minutes
    };
  }

  function lineupBenchPlayers(manager,savedLineup){
    const starterIds=new Set(Object.values(savedLineup?.starters||{}).map(String));
    const ordered=(savedLineup?.bench||[]).map(String);
    const seen=new Set();
    const result=[];
    ordered.forEach(id=>{
      if(seen.has(id)||starterIds.has(id)) return;
      const p=(manager.roster||[]).find(x=>String(x.id)===id);
      if(p){seen.add(id);result.push(p);}
    });
    (manager.roster||[]).forEach(p=>{
      const id=String(p.id);
      if(!starterIds.has(id)&&!seen.has(id)){seen.add(id);result.push(p);}
    });
    const blocked=String($runtime.adminBlockedStarterForManager(manager.id)||'');
    const index=result.findIndex(p=>String(p.id)===blocked);
    if(index>=0) result.push(...result.splice(index,1));
    return result;
  }

  function classicDefenseModifierResult(performances,formation,day,minute=90){
    const rules=$runtime.fantasyRuleForDay(day);
    if(rules.defenseModifier!=='classic' || minute<90) return {bonus:0,average:null,active:false};
    const defenderSlots=$runtime.lineupSlots(formation||'4-3-3').filter(slot=>slot.role==='D').length;
    if(defenderSlots<4) return {bonus:0,average:null,active:false};
    const valid=(performances||[]).filter(p=>!p?.noVote && p?.vote!==null && p?.vote!==undefined);
    const keeper=valid.find(p=>p.role==='P');
    const defenders=valid.filter(p=>p.role==='D').sort((a,b)=>Number(b.vote||0)-Number(a.vote||0));
    if(!keeper || defenders.length<3) return {bonus:0,average:null,active:false};
    const selected=[keeper,...defenders.slice(0,3)];
    const average=selected.reduce((sum,p)=>sum+Number(p.vote||0),0)/4;
    const bonus=average>=7?6:average>=6.5?3:average>=6?1:0;
    return {bonus,average,active:true};
  }

  function applyAdminTeamScoring(performances,substitutions,manager,day){
    const rule=$runtime.activeAdminRuleEffect(day)?.ruleId;
    if(rule==='golden_bench'){
      const first=performances.find(p=>p.lineupSource==='substitute' && String(p.playerId)===String(substitutions[0]?.inPlayerId||''));
      if(first && !first.noVote && Number(first.goals)>0){first.goldenBenchBonus=1;first.fantasy=halfPoint(Number(first.fantasy||0)+1);if(substitutions[0])substitutions[0].fantasy=first.fantasy;}
    }
    if(rule==='underdog')for(const perf of performances){
      const player=(manager.roster||[]).find(p=>String(p.id)===String(perf.playerId));
      if(player && perf.lineupSource==='starter' && !perf.noVote && perf.vote!=null && $runtime.currentPlayerOvr(player)<75){perf.underdogBonus=.5;perf.fantasy=halfPoint(Number(perf.fantasy||0)+.5);}
    }
  }

  function simulateFantasyTeamFromSerieA(manager,savedLineup,perfMap,minute=90){
    const formation=savedLineup?.formation||'4-3-3';
    const slotDefs=$runtime.lineupSlots(formation);
    const roster=manager.roster||[];
    const bench=lineupBenchPlayers(manager,savedLineup);
    const usedBench=new Set();
    const substitutions=[];
    let subsUsed=0;
    let wildcardUsed=false;
    const day=$runtime.state?.season?.currentMatchday||1;
    const tactic=$runtime.tacticForManager(day,manager.id);

    const performances=slotDefs.map(slot=>{
      const starterId=String(savedLineup?.starters?.[slot.instanceId]||'');
      const starter=roster.find(p=>String(p.id)===starterId);
      if(!starter) return null;
      const original=currentFantasyPerformance(starter,perfMap,minute);
      if(!original.noVote || minute<90) return {...original,slotId:slot.instanceId,lineupSource:'starter'};

      let maxSubs=$runtime.fantasyRuleForDay(original.day||day).maxFantasySubs;
      if(tactic==='extra_subs') maxSubs=7;
      if(subsUsed>=maxSubs) return {...original,slotId:slot.instanceId,lineupSource:'starter'};

      const validBench=bench.filter(p=>{
        const id=String(p.id);
        if(usedBench.has(id)) return false;
        const perf=currentFantasyPerformance(p,perfMap,minute);
        return !perf.noVote;
      });

      let compatible=validBench.filter(p=>p.role===slot.role);

      if(tactic==='best_bench'){
        compatible=compatible.slice().sort((a,b)=>{
          const af=currentFantasyPerformance(a,perfMap,minute).fantasy||0;
          const bf=currentFantasyPerformance(b,perfMap,minute).fantasy||0;
          return bf-af;
        });
      }

      let replacement=compatible[0]||null;

      if(!replacement && tactic==='wildcard_sub' && !wildcardUsed){
        replacement=validBench.slice().sort((a,b)=>{
          const af=currentFantasyPerformance(a,perfMap,minute).fantasy||0;
          const bf=currentFantasyPerformance(b,perfMap,minute).fantasy||0;
          return bf-af;
        })[0]||null;
        if(replacement) wildcardUsed=true;
      }

      if(!replacement) return {...original,slotId:slot.instanceId,lineupSource:'starter'};

      const replacementPerf=currentFantasyPerformance(replacement,perfMap,minute);
      usedBench.add(String(replacement.id));
      subsUsed++;
      substitutions.push({
        slotId:slot.instanceId,role:slot.role,
        outPlayerId:String(starter.id),outPlayerName:starter.name,
        inPlayerId:String(replacement.id),inPlayerName:replacement.name,
        fantasy:replacementPerf.fantasy
      });
      return {
        ...replacementPerf,slotId:slot.instanceId,lineupSource:'substitute',
        replacedPlayerId:String(starter.id),replacedPlayerName:starter.name
      };
    }).filter(Boolean);

    applyAdminTeamScoring(performances,substitutions,manager,day);

    const captainId=String(savedLineup?.captainId || (manager.id!=='user' && $runtime.leagueRulesFor($runtime.state).captainBonus!=='off'
      ? lineupPlayersForManager(manager,savedLineup).sort((a,b)=>$runtime.cpuLeagueRuleLineupValue(manager,b,day)-$runtime.cpuLeagueRuleLineupValue(manager,a,day))[0]?.id
      : '') || '');
    const captainRule=$runtime.leagueRulesFor($runtime.state).captainBonus;
    if(captainRule!=='off' && captainId){
      const captain=performances.find(p=>p.lineupSource==='starter' && String(p.playerId)===captainId && !p.noVote);
      const threshold=captainRule==='eight'?8:7;
      if(captain && Number(captain.vote)>=threshold){
        captain.captainBonus=captainRule==='eight'?2:1;
        captain.fantasy=halfPoint(captain.fantasy+captain.captainBonus);
      }
    }

    // RISCHIO: l'effetto deve modificare il FV del singolo giocatore.
    // Prima il malus/bonus era visibile nella riga ma non entrava nel calcolo FV.
    if(manager.id==='user'){
      const chosen=$runtime.activeFormationChoice(day);
      if(chosen?.category==='risk'){
        const target=performances.find(p=>String(p.playerId)===String(chosen.effect?.targetPlayerId||''));
        if(target){
          const riskDelta=$runtime.riskAdjustmentForPerformance(target,day);
          target.riskDelta=riskDelta;
          target.fantasy=halfPoint(Number(target.fantasy||0)+Number(riskDelta||0));
        }
      }
    }

    let fantasyPoints=halfPoint(performances.reduce((s,p)=>s+Number(p.fantasy||0),0));
    const defenseModifier=classicDefenseModifierResult(performances,formation,day,minute);
    if(defenseModifier.bonus>0) fantasyPoints=halfPoint(fantasyPoints+defenseModifier.bonus);

    return {
      managerId:manager.id,team:manager.team,fantasyPoints,fantasyGoals:fantasyGoals(fantasyPoints,day),
      performances,substitutions,subsUsed,unresolvedSV:performances.filter(p=>p.noVote).length,
      defenseModifierBonus:defenseModifier.bonus,defenseModifierAverage:defenseModifier.average
    };
  }

  function updateStandingsFromMatch(match) {
    const season=$runtime.ensureSeasonState(); if(!season) return;
    $runtime.applyFantasyMatch(season.standings,match);
  }
    return Object.freeze({halfPoint,serieAFixtureCompactText,serieAFixtureFullText,serieAMatchupBadgeHtml,baseLivePerformance,lockerVoteModifier,participantWeight,weightedPerformancePick,activePerformances,serieAGoalProbability,buildSerieAMatch,selectSerieABigMatch,buildSerieADay,playedMinutes,decisivePerformance,finalizeSerieAMatchRatings,finalizeSerieAPhaseRatings,liveFantasyValue,perfEventText,liveEventBadgesMarkup,performanceText,fantasyGoals,lineupPlayersForManager,currentFantasyPerformance,lineupBenchPlayers,classicDefenseModifierResult,applyAdminTeamScoring,simulateFantasyTeamFromSerieA,updateStandingsFromMatch});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['football-engine']=Object.freeze({create});
})();
