/* Domain service: player-season-state. No DOM, timers, or persistence; state accessors remain live. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: player-season-state');
  function ensurePlayerSeasonSystems(season){
    if(!season || $runtime.initializedSeasonSystems.has(season)) return;
    if(!season.playerSeasonStats || typeof season.playerSeasonStats!=='object') season.playerSeasonStats={};
    if(!season.playerStatus || typeof season.playerStatus!=='object') season.playerStatus={};
    if(!season.simDataUpdatedDays || typeof season.simDataUpdatedDays!=='object') season.simDataUpdatedDays={};

    (window.FANTA_PLAYERS||[]).forEach(player=>{
      const id=String(player.id);
      if(!season.playerSeasonStats[id]) season.playerSeasonStats[id]=$runtime.emptyPlayerSeasonStat(player);
      if(!season.playerStatus[id]) season.playerStatus[id]={injuryUntil:0,suspensionUntil:0,yellowAccum:0,lastReason:''};
    });

    if(!Array.isArray(season.serieAStandings) || season.serieAStandings.length!==(window.FANTA_CLUBS||[]).length){
      season.serieAStandings=$runtime.freshSerieAStandings();
      Object.values(season.serieAResults||{}).sort((a,b)=>Number(a.day||0)-Number(b.day||0)).forEach(result=>{
        updateSerieAStandingsFromStoredMatches(season,result.matches||[]);
      });
    }
    $runtime.initializedSeasonSystems.add(season);
  }

  function playerSeasonStat(playerId){
    const season=$runtime.state?.season;
    if(!season) return null;
    ensurePlayerSeasonSystems(season);
    return season.playerSeasonStats[String(playerId)]||null;
  }

  function playerSeasonStatus(playerId){
    const season=$runtime.state?.season;
    if(!season) return {injuryUntil:0,suspensionUntil:0,yellowAccum:0,lastReason:''};
    ensurePlayerSeasonSystems(season);
    return season.playerStatus[String(playerId)]||{injuryUntil:0,suspensionUntil:0,yellowAccum:0,lastReason:''};
  }

  function playerStatusForDay(playerId,day){
    const canonical=$runtime.playerMap.get(String(playerId));
    if(canonical?.marketStatus==='abroad' || canonical?.club==='estero'){
      return {unavailable:true,type:'abroad',label:'FUORI SERIE A',className:'abroad'};
    }
    const status=playerSeasonStatus(playerId);
    const d=Number(day||$runtime.state?.season?.currentMatchday||1);
    if(Number(status.injuryUntil||0)>=d){
      return {unavailable:true,type:'injury',label:`INFORTUNATO · rientro G${Number(status.injuryUntil)+1}`,className:'injured'};
    }
    if(Number(status.suspensionUntil||0)>=d){
      return {unavailable:true,type:'suspension',label:`SQUALIFICATO · rientro G${Number(status.suspensionUntil)+1}`,className:'suspended'};
    }
    return {unavailable:false,type:'available',label:'DISPONIBILE',className:'available'};
  }

  function playerFormMetrics(playerId){
    const stat=playerSeasonStat(playerId);
    const recent=(stat?.recent||[]).filter(x=>Number.isFinite(Number(x.vote))).slice(-5);
    if(!recent.length) return {count:0,avg:6,trend:0,arrow:'→',className:'neutral',score:0,recent:[]};
    const avg=recent.reduce((s,x)=>s+Number(x.vote),0)/recent.length;
    const previous=recent.length>1?recent.slice(0,-1).reduce((s,x)=>s+Number(x.vote),0)/(recent.length-1):avg;
    const trend=Number(recent[recent.length-1].vote)-previous;
    const arrow=trend>.22?'↑':trend<-.22?'↓':'→';
    const className=trend>.22?'up':trend<-.22?'down':'neutral';
    const score=$runtime.clamp((avg-6)*1.45 + trend*.42,-1.6,1.6);
    return {count:recent.length,avg,trend,arrow,className,score,recent};
  }

  function updateSerieAStandingsFromStoredMatches(season,matches){
    if(!season?.serieAStandings) return;
    $runtime.applyClubMatches(season.serieAStandings,matches);
  }

  function currentPlayerOvr(player){
    if(!player)return 0;
    const base=Number(player.ovr||player.overall||0);
    const season=$runtime.state?.season?.started?$runtime.state.season:null;
    const delta=Number(season?.playerOvrDevelopment?.[String(player.id)]?.delta||0);
    return $runtime.clamp(base+delta,50,99);
  }

  function playerOvrLabel(player){
    const current=currentPlayerOvr(player);
    const base=Number(player?.ovr||player?.overall||current);
    const delta=current-base;
    return `${current}${delta?` (${delta>0?'+':''}${delta})`:''}`;
  }

    return Object.freeze({ensurePlayerSeasonSystems,playerSeasonStat,playerSeasonStatus,playerStatusForDay,playerFormMetrics,updateSerieAStandingsFromStoredMatches,currentPlayerOvr,playerOvrLabel});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['player-season-state']=Object.freeze({create});
})();
