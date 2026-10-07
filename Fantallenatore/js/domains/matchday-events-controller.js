/* Responsibility: matchday-events-controller. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: matchday-events-controller');
  function formationChoiceCategoryLabel(category){
    return ({boost:'BOOST',malus:'MALUS AVVERSARIO',risk:'RISCHIO',locker:'SPOGLIATOIO',admin:'ADMIN',rule:'ADMIN'})[category]||'SCELTA';
  }

  function formationChoiceCategoryClass(category){
    if(category==='admin') return 'rule';
    return ['boost','malus','risk','locker','rule'].includes(category)?category:'rule';
  }

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
    const entry=$runtime.adminRuleDayState(day);
    return entry?.triggered && entry?.resolved && entry?.selectedOption ? entry.selectedOption : null;
  }

  function activeAdminRuleEffect(day=$runtime.ensureSeasonState()?.currentMatchday){
    return $runtime.activeAdminRule(day)?.effect || null;
  }

  function hasPendingMatchdayEvent(day=$runtime.ensureSeasonState()?.currentMatchday, season=$runtime.ensureSeasonState()){
    if(!season || !day) return false;
    const key=String(day);
    const formation=season.formationChoices?.[key];
    if(formation?.triggered && !formation.resolved) return true;
    const admin=season.adminRules?.[key];
    if(admin?.triggered && !admin.resolved) return true;
    return false;
  }

  function nextPendingMatchdayEvent(day=$runtime.ensureSeasonState()?.currentMatchday, season=$runtime.ensureSeasonState()){
    if(!season || !day) return null;
    const key=String(day);
    const formation=season.formationChoices?.[key];
    if(formation?.triggered && !formation.resolved) return {type:'formation',entry:formation};
    const admin=season.adminRules?.[key];
    if(admin?.triggered && !admin.resolved) return {type:'admin_rule',entry:admin};
    return null;
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

  function isDerbyFixtureForPlayer(player,day=$runtime.ensureSeasonState()?.currentMatchday||1){
    const fixture=$runtime.serieAFixtureForPlayer(player,day);
    if(!fixture) return false;
    const pair=[String(player.club),String(fixture.opponentClub)].sort().join('|');
    return $runtime.SERIEA_DERBY_PAIRS.has(pair);
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
      return $runtime.hashPick($runtime.sortedByChoiceHash(pool,seededKey),seededKey);
    };
    const pickFromStrict=(base,key,filter)=>{
      const pool=base.filter(p=>!filter || filter(p));
      if(!pool.length) return null;
      const seededKey=`S${$runtime.state?.career?.seasonNumber||1}|G${day}|${ownManagerId}|${salt}|${key}`;
      return $runtime.hashPick($runtime.sortedByChoiceHash(pool,seededKey),seededKey);
    };

    return {
      day,fixture,oppId:String(opponentManagerId||''),user,opponent,
      pickOwn:(key,filter=null)=>pickFrom(userRoster,key,filter),
      pickOpponent:(key,filter=null)=>pickFrom(oppRoster,key,filter),
      pickOwnStrict:(key,filter=null)=>pickFromStrict(userRoster,key,filter),
      pickOpponentStrict:(key,filter=null)=>pickFromStrict(oppRoster,key,filter)
    };
  }

  function fantasyAppearanceRate(playerId,day){
    const results=$runtime.state?.season?.matchdayResults||{};
    let played=0,total=0;
    for(let previous=1;previous<Number(day||1);previous++){
      const result=results[String(previous)];
      if(!result)continue;
      const fixture=(result.matches||[]).find(m=>m.homeId==='user'||m.awayId==='user');
      if(!fixture)continue;
      total++;
      const performances=fixture.homeId==='user'?fixture.homePerformances:fixture.awayPerformances;
      if((performances||[]).some(p=>String(p.playerId)===String(playerId) && !p.noVote && p.lineupSource==='starter'))played++;
    }
    return total?played/total:0;
  }

  function formationChoiceContext(day,salt='base'){
    return $runtime.formationChoiceContextForManagers(day,'user',$runtime.userOpponentIdForDay(day),salt);
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
    const isSpecial=$runtime.specialRivalManager(manager);
    if(level===3) return isSpecial ? .12 : 0;
    if(level<=2) return isSpecial ? .20 : .12;
    return 0;
  }

  function generateOpponentMalusOption(day, opponentManager, salt='cpu-malus'){
    const ctx=$runtime.formationChoiceContextForManagers(day, opponentManager?.id, 'user', `${salt}|${opponentManager?.id||'cpu'}`);
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
    const chance=$runtime.opponentMalusChanceForManager(opponent, division);
    const roll=$runtime.careerHash(`opponent-malus-trigger|D${division}|G${day}|${opponentId||'none'}`);
    const triggered=roll<chance;
    // Target availability reads the active malus. While selecting its target,
    // the same day's malus does not exist yet and must not generate itself.
    if($runtime.opponentMalusRollsInProgress.has(key)) return null;
    let option=null;
    $runtime.opponentMalusRollsInProgress.add(key);
    try{
      option=triggered ? $runtime.generateOpponentMalusOption(day, opponent, `cpu-malus|D${division}`) : null;
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
    $runtime.saveState();
    return entry;
  }

  function activeOpponentMalus(day=$runtime.ensureSeasonState()?.currentMatchday){
    const entry=$runtime.opponentMalusDayState(day) || $runtime.ensureOpponentMalusRoll(day);
    return entry?.triggered && entry?.selectedOption ? entry.selectedOption : null;
  }

  function generateFormationChoiceOptions(day,salt='base'){
    const ctx=$runtime.formationChoiceContext(day,salt);
    if(!ctx.user || !ctx.opponent) return [];

    // Ordine deterministico ma pesato per rarità. Il power-up Cacciatore di rarità
    // aumenta il peso di Rare ed Epiche senza garantire una carta specifica.
    const templates=$runtime.deterministicFormationTemplateOrder(day,salt);

    const options=[];
    const usedIds=new Set();
    const usedTargets=new Set();

    for(let i=0;i<templates.length && options.length<3;i++){
      const entry=templates[i];
      const built=entry.template.build(ctx,options.length);
      if(built) built.rarity=entry.rarity;
      if(!built || usedIds.has(built.id)) continue;

      // Evita tre carte quasi identiche sullo stesso calciatore.
      const target=built.effect?.targetPlayerId;
      if(target && usedTargets.has(String(target)) && i<templates.length-3) continue;

      options.push(built);
      usedIds.add(built.id);
      if(target) usedTargets.add(String(target));
    }

    return options.slice(0,3);
  }

  function sanitizeLockedFormationChoiceEntry(entry,day){
    if(!entry?.triggered || entry.resolved || $runtime.formationRaritiesUnlocked()) return entry;
    if(!(entry.options||[]).some(option=>option?.rarity==='rare'||option?.rarity==='epic')) return entry;
    const count=Math.max(0,Number(entry.rerollCount||0));
    entry.options=$runtime.generateFormationChoiceOptions(day,count?`reroll-${count}`:'base');
    entry.selectedId=null;
    entry.selectedOption=null;
    $runtime.saveState();
    return entry;
  }

  function adminRuleRarityProfile(division=$runtime.state?.career?.division||$runtime.GAME_CONFIG.startingDivision){
    const value=Math.max(1,Math.floor(Number(division||$runtime.GAME_CONFIG.startingDivision)));
    return $runtime.ADMIN_RULE_RARITY_PROFILES[value] || $runtime.ADMIN_RULE_RARITY_PROFILES[1];
  }

  function generateAdminRuleOption(day,salt='base',excludeId=null){
    const eligible=$runtime.ADMIN_RULE_TEMPLATES.map(template=>{
      const option=template.build(day);
      if(!option) return null;
      option.rarity=template.rarity||'common';
      option.templateId=template.id;
      return option;
    }).filter(Boolean).filter(option=>!excludeId||String(option.id)!==String(excludeId));
    if(!eligible.length) return null;

    const groups={
      common:eligible.filter(option=>option.rarity==='common'),
      rare:eligible.filter(option=>option.rarity==='rare'),
      epic:eligible.filter(option=>option.rarity==='epic')
    };
    const profile=$runtime.adminRuleRarityProfile();
    const rarities=['common','rare','epic'].filter(rarity=>groups[rarity].length && Number(profile[rarity]||0)>0);
    if(!rarities.length) return null;

    const total=rarities.reduce((sum,rarity)=>sum+Number(profile[rarity]||0),0);
    const roll=$runtime.careerHash(`admin-rule-rarity|D${$runtime.state?.career?.division||$runtime.GAME_CONFIG.startingDivision}|${day}|${salt}`)*total;
    let cursor=0,selectedRarity=rarities[0];
    for(const rarity of rarities){
      cursor+=Number(profile[rarity]||0);
      if(roll<cursor){selectedRarity=rarity;break;}
    }
    const pool=groups[selectedRarity];
    return $runtime.sortedByChoiceHash(pool,`admin-rule-pick|${day}|${salt}|${selectedRarity}`)[0] || pool[0];
  }

  function ensureAdminRuleRoll(day){
    const season=$runtime.ensureSeasonState();
    if(!season) return null;
    const key=String(day);
    if(!season.adminRules || typeof season.adminRules!=='object') season.adminRules={};
    let entry=season.adminRules[key];
    if(entry?.rolled) return entry;

    const roll=$runtime.careerHash(`admin-rule-trigger|${day}`);
    const chance=$runtime.ADMIN_RULE_EVENT_CHANCE;
    const triggered=roll<chance;
    const option=triggered?$runtime.generateAdminRuleOption(day):null;
    entry={
      day,
      rolled:true,
      roll,
      triggerChance:chance,
      triggered:!!option && triggered,
      resolved:!(!!option && triggered),
      selectedId:null,
      selectedOption:option,
      createdAt:Date.now()
    };
    season.adminRules[key]=entry;
    $runtime.saveState();
    return entry;
  }

  function ensureAllPreMatchEventRolls(day){
    $runtime.ensureFormationChoiceRoll(day);
    $runtime.ensureAdminRuleRoll(day);
    $runtime.ensureOpponentMalusRoll(day);
    return $runtime.nextPendingMatchdayEvent(day);
  }

  function forcedFormationRuleForDay(day=$runtime.ensureSeasonState()?.currentMatchday){
    const effect=$runtime.activeAdminRuleEffect(day);
    return effect?.ruleId==='forced_formation' || effect?.ruleId==='butterfly_555' ? String(effect.formation||'') : null;
  }

  function adminForcedStarterForManager(managerId,day=$runtime.ensureSeasonState()?.currentMatchday){
    const effect=$runtime.activeAdminRuleEffect(day);
    if(effect?.ruleId!=='forced_starter_pair') return null;
    if(String(managerId)==='user') return effect.userPlayerId?String(effect.userPlayerId):null;
    if(String(managerId)===String(effect.opponentId||'')) return effect.opponentPlayerId?String(effect.opponentPlayerId):null;
    return null;
  }

  function adminBenchableTopPlayer(manager,day=$runtime.ensureSeasonState()?.currentMatchday){
    if(!manager) return null;
    const available=(manager.roster||[]).filter(player=>!$runtime.playerStatusForDay(player.id,day).unavailable);
    const ranked=available.slice().sort((a,b)=>$runtime.currentPlayerOvr(b)-$runtime.currentPlayerOvr(a) || Number(b.fvm||0)-Number(a.fvm||0) || String(a.name).localeCompare(String(b.name),'it'));
    return ranked.find(player=>available.some(candidate=>String(candidate.id)!==String(player.id) && candidate.role===player.role)) || null;
  }

  function previousUnusedBenchEligibleIds(day=$runtime.ensureSeasonState()?.currentMatchday){
    const season=$runtime.ensureSeasonState(), user=$runtime.managerById('user');
    const currentDay=Number(day||0), prevDay=currentDay-1;
    if(!season || !user || prevDay<1) return [];
    const previousResult=season.matchdayResults?.[String(prevDay)];
    const previousLineup=season.lineups?.[String(prevDay)]?.user;
    const benchIds=(Array.isArray(previousResult?.userBenchIds)?previousResult.userBenchIds:previousLineup?.bench||[]).map(String);
    if(!benchIds.length) return [];
    const userMatch=(previousResult?.matches||[]).find(match=>match.homeId==='user'||match.awayId==='user');
    const substitutions=userMatch ? (userMatch.homeId==='user'?userMatch.homeSubstitutions:userMatch.awaySubstitutions)||[] : [];
    const entered=new Set(substitutions.map(sub=>String(sub.inPlayerId||''))); 
    const rosterIds=new Set((user.roster||[]).map(player=>String(player.id)));
    return benchIds.filter((id,index)=>benchIds.indexOf(id)===index && rosterIds.has(id) && !entered.has(id) && !$runtime.playerStatusForDay(id,currentDay).unavailable);
  }

  function adminBlockedStarterForManager(managerId,day=$runtime.ensureSeasonState()?.currentMatchday){
    const effect=$runtime.activeAdminRuleEffect(day);
    if(effect?.ruleId!=='top_player_bench') return null;
    if(String(managerId)==='user') return effect.userPlayerId?String(effect.userPlayerId):null;
    if(String(managerId)===String(effect.opponentId||'')) return effect.opponentPlayerId?String(effect.opponentPlayerId):null;
    return null;
  }

  function adminFaithReserveEligibleIds(day=$runtime.ensureSeasonState()?.currentMatchday){
    const effect=$runtime.activeAdminRuleEffect(day);
    if(effect?.ruleId!=='faith_reserve') return [];
    return (effect.eligiblePlayerIds||[]).map(String);
  }

  function adminWildcardStartingSlotLimit(day=$runtime.ensureSeasonState()?.currentMatchday){
    const effect=$runtime.activeAdminRuleEffect(day);
    if(effect?.ruleId==='double_wildcard_starting_slot') return 2;
    if(effect?.ruleId==='wildcard_starting_slot') return 1;
    return $runtime.state?.season?.sponsor?.id==='fantacana' ? 1 : 0;
  }

  function wildcardSlotCompatible(playerRole,slotRole){
    const p=String(playerRole||''), s=String(slotRole||'');
    if(!p || !s || p===s) return false;
    if(p==='P' || s==='P') return false;
    if($runtime.state?.season?.sponsor?.id==='fantacana') return ['D','C','A'].includes(p) && ['D','C','A'].includes(s);
    return (p==='D'&&s==='C') || (p==='C'&&s==='D') || (p==='C'&&s==='A') || (p==='A'&&s==='C');
  }

  function lineupOutOfRoleEntries(lineup,manager=$runtime.managerById('user')){
    if(!lineup || !manager) return [];
    const slots=new Map($runtime.lineupSlots(lineup.formation).map(slot=>[slot.instanceId,slot]));
    return Object.entries(lineup.starters||{}).map(([slotId,playerId])=>{
      const slot=slots.get(slotId);
      const player=(manager.roster||[]).find(p=>String(p.id)===String(playerId));
      if(!slot || !player || player.role===slot.role) return null;
      return {slotId,playerId:String(player.id),playerRole:player.role,slotRole:slot.role,player};
    }).filter(Boolean);
  }

  function canPlacePlayerInLineupSlot(player,slot,lineup=$runtime.lineupDraft,day=$runtime.ensureSeasonState()?.currentMatchday){
    if(!player || !slot) return false;
    const blockedId=$runtime.adminBlockedStarterForManager('user',day);
    if(blockedId && String(player.id)===String(blockedId)) return false;
    if(player.role===slot.role) return true;
    const wildcardLimit=$runtime.adminWildcardStartingSlotLimit(day);
    if(wildcardLimit<=0) return false;
    if(!$runtime.wildcardSlotCompatible(player.role,slot.role)) return false;
    const mismatches=$runtime.lineupOutOfRoleEntries(lineup).filter(entry=>entry.slotId!==slot.instanceId && String(entry.playerId)!==String(player.id));
    return mismatches.length<wildcardLimit;
  }

  function enforceStarterInLineup(manager,lineup,playerId){
    if(!manager || !lineup || !playerId) return lineup;
    const forced=(manager.roster||[]).find(player=>String(player.id)===String(playerId));
    if(!forced) return lineup;
    const forcedId=String(forced.id);
    if(Object.values(lineup.starters||{}).map(String).includes(forcedId)) return lineup;
    const roleSlots=$runtime.lineupSlots(lineup.formation).filter(slot=>slot.role===forced.role);
    if(!roleSlots.length) return lineup;
    const targetSlot=roleSlots.slice().sort((a,b)=>{
      const pa=(manager.roster||[]).find(p=>String(p.id)===String(lineup.starters?.[a.instanceId]||''));
      const pb=(manager.roster||[]).find(p=>String(p.id)===String(lineup.starters?.[b.instanceId]||''));
      return $runtime.lineupPlayerValue(pa)-$runtime.lineupPlayerValue(pb);
    })[0];
    if(!targetSlot) return lineup;
    const displaced=lineup.starters?.[targetSlot.instanceId]?String(lineup.starters[targetSlot.instanceId]):null;
    lineup.starters[targetSlot.instanceId]=forcedId;
    lineup.bench=(lineup.bench||[]).map(String).filter(id=>id!==forcedId && id!==displaced);
    if(displaced) lineup.bench.unshift(displaced);
    lineup.confirmed=true;
    lineup.updatedAt=Date.now();
    return lineup;
  }

  function enforceAdminLastReserve(lineup,managerId,day=$runtime.state?.season?.currentMatchday){
    const id=String($runtime.adminBlockedStarterForManager(managerId,day)||'');
    if(!id || !lineup || Object.values(lineup.starters||{}).map(String).includes(id)) return lineup;
    lineup.bench=(lineup.bench||[]).map(String).filter(item=>item!==id);
    lineup.bench.push(id);
    return lineup;
  }

  function enforcePlayerBenchedInLineup(manager,lineup,playerId,day=$runtime.ensureSeasonState()?.currentMatchday){
    if(!manager || !lineup || !playerId) return lineup;
    const blockedId=String(playerId);
    const entry=Object.entries(lineup.starters||{}).find(([,id])=>String(id)===blockedId);
    if(!entry) return $runtime.enforceAdminLastReserve(lineup,manager.id,day);
    const blocked=(manager.roster||[]).find(player=>String(player.id)===blockedId);
    if(!blocked) return lineup;
    const used=new Set(Object.values(lineup.starters||{}).map(String));
    const candidates=(manager.roster||[]).filter(player=>player.role===blocked.role && String(player.id)!==blockedId && !used.has(String(player.id)) && !$runtime.playerStatusForDay(player.id,day).unavailable).sort((a,b)=>{
      const av=manager.id==='user'?$runtime.lineupPlayerValue(a):$runtime.cpuLeagueRuleLineupValue(manager,a,day);
      const bv=manager.id==='user'?$runtime.lineupPlayerValue(b):$runtime.cpuLeagueRuleLineupValue(manager,b,day);
      return bv-av;
    });
    const replacement=candidates[0];
    if(!replacement) return lineup;
    const [slotId]=entry, replacementId=String(replacement.id);
    lineup.starters[slotId]=replacementId;
    lineup.bench=(lineup.bench||[]).map(String).filter(id=>id!==replacementId && id!==blockedId);
    lineup.bench.push(blockedId);
    if(String(lineup.captainId||'')===blockedId) lineup.captainId=null;
    lineup.confirmed=true;
    lineup.updatedAt=Date.now();
    return lineup;
  }

  function enforceFaithReserveStarterInLineup(manager,lineup,day=$runtime.ensureSeasonState()?.currentMatchday){
    if(!manager || manager.id!=='user' || !lineup) return lineup;
    const eligible=new Set($runtime.adminFaithReserveEligibleIds(day));
    if(!eligible.size) return lineup;
    const starterIds=Object.values(lineup.starters||{}).map(String);
    if(starterIds.some(id=>eligible.has(id))) return lineup;
    const candidates=(manager.roster||[]).filter(player=>eligible.has(String(player.id)) && !$runtime.playerStatusForDay(player.id,day).unavailable).sort((a,b)=>$runtime.lineupPlayerValue(b)-$runtime.lineupPlayerValue(a));
    const reserve=candidates[0];
    if(!reserve) return lineup;
    const roleSlots=$runtime.lineupSlots(lineup.formation).filter(slot=>slot.role===reserve.role && lineup.starters?.[slot.instanceId]);
    if(!roleSlots.length) return lineup;
    const targetSlot=roleSlots.slice().sort((a,b)=>{
      const pa=(manager.roster||[]).find(player=>String(player.id)===String(lineup.starters[a.instanceId]));
      const pb=(manager.roster||[]).find(player=>String(player.id)===String(lineup.starters[b.instanceId]));
      return $runtime.lineupPlayerValue(pa)-$runtime.lineupPlayerValue(pb);
    })[0];
    const displaced=String(lineup.starters[targetSlot.instanceId]||'');
    const reserveId=String(reserve.id);
    lineup.starters[targetSlot.instanceId]=reserveId;
    lineup.bench=(lineup.bench||[]).map(String).filter(id=>id!==reserveId && id!==displaced);
    if(displaced) lineup.bench.unshift(displaced);
    lineup.confirmed=true;
    lineup.updatedAt=Date.now();
    return lineup;
  }

  function lineupTurnoverDeltaFromPrevious(lineup, day=$runtime.ensureSeasonState()?.currentMatchday, required=3){
    const season=$runtime.ensureSeasonState();
    if(!season || !lineup || Number(day||0)<=1) return {changed:0,required:0,ok:true};
    const prev=season.lineups?.[String(Number(day)-1)]?.user;
    const prevIds=new Set(Object.values(prev?.starters||{}).map(String).filter(Boolean));
    const currentIds=new Set(Object.values(lineup?.starters||{}).map(String).filter(Boolean));
    if(!prevIds.size || !currentIds.size) return {changed:0,required:0,ok:true};
    let overlap=0;
    currentIds.forEach(id=>{ if(prevIds.has(id)) overlap++; });
    const changed=Math.max(0,currentIds.size-overlap);
    return {changed,required:Number(required||0),ok:changed>=Number(required||0)};
  }

  function validateAdminRuleLineup(lineup, day=$runtime.ensureSeasonState()?.currentMatchday){
    const effect=$runtime.activeAdminRuleEffect(day);
    if(!effect) return {ok:true};
    if(effect.ruleId==='forced_formation' || effect.ruleId==='butterfly_555'){
      const formation=String(effect.formation||'');
      if(String(lineup?.formation||'')!==formation){
        return {ok:false,message:`Regolamento Admin: per questa giornata devi usare il modulo ${formation}.`};
      }
    }
    if(effect.ruleId==='forced_turnover_3' || effect.ruleId==='forced_turnover_5'){
      const required=effect.ruleId==='forced_turnover_5'?5:3;
      const info=$runtime.lineupTurnoverDeltaFromPrevious(lineup,day,required);
      if(!info.ok){
        return {ok:false,message:`Regolamento Admin: servono almeno ${required} cambi di titolari rispetto alla giornata precedente. Al momento ne hai cambiati ${info.changed}/${required}.`};
      }
    }
    if(effect.ruleId==='forced_starter_pair'){
      const forcedId=String(effect.userPlayerId||'');
      const currentIds=new Set(Object.values(lineup?.starters||{}).map(String));
      if(forcedId && !currentIds.has(forcedId)){
        return {ok:false,message:`Regolamento Admin: ${effect.userPlayerName||'il giocatore imposto'} deve essere schierato nell'XI titolare.`};
      }
    }
    if(effect.ruleId==='top_player_bench'){
      const blockedId=String(effect.userPlayerId||'');
      const currentIds=new Set(Object.values(lineup?.starters||{}).map(String));
      if(blockedId && (currentIds.has(blockedId) || String(lineup?.bench?.[lineup.bench.length-1]||'')!==blockedId)){
        return {ok:false,message:`Regolamento Admin: ${effect.userPlayerName||'il tuo Top Player'} deve occupare l’ultimo posto in panchina in questa giornata.`};
      }
    }
    if(effect.ruleId==='faith_reserve'){
      const eligible=new Set((effect.eligiblePlayerIds||[]).map(String));
      const currentIds=Object.values(lineup?.starters||{}).map(String);
      if(eligible.size && !currentIds.some(id=>eligible.has(id))){
        return {ok:false,message:'Regolamento Admin: devi schierare titolare almeno una delle riserve della giornata precedente che non erano entrate.'};
      }
    }
    if(effect.ruleId==='wildcard_starting_slot' || effect.ruleId==='double_wildcard_starting_slot'){
      const maxOutOfRole=effect.ruleId==='double_wildcard_starting_slot'?2:1;
      const mismatches=$runtime.lineupOutOfRoleEntries(lineup);
      if(mismatches.length>maxOutOfRole){
        return {ok:false,message:`Regolamento Admin: puoi utilizzare al massimo ${maxOutOfRole} giocator${maxOutOfRole===1?'e':'i'} fuori ruolo nell'XI.`};
      }
      if(mismatches.some(entry=>!$runtime.wildcardSlotCompatible(entry.playerRole,entry.slotRole))){
        return {ok:false,message:'Regolamento Admin: i Jolly valgono solo tra ruoli adiacenti D↔C e C↔A; il portiere resta vincolato al ruolo P.'};
      }
    }
    return {ok:true};
  }

  function adminRuleNeedsLineupReconfirm(option, season=$runtime.ensureSeasonState(), day=$runtime.ensureSeasonState()?.currentMatchday){
    const effect=option?.effect;
    if(!effect || !season || !day) return false;
    if(!['forced_formation','butterfly_555','forced_turnover_3','forced_turnover_5','forced_starter_pair','top_player_bench','faith_reserve'].includes(effect.ruleId)) return false;
    const saved=season.lineups?.[String(day)]?.user;
    if(!saved?.confirmed) return false;
    if(effect.ruleId==='butterfly_555' && (saved.formation!=='5-5-5' || Object.keys(saved.starters||{}).length!==16)) return true;
    return !$runtime.validateAdminRuleLineup(saved,day).ok;
  }

  function syncFlowAfterPreMatchResolution(season,day,{forceLineup=false}={}){
    if(forceLineup){
      $runtime.setMatchdayFlowPhase(season,day,'lineup',{eventResolvedAt:Date.now()});
      return 'lineup';
    }
    const pending=$runtime.nextPendingMatchdayEvent(day,season);
    if(pending){
      $runtime.setMatchdayFlowPhase(season,day,'event_pending',{eventResolvedAt:Date.now()});
      return 'event_pending';
    }
    $runtime.setMatchdayFlowPhase(season,day,'match_ready',{eventResolvedAt:Date.now()});
    return 'match_ready';
  }

  function adminRuleCover(rarity='common'){
    return rarity==='rare' || rarity==='epic'
      ? 'assets/referee_rule_rare_epic.webp'
      : 'assets/referee_rule.webp';
  }

  function ensureForcedFormationDraft(){
    const forced=$runtime.forcedFormationRuleForDay();
    if(!forced || !$runtime.lineupDraft || !$runtime.LINEUP_FORMATIONS[forced] || $runtime.lineupDraft.formation===forced) return false;
    const currentPlayers=Object.values($runtime.lineupDraft.starters).map($runtime.draftPlayerById).filter(Boolean);
    const next={};
    ['P','D','C','A'].forEach(role=>{
      const ids=currentPlayers.filter(p=>p.role===role).map(p=>String(p.id));
      const slots=$runtime.lineupSlots(forced).filter(s=>s.role===role);
      ids.slice(0,slots.length).forEach((id,idx)=>{ next[slots[idx].instanceId]=id; });
    });
    $runtime.lineupDraft.formation=forced;
    $runtime.lineupDraft.starters=next;
    $runtime.syncDraftBenchOrder();
    $runtime.lineupDraft.confirmed=false;
    $runtime.lineupSelectedPlayerId=null;
    return true;
  }

  function ensureFormationChoiceRoll(day){
    const season=$runtime.ensureSeasonState();
    if(!season) return null;
    const key=String(day);
    let entry=season.formationChoices[key];
    if(entry?.seasonShock && !entry.resolved && $runtime.seasonShockChance()===0){
      delete season.formationChoices[key];
      entry=null;
    }
    if(entry?.rolled){
      const deprecated=(entry.options||[]).some(x=>x?.category==='tactic'||x?.category==='rule') || ['tactic','rule'].includes(entry.selectedOption?.category);
      if(!deprecated) return $runtime.sanitizeLockedFormationChoiceEntry(entry,day);
      // Migrazione live dei salvataggi precedenti: le vecchie carte tattica/regola
      // non devono più apparire né bloccare il flusso prepartita.
      delete season.formationChoices[key];
      entry=null;
    }

    const roll=$runtime.careerHash(`formation-event-trigger|${day}`);
    const chance=$runtime.formationEventChance();
    const triggered=roll<chance;
    const alreadyCursed=Object.values(season.formationChoices||{}).some(choice=>choice?.seasonShock);
    const eligible=($runtime.managerById('user')?.roster||[]).some(player=>!$runtime.playerStatusForDay(player.id,day).unavailable);
    // Sostituisce occasionalmente un evento ordinario; una sola volta per stagione.
    const seasonShock=triggered && !alreadyCursed && eligible &&
      $runtime.careerHash(`season-shock|${$runtime.state?.career?.seasonNumber||1}|${day}`)<$runtime.seasonShockChance();
    const shockOrder=[0,1,2].sort((a,b)=>$runtime.careerHash(`season-shock-order|${day}|${a}`)-$runtime.careerHash(`season-shock-order|${day}|${b}`));
    entry={
      day,
      rolled:true,
      roll,
      triggerChance:chance,
      triggered,
      resolved:!triggered,
      selectedId:null,
      selectedOption:null,
      seasonShock,
      options:seasonShock?shockOrder.map((slot,index)=>({id:`season-shock-${day}-${index}`,kind:slot===0?'cruciate':'neutral'})):
        (triggered?$runtime.generateFormationChoiceOptions(day):[]),
      createdAt:Date.now()
    };
    season.formationChoices[key]=entry;
    $runtime.saveState();
    return entry;
  }

  function activeFormationChoice(day=$runtime.ensureSeasonState()?.currentMatchday){
    const entry=$runtime.formationChoiceDayState(day);
    const option=entry?.triggered && entry?.resolved && entry?.selectedOption ? entry.selectedOption : null;
    if(!option) return null;
    // Le categorie TATTICA e CAMBIO REGOLA sono state rimosse dalle carte normali.
    if(option.category==='tactic' || option.category==='rule') return null;
    return option;
  }

  function tacticForManager(day,managerId){
    if(managerId!=='user') return null;
    const ruleId=$runtime.activeAdminRuleEffect(day)?.ruleId || null;
    if(ruleId==='extra_subs_7') return 'extra_subs';
    if(ruleId==='wildcard_sub') return 'wildcard_sub';
    if(ruleId==='best_bench') return 'best_bench';
    return null;
  }

  function riskAdjustmentForPerformance(perf,day){
    const choice=$runtime.activeFormationChoice(day);
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
    const adminRuleId=$runtime.activeAdminRuleEffect(day)?.ruleId || null;
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

  function specialTrainingPlayerId(day=$runtime.ensureSeasonState()?.currentMatchday){
    return $runtime.specialTrainingPlayerIds(day)[0] || null;
  }

  function specialTrainingUsedForPlayer(day,playerId){
    return $runtime.specialTrainingPlayerIds(day).includes(String(playerId||''));
  }

  function blockedOpponentPlayerId(day=$runtime.ensureSeasonState()?.currentMatchday){
    return $runtime.consumableDayEffect(day)?.blockedOpponentPlayerId ? String($runtime.consumableDayEffect(day).blockedOpponentPlayerId) : null;
  }

  function worldPlayerModifier(day,playerId){
    const targetId=String(playerId||'');
    const choice=$runtime.activeFormationChoice(day);
    const effect=choice?.effect;
    const cpuEffect=typeof $runtime.activeOpponentMalus==='function' ? $runtime.activeOpponentMalus(day)?.effect : null;
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
    if($runtime.specialTrainingUsedForPlayer(day,targetId)){
      merged ||= {kind:'world_player',targetPlayerId:targetId};
      merged.voteDelta=Number(merged.voteDelta||0)+.25;
      merged.goalMultiplier=Number(merged.goalMultiplier||1)*1.10;
      merged.assistMultiplier=Number(merged.assistMultiplier||1)*1.10;
    }
    return merged;
  }

  function formationPlayerModifier(day,playerId,kind){
    const targetId=String(playerId||'');
    const userEffect=$runtime.activeFormationChoice(day)?.effect;
    const cpuEffect=typeof $runtime.activeOpponentMalus==='function' ? $runtime.activeOpponentMalus(day)?.effect : null;
    const effects=[userEffect,cpuEffect].filter(Boolean);
    for(const effect of effects){
      if(String(effect.targetPlayerId||'')!==targetId) continue;
      if(effect.kind===kind) return effect;
    }
    return null;
  }

  function formationChoiceCover(category,rarity='common'){
    const normalizedRarity=String(rarity||'common').toLowerCase();
    if(normalizedRarity==='rare' || normalizedRarity==='epic'){
      const special={
        boost:'boost-rare-epic.webp',
        locker:'spogliatoio-rare-epic.webp',
        malus:'malus-rare-epic.webp',
        rule:'regola-rare-epic.webp',
        risk:'rischio-rare-epic.webp'
      };
      if(special[category]) return special[category];
    }
    return ({
      boost:'boost.webp',
      locker:'spogliatoio.webp',
      malus:'malus.webp',
      rule:'regola.webp',
      risk:'rischio.webp',
      tactic:'tattica.webp'
    })[category] || 'regola.webp';
  }

  function rerollFormationChoiceCards(){
    const season=$runtime.ensureSeasonState();
    if(!season) return;
    const day=season.currentMatchday,entry=$runtime.formationChoiceDayState(day);
    if(!entry?.triggered || entry.resolved || entry.seasonShock) return;
    if($runtime.consumableQuantity('cons_reroll_event',season)<=0){$runtime.showToast('Non hai Reroll Evento nell’inventario.',true);return;}
    const previous=(entry.options||[]).map(x=>x.id).join('|');
    let count=Math.max(0,Number(entry.rerollCount||0));
    let next=[];
    for(let tries=0;tries<8;tries++){
      count++;
      next=$runtime.generateFormationChoiceOptions(day,`reroll-${count}`);
      if(next.map(x=>x.id).join('|')!==previous) break;
    }
    if(!next.length){$runtime.showToast('Nessuna nuova combinazione disponibile.',true);return;}
    if(!$runtime.consumeConsumable('cons_reroll_event',{day,note:'reroll_event'})) return;
    entry.rerollCount=count;
    entry.options=next;
    entry.selectedId=null;
    entry.selectedOption=null;
    entry.lastRerollAt=Date.now();
    $runtime.saveState();
    $runtime.renderFormationChoiceModal(entry);
    $runtime.showToast(`Carte evento rigenerate · Reroll rimasti: ${$runtime.consumableQuantity('cons_reroll_event',season)}.`);
  }

  function rerollAdminRuleCard(){
    const season=$runtime.ensureSeasonState();
    if(!season) return;
    const day=season.currentMatchday,entry=$runtime.adminRuleDayState(day);
    if(!entry?.triggered || entry.resolved || !entry.selectedOption) return;
    if($runtime.consumableQuantity('cons_reroll_admin',season)<=0){$runtime.showToast('Non hai Reroll Admin nell’inventario.',true);return;}
    const count=Math.max(0,Number(entry.rerollCount||0))+1;
    const next=$runtime.generateAdminRuleOption(day,`reroll-${count}`,entry.selectedOption.id);
    if(!next){$runtime.showToast('Nessuna regola Admin alternativa disponibile.',true);return;}
    if(!$runtime.consumeConsumable('cons_reroll_admin',{day,note:'reroll_admin'})) return;
    entry.rerollCount=count;
    entry.selectedOption=next;
    entry.selectedId=null;
    entry.lastRerollAt=Date.now();
    $runtime.saveState();
    $runtime.renderAdminRuleModal(entry);
    $runtime.showToast(`Regola Admin rigenerata · Reroll rimasti: ${$runtime.consumableQuantity('cons_reroll_admin',season)}.`);
  }

  function renderFormationChoiceModal(entry){
    entry=$runtime.sanitizeLockedFormationChoiceEntry(entry,entry?.day);
    const modal=$runtime.$('formationChoiceModal');
    const box=$runtime.$('formationChoiceOptions');
    if(!modal || !box || !entry) return;

    if(entry.seasonShock){
      $runtime.$('formationChoiceDay').textContent=`GIORNATA ${entry.day}`;
      $runtime.$('formationChoiceKicker').textContent='☠ IMPREVISTO DI STAGIONE';
      $runtime.$('formationChoiceTitle').textContent='La maledizione';
      $runtime.$('formationChoiceText').textContent='Tre carte coperte. Girane una: l’effetto si applica immediatamente.';
      $runtime.$('formationChoiceFooterText').textContent='Una carta nasconde un grave infortunio. Le altre due sono neutrali.';
      $runtime.$('formationEventRerollBtn')?.classList.add('hidden');
      box.innerHTML=(entry.options||[]).map((option,index)=>`
        <article class="formation-flip-card type-malus rarity-epic" data-shock-card="${$runtime.escapeHtml(option.id)}" tabindex="0" role="button" aria-label="Carta coperta ${index+1}. Gira e applica subito l’esito.">
          <div class="formation-flip-inner">
            <section class="formation-card-face formation-card-front"><img class="formation-card-cover" src="assets/maledizione-stagione.webp" alt="Maledizione"><span class="formation-card-index">0${index+1}</span><div class="formation-card-front-footer"><span class="formation-card-front-category">MALEDIZIONE</span><button class="formation-card-flip-btn" type="button" tabindex="-1">GIRA ↻</button></div></section>
            <section class="formation-card-face formation-card-back"><div class="formation-card-back-top"><span class="formation-choice-icon">${option.kind==='cruciate'?'🩼':'✨'}</span><span class="formation-choice-category">IMPREVISTO</span></div><div class="formation-card-back-copy"><strong>${option.kind==='cruciate'?'Rotto il crociato!':'Falso allarme'}</strong><small>${option.kind==='cruciate'?$runtime.escapeHtml(entry.selectedOption?.id===option.id?entry.selectedOption.text:'Un giocatore della tua rosa non sarà disponibile fino a fine stagione!'):'Nessuna conseguenza per la tua squadra.'}</small></div><div class="formation-card-back-footer"><button type="button" class="formation-card-select-btn" data-shock-continue>CONTINUA ✓</button></div></section>
          </div>
        </article>`).join('');
      box.querySelectorAll('[data-shock-card]').forEach(card=>{
        const reveal=()=>{
          if(entry.resolved) return;
          $runtime.resolveSeasonShock(card.dataset.shockCard);
          const result=entry.selectedOption;
          if(result?.id!==card.dataset.shockCard) return;
          card.querySelector('.formation-card-back-copy small').textContent=result.text;
          card.classList.add('is-flipped');
          box.querySelectorAll('[data-shock-card]').forEach(other=>{if(other!==card){other.setAttribute('aria-disabled','true');other.tabIndex=-1;other.style.pointerEvents='none';}});
          card.setAttribute('aria-label',`${result.title}. ${result.text}`);
          card.querySelector('[data-shock-continue]').focus();
        };
        card.addEventListener('click',event=>{if(event.target.closest('[data-shock-continue]')){$runtime.hideFormationChoiceModal();$runtime.openNextSeasonEvent(entry.day);return;}reveal();});
        card.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&!event.target.closest('button')){event.preventDefault();reveal();}});
      });
      $runtime.$('matchdayEventRestoreBtn')?.classList.add('hidden');
      modal.classList.add('show');modal.setAttribute('aria-hidden','false');
      return;
    }
    $runtime.$('formationEventRerollBtn')?.classList.remove('hidden');

    $runtime.$('formationChoiceDay').textContent=`GIORNATA ${entry.day}`;
    if($runtime.$('formationChoiceKicker')) $runtime.$('formationChoiceKicker').textContent='⚡ IMPREVISTO DI GIORNATA';
    if($runtime.$('formationChoiceTitle')) $runtime.$('formationChoiceTitle').textContent='Prima di andare alla partita...';
    if($runtime.$('formationChoiceText')) $runtime.$('formationChoiceText').innerHTML='È successo qualcosa. <strong>Gira le carte</strong>, scopri gli effetti e scegli 1 delle 3 opzioni. Dopo la scelta potrai ancora modificare la formazione prima della Diretta Gol.';
    if($runtime.$('formationChoiceFooterText')) $runtime.$('formationChoiceFooterText').textContent='Clicca una carta per girarla. La scelta finale è definitiva.';
    const eventReroll=$runtime.$('formationEventRerollBtn');
    if(eventReroll){
      const qty=$runtime.consumableQuantity('cons_reroll_event');
      eventReroll.textContent=`🎴 REROLL · ×${qty}`;
      eventReroll.disabled=qty<=0;
      eventReroll.onclick=$runtime.rerollFormationChoiceCards;
    }

    box.innerHTML=(entry.options||[]).map((option,index)=>{
      const category=$runtime.formationChoiceCategoryClass(option.category);
      const cover=$runtime.formationChoiceCover(option.category, option.rarity||'common');

      return `
        <article class="formation-flip-card type-${category} rarity-${$runtime.escapeHtml(option.rarity||'common')}" data-flip-card="${$runtime.escapeHtml(option.id)}" tabindex="0" role="button" aria-label="Carta ${$runtime.formationChoiceCategoryLabel(option.category)} ${$runtime.formationChoiceRarityLabel(option.rarity||'common')}. Clicca per girare.">
          <div class="formation-flip-inner">

            <section class="formation-card-face formation-card-front">
              <img class="formation-card-cover" src="${cover}" alt="${$runtime.escapeHtml($runtime.formationChoiceCategoryLabel(option.category))}">
              <span class="formation-card-index">0${index+1}</span>
              <div class="formation-card-front-footer">
                <span class="formation-card-front-category">${$runtime.formationChoiceCategoryLabel(option.category)}</span><span class="formation-card-rarity rarity-${$runtime.escapeHtml(option.rarity||'common')}">${$runtime.formationChoiceRarityLabel(option.rarity||'common')}</span>
                <button type="button" class="formation-card-flip-btn" data-flip-action="${$runtime.escapeHtml(option.id)}">GIRA ↻</button>
              </div>
            </section>

            <section class="formation-card-face formation-card-back">
              <div class="formation-card-back-top">
                <span class="formation-choice-icon">${option.icon||'?'}</span>
                <span class="formation-choice-category">${$runtime.formationChoiceCategoryLabel(option.category)}</span><span class="formation-card-rarity rarity-${$runtime.escapeHtml(option.rarity||'common')}">${$runtime.formationChoiceRarityLabel(option.rarity||'common')}</span>
              </div>
              <div class="formation-card-back-copy">
                <strong>${$runtime.escapeHtml(option.title)}</strong>
                <small>${$runtime.escapeHtml(option.text)}</small>
              </div>
              <div class="formation-card-back-footer">
                <button type="button" class="formation-card-flip-back-btn" data-flip-action="${$runtime.escapeHtml(option.id)}">↺ RIGIRA</button>
                <button type="button" class="formation-card-select-btn" data-formation-choice="${$runtime.escapeHtml(option.id)}">SCEGLI ✓</button>
              </div>
            </section>

          </div>
        </article>
      `;
    }).join('');

    const toggleCard=(id)=>{
      const card=box.querySelector(`[data-flip-card="${CSS.escape(String(id))}"]`);
      if(!card) return;
      const flipped=card.classList.toggle('is-flipped');
      card.setAttribute('aria-label',flipped?'Carta girata. Leggi l’effetto o scegli.':'Carta coperta. Clicca per girare.');
    };

    box.querySelectorAll('[data-flip-card]').forEach(card=>{
      card.addEventListener('click',e=>{
        if(e.target.closest('[data-formation-choice]') || e.target.closest('[data-flip-action]')) return;
        toggleCard(card.dataset.flipCard);
      });
      card.addEventListener('keydown',e=>{
        if((e.key==='Enter' || e.key===' ') && !e.target.closest('button')){
          e.preventDefault();
          toggleCard(card.dataset.flipCard);
        }
      });
    });

    box.querySelectorAll('[data-flip-action]').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.stopPropagation();
        toggleCard(btn.dataset.flipAction);
      });
    });

    box.querySelectorAll('[data-formation-choice]').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.stopPropagation();
        $runtime.resolveFormationChoice(btn.dataset.formationChoice);
      });
    });

    $runtime.$('matchdayEventRestoreBtn')?.classList.add('hidden');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
  }

  function resolveSeasonShock(optionId){
    const season=$runtime.ensureSeasonState();
    const day=season?.currentMatchday;
    const entry=season?.formationChoices?.[String(day)];
    if(!entry?.seasonShock || entry.resolved) return;
    const option=(entry.options||[]).find(item=>item.id===optionId);
    if(!option) return;
    let result={id:option.id,title:'Falso allarme',text:'Nessuna conseguenza per la tua squadra.'};
    if(option.kind==='cruciate'){
      const eligible=($runtime.managerById('user')?.roster||[]).filter(player=>!$runtime.playerStatusForDay(player.id,day).unavailable);
      const player=$runtime.hashPick(eligible,`cruciate|${$runtime.state?.career?.seasonNumber||1}|${day}`);
      if(player){
        $runtime.ensurePlayerSeasonSystems(season);
        const status=season.playerStatus[String(player.id)] ||= {injuryUntil:0,suspensionUntil:0,yellowAccum:0,lastReason:''};
        status.injuryUntil=$runtime.FANTASY_SEASON_MATCHDAYS;
        status.lastReason='Rotto il crociato';
        result={id:option.id,title:'Rotto il crociato!',text:`${player.name} non sarà disponibile fino a fine stagione!`,playerId:String(player.id)};
      }
    }
    entry.selectedId=option.id;
    entry.selectedOption=result;
    entry.resolved=true;
    entry.resolvedAt=Date.now();
    $runtime.syncFlowAfterPreMatchResolution(season,day,{forceLineup:!!result.playerId});
    $runtime.saveState();
  }

  function openNextSeasonEvent(day){
    const pending=$runtime.nextPendingMatchdayEvent(day);
    if(pending?.type==='admin_rule') $runtime.renderAdminRuleModal(pending.entry);
    else $runtime.renderSeasonDashboard();
  }

  function hideFormationChoiceModal(){
    const modal=$runtime.$('formationChoiceModal');
    if(!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    if($runtime.$('matchdayEventRestoreBtn')?.dataset.modal==='formationChoiceModal') $runtime.$('matchdayEventRestoreBtn').classList.add('hidden');
  }

  function renderAdminRuleModal(entry){
    const modal=$runtime.$('adminRuleModal');
    const box=$runtime.$('adminRuleOptions');
    if(!modal || !box || !entry?.selectedOption) return;
    const option=entry.selectedOption;
    if($runtime.$('adminRuleDay')) $runtime.$('adminRuleDay').textContent=`GIORNATA ${entry.day}`;
    const adminReroll=$runtime.$('adminRuleRerollBtn');
    if(adminReroll){
      const qty=$runtime.consumableQuantity('cons_reroll_admin');
      adminReroll.textContent=`📜 REROLL · ×${qty}`;
      adminReroll.disabled=qty<=0;
      adminReroll.onclick=$runtime.rerollAdminRuleCard;
    }
    box.innerHTML=`
      <article class="formation-flip-card type-rule admin-rule-card rarity-${$runtime.escapeHtml(option.rarity||'common')}" data-admin-rule-card="${$runtime.escapeHtml(option.id)}" tabindex="0" role="button" aria-label="Carta regolamento Admin ${$runtime.formationChoiceRarityLabel(option.rarity||'common')}. Clicca per girare.">
        <div class="formation-flip-inner">
          <section class="formation-card-face formation-card-front">
            <img class="formation-card-cover" src="${$runtime.adminRuleCover(option.rarity)}" alt="Regolamento Admin">
            <span class="formation-card-index">01</span>
            <div class="formation-card-front-footer">
              <span class="formation-card-front-category">REGOLAMENTO ADMIN</span><span class="formation-card-rarity rarity-${$runtime.escapeHtml(option.rarity||'common')}">${$runtime.formationChoiceRarityLabel(option.rarity||'common')}</span>
              <button type="button" class="formation-card-flip-btn" data-admin-rule-flip="${$runtime.escapeHtml(option.id)}">GIRA ↻</button>
            </div>
          </section>
          <section class="formation-card-face formation-card-back">
            <div class="formation-card-back-top">
              <span class="formation-choice-icon">${option.icon||'📜'}</span>
              <span class="formation-choice-category">REGOLAMENTO ADMIN</span>
              <span class="formation-card-rarity rarity-${$runtime.escapeHtml(option.rarity||'common')}">${$runtime.formationChoiceRarityLabel(option.rarity||'common')}</span>
            </div>
            <div class="formation-card-back-copy">
              <strong>${$runtime.escapeHtml(option.title)}</strong>
              <small>${$runtime.escapeHtml(option.text)}</small>
            </div>
            <div class="formation-card-back-footer">
              <button type="button" class="formation-card-flip-back-btn" data-admin-rule-flip="${$runtime.escapeHtml(option.id)}">↺ RIGIRA</button>
              <button type="button" class="formation-card-select-btn" data-admin-rule-confirm="${$runtime.escapeHtml(option.id)}">CONFERMA ✓</button>
            </div>
          </section>
        </div>
      </article>`;

    const toggle=()=>{
      const card=box.querySelector('[data-admin-rule-card]');
      if(!card) return;
      const flipped=card.classList.toggle('is-flipped');
      card.setAttribute('aria-label',flipped?'Carta regolamento girata. Leggi l’effetto o conferma.':'Carta regolamento coperta. Clicca per girare.');
    };

    const card=box.querySelector('[data-admin-rule-card]');
    card?.addEventListener('click',e=>{
      if(e.target.closest('[data-admin-rule-confirm]') || e.target.closest('[data-admin-rule-flip]')) return;
      toggle();
    });
    card?.addEventListener('keydown',e=>{
      if((e.key==='Enter' || e.key===' ') && !e.target.closest('button')){
        e.preventDefault();
        toggle();
      }
    });
    box.querySelectorAll('[data-admin-rule-flip]').forEach(btn=>btn.addEventListener('click',e=>{ e.stopPropagation(); toggle(); }));
    box.querySelector('[data-admin-rule-confirm]')?.addEventListener('click',e=>{
      e.stopPropagation();
      $runtime.resolveAdminRule(entry.selectedOption.id);
    });

    $runtime.$('matchdayEventRestoreBtn')?.classList.add('hidden');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
  }

  function hideAdminRuleModal(){
    const modal=$runtime.$('adminRuleModal');
    if(!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    if($runtime.$('matchdayEventRestoreBtn')?.dataset.modal==='adminRuleModal') $runtime.$('matchdayEventRestoreBtn').classList.add('hidden');
  }

  function minimizeMatchdayEvent(modalId){
    const modal=$runtime.$(modalId), restore=$runtime.$('matchdayEventRestoreBtn');
    const season=$runtime.ensureSeasonState();
    const pending=$runtime.nextPendingMatchdayEvent(season?.currentMatchday,season);
    if(!modal?.classList.contains('show') || !restore || !pending ||
       (pending.type==='formation'?'formationChoiceModal':'adminRuleModal')!==modalId) return;
    modal.classList.remove('show'); modal.setAttribute('aria-hidden','true');
    restore.dataset.modal=modalId; restore.classList.remove('hidden'); restore.focus();
  }

  function restoreMatchdayEvent(){
    const restore=$runtime.$('matchdayEventRestoreBtn'), modal=$runtime.$(restore?.dataset.modal);
    const season=$runtime.ensureSeasonState();
    const pending=$runtime.nextPendingMatchdayEvent(season?.currentMatchday,season);
    if(!modal || !pending || (pending.type==='formation'?'formationChoiceModal':'adminRuleModal')!==modal.id){
      restore?.classList.add('hidden'); return;
    }
    restore.classList.add('hidden'); modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
    modal.querySelector('.matchday-event-minimize')?.focus();
  }

  function resolveAdminRule(optionId){
    const season=$runtime.ensureSeasonState();
    if(!season) return;
    const day=season.currentMatchday;
    const entry=$runtime.adminRuleDayState(day);
    if(!entry || !entry.triggered || entry.resolved || !entry.selectedOption) return;
    if(String(entry.selectedOption.id)!==String(optionId)) return;
    const option=entry.selectedOption;

    entry.resolved=true;
    entry.selectedId=option.id;
    entry.resolvedAt=Date.now();
    if(option.effect?.ruleId==='fantaclassifica'){
      season.fantaclassificaActive=true;
      season.fantaclassificaActivatedDay=Number(day||1);
      season.fantaclassificaActivatedAt=Date.now();
      $runtime.leagueStandingsSort={key:'position',direction:'asc'};
    }
    $runtime.hideAdminRuleModal();

    let forceLineup=false;
    if($runtime.adminRuleNeedsLineupReconfirm(option,season,day)){
      const lineup=season.lineups?.[String(day)]?.user;
      if(lineup) lineup.confirmed=false;
      forceLineup=true;
    }

    const nextPhase=$runtime.syncFlowAfterPreMatchResolution(season,day,{forceLineup});
    $runtime.saveState();

    if(forceLineup){
      $runtime.showToast(`${option.title}: devi aggiornare e riconfermare la formazione.`);
      $runtime.renderSeasonDashboard();
      return;
    }

    const pending=$runtime.nextPendingMatchdayEvent(day,season);
    if(pending?.type==='formation'){
      $runtime.renderFormationChoiceModal(pending.entry);
      return;
    }
    if(pending?.type==='admin_rule'){
      $runtime.renderAdminRuleModal(pending.entry);
      return;
    }

    $runtime.showToast(option.effect?.ruleId==='fantaclassifica'
      ? '🏆 Fantaclassifica attiva: fino a fine stagione la posizione dipende dai Fantapunti totali.'
      : `${option.title}: regolamento confermato per la giornata.`);
    $runtime.renderSeasonDashboard();
  }

  function resolveFormationChoice(optionId){
    const season=$runtime.ensureSeasonState();
    if(!season) return;
    const day=season.currentMatchday;
    const entry=$runtime.sanitizeLockedFormationChoiceEntry($runtime.formationChoiceDayState(day),day);
    if(!entry || !entry.triggered || entry.resolved) return;
    const option=(entry.options||[]).find(x=>x.id===optionId);
    if(!option) return;

    entry.resolved=true;
    entry.selectedId=option.id;
    entry.selectedOption=option;
    entry.resolvedAt=Date.now();
    $runtime.hideFormationChoiceModal();
    $runtime.syncFlowAfterPreMatchResolution(season,day);
    $runtime.saveState();
    const pending=$runtime.nextPendingMatchdayEvent(day,season);
    if(pending?.type==='admin_rule'){
      $runtime.renderAdminRuleModal(pending.entry);
      return;
    }
    $runtime.showToast(`${$runtime.formationChoiceCategoryLabel(option.category)}: ${option.title}. Puoi ancora modificare la formazione.`);
    $runtime.renderSeasonDashboard();
  }

  function requestOpenLineup(){
    const season=$runtime.ensureSeasonState();
    if(!season) return;
    // Le carte vengono controllate solo con CONTINUA. La formazione può essere
    // aperta e modificata liberamente fino all'avvio della Diretta Gol.
    $runtime.openLineupScreen();
  }
    return Object.freeze({formationChoiceCategoryLabel,formationChoiceCategoryClass,formationChoiceDayState,adminRuleDayState,activeAdminRule,activeAdminRuleEffect,hasPendingMatchdayEvent,nextPendingMatchdayEvent,hashPick,sortedByChoiceHash,isDerbyFixtureForPlayer,formationChoiceContextForManagers,fantasyAppearanceRate,formationChoiceContext,specialRivalManager,opponentMalusDayState,opponentMalusChanceForManager,generateOpponentMalusOption,ensureOpponentMalusRoll,activeOpponentMalus,generateFormationChoiceOptions,sanitizeLockedFormationChoiceEntry,adminRuleRarityProfile,generateAdminRuleOption,ensureAdminRuleRoll,ensureAllPreMatchEventRolls,forcedFormationRuleForDay,adminForcedStarterForManager,adminBenchableTopPlayer,previousUnusedBenchEligibleIds,adminBlockedStarterForManager,adminFaithReserveEligibleIds,adminWildcardStartingSlotLimit,wildcardSlotCompatible,lineupOutOfRoleEntries,canPlacePlayerInLineupSlot,enforceStarterInLineup,enforceAdminLastReserve,enforcePlayerBenchedInLineup,enforceFaithReserveStarterInLineup,lineupTurnoverDeltaFromPrevious,validateAdminRuleLineup,adminRuleNeedsLineupReconfirm,syncFlowAfterPreMatchResolution,adminRuleCover,ensureForcedFormationDraft,ensureFormationChoiceRoll,activeFormationChoice,tacticForManager,riskAdjustmentForPerformance,fantasyRuleForDay,starterReportActive,specialTrainingPlayerIds,specialTrainingPlayerId,specialTrainingUsedForPlayer,blockedOpponentPlayerId,worldPlayerModifier,formationPlayerModifier,formationChoiceCover,rerollFormationChoiceCards,rerollAdminRuleCard,renderFormationChoiceModal,resolveSeasonShock,openNextSeasonEvent,hideFormationChoiceModal,renderAdminRuleModal,hideAdminRuleModal,minimizeMatchdayEvent,restoreMatchdayEvent,resolveAdminRule,resolveFormationChoice,requestOpenLineup});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['matchday-events-controller']=Object.freeze({create});
})();
