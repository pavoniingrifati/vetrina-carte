'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const app=require('./helpers/production-source').readProductionSource();
const context={console};vm.createContext(context);
function extract(from,to){const start=app.indexOf(from),end=app.indexOf(to,start);assert(start>=0&&end>start,`Sezione mancante: ${from}`);return app.slice(start,end)}
vm.runInContext(`
const FANTASY_MAX_SUBS=3,SERIEA_MIN_VOTE_MINUTES=15,GAME_CONFIG={startingDivision:3};
let state={};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const randomHash=value=>{let h=2166136261;for(const c of String(value)){h=Math.imul(h^c.charCodeAt(0),16777619)}return ((h>>>0)%100000)/100000};
const activeAdminRuleEffect=()=>null;
const activeFormationChoice=()=>null;
const playedMinutes=(perf,minute)=>minute-Number(perf.entryMinute||0);
const decisivePerformance=()=>false;
const halfPoint=value=>Math.round(value*2)/2;
${extract('const LEAGUE_RULE_DEFAULTS =','const FORMATION_CHOICE_RARITY_BY_TEMPLATE')}
${extract('function makeFormationSlots(','let lineupDraft =')}
${extract('function fantasyRuleForDay(day){','function starterReportActive(')}
${extract('function liveFantasyValue(perf,minute=90){','function perfEventText(')}
globalThis.check={defaultLeagueRules,generatePreAuctionLeagueRules,leagueRuleCardData,leagueRulesFor,availableLineupFormations,LINEUP_FORMATIONS,leagueRulesSummary,fantasyRuleForDay,liveFantasyValue,setState:value=>{state=value}};
`,context);
const rules=context.check;
assert.strictEqual(rules.defaultLeagueRules().maxFantasySubs,3);
assert.strictEqual(rules.defaultLeagueRules().formation334Allowed,false);
assert(!rules.availableLineupFormations().includes('3-3-4'));
assert.strictEqual(rules.LINEUP_FORMATIONS['3-3-4'].length,11);
const slotCounts=rules.LINEUP_FORMATIONS['3-3-4'].reduce((acc,slot)=>(acc[slot.role]++,acc),{P:0,D:0,C:0,A:0});
assert.strictEqual(JSON.stringify(slotCounts),JSON.stringify({P:1,D:3,C:3,A:4}));
let mega=false,allowed=false,captain=false,decisive=false;
for(let i=0;i<200;i++){
 const career={marketSeed:`rules-${i}`,leagueRules:rules.defaultLeagueRules()};
 const picked=rules.generatePreAuctionLeagueRules(career);
 assert.strictEqual(picked.selectedCategories.length,3);
 assert.strictEqual(new Set(picked.selectedCategories).size,3);
 rules.setState(career);
 const active=rules.fantasyRuleForDay(1);
 assert.strictEqual(active.maxFantasySubs,picked.maxFantasySubs);
 assert.strictEqual(active.cleanSheetBonus,picked.cleanSheetBonus);
 assert.strictEqual(rules.availableLineupFormations().includes('3-3-4'),!!picked.formation334Allowed);
 assert.strictEqual(rules.leagueRuleCardData(career).length,3);
 if(picked.selectedCategories.includes('captainBonus')) captain=true;
 if(picked.selectedCategories.includes('decisiveGoalBonus')) decisive=true;
 if(picked.cleanSheetBonus===2){
  mega=true;assert(rules.leagueRulesSummary(career).includes('+2 MEGA'));
  const keeper={day:1,entryMinute:0,role:'P',liveVote:6,goals:0,assists:0,yellow:0,red:0,ownGoal:0,missedPenalty:0,savedPenalty:0,goalsConceded:0};
  assert.strictEqual(rules.liveFantasyValue(keeper,90),8,'Il clean sheet mega deve assegnare +2 FP');
 }
 if(picked.formation334Allowed) allowed=true;
}
assert(mega&&allowed&&captain&&decisive,'La pool non estrae tutte le nuove regole');
const win={marketSeed:'bonus-test',leagueRules:{...rules.defaultLeagueRules(),decisiveGoalBonus:true}};
rules.setState(win);
const scorer={day:1,entryMinute:0,role:'A',liveVote:6,goals:1,decisiveGoals:1,assists:0,yellow:0,red:0,ownGoal:0,missedPenalty:0,savedPenalty:0,goalsConceded:0};
assert.strictEqual(rules.liveFantasyValue(scorer,90),10,'Il gol della vittoria vale +1 oltre al gol');
rules.setState({leagueRules:rules.defaultLeagueRules()});
const carded={...scorer,goals:0,decisiveGoals:0,liveVote:6};
assert.strictEqual(rules.liveFantasyValue({...carded,yellow:0,red:1},90),5,'Rosso diretto: -1');
assert.strictEqual(rules.liveFantasyValue({...carded,yellow:2,red:1,secondYellow:true},90),5,'Doppio giallo: due volte -0,5, senza ulteriore rosso');
assert.strictEqual(rules.liveFantasyValue({...carded,yellow:1,red:1},90),4.5,'Un giallo seguito da rosso diretto resta cumulabile');
console.log('OK: 200 carriere, default 3 cambi, clean sheet mega, 3-3-4, capitano e gol decisivo.');
