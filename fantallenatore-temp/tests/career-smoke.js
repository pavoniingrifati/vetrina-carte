const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
const ctx={window:{},console,TextEncoder,TextDecoder,Uint8Array};vm.createContext(ctx);
for(const file of ['data_v302.js','js/season-engine.js','js/transfer-engine.js','js/auction-engine.js','js/save-codec.js']) vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
const E=ctx.window.FantaSeasonEngine,T=ctx.window.FantaTransferEngine,A=ctx.window.FantaAuctionEngine;
const players=ctx.window.FANTA_PLAYERS,clubs=ctx.window.FANTA_CLUBS;
assert(players.length>=500&&clubs.length===20);
const roleLimits={P:3,D:8,C:8,A:6};
function completeRosters(){
 const managers=Array.from({length:10},(_,i)=>({id:i?'cpu'+i:'user',budget:500,roster:[]}));
 const auction={managers,availableIds:players.map(player=>player.id)};
 for(const manager of managers) for(const [role,limit] of Object.entries(roleLimits)){
  let assigned=0;
  for(const player of players){
   if(assigned===limit) break;
   if(player.role!==role || !auction.availableIds.includes(player.id)) continue;
   const award=A.awardPlayer(auction,player,manager.id,1,{roleLimits,totalSlots:25});
   if(award.ok) assigned++;
  }
  assert.strictEqual(assigned,limit,`Rosa incompleta: ${manager.id} ${role}`);
 }
 assert.strictEqual(auction.stats.purchases,250);
 assert.strictEqual(new Set(managers.flatMap(m=>m.roster.map(p=>p.id))).size,250);
 for(const manager of managers){assert.strictEqual(manager.roster.length,25);assert.strictEqual(manager.budget,475)}
 return managers;
}
let managers=completeRosters();
let world=T.createMarketState('smoke-carriera');
for(let season=1;season<=4;season++){
 const rounds=E.buildFantasySeasonSchedule(managers,38,[],key=>{let h=2166136261;for(let i=0;i<key.length;i++)h=Math.imul(h^key.charCodeAt(i),16777619);return (h>>>0)/4294967296});
 const standings=E.freshStandings(managers);const keys=new Set();
 assert.strictEqual(rounds.length,38);
 for(let day=1;day<=38;day++){
  const round=rounds[day-1],seen=new Set();assert.strictEqual(round.matches.length,5);
  for(const match of round.matches){assert(!seen.has(match.homeId)&&!seen.has(match.awayId));seen.add(match.homeId);seen.add(match.awayId);
   const n=(day*17+String(match.homeId).length*13+String(match.awayId).length*7)%7;
   assert(E.applyFantasyMatch(standings,{...match,homeScore:n%4,awayScore:Math.floor(n/2),homeFantasy:60+n,awayFantasy:59+n}));}
  assert.strictEqual(seen.size,10);keys.add(day);
  if(day===19){const plan=T.planWindow({windowType:'winter',seed:`smoke-S${season}-winter`,players,clubs,externalPool:world.foreignPool});world=T.applyPlan(world,plan);assert.strictEqual(world.windows.filter(w=>w.id===plan.id).length,1);world=T.applyPlan(world,plan);assert.strictEqual(world.windows.filter(w=>w.id===plan.id).length,1);console.log(`S${season} giorno 19: mercato inverno ${plan.counts.total} operazioni, registrazione idempotente`);}
 }
 assert.strictEqual(keys.size,38);for(const row of standings){assert.strictEqual(row.played,38);assert.strictEqual(row.wins+row.draws+row.losses,38);assert(row.fantasyPoints>0)}
 const summer=T.planWindow({windowType:'summer',seed:`smoke-S${season}-summer`,players,clubs,externalPool:world.foreignPool});world=T.applyPlan(world,summer);
 const checkpoint={version:24,career:{seasonNumber:season,division:Math.max(1,5-season),divisionScaleVersion:2},managers,transferMarket:world,standings,season:{completed:true,lastCompletedMatchday:38}};
 const serialized=ctx.window.FantaSaveCodec.encode(JSON.stringify(checkpoint));
 assert(serialized.startsWith(ctx.window.FantaSaveCodec.PREFIX),'Il salvataggio di prova deve usare la compressione reale');
 const restored=JSON.parse(ctx.window.FantaSaveCodec.decode(serialized));
 assert.strictEqual(restored.career.division,Math.max(1,5-season));
 assert.strictEqual(restored.transferMarket.windows.length,Math.min(4,season*2),'Archivio dettagli mercato non limitato');
 assert.strictEqual(restored.transferMarket.appliedWindowIds.length,season*2,'Identificativi dei mercati applicati persi');
 assert.strictEqual(JSON.stringify(T.materializeWorldPlayers(players,world)),JSON.stringify(T.materializeWorldPlayers(players,restored.transferMarket)),'Mondo alterato dal ripristino');
 assert.strictEqual(restored.standings.find(row=>row.managerId==='user').played,38);
 assert.strictEqual(restored.managers.length,10);
 world=restored.transferMarket;managers=restored.managers;
 console.log(`S${season}: 38 giornate, 190 partite, mercato estivo ${summer.counts.total} operazioni; salvataggio e ripristino ${Math.round(serialized.length/1024)} KB`);
 if(season<4) managers=completeRosters();
}
assert.strictEqual(world.windows.length,4);assert.strictEqual(world.appliedWindowIds.length,8);console.log('OK: quattro aste sintetiche da 250 acquisti, quattro stagioni, quattro mercati invernali e quattro estivi.');
