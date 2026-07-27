# Fix classifica Sfida della settimana

## Problema individuato

La pagina `sfida-settimana.html` caricava Google Sheets esclusivamente tramite JSONP. Quando il caricamento veniva bloccato o non completato, passava al file locale `data/classifica-settimana.json`, che è vuoto. La pagina mostrava quindi nessun risultato anche se la riga era stata salvata nel Google Sheet.

Inoltre le righe salvate da una precedente distribuzione del Google Apps Script potevano avere `modalita_tipo` non canonico. Il vecchio output non esponeva `codice_vittoria`, quindi la pagina non poteva riconoscere la modalità dal prefisso univoco `sfida_settimana_pisa-...`.

## Correzioni

- caricamento concorrente tramite Fetch, JSONP e iframe;
- cache locale dell'ultima risposta online valida;
- riconoscimento di modalità canoniche e legacy;
- recupero delle righe tramite prefisso del codice univoco;
- filtro server dedicato `modalita_tipo=sfida_settimana`;
- esposizione di `codice_vittoria` nel `doGet`;
- recupero automatico delle vecchie righe con prefisso `sfida_settimana_pisa-`;
- messaggio diagnostico quando Google restituisce righe ma nessuna risulta etichettata come Sfida della settimana;
- esclusione della modalità settimanale dalle classifiche generali;
- aggiornamento della versione cache del JavaScript.

## Pubblicazione Google Apps Script

Per recuperare anche eventuali righe registrate con una vecchia etichetta:

1. aprire il Google Sheet;
2. andare in **Estensioni > Apps Script**;
3. sostituire il codice con `google-apps-script/invio_vittoria.gs`;
4. salvare;
5. aprire **Esegui il deployment > Gestisci deployment**;
6. modificare la Web app esistente selezionando **Nuova versione**;
7. pubblicare mantenendo lo stesso URL.

## Test

- 17 suite JavaScript superate;
- 9 controlli specifici classifica settimanale superati;
- 60 JavaScript validi;
- 2 Google Apps Script validi sintatticamente;
- 75 JSON validi;
- 0 riferimenti locali mancanti nelle pagine principali;
- validazione database: 0 errori bloccanti.
