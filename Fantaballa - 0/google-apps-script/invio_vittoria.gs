/*
  Fantaballa - Classifica automatica su Google Sheets

  Come usarlo:
  1. Apri il Google Sheet collegato alla classifica.
  2. Vai su Estensioni > Apps Script.
  3. Sostituisci il vecchio codice con questo file.
  4. Salva e aggiorna la distribuzione Web app già esistente.

  Supporta:
  - Classica
  - Gary MEDel
  - HARDa Turan
  - Campionato del Ca*** con piazzamento finale e punti
*/

const SHEET_NAME = 'Classifica';

const HEADERS = [
  'data_invio',
  'codice_vittoria',
  'squadra',
  'allenatore',
  'modalita',
  'posizione_finale',
  'punti',
  'giornate',
  'vittorie',
  'pareggi',
  'sconfitte',
  'gol_fatti',
  'gol_subiti',
  'modulo',
  'ovr_medio',
  'capocannoniere'
];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Apri questo Apps Script dal Google Sheet: Estensioni > Apps Script.');
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  let headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(value => String(value || '').trim());
  const hasHeaders = headers.some(value => value !== '');

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    headers = HEADERS.slice();
  } else {
    const missing = HEADERS.filter(header => headers.indexOf(header) < 0);
    if (missing.length) {
      sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
      headers = headers.concat(missing);
    }
  }

  return sheet;
}

function safeNumber_(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function firstValue_(payload, keys, fallback) {
  for (let i = 0; i < keys.length; i++) {
    const value = payload[keys[i]];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return fallback;
}

function normalizePayload_(payload) {
  const wins = safeNumber_(firstValue_(payload, ['vittorie', 'wins'], 0), 0);
  const draws = safeNumber_(firstValue_(payload, ['pareggi', 'draws'], 0), 0);
  const explicitPoints = firstValue_(payload, ['punti', 'points', 'pts'], '');

  return {
    data_invio: new Date(),
    codice_vittoria: String(firstValue_(payload, ['victoryCode', 'codice_vittoria'], '')).trim(),
    squadra: String(firstValue_(payload, ['squadra', 'nome_squadra', 'teamName', 'team_name'], '')).trim(),
    allenatore: String(firstValue_(payload, ['allenatore', 'coachName', 'coach_name', 'nome_allenatore', 'coach'], '')).trim(),
    modalita: String(firstValue_(payload, ['modalita', 'gameMode', 'mode'], 'Classica')).trim(),
    posizione_finale: safeNumber_(firstValue_(payload, ['posizione_finale', 'piazzamento_finale', 'finalPosition', 'final_position'], ''), ''),
    punti: explicitPoints === '' ? wins * 3 + draws : safeNumber_(explicitPoints, wins * 3 + draws),
    giornate: safeNumber_(firstValue_(payload, ['giornate', 'matchesPlayed', 'partite_giocate'], ''), ''),
    vittorie: wins,
    pareggi: draws,
    sconfitte: safeNumber_(firstValue_(payload, ['sconfitte', 'losses'], 0), 0),
    gol_fatti: safeNumber_(firstValue_(payload, ['gol_fatti', 'golFatti', 'goalsFor', 'gf'], 0), 0),
    gol_subiti: safeNumber_(firstValue_(payload, ['gol_subiti', 'golSubiti', 'goalsAgainst', 'ga'], 0), 0),
    modulo: String(firstValue_(payload, ['modulo', 'formation'], '')).trim(),
    ovr_medio: safeNumber_(firstValue_(payload, ['ovr_medio', 'avgOvr', 'averageOvr'], ''), ''),
    capocannoniere: String(firstValue_(payload, ['capocannoniere', 'capocannoniereSquadra', 'topScorer', 'migliorMarcatore'], '')).trim()
  };
}

function parseRequest_(e) {
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (err) {}
  }
  if (e && e.parameter && e.parameter.payload) {
    try { return JSON.parse(e.parameter.payload); } catch (err) {}
  }
  return e && e.parameter ? e.parameter : {};
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsOutput_(callback, data) {
  return ContentService
    .createTextOutput(String(callback).replace(/[^a-zA-Z0-9_$\.]/g, '') + '(' + JSON.stringify(data) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const payload = parseRequest_(e);
    const row = normalizePayload_(payload);
    if (!row.squadra || !row.allenatore) {
      return jsonOutput_({ ok:false, error:'Squadra o allenatore mancanti' });
    }

    const sheet = getSheet_();
    const lastColumn = sheet.getLastColumn();
    const values = sheet.getDataRange().getValues();
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
    const codeIndex = headers.indexOf('codice_vittoria');

    if (row.codice_vittoria && codeIndex >= 0) {
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][codeIndex] || '') === row.codice_vittoria) {
          return jsonOutput_({ ok:true, duplicate:true, saved:row });
        }
      }
    }

    sheet.appendRow(headers.map(header => row[header] !== undefined ? row[header] : ''));
    return jsonOutput_({ ok:true, saved:row });
  } catch (err) {
    return jsonOutput_({ ok:false, error:String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(String);

  const classifica = values
    .filter(row => row.some(cell => String(cell || '').trim() !== ''))
    .map(row => {
      const item = {};
      headers.forEach((header, index) => item[header] = row[index]);
      const wins = Number(item.vittorie || 0);
      const draws = Number(item.pareggi || 0);
      const storedPoints = item.punti;
      return {
        squadra: item.squadra || '',
        allenatore: item.allenatore || '',
        modalita: item.modalita || 'Classica',
        posizione_finale: item.posizione_finale === '' ? '' : Number(item.posizione_finale || 0),
        punti: storedPoints === '' || storedPoints === undefined ? wins * 3 + draws : Number(storedPoints || 0),
        giornate: item.giornate === '' ? '' : Number(item.giornate || 0),
        vittorie: wins,
        pareggi: draws,
        sconfitte: Number(item.sconfitte || 0),
        gol_fatti: Number(item.gol_fatti || 0),
        gol_subiti: Number(item.gol_subiti || 0),
        modulo: item.modulo || '',
        ovr_medio: item.ovr_medio || '',
        capocannoniere: item.capocannoniere || ''
      };
    });

  const data = {
    aggiornato_il: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
    classifica: classifica
  };
  const callback = e && e.parameter && e.parameter.callback;
  return callback ? jsOutput_(callback, data) : jsonOutput_(data);
}
