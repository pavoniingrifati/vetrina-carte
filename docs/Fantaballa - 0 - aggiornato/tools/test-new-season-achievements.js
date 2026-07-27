const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');
const defsCode = fs.readFileSync(path.join(root, 'assets', 'achievements.js'), 'utf8');
const seasonCode = fs.readFileSync(path.join(root, 'assets', 'season', '02-achievements.js'), 'utf8');

const storage = new Map();
const baseContext = {
  console,
  Date,
  Math,
  JSON,
  setTimeout: () => 0,
  clearTimeout: () => {},
  localStorage: {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
  },
  document: {
    body: { appendChild() {} },
    createElement() { return { className:'', innerHTML:'', remove(){}, setAttribute(){} }; }
  },
  location: { pathname:'/campionato.html' }
};
baseContext.window = baseContext;
vm.createContext(baseContext);
vm.runInContext(defsCode, baseContext, { filename:'achievements.js' });

const requiredDefinitions = [
  ['chi-perde-vince', 'Chi perde...vince!'],
  ['zero-vittorie-un-titolo', '0 vittorie, 1 titolo'],
  ['coppa-di-consolazione', 'Coppa di consolazione']
];
for (const [id, title] of requiredDefinitions) {
  const item = baseContext.FantaballaAchievements.definitions.find(entry => entry.id === id);
  if (!item || item.title !== title) throw new Error(`Definizione mancante o errata: ${id}`);
}

vm.runInContext(seasonCode, baseContext, { filename:'02-achievements.js' });

// Neutralizza le verifiche non pertinenti, lasciando attiva la logica dei tre nuovi achievement.
Object.assign(baseContext, {
  coachIs: () => false,
  achievementAllUsedPlayersUnder76: () => false,
  achievementChangedAtLeastHalfRoster: () => false,
  sponsorFootballManagerActive: () => false,
  sponsorBallariniActive: () => false,
  mysteryCharacterChain: () => ({ branch:'', playerId:'', finale:{} }),
  mysteryPlayerLeadingBuckets: () => [],
  syncFantaballopoliAchievements: () => {},
  fantaballopoliState: () => ({ stage:'', finale:{} }),
  achievementFantaballopoliBetrayal: () => false,
  achievementFantaballopoliUsedAdvantages: () => false,
  allRosterItalian: () => false,
  curvaContestState: () => ({ status:'' }),
  achievementLongestWinStreak: () => 0,
  getAchievementCareerFlag: () => null,
  parallelCupUserId: () => 'cup-user'
});

function runScenario({ rank, w, d=0, l, cupWon }) {
  const unlocked = [];
  const standing = { id:'user', w, d, l, p:w+d+l, pts:10, gf:10, ga:10 };
  const rival = { id:'rival', w:1, d:0, l:0, p:1, pts:9, gf:9, ga:9 };
  baseContext.state = {
    standings:{ user:standing, rival },
    history:Array.from({length:Math.max(1, standing.p)}, () => ({gf:1,ga:1})),
    seasonRules:{}, stats:{ appearances:{} }
  };
  baseContext.USER_ID = 'user';
  baseContext.sortedTable = () => rank === 1 ? [standing, rival] : [rival, standing];
  baseContext.userStanding = () => standing;
  baseContext.parallelCupState = () => ({ winnerId:cupWon ? 'cup-user' : 'other' });
  baseContext.window.FantaballaAchievements = {
    ...baseContext.window.FantaballaAchievements,
    unlock(id) { unlocked.push(id); return true; },
    getCareerFlag() { return undefined; },
    setCareerFlag() {},
    clearCareerFlag() {}
  };
  baseContext.checkSeasonAchievements(rank, false);
  return unlocked;
}

const lossesChampion = runScenario({ rank:1, w:2, l:3, cupWon:false });
if (!lossesChampion.includes('chi-perde-vince')) throw new Error('Chi perde...vince! non si sblocca.');

const zeroWinsChampion = runScenario({ rank:1, w:0, l:4, cupWon:false });
if (!zeroWinsChampion.includes('zero-vittorie-un-titolo')) throw new Error('0 vittorie, 1 titolo non si sblocca.');

const cupOnly = runScenario({ rank:2, w:3, l:2, cupWon:true });
if (!cupOnly.includes('coppa-di-consolazione')) throw new Error('Coppa di consolazione non si sblocca.');

const doubleWinner = runScenario({ rank:1, w:3, l:2, cupWon:true });
if (doubleWinner.includes('coppa-di-consolazione')) throw new Error('Coppa di consolazione si sblocca erroneamente con il Double.');

console.log('Nuovi achievement stagionali: 4/4 test superati.');
