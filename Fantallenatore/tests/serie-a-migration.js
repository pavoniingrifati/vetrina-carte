'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const app=fs.readFileSync(path.join(__dirname,'../app_v302.js'),'utf8');
const from=app.indexOf('  function migrateCareerDivisionScale(');
const to=app.indexOf('  function normalizeSavedState(',from);
assert(from>=0 && to>from);
const context={};
vm.runInNewContext(app.slice(from,to),context);
for(const [oldDivision,newDivision] of [[3,4],[2,3],[1,2]]){
  const save={career:{division:oldDivision,seasonHistory:[{division:oldDivision,nextDivision:oldDivision}],prizeHistory:[{division:oldDivision}]}};
  context.migrateCareerDivisionScale(save);
  assert.strictEqual(save.career.division,newDivision);
  assert.strictEqual(save.career.seasonHistory[0].division,newDivision);
  assert.strictEqual(save.career.prizeHistory[0].division,newDivision);
  context.migrateCareerDivisionScale(save);
  assert.strictEqual(save.career.division,newDivision,'Migrazione ripetuta');
}
const finalB={career:{division:1},nextSeasonFlow:{currentDivision:1,nextDivision:1,champion:true,promoted:false}};
context.migrateCareerDivisionScale(finalB);
assert.strictEqual(finalB.career.division,2);
assert.strictEqual(finalB.nextSeasonFlow.nextDivision,1);
assert.strictEqual(finalB.nextSeasonFlow.promoted,true);
assert.strictEqual(finalB.nextSeasonFlow.champion,false);
console.log('OK: salvataggi Amatori/C/B e passaggio B→A migrati senza duplicazioni.');
