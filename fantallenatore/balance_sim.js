'use strict';
// No alternative football formulas: run the current production app headlessly.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRuntime}=require('./tests/helpers/season-runtime');
function run({seasons=1,days=38,prefix='balance'}={}){
 if(!Number.isInteger(seasons)||seasons<1||seasons>100||!Number.isInteger(days)||days<1||days>38)throw Error('Seasons 1..100, days 1..38');
 const runs=[];let matches=0,goals=0,draws=0;const roleGoals={P:0,D:0,C:0,A:0},events={};
 for(let index=0;index<seasons;index++){
  const seed=prefix+'-'+index,runtime=createRuntime(seed),rounds=[];
  for(let day=1;day<=days;day++){
   const result=runtime.day(day);rounds.push({day,matches:result.matches.map(m=>({homeClub:m.homeClub,awayClub:m.awayClub,homeScore:m.homeScore,awayScore:m.awayScore})),performances:result.performances});
   for(const match of result.matches){matches++;goals+=match.homeScore+match.awayScore;if(match.homeScore===match.awayScore)draws++;}
   for(const perf of result.performances)roleGoals[perf.role]=(roleGoals[perf.role]||0)+Number(perf.goals||0);
   for(const event of result.events)events[event.type]=(events[event.type]||0)+1;
  }
  const state=runtime.getState();runs.push({seed,rounds,standings:state.season.serieAStandings,playerSeasonStats:state.season.playerSeasonStats,playerStatus:state.season.playerStatus,playerOvrDevelopment:state.season.playerOvrDevelopment});
 }
 const files=['app_v302.js','data_v302.js',...fs.readdirSync(path.join(__dirname,'js')).filter(f=>f.endsWith('.js')).map(f=>'js/'+f)];
 const sourceHashes=Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,file))).digest('hex')]));
 return {engine:'production-app',scope:'Serie A: generation, live events, ratings, standings, stats, statuses, OVR evolution',excluded:['UI/timers','fantasy manager lineups/standings','market and promotions','career season transition','browser persistence'],seasons,days,prefix,sourceHashes,summary:{matches,goals,goalsPerMatch:goals/matches,drawPct:draws*100/matches,roleGoals,events},runs};
}
if(require.main===module){
 try{const args=process.argv.slice(2),get=(key,fallback)=>{const i=args.indexOf(key);if(i<0)return fallback;if(!args[i+1])throw Error('Valore mancante: '+key);return args[i+1];};
 const seasons=Number(get('--seasons',args[0]&&!args[0].startsWith('--')?args[0]:1)),days=Number(get('--days',38)),prefix=get('--seed','balance');
 const report=run({seasons,days,prefix}),output=path.resolve(__dirname,get('--report','reports/balance-production-latest.json'));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({summary:report.summary,report:output,excluded:report.excluded},null,2));
 }catch(error){console.error(error);process.exitCode=1;}
}
module.exports={run};
