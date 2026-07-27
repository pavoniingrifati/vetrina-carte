# Fix — Scelte del draft definitive

- Rimosso il pulsante **Annulla ultima scelta** dal pannello di analisi.
- Rimosse la funzione di rollback e la memorizzazione del pack precedente.
- Dopo l'inserimento in campo o in panchina, il singolo giocatore non può più essere rimosso o sostituito durante il draft.
- I vecchi salvataggi restano compatibili: l'eventuale dato storico `draft.lastPlacement` viene eliminato durante il caricamento.
- L'opzione **Azzera draft** resta disponibile in **Altre opzioni** e riavvia l'intera procedura, non la singola scelta.
