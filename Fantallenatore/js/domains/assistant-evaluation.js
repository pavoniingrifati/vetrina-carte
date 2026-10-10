/* Domain service: assistant-evaluation. No DOM, timers, or persistence; state accessors remain live. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: assistant-evaluation');
  function estimatedStarterProbability(player,day=$runtime.ensureSeasonState()?.currentMatchday||1){
    const season=$runtime.ensureSeasonState();
    if(!player || !season) return 0;
    const targetDay=Number(day||season.currentMatchday||1);
    const status=$runtime.playerStatusForDay(player.id,targetDay);
    if(status.unavailable) return 0;

    const slots=$runtime.clubRoleStarterSlots(player.club,player.role);
    const peers=(window.FANTA_PLAYERS||[])
      .filter(p=>p.club===player.club&&p.role===player.role&&p.marketStatus!=='abroad')
      .slice()
      .sort((a,b)=>{
        const aUnavailable=$runtime.playerStatusForDay(a.id,targetDay).unavailable?1:0;
        const bUnavailable=$runtime.playerStatusForDay(b.id,targetDay).unavailable?1:0;
        return aUnavailable-bUnavailable || $runtime.lineupPlayerValue(b)-$runtime.lineupPlayerValue(a) || $runtime.currentPlayerOvr(b)-$runtime.currentPlayerOvr(a);
      });
    const available=peers.filter(candidate=>!$runtime.playerStatusForDay(candidate.id,targetDay).unavailable);
    const rankById=new Map(available.map((candidate,index)=>[String(candidate.id),index]));
    const entries=peers.map(candidate=>{
      const unavailable=$runtime.playerStatusForDay(candidate.id,targetDay).unavailable;
      const rank=rankById.get(String(candidate.id))??peers.length;
      const stat=$runtime.playerSeasonStat(candidate.id);
      const startRate=stat?.appearances?Number(stat.starts||0)/Math.max(1,Number(stat.appearances||0)):null;
      const historyAdj=startRate==null?0:$runtime.clamp((startRate-.5)*12,-6,6);
      const form=$runtime.playerFormMetrics(candidate.id);
      const formAdj=form.count?$runtime.clamp((form.avg-6)*2.2,-2.8,3.2):0;
      const noise=($runtime.careerHash(`starter-prob|${targetDay}|${candidate.id}`)-.5)*3;
      const worldEffect=$runtime.worldPlayerModifier(targetDay,candidate.id);
      const eventScoreDelta=Number(worldEffect?.starterScoreDelta||0);
      const eventProbabilityDelta=Number(worldEffect?.starterProbabilityDelta||0);
      return {
        id:candidate.id,
        unavailable,
        score:$runtime.currentPlayerOvr(candidate)+$runtime.starterHierarchyBias(candidate.role,rank,slots)+historyAdj+formAdj+noise+eventScoreDelta+eventProbabilityDelta*.28
      };
    });

    // Le probabilità competono per i posti realmente disponibili nel ruolo.
    // Esempio P: la somma dei portieri disponibili resta circa 100%, invece di
    // consentire contemporaneamente valori come 94% al primo e 74% al secondo.
    return $runtime.normalizedStarterProbability(entries,player.id,slots,player.role==='P'?2.4:4.2);
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
