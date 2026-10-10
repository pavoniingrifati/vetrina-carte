const assert=require('assert');
const {createRuntime}=require('./helpers/season-runtime');
const api=createRuntime('pack-test');
const base=api.getState();
const make=division=>({...base,marketSeed:'pack-fixed',career:{...base.career,division},managers:base.managers.map(m=>({...m,budget:500,roster:[]})),availableIds:api.players().map(p=>String(p.id)),leagueRules:{packOpening:true},stats:{purchases:0,totalSpent:0},log:[],preAuctionPack:null});
for(const division of [3,2,1]){
 const draft=make(division);assert.strictEqual(api.packApply(draft),true);
 const owned=draft.managers.flatMap(m=>m.roster);assert.strictEqual(owned.length,40);assert.strictEqual(new Set(owned.map(p=>p.id)).size,40);
 for(const m of draft.managers){assert.strictEqual(m.budget,496);assert.deepStrictEqual(m.roster.map(p=>p.role).sort(),['A','C','D','P']);assert(m.roster.every(p=>p.price===1));}
 assert(owned.every(p=>!draft.availableIds.includes(String(p.id))));assert.strictEqual(api.packApply(draft),false);assert.strictEqual(draft.stats.totalSpent,40);
 const reload=JSON.parse(JSON.stringify(draft));assert.strictEqual(api.packApply(reload),false);
 const repeat=make(division);api.packApply(repeat);assert.strictEqual(JSON.stringify(draft.preAuctionPack),JSON.stringify(repeat.preAuctionPack));
}
assert.strictEqual(api.packApply(make(4)),false);
const off=make(3);off.leagueRules.packOpening=false;assert.strictEqual(api.packApply(off),false);
const keeper=make(3),p=api.players().find(p=>p.role==='P');keeper.managers[0].roster.push({...p,price:30});keeper.managers[0].budget=470;keeper.availableIds=keeper.availableIds.filter(id=>id!==String(p.id));api.packApply(keeper);assert.strictEqual(keeper.managers[0].roster.length,5);assert.strictEqual(keeper.managers[0].budget,466);
for(let i=0;i<100;i++){const d=make(4);d.leagueRules={};d.marketSeed=`no-pack-${i}`;assert(!api.packRules(d).selectedCategories.includes('packOpening'));}
console.log('OK: pack allocation, divisions, uniqueness, budgets, keeper, deterministic reload and rule gating.');
