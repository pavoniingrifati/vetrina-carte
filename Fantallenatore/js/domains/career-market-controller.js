/* Responsibility: career-market-controller. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: career-market-controller');
  function ensurePlayerSeasonSystems(season){
    if(!season || $runtime.initializedSeasonSystems.has(season)) return;
    if(!season.playerSeasonStats || typeof season.playerSeasonStats!=='object') season.playerSeasonStats={};
    if(!season.playerStatus || typeof season.playerStatus!=='object') season.playerStatus={};
    if(!season.simDataUpdatedDays || typeof season.simDataUpdatedDays!=='object') season.simDataUpdatedDays={};

    (window.FANTA_PLAYERS||[]).forEach(player=>{
      const id=String(player.id);
      if(!season.playerSeasonStats[id]) season.playerSeasonStats[id]=$runtime.emptyPlayerSeasonStat(player);
      if(!season.playerStatus[id]) season.playerStatus[id]={injuryUntil:0,suspensionUntil:0,yellowAccum:0,lastReason:''};
    });

    if(!Array.isArray(season.serieAStandings) || season.serieAStandings.length!==(window.FANTA_CLUBS||[]).length){
      season.serieAStandings=$runtime.freshSerieAStandings();
      Object.values(season.serieAResults||{}).sort((a,b)=>Number(a.day||0)-Number(b.day||0)).forEach(result=>{
        $runtime.updateSerieAStandingsFromStoredMatches(season,result.matches||[]);
      });
    }
    $runtime.initializedSeasonSystems.add(season);
  }

  function playerSeasonStat(playerId){
    const season=$runtime.state?.season;
    if(!season) return null;
    $runtime.ensurePlayerSeasonSystems(season);
    return season.playerSeasonStats[String(playerId)]||null;
  }

  function ensureSerieATransferMarket(source=$runtime.state){
    if(!source) return $runtime.TransferEngine.createMarketState('career');
    if(!source.transferMarket || typeof source.transferMarket!=='object'){
      source.transferMarket=$runtime.TransferEngine.createMarketState(source.marketSeed||'career');
    }
    const market=source.transferMarket;
    market.seed=String(market.seed||source.marketSeed||'career');
    market.version=Math.max(3,Number(market.version||1));
    if(!Array.isArray(market.foreignPool) || !market.foreignPool.length){
      market.foreignPool=$runtime.TransferEngine.generateForeignPool(market.seed,$runtime.TransferEngine.FOREIGN_POOL_SIZE||300);
    }
    if(!Array.isArray(market.specialPlayers)) market.specialPlayers=[];
    return market;
  }

  function syncSerieATransferWorld(source=$runtime.state){
    if(!source) return null;
    $runtime.activateCatalogBase(source);
    const market=$runtime.ensureSerieATransferMarket(source);
    const world=$runtime.TransferEngine.materializeWorldPlayers($runtime.baseSerieAPlayers,market);
    const baseOvr=source.playerBaseOvr&&typeof source.playerBaseOvr==='object'?source.playerBaseOvr:{};
    const applyBaseOvr=(player)=>{
      const override=Number(baseOvr[String(player?.id)]);
      if(!player || !Number.isFinite(override)) return {...player};
      return {...player,ovr:override,overall:override};
    };
    const activeClubIds=new Set($runtime.ensureRealLeague(source).serieA);
    const serieBWorldPlayers=world.activePlayers.filter(p=>!activeClubIds.has(p.club)).map(p=>({...applyBaseOvr(p),marketStatus:'serie_b',hidden:true}));
    const activePlayers=world.activePlayers.filter(p=>activeClubIds.has(p.club)).map(applyBaseOvr);
    world.activePlayers=activePlayers;
    world.abroadPlayers=(world.abroadPlayers||[]).map(applyBaseOvr);
    world.incomingPlayers=(world.incomingPlayers||[]).map(applyBaseOvr);

    // Il listone runtime contiene soltanto calciatori attualmente in Serie A.
    // Gli espatriati restano nel playerMap/storico, ma spariscono dal listone e
    // dalle rose reali usate dalla simulazione.
    if(!Array.isArray(window.FANTA_PLAYERS)) window.FANTA_PLAYERS=[];
    window.FANTA_PLAYERS.splice(0,window.FANTA_PLAYERS.length,...activePlayers);

    $runtime.playerMap.clear();
    activePlayers.forEach(player=>$runtime.playerMap.set(String(player.id),player));
    serieBWorldPlayers.forEach(player=>$runtime.playerMap.set(String(player.id),player));
    world.abroadPlayers.forEach(player=>$runtime.playerMap.set(String(player.id),{...player}));
    $runtime.refreshMarketValueMap(source);

    // Aggiorna le copie dei giocatori presenti nelle fantasquadre senza toccare
    // prezzo d'asta o altri dati propri della rosa fantasy.
    (source.managers||[]).forEach(manager=>{
      (manager.roster||[]).forEach(item=>{
        const canonical=$runtime.playerMap.get(String(item.id));
        if(!canonical) return;
        const fantasyPrice=item.price;
        Object.assign(item,canonical);
        if(fantasyPrice!==undefined) item.price=fantasyPrice;
      });
    });

    // I nuovi arrivi devono poter produrre statistiche e status già dalla
    // giornata successiva, anche se i sistemi stagione erano già inizializzati.
    const season=source.season;
    if(season?.started){
      season.playerSeasonStats ||= {};
      season.playerStatus ||= {};
      [...activePlayers,...world.abroadPlayers].forEach(player=>{
        const id=String(player.id);
        if(!season.playerSeasonStats[id]) season.playerSeasonStats[id]=$runtime.emptyPlayerSeasonStat(player);
        else {
          season.playerSeasonStats[id].name=player.name;
          season.playerSeasonStats[id].club=player.club;
          season.playerSeasonStats[id].role=player.role;
        }
        if(!season.playerStatus[id]) season.playerStatus[id]={injuryUntil:0,suspensionUntil:0,yellowAccum:0,lastReason:''};
      });
    }

    // Anche il listone svincolati segue il nuovo mondo Serie A.
    const owned=new Set((source.managers||[]).flatMap(manager=>(manager.roster||[]).map(player=>String(player.id))));
    source.availableIds=activePlayers.map(player=>String(player.id)).filter(id=>!owned.has(id));

    market.worldClubMetrics=$runtime.TransferEngine.buildClubWorldMetrics(activePlayers,window.FANTA_CLUBS||[]);
    market.worldRevision=(market.history||[]).length;
    market.worldSummary={
      activePlayers:activePlayers.length,
      abroadPlayers:world.abroadPlayers.length,
      incomingPlayers:world.incomingPlayers.length,
      revision:market.worldRevision
    };
    if(typeof $runtime.serieAStrengthCache!=='undefined') $runtime.serieAStrengthCache={key:null,rows:null};
    return {...world,clubMetrics:market.worldClubMetrics};
  }

  function serieATransferStatsSnapshot(){
    const season=$runtime.state?.season;
    if(!season?.playerSeasonStats) return {};
    const out={};
    Object.entries(season.playerSeasonStats).forEach(([playerId,stat])=>{
      const voteCount=Math.max(0,Number(stat?.voteCount||0));
      out[playerId]={
        appearances:Number(stat?.appearances||0),
        starts:Number(stat?.starts||0),
        goals:Number(stat?.goals||0),
        assists:Number(stat?.assists||0),
        avgVote:voteCount>0?Number(stat?.voteSum||0)/voteCount:0,
        fantasyAverage:voteCount>0?Number(stat?.fantasySum||0)/voteCount:0
      };
    });
    return out;
  }

  function ensureMisterJunior(seasonNumber){
    const market=$runtime.ensureSerieATransferMarket($runtime.state);
    const id=`mister-junior-S${seasonNumber}`;
    const existing=market.specialPlayers.find(player=>player.isMisterJunior || String(player.id).startsWith('mister-junior-'));
    if(existing) return existing;
    const key=`mister-junior|S${seasonNumber}`;
    const role=$runtime.ROLE_ORDER[Math.floor($runtime.careerHash(`${key}|role`)*$runtime.ROLE_ORDER.length)]||'C';
    const ovr=65+Math.floor($runtime.careerHash(`${key}|ovr`)*26);
    const age=17+Math.floor($runtime.careerHash(`${key}|age`)*4);
    const potentialOvr=Math.min(94,ovr+2+Math.floor($runtime.careerHash(`${key}|potential`)*Math.max(3,95-ovr)));
    const clubs=(window.FANTA_CLUBS||[]).filter(club=>club?.id);
    if(!clubs.length) return null;
    const club=String(clubs[Math.floor($runtime.careerHash(`${key}|club`)*clubs.length)].id);
    const name=`${String($runtime.state.managerName||'Fantallenatore').trim()||'Fantallenatore'} Junior`;
    const roleFactor={P:.82,D:.92,C:1.02,A:1.12}[role]||1;
    const base=Math.max(1,(ovr-58)*1.05*roleFactor*1.16*(1+Math.max(0,potentialOvr-ovr)*.018));
    const player={id,name,role,roleLabel:$runtime.ROLE_LABELS[role]||role,nation:'Italia',age,ovr,overall:ovr,potentialOvr,
      quotation:Math.max(1,Math.round(base*.72)),fvm:Math.max(2,Math.round(base*2.05)),
      sourceLeague:'Settore giovanile',sourceNation:'Italia',originClub:'Settore giovanile',
      marketStatus:'pending',hidden:true,club:'',isMisterJunior:true,juniorSeason:seasonNumber};
    market.specialPlayers.push(player);
    return player;
  }

  function addMisterJuniorToWinterPlan(plan,seasonNumber){
    if(!plan || plan.windowType!=='winter') return plan;
    const junior=$runtime.ensureMisterJunior(seasonNumber);
    if(!junior || Number(junior.juniorSeason)!==Number(seasonNumber) || junior.marketStatus!=='pending' || (plan.operations||[]).some(op=>String(op.playerId)===String(junior.id))) return plan;
    const clubs=(window.FANTA_CLUBS||[]).filter(club=>club?.id);
    const destination=String(clubs[Math.floor($runtime.careerHash(`mister-junior|S${seasonNumber}|club`)*clubs.length)].id);
    const operation={id:`arrival-winter-junior-S${seasonNumber}`,type:'arrival',playerId:junior.id,playerName:junior.name,
      role:junior.role,fromClub:null,toClub:destination,destination:null,ovr:junior.ovr,targetOvr:junior.ovr,
      reason:'mister_junior',replacementSource:'special',score:999,externalPlayer:{...junior},specialArrival:true};
    const operations=Array.isArray(plan.operations)?plan.operations.slice():[];
    const replaceIndex=operations.findIndex(op=>op?.type==='arrival');
    if(replaceIndex>=0) operations[replaceIndex]=operation;
    else operations.push(operation);
    plan.operations=operations;
    plan.counts={...(plan.counts||{}),internal:operations.filter(op=>op.type==='internal').length,
      abroad:operations.filter(op=>op.type==='abroad').length,arrivals:operations.filter(op=>op.type==='arrival').length,
      arrivalRequests:operations.filter(op=>op.type==='arrival_request').length,total:operations.length};
    return plan;
  }

  function generateSerieATransferWindowPlan(windowType='winter',externalPool=null){
    if(!$runtime.state) return null;
    const market=$runtime.ensureSerieATransferMarket($runtime.state);
    const seasonNumber=Math.max(1,Number($runtime.state.career?.seasonNumber||1));
    const normalizedType=windowType==='summer'?'summer':'winter';
    const seed=`${market.seed||$runtime.state.marketSeed||'career'}|S${seasonNumber}|${normalizedType}`;
    const hiddenForeignPool=Array.isArray(externalPool)
      ? externalPool
      : (market.foreignPool||[]).filter(player=>player?.marketStatus==='foreign_pool');
    const plan=$runtime.TransferEngine.planWindow({
      windowType:normalizedType,
      seed,
      generatedAt:Date.now(),
      players:window.FANTA_PLAYERS||[],
      clubs:window.FANTA_CLUBS||[],
      statsByPlayer:$runtime.serieATransferStatsSnapshot(),
      externalPool:hiddenForeignPool
    });
    return normalizedType==='winter'?$runtime.addMisterJuniorToWinterPlan(plan,seasonNumber):plan;
  }

  function registerSerieATransferWindowPlan(plan){
    if(!$runtime.state || !plan) return null;
    $runtime.state.transferMarket=$runtime.TransferEngine.applyPlan($runtime.ensureSerieATransferMarket($runtime.state),plan);
    $runtime.syncSerieATransferWorld($runtime.state);
    return $runtime.state.transferMarket;
  }

  function completedSeasonUserPosition(season=$runtime.state?.season){
    if(!season) return 10;
    if(Number.isFinite(Number(season?.careerPrize?.position))) return Number(season.careerPrize.position);
    const rows=$runtime.sortFantasyLeagueStandings(season.standings||[],season);
    const index=rows.findIndex(row=>String(row.managerId)==='user');
    return index>=0?index+1:10;
  }

  function careerSeasonOutcome(position,currentDivision,teamCount){
    const promoted=position===1 && currentDivision>1;
    const champion=position===1 && currentDivision===1;
    const relegated=currentDivision<4 && teamCount>1 && position===teamCount;
    const nextDivision=promoted?currentDivision-1:relegated?currentDivision+1:currentDivision;
    return {promoted,champion,relegated,nextDivision};
  }

  function completedUserSeasonRecap(season=$runtime.state?.season){
    if(!season?.completed) return null;
    if(season.userSeasonRecap) return season.userSeasonRecap;
    const user=$runtime.managerById('user');
    season.userSeasonRecap=window.FantaSeasonRecap.build({
      results:season.matchdayResults||{},
      roster:user?.roster||[],
      development:season.playerOvrDevelopment||season.archivedPlayerOvrDevelopment||{},
      position:$runtime.completedSeasonUserPosition(season)
    });
    $runtime.saveState();
    return season.userSeasonRecap;
  }

  function recordUserAuctionPick(player,winnerId){
    if(!$runtime.state || winnerId!=='user' || !player) return;
    const career=$runtime.ensureCareerEconomy();
    career.auctionPicks ||= [];
    const existing=career.auctionPicks.find(pick=>String(pick.id)===String(player.id));
    if(existing){existing.count=Math.max(1,Number(existing.count||1))+1;existing.seasonNumber=Number(career.seasonNumber||1);}
    else career.auctionPicks.push({id:String(player.id),name:player.name,count:1,seasonNumber:Number(career.seasonNumber||1)});
  }

  function finalizeCompletedSeasonOvrBases(){
    const season=$runtime.state?.season;
    if(!$runtime.state || !season?.completed) return false;
    if(season.ovrBasesFinalized) return true;
    $runtime.state.playerBaseOvr ||= {};
    const snapshot={};
    for(const [id,player] of $runtime.playerMap.entries()){
      if(!player) continue;
      const finalOvr=$runtime.currentPlayerOvr(player);
      snapshot[String(id)]=finalOvr;
      $runtime.state.playerBaseOvr[String(id)]=finalOvr;
    }
    season.finalOvrSnapshot=snapshot;
    season.archivedPlayerOvrDevelopment=JSON.parse(JSON.stringify(season.playerOvrDevelopment||{}));
    season.playerOvrDevelopment={};
    season.ovrBasesFinalized=true;
    season.ovrBasesFinalizedAt=Date.now();
    $runtime.syncSerieATransferWorld($runtime.state);
    $runtime.saveState();
    return true;
  }

  function ensureNextSeasonFlow(){
    const season=$runtime.state?.season;
    if(!$runtime.state || !season?.completed) return null;
    $runtime.completedUserSeasonRecap(season);
    const career=$runtime.ensureCareerEconomy();
    if(!$runtime.state.nextSeasonFlow || Number($runtime.state.nextSeasonFlow.sourceSeasonNumber)!==Number(career.seasonNumber||1)){
      const position=$runtime.completedSeasonUserPosition(season);
      const currentDivision=Math.max(1,Math.floor(Number(career.division||$runtime.GAME_CONFIG.startingDivision)));
      const {promoted,champion,relegated,nextDivision}=$runtime.careerSeasonOutcome(position,currentDivision,$runtime.state.managers.length);
      $runtime.state.nextSeasonFlow={
        version:3,
        sourceSeasonNumber:Number(career.seasonNumber||1),
        stage:'recap',
        position,
        promoted,
        champion,
        relegated,
        currentDivision,
        nextDivision,
        createdAt:Date.now(),
        summerPlanId:null
      };
      $runtime.saveState();
    }else if(Number($runtime.state.nextSeasonFlow.version||0)<3){
      // Recap già aperto in un salvataggio precedente: applica la retrocessione
      // prima di costruire la nuova asta, senza riavviare il mercato estivo.
      const flow=$runtime.state.nextSeasonFlow;
      const outcome=$runtime.careerSeasonOutcome(Number(flow.position||$runtime.completedSeasonUserPosition(season)),Number(flow.currentDivision||career.division),$runtime.state.managers.length);
      Object.assign(flow,outcome,{version:3});
      $runtime.saveState();
    }
    return $runtime.state.nextSeasonFlow;
  }

  function nextSeasonSummerPlan(){
    const flow=$runtime.state?.nextSeasonFlow;
    if(!flow?.summerPlanId) return null;
    return ($runtime.state?.transferMarket?.windows||[]).find(item=>item?.id===flow.summerPlanId)||null;
  }

  function archiveCompletedSeasonIfNeeded(){
    const season=$runtime.state?.season;
    if(!$runtime.state || !season?.completed) return null;
    const career=$runtime.ensureCareerEconomy();
    career.seasonHistory ||= [];
    const seasonNumber=Math.max(1,Number(career.seasonNumber||1));
    const existing=career.seasonHistory.find(item=>Number(item.seasonNumber)===seasonNumber);
    if(existing) return existing;
    const standings=$runtime.sortFantasyLeagueStandings(season.standings||[],season);
    const position=$runtime.completedSeasonUserPosition(season);
    const row=standings.find(item=>String(item.managerId)==='user')||{};
    const flow=$runtime.ensureNextSeasonFlow();
    const archive={
      seasonNumber,
      seasonLabel:$runtime.careerSeasonLabel(seasonNumber),
      division:Number(career.division||$runtime.GAME_CONFIG.startingDivision),
      divisionLabel:$runtime.careerDivisionLabel(career.division),
      position,
      promoted:!!flow?.promoted,
      champion:!!flow?.champion,
      relegated:!!flow?.relegated,
      nextDivision:Number(flow?.nextDivision||career.division||$runtime.GAME_CONFIG.startingDivision),
      nextDivisionLabel:$runtime.careerDivisionLabel(flow?.nextDivision||career.division),
      played:Number(row.played||0),wins:Number(row.wins||0),draws:Number(row.draws||0),losses:Number(row.losses||0),
      gf:Number(row.gf||0),ga:Number(row.ga||0),points:Number(row.points||0),fantasyPoints:Number(row.fantasyPoints||0),
      finalEuros:$runtime.careerEuros(),finalFantapoints:$runtime.careerFantapoints(),
      completedAt:Date.now()
    };
    archive.personalRecap=$runtime.completedUserSeasonRecap(season);
    career.seasonHistory.push(archive);
    $runtime.saveState();
    return archive;
  }

  function renderNextSeasonFlow(){
    const flow=$runtime.ensureNextSeasonFlow();
    const season=$runtime.state?.season;
    if(!flow || !season) return $runtime.renderSeasonDashboard();
    $runtime.showScreen('nextSeasonScreen');
    $runtime.renderCareerWallets();
    const position=Number(flow.position||$runtime.completedSeasonUserPosition(season));
    const nextLabel=$runtime.careerDivisionLabel(flow.nextDivision);
    const currentLabel=$runtime.careerDivisionLabel(flow.currentDivision);
    const promoted=!!flow.promoted;
    const champion=!!flow.champion;
    const relegated=!!flow.relegated;
    const nextNo=Number(flow.sourceSeasonNumber||1)+1;
    const title=$runtime.$('nextSeasonTitle'),subtitle=$runtime.$('nextSeasonSubtitle'),kicker=$runtime.$('nextSeasonKicker');
    if(flow.stage==='market_summary'){
      if(kicker) kicker.textContent=`STAGIONE ${flow.sourceSeasonNumber} CONCLUSA · MERCATO ESTIVO`;
      if(title) title.textContent='Il nuovo mondo Serie A è pronto';
      if(subtitle) subtitle.textContent=`Ora prepara la stagione ${nextNo}: nuovi avversari, nuova asta, nuovi Fantapoteri e nuove regole Admin.`;
    }else{
      if(kicker) kicker.textContent=promoted?'PROMOZIONE!':champion?'CAMPIONE DI SERIE A!':relegated?'RETROCESSIONE':'FINE STAGIONE';
      if(title) title.textContent=promoted?`Destinazione ${nextLabel}`:champion?'Hai vinto la Serie A':relegated?`Si riparte dalla ${nextLabel}`:`Stagione conclusa · ${currentLabel}`;
      if(subtitle) subtitle.textContent=promoted
        ? `Hai chiuso al ${position}° posto e sali di categoria. Prima della nuova asta si apre il mercato estivo della Serie A.`
        : champion
          ? `Hai chiuso al 1° posto e conquistato la Serie A. Ripartirai dalla Serie A con una nuova lega, 9 nuovi avversari e una nuova asta.`
          : relegated
            ? `Hai chiuso all'ultimo posto in ${currentLabel} e retrocedi in ${nextLabel}. Ti aspettano una nuova lega, 9 nuovi avversari e una nuova asta.`
          : `Hai chiuso al ${position}° posto. Ripartirai nella stessa categoria con una nuova lega e nuovi avversari.`;
    }
    const userRow=$runtime.sortFantasyLeagueStandings(season.standings||[],season).find(item=>String(item.managerId)==='user')||{};
    const prize=season.careerPrize||{};
    if($runtime.$('nextSeasonRecapGrid')) $runtime.$('nextSeasonRecapGrid').innerHTML=`
      <article class="panel next-season-stat"><small>POSIZIONE FINALE</small><strong>${position}°</strong><span>${promoted?'PROMOSSO':champion?'CAMPIONE':relegated?'RETROCESSO':'STAGIONE CONCLUSA'}</span></article>
      <article class="panel next-season-stat"><small>CATEGORIA</small><strong>${$runtime.escapeHtml(currentLabel)}</strong><span>${promoted||relegated?`→ ${$runtime.escapeHtml(nextLabel)}`:champion?'TITOLO SERIE A':'PERMANENZA'}</span></article>
      <article class="panel next-season-stat"><small>${$runtime.fantaclassificaIsActive(season)?'FANTACLASSIFICA':'RECORD'}</small><strong>${Number(userRow.wins||0)}V · ${Number(userRow.draws||0)}N · ${Number(userRow.losses||0)}P</strong><span>${$runtime.fantaclassificaIsActive(season)?`${Number(userRow.fantasyPoints||0).toFixed(1)} FANTAPUNTI`:`${Number(userRow.points||0)} PUNTI`}</span></article>
      <article class="panel next-season-stat"><small>PREMIO STAGIONE</small><strong>${Number(prize.amount||0)>0?`+${Number(prize.amount||0)} €`:'—'}</strong><span>FP ${$runtime.careerFantapoints()} · € ${$runtime.careerEuros()}</span></article>`;
    if(flow.stage==='market_summary' && $runtime.state.realLeague?.lastChanges){
      const changes=$runtime.state.realLeague.lastChanges;
      $runtime.$('nextSeasonRecapGrid')?.insertAdjacentHTML('beforeend',`<article class="panel next-season-stat"><small>SERIE A REALE · PROMOSSE</small><p>${changes.promoted.map(id=>$runtime.escapeHtml($runtime.clubName(id))).join(' · ')}</p><small>RETROCESSE IN SERIE B</small><p>${changes.relegated.map(id=>$runtime.escapeHtml($runtime.clubName(id))).join(' · ')}</p></article>`);
    }
    $runtime.renderSeasonKeeperChoice();
    const personal=$runtime.completedUserSeasonRecap(season);
    const formatAverage=value=>Number(value||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});
    const award=(icon,title,item,value,detail)=>{
      const player=item?.id?$runtime.managerById('user')?.roster?.find(p=>String(p.id)===String(item.id)):null;
      return `<article class="next-season-personal-award"><div class="next-season-personal-head"><span aria-hidden="true">${icon}</span><small>${$runtime.escapeHtml(title)}</small></div><div class="next-season-personal-player">${player?`<span class="next-season-personal-face">${$runtime.playerAvatarMarkup(player,player.name)}</span>`:''}<strong>${$runtime.escapeHtml(item?.name||'—')}</strong></div><b>${item?$runtime.escapeHtml(value):'—'}</b><span class="next-season-personal-detail">${item?$runtime.escapeHtml(detail):'Nessun giocatore idoneo'}</span></article>`;
    };
    if($runtime.$('nextSeasonPersonalGrid') && personal){
      const appearances=item=>`${item.appearances} presenze nella tua fantasquadra`;
      $runtime.$('nextSeasonPersonalGrid').innerHTML=
        award('⚽','CAPOCANNONIERE',personal.scorer,`${personal.scorer?.goals||0} gol`,appearances(personal.scorer||{appearances:0}))+
        award('👟','ASSIST MAN',personal.assister,`${personal.assister?.assists||0} assist`,appearances(personal.assister||{appearances:0}))+
        award('⭐','MIGLIOR MEDIA VOTO',personal.topVote,formatAverage(personal.topVote?.avgVote),`Minimo 5 voti · ${appearances(personal.topVote||{appearances:0})}`)+
        award('🔥','MIGLIOR FANTAMEDIA',personal.topFantasy,formatAverage(personal.topFantasy?.avgFantasy),`Minimo 5 voti · ${appearances(personal.topFantasy||{appearances:0})}`)+
        award('💎','MIGLIOR ACQUISTO',personal.bestPurchase,`${formatAverage(personal.bestPurchase?.avgFantasy)} FM`,`Costo d’asta ${personal.bestPurchase?.cost||0} crediti · ${appearances(personal.bestPurchase||{appearances:0})}`)+
        award('📈','PIÙ MIGLIORATO',personal.improved,`+${personal.improved?.delta||0} OVR`,`Da ${personal.improved?.start||0} a ${personal.improved?.end||0} OVR`)+
        award('📉','PIÙ PEGGIORATO',personal.declined,`${personal.declined?.delta||0} OVR`,`Da ${personal.declined?.start||0} a ${personal.declined?.end||0} OVR`);
    }
    const marketCard=$runtime.$('nextSeasonMarketCard');
    const primary=$runtime.$('nextSeasonPrimaryBtn');
    if(flow.stage==='market_summary'){
      marketCard?.classList.remove('hidden');
      const plan=$runtime.nextSeasonSummerPlan();
      const counts=plan?.counts||{};
      if($runtime.$('nextSeasonMarketStats')) $runtime.$('nextSeasonMarketStats').innerHTML=`<div class="winter-transfer-stat"><strong>${Number(counts.internal||0)}</strong><span>TRASFERIMENTI</span></div><div class="winter-transfer-stat"><strong>${Number(counts.abroad||0)}</strong><span>PARTENZE</span></div><div class="winter-transfer-stat"><strong>${Number(counts.arrivals||0)}</strong><span>NUOVI ARRIVI</span></div>`;
      if($runtime.$('nextSeasonTransferList')) $runtime.$('nextSeasonTransferList').innerHTML=(plan?.operations||[]).map($runtime.winterTransferOperationMarkup).join('') || '<div class="next-season-empty">Nessuna operazione registrata.</div>';
      $runtime.wireSeasonPlayerButtons($runtime.$('nextSeasonTransferList'));
      if(primary) primary.textContent='SCEGLI I FANTAPOTERI';
    }else{
      marketCard?.classList.add('hidden');
      if(primary) primary.textContent='SIMULA MERCATO ESTIVO';
    }
  }

  async function simulateNextSeasonSummerMarket(){
    const flow=$runtime.ensureNextSeasonFlow();
    if(!flow || flow.stage!=='recap' || $runtime.nextSeasonMarketSimulationRunning) return;
    $runtime.nextSeasonMarketSimulationRunning=true;
    const loading=$runtime.$('nextSeasonLoading'),button=$runtime.$('nextSeasonPrimaryBtn');
    if(button){button.disabled=true;button.textContent='MERCATO IN CORSO...';}
    if(loading){loading.classList.remove('hidden');loading.setAttribute('aria-hidden','false');}
    const steps=[
      ['Consolidamento OVR...','I valori finali della stagione diventano la nuova base dei giocatori.'],
      ['Mercato estivo in corso...','I club stanno valutando cessioni, acquisti e nuovi arrivi.'],
      ['Aggiornamento Serie A...','Rose, gerarchie e listone della nuova stagione stanno venendo ricostruiti.']
    ];
    for(const [title,description] of steps){
      if($runtime.$('nextSeasonLoadingTitle')) $runtime.$('nextSeasonLoadingTitle').textContent=title;
      if($runtime.$('nextSeasonLoadingText')) $runtime.$('nextSeasonLoadingText').textContent=description;
      await new Promise(resolve=>setTimeout(resolve,620));
      if(title.startsWith('Consolidamento')) $runtime.finalizeCompletedSeasonOvrBases();
    }
    $runtime.advanceRealLeague($runtime.state,$runtime.sortedSerieAStandings());
    const plan=$runtime.generateSerieATransferWindowPlan('summer');
    $runtime.registerSerieATransferWindowPlan(plan);
    flow.summerPlanId=plan?.id||null;
    flow.stage='market_summary';
    flow.summerCompletedAt=Date.now();
    $runtime.saveState();
    if(loading){loading.classList.add('hidden');loading.setAttribute('aria-hidden','true');}
    if(button) button.disabled=false;
    $runtime.nextSeasonMarketSimulationRunning=false;
    $runtime.renderNextSeasonFlow();
  }

  function renderSeasonKeeperChoice(){
    const grid=$runtime.$('nextSeasonRecapGrid');
    if(!grid || !$runtime.leagueRulesFor($runtime.state).keeperConfirmation)return;
    const selected=String($runtime.state.season?.keeperPlayerId||'');
    const roster=$runtime.managerById('user')?.roster||[];
    const panel=document.createElement('article');panel.className='panel next-season-stat';
    panel.innerHTML=`<small>CONFERMA PER LA PROSSIMA ASTA</small><p>Scegli un giocatore al prezzo pagato. Puoi anche non confermare nessuno.</p><select id="seasonKeeperSelect" aria-label="Giocatore da confermare"><option value="">Nessuna conferma</option>${roster.map(p=>`<option value="${$runtime.escapeHtml(String(p.id))}" ${String(p.id)===selected?'selected':''}>${$runtime.escapeHtml(p.name)} · ${p.role} · ${Number(p.price||1)} crediti</option>`).join('')}</select><p>Se il giocatore lascia il listone o cambi universo, la conferma viene annullata senza costi.</p>`;
    grid.append(panel);
    panel.querySelector('select').addEventListener('change',event=>{$runtime.state.season.keeperPlayerId=event.target.value;$runtime.saveState();});
  }

  function applySeasonKeeper(draft){
    const keeper=draft?.pendingKeeper;
    if(!keeper)return;
    const manager=draft.managers?.find(m=>m.id==='user');
    const player=(window.FANTA_PLAYERS||[]).find(p=>String(p.id)===String(keeper.id));
    const price=Math.max(1,Number(keeper.price||1));
    if(!manager || !player || player.marketStatus==='abroad' || price>manager.budget){draft.pendingKeeper=null;$runtime.showToast('Conferma annullata: giocatore non disponibile nel nuovo listone.',true);return;}
    if(!manager.roster.some(p=>String(p.id)===String(player.id))){
      manager.roster.push({...player,price});manager.budget-=price;
      draft.availableIds=draft.availableIds.filter(id=>String(id)!==String(player.id));
      draft.log.unshift(`CONFERMATO · ${player.name} · ${price} cr`);
    }
    draft.pendingKeeper=null;
  }

  function buildNextSeasonCareerDraft(){
    const flow=$runtime.ensureNextSeasonFlow();
    const season=$runtime.state?.season;
    if(!flow || flow.stage!=='market_summary' || !season?.completed) return null;
    $runtime.archiveCompletedSeasonIfNeeded();
    $runtime.finalizeCompletedSeasonOvrBases();
    const oldCareer=$runtime.ensureCareerEconomy();
    const nextCareer=JSON.parse(JSON.stringify($runtime.compactLongCareerState($runtime.state).career));
    nextCareer.seasonNumber=Math.max(1,Number(oldCareer.seasonNumber||1))+1;
    nextCareer.division=Number(flow.nextDivision||oldCareer.division||$runtime.GAME_CONFIG.startingDivision);
    const auctionBonus=Math.max(0,Number(oldCareer.nextAuctionBonusCredits||0));
    nextCareer.nextAuctionBonusCredits=0;
    const managers=$runtime.freshManagers($runtime.state.teamName||'Team JHZ',$runtime.state.managerName||'Mister',nextCareer.division);
    if(managers[0]) managers[0].budget=$runtime.INITIAL_BUDGET+auctionBonus;
    const seasonalSeed=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}-S${nextCareer.seasonNumber}`;
    const inventory={...(season.consumables?.inventory||{})};
    return {
      version:24,
      marketSeed:seasonalSeed,
      currentRoleIndex:0,
      startedAt:Date.now(),
      teamName:$runtime.state.teamName||'Team JHZ',
      managerName:$runtime.state.managerName||'Mister',
      coachAvatar:$runtime.normalizedCoachAvatar($runtime.state.coachAvatar),
      tradeWindows:{},tradeBudgetAdjustments:{},
      managers,
      auctionStartingBudgets:Object.fromEntries(managers.map(manager=>[manager.id,Number(manager.budget||$runtime.INITIAL_BUDGET)])),
      availableIds:(window.FANTA_PLAYERS||[]).map(player=>String(player.id)),
      nominationIndex:0,
      nominationCalls:{},
      auction:null,
      roleTransition:null,
      log:[],
      turbo:false,
      completed:false,
      stats:{purchases:0,totalSpent:0,highest:null},
      auctionEvents:{count:0,lastPurchaseAt:-99,history:[],activeEffects:[],pending:null,relationships:{}},
      auctionPowers:{block:false,scout:false,bluff:false,observer:false,oneShot:false,uses:{block:0,scout:0,bluff:0,oneShot:0},selected:[]},
      leagueRules:flow.preAuctionRules ? JSON.parse(JSON.stringify(flow.preAuctionRules)) : $runtime.defaultLeagueRules(),
      leagueRulesRerollCount:Number(flow.preAuctionRulesRerollCount||0),
      transferMarket:JSON.parse(JSON.stringify($runtime.ensureSerieATransferMarket($runtime.state))),
      playerBaseOvr:{...($runtime.state.playerBaseOvr||{})},
      realLeague:JSON.parse(JSON.stringify($runtime.ensureRealLeague($runtime.state))),
      catalogMode:$runtime.state.catalogMode||'base',
      pokemonCatalogSeed:$runtime.state.pokemonCatalogSeed||null,
      catalogWorlds:JSON.parse(JSON.stringify($runtime.state.catalogWorlds||{})),
      pendingKeeper:$runtime.leagueRulesFor($runtime.state).keeperConfirmation ? (()=>{const p=$runtime.managerById('user')?.roster?.find(p=>String(p.id)===String(season.keeperPlayerId||''));return p?{id:String(p.id),price:Number(p.price||1)}:null;})():null,
      auctionReputation:$runtime.buildSeasonAuctionReputation(season),
      carryoverConsumables:inventory,
      sponsorOfferIds:$runtime.shuffledCopy(Object.keys($runtime.SEASON_SPONSORS)).slice(0,3),
      career:nextCareer,
      integrity:{checks:0,repairs:0,warnings:0,lastCheck:null,recent:[]},
      nextSeasonMeta:{fromSeason:Number(flow.sourceSeasonNumber||1),promotion:!!flow.promoted,champion:!!flow.champion,relegation:!!flow.relegated,fromDivision:Number(flow.currentDivision),toDivision:Number(flow.nextDivision),auctionBonusCredits:auctionBonus}
    };
  }

  function openNextSeasonAuctionSetup(){
    const draft=$runtime.buildNextSeasonCareerDraft();
    if(!draft) return;
    $runtime.careerDraft=draft;
    $runtime.careerPowerSelection=[];
    $runtime.careerRulesNextAction='auction';
    $runtime.nextSeasonSetupMode=true;
    $runtime.$('careerTeamNameInput').value=$runtime.careerDraft.teamName;
    $runtime.$('coachNameInput').value=$runtime.careerDraft.managerName;
    $runtime.updateCareerIdentityControls();
    const title=document.querySelector('#careerSetupScreen .career-title h2');
    const subtitle=document.querySelector('#careerSetupScreen .career-title p');
    if(title) title.textContent=`Stagione ${$runtime.careerDraft.career.seasonNumber} · ${$runtime.careerDivisionLabel($runtime.careerDraft.career.division)}`;
    if(subtitle) subtitle.innerHTML=`${$runtime.escapeHtml($runtime.careerSeasonLabel($runtime.careerDraft.career.seasonNumber))} · NUOVA ASTA · 9 NUOVI AVVERSARI`;
    if($runtime.$('careerPowersBackBtn')) $runtime.$('careerPowersBackBtn').textContent='← MERCATO ESTIVO';
    $runtime.showCareerSetupStep('powers');
    $runtime.renderCareerPowerSelection();
    $runtime.$('careerSetupScreen').classList.remove('hidden');
  }

  function handleNextSeasonPrimaryAction(){
    const flow=$runtime.ensureNextSeasonFlow();
    if(!flow) return;
    if(flow.stage==='market_summary') $runtime.openNextSeasonAuctionSetup();
    else $runtime.simulateNextSeasonSummerMarket();
  }

  function winterExpectedWindowId(){
    const market=$runtime.ensureSerieATransferMarket($runtime.state);
    const seasonNumber=Math.max(1,Number($runtime.state?.career?.seasonNumber||1));
    return `winter-${market.seed||$runtime.state?.marketSeed||'career'}|S${seasonNumber}|winter`;
  }

  function winterMarketPlan(){
    const id=$runtime.state?.winterMarketFlow?.planId||$runtime.winterExpectedWindowId();
    return ($runtime.state?.transferMarket?.windows||[]).find(item=>item?.id===id)||null;
  }

  function createWinterBudgetLedger(){
    return Object.fromEntries(($runtime.state?.managers||[]).map(manager=>[manager.id,{
      initialLeftover:Math.max(0,Number(manager.budget||0)),baseGrant:0,foreignRefund:0,releaseRefund:0,winterSpent:0
    }]));
  }

  function winterLedgerFor(managerId){
    const flow=$runtime.state?.winterMarketFlow;
    if(!flow) return null;
    flow.ledger ||= $runtime.createWinterBudgetLedger();
    return flow.ledger[managerId] ||= {initialLeftover:0,baseGrant:0,foreignRefund:0,releaseRefund:0,winterSpent:0};
  }

  function expectedWinterBudget(managerId){
    const row=$runtime.winterLedgerFor(managerId);
    if(!row) return null;
    return Math.max(0,Number(row.initialLeftover||0)+Number(row.baseGrant||0)+Number(row.foreignRefund||0)+Number(row.releaseRefund||0)-Number(row.winterSpent||0)+Number(row.tradeCashDelta||0));
  }

  function ensureWinterMarketFlow(){
    const season=$runtime.state?.season;
    if(!season?.started || Number(season.lastCompletedMatchday||0)<$runtime.WINTER_TRANSFER_TRIGGER_MATCHDAY) return null;
    if($runtime.state.winterMarketFlow?.stage==='completed') return $runtime.state.winterMarketFlow;
    if(!$runtime.state.winterMarketFlow){
      const existing=($runtime.state.transferMarket?.windows||[]).find(item=>item?.id===$runtime.winterExpectedWindowId());
      $runtime.state.winterMarketFlow={
        version:1,seasonNumber:Math.max(1,Number($runtime.state.career?.seasonNumber||1)),
        stage:existing?'summary':'intro',planId:existing?.id||null,ledger:$runtime.createWinterBudgetLedger(),
        userReleaseIds:[],foreignDepartures:[],userForeignRefunds:[],cpuReleases:[],userReleases:[],createdAt:Date.now()
      };
      if(existing) $runtime.settleWinterMarketFinances(existing);
      $runtime.saveState();
    }
    return $runtime.state.winterMarketFlow;
  }

  function activateWinterTransferWindowIfNeeded(){
    return $runtime.ensureWinterMarketFlow();
  }

  function winterTransferOperationMarkup(operation){
    const player=$runtime.playerMap.get(String(operation.playerId))||(window.FANTA_PLAYERS||[]).find(item=>String(item.id)===String(operation.playerId));
    const name=$runtime.escapeHtml(operation.playerName||player?.name||'Giocatore');
    const type=operation.reason==='mister_junior'?'ARRIVO · JUNIOR':operation.type==='internal'?'SERIE A':operation.type==='abroad'?'ESTERO':operation.reason==='replacement'?'ARRIVO · SOSTITUTO':'ARRIVO';
    const from=operation.reason==='mister_junior'?'Settore giovanile':operation.type==='arrival'?'Estero':$runtime.clubName(operation.fromClub);
    const to=operation.type==='abroad'?'Estero':$runtime.clubName(operation.toClub);
    const stat=$runtime.playerSeasonStat(operation.playerId)||{};
    const dataPro=$runtime.shopItemActive('fantadata_pro',$runtime.state?.season);
    const scoutPlus=$runtime.shopItemActive('scout_plus',$runtime.state?.season);
    const avg=Number(stat.voteCount||0)?(Number(stat.voteSum||0)/Number(stat.voteCount)).toFixed(2):'—';
    const favg=Number(stat.voteCount||0)?(Number(stat.fantasySum||0)/Number(stat.voteCount)).toFixed(2):'—';
    const starter=player?$runtime.estimatedStarterProbability(player):0;
    return `<button type="button" class="winter-transfer-player-card is-${operation.type}" data-season-player="${$runtime.escapeHtml(String(operation.playerId||''))}">
      <span class="winter-transfer-avatar">${player?$runtime.playerAvatarMarkup(player,name):''}</span>
      <span class="winter-transfer-player-main"><small class="winter-transfer-type">${type}</small><strong>${name}</strong><em>${$runtime.escapeHtml(from)} <b>→</b> ${$runtime.escapeHtml(to)}</em></span>
      <span class="winter-transfer-overall"><small>OVR</small><strong>${player?$runtime.playerOvrLabel(player):'—'}</strong></span>
      <span class="winter-transfer-role role-${$runtime.escapeHtml(player?.role||'')}"><small>RUOLO</small><strong>${$runtime.escapeHtml(player?.role||'—')}</strong></span>
      <span class="winter-transfer-insights">
        <span class="${scoutPlus?'is-unlocked':'is-locked'}"><small>TITOLARE</small><b>${scoutPlus?`${starter}%`:'🔒 Scout Plus'}</b></span>
        <span class="${dataPro?'is-unlocked':'is-locked'}"><small>MV</small><b>${dataPro?avg:'🔒'}</b></span>
        <span class="${dataPro?'is-unlocked':'is-locked'}"><small>FM</small><b>${dataPro?favg:'🔒'}</b></span>
        <span><small>G / A</small><b>${Number(stat.goals||0)} / ${Number(stat.assists||0)}</b></span>
      </span>
    </button>`;
  }

  function settleWinterMarketFinances(plan){
    const flow=$runtime.state?.winterMarketFlow;
    if(!flow || flow.financesSettled) return;
    ($runtime.state.managers||[]).forEach(manager=>{
      const ledger=$runtime.winterLedgerFor(manager.id);
      ledger.baseGrant=$runtime.WINTER_AUCTION_BASE_CREDITS;
      manager.budget=Number(manager.budget||0)+$runtime.WINTER_AUCTION_BASE_CREDITS;
    });
    (plan?.operations||[]).filter(operation=>operation.type==='abroad'&&operation.playerId).forEach(operation=>{
      for(const manager of $runtime.state.managers||[]){
        const index=(manager.roster||[]).findIndex(item=>String(item.id)===String(operation.playerId));
        if(index<0) continue;
        const [item]=manager.roster.splice(index,1);
        const refund=Math.max(0,Number(item.price||0));
        manager.budget+=refund;
        $runtime.winterLedgerFor(manager.id).foreignRefund+=refund;
        const record={managerId:manager.id,playerId:String(item.id),playerName:item.name,refund,paid:Number(item.price||0)};
        flow.foreignDepartures.push(record);
        if(manager.id==='user') flow.userForeignRefunds.push(record);
        break;
      }
    });
    flow.financesSettled=true;
    delete $runtime.state.transferMarket.pendingWindowSummaryId;
    delete $runtime.state.transferMarket.pendingWindowSummarySeason;
    $runtime.syncSerieATransferWorld($runtime.state);
  }

  async function simulateWinterMarket(){
    const flow=$runtime.ensureWinterMarketFlow();
    if(!flow || flow.stage!=='intro' || $runtime.winterMarketSimulationRunning) return;
    $runtime.winterMarketSimulationRunning=true;
    const overlay=$runtime.$('winterMarketLoading'),button=$runtime.$('simulateWinterMarketBtn');
    const loadingSteps=[
      ['Analisi delle trattative...','I club stanno valutando acquisti e cessioni.'],
      ['Registrazione dei trasferimenti...','Contratti e destinazioni vengono confermati.'],
      ['Aggiornamento delle rose...','Gerarchie, titolarità e listone stanno cambiando.']
    ];
    if(button){button.disabled=true;button.textContent='MERCATO IN CORSO...';}
    if(overlay){overlay.classList.add('show');overlay.setAttribute('aria-hidden','false');}
    for(const [title,description] of loadingSteps){
      if($runtime.$('winterMarketLoadingTitle')) $runtime.$('winterMarketLoadingTitle').textContent=title;
      if($runtime.$('winterMarketLoadingText')) $runtime.$('winterMarketLoadingText').textContent=description;
      await new Promise(resolve=>setTimeout(resolve,700));
    }
    const plan=$runtime.generateSerieATransferWindowPlan('winter');
    $runtime.registerSerieATransferWindowPlan(plan);
    flow.planId=plan.id;
    $runtime.settleWinterMarketFinances(plan);
    flow.stage='summary';
    flow.simulatedAt=Date.now();
    $runtime.saveState();
    if(overlay){overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true');}
    if(button){button.disabled=false;button.textContent='SIMULA MERCATO';}
    $runtime.winterMarketSimulationRunning=false;
    $runtime.renderWinterMarketSummary();
  }

  function renderWinterMarketIntro(){ $runtime.showScreen('winterMarketIntroScreen'); }

  function renderWinterMarketSummary(){
    const flow=$runtime.ensureWinterMarketFlow();
    const plan=$runtime.winterMarketPlan();
    if(!flow||!plan) return $runtime.renderWinterMarketIntro();
    $runtime.showScreen('winterMarketSummaryScreen');
    const counts=plan.counts||{};
    $runtime.$('winterFlowStats').innerHTML=`<div class="winter-transfer-stat"><strong>${Number(counts.internal||0)}</strong><span>TRASFERIMENTI</span></div><div class="winter-transfer-stat"><strong>${Number(counts.abroad||0)}</strong><span>PARTENZE</span></div><div class="winter-transfer-stat"><strong>${Number(counts.arrivals||0)}</strong><span>NUOVI ARRIVI</span></div>`;
    $runtime.$('winterFlowTransferList').innerHTML=(plan.operations||[]).map($runtime.winterTransferOperationMarkup).join('');
    $runtime.wireSeasonPlayerButtons($runtime.$('winterFlowTransferList'));
    const me=$runtime.managerById('user'),ledger=$runtime.winterLedgerFor('user');
    const refunds=flow.userForeignRefunds||[];
    $runtime.$('winterUserRefunds').innerHTML=`<h3>Il tuo budget di gennaio: ${Number(me?.budget||0)} crediti</h3><div class="winter-refund-row"><strong>Bonus base mercato invernale</strong><b>+${Number(ledger?.baseGrant||0)}</b></div><div class="winter-refund-row"><strong>Crediti avanzati dall'asta iniziale</strong><b>${Number(ledger?.initialLeftover||0)}</b></div>${refunds.length?refunds.map(row=>`<div class="winter-refund-row"><strong>${$runtime.escapeHtml(row.playerName)} · trasferito all'estero</strong><b>+${row.refund}</b></div>`).join(''):'<div class="winter-refund-row"><strong>Nessun tuo giocatore trasferito all’estero</strong><b>+0</b></div>'}`;
  }

  function cpuWinterReleaseScore(player,manager){
    const form=$runtime.playerFormMetrics(player.id);
    const starter=$runtime.estimatedStarterProbability(player);
    const roleDepth=$runtime.roleCount(manager,player.role);
    return Number(player.ovr||60)*1.3+Number(player.quotation||1)*.7+starter*.12+Number(form.avg||6)*2+(roleDepth<=$runtime.ROLE_LIMITS[player.role]?-2:0);
  }

  function releaseWinterPlayer(manager,player,source='voluntary'){
    const index=(manager?.roster||[]).findIndex(item=>String(item.id)===String(player.id));
    if(index<0) return null;
    const [item]=manager.roster.splice(index,1);
    const refund=Math.max(0,Math.round(Number(item.quotation||player.quotation||0)));
    manager.budget=Number(manager.budget||0)+refund;
    $runtime.winterLedgerFor(manager.id).releaseRefund+=refund;
    if(!$runtime.state.availableIds.includes(String(item.id))) $runtime.state.availableIds.push(String(item.id));
    return {managerId:manager.id,playerId:String(item.id),playerName:item.name,role:item.role,refund,source};
  }

  function processCpuWinterReleases(){
    const flow=$runtime.state?.winterMarketFlow;
    if(!flow || flow.cpuReleasesProcessed) return;
    $runtime.state.managers.filter(manager=>manager.id!=='user').forEach(manager=>{
      const roll=$runtime.careerHash(`winter-releases|S${flow.seasonNumber}|${manager.id}`);
      const count=roll<.12?0:roll<.55?1:roll<.86?2:3;
      const candidates=(manager.roster||[]).slice().sort((a,b)=>$runtime.cpuWinterReleaseScore(a,manager)-$runtime.cpuWinterReleaseScore(b,manager));
      candidates.slice(0,count).forEach(player=>{
        const record=$runtime.releaseWinterPlayer(manager,player,'cpu');
        if(record) flow.cpuReleases.push(record);
      });
    });
    flow.cpuReleasesProcessed=true;
  }

  function openWinterReleases(){
    const flow=$runtime.ensureWinterMarketFlow();
    if(!flow||flow.stage!=='summary') return;
    flow.stage='releases';
    $runtime.processCpuWinterReleases();
    $runtime.saveState();
    $runtime.renderWinterReleaseScreen();
  }

  function useGuaranteedWinterSale(playerId){
    const flow=$runtime.state?.winterMarketFlow,season=$runtime.ensureSeasonState(),me=$runtime.managerById('user');
    if(!flow||flow.stage!=='releases'||!season||$runtime.consumableQuantity('cons_guaranteed_sale',season)<=0) return false;
    const index=(me?.roster||[]).findIndex(item=>String(item.id)===String(playerId));
    if(index<0) return false;
    const [item]=me.roster.splice(index,1);
    const refund=Math.max(0,Math.round(Number(item.price||item.quotation||0)));
    me.budget=Number(me.budget||0)+refund;
    $runtime.winterLedgerFor('user').releaseRefund+=refund;
    if(!$runtime.state.availableIds.includes(String(item.id))) $runtime.state.availableIds.push(String(item.id));
    if(!$runtime.consumeConsumable('cons_guaranteed_sale',{day:season.currentMatchday,note:'guaranteed_winter_sale',targetPlayerId:item.id})) return false;
    flow.userReleases.push({managerId:'user',playerId:String(item.id),playerName:item.name,role:item.role,refund,source:'guaranteed_sale',paid:Number(item.price||0)});
    flow.userReleaseIds=(flow.userReleaseIds||[]).map(String).filter(id=>id!==String(item.id));
    $runtime.winterGuaranteedSaleMode=false;
    $runtime.saveState();
    $runtime.showToast(`Cessione Garantita: ${item.name} ceduto · +${refund} crediti.`);
    $runtime.renderWinterReleaseScreen();
    return true;
  }

  function toggleGuaranteedWinterSaleMode(){
    const season=$runtime.ensureSeasonState();
    if(!season||$runtime.consumableQuantity('cons_guaranteed_sale',season)<=0) return;
    $runtime.winterGuaranteedSaleMode=!$runtime.winterGuaranteedSaleMode;
    $runtime.renderWinterReleaseScreen();
  }

  function renderWinterReleaseScreen(){
    const flow=$runtime.ensureWinterMarketFlow();
    if(!flow) return;
    $runtime.processCpuWinterReleases();
    $runtime.showScreen('winterReleaseScreen');
    const me=$runtime.managerById('user');
    const selected=new Set(flow.userReleaseIds||[]);
    $runtime.$('winterReleaseList').innerHTML=(me?.roster||[]).slice().sort((a,b)=>$runtime.ROLE_ORDER.indexOf(a.role)-$runtime.ROLE_ORDER.indexOf(b.role)||Number(b.ovr||0)-Number(a.ovr||0)).map(player=>{
      const isSelected=selected.has(String(player.id));
      const stat=$runtime.playerSeasonStat(player.id)||{};
      return `<button class="winter-release-player ${isSelected?'selected':''}" data-winter-release-player="${$runtime.escapeHtml(String(player.id))}" type="button" aria-pressed="${isSelected}">
        <span class="lineup-role-chip role-${player.role}">${player.role}</span>
        <span class="winter-release-identity"><strong>${$runtime.escapeHtml(player.name)}</strong><small>${$runtime.escapeHtml($runtime.clubShort(player.club))} · OVR ${$runtime.playerOvrLabel(player)}</small></span>
        <span class="winter-release-value"><b>+${Math.max(0,Math.round(Number(player.quotation||0)))} cr</b><em>${isSelected?'✓ SELEZIONATO':'SVINCOLA'}</em></span>
        <span class="winter-release-stats"><span><small>PRES</small><b>${Number(stat.appearances||0)}</b></span><span><small>TIT</small><b>${Number(stat.starts||0)}</b></span><span><small>MIN</small><b>${Number(stat.minutes||0)}</b></span><span><small>GOL</small><b>${Number(stat.goals||0)}</b></span><span><small>ASSIST</small><b>${Number(stat.assists||0)}</b></span></span>
      </button>`
    }).join('');
    document.querySelectorAll('[data-winter-release-player]').forEach(button=>button.addEventListener('click',()=>{
      if($runtime.winterGuaranteedSaleMode) $runtime.useGuaranteedWinterSale(button.dataset.winterReleasePlayer);
      else $runtime.toggleWinterRelease(button.dataset.winterReleasePlayer);
    }));
    const refund=(me?.roster||[]).filter(player=>selected.has(String(player.id))).reduce((sum,player)=>sum+Math.max(0,Math.round(Number(player.quotation||0))),0);
    $runtime.$('winterReleaseBudget').textContent=Number(me?.budget||0);
    $runtime.$('winterReleaseCount').textContent=selected.size;
    $runtime.$('winterReleaseRefund').textContent=`+${refund}`;
    $runtime.$('winterReleaseSlots').textContent=Math.max(0,$runtime.TOTAL_SLOTS-Number(me?.roster?.length||0)+selected.size);
    const guaranteedBtn=$runtime.$('winterGuaranteedSaleBtn'),guaranteedQty=$runtime.consumableQuantity('cons_guaranteed_sale');
    if(guaranteedBtn){
      guaranteedBtn.textContent=`💼 CESSIONE GARANTITA · ×${guaranteedQty}${$runtime.winterGuaranteedSaleMode?' · SCEGLI':''}`;
      guaranteedBtn.disabled=guaranteedQty<=0;
      guaranteedBtn.classList.toggle('active',$runtime.winterGuaranteedSaleMode);
    }
    if($runtime.$('winterGuaranteedSaleHint')) $runtime.$('winterGuaranteedSaleHint').textContent=$runtime.winterGuaranteedSaleMode?'Clicca il giocatore da cedere: recupererai il prezzo pagato all’asta.':'Recupera il prezzo pagato all’asta invece della quotazione base.';
  }

  function toggleWinterRelease(playerId){
    const flow=$runtime.state?.winterMarketFlow;
    if(!flow||flow.stage!=='releases') return;
    const ids=new Set(flow.userReleaseIds||[]),id=String(playerId);
    if(ids.has(id)) ids.delete(id); else ids.add(id);
    flow.userReleaseIds=[...ids];
    $runtime.saveState();
    $runtime.renderWinterReleaseScreen();
  }

  function confirmWinterReleases(){
    const flow=$runtime.state?.winterMarketFlow;
    if(!flow||flow.stage!=='releases') return;
    const me=$runtime.managerById('user');
    (flow.userReleaseIds||[]).forEach(id=>{
      const player=(me?.roster||[]).find(item=>String(item.id)===String(id));
      if(!player) return;
      const record=$runtime.releaseWinterPlayer(me,player,'user');
      if(record) flow.userReleases.push(record);
    });
    flow.userReleaseIds=[];
    if($runtime.state.season?.lineups) delete $runtime.state.season.lineups[String($runtime.state.season.currentMatchday||20)];
    if($runtime.state.season) $runtime.state.season.assistantCoachLineup={enabled:!!$runtime.state.season.assistantCoachLineup?.enabled,formation:null,starters:{},bench:[],updatedAt:Date.now(),lastSourceDay:0};
    $runtime.startWinterRepairAuction();
  }

  function startWinterRepairAuction(){
    const flow=$runtime.state?.winterMarketFlow;
    if(!flow) return;
    $runtime.syncSerieATransferWorld($runtime.state);
    flow.stage='auction';
    flow.auctionStartedAt=Date.now();
    $runtime.state.completed=false;
    $runtime.state.auction=null;
    $runtime.state.roleTransition=null;
    $runtime.state.currentRoleIndex=0;
    if($runtime.openRoleAuction() && $runtime.$('roleFilter')) $runtime.$('roleFilter').value='ALL';
    $runtime.state.nominationIndex=0;
    $runtime.state.nominationCalls={};
    $runtime.state.auctionEvents={count:0,lastPurchaseAt:-99,history:[],activeEffects:[],pending:null,relationships:$runtime.state.auctionEvents?.relationships||{}};
    $runtime.advanceRolePhaseIfNeeded();
    if($runtime.state.currentRoleIndex<$runtime.ROLE_ORDER.length && $runtime.roleSlotsRemaining($runtime.state.managers[$runtime.state.nominationIndex],$runtime.currentAuctionRole())<=0){
      $runtime.state.nominationIndex=$runtime.nextNominatorIndex($runtime.state.nominationIndex);
    }
    $runtime.saveState();
    $runtime.showScreen('auctionScreen');
    $runtime.renderAll();
    if($runtime.state.currentRoleIndex>=$runtime.ROLE_ORDER.length) return $runtime.finishAuction();
    if($runtime.userCompletedCurrentRole($runtime.currentAuctionRole())) $runtime.beginRoleRemainderAutoSim($runtime.currentAuctionRole());
    if($runtime.state.managers[$runtime.state.nominationIndex]?.id!=='user'||$runtime.autocompleteMode) $runtime.scheduleNomination();
  }

  function routeWinterMarketFlow(){
    const flow=$runtime.ensureWinterMarketFlow();
    if(!flow||flow.stage==='completed') return false;
    if(flow.stage==='intro') $runtime.renderWinterMarketIntro();
    else if(flow.stage==='summary') $runtime.renderWinterMarketSummary();
    else if(flow.stage==='releases') $runtime.renderWinterReleaseScreen();
    else if(flow.stage==='trades') $runtime.renderTradeWindow('winter');
    else if(flow.stage==='auction'){
      $runtime.showScreen('auctionScreen');$runtime.renderAll();
      if(!$runtime.state.auction && $runtime.state.managers[$runtime.state.nominationIndex]?.id!=='user') $runtime.scheduleNomination();
    }
    return true;
  }

  function showPendingWinterTransferSummary(){ return false; }

  function closeWinterTransferSummary(){ $runtime.$('winterTransferModal')?.classList.add('hidden'); }

  function playerSeasonStatus(playerId){
    const season=$runtime.state?.season;
    if(!season) return {injuryUntil:0,suspensionUntil:0,yellowAccum:0,lastReason:''};
    $runtime.ensurePlayerSeasonSystems(season);
    return season.playerStatus[String(playerId)]||{injuryUntil:0,suspensionUntil:0,yellowAccum:0,lastReason:''};
  }

  function playerStatusForDay(playerId,day){
    const canonical=$runtime.playerMap.get(String(playerId));
    if(canonical?.marketStatus==='abroad' || canonical?.club==='estero'){
      return {unavailable:true,type:'abroad',label:'FUORI SERIE A',className:'abroad'};
    }
    const status=$runtime.playerSeasonStatus(playerId);
    const d=Number(day||$runtime.state?.season?.currentMatchday||1);
    if(Number(status.injuryUntil||0)>=d){
      return {unavailable:true,type:'injury',label:`INFORTUNATO · rientro G${Number(status.injuryUntil)+1}`,className:'injured'};
    }
    if(Number(status.suspensionUntil||0)>=d){
      return {unavailable:true,type:'suspension',label:`SQUALIFICATO · rientro G${Number(status.suspensionUntil)+1}`,className:'suspended'};
    }
    return {unavailable:false,type:'available',label:'DISPONIBILE',className:'available'};
  }

  function playerFormMetrics(playerId){
    const stat=$runtime.playerSeasonStat(playerId);
    const recent=(stat?.recent||[]).filter(x=>Number.isFinite(Number(x.vote))).slice(-5);
    if(!recent.length) return {count:0,avg:6,trend:0,arrow:'→',className:'neutral',score:0,recent:[]};
    const avg=recent.reduce((s,x)=>s+Number(x.vote),0)/recent.length;
    const previous=recent.length>1?recent.slice(0,-1).reduce((s,x)=>s+Number(x.vote),0)/(recent.length-1):avg;
    const trend=Number(recent[recent.length-1].vote)-previous;
    const arrow=trend>.22?'↑':trend<-.22?'↓':'→';
    const className=trend>.22?'up':trend<-.22?'down':'neutral';
    const score=$runtime.clamp((avg-6)*1.45 + trend*.42,-1.6,1.6);
    return {count:recent.length,avg,trend,arrow,className,score,recent};
  }

  function qualitativeFormLabel(form){
    if(!form?.count) return 'FORMA N/D';
    if(Number(form.avg)>=6.5 || Number(form.score)>=.45) return '🔥 IN FORMA';
    if(Number(form.avg)<=5.75 || Number(form.score)<=-.55) return '⚠ IN CALO';
    if(Number(form.trend)>.22) return '↗ IN CRESCITA';
    if(Number(form.trend)<-.22) return '↘ IN CALO';
    return '→ STABILE';
  }

  function visibleFormLabel(playerId,precision=1,season=$runtime.ensureSeasonState()){
    const form=$runtime.playerFormMetrics(playerId);
    if($runtime.shopItemActive('fantadata_pro',season)) return form.count?`${form.arrow} ${form.avg.toFixed(precision)}`:'—';
    return $runtime.qualitativeFormLabel(form);
  }

  function visibleNewsDetail(item,season=$runtime.ensureSeasonState()){
    if(!item) return '';
    if($runtime.shopItemActive('fantadata_pro',season)) return String(item.detail||'');
    if((item.type==='form'||item.type==='cold') && item.playerId){
      const form=$runtime.playerFormMetrics(item.playerId);
      if(item.type==='form') return `${$runtime.qualitativeFormLabel(form)} · rendimento recente positivo. Dati numerici con FantaData Pro.`;
      return `${$runtime.qualitativeFormLabel(form)} · rendimento recente da monitorare. Dati numerici con FantaData Pro.`;
    }
    return String(item.detail||'');
  }

  function playerAvailabilityText(playerId,day){
    return $runtime.playerStatusForDay(playerId,day);
  }

  function sortedSerieAStandings(){
    const season=$runtime.ensureSeasonState();
    if(!season) return [];
    $runtime.ensurePlayerSeasonSystems(season);
    return $runtime.sortStandings(season.serieAStandings);
  }

  function updateSerieAStandingsFromStoredMatches(season,matches){
    if(!season?.serieAStandings) return;
    $runtime.applyClubMatches(season.serieAStandings,matches);
  }

  function seasonPlayerOwner(playerId){
    for(const manager of $runtime.state?.managers||[]){
      const item=(manager.roster||[]).find(p=>String(p.id)===String(playerId));
      if(item) return {manager,item};
    }
    return null;
  }
    return Object.freeze({ensurePlayerSeasonSystems,playerSeasonStat,ensureSerieATransferMarket,syncSerieATransferWorld,serieATransferStatsSnapshot,ensureMisterJunior,addMisterJuniorToWinterPlan,generateSerieATransferWindowPlan,registerSerieATransferWindowPlan,completedSeasonUserPosition,careerSeasonOutcome,completedUserSeasonRecap,recordUserAuctionPick,finalizeCompletedSeasonOvrBases,ensureNextSeasonFlow,nextSeasonSummerPlan,archiveCompletedSeasonIfNeeded,renderNextSeasonFlow,simulateNextSeasonSummerMarket,renderSeasonKeeperChoice,applySeasonKeeper,buildNextSeasonCareerDraft,openNextSeasonAuctionSetup,handleNextSeasonPrimaryAction,winterExpectedWindowId,winterMarketPlan,createWinterBudgetLedger,winterLedgerFor,expectedWinterBudget,ensureWinterMarketFlow,activateWinterTransferWindowIfNeeded,winterTransferOperationMarkup,settleWinterMarketFinances,simulateWinterMarket,renderWinterMarketIntro,renderWinterMarketSummary,cpuWinterReleaseScore,releaseWinterPlayer,processCpuWinterReleases,openWinterReleases,useGuaranteedWinterSale,toggleGuaranteedWinterSaleMode,renderWinterReleaseScreen,toggleWinterRelease,confirmWinterReleases,startWinterRepairAuction,routeWinterMarketFlow,showPendingWinterTransferSummary,closeWinterTransferSummary,playerSeasonStatus,playerStatusForDay,playerFormMetrics,qualitativeFormLabel,visibleFormLabel,visibleNewsDetail,playerAvailabilityText,sortedSerieAStandings,updateSerieAStandingsFromStoredMatches,seasonPlayerOwner});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['career-market-controller']=Object.freeze({create});
})();
