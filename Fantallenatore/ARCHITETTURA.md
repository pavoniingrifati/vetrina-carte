# Architettura e regole di modifica

V162 introduce confini espliciti per due responsabilità prima inserite nell'app principale. Non completa la modularizzazione: schermate, gestione degli eventi e numerose transizioni restano accoppiate in app_v302.js.

| Area | Responsabilità | Dipendenze e divieti |
|---|---|---|
| app_v302.js | Stato carriera, orchestrazione e UI | Collega i moduli allo stato corrente; mantiene adattatori brevi |
| js/storage-snapshot.js | Proiezione dello stato da salvare, compattazione | Factory con compactMarketState; nessun DOM, storage, timer o scrittura |
| js/cpu-lineup-policy.js | Valutazione dei giocatori e confronto moduli CPU | Dati e funzioni pre-partita espliciti; nessun accesso diretto a stato globale, UI o esiti futuri |
| js/save-manager.js | Coda, backend, backup e flush | Non decide quali dati di gioco conservare |
| js/transfer-engine.js | Piani e materializzazione del mondo di mercato | Contiene compattazione e idempotenza dei piani |
| js/season-engine.js | Calendari e classifiche | Dati espliciti, nessuna UI |
| tests/helpers/season-runtime.js | Adapter diagnostico dell'app reale | Disabilita bootstrap UI, persistenza e feedback visivo; non sostituisce formule calcistiche |

## Modificare i salvataggi

Intervenire in storage-snapshot.js per cambiare il formato compatto, in save-manager.js per cambiare il backend. Stato live e Big Match devono restare ripristinabili. Non alterare input durante la serializzazione. Le migrazioni restano nell'app; una modifica di schema deve dichiarare la compatibilità e avere un test di salvataggio precedente.

## Modificare le CPU

Intervenire in cpu-lineup-policy.js per i pesi, lasciando agli adattatori dell'app le letture dello stato. Il modulo riceve probabilità, forma, statistiche e matchup tramite funzioni esplicite. Non usare risultati già generati della giornata come informazione disponibile prima della formazione. La costruzione della rosa schierata e l'applicazione delle carte restano nell'app.

## Controlli da eseguire

`node tests/run-all.js --core`

- module-boundaries.js confronta snapshot e 144 punteggi con fixture registrate dal codice V161 prima dell'estrazione; verifica input non mutati, assenza di logica duplicata e ordine di caricamento.
- long-career-storage.js verifica salvataggi compatti, migrazione, contatori e mercato invariato.
- cpu-lineup-context.js verifica decisioni contestuali e costruzione reale di una formazione.
- balance-production.js verifica il percorso di simulazione attraverso l'app e i moduli reali.

Se una modifica cambia intenzionalmente il comportamento, documentare il cambiamento e aggiornare soltanto le aspettative coinvolte. Non rigenerare tutte le fixture per far passare il runner. Un refactoring strutturale deve conservare le aspettative.

I test core non sono test browser. Per il caricamento e lo smoke UI usare la suite browser con Chromium disponibile. In questa consegna il browser resta non verificato.

## Passi successivi

Separare progressivamente costruzione delle formazioni, controller dell'asta e transizioni di giornata. Prima di ciascuna estrazione, registrare il comportamento di riferimento, individuare le dipendenze e distinguere dominio da UI. I test che estraggono testo dall'app sono ancora presenti: convertirli a test delle API durante l'estrazione della relativa responsabilità.
