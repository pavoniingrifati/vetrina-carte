# Test browser V259

## Esecuzione

Dalla cartella Fantallenatore, con Node.js installato:

```sh
npm install
npx playwright install chromium
npm run test:browser
```

`npm run test:full` include anche regressioni e aste complete. `npm test` esegue soltanto le regressioni Node, senza browser.

Il server ascolta esclusivamente su localhost, su una porta libera. Il browser usa contesti temporanei: non apre il profilo personale. Per vedere le azioni: `FANTA_BROWSER_HEADED=1 npm run test:browser` su bash. `FANTA_BROWSER_EXECUTABLE` permette di indicare il percorso assoluto di un Chrome/Chromium già installato.

## Scenari e controlli

| Fase | Azioni e verifiche |
|---|---|
| Avvio | Identità obbligatoria, passaggio all'avatar, reload |
| Chiamata | Apertura listone e chiamata tramite pulsante reale |
| Asta | Observer e acquisto doppio; comandi visibili e raggiungibili; dock fermo durante lo scroll mobile; rilanci +1/+5/+10; lascia; salvataggio IndexedDB e ripresa dopo reload; ripetuti cambi desktop/mobile; identità dei nodi, assenza di duplicati, smontaggio/rimontaggio e dati mobili indipendenti dal testo desktop |
| Rilevatore | Sposta deliberatamente un pulsante fuori schermo nel solo test, verifica che il controllo lo rifiuti e ripristina lo stile |
| Formazione | Autocompletamento premium, 4-3-3 e 4-4-2, undici giocatori dentro il campo senza sovrapposizioni; selezione capitano senza sostituzione; stabilità all'hover; conferma |
| Diretta Gol | Due squadre affiancate con undici titolari ciascuna; tabellone in ordine squadra/risultato/avversario con colonne equivalenti; controlli visibili; velocità, pausa, prossimo evento, salta al 90 e avvio Big Match |

Viewport: 1920×1080, 1366×768, 1024×768, 768×1024, 390×844, 369×682, 844×390. Sono 42 combinazioni fase/viewport, con più verifiche per fase. Una fase fallita interrompe le successive su quella viewport; le altre viewport continuano.

## Risultati

`reports/browser/latest.json` distingue `passed`, `failed` e `not_run`. Le cartelle per viewport contengono screenshot dell'asta, delle formazioni, della diretta e dell'errore, quando il browser viene eseguito. Le misure del campo sono riportate nel JSON; gli errori geometrici includono le misure utili nell'assertion.

Codici: **0** tutti gli scenari eseguiti passano; **1** errore/assertion; **3** browser o dipendenze assenti, verifica non eseguita. Il report distribuito con V256 registra `not_run`: Chromium non era disponibile nell'ambiente di consegna.

## Confini della copertura

Il server inietta `fixture-bridge.js` nella copia servita di `app_v302.js`, senza modificarne il file. Il gioco aperto normalmente non carica il bridge. Le carriere iniziali sono preparate con il catalogo e il motore reali; gli acquisti della fixture rispettano i ruoli e producono dieci rose uniche da 25 giocatori. Il test Node `tests/browser-fixtures.js` ne verifica legalità e isolamento, ma non verifica la grafica.

Le azioni usano i gestori di produzione. I timer vengono fermati tra le azioni per evitare concorrenza casuale: non è una verifica della durata dell'asta, delle corse tra timer e click o del comportamento in background. Non simula un'asta completa di 250 acquisti nel browser, tutti i poteri, gli abbonamenti bloccati, tutte le animazioni o una stagione intera. Gli screenshot sono destinati alla revisione: non esiste una baseline pixel approvata. Chromium non certifica Safari/iPhone. La V258 esegue questi scenari in Chromium su Linux; restano fuori dalla verifica gli altri motori e dispositivi fisici.
