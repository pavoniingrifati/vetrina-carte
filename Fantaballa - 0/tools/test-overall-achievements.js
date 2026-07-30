const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const definitionsCode = fs.readFileSync(path.join(root, 'assets', 'achievements.js'), 'utf8');
const seasonCode = fs.readFileSync(path.join(root, 'assets', 'season', '02-achievements.js'), 'utf8');

const context = {
  console,
  Date,
  Math,
  JSON,
  setTimeout: () => 0,
  clearTimeout: () => {},
  requestAnimationFrame: callback => callback(),
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: {
    body: { appendChild() {} },
    head: { appendChild() {} },
    createElement() { return { className:'', innerHTML:'', remove(){}, setAttribute(){}, classList:{ add(){}, remove(){} } }; }
  },
  location: { pathname:'/campionato.html' }
};
context.window = context;
vm.createContext(context);
vm.runInContext(definitionsCode, context, { filename:'achievements.js' });

const expected = [
  ['io-sono-fortissimo', 'Io sono Fortissimo!'],
  ['aura-strabiliaaante', 'Ha un’aura strabiliaaante!'],
  ['limite-super-sayan', 'Il limite del super sayan']
];
for (const [id, title] of expected) {
  const definition = context.FantaballaAchievements.definitions.find(item => item.id === id);
  if (!definition || definition.title !== title) throw new Error(`Definizione achievement errata: ${id}`);
}

vm.runInContext(seasonCode, context, { filename:'02-achievements.js' });

let unlocked = [];
context.FantaballaAchievements = {
  ...context.FantaballaAchievements,
  unlock(id) { unlocked.push(id); return true; },
  getCareerFlag() { return undefined; },
  setCareerFlag() {},
  clearCareerFlag() {}
};
context.state = { meta:{ createdAt:'test' }, teamName:'Test', coachName:'Coach', matchday:1, analytics:{ initialOvr:90 } };

context.teamPowerBase = () => 120;
context.checkTeamOverallAchievements();
if (!unlocked.includes('io-sono-fortissimo')) throw new Error('OVR medio 120 non sblocca Io sono Fortissimo!');
if (unlocked.includes('aura-strabiliaaante')) throw new Error('OVR medio 120 sblocca erroneamente il traguardo 140.');

unlocked = [];
context.teamPowerBase = () => 140;
context.checkTeamOverallAchievements();
if (!unlocked.includes('io-sono-fortissimo') || !unlocked.includes('aura-strabiliaaante')) throw new Error('OVR medio 140 non sblocca entrambi i traguardi.');

unlocked = [];
context.teamPowerBase = () => 100;
context.state.analytics.initialOvr = 90;
context.checkSeasonAchievements(0, true);
if (!unlocked.includes('limite-super-sayan')) throw new Error('Incremento stagionale 90 → 100 non sblocca Il limite del super sayan.');

unlocked = [];
context.teamPowerBase = () => 99.9;
context.state.analytics.initialOvr = 90;
context.checkSeasonAchievements(0, true);
if (unlocked.includes('limite-super-sayan')) throw new Error('Incremento inferiore a 10 sblocca erroneamente Il limite del super sayan.');

const postMatchHook = /checkTeamOverallAchievements\(matchAverageOvr\)/.test(seasonCode);
if (!postMatchHook) throw new Error('Controllo OVR medio non collegato al fine partita.');

console.log('Achievement OVR squadra: 5/5 test superati.');
