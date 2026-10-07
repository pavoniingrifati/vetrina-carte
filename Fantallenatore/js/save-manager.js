(() => {
  'use strict';

  function createSaveManager(options={}){
    const env=options.env||window;
    const indexedDb=options.indexedDB||env.indexedDB;
    const storage=options.storage||env.localStorage;
    const encode=options.encode||String;
    const onError=typeof options.onError==='function'?options.onError:()=>{};
    const onWarning=typeof options.onWarning==='function'?options.onWarning:(...args)=>console.warn(...args);
    const legacyKey=options.legacyKey||'fantallenatore_save';
    const dbName=options.dbName||'fantallenatore_db';
    const dbVersion=Number(options.dbVersion||1);
    const storeName=options.storeName||'saves';
    const currentSlot=options.currentSlot||'current';
    const backupSlot=options.backupSlot||'backup';

    let dbPromise=null;
    let backend='indexeddb';
    let pendingRecord=null;
    let workerPromise=null;

    function open(){
      if(dbPromise) return dbPromise;
      dbPromise=new Promise((resolve,reject)=>{
        if(!indexedDb?.open) return reject(new Error('IndexedDB non disponibile'));
        let request;
        try{ request=indexedDb.open(dbName,dbVersion); }
        catch(error){ reject(error); return; }
        request.onupgradeneeded=()=>{
          const db=request.result;
          if(!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName,{keyPath:'id'});
        };
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error||new Error('Apertura IndexedDB non riuscita'));
        request.onblocked=()=>onWarning('IndexedDB bloccato da un’altra scheda/versione del gioco.');
      }).catch(error=>{
        backend='legacy';
        onWarning('IndexedDB non disponibile: fallback localStorage.',error);
        return null;
      });
      return dbPromise;
    }

    function requestResult(request){
      return new Promise((resolve,reject)=>{
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error||new Error('Operazione IndexedDB non riuscita'));
      });
    }

    async function getRecord(id){
      const db=await open();
      if(!db) return null;
      const transaction=db.transaction(storeName,'readonly');
      return requestResult(transaction.objectStore(storeName).get(id));
    }

    function commitRecords(db,records){
      return new Promise((resolve,reject)=>{
        let transaction;
        try{ transaction=db.transaction(storeName,'readwrite'); }
        catch(error){ reject(error); return; }
        const store=transaction.objectStore(storeName);
        records.forEach(record=>store.put(record));
        transaction.oncomplete=()=>resolve(true);
        transaction.onerror=()=>reject(transaction.error||new Error('Scrittura IndexedDB non riuscita'));
        transaction.onabort=()=>reject(transaction.error||new Error('Scrittura IndexedDB annullata'));
      });
    }

    async function writeIndexed(record,skipBackup=false){
      const db=await open();
      if(!db) throw new Error('IndexedDB non disponibile');
      const previous=skipBackup?null:await getRecord(currentSlot);
      if(previous?.payload===record.payload) return true;
      const records=[];
      if(previous?.payload) records.push({...previous,id:backupSlot,backupOf:Number(previous.savedAt||0),savedAt:Date.now()});
      records.push({...record,id:currentSlot});
      return commitRecords(db,records);
    }

    async function persist(record,skipBackup=false){
      if(backend!=='legacy'){
        try{
          await writeIndexed(record,skipBackup);
          return true;
        }catch(error){
          onWarning('Errore IndexedDB durante il salvataggio',error);
          if(backend!=='legacy'){ onError(error); return false; }
        }
      }
      try{
        storage.setItem(legacyKey,encode(record.payload));
        return true;
      }catch(error){
        onError(error);
        return false;
      }
    }

    function startWorker(){
      if(workerPromise||!pendingRecord) return;
      workerPromise=(async()=>{
        let allOk=true;
        while(pendingRecord){
          const next=pendingRecord;
          pendingRecord=null;
          if(!await persist(next,false)) allOk=false;
        }
        return allOk;
      })().finally(()=>{
        workerPromise=null;
        if(pendingRecord) startWorker();
      });
    }

    function queue(record){
      pendingRecord=record;
      startWorker();
      return true;
    }

    async function flush(){
      let ok=true;
      while(workerPromise||pendingRecord){
        if(!workerPromise&&pendingRecord) startWorker();
        if(workerPromise&&await workerPromise===false) ok=false;
      }
      return ok;
    }

    async function load({parsePayload,serializeState}){
      await open();
      if(backend!=='legacy'){
        try{
          const current=await getRecord(currentSlot);
          let state=parsePayload(current?.payload);
          if(state){
            try{ storage.removeItem(legacyKey); }catch{}
            return {state,source:'current',migrated:false};
          }
          const backup=await getRecord(backupSlot);
          state=parsePayload(backup?.payload);
          if(state){
            const payload=serializeState(state);
            await persist(makeRecord(payload,state.version),true);
            try{ storage.removeItem(legacyKey); }catch{}
            return {state,source:'backup',migrated:false};
          }
        }catch(error){
          onWarning('Lettura IndexedDB non riuscita',error);
        }
      }

      let raw=null;
      try{ raw=storage.getItem(legacyKey); }catch{}
      const state=parsePayload(raw);
      if(!state) return {state:null,source:null,migrated:false};
      if(backend!=='legacy'){
        try{
          const payload=serializeState(state);
          const migrated=await persist(makeRecord(payload,state.version),true);
          if(migrated) try{ storage.removeItem(legacyKey); }catch{}
          return {state,source:'legacy',migrated};
        }catch(error){ onWarning('Migrazione save precedente non riuscita',error); }
      }
      return {state,source:'legacy',migrated:false};
    }

    function makeRecord(payload,stateVersion){
      const sizeBytes=typeof Blob==='function'?new Blob([payload]).size:String(payload).length;
      return {id:currentSlot,payload,savedAt:Date.now(),stateVersion:Number(stateVersion||18),sizeBytes};
    }

    async function clear(){
      pendingRecord=null;
      try{ await flush(); }catch{}
      if(backend!=='legacy'){
        try{
          const db=await open();
          if(db) await new Promise((resolve,reject)=>{
            const transaction=db.transaction(storeName,'readwrite');
            transaction.objectStore(storeName).clear();
            transaction.oncomplete=()=>resolve(true);
            transaction.onerror=()=>reject(transaction.error||new Error('Pulizia IndexedDB non riuscita'));
            transaction.onabort=()=>reject(transaction.error||new Error('Pulizia IndexedDB annullata'));
          });
        }catch(error){ onWarning('Impossibile pulire IndexedDB',error); }
      }
      try{ storage.removeItem(legacyKey); }catch{}
    }

    async function initialize(){
      await open();
      if(backend!=='legacy'&&env.navigator?.storage?.persist){
        try{ return {backend,persistent:await env.navigator.storage.persist()}; }
        catch{}
      }
      return {backend,persistent:null};
    }

    return Object.freeze({
      queue,flush,load,clear,initialize,makeRecord,persist,
      get backend(){ return backend; }
    });
  }

  window.FantaSaveManager=Object.freeze({createSaveManager});
})();
