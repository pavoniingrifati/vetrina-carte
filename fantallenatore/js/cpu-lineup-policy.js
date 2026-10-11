(() => {
  'use strict';
  function playerValue({manager,player,day,state,lineupPlayerValue,leagueRulesFor,cpuLeagueRuleSensitivity,estimatedStarterProbability,currentPlayerOvr,playerFormMetrics,playerSeasonStat,serieAMatchupDifficulty,clamp}){
    let value=lineupPlayerValue(player);
    if(!manager || manager.id==='user' || !player) return value;
    const rules=leagueRulesFor(state);
    const sensitivity=cpuLeagueRuleSensitivity(manager);
    const role=String(player.role||'');
    const starterPct=estimatedStarterProbability(player,day);
    const starterDelta=starterPct-55;
    const ovr=currentPlayerOvr(player);
    // Higher divisions evaluate public pre-match information, never generated outcomes.
    const competence=({4:0,3:.4,2:.75,1:1})[Number(manager.division||state?.career?.division||4)]||0;
    if(competence){
      const form=playerFormMetrics(player.id);
      const stat=playerSeasonStat(player.id);
      const sample=Number(stat?.voteCount||0);
      const historical=sample?clamp(Number(stat.fantasySum||0)/sample-6,-3,4)*sample/(sample+8):0;
      const matchup=serieAMatchupDifficulty(player,day);
      const matchupValue=matchup?.key==='favorable'?130:matchup?.key==='hard'?-130:0;
      value+=competence*(-(ovr-75)*45+starterDelta*18+Number(form?.score||0)*200+historical*100+matchupValue+(matchup?.home?35:0));
    }

    // Pochi cambi: la CPU evita maggiormente il rischio SV nella formazione iniziale.
    if(Number(rules.maxFantasySubs)===1) value+=starterDelta*14*sensitivity;
    else if(Number(rules.maxFantasySubs)===3) value+=starterDelta*7*sensitivity;
    else if(Number(rules.maxFantasySubs)>=5) value+=starterDelta*2.5*sensitivity;

    // Modificatore difesa: premia i migliori P/D quando deve scegliere gli undici.
    if(rules.defenseModifier==='classic'){
      if(role==='P') value+=70*sensitivity + Math.max(0,ovr-72)*5*sensitivity;
      if(role==='D') value+=105*sensitivity + Math.max(0,ovr-72)*8*sensitivity;
    }

    // Clean sheet: tra i portieri la CPU considera anche la difficoltà della gara.
    if(Number(rules.cleanSheetBonus||0)>0 && role==='P'){
      const difficulty=serieAMatchupDifficulty(player,day);
      const matchupBonus=difficulty?.key==='favorable'?150:difficulty?.key==='hard'?-65:65;
      value+=(85+matchupBonus)*sensitivity;
    }

    // Soglia bassa: un po' più di upside offensivo. Soglia alta: più continuità.
    if(Number(rules.firstGoalThreshold)===65){
      if(role==='A') value+=105*sensitivity;
      else if(role==='C') value+=55*sensitivity;
    }else if(Number(rules.firstGoalThreshold)===67){
      value+=Math.max(0,ovr-72)*5*sensitivity;
      value+=Math.max(0,starterDelta)*3*sensitivity;
    }
    return value;
  }
  function chooseFormation(manager,{state,availableLineupFormations,lineupCountsForFormation,bestPlayersForRole,cpuLeagueRuleLineupValue,formationCpuBias}){
    return availableLineupFormations().map(key=>{
      const counts=lineupCountsForFormation(key);
      let score=0;
      for (const role of ['P','D','C','A']) score += bestPlayersForRole(manager,role,counts[role]).reduce((s,p)=>s+cpuLeagueRuleLineupValue(manager,p,state?.season?.currentMatchday||1),0);
      return {key,score:score+formationCpuBias(manager,key,state?.season?.currentMatchday||1)};
    }).sort((a,b)=>b.score-a.score)[0]?.key || '4-3-3';
  }
  window.FantaCpuLineupPolicy=Object.freeze({playerValue,chooseFormation});
})();
