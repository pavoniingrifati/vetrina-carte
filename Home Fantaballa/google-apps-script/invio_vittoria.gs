/*
  Fantaballa - Classifica automatica su Google Sheets

  Come usarlo:
  1. Crea un Google Sheet e apri Estensioni > Apps Script dal foglio.
  2. Incolla questo codice.
  3. Deploy > New deployment > Web app.
  4. Execute as: Me.
  5. Who has access: Anyone.
  6. Copia il link /exec e incollalo in index.html e classifica.html.

  Questo script:
  - riceve le vittorie dal sito con doPost(e)
  - salva una riga nel foglio "Classifica"
  - restituisce la classifica con doGet(e), anche in JSONP per il sito statico
*/

const SHEET_NAME = 'Classifica';

const HEADERS = [
  'data_invio',
  'codice_vittoria',
  'squadra',
  'allenatore',
  'modalita',
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

  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = firstRow.some(value => String(value || '').trim() !== '');
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
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
  return {
    data_invio: new Date(),
    codice_vittoria: String(firstValue_(payload, ['victoryCode', 'codice_vittoria'], '')).trim(),
    squadra: String(firstValue_(payload, ['squadra', 'nome_squadra', 'teamName', 'team_name'], '')).trim(),
    allenatore: String(firstValue_(payload, ['allenatore', 'coachName', 'coach_name', 'nome_allenatore', 'coach'], '')).trim(),
    modalita: String(firstValue_(payload, ['modalita', 'gameMode', 'mode'], 'Classica')).trim(),
    vittorie: safeNumber_(firstValue_(payload, ['vittorie', 'wins'], 0), 0),
    pareggi: safeNumber_(firstValue_(payload, ['pareggi', 'draws'], 0), 0),
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
    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(String);
    const codeIndex = headers.indexOf('codice_vittoria');
    if (row.codice_vittoria && codeIndex >= 0) {
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][codeIndex] || '') === row.codice_vittoria) {
          return jsonOutput_({ ok:true, duplicate:true, saved:row });
        }
      }
    }

    sheet.appendRow(HEADERS.map(header => row[header]));
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
      return {
        squadra: item.squadra || '',
        allenatore: item.allenatore || '',
        modalita: item.modalita || 'Classica',
        vittorie: Number(item.vittorie || 0),
        pareggi: Number(item.pareggi || 0),
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
