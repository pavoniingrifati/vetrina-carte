# Fix riapertura pacchetti e immagini carte

## Problemi corretti

### 1. Impossibile aprire un secondo pacchetto
Dopo la chiusura del riepilogo premium veniva richiamata `clearResults()` dal modulo principale, ma quella funzione era privata di uno script interno a `store.html`. L'errore interrompeva il flusso prima di eseguire:

- `GAME_STATE.opening = false`;
- il ripristino del pacchetto selezionato;
- la riattivazione del pulsante di apertura.

Ora il risultato precedente viene pulito direttamente dal motore, lo stato viene sbloccato e il pacchetto selezionato ricompare immediatamente senza ricaricare la pagina.

### 2. Placeholder sopra la grafica della carta
Le immagini delle carte vengono caricate in modo asincrono. L'evento di errore di una carta precedente poteva arrivare dopo il caricamento della carta successiva e rendere nuovamente visibile il placeholder nero.

Ora ogni caricamento ha un identificatore progressivo. Gli eventi `load` ed `error` appartenenti a una carta precedente vengono ignorati e non possono più coprire la carta corrente.

Se il percorso `img` è valido viene mostrata esclusivamente la grafica originale. Il placeholder viene mostrato solamente quando il campo `img` è assente o il file non è realmente raggiungibile.

## File modificati

- `assets/js/futtu-pack-opening.js`
- `assets/js/futtu-core-original-ui.js`
- `store.html`
- `tools/test-pack-opening.js`

## Cache

I riferimenti degli script in `store.html` sono stati aggiornati alla versione `20260726-opening-reopen-image-v3` per impedire al browser di riutilizzare i vecchi file.

## Test

- sintassi `futtu-pack-opening.js`: valida;
- sintassi `futtu-core-original-ui.js`: valida;
- test dedicati: 14/14 superati.

Il tentativo di collaudo visuale automatico con Chromium headless non si è concluso entro il tempo disponibile, quindi non viene considerato un test superato.
