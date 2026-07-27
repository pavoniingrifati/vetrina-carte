# UX Percorso stagione

## Obiettivo

Rendere più chiaro l'andamento della stagione senza aggiungere pannelli sempre visibili o appesantire la schermata principale.

## Interfaccia

Nella sezione a schede del Campionato è stata aggiunta la scheda `Percorso` accanto a:

- Classifica
- Calendario
- Rosa
- Statistiche

La scheda mostra soltanto:

- bilancio vittorie-pareggi-sconfitte;
- forma delle ultime cinque partite;
- numero di eventi registrati;
- numero di effetti attivi;
- ultima partita disputata.

Lo storico completo delle partite e quello degli eventi sono dentro due pannelli `details` chiusi in partenza. In questo modo la schermata resta leggera e l'utente apre solo ciò che gli serve.

## Salvataggio

Non è stato creato un nuovo archivio.

I dati sono ricavati da campi già presenti nel salvataggio versionato:

- `state.history`: storico delle partite;
- `state.analytics.eventLog`: eventi e decisioni;
- `state.activeEffects`: effetti temporanei attivi;
- `state.standings`: bilancio e classifica.

Tutto continua a essere scritto nel `localStorage` tramite il sistema di autosalvataggio con backup già presente.

## Riepilogo finale

Nel riepilogo di fine stagione è stato aggiunto lo storico partite richiudibile. Anche lo storico delle scelte evento ora parte chiuso, per evitare una pagina finale eccessivamente lunga.

## File modificati

- `assets/season/09-analytics-and-summary.js`
- `assets/season/11-season-ui-and-lineup.js`
- `assets/season/15-test-api.js`
- `assets/mobile-responsive.css`
- `campionato.html`
- `campionato-real.html`
- `test-season-runner.html`
