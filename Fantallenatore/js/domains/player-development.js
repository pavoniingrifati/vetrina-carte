/* Responsibility: player-development. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: player-development');
  function updatePersistentPlayerStatuses(day,live){
    const season=$runtime.ensureSeasonState();
    if(!season||!live) return;
    $runtime.ensurePlayerSeasonSystems(season);

    (live.events||[]).forEach(event=>{
      const id=String(event.playerId||'');
      if(!id || !season.playerStatus[id]) return;
      const status=season.playerStatus[id];

      if(event.type==='injury'){
        const severeRoll=$runtime.seededSerieRand(day,`persistent-injury|${event.matchIndex}|${id}|${event.minute}`);
        const duration=severeRoll<.08?4:severeRoll<.28?3:severeRoll<.62?2:1;
        status.injuryUntil=Math.max(Number(status.injuryUntil||0),day+duration);
        status.lastReason=`Infortunio · ${duration} giornat${duration===1?'a':'e'}`;
      }
      if(event.type==='yellow'){
        status.yellowAccum=Number(status.yellowAccum||0)+1;
        if(status.yellowAccum>=5){
          status.yellowAccum-=5;
          status.suspensionUntil=Math.max(Number(status.suspensionUntil||0),day+1);
          status.lastReason='Squalifica per ammonizioni';
        }
      }
      if(event.type==='red'){
        const duration=event.secondYellow?1:($runtime.seededSerieRand(day,`red-ban|${event.matchIndex}|${id}`)<.16?2:1);
        status.suspensionUntil=Math.max(Number(status.suspensionUntil||0),day+duration);
        status.lastReason=`Squalifica · ${duration} giornat${duration===1?'a':'e'}`;
      }
    });
  }

  function updatePlayerSeasonStatsFromLive(day,live){
    const season=$runtime.ensureSeasonState();
    if(!season||!live) return;
    $runtime.ensurePlayerSeasonSystems(season);

    (live.matches||[]).forEach(match=>{
      const all=[...(match.homePerfs||[]),...(match.awayPerfs||[])];
      all.forEach(perf=>{
        const player=$runtime.playerMap.get(String(perf.playerId)) || (window.FANTA_PLAYERS||[]).find(p=>String(p.id)===String(perf.playerId));
        if(!player) return;
        const stat=season.playerSeasonStats[String(player.id)] || (season.playerSeasonStats[String(player.id)]=$runtime.emptyPlayerSeasonStat(player));
        const mins=$runtime.playedMinutes(perf,90);
        if(mins<=0) return;

        stat.appearances++;
        if(perf.starter) stat.starts++; else stat.subApps++;
        stat.minutes+=mins;
        stat.goals+=Number(perf.goals||0);
        stat.assists+=Number(perf.assists||0);
        stat.yellow+=Number(perf.yellow||0);
        stat.red+=Number(perf.red||0);
        stat.missedPenalty+=Number(perf.missedPenalty||0);
        stat.savedPenalty+=Number(perf.savedPenalty||0);

        const isHome=match.homeClub===perf.club;
        const goalsAgainst=isHome?Number(match.awayScore||0):Number(match.homeScore||0);
        if((perf.role==='P'||perf.role==='D') && goalsAgainst===0 && mins>=60) stat.cleanSheets++;

        const performance=$runtime.currentFantasyPerformance(player,match.perfMap||live.perfMap,90);
        if(!performance.noVote && performance.vote!==null){
          const vote=Number(performance.vote);
          const fantasy=Number(performance.fantasy||0);
          stat.voteCount++;
          stat.voteSum+=vote;
          stat.fantasySum+=fantasy;
          stat.bestVote=stat.bestVote===null?vote:Math.max(stat.bestVote,vote);
          stat.worstVote=stat.worstVote===null?vote:Math.min(stat.worstVote,vote);
          stat.recent=Array.isArray(stat.recent)?stat.recent:[];
          stat.recent.push({day,vote,fantasy});
          stat.recent=stat.recent.slice(-5);
        }
        stat.lastDay=day;
      });
    });
  }

  function playerOvrDevelopment(playerId,season=$runtime.ensureSeasonState()){
    if(!season)return null;
    if(!season.playerOvrDevelopment||typeof season.playerOvrDevelopment!=='object') season.playerOvrDevelopment={};
    const id=String(playerId);
    return season.playerOvrDevelopment[id] ||= {delta:0,progress:0,lastDay:0,history:[]};
  }

  function applyPlayerOvrChange(player,amount,day,reason,type='form'){
    const season=$runtime.ensureSeasonState();
    if(!season||!player||!amount)return null;
    const development=$runtime.playerOvrDevelopment(player.id,season);
    const before=$runtime.currentPlayerOvr(player);
    const wantedDelta=$runtime.clamp(Number(development.delta||0)+Number(amount||0),-10,10);
    const after=$runtime.clamp(Number(player.ovr||0)+wantedDelta,50,99);
    const actualDelta=after-before;
    if(!actualDelta)return null;
    development.delta=after-Number(player.ovr||0);
    development.lastDay=day;
    development.history=Array.isArray(development.history)?development.history:[];
    development.history.push({day,before,after,change:actualDelta,reason,type});
    development.history=development.history.slice(-20);
    const event={id:`ovr_${day}_${player.id}_${development.history.length}`,day,playerId:String(player.id),before,after,change:actualDelta,reason,type};
    season.playerDevelopmentEvents=Array.isArray(season.playerDevelopmentEvents)?season.playerDevelopmentEvents:[];
    season.playerDevelopmentEvents.push(event);
    season.playerDevelopmentEvents=season.playerDevelopmentEvents.slice(-120);
    $runtime.addSeasonNews({id:event.id,day,stage:'post',priority:actualDelta>0?92:88,type:actualDelta>0?'growth':'decline',title:actualDelta>0?`${player.name} cresce: OVR ${before} → ${after}`:`${player.name} in calo: OVR ${before} → ${after}`,detail:`${reason} · variazione stagionale ${development.delta>=0?'+':''}${development.delta}`,playerId:player.id,expiresAfter:3});
    return event;
  }

  function updatePlayerOvrEvolution(day,live){
    const season=$runtime.ensureSeasonState();
    if(!season||!live)return;

    // V3.2.35.8:
    // l'OVR deve essere un sistema vivo e percepibile durante tutta la stagione.
    // Ogni giornata genera normalmente tra 8 e 15 variazioni complessive.
    // La maggior parte nasce dalle prestazioni; almeno 2 sono eventi di contesto/allenamento.
    const targetChanges=8+Math.floor($runtime.seededSerieRand(day,'ovr-target-changes')*8); // 8..15
    const performanceCandidates=[];

    (live.matches||[]).forEach(match=>{
      [...(match.homePerfs||[]),...(match.awayPerfs||[])].forEach(perf=>{
        const player=$runtime.playerMap.get(String(perf.playerId))||(window.FANTA_PLAYERS||[]).find(p=>String(p.id)===String(perf.playerId));
        if(!player)return;

        const performance=$runtime.currentFantasyPerformance(player,match.perfMap||live.perfMap,90);
        if(performance.noVote||performance.vote===null)return;

        const development=$runtime.playerOvrDevelopment(player.id,season);
        const vote=Number(performance.vote||0);
        const role=String(player.role||perf.role||'');

        // V3.2.35.56 · Evoluzione OVR normalizzata per ruolo.
        // Prima gli attaccanti avevano un doppio vantaggio: i bonus miglioravano già
        // il rendimento e, in più, gol/assist aggiungevano molto progresso OVR.
        // Qui manteniamo le prestazioni come motore principale, ma diamo a ogni ruolo
        // un metro più coerente con il suo lavoro in campo.
        let points=
          vote>=8 ? 2.5 :
          vote>=7.5 ? 2 :
          vote>=6.8 ? 1 :
          vote<=4.8 ? -2.5 :
          vote<=5 ? -2 :
          vote<=5.5 ? -1 : 0;

        // Piccola normalizzazione continua: compensa il fatto che P/D producono
        // naturalmente meno eventi offensivi, mentre riduce il vantaggio strutturale A.
        points+=({P:.34,D:.12,C:0,A:-.15}[role]||0);

        // Gol e assist restano importanti, ma il loro impatto sull'OVR è scalato
        // per ruolo: un bomber non deve crescere automaticamente più di tutti solo
        // perché il suo ruolo genera più bonus fantasy.
        const goalEvolutionScale=({P:1,D:.9,C:.7,A:.25}[role]||1);
        const assistEvolutionScale=({P:1,D:.85,C:.7,A:.35}[role]||1);
        if(Number(perf.goals||0)>=2) points+=goalEvolutionScale;
        else if(Number(perf.goals||0)===1 && vote>=7) points+=.35*goalEvolutionScale;
        if(Number(perf.assists||0)>=2) points+=.45*assistEvolutionScale;

        // Il clean sheet diventa un merito evolutivo esplicito per P e D,
        // purché il giocatore abbia disputato almeno 60 minuti.
        const goalsAgainst=String(perf.club)===String(match.homeClub)
          ? Number(match.awayScore||0)
          : Number(match.homeScore||0);
        if((role==='P'||role==='D') && goalsAgainst===0 && $runtime.playedMinutes(perf,90)>=60){
          points+=role==='P'?.20:.08;
        }

        if(Number(perf.red||0)>0) points-=1;

        // Il potenziale segreto assegnato a inizio stagione orienta la carriera del giocatore.
        // ELITE/ALTO sono realmente predisposti a crescere; BASSO/RISCHIO CALO al contrario.
        // Le prestazioni possono comunque accelerare, rallentare o contrastare quella tendenza.
        const hiddenPotential=$runtime.playerSeasonPotentialProfile(player);
        const trend=Number(hiddenPotential.trend||0);
        const absTrend=Math.abs(trend);

        const trendBias=
          absTrend>=8 ? Math.sign(trend)*1.12 :
          absTrend>=4 ? Math.sign(trend)*.64 :
          trend*.06;

        const trigger=
          absTrend>=8 ? 3.0 :
          absTrend>=4 ? 3.6 :
          4.0;

        development.progress=$runtime.clamp(Number(development.progress||0)+points+trendBias,-9,9);

        if(development.progress>=trigger){
          performanceCandidates.push({
            player,
            amount:1,
            score:development.progress+(trend>0?Math.min(1.4,trend*.08):0),
            resetStep:trigger,
            reason:hiddenPotential.tier==='elite'
              ? 'Crescita tecnica accelerata e prestazioni convincenti'
              : hiddenPotential.tier==='high'
                ? 'Potenziale in crescita e rendimento positivo'
                : 'Prestazioni eccellenti e grande continuità'
          });
        }else if(development.progress<=-trigger){
          performanceCandidates.push({
            player,
            amount:-1,
            score:-development.progress+(trend<0?Math.min(1.4,-trend*.08):0),
            resetStep:trigger,
            reason:hiddenPotential.tier==='collapse'
              ? 'Regresso tecnico e fiducia in forte calo'
              : hiddenPotential.tier==='low'
                ? 'Potenziale in calo e rendimento negativo'
                : 'Periodo di forma negativo'
          });
        }
      });
    });

    const changedToday=new Set();
    let changesMade=0;

    // Lasciamo sempre almeno 2 slot agli eventi di allenamento/contesto.
    // In questo modo la crescita non dipende esclusivamente dal voto dell'ultima giornata.
    const performanceLimit=Math.max(0,targetChanges-2);

    performanceCandidates
      .sort((a,b)=>b.score-a.score)
      .slice(0,performanceLimit)
      .forEach(item=>{
        if(changedToday.has(String(item.player.id)))return;
        const development=$runtime.playerOvrDevelopment(item.player.id,season);
        development.progress+=item.amount>0?-item.resetStep:item.resetStep;
        const event=$runtime.applyPlayerOvrChange(item.player,item.amount,day,item.reason,'performance');
        if(event){
          changedToday.add(String(item.player.id));
          changesMade++;
        }
      });

    const allPlayers=(window.FANTA_PLAYERS||[]).slice();

    // Per gli eventi extra diamo priorità ai giocatori effettivamente coinvolti nella giornata,
    // ma una quota può comunque riguardare riserve/giocatori meno utilizzati.
    const activeIds=new Set();
    (live.matches||[]).forEach(match=>{
      [...(match.homePerfs||[]),...(match.awayPerfs||[])].forEach(perf=>{
        if(perf?.playerId!=null) activeIds.add(String(perf.playerId));
      });
    });
    const activePool=allPlayers.filter(p=>activeIds.has(String(p.id)));
    const randomEvents=[
      {id:'great_training',weight:31,change:1,reason:'Settimana di allenamenti eccellente',type:'training'},
      {id:'breakthrough',weight:2,change:2,reason:'Esplosione inattesa durante gli allenamenti',type:'breakthrough'},
      {id:'confidence',weight:22,change:1,reason:'Fiducia crescente da parte dell’allenatore',type:'confidence'},
      {id:'bad_training',weight:28,change:-1,reason:'Allenamenti sotto le aspettative',type:'training'},
      {id:'coach_conflict',weight:24,change:-1,reason:'Discussione con il mister e fiducia in calo',type:'conflict'},
      {id:'locker_crisis',weight:2,change:-2,reason:'Crisi nello spogliatoio',type:'conflict'}
    ];

    const pickWeighted=(roll,trend=0)=>{
      const bias=$runtime.clamp(Number(trend||0)/10,-1,1);
      const weighted=randomEvents.map(event=>({
        event,
        // Il potenziale influenza nettamente la direzione dell'evento,
        // senza rendere impossibile un risultato contrario.
        weight:event.weight*(
          event.change>0 ? (1+bias*.92) :
          event.change<0 ? (1-bias*.92) : 1
        )
      }));
      let total=weighted.reduce((s,x)=>s+x.weight,0);
      let cursor=roll*total;
      for(const item of weighted){
        cursor-=item.weight;
        if(cursor<=0)return item.event;
      }
      return weighted[0].event;
    };

    let attempts=0;
    const maxAttempts=Math.max(100,targetChanges*30);

    while(changesMade<targetChanges && attempts<maxAttempts){
      attempts++;

      // Circa il 75% degli eventi extra riguarda qualcuno visto in campo in questa giornata.
      const useActive=activePool.length>0 && $runtime.seededSerieRand(day,`ovr-extra-active-${attempts}`)<.75;
      const pool=useActive?activePool:allPlayers;
      if(!pool.length)break;

      const index=Math.floor($runtime.seededSerieRand(day,`ovr-extra-player-${attempts}`)*pool.length);
      const player=pool[index];
      if(!player || changedToday.has(String(player.id)))continue;

      const hiddenPotential=$runtime.playerSeasonPotentialProfile(player);
      const event=pickWeighted(
        $runtime.seededSerieRand(day,`ovr-extra-type-${attempts}-${player.id}`),
        hiddenPotential.trend
      );

      const applied=$runtime.applyPlayerOvrChange(player,event.change,day,event.reason,event.type);
      if(!applied)continue;

      changedToday.add(String(player.id));
      changesMade++;
    }

    // Piccolo log persistente utile per diagnostica e bilanciamento.
    season.ovrEvolutionMeta ||= {};
    season.ovrEvolutionMeta[String(day)]={
      target:targetChanges,
      actual:changesMade,
      performanceChanges:[...changedToday].length,
      updatedAt:Date.now()
    };
  }

  function updateSerieASeasonWorld(day,live){
    const season=$runtime.ensureSeasonState();
    if(!season||!live) return;
    $runtime.ensurePlayerSeasonSystems(season);
    if(season.simDataUpdatedDays[String(day)]) return;

    $runtime.updateSerieAStandingsFromStoredMatches(season,(live.matches||[]).map(m=>({
      homeClub:m.homeClub,awayClub:m.awayClub,homeScore:m.homeScore,awayScore:m.awayScore
    })));
    $runtime.updatePlayerSeasonStatsFromLive(day,live);
    $runtime.updatePersistentPlayerStatuses(day,live);
    $runtime.updatePlayerOvrEvolution(day,live);
    $runtime.applyLockerRoomOvrOutcome(day,live);
    season.simDataUpdatedDays[String(day)]=true;
  }

  function applyLockerRoomOvrOutcome(day,live){
    const effect=$runtime.activeFormationChoice(day)?.effect;
    if(!effect || !['locker_vote','locker_turnaround'].includes(effect.kind) || !effect.ovrCondition && effect.kind!=='locker_turnaround')return;
    const id=String(effect.targetPlayerId),player=$runtime.playerMap.get(id);
    const starters=Object.values($runtime.state?.season?.lineups?.[String(day)]?.user?.starters||{}).map(String);
    if(!player || !starters.includes(id))return;
    const perf=live.perfMap?.get(id);
    if(!perf)return;
    const performance=$runtime.currentFantasyPerformance(player,live.perfMap,90);
    if(performance.noVote)return;
    const season=$runtime.ensureSeasonState();
    season.lockerOvrAwarded ||= {};
    if(season.lockerOvrAwarded[id])return;
    const vote=Number(performance.vote);
    const change=vote>=7?1:effect.kind==='locker_turnaround' && vote<6?-1:0;
    if(change && $runtime.applyPlayerOvrChange(player,change,day,`${$runtime.activeFormationChoice(day).title}: voto ${vote}`,'locker_event')) season.lockerOvrAwarded[id]=true;
  }
    return Object.freeze({updatePersistentPlayerStatuses,updatePlayerSeasonStatsFromLive,playerOvrDevelopment,applyPlayerOvrChange,updatePlayerOvrEvolution,updateSerieASeasonWorld,applyLockerRoomOvrOutcome});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['player-development']=Object.freeze({create});
})();
