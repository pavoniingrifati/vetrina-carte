'use strict';
const assert=require('node:assert/strict'),{createRuntime}=require('./helpers/season-runtime');
const api=createRuntime('risk-injury'),state=api.getState();let injured=0,safe=0;
for(let day=1;day<=8;day++){
 state.season.currentMatchday=day;
 const baseline=api.rawDay(day),original=[...baseline.perfMap.values()].find(p=>p.starter&&p.entryMinute<=1);
 const player=api.players().find(p=>String(p.id)===String(original.playerId));
 const card=api.riskTemplate(day,player);assert.equal(card.category,'risk');assert.equal(card.rarity,'rare');assert.equal(card.effect.injuryChance,.5);
 state.season.formationChoices[String(day)]={triggered:true,resolved:true,selectedOption:card};
 const built=api.rawDay(day),perf=built.perfMap.get(original.playerId);assert.equal(perf.baseVote,original.baseVote+1);assert.equal(perf.startingVoteBonus,1);
 const injuries=built.events.filter(e=>e.type==='injury'&&String(e.playerId)===String(player.id));assert(injuries.length<=1);
 if(injuries.length){injured++;assert(injuries[0].minute>=2&&injuries[0].minute<=89);}else safe++;
 const repeated=api.rawDay(day);assert.deepEqual(repeated.events.filter(e=>e.type==='injury'&&String(e.playerId)===String(player.id)),injuries,'Reload non cambia esito');
 delete state.season.formationChoices[String(day)];assert.equal(api.rawDay(day).perfMap.get(original.playerId).baseVote,original.baseVote);
}
assert(injured>0&&safe>0);console.log('OK: scommessa rara, +1 reale e temporaneo, infortuni e casi salvi, esito deterministico senza duplicati.');
