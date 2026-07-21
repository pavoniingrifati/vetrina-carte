/* Fantaballa Season Engine — 01-bootstrap.js
 * Configurazione, chiavi di salvataggio e bootstrap condiviso.
 * Modulo classico: l'ordine di caricamento è definito negli HTML del Campionato.
 */
const SEASON_CONFIG=window.FANTABALLA_SEASON_CONFIG;
if(!SEASON_CONFIG)throw new Error('Configurazione stagione mancante. Caricare il file season-config prima di season-engine.js.');
const DEFAULT_TEAM_NAME=String(SEASON_CONFIG.user.defaultTeamName||'Fantaballa FC');
const DEFAULT_FRESH_USER_CLUB_ID=String(SEASON_CONFIG.user.freshClubId||'fantaballa-fc');
const DEFAULT_NORMALIZED_USER_CLUB_ID=String(SEASON_CONFIG.user.normalizedClubFallback||'fantaballa-fc');
const EXCLUDED_AUTO_EVENT_TITLES=new Set(SEASON_CONFIG.events?.excludedAutoEventTitles||[]);
const EXCLUDED_DECISION_IDS=new Set(SEASON_CONFIG.events?.excludedDecisionIds||[]);
const CURRENT_STATE_VERSION=44;
const SAVE_FORMAT_VERSION=2;
const SEASON_ENGINE_VERSION='1.1.0';
const SAVE_MODE=String(SEASON_CONFIG.mode||'unknown');
const SAVE_BASE=SEASON_CONFIG.storage.saveBase;
const AUTO_SAVE_KEY=`${SAVE_BASE}_autosave`;
const SAVE_BACKUP_KEY=`${AUTO_SAVE_KEY}_backup`;
const SAVE_TEMP_KEY=`${AUTO_SAVE_KEY}_temp`;
const SAVE_QUARANTINE_PREFIX=`${AUTO_SAVE_KEY}_isolato`;
const LEGACY_SAVE_KEYS=[...(SEASON_CONFIG.storage.legacySaveKeys||[])];
const ACTIVE_SLOT_KEY=SEASON_CONFIG.storage.activeSlotKey;
const SETUP_TEAM_NAME_KEY=SEASON_CONFIG.storage.teamNameKey;
const SETUP_COACH_NAME_KEY=SEASON_CONFIG.storage.coachNameKey;
const SETUP_COACH_TYPE_KEY=SETUP_COACH_NAME_KEY+'_type';
const SETUP_PALETTE_KEY=SEASON_CONFIG.storage.paletteKey;
let startupNotice='';
let dataDiagnostics={fatal:[],warnings:[]};
const legacyActiveSlot=Math.max(1,Math.min(3,Number(localStorage.getItem(ACTIVE_SLOT_KEY))||1));
const activeSaveSlot=1;
function saveKey(){return AUTO_SAVE_KEY}
function generateSeasonId(){
 const time=Date.now().toString(36);
 let token='';
 try{const bytes=new Uint32Array(2);crypto.getRandomValues(bytes);token=Array.from(bytes,value=>value.toString(36)).join('')}catch{token=Math.random().toString(36).slice(2,14)}
 return `${SAVE_MODE}-${time}-${token.slice(0,14)}`;
}
function legacySlotKey(slot){return `${SAVE_BASE}_slot_${slot}`}
function cleanupLegacySaveArtifacts(){
 try{
  for(let slot=1;slot<=3;slot++){localStorage.removeItem(legacySlotKey(slot));localStorage.removeItem(`${legacySlotKey(slot)}_backup`)}
  localStorage.removeItem(ACTIVE_SLOT_KEY);
  LEGACY_SAVE_KEYS.forEach(key=>localStorage.removeItem(key));
 }catch(error){console.warn('Pulizia vecchi salvataggi non riuscita',error)}
}
const VICTORY_ENDPOINT='https://script.google.com/macros/s/AKfycbwadjpez_e-IXMLupqpISLEZ3rrHhrtF9gk_E9v9HB_YcgkXUneOnrW7iYAdGjqz3_G/exec';
const USER_ID=SEASON_CONFIG.user.teamId;

