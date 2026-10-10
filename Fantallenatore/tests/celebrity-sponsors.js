'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const window={};
for(const file of ['js/career-engine.js','js/storage-snapshot.js','js/domains/shop-controller.js','js/domains/lineup-controller.js','js/domains/career-market-controller.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),{window,Date,console,document:{querySelectorAll:()=>[]}});
const engine=window.FantaCareerEngine;
const defs=Object.fromEntries(['win_bonus','bonus_firma','academy','free_subscription','future_auction','big_match','streak_bonus','fantasy_bonus','fantacana'].map(id=>[id,{id,name:id}]));
const state={career:engine.normalizeCareer({seasonNumber:3,fantapoints:100}),season:{started:true,currentMatchday:4,consumables:{inventory:{cons_celebrity:2}}},managers:[{roster:[{id:'p',ovr:80}]}]};
let saves=0;
const rt={state,CareerEngine:engine,SEASON_SPONSORS:defs,shuffledCopy:x=>x,saveState:()=>saves++,showToast:()=>{},renderSponsorSelection:()=>{},ensureSeasonState:()=>state.season,lineupReadOnly:false,$:()=>null};
Object.assign(rt,window.FantaDomains['shop-controller'].create(rt));
const lineup=window.FantaDomains['lineup-controller'].create(rt);rt.lineupConsumableActionState=lineup.lineupConsumableActionState;rt.renderConsumableInventory=()=>{};
lineup.beginConsumableUse('cons_celebrity');assert.equal(state.career.nextSponsorSeason,4);assert.equal(state.season.consumables.inventory.cons_celebrity,1);assert.ok(saves>0);
lineup.beginConsumableUse('cons_celebrity');assert.equal(state.season.consumables.inventory.cons_celebrity,1,'repeat activation must not consume');
const storage=window.FantaStorageSnapshot.create({compactMarketState:x=>x});
assert.equal(JSON.parse(JSON.stringify(storage.buildStorageSnapshot(state))).career.nextSponsorSeason,4);
state.season.completed=true;
Object.assign(rt,{ensureNextSeasonFlow:()=>({stage:'market_summary',nextDivision:3}),archiveCompletedSeasonIfNeeded:()=>{},finalizeCompletedSeasonOvrBases:()=>{},compactLongCareerState:x=>x,GAME_CONFIG:{startingDivision:3},freshManagers:()=>[{id:'user',roster:[]}],INITIAL_BUDGET:500,normalizedCoachAvatar:()=>'',defaultLeagueRules:()=>({}),ensureSerieATransferMarket:()=>({}),ensureRealLeague:()=>({}),leagueRulesFor:()=>({}),buildSeasonAuctionReputation:()=>({})});
const market=window.FantaDomains['career-market-controller'].create(rt);
const draft=market.buildNextSeasonCareerDraft();assert.equal(draft.sponsorSlots,2);assert.equal(draft.carryoverConsumables.cons_celebrity,1);assert.equal(draft.sponsorOfferIds.length,3);
state.career.nextSponsorSeason=5;assert.equal(market.buildNextSeasonCareerDraft().sponsorSlots,1,'must apply only to intended season');state.career.nextSponsorSeason=4;
state.season=null;state.sponsorSlots=2;state.sponsorOfferIds=['win_bonus','academy','bonus_firma'];
rt.selectSeasonSponsor('win_bonus');rt.selectSeasonSponsor('academy');assert.equal(engine.selectedSponsorChoices(state).length,2);
rt.selectSeasonSponsor('bonus_firma');assert.equal(engine.selectedSponsorChoices(state).length,2,'third cannot replace signed sponsors');
rt.selectAcademySponsorPlayer('p');let season={sponsor:rt.seasonSponsorFromChoice()};assert.equal(engine.findSeasonSponsor(season,'academy').playerId,'p');
rt.selectSeasonSponsor('win_bonus');rt.selectSeasonSponsor('bonus_firma');assert.equal(engine.selectedSponsorChoices(state).length,2);assert.equal(engine.selectedSponsorChoices(state)[0].playerId,'p');
season={sponsor:rt.seasonSponsorFromChoice()};assert.equal(engine.grantImmediateSponsorBonus(state.career,season),12);assert.equal(engine.grantImmediateSponsorBonus(state.career,season),0);
// Every pair shares a season but has independent caps and one-time rewards.
for(const first of Object.keys(defs))for(const second of Object.keys(defs).filter(id=>id!==first)){
 const career=engine.normalizeCareer({euros:0});const sponsor=engine.createSeasonSponsor(defs[first]);sponsor.additionalSponsors=[engine.createSeasonSponsor(defs[second])];const season={sponsor,matchdayResults:{}};
 engine.grantImmediateSponsorBonus(career,season);
 for(let day=1;day<=38;day++){
  const result={matches:[{homeId:'user',awayId:'cpu',homeScore:2,awayScore:0}]};season.matchdayResults[day]=result;
  engine.grantWinSponsorReward(career,season,day,result);engine.grantBigMatchSponsorReward(career,season,day,result,['cpu']);engine.grantStreakSponsorReward(career,season,day,result);
  engine.grantMidseasonSponsorBonus(career,season,day,[{managerId:'user'}]);
 }
 const expected={win_bonus:38,bonus_firma:24,big_match:40,streak_bonus:40};assert.equal(career.euros,(expected[first]||0)+(expected[second]||0));
 assert.equal(engine.grantFutureAuctionBonus(career,season),[first,second].includes('future_auction')?30:0);assert.equal(engine.grantFutureAuctionBonus(career,season),0);
 if([first,second].includes('free_subscription')){
  assert.equal(engine.buyShopItem(career,season,{cost:20},'data',{freeItemIds:['data','scout']}).free,true);
  assert.equal(engine.sponsorCanMakeItemFree('scout',season,['scout']),false);
 }
 const restored=JSON.parse(JSON.stringify(season));assert.equal(engine.seasonSponsors(restored).length,2);assert.equal(engine.grantImmediateSponsorBonus(career,restored),0);
}
// Non-cash effects must also work when the sponsor is second.
state.season={sponsor:engine.createSeasonSponsor(defs.win_bonus)};
state.season.sponsor.additionalSponsors=[engine.createSeasonSponsor(defs.fantasy_bonus)];
assert.equal(rt.grantMatchdayFantapoints(state.season,1,{matches:[{homeId:'user',awayId:'cpu',homeScore:2,awayScore:0}]}).parts.sponsor,2);
const saved=JSON.parse(JSON.stringify(storage.buildStorageSnapshot(state)));
assert.equal(engine.findSeasonSponsor(saved.season,'fantasy_bonus').id,'fantasy_bonus');
vm.runInNewContext(fs.readFileSync('js/domains/matchday-events-controller.js','utf8'),{window});
const events=window.FantaDomains['matchday-events-controller'].create({...rt,activeAdminRuleEffect:()=>null});
state.season.sponsor.additionalSponsors=[engine.createSeasonSponsor(defs.fantacana)];
assert.equal(events.adminWildcardStartingSlotLimit(),1);assert.equal(events.wildcardSlotCompatible('D','A'),true);assert.equal(events.wildcardSlotCompatible('P','A'),false);
state.season=null;
state.sponsorSlots=1;state.sponsorChoice=null;rt.selectSeasonSponsor('win_bonus');rt.selectSeasonSponsor('bonus_firma');assert.equal(engine.selectedSponsorChoices(state).length,1);
console.log('OK: activation, duplicate guard, save/reload, exact next-season carryover, two-of-three choices, academy player, 72 sponsor pairs, independent caps, old single sponsor.');
