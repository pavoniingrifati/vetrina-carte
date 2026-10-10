# Bilanciamento: motore reale

Il simulatore alternativo è stato sostituito. Build del gioco invariata: 3.2.35.56.159.

Carica i moduli e le funzioni dell'app di produzione, senza bootstrap UI. Percorso: buildSerieADay → applySerieAEvent sulle nove partite → finalizeSerieAPhaseRatings → eventi Big Match → voti finali → updateSerieASeasonWorld. Usa classifica, statistiche, indisponibilità ed evoluzione OVR reali.

Confini disabilitati: persistenza e feedback visivo dei voti. Nessuna formula calcistica sostitutiva. Nessuna verifica browser. Calendario e stato iniziale vengono preparati dal runtime diagnostico con le funzioni del gioco.

## Esecuzione effettuata

Seed: production-audit-0. Una stagione, 38 giornate, 380 partite. 1071 gol, 2.82 per partita, 23.95% pareggi. Ogni club ha 38 presenze; somma gol nei risultati e gol fatti in classifica coincide. Il report JSON include risultati, prestazioni, statistiche, sviluppo OVR e hash dei sorgenti.

Il test di regressione verifica stesso seed, seed diverso, numero squadre, voti finiti e aggiornamento classifica su due giornate.

## Interpretazione

Una stagione diagnostica non certifica realismo o bilanciamento. Non sono simulati rose e classifiche fantasy, mercato invernale, promozioni o transizione di carriera. I vecchi numeri prodotti dalle formule separate sono superati e non vanno confrontati come se misurassero lo stesso motore.

Comando: node balance_sim.js --seasons 3 --days 38 --seed balance --report reports/balance-production-latest.json

Validazione: 31 script core superati. Browser non rieseguito; limite Chromium della consegna precedente invariato.
