/* Domain service: lineup-evaluation. No DOM, timers, or persistence; state accessors remain live. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: lineup-evaluation');
  function lineupSlots(key) {
    return $runtime.LINEUP_FORMATIONS[key] || $runtime.LINEUP_FORMATIONS['4-3-3'];
  }

  function lineupRequiredStarters(formation){
    return lineupSlots(formation).length;
  }

  function lineupCountsForFormation(key) {
    return lineupSlots(key).reduce((acc,s)=>(acc[s.role]=(acc[s.role]||0)+1,acc),{P:0,D:0,C:0,A:0});
  }

  function lineupPlayerValue(player) {
    const form=$runtime.playerFormMetrics(player?.id);
    const status=$runtime.playerStatusForDay(player?.id,$runtime.state?.season?.currentMatchday||1);
    const statusPenalty=status.unavailable?-4500:0;
    return $runtime.currentPlayerOvr(player) * 100 + Number(player?.fvm || 0) * .2 + Number(player?.quotation || 0) * .1 + form.score*160 + statusPenalty;
  }

    return Object.freeze({lineupSlots,lineupRequiredStarters,lineupCountsForFormation,lineupPlayerValue});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['lineup-evaluation']=Object.freeze({create});
})();
