/* Domain service: season-state. No DOM, timers, or persistence; state accessors remain live. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: season-state');
  function ensureSeasonState() {
    if (!$runtime.state) return null;
    if (!$runtime.state.season || !$runtime.state.season.started) return null;
    if (!Array.isArray($runtime.state.season.schedule) || $runtime.state.season.schedule.length===0) {
      $runtime.state.season.schedule = $runtime.buildFantasySeasonSchedule($runtime.state.managers);
    } else if ($runtime.state.season.schedule.length!==$runtime.FANTASY_SEASON_MATCHDAYS) {
      // Migrazione: conserva tutte le giornate già presenti/giocate e completa il calendario fino a 38.
      $runtime.state.season.schedule = $runtime.buildFantasySeasonSchedule($runtime.state.managers,$runtime.FANTASY_SEASON_MATCHDAYS,$runtime.state.season.schedule);
    }
    if (!Array.isArray($runtime.state.season.standings) || $runtime.state.season.standings.length!==$runtime.state.managers.length) {
      $runtime.state.season.standings = $runtime.freshStandings($runtime.state.managers);
    }
    $runtime.state.season.currentMatchday = $runtime.clamp(Number($runtime.state.season.currentMatchday||1),1,$runtime.FANTASY_SEASON_MATCHDAYS);
    if (!$runtime.state.season.matchdayResults || typeof $runtime.state.season.matchdayResults !== 'object') $runtime.state.season.matchdayResults = {};

    // V2.7.2 migration: ricostruisce i Fantapunti totali dai risultati già giocati
    // per rendere compatibili anche i salvataggi delle versioni precedenti.
    const missingFantasyTotals = $runtime.state.season.standings.some(s=>!Number.isFinite(Number(s.fantasyPoints)));
    if (missingFantasyTotals) {
      $runtime.state.season.standings.forEach(s=>{ s.fantasyPoints=0; });
      Object.values($runtime.state.season.matchdayResults).forEach(dayResult=>{
        (dayResult?.matches||[]).forEach(m=>{
          const h=$runtime.state.season.standings.find(s=>s.managerId===m.homeId);
          const a=$runtime.state.season.standings.find(s=>s.managerId===m.awayId);
          if(h) h.fantasyPoints+=Number(m.homeFantasy||0);
          if(a) a.fantasyPoints+=Number(m.awayFantasy||0);
        });
      });
    }

    if (!$runtime.state.season.lineups || typeof $runtime.state.season.lineups !== 'object') $runtime.state.season.lineups = {};
    if (!$runtime.state.season.dashboardReadyDays || typeof $runtime.state.season.dashboardReadyDays !== 'object') $runtime.state.season.dashboardReadyDays = {};
    if (!$runtime.state.season.matchdayFlow || typeof $runtime.state.season.matchdayFlow !== 'object') $runtime.state.season.matchdayFlow = {};
    if (!Array.isArray($runtime.state.season.newsFeed)) $runtime.state.season.newsFeed = [];
    if (!$runtime.state.season.newsGeneratedDays || typeof $runtime.state.season.newsGeneratedDays !== 'object') $runtime.state.season.newsGeneratedDays = {};
    if (!$runtime.state.season.newsMeta || typeof $runtime.state.season.newsMeta !== 'object') $runtime.state.season.newsMeta = {};
    if (!Array.isArray($runtime.state.season.serieASchedule) || $runtime.state.season.serieASchedule.length !== 38) $runtime.state.season.serieASchedule = buildSerieASchedule();
    if (!$runtime.state.season.serieAResults || typeof $runtime.state.season.serieAResults !== 'object') $runtime.state.season.serieAResults = {};
    if ($runtime.state.season.pendingBigMatch === undefined) $runtime.state.season.pendingBigMatch = null;
    if (!$runtime.state.season.dayPhase) $runtime.state.season.dayPhase = 'ready';
    if (!$runtime.state.season.formationChoices || typeof $runtime.state.season.formationChoices !== 'object') $runtime.state.season.formationChoices = {};
    if (!$runtime.state.season.adminRules || typeof $runtime.state.season.adminRules !== 'object') $runtime.state.season.adminRules = {};
    if (!$runtime.state.season.opponentMalusEvents || typeof $runtime.state.season.opponentMalusEvents !== 'object') $runtime.state.season.opponentMalusEvents = {};
    if(!$runtime.state.season.fantaclassificaActive){
      const activatedEntry=Object.values($runtime.state.season.adminRules).find(entry=>entry?.resolved && entry?.selectedOption?.effect?.ruleId==='fantaclassifica');
      if(activatedEntry){
        $runtime.state.season.fantaclassificaActive=true;
        $runtime.state.season.fantaclassificaActivatedDay=Number(activatedEntry.day||activatedEntry.selectedOption?.effect?.activatedDay||1);
      }
    }
    if (!$runtime.state.season.shopPurchases || typeof $runtime.state.season.shopPurchases !== 'object') $runtime.state.season.shopPurchases = {};
    if (!$runtime.state.season.consumables || typeof $runtime.state.season.consumables !== 'object') $runtime.state.season.consumables = {inventory:{},effects:{},usageHistory:[],purchaseHistory:[]};
    if (!$runtime.state.season.consumables.inventory || typeof $runtime.state.season.consumables.inventory !== 'object') $runtime.state.season.consumables.inventory={};
    if (!$runtime.state.season.consumables.effects || typeof $runtime.state.season.consumables.effects !== 'object') $runtime.state.season.consumables.effects={};
    if (!Array.isArray($runtime.state.season.consumables.usageHistory)) $runtime.state.season.consumables.usageHistory=[];
    if (!Array.isArray($runtime.state.season.consumables.purchaseHistory)) $runtime.state.season.consumables.purchaseHistory=[];
    if($runtime.state.season.sponsor && !$runtime.state.season.sponsor.winRewards) $runtime.state.season.sponsor.winRewards={};
    if (!$runtime.state.season.playerOvrDevelopment || typeof $runtime.state.season.playerOvrDevelopment !== 'object') $runtime.state.season.playerOvrDevelopment = {};
    if (!Array.isArray($runtime.state.season.playerDevelopmentEvents)) $runtime.state.season.playerDevelopmentEvents = [];
    $runtime.ensureSocialState($runtime.state.season);
    if (!$runtime.state.season.assistantCoachLineup || typeof $runtime.state.season.assistantCoachLineup !== 'object') $runtime.state.season.assistantCoachLineup = {enabled:false,formation:null,starters:{},bench:[],updatedAt:0,lastSourceDay:0};
    $runtime.ensureCareerEconomy();
    $runtime.ensurePlayerSeasonSystems($runtime.state.season);
    return $runtime.state.season;
  }

  function buildSerieASchedule() {
    return $runtime.buildDoubleRoundRobin((window.FANTA_CLUBS||[]).map(club=>club.id),$runtime.careerHash);
  }

    return Object.freeze({ensureSeasonState,buildSerieASchedule});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['season-state']=Object.freeze({create});
})();
