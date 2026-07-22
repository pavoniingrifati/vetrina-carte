#!/usr/bin/env node
const fs=require('fs');const path=require('path');const vm=require('vm');
const root=path.resolve(__dirname,'..');
async function run(mode){
 const context={console,Set,Promise,Number,String,Array,Object,Math,Error};context.globalThis=context;vm.createContext(context);
 let handlers=fs.readFileSync(path.join(root,'assets/season/event-handlers.js'),'utf8');handlers+='\nglobalThis.SEASON_EVENT_HANDLERS=SEASON_EVENT_HANDLERS;';vm.runInContext(handlers,context);
 context.SEASON_CONFIG={mode,events:{commonCatalog:'data/events/events-common.json',modeCatalog:`data/events/events-${mode}.json`}};
 context.fetchJsonResource=async p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 context.EXCLUDED_AUTO_EVENT_TITLES=new Set();context.EXCLUDED_DECISION_IDS=new Set();
 let source=fs.readFileSync(path.join(root,'assets/season/10-events.js'),'utf8');
 source+='\nglobalThis.__ready=SEASON_EVENTS_READY;globalThis.__snapshot=()=>({auto:AUTO_EVENTS.map(x=>x.id),decisions:DECISIONS.map(x=>x.id),report:SEASON_EVENT_CATALOG_REPORT});';
 vm.runInContext(source,context,{filename:'10-events.js'});await context.__ready;return context.__snapshot();
}
(async()=>{const community=await run('community'),real=await run('real');const report={ok:community.auto.length===5&&community.decisions.length===81&&real.auto.length===4&&real.decisions.length===75,community:{auto:community.auto.length,decisions:community.decisions.length},real:{auto:real.auto.length,decisions:real.decisions.length}};console.log(JSON.stringify(report,null,2));process.exitCode=report.ok?0:1})().catch(error=>{console.error(error);process.exit(1)});
