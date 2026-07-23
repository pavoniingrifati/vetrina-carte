# Architettura modulare dei Campionati

Le modalità **Campionato Community** e **Fantacampionato REAL** condividono lo stesso motore, ma conservano database, salvataggi, testi, validazioni ed eventi esclusivi differenti.

Il precedente file monolitico `assets/season-engine.js` è stato rimosso. La logica condivisa è ora nella cartella `assets/season/`.

## Configurazioni delle modalità

- `assets/season-config-community.js`: differenze del Campionato Community.
- `assets/season-config-real.js`: differenze del Fantacampionato REAL.
- `campionato.html`: grafica e configurazione Community.
- `campionato-real.html`: grafica e configurazione REAL.

## Moduli del motore

I moduli vengono caricati come script classici e devono mantenere questo ordine:

1. `01-bootstrap.js` — configurazione e costanti condivise.
2. `02-achievements.js` — achievement di partita e stagione.
3. `03-save-system.js` — salvataggi versionati, backup, recupero e migrazione.
4. `03-state-and-data.js` — stato, database e normalizzazione.
5. `04-setup-and-draft.js` — configurazione squadra e draft iniziale.
6. `05-opponents-and-chaos.js` — avversari e modalità Caos.
7. `06-competitions-and-stories.js` — calendario, coppe e archi narrativi.
8. `07-effects-quests-chains.js` — intesa, sponsor, effetti, quest e catene.
9. `08-special-rules.js` — regolamenti speciali, playoff e modificatori.
10. `09-analytics-and-summary.js` — formazione, potenza, analytics e riepilogo.
11. `10-events.js` — catalogo e risoluzione di eventi e decisioni.
12. `11-season-ui-and-lineup.js` — schermata stagione e formazione.
13. `12-match-simulation.js` — simulazione, cronaca e risultato.
14. `13-market-and-finish.js` — mercato, conclusione e invio risultati.
15. `14-runtime.js` — rendering, avvio e gestori globali.

## Differenze preservate

Le due configurazioni continuano a separare:

- chiavi e migrazione dei salvataggi;
- identificativi e nome predefinito della squadra utente;
- database principale e database secondario degli eventi Multiverso;
- validazione di club e rose;
- testi specifici della modalità;
- categorie e codici per l'invio delle vittorie;
- eventi disponibili soltanto nella modalità Community.

## Regole di manutenzione

- Una modifica condivisa va eseguita nel modulo della relativa responsabilità.
- Una differenza intenzionale Community/REAL va inserita nel rispettivo `season-config-*.js`.
- Non creare copie alternative dei moduli per la modalità REAL.
- Non cambiare l'ordine degli script senza eseguire i test automatici.
- Le funzioni di supporto di un evento vanno tenute in `07-effects-quests-chains.js` o `08-special-rules.js`; la definizione dell'evento va in `10-events.js`.
