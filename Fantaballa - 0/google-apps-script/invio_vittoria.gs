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
  - Campionato del Ca***: vengono accettate soltanto le stagioni vinte
  - Fantacampionato del Ca***: modalità REAL separata, accettata soltanto se vinta
*/

const SHEET_NAME = 'Classifica';

const HEADERS = [
  'data_invio',
  'codice_vittoria',
  'squadra',
  'allenatore',
  'modalita',
  'modalita_tipo',
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
  'capocannoniere',
  'capocannoniere_giocatore',
  'capocannoniere_campionato'
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


function normalizeMode_(modeValue, explicitType) {
  const rawMode = String(modeValue || 'Classica').trim();
  const rawType = String(explicitType || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (rawType === 'campionato_real' || rawType === 'fantacampionato' || rawType === 'real') {
    return { label:'Fantacampionato del Ca***', type:'campionato_real' };
  }
  if (rawType === 'campionato' || rawType === 'stagione') {
    return { label:'Campionato del Ca***', type:'campionato' };
  }
  if (rawType === 'hard' || rawType === 'harda_turan') {
    return { label:'HARDa Turan', type:'hard' };
  }
  if (rawType === 'gary' || rawType === 'gary_medel') {
    return { label:'Gary MEDel', type:'gary' };
  }
  if (rawType === 'classica' || rawType === 'classic') {
    return { label:'Classica', type:'classica' };
  }

  if (/fantacampionato|(campionato|stagione).*real|real.*(campionato|stagione)/i.test(rawMode)) {
    return { label:'Fantacampionato del Ca***', type:'campionato_real' };
  }
  if (/campionato|stagione/i.test(rawMode)) {
    return { label:'Campionato del Ca***', type:'campionato' };
  }
  if (/hard|turan/i.test(rawMode)) {
    return { label:'HARDa Turan', type:'hard' };
  }
  if (/gary|medel/i.test(rawMode)) {
    return { label:'Gary MEDel', type:'gary' };
  }
  if (/classic|classica/i.test(rawMode)) {
    return { label:'Classica', type:'classica' };
  }
  return { label:rawMode || 'Classica', type:'altro' };
}

function isChampionshipMode_(type) {
  return type === 'campionato' || type === 'campionato_real';
}

function normalizePayload_(payload) {
  const wins = safeNumber_(firstValue_(payload, ['vittorie', 'wins'], 0), 0);
  const draws = safeNumber_(firstValue_(payload, ['pareggi', 'draws'], 0), 0);
  const explicitPoints = firstValue_(payload, ['punti', 'points', 'pts'], '');
  const modeInfo = normalizeMode_(
    firstValue_(payload, ['modalita', 'gameMode', 'mode'], 'Classica'),
    firstValue_(payload, ['modalita_tipo', 'modalitaTipo', 'modeType'], '')
  );

  return {
    data_invio: new Date(),
    codice_vittoria: String(firstValue_(payload, ['victoryCode', 'codice_vittoria'], '')).trim(),
    squadra: String(firstValue_(payload, ['squadra', 'nome_squadra', 'teamName', 'team_name'], '')).trim(),
    allenatore: String(firstValue_(payload, ['allenatore', 'coachName', 'coach_name', 'nome_allenatore', 'coach'], '')).trim(),
    modalita: modeInfo.label,
    modalita_tipo: modeInfo.type,
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
    capocannoniere: String(firstValue_(payload, ['capocannoniere', 'capocannoniereSquadra', 'topScorer', 'migliorMarcatore'], '')).trim(),
    capocannoniere_giocatore: String(firstValue_(payload, ['capocannoniere_giocatore', 'capocannoniereGiocatore', 'userTopScorer', 'playerOwnedTopScorer', 'capocannoniere'], '')).trim(),
    capocannoniere_campionato: String(firstValue_(payload, ['capocannoniere_campionato', 'capocannoniereCampionato', 'leagueTopScorer'], '')).trim()
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

function iframeOutput_(data, requestId) {
  const safeRequestId = String(requestId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const payload = JSON.stringify({
    type:'fantaballa-classifica-response-v1',
    requestId:safeRequestId,
    data:data
  })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"></head><body>' +
    '<script>parent.postMessage(' + payload + ', "*");<\/script></body></html>';
  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
    if (isChampionshipMode_(row.modalita_tipo) && Number(row.posizione_finale) !== 1) {
      return jsonOutput_({ ok:false, error:'Il risultato del Campionato può essere salvato solo con posizione finale 1.' });
    }
    if (row.modalita_tipo === 'campionato_real' && row.giornate !== '' && Number(row.giornate) !== 38) {
      return jsonOutput_({ ok:false, error:'Il Fantacampionato REAL deve risultare concluso dopo 38 giornate.' });
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
      const modeInfo = normalizeMode_(item.modalita || 'Classica', item.modalita_tipo || '');
      return {
        squadra: item.squadra || '',
        allenatore: item.allenatore || '',
        modalita: modeInfo.label,
        modalita_tipo: modeInfo.type,
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
        capocannoniere: item.capocannoniere || '',
        capocannoniere_giocatore: item.capocannoniere_giocatore || item.capocannoniere || '',
        capocannoniere_campionato: item.capocannoniere_campionato || ''
      };
    });

  const data = {
    aggiornato_il: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
    classifica: classifica
  };
  const params = e && e.parameter ? e.parameter : {};
  const transport = String(params.transport || '').toLowerCase();
  if (transport === 'iframe') return iframeOutput_(data, params.requestId || '');
  const callback = params.callback;
  return callback ? jsOutput_(callback, data) : jsonOutput_(data);
}
