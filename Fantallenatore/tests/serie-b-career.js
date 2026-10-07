'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..'),app=require('./helpers/production-source').readProductionSource();
function section(from,to){const a=app.indexOf(from),b=app.indexOf(to,a);assert(a>=0&&b>a,`Sezione non trovata: ${from}`);return app.slice(a,b)}
const ctx={window:{},console,TextEncoder,TextDecoder,Uint8Array,Date,Math};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'js/save-codec.js'),'utf8'),ctx);
vm.runInContext(`
const GAME_CONFIG={startingDivision:4},INITIAL_BUDGET=500;
let state=null,saveCalls=0;
const shuffledCopy=a=>a.slice().sort((x,y)=>String(x?.id||x).localeCompare(String(y?.id||y)));
const RIVAL_TEAM_NAMES=Array.from({length:24},(_,i)=>'Rivali '+i);
const RIVAL_COLOR_BASES=Array.from({length:24},(_,i)=>['#abcdef','#111111']);
const ensureSeasonState=()=>state?.season||null;
const ensureCareerEconomy=()=>state.career;
const completedUserSeasonRecap=()=>({position:1});
const completedSeasonUserPosition=()=>state?.season?.careerPrize?.position||1;
const managerById=id=>state?.managers.find(m=>String(m.id)===String(id));
const userOpponentIdForDay=day=>state?.season?.schedule?.[day-1]?.matches?.find(m=>m.homeId==='user'||m.awayId==='user')?.homeId==='user'
 ?state.season.schedule[day-1].matches.find(m=>m.homeId==='user').awayId
 :state?.season?.schedule?.[day-1]?.matches?.find(m=>m.awayId==='user')?.homeId;
const careerHash=value=>{let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0)/4294967296};
const saveState=()=>{saveCalls++;return true};
const generateOpponentMalusOption=(day,opponent)=>({id:'malus-'+day,effect:{kind:'malus_vote',targetPlayerId:'target'},text:'Malus del tuo prossimo avversario'});
${section('const PERSONALITIES = [','let state = null;')}
${section('function freshRivalIdentityPool(','function freshState(')}
${section('function careerSeasonOutcome(','function completedUserSeasonRecap(')}
${section('function ensureNextSeasonFlow(){','function nextSeasonSummerPlan(){')}
${section('function specialRivalManager(manager){','function generateOpponentMalusOption(')}
${section('const opponentMalusRollsInProgress=new Set();','function activeOpponentMalus(')}
globalThis.api={freshManagers,ensureNextSeasonFlow,opponentMalusChanceForManager,ensureOpponentMalusRoll,specialRivalManager,setState:v=>{state=v},getState:()=>state,getSaveCalls:()=>saveCalls};
`,ctx);
const {api}=ctx,codec=ctx.window.FantaSaveCodec;
function restore(value){const stored=codec.encode(JSON.stringify(value)),decoded=JSON.parse(codec.decode(stored));assert.strictEqual(JSON.stringify(decoded),JSON.stringify(value));api.setState(decoded);return decoded}
function season(division,number,position=1){
 const managers=api.freshManagers('Fantaballa','Filippo',division);
 assert.strictEqual(managers.length,10);
 assert.strictEqual(new Set(managers.map(m=>m.id)).size,10);
 assert.strictEqual(managers.filter(m=>m.id!=='user').length,9);
 const specials=managers.filter(api.specialRivalManager);
 if(division===4) assert.strictEqual(specials.length,0,'La Lega Amatori non deve contenere rivali speciali');
 if(division===2) assert(specials.length>=3,'La Serie B deve includere almeno tre rivali speciali');
 if(division===1) assert(specials.length>=4,'La Serie A deve includere Admin e tre rivali speciali');
 const admins=managers.filter(m=>m.profile?.archetype==='admin');
 assert.strictEqual(admins.length,division===1?1:0,'Admin deve comparire solo e sempre in Serie A');
 if(admins.length){
  assert.strictEqual(admins[0].name,'Admin');
  assert.strictEqual(admins[0].team,'Admin FC');
  assert.strictEqual(admins[0].profile.expert,true);
  assert.strictEqual(admins[0].budget,500);
 }
 const rival=specials[0]||managers[1];
 assert.strictEqual(api.opponentMalusChanceForManager(rival,division),division===4?0:division===3?.12:.20);
 const regular=managers.find(m=>m.id!=='user'&&!api.specialRivalManager(m));
 if(regular) assert.strictEqual(api.opponentMalusChanceForManager(regular,division),division<=2?.12:0);
 const snapshot={version:24,teamName:'Fantaballa',managerName:'Filippo',career:{seasonNumber:number,division,seasonHistory:[]},managers,
  season:{completed:false,currentMatchday:1,opponentMalusEvents:{},schedule:Array.from({length:38},()=>({matches:[{homeId:'user',awayId:rival.id}]}))}};
 restore(snapshot);
 const first=api.ensureOpponentMalusRoll(1),calls=api.getSaveCalls();
 assert.strictEqual(first.opponentId,rival.id);assert.strictEqual(first.triggerChance,api.opponentMalusChanceForManager(rival,division));
 assert.strictEqual(first.triggered,first.roll<first.triggerChance);
 assert.strictEqual(api.ensureOpponentMalusRoll(1),first,'Il malus deve essere idempotente');
 assert.strictEqual(api.getSaveCalls(),calls,'La seconda lettura non deve salvare di nuovo');
 const triggered=Array.from({length:37},(_,i)=>api.ensureOpponentMalusRoll(i+2)).filter(entry=>entry.triggered);
 if(division<4) assert(triggered.length>0,'Il rivale speciale non lancia mai malus in 38 giornate');
 const resumed=restore(JSON.parse(JSON.stringify(api.getState())));
 assert.strictEqual(api.ensureOpponentMalusRoll(1).triggered,first.triggered,'Il malus non deve cambiare dopo il caricamento');
 assert.strictEqual(Object.keys(resumed.season.opponentMalusEvents).length,38,'Il registro dei malus deve sopravvivere al salvataggio');
 resumed.season.completed=true;resumed.season.careerPrize={position};
 const flow=api.ensureNextSeasonFlow();
 assert.strictEqual(flow.currentDivision,division);
 const relegated=position===10 && division<4;
 assert.strictEqual(flow.nextDivision,position===1?Math.max(1,division-1):relegated?division+1:division);
 assert.strictEqual(flow.promoted,position===1&&division>1);
 assert.strictEqual(flow.champion,position===1&&division===1);
 assert.strictEqual(flow.relegated,relegated);
 assert.strictEqual(api.ensureNextSeasonFlow(),flow,'La transizione deve essere persistente');
 if(relegated){
  flow.version=2;flow.relegated=false;flow.nextDivision=division;
  assert.strictEqual(api.ensureNextSeasonFlow().nextDivision,division+1,'Recap precedente non aggiornato alla retrocessione');
  assert.strictEqual(flow.relegated,true);
 }
 console.log(`S${number}: divisione ${division}, ${specials.length} rivali speciali, ${triggered.length+(first.triggered?1:0)} malus/38, passaggio a ${flow.nextDivision}${flow.champion?' (campione)':''}`);
}
season(4,1);season(3,2);season(2,3);season(1,4);
season(1,5,10);season(2,6,10);season(3,7,10);season(4,8,10);
for(let attempt=0;attempt<150;attempt++){
 const rivals=api.freshManagers('Fantaballa','Filippo',1);
 assert.strictEqual(rivals.length,10);
 assert.strictEqual(rivals.filter(m=>m.profile?.archetype==='admin').length,1);
 assert(rivals.filter(api.specialRivalManager).length>=4);
}
assert(fs.existsSync(path.join(root,'assets/rivals/admin.webp')),'Grafica Admin mancante');
console.log('OK: fino alla Serie A, rivali speciali, malus, promozioni e ripristino salvataggio.');
