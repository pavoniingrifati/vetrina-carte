(() => {
  'use strict';
  function snapshot(live) {
    return {
      day:live.day,
      matches:live.matches.map(({perfMap,...match})=>match),
      perfEntries:Array.from(live.perfMap.entries()),
      events:live.events,mainEvents:live.mainEvents,bigMatchEvents:live.bigMatchEvents,
      bigMatchIndex:live.bigMatchIndex,lineups:live.lineups,
      phase:live.phase,minute:live.minute,eventIndex:live.eventIndex,
      feed:live.feed||[],allFeed:live.allFeed||[],speed:live.speed||1,
      manualPaused:!!live.manualPaused,reviewComplete:!!live.reviewComplete
    };
  }
  function hydrate(snapshotValue, phase=null) {
    const s=JSON.parse(JSON.stringify(snapshotValue));
    const perfMap=new Map((s.perfEntries||[]).map(([id,perf])=>[String(id),perf]));
    const matches=(s.matches||[]).map(match=>{
      const canonical=perf=>{
        const id=String(perf.playerId);
        if(!perfMap.has(id)) perfMap.set(id,perf);
        return perfMap.get(id);
      };
      const homePerfs=(match.homePerfs||[]).map(canonical);
      const awayPerfs=(match.awayPerfs||[]).map(canonical);
      return {...match,homePerfs,awayPerfs,perfMap:new Map([...homePerfs,...awayPerfs].map(perf=>[String(perf.playerId),perf]))};
    });
    const selectedPhase=phase||s.phase||'bigmatch';
    return {...s,matches,perfMap,phase:selectedPhase,
      phaseEvents:selectedPhase==='multilive'?s.mainEvents||[]:s.bigMatchEvents||[],
      minute:phase?0:Number(s.minute||0),eventIndex:phase?0:Number(s.eventIndex||0),
      feed:phase?[]:s.feed||[],timer:null,finalizing:false,
      speed:s.speed||1,manualPaused:phase?false:!!s.manualPaused,
      autoPauseUntil:0,tvToken:0,voteFlashes:new Map()};
  }
  window.FantaLiveState=Object.freeze({snapshot,hydrate});
})();
