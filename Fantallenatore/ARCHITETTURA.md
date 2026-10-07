# Architettura V224

Il file principale è passato da 16.233 a 5.385 righe e da 774 a 74 funzioni dichiarate. Le 700 funzioni estratte hanno un proprietario esplicito in 24 moduli. I file sono script locali: funzionano senza fetch e senza build JavaScript.

`app_v302.js` conserva stato condiviso, dati statici, collegamento delle dipendenze, bootstrap e registrazione degli eventi. Le factory in `js/domains/` ricevono getter e setter espliciti sul contesto: leggono sempre lo stato corrente, anche dopo caricamenti e cambio carriera. La costruzione delle factory non legge anticipatamente lo stato. Non sono presenti copie alternative del motore.

Questa separazione riduce il file principale e delimita le responsabilità, ma non rende tutte le schermate indipendenti: diversi moduli condividono ancora lo stato e si richiamano. Non aggiungere nuove regole di dominio al file principale. La lista completa delle dipendenze è in `js/domains/manifest.json`.

| Modulo | Funzioni |
|---|---:|
| `auction-policy` | 39 |
| `persistence-controller` | 13 |
| `auction-controller` | 89 |
| `trade-roster-controller` | 29 |
| `career-market-controller` | 59 |
| `league-views` | 31 |
| `shop-controller` | 51 |
| `assistant-policy` | 8 |
| `datacenter-views` | 13 |
| `social-controller` | 21 |
| `expert-controller` | 14 |
| `dashboard-controller` | 36 |
| `matchday-controller` | 2 |
| `lineup-controller` | 56 |
| `matchday-events-controller` | 72 |
| `football-engine` | 43 |
| `live-controller` | 40 |
| `player-development` | 9 |
| `result-controller` | 5 |
| `ready-rosters-controller` | 5 |
| `auction-events-controller` | 29 |
| `pack-controller` | 2 |
| `visual-identity` | 12 |
| `career-setup-controller` | 22 |

## Salvataggi

`js/storage-snapshot.js` decide quali dati conservare; `js/save-manager.js` gestisce backend, coda e backup. Lo schema resta 24 e il namespace del database non cambia. I bonus opzionali del capitano, gol decisivo, Cesarini, panchina d'oro e underdog, minuti e riferimenti del sostituito vengono conservati nelle prestazioni della partita dell'utente, compreso l'avversario. I risultati delle altre partite continuano a conservare i totali senza tutte le prestazioni.

I vecchi salvataggi sono caricabili. I dettagli già cancellati da una versione precedente non possono essere ricostruiti dai soli totali; il fix previene nuove perdite.

## Verifica

`node tests/run-all.js --core` carica i moduli reali nei runtime integrati. `tests/domain-integration.js` confronta nove giornate con hash acquisiti dalla V223 prima dell'estrazione (tre semi). `tests/save-performance-details.js` verifica compattazione, compressione, caricamento, testo dei bonus, totali e compatibilità con campi assenti.

`tests/helpers/production-source.js` ricostruisce dalle implementazioni reali una vista per i vecchi test che estraggono funzioni isolate; non è codice del gioco e non sostituisce il test dei moduli reali. Le fixture V161 preesistenti restano invariate.

Il test GOD preesistente richiamava una funzione assente nell'edizione standard. È sostituito dal controllo dell'edizione di produzione e del namespace corretto, senza introdurre comandi GOD.

Lo smoke browser resta distinto dai test del motore e richiede Chromium.
