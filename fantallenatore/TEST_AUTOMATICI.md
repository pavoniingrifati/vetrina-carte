# Verifiche V224

Nuovi controlli: `domain-integration.js` carica le factory reali e confronta nove giornate con la V223; `save-performance-details.js` verifica il round-trip compresso dei dettagli e dei riepiloghi; `css-build.js` verifica sorgenti, ordine e percorsi del CSS runtime. Il test GOD non applicabile è sostituito da `production-edition.js`.

I test che isolano singole funzioni leggono una vista ricostruita dai moduli di produzione. I runtime di integrazione caricano direttamente i file di dominio. Non è stata rigenerata nessuna fixture preesistente per adattarla al refactoring.

I risultati di questa consegna sono in `reports/REFACTOR_V224.md`, `reports/test-latest.json`, `reports/css-v224.json` e `reports/auction-v224.json`. La verifica visiva su browser rimane non eseguita.

---

# Test automatici di Fantallenatore — copertura e limiti

## Avvio rapido su Windows

- `ESEGUI_TEST.bat`: esegue regressioni, 21 aste con soglie bloccanti e scenari browser. Se Chromium manca termina con codice 3: verifica incompleta.
- `VERIFICA_ASTE.bat`: esegue 42 aste complete (due semi) e applica le soglie di attenzione come controllo bloccante.

Serve Node.js LTS. Per il browser: `npm install`, poi `npx playwright install chromium`. Le aste richiedono alcuni minuti.

## Da terminale

Eseguire dalla cartella del gioco:

```text
node tests/run-all.js
node tests/run-all.js --core
node tests/auction-competitive.js --seeds 2 --report reports/auction-latest.json
node tests/auction-competitive.js --seeds 2 --strict --report reports/auction-latest.json
node tools/summarize-auctions.js reports/auction-latest.json
```

`--skip-auctions` esclude soltanto la simulazione completa delle aste. I test del runtime dell'asta restano inclusi.
`--seeds` accetta un intero tra 1 e 100. Lo stesso seme riproduce le stesse scelte.

## Cosa verifica la nuova simulazione

Usa le funzioni effettive di `app_v302.js`, lette al momento dell'esecuzione, per:

- personalità e composizione delle CPU per categoria;
- valori di mercato, interesse e limite di offerta delle CPU;
- chiamate CPU, scelta del ruolo, turni equi e incrementi dei rilanci;
- assegnazione dei giocatori attraverso `FantaAuctionEngine`.

Non contiene una copia alternativa dell'intelligenza delle CPU. Se una dipendenza cambia o manca, il test deve fallire.
Il confronto `auction-runtime-check.js` verifica riproducibilità e parità dei limiti e delle chiamate con/senza cache.

Ogni asta termina con 250 acquisti: dieci rose da 25 giocatori, 3 P / 8 D / 8 C / 6 A. Dopo ogni acquisto verifica budget, riserva per completare la rosa e contabilità; a fine asta verifica anche unicità dei giocatori e quote per ruolo.

Scenari: quattro divisioni, asta per reparti e chiamata libera (quest'ultima solo da C in su), tre strategie dell'utente, per ogni seme. Sono 21 aste per seme.

Strategie dell'utente, esplicite e indipendenti dalle CPU:

- **Equilibrata**: chiama per OVR e conserva i budget di reparto, con tetto pari al 110% del riferimento.
- **Top**: chiama per OVR e può spendere fino al 165% del riferimento sui dieci migliori per ruolo; 75% sugli altri.
- **Attendista**: chiama i giocatori meno costosi e offre fino al 45% del riferimento prima del completamento del 65% degli slot del reparto, poi fino al 105%. È uno stress test di risparmio e chiamate economiche; può acquistare riserve a 1 se nessuna CPU rilancia.

Il riferimento prezzo è il valore di mercato di produzione moltiplicato per la correzione del ruolo. Non è il prezzo che un giocatore deve necessariamente raggiungere.

## Misure e soglie

Il JSON contiene tutte le assegnazioni e le rose finali, oltre a:

- crediti residui delle CPU e dell'utente;
- numero dei top10 per ruolo presi dall'utente;
- prezzo medio dei top rispetto al riferimento;
- top acquistati dall'utente a <=25% del riferimento, anche dopo il 60% degli slot;
- CPU con slot/credito disponibili, CPU interessate e CPU che rilanciano;
- qualità OVR del miglior undici per ogni rosa, sui sei moduli standard.

Le soglie di attenzione, definite prima di raccogliere la baseline, per Serie B e A sono:

1. almeno due top10 per ruolo acquistati tardi dall'utente a <=25% del riferimento;
2. almeno venti dei quaranta top10 per ruolo concentrati nell'utente;
3. almeno 100/500 crediti residui medi delle CPU.

Sono obiettivi di audit, non una dimostrazione automatica che ogni singolo caso sia un bug. Un vantaggio OVR elevato va comunque valutato anche se nessuna soglia scatta. OVR11 è un indicatore di qualità, non una previsione di vittoria o di fantapunti.

Codici di uscita:

- `0`: integrità valida; in modalità normale le segnalazioni sono diagnostiche.
- `1`: errore tecnico/assertion o test di regressione fallito.
- `2`: solo con `--strict`, integrità valida ma soglie di bilanciamento superate.

Non confondere “tutti i test tecnici passano” con “il gioco è bilanciato”.

## Limiti della verifica

La baseline usa il listone iniziale, 500 crediti uguali, regolamento base, nessun potere, evento, bonus sponsor o rapporto dinamico. Risolve i rilanci legalmente fino a esaurire le offerte, senza simulare i timer, il browser o i click. Non sostituisce una verifica UI né la riproduzione di un salvataggio di una carriera avanzata.

La verifica delle aste è separata da `balance_sim.js`, ora collegato al motore delle partite di produzione.

## Correzioni dei test precedenti

- `auction-regressions.js`: dipendenza `auctionReputationMultiplier` aggiunta alla fixture; divisioni aggiornate a 4=Amatori, 3=C, 2=B, 1=A.
- `pokemon-catalog-smoke.js`: fixture aggiornata con club originali, pool B e funzioni di sincronizzazione richieste dal catalogo attuale.
- `real-league-promotion.js`: letture relative alla cartella del gioco, così il test funziona anche lanciato da un'altra directory.
- `run-all.js`: esegue tutti gli script di regressione, non soltanto i cinque che erano richiamati dal batch precedente.

## Progressione CPU V159

`auction-difficulty.js` verifica che la competenza cresca fra categorie a parità di budget e che i vincoli per completare le rose restino rispettati. La simulazione usa ora anche le nuove funzioni di valutazione qualitativa, stima della titolarità e pianificazione dei crediti del gioco.

Il confronto V158/V159 è in `reports/DIFFICOLTA_CPU_CONFRONTO.md`. Le misure V159 sono in `reports/auction-difficulty-after.json`; `auction-baseline.json` conserva la prova della V158. Il comando ordinario crea invece `auction-latest.json` per la versione corrente.


## Sicurezza effettiva dei risultati

Il successo indica soltanto lo scope eseguito. `--core` esclude esplicitamente aste complete e browser. Il runner salva `reports/test-latest.json`, distinguendo `passed`, `failed` e `not_run`. Exit 1: errori; exit 3: browser non disponibile. Le soglie di bilanciamento delle aste ora sono bloccanti anche nel runner principale.

| Verifica | Garanzia | Limite |
|---|---|---|
| save-integration.js | Coda, reload del manager, backup corrotto, migrazione compressa, abort atomico, clear con scrittura pendente | Adapter controllabile: non prova IndexedDB reale, chiusura scheda o quota del dispositivo |
| Calendario + classifica + salvataggio | 38 giornate, dieci squadre, contabilità punti e ripresa dopo giornata 19 | Punteggi fixture: non simula voti, infortuni, premi, mercato o promozione |
| Aste competitive | Funzioni CPU reali, legalità e soglie su scenari deterministici | Non prova timer, pulsanti o tutte le strategie umane |
| responsive-audit.js | Presenza dei contratti CSS | Nessuna viewport realmente renderizzata; non dichiara più viewport superate |
| browser/run.js | Scenari V256: avvio, chiamata, rilanci, ripresa asta, formazione, capitano, Diretta Gol e Big Match; sette viewport | Dati iniziali preparati; nessun confronto pixel certificato. Qui NON ESEGUITO per Chromium assente |

I test isolati che estraggono funzioni o usano stub non diventano test end-to-end perché passano. Il numero di script non misura la copertura. Rimangono prioritari test browser dei rilanci con timer, ripresa durante asta/live e transizione di stagione. La suite browser è stata eseguita in Chromium Linux nella V258; copre esclusivamente gli scenari dichiarati.


## Simulatore di bilanciamento delle partite

`node balance_sim.js --seasons 3 --days 38 --seed balance --report reports/balance-production-latest.json`

Oppure `SIMULA_BILANCIAMENTO.bat`. Il runtime carica i moduli reali e l'app fino al bootstrap degli eventi UI; non ricopia formule calcistiche. Disabilita soltanto salvataggio e feedback visivo dei voti. Applica prima gli eventi delle nove partite e poi quelli del Big Match, come la simulazione diretta del gioco. Aggiorna classifica, statistiche, indisponibilità e OVR tramite `updateSerieASeasonWorld`.

Il report registra SHA-256 dei sorgenti, seed, risultati e prestazioni di ogni giornata. I vecchi risultati ottenuti col simulatore separato non sono utilizzabili come prova del comportamento della build corrente. Confrontare report soltanto conoscendo sorgenti, seed e scope.

La stagione simulata riguarda il mondo Serie A con regole iniziali e nessuna rosa fantasy utente. Esclude mercato di gennaio, promozioni, cambi di stagione, UI, timer e persistenza browser. Tre stagioni sono un campione diagnostico, non una certificazione. Il test `balance-production.js` verifica determinismo, variazione seed, classifica e voti finiti su due giornate.


## Formazioni CPU V160

`cpu-lineup-context.js` verifica criteri pre-partita e progressione con fixture controllabili, poi esercita modulo e costruzione formazione di produzione con una rosa reale. Controlla undici titolari unici, indisponibilità e copertura della rosa. Non misura percentuali di vittoria o copertura UI.


## Carriere lunghe V161

`long-career-storage.js`: fixture strutturale di 100 stagioni, mondo mercato invariato, piani storici idempotenti, contatori acquisti, saldi, trofei, snapshot non mutante e ripresa col parser di produzione. Non simula cento stagioni e non misura FPS. `career-smoke.js` verifica quattro stagioni sintetiche e otto mercati applicati; conserva quattro piani dettagliati e tutti gli identificativi.

Registro FP: ultimi 76 accrediti; log: ultime 200 righe; piani mercato: ultime quattro finestre più ultimo movimento per giocatore. Trofei, premi e recap non sono troncati.


## Confini dei moduli V162

`module-boundaries.js` confronta i due moduli estratti con fixture V161 e controlla input non mutati, caricamento prima dell'app e assenza di dipendenze UI/storage. I runtime diagnostici caricano gli stessi nuovi moduli usati da index.html. Vedere ARCHITETTURA.md per responsabilità e regole delle successive modifiche.


## Test grafici V256

La suite browser ora prepara stati ripetibili e aziona i pulsanti reali. Controlla rilanci +1/+5/+10, lascia, ripresa IndexedDB, due moduli, capitano, hover, conferma formazione e comandi Diretta Gol fino al Big Match. Verifica geometria, ritagli, punti di click, sovrapposizioni sul campo e permanenza dei comandi asta durante lo scorrimento mobile.

I 42 scenari previsti (sei fasi per sette viewport) sono descritti in `tests/browser/README.md`. Il codice di preparazione è iniettato soltanto dal server locale dei test: non viene caricato dal gioco normale. Screenshot e report sono in `reports/browser/`. Chromium assente genera `not_run` e codice 3, mai un falso successo. Le fixture sono state verificate con Node; i test grafici sono stati poi eseguiti e corretti nella V258.


## Modularizzazione asta V257

`auction-module-boundaries.js` verifica le 89 funzioni rispetto alla V256, i sette contratti dell’asta e la lettura dello stato aggiornato. I test integrati e le fixture browser caricano tutti i nuovi moduli. Non è una verifica della resa grafica: Chromium resta necessario.

Il test One Shot Admin ora esegue `awardAuction` reale con timer controllato, anziché sostituire l’aggiudicazione con una funzione semplificata. Il catalogo viene sincronizzato con la carriera prima di scegliere i giocatori. Le chiamate di presentazione restano disabilitate nel runtime Node; la verifica non certifica animazioni o durata dei timer.


## Verifica grafica V258

Chromium è stato ottenuto dalla distribuzione ufficiale Chrome for Testing, con controllo MD5 dell’archivio. La suite usa i controlli reali su sette viewport. Il report finale e gli screenshot sono in `reports/browser/`; le correzioni e i limiti sono in `reports/TEST_GRAFICI_V258.md`.

Corrette tre interferenze CSS: riga rilanci desktop più bassa dei pulsanti; ordine mobile del tabellone ereditato dalla vecchia vista; riquadro evento invisibile che intercettava i tocchi. I controlli geometrici ora misurano i pulsanti dopo uno scorrimento coerente e raccolgono anche l’elemento che copre un punto di click. Il test formazione usa il selettore giocatori reale; la verifica negativa del rilevatore disabilita la transizione del solo pulsante spostato nel test.


## Dati e composizione mobile V259

`presentation-state.js` verifica snapshot immutabili, conteggi, cambio carriera con identico giocatore in asta, deduplicazione delle notifiche, disiscrizione e assenza di dipendenze DOM. `mobile-auction-app.js` e `mobile-ui.js` verificano posizioni originali, listener conservati, ripetuti cambi viewport, inizializzazione idempotente e smontaggio/rimontaggio.

La suite browser esercita gli stessi passaggi sui nodi reali; modifica deliberatamente il testo desktop dei crediti e verifica che il riepilogo mobile continui a mostrare il numero dello stato. Le 42 combinazioni passano, insieme ai 64 script core. Il confronto delle funzioni asta con V256 ammette esclusivamente le tre pubblicazioni esplicite del modello di presentazione; non rigenera gli hash della logica precedente.
