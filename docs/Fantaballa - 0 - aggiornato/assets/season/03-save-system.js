/* Fantaballa Season Engine — 03-save-system.js
 * Salvataggi versionati, migrazione, backup, recupero e scrittura verificata.
 * Deve essere caricato dopo 01-bootstrap.js e prima di 03-state-and-data.js.
 */
let lastLoadedSaveInfo={source:'none',legacy:false,recovered:false,envelope:null};

function isoOrFallback(value,fallback){
 const date=new Date(value);return Number.isNaN(date.getTime())?fallback:date.toISOString();
}
function findInvalidNumber(value,path='state',seen=new WeakSet()){
 if(typeof value==='number')return Number.isFinite(value)?'':path;
 if(!value||typeof value!=='object')return '';
 if(seen.has(value))return '';
 seen.add(value);
 if(Array.isArray(value)){
  for(let index=0;index<value.length;index++){const invalid=findInvalidNumber(value[index],`${path}[${index}]`,seen);if(invalid)return invalid}
  return '';
 }
 for(const [key,item] of Object.entries(value)){const invalid=findInvalidNumber(item,`${path}.${key}`,seen);if(invalid)return invalid}
 return '';
}
function validateStateForStorage(candidate,{strict=false}={}){
 const errors=[];
 if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))return{valid:false,errors:['Lo stato non è un oggetto valido.']};
 const invalidNumber=findInvalidNumber(candidate);if(invalidNumber)errors.push(`Valore numerico non valido in ${invalidNumber}.`);
 if(candidate.phase!==undefined&&!['setup','draft','season','midseason','story-final','italia-2006-final','fantaballopoli-final','fantaballopoli-restart','playoffs','finished'].includes(String(candidate.phase)))errors.push(`Fase non valida: ${String(candidate.phase)}.`);
 if(candidate.matchday!==undefined&&!Number.isFinite(Number(candidate.matchday)))errors.push('La giornata non è numerica.');
 if(candidate.draft!==undefined&&(!candidate.draft||typeof candidate.draft!=='object'||!Array.isArray(candidate.draft.roster)))errors.push('La rosa del draft non è valida.');
 if(candidate.schedule!==undefined&&!Array.isArray(candidate.schedule))errors.push('Il calendario non è un array.');
 if(candidate.teams!==undefined&&!Array.isArray(candidate.teams))errors.push('Le squadre non sono un array.');
 if(candidate.history!==undefined&&!Array.isArray(candidate.history))errors.push('Lo storico non è un array.');
 if(candidate.standings!==undefined&&(!candidate.standings||typeof candidate.standings!=='object'||Array.isArray(candidate.standings)))errors.push('La classifica non è valida.');
 if(strict){
  if(!candidate.draft||!Array.isArray(candidate.draft.roster))errors.push('Sezione draft mancante.');
  if(!candidate.seasonRules||typeof candidate.seasonRules!=='object')errors.push('Regole stagione mancanti.');
  if(!candidate.meta||typeof candidate.meta!=='object')errors.push('Metadati del salvataggio mancanti.');
 }
 return{valid:errors.length===0,errors};
}
function syncStateSaveMetadata(candidate,envelope={}){
 if(!candidate||typeof candidate!=='object')return candidate;
 const now=new Date().toISOString();
 candidate.meta=candidate.meta&&typeof candidate.meta==='object'?candidate.meta:{};
 candidate.meta.seasonId=String(envelope.seasonId||candidate.meta.seasonId||generateSeasonId());
 candidate.meta.createdAt=isoOrFallback(envelope.createdAt||candidate.meta.createdAt,now);
 candidate.meta.updatedAt=isoOrFallback(envelope.updatedAt||candidate.meta.updatedAt,candidate.meta.createdAt);
 candidate.meta.mode=SAVE_MODE;
 candidate.meta.saveFormatVersion=SAVE_FORMAT_VERSION;
 candidate.meta.gameVersion=String(envelope.gameVersion||candidate.meta.gameVersion||SEASON_ENGINE_VERSION);
 candidate.meta.autosave=true;
 return candidate;
}
function migrateSaveEnvelope(parsed){
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Contenuto del salvataggio non valido.');
 const looksLikeEnvelope=Object.prototype.hasOwnProperty.call(parsed,'state')&&(Object.prototype.hasOwnProperty.call(parsed,'mode')||Object.prototype.hasOwnProperty.call(parsed,'version'));
 if(!looksLikeEnvelope){
  const validation=validateStateForStorage(parsed);if(!validation.valid)throw new Error(validation.errors.join(' '));
  const migratedState=syncStateSaveMetadata(parsed,{});
  return{version:SAVE_FORMAT_VERSION,mode:SAVE_MODE,seasonId:migratedState.meta.seasonId,createdAt:migratedState.meta.createdAt,updatedAt:migratedState.meta.updatedAt,gameVersion:SEASON_ENGINE_VERSION,state:migratedState,legacy:true};
 }
 const formatVersion=Math.max(1,Number(parsed.version)||1);
 if(formatVersion>SAVE_FORMAT_VERSION)throw new Error(`Formato salvataggio ${formatVersion} più recente del formato supportato ${SAVE_FORMAT_VERSION}.`);
 const mode=String(parsed.mode||SAVE_MODE);
 if(mode!==SAVE_MODE)throw new Error(`Salvataggio della modalità ${mode}, non compatibile con ${SAVE_MODE}.`);
 let candidate=parsed.state;
 if(formatVersion===1&&parsed.payload&&typeof parsed.payload==='object')candidate=parsed.payload;
 const validation=validateStateForStorage(candidate);if(!validation.valid)throw new Error(validation.errors.join(' '));
 const now=new Date().toISOString();
 const envelope={
  version:SAVE_FORMAT_VERSION,
  mode:SAVE_MODE,
  seasonId:String(parsed.seasonId||candidate?.meta?.seasonId||generateSeasonId()),
  createdAt:isoOrFallback(parsed.createdAt||candidate?.meta?.createdAt,now),
  updatedAt:isoOrFallback(parsed.updatedAt||candidate?.meta?.updatedAt,now),
  gameVersion:String(parsed.gameVersion||candidate?.meta?.gameVersion||SEASON_ENGINE_VERSION),
  state:candidate,
  legacy:formatVersion!==SAVE_FORMAT_VERSION
 };
 envelope.state=syncStateSaveMetadata(envelope.state,envelope);
 return envelope;
}
function decodeStoredSave(raw){
 if(!raw)return null;
 let parsed;
 try{parsed=JSON.parse(raw)}catch(error){throw new Error(`JSON non leggibile: ${error.message}`)}
 return migrateSaveEnvelope(parsed);
}
function quarantineStoredSave(key,raw,reason='corrotto'){
 if(!raw)return '';
 const safeReason=String(reason||'corrotto').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').slice(0,32)||'corrotto';
 const quarantineKey=`${key}_${safeReason}_${Date.now()}`;
 try{localStorage.setItem(quarantineKey,raw);localStorage.removeItem(key);return quarantineKey}catch{return ''}
}
function readStoredSave(key,{quarantine=true,notice=true}={}){
 const raw=localStorage.getItem(key);if(!raw)return null;
 try{return decodeStoredSave(raw)}catch(error){
  if(quarantine)quarantineStoredSave(key,raw,error.message.includes('modalità')?'incompatibile':error.message.includes('più recente')?'versione-futura':'corrotto');
  if(notice)startupNotice='Un salvataggio non valido è stato isolato in sicurezza.';
  console.error(`Salvataggio non leggibile (${key})`,error);
  return null;
 }
}
function parseStoredState(raw,key){
 if(!raw)return null;
 try{return decodeStoredSave(raw)?.state||null}catch(error){
  quarantineStoredSave(key,raw,error.message.includes('modalità')?'incompatibile':'corrotto');
  startupNotice='Un salvataggio danneggiato o incompatibile è stato isolato.';
  console.error('Salvataggio non leggibile',error);
  return null;
 }
}
function loadState(){
 const direct=readStoredSave(AUTO_SAVE_KEY);
 const temporary=readStoredSave(SAVE_TEMP_KEY,{notice:false});
 const directTime=direct?new Date(direct.updatedAt||0).getTime():0;
 const temporaryTime=temporary?new Date(temporary.updatedAt||0).getTime():0;
 if(temporary&&(!direct||temporaryTime>directTime)){
  lastLoadedSaveInfo={source:'temporary',legacy:Boolean(temporary.legacy),recovered:true,envelope:temporary};
  startupNotice='È stato recuperato il salvataggio temporaneo più recente, rimasto da una scrittura interrotta.';
  return temporary.state;
 }
 if(direct){
  try{localStorage.removeItem(SAVE_TEMP_KEY)}catch{}
  lastLoadedSaveInfo={source:'primary',legacy:Boolean(direct.legacy),recovered:false,envelope:direct};
  if(direct.legacy)startupNotice='Il salvataggio è stato aggiornato al nuovo formato versionato.';
  return direct.state;
 }
 const backup=readStoredSave(SAVE_BACKUP_KEY,{notice:false});
 if(backup){
  lastLoadedSaveInfo={source:'backup',legacy:Boolean(backup.legacy),recovered:true,envelope:backup};
  startupNotice='Il salvataggio principale non era leggibile: è stato recuperato automaticamente il backup precedente.';
  return backup.state;
 }
 const slotOrder=[legacyActiveSlot,1,2,3].filter((slot,index,array)=>array.indexOf(slot)===index);
 for(const slot of slotOrder){
  const key=legacySlotKey(slot),legacySlot=readStoredSave(key,{notice:false});
  if(legacySlot){lastLoadedSaveInfo={source:key,legacy:true,recovered:true,envelope:legacySlot};startupNotice='La stagione attiva è stata trasferita al nuovo salvataggio automatico versionato.';return legacySlot.state}
 }
 for(const legacyKey of LEGACY_SAVE_KEYS){
  const legacy=readStoredSave(legacyKey,{notice:false});
  if(legacy){lastLoadedSaveInfo={source:legacyKey,legacy:true,recovered:true,envelope:legacy};startupNotice='Il vecchio salvataggio è stato trasferito al nuovo formato versionato.';return legacy.state}
 }
 lastLoadedSaveInfo={source:'none',legacy:false,recovered:false,envelope:null};
 return null;
}
function isStorageQuotaError(error){
 const name=String(error?.name||''),message=String(error?.message||'').toLowerCase();
 return name==='QuotaExceededError'||name==='NS_ERROR_DOM_QUOTA_REACHED'||Number(error?.code)===22||Number(error?.code)===1014||message.includes('quota')||message.includes('storage');
}
function storageClone(value){
 try{if(typeof structuredClone==='function')return structuredClone(value)}catch{}
 return JSON.parse(JSON.stringify(value));
}
function compactGoalForStorage(goal){
 if(!goal||typeof goal!=='object')return goal;
 const allowed=['minute','type','icon','teamId','playerId','player','playerName','scorer','assist','goalValue','scoreAfter'];
 const compact={};for(const key of allowed)if(goal[key]!==undefined)compact[key]=goal[key];
 return compact;
}
function compactMatchForStorage(match){
 if(!match||typeof match!=='object')return match;
 const compact={...match};
 for(const key of ['commentary','highlights','lineup','opponentLineup','formulaOneRanking','ductilityBoosts','frenchLateBoosts'])delete compact[key];
 if(Array.isArray(compact.goals))compact.goals=compact.goals.map(compactGoalForStorage);
 if(Array.isArray(compact.opponentGoals))compact.opponentGoals=compact.opponentGoals.map(compactGoalForStorage);
 return compact;
}
function buildStorageStateSnapshot(candidate){
 const snapshot=storageClone(candidate);
 snapshot.history=Array.isArray(snapshot.history)?snapshot.history.map(compactMatchForStorage):[];
 snapshot.lastResult=snapshot.lastResult?(snapshot.history[snapshot.history.length-1]||compactMatchForStorage(snapshot.lastResult)):null;
 snapshot.lastRoundResults=[];
 if(snapshot.chaos&&typeof snapshot.chaos==='object'&&Array.isArray(snapshot.chaos.latest))snapshot.chaos.latest=snapshot.chaos.latest.slice(-12);
 return snapshot;
}
function removeSaveStorageDebris({removeBackup=false,removeQuarantine=false}={}){
 try{localStorage.removeItem(SAVE_TEMP_KEY)}catch{}
 if(removeBackup){try{localStorage.removeItem(SAVE_BACKUP_KEY)}catch{}}
 if(removeQuarantine){
  try{
   const keys=[];for(let index=0;index<localStorage.length;index++)keys.push(localStorage.key(index));
   keys.filter(key=>key&&key.startsWith(`${AUTO_SAVE_KEY}_`)&&key!==SAVE_BACKUP_KEY&&key!==SAVE_TEMP_KEY).forEach(key=>localStorage.removeItem(key));
  }catch{}
 }
}
function tryWriteBackup(currentRaw,newRaw){
 if(!currentRaw||currentRaw===newRaw)return false;
 /* Con stringhe molto grandi il backup completo consumerebbe quasi tutta la quota.
    In quel caso è più sicuro mantenere soltanto il salvataggio principale verificato. */
 if(currentRaw.length+newRaw.length>1800000){try{localStorage.removeItem(SAVE_BACKUP_KEY)}catch{}return false}
 try{localStorage.setItem(SAVE_BACKUP_KEY,currentRaw);verifySerializedEnvelope(localStorage.getItem(SAVE_BACKUP_KEY));return true}
 catch(error){try{localStorage.removeItem(SAVE_BACKUP_KEY)}catch{};if(!isStorageQuotaError(error))console.warn('Backup del salvataggio non creato.',error);return false}
}
function buildSaveEnvelope(candidate,now=new Date().toISOString()){
 candidate.version=CURRENT_STATE_VERSION;
 candidate.meta=candidate.meta&&typeof candidate.meta==='object'?candidate.meta:{};
 candidate.meta.seasonId=String(candidate.meta.seasonId||generateSeasonId());
 candidate.meta.createdAt=isoOrFallback(candidate.meta.createdAt,now);
 candidate.meta.updatedAt=now;
 candidate.meta.mode=SAVE_MODE;
 candidate.meta.saveFormatVersion=SAVE_FORMAT_VERSION;
 candidate.meta.gameVersion=SEASON_ENGINE_VERSION;
 candidate.meta.autosave=true;
 delete candidate.meta.saveSlot;
 const storageState=buildStorageStateSnapshot(candidate);
 return{version:SAVE_FORMAT_VERSION,mode:SAVE_MODE,seasonId:candidate.meta.seasonId,createdAt:candidate.meta.createdAt,updatedAt:now,gameVersion:SEASON_ENGINE_VERSION,state:storageState};
}
function verifySerializedEnvelope(raw){
 const decoded=decodeStoredSave(raw);
 const validation=validateStateForStorage(decoded?.state,{strict:true});
 if(!validation.valid)throw new Error(validation.errors.join(' '));
 return decoded;
}
function save(){
 try{
  if(state?.draft?.roster?.length)enforceTipsterStarters();
  if(state?.seasonRules?.autoOptimizeLineup&&state?.draft?.roster?.length)optimizeLineupWithBench();
  const stateValidation=validateStateForStorage(state,{strict:true});
  if(!stateValidation.valid)throw new Error(stateValidation.errors.join(' '));
  const currentRaw=localStorage.getItem(AUTO_SAVE_KEY);
  let currentValid=false;
  if(currentRaw){try{verifySerializedEnvelope(currentRaw);currentValid=true}catch(error){console.warn('Il salvataggio precedente non è valido e non verrà usato come backup.',error)}}
  const envelope=buildSaveEnvelope(state);
  const raw=JSON.stringify(envelope);
  verifySerializedEnvelope(raw);

  /* localStorage.setItem sostituisce atomicamente il valore della stessa chiave.
     Non salviamo più tre copie complete (temp + backup + principale), causa del superamento quota. */
  removeSaveStorageDebris();
  try{localStorage.setItem(AUTO_SAVE_KEY,raw)}catch(error){
   if(!isStorageQuotaError(error))throw error;
   /* Un vecchio backup o salvataggi isolati possono occupare la quota: li rimuoviamo
      e riproviamo senza cancellare il salvataggio principale ancora valido. */
   removeSaveStorageDebris({removeBackup:true,removeQuarantine:true});
   localStorage.setItem(AUTO_SAVE_KEY,raw);
  }
  verifySerializedEnvelope(localStorage.getItem(AUTO_SAVE_KEY));
  const backupWritten=currentValid?tryWriteBackup(currentRaw,raw):false;
  lastLoadedSaveInfo={source:'primary',legacy:false,recovered:false,envelope,backupWritten};
  updateSaveStatus();
  return true;
 }catch(error){
  console.error('Salvataggio automatico non riuscito',error);
  const message=isStorageQuotaError(error)
   ?'spazio del browser esaurito. Il salvataggio precedente è rimasto intatto.'
   :(error.message||'dato non valido o spazio insufficiente.');
  try{toast(`Salvataggio automatico non riuscito: ${message}`)}catch{}
  return false;
 }
}
function clearCurrentSaveArtifacts({includeQuarantine=false}={}){
 try{
  [AUTO_SAVE_KEY,SAVE_BACKUP_KEY,SAVE_TEMP_KEY].forEach(key=>localStorage.removeItem(key));
  if(includeQuarantine){
   const keys=[];for(let index=0;index<localStorage.length;index++)keys.push(localStorage.key(index));
   keys.filter(key=>key&&key.startsWith(`${AUTO_SAVE_KEY}_`)).forEach(key=>localStorage.removeItem(key));
  }
 }catch(error){console.warn('Pulizia salvataggi non riuscita',error)}
}
