# Bilanciamento economia · V287

- Fortuna mantiene 15 € / 75 FP e porta la probabilità eventi al 50%, dal 35% base. Descrizione aggiornata; 19 eventi attesi in 38 giornate contro 13,3 base, non garantiti.
- Allenamento Speciale: 10 FP invece di 14.
- Assistente Tattico Pro: 10 € oppure 50 FP. Rimane il requisito Assistente Tecnico.
- Celebrità: 20 € oppure 100 FP, nella categoria Pay to Win, con l’immagine originale. Ogni acquisto aggiunge un oggetto all’inventario. Attivazione e validità per la prossima stagione restano quelle già implementate.

Schede e modale mostrano due pulsanti per Celebrità. Il pagamento scelto aggiorna soltanto il relativo saldo e lo storico registra correttamente euro o FP. Gli altri consumabili restano acquistabili soltanto con FP. Nessun rimborso o modifica agli oggetti già acquistati. Premi, sponsor e altri prezzi invariati.

Tutti i servizi stagionali costano complessivamente 115 € oppure 575 FP ora che anche l’Assistente Tattico Pro ha un prezzo FP.

Verifica: 62/62 controlli generali, test economy-prices (acquisti € e FP, saldi indipendenti, storico, modale, scheda, insufficienza fondi, requisito staff e stagione conclusa), celebrity-sponsors, zalandiolo-blocks, shop-economy, production-edition, domain-integration e css-build passati. Il controllo statico generale dei consumabili è stato adattato alla nuova gestione delle due valute e affiancato al test comportamentale. Nessun nuovo test grafico browser eseguito.
