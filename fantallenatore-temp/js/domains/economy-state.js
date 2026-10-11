/* Domain service: economy-state. No DOM, timers, or persistence; state accessors remain live. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: economy-state');
  function shopItemActive(id,season=$runtime.ensureSeasonState()){
    const purchases=season?.shopPurchases;
    if(purchases?.[id]) return true;
    if(!season || season.completed || !['fantadata_pro','scout_plus','assistant_coach','assistant_tactical_pro'].includes(id)) return false;
    const choice=season.formationChoices?.[String(season.currentMatchday)];
    return !!(choice?.triggered && choice.resolved && choice.selectedOption?.category==='boost' && (choice.selectedOption.effect?.kind==='free_subscriptions' || (id==='scout_plus' && choice.selectedOption.effect?.kind==='free_scout')));
  }

  function ensureConsumableState(season=$runtime.ensureSeasonState()){
    if(!season) return null;
    season.consumables ||= {inventory:{},effects:{},usageHistory:[],purchaseHistory:[]};
    season.consumables.inventory ||= {};
    season.consumables.effects ||= {};
    if(!Array.isArray(season.consumables.usageHistory)) season.consumables.usageHistory=[];
    if(!Array.isArray(season.consumables.purchaseHistory)) season.consumables.purchaseHistory=[];
    return season.consumables;
  }

  function consumableQuantity(id,season=$runtime.ensureSeasonState()){
    const data=ensureConsumableState(season);
    return Math.max(0,Math.floor(Number(data?.inventory?.[id]||0)));
  }

  function consumableDayEffect(day=$runtime.ensureSeasonState()?.currentMatchday,season=$runtime.ensureSeasonState()){
    const data=ensureConsumableState(season);
    const key=String(day||1);
    data.effects[key] ||= {};
    return data.effects[key];
  }

  function formationChoiceRarity(templateId){
    return $runtime.FORMATION_CHOICE_RARITY_BY_TEMPLATE[String(templateId)] || 'common';
  }

    return Object.freeze({shopItemActive,ensureConsumableState,consumableQuantity,consumableDayEffect,formationChoiceRarity});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['economy-state']=Object.freeze({create});
})();
