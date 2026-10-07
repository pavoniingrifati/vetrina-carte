'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app_v302.js'),'utf8');

function functionsBetween(start,end,context){
  const source=app.slice(app.indexOf(`  function ${start}(`),app.indexOf(`  function ${end}(`));
  assert(source.startsWith(`  function ${start}(`));
  context.cpuCoverInfo ||= ()=>null;
  context.cpuMissingKeeperCover ||= ()=>null;
  vm.runInNewContext(source,context);
}

{
  const managers=['user','a','b'].map(id=>({id,roster:[]}));
  const context={state:{managers,nominationCalls:{},availableIds:['p']},openRoleAuction:()=>false,
    currentAuctionRole:()=> 'P',roleSlotsRemaining:()=>1};
  functionsBetween('nominationCallCount','allRostersComplete',context);
  context.registerNominationCall('user','P');
  assert.strictEqual(context.nextNominatorIndex(0),1);
  context.registerNominationCall('a','P');
  assert.strictEqual(context.nextNominatorIndex(1),2);
  context.registerNominationCall('b','P');
  assert.strictEqual(context.nextNominatorIndex(2),0);
  context.registerNominationCall('user','P');
  assert.strictEqual(context.nextNominatorIndex(0),1);
  context.openRoleAuction=()=>true;
  context.managerCanNominate=manager=>manager.id!=='a';
  context.registerNominationCall('user','A');
  assert.strictEqual(context.state.nominationCalls.ALL.user,1);
  assert.strictEqual(context.nextNominatorIndex(0),2);
}

{
  let forwarded=0;
  const auction={playerId:'p',price:8,highBidderId:'a',activeIds:['user','a','b'],awaitingUser:true,log:[]};
  const context={state:{auction,managers:[{id:'user',team:'Mia squadra'}]},playerMap:new Map([['p',{id:'p'}]]),
    autocompleteMode:false,maxLegalBid:()=>8,fastForwardCpuAuctionAfterUserPass:()=>{forwarded++;},
    addAuctionLog:(team,message)=>auction.log.push({team,message})};
  functionsBetween('userCannotBeatCurrentAuction','awardAuction',context);
  assert.strictEqual(context.autoSkipUserIfCannotBid(),true);
  assert.strictEqual(forwarded,1);
  assert.strictEqual(auction.awaitingUser,false);
  assert(!auction.activeIds.includes('user'));
  assert(auction.log.some(item=>item.message==='SKIP · CREDITO INSUFFICIENTE'));
  assert.strictEqual(context.autoSkipUserIfCannotBid(),false);
}

{
  const players=Array.from({length:5},(_,i)=>({id:`p${i}`,role:'A',ovr:84,value:60-i*5}));
  const candidate=players[3];
  const cpu={id:'cpu1',roster:[],budget:150,profile:{archetype:'esperto'}};
  const rival={id:'cpu2',roster:[],budget:150};
  const state={career:{division:4},marketSeed:'test',managers:[cpu,rival],availableIds:players.map(p=>p.id),auction:{playerId:candidate.id,nominatorId:'cpu2',price:1,activeIds:['cpu1','cpu2']}};
  const context={state,slotRankingCache:new Map(),playerMap:new Map(players.map(p=>[p.id,p])),
    ROLE_LIMITS:{A:6},TOP_VALUE_THRESHOLD:{A:40},TOTAL_SLOTS:25,GAME_CONFIG:{startingDivision:4},
    roleSlotsRemaining:()=>1,canOwn:()=>true,maxLegalBid:()=>100,
    strategicPlayerScore:(_manager,p)=>p.value,baseAuctionValue:p=>p.value,
    cpuRoleUrgencyState:()=>({active:false,severity:0}),isHotRival:()=>false,hasGoodRelations:()=>false,
    cpuAuctionCompetence:()=>0,profileArchetype:()=> 'esperto',careerHash:()=>.25,clamp:(x,a,b)=>Math.max(a,Math.min(b,x))};
  functionsBetween('strategicSlotInterest','cpuBundleLimit',context);
  const amateur=context.strategicSlotInterest(cpu,candidate);
  state.career.division=3;
  const serieC=context.strategicSlotInterest(cpu,candidate);
  state.career.division=2;
  const serieB=context.strategicSlotInterest(cpu,candidate);
  assert(amateur.passChance>serieC.passChance,'La Lega Amatori non deve ricevere il correttivo');
  assert(serieC.passChance<=.18 && serieB.passChance<=.12,'Serie C/B devono competere sul talento tardivo');
  state.career.division=3;
  assert.strictEqual(context.strategicSlotInterest(cpu,players[4]).passChance<=.18,true);
  cpu.budget=1;
  context.maxLegalBid=()=>1;
  assert(context.strategicSlotInterest(cpu,candidate).passChance>.18,'Credito insufficiente non deve attivare il correttivo');
}

{
  const players=Array.from({length:18},(_,i)=>({id:`n${i}`,role:'A',ovr:90-i,value:80-i*4,quotation:80-i*4}));
  const cpu={id:'cpu',budget:100,roster:[],profile:{archetype:'ragioniere'}};
  const user={id:'user',budget:100,roster:[]};
  const state={career:{division:3},managers:[cpu,user],availableIds:players.map(p=>p.id)};
  const context={state,playerMap:new Map(players.map(p=>[p.id,p])),ROLE_ORDER:['A'],ROLE_LIMITS:{A:6},
    TOP_VALUE_THRESHOLD:{A:40},GAME_CONFIG:{startingDivision:4},auctionReputationMultiplier:()=>1,cpuAuctionCompetence:()=>state.career.division<=3?.4:0,cpuFootballAuctionFactor:()=>1,cpuAuctionStarterEstimate:()=>55,currentPlayerOvr:p=>p.ovr,
    openRoleAuction:()=>false,currentAuctionRole:()=> 'A',roleSlotsRemaining:()=>3,
    canOwn:()=>true,maxLegalBid:()=>100,profileArchetype:()=> 'ragioniere',
    roleSpend:()=>0,targetFor:()=>100,baseAuctionValue:p=>p.value,cpuLimit:()=>70,
    strategicSlotInterest:()=>({willing:true,factor:1}),careerHash:()=>.5,
    Math:Object.create(Math)};
  context.Math.random=()=>.5; // modalità convenienza, senza casualità nei punteggi
  functionsBetween('chooseNomination','finishAuction',context);
  const strong=context.chooseNomination(cpu);
  assert(strong.value>=56,'In Serie C il chiamante deve anticipare la fascia forte');
  state.career.division=4;
  assert(context.chooseNomination(cpu),'La Lega Amatori mantiene la propria selezione');
}

{
  const handlers={};
  const elements={};
  const element=id=>elements[id] ||= {id,textContent:'',dataset:{},classList:{items:new Set(['hidden']),add(x){this.items.add(x)},remove(x){this.items.delete(x)},toggle(x,on){if(on)this.add(x);else this.remove(x)},contains(x){return this.items.has(x)}},setAttribute(){},focus(){}};
  const document={getElementById:element,body:{classList:element('body').classList},addEventListener:(type,fn)=>{handlers[type]=fn}};
  const window={setTimeout:fn=>fn()};
  class Element { constructor(selector){this.selector=selector} closest(selector){return selector.split(',').map(x=>x.trim()).includes(this.selector)?element(this.selector.slice(1)):null} }
  vm.runInNewContext(fs.readFileSync(path.join(root,'js/ui-dialogs.js'),'utf8'),{document,window,Element});
  assert(handlers.click && handlers.keydown,'Listener delegati non registrati immediatamente');
  const confirm=window.PixelDialog.alert({confirmLabel:'HO CAPITO'});
  assert.strictEqual(element('pixelDialogConfirm').textContent,'HO CAPITO');
  handlers.click({target:new Element('#pixelDialogConfirm'),preventDefault(){}});
  confirm.then(value=>assert.strictEqual(value,true));
  assert(element('pixelDialog').classList.contains('hidden'));
  const cancelled=window.PixelDialog.confirm({});
  handlers.keydown({key:'Escape',preventDefault(){}});
  cancelled.then(value=>assert.strictEqual(value,false));
}
console.log('OK: dialogo delegato, auto-skip e chiamate eque.');
