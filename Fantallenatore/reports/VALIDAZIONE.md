> Report storico della modifica CPU. Per la copertura aggiornata dei test leggere VERIFICA_TEST_PUNTO_3.md e test-latest.json.

# Validazione V3.2.35.56.159

- 28 script di regressione superati; suite principale 62/62.
- 21 aste complete dopo la modifica, 5.250 acquisti validi.
- Valutazioni, limiti di offerta e riserve progressive controllati dal test dedicato.
- Budget minimo e ultimo reparto completabili; nessun duplicato o violazione delle rose nelle aste.
- Parità dei risultati con/senza cache controllata.
- Confronto con la precedente versione sullo stesso seme.
- Amatori: assegnazioni e rose identiche alla baseline V158.
- Nuova asta di Serie A a chiamata libera ripetuta per verificare tutte le assegnazioni.

I dati della baseline V158 restano come riferimento storico, mentre i risultati aggiornati sono in auction-difficulty-after.json e DIFFICOLTA_CPU_CONFRONTO.md. Il sorgente del gioco è modificato nella V159: la precedente attestazione che il codice era identico all'originale riguardava soltanto l'aggiornamento dei test V158.
