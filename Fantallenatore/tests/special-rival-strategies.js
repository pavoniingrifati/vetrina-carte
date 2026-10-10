'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRuntime}=require('./helpers/auction-runtime');
const archetypes=['squalo','camaleonte','fantadata','predatore','broker'];
function setup(archetype,division=1,open=false){
  const api=createRuntime('special-rivals-behavior');api.initialize(division,open,'special-rivals-behavior');
  const manager=api.state.managers[1];
  // Remove coefficient differences: behavior must come from the actual policies.
  manager.profile={id:manager.id,archetype,aggression:1,volatility:0,topBias:1,heat:0,targets:{P:30,D:60,C:120,A:290}};
  return {api,manager};
}
function top(api,role){return api.players.filter(p=>p.role===role).sort((a,b)=>b.ovr-a.ovr)[0];}
function auction(api,p,price=1){api.state.auction={playerId:p.id,nominatorId:'user',highBidderId:'user',price,bidCount:0,activeIds:api.state.managers.map(m=>m.id)};}
const averages={};
for(const arch of archetypes){
  const {api,manager}=setup(arch),player=top(api,'A');auction(api,player);
  const nominations=[],delays=[],jumps=[];
  for(let i=0;i<350;i++){
    nominations.push(api.cpuNominationDelay(manager));
    delays.push(api.cpuReactionDelay(manager));
    jumps.push(api.jumpSize(manager,10,150,player));
  }
  assert(delays.every(n=>n>=280&&n<=4550),'Normal reactions remain below the deadline: '+arch);
  assert(jumps.every(n=>[1,5,10].includes(n)));
  const mean=xs=>xs.reduce((s,n)=>s+n,0)/xs.length;
  averages[arch]={nomination:mean(nominations),reaction:mean(delays),jump:mean(jumps)};
  for(const current of [149,150])assert.equal(api.jumpSize(manager,current,150,player),1);
  api.state.auction.arcade={type:'hammer'};
  for(let i=0;i<40;i++)assert(api.cpuReactionDelay(manager)<=1800,'Hammer deadline: '+arch);
  api.state.turbo=true;
  for(let i=0;i<20;i++){
    assert(api.cpuReactionDelay(manager)<=530);
    assert(api.cpuNominationDelay(manager)<=360);
  }
}
assert(averages.squalo.reaction<averages.predatore.reaction*.65,'Squalo must react substantially earlier than Predatore');
assert(averages.squalo.nomination<averages.broker.nomination);
assert(averages.fantadata.nomination<averages.predatore.nomination);
assert(averages.squalo.jump>averages.fantadata.jump*1.3,'Tactical jump differences survive identical coefficients');
assert(averages.broker.jump>averages.fantadata.jump*1.15);

// Nomination preferences survive identical numeric personality coefficients too.
{
  const means={};
  for(const arch of archetypes){
    const {api,manager}=setup(arch);api.state.currentRoleIndex=3;
    let total=0;
    for(let i=0;i<60;i++)total+=api.baseAuctionValue(api.chooseNomination(manager));
    means[arch]=total/60;
  }
  assert(means.squalo>means.predatore,'Squalo calls more expensive targets than the patient Predator');
  assert(means.broker>means.fantadata,'Broker exposes expensive names instead of following the data-value shortlist');
}

// Camaleonte reacts to public prices; an older save has a neutral market.
{
  const {api,manager}=setup('camaleonte'),p=top(api,'D');auction(api,p);
  const reference=api.baseAuctionValue(p)*api.ROLE_BID_CORRECTION.D;
  assert.equal(api.cpuSpecialRivalMarket('D').priceRatio,1);
  const setTape=ratio=>{api.state.stats.auctionSales=Array.from({length:8},()=>({playerId:p.id,role:'D',price:reference*ratio,season:1,winter:false}));};
  setTape(.75);const cheap=api.cpuSpecialRivalPlan(manager,p),cheapLimit=api.cpuLimit(manager,p);
  setTape(1.35);const expensive=api.cpuSpecialRivalPlan(manager,p),expensiveLimit=api.cpuLimit(manager,p);
  assert(cheap.marketRatio<1&&expensive.marketRatio>1);
  assert(expensive.valueFactor>cheap.valueFactor);
  assert(expensiveLimit>cheapLimit,'Observed prices change actual offers where the budget cap is not binding');
  api.state.stats.auctionSales.push({playerId:p.id,role:'D',price:reference*100,season:1,winter:false});
  api.state.stats.auctionSales=api.state.stats.auctionSales.slice();
  assert(api.cpuSpecialRivalMarket('D').priceRatio<=1.65,'One outlier cannot cause unbounded offers');
  api.state.winterMarketFlow={stage:'auction'};
  assert.equal(api.cpuSpecialRivalMarket('D').priceRatio,1,'Winter must not reuse summer prices');
  api.state.winterMarketFlow=null;api.state.career.seasonNumber=2;
  assert.equal(api.cpuSpecialRivalMarket('D').priceRatio,1,'A new season must not reuse old prices');
  api.state.career.seasonNumber=1;
  const restored=JSON.parse(JSON.stringify(api.state.stats));api.state.stats=restored;
  assert(api.cpuSpecialRivalMarket('D').priceRatio>1,'Observation survives serialized state');
}

// Marginal improvement matters to Fantadata; hidden identity is never analyzed.
{
  const {api,manager}=setup('fantadata'),p=top(api,'A');auction(api,p);
  const before=api.cpuSpecialRivalPlan(manager,p);
  manager.roster=api.players.filter(q=>q.role==='A').sort((a,b)=>b.ovr-a.ovr).slice(0,3).map(q=>({...q,price:1}));
  api.state.availableIds=api.state.availableIds.filter(id=>!manager.roster.some(q=>q.id===id));
  const after=api.cpuSpecialRivalPlan(manager,p);
  assert(after.gain<before.gain&&after.valueFactor<before.valueFactor,'Already owning good starters reduces marginal willingness to pay');
  api.state.auction.arcade={type:'mystery'};
  assert.equal(api.cpuSpecialRivalPlan(manager,p),null,'No hidden quality in tactical decisions');
}

// Predator accelerates when quality supply becomes scarce rather than waiting indefinitely.
{
  const {api,manager}=setup('predatore'),p=top(api,'A');auction(api,p);
  const initial=api.cpuSpecialRivalPlan(manager,p);
  api.state.availableIds=api.state.availableIds.filter(id=>api.playerMap.get(id).role!=='A'||id===p.id);
  const scarce=api.cpuSpecialRivalPlan(manager,p);
  assert(scarce.scarce&&!initial.scarce);
  assert(scarce.valueFactor>initial.valueFactor);
}

// Broker calls attractive players even when it personally has passed on them.
{
  const window={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/domains/auction-controller.js'),'utf8'),{window,Math});
  const p={id:'bait',role:'A',ovr:90,quotation:40},cpu={id:'cpu1',budget:300,roster:[],profile:{archetype:'broker'}},user={id:'user',budget:300,roster:[]};
  const runtime={state:{career:{division:1},managers:[user,cpu],availableIds:[p.id]},playerMap:new Map([[p.id,p]]),ROLE_ORDER:['A'],ROLE_LIMITS:{A:6},TOP_VALUE_THRESHOLD:{A:40},
    openRoleAuction:()=>false,cpuMissingKeeperCover:()=>null,roleSlotsRemaining:()=>3,canOwn:()=>true,maxLegalBid:()=>280,currentAuctionRole:()=> 'A',profileArchetype:()=> 'broker',roleSpend:()=>0,targetFor:()=>200,
    baseAuctionValue:()=>80,cpuLimit:()=>0,cpuAuctionCompetence:()=>1,cpuAuctionStarterEstimate:()=>80,currentPlayerOvr:()=>90,
    strategicSlotInterest:()=>({willing:false,factor:1}),careerHash:()=>.5,auctionReputationMultiplier:()=>1,cpuFootballAuctionFactor:()=>1,
    cpuAdminPlayerPlan:()=>null,
    cpuSpecialRivalPlan:()=>({archetype:'broker',pressureCall:true,rivals:3,improvement:0})};
  assert.equal(window.FantaDomains['auction-controller'].create(runtime).chooseNomination(cpu).id,p.id);
}

// Sales use real, legal awards; exclude split package prices and forced bargains.
{
  const {api}=setup('camaleonte');
  const award=(role,flags={})=>{
    const p=api.players.find(p=>p.role===role&&api.state.availableIds.includes(p.id));
    auction(api,p);Object.assign(api.state.auction,flags);
    assert(api.award(p,'cpu2',1).ok);return p;
  };
  const p=award('D');assert.equal(api.state.stats.auctionSales.length,1);
  assert.equal(api.state.stats.auctionSales[0].playerId,p.id);
  award('D',{oneShotForced:true});award('D',{adminOneShotForced:true});
  assert.equal(api.state.stats.auctionSales.length,1);
  const packagePlayers=api.players.filter(p=>p.role==='C'&&api.state.availableIds.includes(p.id)).slice(0,2);
  assert(api.awardBundle(packagePlayers,'cpu2',10).ok);
  assert.equal(api.state.stats.auctionSales.length,1,'Artificial package split prices are not market observations');
  const snapshot=JSON.stringify(api.state.stats);
  assert(!api.award(p,'cpu2',1).ok);assert.equal(JSON.stringify(api.state.stats),snapshot,'Rejected award cannot change public market data');
  api.state.stats.auctionSales=Array.from({length:80},()=>({playerId:p.id,role:'D',price:1,season:1,winter:false}));
  award('D');assert.equal(api.state.stats.auctionSales.length,80,'The tape stays bounded');
}

// Every personality works in C/B/A, both auction modes, with no extra money.
for(const division of [3,2,1])for(const open of [false,true])for(const arch of archetypes){
  const {api,manager}=setup(arch,division,open);
  if(!open)api.state.currentRoleIndex=3;
  for(let i=0;i<4;i++){
    api.state.auction=null;const p=api.chooseNomination(manager);
    assert(p&&api.canOwn(manager,p));assert(open||p.role==='A');auction(api,p);
    for(const price of [1,30,100]){
      api.state.auction.price=price;
      const limit=api.cpuLimit(manager,p);
      assert(Number.isFinite(limit)&&limit>=0&&limit<=api.maxLegalBid(manager,p));
      assert(limit<=api.cpuAuctionSpendingCap(manager,p));
    }
    assert.equal(manager.budget,500);
  }
  manager.budget=25;
  assert(api.cpuLimit(manager,top(api,'A'))<=1,'Minimum slot reserve still protected');
}
const source=fs.readFileSync(path.join(__dirname,'../app_v302.js'),'utf8');
const profiles=vm.runInNewContext(source.slice(source.indexOf('  const PERSONALITIES = ['),source.indexOf('  const SPECIAL_RIVAL_IDS'))+';PERSONALITIES');
for(const arch of archetypes)assert.equal(Object.values(profiles.find(p=>p.id===arch).targets).reduce((a,b)=>a+b,0),500);
console.log('OK: five distinct tactics with identical coefficients; public-price adaptation, marginal improvement, pressure calls, scarcity response, mystery privacy, legal budgets, bounded saved observations, package/one-shot exclusion, normal/hammer/turbo timings, C/B/A in both modes.');
console.log(JSON.stringify(averages));
