/* Domain service: career-state. No DOM, timers, or persistence; state accessors remain live. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: career-state');
  function managerById(id) { return $runtime.state?.managers?.find(m=>m.id===id) || null; }

  function ensureCareerEconomy(){
    if(!$runtime.state) return null;
    $runtime.state.career=$runtime.CareerEngine.normalizeCareer($runtime.state.career,$runtime.CAREER_STARTING_EUROS,$runtime.GAME_CONFIG.startingDivision);
    return $runtime.state.career;
  }

  function seasonPlayerOwner(playerId){
    for(const manager of $runtime.state?.managers||[]){
      const item=(manager.roster||[]).find(p=>String(p.id)===String(playerId));
      if(item) return {manager,item};
    }
    return null;
  }
    return Object.freeze({managerById,ensureCareerEconomy,seasonPlayerOwner});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['career-state']=Object.freeze({create});
})();
