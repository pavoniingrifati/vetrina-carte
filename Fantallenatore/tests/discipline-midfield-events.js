'use strict';
const assert=require('node:assert/strict'),{createRuntime}=require('./helpers/season-runtime');
const api=createRuntime('discipline-midfield'),state=api.getState();state.season.currentMatchday=2;
const slots=api.slots(),roster=slots.map((s,i)=>({id:'p'+i,name:'Player '+i,role:s.role,club:'inter',ovr:74}));
roster.push({id:'bench',name:'Bench midfielder',role:'C',club:'inter',ovr:74});
const lineup={formation:'4-3-3',starters:Object.fromEntries(slots.map((s,i)=>[s.instanceId,roster[i].id])),bench:['bench']},manager={id:'user',team:'Test',roster};
const map=new Map(roster.map(p=>[p.id,{playerId:p.id,name:p.name,role:p.role,club:p.club,day:2,entryMinute:0,exitMinute:90,liveVote:6,goals:0,assists:0,yellow:0,red:0,ownGoal:0,missedPenalty:0,savedPenalty:0,goalsConceded:0}]));
function activate(id){const option=api.eventTemplate(id,2);assert.equal(option.rarity,'common');state.season.formationChoices['2']={triggered:true,resolved:true,selectedOption:option};return option;}
function score(){return api.score(manager,lineup,map);}
function check(id,expected){state.season.formationChoices={};const base=score();const card=activate(id);const actual=score();assert.equal(actual.fantasyPoints,base.fantasyPoints+expected);assert.equal(actual.formationTeamBonus,expected);assert.equal(actual.formationTeamBonusLabel,expected?card.title:'');assert.equal(score().fantasyPoints,actual.fantasyPoints,'No cumulative bonus');assert.equal(api.score({...manager,id:'cpu1'},lineup,map).fantasyPoints,base.fantasyPoints,'User event does not affect CPU');assert.equal(api.score(manager,lineup,map,45).formationTeamBonus,0,'Team bonuses only settled at full time');return actual;}
const discipline='locker-rewarded-discipline',bomber='boost-midfield-bomber';
assert.equal(activate(discipline).category,'locker');assert.equal(activate(bomber).category,'boost');
check(discipline,1);
map.get('p0').yellow=1;check(discipline,0);map.get('p0').yellow=0;
map.get('p0').red=1;check(discipline,0);map.get('p0').red=0;
map.get('p0').yellow=2;map.get('p0').red=1;check(discipline,0);map.get('p0').yellow=0;map.get('p0').red=0;
map.get('bench').yellow=1;check(discipline,1); // Unused reserves are excluded.
map.delete('p3');check(discipline,0); // The booked reserve enters the fantasy XI.
map.get('bench').yellow=0;check(discipline,1);
check(bomber,0);map.get('p0').goals=2;check(bomber,0); // Forward goals never qualify.
map.get('p4').goals=1;check(bomber,1);map.get('p4').goals=3;map.get('p5').goals=2;const result=check(bomber,1); // Once per team, not per goal or midfielder.
assert.equal(JSON.parse(JSON.stringify(result)).formationTeamBonusLabel,'Bomber di reparto');
map.get('p4').goals=0;map.get('p5').goals=0;map.get('bench').goals=1;check(bomber,1); // Entering midfielder counts.
map.set('p3',{...map.get('p4'),playerId:'p3',name:'Player 3'});check(bomber,0); // Bench goal does not count if player stays on bench.
map.get('p4').goals=1;activate(bomber);state.season.currentMatchday=3;assert.equal(score().formationTeamBonus,0,'Event expires next day');state.season.currentMatchday=2;
map.clear();check(discipline,0);check(bomber,0); // Empty/no-vote team earns no bonus.
console.log('OK: Common categories, clean/booked/sent-off XI, used/unused bench, midfield-only goals, once per team, full-time only, CPU isolation, expiry and result label persistence.');
