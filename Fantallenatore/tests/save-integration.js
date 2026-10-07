'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Adapter controllabile: verifica il contratto del manager, non il browser IndexedDB.
function database(){
 const records=new Map(); let fail=false;
 const db={objectStoreNames:{contains:()=>true},transaction(_name,mode){
  const tx={},staged=new Map(records);let pending=0,scheduled=false;
  function finish(){if(scheduled)return;scheduled=true;setImmediate(()=>{scheduled=false;if(pending)return finish();if(mode==='readwrite'&&fail){fail=false;tx.error=new Error('quota simulata');tx.onabort?.();return;}if(mode==='readwrite'){records.clear();for(const [k,v] of staged)records.set(k,v);}tx.oncomplete?.();});}
  tx.objectStore=()=>({get(id){const req={};pending++;setImmediate(()=>{req.result=structuredClone(records.get(id));req.onsuccess?.();pending--;finish();});return req;},put(record){staged.set(record.id,structuredClone(record));finish();},clear(){staged.clear();finish();}});return tx;
 }};
 return {records,failNext(){fail=true;},open(){const request={};setImmediate(()=>{request.result=db;request.onsuccess?.();});return request;}};
}
(async()=>{
 const ctx=vm.createContext({window:{},console,Blob,TextEncoder,TextDecoder,btoa,atob});
 for(const name of ['save-codec','save-manager','season-engine'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),ctx);
 const codec=ctx.window.FantaSaveCodec,store=new Map(),storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const errors=[],db=database();const create=()=>ctx.window.FantaSaveManager.createSaveManager({env:{},indexedDB:db,storage,encode:codec.encode,onError:e=>errors.push(e),onWarning:()=>{}});
 const parsePayload=raw=>{try{return JSON.parse(codec.decode(raw));}catch{return null;}},serializeState=JSON.stringify;
 let manager=create();assert.equal((await manager.initialize()).backend,'indexeddb');
 for(let day=1;day<=50;day++)manager.queue(manager.makeRecord(JSON.stringify({version:24,day}),24));
 assert.equal(await manager.flush(),true);assert.equal(JSON.parse(db.records.get('current').payload).day,50);
 manager=create();assert.equal((await manager.load({parsePayload,serializeState})).state.day,50);
 await manager.persist(manager.makeRecord(JSON.stringify({version:24,day:51}),24));
 db.records.get('current').payload='{corrotto';
 const recovered=await manager.load({parsePayload,serializeState});assert.equal(recovered.source,'backup');assert.equal(recovered.state.day,50);assert.equal(JSON.parse(db.records.get('current').payload).day,50);
 const before=JSON.stringify([...db.records]);db.failNext();manager.queue(manager.makeRecord(JSON.stringify({version:24,day:99}),24));assert.equal(await manager.flush(),false);assert.equal(errors.length,1);assert.equal(JSON.stringify([...db.records]),before,'abort deve essere atomico');
 manager.queue(manager.makeRecord(JSON.stringify({version:24,day:100}),24));await manager.clear();assert.equal(db.records.size,0);
 store.set('fantallenatore_save',codec.encode(JSON.stringify({version:24,day:7,team:'Città 🏆'})));
 const migrated=await create().load({parsePayload,serializeState});assert.equal(migrated.migrated,true);assert.equal(migrated.state.team,'Città 🏆');assert.equal(store.size,0);
 // Integra calendario e classifica reali con persistenza/ripresa a metà stagione.
 const engine=ctx.window.FantaSeasonEngine,managers=Array.from({length:10},(_,id)=>({id}));
 let season={version:24,schedule:engine.buildFantasySeasonSchedule(managers,38,[],key=>{let h=0;for(const c of key)h=(h*31+c.charCodeAt(0))>>>0;return h/4294967296;}),standings:engine.freshStandings(managers)};
 assert.equal(season.schedule.length,38);
 for(let day=0;day<38;day++){
  const round=season.schedule[day];assert.equal(new Set(round.matches.flatMap(m=>[m.homeId,m.awayId])).size,10);
  for(const match of round.matches){match.homeScore=2;match.awayScore=1;match.homeFantasy=72;match.awayFantasy=66;assert.equal(engine.applyFantasyMatch(season.standings,match),true);match.played=true;}
  if(day===18){manager.queue(manager.makeRecord(JSON.stringify(season),24));assert.equal(await manager.flush(),true);season=(await create().load({parsePayload,serializeState})).state;}
 }
 assert.equal(season.standings.reduce((n,r)=>n+r.played,0),380);assert.equal(season.standings.reduce((n,r)=>n+r.points,0),570);for(const row of season.standings)assert.equal(row.played,38);
 console.log('OK: coda, ripresa, backup, migrazione, errore atomico, cancellazione e calendario/classifica 38 giornate. Adapter storage; punteggi fixture, nessuna verifica UI o simulazione calcistica.');
})().catch(error=>{console.error(error);process.exitCode=1;});
