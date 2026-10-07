'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const app=fs.readFileSync(path.join(__dirname,'..','app_v302.js'),'utf8');
const start=app.indexOf('  let expertStoryState=null;'),end=app.indexOf('  function renderExpertAdvice(){',start);
assert(start>=0&&end>start);
const elements=new Map();
const get=id=>{
  if(!elements.has(id)) elements.set(id,{textContent:'',innerHTML:'',disabled:false,src:'',alt:'',isConnected:true,
    classList:{classes:new Set(['show']),contains(name){return this.classes.has(name)},add(name){this.classes.add(name)},remove(name){this.classes.delete(name)},toggle(name,on){if(on)this.add(name);else this.remove(name)}},
    setAttribute(){},querySelector(){return {focus(){}}},focus(){this.focused=true}});
  return elements.get(id);
};
const context={$:get,state:{career:{seasonNumber:1}},careerHash:()=>.5,escapeHtml:s=>String(s),expertPrecisionActive:()=>false,
  ensureSeasonState:()=>({currentMatchday:2}),playerAvatarMarkup:()=>'<img alt="">',
  expertReasonParagraphs:()=>['Primo motivo','Secondo motivo','Terzo motivo']};
vm.runInNewContext(app.slice(start,end),context);
const trigger={isConnected:true,focus(){this.focused=true}};
context.openExpertReason({name:'Il Professore',tag:'FORMA',avatar:'portrait.webp'}, {name:'Rossi'}, {},null,trigger);
assert.strictEqual(get('expertStoryCounter').textContent,'1 / 3');
assert(get('expertReasonBody').innerHTML.includes('Primo motivo'));
context.changeExpertStoryStep(1);
assert.strictEqual(get('expertStoryCounter').textContent,'2 / 3');
context.changeExpertStoryStep(1);
assert.strictEqual(get('expertStoryNext').textContent,'HO CAPITO ✓');
context.changeExpertStoryStep(1);
assert.strictEqual(get('expertReasonModal').classList.contains('show'),false);
assert.strictEqual(trigger.focused,true);
console.log('OK: la storia scorre in tre passaggi e restituisce il focus alla carta.');
