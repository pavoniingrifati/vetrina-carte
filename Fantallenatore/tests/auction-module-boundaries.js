'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'js/domains/manifest.json')));
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/auction-functions-v256.json')));
const groups=['auction-analysis-policy','auction-views','auction-clock','auction-arcade-controller','auction-feedback','auction-powers-controller','auction-controller'];
const hooks=["    window.FantaPresentationState?.publishAuction($runtime.state,{totalSlots:$runtime.TOTAL_SLOTS,roleLimits:$runtime.ROLE_LIMITS});\n","    window.FantaPresentationState?.publishAuction($runtime.state,{totalSlots:$runtime.TOTAL_SLOTS,roleLimits:$runtime.ROLE_LIMITS,userCanAct});\n"];
const canonical=s=>hooks.reduce((body,hook)=>body.split(hook).join(''),s).replace(/\$runtime\./g,'').trim(),found=new Set(),context=vm.createContext({window:{}});
for(const name of groups){
 const entry=manifest.find(m=>m.name===name);assert(entry,name);
 const source=fs.readFileSync(path.join(root,entry.file),'utf8');new vm.Script(source);vm.runInContext(source,context);
 if(name==='auction-views'){assert.equal(source.split(hooks[0]).length-1,2);assert.equal(source.split(hooks[1]).length-1,1);}
 const matches=[...source.matchAll(/^  function (\w+)\(/gm)].filter(m=>m[1]!=='create');
 const end=source.lastIndexOf('    return Object.freeze({');
 for(let i=0;i<matches.length;i++){
  const match=matches[i],body=source.slice(match.index,i+1<matches.length?matches[i+1].index:end);
  assert(!found.has(match[1]));found.add(match[1]);
  assert.equal(crypto.createHash('sha256').update(canonical(body)).digest('hex'),baseline[match[1]],match[1]+' differs from V256');
 }
 const deps=[...new Set([...source.matchAll(/\$runtime\.([\w$]+)/g)].map(m=>m[1]))].sort();
 assert.deepEqual(deps,entry.dependencies,'Dependency contract '+name);
 assert(!entry.dependencies.some(d=>entry.functions.includes(d)),'Local calls must not route through shell');
 const api=context.window.FantaDomains[name].create(new Proxy({}, {get(){throw Error('Premature runtime read');}}));
 assert.deepEqual(Object.keys(api),entry.functions,'API ownership');
}
assert.deepEqual([...found].sort(),Object.keys(baseline).sort(),'Every V256 function preserved exactly once');
const analysis=manifest.find(m=>m.name==='auction-analysis-policy');assert.deepEqual(analysis.dependencies,['careerHash','clamp','clubMap','state']);
const policySource=fs.readFileSync(path.join(root,analysis.file),'utf8');assert(!/\b(document|localStorage|indexedDB|setTimeout|setInterval)\b/.test(policySource),'Analysis must not own UI, timers or storage');
let state={career:{seasonNumber:1}};const seasons=[];
const policy=context.window.FantaDomains['auction-analysis-policy'].create({get state(){return state;},careerHash(key){seasons.push(key);return .5;},clamp:(v,a,b)=>Math.max(a,Math.min(v,b)),clubMap:new Map()});
policy.playerSeasonPotentialProfile({id:'test'});state={career:{seasonNumber:2}};policy.playerSeasonPotentialProfile({id:'test'});
assert(seasons.some(k=>k.includes('|1|'))&&seasons.some(k=>k.includes('|2|')),'Reads new career state after replacement');
assert(fs.readFileSync(path.join(root,'js/domains/auction-controller.js'),'utf8').split('\n').length<800,'Main auction controller budget');
console.log('OK: 89 V256 function bodies preserved apart from three explicit presentation publications, seven contracts, local calls, lazy wiring and live career state.');
