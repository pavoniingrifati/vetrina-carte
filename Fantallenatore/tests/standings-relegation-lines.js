'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const window={},buttons=['position','team','points'].map(key=>({dataset:{serieaStandingsSort:key},classList:{toggle(){}},querySelector:()=>({}),setAttribute(){},closest:()=>({setAttribute(){}})})),document={querySelectorAll:selector=>selector.includes('data-seriea-standings-sort')?buttons:[]};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/domains/league-views.js'),'utf8'),{window,document});
const fantasy=Array.from({length:10},(_,i)=>({managerId:i===9?'user':'cpu'+i,_leaguePosition:i+1,played:19,points:30-i,fantasyPoints:100-i,wins:1,draws:1,losses:1,gf:10,ga:5}));
const clubs=Array.from({length:20},(_,i)=>({clubId:String(i+1),played:19,points:60-i,wins:1,draws:1,losses:1,gf:30,ga:20}));
const nodes={serieAStandingsBody:{},fantasyRelegationNote:{}},noop=()=>{},runtime={state:{career:{division:4}},$:id=>nodes[id],sortedFullStandingsForView:()=>fantasy,managerById:id=>({team:id,name:''}),escapeHtml:s=>String(s),stopHubNewsCarousel:noop,ensureSeasonState:()=>({standings:fantasy,playerSeasonStats:{}}),showScreen:noop,renderLeagueNavActive:noop,renderCareerWallets:noop,sortedStandings:()=>fantasy,renderCareerHonours:noop,renderFullStandingsSortState:noop,sortedSerieAStandings:()=>clubs,clubName:id=>'Club '+String(21-Number(id)).padStart(2,'0'),wireSeasonPlayerButtons:noop};
const api=window.FantaDomains['league-views'].create(runtime);
for(const division of [4,3,2,1]){
 runtime.state.career.division=division;
 const html=api.fullStandingsRowsHtml();assert.equal((html.match(/relegation-boundary/g)||[]).length,division===4?0:1);
 if(division<4)assert.ok(html.includes('is-user-standing is-relegation-standing relegation-boundary'));
 api.renderLeagueStandingsScreen();assert.equal(nodes.fantasyRelegationNote.hidden,division===4);
}
const check=()=>{
 const rows=Array.from(nodes.serieAStandingsBody.innerHTML.matchAll(/<tr class="([^"]*)"><td>(\d+)<\/td>/g));
 assert.deepEqual(rows.filter(m=>m[1].includes('is-relegation-standing')).map(m=>Number(m[2])).sort((a,b)=>a-b),[18,19,20]);
 assert.deepEqual(rows.filter(m=>m[1].includes('relegation-boundary')).map(m=>Number(m[2])),[18]);
};
check();buttons[1].onclick();check();buttons[2].onclick();buttons[2].onclick();check();
fantasy.reverse();const html=api.fullStandingsRowsHtml();assert.ok(/relegation-boundary">\s*<td>10<\/td>/.test(html));
console.log('OK: Serie A ultime tre, linea prima del 18°, fantasy ultima da C in su, nessuna retrocessione amatoriale e posizioni reali dopo ordinamento.');
