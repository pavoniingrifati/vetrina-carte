'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
function createRuntime(seed='balance-0'){
 const math=Object.create(Math);let n=123456;for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
 const storage=new Map();const window={addEventListener:()=>{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout,clearTimeout,setInterval,clearInterval};
 const document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]};
 const ctx=vm.createContext({window,document,console,Math:math,Date,Blob,TextEncoder,TextDecoder,btoa,atob,setTimeout,clearTimeout,setInterval,clearInterval});
 for(const file of ['data_v302.js','js/pokemon-catalog.js','js/serie-b-catalog.js','js/game-rules.js','js/core-utils.js','js/save-codec.js','js/save-manager.js','js/season-engine.js','js/transfer-engine.js','js/career-engine.js','js/auction-engine.js','js/auction-clock-events.js','js/auction-events.js','js/live-match-state.js','js/season-recap.js','js/storage-snapshot.js','js/cpu-lineup-policy.js','js/datacenter-overview.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
 for(const file of require('./production-source').domainFiles())vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
 const source=fs.readFileSync(path.join(root,'app_v302.js'),'utf8'),marker='  // Events\n',end=source.indexOf(marker);if(end<0)throw Error('Confine bootstrap UI mancante');
 vm.runInContext(source.slice(0,end)+`
 let adminTestTimers=[];
 // Only presentation boundaries are disabled; match generation and evolution remain verbatim.
 saveState=()=>{}; // Persistence is outside this simulation.
 captureWatchedVoteSnapshot=()=>new Map();
 updateWatchedVoteFlashes=()=>{};
 window.balanceRuntime={
 initialize(seed){state=freshState('Test','Mister');state.marketSeed=seed;state.completed=true;state.season={started:true,currentMatchday:1,serieASchedule:buildSerieASchedule(),serieAStandings:freshSerieAStandings(),lineups:{},formationChoices:{},adminRules:{},opponentMalusEvents:{}};ensureSeasonState();return state;},
 day(day){state.season.currentMatchday=day;const built=buildSerieADay(day);if(!built)throw Error('Giornata assente');serieALive={...built,phase:'multilive',phaseEvents:built.mainEvents,minute:90,eventIndex:0,feed:[],allFeed:[],lineups:{},voteFlashes:new Map(),autoPauseUntil:0};for(const event of built.mainEvents)applySerieAEvent(event);finalizeSerieAPhaseRatings();serieALive.phase='bigmatch';for(const event of built.bigMatchEvents)applySerieAEvent(event);finalizeSerieAPhaseRatings();updateSerieASeasonWorld(day,serieALive);return {matches:serieALive.matches,events:built.events,performances:Array.from(built.perfMap.values()).map(perf=>currentFantasyPerformance(playerMap.get(String(perf.playerId)),built.perfMap,90))};},
 adminTemplate(id,day){const t=ADMIN_RULE_TEMPLATES.find(t=>t.id===id);return {...t.build(day),rarity:t.rarity};},
 riskTemplate(day,player){const t=FORMATION_CHOICE_TEMPLATES.find(t=>t.id==='risk-injury');return {...t.build({day,pickOwnStrict:()=>player},0),rarity:formationChoiceRarity(t.id)};},rawDay(day){return buildSerieADay(day);},
 adminTeamBonuses(perfs,subs,manager,day){applyAdminTeamScoring(perfs,subs,manager,day);return perfs;},adminFantasy(perf,minute=90){return liveFantasyValue(perf,minute);},
 rules(day){return fantasyRuleForDay(day);},
 goals(points,day){return fantasyGoals(points,day);},
 arcadeInitialize(){state=freshState('Test','Mister');state.completed=false;state.nominationIndex=0;return state;},
 arcadePrepare(player,type){state.auction={playerId:player.id,nominatorId:'user',highBidderId:'user',price:1,activeIds:state.managers.map(m=>m.id),log:[],commentMoments:[],bidCount:1};const old=Math.random;let calls=0;Math.random=()=>[0,0,(type+.1)/5][calls++]??.5;try{prepareArcadeAuction(state.managers[0],player);}finally{Math.random=old;}return state.auction;},
 arcadeWindow(){return auctionWindowMs();},arcadeDelay(manager){return cpuReactionDelay(manager);},arcadeNoTimers(){beginBidRound=()=>true;},
 arcadeRender(){renderAuction();},arcadeShow(){showArcadeModal();},arcadeAction(action){handleArcadeAction(action);},arcadeResolve(){resolveSealedAuction();},arcadeLimit(manager,player){return cpuLimit(manager,player);},arcadeMax(manager,player){return maxLegalBid(manager,player);},arcadeEngine(){return AuctionEngine;},
 adminPowerSetup(){state=freshState('Test','Mister');state.career.division=1;state.managers=freshManagers('Test','Mister',1);syncSerieATransferWorld(state);refreshMarketValueMap(state);adminTestTimers=[];setTimeout=callback=>{adminTestTimers.push(callback);return adminTestTimers.length;};renderAuction=renderAll=renderRoster=renderManagers=renderTurn=showAwardAnimation=hideAwardAnimation=()=>{};return state;},
 adminPowerScore(manager,player){return adminOneShotScore(manager,player);},adminPowerTry(){return tryAdminOneShot();},adminPowerFast(){fastForwardCpuAuctionAfterUserPass();const awardTimer=adminTestTimers.shift();if(awardTimer)awardTimer();},
 rulesItem(){return SHOP_ITEMS.cons_reroll_rules;},
 rulesSetup(quantity=2){state.season.completed=true;state.nextSeasonFlow={version:3,sourceSeasonNumber:state.career.seasonNumber,stage:'market_summary'};state.season.consumables.inventory.cons_reroll_rules=quantity;careerDraft={marketSeed:'reroll-test',career:state.career,leagueRules:defaultLeagueRules(),carryoverConsumables:{cons_reroll_rules:quantity},stats:{purchases:0}};nextSeasonSetupMode=true;generatePreAuctionLeagueRules(careerDraft);renderCareerLeagueRules=()=>{};return careerDraft;},
 rulesReroll(){return rerollPreAuctionRules();},rulesClose(){careerDraft=null;nextSeasonSetupMode=false;},
 rulesResume(){careerDraft={marketSeed:'reopened-test',career:state.career,leagueRules:JSON.parse(JSON.stringify(state.nextSeasonFlow.preAuctionRules)),leagueRulesRerollCount:state.nextSeasonFlow.preAuctionRulesRerollCount,carryoverConsumables:{...state.season.consumables.inventory},stats:{purchases:0}};nextSeasonSetupMode=true;generatePreAuctionLeagueRules(careerDraft);return careerDraft;},
 rulesBuy(){showToast=()=>{};renderCareerWallets=()=>{};renderLeagueShopScreen=()=>{};return buyConsumableItem(SHOP_ITEMS.cons_reroll_rules);},
 marketProfiles(){return careerMarketProfiles(state);},
 refreshMarket(){return refreshMarketValueMap(state);},
 value(player){return baseAuctionValue(player);},
 malus(day){return ensureOpponentMalusRoll(day);},
 noticeTestElements(elements){document.getElementById=id=>elements[id]||null;},
 showMalusNotice(day,force=false){return showOpponentMalusNotice(day,force);},
 closeMalusNotice(acknowledge=false){return closeOpponentMalusNotice(acknowledge);},
 cpuLineup(manager){return buildAutoLineup(manager,cpuFormationForDay(manager,state.season.currentMatchday));},
 performanceText(performance){return performanceText(performance);},
 storageSnapshot(source=state){return buildStorageSnapshot(source);},
 parseSave(payload){return parseStoredPayload(payload);},
 overviewHtml(premium=false){const body={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]};const previous=document.getElementById,oldShop=shopItemActive;document.getElementById=id=>id==='datacenterOverviewBody'?body:null;shopItemActive=id=>premium&&id==='fantadata_pro';try{renderDataCenterOverviewPanel();return body.innerHTML;}finally{document.getElementById=previous;shopItemActive=oldShop;}},
 packApply(draft){return applyPreAuctionPack(draft);},packRules(draft){return generatePreAuctionLeagueRules(draft);},

 getState(){return state;},players(){return window.FANTA_PLAYERS;},buildVersion:GAME_CONFIG.buildVersion
 };
})();`,ctx,{filename:'app_v302.js:headless'});
 const api=window.balanceRuntime;api.initialize(seed);return api;
}
module.exports={createRuntime};
