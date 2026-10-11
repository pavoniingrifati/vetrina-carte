# Filtri asta — V277

Rimossi i reset automatici di ordinamento, ricerca e club al cambio del turno / numero di giocatori disponibili, per asta libera e a reparti. L’ordinamento resta scelto anche passando a un nuovo reparto. Il ruolo nell’asta a reparti segue il reparto corrente, come prima. Restano i controlli Osservatore e la validazione del club disponibile.

Verifiche superate: auction-filter-persistence, auction-observer-sorting, sintassi e production-edition. Nessun nuovo test browser eseguito. Questa modifica conserva le scelte durante la sessione; non introduce persistenza dei filtri nei salvataggi.
