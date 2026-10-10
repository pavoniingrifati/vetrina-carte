(() => {
  'use strict';

  function createSaveManager(options={}){
    const env=options.env||window;
    const encode=options.encode||String;
    const onError=typeof options.onError==='function'?options.onError:()=>{};
    const onWarning=typeof options.onWarning==='function'?options.onWarning:(...args)=>console.warn(...args);
    // Accessing browser storage properties can itself throw SecurityError.
    let storageAccessError=null;
    function capability(option,name){
      try{ return Object.hasOwn(options,option)?options[option]:env[name]; }
      catch(error){
        if(name==='localStorage') storageAccessError=error;
        onWarning(`Accesso a ${name} non disponibile`,error);
        return null;
      }
    }
    const indexedDb=capability('indexedDB','indexedDB');
    const storage=capability('storage','localStorage');
    const configuredTimeout=Number(options.timeoutMs);
    const timeoutMs=Number.isFinite(configuredTimeout)&&configuredTimeout>0?configuredTimeout:2500;
    function timeoutError(message){
      const error=new Error(message);
      error.name='TimeoutError';
      return error;
    }
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
        let settled=false;
        const timer=setTimeout(()=>finish(null,timeoutError('Apertura IndexedDB scaduta')),timeoutMs);
        function finish(db,error){
          if(settled) return;
          settled=true;
          clearTimeout(timer);
          if(error) reject(error); else resolve(db);
        }
        if(!indexedDb?.open) return finish(null,new Error('IndexedDB non disponibile'));
        let request;
        try{ request=indexedDb.open(dbName,dbVersion); }
        catch(error){ finish(null,error); return; }
        request.onupgradeneeded=()=>{
          if(settled){ try{ request.transaction?.abort(); }catch{} return; }
          try{
            const db=request.result;
            if(!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName,{keyPath:'id'});
          }catch(error){
            finish(null,error);
            try{ request.transaction?.abort(); }catch{}
          }
        };
        request.onsuccess=()=>{
          const db=request.result;
          if(settled){ try{ db.close(); }catch{} return; }
          db.onversionchange=()=>{
            backend='legacy';
            db.close();
            onWarning('Database aggiornato in un’altra scheda: uso del salvataggio alternativo.');
          };
          finish(db);
        };
        request.onerror=()=>finish(null,request.error||new Error('Apertura IndexedDB non riuscita'));
        request.onblocked=()=>finish(null,new Error('IndexedDB bloccato da un’altra scheda/versione del gioco.'));
      }).catch(error=>{
        backend='legacy';
        onWarning('IndexedDB non disponibile: fallback localStorage.',error);
        return null;
      });
      return dbPromise;
    }

    function runTransaction(db,mode,work){
      return new Promise((resolve,reject)=>{
        let transaction,settled=false,result=true;
        const timer=setTimeout(()=>finish(timeoutError('Operazione IndexedDB scaduta')),timeoutMs);
        function finish(error){
          if(settled) return;
          settled=true;
          clearTimeout(timer);
          if(error){
            try{ transaction?.abort(); }catch{}
            reject(error);
          }else resolve(result);
        }
        try{
          transaction=db.transaction(storeName,mode);
          transaction.oncomplete=()=>finish();
          transaction.onerror=()=>finish(transaction.error||new Error('Operazione IndexedDB non riuscita'));
          transaction.onabort=()=>finish(transaction.error||new Error('Operazione IndexedDB annullata'));
          const request=work(transaction.objectStore(storeName));
          if(request){
            result=undefined;
            request.onsuccess=()=>{ if(!settled) result=request.result; };
            request.onerror=()=>finish(request.error||new Error('Lettura IndexedDB non riuscita'));
          }
        }catch(error){ finish(error); }
      });
    }

    async function getRecord(id){
      const db=await open();
      if(!db) return null;
      return runTransaction(db,'readonly',store=>store.get(id));
    }

    function commitRecords(db,records){
      return runTransaction(db,'readwrite',store=>{ records.forEach(record=>store.put(record)); });
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
        if(!storage) throw storageAccessError||new Error('Archivio locale non disponibile');
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
            const repaired=await persist(makeRecord(payload,state.version),true);
            if(repaired) try{ storage.removeItem(legacyKey); }catch{}
            return {state,source:'backup',migrated:false};
          }
        }catch(error){
          backend='legacy';
          onWarning('Lettura IndexedDB non riuscita: fallback localStorage.',error);
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
          if(db) await runTransaction(db,'readwrite',store=>{ store.clear(); });
        }catch(error){ onWarning('Impossibile pulire IndexedDB',error); }
      }
      try{ storage.removeItem(legacyKey); }catch{}
    }

    async function initialize(){
      await open();
      if(backend!=='legacy'){
        try{
          const storageManager=env.navigator?.storage;
          if(typeof storageManager?.persist==='function'){
            const persistent=await new Promise(resolve=>{
              let settled=false;
              const timer=setTimeout(()=>finish(null),timeoutMs);
              function finish(value){
                if(settled) return;
                settled=true;
                clearTimeout(timer);
                resolve(value);
              }
              try{ Promise.resolve(storageManager.persist()).then(finish,()=>finish(null)); }
              catch{ finish(null); }
            });
            return {backend,persistent};
          }
        }catch(error){ onWarning('Richiesta di storage persistente non disponibile',error); }
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
