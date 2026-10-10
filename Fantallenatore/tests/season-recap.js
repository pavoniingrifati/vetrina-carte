'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/season-recap.js'),'utf8'),context);
const build=context.window.FantaSeasonRecap.build;
const roster=[
 {id:'a',name:'Acquisto intelligente',price:4,ovr:75},
 {id:'b',name:'Stella costosa',price:85,ovr:82},
 {id:'c',name:'Riserva',price:1,ovr:70}
];
const days={};
for(let day=1;day<=8;day++)days[day]={day,matches:[{homeId:'user',awayId:'cpu',homePerformances:[
 {playerId:'a',name:'Acquisto intelligente',vote:7,fantasy:9,goals:1,assists:0},
 {playerId:'b',name:'Stella costosa',vote:7.5,fantasy:8,goals:0,assists:1},
 ...(day===1?[{playerId:'c',name:'Riserva',vote:10,fantasy:12,goals:0,assists:0}]:[])
]}]};
const result=build({results:days,roster,position:2,development:{a:{delta:5},b:{delta:-4}}});
assert.strictEqual(result.position,2);
assert.strictEqual(result.scorer.id,'a');assert.strictEqual(result.scorer.goals,8);
assert.strictEqual(result.assister.id,'b');assert.strictEqual(result.assister.assists,8);
assert.strictEqual(result.topVote.id,'b');assert.strictEqual(result.topFantasy.id,'a');
assert.strictEqual(result.bestPurchase.id,'a');assert.strictEqual(result.bestPurchase.cost,4);
assert.strictEqual(result.improved.delta,5);assert.strictEqual(result.declined.delta,-4);
assert.strictEqual(build({results:{},roster:[],development:{}}).scorer,null);
console.log('OK: recap stagione, medie su presenze fantasy, acquisto/prezzo e variazioni OVR.');
const recordResults={
  1:{day:1,matches:[{homeId:'user',awayId:'cpu1',awayTeam:'Rivale Uno',homeFantasy:88.5,awayFantasy:70,homeScore:4,awayScore:1}]},
  2:{day:2,matches:[{homeId:'cpu2',awayId:'user',homeTeam:'Rivale Due',homeFantasy:99,awayFantasy:65.5,homeScore:6,awayScore:0}]},
  3:{day:3,matches:[{homeId:'user',awayId:'cpu3',homeFantasy:88.5}]},
  4:{day:4,matches:[{homeId:'user',awayId:'cpu4',homeFantasy:null}]},
  5:{day:5,matches:[{homeId:'cpu',awayId:'other',homeFantasy:120,awayFantasy:1}]}
};
const records=build({results:recordResults});
assert.strictEqual(records.bestMatchday.day,1);assert.strictEqual(records.bestMatchday.fantasyPoints,88.5);
assert.strictEqual(records.bestMatchday.opponentTeam,'Rivale Uno');assert.strictEqual(records.bestMatchday.home,true);
assert.strictEqual(records.worstMatchday.day,2);assert.strictEqual(records.worstMatchday.fantasyPoints,65.5);
assert.strictEqual(records.worstMatchday.opponentTeam,'Rivale Due');assert.strictEqual(records.worstMatchday.home,false);
assert.strictEqual(records.worstMatchday.score,0);assert.strictEqual(records.worstMatchday.opponentScore,6);
recordResults[6]={day:6,matches:[{homeId:'user',awayId:'cpu',homeFantasy:0}]};
assert.strictEqual(build({results:recordResults}).worstMatchday.fantasyPoints,0);
assert.strictEqual(build().bestMatchday,null);assert.strictEqual(build().worstMatchday,null);
console.log('OK: best/worst fantasy totals, home/away perspective, ties use earliest day, valid zero, missing data ignored.');
