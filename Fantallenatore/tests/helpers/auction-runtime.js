'use strict';
// Load production functions verbatim. Missing functions/dependencies must fail loudly.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'app_v302.js'),'utf8');
function productionFunction(name){
  const start=source.indexOf(`  function ${name}(`);
  assert(start>=0,`Funzione di produzione mancante: ${name}`);
  const firstLine=source.slice(start,source.indexOf('\n',start));
  if(firstLine.trimEnd().endsWith('}')){
    try {new vm.Script(firstLine,{filename:`app_v302.js:${name}`});return firstLine;} catch(error){if(!(error instanceof SyntaxError))throw error;}
  }
  const end=source.indexOf('\n  }',start);
  assert(end>start,`Fine funzione mancante: ${name}`);
  const body=source.slice(start,end+4);
  new vm.Script(body,{filename:`app_v302.js:${name}`});
  return body;
}
function seededRandom(seed){
  let value=2166136261;
  for(const char of seed)value=Math.imul(value^char.charCodeAt(0),16777619);
  return ()=>{value=(value+0x6D2B79F5)|0;let n=Math.imul(value^(value>>>15),1|value);n^=n+Math.imul(n^(n>>>7),61|n);return ((n^(n>>>14))>>>0)/4294967296;};
}
function createRuntime(seed,{cache=true}={}){
  const math=Object.create(Math);math.random=seededRandom(seed);
  const context={window:{},Math:math,console,$:()=>null,cacheEnabled:cache};
  vm.createContext(context);
  for(const file of ['data_v302.js','js/game-rules.js','js/core-utils.js','js/season-engine.js','js/auction-engine.js','js/auction-events.js'])
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
  vm.runInContext(`
    const {GAME_CONFIG,ROLE_LIMITS,ROLE_ORDER,ROLE_LABELS,TOTAL_SLOTS,INITIAL_BUDGET,MARKET_ALPHA,MARKET_VALUE_POOL_TARGET,MARKET_ROLE_TARGET,ROLE_BID_CORRECTION,TOP_VALUE_THRESHOLD}=window.FantaGameRules;
    const {clamp,randomHash,shuffledCopy}=window.FantaCoreUtils;
    const AuctionEngine=window.FantaAuctionEngine;
    const baseSerieAPlayers=window.FANTA_PLAYERS.map(p=>({...p}));
    const basePlayerValueReference=new Map(baseSerieAPlayers.map(p=>[String(p.id),{...p}]));
    const playerMap=new Map(baseSerieAPlayers.map(p=>[String(p.id),p]));
    const clubMap=new Map(window.FANTA_CLUBS.map(c=>[c.id,c]));
    let state=null,marketValueMap;
    const slotRankingCache=new Map();
    const RIVAL_TEAM_NAMES=Array.from({length:24},(_,i)=>'Rivale '+i);
    const RIVAL_COLOR_BASES=Array.from({length:24},()=>['#abcdef','#111111']);
    ${source.slice(source.indexOf('  const PERSONALITIES = ['),source.indexOf('  let state = null;'))}
    // Controlled baseline: league defaults, no power/event/sponsor advantage.
    function leagueRulesFor(){return {freeRoleAuction:state?.freeRoleAuction===true,defenseModifier:'off',cleanSheetBonus:0,maxFantasySubs:3,firstGoalThreshold:66};}
  `,context);
  const names=['careerHash','profileArchetype','roleCount','openRoleAuction','managerCanNominate','slotsRemaining','roleSlotsRemaining','currentAuctionRole','canOwn','maxLegalBid','currentPlayerOvr',
    'comparableAuctionFvm','careerMarketProfiles','buildMarketValueMap','refreshMarketValueMap','baseAuctionValue','roleSpend','targetFor','cpuLeagueRuleSensitivity','cpuLeagueRuleAuctionFactor','scarcityFactor','freePerSlot','wealthFactor','urgencyFactor','cpuRoleUrgencyState','hasGoodRelations','isHotRival','needFactor','auctionReputationMultiplier','cpuAuctionCompetence','cpuAuctionRoleQuality','cpuAuctionStarterEstimate','cpuFootballAuctionFactor','cpuCoverageEnabled','cpuClubRoleHierarchy','cpuMainKeeper','cpuCoverInfo','cpuMissingKeeperCover','cpuKeeperReserve','cpuOpenRoleSpendingCap','cpuAuctionSpendingCap','strategicPlayerScore','strategicSlotInterest','cpuBundleLimit','cpuLimit','jumpSize',
    'freshRivalIdentityPool','cpuPersonalityPool','pickCpuPersonalities','freshManagers',
    'playerSeasonPotentialProfile','clubRoleStarterSlots','starterHierarchyBias','normalizedStarterProbability','auctionStarterProbability','auctionPlayerAnalysis',
    'nominationCallCount','registerNominationCall','nextNominatorIndex','freeRoleNominationWeights','chooseNomination','ensureAuctionEvents','auctionEffects','relationship'];
  vm.runInContext(names.map(productionFunction).join('\n'),context);
  // Starter estimates are invariant within this baseline auction; cache their real results.
  vm.runInContext(`const starterEstimates=new Map(window.FANTA_PLAYERS.map(p=>[p.id,auctionStarterProbability(p)]));
    auctionStarterProbability=p=>starterEstimates.get(p?.id)||0;
    marketValueMap=buildMarketValueMap();
    // Budgets/rosters change only at award; avoid rescanning the full market for
    // every candidate. Cache only functions independent of the live bid price.
    function cachedUntilAward(fn,key){const cache=new Map();let purchase=-1,previousState;return (...args)=>{if(purchase!==state?.stats.purchases||previousState!==state){cache.clear();purchase=state?.stats.purchases;previousState=state;}const k=key(...args);if(!cache.has(k))cache.set(k,fn(...args));return cache.get(k);};}
    if(cacheEnabled){
    cpuRoleUrgencyState=cachedUntilAward(cpuRoleUrgencyState,(m,r)=>m.id+'|'+r);
    scarcityFactor=cachedUntilAward(scarcityFactor,p=>p.role);
    wealthFactor=cachedUntilAward(wealthFactor,(m,p)=>m.id+'|'+p.role);
    urgencyFactor=cachedUntilAward(urgencyFactor,m=>m.id);
    const ruleFactors=new Map(),realRuleFactor=cpuLeagueRuleAuctionFactor;
    cpuLeagueRuleAuctionFactor=(m,p)=>{const k=m.id+'|'+p.id;if(!ruleFactors.has(k))ruleFactors.set(k,realRuleFactor(m,p));return ruleFactors.get(k);};
    }
    globalThis.api={
      initialize(division,freeRoleAuction,seed){state={marketSeed:seed,career:{division,seasonNumber:1},freeRoleAuction,currentRoleIndex:0,nominationIndex:0,nominationCalls:{},managers:freshManagers('Utente','Tester',division),availableIds:window.FANTA_PLAYERS.map(p=>p.id),stats:{purchases:0,totalSpent:0,highest:null}};slotRankingCache.clear();return state;},
      get state(){return state;},players:baseSerieAPlayers,playerMap,starterEstimates,
      ...window.FantaGameRules,canOwn,maxLegalBid,roleSlotsRemaining,slotsRemaining,baseAuctionValue,cpuCoverInfo,cpuMissingKeeperCover,cpuKeeperReserve,cpuClubRoleHierarchy,cpuAuctionCompetence,cpuFootballAuctionFactor,cpuAuctionSpendingCap,cpuLimit,jumpSize,chooseNomination,registerNominationCall,nextNominatorIndex,strategicSlotInterest,
      awardBundle(players,id,price){const result=AuctionEngine.awardBundle(state,players,id,price,{roleLimits:ROLE_LIMITS,totalSlots:TOTAL_SLOTS});state.auction=null;return result;},
      award(p,id,price){const result=AuctionEngine.awardPlayer(state,p,id,price,{roleLimits:ROLE_LIMITS,totalSlots:TOTAL_SLOTS});state.auction=null;return result;},
      random:()=>Math.random()
    };`,context);
  return context.api;
}
module.exports={createRuntime,productionFunction,seededRandom};
