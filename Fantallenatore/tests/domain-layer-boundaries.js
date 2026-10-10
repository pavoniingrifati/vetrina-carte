'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'js/domains/manifest.json'),'utf8'));
const domainNames=['auction-policy','auction-analysis-policy','football-engine','auction-state','player-season-state','league-state','economy-state','social-state','expert-policy','lineup-evaluation','assistant-evaluation','matchday-policy','live-state','season-state','career-state','football-selection','cpu-lineup-evaluation'];

function assertBoundaries(entries){
  const modules=new Map(entries.map(entry=>[entry.name,entry]));
  const owners=new Map();
  for(const entry of entries){
    assert(['domain','application'].includes(entry.layer),'Layer required: '+entry.name);
    for(const name of entry.functions){assert(!owners.has(name),'Duplicate owner: '+name);owners.set(name,entry);}
  }
  for(const name of domainNames)assert.equal(modules.get(name)?.layer,'domain','Protected domain: '+name);
  const visiting=new Set(),visited=new Set();
  function visit(entry){
    assert(!visiting.has(entry.name),'Domain cycle: '+entry.name);
    if(visited.has(entry.name))return;
    visiting.add(entry.name);
    for(const dependency of entry.dependencies){
      const owner=owners.get(dependency);
      if(!owner)continue; // State, constants, pure utilities and the explicit change notification port.
      assert.notEqual(owner.name,entry.name,'Local collaborator must not pass through the shell: '+dependency);
      assert.equal(owner.layer,'domain','Domain depends on application: '+entry.name+' -> '+owner.name);
      visit(owner);
    }
    visiting.delete(entry.name);visited.add(entry.name);
  }
  for(const entry of entries)if(entry.layer==='domain')visit(entry);
}

assertBoundaries(manifest);
// Prove the guard rejects both kinds of architectural regression.
const invalidDependency=structuredClone(manifest);
invalidDependency.find(entry=>entry.name==='football-engine').dependencies.push('renderAll');
assert.throws(()=>assertBoundaries(invalidDependency),/Domain depends on application/);
const invalidCycle=structuredClone(manifest);
invalidCycle.find(entry=>entry.name==='player-season-state').dependencies.push('buildSerieADay');
assert.throws(()=>assertBoundaries(invalidCycle),/Domain cycle/);

const context=vm.createContext({window:{},console});
for(const entry of manifest.filter(entry=>entry.layer==='domain')){
  const source=fs.readFileSync(path.join(root,entry.file),'utf8');
  const dependencies=[...new Set([...source.matchAll(/\$runtime\.([\w$]+)/g)].map(match=>match[1]))].sort();
  assert.deepEqual(dependencies,entry.dependencies,'Dependency contract: '+entry.name);
  assert(!/\b(document|localStorage|indexedDB|setTimeout|setInterval)\b/.test(source),'Domain owns a browser side effect: '+entry.name);
  assert(!/\$runtime\.(saveState|showToast|render\w+)\b/.test(source),'Domain knows application behavior: '+entry.name);
  vm.runInContext(source,context,{filename:entry.file});
  const api=context.window.FantaDomains[entry.name].create(new Proxy({}, {get(){throw Error('Premature dependency read');}}));
  assert.deepEqual(Object.keys(api),entry.functions,'Public API ownership: '+entry.name);
}

// The models work with injected state and no DOM, and follow state replacement on resume.
let state={career:{division:4},managers:[{id:'user',team:'First'}],season:{started:true,playerOvrDevelopment:{p:{delta:2}}}};
const runtime={get state(){return state;},clamp:(value,min,max)=>Math.max(min,Math.min(max,value))};
const career=context.window.FantaDomains['career-state'].create(runtime);
const players=context.window.FantaDomains['player-season-state'].create(runtime);
assert.equal(career.managerById('user').team,'First');
assert.equal(players.currentPlayerOvr({id:'p',ovr:80}),82);
state={managers:[{id:'user',team:'Restored'}],season:{started:true,playerOvrDevelopment:{p:{delta:-1}}}};
assert.equal(career.managerById('user').team,'Restored');
assert.equal(players.currentPlayerOvr({id:'p',ovr:80}),79);
console.log('OK: 17 domain services form an acyclic graph, never depend on application controllers, construct lazily and follow restored state without a DOM.');
