#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');

const root=path.resolve(__dirname,'..');
const context={
 console,Math,Date,JSON,Object,Array,String,Number,Boolean,Set,Map,
 state:{seasonRules:{figcIncidentRule:''},standings:{user:{id:'user',name:'User',pts:10},opp:{id:'opp',name:'Opp',pts:8}}},
 isTeamEliminated:()=>false,
 clamp:(n,a,b)=>Math.max(a,Math.min(b,n))
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'assets/season/08-special-rules.js'),'utf8'),context,{filename:'08-special-rules.js'});

const tests=[];
function test(name,fn){try{fn();tests.push({name,ok:true})}catch(error){tests.push({name,ok:false,error:String(error.message||error)})}}

test('scelta negativa attiva la regola',()=>{
 const text=context.activateFigcIncidentRule('negative');
 assert.equal(context.state.seasonRules.figcIncidentRule,'negative');
 assert(text.includes('sottrae un gol'));assert(text.includes('negativo'));
});

test('rossi, infortuni e rigori sbagliati possono portare il risultato sotto zero',()=>{
 context.state.seasonRules.figcIncidentRule='negative';
 const events=[
  {minute:10,playerId:'p1',player:'Uno',goalValue:1},
  {minute:20,playerId:'p2',player:'Due',goalValue:1},
  {minute:30,playerId:'p3',player:'Tre',goalValue:1}
 ];
 const out=context.applyFigcNegativeGoalPenalty(3,events,{redCards:1,injuries:1,missedPenalties:1});
 assert.equal(out.after,0);assert.equal(out.penalty,3);assert.equal(context.scoreGoalEvents(events),0);
 const zero=context.applyFigcNegativeGoalPenalty(0,[],{redCards:2,injuries:2,missedPenalties:2});
 assert.equal(zero.after,-6);assert.equal(zero.penalty,6);
 const belowEvents=[{minute:12,playerId:'p4',player:'Quattro',goalValue:1}];
 const below=context.applyFigcNegativeGoalPenalty(1,belowEvents,{redCards:2,injuries:1,missedPenalties:0});
 assert.equal(below.after,-2);assert.equal(below.penalty,3);assert.equal(context.scoreGoalEvents(belowEvents),0);
});

test('una doppietta o più vale un punto per giocatore, non per ogni gol oltre il secondo',()=>{
 context.state.seasonRules.figcIncidentRule='positive';
 const goals=[
  {playerId:'p1',player:'Bomber A',goalValue:1},{playerId:'p1',player:'Bomber A',goalValue:1},
  {playerId:'p2',player:'Bomber B',goalValue:1},{playerId:'p2',player:'Bomber B',goalValue:1},{playerId:'p2',player:'Bomber B',goalValue:1},
  {playerId:'p3',player:'Singolo',goalValue:2},
  {playerId:'',player:'Gol regolamentare',goalValue:1},{playerId:'',player:'Gol regolamentare',goalValue:1}
 ];
 const scorers=context.figcBraceScorers(goals);
 assert.equal(scorers.length,2);assert.equal(context.figcBraceBonus(goals),2);
});

test('il bonus doppietta viene applicato alla classifica di entrambe le squadre',()=>{
 context.state.seasonRules.figcIncidentRule='positive';
 context.state.standings.user.pts=10;context.state.standings.opp.pts=8;
 const details=context.applyFigcBraceBonusesToRound([{homeId:'user',homeName:'User',awayId:'opp',awayName:'Opp',homeGoals:[{playerId:'p1',player:'A'},{playerId:'p1',player:'A'}],awayGoals:[{playerId:'q1',player:'B'},{playerId:'q1',player:'B'},{playerId:'q1',player:'B'}]}]);
 assert.equal(context.state.standings.user.pts,11);assert.equal(context.state.standings.opp.pts,9);assert.equal(details.length,2);
});

const failed=tests.filter(item=>!item.ok);
console.log(JSON.stringify({ok:failed.length===0,tests,summary:{total:tests.length,passed:tests.length-failed.length,failed:failed.length}},null,2));
process.exitCode=failed.length?1:0;
