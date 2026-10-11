/* Domain service: assistant-evaluation. No DOM, timers, or persistence; state accessors remain live. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: assistant-evaluation');
  // La stima usa le stesse formazioni del campionato, senza leggere quella
  // effettiva del giorno richiesto. La finestra di 24 giornate misura moduli,
  // rotazioni e concorrenza nel ruolo; non garantisce la prossima titolarità.
  const starterForecastCache=new Map();
  function estimatedStarterProbability(player,day=$runtime.ensureSeasonState()?.currentMatchday||1){
    const season=$runtime.ensureSeasonState();
    if(!player || !season) return 0;
    const targetDay=Math.max(1,Number(day||season.currentMatchday||1));
    if($runtime.playerStatusForDay(player.id,targetDay).unavailable) return 0;
    const clubId=player.club;
    const pool=(window.FANTA_PLAYERS||[]).filter(p=>p.club===clubId&&p.marketStatus!=='abroad');
    if(!pool.some(p=>String(p.id)===String(player.id))) return 0;
    // Invalidazione dopo le giornate, i trasferimenti e i cambi di rosa/OVR.
    const revision=Number($runtime.state?.transferMarket?.worldRevision||0);
    const completed=Number(season.lastCompletedMatchday||0);
    const rosterSignature=pool.map(p=>`${p.id}:${$runtime.currentPlayerOvr(p)}`).join('|');
    const key=`${clubId}|${targetDay}|${completed}|${revision}|${rosterSignature}`;
    let forecast=starterForecastCache.get(key);
    if(!forecast){
      forecast=new Map(pool.map(p=>[String(p.id),0]));
      // Alcuni ambienti (es. simulazioni delle CPU e test headless) non
      // espongono il selettore Serie A. Evitiamo di bloccare la formazione.
      if(typeof $runtime.buildSerieAClubSelection!=='function'){
        const roleCounts={P:1,D:4,C:4,A:2};
        for(const role of ['P','D','C','A']){
          const ranked=pool.filter(p=>p.role===role).sort((a,b)=>$runtime.currentPlayerOvr(b)-$runtime.currentPlayerOvr(a));
          ranked.forEach((p,index)=>forecast.set(String(p.id),index<roleCounts[role]?90:Math.max(1,Math.round(35/(index-roleCounts[role]+1)))));
        }
        if(starterForecastCache.size>120) starterForecastCache.clear();
        starterForecastCache.set(key,forecast);
        return forecast.get(String(player.id))||0;
      }
      const sampleCount=24;
      let valid=0;
      for(let i=1;i<=sampleCount;i++){
        // Campioniamo altre giornate (mai quella richiesta) usando il vero
        // selettore: la previsione non mostra gli 11 già estratti per oggi.
        const sampleDay=1+((targetDay+i-1)%38);
        const selection=$runtime.buildSerieAClubSelection(clubId,sampleDay);
        if(!selection?.starters?.length) continue;
        valid++;
        for(const starter of selection.starters){
          const id=String(starter.id);
          forecast.set(id,(forecast.get(id)||0)+1);
        }
      }
      for(const [id,starts] of forecast) forecast.set(id,valid?Math.min(96,Math.max(1,Math.round(starts*100/valid))):0);
      if(starterForecastCache.size>120) starterForecastCache.clear();
      starterForecastCache.set(key,forecast);
    }
    return forecast.get(String(player.id))||0;
  }

  function assistantAutoLineupCapabilities(season=$runtime.ensureSeasonState()){
    return {
      scout:!!$runtime.shopItemActive('scout_plus',season),
      fantadata:!!$runtime.shopItemActive('fantadata_pro',season)
    };
  }

  function assistantBasePlayerValue(player){
    if(!player) return -999999;
    const season=$runtime.ensureSeasonState();
    const status=$runtime.playerStatusForDay(player.id,season?.currentMatchday||1);
    const statusPenalty=status.unavailable?-4500:0;
    // Assistente Tecnico da solo usa soltanto qualità generale e disponibilità.
    // Forma/rendimento appartengono a FantaData; titolarità stimata appartiene a Scout Plus.
    return $runtime.currentPlayerOvr(player)*100 + statusPenalty;
  }

  function advancedAutoLineupValue(player){
    if(!player) return -999999;
    const season=$runtime.ensureSeasonState();
    const caps=assistantAutoLineupCapabilities(season);
    let value=assistantBasePlayerValue(player);
    if(caps.fantadata){
      const stat=$runtime.playerSeasonStat(player.id);
      const favg=stat?.voteCount?Number(stat.fantasySum||0)/Math.max(1,Number(stat.voteCount||0)):6;
      const form=$runtime.playerFormMetrics(player.id);
      value += (favg-6)*420 + form.score*340;
      // Il calendario Serie A è un dato FantaData: AUTO XI lo usa solo se l'abbonamento è attivo.
      const matchup=$runtime.serieAMatchupDifficulty(player,season?.currentMatchday||1);
      if(matchup){
        value += matchup.key==='favorable'?260:matchup.key==='hard'?-240:0;
        value += matchup.home?45:-25;
      }
    }
    if(caps.scout) value += estimatedStarterProbability(player)*8;
    if($runtime.shopItemActive('assistant_tactical_pro',season)){
      const choice=$runtime.activeFormationChoice(season?.currentMatchday);
      const effect=choice?.effect;
      if(String(effect?.targetPlayerId||'')===String(player.id) && ['player_vote','locker_vote','world_player'].includes(effect.kind)) value+=Number(effect.delta||effect.voteDelta||0)*900;
    }
    return value;
  }

    return Object.freeze({estimatedStarterProbability,assistantAutoLineupCapabilities,assistantBasePlayerValue,advancedAutoLineupValue});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['assistant-evaluation']=Object.freeze({create});
})();
