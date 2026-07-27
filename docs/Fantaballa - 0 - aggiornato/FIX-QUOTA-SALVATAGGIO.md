# Correzione quota salvataggio automatico

## Errore risolto

`Failed to execute 'setItem' on 'Storage': Setting the value of 'fantaballa_campionato_real_v1_autosave_temp' exceeded the quota.`

## Causa
Il precedente sistema poteva mantenere contemporaneamente tre copie complete della stagione:

1. salvataggio principale;
2. salvataggio temporaneo;
3. backup del salvataggio precedente.

Nelle stagioni REAL più avanzate, la somma delle tre copie poteva superare la quota del `localStorage` del browser.

## Modifiche

- eliminata la scrittura ordinaria della copia temporanea completa;
- scrittura diretta e atomica sulla chiave principale;
- se la quota è occupata da un vecchio backup, il backup viene rimosso e la scrittura viene riprovata;
- i vecchi salvataggi temporanei e gli elementi isolati vengono puliti solo quando necessario;
- il backup completo viene creato soltanto quando la sua dimensione è compatibile con lo spazio disponibile;
- lo storico salvato non duplica più cronaca completa, formazioni complete e altri dati già derivabili;
- punteggi, marcatori, MVP, eventi, classifica, rosa ed effetti restano salvati.

## Compatibilità

- nessuna cancellazione automatica della stagione principale;
- vecchi salvataggi ancora leggibili;
- nessuna modifica al gameplay;
- nessuna modifica a eventi, classifiche o Google Apps Script;
- formato del salvataggio ancora compatibile con la versione precedente.

## File modificati

- `assets/season/03-save-system.js`
- `assets/season/01-bootstrap.js`
- `tools/test-storage-quota.py`
