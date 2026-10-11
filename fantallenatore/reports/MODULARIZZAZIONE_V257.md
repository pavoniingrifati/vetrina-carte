# Modularizzazione asta V257

Il controller dell’asta passa da 1.898 a 727 righe e da 89 a 28 funzioni. Sei moduli separano schermate, analisi, timer, aste speciali, feedback e poteri. Le 89 funzioni originali restano presenti esattamente una volta. Sono eliminati 67 collaboratori interni che passavano dal file principale; le factory ricevono solo dipendenze esterne effettivamente utilizzate.

Il confronto normalizzato delle funzioni con gli hash acquisiti dalla V256 passa: cambia il proprietario e il collegamento, non le istruzioni di gioco. Il file principale passa a 5.441 righe, sempre con 74 funzioni; 53 righe aggiuntive collegano esplicitamente le nuove factory. Restano stato condiviso e dipendenze incrociate: il refactoring non rende ancora l’intero gioco indipendente per schermata.

## Verifiche eseguite

- 63 script di regressione Node passati (`reports/test-latest.json`).
- Confini asta: hash delle 89 funzioni invariati, proprietà unica, sette contratti, chiamate locali, nessuna lettura anticipata durante la costruzione e stato carriera aggiornato dopo sostituzione.
- Integrazione: 30 moduli reali, 700 funzioni univoche; nove giornate identiche alla baseline V223.
- Fixture browser legali e caricamento dei nuovi moduli passati in Node.
- One Shot Admin: test migliorato, con aggiudicazione di produzione e timer controllato invece di una sostituzione semplificata del motore; disabilitata soltanto la presentazione nel runtime diagnostico.
- Confronto V256: CSS invariati; markup delle schermate invariato, aggiornato soltanto il caricamento degli script.
- Sintassi shell valida.

## Limiti

Chromium non disponibile: i 42 scenari grafici sono `not_run`, senza screenshot o successo dichiarato. Non eseguite ulteriori aste competitive complete in questa consegna; le regressioni includono i controlli del runtime asta. Non cambiati grafica, schema dei salvataggi o regole del gioco.

Vedere `ARCHITETTURA.md`, `TEST_AUTOMATICI.md` e `reports/modularizzazione-v257.json`.
