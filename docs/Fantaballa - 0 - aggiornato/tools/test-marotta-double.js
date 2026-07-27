const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.resolve(__dirname,'..');
const context={console,Math,Date,Intl,Number,String,Boolean,Array,Object,Map,Set,JSON,parseInt,parseFloat,isFinite};
context.globalThis=context;
context.USER_ID='user';
context.state={};
context.isTeamEliminated=()=>false;
context.teamById=id=>({id:String(id),name:String(id)});
context.opponentMatchPower=()=>70;
context.userStanding=()=>context.state.standings?.user||null;
context.fgciResultRuleTarget=(gf,ga,base)=>base;
context.fgciPointsAdjustment=()=>0;
context.fgciPointsRuleNote=()=>'';
context.fgciResultRuleNote=()=>'';
context.fantaballaVideoPointsNote=()=>'';
vm.createContext(context);
for(const file of ['assets/season/08-special-rules.js','assets/season/12-match-simulation.js']){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
}
const tests=[];
function test(name,fn){try{fn();tests.push({name,ok:true});}catch(error){tests.push({name,ok:false,error:error.message});}}
function eq(actual,expected,label='value'){if(actual!==expected)throw new Error(`${label}: expected ${expected}, got ${actual}`);}
function reset({winPoints=3,pointsEqualGoals=false,activeEffects=[],rules={}}={}){
  context.state={
    seasonRules:{figcCompetitionRule:'',fgicLeagueRule:'',bottomHelpRoundTeamIds:[],marottaDoubleWins:true,marottaLossPenalty:100,winPoints,drawPoints:1,zeroZeroNoPoints:false,pointsEqualGoals,fantaballaVideoRule:'',...rules},
    activeEffects,
    standings:{user:{id:'user',pts:0},ai:{id:'ai',pts:0}},
    lastResult:null
  };
}

test('Vittoria standard 3 diventa 6',()=>{reset();context.state.standings.user.pts=3;const r=context.applyUserPointRules(2,1);eq(r.awarded,6,'awarded');eq(context.state.standings.user.pts,6,'standing');if(!r.note.includes('da 3 a 6'))throw new Error('missing dynamic note');});
test('Maratona 1.5 diventa 3',()=>{reset({winPoints:1.5});context.state.standings.user.pts=1.5;const r=context.applyUserPointRules(1,0);eq(r.awarded,3,'awarded');eq(context.state.standings.user.pts,3,'standing');});
test('Vittoria speciale 9 diventa 18',()=>{reset({activeEffects:[{type:'winPoints',value:9}]});context.state.standings.user.pts=3;const r=context.applyUserPointRules(1,0);eq(r.awarded,18,'awarded');eq(context.state.standings.user.pts,18,'standing');});
test('Bonus vittoria viene incluso prima del raddoppio',()=>{reset({activeEffects:[{type:'extraWinPoint',value:1}]});context.state.standings.user.pts=3;const r=context.applyUserPointRules(1,0);eq(r.awarded,8,'awarded');eq(context.state.standings.user.pts,8,'standing');});
test('Punti uguali ai gol: 4 diventa 8',()=>{reset({pointsEqualGoals:true});context.state.standings.user.pts=4;const r=context.applyUserPointRules(4,1);eq(r.awarded,8,'awarded');eq(context.state.standings.user.pts,8,'standing');});
test('Aiuto dal fondo: vittoria 4 diventa 8',()=>{reset({rules:{fgicLeagueRule:'bottom-help',bottomHelpRoundTeamIds:['user']}});context.state.standings.user.pts=4;const r=context.applyUserPointRules(2,0);eq(r.awarded,8,'awarded');eq(context.state.standings.user.pts,8,'standing');});
test('Sconfitta resta -100',()=>{reset();const r=context.applyUserPointRules(0,1);eq(r.awarded,-100,'awarded');eq(context.state.standings.user.pts,-100,'standing');});
test('Formula 1: 25 punti della vittoria diventano 50',()=>{reset({rules:{figcCompetitionRule:'formula-one'}});const result=context.applyFormulaOneRoundPoints([{homeId:'user',awayId:'ai',homeName:'User',awayName:'AI',homeScore:2,awayScore:0,winnerId:'user'}]);eq(result.user.basePoints,25,'basePoints');eq(result.user.points,50,'points');eq(context.state.standings.user.pts,50,'standing');});
test('Formula 1: le altre squadre non ricevono il raddoppio',()=>{reset({rules:{figcCompetitionRule:'formula-one'}});const result=context.applyFormulaOneRoundPoints([{homeId:'ai',awayId:'user',homeName:'AI',awayName:'User',homeScore:2,awayScore:0,winnerId:'ai'}]);const ai=result.ranking.find(x=>x.teamId==='ai');eq(ai.points,25,'ai points');if(ai.marottaDoubled)throw new Error('AI incorrectly doubled');});

const failed=tests.filter(t=>!t.ok);
const report={suite:'Marotta League dynamic double',passed:tests.length-failed.length,failed:failed.length,total:tests.length,tests};
fs.writeFileSync(path.join(root,'TEST-MAROTTA-DOPPIO.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(failed.length)process.exit(1);
