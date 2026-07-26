# Fix Legend: clic sequenziali e immagine finale

## Problemi corretti

1. La sequenza Legend avanzava automaticamente tramite timer, quindi un solo clic sembrava mostrare tutte le informazioni insieme.
2. Una regola CSS con `!important` manteneva nascosto il frame della carta anche nello step finale.
3. L'immagine veniva avviata al caricamento solo all'ultimo momento senza essere attesa: cliccando rapidamente si poteva passare oltre prima di vederla.

## Nuovo flusso Legend

Dopo l'ingresso della carta Legend, la schermata attende un clic per ogni passaggio:

1. primo clic: **role**;
2. secondo clic: **rarity**;
3. terzo clic: **series**;
4. quarto clic: **name**;
5. quinto clic: caricamento e comparsa della **carta completa**;
6. sesto clic: carta successiva oppure recap finale.

Nessuno step Legend viene più avanzato tramite timer.

## Correzione immagine

- la carta rimane totalmente nascosta prima del quinto clic;
- al quinto clic il codice attende il caricamento della grafica reale o dell'immagine default;
- soltanto dopo il caricamento viene applicata la classe visiva `show-image`;
- corretta la priorità CSS affinché lo stato finale renda visibili sia il contenitore sia il frame della carta.

## File modificati

- `assets/js/futtu-pack-opening.js`
- `assets/css/futtu-pack-opening.css`
- `store.html`
- `tools/test-pack-opening.js`
- `tools/test-legend-click-flow.js`

## Test eseguiti

- `node tools/test-pack-opening.js`: **19/19 superati**;
- `node tools/test-legend-click-flow.js`: simulazione completa superata:
  - 5 clic separati;
  - nessuno step anticipato;
  - immagine visibile al quinto clic;
  - recap raggiunto al sesto clic;
- controllo sintassi di tutti i JavaScript: superato;
- validazione JSON: superata.

Il tentativo di collaudo con Chromium headless non si è concluso nell'ambiente disponibile; per questo è stato aggiunto un test DOM dedicato che esegue direttamente il flusso di clic del modulo.
