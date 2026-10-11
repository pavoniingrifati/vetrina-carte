/* Domain service: football-selection. No DOM, timers, or persistence; state accessors remain live. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: football-selection');
  function seededSerieRand(day, key) {
    return $runtime.careerHash(`seriea|${day}|${key}`);
  }

  function serieAFixtureForPlayer(player,day=$runtime.ensureSeasonState()?.currentMatchday||1){
    const season=$runtime.ensureSeasonState();
    if(!player || !season) return null;
    const round=season.serieASchedule?.[Number(day)-1];
    if(!round) return null;
    const match=(round.matches||[]).find(m=>m.homeClub===player.club || m.awayClub===player.club);
    if(!match) return null;
    const home=match.homeClub===player.club;
    const opponentClub=home?match.awayClub:match.homeClub;
    return {
      day:Number(day),
      clubId:player.club,
      opponentClub,
      home,
      venue:home?'Casa':'Trasferta',
      opponentName:$runtime.clubName(opponentClub),
      opponentShort:$runtime.clubShort(opponentClub)
    };
  }

  function serieAStrengthRowsForDay(day=$runtime.ensureSeasonState()?.currentMatchday||1){
    const season=$runtime.ensureSeasonState();
    const cacheKey=`${Number(day)}|${Number(season?.lastCompletedMatchday||0)}|${Object.keys(season?.playerStatus||{}).length}|M${Number($runtime.state?.transferMarket?.worldRevision||0)}`;
    if($runtime.serieAStrengthCache.key===cacheKey && Array.isArray($runtime.serieAStrengthCache.rows)) return $runtime.serieAStrengthCache.rows;
    const rows=(window.FANTA_CLUBS||[]).map(club=>({
      clubId:club.id,
      strength:serieAClubStrength(club.id,Number(day))
    })).sort((a,b)=>b.strength-a.strength);
    $runtime.serieAStrengthCache={key:cacheKey,rows};
    return rows;
  }

  function serieAMatchupDifficulty(player,day=$runtime.ensureSeasonState()?.currentMatchday||1){
    const fixture=serieAFixtureForPlayer(player,day);
    if(!fixture) return null;
    const rows=serieAStrengthRowsForDay(day);
    const idx=rows.findIndex(x=>x.clubId===fixture.opponentClub);
    const rank=idx>=0?idx+1:Math.ceil(rows.length/2);
    let key='balanced',label='EQUILIBRATA',icon='🟡';
    if(rank<=6){key='hard';label='DIFFICILE';icon='🔴';}
    else if(rank>=Math.max(15,rows.length-5)){key='favorable';label='FAVOREVOLE';icon='🟢';}
    return {...fixture,key,label,icon,rank,opponentStrength:idx>=0?rows[idx].strength:null};
  }

  function clubPool(clubId){
    return (window.FANTA_PLAYERS||[]).filter(p=>p.club===clubId);
  }

  function rankedClubPlayers(clubId,day,key='rank'){
    return clubPool(clubId).slice().sort((a,b)=>{
      const av=$runtime.currentPlayerOvr(a)+(seededSerieRand(day,`${clubId}|${key}|${a.id}`)-.5)*5;
      const bv=$runtime.currentPlayerOvr(b)+(seededSerieRand(day,`${clubId}|${key}|${b.id}`)-.5)*5;
      return bv-av || String(a.name).localeCompare(String(b.name),'it');
    });
  }

  function serieAPlayerDayProfile(player,clubId,day){
    const persistent=$runtime.playerStatusForDay(player.id,day);
    const availabilityRoll=seededSerieRand(day,`${clubId}|availability|${player.id}`);
    const randomUnavailable=!persistent.unavailable && availabilityRoll<.012;
    const unavailable=persistent.unavailable || randomUnavailable;
    const doubtful=!unavailable && availabilityRoll<.075;
    const form=$runtime.playerFormMetrics(player.id);
    const formNoise=(seededSerieRand(day,`${clubId}|form|${player.id}`)-.5)*3.2;
    const rotationNoise=(seededSerieRand(day,`${clubId}|rotation|${player.id}`)-.5)*3.2;
    const persistentFormBoost=form.score*2.15;
    const worldEffect=$runtime.worldPlayerModifier(day,player.id);
    const eventStarterDelta=Number(worldEffect?.starterScoreDelta||0);
    const score=$runtime.currentPlayerOvr(player)+formNoise+rotationNoise+persistentFormBoost+eventStarterDelta-(doubtful?3.1:0);
    return {unavailable,doubtful,score,formNoise,persistentUnavailable:persistent.unavailable,status:persistent,form};
  }

  function chooseSerieATacticalShape(clubId,day,available,profiles){
    const feasible=$runtime.SERIEA_TACTICAL_SHAPES.filter(shape=>
      $runtime.ROLE_ORDER.every(role=>available.filter(p=>p.role===role).length>=shape.req[role])
    );
    const shapes=feasible.length?feasible:$runtime.SERIEA_TACTICAL_SHAPES.filter(shape=>
      $runtime.ROLE_ORDER.every(role=>clubPool(clubId).filter(p=>p.role===role).length>=shape.req[role])
    );
    const ranked=(shapes.length?shapes:[$runtime.SERIEA_TACTICAL_SHAPES[0]]).map(shape=>{
      let score=0;
      $runtime.ROLE_ORDER.forEach(role=>{
        const candidates=available.filter(p=>p.role===role).slice().sort((a,b)=>(profiles.get(String(b.id))?.score||0)-(profiles.get(String(a.id))?.score||0));
        score+=candidates.slice(0,shape.req[role]).reduce((s,p)=>s+(profiles.get(String(p.id))?.score||$runtime.currentPlayerOvr(p)),0);
      });
      // Identità tattica: il modulo principale riceve un vantaggio moderato,
      // il secondo un vantaggio più piccolo. Non supera una grossa differenza di qualità.
      const prefs=$runtime.SERIEA_TACTICAL_IDENTITY[clubId]||[];
      if(shape.key===prefs[0]) score+=20;
      else if(shape.key===prefs[1]) score+=8;
      score+=(seededSerieRand(day,`${clubId}|shape|${shape.key}`)-.5)*7.5;
      return {shape,score};
    }).sort((a,b)=>b.score-a.score);
    return ranked[0]?.shape||$runtime.SERIEA_TACTICAL_SHAPES[0];
  }

  function buildSerieAClubSelection(clubId,day){
    const pool=clubPool(clubId);
    const profiles=new Map(pool.map(p=>[String(p.id),serieAPlayerDayProfile(p,clubId,day)]));
    let available=pool.filter(p=>!profiles.get(String(p.id)).unavailable);
    let shape=chooseSerieATacticalShape(clubId,day,available,profiles);

    // Se le indisponibilità rendessero impossibile un XI, recuperiamo il minimo
    // indispensabile dalla rosa per non rompere la simulazione.
    if(!$runtime.ROLE_ORDER.every(role=>available.filter(p=>p.role===role).length>=shape.req[role])){
      available=pool.filter(p=>!profiles.get(String(p.id))?.persistentUnavailable);
      shape=chooseSerieATacticalShape(clubId,day,available,profiles);
    }
    // Safety estremo: evita di rompere la simulazione se un club resta senza 11 eleggibili.
    if(!$runtime.ROLE_ORDER.every(role=>available.filter(p=>p.role===role).length>=shape.req[role])){
      available=pool.slice();
      shape=chooseSerieATacticalShape(clubId,day,available,profiles);
    }

    const starters=[], used=new Set();
    $runtime.ROLE_ORDER.forEach(role=>{
      const candidates=available.filter(p=>p.role===role).slice().sort((a,b)=>{
        const av=profiles.get(String(a.id))?.score||$runtime.currentPlayerOvr(a);
        const bv=profiles.get(String(b.id))?.score||$runtime.currentPlayerOvr(b);
        return bv-av || $runtime.currentPlayerOvr(b)-$runtime.currentPlayerOvr(a);
      });
      candidates.slice(0,shape.req[role]).forEach(p=>{starters.push(p);used.add(String(p.id));});
    });

    const bench=available.filter(p=>!used.has(String(p.id))).slice().sort((a,b)=>{
      const av=profiles.get(String(a.id))?.score||$runtime.currentPlayerOvr(a);
      const bv=profiles.get(String(b.id))?.score||$runtime.currentPlayerOvr(b);
      return bv-av;
    }).slice(0,12);

    const participants=[];
    starters.forEach(p=>participants.push({
      player:p,starter:true,entryMinute:1,plannedExitMinute:90,
      dayScore:profiles.get(String(p.id))?.score||$runtime.currentPlayerOvr(p)
    }));
    bench.forEach(p=>participants.push({
      player:p,starter:false,entryMinute:999,plannedExitMinute:90,
      dayScore:profiles.get(String(p.id))?.score||$runtime.currentPlayerOvr(p)
    }));

    // 3-4 cambi tattici programmati; il quinto slot resta spesso disponibile
    // per un eventuale infortunio.
    const substitutions=[];
    const plannedCount=3+(seededSerieRand(day,`${clubId}|planned-subs`)<.58?1:0);
    const starterItems=participants.filter(x=>x.starter && x.player.role!=='P').slice().sort((a,b)=>
      a.dayScore-b.dayScore || seededSerieRand(day,`${clubId}|subout|${a.player.id}`)-seededSerieRand(day,`${clubId}|subout|${b.player.id}`)
    );
    const benchItems=participants.filter(x=>!x.starter && x.player.role!=='P').slice().sort((a,b)=>b.dayScore-a.dayScore);
    const usedIn=new Set(), usedOut=new Set();

    for(let i=0;i<plannedCount;i++){
      const out=starterItems.find(x=>!usedOut.has(String(x.player.id)) && benchItems.some(y=>!usedIn.has(String(y.player.id))&&y.player.role===x.player.role));
      if(!out) break;
      const incoming=benchItems.find(y=>!usedIn.has(String(y.player.id))&&y.player.role===out.player.role);
      if(!incoming) break;
      const minute=56+Math.floor(seededSerieRand(day,`${clubId}|subminute|${i}|${out.player.id}`)*27);
      out.plannedExitMinute=minute-1;
      incoming.entryMinute=minute;
      usedOut.add(String(out.player.id)); usedIn.add(String(incoming.player.id));
      substitutions.push({
        outPlayerId:String(out.player.id),outPlayerName:out.player.name,
        inPlayerId:String(incoming.player.id),inPlayerName:incoming.player.name,
        role:out.player.role,minute,reason:'tactical',cancelled:false
      });
    }

    return {
      clubId,formation:shape.key,requirements:shape.req,starters,bench,participants,
      substitutions,unavailable:pool.filter(p=>profiles.get(String(p.id))?.unavailable).map(p=>String(p.id))
    };
  }

  function serieAClubStrength(clubId,day){
    const selection=buildSerieAClubSelection(clubId,day);
    const starters=selection?.starters||[];
    if(!starters.length) return 0;
    return matchStrength(starters);
  }

  function matchStrength(starters){
    return serieATeamUnitProfile(starters).overall;
  }

  function serieAUnitWeightedAverage(items,weights,fallback=72){
    let total=0,weight=0;
    (items||[]).forEach(item=>{
      const player=item?.playerId ? $runtime.playerMap.get(String(item.playerId)) : item;
      if(!player) return;
      const w=Number(weights?.[item.role||player.role]||0);
      if(w<=0) return;
      total+=$runtime.currentPlayerOvr(player)*w;
      weight+=w;
    });
    return weight>0?total/weight:Number(fallback||72);
  }

  function serieATeamUnitProfile(items){
    const active=(items||[]).filter(Boolean);
    const activeCount=active.length;
    const missing=Math.max(0,11-activeCount);
    const rawAttack=serieAUnitWeightedAverage(active,$runtime.SERIEA_UNIT_WEIGHTS.attack);
    const rawDefense=serieAUnitWeightedAverage(active,$runtime.SERIEA_UNIT_WEIGHTS.defense);
    const rawControl=serieAUnitWeightedAverage(active,$runtime.SERIEA_UNIT_WEIGHTS.control);
    // Un'espulsione deve cambiare davvero la partita. L'attacco perde opzioni,
    // ma la fase difensiva soffre ancora di più quando la squadra resta in 10.
    return {
      activeCount,
      attack:$runtime.clamp(rawAttack-missing*2.8,55,95),
      defense:$runtime.clamp(rawDefense-missing*4.2,55,95),
      control:$runtime.clamp(rawControl-missing*2.6,55,95),
      overall:$runtime.clamp(rawAttack*.34+rawDefense*.36+rawControl*.30-missing*3.2,55,95)
    };
  }

    return Object.freeze({seededSerieRand,serieAFixtureForPlayer,serieAStrengthRowsForDay,serieAMatchupDifficulty,clubPool,rankedClubPlayers,serieAPlayerDayProfile,chooseSerieATacticalShape,buildSerieAClubSelection,serieAClubStrength,matchStrength,serieAUnitWeightedAverage,serieATeamUnitProfile});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['football-selection']=Object.freeze({create});
})();
