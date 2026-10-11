# Interfaccia mobile V259

Il riepilogo dell’asta mobile ora riceve dati dal gioco tramite snapshot immutabili: crediti, posti, ruoli, fase e comandi disponibili. Non copia più il testo desktop e non osserva le classi degli elementi per ricostruire lo stato.

## Confini della modifica

- `presentation-state.js` costruisce il modello dai dati, senza DOM o salvataggi. La vista asta pubblica tre aggiornamenti espliciti, condividendo `userCanAct` con i pulsanti già esistenti.
- Le regioni mobili e gli ancoraggi di asta, formazione e diretta sono dichiarati nell’HTML. I contenitori della lega sono statici, senza dipendere dall’ordine in cui due moduli creano e cercano i wrapper.
- `mobile-locations.js` gestisce spostamento e ripristino degli stessi nodi. Gli adattatori sono idempotenti e hanno smontaggio esplicito, con disiscrizione e rimozione dei listener e dei marcatori.
- I nodi originali continuano a essere spostati dove serve: i comandi asta restano fuori dalla zona scorrevole. Non sono duplicati pulsanti o gestori di gioco.

## Verifiche eseguite

64 script core passati. 42 combinazioni browser passate in Chromium Linux su sette viewport, con 42 screenshot. La fase asta esercita anche cinque cambi di larghezza, inizializzazione ripetuta, controllo identità/unicità dei nodi e smontaggio/rimontaggio.

Il browser modifica deliberatamente il testo dei crediti desktop e conferma che il riepilogo mobile conserva il valore dello stato. I test Node verificano cambio carriera, deduplicazione e disiscrizione, snapshot immutabili e contratti HTML. Il confronto con la V256 ammette esclusivamente le tre pubblicazioni esplicite della presentazione; le altre istruzioni delle funzioni asta conservano gli hash precedenti.

Tutti i CSS confrontati byte per byte con la V258 sono identici. Ispezione visiva campionaria dell’asta mobile; non viene dichiarata una baseline pixel approvata. Grafica, regole e schema salvataggi non cambiano.

## Limiti

Restano stato condiviso, composizione responsive tramite spostamento di nodi e collegamenti tra schermate. Chi riscrive l’HTML deve mantenere gli attributi del contratto. Navigazione inferiore e carosello rivali conservano le proprie osservazioni su visibilità e collezioni. I test browser usano carriere preparate e timer controllati tra le azioni; non certificano ogni flusso, Safari o dispositivi fisici.

Risultati: `reports/test-latest.json`, `reports/browser/latest.json`, `reports/sources-v259.json`. Documentazione: `ARCHITETTURA.md` e `TEST_AUTOMATICI.md`.
