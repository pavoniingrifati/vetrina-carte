/* Domain service: cpu-lineup-evaluation. No DOM, timers, or persistence; state accessors remain live. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: cpu-lineup-evaluation');
  function cpuLeagueRuleLineupValue(manager,player,day=$runtime.state?.season?.currentMatchday||1){
    return window.FantaCpuLineupPolicy.playerValue({manager,player,day,state:$runtime.state,lineupPlayerValue:$runtime.lineupPlayerValue,leagueRulesFor:$runtime.leagueRulesFor,cpuLeagueRuleSensitivity:$runtime.cpuLeagueRuleSensitivity,estimatedStarterProbability:$runtime.estimatedStarterProbability,currentPlayerOvr:$runtime.currentPlayerOvr,playerFormMetrics:$runtime.playerFormMetrics,playerSeasonStat:$runtime.playerSeasonStat,serieAMatchupDifficulty:$runtime.serieAMatchupDifficulty,clamp:$runtime.clamp});
  }

    return Object.freeze({cpuLeagueRuleLineupValue});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['cpu-lineup-evaluation']=Object.freeze({create});
})();
