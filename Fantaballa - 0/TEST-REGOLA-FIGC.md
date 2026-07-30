# Test — Nuova regola FIGC

## Controlli dedicati

Il file `tools/test-figc-incident-rule.js` verifica:

1. attivazione della scelta Negativo;
2. sottrazione cumulativa per rosso, infortunio e rigore sbagliato;
3. possibilità che il risultato diventi negativo;
4. conteggio della doppietta basato sulle marcature effettive;
5. tripletta considerata come un solo bonus;
6. bonus applicato alla classifica di entrambe le squadre.

Risultato: **4 test su 4 superati**.

## Suite generale

Sono stati rieseguiti:

- test del caricatore eventi;
- test dell'editor eventi;
- test di Fantaballopoli;
- test di oggetti, allenatori, quest e achievement;
- controllo sintattico dei file JavaScript;
- validazione dei file JSON;
- compilazione degli script Python.

Il test completo delle pagine con Chromium headless non è stato eseguibile perché l'ambiente ha bloccato l'accesso al server locale con `ERR_BLOCKED_BY_ADMINISTRATOR`. Non sono emersi errori nelle suite statiche e del motore.
