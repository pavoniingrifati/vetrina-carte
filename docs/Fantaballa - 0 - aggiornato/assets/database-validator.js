/* Fantaballa Database Validator
 * Validazione e normalizzazione non distruttiva dei database JSON.
 * Può essere usato da database-check.html e dalla suite test-season.html.
 */
(() => {
  'use strict';

  const VERSION = 1;
  const ROLE_LABELS = Object.freeze({ P: 'Portiere', D: 'Difensore', C: 'Centrocampista', A: 'Attaccante' });
  const POSITION_ROLE = Object.freeze({ P: 'P', DC: 'D', TS: 'D', TD: 'D', CDC: 'C', CC: 'C', COC: 'C', AS: 'A', AD: 'A', ATT: 'A' });
  const VALID_POSITIONS = new Set(Object.keys(POSITION_ROLE));
  const VALID_FORMATIONS = new Set(['4-3-3', '4-4-2', '4-2-3-1', '4-5-1', '3-5-2', '5-3-2', '3-4-3', '4-3-1-2', '2-4-4', '4-4-4', '3-3-3']);
  const TRUE_VALUES = new Set(['si', 'sì', 'yes', 'true', '1', 'y', 'abbonato', 'subscriber']);
  const FALSE_VALUES = new Set(['no', 'false', '0', 'n', '']);
  const HEX_COLOR = /^#[0-9a-f]{6}$/i;
  const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  const clone = value => {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };

  const compact = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const normalizeName = value => compact(value).toLocaleLowerCase('it').replace(/[^a-z0-9à-ÿ]+/g, '');
  const finiteNumber = value => Number.isFinite(Number(value));
  const canonicalYesNo = value => {
    const text = compact(value).toLocaleLowerCase('it');
    if (TRUE_VALUES.has(text)) return 'si';
    if (FALSE_VALUES.has(text)) return 'no';
    return null;
  };
  const positionTokens = value => String(value ?? '').split(',').map(token => compact(token).toUpperCase()).filter(Boolean);

  function makeIssue(severity, code, dataset, message, detail = {}) {
    return { severity, code, dataset, message, detail };
  }

  function summarizeIssues(issues) {
    const summary = { errors: 0, warnings: 0, info: 0, total: issues.length };
    issues.forEach(item => {
      if (item.severity === 'error') summary.errors += 1;
      else if (item.severity === 'warning') summary.warnings += 1;
      else summary.info += 1;
    });
    return summary;
  }

  function normalizePlayer(player, mode, changes) {
    const result = clone(player && typeof player === 'object' ? player : {});
    const id = compact(result.id);
    ['id', 'name', 'role', 'Position', 'roleLabel', 'nation', 'club'].forEach(field => {
      if (typeof result[field] !== 'string') return;
      const cleaned = compact(result[field]);
      if (cleaned !== result[field]) {
        changes.push({ recordType: 'player', id, field, from: result[field], to: cleaned, reason: 'spazi normalizzati' });
        result[field] = cleaned;
      }
    });
    const role = compact(result.role).toUpperCase();
    if (role) result.role = role;
    const canonicalPosition = positionTokens(result.Position).join(', ');
    if (canonicalPosition && canonicalPosition !== result.Position) {
      changes.push({ recordType: 'player', id, field: 'Position', from: result.Position, to: canonicalPosition, reason: 'posizioni normalizzate' });
      result.Position = canonicalPosition;
    }
    const expectedLabel = ROLE_LABELS[role];
    if (expectedLabel && result.roleLabel !== expectedLabel) {
      changes.push({ recordType: 'player', id, field: 'roleLabel', from: result.roleLabel, to: expectedLabel, reason: 'etichetta coerente con il ruolo' });
      result.roleLabel = expectedLabel;
    }
    const subscriber = canonicalYesNo(result.subscriber);
    const hasAbbonato = Object.prototype.hasOwnProperty.call(result, 'abbonato');
    const abbonato = hasAbbonato ? canonicalYesNo(result.abbonato) : null;
    const canonical = subscriber === 'si' || abbonato === 'si' ? 'si' : 'no';
    if (result.subscriber !== canonical) {
      changes.push({ recordType: 'player', id, field: 'subscriber', from: result.subscriber, to: canonical, reason: 'valore abbonamento unificato' });
      result.subscriber = canonical;
    }
    if (mode === 'community' || hasAbbonato) {
      if (result.abbonato !== canonical) {
        changes.push({ recordType: 'player', id, field: 'abbonato', from: result.abbonato, to: canonical, reason: 'campo ridondante allineato a subscriber' });
        result.abbonato = canonical;
      }
    }
    if (finiteNumber(result.ovr)) result.ovr = Math.trunc(Number(result.ovr));
    if (Object.prototype.hasOwnProperty.call(result, 'quotation') && finiteNumber(result.quotation)) result.quotation = Number(result.quotation);
    return result;
  }

  function normalizeClub(club, rosterCount, changes) {
    const result = clone(club && typeof club === 'object' ? club : {});
    const id = compact(result.id);
    ['id', 'name', 'shortName', 'defaultFormation'].forEach(field => {
      if (typeof result[field] !== 'string') return;
      const cleaned = compact(result[field]);
      if (cleaned !== result[field]) {
        changes.push({ recordType: 'club', id, field, from: result[field], to: cleaned, reason: 'spazi normalizzati' });
        result[field] = cleaned;
      }
    });
    if (result.rosterSize !== rosterCount) {
      changes.push({ recordType: 'club', id, field: 'rosterSize', from: result.rosterSize, to: rosterCount, reason: 'conteggio sincronizzato con i giocatori presenti' });
      result.rosterSize = rosterCount;
    }
    const colors = result.colorClub && typeof result.colorClub === 'object' ? result.colorClub : {};
    result.colorClub = colors;
    ['primary', 'secondary', 'accent', 'text'].forEach(key => {
      if (typeof colors[key] !== 'string') return;
      const normalized = colors[key].trim().toUpperCase();
      if (colors[key] !== normalized) {
        changes.push({ recordType: 'club', id, field: `colorClub.${key}`, from: colors[key], to: normalized, reason: 'colore HEX normalizzato' });
        colors[key] = normalized;
      }
    });
    return result;
  }

  function validateMode(players, clubs, mode) {
    const dataset = mode === 'real' ? 'real' : 'community';
    const issues = [];
    const changes = [];
    if (!Array.isArray(players)) {
      issues.push(makeIssue('error', 'PLAYERS_NOT_ARRAY', dataset, 'Il database giocatori non contiene un array.'));
      return { dataset, issues, changes, normalizedPlayers: [], normalizedClubs: [], summary: summarizeIssues(issues), stats: { players: 0, clubs: 0 } };
    }
    if (!Array.isArray(clubs)) {
      issues.push(makeIssue('error', 'CLUBS_NOT_ARRAY', dataset, 'Il database club non contiene un array.'));
      return { dataset, issues, changes, normalizedPlayers: [], normalizedClubs: [], summary: summarizeIssues(issues), stats: { players: players.length, clubs: 0 } };
    }

    const clubIds = clubs.map(club => compact(club?.id));
    const knownClubs = new Set(clubIds);
    const rosterCounts = new Map();
    players.forEach(player => {
      const club = compact(player?.club);
      rosterCounts.set(club, (rosterCounts.get(club) || 0) + 1);
    });
    const normalizedPlayers = players.map(player => normalizePlayer(player, dataset, changes));
    const normalizedClubs = clubs.map(club => normalizeClub(club, rosterCounts.get(compact(club?.id)) || 0, changes));

    const playerIdCounts = new Map();
    players.forEach(player => {
      const id = compact(player?.id);
      playerIdCounts.set(id, (playerIdCounts.get(id) || 0) + 1);
    });
    const nameGroups = new Map();
    players.forEach((player, index) => {
      if (!player || typeof player !== 'object' || Array.isArray(player)) {
        issues.push(makeIssue('error', 'PLAYER_NOT_OBJECT', dataset, `Il giocatore in posizione ${index + 1} non è un oggetto.`, { index }));
        return;
      }
      const id = compact(player.id);
      const name = compact(player.name);
      const role = compact(player.role).toUpperCase();
      const tokens = positionTokens(player.Position);
      if (!id) issues.push(makeIssue('error', 'PLAYER_ID_MISSING', dataset, `Giocatore ${index + 1}: ID mancante.`, { index }));
      else if ((playerIdCounts.get(id) || 0) > 1) issues.push(makeIssue('error', 'PLAYER_ID_DUPLICATE', dataset, `ID giocatore duplicato: ${id}.`, { id, count: playerIdCounts.get(id) }));
      if (!name) issues.push(makeIssue('error', 'PLAYER_NAME_MISSING', dataset, `Giocatore ${id || index + 1}: nome mancante.`, { id }));
      else {
        const key = normalizeName(name);
        if (!nameGroups.has(key)) nameGroups.set(key, []);
        nameGroups.get(key).push({ id, name, club: compact(player.club), role });
      }
      if (!ROLE_LABELS[role]) issues.push(makeIssue('error', 'PLAYER_ROLE_INVALID', dataset, `${name || id}: ruolo macro non valido “${role || 'mancante'}”.`, { id, value: role }));
      if (!tokens.length) issues.push(makeIssue('error', 'PLAYER_POSITION_MISSING', dataset, `${name || id}: Position mancante.`, { id }));
      const unknownPositions = tokens.filter(token => !VALID_POSITIONS.has(token));
      if (unknownPositions.length) issues.push(makeIssue('error', 'PLAYER_POSITION_INVALID', dataset, `${name || id}: posizioni non valide: ${unknownPositions.join(', ')}.`, { id, values: unknownPositions }));
      const expectedLabel = ROLE_LABELS[role];
      if (expectedLabel && compact(player.roleLabel) !== expectedLabel) issues.push(makeIssue('warning', 'PLAYER_ROLE_LABEL_MISMATCH', dataset, `${name || id}: roleLabel “${compact(player.roleLabel) || 'mancante'}” dovrebbe essere “${expectedLabel}”.`, { id, expected: expectedLabel, actual: player.roleLabel, autoFix: true }));
      if (!finiteNumber(player.ovr) || Number(player.ovr) < 1 || Number(player.ovr) > 100) issues.push(makeIssue('error', 'PLAYER_OVR_INVALID', dataset, `${name || id}: OVR non valido.`, { id, value: player.ovr }));
      else if (!Number.isInteger(Number(player.ovr))) issues.push(makeIssue('warning', 'PLAYER_OVR_NOT_INTEGER', dataset, `${name || id}: OVR non intero.`, { id, value: player.ovr }));
      if (!compact(player.nation)) issues.push(makeIssue('error', 'PLAYER_NATION_MISSING', dataset, `${name || id}: nazionale mancante.`, { id }));
      const club = compact(player.club);
      if (!knownClubs.has(club)) issues.push(makeIssue('error', 'PLAYER_CLUB_UNKNOWN', dataset, `${name || id}: club “${club || 'mancante'}” inesistente.`, { id, club }));
      const subscriberRaw = compact(player.subscriber).toLocaleLowerCase('it');
      const subscriber = canonicalYesNo(player.subscriber);
      if (subscriber === null || !['si', 'no'].includes(subscriberRaw)) issues.push(makeIssue('warning', 'PLAYER_SUBSCRIBER_NON_CANONICAL', dataset, `${name || id}: subscriber usa il valore non canonico “${player.subscriber}”.`, { id, value: player.subscriber, autoFix: true }));
      if (Object.prototype.hasOwnProperty.call(player, 'abbonato')) {
        const abbonatoRaw = compact(player.abbonato).toLocaleLowerCase('it');
        const abbonato = canonicalYesNo(player.abbonato);
        if (abbonato === null || !['si', 'no'].includes(abbonatoRaw)) issues.push(makeIssue('warning', 'PLAYER_ABBONATO_NON_CANONICAL', dataset, `${name || id}: abbonato usa il valore non canonico “${player.abbonato}”.`, { id, value: player.abbonato, autoFix: true }));
        if (subscriber !== null && abbonato !== null && subscriber !== abbonato) issues.push(makeIssue('warning', 'PLAYER_SUBSCRIBER_CONFLICT', dataset, `${name || id}: subscriber e abbonato non coincidono; la normalizzazione mantiene il valore affermativo.`, { id, subscriber: player.subscriber, abbonato: player.abbonato, autoFix: true }));
      }
      if (dataset === 'real') {
        if (!finiteNumber(player.quotation) || Number(player.quotation) < 0) issues.push(makeIssue('error', 'PLAYER_QUOTATION_INVALID', dataset, `${name || id}: quotazione non valida.`, { id, value: player.quotation }));
        if (!compact(player.sourceRole)) issues.push(makeIssue('warning', 'PLAYER_SOURCE_ROLE_MISSING', dataset, `${name || id}: sourceRole mancante.`, { id }));
      }
    });

    nameGroups.forEach(entries => {
      if (entries.length < 2) return;
      const labels = entries.map(entry => `${entry.name} [${entry.id} · ${entry.club} · ${entry.role}]`).join(', ');
      issues.push(makeIssue('warning', 'PLAYER_NAME_DUPLICATE', dataset, `Nome giocatore duplicato: ${labels}.`, { entries, manualReview: true }));
    });

    const clubIdCounts = new Map();
    clubIds.forEach(id => clubIdCounts.set(id, (clubIdCounts.get(id) || 0) + 1));
    const clubNameGroups = new Map();
    clubs.forEach((club, index) => {
      if (!club || typeof club !== 'object' || Array.isArray(club)) {
        issues.push(makeIssue('error', 'CLUB_NOT_OBJECT', dataset, `Il club in posizione ${index + 1} non è un oggetto.`, { index }));
        return;
      }
      const id = compact(club.id);
      const name = compact(club.name);
      if (!id) issues.push(makeIssue('error', 'CLUB_ID_MISSING', dataset, `Club ${index + 1}: ID mancante.`, { index }));
      else if ((clubIdCounts.get(id) || 0) > 1) issues.push(makeIssue('error', 'CLUB_ID_DUPLICATE', dataset, `ID club duplicato: ${id}.`, { id, count: clubIdCounts.get(id) }));
      else if (!SLUG.test(id)) issues.push(makeIssue('warning', 'CLUB_ID_NON_CANONICAL', dataset, `${name || id}: ID club non è uno slug canonico.`, { id }));
      if (!name) issues.push(makeIssue('error', 'CLUB_NAME_MISSING', dataset, `Club ${id || index + 1}: nome mancante.`, { id }));
      else {
        const key = normalizeName(name);
        if (!clubNameGroups.has(key)) clubNameGroups.set(key, []);
        clubNameGroups.get(key).push({ id, name });
      }
      const shortName = compact(club.shortName);
      if (!shortName) issues.push(makeIssue('error', 'CLUB_SHORT_NAME_MISSING', dataset, `${name || id}: shortName mancante.`, { id }));
      else if (shortName.length > 6) issues.push(makeIssue('warning', 'CLUB_SHORT_NAME_LONG', dataset, `${name || id}: shortName molto lungo (${shortName.length} caratteri).`, { id, value: shortName }));
      const colors = club.colorClub && typeof club.colorClub === 'object' ? club.colorClub : {};
      ['primary', 'secondary', 'accent', 'text'].forEach(color => {
        const value = compact(colors[color]);
        if (!value) issues.push(makeIssue('warning', 'CLUB_COLOR_MISSING', dataset, `${name || id}: colore ${color} mancante.`, { id, color }));
        else if (!HEX_COLOR.test(value)) issues.push(makeIssue('error', 'CLUB_COLOR_INVALID', dataset, `${name || id}: colore ${color} non valido “${value}”.`, { id, color, value }));
      });
      const formation = compact(club.defaultFormation);
      if (!VALID_FORMATIONS.has(formation)) issues.push(makeIssue('warning', 'CLUB_FORMATION_UNKNOWN', dataset, `${name || id}: formazione predefinita non riconosciuta “${formation || 'mancante'}”.`, { id, value: formation }));
      const actualRoster = rosterCounts.get(id) || 0;
      if (!finiteNumber(club.rosterSize) || Math.trunc(Number(club.rosterSize)) !== actualRoster) issues.push(makeIssue('warning', 'CLUB_ROSTER_SIZE_MISMATCH', dataset, `${name || id}: rosterSize è ${club.rosterSize}, ma i giocatori presenti sono ${actualRoster}.`, { id, declared: club.rosterSize, actual: actualRoster, autoFix: true }));
      const roles = { P: 0, D: 0, C: 0, A: 0 };
      players.filter(player => compact(player?.club) === id).forEach(player => {
        const role = compact(player?.role).toUpperCase();
        roles[role] = (roles[role] || 0) + 1;
      });
      const excludedUserClub = dataset === 'real' && id === 'fantaballa-real';
      const minimum = dataset === 'real' ? 14 : 11;
      if (!excludedUserClub && actualRoster < minimum) issues.push(makeIssue('error', 'CLUB_ROSTER_TOO_SMALL', dataset, `${name || id}: soltanto ${actualRoster} giocatori, minimo ${minimum}.`, { id, actual: actualRoster, minimum }));
      if (!excludedUserClub && !roles.P) issues.push(makeIssue('error', 'CLUB_NO_GOALKEEPER', dataset, `${name || id}: nessun portiere.`, { id }));
      if (!excludedUserClub && (roles.D < 4 || roles.C < 3 || roles.A < 2)) issues.push(makeIssue('warning', 'CLUB_ROLE_DISTRIBUTION_FRAGILE', dataset, `${name || id}: distribuzione ruoli fragile (P ${roles.P}, D ${roles.D}, C ${roles.C}, A ${roles.A}).`, { id, roles }));
    });
    clubNameGroups.forEach(entries => {
      if (entries.length > 1) issues.push(makeIssue('warning', 'CLUB_NAME_DUPLICATE', dataset, `Nome club duplicato: ${entries.map(entry => entry.name).join(', ')}.`, { entries, manualReview: true }));
    });

    const expectedPlayers = dataset === 'real' ? 455 : 717;
    const expectedClubs = dataset === 'real' ? 21 : 37;
    if (players.length !== expectedPlayers) issues.push(makeIssue('warning', 'DATASET_PLAYER_COUNT_UNEXPECTED', dataset, `Numero giocatori inatteso: ${players.length}, attesi ${expectedPlayers}.`, { actual: players.length, expected: expectedPlayers }));
    if (clubs.length !== expectedClubs) issues.push(makeIssue('warning', 'DATASET_CLUB_COUNT_UNEXPECTED', dataset, `Numero club inatteso: ${clubs.length}, attesi ${expectedClubs}.`, { actual: clubs.length, expected: expectedClubs }));

    return {
      dataset,
      issues,
      changes,
      normalizedPlayers,
      normalizedClubs,
      summary: summarizeIssues(issues),
      stats: { players: players.length, clubs: clubs.length, subscribers: players.filter(player => canonicalYesNo(player?.subscriber) === 'si').length }
    };
  }

  function validateCommentary(value) {
    const dataset = 'commentary';
    const issues = [];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      issues.push(makeIssue('error', 'COMMENTARY_NOT_OBJECT', dataset, 'cronaca-gol.json non contiene un oggetto.'));
      return { dataset, issues, summary: summarizeIssues(issues), stats: {} };
    }
    const required = { positions: 'object', special: 'object', result: 'object', milestones: 'object', assists: 'array' };
    Object.entries(required).forEach(([key, type]) => {
      const valid = type === 'array' ? Array.isArray(value[key]) : value[key] && typeof value[key] === 'object' && !Array.isArray(value[key]);
      if (!valid) issues.push(makeIssue('error', 'COMMENTARY_SECTION_INVALID', dataset, `Sezione ${key} mancante o non valida.`, { section: key }));
    });
    const positions = value.positions && typeof value.positions === 'object' ? value.positions : {};
    VALID_POSITIONS.forEach(position => {
      if (!Array.isArray(positions[position]) || !positions[position].length) issues.push(makeIssue('warning', 'COMMENTARY_POSITION_EMPTY', dataset, `Nessuna frase gol per la posizione ${position}.`, { position }));
    });
    ['positions', 'special', 'result', 'milestones'].forEach(sectionName => {
      const section = value[sectionName];
      if (!section || typeof section !== 'object' || Array.isArray(section)) return;
      Object.entries(section).forEach(([key, rows]) => {
        if (!Array.isArray(rows) || !rows.every(row => typeof row === 'string' && row.trim())) issues.push(makeIssue('error', 'COMMENTARY_LIST_INVALID', dataset, `Elenco non valido in ${sectionName}.${key}.`, { section: sectionName, key }));
      });
    });
    return { dataset, issues, summary: summarizeIssues(issues), stats: { positionGroups: Object.keys(positions).length } };
  }

  function validateRanking(value) {
    const dataset = 'ranking-fallback';
    const issues = [];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      issues.push(makeIssue('error', 'RANKING_NOT_OBJECT', dataset, 'classifica.json non contiene un oggetto.'));
      return { dataset, issues, summary: summarizeIssues(issues), stats: {} };
    }
    if (!Array.isArray(value.classifica)) issues.push(makeIssue('error', 'RANKING_ROWS_INVALID', dataset, 'Il campo classifica deve essere un array.'));
    const date = compact(value.aggiornato_il);
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) issues.push(makeIssue('warning', 'RANKING_DATE_INVALID', dataset, 'aggiornato_il non usa il formato YYYY-MM-DD.', { value: date }));
    if (Array.isArray(value.classifica) && !value.classifica.length) issues.push(makeIssue('info', 'RANKING_EMPTY', dataset, 'La classifica fallback è vuota; la pagina dipende dalla sorgente online.'));
    return { dataset, issues, summary: summarizeIssues(issues), stats: { rows: Array.isArray(value.classifica) ? value.classifica.length : 0 } };
  }

  function validateAll(resources) {
    const community = validateMode(resources.communityPlayers, resources.communityClubs, 'community');
    const real = validateMode(resources.realPlayers, resources.realClubs, 'real');
    const commentary = validateCommentary(resources.commentary);
    const ranking = validateRanking(resources.ranking);
    const datasets = { community, real, commentary, 'ranking-fallback': ranking };
    const issues = Object.values(datasets).flatMap(section => section.issues);
    return {
      schemaVersion: 1,
      validatorVersion: VERSION,
      generatedAt: new Date().toISOString(),
      summary: summarizeIssues(issues),
      datasets,
      issues,
      normalized: {
        communityPlayers: community.normalizedPlayers,
        communityClubs: community.normalizedClubs,
        realPlayers: real.normalizedPlayers,
        realClubs: real.normalizedClubs
      }
    };
  }

  function downloadJson(filename, value) {
    const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  window.FantaballaDatabaseValidator = Object.freeze({
    version: VERSION,
    validateMode,
    validateCommentary,
    validateRanking,
    validateAll,
    normalizePlayer,
    normalizeClub,
    summarizeIssues,
    canonicalYesNo,
    downloadJson
  });
})();
