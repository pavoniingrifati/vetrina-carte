# Architettura V257

Il file principale è passato da 16.233 a 5.385 righe e da 774 a 74 funzioni dichiarate. Le 700 funzioni estratte hanno un proprietario esplicito in 30 moduli. I file sono script locali: funzionano senza fetch e senza build JavaScript.

`app_v302.js` conserva stato condiviso, dati statici, collegamento delle dipendenze, bootstrap e registrazione degli eventi. Le factory in `js/domains/` ricevono getter e setter espliciti sul contesto: leggono sempre lo stato corrente, anche dopo caricamenti e cambio carriera. La costruzione delle factory non legge anticipatamente lo stato. Non sono presenti copie alternative del motore.

Questa separazione riduce il file principale e delimita le responsabilità, ma non rende tutte le schermate indipendenti: diversi moduli condividono ancora lo stato e si richiamano. Non aggiungere nuove regole di dominio al file principale. La lista completa delle dipendenze è in `js/domains/manifest.json`.

| Modulo | Funzioni |
|---|---:|
| `auction-policy` | 39 |
| `persistence-controller` | 13 |
| `auction-controller` | 28 |
| `auction-views` | 18 |
| `auction-analysis-policy` | 6 |
| `auction-clock` | 8 |
| `auction-arcade-controller` | 5 |
| `auction-feedback` | 8 |
| `auction-powers-controller` | 16 |
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

La suite browser estesa resta distinta dai test del motore e richiede Chromium.


## Confini dell’asta V257

Il controller principale dell’asta passa da 1.898 a 727 righe: mantiene chiamate, rilanci, reazioni CPU, aggiudicazione e avanzamento. Le schermate (468 righe), analisi (81), timer (149), aste speciali (164), feedback (154) e poteri (209) hanno proprietari distinti.

Le 89 funzioni preesistenti restano disponibili con gli stessi nomi. I richiami interni a ciascun modulo sono diretti: eliminate 67 dipendenze che facevano tornare nel file principale per richiamare funzioni dello stesso modulo. Le factory ricevono solo i collaboratori esterni effettivamente utilizzati, elencati nel manifest; i getter continuano a leggere lo stato corrente dopo una ripresa o un cambio carriera.

`auction-analysis-policy` dipende soltanto da stato, hash carriera, clamp e catalogo club, oltre ai dati/motore globali già usati. Non gestisce DOM, salvataggi o timer. Il controller del flusso usa 78 dipendenze esterne anziché il contratto precedente di 170 voci, che includeva anche richiami interni. Questi numeri non misurano l’indipendenza complessiva: restano collegamenti tra i moduli e lo stato condiviso.

Il file principale contiene ora 5.441 righe e 74 funzioni: il collegamento esplicito delle nuove factory aggiunge 53 righe. La modularizzazione migliora i confini dell’asta senza introdurre proxy globali o un secondo motore. Rimangono da ridurre le dipendenze del flusso e degli altri controller.

`tests/auction-module-boundaries.js` confronta tutte le funzioni con hash acquisiti dalla V256, ignorando esclusivamente il prefisso dei collaboratori; controlla proprietà unica, contratti, richiami locali, costruzione senza letture anticipate e sostituzione dello stato carriera. I test integrati caricano i moduli reali. La verifica browser richiede ancora Chromium.


## Verifica browser V258

La suite estesa è stata eseguita in Chromium su sette viewport: tutte le 42 combinazioni passano. Corrette tre interferenze CSS, senza cambiare il motore o i confini dei moduli. Il report è `reports/TEST_GRAFICI_V258.md`; risultati e screenshot sono in `reports/browser/`. I report precedenti mantengono il loro stato storico `not_run`.


## Presentazione mobile V259

`js/presentation-state.js` pubblica snapshot immutabili per il riepilogo dell’asta: crediti, posti occupati e totali, conteggi per ruolo, fase e disponibilità dei rilanci. I numeri provengono da stato e regolamento; la disponibilità dei comandi viene pubblicata dal medesimo valore `userCanAct` usato dalla vista dell’asta, senza ricopiare la regola nel modulo mobile. Le viste notificano dopo gli aggiornamenti della rosa, del turno e dell’asta.

`js/mobile-auction-app.js` si iscrive a questi dati; non legge più testi di `myBudget`, `mySlots`, `roleNeed` o classi di `liveAuction`/`userBidControls`, e non usa MutationObserver. Crediti e ruoli possono cambiare formato nella vista desktop senza alterare il riepilogo mobile.

Gli attributi `data-mobile-auction-region` dichiarano Rosa, Lega e Storico. `data-mobile-anchor` dichiara controlli asta, navigazione formazione, istruzioni, contenuto della diretta, tabellone e formazioni. I tre contenitori details della lega sono dichiarati nell’HTML, invece di essere costruiti da un modulo e poi ricercati da un altro. Gli attributi sono il contratto: se una schermata viene riscritta, vanno conservati sulle regioni equivalenti.

`js/mobile-locations.js` conserva marcatori per ripristinare le posizioni originali, evita la registrazione ripetuta nella stessa composizione e sposta gli stessi nodi senza clonare i pulsanti. I due adattatori hanno inizializzazione idempotente e `destroy()`, che rimuove iscrizioni, listener media, navigazioni e marcatori e ripristina gli elementi. Restano spostamenti necessari per mantenere i comandi asta fuori dallo scorrimento e la toolbar della diretta nella posizione mobile; non sono stati eliminati con duplicazioni dei controlli.

CSS, regole e schema salvataggi restano invariati. I moduli di navigazione inferiore e carosello rivali conservano le proprie osservazioni sulla visibilità/collezione, senza ricavare numeri dal testo. Questo intervento riduce il legame con la struttura delle schermate coinvolte, ma non trasforma l’intera interfaccia in componenti indipendenti.

Verifica V259: 64 script core e 42 combinazioni browser passate. La fase asta include cambi ripetuti desktop/mobile, controllo dell’identità dei nodi, reinizializzazione, smontaggio/rimontaggio e indipendenza dei crediti dal testo desktop.
