# Test correzione quota salvataggio

## Suite motore

- Community: 26/26
- REAL: 26/26
- Totale: 52/52

## Test quota simulata

È stato simulato un errore `QuotaExceededError` durante la sostituzione del salvataggio principale in presenza di un backup.

Risultato:

- errore quota intercettato: OK
- backup ingombrante rimosso: OK
- nuovo salvataggio scritto al secondo tentativo: OK
- salvataggio principale leggibile: OK
- nessuna copia temporanea residua: OK

## Validatori

- cataloghi eventi: 0 errori, 0 avvisi
- database: 0 errori
- sintassi `03-save-system.js`: valida
- sintassi `01-bootstrap.js`: valida
