# V224 — struttura e salvataggi

## Modifiche

- 700 funzioni estratte in 24 factory con dipendenze esplicite; il file principale passa da 16.233 a 5.385 righe e da 774 a 74 funzioni. Restano stato condiviso, collegamenti e bootstrap: la separazione non equivale a un isolamento completo dei domini.
- 1.065 dichiarazioni CSS superate rimosse, di cui 826 con `!important`. Le priorità attive passano da 6.571 a 5.745. L'HTML carica un singolo CSS generato con lo stesso ordine delle sorgenti; i valori dinamici e i fallback non dimostrabilmente superati vengono mantenuti.
- La compattazione conserva bonus capitano, gol decisivo, Cesarini, panchina d'oro, underdog, minuti, gol tardivi/decisivi e ID del sostituito. Il riepilogo mostra anche i bonus prima omessi. Fantavoti e formule non cambiano.
- Schema 24 e namespace del database invariati. I vecchi salvataggi restano caricabili; i dettagli già cancellati dalla V223 non si ricavano retroattivamente dai totali.

## Verifiche completate

- 53 script di regressione core superati, compresa la suite da 62 controlli e le fixture V161 invariate.
- Nove giornate del motore reale, tre semi: output identico agli hash acquisiti dalla V223 prima delle modifiche.
- Round-trip stato → snapshot → compressione → caricamento: dettagli dei bonus e testo del riepilogo conservati, totali identici, stato non mutato, compattazione idempotente e caricamento dei campi opzionali assenti.
- CSS: 17.590 chiavi di dichiarazione finale invariate; nessun errore sintattico con tinycss2 prima/dopo; build idempotente, sorgenti/runtime coincidenti e risorse locali esistenti.
- 21 aste complete e 5.250 acquisti validi; nessuno scenario oltre le soglie di attenzione del test. Copertura: un seme, quattro divisioni, tre strategie, modalità a reparti/libera. Nessun evento, potere o interazione UI in questa diagnosi.
- Il test GOD preesistente falliva perché richiamava comandi assenti nell'edizione standard: sostituito da verifica dell'edizione standard e isolamento del namespace di produzione.

## Limiti

Chromium non era disponibile e il download non ha prodotto un archivio utilizzabile. Lo smoke browser non è stato eseguito; l'aspetto mobile/desktop non è stato verificato visivamente. I test di persistenza usano adapter o codec e non un IndexedDB reale nel browser. Il confronto del motore è headless, non un'interazione completa con le schermate.

Per i confini dei moduli e le regole di modifica leggere `ARCHITETTURA.md`; per il CSS leggere `CSS_ARCHITETTURA.md`. I report delle versioni precedenti sono conservati come storico e non descrivono la V224.
