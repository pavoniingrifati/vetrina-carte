/* Domain service: live-state. No DOM, timers, or persistence; state accessors remain live. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: live-state');
  function serieABigMatch(){
    return $runtime.serieALive?.matches?.[$runtime.serieALive.bigMatchIndex]||null;
  }

  function snapshotSerieALive(live) {
    return window.FantaLiveState.snapshot(live);
  }

  function hydrateSerieALive(snapshot, phase=null) {
    return window.FantaLiveState.hydrate(snapshot,phase);
  }

    return Object.freeze({serieABigMatch,snapshotSerieALive,hydrateSerieALive});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['live-state']=Object.freeze({create});
})();
