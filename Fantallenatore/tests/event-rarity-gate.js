'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','app_v302.js'),'utf8');
const extract=(start,end)=>{
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert(a>=0&&b>a,`Sezione assente: ${start}`);
 return source.slice(a,b);
};
const owned=new Set();
const context={Math,shopItemActive:id=>owned.has(id),careerHash:key=>{
 let n=0;for(const ch of key)n=(n*31+ch.charCodeAt(0))>>>0;return Math.max(.00001,(n%99999)/100000);
}};
vm.createContext(context);
vm.runInContext(`
${extract('const FORMATION_CHOICE_RARITY_BY_TEMPLATE =','const FORMATION_CHOICE_TEMPLATES =')}
const FORMATION_CHOICE_TEMPLATES=['boost-vote','boost-goal','boost-grace-moment','malus-card-risk'].map(id=>({id}));
${extract('function formationChoiceRarity(templateId){','function buyShopItem(')}
this.rarity={formationRarityWeights,deterministicFormationTemplateOrder};
`,context);
const ids=()=>context.rarity.deterministicFormationTemplateOrder(1).map(row=>row.template.id);
assert.deepEqual([...ids()].sort(),['boost-vote','malus-card-risk'].sort(),'Senza power-up devono esserci solo carte comuni');
assert.equal(context.rarity.formationRarityWeights().rare,0);
owned.add('special_events');
assert(ids().includes('boost-goal')&&ids().includes('boost-grace-moment'),'Eventi Speciali deve sbloccare le rare e le carte speciali');
assert(context.rarity.formationRarityWeights().epic>0,'Il pool epico deve attivarsi con Eventi Speciali');
let saved=0;
const pending={day:5,triggered:true,resolved:false,options:[{id:'old',rarity:'rare'}]};
const migration={formationRaritiesUnlocked:()=>owned.has('special_events'),
 generateFormationChoiceOptions:()=>[{id:'new',rarity:'common'}],saveState:()=>saved++};
vm.createContext(migration);
vm.runInContext(extract('function sanitizeLockedFormationChoiceEntry(entry,day){','const ADMIN_RULE_RARITY_PROFILES')+'\nthis.sanitize=sanitizeLockedFormationChoiceEntry;',migration);
owned.clear();migration.sanitize(pending,5);
assert.equal(pending.options[0].id,'new','Le carte rare già sorteggiate e ancora da scegliere vanno sostituite');
assert.equal(saved,1);
const past={day:4,triggered:true,resolved:true,options:[{id:'past',rarity:'rare'}]};
migration.sanitize(past,4);
assert.equal(past.options[0].id,'past','Le scelte passate non vanno riscritte');
const oldPurchases={season:{shopPurchases:{rarity_hunter:{id:'rarity_hunter',cost:20,currency:'eur'}}},career:{euros:5,totalSpent:20}};
vm.runInContext(extract('function migrateRarityHunterPurchase(source){','function normalizeSavedState(parsed){')+'\nthis.migrate=migrateRarityHunterPurchase;',migration);
assert.equal(migration.migrate(oldPurchases),true);
assert.equal(oldPurchases.season.shopPurchases.special_events.migratedFrom,'rarity_hunter');
assert(!oldPurchases.season.shopPurchases.rarity_hunter);
assert.equal(migration.migrate(oldPurchases),false,'Migrazione non idempotente');
const both={season:{shopPurchases:{rarity_hunter:{cost:100,currency:'fp'},special_events:{id:'special_events'}}},career:{fantapoints:2,totalFantapointsSpent:110}};
migration.migrate(both);
assert.equal(both.career.fantapoints,102,'Il doppione deve essere rimborsato');
assert.equal(both.career.totalFantapointsSpent,10);
console.log('OK: solo Eventi Speciali sblocca Rare/Epiche; acquisti precedenti convertiti o rimborsati.');
