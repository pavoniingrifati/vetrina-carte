(() => {
  'use strict';
  function create({compactMarketState}){
    if(typeof compactMarketState!=='function')throw new TypeError('compactMarketState richiesto');
  function compactPerformanceForSave(p) {
    if (!p || typeof p!=='object') return p;
    const keys=['playerId','name','club','role','day','noVote','vote','fantasy','goals','assists','yellow','red','secondYellow','ownGoal','missedPenalty','savedPenalty','goalsConceded','cleanSheetBonus','injury','riskDelta','socialMotivationDelta','socialMotivationOutcome','lineupSource','replacedPlayerName'];
    const out={};
    keys.forEach(k=>{ if(p[k]!==undefined) out[k]=p[k]; });
    return out;
  }

  function compactFantasyMatchForSave(m) {
    if (!m || typeof m!=='object') return m;
    const out={
      homeId:m.homeId,awayId:m.awayId,homeScore:m.homeScore,awayScore:m.awayScore,
      homeFantasy:m.homeFantasy,awayFantasy:m.awayFantasy,homeTeam:m.homeTeam,awayTeam:m.awayTeam,
      homeDefenseModifierBonus:Number(m.homeDefenseModifierBonus||0),awayDefenseModifierBonus:Number(m.awayDefenseModifierBonus||0),
      homeDefenseModifierAverage:m.homeDefenseModifierAverage??null,awayDefenseModifierAverage:m.awayDefenseModifierAverage??null
    };
    if(m.homeId==='user' || m.awayId==='user'){
      out.homePerformances=(m.homePerformances||[]).map(compactPerformanceForSave);
      out.awayPerformances=(m.awayPerformances||[]).map(compactPerformanceForSave);
      out.homeSubstitutions=(m.homeSubstitutions||[]).map(x=>({...x}));
      out.awaySubstitutions=(m.awaySubstitutions||[]).map(x=>({...x}));
      out.homeSubsUsed=Number(m.homeSubsUsed||0);
      out.awaySubsUsed=Number(m.awaySubsUsed||0);
    }
    return out;
  }

  function compactLongCareerState(source){
    if(!source || typeof source!=='object')return source;
    const snapshot={...source};
    const seasonNumber=Math.max(1,Number(source.career?.seasonNumber||1));
    if(source.career){
      const picks=new Map();
      (source.career.auctionPicks||[]).forEach(pick=>{
        const id=String(pick.id||'');if(!id)return;
        const previous=picks.get(id);
        picks.set(id,{...pick,count:Number(previous?.count||0)+Math.max(1,Number(pick.count||1))});
      });
      snapshot.career={...source.career,auctionPicks:[...picks.values()],fantapointsHistory:(source.career.fantapointsHistory||[]).slice(-76)};
    }
    snapshot.log=(source.log||[]).slice(-200);
    snapshot.tradeWindows=Object.fromEntries(Object.entries(source.tradeWindows||{}).filter(([,entry])=>Number(entry?.seasonNumber||seasonNumber)>=seasonNumber));
    if(source.transferMarket)snapshot.transferMarket=compactMarketState(source.transferMarket);
    if(source.catalogWorlds)snapshot.catalogWorlds=Object.fromEntries(Object.entries(source.catalogWorlds).map(([key,world])=>[key,{...world,transferMarket:compactMarketState(world?.transferMarket)}]));
    return snapshot;
  }

  function buildStorageSnapshot(source) {
    if(!source || typeof source!=='object') return source;
    const snapshot=compactLongCareerState(source);
    const season=source.season;
    if(!season || typeof season!=='object') return snapshot;
    const compactSeason={...season};

    // I risultati fantasy storici mantengono tutti i punteggi, ma i dettagli dei
    // singoli giocatori sono necessari solo per la partita dell'utente.
    compactSeason.matchdayResults={};
    Object.entries(season.matchdayResults||{}).forEach(([day,result])=>{
      compactSeason.matchdayResults[day]={
        day:Number(result?.day||day),
        createdAt:Number(result?.createdAt||0),
        formationChoice:result?.formationChoice||null,
        userBenchIds:Array.isArray(result?.userBenchIds)?result.userBenchIds.map(String):[],
        fantapointsReward:result?.fantapointsReward||null,
        fantapointsPresented:!!result?.fantapointsPresented,
        matches:(result?.matches||[]).map(compactFantasyMatchForSave)
      };
    });

    // Per ricostruire classifica e mondo Serie A bastano i risultati: il feed live
    // completo è già trasformato in news e statistiche persistenti a fine giornata.
    compactSeason.serieAResults={};
    Object.entries(season.serieAResults||{}).forEach(([day,result])=>{
      compactSeason.serieAResults[day]={
        day:Number(result?.day||day),
        matches:(result?.matches||[]).map(m=>({
          homeClub:m.homeClub,awayClub:m.awayClub,
          homeScore:Number(m.homeScore||0),awayScore:Number(m.awayScore||0)
        }))
      };
    });

    // Le formazioni delle giornate concluse non servono più al motore: il risultato
    // e le prestazioni dell'utente sono già salvati in matchdayResults.
    const keepDays=new Set([String(season.currentMatchday||1)]);
    if(season.pendingBigMatch?.day) keepDays.add(String(season.pendingBigMatch.day));
    if(season.activeLive?.day) keepDays.add(String(season.activeLive.day));
    compactSeason.lineups={};
    Object.entries(season.lineups||{}).forEach(([day,lineups])=>{
      if(keepDays.has(String(day))) compactSeason.lineups[day]=lineups;
    });

    // Non salviamo centinaia di righe vuote: al caricamento vengono ricreate dal database.
    compactSeason.playerSeasonStats=Object.fromEntries(Object.entries(season.playerSeasonStats||{}).filter(([,v])=>
      Number(v?.appearances||0)>0 || Number(v?.minutes||0)>0 || (Array.isArray(v?.recent)&&v.recent.length>0)
    ));
    compactSeason.playerStatus=Object.fromEntries(Object.entries(season.playerStatus||{}).filter(([,v])=>
      Number(v?.injuryUntil||0)>0 || Number(v?.suspensionUntil||0)>0 || Number(v?.yellowAccum||0)>0 || !!v?.lastReason
    ));
    if(Array.isArray(compactSeason.newsFeed) && compactSeason.newsFeed.length>120) compactSeason.newsFeed=compactSeason.newsFeed.slice(-120);

    snapshot.season=compactSeason;
    return snapshot;
  }

    return Object.freeze({buildStorageSnapshot,compactLongCareerState});
  }
  window.FantaStorageSnapshot=Object.freeze({create});
})();
