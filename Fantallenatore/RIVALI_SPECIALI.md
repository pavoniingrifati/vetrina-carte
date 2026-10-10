# Strategie dei rivali speciali

Implementate per Squalo, Camaleonte, Fantadata, Predatore e Broker. Le differenze intervengono nelle chiamate, nella valutazione degli acquisti, negli incrementi e nei tempi. Restano in vigore gli stessi limiti di budget, slot e riserve dei reparti.

| Rivale | Chiamate | Valutazione e rilanci | Tempi |
|---|---|---|---|
| Squalo | Preferisce top che più avversari possono permettersi. | Più pressione se il giocatore migliora la rosa ed è contendibile; incrementi più decisi. | Rapidi, con poche attese fino all’ultimo secondo. |
| Camaleonte | Sposta il mix tra top e convenienza in base ai prezzi osservati nel reparto. | Adatta moderatamente la valutazione al mercato; rilanci più decisi sui prezzi ancora convenienti. | Più rapido sulle occasioni, più prudente sui prezzi elevati. |
| Fantadata | Ordina i candidati anche per miglioramento marginale e rendimento per credito. | Riduce il valore di un acquisto quando possiede già titolari migliori; incrementi più prudenti e poca vulnerabilità al bluff. | Regolari, con poche attese all’ultimo secondo. |
| Predatore | Cerca giocatori che migliorano la rosa e che meno avversari possono permettersi. | È selettivo e aumenta la disponibilità a spendere quando le alternative scarseggiano o il reparto è avanzato. | Aspetta più spesso; accelera quando deve assicurarsi qualità. |
| Broker | Espone nomi appetibili ad almeno due avversari, anche quando personalmente non vuole rilanciare. | Usa incrementi più decisi lontano dal proprio tetto, senza fare offerte oltre la propria valutazione per alzare artificialmente il prezzo. | Abbastanza rapidi nelle fasi favorevoli. |

## Informazioni e compatibilità

- Le strategie usano OVR pubblico, probabilità di titolarità già disponibile al motore, rose, crediti, slot e prezzi di acquisti conclusi. Non leggono i massimali privati degli avversari o risultati futuri.
- Camaleonte usa una mediana di un massimo di 12 vendite significative per ruolo, con almeno 3 campioni e correzioni limitate. Una singola vendita estrema non determina il comportamento.
- La cronologia pubblica conserva al massimo 80 vendite in `state.stats.auctionSales` e sopravvive al salvataggio. Le vecchie carriere prive di questo campo partono da una lettura neutra e raccolgono dati ai nuovi acquisti.
- I prezzi artificiali della divisione dei pacchetti e degli acquisti One Shot sono esclusi. Aste estive, invernali e stagioni diverse non condividono gli stessi segnali di prezzo.
- Durante una chiamata con identità nascosta non viene calcolata la valutazione tattica del giocatore nascosto.
- Normale, turbo e martello mantengono i propri limiti temporali. Gli incrementi vicino al tetto restano prudenti.
- La configurazione dei nuovi profili Fantadata ha target totali pari a 500; i target già salvati nelle carriere precedenti non vengono riscritti.

## Verifica

`npm test`: 81 script di regressione superati. Il test `tests/special-rival-strategies.js` usa anche coefficienti identici per verificare che le differenze derivino dalle strategie. Copre prezzi osservati, miglioramento della rosa, chiamate di pressione, scarsità, dati nascosti, limiti legali, compatibilità delle osservazioni e tempi.

Confronto di 12 aste complete, 3.000 acquisti validi, medesimi due seed della diagnosi precedente, strategia utente “top”, C/B/A in entrambe le modalità. Nessuna soglia di attenzione superata. I valori sono il vantaggio medio OVR del miglior undici dell’utente sulla CPU media.

| Divisione | Modalità | Prima | Dopo |
|---|---|---:|---:|
| C | reparti | +3.81 | +3.21 |
| C | libera | +1.29 | +1.24 |
| B | reparti | +1.59 | +1.65 |
| B | libera | +2.15 | +1.84 |
| A | reparti | +1.59 | +1.10 |
| A | libera | +1.10 | +0.61 |

Il campione mostra miglioramenti in più combinazioni, ma non una difficoltà maggiore in modo uniforme: B per reparti rimane sostanzialmente invariata e i singoli seed possono peggiorare. L’obiettivo di questa modifica è rendere concrete le cinque identità tattiche; la calibrazione generale del budget resta un intervento distinto. Queste simulazioni economiche non includono timer reali, eventi o poteri.

I test browser dei rivali verificano separatamente il percorso reale: timer → CPU → rilancio → PASS utente → acquisto, in C e A per tutti e cinque i profili. Il browser esteso copre anche le sette viewport e i casi di storage.

## File e comandi

- `js/domains/auction-policy.js`: lettura del mercato, miglioramento marginale, valore tattico e incrementi.
- `js/domains/auction-controller.js`: scelte di chiamata e pressione di Broker.
- `js/domains/auction-clock.js`: ritmi dedicati e risposta alle occasioni/scarsità.
- `js/auction-engine.js`: cronologia pubblica degli acquisti conclusi.
- `app_v302.js`, `js/domains/manifest.json`: composizione e contratti; descrizioni aggiornate.
- `tests/special-rival-strategies.js`, `tests/browser/special-rivals.js`: verifiche comportamentali e percorso browser reale.

```bash
npm test
node tests/special-rival-strategies.js
npm run test:browser
```
