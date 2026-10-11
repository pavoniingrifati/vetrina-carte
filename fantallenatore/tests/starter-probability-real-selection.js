const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/domains/assistant-evaluation.js'),'utf8');
const players=[{id:'first',club:'INT',role:'A',ovr:93},{id:'second',club:'INT',role:'A',ovr:90},{id:'pio',club:'INT',role:'A',ovr:84}];
const selectedDays=[];
const context={window:{FANTA_PLAYERS:players,FantaDomains:{}}};
vm.runInNewContext(source,context);
const runtime={
  ensureSeasonState:()=>({currentMatchday:5,lastCompletedMatchday:4}),
  state:{transferMarket:{worldRevision:1}},
  playerStatusForDay:()=>({unavailable:false}),
  currentPlayerOvr:p=>p.ovr,
  buildSerieAClubSelection:(club,day)=>{selectedDays.push(day);return {starters:players.slice(0,2)};}
};
const {estimatedStarterProbability}=context.window.FantaDomains['assistant-evaluation'].create(runtime);
assert.equal(estimatedStarterProbability(players[2],5),1,'Terzo attaccante di un modulo a due punte non deve risultare titolare al 96%');
assert.equal(estimatedStarterProbability(players[0],5),96);
assert.equal(selectedDays.length,24);
assert.ok(!selectedDays.includes(5),'Non bisogna rivelare la formazione della giornata corrente');
assert.equal(estimatedStarterProbability(players[1],5),96);
assert.equal(selectedDays.length,24,'La cache deve evitare simulazioni duplicate per i compagni');

// Nei simulatori che espongono uno stato parziale, la stima non deve bloccare la CPU.
const fallbackRuntime={...runtime,buildSerieAClubSelection:undefined};
const fallback=context.window.FantaDomains['assistant-evaluation'].create(fallbackRuntime);
assert.ok(fallback.estimatedStarterProbability(players[2],5)<fallback.estimatedStarterProbability(players[0],5));
console.log('Starter forecast: OK');
