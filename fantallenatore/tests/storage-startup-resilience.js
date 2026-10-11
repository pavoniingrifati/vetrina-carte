'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({window:{},console,Blob,setTimeout,clearTimeout});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/save-manager.js'),'utf8'),context);
const create=context.window.FantaSaveManager.createSaveManager;
const parsePayload=raw=>raw?JSON.parse(raw):null,serializeState=JSON.stringify;
const load=manager=>manager.load({parsePayload,serializeState});
const next=()=>new Promise(resolve=>setImmediate(resolve));
const security=()=>Object.assign(new Error('Dati locali bloccati'),{name:'SecurityError'});
function legacy(){const values=new Map([['save','{"version":24,"day":7}']]);return {values,getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
function options(extra={}){return {env:{},legacyKey:'save',timeoutMs:20,onWarning:()=>{},...extra};}
function dbAdapter({hangRead=false,hangWrite=false}={}){
 const records=new Map([['current',{payload:'{"version":24,"day":9}'}]]),transactions=[];
 const db={closed:false,objectStoreNames:{contains:()=>true},close(){this.closed=true;},transaction(_,mode){
  const tx={aborted:false,abort(){this.aborted=true;this.onabort?.();}};transactions.push(tx);
  tx.objectStore=()=>({get(id){const request={};if(!hangRead)setImmediate(()=>{request.result=records.get(id);request.onsuccess?.();tx.oncomplete?.();});return request;},put(){if(!hangWrite)setImmediate(()=>tx.oncomplete?.());},clear(){if(!hangWrite)setImmediate(()=>tx.oncomplete?.());}});
  return tx;
 }};
 return {records,transactions,db,open(){const request={};setImmediate(()=>{request.result=db;request.onsuccess?.();});return request;}};
}
(async()=>{
 // Property access can throw before open() is even reached.
 const denied={};for(const key of ['indexedDB','localStorage'])Object.defineProperty(denied,key,{get(){throw security();}});
 const errors=[];let manager=create(options({env:denied,onError:error=>errors.push(error)}));
 assert.equal((await manager.initialize()).backend,'legacy');assert.equal((await load(manager)).state,null);
 manager.queue(manager.makeRecord('{"day":1}',24));assert.equal(await manager.flush(),false);assert.equal(errors[0].name,'SecurityError');
 const storage=legacy();manager=create(options({env:denied,storage}));assert.equal((await load(manager)).state.day,7);assert(storage.values.has('save'));
 const healthy=dbAdapter();manager=create(options({env:denied,indexedDB:healthy}));assert.equal((await load(manager)).state.day,9,'Blocked localStorage must not disable healthy IndexedDB');
 // A blocked open falls back immediately; late upgrade/success cannot revive it.
 let request;let aborted=0,closed=0;
 const blocked={open(){request={};setImmediate(()=>request.onblocked?.());return request;}};
 manager=create(options({indexedDB:blocked,storage}));assert.equal((await load(manager)).state.day,7);assert.equal(manager.backend,'legacy');
 request.transaction={abort(){aborted++;}};request.onupgradeneeded();assert.equal(aborted,1);
 request.result={close(){closed++;}};request.onsuccess();assert.equal(closed,1);assert.equal(manager.backend,'legacy');assert(storage.values.has('save'));
 // An opening that emits no event is also bounded and closes a late connection.
 manager=create(options({indexedDB:{open(){request={};return request;}},storage}));assert.equal((await load(manager)).state.day,7);
 request.result={close(){closed++;}};request.onsuccess();assert.equal(closed,2);
 // Reads must wait for transaction completion, and stalled reads abort cleanly.
 const read=dbAdapter({hangRead:true});manager=create(options({indexedDB:read,storage}));assert.equal((await load(manager)).state.day,7);assert.equal(manager.backend,'legacy');assert(read.transactions[0].aborted);assert(storage.values.has('save'));assert.equal(JSON.parse(read.records.get('current').payload).day,9);
 // Failed writes report failure and cannot leave flush() or clear() pending forever.
 const writes=dbAdapter({hangWrite:true}),writeErrors=[];manager=create(options({indexedDB:writes,storage:legacy(),onError:e=>writeErrors.push(e)}));
 manager.queue(manager.makeRecord('{"day":10}',24));assert.equal(await manager.flush(),false);assert.equal(writeErrors[0].name,'TimeoutError');assert(writes.transactions.at(-1).aborted);assert.equal(JSON.parse(writes.records.get('current').payload).day,9);
 await manager.clear();assert(writes.transactions.at(-1).aborted);
 // Recovering a backup must not delete the legacy copy if its repair write fails.
 const backup=dbAdapter({hangWrite:true}),backupStorage=legacy();
 backup.records.set('current',{payload:'corrotto'});backup.records.set('backup',{payload:'{"version":24,"day":8}'});
 manager=create(options({indexedDB:backup,storage:backupStorage}));
 const recovered=await manager.load({parsePayload:raw=>{try{return parsePayload(raw);}catch{return null;}},serializeState});
 assert.equal(recovered.source,'backup');assert.equal(recovered.state.day,8);assert(backupStorage.values.has('save'),'Failed backup repair removed an existing legacy copy');
 // Persistence permission is optional and bounded, with independent save loading.
 const permission=dbAdapter();let initialized=false;
 manager=create(options({indexedDB:permission,storage:legacy(),timeoutMs:100,env:{navigator:{storage:{persist:()=>new Promise(()=>{})}}}}));
 const initialization=manager.initialize().then(info=>{initialized=true;return info;});
 assert.equal((await load(manager)).state.day,9);assert.equal(initialized,false);assert.equal((await initialization).persistent,null);
 const navigatorDenied={};Object.defineProperty(navigatorDenied,'navigator',{get(){throw security();}});
 manager=create(options({indexedDB:dbAdapter(),storage:legacy(),env:navigatorDenied}));assert.equal((await manager.initialize()).persistent,null);assert.equal((await load(manager)).state.day,9);
 // An upgrade exception is handled rather than escaping the event callback.
 const upgrade={open(){const r={transaction:{abort(){aborted++;}},result:{objectStoreNames:{contains:()=>false},createObjectStore(){throw security();}}};setImmediate(()=>r.onupgradeneeded());return r;}};
 manager=create(options({indexedDB:upgrade,storage:legacy()}));assert.equal((await manager.initialize()).backend,'legacy');assert.equal((await load(manager)).state.day,7);
 await next();
 console.log('OK: blocked storage getters, blocked/hung opens, late connections, upgrade errors, read/write/clear timeouts and optional permission; existing saves retained on failed reads/writes.');
})().catch(error=>{console.error(error);process.exitCode=1;});
