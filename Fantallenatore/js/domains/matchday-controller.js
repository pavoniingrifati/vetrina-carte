/* Responsibility: matchday-controller. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: matchday-controller');
  function continueMatchdayFromLineup(season,day){
    const pending=$runtime.ensureAllPreMatchEventRolls(day);
    if(pending){
      $runtime.setMatchdayFlowPhase(season,day,'event_pending',{continuedAt:Date.now()});
      $runtime.saveState();
      if(pending.type==='formation') $runtime.renderFormationChoiceModal(pending.entry);
      else $runtime.renderAdminRuleModal(pending.entry);
      return;
    }
    $runtime.setMatchdayFlowPhase(season,day,'match_ready',{continuedAt:Date.now()});
    $runtime.saveState();
    $runtime.showToast(`Giornata ${day} pronta. Puoi modificare ancora la formazione oppure entrare in Diretta Gol.`);
    $runtime.renderSeasonDashboard();
  }

  function handleDashboardPrimaryAction(){
    const season=$runtime.ensureSeasonState();
    if(!season || $runtime.weekendArrivalLoading) return;
    if(season.completed) return $runtime.renderNextSeasonFlow();
    const day=season.currentMatchday||1;
    const round=season.schedule?.[day-1];
    const savedLineup=season.lineups?.[String(day)]?.user;
    const pendingBigMatch=season.pendingBigMatch?.day===day ? season.pendingBigMatch : null;
    const roundPlayed=!!round?.matches?.every(m=>m.played);
    if(pendingBigMatch || roundPlayed || !savedLineup?.confirmed) return;

    const flow=$runtime.ensureMatchdayFlowEntry(season,day);
    if(!flow) return;

    if($runtime.showOpponentMalusNotice(day)) return;

    if(flow.phase==='event_pending'){
      const pending=$runtime.nextPendingMatchdayEvent(day,season);
      if(pending?.type==='formation'){
        $runtime.renderFormationChoiceModal(pending.entry);
        return;
      }
      if(pending?.type==='admin_rule'){
        $runtime.renderAdminRuleModal(pending.entry);
        return;
      }
      $runtime.setMatchdayFlowPhase(season,day,'match_ready',{eventResolvedAt:Date.now()});
      $runtime.saveState();
      $runtime.renderSeasonDashboard();
      return;
    }

    if(flow.phase==='lineup'){
      $runtime.showWeekendArrivalLoading(()=>$runtime.continueMatchdayFromLineup(season,day));
      return;
    }

    if(flow.phase==='match_ready') $runtime.startSerieALiveMatchday();
  }
    return Object.freeze({continueMatchdayFromLineup,handleDashboardPrimaryAction});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['matchday-controller']=Object.freeze({create});
})();
