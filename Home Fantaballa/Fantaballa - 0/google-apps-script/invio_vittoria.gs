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

    const teamName = cleanText(data.teamName || 'La tua XI');
    const subject = 'Vittoria Mondiale Fantaballa - ' + teamName;
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
  const teamName = cleanText(data.teamName || 'La tua XI');
  const rows = [
    'Nuova vittoria Mondiale Fantaballa!',
    '',
    'Squadra: ' + teamName,
    'Codice vittoria: ' + cleanText(data.victoryCode),
    'Finale: ' + teamName + ' ' + cleanText(data.finalScore || 'N/D') + ' vs ' + cleanText(data.finalOpponent || 'N/D'),
    'Partite giocate: ' + cleanText(data.matches || '0'),
    'Vittorie: ' + cleanText(data.wins || '0'),
    'Pareggi: ' + cleanText(data.draws || '0'),
    'Sconfitte: ' + cleanText(data.losses || '0'),
    'Gol fatti/subiti: ' + cleanText(data.goalsFor || '0') + '-' + cleanText(data.goalsAgainst || '0'),
    'Modulo: ' + cleanText(data.formation || 'N/D'),
    'OVR medio: ' + cleanText(data.avgOvr || '0'),
    'Reparti: ATT ' + cleanText(data.attack || '0') + ' / MID ' + cleanText(data.midfield || '0') + ' / DEF ' + cleanText(data.defense || '0'),
    'Intesa: ' + cleanText(data.chemistryScore || '0') + '/100 (+' + cleanText(data.chemistryBonus || '0') + ')',
    'Data gioco: ' + cleanText(data.dateText || 'N/D'),
    'Data invio: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    'Privacy notice accettata: ' + (data.privacyNoticeAccepted === true ? 'si' : 'non indicato'),
    'Versione privacy: ' + cleanText(data.privacyVersion || 'N/D'),
    '',
    'Nota: email inviata automaticamente dal bottone vittoria. Non sono richiesti login, email utente o password.'
  ];

  return rows.join('\n');
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
