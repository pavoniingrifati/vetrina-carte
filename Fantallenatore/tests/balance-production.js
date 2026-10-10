'use strict';
const assert=require('node:assert/strict');
const {run}=require('../balance_sim');
const first=run({days:2,prefix:'regression-balance'}),second=run({days:2,prefix:'regression-balance'}),other=run({days:2,prefix:'different-balance'});
assert.equal(JSON.stringify(first),JSON.stringify(second),'stesso seed deve riprodurre eventi, voti ed evoluzione');assert.notEqual(JSON.stringify(first.runs[0].rounds),JSON.stringify(other.runs[0].rounds),'seed diverso deve modificare i risultati');
assert.equal(first.engine,'production-app');assert.equal(first.summary.matches,20);assert.equal(first.sourceHashes['app_v302.js'].length,64);
for(const round of first.runs[0].rounds){assert.equal(round.matches.length,10);assert.equal(new Set(round.matches.flatMap(m=>[m.homeClub,m.awayClub])).size,20);for(const perf of round.performances){if(!perf.noVote){assert(Number.isFinite(perf.vote));assert(Number.isFinite(perf.fantasy));}}}
for(const row of first.runs[0].standings)assert.equal(row.played,2);
assert(first.runs[0].playerOvrDevelopment);assert(first.runs[0].playerSeasonStats);
console.log('OK: motore produzione, riproducibilità, variabilità seed, voti finiti e classifica.');
