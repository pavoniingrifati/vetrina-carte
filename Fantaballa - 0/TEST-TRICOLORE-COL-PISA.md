# Test — Tricolore col Pisa!

## Esito

- 16 suite automatiche del progetto superate.
- 18 controlli dedicati alla nuova modalità superati.
- 59 file JavaScript validi sintatticamente.
- 75 file JSON validi.
- 10 script Python compilabili.
- 19 pagine HTML controllate.
- 378 riferimenti locali verificati, 0 file mancanti.
- Sorgente Google Apps Script valido sintatticamente.
- L'immagine usata nel box è una copia binariamente identica al file fornito dall'utente.

## Controlli dedicati

- 20 club presenti nella competizione e Pisa incluso.
- 22 giocatori del Pisa disponibili nel database.
- Tutti gli otto moduli standard sono completabili con la rosa del Pisa.
- Salvataggio separato dalle altre modalità.
- Squadra e colori bloccati sul Pisa.
- Draft senza roll e reroll.
- Selezione di 11 titolari e 3 riserve.
- Box home e immagine correttamente collegati.
- Pagina gioco collegata al config e all'adattatore weekly.
- Invio consentito per qualunque piazzamento finale.
- Classifica dedicata, miglior risultato per allenatore e badge +2 OVR per i primi 10.

## Limite del test browser

Il browser headless dell'ambiente ha bloccato qualsiasi navigazione locale con `ERR_BLOCKED_BY_ADMINISTRATOR`. Non è stato quindi possibile completare il test end-to-end tramite Chromium. Il motore condiviso è stato verificato attraverso le suite automatiche, mentre la nuova modalità è stata controllata tramite test dedicati su dati, configurazione, collegamenti, draft e invio risultati.
