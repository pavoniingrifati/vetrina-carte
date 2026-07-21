# Motore stagione modulare

Il precedente `assets/season-engine.js` è stato diviso in moduli classici caricati in ordine.
Il comportamento resta invariato: le dichiarazioni globali continuano a condividere lo stesso ambiente JavaScript del browser.
Le differenze tra Community e REAL rimangono nei rispettivi file `season-config-*.js`.

## Ordine di caricamento obbligatorio

1. `01-bootstrap.js` — Configurazione, chiavi di salvataggio e bootstrap condiviso.
2. `02-achievements.js` — Integrazione achievement e controlli di fine partita/stagione.
3. `03-state-and-data.js` — Formazioni, profili allenatore, stato, salvataggi, caricamento e normalizzazione dati.
4. `04-setup-and-draft.js` — Configurazione squadra, interfaccia del draft, intesa e costruzione della rosa.
5. `05-opponents-and-chaos.js` — Rose avversarie, modalità Caos, potenza squadre e chiusura del draft.
6. `06-competitions-and-stories.js` — Calendario, coppa parallela e archi narrativi principali.
7. `07-effects-quests-chains.js` — Intesa, effetti, sponsor, quest e catene di eventi.
8. `08-special-rules.js` — Azioni degli eventi, regolamenti speciali, playoff e modificatori persistenti.
9. `09-analytics-and-summary.js` — Risoluzione formazione, potenza, analytics e riepilogo condivisibile della stagione.
10. `10-events.js` — Catalogo eventi/decisioni e relativa interfaccia di risoluzione.
11. `11-season-ui-and-lineup.js` — Schermata della stagione, disponibilità, avversari, formazione ed effetti sulla rosa.
12. `12-match-simulation.js` — Simulazione, gol, statistiche, cronaca live, giornata e risultato partita.
13. `13-market-and-finish.js` — Mercato di metà stagione, conclusione campionato, invio ed esportazione risultati.
14. `14-runtime.js` — Router di rendering, avvio applicazione e gestori globali.

## Regola di manutenzione

- Inserire ogni nuova funzione nel modulo della sua responsabilità.
- Evitare dipendenze circolari e non cambiare l’ordine degli script senza eseguire i test.
- Non ricreare un secondo motore per la modalità REAL: usare le configurazioni.

## Suite di test

Il file `15-test-api.js` non fa parte del caricamento normale del gioco.
Viene caricato soltanto da `test-season-runner.html` e rende disponibili i controlli automatici alla pagina `test-season.html`.

- Non aggiungerlo a `campionato.html` o `campionato-real.html`.
- I test usano chiavi `localStorage` isolate con suffisso `_test_runner`.
- La suite prova entrambe le configurazioni usando gli stessi 14 moduli del gioco.
