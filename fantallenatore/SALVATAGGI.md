# Avvio e dati locali

Il gestore in `js/save-manager.js` protegge anche la lettura delle proprietà `window.localStorage` e `window.indexedDB`: il browser può negarle con `SecurityError` prima che venga chiamato un metodo di salvataggio. Una capacità negata non interrompe l'esecuzione del file principale.

## Comportamento

- IndexedDB disponibile: carica il salvataggio corrente, quindi prova il backup e la migrazione del formato precedente secondo il comportamento esistente.
- Apertura bloccata da un'altra scheda, negata o senza risposta: usa il fallback localStorage. L'apertura ha un limite di 2.500 ms; `onblocked` attiva il fallback immediatamente.
- Lettura IndexedDB fallita o sospesa: annulla la transazione e prova il salvataggio precedente in localStorage. La lettura fallita non cancella i salvataggi esistenti.
- Entrambi gli archivi negati: la schermata iniziale e la creazione della carriera continuano a funzionare. Quando un salvataggio viene tentato, il gestore restituisce un errore e il gioco mostra il messaggio relativo ai dati locali bloccati. I progressi della sessione non vengono dichiarati salvati.
- Scrittura o cancellazione senza risposta: il limite della transazione è di 2.500 ms. La transazione viene annullata dove possibile; `flush()` non rimane in attesa indefinita di una singola operazione.

Il limite può essere impostato con `timeoutMs` nella factory, mantenendo 2.500 ms come valore predefinito. I timer vengono cancellati quando l'operazione termina. Le connessioni arrivate dopo un'apertura già abbandonata vengono chiuse e gli upgrade tardivi vengono annullati; non sostituiscono il backend di fallback.

Una richiesta `navigator.storage.persist()` senza risposta è anch'essa limitata. La ricerca del salvataggio per il pulsante Riprendi parte indipendentemente dal permesso di persistenza: un permesso opzionale sospeso non impedisce di riprendere una partita.

## Controlli

```sh
node tests/storage-startup-resilience.js
node tests/save-integration.js
node tests/run-tests.js
npm run test:browser -- --storage-only
```

Il primo test simula proprietà negate, aperture bloccate o sospese, connessioni tardive, errori di upgrade, letture e scritture sospese, cancellazione e permessi. Il test di integrazione mantiene i controlli di coda, backup, migrazione, errore atomico e caricamento del formato esistente.

Il browser esegue sette casi di avvio con errori storage iniettati. Usa i pulsanti reali per creare la carriera, verifica il messaggio quando il salvataggio è impossibile e salva/riprende una partita con IndexedDB reale mentre il permesso di persistenza è sospeso. Questi casi fanno parte anche della suite browser completa, insieme ai 42 scenari dell'interfaccia.
