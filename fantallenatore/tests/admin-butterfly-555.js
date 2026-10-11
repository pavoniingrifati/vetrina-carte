'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const source=require('./helpers/production-source').readProductionSource();
const start=source.indexOf('  function makeFormationSlots(');
const end=source.indexOf('  let lineupDraft = null;',start);
assert(start>=0&&end>start);
const context={state:{season:{currentMatchday:1}},leagueRulesFor:()=>({formation334Allowed:false}),activeAdminRuleEffect:()=>({ruleId:'butterfly_555'}),Object};
vm.runInNewContext(source.slice(start,end)+'\nthis.formationSlots=LINEUP_FORMATIONS["5-5-5"];',context);
const slots=context.formationSlots;
assert.strictEqual(slots.length,16);
for(const [role,count] of [['P',1],['D',5],['C',5],['A',5]])
  assert.strictEqual(slots.filter(slot=>slot.role===role).length,count);
assert.strictEqual(context.allowedLineupFormation('5-5-5'),true);
context.activeAdminRuleEffect=()=>null;
assert.strictEqual(context.allowedLineupFormation('5-5-5'),false,'Il modulo speciale non resta nelle altre giornate');

const simStart=source.indexOf('  function applyAdminTeamScoring(');
const simEnd=source.indexOf('  function updateStandingsFromMatch(',simStart);
assert(simStart>=0&&simEnd>simStart);
const roster=slots.map((slot,i)=>({id:`p${i}`,name:`Giocatore ${i}`,role:slot.role}));
const starters=Object.fromEntries(slots.map((slot,i)=>[slot.instanceId,roster[i].id]));
Object.assign(context,{
  lineupSlots:()=>slots,lineupBenchPlayers:()=>[],
  currentFantasyPerformance:player=>({playerId:player.id,role:player.role,day:1,noVote:false,vote:6,fantasy:6}),
  tacticForManager:()=>null,activeFormationChoice:()=>null,leagueRulesFor:()=>({captainBonus:'off'}),
  halfPoint:value=>Math.round(value*2)/2,
  classicDefenseModifierResult:()=>({bonus:0,average:null}),fantasyGoals:points=>Math.floor(points/6)
});
vm.runInNewContext(source.slice(simStart,simEnd),context);
const result=context.simulateFantasyTeamFromSerieA({id:'user',team:'Test',roster},{formation:'5-5-5',starters,bench:[]},new Map());
assert.strictEqual(result.performances.length,16);
assert.strictEqual(result.fantasyPoints,96,'Tutti i 16 titolari concorrono al punteggio');
assert.strictEqual(result.unresolvedSV,0);
console.log('OK: 5-5-5 epico, 16 slot, punti di tutti i titolari e ritorno ai moduli normali.');
