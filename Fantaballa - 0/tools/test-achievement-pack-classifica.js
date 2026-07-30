const fs = require('fs');
const vm = require('vm');
const path = require('path');

const parent = path.resolve(__dirname, '..');
const root = path.basename(parent) === 'assets' ? path.resolve(parent, '..') : parent;
const definitionsCode = fs.readFileSync(path.join(root, 'assets', 'achievements.js'), 'utf8');
const seasonCode = fs.readFileSync(path.join(root, 'assets', 'season', '02-achievements.js'), 'utf8');

const context = {
  console, Date, Math, JSON,
  setTimeout: () => 0,
  clearTimeout: () => {},
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { body:{appendChild(){}}, createElement(){return {remove(){},setAttribute(){}};} },
  location: { pathname:'/campionato.html' }
};
context.window = context;
vm.createContext(context);
vm.runInContext(definitionsCode, context, { filename:'achievements.js' });

const expectedDefinitions = [
  ['pareggite-acuta','Pareggite acuta'],
  ['vietato-segnare','Vietato segnare'],
  ['difesa-illegale','Difesa illegale'],
  ['attacco-atomico','Attacco atomico'],
  ['campione-al-risparmio','Campione al risparmio'],
  ['rimonta-del-secolo','La rimonta del secolo'],
  ['per-un-soffio','Per un soffio'],
  ['dominio-assoluto','Dominio assoluto']
];
for (const [id,title] of expectedDefinitions) {
  const item = context.FantaballaAchievements.definitions.find(entry => entry.id === id);
  if (!item || item.title !== title) throw new Error(`Definizione mancante o errata: ${id}`);
}
if (context.FantaballaAchievements.definitions.length !== 116) {
  throw new Error(`Numero achievement inatteso: ${context.FantaballaAchievements.definitions.length}, atteso 116.`);
}

vm.runInContext(seasonCode, context, { filename:'02-achievements.js' });

Object.assign(context, {
  USER_ID:'user',
  teamPowerBase: () => 90,
  parallelCupState: () => ({winnerId:'none'}),
  parallelCupUserId: () => 'cup-user',
  coachIs: () => false,
  achievementAllUsedPlayersUnder76: () => false,
  achievementChangedAtLeastHalfRoster: () => false,
  sponsorFootballManagerActive: () => false,
  sponsorBallariniActive: () => false,
  mysteryCharacterChain: () => ({branch:'',playerId:'',finale:{}}),
  mysteryPlayerLeadingBuckets: () => [],
  syncFantaballopoliAchievements: () => {},
  fantaballopoliState: () => ({path:'',finale:{}}),
  achievementFantaballopoliBetrayal: () => false,
  achievementFantaballopoliUsedAdvantages: () => false,
  allRosterItalian: () => false,
  curvaContestState: () => ({status:''})
});

let flags = {};
let unlocked = [];
context.FantaballaAchievements = {
  ...context.FantaballaAchievements,
  unlock(id){ unlocked.push(id); return true; },
  getCareerFlag(_career,key){ return flags[key]; },
  setCareerFlag(_career,key,value){ flags[key]=value; return value; },
  clearCareerFlag(_career,key){ delete flags[key]; }
};

function makeHistory({draws=0,zeroZero=0,wins=0,losses=0}) {
  const out=[];
  for(let i=0;i<zeroZero;i++) out.push({gf:0,ga:0});
  for(let i=zeroZero;i<draws;i++) out.push({gf:1,ga:1});
  for(let i=0;i<wins;i++) out.push({gf:2,ga:0});
  for(let i=0;i<losses;i++) out.push({gf:0,ga:1});
  return out;
}
function scenario({user,rival,rank=1,history,lastPlaceFlag=false}) {
  unlocked=[];
  flags=lastPlaceFlag?{wasLastFromMatchday10:{matchday:12}}:{};
  context.state={
    meta:{createdAt:'test'}, teamName:'Test', coachName:'Coach', matchday:38,
    analytics:{initialOvr:90}, seasonRules:{}, stats:{appearances:{}},
    standings:{user,rival}, history
  };
  context.userStanding=()=>user;
  context.sortedTable=()=>rank===1?[user,rival]:[rival,user];
  context.checkSeasonAchievements(rank,false);
  return [...new Set(unlocked)];
}

let got=scenario({
  user:{id:'user',p:38,w:8,d:15,l:15,pts:39,gf:100,ga:9},
  rival:{id:'rival',p:38,w:7,d:15,l:16,pts:38,gf:80,ga:20},
  history:makeHistory({draws:15,zeroZero:10,wins:8,losses:15}),
  lastPlaceFlag:true
});
for (const id of ['pareggite-acuta','vietato-segnare','difesa-illegale','attacco-atomico','campione-al-risparmio','rimonta-del-secolo','per-un-soffio']) {
  if (!got.includes(id)) throw new Error(`${id} non si sblocca nello scenario valido.`);
}

got=scenario({
  user:{id:'user',p:38,w:25,d:5,l:8,pts:80,gf:90,ga:20},
  rival:{id:'rival',p:38,w:18,d:6,l:14,pts:59,gf:70,ga:30},
  history:makeHistory({draws:5,wins:25,losses:8})
});
if (!got.includes('dominio-assoluto')) throw new Error('Dominio assoluto non si sblocca con 21 punti di vantaggio.');

got=scenario({
  user:{id:'user',p:38,w:20,d:10,l:8,pts:70,gf:70,ga:20},
  rival:{id:'rival',p:38,w:20,d:10,l:8,pts:70,gf:60,ga:20},
  history:makeHistory({draws:10,wins:20,losses:8})
});
if (!got.includes('per-un-soffio')) throw new Error('Per un soffio non si sblocca con titolo a pari punti deciso dalla differenza reti.');

flags={};
context.state={meta:{createdAt:'test'},teamName:'Test',coachName:'Coach',matchday:9,standings:{user:{id:'user'},a:{id:'a'}}};
context.sortedTable=()=>[{id:'a'},{id:'user'}];
context.trackLastPlaceFromMatchday10();
if (flags.wasLastFromMatchday10) throw new Error('La rimonta viene tracciata prima della 10ª giornata.');
context.state.matchday=10;
context.trackLastPlaceFromMatchday10();
if (!flags.wasLastFromMatchday10 || flags.wasLastFromMatchday10.matchday!==10) throw new Error('Ultimo posto dalla 10ª giornata non tracciato.');

const matchHook = /state\.matchday\+\+;if\(typeof trackLastPlaceFromMatchday10/.test(
  fs.readFileSync(path.join(root,'assets','season','12-match-simulation.js'),'utf8')
);
if (!matchHook) throw new Error('Tracciamento ultimo posto non collegato al completamento della giornata.');
const immediateZeroZeroHook = /currentZeroZeroCount[\s\S]*unlockAchievement\('vietato-segnare'/.test(seasonCode);
if (!immediateZeroZeroHook) throw new Error('Vietato segnare non viene controllato subito dopo la decima partita per 0-0.');

console.log('Pacchetto achievement classifica: 13/13 test superati.');
