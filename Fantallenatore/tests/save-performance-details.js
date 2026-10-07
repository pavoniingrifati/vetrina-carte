'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const api=require('./helpers/season-runtime').createRuntime('save-bonus-details');
const ctx=vm.createContext({window:{},TextEncoder,TextDecoder,btoa,atob});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/save-codec.js'),'utf8'),ctx);
const performance={playerId:api.players()[0].id,name:'Capitano',day:1,role:'P',vote:8,fantasy:18.5,
 goals:1,assists:1,captainBonus:2,decisiveGoalBonus:1,cesariniBonus:1,goldenBenchBonus:1,underdogBonus:.5,
 decisiveGoals:1,lateGoals:1,minutes:90,replacedPlayerId:'reserve-id',replacedPlayerName:'Riserva',lineupSource:'bench',cleanSheetBonus:1};
const state=api.getState();state.season.matchdayResults={1:{day:1,matches:[{homeId:'user',awayId:'cpu1',homeFantasy:80,awayFantasy:70,homeScore:3,awayScore:1,homePerformances:[performance],awayPerformances:[{...performance,playerId:'opponent'}],homeSubstitutions:[{inId:performance.playerId,outId:'reserve-id',fantasy:18.5}]}]}};
const label=api.performanceText(performance),before=JSON.stringify(state);
const snapshot=api.storageSnapshot();assert.equal(JSON.stringify(state),before,'snapshot must not mutate live state');
const payload=ctx.window.FantaSaveCodec.encode(JSON.stringify(snapshot));
const reloaded=api.parseSave(payload);assert(reloaded,'compressed save must load');
const match=reloaded.season.matchdayResults[1].matches[0];
for(const side of ['homePerformances','awayPerformances']){
 const actual=match[side][0];
 for(const key of Object.keys(performance))assert.equal(actual[key],side==='awayPerformances'&&key==='playerId'?'opponent':performance[key],key);
 assert.equal(api.performanceText(actual),label,'bonus explanation survives reload');
}
for(const word of ['CAPITANO','GOL DECISIVO','CESARINI','PANCHINA D’ORO','UNDERDOG'])assert(label.includes(word));
assert.equal(match.homeFantasy,80);assert.equal(match.homePerformances[0].fantasy,18.5);
assert.equal(JSON.stringify(api.storageSnapshot(snapshot)),JSON.stringify(snapshot),'compaction remains idempotent');
// A V223 compact save can lack these optional fields; preserve its totals without inventing explanations.
const legacy=JSON.parse(JSON.stringify(snapshot));for(const p of legacy.season.matchdayResults[1].matches[0].homePerformances)for(const k of ['captainBonus','decisiveGoalBonus','cesariniBonus','goldenBenchBonus','underdogBonus'])delete p[k];
const old=api.parseSave(JSON.stringify(legacy));assert(old);assert.equal(old.season.matchdayResults[1].matches[0].homePerformances[0].fantasy,18.5);
assert(!api.performanceText(old.season.matchdayResults[1].matches[0].homePerformances[0]).includes('CAPITANO'));
console.log('OK: bonus, minuti e sostituzioni conservati nel round-trip compresso; riepilogo invariato, legacy compatibile, stato non mutato.');
