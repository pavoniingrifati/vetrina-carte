const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'../assets/season/08-special-rules.js'),'utf8');
const start=src.indexOf('function simulatePenaltyShootout');
const end=src.indexOf('function matchOutcomeScores',start);
const code=src.slice(start,end)+'\nglobalThis.resolveNoDrawMatch=resolveNoDrawMatch;';
const context={Math:Object.create(Math),Number,String,Array,Object,console,clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),noDrawRuleActive:()=>false,simulateScore:()=>[0,0],buildTeamGoals:()=>[],goalValueForMinute:()=>1,scoreGoalEvents:events=>(events||[]).reduce((sum,e)=>sum+(Number(e.goalValue)||1),0)};
let seq=[0.1,0.9,0.1,0.9,0.1,0.9,0.1,0.9,0.1,0.9,0.1,0.9];context.Math.random=()=>seq.shift()??0.1;context.globalThis=context;vm.createContext(context);vm.runInContext(code,context);
const result=context.resolveNoDrawMatch({scoreA:1,scoreB:1,teamA:{id:'user',name:'Utente'},teamB:{id:'opp',name:'Avversario'},force:true});
assert.equal(result.extraTime,true);assert(result.winnerId);assert(result.penalties);assert.notEqual(result.outcomeScoreA,result.outcomeScoreB);console.log('PASS pareggio forzatamente risolto con supplementari e rigori');
