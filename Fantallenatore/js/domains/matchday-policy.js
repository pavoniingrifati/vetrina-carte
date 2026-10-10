/* Domain service: matchday-policy. No DOM, timers, or persistence; state accessors remain live. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: matchday-policy');
  function formationChoiceDayState(day=$runtime.ensureSeasonState()?.currentMatchday){
    const season=$runtime.ensureSeasonState();
    if(!season || !day) return null;
    if(!season.formationChoices || typeof season.formationChoices!=='object') season.formationChoices={};
    return season.formationChoices[String(day)]||null;
  }

  function adminRuleDayState(day=$runtime.ensureSeasonState()?.currentMatchday){
    const season=$runtime.ensureSeasonState();
    if(!season || !day) return null;
    if(!season.adminRules || typeof season.adminRules!=='object') season.adminRules={};
    return season.adminRules[String(day)]||null;
  }

  function activeAdminRule(day=$runtime.ensureSeasonState()?.currentMatchday){
    const entry=adminRuleDayState(day);
    return entry?.triggered && entry?.resolved && entry?.selectedOption ? entry.selectedOption : null;
  }

  function activeAdminRuleEffect(day=$runtime.ensureSeasonState()?.currentMatchday){
    return activeAdminRule(day)?.effect || null;
  }

  function hashPick(list,key){
    if(!list?.length) return null;
    const idx=Math.floor($runtime.careerHash(`formation-choice|${key}`)*list.length)%list.length;
    return list[idx]||list[0];
  }

  function sortedByChoiceHash(list,key){
    return list.slice().sort((a,b)=>{
      const av=$runtime.careerHash(`formation-choice|${key}|${a.id}`);
      const bv=$runtime.careerHash(`formation-choice|${key}|${b.id}`);
      return av-bv || String(a.name).localeCompare(String(b.name),'it');
    });
  }

  function formationChoiceContextForManagers(day, ownManagerId='user', opponentManagerId=$runtime.userOpponentIdForDay(day), salt='base'){
    const season=$runtime.ensureSeasonState();
    const round=season?.schedule?.[Number(day)-1];
    const fixture=round?.matches?.find(m=>
      (String(m.homeId)===String(ownManagerId) && String(m.awayId)===String(opponentManagerId)) ||
      (String(m.awayId)===String(ownManagerId) && String(m.homeId)===String(opponentManagerId))
    ) || $runtime.currentUserFixture();
    const user=$runtime.managerById(ownManagerId);
    const opponent=$runtime.managerById(opponentManagerId);
    const userRoster=(user?.roster||[]).filter(p=>!$runtime.playerStatusForDay(p.id,day).unavailable);
    const oppRoster=(opponent?.roster||[]).filter(p=>!$runtime.playerStatusForDay(p.id,day).unavailable);

    const pickFrom=(base,key,filter)=>{
      let pool=base.filter(p=>!filter || filter(p));
      if(!pool.length) pool=base.slice();
      const seededKey=`S${$runtime.state?.career?.seasonNumber||1}|G${day}|${ownManagerId}|${salt}|${key}`;
      return hashPick(sortedByChoiceHash(pool,seededKey),seededKey);
    };
    const pickFromStrict=(base,key,filter)=>{
      const pool=base.filter(p=>!filter || filter(p));
      if(!pool.length) return null;
      const seededKey=`S${$runtime.state?.career?.seasonNumber||1}|G${day}|${ownManagerId}|${salt}|${key}`;
      return hashPick(sortedByChoiceHash(pool,seededKey),seededKey);
    };

    return {
      day,fixture,oppId:String(opponentManagerId||''),user,opponent,
      pickOwn:(key,filter=null)=>pickFrom(userRoster,key,filter),
      pickOpponent:(key,filter=null)=>pickFrom(oppRoster,key,filter),
      pickOwnStrict:(key,filter=null)=>pickFromStrict(userRoster,key,filter),
      pickOpponentStrict:(key,filter=null)=>pickFromStrict(oppRoster,key,filter)
    };
  }

  function specialRivalManager(manager){
    const id=String(manager?.profile?.archetype||manager?.profile?.id||manager?.id||'');
    return id==='admin' || $runtime.SPECIAL_RIVAL_IDS.includes(id);
  }

  function opponentMalusDayState(day=$runtime.ensureSeasonState()?.currentMatchday){
    const season=$runtime.ensureSeasonState();
    if(!season) return null;
    if(!season.opponentMalusEvents || typeof season.opponentMalusEvents!=='object') season.opponentMalusEvents={};
    return season.opponentMalusEvents[String(day)]||null;
  }

  function opponentMalusChanceForManager(manager, division=$runtime.state?.career?.division||$runtime.GAME_CONFIG.startingDivision){
    const level=Math.max(1,Math.floor(Number(division||$runtime.GAME_CONFIG.startingDivision)));
    if(!manager || String(manager.id)==='user') return 0;
    const isSpecial=specialRivalManager(manager);
    if(level===3) return isSpecial ? .12 : 0;
    if(level<=2) return isSpecial ? .20 : .12;
    return 0;
  }

  function generateOpponentMalusOption(day, opponentManager, salt='cpu-malus'){
    const ctx=formationChoiceContextForManagers(day, opponentManager?.id, 'user', `${salt}|${opponentManager?.id||'cpu'}`);
    if(!ctx.user || !ctx.opponent) return null;
    const templates=$runtime.FORMATION_CHOICE_TEMPLATES
      .filter(template=>template.category==='malus')
      .map(template=>({template, rarity:$runtime.formationChoiceRarity(template.id), roll:$runtime.careerHash(`opponent-malus|${day}|${opponentManager?.id||'cpu'}|${template.id}`)}))
      .sort((a,b)=>a.roll-b.roll || String(a.template.id).localeCompare(String(b.template.id),'it'));
    for(let i=0;i<templates.length;i++){
      const built=templates[i].template.build(ctx,i);
      if(built){
        built.rarity=templates[i].rarity;
        return built;
      }
    }
    return null;
  }

  function ensureOpponentMalusRoll(day){
    const season=$runtime.ensureSeasonState();
    if(!season || !day) return null;
    if(!season.opponentMalusEvents || typeof season.opponentMalusEvents!=='object') season.opponentMalusEvents={};
    const key=String(day);
    let entry=season.opponentMalusEvents[key];
    if(entry?.rolled) return entry;

    const opponentId=$runtime.userOpponentIdForDay(day);
    const opponent=$runtime.managerById(opponentId);
    const division=Math.max(1,Math.floor(Number($runtime.state?.career?.division||$runtime.GAME_CONFIG.startingDivision)));
    const chance=opponentMalusChanceForManager(opponent, division);
    const roll=$runtime.careerHash(`opponent-malus-trigger|D${division}|G${day}|${opponentId||'none'}`);
    const triggered=roll<chance;
    // Target availability reads the active malus. While selecting its target,
    // the same day's malus does not exist yet and must not generate itself.
    if($runtime.opponentMalusRollsInProgress.has(key)) return null;
    let option=null;
    $runtime.opponentMalusRollsInProgress.add(key);
    try{
      option=triggered ? generateOpponentMalusOption(day, opponent, `cpu-malus|D${division}`) : null;
    }finally{
      $runtime.opponentMalusRollsInProgress.delete(key);
    }
    entry={
      day,
      rolled:true,
      opponentId:opponentId||null,
      opponentLabel:opponent?.profile?.label || opponent?.team || 'Avversario',
      triggerChance:chance,
      roll,
      triggered:!!option && triggered,
      resolved:true,
      selectedOption:option ? {
        ...option,
        cpuMalus:true,
        cpuLabel:opponent?.profile?.label || opponent?.team || 'Avversario',
        text:`${opponent?.profile?.label || opponent?.team || 'Avversario'} ti lancia un malus: ${String(option.text||'').replace(/^.+?[, ]+del tuo prossimo avversario,? ?/i,'').replace(/^.+? parte con /i,'Parte con ')}`
      } : null,
      createdAt:Date.now()
    };
    season.opponentMalusEvents[key]=entry;
    $runtime.onMatchdayEventsChanged();
    return entry;
  }

  function activeOpponentMalus(day=$runtime.ensureSeasonState()?.currentMatchday){
    const entry=opponentMalusDayState(day) || ensureOpponentMalusRoll(day);
    return entry?.triggered && entry?.selectedOption ? entry.selectedOption : null;
  }

  function adminBlockedStarterForManager(managerId,day=$runtime.ensureSeasonState()?.currentMatchday){
    const effect=activeAdminRuleEffect(day);
    if(effect?.ruleId!=='top_player_bench') return null;
    if(String(managerId)==='user') return effect.userPlayerId?String(effect.userPlayerId):null;
    if(String(managerId)===String(effect.opponentId||'')) return effect.opponentPlayerId?String(effect.opponentPlayerId):null;
    return null;
  }

  function activeFormationChoice(day=$runtime.ensureSeasonState()?.currentMatchday){
    const entry=formationChoiceDayState(day);
    const option=entry?.triggered && entry?.resolved && entry?.selectedOption ? entry.selectedOption : null;
    if(!option) return null;
    // Le categorie TATTICA e CAMBIO REGOLA sono state rimosse dalle carte normali.
    if(option.category==='tactic' || option.category==='rule') return null;
    return option;
  }

  function tacticForManager(day,managerId){
    if(managerId!=='user') return null;
    const ruleId=activeAdminRuleEffect(day)?.ruleId || null;
    if(ruleId==='extra_subs_7') return 'extra_subs';
    if(ruleId==='wildcard_sub') return 'wildcard_sub';
    if(ruleId==='best_bench') return 'best_bench';
    return null;
  }

  function riskAdjustmentForPerformance(perf,day){
    const choice=activeFormationChoice(day);
    const effect=choice?.effect;
    if(!effect || String(effect.targetPlayerId||'')!==String(perf?.playerId||'')) return 0;

    if(effect.kind==='risk_vote'){
      if(perf?.noVote || perf?.vote===null || perf?.vote===undefined) return Number(effect.penalty||0);
      return Number(perf.vote)>=Number(effect.threshold||6.5)
        ? Number(effect.reward||0)
        : Number(effect.penalty||0);
    }

    if(effect.kind==='risk_goal'){
      return Number(perf?.goals||0)>0 ? Number(effect.reward||0) : Number(effect.penalty||0);
    }

    return 0;
  }

  function fantasyRuleForDay(day){
    const league=$runtime.leagueRulesFor($runtime.state);
    const base={
      goalBonus:3,
      assistBonus:1,
      yellowMalus:.5,
      redMalus:1,
      ownGoalMalus:2,
      missedPenaltyMalus:3,
      savedPenaltyBonus:3,
      goalConcededMalus:1,
      cleanSheetBonus:Number(league.cleanSheetBonus||0),
      decisiveGoalBonus:!!league.decisiveGoalBonus,
      captainBonus:league.captainBonus,
      defenseModifier:league.defenseModifier==='classic'?'classic':'off',
      firstGoalThreshold:$runtime.clamp(Number(league.firstGoalThreshold||66),65,67),
      goalStep:6,
      minVoteMinutes:$runtime.SERIEA_MIN_VOTE_MINUTES,
      maxFantasySubs:[1,3,5].includes(Number(league.maxFantasySubs))?Number(league.maxFantasySubs):$runtime.FANTASY_MAX_SUBS
    };
    // Gli eventi Admin della singola giornata possono sovrascrivere temporaneamente
    // il regolamento stagionale sorteggiato prima dell'asta.
    const adminRuleId=activeAdminRuleEffect(day)?.ruleId || null;
    base.cesarini=adminRuleId==='cesarini';
    if(adminRuleId==='no_substitutions') base.maxFantasySubs=0;
    if(adminRuleId==='goal_threshold_76') base.firstGoalThreshold=76;

    return base;
  }

  function starterReportActive(day=$runtime.ensureSeasonState()?.currentMatchday){
    return !!$runtime.consumableDayEffect(day)?.starterReport;
  }

  function specialTrainingPlayerIds(day=$runtime.ensureSeasonState()?.currentMatchday){
    const effect=$runtime.consumableDayEffect(day);
    const ids=[];
    if(Array.isArray(effect?.trainingPlayerIds)) ids.push(...effect.trainingPlayerIds.map(String));
    if(effect?.trainingPlayerId) ids.push(String(effect.trainingPlayerId));
    return [...new Set(ids.filter(Boolean))];
  }

  function specialTrainingUsedForPlayer(day,playerId){
    return specialTrainingPlayerIds(day).includes(String(playerId||''));
  }

  function worldPlayerModifier(day,playerId){
    const targetId=String(playerId||'');
    const choice=activeFormationChoice(day);
    const effect=choice?.effect;
    const cpuEffect=typeof activeOpponentMalus==='function' ? activeOpponentMalus(day)?.effect : null;
    let merged=null;
    if(effect?.kind==='world_player' && String(effect.targetPlayerId||'')===targetId) merged={...effect};
    if(cpuEffect?.kind==='world_player' && String(cpuEffect.targetPlayerId||'')===targetId) merged={...(merged||{}), ...cpuEffect};
    const surprise=$runtime.expertDayState(day)?.boosts.find(boost=>boost.playerId===targetId);
    if(surprise){
      merged ||= {kind:'world_player',targetPlayerId:targetId};
      const large=surprise.size==='large';
      if(surprise.kind==='starter') merged.starterScoreDelta=Number(merged.starterScoreDelta||0)+(large?8:3);
      if(surprise.kind==='vote') merged.voteDelta=Number(merged.voteDelta||0)+(large?.55:.25);
      if(surprise.kind==='goal') merged.goalMultiplier=Number(merged.goalMultiplier||1)*(large?1.65:1.25);
      if(surprise.kind==='assist') merged.assistMultiplier=Number(merged.assistMultiplier||1)*(large?1.65:1.25);
    }
    if(specialTrainingUsedForPlayer(day,targetId)){
      merged ||= {kind:'world_player',targetPlayerId:targetId};
      merged.voteDelta=Number(merged.voteDelta||0)+.25;
      merged.goalMultiplier=Number(merged.goalMultiplier||1)*1.10;
      merged.assistMultiplier=Number(merged.assistMultiplier||1)*1.10;
    }
    return merged;
  }

  function formationPlayerModifier(day,playerId,kind){
    const targetId=String(playerId||'');
    const userEffect=activeFormationChoice(day)?.effect;
    const cpuEffect=typeof activeOpponentMalus==='function' ? activeOpponentMalus(day)?.effect : null;
    const effects=[userEffect,cpuEffect].filter(Boolean);
    for(const effect of effects){
      if(String(effect.targetPlayerId||'')!==targetId) continue;
      if(effect.kind===kind) return effect;
    }
    return null;
  }

    return Object.freeze({formationChoiceDayState,adminRuleDayState,activeAdminRule,activeAdminRuleEffect,hashPick,sortedByChoiceHash,formationChoiceContextForManagers,specialRivalManager,opponentMalusDayState,opponentMalusChanceForManager,generateOpponentMalusOption,ensureOpponentMalusRoll,activeOpponentMalus,adminBlockedStarterForManager,activeFormationChoice,tacticForManager,riskAdjustmentForPerformance,fantasyRuleForDay,starterReportActive,specialTrainingPlayerIds,specialTrainingUsedForPlayer,worldPlayerModifier,formationPlayerModifier});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['matchday-policy']=Object.freeze({create});
})();
