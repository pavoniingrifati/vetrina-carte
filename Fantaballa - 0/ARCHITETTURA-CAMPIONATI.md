# Architettura condivisa dei Campionati

Le due modalità continuano ad avere pagine, grafica, database, salvataggi e contenuti differenti, ma usano un unico motore JavaScript.

## File

- `assets/season-engine.js`: tutta la logica condivisa della stagione.
- `assets/season-config-community.js`: configurazione del Campionato Community.
- `assets/season-config-real.js`: configurazione del Fantacampionato REAL.
- `campionato.html`: interfaccia e grafica Community; carica la configurazione Community.
- `campionato-real.html`: interfaccia e grafica REAL; carica la configurazione REAL.

## Differenze preservate

Le configurazioni separano:

- chiavi e migrazione dei salvataggi;
- identificativi della squadra utente;
- nomi e fallback della squadra;
- database principale e database secondario per gli eventi Multiverso;
- regole di validazione dei club e delle rose;
- testi specifici della modalità;
- codici e categorie per l'invio delle vittorie;
- eventi presenti solo nella modalità Community.

## Regola di manutenzione

Le modifiche alla simulazione, al draft, alle quest, agli eventi condivisi e alle finali vanno fatte una sola volta in `season-engine.js`.
Una differenza intenzionale tra le modalità va aggiunta nel relativo file `season-config-*.js`, evitando di duplicare il motore.
