/* Fantaballa Season Engine — 16-balance-api.js
 * Balance Lab caricato esclusivamente da balance-runner.html.
 * Esegue simulazioni ripetibili senza modificare i salvataggi reali.
 */
(() => {
  const API_VERSION = 1;
  const MODE = String(SEASON_CONFIG?.mode || 'unknown');
  const STANDARD_FORMATIONS = Object.keys(FORMATIONS).filter(key => !['2-4-4', '4-4-4', '3-3-3'].includes(key));
  const COACHES = COACH_PROFILES.map(profile => ({ id: profile.id, name: profile.name }));
  let cancelled = false;

  const originalRuntime = {
    save: typeof save === 'function' ? save : null,
    render: typeof render === 'function' ? render : null,
    toast: typeof toast === 'function' ? toast : null,
    showResultModal: typeof showResultModal === 'function' ? showResultModal : null,
    updateSaveStatus: typeof updateSaveStatus === 'function' ? updateSaveStatus : null
  };

  // Il runner è isolato: disattiviamo soltanto persistenza e rendering costoso.
  save = () => true;
  render = () => {};
  toast = () => {};
  showResultModal = () => {};
  updateSaveStatus = () => {};

  const clone = value => {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
  };

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

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'Asserzione non rispettata');
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
        assert(executions < 700, 'Coda timer apparentemente infinita');
      }
    } finally {
      window.setTimeout = originalSetTimeout;
      window.clearTimeout = originalClearTimeout;
    }
  }

  async function waitUntilReady(timeoutMs = 15000) {
    const started = performance.now();
    while (performance.now() - started < timeoutMs) {
      if (PLAYERS.length && CLUBS.length && DECISIONS.length && AUTO_EVENTS.length && window.FANTABALLA_SEASON_CONFIG) return true;
      await sleep(50);
    }
    throw new Error('Timeout durante il caricamento del motore');
  }

  function clearRunnerStorage() {
    const marker = String(SEASON_CONFIG?.storage?.saveBase || 'balance_runner');
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) keys.push(localStorage.key(index));
    keys.filter(Boolean).forEach(key => {
      if (key.includes(marker) || key.includes('_balance_runner')) localStorage.removeItem(key);
    });
  }

  function scenarioList(scope = 'all') {
    const scenarios = [];
    if (scope === 'all' || scope === 'coaches') {
      COACHES.forEach(coach => scenarios.push({
        key: `coach:${coach.id}`,
        group: 'coach',
        id: coach.id,
        label: coach.name,
        coachType: coach.id,
        formation: coach.id === 'three-five-two' ? '3-5-2' : '4-3-3'
      }));
    }
    if (scope === 'all' || scope === 'formations') {
      STANDARD_FORMATIONS.forEach(formation => scenarios.push({
        key: `formation:${formation}`,
        group: 'formation',
        id: formation,
        label: formation,
        coachType: 'anonymous',
        formation
      }));
    }
    return scenarios;
  }

  function allocateRuns(total, scenarios) {
    const minimum = Math.max(1, scenarios.length);
    const normalized = Math.max(minimum, Math.min(5000, Math.floor(Number(total) || minimum)));
    const base = Math.floor(normalized / scenarios.length);
    let remainder = normalized % scenarios.length;
    return scenarios.map(scenario => ({ ...scenario, runs: base + (remainder-- > 0 ? 1 : 0) }));
  }

  function resetSimulationState(scenario) {
    state = normalizeCampionatoState(freshState());
    state.teamName = `Balance ${MODE}`;
    state.coachName = scenario.label;
    state.coachType = normalizeCoachType(scenario.coachType);
    state.formation = FORMATIONS[scenario.formation] ? scenario.formation : '4-3-3';
    state.gameMode = 'normal';
    state.phase = 'setup';
    state.pendingEvent = null;
    state.seasonRules.autoDecisions = true;
    state.seasonRules.autoMidseason = true;
    state.seasonRules.botMidseason = true;
    syncCoachRestrictions();
  }

  function buildInitialRoster(scenario) {
    if (scenario.coachType === 'three-five-two') {
      const possible = draftPossibleClubs();
      const clubId = possible.length ? pick(possible) : '';
      return Boolean(clubId && buildThreeFiveTwoOpeningRoster(clubId));
    }
    return Boolean(buildFullyRandomDraftRoster());
  }

  function disableStoryArcs() {
    initializeMeritStory(false);
    initializeFantaballopoliStory(false);
    initializeError404Story(false);
    if (String(state.pendingEvent?.kind || '').startsWith('story')) {
      state.pendingEvent = null;
      prepareEvent();
    }
  }

  function resolveStoryEvent(storyLog) {
    const event = state.pendingEvent;
    if (!event || event.resolved || !String(event.kind || '').startsWith('story')) return false;
    let action = '';
    if (event.kind === 'storyError404') {
      const choices = event.storyType === 'opening' ? ['restart', 'continue'] : event.storyType === 'technician' ? ['install', 'ignore'] : ['restart'];
      action = pick(choices);
      storyLog.push({ title: event.title || 'Errore 404', choice: action, storyType: event.storyType || '' });
      resolveError404Action(action);
      return true;
    }
    if (event.kind === 'storyFantaballopoli') {
      const map = {
        opening: ['accept', 'reject'],
        part2: ['ack'],
        satisfaction: ['stop', 'more'],
        investigator: ['confess', 'deny'],
        accusation: ['blame', 'admit-both']
      };
      action = pick(map[event.storyType] || ['ack']);
      storyLog.push({ title: event.title || 'Fantaballopoli', choice: action, storyType: event.storyType || '' });
      resolveFantaballopoliAction(action);
      return true;
    }
    if (event.kind === 'storyMerit') {
      if (event.storyType === 'opening') {
        action = Math.random() < 0.5 ? 'reject' : 'promote';
        storyLog.push({ title: event.title || 'Merito di più!', choice: action, storyType: event.storyType || '' });
        if (action === 'reject') transferMeritPlayer();
        else {
          const starters = meritCompatibleStarters();
          if (starters.length) promoteMeritPlayer(pick(starters).playerId);
          else chooseMeritOpeningAction('reject');
        }
      } else {
        action = 'continue';
        storyLog.push({ title: event.title || 'Merito di più!', choice: action, storyType: event.storyType || '' });
        acknowledgeMeritPostEvent();
      }
      return true;
    }
    event.resolved = true;
    storyLog.push({ title: event.title || event.kind, choice: 'auto-skip', storyType: event.storyType || '' });
    return true;
  }

  function resolvePendingEvent(storyLog) {
    const event = state.pendingEvent;
    if (!event || event.resolved) return false;
    if (String(event.kind || '').startsWith('story')) return resolveStoryEvent(storyLog);
    if (event.kind === 'decision') {
      const decision = DECISIONS.find(item => item.id === event.decisionId) || DECISIONS[event.decisionIndex];
      const count = decision?.choices?.length || 0;
      if (count) resolveDecision(Math.floor(Math.random() * count));
      else event.resolved = true;
      return true;
    }
    event.resolved = true;
    return true;
  }

  function continueAutomatedMidseason() {
    state.midseason.auto = true;
    runBotMidseason();
    continueAfterMidseasonSummary();
  }

  function currentRank() {
    const table = sortedTable();
    const index = table.findIndex(row => String(row.id) === String(USER_ID));
    return index >= 0 ? index + 1 : 20;
  }


  function applyFastUserRules(goalsFor, goalsAgainst) {
    let gf = Math.max(0, Math.round(Number(goalsFor) || 0));
    let ga = Math.max(0, Math.round(Number(goalsAgainst) || 0));
    const forcedScore = state.activeEffects.find(effect => effect.type === 'forcedScore');
    const forcedWin = state.activeEffects.some(effect => effect.type === 'forcedWin');
    const forcedLoss = state.activeEffects.some(effect => effect.type === 'forcedLoss');
    const maxDraw = state.activeEffects.some(effect => effect.type === 'maxDraw');
    const caps = state.activeEffects.filter(effect => effect.type === 'goalCap').map(effect => Number(effect.value)).filter(Number.isFinite);
    const defensive = state.activeEffects.filter(effect => effect.type === 'cleanSheet' || effect.type === 'minimumGoalsAgainst');
    if (caps.length) gf = Math.min(gf, Math.min(...caps));
    if (defensive.length) {
      const rule = defensive[defensive.length - 1];
      ga = rule.type === 'cleanSheet' ? 0 : Math.max(ga, Number(rule.value) || 1);
    }
    if (coachIs('salvation')) {
      const coachAverage = coachRosterAverageOvr();
      if (coachAverage < 70) gf += 1;
      if (coachAverage > 80) ga = Math.max(1, ga);
    }
    if (state.activeEffects.some(effect => effect.type === 'drawBecomesLoss') && gf === ga) ga += 1;
    if (String(state.seasonRules?.italiaCatenaccioRule || '') === 'allegri') gf = Math.min(1, gf);
    if (forcedWin && gf <= ga) gf = ga + 1;
    if (forcedLoss && gf >= ga) ga = gf + 1;
    if (maxDraw && gf > ga) ga = gf;
    if (forcedScore) {
      gf = Math.max(0, Number.isFinite(Number(forcedScore.gf)) ? Number(forcedScore.gf) : 6);
      ga = Math.max(0, Number.isFinite(Number(forcedScore.ga)) ? Number(forcedScore.ga) : 0);
    }
    return [gf, ga];
  }

  function simulateFastRound() {
    const round = state.schedule?.[state.matchday];
    assert(Array.isArray(round) && round.length, `Calendario mancante alla giornata ${Number(state.matchday) + 1}`);
    const fixture = userFixture();
    assert(fixture, `Partita utente mancante alla giornata ${Number(state.matchday) + 1}`);
    const userTeam = teamById(USER_ID) || { id: USER_ID, name: state.teamName };
    const opponent = teamById(fixture.home === USER_ID ? fixture.away : fixture.home);
    const userHome = fixture.home === USER_ID;
    const userPower = Math.max(35, matchPower());
    const eventOvr = state.activeEffects.filter(effect => effect.type === 'opponentOvr').reduce((sum, effect) => sum + (Number(effect.value) || 0), 0);
    const deathBonus = String(state.seasonRules?.deathMatchClubId || '') === String(opponent?.id || '') ? Math.max(0, Number(state.seasonRules?.deathMatchClubBonus) || 10) : 0;
    const opponentPower = Math.max(1, opponentMatchPower(opponent) + eventOvr + deathBonus);
    const duration = currentMatchDuration();
    const smallGoalMultiplier = state.activeEffects.filter(effect => effect.type === 'smallGoals').reduce((value, effect) => value * clamp(Number(effect.value) || .65, .1, 1), 1);
    let [homeScore, awayScore] = simulateScore(userHome ? userPower : opponentPower, userHome ? opponentPower : userPower, curvaContestHomeAdvantage(userHome), duration, smallGoalMultiplier);
    let goalsFor = userHome ? homeScore : awayScore;
    let goalsAgainst = userHome ? awayScore : homeScore;
    if (isTeamEliminated(opponent?.id)) [goalsFor, goalsAgainst] = [3, 0];
    [goalsFor, goalsAgainst] = applyFastUserRules(goalsFor, goalsAgainst);

    const beforeStatuses = analyticsStatusSnapshot();
    const roundResults = [];
    round.forEach(match => {
      const homeId = String(match.home), awayId = String(match.away);
      if (homeId === USER_ID || awayId === USER_ID) {
        const h = homeId === USER_ID ? goalsFor : goalsAgainst;
        const a = homeId === USER_ID ? goalsAgainst : goalsFor;
        updateStanding(homeId, h, a);
        updateStanding(awayId, a, h);
        roundResults.push({ home: homeId, away: awayId, homeScore: h, awayScore: a });
        return;
      }
      const homeTeam = teamById(homeId), awayTeam = teamById(awayId);
      let h = 0, a = 0;
      if (isTeamEliminated(homeId) && !isTeamEliminated(awayId)) [h, a] = [0, 3];
      else if (!isTeamEliminated(homeId) && isTeamEliminated(awayId)) [h, a] = [3, 0];
      else [h, a] = simulateScore(opponentMatchPower(homeTeam), opponentMatchPower(awayTeam), .08, 90, 1);
      updateStanding(homeId, h, a);
      updateStanding(awayId, a, h);
      roundResults.push({ home: homeId, away: awayId, homeScore: h, awayScore: a });
    });

    const result = {
      matchday: Number(state.matchday) + 1,
      opponentId: String(opponent?.id || ''),
      opponent: String(opponent?.name || 'Avversario'),
      home: userHome,
      gf: goalsFor,
      ga: goalsAgainst,
      displayGf: goalsFor,
      displayGa: goalsAgainst,
      matchDuration: duration,
      userGoals: [],
      opponentGoals: [],
      ownRedCard: false,
      ownSuspensionId: '',
      winnerId: goalsFor > goalsAgainst ? USER_ID : goalsAgainst > goalsFor ? String(opponent?.id || '') : ''
    };
    state.history.push(result);
    state.lastResult = result;
    state.lastRoundResults = roundResults;
    applyUserPointRules(goalsFor, goalsAgainst);
    postMatch();
    updateSeasonMatchAnalytics(result, beforeStatuses);
    return result;
  }

  function collectRunResult({ scenario, seed, initialRoster, initialOvr, storyLog, elapsedMs }) {
    const standing = state.standings?.[USER_ID] || { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
    const rank = currentRank();
    const logs = Array.isArray(state.analytics?.eventLog) ? clone(state.analytics.eventLog) : [];
    const finalOvr = round(teamPowerBase(), 1);
    const target = seasonLength();
    const played = Number(standing.p) || Number(state.matchday) || 0;
    const valid = [rank, standing.pts, standing.gf, standing.ga, played].every(value => Number.isFinite(Number(value)));
    assert(valid, 'Metriche finali non valide');
    return {
      mode: MODE,
      scenarioKey: scenario.key,
      scenarioGroup: scenario.group,
      scenarioId: scenario.id,
      scenarioLabel: scenario.label,
      coachType: scenario.coachType,
      formation: scenario.formation,
      seed,
      rank,
      title: rank === 1,
      top4: rank <= 4,
      points: Number(standing.pts) || 0,
      played,
      wins: Number(standing.w) || 0,
      draws: Number(standing.d) || 0,
      losses: Number(standing.l) || 0,
      gf: Number(standing.gf) || 0,
      ga: Number(standing.ga) || 0,
      goalDifference: (Number(standing.gf) || 0) - (Number(standing.ga) || 0),
      initialOvr: round(initialOvr, 1),
      finalOvr,
      ovrDelta: round(finalOvr - initialOvr, 1),
      injuries: Number(state.analytics?.injuries) || 0,
      redCards: Number(state.analytics?.redCards) || 0,
      eventCount: logs.length + storyLog.length,
      decisionCount: logs.filter(item => item.kind === 'decision').length,
      autoEventCount: logs.filter(item => item.kind === 'auto').length,
      events: logs,
      storyEvents: clone(storyLog),
      initialRoster: clone(initialRoster),
      phase: String(state.phase || ''),
      matchday: Number(state.matchday) || 0,
      targetMatchdays: target,
      earlyEnd: played < Math.min(38, target),
      alternativeEnding: !['season', 'midseason', 'finished'].includes(String(state.phase || '')),
      elapsedMs: Math.round(elapsedMs)
    };
  }

  async function simulateSeason(scenario, seed, options = {}) {
    const started = performance.now();
    const storyLog = [];
    return withSeed(seed, async () => {
      resetSimulationState(scenario);
      assert(buildInitialRoster(scenario), `Impossibile creare la rosa per ${scenario.label}`);
      const initialRoster = state.draft.roster.map(entry => String(entry.playerId));
      finalizeDraft();
      state.seasonRules.autoDecisions = true;
      state.seasonRules.autoMidseason = true;
      state.seasonRules.botMidseason = true;
      if (!options.includeStories) disableStoryArcs();
      const initialOvr = Number(state.analytics?.initialOvr) || teamPowerBase();
      let safety = 0;
      while (safety < 700) {
        if (cancelled) throw new DOMException('Simulazione annullata', 'AbortError');
        safety += 1;
        if (state.phase === 'midseason') {
          continueAutomatedMidseason();
          continue;
        }
        if (state.phase !== 'season') break;
        if (resolvePendingEvent(storyLog)) continue;
        state.seasonRules.autoDecisions = true;
        if (options.engine === 'fast') simulateFastRound();
        else runTimersImmediately(() => playRound('instant'));
      }
      assert(safety < 700, 'Stagione bloccata oltre il limite di sicurezza');
      return collectRunResult({ scenario, seed, initialRoster, initialOvr, storyLog, elapsedMs: performance.now() - started });
    });
  }

  function average(rows, key) {
    if (!rows.length) return 0;
    return rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0) / rows.length;
  }

  function summarizeScenario(scenario, rows) {
    const valid = rows.filter(row => !row.error);
    const totalMatches = valid.reduce((sum, row) => sum + row.played, 0);
    const totalWins = valid.reduce((sum, row) => sum + row.wins, 0);
    return {
      key: scenario.key,
      group: scenario.group,
      id: scenario.id,
      label: scenario.label,
      coachType: scenario.coachType,
      formation: scenario.formation,
      seasons: rows.length,
      completed: valid.length,
      failures: rows.length - valid.length,
      titles: valid.filter(row => row.title).length,
      titleRate: round(valid.filter(row => row.title).length * 100 / Math.max(1, valid.length), 1),
      top4Rate: round(valid.filter(row => row.top4).length * 100 / Math.max(1, valid.length), 1),
      averageRank: round(average(valid, 'rank'), 2),
      averagePoints: round(average(valid, 'points'), 2),
      averageGoalsFor: round(average(valid, 'gf'), 2),
      averageGoalsAgainst: round(average(valid, 'ga'), 2),
      averageGoalDifference: round(average(valid, 'goalDifference'), 2),
      matchWinRate: round(totalWins * 100 / Math.max(1, totalMatches), 1),
      averageOvrDelta: round(average(valid, 'ovrDelta'), 2),
      averageInjuries: round(average(valid, 'injuries'), 2),
      averageRedCards: round(average(valid, 'redCards'), 2),
      averageEvents: round(average(valid, 'eventCount'), 2),
      earlyEnds: valid.filter(row => row.earlyEnd).length,
      alternativeEndings: valid.filter(row => row.alternativeEnding).length,
      averageDurationMs: round(average(valid, 'elapsedMs'), 0)
    };
  }

  function aggregateEvents(runs) {
    const map = new Map();
    runs.filter(run => !run.error).forEach(run => {
      const seenThisSeason = new Set();
      (run.events || []).forEach(event => {
        const key = `${event.title || 'Evento'}|${event.choice || event.kind || ''}`;
        if (!map.has(key)) map.set(key, { key, title: event.title || 'Evento', choice: event.choice || event.kind || '', kind: event.kind || '', occurrences: 0, seasons: 0, impactSum: 0, ovrDeltaSum: 0, pointsDeltaSum: 0, titles: 0 });
        const row = map.get(key);
        row.occurrences += 1;
        row.impactSum += Number(event.score) || 0;
        row.ovrDeltaSum += Number(event.ovrDelta) || 0;
        row.pointsDeltaSum += Number(event.pointsDelta) || 0;
        if (!seenThisSeason.has(key)) {
          seenThisSeason.add(key);
          row.seasons += 1;
          if (run.title) row.titles += 1;
        }
      });
      (run.storyEvents || []).forEach(event => {
        const key = `STORY:${event.title}|${event.choice}`;
        if (!map.has(key)) map.set(key, { key, title: event.title, choice: event.choice, kind: 'story', occurrences: 0, seasons: 0, impactSum: 0, ovrDeltaSum: 0, pointsDeltaSum: 0, titles: 0 });
        const row = map.get(key);
        row.occurrences += 1;
        if (!seenThisSeason.has(key)) {
          seenThisSeason.add(key);
          row.seasons += 1;
          if (run.title) row.titles += 1;
        }
      });
    });
    return [...map.values()].map(row => ({
      key: row.key,
      title: row.title,
      choice: row.choice,
      kind: row.kind,
      occurrences: row.occurrences,
      seasons: row.seasons,
      averageImpact: round(row.impactSum / Math.max(1, row.occurrences), 2),
      averageOvrDelta: round(row.ovrDeltaSum / Math.max(1, row.occurrences), 2),
      averagePointsDelta: round(row.pointsDeltaSum / Math.max(1, row.occurrences), 2),
      titleRateWhenPresent: round(row.titles * 100 / Math.max(1, row.seasons), 1)
    })).sort((a, b) => b.occurrences - a.occurrences || Math.abs(b.averageImpact) - Math.abs(a.averageImpact));
  }

  function aggregateDraftPlayers(runs) {
    const map = new Map();
    const validRuns = runs.filter(run => !run.error);
    validRuns.forEach(run => {
      new Set(run.initialRoster || []).forEach(id => {
        const player = playerById(id);
        if (!map.has(id)) map.set(id, { id, name: player?.name || id, position: player?.Position || '', ovr: Number(player?.ovr) || 0, selections: 0, titles: 0 });
        const row = map.get(id);
        row.selections += 1;
        if (run.title) row.titles += 1;
      });
    });
    return [...map.values()].map(row => ({
      ...row,
      selectionRate: round(row.selections * 100 / Math.max(1, validRuns.length), 1),
      titleRateWhenSelected: round(row.titles * 100 / Math.max(1, row.selections), 1)
    })).sort((a, b) => b.selections - a.selections || b.ovr - a.ovr).slice(0, 40);
  }

  function buildAlerts(summaries, events, overall) {
    const alerts = [];
    summaries.forEach(summary => {
      if (summary.failures) alerts.push({ severity: 'error', area: summary.group, message: `${summary.label}: ${summary.failures} simulazioni fallite.` });
      if (summary.seasons >= 8 && overall.titleRate > 0) {
        if (summary.titleRate >= overall.titleRate * 1.45 && summary.titleRate - overall.titleRate >= 5) alerts.push({ severity: 'warning', area: summary.group, message: `${summary.label}: vittorie campionato ${summary.titleRate}% contro media ${overall.titleRate}%. Possibile vantaggio dominante.` });
        if (summary.titleRate <= overall.titleRate * 0.55 && overall.titleRate - summary.titleRate >= 5) alerts.push({ severity: 'warning', area: summary.group, message: `${summary.label}: vittorie campionato ${summary.titleRate}% contro media ${overall.titleRate}%. Possibile scelta sottodimensionata.` });
      }
      if (summary.earlyEnds > Math.max(2, summary.completed * 0.08)) alerts.push({ severity: 'warning', area: summary.group, message: `${summary.label}: ${summary.earlyEnds} stagioni terminate prima delle 38 giornate.` });
    });
    events.filter(event => event.occurrences >= 4 && Math.abs(event.averageImpact) >= 8).slice(0, 12).forEach(event => {
      alerts.push({ severity: 'info', area: 'event', message: `${event.title} / ${event.choice}: impatto medio ${event.averageImpact >= 0 ? '+' : ''}${event.averageImpact} su ${event.occurrences} occorrenze.` });
    });
    return alerts.slice(0, 30);
  }

  function buildReport({ options, scenarios, runs, startedAt, durationMs }) {
    const scenarioSummaries = scenarios.map(scenario => summarizeScenario(scenario, runs.filter(run => run.scenarioKey === scenario.key)));
    const valid = runs.filter(run => !run.error);
    const overall = {
      seasons: runs.length,
      completed: valid.length,
      failures: runs.length - valid.length,
      titles: valid.filter(run => run.title).length,
      titleRate: round(valid.filter(run => run.title).length * 100 / Math.max(1, valid.length), 1),
      top4Rate: round(valid.filter(run => run.top4).length * 100 / Math.max(1, valid.length), 1),
      averageRank: round(average(valid, 'rank'), 2),
      averagePoints: round(average(valid, 'points'), 2),
      averageGoalsFor: round(average(valid, 'gf'), 2),
      averageGoalsAgainst: round(average(valid, 'ga'), 2),
      averageInjuries: round(average(valid, 'injuries'), 2),
      averageEvents: round(average(valid, 'eventCount'), 2),
      earlyEnds: valid.filter(run => run.earlyEnd).length,
      alternativeEndings: valid.filter(run => run.alternativeEnding).length
    };
    const events = aggregateEvents(runs);
    const draftPlayers = aggregateDraftPlayers(runs);
    return {
      apiVersion: API_VERSION,
      mode: MODE,
      generatedAt: new Date().toISOString(),
      startedAt,
      durationMs: Math.round(durationMs),
      options,
      environment: {
        players: PLAYERS.length,
        clubs: CLUBS.length,
        coaches: COACHES.length,
        formations: STANDARD_FORMATIONS.length,
        decisions: DECISIONS.length,
        autoEvents: AUTO_EVENTS.length,
        stateVersion: CURRENT_STATE_VERSION,
        saveFormatVersion: SAVE_FORMAT_VERSION
      },
      overall,
      scenarios: scenarioSummaries,
      events,
      draftPlayers,
      alerts: buildAlerts(scenarioSummaries, events, overall),
      failures: runs.filter(run => run.error).map(run => ({ scenarioKey: run.scenarioKey, seed: run.seed, error: run.error })),
      rawRuns: options.includeRawRuns ? runs : undefined
    };
  }

  async function runBalance(options = {}, onProgress = () => {}) {
    await waitUntilReady();
    cancelled = false;
    clearRunnerStorage();
    const normalized = {
      scope: ['all', 'coaches', 'formations'].includes(options.scope) ? options.scope : 'all',
      totalSeasons: Math.max(1, Math.min(options.engine === 'exact' ? 250 : 5000, Math.floor(Number(options.totalSeasons) || 60))),
      baseSeed: Math.max(1, Math.floor(Number(options.baseSeed) || 20260722)),
      includeStories: Boolean(options.includeStories),
      includeRawRuns: Boolean(options.includeRawRuns),
      engine: options.engine === 'exact' ? 'exact' : 'fast'
    };
    const scenarios = allocateRuns(normalized.totalSeasons, scenarioList(normalized.scope));
    normalized.totalSeasons = scenarios.reduce((sum, scenario) => sum + scenario.runs, 0);
    const runs = [];
    const startedAt = new Date().toISOString();
    const started = performance.now();
    let completed = 0;
    for (const scenario of scenarios) {
      for (let index = 0; index < scenario.runs; index += 1) {
        if (cancelled) throw new DOMException('Simulazione annullata', 'AbortError');
        const seed = normalized.baseSeed + index * 104729;
        try {
          runs.push(await simulateSeason(scenario, seed, normalized));
        } catch (error) {
          if (error?.name === 'AbortError') throw error;
          runs.push({ mode: MODE, scenarioKey: scenario.key, scenarioGroup: scenario.group, scenarioId: scenario.id, scenarioLabel: scenario.label, seed, error: error?.message || String(error) });
        }
        completed += 1;
        onProgress({ mode: MODE, completed, total: normalized.totalSeasons, scenario: scenario.label, scenarioGroup: scenario.group, failures: runs.filter(run => run.error).length });
        if (completed % 2 === 0) await sleep(0);
      }
    }
    clearRunnerStorage();
    return buildReport({ options: normalized, scenarios, runs, startedAt, durationMs: performance.now() - started });
  }

  function cancel() {
    cancelled = true;
  }

  window.FantaballaBalanceAPI = {
    version: API_VERSION,
    mode: MODE,
    ready: waitUntilReady,
    runBalance,
    cancel,
    getOverview: () => ({
      mode: MODE,
      players: PLAYERS.length,
      clubs: CLUBS.length,
      coaches: clone(COACHES),
      formations: [...STANDARD_FORMATIONS],
      decisions: DECISIONS.length,
      autoEvents: AUTO_EVENTS.length
    }),
    restoreRuntime: () => {
      if (originalRuntime.save) save = originalRuntime.save;
      if (originalRuntime.render) render = originalRuntime.render;
      if (originalRuntime.toast) toast = originalRuntime.toast;
      if (originalRuntime.showResultModal) showResultModal = originalRuntime.showResultModal;
      if (originalRuntime.updateSaveStatus) updateSaveStatus = originalRuntime.updateSaveStatus;
    }
  };

  window.parent?.postMessage({ type: 'fantaballa-balance-runner-ready', mode: MODE }, '*');
})();
