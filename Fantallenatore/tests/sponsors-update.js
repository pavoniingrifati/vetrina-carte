'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const context={window:{},Date};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/career-engine.js'),'utf8'),context);
const E=context.window.FantaCareerEngine;
const career={euros:0,totalEarned:0,nextAuctionBonusCredits:0};
const season={sponsor:E.createSeasonSponsor({id:'bonus_firma',name:'Amauri'})};
assert.strictEqual(E.grantImmediateSponsorBonus(career,season),12);
assert.strictEqual(E.grantMidseasonSponsorBonus(career,season,18,[{managerId:'user'}]),0);
assert.strictEqual(E.grantMidseasonSponsorBonus(career,season,19,[{managerId:'cpu'},{managerId:'user'}]),12);
assert.strictEqual(E.grantMidseasonSponsorBonus(career,season,19,[{managerId:'user'}]),0);
assert.strictEqual(career.euros,24);
const third={sponsor:E.createSeasonSponsor({id:'bonus_firma'})};
assert.strictEqual(E.grantMidseasonSponsorBonus(career,third,19,[{managerId:'a'},{managerId:'b'},{managerId:'user'}]),0);
assert.strictEqual(E.grantMidseasonSponsorBonus(career,third,19,[{managerId:'user'}]),0);
season.sponsor=E.createSeasonSponsor({id:'big_match'});
const match={matches:[{homeId:'user',awayId:'cpu',homeScore:2,awayScore:1}]};
assert.strictEqual(E.grantBigMatchSponsorReward(career,season,1,match,['cpu']),8);
assert.strictEqual(E.grantBigMatchSponsorReward(career,season,1,match,['cpu']),0);
season.sponsor=E.createSeasonSponsor({id:'streak_bonus'});
season.matchdayResults={'1':match,'2':match,'3':match};
assert.strictEqual(E.grantStreakSponsorReward(career,season,3,match),10);
season.sponsor=E.createSeasonSponsor({id:'future_auction'});
assert.strictEqual(E.grantFutureAuctionBonus(career,season),30);
assert.strictEqual(E.grantFutureAuctionBonus(career,season),0);

const app=require('./helpers/production-source').readProductionSource();
const between=(a,b)=>{const from=app.indexOf(`  function ${a}(`),to=app.indexOf(`  function ${b}(`,from);assert(from>=0&&to>from);return app.slice(from,to)};
const player={id:'a',role:'A',name:'Attaccante'},other={id:'b',role:'D',name:'Difensore'};
const user={id:'user',roster:[player,other]};
const dayContext={state:{season:{sponsor:{id:'fantacana'},currentMatchday:1}},
  ensureSeasonState:()=>dayContext.state.season,activeAdminRuleEffect:()=>null,managerById:()=>user,
  lineupSlots:()=>[{instanceId:'d1',role:'D'},{instanceId:'a1',role:'A'}],
  allowedLineupFormation:()=>true,adminBlockedStarterForManager:()=>null,
  lineupPlayerValue:()=>1,Math};
vm.runInNewContext(between('adminWildcardStartingSlotLimit','enforceStarterInLineup'),dayContext);
vm.runInNewContext(between('normalizeSavedLineup','syncDraftBenchOrder'),dayContext);
assert.strictEqual(dayContext.adminWildcardStartingSlotLimit(),1);
assert.strictEqual(dayContext.wildcardSlotCompatible('A','D'),true);
const lineup=dayContext.normalizeSavedLineup({formation:'4-3-3',starters:{d1:'a',a1:'b'},bench:[],confirmed:true},user);
assert.strictEqual(Object.keys(lineup.starters).length,1,'Un solo titolare fuori ruolo');
assert.strictEqual(lineup.starters.d1,'a');
assert.strictEqual(dayContext.canPlacePlayerInLineupSlot(other,{instanceId:'a1',role:'A'},lineup),false);
dayContext.state.season.sponsor.id='win_bonus';
assert.strictEqual(dayContext.adminWildcardStartingSlotLimit(),0);
assert.strictEqual(dayContext.normalizeSavedLineup({formation:'4-3-3',starters:{d1:'a'}},user).starters.d1,undefined);

const fpContext={state:{career:{seasonNumber:1,fantapoints:0,totalFantapointsEarned:0,fantapointsHistory:[]}},
  ensureCareerEconomy:()=>fpContext.state.career,careerFantapoints:()=>fpContext.state.career.fantapoints};
vm.runInNewContext(between('grantMatchdayFantapoints','careerDivisionLabel'),fpContext);
const bonusDay={matches:[{homeId:'user',awayId:'cpu',homeScore:2,awayScore:0}]};
const fpSeason={sponsor:{id:'fantasy_bonus'}};
const reward=fpContext.grantMatchdayFantapoints(fpSeason,1,bonusDay);
assert.strictEqual(reward.parts.sponsor,2);
assert.strictEqual(fpContext.grantMatchdayFantapoints(fpSeason,1,bonusDay),reward);
assert.strictEqual(fpContext.state.career.totalFantapointsEarned,reward.total);
const academySeason={started:true,playerOvrDevelopment:{},playerDevelopmentEvents:[]};
const academyPlayer={id:'academy-player',name:'Giovane',ovr:80};
const academyContext={state:{season:academySeason},ensureSeasonState:()=>academySeason,
  playerOvrDevelopment:id=>academySeason.playerOvrDevelopment[id] ||= {delta:0,history:[]},
  currentPlayerOvr:p=>p.ovr+Number(academySeason.playerOvrDevelopment[p.id]?.delta||0),
  clamp:(value,min,max)=>Math.max(min,Math.min(max,value)),addSeasonNews:()=>{},Math};
vm.runInNewContext(between('applyPlayerOvrChange','updatePlayerOvrEvolution'),academyContext);
const growth=academyContext.applyPlayerOvrChange(academyPlayer,2,1,'Accademia: crescita garantita','sponsor_academy');
assert.strictEqual(growth.change,2);
assert.strictEqual(academySeason.playerOvrDevelopment[academyPlayer.id].delta,2);
assert.strictEqual(academySeason.playerDevelopmentEvents.length,1);
console.log('OK: sponsor nuovi, premi G19, FP e fuori ruolo persistenti.');
