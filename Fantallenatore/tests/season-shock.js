'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const app=fs.readFileSync(path.join(__dirname,'../app_v302.js'),'utf8');
const chanceSource=app.slice(app.indexOf('  function seasonShockChance('),app.indexOf('  function formationChoiceRarity('));
const chanceContext={state:{career:{division:4}},GAME_CONFIG:{startingDivision:4},Math};
vm.runInNewContext(chanceSource,chanceContext);
assert.strictEqual(chanceContext.seasonShockChance(),0);
chanceContext.state.career.seasonNumber=5;
assert.strictEqual(chanceContext.seasonShockChance(),0,'Maledizione in Amatori dopo più stagioni');
chanceContext.state.career.division=3;
assert.strictEqual(chanceContext.seasonShockChance(),.05);
chanceContext.state.career.division=2;
assert.strictEqual(chanceContext.seasonShockChance(),.07);
chanceContext.state.career.division=1;
assert.strictEqual(chanceContext.seasonShockChance(),.09);
const start=app.indexOf('  function resolveSeasonShock(');
const end=app.indexOf('  function openNextSeasonEvent(',start);
assert(start>0 && end>start);
for(const kind of ['cruciate','neutral']){
  const player={id:'p1',name:'Mario Rossi'};
  const entry={day:9,seasonShock:true,resolved:false,options:[{id:'chosen',kind}]};
  const season={currentMatchday:9,formationChoices:{9:entry},playerStatus:{}};
  let saved=0,forced=false;
  const ctx={ensureSeasonState:()=>season,managerById:()=>({roster:[player]}),
    playerStatusForDay:()=>({unavailable:false}),hashPick:list=>list[0],
    state:{career:{seasonNumber:2}},ensurePlayerSeasonSystems:()=>{},
    FANTASY_SEASON_MATCHDAYS:38,
    syncFlowAfterPreMatchResolution:(_season,_day,options)=>{forced=options.forceLineup},
    saveState:()=>{saved++},Date};
  vm.runInNewContext(app.slice(start,end),ctx);
  ctx.resolveSeasonShock('chosen');
  assert.strictEqual(entry.resolved,true);
  assert.strictEqual(saved,1);
  if(kind==='cruciate'){
    assert.strictEqual(season.playerStatus.p1.injuryUntil,38);
    assert(entry.selectedOption.text.includes('Mario Rossi'));
    assert.strictEqual(forced,true);
  }else{
    assert.strictEqual(season.playerStatus.p1,undefined);
    assert.strictEqual(forced,false);
  }
  ctx.resolveSeasonShock('chosen');
  assert.strictEqual(saved,1,'Una carta non può applicarsi due volte');
}
console.log('OK: carta stagionale, indisponibilità e scelta neutra persistenti.');
