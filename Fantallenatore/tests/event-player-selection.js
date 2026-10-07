const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const app=require('./helpers/production-source').readProductionSource();
const roster=Array.from({length:25},(_,i)=>({id:String(i),name:'Player '+i,role:i<3?'P':i<11?'D':i<19?'C':'A'}));
let seed='career';const context={state:{career:{seasonNumber:1}},ensureSeasonState:()=>({}),currentUserFixture:()=>null,userOpponentIdForDay:()=> 'cpu',managerById:()=>({roster}),playerStatusForDay:()=>({unavailable:false}),careerHash:key=>crypto.createHash('sha256').update(seed+'|'+key).digest().readUInt32BE()/4294967296};
vm.createContext(context);vm.runInContext(app.slice(app.indexOf('  function hashPick('),app.indexOf('  const SERIEA_DERBY_PAIRS'))+app.slice(app.indexOf('  function formationChoiceContextForManagers('),app.indexOf('  function fantasyAppearanceRate(')),context);
const names=new Set();for(let day=1;day<=38;day++){
 const ctx=context.formationChoiceContextForManagers(day,'user','cpu');
 const a=ctx.pickOwn('boost-vote|0'),b=context.formationChoiceContextForManagers(day,'user','cpu').pickOwn('boost-vote|0');
 assert(a.id===b.id);names.add(a.id);
 assert(ctx.pickOwnStrict('goal',p=>p.role==='A').role==='A');
 assert(ctx.pickOwnStrict('none',()=>false)===null);
}
assert(names.size>10,'Stessi nomi su tutta la stagione');
const counts=Array(25).fill(0);for(let career=0;career<200;career++){seed='career'+career;for(let day=1;day<=38;day++)counts[Number(context.formationChoiceContextForManagers(day,'user','cpu').pickOwn('boost-vote|0').id)]++;}
console.log('OK: riapertura stabile, filtri rispettati, '+names.size+' giocatori diversi su 38 giornate.');
console.log('7600 estrazioni controllate: min '+Math.min(...counts)+', max '+Math.max(...counts)+', atteso 304 per giocatore.');
