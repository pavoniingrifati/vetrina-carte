/* Responsibility: auction-policy. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: auction-policy');
  function comparableAuctionFvm(player){
    if(!player) return 1;
    const role=String(player.role||'');
    const currentOvr=Math.max(50,Math.min(99,Number($runtime.currentPlayerOvr(player)||player.ovr||60)));
    const baseFvm=Math.max(1,Number(player.fvm||1));
    const original=$runtime.basePlayerValueReference.get(String(player.id));

    // Nessuna modifica alla valutazione della stagione iniziale.
    if(original && Number(original.ovr||0)===currentOvr) return baseFvm;

    const peers=$runtime.baseSerieAPlayers
      .filter(candidate=>String(candidate.role||'')===role)
      .slice()
      .sort((a,b)=>Math.abs(Number(a.ovr||0)-currentOvr)-Math.abs(Number(b.ovr||0)-currentOvr) || Number(b.fvm||0)-Number(a.fvm||0))
      .slice(0,7);
    const peerValues=peers.map(candidate=>Math.max(1,Number(candidate.fvm||1))).sort((a,b)=>a-b);
    const middle=Math.floor(peerValues.length/2);
    const peerMedian=peerValues.length
      ? (peerValues.length%2?peerValues[middle]:(peerValues[middle-1]+peerValues[middle])/2)
      : baseFvm;

    if(!original){
      // Nuovo arrivo: il FVM generato resta valido, ma non può essere molto
      // inferiore a quello di giocatori comparabili già presenti in Serie A.
      return Math.max(baseFvm,peerMedian*.72);
    }

    const originalOvr=Math.max(50,Math.min(99,Number(original.ovr||currentOvr)));
    const delta=Math.max(-12,Math.min(12,currentOvr-originalOvr));
    const evolvedFvm=baseFvm*Math.pow(1.105,delta);
    if(delta>0) return Math.max(evolvedFvm,peerMedian*.68);
    return Math.max(1,evolvedFvm);
  }

  function careerMarketProfiles(source=$runtime.state){
    const profiles=new Map();
    if(!source || Number(source.career?.seasonNumber||1)<=1) return profiles;
    const groups=new Map();
    for(const player of window.FANTA_PLAYERS||[]){
      if(player.marketStatus==='abroad') continue;
      const key=`${player.club}|${player.role}`;
      if(!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(player);
    }
    for(const players of groups.values()){
      const ordered=players.slice().sort((a,b)=>Number(b.ovr)-Number(a.ovr) || String(a.id).localeCompare(String(b.id)));
      const role=ordered[0].role;
      const slots=$runtime.clubRoleStarterSlots(ordered[0].club,role);
      const entries=ordered.map((p,rank)=>({id:p.id,score:Number(p.ovr)+$runtime.starterHierarchyBias(role,rank,slots),unavailable:false}));
      for(const player of ordered){
        const pct=$runtime.normalizedStarterProbability(entries,player.id,slots,role==='P'?2.4:4.4)/100;
        const factor=role==='P' ? .08+.92*pct : .22+.78*pct;
        const peers=$runtime.baseSerieAPlayers.filter(p=>p.role===role).slice()
          .sort((a,b)=>Math.abs(Number(a.ovr)-Number(player.ovr))-Math.abs(Number(b.ovr)-Number(player.ovr)))
          .slice(0,7);
        const median=values=>{const sorted=values.slice().sort((a,b)=>a-b);const i=Math.floor(sorted.length/2);return sorted.length?(sorted.length%2?sorted[i]:(sorted[i-1]+sorted[i])/2):1;};
        const peerFvm=median(peers.map(p=>Math.max(1,Number(p.fvm||1))));
        const peerQuote=median(peers.map(p=>Math.max(1,Number(p.quotation||1))));
        const peerOvr=median(peers.map(p=>Number(p.ovr||60)));
        const strength=Math.pow(1.08,$runtime.clamp(Number(player.ovr)-peerOvr,-20,20));
        profiles.set(String(player.id),{
          // Recompute from immutable baseline peers, never last season's price.
          fvm:Math.max(1,peerFvm*strength*factor),
          quotation:Math.max(1,Math.round(peerQuote*strength*factor)),starterPct:Math.round(pct*100)
        });
      }
    }
    return profiles;
  }

  function buildMarketValueMap(profiles=new Map()) {
    const valuationPlayers=(window.FANTA_PLAYERS||[]).map(player=>({
      ...player,
      ovr:$runtime.currentPlayerOvr(player),
      fvm:profiles.get(String(player.id))?.fvm ?? $runtime.comparableAuctionFvm(player)
    }));
    return $runtime.AuctionEngine.buildMarketValueMap(valuationPlayers,$runtime.ROLE_LIMITS,$runtime.MARKET_ALPHA,$runtime.MARKET_VALUE_POOL_TARGET,10);
  }

  function refreshMarketValueMap(source=$runtime.state){
    const profiles=$runtime.careerMarketProfiles(source);
    for(const player of window.FANTA_PLAYERS||[]){
      const profile=profiles.get(String(player.id));
      if(profile) player.quotation=profile.quotation;
    }
    $runtime.marketValueMap=$runtime.buildMarketValueMap(profiles);
    if(typeof $runtime.slotRankingCache!=='undefined') $runtime.slotRankingCache.clear();
    return $runtime.marketValueMap;
  }

  function baseAuctionValue(player) {
    if(!player) return 1;
    const mapped=$runtime.marketValueMap.get(player.id) ?? $runtime.marketValueMap.get(String(player.id));
    if(Number.isFinite(Number(mapped)) && Number(mapped)>0) return Math.max(1,Number(mapped));
    // Fallback di sicurezza per record non ancora sincronizzati: mai più 1 fisso
    // per un giocatore forte soltanto perché il suo ID non era nel listone iniziale.
    const comparable=$runtime.comparableAuctionFvm(player);
    return Math.max(1,Number(player.quotation||1)*.9,comparable*.12);
  }

  function roleSpend(manager, role) {
    return manager.roster.filter(x => x.role === role).reduce((sum,x)=>sum + Number(x.price||0), 0);
  }

  function targetFor(manager, role) {
    return Number(manager.profile?.targets?.[role] || $runtime.MARKET_ROLE_TARGET[role]);
  }

  function cpuLeagueRuleSensitivity(manager){
    if(!manager || manager.id==='user') return 0;
    const arch=$runtime.profileArchetype(manager);
    const map={
      admin:1.25,stratega:1.22,esperto:1.18,moneyball:1.15,ragioniere:1.10,tirchio:1.05,
      rivale:.95,tifoso:.82,bomber:.78,spendaccione:.72,collezionista:.72,gambler:.72,pazzo:.55
    };
    return Number(map[arch] ?? 1);
  }

  function cpuLeagueRuleAuctionFactor(manager,player){
    if(!manager || manager.id==='user' || !player) return 1;
    const rules=$runtime.leagueRulesFor($runtime.state);
    const sensitivity=$runtime.cpuLeagueRuleSensitivity(manager);
    const role=String(player.role||'');
    const analysis=$runtime.auctionPlayerAnalysis(player);
    const starterPct=Number(analysis?.starterPct||55);
    const market=Math.max(1,$runtime.baseAuctionValue(player));
    let factor=1;

    // Modificatore classico: P e soprattutto D affidabili acquistano più valore.
    if(rules.defenseModifier==='classic'){
      if(role==='P') factor*=1+.025*sensitivity;
      if(role==='D') factor*=1+.055*sensitivity;
      if((role==='P'||role==='D') && Number(player.ovr||0)>=80) factor*=1+.012*sensitivity;
    }

    // Porta inviolata: il beneficio diretto è del portiere.
    if(Number(rules.cleanSheetBonus||0)>0 && role==='P') factor*=1+.05*sensitivity;

    // Con pochi cambi la CPU paga di più la sicurezza di titolarità e penalizza le scommesse.
    const starterSignal=$runtime.clamp((starterPct-55)/40,-1,1);
    if(Number(rules.maxFantasySubs)===1) factor*=1+starterSignal*.06*sensitivity;
    else if(Number(rules.maxFantasySubs)===3) factor*=1+starterSignal*.028*sensitivity;
    else if(Number(rules.maxFantasySubs)>=5 && ['C','A'].includes(role) && market>=$runtime.TOP_VALUE_THRESHOLD[role]*.75) factor*=1+.012*sensitivity;

    // Soglia 65: leggero premio all'upside offensivo. A 67 conta un po' di più l'affidabilità.
    if(Number(rules.firstGoalThreshold)===65){
      if(role==='A') factor*=1+.035*sensitivity;
      else if(role==='C') factor*=1+.018*sensitivity;
    }else if(Number(rules.firstGoalThreshold)===67){
      factor*=1+Math.max(0,starterSignal)*.018*sensitivity;
      if(role==='P'||role==='D') factor*=1+.008*sensitivity;
    }

    return $runtime.clamp(factor,.88,1.16);
  }

  function scarcityFactor(player) {
    if (!$runtime.state) return 1;
    const availableCount = $runtime.state.availableIds.reduce((n,id) => n + ($runtime.playerMap.get(id)?.role === player.role ? 1 : 0), 0);
    const outstandingSlots = $runtime.state.managers.reduce((sum,m)=>sum + $runtime.roleSlotsRemaining(m, player.role), 0);
    if (!outstandingSlots || !availableCount) return 1;
    const ratio = outstandingSlots / availableCount;
    return $runtime.clamp(.97 + .15 * ratio, .96, 1.12);
  }

  function freePerSlot(manager) {
    const left = $runtime.slotsRemaining(manager);
    if (left <= 0) return 0;
    return Math.max(0, manager.budget - left) / left;
  }

  function wealthFactor(manager, player) {
    if (!$runtime.state) return 1;
    const peers = $runtime.state.managers.filter(m => $runtime.roleSlotsRemaining(m, player.role) > 0 && $runtime.slotsRemaining(m) > 0);
    const values = peers.map($runtime.freePerSlot).filter(v => v > 0).sort((a,b)=>a-b);
    if (!values.length) return 1;
    const mid = Math.floor(values.length/2);
    const median = values.length%2 ? values[mid] : (values[mid-1]+values[mid])/2;
    if (median <= 0) return 1;
    const ratio = $runtime.freePerSlot(manager) / median;
    const phase = manager.roster.length / $runtime.TOTAL_SLOTS;
    const exponent = .10 + .22 * phase;
    return $runtime.clamp(Math.pow(Math.max(.1,ratio), exponent), .85, 1.40);
  }

  function urgencyFactor(manager) {
    const left = $runtime.slotsRemaining(manager);
    if (left <= 0) return 1;
    let remainingPlan = 0;
    Object.keys($runtime.ROLE_LIMITS).forEach(role => {
      const roleLeft = $runtime.roleSlotsRemaining(manager, role);
      if (roleLeft > 0) remainingPlan += Math.max(roleLeft, $runtime.targetFor(manager,role)-$runtime.roleSpend(manager,role));
    });
    const ratio = manager.budget / Math.max(left, remainingPlan);
    const phase = manager.roster.length / $runtime.TOTAL_SLOTS;
    const urgency = ratio >= 1
      ? 1 + (ratio-1) * (.18 + .95*phase)
      : 1 - (1-ratio) * .10;
    return $runtime.clamp(urgency, .86, 2.10);
  }

  function cpuRoleUrgencyState(manager, role=$runtime.currentAuctionRole()) {
    if (!$runtime.state || !manager || manager.id==='user' || !role) return {active:false,severity:0,roleLeft:0,validLeft:0};
    const roleLeft=Math.max(0,$runtime.roleSlotsRemaining(manager,role));
    if(roleLeft<2) return {active:false,severity:0,roleLeft,validLeft:0};
    const cutoff=Math.max(3,$runtime.TOP_VALUE_THRESHOLD[role]*.52);
    const available=$runtime.state.availableIds.map(id=>$runtime.playerMap.get(id)).filter(p=>p&&p.role===role&&$runtime.canOwn(manager,p)&&$runtime.maxLegalBid(manager,p)>=1);
    const validLeft=available.filter(p=>$runtime.baseAuctionValue(p)>=cutoff).length;
    const pressure=roleLeft/Math.max(1,validLeft);
    const supplyTight=available.length<=roleLeft*4;
    const active=supplyTight && validLeft<=roleLeft+2;
    const severity=active?$runtime.clamp((pressure-.45)*1.25,0,1):0;
    return {active,severity,roleLeft,validLeft};
  }

  function hasGoodRelations(manager){
    if(!manager || manager.id==='user' || !$runtime.state) return false;
    const r=$runtime.relationship(manager.id);
    return Number(r.trust||0)>=63 && Number(r.rivalry||0)<=4 && Number(r.agreements||0)>=1 && Number(r.betrayals||0)===0;
  }

  function isHotRival(manager){
    if(!manager || manager.id==='user' || !$runtime.state) return false;
    const r=$runtime.relationship(manager.id);
    // V3.2.35.44: RIVALE CALDO è uno stato raro. Servono almeno cinque
    // veri duelli prolungati, non semplici incroci di un singolo rilancio.
    return Number(r.duels||0)>=5 && Number(r.rivalry||0)>=10 && !$runtime.hasGoodRelations(manager);
  }

  function needFactor(manager, player) {
    const left = $runtime.roleSlotsRemaining(manager, player.role);
    if (left <= 0) return 0;
    if (left === 1) return 1.07;
    if (left === 2) return 1.025;
    return 1;
  }

  function auctionReputationMultiplier(player,source=$runtime.state){
    if(Number(source?.career?.seasonNumber||1)<=1) return 1;
    return Number(source?.auctionReputation?.[String(player.id)]?.multiplier||1);
  }

  function buildSeasonAuctionReputation(season){
    const rows=Object.entries(season?.playerSeasonStats||{}).map(([id,stat])=>({id,...stat}));
    const result={};
    const awards=[['capocannoniere',1.15,rows.filter(p=>Number(p.goals||0)>0),p=>Number(p.goals||0)],['assistman',1.12,rows.filter(p=>Number(p.assists||0)>0),p=>Number(p.assists||0)],['mvp',1.18,rows.filter(p=>Number(p.voteCount||0)>=19),p=>Number(p.fantasySum||0)/Number(p.voteCount)]];
    for(const [award,multiplier,pool,value] of awards){
      if(!pool.length)continue;
      const best=Math.max(...pool.map(value));
      for(const player of pool.filter(p=>Math.abs(value(p)-best)<.000001)){
        const entry=result[player.id] ||= {multiplier:1,awards:[]};
        entry.multiplier=Math.max(entry.multiplier,multiplier);entry.awards.push(award);
      }
    }
    return result;
  }

  function cpuAuctionCompetence(manager,division=$runtime.state?.career?.division||$runtime.GAME_CONFIG.startingDivision){
    if(!manager || manager.id==='user') return 0;
    return ({4:0,3:.40,2:.75,1:1})[Math.max(1,Math.min(4,Number(division)))]||0;
  }

  function cpuAuctionRoleQuality(role){
    const key=`football-quality|${role}`;
    let cached=$runtime.slotRankingCache.get(key);
    const day=Number($runtime.state?.season?.currentMatchday||0);
    if(!cached || cached.pool!==window.FANTA_PLAYERS || cached.playerCount!==window.FANTA_PLAYERS.length || cached.day!==day || cached.seed!==$runtime.state?.marketSeed){
      const values=(window.FANTA_PLAYERS||[]).filter(p=>p.role===role).map(p=>$runtime.currentPlayerOvr(p)).sort((a,b)=>a-b);
      const middle=Math.floor(values.length/2);
      const median=values.length ? (values.length%2?values[middle]:(values[middle-1]+values[middle])/2) : 70;
      cached={pool:window.FANTA_PLAYERS,playerCount:window.FANTA_PLAYERS.length,day,seed:$runtime.state?.marketSeed,median,starterEstimates:new Map(),footballFactors:new Map()};
      $runtime.slotRankingCache.set(key,cached);
    }
    return cached;
  }

  function cpuAuctionStarterEstimate(player){
    if(!player) return 0;
    const quality=$runtime.cpuAuctionRoleQuality(player.role);
    if(!quality.starterEstimates.has(player.id)) quality.starterEstimates.set(player.id,$runtime.auctionStarterProbability(player));
    return quality.starterEstimates.get(player.id);
  }

  function cpuFootballAuctionFactor(manager,player){
    const skill=$runtime.cpuAuctionCompetence(manager);
    if(!skill || !player) return 1;
    const quality=$runtime.cpuAuctionRoleQuality(player.role);
    if(quality.footballFactors.has(player.id)) return 1+(quality.footballFactors.get(player.id)-1)*skill;
    const median=quality.median;
    const starter=$runtime.cpuAuctionStarterEstimate(player);
    // Prezzo, qualità e probabilità di giocare sono segnali distinti. Nessun
    // accesso all'esito futuro delle partite o al potenziale nascosto stagionale.
    const footballFactor=$runtime.clamp(1+($runtime.currentPlayerOvr(player)-median)*.035+(starter-55)*.0018,.68,1.65);
    quality.footballFactors.set(player.id,footballFactor);
    return 1+(footballFactor-1)*skill;
  }

  function cpuCoverageEnabled(manager){
    return !!manager && manager.id!=='user' && Number($runtime.state?.career?.division||$runtime.GAME_CONFIG.startingDivision)<=2;
  }

  function cpuClubRoleHierarchy(club,role){
    const key=`cover-hierarchy|${club}|${role}`;
    let cached=$runtime.slotRankingCache.get(key);
    if(!cached || cached.players!==window.FANTA_PLAYERS){
      const players=window.FANTA_PLAYERS.filter(p=>p.club===club && p.role===role && p.marketStatus!=='abroad')
        .slice().sort((a,b)=>Number(b.ovr||0)*100+Number(b.fvm||0)*.22+Number(b.quotation||0)*.4-(Number(a.ovr||0)*100+Number(a.fvm||0)*.22+Number(a.quotation||0)*.4) || String(a.id).localeCompare(String(b.id)));
      cached={players:window.FANTA_PLAYERS,hierarchy:players};$runtime.slotRankingCache.set(key,cached);
    }
    return cached.hierarchy;
  }

  function cpuMainKeeper(manager){
    return manager.roster.filter(p=>p.role==='P').map(p=>$runtime.playerMap.get(p.id)||p)
      .filter(p=>$runtime.cpuClubRoleHierarchy(p.club,'P')[0]?.id===p.id && $runtime.cpuAuctionStarterEstimate(p)>=55)
      .sort((a,b)=>$runtime.currentPlayerOvr(b)-$runtime.currentPlayerOvr(a) || String(a.id).localeCompare(String(b.id)))[0] || null;
  }

  function cpuCoverInfo(manager,player){
    if(!$runtime.cpuCoverageEnabled(manager) || !player || !$runtime.canOwn(manager,player))return null;
    // No hidden identity may be used to recognise a mystery backup.
    if($runtime.state?.auction?.arcade?.type==='mystery' && $runtime.state.auction.playerId===player.id)return null;
    const owned=manager.roster.filter(p=>p.role===player.role && p.club===player.club && p.id!==player.id);
    if(!owned.length)return null;
    const peers=$runtime.cpuClubRoleHierarchy(player.club,player.role),rank=peers.findIndex(p=>p.id===player.id);
    const slots=$runtime.clubRoleStarterSlots(player.club,player.role);
    if(player.role==='P'){
      const starter=peers[0];
      if(rank!==1 || !starter || $runtime.cpuMainKeeper(manager)?.id!==starter.id || !owned.some(p=>p.id===starter.id) || $runtime.cpuAuctionStarterEstimate(starter)<55)return null;
      const ceiling=$runtime.profileArchetype(manager)==='admin'?7:Number($runtime.state.career.division)===1?6:4;
      return {kind:'keeper',starterId:starter.id,ceiling,factor:1.8};
    }
    // Outfield coverage is only a weak preference for the first rotation option
    // behind a probable owned starter, not a guaranteed positional replacement.
    if(rank!==slots || $runtime.cpuAuctionStarterEstimate(player)>45 || $runtime.cpuAuctionStarterEstimate(player)<5)return null;
    const starter=owned.map(p=>$runtime.playerMap.get(p.id)||p).find(p=>peers.findIndex(x=>x.id===p.id)>=0 && peers.findIndex(x=>x.id===p.id)<slots && $runtime.cpuAuctionStarterEstimate(p)>=55 && $runtime.currentPlayerOvr(p)-$runtime.currentPlayerOvr(player)<=10);
    if(!starter || owned.some(p=>peers.findIndex(x=>x.id===p.id)>=slots))return null;
    return {kind:'rotation',starterId:starter.id,ceiling:12,factor:$runtime.profileArchetype(manager)==='admin'?1.16:1.10};
  }

  function cpuMissingKeeperCover(manager){
    if(!$runtime.cpuCoverageEnabled(manager) || $runtime.roleSlotsRemaining(manager,'P')<1)return null;
    for(const owned of manager.roster.filter(p=>p.role==='P')){
      const second=$runtime.cpuClubRoleHierarchy(owned.club,'P')[1];
      if(second && $runtime.state.availableIds.includes(second.id) && $runtime.cpuCoverInfo(manager,second))return second;
    }
    return null;
  }

  function cpuKeeperReserve(manager,player){
    if(!$runtime.cpuCoverageEnabled(manager))return 0;
    const missing=$runtime.cpuMissingKeeperCover(manager);
    if(missing && missing.id!==player.id)return Math.min($runtime.cpuCoverInfo(manager,missing).ceiling,Math.max(0,manager.budget-$runtime.slotsRemaining(manager)));
    // Protect a small backup fund when buying a new first-choice goalkeeper.
    if(player.role==='P' && $runtime.roleSlotsRemaining(manager,'P')>=2){
      const peers=$runtime.cpuClubRoleHierarchy(player.club,'P');
      if(peers[0]?.id===player.id && peers[1] && $runtime.state.availableIds.includes(peers[1].id))return Number($runtime.state.career.division)===1?5:3;
    }
    return 0;
  }

  function cpuOpenRoleSpendingCap(manager,player,bundlePlayers=null){
    const members=bundlePlayers||[player],left=$runtime.roleSlotsRemaining(manager,player.role);
    const legal=bundlePlayers?$runtime.AuctionEngine.maxBundleBid(manager,members,$runtime.ROLE_LIMITS,$runtime.TOTAL_SLOTS):$runtime.maxLegalBid(manager,player);
    if(legal<members.length) return legal;
    const plans={};let total=0;
    for(const role of $runtime.ROLE_ORDER){
      const missing=$runtime.roleSlotsRemaining(manager,role);
      plans[role]=missing?Math.max(0,$runtime.targetFor(manager,role)-$runtime.roleSpend(manager,role)-missing):0;
      total+=plans[role];
    }
    // Fund every unfinished department before bidding, even in lower divisions.
    // Completed departments release their unused funds. Old overspent saves
    // share the remaining balance proportionally rather than freezing all bids.
    const extra=Math.max(0,manager.budget-$runtime.slotsRemaining(manager));
    const roleFund=left+(total>0?extra*plans[player.role]/total:extra*left/Math.max(1,$runtime.slotsRemaining(manager)));
    let room=Math.max(members.length,Math.floor(roleFund)-Math.max(0,left-members.length));
    const desired={P:1,D:4,C:4,A:3}[player.role]||1;
    const median=$runtime.cpuAuctionRoleQuality(player.role).median;
    const credible=p=>$runtime.currentPlayerOvr(p)>=median+3 && $runtime.cpuAuctionStarterEstimate(p)>=45;
    const owned=manager.roster.filter(p=>p.role===player.role && credible(p)).length;
    const need=Math.max(0,Math.min(desired-owned,left));
    if(need>=2){
      const bought=members.filter(credible).length;
      const share=bought>=need?1:bought>=2?.85:need>=4?.42:need>=3?.52:.68;
      room=Math.max(members.length,Math.floor(room*share));
    }
    const depthReserve=$runtime.ROLE_ORDER.reduce((sum,role)=>sum+
      Math.max(0,$runtime.roleSlotsRemaining(manager,role)-members.filter(p=>p.role===role).length)*({P:2,D:3,C:4,A:6}[role]||3),0);
    // Keep usable money for the remaining bench too, releasing it as slots fill.
    return Math.max(members.length,Math.min(legal,room,manager.budget-depthReserve));
  }

  function cpuAuctionSpendingCap(manager,player,bundlePlayers=null){
    const legal=bundlePlayers?$runtime.AuctionEngine.maxBundleBid(manager,bundlePlayers,$runtime.ROLE_LIMITS,$runtime.TOTAL_SLOTS):$runtime.maxLegalBid(manager,player),skill=$runtime.cpuAuctionCompetence(manager);
    const openCap=$runtime.openRoleAuction()?$runtime.cpuOpenRoleSpendingCap(manager,player,bundlePlayers):legal;
    if(!skill || legal<1) return openCap;
    const key=`football-budget|${manager.id}|${player.role}`;
    let plan=$runtime.slotRankingCache.get(key);
    if(!plan || plan.availableIds!==$runtime.state.availableIds || plan.budget!==manager.budget || plan.skill!==skill){
      const starters={P:1,D:4,C:4,A:3};
      const weights={};
      let total=0,otherMinimum=0;
      for(const role of $runtime.ROLE_ORDER){
        const left=$runtime.roleSlotsRemaining(manager,role);
        if(!left){weights[role]=0;continue;}
        const median=$runtime.cpuAuctionRoleQuality(role).median;
        const reliable=manager.roster.filter(p=>p.role===role && $runtime.currentPlayerOvr(p)>=median+3 && $runtime.cpuAuctionStarterEstimate(p)>=45).length;
        const gap=Math.max(0,starters[role]-reliable)/starters[role];
        weights[role]=Math.max(left,$runtime.targetFor(manager,role)-$runtime.roleSpend(manager,role))*(.75+gap*.5);
        total+=weights[role];
        if(role!==player.role) otherMinimum+=left;
      }
      const discretionary=Math.max(0,manager.budget-$runtime.slotsRemaining(manager));
      const otherShare=total>0?1-weights[player.role]/total:0;
      // A proportional reserve alone shrinks after every purchase, allowing
      // repeated overspending in early departments to consume the attack fund.
      let plannedOtherReserve=0;
      for(const role of $runtime.ROLE_ORDER){
        if(role===player.role) continue;
        const left=$runtime.roleSlotsRemaining(manager,role);
        if(!left) continue;
        const remainingTarget=Math.max(left,$runtime.targetFor(manager,role)-$runtime.roleSpend(manager,role));
        const protection=role==='A' ? .97 : .90;
        plannedOtherReserve+=Math.max(left,Math.floor(remainingTarget*protection*skill));
      }
      plan={availableIds:$runtime.state.availableIds,budget:manager.budget,skill,
        protected:Math.max(plannedOtherReserve,otherMinimum+Math.floor(discretionary*otherShare*skill))};
      $runtime.slotRankingCache.set(key,plan);
    }
    // Il credito protetto copre gli altri reparti; il resto può essere usato
    // per questo acquisto. Con soli slot dello stesso ruolo resta il limite legale.
    const sameRoleReserve=Math.max(0,$runtime.roleSlotsRemaining(manager,player.role)-(bundlePlayers?.length||1));
    let cap=manager.budget-plan.protected-sameRoleReserve;
    // Build three credible attackers before committing nearly the whole
    // department budget to one name. Once alternatives disappear, release it.
    if(player.role==='A' && skill>=.75){
      const median=$runtime.cpuAuctionRoleQuality('A').median;
      const credible=p=>$runtime.currentPlayerOvr(p)>=median+3 && $runtime.cpuAuctionStarterEstimate(p)>=45;
      const owned=manager.roster.filter(p=>p.role==='A' && credible(p)).length;
      const need=Math.max(0,Math.min(3-owned,$runtime.roleSlotsRemaining(manager,'A')));
      if(need>=2){
        const alternatives=$runtime.state.availableIds.map(id=>$runtime.playerMap.get(id)).filter(p=>
          p && p.role==='A' && !(bundlePlayers||[player]).some(member=>member.id===p.id) && credible(p));
        const purchased=(bundlePlayers||[player]).filter(credible).length;
        if(alternatives.length>=(bundlePlayers?Math.max(0,need-purchased):need-1)){
          const share=purchased>=need?1:purchased>=2?.85:need>=3 ? .55 : .70;
          if(purchased>0) cap=Math.min(cap,Math.floor(Math.max(0,cap)*share));
          else cap=Math.min(cap,Math.max(1,Math.floor(Math.max(0,cap)*.10)));
        }
      }
    }
    const coversKeeper=bundlePlayers?.some(first=>first.role==='P' && $runtime.cpuClubRoleHierarchy(first.club,'P')[0]?.id===first.id && bundlePlayers.some(second=>$runtime.cpuClubRoleHierarchy(first.club,'P')[1]?.id===second.id));
    if(!coversKeeper)cap-=$runtime.cpuKeeperReserve(manager,player);
    return Math.max(1,Math.min(legal,openCap,cap));
  }

  function strategicPlayerScore(manager, player) {
    // A stable, manager-specific football value used only to decide whether an
    // open roster slot is worth spending on this player. It is intentionally
    // independent from the current auction price.
    const profile = manager?.profile || {};
    const market = Math.max(1, $runtime.baseAuctionValue(player));
    let score = market*$runtime.cpuFootballAuctionFactor(manager,player);

    if (profile.favoriteClub && profile.favoriteClub === player.club) score *= 1.10;
    if (profile.valueHunter) {
      const quote = Math.max(1, Number(player.quotation||1));
      const efficiency = Number(player.ovr||70) / quote;
      score *= $runtime.clamp(.94 + efficiency * .018, .96, 1.09);
    }
    if (market >= $runtime.TOP_VALUE_THRESHOLD[player.role]) score *= Number(profile.topBias||1);
    const rulesFactor=$runtime.cpuLeagueRuleAuctionFactor(manager,player);
    score *= 1 + (rulesFactor-1)*.55;

    // Personal taste changes from career to career but remains stable inside
    // the same career, so CPUs do not suddenly change opinion mid-auction.
    score *= .94 + $runtime.careerHash(`slot-taste|${manager.id}|${player.id}`) * .12;
    return score*$runtime.auctionReputationMultiplier(player)*($runtime.cpuCoverInfo(manager,player)?.factor||1);
  }

  function strategicSlotInterest(manager, player) {
    if (!$runtime.state || manager.id === 'user') return { willing:true, factor:1, passChance:0 };
    if (!$runtime.canOwn(manager,player)) return { willing:false, factor:0, passChance:1 };

    const cover=$runtime.cpuCoverInfo(manager,player);
    if(cover?.kind==='keeper')return {willing:true,factor:1,passChance:0};
    const pendingKeeper=player.role==='P'?$runtime.cpuMissingKeeperCover(manager):null;
    if(pendingKeeper && pendingKeeper.id!==player.id && $runtime.roleSlotsRemaining(manager,'P')===1 && $runtime.maxLegalBid(manager,pendingKeeper)>=1)
      return {willing:false,factor:0,passChance:1};
    const role = player.role;
    const ownLeft = $runtime.roleSlotsRemaining(manager,role);
    const totalOpen = $runtime.state.managers.reduce((sum,m)=>sum + Math.max(0,$runtime.roleSlotsRemaining(m,role)),0);
    const otherOpen = Math.max(0,totalOpen-ownLeft);
    const competence=$runtime.cpuAuctionCompetence(manager);

    // Ranks stay valid until an award replaces availableIds. Gate decisions below
    // still use current budgets, ownership and the current nominator.
    const cacheKey = `${manager.id}|${role}`;
    let ranking = $runtime.slotRankingCache.get(cacheKey);
    if (!ranking || ranking.availableIds !== $runtime.state.availableIds || ranking.seed !== $runtime.state.marketSeed) {
      const available = $runtime.state.availableIds.map(id=>$runtime.playerMap.get(id))
        .filter(p=>p && p.role===role)
        .map(p=>({p,score:$runtime.strategicPlayerScore(manager,p)}))
        .sort((a,b)=>b.score-a.score).map(x=>x.p);
      ranking = {availableIds:$runtime.state.availableIds,seed:$runtime.state.marketSeed,available,
        ranks:new Map(available.map((p,i)=>[p.id,i]))};
      $runtime.slotRankingCache.set(cacheKey,ranking);
    }
    const available = ranking.available;
    const rank = Math.max(0,ranking.ranks.get(player.id) ?? 0);
    const betterAvailable = rank;

    // Key anti-exploit idea:
    // if there are more better players available than all the OTHER managers
    // can possibly consume, at least one better option is mathematically likely
    // to survive for this CPU. Burning a slot now is therefore irrational.
    const guaranteedBetter = Math.max(0, betterAvailable - otherOpen);
    const demandWindow = Math.max(1,totalOpen);
    const rankRatio = (rank+1) / demandWindow;

    // Reserve at least one quality slot until the CPU has secured a credible
    // anchor for the role. This is especially important for 3-GK departments,
    // but works generically for all roles.
    const anchorCutoff = $runtime.TOP_VALUE_THRESHOLD[role] * .70;
    const ownedRole = manager.roster.filter(x=>x.role===role);
    const hasAnchor = ownedRole.some(x => $runtime.baseAuctionValue(x) >= anchorCutoff);
    const anchorsAvailable = available.filter(p=>$runtime.baseAuctionValue(p)>=anchorCutoff).length;
    const candidateIsAnchor = $runtime.baseAuctionValue(player)>=anchorCutoff;

    let passChance = 0;

    if (guaranteedBetter >= Math.max(1,ownLeft)) {
      passChance = .97;
    } else if (guaranteedBetter > 0) {
      passChance = .82 + Math.min(.13, guaranteedBetter / Math.max(1,ownLeft+2) * .13);
    }

    // Players clearly outside the number of slots still demanded by the league
    // are deep reserves. CPUs mostly leave them alone instead of filling slots
    // just because the opening price is one credit.
    if (rankRatio > 1.45) passChance = Math.max(passChance,.965);
    else if (rankRatio > 1.20) passChance = Math.max(passChance,.93);
    else if (rankRatio > 1.00) passChance = Math.max(passChance,.78);

    if (!hasAnchor && anchorsAvailable > 0 && !candidateIsAnchor) {
      // Strongest when the manager is getting close to its final role slots.
      const reservePressure = ownLeft <= 2 ? .94 : .86;
      passChance = Math.max(passChance,reservePressure);
    }

    // If the player is genuinely among this CPU's best remaining options, do
    // not overthink it: strong names should still attract broad bidding.
    if (rank < Math.max(2,Math.ceil(ownLeft*.75))) passChance *= .12;
    else if (rank < Math.max(4,ownLeft*2)) passChance *= .45;

    const archetype = $runtime.profileArchetype(manager);
    if (['ragioniere','tirchio','moneyball','esperto'].includes(archetype)) passChance += .025;
    if (['spendaccione','bomber','collezionista'].includes(archetype)) passChance -= .02;
    if (archetype === 'pazzo') passChance -= .11; // sometimes makes a genuinely bad buy
    if (archetype === 'tifoso' && manager.profile?.favoriteClub === player.club) passChance -= .09;

    const liveUrgency=$runtime.cpuRoleUrgencyState(manager,role);
    if(liveUrgency.active) passChance -= .08 + liveUrgency.severity*.07;
    if($runtime.isHotRival(manager) && $runtime.state?.auction?.activeIds?.includes('user')) passChance -= .07;
    if($runtime.hasGoodRelations(manager) && $runtime.state?.auction?.activeIds?.includes('user')) passChance += .04;

    // Dalla Serie C in su un buon giocatore rimasto tardi nel reparto non va
    // ignorato solo perché la CPU spera in un nome ancora migliore. Lo slot e
    // il credito legale restano obbligatori; la valutazione massima non cambia.
    const division=Number($runtime.state?.career?.division||$runtime.GAME_CONFIG.startingDivision);
    const roleDemand=$runtime.ROLE_LIMITS[role]*$runtime.state.managers.length;
    const phaseCompletion=1-totalOpen/Math.max(1,roleDemand);
    const strongValue=$runtime.baseAuctionValue(player);
    const strongLatePlayer=(Number(player.ovr||0)>=80 && strongValue>=$runtime.TOP_VALUE_THRESHOLD[role]*.75) ||
      strongValue>=$runtime.TOP_VALUE_THRESHOLD[role];
    if(division<=3 && phaseCompletion>=.60 && strongLatePlayer &&
       $runtime.maxLegalBid(manager,player)>Number($runtime.state.auction?.price||1)){
      const latePressure=$runtime.clamp((phaseCompletion-.60)/.20,0,1);
      const maxPass=division<=2 ? .12 : .18;
      passChance=Math.min(passChance,.40-(.40-maxPass)*latePressure);
    }

    // Non chiudere l'ultimo slot con una riserva mentre esistono alternative
    // migliori realmente acquistabili. La prudenza cresce con la categoria.
    if(competence>0 && ownLeft<=2 && rank>=ownLeft){
      const strongerAffordable=available.slice(0,rank).filter(p=>
        $runtime.cpuFootballAuctionFactor(manager,p)>$runtime.cpuFootballAuctionFactor(manager,player)+.08 &&
        $runtime.baseAuctionValue(p)*$runtime.ROLE_BID_CORRECTION[role]<=$runtime.cpuAuctionSpendingCap(manager,p)).length;
      if(strongerAffordable>=ownLeft) passChance=Math.max(passChance,.75+competence*.23);
    }
    // I migliori profili restano contendibili già all'inizio del reparto.
    if(competence>0 && rank<Math.max(2,ownLeft) && $runtime.cpuFootballAuctionFactor(manager,player)>1.08)
      passChance*=1-competence*.85;

    if(cover?.kind==='rotation')passChance=Math.min(passChance,.30);

    // A CPU that itself nominated the player has already made the strategic
    // decision to pursue it, so it must not immediately regret the call.
    const isNominator = ($runtime.state.auction?.playerId===player.id || ($runtime.state.auction?.arcade?.type==='bundle' && $runtime.state.auction.arcade.secondPlayerId===player.id)) && $runtime.state.auction?.nominatorId===manager.id;
    if (isNominator) passChance = 0;

    passChance = $runtime.clamp(passChance,0,.992);
    const roll = $runtime.careerHash(`slot-gate|${manager.id}|${player.id}`);
    const willing = roll >= passChance;

    // Marginal candidates that survive the gate still receive a lower ceiling;
    // CPUs may take them cheaply, but should not start bidding wars for them.
    let factor = 1;
    if (rankRatio > 1.00) factor *= .88;
    if (guaranteedBetter > 0) factor *= .84;
    if (!candidateIsAnchor && !hasAnchor && anchorsAvailable > 0) factor *= .88;
    if (isNominator) factor = Math.max(.94,factor);

    return { willing, factor:$runtime.clamp(factor,.62,1), passChance, rank, guaranteedBetter };
  }

  function cpuBundleLimit(manager,players){
    const legal=$runtime.AuctionEngine.maxBundleBid(manager,players,$runtime.ROLE_LIMITS,$runtime.TOTAL_SLOTS);
    if(legal<players.length)return 0;
    const values=players.map(player=>$runtime.cpuLimit(manager,player,{bundleMember:true}));
    const anchor=players.slice().sort((a,b)=>$runtime.baseAuctionValue(b)-$runtime.baseAuctionValue(a) || String(a.id).localeCompare(String(b.id)))[0];
    let value=values.reduce((sum,v)=>sum+Math.max(1,v),0);
    if($runtime.cpuCoverageEnabled(manager)){
      const keeperPair=players.some(p=>p.role==='P' && $runtime.cpuClubRoleHierarchy(p.club,'P')[0]?.id===p.id && players.some(q=>$runtime.cpuClubRoleHierarchy(p.club,'P')[1]?.id===q.id));
      if(keeperPair)value+=Math.min(4,value*.08);
    }
    const cap=$runtime.cpuAuctionSpendingCap(manager,anchor,players);
    return cap<2?0:Math.max(2,Math.min(legal,cap,Math.round(value)));
  }

  function cpuLimit(manager, player,options={}) {
    const second=!options.bundleMember && $runtime.state?.auction?.arcade?.type==='bundle' && $runtime.state.auction.playerId===player.id ? $runtime.playerMap.get($runtime.state.auction.arcade.secondPlayerId):null;
    if(second)return $runtime.cpuBundleLimit(manager,[player,second]);
    // Hidden identity must not influence CPU offers: only public role/club.
    if($runtime.state?.auction?.arcade?.type==='mystery' && $runtime.state.auction.playerId===player.id){
      const pool=window.FANTA_PLAYERS.filter(p=>p.role===player.role && p.club===player.club);
      const publicValues=pool.map(p=>$runtime.baseAuctionValue(p)).sort((a,b)=>a-b);
      const publicValue=publicValues[Math.floor(publicValues.length/2)]||1;
      const cap=Math.min($runtime.maxLegalBid(manager,player),Math.max(1,Math.floor(($runtime.targetFor(manager,player.role)-$runtime.roleSpend(manager,player.role))/Math.max(1,$runtime.roleSlotsRemaining(manager,player.role)))));
      return Math.max(0,Math.min(cap,Math.round(publicValue*Number(manager.profile?.aggression||1)*($runtime.state.auction.bluffActive?1.1:1))));
    }
    const cover=$runtime.cpuCoverInfo(manager,player);
    if(cover?.kind==='keeper')return Math.max(0,Math.min(cover.ceiling,$runtime.maxLegalBid(manager,player),options.bundleMember?Infinity:$runtime.cpuAuctionSpendingCap(manager,player)));
    const profile = manager.profile || $runtime.PERSONALITIES[0];
    const role = player.role;
    const market = $runtime.baseAuctionValue(player);
    const legal = options.bundleMember?$runtime.AuctionEngine.maxLegalBid(manager,player,$runtime.ROLE_LIMITS,$runtime.TOTAL_SLOTS):$runtime.maxLegalBid(manager, player);
    if (legal < 1) return 0;

    const slotInterest = $runtime.strategicSlotInterest(manager,player);
    if (!slotInterest.willing && !options.bundleMember) return 0;

    const personalTarget = $runtime.targetFor(manager, role);
    const rolePreference = Math.pow(personalTarget / $runtime.MARKET_ROLE_TARGET[role], .26);
    const spent = $runtime.roleSpend(manager, role);
    const roleLeft = $runtime.roleSlotsRemaining(manager, role);
    const remainingTarget = Math.max(roleLeft, personalTarget-spent);
    const averageRoom = remainingTarget / Math.max(1, roleLeft);
    const targetFactor = spent >= personalTarget
      ? .91
      : $runtime.clamp(Math.pow(averageRoom / Math.max(1,market), .08), .90, 1.065);

    // Career-to-career perception is deliberately broader than V1.9.0, while
    // remaining mean-neutral so the calibrated league economy does not drift.
    const baseVolatility = Number(profile.volatility||0);
    const personalAmp = Math.min(.18, baseVolatility * 1.22 + .012);
    const stableNoise = ($runtime.careerHash(`value|${manager.id}|${player.id}`) - .5) * 2 * personalAmp;
    const marketPulse = ($runtime.careerHash(`market-pulse|${player.id}`) - .5) * .08; // shared ±4% perception this career
    const roleMood = ($runtime.careerHash(`role-mood|${manager.id}|${role}`) - .5) * .05; // manager/role ±2.5%
    const footballFactor=$runtime.cpuFootballAuctionFactor(manager,player);
    let value = market * footballFactor * $runtime.ROLE_BID_CORRECTION[role] * 1.01;
    value *= rolePreference;
    value *= Number(profile.aggression||1);
    value *= targetFactor;
    value *= $runtime.needFactor(manager, player);
    value *= $runtime.scarcityFactor(player);
    value *= Math.max(.70, 1 + stableNoise + marketPulse + roleMood);
    value *= $runtime.urgencyFactor(manager);
    const liveUrgency=$runtime.cpuRoleUrgencyState(manager,role);
    if(liveUrgency.active) value *= 1.12 + liveUrgency.severity*.10;
    if($runtime.isHotRival(manager) && $runtime.state?.auction?.activeIds?.includes('user')) value *= 1.08;
    if($runtime.hasGoodRelations(manager) && $runtime.state?.auction?.activeIds?.includes('user')) value *= .97;
    value *= $runtime.wealthFactor(manager, player);
    value *= slotInterest.factor;
    value *= $runtime.cpuLeagueRuleAuctionFactor(manager,player);

    if (profile.favoriteClub && profile.favoriteClub === player.club) value *= 1.12;
    if (profile.valueHunter) {
      const quote = Math.max(1, Number(player.quotation||1));
      const efficiency = Number(player.ovr||70) / quote;
      value *= $runtime.clamp(.995 + (efficiency-4)*.012, .96, 1.06);
    }
    if (market >= $runtime.TOP_VALUE_THRESHOLD[role]) value *= Number(profile.topBias||1);

    const heatRoll = $runtime.careerHash(`heat|${manager.id}|${player.id}`);
    const heated = heatRoll < Number(profile.heat||0);
    if (heated) value *= 1.04 + $runtime.careerHash(`heat2|${manager.id}|${player.id}`) * .08;

    const phase = manager.roster.length / $runtime.TOTAL_SLOTS;
    const cap = market * footballFactor * $runtime.ROLE_BID_CORRECTION[role] * (1.34 + .35*phase + (heated?.08:0));
    value = Math.min(value, cap);
    // V3.2.5: temporary auction-event modifiers.
    const contested = $runtime.auctionEffects('contested_player').find(e=>e.playerId===player.id);
    value *= window.FantaAuctionEvents.contestedMultiplier(contested,manager.id);
    const war = $runtime.auctionEffects('personal_war').find(e=>e.managerId===manager.id && Number(e.remainingCalls||0)>0);
    if (war && $runtime.state?.auction?.activeIds?.includes('user')) value *= 1.14;

    // V3.2.35.39: nuovi eventi dinamici d'asta.
    const crazyAuction = $runtime.auctionEffects('crazy_auction').find(e=>e.playerId===player.id);
    if (crazyAuction) {
      if ((crazyAuction.cpuIds||[]).includes(manager.id)) value *= Number(crazyAuction.multiplier||1.16);
      else value *= 1.035; // il rumore del tavolo contagia leggermente anche gli altri.
    }
    const opportunity = $runtime.auctionEffects('market_opportunity').find(e=>e.playerId===player.id);
    if (opportunity && manager.id!=='user') value *= Number(opportunity.multiplier||.82);
    const untouchable = $runtime.auctionEffects('untouchable_player').find(e=>e.playerId===player.id && e.cpuId===manager.id);
    if (untouchable) value *= Number(untouchable.multiplier||1.24);
    const pressure = $runtime.auctionEffects('table_pressure').find(e=>Number(e.remainingCalls||0)>0);
    if (pressure && manager.id!=='user' && $runtime.state?.auction?.activeIds?.includes('user')) value *= Number(pressure.multiplier||1.10);
    const sudden = $runtime.auctionEffects('sudden_interest').find(e=>e.playerId===player.id && e.cpuId===manager.id && e.activated);
    if (sudden) value *= Number(sudden.multiplier||1.22);

    // BLUFF: some personalities are much easier to drag into an inflated bidding war.
    if ($runtime.state?.auction?.bluffActive && manager.id !== 'user') {
      const arch=$runtime.profileArchetype(manager);
      const vuln={pazzo:1.18,tifoso:1.16,spendaccione:1.15,gambler:1.14,bomber:1.10,collezionista:1.10,rivale:1.09,stratega:1.07,esperto:1.05,moneyball:1.04,ragioniere:1.035,tirchio:1.025}[arch] || 1.07;
      value *= vuln;
    }
    if(manager.id!=='user') value*=$runtime.auctionReputationMultiplier(player);
    if(cover?.kind==='rotation')value+=Math.min(3,value*(cover.factor-1));
    return Math.max(1, Math.min(legal,options.bundleMember?Infinity:$runtime.cpuAuctionSpendingCap(manager,player),Math.round(value)));
  }

  function jumpSize(manager, current, limit, player=null) {
    const headroom = Math.max(0, limit - current);
    if (headroom <= 1) return 1;

    const profile = manager.profile || {};
    const archetype = $runtime.profileArchetype(manager);
    const roomRatio = $runtime.clamp(headroom / Math.max(8, limit), 0, 1);
    const limitProgress = $runtime.clamp(current / Math.max(1, limit), 0, 1);
    const topPlayer = player ? $runtime.baseAuctionValue(player) >= $runtime.TOP_VALUE_THRESHOLD[player.role] : false;

    // Base personality: conservative managers tend to climb one credit at a time;
    // aggressive / chaotic managers are more likely to make statement raises.
    let p10 = headroom >= 10 ? .08 + roomRatio * .25 : 0;
    let p5  = headroom >= 5  ? .22 + roomRatio * .34 : 0;

    if (['spendaccione','bomber','collezionista'].includes(archetype)) { p10 += .11; p5 += .10; }
    if (archetype === 'pazzo') { p10 += .14; p5 += .08; }
    if (['ragioniere','tirchio','moneyball'].includes(archetype)) { p10 -= .07; p5 -= .08; }
    if (archetype === 'esperto') { p10 -= .02; p5 += .03; }
    if (archetype === 'tifoso' && player && profile.favoriteClub === player.club) { p10 += .10; p5 += .09; }
    if (topPlayer && ['bomber','collezionista','spendaccione'].includes(archetype)) { p10 += .05; p5 += .05; }

    // As the CPU approaches its own valuation, it becomes visibly more cautious.
    if (limitProgress >= .82 || headroom <= 6) { p10 *= .12; p5 *= .48; }
    if (limitProgress >= .92 || headroom <= 3) { p10 = 0; p5 *= .12; }

    // A small "auction fever" effect after several raises makes wars feel less robotic.
    const bidCount = Number($runtime.state?.auction?.bidCount || 0);
    const duelHeat = $runtime.clamp((bidCount - 3) / 10, 0, 1);
    p10 += duelHeat * Number(profile.heat || 0) * .55;
    p5  += duelHeat * Number(profile.heat || 0) * .70;

    p10 = $runtime.clamp(p10, 0, headroom >= 10 ? .48 : 0);
    p5  = $runtime.clamp(p5, 0, headroom >= 5 ? .68 : 0);
    // Even the most aggressive CPU sometimes makes the classic +1 raise.
    // Keep at least ~12% probability mass for it while there is plenty of headroom.
    const maxCombined = (limitProgress < .82 && headroom >= 5) ? .88 : .96;
    if (p10 + p5 > maxCombined) p5 = Math.max(0, maxCombined - p10);
    const r = Math.random();
    if (headroom >= 10 && r < p10) return 10;
    if (headroom >= 5 && r < p10 + p5) return 5;
    return 1;
  }

  function cpuPersonalityPool(division=$runtime.state?.career?.division||$runtime.GAME_CONFIG.startingDivision){
    const level=Math.max(1,Math.floor(Number(division||$runtime.GAME_CONFIG.startingDivision)));
    if(level>=4) return $runtime.PERSONALITIES.filter(p=>p.id!=='user' && p.id!=='admin' && !$runtime.SPECIAL_RIVAL_IDS.includes(p.id));
    return $runtime.PERSONALITIES.filter(p=>p.id!=='user' && (level===1 || p.id!=='admin'));
  }

  function pickCpuPersonalities(count=9, division=$runtime.state?.career?.division||$runtime.GAME_CONFIG.startingDivision) {
    const level=Math.max(1,Math.floor(Number(division||$runtime.GAME_CONFIG.startingDivision)));
    const pool = $runtime.cpuPersonalityPool(level).slice();
    for (let i=pool.length-1;i>0;i--) {
      const j=Math.floor(Math.random()*(i+1));
      [pool[i],pool[j]]=[pool[j],pool[i]];
    }
    const selected=level===1 && count>0
      ? [$runtime.PERSONALITIES.find(p=>p.id==='admin'),...pool.filter(p=>p.id!=='admin').slice(0,count-1)]
      : pool.slice(0,count);

    // In Serie B e Serie A i rivali speciali devono apparire più spesso, così la
    // categoria si percepisce più dura già dalla composizione della lega.
    if(level<=2){
      const selectedIds=new Set(selected.map(p=>p.id));
      const selectedSpecial=selected.filter(p=>$runtime.SPECIAL_RIVAL_IDS.includes(p.id));
      const requiredSpecials=Math.min(3, count, $runtime.SPECIAL_RIVAL_IDS.length);
      if(selectedSpecial.length < requiredSpecials){
        const specialPool=pool.filter(p=>$runtime.SPECIAL_RIVAL_IDS.includes(p.id) && !selectedIds.has(p.id));
        let replaceIndex=selected.length-1;
        while(selected.filter(p=>$runtime.SPECIAL_RIVAL_IDS.includes(p.id)).length < requiredSpecials && specialPool.length && replaceIndex>=0){
          while(replaceIndex>=0 && ($runtime.SPECIAL_RIVAL_IDS.includes(selected[replaceIndex].id) || selected[replaceIndex].id==='admin')) replaceIndex--;
          if(replaceIndex<0) break;
          selectedIds.delete(selected[replaceIndex].id);
          selected[replaceIndex]=specialPool.shift();
          selectedIds.add(selected[replaceIndex].id);
          replaceIndex--;
        }
      }
    }
    return selected.slice(0,count);
  }

  function freshManagers(teamName, managerName, division=$runtime.state?.career?.division||$runtime.GAME_CONFIG.startingDivision) {
    const selected = $runtime.pickCpuPersonalities(9, division);
    const rivalIdentities = $runtime.freshRivalIdentityPool(9);
    const all = [$runtime.PERSONALITIES.find(p=>p.id==='user'), ...selected];
    return all.map((p, idx) => {
      const rivalIdentity = idx===0 ? null : rivalIdentities[idx-1];
      return {
        id: idx === 0 ? 'user' : 'cpu'+idx,
        name: idx === 0 ? managerName : p.name,
        team: idx === 0 ? teamName : p.id==='admin' ? p.team : rivalIdentity.team,
        teamColors: idx === 0 ? null : p.id==='admin' ? {primary:'#a648dd',secondary:'#161020'} : {...rivalIdentity.teamColors},
        budget: $runtime.INITIAL_BUDGET,
        roster: [],
        profile: {...p, archetype:p.id, id: idx===0?'user':'cpu'+idx}
      };
    });
  }
    return Object.freeze({comparableAuctionFvm,careerMarketProfiles,buildMarketValueMap,refreshMarketValueMap,baseAuctionValue,roleSpend,targetFor,cpuLeagueRuleSensitivity,cpuLeagueRuleAuctionFactor,scarcityFactor,freePerSlot,wealthFactor,urgencyFactor,cpuRoleUrgencyState,hasGoodRelations,isHotRival,needFactor,auctionReputationMultiplier,buildSeasonAuctionReputation,cpuAuctionCompetence,cpuAuctionRoleQuality,cpuAuctionStarterEstimate,cpuFootballAuctionFactor,cpuCoverageEnabled,cpuClubRoleHierarchy,cpuMainKeeper,cpuCoverInfo,cpuMissingKeeperCover,cpuKeeperReserve,cpuOpenRoleSpendingCap,cpuAuctionSpendingCap,strategicPlayerScore,strategicSlotInterest,cpuBundleLimit,cpuLimit,jumpSize,cpuPersonalityPool,pickCpuPersonalities,freshManagers});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['auction-policy']=Object.freeze({create});
})();
