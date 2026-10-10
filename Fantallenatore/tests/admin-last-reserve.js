const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const s=require('./helpers/production-source').readProductionSource();
const ctx={state:{season:{currentMatchday:1}},adminBlockedStarterForManager:()=> 'top'};
vm.createContext(ctx);vm.runInContext(s.slice(s.indexOf('  function enforceAdminLastReserve('),s.indexOf('  function enforcePlayerBenchedInLineup('))+s.slice(s.indexOf('  function lineupBenchPlayers('),s.indexOf('  function classicDefenseModifierResult(')),ctx);
for(const id of ['user','cpu']){
const lineup={starters:{a:'starter'},bench:['top','reserve']};ctx.enforceAdminLastReserve(lineup,id);assert(lineup.bench.join(',')==='reserve,top');ctx.enforceAdminLastReserve(lineup,id);assert(lineup.bench.length===2);
const manager={id,roster:['starter','top','reserve','missing'].map(id=>({id}))};const bench=ctx.lineupBenchPlayers(manager,{starters:lineup.starters,bench:['top','reserve']});assert(bench.at(-1).id==='top');
}
console.log('OK: ultima riserva obbligatoria per utente e CPU, anche con formazione salvata.');
