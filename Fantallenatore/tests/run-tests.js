'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { VIEWPORTS, auditResponsive } = require('./responsive-audit.js');

const ROOT = path.resolve(__dirname, '..');
const results = [];
const pendingTests = [];

function test(name, fn) {
  try {
    const result={name,ok:true};
    results.push(result);
    const value=fn();
    if(value&&typeof value.then==='function'){
      result.ok=null;
      pendingTests.push(value.then(()=>{ result.ok=true; }).catch(error=>{
        result.ok=false;
        result.error=error&&error.message?error.message:String(error);
      }));
    }
  } catch (error) {
    results.push({ name, ok: false, error: error && error.message ? error.message : String(error) });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function extractNumber(source, constantName) {
  const match = source.match(new RegExp(`(?:\\bconst\\s+${constantName}\\s*=|\\b${constantName}\\s*:)\\s*(\\d+)`));
  assert(match, `Costante ${constantName} non trovata`);
  return Number(match[1]);
}

function loadDatabase() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read('data_v302.js'), context, { filename: 'data_v302.js' });
  return {
    players: context.window.FANTA_PLAYERS,
    clubs: context.window.FANTA_CLUBS,
    foreignPlayers: context.window.FANTA_FOREIGN_PLAYERS
  };
}

function htmlIds(html) {
  return [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
}

function localHtmlReferences(html) {
  return [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)]
    .map(match => match[1])
    .filter(value => !/^(?:https?:|data:|#)/.test(value));
}

function cssUrls(css) {
  return [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)]
    .map(match => match[1])
    .filter(value => !/^(?:https?:|data:|#)/.test(value));
}

function assertBalancedCss(css, filename) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
  let braces = 0;
  for (const char of clean) {
    if (char === '{') braces += 1;
    if (char === '}') braces -= 1;
    assert(braces >= 0, `${filename}: graffa di chiusura senza apertura`);
  }
  assert(braces === 0, `${filename}: ${braces} graffe non bilanciate`);
}

const app = read('app_v302.js');
const serieADatabase = JSON.parse(read('data/serie-a.json'));
const foreignDatabase = JSON.parse(read('data/foreign-players.json'));
const rules = read('js/game-rules.js');
const utilities = read('js/core-utils.js');
const saveCodec = read('js/save-codec.js');
const transferEngineSource = read('js/transfer-engine.js');
const html = read('index.html');
const database = loadDatabase();

test('JavaScript: tutti i file hanno sintassi valida', () => {
  const files = ['app_v302.js', 'data_v302.js', 'balance_sim.js', 'js/game-rules.js', 'js/core-utils.js', 'js/save-codec.js', 'js/save-manager.js', 'js/storage-snapshot.js', 'js/cpu-lineup-policy.js', 'js/season-engine.js', 'js/transfer-engine.js', 'js/career-engine.js', 'js/auction-engine.js', 'js/accessibility.js', 'js/ui-dialogs.js', 'js/auction-events.js', 'js/live-match-state.js'];
  for (const file of files) new vm.Script(read(file), { filename: file });
});

test('HTML: nessun ID duplicato', () => {
  const ids = htmlIds(html);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert(duplicates.length === 0, `ID duplicati: ${[...new Set(duplicates)].join(', ')}`);
});

test('HTML: script, fogli stile e immagini collegati esistono', () => {
  const missing = localHtmlReferences(html).filter(reference => !fs.existsSync(path.join(ROOT, reference)));
  assert(missing.length === 0, `File mancanti: ${missing.join(', ')}`);
});

test('CSS: sintassi strutturale e asset locali validi', () => {
  const cssFiles = fs.readdirSync(path.join(ROOT, 'css/modules')).filter(file => file.endsWith('.css')).map(file => `css/modules/${file}`)
    .concat(['styles_v302.css', 'css/ui-dialogs.css']);
  const missing = [];
  for (const file of cssFiles) {
    const source = read(file);
    assertBalancedCss(source, file);
    for (const reference of cssUrls(source)) {
      const target = path.resolve(path.dirname(path.join(ROOT, file)), reference);
      if (!fs.existsSync(target)) missing.push(`${file} -> ${reference}`);
    }
  }
  assert(missing.length === 0, `Asset CSS mancanti: ${missing.join('; ')}`);
});

test('Database: struttura generale coerente', () => {
  const { players, clubs } = database;
  assert(Array.isArray(players) && players.length >= 500, `Giocatori insufficienti: ${players && players.length}`);
  assert(Array.isArray(clubs) && clubs.length === 20, `Club attesi 20, trovati ${clubs && clubs.length}`);
  assert(new Set(players.map(player => player.id)).size === players.length, 'Sono presenti ID giocatore duplicati');
  assert(new Set(clubs.map(club => club.id)).size === clubs.length, 'Sono presenti ID club duplicati');
});

test('Database: ogni giocatore ha dati e valori validi', () => {
  const clubIds = new Set(database.clubs.map(club => club.id));
  const roles = new Set(['P', 'D', 'C', 'A']);
  for (const player of database.players) {
    assert(player.id && player.name, 'Giocatore senza ID o nome');
    assert(roles.has(player.role), `${player.name}: ruolo non valido ${player.role}`);
    assert(clubIds.has(player.club), `${player.name}: club inesistente ${player.club}`);
    assert(Number.isFinite(Number(player.ovr)) && player.ovr >= 1 && player.ovr <= 99, `${player.name}: OVR non valido`);
    assert(Number.isFinite(Number(player.quotation)) && player.quotation >= 0, `${player.name}: quotazione non valida`);
    assert(Number.isFinite(Number(player.fvm)) && player.fvm >= 0, `${player.name}: FVM non valido`);
  }
});

test('Database: disponibilita sufficiente per 10 rose complete', () => {
  const required = { P: 30, D: 80, C: 80, A: 60 };
  const found = database.players.reduce((counts, player) => {
    counts[player.role] = (counts[player.role] || 0) + 1;
    return counts;
  }, {});
  for (const [role, minimum] of Object.entries(required)) {
    assert((found[role] || 0) >= minimum, `${role}: servono ${minimum}, disponibili ${found[role] || 0}`);
  }
});

test('Database JSON: fonte ufficiale valida e allineata al runtime offline', () => {
  assert(serieADatabase.schemaVersion===1, 'Versione schema JSON non valida');
  assert(serieADatabase.season==='2026/27', 'Stagione database JSON non valida');
  assert(JSON.stringify(serieADatabase.players)===JSON.stringify(database.players), 'Giocatori runtime non allineati al JSON');
  assert(JSON.stringify(serieADatabase.clubs)===JSON.stringify(database.clubs), 'Club runtime non allineati al JSON');
  assert(new Set(serieADatabase.players.map(player=>player.id)).size===serieADatabase.players.length, 'ID giocatori duplicati nel JSON');
  const clubIds=new Set(serieADatabase.clubs.map(club=>club.id));
  assert(serieADatabase.players.every(player=>clubIds.has(player.club)), 'Giocatore associato a un club inesistente');
  assert(/data\/serie-a\.json \+ data\/foreign-players\.json/.test(read('data_v302.js')), 'Il file runtime non dichiara le proprie fonti JSON');
});

test('Database estero JSON: 300 giocatori modificabili e allineati al runtime', () => {
  assert(foreignDatabase.schemaVersion===2 && foreignDatabase.catalogVersion, 'Metadati catalogo estero mancanti');
  assert(foreignDatabase.players.length===300, 'Il catalogo estero non contiene 300 giocatori');
  assert(database.foreignPlayers.length===300, 'Il catalogo estero non viene caricato nel runtime offline');
  assert(foreignDatabase.players.every(player=>player.id && player.name), 'Identita giocatori esteri incomplete');
  assert(foreignDatabase.players.every(player=>Object.keys(player).every(key=>['id','name'].includes(key))), 'Nel catalogo estero sono presenti dati che dovrebbero essere casuali');
  assert(new Set(foreignDatabase.players.map(player=>player.id)).size===300, 'ID duplicati nel catalogo estero');
  assert(/window\.FANTA_FOREIGN_PLAYERS/.test(transferEngineSource), 'Il motore non utilizza il catalogo estero JSON');
});

test('Regole carriera: budget, rosa e stagione invariati', () => {
  assert(extractNumber(rules, 'INITIAL_BUDGET') === 500, 'Il budget iniziale non e 500');
  assert(extractNumber(rules, 'FANTASY_SEASON_MATCHDAYS') === 38, 'La stagione non dura 38 giornate');
  assert(extractNumber(rules, 'TOTAL_SLOTS') === 25, 'La rosa non contiene 25 slot');
  assert(/ROLE_LIMITS:\s*Object\.freeze\(\{\s*P:\s*3,\s*D:\s*8,\s*C:\s*8,\s*A:\s*6\s*\}\)/.test(rules), 'Limiti reparto diversi da 3P/8D/8C/6A');
});

test('Configurazione: valori identificativi centralizzati', () => {
  assert(/const\s+GAME_CONFIG\s*=\s*Object\.freeze\(\{/.test(rules), 'GAME_CONFIG non trovato');
  assert(/buildVersion:\s*'3\.2\.35\.56\.\d+'/.test(rules), 'Versione build mancante o non valida');
  assert(/seasonLabel:\s*'2026\/27'/.test(rules), 'Stagione non centralizzata');
  assert(/leagueName:\s*'Lega Amatori'/.test(rules), 'Nome lega non centralizzato');
  assert(/startingDivision:\s*4/.test(rules), 'Divisione iniziale non centralizzata');
  assert(!/2026\/27|V3\.2\.35|>3<|Lega Amatori/.test(html), 'Valore configurabile ancora duplicato nell HTML');
  assert(/data-game-build/.test(html) && /data-game-season/.test(html) && /data-game-league/.test(html) && /data-current-division/.test(html), 'Binding configurazione incompleti');
});

test('Accessibilita: navigazione, annunci e preferenze utente presenti', () => {
  const accessibility=read('js/accessibility.js');
  const accessibilityCss=read('css/modules/11-accessibility.css');
  assert(/class="skip-link"\s+href="#gameMain"/.test(html), 'Link salta al contenuto assente');
  assert(/<main\s+id="gameMain"\s+tabindex="-1">/.test(html), 'Main non focalizzabile');
  assert(/id="a11yAnnouncements"/.test(html), 'Regione annunci screen reader assente');
  assert(html.indexOf('js/accessibility.js')<html.indexOf('app_v302.js'), 'Modulo accessibilita caricato troppo tardi');
  assert(/MutationObserver/.test(accessibility) && /button\.type='button'/.test(accessibility), 'Normalizzazione dinamica dei pulsanti assente');
  assert(/querySelectorAll\?\.\('\.screen'\)/.test(accessibility), 'Stato iniziale delle schermate non normalizzato');
  assert(/event\.key!==\s*'Tab'/.test(accessibility), 'Focus trap delle modali assente');
  assert(/prefers-reduced-motion:reduce/.test(accessibilityCss), 'Movimento ridotto non supportato');
  assert(/forced-colors:active/.test(accessibilityCss), 'Modalita contrasto forzato non supportata');
  assert(/aria-current','page'/.test(app), 'Stato accessibile della navigazione assente');
  assert(/isError\?'alert':'status'/.test(app), 'Errori toast non annunciati come alert');
});

test('Moduli JS: dipendenze esplicite e caricate prima dell orchestratore', () => {
  const rulesPos=html.indexOf('js/game-rules.js');
  const utilsPos=html.indexOf('js/core-utils.js');
  const codecPos=html.indexOf('js/save-codec.js');
  const managerPos=html.indexOf('js/save-manager.js');
  const seasonEnginePos=html.indexOf('js/season-engine.js');
  const transferEnginePos=html.indexOf('js/transfer-engine.js');
  const careerEnginePos=html.indexOf('js/career-engine.js');
  const auctionEnginePos=html.indexOf('js/auction-engine.js');
  const appPos=html.indexOf('app_v302.js');
  assert(rulesPos>=0 && utilsPos>rulesPos && codecPos>utilsPos && managerPos>codecPos && seasonEnginePos>managerPos && transferEnginePos>seasonEnginePos && careerEnginePos>transferEnginePos && auctionEnginePos>careerEnginePos && appPos>auctionEnginePos, 'Ordine di caricamento moduli non valido');
  assert(/window\.FantaGameRules\s*=\s*Object\.freeze/.test(rules), 'API FantaGameRules non esportata');
  assert(/window\.FantaCoreUtils=Object\.freeze/.test(utilities), 'API FantaCoreUtils non esportata');
  assert(/window\.FantaGameRules/.test(app) && /window\.FantaCoreUtils/.test(app) && /window\.FantaSaveCodec/.test(app), 'Orchestratore non collegato ai moduli');
  assert(/window\.FantaSeasonEngine/.test(app), 'Orchestratore non collegato al motore stagione');
  assert(/window\.FantaTransferEngine/.test(app), 'Orchestratore non collegato al motore trasferimenti');
  assert(/window\.FantaCareerEngine/.test(app), 'Orchestratore non collegato al motore carriera');
  assert(/window\.FantaAuctionEngine/.test(app), 'Orchestratore non collegato al motore asta');
  assert(!/function\s+randomHash|function\s+shuffledCopy|function\s+playerInitials/.test(app), 'Utilita pure duplicate nel monolite');
});

test('Modulo salvataggi: compressione reversibile e compatibile', () => {
  const context={window:{},TextEncoder,TextDecoder,Uint8Array,Map,console};
  vm.createContext(context);
  vm.runInContext(saveCodec,context,{filename:'js/save-codec.js'});
  const codec=context.window.FantaSaveCodec;
  const payload=JSON.stringify({team:'Pavoni Ingrifati ⚽',players:Array.from({length:80},(_,index)=>({id:index,name:`Giocatore ${index}`}))});
  assert(codec.decompress(codec.compress(payload))===payload, 'Round-trip compressione non valido');
  assert(codec.decode(codec.encode(payload))===payload, 'Round-trip payload non valido');
  assert(codec.decode(payload)===payload, 'Payload JSON normale non compatibile');
  assert(codec.PREFIX==='FZ1:', 'Prefisso storico del salvataggio modificato');
});

test('Save manager: fallback, coda, lettura e pulizia isolati', async () => {
  const values=new Map();
  const storage={
    setItem:(key,value)=>values.set(key,String(value)),
    getItem:key=>values.has(key)?values.get(key):null,
    removeItem:key=>values.delete(key)
  };
  const context={window:{localStorage:storage,navigator:{}},console,setTimeout,Blob};
  context.window.window=context.window;
  vm.createContext(context);
  vm.runInContext(read('js/save-manager.js'),context,{filename:'js/save-manager.js'});
  const manager=context.window.FantaSaveManager.createSaveManager({
    env:context.window,storage,legacyKey:'test-save',encode:value=>`ENC:${value}`,
    onWarning:()=>{},onError:error=>{ throw error; }
  });
  await manager.initialize();
  assert(manager.backend==='legacy','Fallback localStorage non attivato senza IndexedDB');
  manager.queue(manager.makeRecord('{"version":23,"value":1}',23));
  assert(await manager.flush(),'Coda di salvataggio fallita');
  assert(values.get('test-save')==='ENC:{"version":23,"value":1}','Payload fallback non codificato');
  const loaded=await manager.load({
    parsePayload:payload=>payload?JSON.parse(String(payload).replace(/^ENC:/,'')):null,
    serializeState:JSON.stringify
  });
  assert(loaded.state?.value===1&&loaded.source==='legacy','Lettura fallback non riuscita');
  await manager.clear();
  assert(!values.has('test-save'),'Pulizia fallback non riuscita');
});

test('Motore stagione: calendario fantasy completo e deterministico', () => {
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(read('js/season-engine.js'),context,{filename:'js/season-engine.js'});
  const engine=context.window.FantaSeasonEngine;
  const managers=Array.from({length:10},(_,index)=>({id:index===0?'user':`cpu${index}`}));
  const hash=key=>{
    let value=2166136261;
    for(const char of key){value^=char.charCodeAt(0);value=Math.imul(value,16777619);}
    return (value>>>0)/4294967296;
  };
  const first=engine.buildFantasySeasonSchedule(managers,38,[],hash);
  const second=engine.buildFantasySeasonSchedule(managers,38,[],hash);
  assert(first.length===38,'Il calendario fantasy non contiene 38 giornate');
  assert(JSON.stringify(first)===JSON.stringify(second),'Il calendario non e deterministico');
  first.forEach((round,index)=>{
    assert(round.number===index+1&&round.matches.length===5,`Giornata ${index+1} incompleta`);
    const participants=round.matches.flatMap(match=>[match.homeId,match.awayId]);
    assert(new Set(participants).size===10,`Squadra duplicata nella giornata ${index+1}`);
  });
});

test('Motore stagione: Serie A andata/ritorno e classifica', () => {
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(read('js/season-engine.js'),context,{filename:'js/season-engine.js'});
  const engine=context.window.FantaSeasonEngine;
  const clubs=Array.from({length:20},(_,index)=>({id:`club${index}`}));
  const schedule=engine.buildDoubleRoundRobin(clubs.map(club=>club.id));
  assert(schedule.length===38,'Il calendario Serie A non contiene 38 giornate');
  assert(schedule.every(round=>round.matches.length===10),'Una giornata Serie A non contiene 10 partite');
  const pairings=new Map();
  schedule.flatMap(round=>round.matches).forEach(match=>{
    const key=[match.homeClub,match.awayClub].sort().join('|');
    pairings.set(key,(pairings.get(key)||0)+1);
  });
  assert(pairings.size===190&&[...pairings.values()].every(count=>count===2),'Andata e ritorno non bilanciati');
  const seedRandom=seed=>key=>{
    let hash=2166136261;
    for(const char of `${seed}|${key}`) hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
    return hash/4294967296;
  };
  const first=engine.buildDoubleRoundRobin(clubs.map(club=>club.id),seedRandom('asta-1'));
  const replay=engine.buildDoubleRoundRobin(clubs.map(club=>club.id),seedRandom('asta-1'));
  const next=engine.buildDoubleRoundRobin(clubs.map(club=>club.id),seedRandom('asta-2'));
  assert(JSON.stringify(first)===JSON.stringify(replay),'Il calendario cambia ricaricando la stessa asta');
  assert(JSON.stringify(first)!==JSON.stringify(next),'Il calendario rimane uguale nella nuova asta');
  const table=engine.freshStandings([{id:'a'},{id:'b'},{id:'c'}]);
  engine.applyFantasyMatch(table,{homeId:'a',awayId:'b',homeScore:2,awayScore:1,homeFantasy:72.5,awayFantasy:67});
  engine.applyFantasyMatch(table,{homeId:'c',awayId:'a',homeScore:0,awayScore:0,homeFantasy:61,awayFantasy:65});
  const sorted=engine.sortStandings(table);
  assert(sorted[0].managerId==='a'&&sorted[0].points===4,'Punti o ordinamento classifica errati');
  assert(sorted[0].fantasyPoints===137.5,'Fantapunti cumulativi errati');
});

test('Titolarita: probabilita normalizzate sui posti reali del ruolo', () => {
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(read('js/season-engine.js'),context,{filename:'js/season-engine.js'});
  const engine=context.window.FantaSeasonEngine;
  const keepers=engine.normalizeStarterProbabilities([
    {id:'p1',score:90},{id:'p2',score:80},{id:'p3',score:70}
  ],1,{cap:96,floor:1,temperature:2.4});
  const total=keepers.p1+keepers.p2+keepers.p3;
  assert(total===100,`Le probabilita dei portieri devono sommare 100, trovato ${total}`);
  assert(keepers.p1>=90,`Il primo portiere deve essere nettamente favorito, trovato ${keepers.p1}%`);
  assert(keepers.p2<=9,`Il secondo portiere non puo avere una probabilita irrealistica, trovato ${keepers.p2}%`);
  assert(/normalizeStarterProbabilities\(entries,slots/.test(app)&&/player\.role==='P'\?2\.4:4\.2/.test(app),'La stima runtime non usa la normalizzazione per ruolo');
});

test('Motore carriera: saldo e negozio rispettano i vincoli', () => {
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(read('js/career-engine.js'),context,{filename:'js/career-engine.js'});
  const engine=context.window.FantaCareerEngine;
  const career=engine.normalizeCareer(null,20,3);
  const season={completed:false,shopPurchases:{},sponsor:null};
  assert(engine.balance(career)===20&&career.division===3,'Economia iniziale non valida');
  const purchase=engine.buyShopItem(career,season,{cost:8},'fortune',{now:100});
  assert(purchase.ok&&!purchase.free&&engine.balance(career)===12,'Acquisto standard non contabilizzato');
  assert(career.totalSpent===8&&season.shopPurchases.fortune.cost===8,'Spesa o acquisto non registrati');
  assert(!engine.buyShopItem(career,season,{cost:8},'fortune').ok,'Acquisto duplicato consentito');
  assert(!engine.buyShopItem(career,season,{cost:50},'expensive').ok&&engine.balance(career)===12,'Saldo insufficiente non rispettato');
});

test('Fantapoints: valuta persistente e premio giornata protetto', () => {
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(read('js/career-engine.js'),context,{filename:'js/career-engine.js'});
  const career=context.window.FantaCareerEngine.normalizeCareer(null,20,3);
  assert(career.fantapoints===0&&career.totalFantapointsEarned===0&&Array.isArray(career.fantapointsHistory),'Wallet Fantapoints non inizializzato');
  assert(/function\s+grantMatchdayFantapoints\s*\(/.test(app),'Calcolo premio Fantapoints assente');
  assert(/participation:3/.test(app)&&/won\?8:draw\?3:0/.test(app)&&/goals:goals\*2/.test(app)&&/conceded===0\?2:0/.test(app),'Formula Fantapoints non conforme');
  assert(/if\(!season\|\|!dayResult\|\|dayResult\.fantapointsReward\)/.test(app),'Protezione contro accrediti duplicati assente');
  assert(/matchdayRewardModal/.test(html)&&/resultFantapointsContinueBtn/.test(html)&&/requestAnimationFrame\(tick\)/.test(app),'Modal animata Fantapoints assente');
});

test('Motore carriera: sponsor e premi non vengono duplicati', () => {
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(read('js/career-engine.js'),context,{filename:'js/career-engine.js'});
  const engine=context.window.FantaCareerEngine;
  const career=engine.normalizeCareer({euros:0,startingEuros:0,totalEarned:0,totalSpent:0,seasonNumber:1,division:3,prizeHistory:[],nextAuctionBonusCredits:0},0,3);
  const season={completed:false,sponsor:engine.createSeasonSponsor({id:'win_bonus',name:'Win'},1),matchdayResults:{}};
  const result={matches:[{homeId:'user',awayId:'cpu1',homeScore:2,awayScore:1}]};
  assert(engine.grantWinSponsorReward(career,season,1,result)===1,'Bonus vittoria non assegnato');
  assert(engine.grantWinSponsorReward(career,season,1,result)===0,'Bonus vittoria assegnato due volte');
  season.completed=true;
  const standings=[{managerId:'user'},{managerId:'cpu1'}];
  const prize=engine.grantSeasonPrize(career,season,standings,200);
  assert(prize.amount===40&&engine.balance(career)===41,'Premio primo posto errato');
  engine.grantSeasonPrize(career,season,standings,300);
  assert(engine.balance(career)===41&&career.prizeHistory.length===1,'Premio stagionale duplicato');
});

test('Motore asta: limiti rosa, ruolo e riserva crediti', () => {
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(read('js/auction-engine.js'),context,{filename:'js/auction-engine.js'});
  const engine=context.window.FantaAuctionEngine;
  const limits={P:3,D:8,C:8,A:6};
  const manager={id:'user',budget:20,roster:Array.from({length:20},(_,index)=>({id:`r${index}`,role:index<3?'P':index<11?'D':'C',price:1}))};
  const attacker={id:'a1',name:'Attaccante',role:'A',club:'ROM',ovr:80,quotation:20,fvm:100};
  assert(engine.slotsRemaining(manager,25)===5,'Slot residui errati');
  assert(engine.canOwn(manager,attacker,limits,25),'Giocatore valido rifiutato');
  assert(engine.maxLegalBid(manager,attacker,limits,25)===16,'Riserva minima dei crediti non rispettata');
  const fullRole={...manager,roster:manager.roster.concat(Array.from({length:6},(_,index)=>({id:`a${index}`,role:'A'})))};
  assert(!engine.canOwn(fullRole,attacker,limits,25),'Limite di ruolo superabile');
});

test('Motore asta: aggiudicazione atomica e One Shot a 1', () => {
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(read('js/auction-engine.js'),context,{filename:'js/auction-engine.js'});
  const engine=context.window.FantaAuctionEngine;
  const limits={P:3,D:8,C:8,A:6};
  const player={id:'p1',name:'Portiere',role:'P',club:'MIL',ovr:88,quotation:25,fvm:120};
  const state={
    managers:[{id:'user',team:'Team',budget:25,roster:[]}],availableIds:['p1'],
    stats:{purchases:0,totalSpent:0,highest:null}
  };
  const awarded=engine.awardPlayer(state,player,'user',1,{roleLimits:limits,totalSlots:25});
  assert(awarded.ok&&state.managers[0].budget===24,'One Shot non aggiudica a 1 credito');
  assert(state.managers[0].roster.length===1&&state.managers[0].roster[0].price===1,'Rosa non aggiornata correttamente');
  assert(!state.availableIds.includes('p1')&&state.stats.purchases===1,'Disponibilita o statistiche non aggiornate');
  const duplicate=engine.awardPlayer(state,player,'user',1,{roleLimits:limits,totalSlots:25});
  assert(!duplicate.ok&&state.managers[0].roster.length===1,'Giocatore assegnato due volte');
  const player2={...player,id:'p2',name:'Secondo'};
  state.availableIds.push('p2');
  const illegal=engine.awardPlayer(state,player2,'user',25,{roleLimits:limits,totalSlots:25});
  assert(!illegal.ok&&state.managers[0].budget===24,'Offerta oltre la riserva accettata');
});

test('Moduli JS: regole e utilita pure rispettano il contratto', () => {
  const context={window:{},setTimeout};
  vm.createContext(context);
  vm.runInContext(rules,context,{filename:'js/game-rules.js'});
  vm.runInContext(utilities,context,{filename:'js/core-utils.js'});
  const gameRules=context.window.FantaGameRules;
  const utils=context.window.FantaCoreUtils;
  assert(Object.isFrozen(gameRules) && Object.isFrozen(gameRules.ROLE_LIMITS), 'Regole esportate modificabili');
  assert(gameRules.INITIAL_BUDGET===500 && gameRules.TOTAL_SLOTS===25, 'Contratto regole non valido');
  assert(utils.clamp(12,0,10)===10 && utils.clamp(-2,0,10)===0, 'Clamp non valido');
  assert(utils.randomHash('carriera')===utils.randomHash('carriera'), 'Hash non deterministico');
  assert(utils.playerInitials('Mario Rossi')==='MR' && utils.playerInitials('Svilar')==='SV', 'Iniziali non valide');
  const original=[1,2,3],shuffled=utils.shuffledCopy(original,()=>0);
  assert(original.join(',')==='1,2,3' && shuffled.join(',')==='2,3,1', 'Shuffle modifica l input o non usa il generatore fornito');
});

test('CSS: design system e proprietari caricati nell ordine corretto', () => {
  const manifest=read('styles_v302.css');
  const tokens=manifest.indexOf("00-design-tokens.css");
  const legacy=manifest.indexOf("01-auction-core.css");
  const shell=manifest.indexOf("10-career-shell.css");
  assert(tokens>=0 && legacy>tokens && shell>legacy, 'Ordine del manifest CSS non valido');
  const tokenSource=read('css/modules/00-design-tokens.css');
  const shellSource=read('css/modules/10-career-shell.css');
  const dashboardSource=read('css/modules/09-dashboard-overhaul.css');
  const alignmentSource=read('css/modules/14-visual-alignment.css');
  assert(/--color-gold:#ffd84d/.test(tokenSource), 'Token colore principale assente');
  assert(/--career-nav-height:76px/.test(tokenSource), 'Token dimensione navigazione assente');
  assert(/assets\/navigation\/nav-home\.webp/.test(shellSource), 'Asset navigazione non gestiti dal componente shell');
  assert(!/assets\/navigation\/nav-[a-z-]+\.webp/.test(dashboardSource), 'Asset navigazione duplicati fuori dal componente shell');
  assert(manifest.indexOf('14-visual-alignment.css')>shell && manifest.indexOf('14-visual-alignment.css')<manifest.indexOf('12-responsive-qa.css'), 'Modulo allineamento caricato nella posizione errata');
  assert(/\.result-grid \.result-ratings-panel>\.season-card-head/.test(alignmentSource), 'Padding intestazione risultati non protetto');
  assert(/\.evolution-summary-card[\s\S]*grid-template-rows:auto auto 1fr/.test(alignmentSource), 'Allineamento card evoluzione non protetto');
});

test('Responsive: sei viewport principali protette', () => {
  const report = auditResponsive(ROOT);
  assert(VIEWPORTS.length === 6, 'La matrice non contiene esattamente sei viewport');
  assert(report.ok, `Contratti responsive mancanti: ${report.failures.join(', ')}`);
  assert(report.viewports.every(viewport => viewport.cssContractsPresent), 'Contratti CSS mancanti');
  assert(report.viewports.every(viewport => viewport.browserVerified === false), 'Audit statico non deve dichiarare verifica browser');
});

test('Fantapoteri: loadout da 3 slot e limiti utilizzo', () => {
  assert(/\['observer','oneShot'\]\.includes\(power\)\?3:1/.test(app), 'Costo slot di Osservatore/One Shot non conforme');
  assert(/function\s+auctionPowerMaxUses\(power\)\s*\{\s*return\s+power==='oneShot'\?1:5;\s*\}/.test(app), 'Limiti utilizzo Fantapoteri non conformi');
  assert(/usedSlots!==3/.test(app), 'Avvio asta non vincolato a 3 slot');
});

test('One Shot: assegna all utente a 1 credito e usa il flusso standard', () => {
  const match = app.match(/function\s+useOneShotPower\(\)\s*\{([\s\S]*?)\n\s*\}\n\n\s*function/);
  assert(match, 'Funzione One Shot non trovata');
  const source = match[1];
  assert(/a\.price=1/.test(source), 'One Shot non imposta il prezzo a 1');
  assert(/a\.highBidderId='user'/.test(source), 'One Shot non assegna la leadership all utente');
  assert(/consumeAuctionPower\('oneShot'/.test(source), 'One Shot non viene consumato');
  assert(/awardAuction\(\)/.test(source), 'One Shot non usa il normale flusso di aggiudicazione');
});

test('Salvataggi: IndexedDB, backup e migrazione presenti', () => {
  const manager=read('js/save-manager.js');
  assert(/indexedDb\.open\(dbName,dbVersion\)/.test(manager), 'Apertura IndexedDB assente dal modulo');
  assert(/currentSlot=options\.currentSlot\|\|'current'/.test(manager), 'Slot current assente');
  assert(/backupSlot=options\.backupSlot\|\|'backup'/.test(manager), 'Slot backup assente');
  assert(/previous,id:backupSlot/.test(manager), 'Rotazione del backup assente');
  assert(/function\s+normalizeSavedState/.test(app), 'Migrazione salvataggi assente');
  assert(/parsed\.version=24/.test(app), 'Migrazione alla versione 24 assente');
  assert(/window\.FantaSaveManager\.createSaveManager/.test(app), 'Orchestratore non collegato al save manager');
});

test('Evoluzione OVR: tetto stagionale a +/-10', () => {
  assert(/clamp\(Number\(development\.delta\|\|0\)\+Number\(amount\|\|0\),-10,10\)/.test(app), 'Tetto evoluzione OVR +/-10 assente o modificato');
});

test('UI: schermate e azioni fondamentali presenti', () => {
  const ids = new Set(htmlIds(html));
  const required = [
    'startBtn', 'resumeBtn', 'careerStartAuctionBtn', 'auctionScreen', 'auctionName', 'passBtn',
    'seasonScreen', 'lineupBtn', 'playMatchdayBtn', 'lineupScreen', 'confirmLineupBtn',
    'serieALiveScreen', 'resultContinueBtn', 'leagueDataCenterScreen', 'leagueSocialScreen', 'leagueShopScreen'
  ];
  const missing = required.filter(id => !ids.has(id));
  assert(missing.length === 0, `Elementi UI mancanti: ${missing.join(', ')}`);
});

test('Flusso post asta: ingresso stagione e moduli stagionali integri', () => {
  const requiredFunctions = [
    'startLeague','renderSeasonDashboard','estimatedStarterProbability','grantSeasonPrizeIfNeeded',
    'renderLeagueDataCenterScreen','renderLeagueSocialScreen','sendCurrentSocialMessage'
  ];
  const missing = requiredFunctions.filter(name => !new RegExp(`function\\s+${name}\\s*\\(`).test(app));
  assert(missing.length===0, `Funzioni stagione mancanti: ${missing.join(', ')}`);
  const startLeagueMatch=app.match(/function\s+startLeague\(\)\s*\{([\s\S]*?)\n\s*\}\n\n\s*function/);
  assert(startLeagueMatch, 'Funzione startLeague non trovata');
  assert(/state\.season\s*=\s*\{/.test(startLeagueMatch[1]), 'startLeague non inizializza la stagione');
  assert(/renderSeasonDashboard\(\)/.test(startLeagueMatch[1]), 'startLeague non apre la dashboard stagione');
});


test('Eventi pre-Diretta Gol: nuovi boost e malus giocatore attivi nel motore', () => {
  const ids = [
    'boost-training','boost-derby','boost-offensive-freedom',
    'malus-tough-opponent','malus-card-risk','malus-negative-form'
  ];
  const missing=ids.filter(id=>!app.includes(`id:'${id}'`));
  assert(missing.length===0, `Eventi mancanti: ${missing.join(', ')}`);
  assert(/kind:'world_player'/.test(app), 'Effetti world_player non presenti');
  assert(/starterScoreDelta:5\.5/.test(app) && /starterProbabilityDelta:14/.test(app), 'Allenamento eccellente non influenza la titolarita');
  assert(/cardMultiplier:1\.70/.test(app) && /cardMultiplier:1\.90/.test(app), 'Modificatori cartellino non configurati');
  assert(/goalMultiplier:\.58,assistMultiplier:\.58/.test(app), 'Avversario ostico non riduce i bonus');
  assert(/function\s+worldPlayerModifier\s*\(/.test(app), 'Hook worldPlayerModifier assente');
  assert(/worldEffect\?\.goalMultiplier/.test(app) && /worldEffect\?\.assistMultiplier/.test(app) && /worldEffect\?\.cardMultiplier/.test(app), 'Il motore eventi non applica tutti i moltiplicatori');
});


test('Eventi Admin: rarità, vincoli XI e Fantaclassifica', () => {
  const ids=[
    'admin-forced-starter','admin-revolution-5','admin-wildcard-starter',
    'admin-top-player-bench','admin-faith-reserve','admin-double-wildcard','admin-fantaclassifica'
  ];
  const missing=ids.filter(id=>!app.includes(`id:'${id}'`));
  assert(missing.length===0, `Nuovi eventi Admin mancanti: ${missing.join(', ')}`);
  assert(/ruleId:'forced_starter_pair'/.test(app), 'Titolare imposto non configurato');
  assert(/ruleId:'forced_turnover_5'/.test(app) && /minimumChanges:5/.test(app), 'Formazione rivoluzionata non richiede 5 cambi');
  assert(/id:'admin-revolution-5',rarity:'rare'/.test(app), 'Formazione rivoluzionata non classificata Rara');
  assert(/id:'admin-top-player-bench',rarity:'rare'/.test(app) && /ruleId:'top_player_bench'/.test(app), 'Top Player in panchina non configurato come Raro');
  assert(/id:'admin-faith-reserve',rarity:'rare'/.test(app) && /ruleId:'faith_reserve'/.test(app), 'Fiducia alla riserva non configurata come Rara');
  assert(/id:'admin-wildcard-starter',rarity:'epic'/.test(app), 'Wildcard Admin non classificata Epica');
  assert(/id:'admin-double-wildcard',rarity:'epic'/.test(app) && /ruleId:'double_wildcard_starting_slot'/.test(app) && /maxOutOfRole:2/.test(app), 'Doppio Jolly non configurato come Epico');
  assert(/id:'admin-fantaclassifica',rarity:'epic'/.test(app) && /ruleId:'fantaclassifica'/.test(app), 'Fantaclassifica non configurata come Epica');
  assert(/4:Object\.freeze\(\{common:1\.00,rare:0,epic:0\}\)/.test(app), 'Lega Amatori non limitata ai soli eventi Admin comuni');
  assert(/3:Object\.freeze\(\{common:\.70,rare:\.25,epic:\.05\}\)/.test(app), 'Profilo rarità Serie C non configurato');
  assert(/2:Object\.freeze\(\{common:\.50,rare:\.35,epic:\.15\}\)/.test(app), 'Profilo rarità Serie B non configurato');
  assert(/function\s+adminRuleRarityProfile\s*\(/.test(app) && /admin-rule-rarity\|D/.test(app), 'Rarità Admin non collegata alla divisione della carriera');
  assert(/function\s+wildcardSlotCompatible\s*\(/.test(app) && /D↔C/.test(app) && /C↔A/.test(app), 'Compatibilita wildcard non definita');
  assert(/function\s+adminWildcardStartingSlotLimit\s*\(/.test(app), 'Limite dinamico Jolly non presente');
  assert(/function\s+enforcePlayerBenchedInLineup\s*\(/.test(app) && /adminBlockedStarterForManager\(m\.id,day\)/.test(app), 'Top Player CPU non viene forzato in panchina');
  assert(/function\s+previousUnusedBenchEligibleIds\s*\(/.test(app) && /userBenchIds/.test(app), 'Fiducia alla riserva non traccia le panchine precedenti');
  assert(/function\s+sortFantasyLeagueStandings\s*\(/.test(app) && /fantaclassificaActive/.test(app), 'Fantaclassifica non collegata all ordinamento stagionale');
});


test('Regolamento pre-asta: tre regole Admin sorteggiate e applicate', () => {
  const ids=new Set(htmlIds(html));
  assert(ids.has('careerRulesStep') && ids.has('careerRulesGrid') && ids.has('careerRulesContinueBtn'), 'Schermata regolamento pre-asta incompleta');
  assert(/PRE_AUCTION_RULE_DEFS/.test(app), 'Pool regolamento pre-asta assente');
  assert(/id:'defenseModifier'/.test(app) && /id:'maxFantasySubs'/.test(app) && /id:'firstGoalThreshold'/.test(app) && /id:'cleanSheetBonus'/.test(app), 'Categorie regolamento mancanti');
  assert(/\.slice\(0,3\)/.test(app) && /selectedCategories/.test(app), 'L Admin non sorteggia esattamente tre categorie');
  assert(/values:Object\.freeze\(\['off','classic'\]\)/.test(app), 'Valori Modificatore Difesa non conformi');
  assert(/values:Object\.freeze\(\[1,3,5\]\)/.test(app), 'Valori sostituzioni non conformi');
  assert(/values:Object\.freeze\(\[65,66,67\]\)/.test(app), 'Valori soglia primo gol non conformi');
  assert(/values:Object\.freeze\(\[0,1,2\]\)/.test(app), 'Valori porta inviolata e bonus mega non conformi');
  assert(/id:'formation334Allowed'/.test(app) && /'3-3-4': makeFormationSlots/.test(app), 'Regola del modulo 3-3-4 mancante');
  assert(/function\s+classicDefenseModifierResult\s*\(/.test(app), 'Modificatore Difesa classico non implementato');
  assert(/firstGoalThreshold/.test(app) && /cleanSheetBonus/.test(app), 'Regole stagionali non collegate al calcolo fantapunti');
  assert(/careerRulesNextAction==='ready'/.test(app), 'Rose pronte non passa dalla schermata regolamento');
});


test('Strategia CPU: il regolamento influenza asta e formazione', () => {
  assert(/function\s+cpuLeagueRuleSensitivity\s*\(/.test(app), 'Sensibilita CPU alle regole assente');
  assert(/function\s+cpuLeagueRuleAuctionFactor\s*\(/.test(app), 'Adattamento asta alle regole assente');
  assert(/value \*= cpuLeagueRuleAuctionFactor\(manager,player\)/.test(app), 'Limite asta CPU non usa il regolamento');
  assert(/function\s+cpuLeagueRuleLineupValue\s*\(/.test(app), 'Adattamento formazione alle regole assente');
  assert(/function\s+cpuLeagueFormationBias\s*\(/.test(app), 'Bias modulo CPU legato al regolamento assente');
  assert(/rules\.defenseModifier==='classic'/.test(app), 'Modificatore Difesa non influenza la strategia CPU');
  assert(/Number\(rules\.maxFantasySubs\)===1/.test(app), 'Numero cambi non influenza la strategia CPU');
  assert(/Number\(rules\.firstGoalThreshold\)===65/.test(app) && /Number\(rules\.firstGoalThreshold\)===67/.test(app), 'Soglia gol non influenza la strategia CPU');
  assert(/Number\(rules\.cleanSheetBonus\|\|0\)>0/.test(app), 'Porta inviolata non influenza la strategia CPU');
});


test('Fine reparto utente: aste CPU residue simulate automaticamente', () => {
  const ids=new Set(htmlIds(html));
  assert(ids.has('roleAutoSimBanner') && ids.has('roleAutoSimTitle') && ids.has('roleAutoSimText'), 'Banner simulazione automatica reparto assente');
  assert(/function\s+beginRoleRemainderAutoSim\s*\(/.test(app), 'Avvio simulazione automatica reparto assente');
  assert(/function\s+endRoleRemainderAutoSim\s*\(/.test(app), 'Chiusura simulazione automatica reparto assente');
  assert(/userCompletedCurrentRole\(previousRole\)/.test(app), 'Il completamento reparto utente non attiva il fast-forward');
  assert(/roleRemainderAutoSim=true/.test(app) && /autocompleteMode=true/.test(app), 'La simulazione reparto non usa il motore rapido');
  assert(/phaseFinished && roleRemainderAutoSim/.test(app), 'Il fast-forward non si arresta alla fine del solo reparto');
  assert(/return beginRoleTransition\(previousRole\)/.test(app), 'Manca il passaggio al reparto successivo dopo la simulazione');
});


test('Calciomercato Serie A: motore trasferimenti deterministico e coerente', () => {
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(transferEngineSource,context,{filename:'js/transfer-engine.js'});
  const engine=context.window.FantaTransferEngine;
  assert(engine && typeof engine.planWindow==='function' && typeof engine.applyPlan==='function', 'API motore trasferimenti incompleta');
  const externalPool=[
    {id:'ext-p',name:'Portiere Estero',role:'P',ovr:78,club:'estero'},
    {id:'ext-d',name:'Difensore Estero',role:'D',ovr:80,club:'estero'},
    {id:'ext-c',name:'Centrocampista Estero',role:'C',ovr:81,club:'estero'},
    {id:'ext-a',name:'Attaccante Estero',role:'A',ovr:82,club:'estero'},
    {id:'ext-a2',name:'Punta Estera',role:'A',ovr:75,club:'estero'}
  ];
  const options={windowType:'winter',seed:'test-market',players:database.players,clubs:database.clubs,externalPool,statsByPlayer:{}};
  const first=engine.planWindow(options);
  const second=engine.planWindow(options);
  assert(JSON.stringify(first.operations)===JSON.stringify(second.operations), 'La stessa finestra non e deterministica');
  assert(first.counts.internal>=3 && first.counts.internal<=5, `Trasferimenti interni invernali fuori range: ${first.counts.internal}`);
  assert(first.counts.abroad>=2 && first.counts.abroad<=3, `Partenze estero invernali fuori range: ${first.counts.abroad}`);
  assert(first.targets.arrivals===first.counts.abroad, `Gli arrivi esteri non compensano le partenze: target ${first.targets.arrivals}, partenze ${first.counts.abroad}`);
  assert(first.operations.every(op=>['internal','abroad','arrival','arrival_request'].includes(op.type)), 'Tipo operazione mercato non valido');
  const movedIds=first.operations.filter(op=>op.playerId && op.type!=='arrival').map(op=>op.playerId);
  assert(new Set(movedIds).size===movedIds.length, 'Un giocatore viene trasferito due volte nella stessa finestra');
  const market=engine.applyPlan(engine.createMarketState('test-market'),first);
  assert(market.windows.length===1 && market.history.length===first.operations.length, 'Piano mercato non registrato nello stato');
  const reapplied=engine.applyPlan(market,first);
  assert(reapplied.windows.length===1, 'La stessa finestra viene applicata due volte');
  assert(/generateSerieATransferWindowPlan/.test(app) && /serieATransferStatsSnapshot/.test(app), 'Motore trasferimenti non collegato ai dati della carriera');
});

test('Calciomercato: punteggi distanti contano e una cessione crea bisogno', () => {
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(transferEngineSource,context,{filename:'js/transfer-engine.js'});
  const {weightedTop,arrivalClubRoleOptions}=context.window.FantaTransferEngine._test;
  const distant=[{id:'buono',score:100},{id:'scarso',score:55}];
  const close=[{id:'buono',score:100},{id:'scarso',score:99}];
  let goodDistant=0,goodClose=0;
  for(let index=0;index<100;index++){
    if(weightedTop(distant,`seed-${index}`,'pick').id==='buono') goodDistant++;
    if(weightedTop(close,`seed-${index}`,'pick').id==='buono') goodClose++;
  }
  assert(goodDistant>=90,`Una destinazione molto peggiore viene scelta troppo spesso (${100-goodDistant}/100)`);
  assert(goodClose<85,'Destinazioni vicine non conservano variabilità');
  const clubs=[{id:'a'},{id:'b'}],rosters=new Map([['a',[{role:'A',ovr:74}]],['b',[{role:'A',ovr:74}]]]);
  const profiles=new Map([['a',{spending:1}],['b',{spending:1}]]);
  const benchmarks={P:{avgCount:1,avgOvr:70},D:{avgCount:1,avgOvr:70},C:{avgCount:1,avgOvr:70},A:{avgCount:1,avgOvr:74}};
  const baseline=arrivalClubRoleOptions(clubs,rosters,benchmarks,profiles,'seed',1);
  const needs=new Map([['a|A',{count:1,quality:84,important:true}]]);
  const changed=arrivalClubRoleOptions(clubs,rosters,benchmarks,profiles,'seed',1,needs);
  const score=(list,club)=>list.find(item=>item.clubId===club&&item.role==='A').score;
  assert(score(changed,'a')>score(baseline,'a')+15,'Perdita di un titolare non aumenta abbastanza il bisogno');
  assert(score(changed,'b')===score(baseline,'b'),'Cessione di un club altera anche un altro club');
});

test('Calciomercato: le big non comprano giocatori troppo sotto il livello del reparto', () => {
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(transferEngineSource,context,{filename:'js/transfer-engine.js'});
  const {destinationQualityFloor,destinationScore}=context.window.FantaTransferEngine._test;
  assert(typeof destinationQualityFloor==='function' && typeof destinationScore==='function','Filtro qualita destinazione non esposto nei test');
  const rosters=new Map([
    ['big',[
      {id:'b1',role:'A',ovr:84,club:'big'},{id:'b2',role:'A',ovr:82,club:'big'},
      {id:'b3',role:'A',ovr:80,club:'big'},{id:'b4',role:'A',ovr:78,club:'big'}
    ]],
    ['small',[
      {id:'low',role:'A',ovr:62,club:'small'},{id:'s2',role:'A',ovr:68,club:'small'},
      {id:'s3',role:'A',ovr:66,club:'small'},{id:'s4',role:'A',ovr:64,club:'small'},
      {id:'s5',role:'A',ovr:63,club:'small'}
    ]]
  ]);
  const profiles=new Map([['big',{reputation:1.22,spending:1.3}],['small',{reputation:.82,spending:.8}]]);
  const benchmarks={P:{avgCount:2,avgOvr:70},D:{avgCount:8,avgOvr:72},C:{avgCount:8,avgOvr:73},A:{avgCount:6,avgOvr:74}};
  const floor=destinationQualityFloor('big','A',rosters,profiles);
  assert(floor>=71,`Soglia big troppo bassa: ${floor}`);
  const low=rosters.get('small')[0];
  const lowScore=destinationScore(low,'big','small',rosters,benchmarks,profiles,{},'quality-gate','summer');
  assert(lowScore===-Infinity,'Un OVR 62 puo ancora essere acquistato da un reparto top');
  const credible={id:'credible',role:'A',ovr:76,club:'small'};
  rosters.set('small',[credible,...rosters.get('small')]);
  const credibleScore=destinationScore(credible,'big','small',rosters,benchmarks,profiles,{},'quality-gate-credible','summer');
  assert(Number.isFinite(credibleScore),'Il filtro blocca anche un acquisto di profondita credibile');
});

test('Finestra invernale: si attiva una sola volta tra giornata 19 e 20', () => {
  const ids=new Set(htmlIds(html));
  ['winterMarketIntroScreen','simulateWinterMarketBtn','winterMarketSummaryScreen','winterFlowTransferList','winterReleaseScreen','winterReleaseList','confirmWinterReleasesBtn'].forEach(id=>assert(ids.has(id),`Elemento flusso gennaio assente: ${id}`));
  assert(/const\s+WINTER_TRANSFER_TRIGGER_MATCHDAY=19/.test(app), 'Soglia della finestra invernale errata');
  assert(/const\s+WINTER_AUCTION_BASE_CREDITS=50/.test(app), 'Bonus base asta di gennaio errato');
  assert(/function\s+activateWinterTransferWindowIfNeeded\s*\(/.test(app), 'Attivazione finestra invernale assente');
  assert(/generateSerieATransferWindowPlan\('winter'\)/.test(app) && /registerSerieATransferWindowPlan\(plan\)/.test(app), 'Pianificazione invernale non collegata al flusso stagione');
  assert(ids.has('winterMarketLoading') && ids.has('winterMarketLoadingTitle') && /winterMarketSimulationRunning/.test(app) && /setTimeout\(resolve,700\)/.test(app), 'Caricamento simulazione mercato assente o non protetto');
  assert(/stage:existing\?'summary':'intro'/.test(app) && /flow\.stage='summary'/.test(app) && /flow\.stage='releases'/.test(app) && /flow\.stage='auction'/.test(app), 'Fasi persistenti del mercato invernale incomplete');
  assert(/activateWinterTransferWindowIfNeeded\(\);[\s\S]{0,900}season\.activeLive/.test(app), 'Il mercato non viene applicato al termine della giornata');
});

test('Asta di gennaio: rimborsi, svincoli e contabilità separata', () => {
  assert(/const refund=Math\.max\(0,Number\(item\.price\|\|0\)\)/.test(app), 'Partenza estero non rimborsa il prezzo pagato');
  assert(/Math\.round\(Number\(item\.quotation\|\|player\.quotation\|\|0\)\)/.test(app), 'Svincolo volontario non usa la quotazione base');
  assert(/initialLeftover[\s\S]*baseGrant[\s\S]*foreignRefund[\s\S]*releaseRefund[\s\S]*winterSpent/.test(app), 'Ledger budget gennaio incompleto');
  assert(/ledger\.winterSpent=Number\(ledger\.winterSpent\|\|0\)\+Number\(finalPrice\|\|0\)/.test(app), 'Spesa della mini asta non registrata');
  assert(/function\s+processCpuWinterReleases\s*\(/.test(app) && /cpuWinterReleaseScore/.test(app), 'Svincoli CPU intelligenti assenti');
  assert(/winter-transfer-player-card/.test(app) && /playerAvatarMarkup\(player,name\)/.test(app) && /playerOvrLabel\(player\)/.test(app), 'Schede giocatore del riepilogo trasferimenti incomplete');
  assert(/winter-transfer-role/.test(app) && /<small>RUOLO<\/small>/.test(app), 'OVR e ruolo non sono separati nel riepilogo trasferimenti');
  assert(/shopItemActive\('scout_plus'/.test(app) && /shopItemActive\('fantadata_pro'/.test(app), 'Dati premium non applicati al riepilogo trasferimenti');
  assert(/aria-pressed="\$\{isSelected\}"/.test(app) && /SELEZIONATO/.test(app), 'Stato visivo e accessibile degli svincoli assente');
  assert(/winter-release-stats/.test(app) && /stat\.appearances/.test(app) && /stat\.starts/.test(app) && /stat\.minutes/.test(app), 'Statistiche stagionali assenti dalle scelte di svincolo');
  assert(/state\.winterMarketFlow\.stage='completed'/.test(app), 'Conclusione mini asta non ripristina la stagione');
});


test('Pool estero: 300 giocatori nascosti, persistenti e consumabili dal mercato', () => {
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(transferEngineSource,context,{filename:'js/transfer-engine.js'});
  const engine=context.window.FantaTransferEngine;
  assert(typeof engine.generateForeignPool==='function' && typeof engine.foreignPoolSummary==='function', 'API pool estero assente');
  const first=engine.generateForeignPool('foreign-pool-test');
  const second=engine.generateForeignPool('foreign-pool-test');
  assert(first.length===300, `Dimensione pool estero inattesa: ${first.length}`);
  assert(JSON.stringify(first)===JSON.stringify(second), 'Il pool estero non e deterministico');
  assert(new Set(first.map(player=>player.id)).size===first.length, 'ID duplicati nel pool estero');
  assert(first.every(player=>player.hidden===true && player.marketStatus==='foreign_pool' && player.club==='estero'), 'Giocatori esteri non correttamente nascosti');
  assert(first.every(player=>player.name && player.nation && player.sourceLeague && ['P','D','C','A'].includes(player.role)), 'Dati anagrafici del pool estero incompleti');
  assert(first.every(player=>Number(player.age)>=18 && Number(player.age)<=32 && Number(player.potentialOvr)>=Number(player.ovr)), 'Eta/potenziale del pool estero incoerenti');
  const summary=engine.foreignPoolSummary(first);
  assert(summary.available===300 && Object.values(summary.roles).every(count=>count>0), 'Distribuzione ruoli pool estero non valida');
  const market=engine.createMarketState('foreign-pool-test');
  assert(Array.isArray(market.foreignPool) && market.foreignPool.length===300, 'Il pool estero non viene salvato nello stato mercato');
  const candidate=market.foreignPool.find(player=>player.role==='C');
  const applied=engine.applyPlan(market,{id:'arrival-test',windowType:'winter',operations:[{type:'arrival',playerId:candidate.id,toClub:'inter'}]});
  const consumed=applied.foreignPool.find(player=>player.id===candidate.id);
  assert(consumed.marketStatus==='serie_a' && consumed.hidden===false && consumed.club==='inter', 'Un nuovo arrivo non esce correttamente dal pool nascosto');
  assert(/market\.foreignPool=TransferEngine\.generateForeignPool/.test(app), 'Migrazione pool estero sui salvataggi esistenti assente');
  assert(/hiddenForeignPool/.test(app), 'Il motore mercato non usa automaticamente il pool estero della carriera');
});

test('Profili esteri: nomi fissi, caratteristiche casuali per carriera e FVM calcolato', () => {
  const context={window:{FANTA_FOREIGN_PLAYERS:JSON.parse(JSON.stringify(database.foreignPlayers))}};
  vm.createContext(context);
  vm.runInContext(transferEngineSource,context,{filename:'js/transfer-engine.js'});
  const engine=context.window.FantaTransferEngine;
  const careerA=engine.generateForeignPool('career-a');
  const careerARepeat=engine.generateForeignPool('career-a');
  const careerB=engine.generateForeignPool('career-b');
  assert(JSON.stringify(careerA)===JSON.stringify(careerARepeat), 'Lo stesso salvataggio cambia i profili esteri');
  assert(careerA.every((player,index)=>player.name===foreignDatabase.players[index].name), 'I nomi fissi non vengono rispettati');
  const changed=careerA.filter((player,index)=>{
    const other=careerB[index];
    return player.role!==other.role || player.age!==other.age || player.ovr!==other.ovr || player.potentialOvr!==other.potentialOvr || player.nation!==other.nation;
  });
  assert(changed.length>200, `Profili troppo simili tra carriere: soltanto ${changed.length} differenze`);
  careerA.forEach(player=>{
    const expected=engine._test.foreignEconomy(player.role,player.ovr,player.age,player.potentialOvr);
    assert(player.quotation===expected.quotation && player.fvm===expected.fvm, `Economia non calcolata dai dati casuali per ${player.name}`);
  });
});



test('Aggiornamento mondo Serie A: club, listone, arrivi, partenze e forza club', () => {
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(transferEngineSource,context,{filename:'js/transfer-engine.js'});
  const engine=context.window.FantaTransferEngine;
  assert(typeof engine.materializeWorldPlayers==='function' && typeof engine.buildClubWorldMetrics==='function', 'API aggiornamento mondo assente');
  const base=[
    {id:'p1',name:'Interno',role:'D',roleLabel:'Difensore',ovr:80,club:'a'},
    {id:'p2',name:'Partente',role:'A',roleLabel:'Attaccante',ovr:82,club:'b'},
    {id:'p3',name:'Fermo',role:'C',roleLabel:'Centrocampista',ovr:76,club:'a'}
  ];
  const clubs=[{id:'a'},{id:'b'}];
  const market=engine.createMarketState('world-test');
  const incoming=market.foreignPool.find(player=>player.role==='A');
  const plan={id:'world-window',windowType:'winter',operations:[
    {type:'internal',playerId:'p1',fromClub:'a',toClub:'b'},
    {type:'abroad',playerId:'p2',fromClub:'b',toClub:null},
    {type:'arrival',playerId:incoming.id,fromClub:null,toClub:'a'}
  ]};
  const applied=engine.applyPlan(market,plan);
  const world=engine.materializeWorldPlayers(base,applied);
  assert(world.activePlayers.some(player=>player.id==='p1' && player.club==='b'), 'Trasferimento interno non modifica il club nel mondo');
  assert(!world.activePlayers.some(player=>player.id==='p2') && world.abroadPlayers.some(player=>player.id==='p2' && player.marketStatus==='abroad'), 'Partenza estero non rimuove il giocatore dal listone attivo');
  assert(world.activePlayers.some(player=>player.id===incoming.id && player.club==='a' && player.hidden===false), 'Nuovo arrivo non entra nel mondo Serie A');
  const departedIncoming=engine.applyPlan(applied,{id:'world-window-2',windowType:'summer',operations:[
    {type:'abroad',playerId:incoming.id,fromClub:'a',toClub:null}
  ]});
  const worldAfterIncomingDeparture=engine.materializeWorldPlayers(base,departedIncoming);
  assert(!worldAfterIncomingDeparture.activePlayers.some(player=>player.id===incoming.id), 'Un giocatore arrivato dal pool estero ricompare dopo una successiva partenza all estero');
  const metrics=engine.buildClubWorldMetrics(world.activePlayers,clubs);
  assert(metrics.a && metrics.b && metrics.a.rosterSize>0 && metrics.b.rosterSize>0, 'Metriche rose club non ricostruite');
  assert(/function\s+syncSerieATransferWorld\s*\(/.test(app), 'Orchestratore mondo Serie A assente');
  assert(/market\.worldClubMetrics=TransferEngine\.buildClubWorldMetrics/.test(app), 'Forza club non aggiornata dopo il mercato');
  assert(/label:'FUORI SERIE A'/.test(app), 'Giocatore ceduto all estero non viene reso indisponibile nel fantasy');
  assert(/transferMarket\?\.worldRevision/.test(app), 'Cache forza Serie A non reagisce ai trasferimenti');
});


test('Consumabili: acquisto multiplo, inventario e utilizzi contestuali', () => {
  const ids=new Set(htmlIds(html));
  ['consumableModal','consumableInventoryGrid','formationEventRerollBtn','adminRuleRerollBtn','winterGuaranteedSaleBtn'].forEach(id=>assert(ids.has(id),`UI consumabili assente: ${id}`));
  assert(/data-open-consumable-inventory/.test(html), 'Pulsante Inventario header assente');
  assert(/data-consumable-inventory-count/.test(html), 'Contatore Inventario header assente');
  ['cons_reroll_admin','cons_starter_report','cons_training','cons_reroll_event','cons_guaranteed_sale','cons_opponent_block'].forEach(id=>assert(new RegExp(`${id}:[\\s\\S]{0,360}consumable:true`).test(app),`Definizione consumabile assente: ${id}`));
  assert(/currency:'fp'/.test(app) && /career\.fantapoints=careerFantapoints\(\)-cost/.test(app), 'I consumabili non usano i Fantapoints');
  assert(/function\s+ensureConsumableState\s*\(/.test(app) && /function\s+consumeConsumable\s*\(/.test(app), 'Inventario consumabili non persistente');
  assert(/function\s+rerollFormationChoiceCards\s*\(/.test(app) && /generateFormationChoiceOptions\(day,`reroll-\$\{count\}`\)/.test(app), 'Reroll carte evento non collegato');
  assert(/function\s+rerollAdminRuleCard\s*\(/.test(app) && /generateAdminRuleOption\(day,`reroll-\$\{count\}`/.test(app), 'Reroll Admin non collegato');
  assert(/starterReportActive/.test(app) && /is-consumable-report/.test(app), 'Report titolarita giornata non applicato alla formazione');
  assert(/specialTrainingPlayerId/.test(app) && /merged\.voteDelta=.*\.25/.test(app) && /merged\.goalMultiplier/.test(app), 'Allenamento speciale non modifica il motore partita');
  assert(/specialTrainingPlayerIds/.test(app) && /specialTrainingUsedForPlayer/.test(app) && /trainingPlayerIds/.test(app) && /GIÀ ALLENATO/.test(app), 'Allenamento speciale non supporta usi multipli su giocatori diversi nella stessa giornata');
  assert(/blockedOpponentPlayerId/.test(app) && /enforceOpponentConsumableBlock/.test(app), 'Blocco giocatore avversario non applicato alla CPU');
  assert(/function\s+useGuaranteedWinterSale\s*\(/.test(app) && /item\.price\|\|item\.quotation/.test(app), 'Cessione garantita invernale non implementata');
});

Promise.all(pendingTests).then(()=>{
  const passed=results.filter(result=>result.ok).length;
  const failed=results.length-passed;
  console.log('\nFANTALLENATORE - TEST AUTOMATICI\n');
  for(const result of results){
    console.log(`${result.ok?'[OK]':'[ERRORE]'} ${result.name}`);
    if(!result.ok) console.log(`         ${result.error}`);
  }
  console.log(`\nRisultato: ${passed}/${results.length} test superati.`);
  if(failed){
    console.error(`Sono presenti ${failed} regressioni. La build NON e pronta per la consegna.`);
    process.exitCode=1;
  }else console.log('Nessuna regressione rilevata.');
});


test('Sostituzioni fantasy: anche un titolare reale SV viene sostituito', () => {
  assert(/const noVote=minute>=90 && minutes<rules\.minVoteMinutes && !decisivePerformance\(perf\);/.test(app), 'Il calcolo SV esclude ancora i titolari reali');
  assert(/if\(!original\.noVote \|\| minute<90\)/.test(app), 'La sostituzione non usa lo stato SV del titolare fantasy');
  assert(/const validBench=bench\.filter\(p=>\{[\s\S]*?return !perf\.noVote;/.test(app), 'La panchina non filtra correttamente i sostituti con voto');
});


test('Eventi rari/epici: nuove carte speciali presenti', () => {
  const app = fs.readFileSync(path.join(ROOT, 'app_v302.js'), 'utf8');
  assert(app.includes("id:'boost-penalty-specialist'"), 'Manca Rigorista d’eccezione');
  assert(app.includes("id:'boost-grace-moment'"), 'Manca Momento di grazia');
  assert(app.includes("id:'boost-life-chance'"), 'Manca Occasione della vita');
  assert(app.includes("id:'malus-high-tension'"), 'Manca Partita ad altissima tensione');
});


test('Power-up Eventi Speciali: sblocca il pool raro/epico dedicato', () => {
  assert(/id:'special_events',name:'Eventi Speciali'/.test(app), 'Power-up Eventi Speciali assente');
  assert(/SPECIAL_FORMATION_EVENT_TEMPLATE_IDS/.test(app), 'Pool eventi speciali non definito');
  assert(/shopItemActive\('special_events'\)/.test(app), 'Sblocco eventi speciali non collegato allo shop');
  assert(/function\s+formationRaritiesUnlocked\s*\(/.test(app) && /allowSpecial \|\| !SPECIAL_FORMATION_EVENT_TEMPLATE_IDS\.has\(String\(template\.id\)\)/.test(app), 'Gli eventi rari/epici non risultano protetti dallo sblocco');
});


test('Carriera multi-stagione: recap, mercato estivo e nuova asta collegati', () => {
  const ids=new Set(htmlIds(html));
  ['nextSeasonScreen','nextSeasonRecapGrid','nextSeasonMarketCard','nextSeasonMarketStats','nextSeasonTransferList','nextSeasonPrimaryBtn'].forEach(id=>assert(ids.has(id),`UI passaggio stagione assente: ${id}`));
  assert(/function\s+ensureNextSeasonFlow\s*\(/.test(app), 'Flusso nuova stagione assente');
  assert(/generateSerieATransferWindowPlan\('summer'\)/.test(app), 'Mercato estivo non collegato al passaggio stagione');
  assert(/flow\.stage='market_summary'/.test(app), 'Recap mercato estivo non viene raggiunto');
  assert(/openNextSeasonAuctionSetup/.test(app) && /showCareerSetupStep\('powers'\)/.test(app), 'La nuova stagione non riparte dalla scelta Fantapoteri');
  assert(/leagueRules:flow\.preAuctionRules.*defaultLeagueRules\(\)/.test(app), 'Il regolamento Admin non viene rigenerato per la nuova stagione');
  assert(/freshManagers\(state\.teamName/.test(app), 'I nuovi avversari non vengono rigenerati');
});

test('Carriera: dalla Lega Amatori alla Serie A', () => {
  assert(/4:'Lega Amatori',3:'Serie C',2:'Serie B',1:'Serie A'/.test(app), 'Serie A non presente nella mappatura carriera');
  assert(/const promoted=position===1 && currentDivision>1/.test(app), 'Il primo in Serie C non viene promosso');
  assert(/const champion=position===1 && currentDivision===1/.test(app), 'Titolo Serie A non gestito');
  assert(/promosso in \$\{careerDivisionLabel\(value-1\)\}/.test(app), 'Nota promozione dinamica assente');
  assert(/campione della Serie A/.test(app), 'Nota campione Serie A assente');
  assert(/9 nuovi avversari e una nuova asta/.test(app), 'Ripartenza post titolo Serie A non esplicitata');
});

test('Carriera multi-stagione: OVR finali diventano nuova base permanente', () => {
  assert(/function\s+finalizeCompletedSeasonOvrBases\s*\(/.test(app), 'Consolidamento OVR di fine stagione assente');
  assert(/state\.playerBaseOvr\[String\(id\)\]=finalOvr/.test(app), 'OVR finale non salvato come nuova base');
  assert(/season\.playerOvrDevelopment=\{\}/.test(app), 'Delta OVR stagionale non viene azzerato dopo il consolidamento');
  assert(/const baseOvr=source\.playerBaseOvr/.test(app) && /ovr:override,overall:override/.test(app), 'La nuova base OVR non viene riapplicata al mondo Serie A');
});

test('Carriera multi-stagione: promozione, storico e inventario persistono', () => {
  assert(/4:'Lega Amatori',3:'Serie C',2:'Serie B',1:'Serie A'/.test(app), 'Mappatura categorie carriera assente');
  assert(/const promoted=position===1 && currentDivision>1/.test(app), 'Promozione del primo classificato non implementata');
  assert(/career\.seasonHistory/.test(app), 'Storico stagioni carriera assente');
  assert(/carryoverConsumables:inventory/.test(app), 'Inventario consumabili non viene portato alla stagione successiva');
  assert(/consumables:\{inventory:\{\.\.\.\(state\.carryoverConsumables\|\|\{\}\)\}/.test(app), 'Inventario non viene ripristinato all avvio della nuova stagione');
});


test('Serie A reale: forza reparto e probabilita gol dinamiche', () => {
  assert(/const SERIEA_UNIT_WEIGHTS=/.test(app), 'Pesi separati attacco/difesa/controllo assenti');
  assert(/function\s+serieATeamUnitProfile\s*\(/.test(app), 'Profilo dinamico di squadra assente');
  assert(/function\s+serieAGoalProbability\s*\(/.test(app), 'Probabilita gol per matchup assente');
  assert(/serieATeamUnitProfile\(activePerformances\(own,minute\)\)/.test(app), 'Forza offensiva non viene ricalcolata minuto per minuto');
  assert(/serieATeamUnitProfile\(activePerformances\(opp,minute\)\)/.test(app), 'Forza difensiva avversaria non viene ricalcolata minuto per minuto');
  assert(/missing\*4\.2/.test(app) && /numericalEdge/.test(app), 'Espulsioni non incidono abbastanza sul motore risultato');
  assert(!/\.0128\+diff\*\.00042/.test(app), 'Vecchia formula OVR medio ancora attiva');
  assert(/penaltyConversion=clamp\(\.76\+\(takerOvr-keeperOvr\)\*\.003/.test(app), 'Rigori non tengono conto di tiratore e portiere');
});

test('Power-up Esperti Pro: aumenta nettamente la precisione senza renderla infallibile', () => {
  assert(/id:'expert_precision'/.test(app), 'Power-up Esperti Pro assente dal negozio');
  assert(/expertPrecisionActive/.test(app), 'Esperti Pro non collegato al motore esperti');
  assert(/proAccuracy:\.88/.test(app) && /proAccuracy:\.78/.test(app) && /proAccuracy:\.92/.test(app) && /proAccuracy:\.72/.test(app), 'Precisioni potenziate degli intuitivi non configurate');
  assert(/expertPrecisionScoreBonus/.test(app) && /score \+= expertPrecisionScoreBonus/.test(app), 'Gli esperti analitici non ricevono il segnale di precisione');
});

test('Sette esperti: tre per giornata, sorprese nascoste e consigli fallibili', () => {
  const first=app.indexOf('  const EXPERT_IDS='),end=app.indexOf('  function renderExpertAdvice(){',first);
  const modifier=app.indexOf('  function worldPlayerModifier('),modifierEnd=app.indexOf('  function formationPlayerModifier(',modifier);
  assert(first>=0&&end>first&&modifier>=0&&modifierEnd>modifier,'Motore esperti o collegamento ai bonus assente');
  const roster=Array.from({length:25},(_,index)=>({id:`test-${index}`}));
  const create=()=>{
    const state={marketSeed:'test-experts',career:{seasonNumber:1},season:{currentMatchday:1},managers:[{id:'user',roster}]};
    const hash=value=>{let h=2166136261;for(const char of value){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}return ((h>>>0)%100000)/100000;};
    const context={state,playerMap:new Map(roster.map(player=>[player.id,player])),managerById:()=>state.managers[0],playerStatusForDay:()=>({unavailable:false}),careerHash:key=>hash(`${state.marketSeed}|${key}`),activeFormationChoice:()=>null,specialTrainingPlayerId:()=>null,specialTrainingUsedForPlayer:()=>false};
    vm.createContext(context);
    vm.runInContext(app.slice(first,end)+app.slice(modifier,modifierEnd)+'\nthis.expertApi={expertDayState,worldPlayerModifier};',context);
    return context.expertApi;
  };
  const a=create(),b=create(),seen=new Set();let correct=0,incorrect=0,daysWithBoost=0,daysWithoutBoost=0;
  for(let day=1;day<=38;day++){
    const x=a.expertDayState(day);
    assert(JSON.stringify(x)===JSON.stringify(b.expertDayState(day)),`Giornata ${day} instabile al ricaricamento`);
    assert(x.experts.length===3&&new Set(x.experts).size===3,'Devono apparire tre esperti diversi');
    x.experts.forEach(id=>seen.add(id));
    if(x.boosts.length) daysWithBoost++;else daysWithoutBoost++;
    Object.values(x.forecasts).forEach(forecast=>{
      if(x.boosts.some(boost=>boost.playerId===forecast.playerId&&boost.kind===forecast.kind))correct++;
      else incorrect++;
    });
    x.boosts.forEach(boost=>{
      const effect=a.worldPlayerModifier(day,boost.playerId);
      assert(effect&&(effect.starterScoreDelta||effect.voteDelta||effect.goalMultiplier||effect.assistMultiplier),'Boost nascosto non applicato al motore');
    });
    assert(a.expertDayState(day)===x,'Riaprire la giornata cambia gli esperti');
  }
  assert(seen.size===7,'Non tutte le sette figure possono apparire');
  assert(daysWithBoost>0&&daysWithoutBoost>0&&correct>0&&incorrect>0,'Le intuizioni sono sempre corrette o sempre sbagliate');
});

test('Scambi post asta: rose, ruoli, crediti e limiti restano coerenti', () => {
  const begin=app.indexOf('  function currentTradeWindow('),end=app.indexOf('  function leagueRoleAverage(',begin);
  assert(begin>=0&&end>begin,'Motore degli scambi assente');
  const me={id:'user',team:'Utente',budget:25,roster:[{id:'p1',name:'Mio',role:'C',price:8,ovr:75}]};
  const cpu={id:'cpu1',team:'CPU',budget:10,roster:[{id:'p2',name:'Rivale',role:'C',price:15,ovr:79}]};
  const context={state:{managers:[me,cpu],career:{seasonNumber:1},tradeBudgetAdjustments:{},tradeWindows:{}},
    managerById:id=>[me,cpu].find(m=>m.id===id),saveState:()=>true};
  vm.createContext(context);
  vm.runInContext(app.slice(begin,end)+'\nthis.completeTrade=completeTrade;this.currentTradeWindow=currentTradeWindow;',context);
  const trade=context.currentTradeWindow('summer');
  assert(context.completeTrade({me,rival:cpu,outgoing:me.roster[0],incoming:cpu.roster[0],credits:100},trade)===false,'Offerta sopra budget accettata');
  const offer={me,rival:cpu,outgoing:me.roster[0],incoming:cpu.roster[0],credits:5};
  assert(context.completeTrade(offer,trade)===true,'Scambio valido rifiutato');
  assert(me.roster[0].id==='p2'&&cpu.roster[0].id==='p1'&&me.budget===20&&cpu.budget===15,'Scambio o trasferimento crediti errato');
  assert(500-me.roster[0].price+context.state.tradeBudgetAdjustments.user===500-8-5,'Contabilita acquisti dello scambio errata');
  assert(trade.completed===1&&trade.history.length===1,'Storico scambi incompleto');
  assert(context.completeTrade(offer,trade)===false,'Lo stesso giocatore puo essere scambiato due volte');
});

test('Scambi invernali: contabilità e formazione vengono aggiornate', () => {
  const begin=app.indexOf('  function currentTradeWindow('),end=app.indexOf('  function leagueRoleAverage(',begin);
  const me={id:'user',team:'Utente',budget:14,roster:[{id:'a1',name:'A',role:'A',price:7}]};
  const cpu={id:'cpu1',team:'CPU',budget:6,roster:[{id:'a2',name:'B',role:'A',price:11}]};
  const ledger={user:{tradeCashDelta:0},cpu1:{tradeCashDelta:0}};
  const state={managers:[me,cpu],career:{seasonNumber:1},tradeBudgetAdjustments:{},tradeWindows:{},
    winterMarketFlow:{stage:'trades',ledger,finalBudgets:{}},
    season:{currentMatchday:20,lineups:{'20':{user:{}}},assistantCoachLineup:{enabled:true}}};
  const context={state,managerById:id=>[me,cpu].find(m=>m.id===id),winterLedgerFor:id=>ledger[id],saveState:()=>true};
  vm.createContext(context);
  vm.runInContext(app.slice(begin,end)+'\nthis.completeTrade=completeTrade;this.currentTradeWindow=currentTradeWindow;',context);
  const result=context.completeTrade({me,rival:cpu,outgoing:me.roster[0],incoming:cpu.roster[0],credits:4},context.currentTradeWindow('winter'));
  assert(result===true&&me.budget===10&&cpu.budget===10,'Crediti dello scambio invernale errati');
  assert(ledger.user.tradeCashDelta===-4&&ledger.cpu1.tradeCashDelta===4,'Ledger invernale non aggiornato');
  assert(!state.season.lineups['20']&&state.season.assistantCoachLineup.enabled,'Formazione precedente non invalidata');
});

test('Scambi: filtri, ordinamenti e motivazione della controproposta', () => {
  const filterStart=app.indexOf('  function tradeFilteredRoster('),filterEnd=app.indexOf('  function renderTradeRosterChoices(',filterStart);
  const counterStart=app.indexOf('  function tradeCpuDecision('),counterEnd=app.indexOf('  function completeTrade(',counterStart);
  assert(filterStart>=0&&filterEnd>filterStart&&counterStart>=0&&counterEnd>counterStart,'Filtri o controproposte assenti');
  const context={currentPlayerOvr:p=>p.ovr,tradePlayerWorth:p=>p.ovr,careerHash:()=>.5,ROLE_PLURALS:{C:'Centrocampisti'}};
  vm.createContext(context);
  vm.runInContext(app.slice(filterStart,filterEnd)+app.slice(app.indexOf('  function tradeLineupStrength('),app.indexOf('  function tradePlayerWorth('))+app.slice(counterStart,counterEnd)+'\nthis.filter=tradeFilteredRoster;this.counter=tradeCpuDecision;',context);
  const roster=[{id:'a',name:'Zeta',role:'C',ovr:82,price:6},{id:'b',name:'Alfa',role:'C',ovr:75,price:45},{id:'c',name:'Beta',role:'A',ovr:91,price:19}];
  assert(context.filter(roster,'compatible','ovr','C').map(p=>p.id).join(',')==='a,b','Filtro compatibile errato');
  assert(context.filter(roster,'all','price').map(p=>p.id).join(',')==='b,c,a','Ordine costo errato');
  assert(context.filter(roster,'C','name').map(p=>p.id).join(',')==='b,a','Ordine nome errato');
  const star={id:'star',role:'C',ovr:85};
  const offer={me:{budget:40},rival:{id:'cpu1',roster:[star,{id:'reserve',role:'C',ovr:70}]},outgoing:{id:'mine',role:'C',ovr:75},incoming:star,credits:10};
  const decision=context.counter(offer,{seasonNumber:1,kind:'summer',attempts:1});
  assert(decision.type==='counter'&&decision.credits>0&&decision.reason.includes('migliori'),'Controproposta senza motivo coerente');
  const weak={...offer,outgoing:{id:'weak',role:'C',ovr:60},credits:0};
  assert(context.counter(weak,{seasonNumber:1,kind:'summer',attempts:1}).type==='reject','La CPU cede il suo migliore per un giocatore debole senza conguaglio adeguato');
  const fair={...offer,outgoing:{id:'fair',role:'C',ovr:84},incoming:{id:'other',role:'C',ovr:83},credits:0,
    rival:{id:'cpu1',roster:[{id:'other',role:'C',ovr:83},star]}};
  assert(context.counter(fair,{seasonNumber:1,kind:'summer',attempts:1}).type==='accept','Uno scambio favorevole alla CPU viene sempre rifiutato');
});

test('Figlio del mister: gennaio garantito, identità e pool separato', () => {
  const start=app.indexOf('  function ensureMisterJunior(');
  const end=app.indexOf('  function registerSerieATransferWindowPlan(',start);
  assert(start>=0&&end>start,'Generazione del figlio del mister mancante');
  const market={foreignPool:[{id:'foreign-1',marketStatus:'foreign_pool'}],specialPlayers:[]};
  const state={managerName:'Filippo',marketSeed:'carriera',career:{seasonNumber:2},transferMarket:market};
  const context={state,ensureSerieATransferMarket:()=>market,ROLE_ORDER:['P','D','C','A'],ROLE_LABELS:{P:'Portiere',D:'Difensore',C:'Centrocampista',A:'Attaccante'},
    careerHash:key=>{let hash=0;for(const ch of key)hash=(hash*31+ch.charCodeAt(0))>>>0;return hash/4294967296;},
    window:{FANTA_CLUBS:[{id:'milan'},{id:'inter'}],FANTA_PLAYERS:[]},
    TransferEngine:{planWindow:({windowType})=>({id:'winter-S2',windowType,operations:[{id:'old',type:'arrival',playerId:'foreign-1'}],counts:{arrivals:1}})},
    serieATransferStatsSnapshot:()=>({})};
  vm.createContext(context);
  vm.runInContext(app.slice(start,end)+'\nthis.generate=generateSerieATransferWindowPlan;',context);
  const plan=context.generate('winter');
  const junior=market.specialPlayers[0];
  assert(junior?.name==='Filippo Junior'&&junior.juniorSeason===2&&junior.ovr>=65&&junior.ovr<=90,'Identità o valori del Junior non validi');
  assert(plan.operations.filter(op=>op.playerId===junior.id).length===1&&plan.operations.length===1,'Arrivo di gennaio non garantito o duplicato');
  context.generate('winter');
  assert(market.specialPlayers.length===1&&market.foreignPool.length===1,'Il Junior viene duplicato o inserito nei foreign players');
  context.state.career.seasonNumber=3;
  context.generate('winter');
  assert(market.specialPlayers.length===1,'Il Junior viene ricreato nella stagione successiva');
  assert(!context.generate('winter').operations.some(op=>op.reason==='mister_junior'),'Secondo debutto del Junior');
  junior.marketStatus='active';
  context.state.career.seasonNumber=2;
  assert(!context.generate('winter').operations.some(op=>op.reason==='mister_junior'),'Junior già arrivato richiamato dal settore giovanile');
  assert(!context.generate('summer').operations.some(op=>op.reason==='mister_junior'),'Debutto del Junior in estate');
});

test('Avvio carriera: levetta Pokémon alterna il listone prima dell’asta', () => {
  const html=read('index.html');
  assert(html.includes('id="careerPokemonToggle"')&&html.includes('type="checkbox"'),'Levetta Pokémon assente dal primo passo');
  const start=app.indexOf('  function setInitialCareerCatalog('),end=app.indexOf('  function showCareerTeamSubstep(',start);
  assert(start>=0&&end>start,'Gestione scelta iniziale del catalogo assente');
  const draft={marketSeed:'new-career',catalogMode:'base',availableIds:['classic'],transferMarket:{}};
  const players=[{id:'classic'}];
  const label={textContent:''};
  const context={careerDraft:draft,nextSeasonSetupMode:false,TransferEngine:{createMarketState:seed=>({seed})},
    activateCatalogBase:source=>{players.splice(0,players.length,{id:source.catalogMode==='pokemon'?'pikachu':'classic'});},
    syncSerieATransferWorld:()=>{},window:{FANTA_PLAYERS:players},$:id=>id==='careerCatalogModeHint'?label:null};
  vm.createContext(context);
  vm.runInContext(app.slice(start,end)+'\nthis.toggle=setInitialCareerCatalog;',context);
  context.toggle(true);
  assert(draft.catalogMode==='pokemon'&&draft.availableIds[0]==='pikachu'&&label.textContent.includes('ON'),'ON non attiva il listone Pokémon');
  context.toggle(false);
  assert(draft.catalogMode==='base'&&draft.availableIds[0]==='classic'&&label.textContent.includes('OFF'),'OFF non ripristina il listone classico');
});

test('Asta gennaio e multi-stagione: valori dinamici ricalcolati dopo mercato e OVR', () => {
  assert(/let\s+marketValueMap\s*=\s*buildMarketValueMap\(\)/.test(app), 'La mappa valori asta non e aggiornabile');
  assert(/function\s+comparableAuctionFvm\s*\(/.test(app), 'Valutazione comparabile per nuovi arrivi/evoluzione assente');
  assert(/basePlayerValueReference/.test(app), 'Riferimento OVR/FVM iniziale assente');
  assert(/function\s+refreshMarketValueMap\s*\(/.test(app), 'Refresh valori asta assente');
  assert(/world\.abroadPlayers\.forEach[\s\S]{0,300}refreshMarketValueMap\(source\)/.test(app), 'Il mercato Serie A non aggiorna i valori asta');
  assert(/peerMedian\*\.72/.test(app), 'I nuovi arrivi non ricevono un floor coerente con pari ruolo/OVR');
  assert(/peerMedian\*\.68/.test(app), 'La crescita OVR non viene riflessa nel valore asta');
  assert(!/marketValueMap\.get\(player\.id\)\s*\|\|\s*1/.test(app), 'Resta il vecchio fallback fisso a 1 credito');
});
