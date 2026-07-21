/* Fantaballa Season Engine — 15-test-api.js
 * API di test caricata esclusivamente da test-season-runner.html.
 * Non viene inclusa nelle pagine di gioco pubbliche.
 */
(() => {
  const TEST_API_VERSION = 1;
  const MODE = String(SEASON_CONFIG?.mode || 'unknown');
  const expected = MODE === 'real'
    ? { players: 455, clubs: 21, autoEvents: 4, decisions: 65 }
    : { players: 716, clubs: 37, autoEvents: 5, decisions: 69 };

  const clone = value => {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function mulberry32(seed) {
    let value = Number(seed) >>> 0;
    return function seededRandom() {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  async function withSeed(seed, callback) {
    const originalRandom = Math.random;
    Math.random = mulberry32(seed);
    try {
      return await callback();
    } finally {
      Math.random = originalRandom;
    }
  }

  function assert(condition, message, detail = '') {
    if (!condition) {
      const error = new Error(message || 'Asserzione non rispettata');
      error.detail = detail;
      throw error;
    }
  }

  function assertEqual(actual, expectedValue, message) {
    assert(
      Object.is(actual, expectedValue),
      message || `Atteso ${String(expectedValue)}, ricevuto ${String(actual)}`,
      `Atteso: ${JSON.stringify(expectedValue)}\nRicevuto: ${JSON.stringify(actual)}`
    );
  }

  function assertFiniteTree(value, path = 'state', seen = new WeakSet()) {
    if (value === null || value === undefined) return;
    if (typeof value === 'number') {
      assert(Number.isFinite(value), `Valore numerico non valido in ${path}`, String(value));
      return;
    }
    if (typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => assertFiniteTree(item, `${path}[${index}]`, seen));
      return;
    }
    Object.entries(value).forEach(([key, item]) => assertFiniteTree(item, `${path}.${key}`, seen));
  }

  function assertSerializable(value, label = 'dato') {
    let serialized = '';
    try {
      serialized = JSON.stringify(value);
    } catch (error) {
      throw new Error(`${label} non serializzabile: ${error.message}`);
    }
    assert(typeof serialized === 'string' && serialized.length > 1, `${label} serializzato in modo non valido`);
  }

  function validateRoster(roster = state?.draft?.roster || []) {
    assert(Array.isArray(roster), 'La rosa non è un array');
    assertEqual(roster.length, 14, 'La rosa deve contenere 14 giocatori');
    const ids = roster.map(entry => String(entry?.playerId || ''));
    assert(ids.every(Boolean), 'La rosa contiene un playerId vuoto');
    assertEqual(new Set(ids).size, ids.length, 'La rosa contiene giocatori duplicati');
    const starters = roster.filter(entry => !entry.bench);
    const bench = roster.filter(entry => entry.bench);
    assertEqual(starters.length, 11, 'La rosa deve contenere 11 titolari');
    assertEqual(bench.length, 3, 'La rosa deve contenere 3 riserve');
    starters.forEach(entry => {
      assert(entry.player, `Dati giocatore mancanti nello slot ${entry.slotId}`);
      assert(userCompatible(entry.player, entry.slot), `${entry.player.name} non è compatibile con ${entry.slot}`);
    });
    bench.forEach((entry, index) => {
      assertEqual(entry.slotId, `bench-${index + 1}`, 'Ordine degli slot panchina non valido');
    });
    return { starters: starters.length, bench: bench.length, uniquePlayers: new Set(ids).size };
  }

  function validateSchedule(schedule = state?.schedule || [], teamIds = state?.teams?.map(team => String(team.id)) || []) {
    assertEqual(teamIds.length, 20, 'Il campionato deve contenere 20 squadre');
    assertEqual(schedule.length, 38, 'Il calendario deve contenere 38 giornate');
    const pairCounts = new Map();
    const homeAway = new Map();
    schedule.forEach((round, roundIndex) => {
      assertEqual(round.length, 10, `La giornata ${roundIndex + 1} deve contenere 10 partite`);
      const seenTeams = new Set();
      round.forEach(match => {
        const home = String(match.home);
        const away = String(match.away);
        assert(home && away && home !== away, `Partita non valida alla giornata ${roundIndex + 1}`);
        assert(teamIds.includes(home) && teamIds.includes(away), `Squadra sconosciuta alla giornata ${roundIndex + 1}`);
        assert(!seenTeams.has(home) && !seenTeams.has(away), `Squadra duplicata nella giornata ${roundIndex + 1}`);
        seenTeams.add(home);
        seenTeams.add(away);
        const unordered = [home, away].sort().join('|');
        pairCounts.set(unordered, (pairCounts.get(unordered) || 0) + 1);
        homeAway.set(`${home}>${away}`, (homeAway.get(`${home}>${away}`) || 0) + 1);
      });
      assertEqual(seenTeams.size, 20, `Non tutte le squadre giocano alla giornata ${roundIndex + 1}`);
    });
    assertEqual(pairCounts.size, 190, 'Il calendario non contiene tutte le 190 coppie possibili');
    for (const [pair, count] of pairCounts) {
      assertEqual(count, 2, `La coppia ${pair} non si affronta due volte`);
      const [a, b] = pair.split('|');
      assertEqual(homeAway.get(`${a}>${b}`) || 0, 1, `Manca una gara ${a} in casa contro ${b}`);
      assertEqual(homeAway.get(`${b}>${a}`) || 0, 1, `Manca una gara ${b} in casa contro ${a}`);
    }
    return { rounds: schedule.length, fixtures: schedule.reduce((sum, round) => sum + round.length, 0), pairs: pairCounts.size };
  }

  function validateStandings(standings = state?.standings || {}, expectedPlayed = null) {
    const rows = Object.values(standings);
    assertEqual(rows.length, 20, 'La classifica deve contenere 20 squadre');
    rows.forEach(row => {
      ['p', 'w', 'd', 'l', 'gf', 'ga', 'pts'].forEach(key => {
        assert(Number.isFinite(Number(row[key])), `Valore ${key} non valido per ${row.name || row.id}`);
        assert(Number(row[key]) >= 0, `Valore ${key} negativo per ${row.name || row.id}`);
      });
      assertEqual(Number(row.p), Number(row.w) + Number(row.d) + Number(row.l), `Bilancio partite incoerente per ${row.name || row.id}`);
      if (expectedPlayed !== null) assertEqual(Number(row.p), expectedPlayed, `Partite giocate errate per ${row.name || row.id}`);
    });
    return rows;
  }

  function resetEngineState() {
    state = normalizeCampionatoState(freshState());
    state.teamName = MODE === 'real' ? 'Test REAL' : 'Test Community';
    state.coachName = 'Test automatico';
    state.coachType = 'anonymous';
    state.formation = '4-3-3';
    state.gameMode = 'normal';
    state.phase = 'setup';
    state.pendingEvent = null;
    closeRobustModal();
    return state;
  }

  async function buildSeason(seed = 1001) {
    resetEngineState();
    return withSeed(seed, async () => {
      const built = buildFullyRandomDraftRoster();
      assert(built, 'Impossibile generare una rosa casuale completa');
      validateRoster();
      const originalRandom = Math.random;
      Math.random = () => 0;
      try {
        finalizeDraft();
      } finally {
        Math.random = originalRandom;
      }
      assertEqual(state.phase, 'season', 'La stagione non è entrata nella fase campionato');
      validateSchedule();
      validateStandings();
      state.pendingEvent = { kind: 'none', resolved: true, title: 'Test', text: 'Evento disattivato per il test.' };
      return clone(state);
    });
  }

  function runTimersImmediately(callback) {
    const originalSetTimeout = window.setTimeout;
    const originalClearTimeout = window.clearTimeout;
    const queue = [];
    let nextTimerId = 1;
    window.setTimeout = (fn, delay = 0, ...args) => {
      const id = nextTimerId++;
      if (typeof fn === 'function') queue.push({ id, fn: () => fn(...args), delay: Number(delay) || 0, cancelled: false });
      return id;
    };
    window.clearTimeout = id => {
      const item = queue.find(entry => entry.id === id);
      if (item) item.cancelled = true;
    };
    try {
      callback();
      let executions = 0;
      while (queue.length) {
        const item = queue.shift();
        if (!item.cancelled) item.fn();
        executions += 1;
        assert(executions < 500, 'Coda dei timer apparentemente infinita');
      }
    } finally {
      window.setTimeout = originalSetTimeout;
      window.clearTimeout = originalClearTimeout;
    }
  }

  function playOneTestRound() {
    assertEqual(state.phase, 'season', 'La partita di test richiede la fase campionato');
    state.pendingEvent = { kind: 'none', resolved: true, title: 'Test', text: '' };
    const beforeMatchday = Number(state.matchday);
    const beforeHistory = state.history.length;
    runTimersImmediately(() => playRound('instant'));
    assertEqual(Number(state.matchday), beforeMatchday + 1, 'La giornata non è avanzata di una unità');
    assertEqual(state.history.length, beforeHistory + 1, 'La partita utente non è stata registrata nello storico');
    const result = state.history[state.history.length - 1];
    assert(result && Number.isInteger(Number(result.gf)) && Number.isInteger(Number(result.ga)), 'Risultato della partita non valido');
    assert(Number(result.gf) >= 0 && Number(result.ga) >= 0, 'Il risultato contiene gol negativi');
    assertSerializable(result, 'Risultato partita');
    assertFiniteTree(state);
    return result;
  }

  async function simulateRegularSeason(seed = 5001) {
    await buildSeason(seed);
    return withSeed(seed + 77, async () => {
      const target = seasonLength();
      let safety = 0;
      while (Number(state.matchday) < target) {
        safety += 1;
        assert(safety <= target + 4, 'La stagione non termina nel numero previsto di giornate');
        if (state.phase === 'midseason') {
          state.midseason.completed = true;
          state.midseason.autoCompleted = true;
          state.phase = 'season';
        }
        assertEqual(state.phase, 'season', `Fase inattesa prima della giornata ${state.matchday + 1}: ${state.phase}`);
        state.pendingEvent = { kind: 'none', resolved: true, title: 'Test', text: '' };
        playOneTestRound();
      }
      assertEqual(state.history.length, target, 'Lo storico non contiene tutte le partite della stagione regolare');
      validateStandings(state.standings, target);
      assertFiniteTree(state);
      assertSerializable(state, 'Stato finale stagione');
      return {
        matchdays: state.matchday,
        history: state.history.length,
        phase: state.phase,
        leader: sortedTable()[0]?.name || ''
      };
    });
  }

  async function waitUntilReady(timeoutMs = 15000) {
    const started = performance.now();
    while (performance.now() - started < timeoutMs) {
      if (PLAYERS.length && CLUBS.length && window.FANTABALLA_SEASON_CONFIG) return true;
      await sleep(50);
    }
    throw new Error('Timeout durante il caricamento del motore e dei database');
  }

  function storageKeysForTest() {
    return [
      AUTO_SAVE_KEY,
      ACTIVE_SLOT_KEY,
      SETUP_TEAM_NAME_KEY,
      SETUP_COACH_NAME_KEY,
      SETUP_COACH_TYPE_KEY,
      SETUP_PALETTE_KEY,
      ...LEGACY_SAVE_KEYS,
      legacySlotKey(1),
      legacySlotKey(2),
      legacySlotKey(3)
    ];
  }

  function clearTestStorage() {
    const prefixes = storageKeysForTest();
    const allKeys = [];
    for (let index = 0; index < localStorage.length; index += 1) allKeys.push(localStorage.key(index));
    allKeys.filter(Boolean).forEach(key => {
      if (prefixes.includes(key) || prefixes.some(prefix => key.startsWith(`${prefix}_corrotto_`))) localStorage.removeItem(key);
    });
  }

  async function executeChoiceSmokeTests(baseState) {
    const failures = [];
    let executed = 0;
    let skipped = 0;
    for (let decisionIndex = 0; decisionIndex < DECISIONS.length; decisionIndex += 1) {
      const decision = DECISIONS[decisionIndex];
      let available = true;
      state = clone(baseState);
      state.matchday = 10;
      try {
        if (typeof decision.available === 'function') available = Boolean(decision.available());
      } catch (error) {
        failures.push(`${decision.id}: available() — ${error.message}`);
        continue;
      }
      if (!available) {
        skipped += decision.choices.length;
        continue;
      }
      let context = {};
      try {
        context = typeof decision.createContext === 'function' ? decision.createContext() : {};
      } catch (error) {
        failures.push(`${decision.id}: createContext() — ${error.message}`);
        continue;
      }
      for (let choiceIndex = 0; choiceIndex < decision.choices.length; choiceIndex += 1) {
        state = clone(baseState);
        state.matchday = 10;
        try {
          const result = applyDecisionChoice(decisionIndex, choiceIndex, clone(context || {}), decision.id);
          assert(typeof result === 'string', `${decision.id}/${choiceIndex}: risultato non testuale`);
          assertFiniteTree(state);
          assertSerializable(state, `${decision.id}/${choiceIndex}`);
          executed += 1;
        } catch (error) {
          failures.push(`${decision.id} → ${decision.choices[choiceIndex]?.label || choiceIndex}: ${error.message}`);
        }
      }
    }
    assert(!failures.length, `${failures.length} scelte evento hanno generato errori`, failures.slice(0, 30).join('\n'));
    return { executed, skipped, decisions: DECISIONS.length };
  }

  async function executeAutoEventSmokeTests(baseState) {
    const failures = [];
    let executed = 0;
    for (const event of AUTO_EVENTS) {
      state = clone(baseState);
      try {
        const result = event.apply();
        if (result && typeof result.then === 'function') await result;
        assertFiniteTree(state);
        assertSerializable(state, event.title);
        executed += 1;
      } catch (error) {
        failures.push(`${event.title}: ${error.message}`);
      }
    }
    assert(!failures.length, `${failures.length} eventi automatici hanno generato errori`, failures.join('\n'));
    return { executed };
  }

  function testDefinition(id, group, name, run, options = {}) {
    return { id, group, name, run, slow: Boolean(options.slow) };
  }

  function buildTests(options = {}) {
    const stressSeasons = Math.max(0, Math.min(20, Number(options.stressSeasons) || 0));
    const tests = [
      testDefinition('config-mode', 'Bootstrap', 'Configurazione della modalità', () => {
        assert(['community', 'real'].includes(MODE), `Modalità sconosciuta: ${MODE}`);
        assert(SEASON_CONFIG.storage.saveBase.includes('test_runner'), 'Le chiavi di salvataggio dei test non sono isolate');
        return { mode: MODE, saveBase: SEASON_CONFIG.storage.saveBase };
      }),
      testDefinition('database-load', 'Database', 'Caricamento e quantità dei dati', () => {
        assertEqual(PLAYERS.length, expected.players, 'Numero giocatori inatteso');
        assertEqual(CLUBS.length, expected.clubs, 'Numero club inatteso');
        assert(!dataDiagnostics.fatal.length, 'Il validatore segnala errori bloccanti', dataDiagnostics.fatal.join('\n'));
        return { players: PLAYERS.length, clubs: CLUBS.length, warnings: dataDiagnostics.warnings.length };
      }),
      testDefinition('database-identifiers', 'Database', 'Identificativi univoci e riferimenti club', () => {
        const playerIds = PLAYERS.map(player => String(player.id || ''));
        const clubIds = CLUBS.map(club => String(club.id || ''));
        assert(playerIds.every(Boolean), 'Sono presenti giocatori senza ID');
        assert(clubIds.every(Boolean), 'Sono presenti club senza ID');
        assertEqual(new Set(playerIds).size, playerIds.length, 'Sono presenti ID giocatore duplicati');
        assertEqual(new Set(clubIds).size, clubIds.length, 'Sono presenti ID club duplicati');
        const allowedClubs = new Set(clubIds);
        const missing = PLAYERS.filter(player => player.club && !allowedClubs.has(String(player.club))).slice(0, 20);
        assert(!missing.length, 'Alcuni giocatori fanno riferimento a club inesistenti', missing.map(player => `${player.name}: ${player.club}`).join('\n'));
        return { uniquePlayers: playerIds.length, uniqueClubs: clubIds.length };
      }),
      testDefinition('fresh-state', 'Stato', 'Struttura di una nuova stagione', () => {
        const fresh = freshState();
        assertEqual(fresh.version, CURRENT_STATE_VERSION, 'Versione iniziale dello stato errata');
        assertEqual(fresh.phase, 'setup', 'Una nuova partita deve iniziare dal setup');
        ['draft', 'seasonRules', 'quest', 'eventChains', 'analytics', 'stats', 'midseason', 'cup', 'story'].forEach(key => {
          assert(fresh[key] && typeof fresh[key] === 'object', `Sezione ${key} mancante nello stato iniziale`);
        });
        assertSerializable(fresh, 'Stato iniziale');
        assertFiniteTree(fresh);
        return { version: fresh.version, phase: fresh.phase };
      }),
      testDefinition('state-migration', 'Stato', 'Normalizzazione di un vecchio salvataggio', () => {
        const old = freshState();
        old.version = 1;
        old.phase = 'season';
        delete old.analytics;
        delete old.stats;
        delete old.cup;
        delete old.quest;
        delete old.eventChains;
        old.seasonRules = { winPoints: 4 };
        const normalized = normalizeCampionatoState(old);
        assertEqual(normalized.version, CURRENT_STATE_VERSION, 'La migrazione non aggiorna la versione');
        assertEqual(normalized.seasonRules.winPoints, 4, 'La migrazione perde i valori preesistenti');
        ['analytics', 'stats', 'cup', 'quest', 'eventChains'].forEach(key => assert(normalized[key], `La migrazione non ricrea ${key}`));
        assertSerializable(normalized, 'Stato migrato');
        return { from: 1, to: normalized.version };
      }),
      testDefinition('storage-roundtrip', 'Salvataggi', 'Salvataggio e rilettura senza perdita di dati', () => {
        resetEngineState();
        state.teamName = `Roundtrip ${MODE}`;
        state.coachName = 'Tester';
        state.meta.marker = `marker-${MODE}`;
        assert(save(), 'La funzione save() ha restituito false');
        const raw = localStorage.getItem(AUTO_SAVE_KEY);
        assert(raw, 'Il salvataggio non è stato scritto in localStorage');
        const parsed = JSON.parse(raw);
        assertEqual(parsed.teamName, state.teamName, 'Nome squadra perso nel salvataggio');
        assertEqual(parsed.meta.marker, state.meta.marker, 'Metadato perso nel salvataggio');
        const loaded = loadState();
        assertEqual(loaded.teamName, state.teamName, 'loadState() non rilegge il salvataggio corretto');
        return { bytes: raw.length, key: AUTO_SAVE_KEY };
      }),
      testDefinition('storage-corruption', 'Salvataggi', 'Isolamento di un salvataggio corrotto', () => {
        const key = `${AUTO_SAVE_KEY}_corruption_probe`;
        localStorage.setItem(key, '{json non valido');
        const beforeKeys = new Set(Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)));
        const result = parseStoredState(localStorage.getItem(key), key);
        assertEqual(result, null, 'Un salvataggio corrotto non deve essere accettato');
        assert(!localStorage.getItem(key), 'Il salvataggio corrotto originale non è stato rimosso');
        const afterKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
        const isolated = afterKeys.find(item => item && item.startsWith(`${key}_corrotto_`) && !beforeKeys.has(item));
        assert(isolated, 'Non è stata creata la copia isolata del salvataggio corrotto');
        localStorage.removeItem(isolated);
        return { isolated: true };
      }),
      testDefinition('formations', 'Formazioni', 'Coerenza tra moduli e posizioni grafiche', () => {
        const formationKeys = Object.keys(FORMATIONS);
        assertEqual(new Set(formationKeys).size, formationKeys.length, 'Formazioni duplicate');
        formationKeys.forEach(key => {
          assert(FORMATION_LAYOUTS[key], `Layout mancante per ${key}`);
          assertEqual(FORMATION_LAYOUTS[key].length, FORMATIONS[key].length, `Numero slot grafici diverso per ${key}`);
          const expectedLength = key === '4-4-4' ? 14 : key === '3-3-3' ? 9 : 11;
          assertEqual(FORMATIONS[key].length, expectedLength, `Numero giocatori inatteso per ${key}`);
        });
        return { formations: formationKeys.length };
      }),
      testDefinition('catalog-contract', 'Eventi', 'Contratto del catalogo eventi', () => {
        assertEqual(AUTO_EVENTS.length, expected.autoEvents, 'Numero eventi automatici inatteso');
        assertEqual(DECISIONS.length, expected.decisions, 'Numero decisioni inatteso');
        const ids = DECISIONS.map(decision => String(decision.id || ''));
        assert(ids.every(Boolean), 'Decisione senza ID');
        assertEqual(new Set(ids).size, ids.length, 'ID decisione duplicati');
        DECISIONS.forEach(decision => {
          assert(Array.isArray(decision.choices) && decision.choices.length >= 2, `${decision.id}: servono almeno due scelte`);
          decision.choices.forEach((choice, index) => {
            assert(String(choice.label || '').trim(), `${decision.id}/${index}: etichetta mancante`);
            assert(typeof choice.apply === 'function', `${decision.id}/${index}: funzione apply mancante`);
          });
        });
        if (MODE === 'real') {
          ['whatsapp-pubblicato', 'cuggino-influencer', 'tiktok-boomer', 'ma-che-mollo'].forEach(id => assert(!ids.includes(id), `${id} non deve comparire nel REAL`));
          assert(!AUTO_EVENTS.some(event => event.title === 'Sostegno degli abbonati'), 'Evento abbonati presente nel REAL');
        }
        return { autoEvents: AUTO_EVENTS.length, decisions: DECISIONS.length, choices: DECISIONS.reduce((sum, decision) => sum + decision.choices.length, 0) };
      }),
      testDefinition('draft-random', 'Draft', 'Generazione automatica di una rosa valida', async () => {
        resetEngineState();
        return withSeed(20260721, async () => {
          assert(buildFullyRandomDraftRoster(), 'La generazione casuale della rosa è fallita');
          return validateRoster();
        });
      }),
      testDefinition('season-start', 'Campionato', 'Creazione di squadre, classifica e calendario', async () => {
        const season = await buildSeason(2401);
        assertEqual(season.teams.length, 20, 'Numero squadre errato');
        assertEqual(Object.keys(season.standings).length, 20, 'Numero righe classifica errato');
        assertEqual(season.schedule.length, 38, 'Numero giornate errato');
        return { teams: season.teams.length, rounds: season.schedule.length };
      }),
      testDefinition('score-engine', 'Simulazione', 'Risultati validi e riproducibili', async () => {
        const first = await withSeed(98765, async () => Array.from({ length: 250 }, () => simulateScore(76, 73, 0.15, 90, 1)));
        const second = await withSeed(98765, async () => Array.from({ length: 250 }, () => simulateScore(76, 73, 0.15, 90, 1)));
        assertEqual(JSON.stringify(first), JSON.stringify(second), 'Lo stesso seed non produce gli stessi risultati');
        first.forEach(([home, away], index) => {
          assert(Number.isInteger(home) && Number.isInteger(away), `Risultato non intero al campione ${index}`);
          assert(home >= 0 && away >= 0, `Gol negativi al campione ${index}`);
        });
        assertEqual(JSON.stringify(simulateScore(80, 80, 0, 0, 1)), JSON.stringify([0, 0]), 'Una partita di durata zero deve finire 0-0');
        const totalGoals = first.reduce((sum, score) => sum + score[0] + score[1], 0);
        return { samples: first.length, averageGoals: Math.round((totalGoals / first.length) * 100) / 100 };
      }),
      testDefinition('standings-rules', 'Simulazione', 'Aggiornamento base della classifica', () => {
        resetEngineState();
        state.teams = [
          { id: USER_ID, name: state.teamName },
          { id: 'opponent-test', name: 'Avversario Test' }
        ];
        state.standings = {
          [USER_ID]: { id: USER_ID, name: state.teamName, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 },
          'opponent-test': { id: 'opponent-test', name: 'Avversario Test', p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }
        };
        updateStanding(USER_ID, 2, 1);
        updateStanding(USER_ID, 1, 1);
        updateStanding(USER_ID, 0, 3);
        const row = state.standings[USER_ID];
        assertEqual(row.p, 3, 'Partite giocate errate');
        assertEqual(row.w, 1, 'Vittorie errate');
        assertEqual(row.d, 1, 'Pareggi errati');
        assertEqual(row.l, 1, 'Sconfitte errate');
        assertEqual(row.pts, 4, 'Punti errati con regola standard 3/1/0');
        assertEqual(row.gf, 3, 'Gol fatti errati');
        assertEqual(row.ga, 5, 'Gol subiti errati');
        return row;
      }),
      testDefinition('single-match', 'Simulazione', 'Una giornata completa del campionato', async () => {
        await buildSeason(3031);
        const result = await withSeed(3032, async () => playOneTestRound());
        validateStandings();
        return { matchday: state.matchday, score: `${result.gf}-${result.ga}`, history: state.history.length };
      }),
      testDefinition('auto-events-smoke', 'Eventi', 'Esecuzione degli eventi automatici', async () => {
        const base = await buildSeason(4041);
        return executeAutoEventSmokeTests(base);
      }),
      testDefinition('decision-choices-smoke', 'Eventi', 'Esecuzione delle scelte attualmente eleggibili', async () => {
        const base = await buildSeason(4051);
        return executeChoiceSmokeTests(base);
      }, { slow: true }),
      testDefinition('full-season', 'Stress', 'Simulazione completa di 38 giornate', async () => simulateRegularSeason(6001), { slow: true })
    ];

    for (let index = 0; index < stressSeasons; index += 1) {
      tests.push(testDefinition(
        `stress-season-${index + 1}`,
        'Stress',
        `Stagione casuale aggiuntiva ${index + 1}/${stressSeasons}`,
        async () => simulateRegularSeason(7000 + index * 101),
        { slow: true }
      ));
    }
    tests.push(testDefinition('runtime-errors', 'Runtime', 'Assenza di errori JavaScript non gestiti', () => {
      const errors = Array.isArray(window.__FANTABALLA_TEST_RUNTIME_ERRORS) ? window.__FANTABALLA_TEST_RUNTIME_ERRORS : [];
      assert(!errors.length, `${errors.length} errori JavaScript non gestiti`, errors.map(item => `${item.type}: ${item.message}`).join('\n'));
      return { uncaughtErrors: 0 };
    }));
    return tests;
  }

  async function runSuite(options = {}) {
    await waitUntilReady();
    clearTestStorage();
    const includeSlow = options.includeSlow !== false;
    const tests = buildTests(options).filter(test => includeSlow || !test.slow);
    const results = [];
    const startedAt = new Date().toISOString();
    const suiteStarted = performance.now();

    for (let index = 0; index < tests.length; index += 1) {
      const test = tests[index];
      const started = performance.now();
      window.parent?.postMessage({ type: 'fantaballa-test-progress', mode: MODE, index, total: tests.length, test: { id: test.id, group: test.group, name: test.name } }, '*');
      try {
        const detail = await test.run();
        results.push({ id: test.id, group: test.group, name: test.name, status: 'pass', durationMs: Math.round(performance.now() - started), detail: detail ?? null });
      } catch (error) {
        results.push({
          id: test.id,
          group: test.group,
          name: test.name,
          status: 'fail',
          durationMs: Math.round(performance.now() - started),
          message: error?.message || String(error),
          detail: error?.detail || error?.stack || ''
        });
      }
    }

    clearTestStorage();
    const report = {
      apiVersion: TEST_API_VERSION,
      mode: MODE,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - suiteStarted),
      summary: {
        total: results.length,
        passed: results.filter(result => result.status === 'pass').length,
        failed: results.filter(result => result.status === 'fail').length
      },
      environment: {
        userAgent: navigator.userAgent,
        players: PLAYERS.length,
        clubs: CLUBS.length,
        autoEvents: AUTO_EVENTS.length,
        decisions: DECISIONS.length,
        engineVersion: CURRENT_STATE_VERSION
      },
      results
    };
    return report;
  }

  window.FantaballaSeasonTestAPI = {
    version: TEST_API_VERSION,
    mode: MODE,
    ready: waitUntilReady,
    runSuite,
    getOverview: () => ({
      mode: MODE,
      players: PLAYERS.length,
      clubs: CLUBS.length,
      autoEvents: AUTO_EVENTS.length,
      decisions: DECISIONS.length,
      stateVersion: CURRENT_STATE_VERSION
    })
  };

  window.parent?.postMessage({ type: 'fantaballa-test-runner-ready', mode: MODE }, '*');
})();
