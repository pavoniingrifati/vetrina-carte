/*
  Fantaballa - Invio automatico vittoria via email

  Come usarlo:
  1. Vai su https://script.google.com e crea un nuovo progetto.
  2. Cancella il codice presente e incolla tutto questo file.
  3. Premi Deploy > New deployment > Web app.
  4. Esegui come: Me.
  5. Chi ha accesso: Anyone.
  6. Autorizza lo script.
  7. Copia il link finale che finisce con /exec.
  8. Incolla quel link in index.html al posto di:
     INCOLLA_QUI_URL_WEB_APP_GOOGLE_APPS_SCRIPT
*/

const DESTINATARIO = 'pavoniingrifati@gmail.com';
const NOME_MITTENTE = 'Fantaballa World Cup';

function doGet() {
  return jsonOutput({ ok: true, message: 'Endpoint Fantaballa attivo' });
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(raw);

    if (!data || data.cupWon !== true || !data.victoryCode) {
      return jsonOutput({ ok: false, error: 'Risultato non valido' });
    }

    const cache = CacheService.getScriptCache();
    const cacheKey = 'victory_' + String(data.victoryCode).slice(0, 90);
    if (cache.get(cacheKey)) {
      return jsonOutput({ ok: true, duplicate: true });
    }
    cache.put(cacheKey, '1', 21600); // 6 ore anti doppio click

    const teamName = cleanText(data.teamName || data.squadra || 'N/D');
    const coachName = cleanText(data.coachName || data.allenatore || 'N/D');
    const subject = 'Vittoria Mondiale Fantaballa - ' + teamName + ' / ' + coachName;
    const body = buildEmailBody(data);

    MailApp.sendEmail({
      to: DESTINATARIO,
      subject: subject,
      body: body,
      name: NOME_MITTENTE
    });

    return jsonOutput({ ok: true });
  } catch (error) {
    return jsonOutput({ ok: false, error: String(error) });
  }
}

function buildEmailBody(data) {
  const teamName = cleanText(firstValue(data, ['teamName', 'squadra'], 'N/D'));
  const coachName = cleanText(firstValue(data, ['coachName', 'allenatore', 'coach_name', 'nome_allenatore', 'coach'], 'N/D'));
  const vittorie = cleanNumber(firstValue(data, ['vittorie', 'wins'], 0));
  const pareggi = cleanNumber(firstValue(data, ['pareggi', 'draws'], 0));
  const sconfitte = cleanNumber(firstValue(data, ['sconfitte', 'losses'], 0));
  const golFatti = cleanNumber(firstValue(data, ['gol_fatti', 'golFatti', 'goalsFor'], 0));
  const golSubiti = cleanNumber(firstValue(data, ['gol_subiti', 'golSubiti', 'goalsAgainst'], 0));
  const modulo = cleanText(firstValue(data, ['modulo', 'formation'], 'N/D'));
  const modalita = cleanText(firstValue(data, ['modalita', 'gameMode', 'mode'], 'Classica'));
  const ovrMedio = cleanNumber(firstValue(data, ['ovr_medio', 'avgOvr'], 0));
  const capocannoniere = cleanText(firstValue(data, ['capocannoniereSquadra', 'capocannoniere', 'topScorer', 'migliorMarcatore'], 'N/D'));

  const classificaJson = {
    squadra: teamName,
    allenatore: coachName,
    vittorie: vittorie,
    pareggi: pareggi,
    sconfitte: sconfitte,
    gol_fatti: golFatti,
    gol_subiti: golSubiti,
    modulo: modulo,
    modalita: modalita,
    ovr_medio: ovrMedio,
    capocannoniere: capocannoniere
  };

  const rows = [
    'Nuova vittoria Mondiale Fantaballa!',
    '',
    'Squadra: ' + teamName,
    'Allenatore: ' + coachName,
    'Codice vittoria: ' + cleanText(data.victoryCode),
    'Finale: ' + teamName + ' ' + cleanText(firstValue(data, ['finalScore'], 'N/D')) + ' vs ' + cleanText(firstValue(data, ['finalOpponent'], 'N/D')),
    'Partite giocate: ' + cleanNumber(firstValue(data, ['matches'], 0)),
    'Vittorie: ' + vittorie,
    'Pareggi: ' + pareggi,
    'Sconfitte: ' + sconfitte,
    'Gol fatti/subiti: ' + golFatti + '/' + golSubiti,
    'Modulo: ' + modulo,
    'Modalita: ' + modalita,
    'OVR medio: ' + ovrMedio,
    'Capocannoniere squadra: ' + capocannoniere,
    'Reparti: ATT ' + cleanNumber(firstValue(data, ['attack'], 0)) + ' / MID ' + cleanNumber(firstValue(data, ['midfield'], 0)) + ' / DEF ' + cleanNumber(firstValue(data, ['defense'], 0)),
    'Intesa: ' + cleanNumber(firstValue(data, ['chemistryScore'], 0)) + '/100 (' + formatSigned(cleanNumber(firstValue(data, ['chemistryBonus'], 0))) + ')',
    'Data gioco: ' + cleanText(firstValue(data, ['dateText'], 'N/D')),
    'Data invio: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    'Privacy notice accettata: ' + (data.privacyNoticeAccepted === true ? 'si' : 'non indicato'),
    'Versione privacy: ' + cleanText(firstValue(data, ['privacyVersion'], 'N/D')),
    '',
    'COPIA QUESTO BLOCCO IN data/classifica.json dentro la lista "classifica":',
    '',
    JSON.stringify(classificaJson, null, 2),
    '',
    "Nota: se nel file classifica.json ci sono gia altre squadre, aggiungi una virgola tra un blocco squadra e l altro.",
    '',
    'Nota: email inviata automaticamente dal bottone vittoria. Non sono richiesti login, email utente o password.'
  ];

  return rows.join('\n');
}

function firstValue(data, keys, fallback) {
  for (var i = 0; i < keys.length; i++) {
    var value = data[keys[i]];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return fallback;
}

function cleanNumber(value) {
  var number = Number(value);
  return isNaN(number) ? 0 : number;
}

function formatSigned(value) {
  var number = Number(value);
  if (isNaN(number)) number = 0;
  return number > 0 ? '+' + number : String(number);
}

function cleanText(value) {
  return String(value)
    .replace(/[<>]/g, '')
    .slice(0, 500);
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
