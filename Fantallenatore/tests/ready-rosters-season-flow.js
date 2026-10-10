'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const window={};
for(const name of ['trade-roster-controller','ready-rosters-controller','auction-controller'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/domains/'+name+'.js'),'utf8'),{window,Date,console});
const events=[],nodes={summaryTitle:{},summaryStats:{},calibrationPanel:{}};
const runtime={state:{career:{seasonNumber:1},managers:[{id:'user',budget:500}],stats:{purchases:0,totalSpent:0}},ROLE_ORDER:[],ROLE_LIMITS:{},TOTAL_SLOTS:25,
 $:id=>nodes[id],openRoleAuction:()=>true,allRostersComplete:()=>true,prepareNewGame:()=>{},auditAndRepairState:()=>{},quickReadyYield:async()=>{},setQuickReadyLoading:()=>{},
 saveState:()=>events.push('save'),showScreen:id=>events.push(id),renderSponsorSelection:()=>events.push('sponsor'),buildFinalLeagueRosterCards:()=>'',
 clearAuctionRuntimeTimers:()=>{},hideRoleTransitionModal:()=>{},hideRoleRemainderAutoSim:()=>{},renderTradeWindow:kind=>events.push(kind+' trades')};
Object.assign(runtime,window.FantaDomains['trade-roster-controller'].create(runtime));
// Use the real summary renderer and trade-window state; the trade UI must never open here.
runtime.renderTradeWindow=kind=>events.push(kind+' trades');
const ready=window.FantaDomains['ready-rosters-controller'].create(runtime);
(async()=>{
 await ready.generateReadyRosters();
 assert.equal(runtime.state.quickStart,true);assert.equal(runtime.currentTradeWindow('summer').stage,'completed');
 assert.ok(events.includes('summaryScreen'));assert.ok(events.includes('sponsor'));assert.ok(!events.includes('summer trades'));
 assert.equal(runtime.currentTradeWindow('winter').stage,'open');
 // Previous ready-roster saves with a pending summer trade also skip it on resume/start guards.
 const summer=runtime.state.tradeWindows['summer|S1'];summer.stage='open';summer.pending={};
 assert.equal(runtime.currentTradeWindow('summer').stage,'completed');assert.equal(summer.pending,null);
 // An ordinary or simulated auction still opens summer trades.
 runtime.state.quickStart=false;delete runtime.state.tradeWindows;events.length=0;
 const auction=window.FantaDomains['auction-controller'].create(runtime);auction.finishAuction();
 assert.equal(runtime.currentTradeWindow('summer').stage,'open');assert.ok(events.includes('summer trades'));
 runtime.state.winterMarketFlow={stage:'auction'};events.length=0;auction.finishAuction();
 assert.equal(runtime.state.winterMarketFlow.stage,'trades');assert.ok(events.includes('winter trades'));
 console.log('OK: Rose pronte → sponsor, ripresa compatibile, asta → scambi estivi, gennaio → scambi invernali.');
})().catch(error=>{console.error(error);process.exitCode=1;});
