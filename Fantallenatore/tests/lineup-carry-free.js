'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const window={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/domains/lineup-controller.js'),'utf8'),{window});
const starters=Object.fromEntries(Array.from({length:11},(_,i)=>['s'+i,'p'+i]));
const season={currentMatchday:1,lineups:{}},manager={id:'user'},runtime={ensureSeasonState:()=>season,managerById:()=>manager,lineupDraft:{formation:'4-3-3',starters,bench:['p11'],captainId:'p3'},lineupOutOfRoleEntries:()=>[],normalizeSavedLineup:x=>({...x,bench:x.bench.slice()}),shopItemActive:()=>{throw Error('Subscription queried by free carry');},saveState:()=>{},renderLineupScreen:()=>{},showToast:()=>{}};
const api=window.FantaDomains['lineup-controller'].create(runtime);for(const key of Object.keys(api))if(!(key in runtime))runtime[key]=api[key];
assert.equal(api.assistantCoachCarryEnabled(),false);assert.equal(api.saveAssistantCoachTemplateFromDraft(),true);assert(api.assistantCoachCarryEnabled());const inherited=api.assistantCoachTemplateForDay(2);assert.equal(inherited.captainId,'p3');assert.equal(Object.keys(inherited.starters).length,11);assert.equal(inherited.bench[0],'p11');api.toggleAssistantCoachCarry();assert.equal(api.assistantCoachTemplateForDay(3),null);api.toggleAssistantCoachCarry();assert(api.assistantCoachCarryEnabled());
console.log('OK: save, carry, captain, bench and toggle work without subscription.');
