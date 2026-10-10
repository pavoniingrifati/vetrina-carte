'use strict';
const assert=require('node:assert/strict'),{createRuntime}=require('./helpers/season-runtime');
const api=createRuntime('new-admin'),state=api.getState();
function activate(id){const card=api.adminTemplate(id,2);state.season.adminRules['2']={triggered:true,resolved:true,selectedOption:card};return card;}
assert.equal(activate('admin-cesarini').rarity,'common');
const p={playerId:'test',day:2,entryMinute:0,liveVote:6,role:'A',goals:2,lateGoals:1,assists:0,yellow:0,red:0,ownGoal:0,missedPenalty:0,savedPenalty:0,goalsConceded:0};
assert.equal(api.adminFantasy(p),13);p.day=3;assert.equal(api.adminFantasy(p),12);
assert.equal(activate('admin-golden-bench').rarity,'common');
let perfs=[{playerId:'one',lineupSource:'substitute',goals:2,fantasy:12},{playerId:'two',lineupSource:'substitute',goals:1,fantasy:9}];
api.adminTeamBonuses(perfs,[{inPlayerId:'one'}],{roster:[]},2);assert.equal(perfs[0].fantasy,13);assert.equal(perfs[1].fantasy,9);
perfs=[{playerId:'one',lineupSource:'substitute',goals:0,fantasy:6},{playerId:'two',lineupSource:'substitute',goals:1,fantasy:9}];api.adminTeamBonuses(perfs,[{inPlayerId:'one'}],{roster:[]},2);assert.equal(perfs[1].fantasy,9);
assert.equal(activate('admin-underdog').rarity,'rare');
const roster=[{id:'low',ovr:74},{id:'edge',ovr:75},{id:'sub',ovr:70},{id:'sv',ovr:70}];
for(const managerId of ['user','cpu1']){
 const values=roster.map(p=>({playerId:p.id,lineupSource:p.id==='sub'?'substitute':'starter',fantasy:6,vote:p.id==='sv'?null:6,noVote:p.id==='sv'}));
 api.adminTeamBonuses(values,[],{id:managerId,roster},2);assert.equal(values[0].fantasy,6.5);for(const v of values.slice(1))assert.equal(v.fantasy,6);
}
const simulated=api.day(2);
for(const perf of simulated.performances){
 const late=simulated.events.filter(e=>String(e.playerId)===String(perf.playerId)&&['goal','penalty_goal'].includes(e.type)&&Number(e.minute)>=85).length;
 assert.equal(Number(perf.lateGoals||0),late,'Gol tardivi conteggiati dagli eventi reali');
}
console.log('OK: rarità, gol tardivi/reset, primo subentrato, bonus unico, OVR 74/75, SV, utente e CPU.');
