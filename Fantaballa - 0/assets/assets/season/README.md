# Motore stagione modulare

Il precedente `assets/season-engine.js` è stato diviso in moduli classici caricati in ordine.
Le differenze tra Community e REAL rimangono nei rispettivi file `season-config-*.js`.

## Ordine di caricamento obbligatorio

1. `01-bootstrap.js` — configurazione, costanti e chiavi condivise.
2. `02-achievements.js` — integrazione achievement.
3. `03-save-system.js` — formato versionato, migrazione, backup, recupero e scrittura verificata.
4. `03-state-and-data.js` — formazioni, profili allenatore, stato, database e normalizzazione.
5. `04-setup-and-draft.js` — configurazione squadra e draft.
6. `05-opponents-and-chaos.js` — avversari e modalità Caos.
7. `06-competitions-and-stories.js` — calendario, coppe e archi narrativi.
8. `07-effects-quests-chains.js` — effetti, sponsor, quest e catene.
9. `08-special-rules.js` — regole speciali, playoff e modificatori.
10. `09-analytics-and-summary.js` — formazione, analytics e riepilogo.
11. `event-handlers.js` — registro esplicito della logica eseguibile degli eventi.
12. `10-events.js` — caricamento, validazione e risoluzione dei cataloghi JSON.
13. `11-season-ui-and-lineup.js` — schermata stagione e formazione.
14. `12-match-simulation.js` — simulazione, cronaca e risultati.
15. `13-market-and-finish.js` — mercato, conclusione e invio.
16. `14-runtime.js` — rendering, avvio e gestori globali.

## Salvataggi

Il motore usa un envelope di formato `2`, separato dalla versione interna dello stato (`44`).

- scrittura temporanea e rilettura di verifica;
- backup automatico del primario precedente;
- recupero del temporaneo più recente o del backup;
- `seasonId` stabile per ogni run;
- isolamento dei salvataggi corrotti, futuri o dell'altra modalità;
- migrazione automatica dei vecchi salvataggi;
- blocco di `NaN` e `Infinity`.

## Regole di manutenzione

- Inserire ogni nuova funzione nel modulo della sua responsabilità.
- Non cambiare l'ordine degli script senza eseguire la suite.
- Non ricreare un secondo motore per REAL: usare le configurazioni.

## Suite di test

`15-test-api.js` è caricato soltanto da `test-season-runner.html`, mai dalle pagine pubbliche.
La suite usa chiavi `localStorage` isolate con suffisso `_test_runner` e prova gli stessi 15 moduli pubblici in Community e REAL.

Il runner carica inoltre `assets/database-validator.js` e verifica che i database attivi non contengano errori bloccanti o correzioni sicure ancora pendenti. Gli avvisi che richiedono una decisione editoriale non bloccano il gioco.

## Eventi data-driven

I contenuti degli eventi non sono più dichiarati dentro il motore:

- `data/events/events-common.json` — eventi condivisi;
- `data/events/events-community.json` — contenuti esclusivi Community;
- `data/events/events-real.json` — estensioni specifiche REAL;
- `assets/season/event-handlers.js` — sola logica eseguibile;
- `event-check.html` — pannello di validazione;
- `tools/validate-events.js` — validazione da terminale.

Ogni catalogo usa `schemaVersion: 1`. Gli eventi sono ordinati tramite `order`, quindi la separazione tra file non modifica l'ordine storico né la selezione casuale. I JSON possono cambiare testi, etichette, descrizioni e associazione agli handler; nessun valore del JSON viene eseguito come codice.

## Balance Lab

`16-balance-api.js` è un modulo esclusivamente diagnostico, caricato da `balance-runner.html` e mai dalle pagine pubbliche del Campionato.

- usa gli stessi database, draft, profili, formazioni, eventi e regole del motore;
- isola completamente il `localStorage` con suffisso `_balance_runner`;
- supporta seed ripetibili;
- offre un motore rapido statistico e uno completo basato su `playRound('instant')`;
- produce aggregazioni per allenatore, modulo, eventi e giocatori estratti;
- può esportare report JSON e CSV;
- non modifica i moduli pubblici `01–14` né i salvataggi degli utenti.
