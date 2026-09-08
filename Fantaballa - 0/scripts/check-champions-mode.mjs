#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const readJson=async p=>JSON.parse(await readFile(resolve(ROOT,p),'utf8'));
const clubs=await readJson('data/champions/club-champions.json');
const configText=await readFile(resolve(ROOT,'assets/season-config-real.js'),'utf8');
const templateText=await readFile(resolve(ROOT,'src/campionato.template.html'),'utf8');
const runtimeText=await readFile(resolve(ROOT,'assets/season/14-runtime.js'),'utf8');
const stateText=await readFile(resolve(ROOT,'assets/season/03-state-and-data.js'),'utf8');
const setupText=await readFile(resolve(ROOT,'assets/season/04-setup-and-draft.js'),'utf8');
const playoffRulesText=await readFile(resolve(ROOT,'assets/season/rules/02-federation-and-playoffs.js'),'utf8');
const championsText=await readFile(resolve(ROOT,'assets/season/06b-champions-league.js'),'utf8');
const championsCss=await readFile(resolve(ROOT,'assets/season/champions.css'),'utf8');
const players=await readJson('data/champions/giocatori-champions.json');
const realClubs=clubs.filter(c=>!c.championsUser), userClub=clubs.find(c=>c.championsUser);
const errors=[]; const ok=(cond,msg)=>{if(!cond)errors.push(msg)};
ok(/champions:\{id:'champions'.*playerCount:970/.test(configText),'config REAL senza variante Champions da 970 giocatori');
ok(templateText.includes('assets/season/champions.css'),'CSS Champions non caricato dal template');
ok(templateText.includes('assets/season/06b-champions-league.js'),'motore Champions non caricato dal template');
ok(templateText.indexOf('assets/season/06b-champions-league.js')<templateText.indexOf('assets/season/rules/02-federation-and-playoffs.js'),'ordine script Champions/playoff non valido');
ok(setupText.includes('data-competition-variant="champions"'),'selettore Champions mancante dal setup Fantacampionato');
ok(runtimeText.includes("state.phase==='champions-knockout'"),'router runtime senza champions-knockout');
ok(runtimeText.includes("SEASON_DATASETS.champions"),'bootstrap senza dataset Champions');
ok(stateText.includes("'champions-knockout'"),'salvataggio/migrazione senza fase champions-knockout');
ok(stateText.includes('next.champions.stage='),'normalizzazione stato Champions mancante');
ok(playoffRulesText.includes('if(isChampionsCompetition()){advanceChampionsAfterLeaguePhase();return;}'),'fine fase campionato non instradata verso Champions');
ok(championsText.includes('id=\"playChampionsLive\"'),'knockout Champions senza pulsante cronaca');
ok(championsText.includes('id=\"playChampionsInstant\"'),'knockout Champions senza pulsante simulazione');
ok(championsText.includes('function championsPlayUserLeg'),'motore knockout senza partita utente dedicata');
ok(championsText.includes('playLiveMatch({commentary:payload.commentary'),'partita Champions non collegata alla telecronaca del campionato');
ok(championsCss.includes('.champions-history-row{color:#10243a'),'storico knockout senza contrasto testo esplicito');
ok(championsCss.includes('.champions-tie-card{color:#10243a'),'tabellone knockout senza contrasto testo esplicito');
ok(realClubs.length===36,`club reali ${realClubs.length}/36`); ok(Boolean(userClub),'club Fantaballa mancante'); ok(players.length===970,`giocatori ${players.length}/970`);
const expected={
 1:['paris','bayern','real-madrid','liverpool','inter','man-city','arsenal','barcelona','atleti'],
 2:['dortmund','roma','sporting','aston-villa','porto','man-utd','club-brugge','real-betis','psv'],
 3:['feyenoord','lille','bodo-glimt','napoli','leipzig','villarreal','fenerbahce','shakhtar','galatasaray'],
 4:['slavia-praha','slovan-bratislava','stuttgart','aek-athens','lask','como','lens','viking','sabah']
};
for(let p=1;p<=4;p++){const ids=realClubs.filter(c=>Number(c.pot)===p).map(c=>String(c.id));ok(JSON.stringify(ids)===JSON.stringify(expected[p]),`fascia ${p} non coincide con la lista UEFA`)}
const ids=new Set(), validPos=new Set(['P','DC','TS','TD','CDC','CC','COC','AS','AD','ATT']);
for(const pl of players){ok(!ids.has(String(pl.id)),`ID duplicato ${pl.id}`);ids.add(String(pl.id));ok(realClubs.some(c=>String(c.id)===String(pl.club)),`${pl.name}: club sconosciuto ${pl.club}`);ok(Number(pl.ovr)>=60&&Number(pl.ovr)<=93,`${pl.name}: OVR ${pl.ovr}`);for(const pos of String(pl.Position||'').split(',').map(x=>x.trim()).filter(Boolean))ok(validPos.has(pos),`${pl.name}: posizione ${pos}`)}
for(const club of realClubs){const roster=players.filter(p=>String(p.club)===String(club.id));ok(roster.length>=14,`${club.name}: rosa ${roster.length}`);ok(roster.some(p=>String(p.Position).split(',').map(x=>x.trim()).includes('P')),`${club.name}: nessun portiere`)}
const clubMap=new Map(clubs.map(c=>[String(c.id),c]));
const context={console,Math,Set,Map,Object,Array,String,Number,Boolean,Error,JSON,state:{competitionVariant:'champions',champions:{}},CLUBS:clubs,normalizeCompetitionVariant:v=>String(v||'serie-a'),clubById:id=>clubMap.get(String(id)),USER_ID:'fantaballa-real-xi'};
context.globalThis=context;vm.createContext(context);vm.runInContext(await readFile(resolve(ROOT,'assets/season/06b-champions-league.js'),'utf8'),context,{filename:'06b-champions-league.js'});
const STRESS_RUNS=25;
let qualityFailures=0;
for(let run=0;run<STRESS_RUNS;run++){
 const removed=realClubs.filter(c=>Number(c.pot)===4)[run%9];
 const tournament=[{id:'fantaballa-real-xi',clubId:userClub.id,name:'Fantaballa',pot:4},...realClubs.filter(c=>c!==removed).map(c=>({id:String(c.id),clubId:String(c.id),name:c.name}))];
 const rounds=context.generateChampionsLeagueSchedule(tournament),drawErrors=context.championsValidateSchedule(rounds,tournament);if(drawErrors.length)errors.push(`sorteggio ${run+1}: ${drawErrors[0]}`);
 const quality=context.championsScheduleQuality(rounds,tournament);if(quality>0)qualityFailures++;
}
// Il vincolo di sequenza casa/trasferta è "in principio" e può essere derogato da UEFA: lo monitoriamo senza bloccare un sorteggio altrimenti valido.
const qualityNote=`${qualityFailures}/${STRESS_RUNS} calendari richiederebbero una deroga sulla sequenza casa/trasferta`;
// Bracket mapping and inherited seeding.
const tournamentForTable=[{id:'fantaballa-real-xi',name:'Fantaballa'},...realClubs.slice(0,35).map(c=>({id:c.id,name:c.name}))];
const table=tournamentForTable.map((t,i)=>({id:String(t.id),name:t.name,p:8,w:0,d:0,l:0,gf:0,ga:0,pts:100-i}));
context.state.champions={leagueTable:table};context.state.standings=Object.fromEntries(table.map(r=>[r.id,{...r}]));
const rankMap=Object.fromEntries(table.map((r,i)=>[r.id,i+1]));
const playoff=context.championsBuildPlayoffTies(table);ok(playoff.length===8,`playoff tie ${playoff.length}/8`);
const allowed=[[9,10,23,24],[11,12,21,22],[13,14,19,20],[15,16,17,18]];
for(let i=0;i<playoff.length;i++){const t=playoff[i],ra=rankMap[t.teamAId],rb=rankMap[t.teamBId],g=Math.floor(i/2),group=allowed[g];ok(group.slice(0,2).includes(ra)&&group.slice(2).includes(rb),`playoff slot ${i}: ${ra} vs ${rb}`);ok(t.secondLegHomeId===t.teamAId,`playoff slot ${i}: ritorno non alla testa di serie`)}
const playoffResults=playoff.map(t=>({...t,winnerId:t.teamBId}));
const r16=context.championsBuildRoundOf16Ties(table,playoffResults);ok(r16.length===8,`ottavi ${r16.length}/8`);
const expectedSeedPairs=[[5,6],[3,4],[7,8],[1,2],[5,6],[3,4],[7,8],[1,2]];
for(let i=0;i<r16.length;i++){const t=r16[i],seedRank=rankMap[t.teamAId];ok(expectedSeedPairs[i].includes(seedRank),`ottavo slot ${i}: seed ${seedRank}`);ok(t.secondLegHomeId===t.teamAId,`ottavo slot ${i}: ritorno non alla Top 8`);ok(t.pathRank===seedRank,`ottavo slot ${i}: pathRank ${t.pathRank}/${seedRank}`)}
const r16Results=r16.map(t=>({...t,winnerId:t.teamBId}));
const qf=context.championsBuildBracketTies(r16Results,'quarter');ok(qf.length===4,`quarti ${qf.length}/4`);ok(qf.every(t=>t.pathRank<=4),`quarti senza percorso Top 4`);
const qfResults=qf.map(t=>({...t,winnerId:t.teamBId}));
const sf=context.championsBuildBracketTies(qfResults,'semi');ok(sf.length===2,`semifinali ${sf.length}/2`);ok(sf.every(t=>t.pathRank<=2),`semifinali senza percorso Top 2`);
const sfResults=sf.map(t=>({...t,winnerId:t.teamBId}));const final=context.championsBuildBracketTies(sfResults,'final');ok(final.length===1&&final[0].single,`finale non singola`);

// User knockout flow: andata -> ritorno -> tie completato.
Object.assign(context,{
 teamById:id=>({id:String(id),name:String(id)==='fantaballa-real-xi'?'Fantaballa':'Avversario',clubId:String(id)}),
 matchPower:()=>82,opponentMatchPower:()=>79,
 simulateScore:(a,b,adv,duration)=>Number(duration)===30?[1,0]:[1,1],
 simulatePenaltyShootout:()=>({scoreA:5,scoreB:4}),
 teamMatchLineup:team=>[{playerId:`p-${team.id}`,player:{id:`p-${team.id}`,name:`P ${team.id}`,ovr:80,Position:'ATT'},slot:'ATT'}],
 buildTeamGoals:(total,lineup,team)=>Array.from({length:Number(total)||0},(_,i)=>({minute:20+i*10,playerId:lineup[0].playerId,player:lineup[0].player.name,assistId:'',assist:'',teamId:String(team.id),goalValue:1,description:'Gol'})),
 buildMatchCommentary:()=>[],recordLeagueMatchPlayerStats:()=>({}),save:()=>{},render:()=>{}
});
const userFlowTie={...context.championsTie('fantaballa-real-xi',realClubs[0].id,{stage:'round16',rankMap:{'fantaballa-real-xi':2,[realClubs[0].id]:18},secondLegHomeId:'fantaballa-real-xi'}),status:'pending'};
const firstLeg=context.championsNextUserLeg(userFlowTie);ok(firstLeg?.legIndex===0&&firstLeg.homeId===String(realClubs[0].id),'knockout utente: andata non costruita correttamente');
const firstPayload=context.championsDetailedUserLeg(userFlowTie,firstLeg);context.championsCommitUserLeg(userFlowTie,firstPayload);ok(userFlowTie.status==='in-progress'&&Boolean(userFlowTie.result?.leg1),'knockout utente: andata non salvata');
const secondLeg=context.championsNextUserLeg(userFlowTie);ok(secondLeg?.legIndex===1&&secondLeg.homeId==='fantaballa-real-xi','knockout utente: ritorno non costruito correttamente');
const secondPayload=context.championsDetailedUserLeg(userFlowTie,secondLeg);context.championsCommitUserLeg(userFlowTie,secondPayload);ok(userFlowTie.status==='completed'&&Boolean(userFlowTie.result?.leg2)&&Boolean(userFlowTie.winnerId),'knockout utente: ritorno/tie non completato');

if(errors.length){console.error(`CHAMPIONS CHECK: ${errors.length} ERRORE/I`);errors.slice(0,40).forEach(e=>console.error(' - '+e));process.exit(1)}
console.log('CHAMPIONS CHECK: OK');console.log(` - 36 club UEFA + Fantaballa (37 record DB)`);console.log(` - 970 giocatori validati`);console.log(` - 4 fasce UEFA da 9 validate`);console.log(` - ${STRESS_RUNS} sorteggi completi: 8 giornate, 18 partite/giornata, vincoli UEFA obbligatori OK`);console.log(` - qualità calendario: ${qualityNote}`);console.log(` - playoff/ottavi/quarti/semifinali/finale e seeding ereditato OK`);
console.log(` - partite utente knockout: andata/ritorno, cronaca e simulazione collegate OK`);
console.log(` - contrasto tabellone/storico knockout verificato`);
