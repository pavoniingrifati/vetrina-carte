/* Responsibility: assistant-policy. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: assistant-policy');
  function scoutStarterBadge(player,day=$runtime.ensureSeasonState()?.currentMatchday){
    const season=$runtime.ensureSeasonState();
    if(!player || !season) return '';
    const scout=$runtime.shopItemActive('scout_plus',season), report=$runtime.starterReportActive(day);
    if(!scout && !report) return '';
    const pct=$runtime.estimatedStarterProbability(player,day);
    const level=pct>=70?'high':pct>=40?'medium':'low';
    const source=scout?'Scout Plus':'Report Titolarità';
    return `<span class="scout-starter-badge ${level} ${report&&!scout?'is-consumable-report':''}" title="${source}: probabilità di titolarità ${pct}%">Tit. ${pct}%</span>`;
  }

  function assistantAutoLineupAnalysisHtml(season=$runtime.ensureSeasonState()){
    const caps=$runtime.assistantAutoLineupCapabilities(season);
    return `<strong>🧠 AUTO XI analizza:</strong><span class="auto-xi-chip on">OVR</span><span class="auto-xi-chip on">Disponibilità</span>${caps.scout?'<span class="auto-xi-chip scout on">Scout Plus · Titolarità</span>':'<span class="auto-xi-chip locked">🔒 Titolarità · Scout Plus</span>'}${caps.fantadata?'<span class="auto-xi-chip data on">FantaData · Forma/Rendimento</span><span class="auto-xi-chip data on">FantaData · Avversario Serie A</span>':'<span class="auto-xi-chip locked">🔒 Forma/Rendimento · FantaData</span><span class="auto-xi-chip locked">🔒 Avversario Serie A · FantaData</span>'}`;
  }

  function buildAdvancedAutoLineup(manager,formationKey){
    if(!$runtime.allowedLineupFormation(formationKey)) formationKey='4-3-3';
    const starters={};
    const counts=$runtime.lineupCountsForFormation(formationKey);
    const blockedId=$runtime.adminBlockedStarterForManager(manager?.id,$runtime.state?.season?.currentMatchday||1);
    ['P','D','C','A'].forEach(role=>{
      const players=(manager.roster||[]).filter(p=>p.role===role && (!blockedId || String(p.id)!==String(blockedId))).slice().sort((a,b)=>{
        const au=$runtime.playerStatusForDay(a.id,$runtime.state?.season?.currentMatchday||1).unavailable?1:0;
        const bu=$runtime.playerStatusForDay(b.id,$runtime.state?.season?.currentMatchday||1).unavailable?1:0;
        return au-bu || $runtime.advancedAutoLineupValue(b)-$runtime.advancedAutoLineupValue(a);
      }).slice(0,counts[role]);
      const slots=$runtime.lineupSlots(formationKey).filter(s=>s.role===role);
      players.forEach((pl,idx)=>{if(slots[idx]) starters[slots[idx].instanceId]=String(pl.id);});
    });
    const used=new Set(Object.values(starters).map(String));
    const bench=(manager.roster||[]).filter(p=>!used.has(String(p.id))).slice().sort((a,b)=>$runtime.advancedAutoLineupValue(b)-$runtime.advancedAutoLineupValue(a)).map(p=>String(p.id));
    const lineup={formation:formationKey,starters,bench,captainId:null,confirmed:true,updatedAt:Date.now()};
    if(blockedId) $runtime.enforcePlayerBenchedInLineup(manager,lineup,blockedId,$runtime.state?.season?.currentMatchday||1);
    if(manager?.id==='user') $runtime.enforceFaithReserveStarterInLineup(manager,lineup,$runtime.state?.season?.currentMatchday||1);
    if(manager?.id==='user' && $runtime.shopItemActive('assistant_tactical_pro')) $runtime.adaptTacticalProLineup(manager,lineup,$runtime.state?.season?.currentMatchday||1);
    return lineup;
  }

  function bestAdvancedFormation(manager){
    return $runtime.availableLineupFormations().map(key=>{
      const built=$runtime.buildAdvancedAutoLineup(manager,key);
      const score=$runtime.shopItemActive('assistant_tactical_pro')?$runtime.tacticalExpectedLineupPoints(manager,built,$runtime.state?.season?.currentMatchday||1):Object.values(built.starters).reduce((sum,id)=>sum+$runtime.advancedAutoLineupValue($runtime.playerMap.get(String(id))||manager.roster.find(p=>String(p.id)===String(id))),0);
      return {key,score};
    }).sort((a,b)=>b.score-a.score)[0]?.key || '4-3-3';
  }
    return Object.freeze({scoutStarterBadge,assistantAutoLineupAnalysisHtml,buildAdvancedAutoLineup,bestAdvancedFormation});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['assistant-policy']=Object.freeze({create});
})();
