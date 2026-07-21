# Eventi e decisioni data-driven

## Obiettivo

Il catalogo degli eventi è stato separato dal motore JavaScript senza modificare il gameplay.
Testi, ordine, modalità, opzioni e collegamenti alla logica sono ora dati JSON; le funzioni eseguibili restano in un registro JavaScript esplicito.

## File

- `data/events/events-common.json`: 65 decisioni e 4 eventi automatici condivisi.
- `data/events/events-community.json`: 4 decisioni e 1 evento automatico esclusivi Community.
- `data/events/events-real.json`: estensioni REAL, attualmente vuote.
- `assets/season/event-handlers.js`: condizioni, titoli dinamici e logica delle scelte.
- `assets/season/10-events.js`: caricamento, validazione, costruzione del catalogo e interfaccia.
- `assets/event-validator.js`: validatore riutilizzabile.
- `event-check.html`: pannello visuale interno.
- `tools/validate-events.js`: validatore da terminale.

## Struttura di una decisione

```json
{
  "id": "nuovo-sponsor",
  "order": 0,
  "title": "Arriva un nuovo sponsor!",
  "text": "Scegli quello che preferisci.",
  "choices": [
    {
      "label": "Padelle Ballarini",
      "effect": "Descrizione mostrata all’utente",
      "applyHandler": "nuovo-sponsor:0"
    }
  ]
}
```

Campi facoltativi:

- `questEvent`, `chainOnly`, `userOnly`;
- `availableHandler` per le condizioni di comparsa;
- `titleHandler` per i titoli dinamici;
- `describeHandler` per descrizioni dipendenti dal contesto;
- `createContextHandler` per preparare dati casuali prima della scelta.

## Modifiche sicure nei JSON

Si possono modificare direttamente:

- titolo e testo;
- etichetta delle opzioni;
- descrizione dell’effetto;
- ordine dell’evento;
- catalogo di appartenenza, rispettando le differenze tra modalità.

Per cambiare l’effetto reale di una scelta bisogna aggiornare o aggiungere un handler in `event-handlers.js`. I nomi degli handler sono verificati prima dell’avvio: un riferimento mancante blocca il caricamento con un errore leggibile.

## Sicurezza

Il motore non usa `eval` e non esegue stringhe provenienti dai JSON. I cataloghi possono richiamare soltanto handler presenti nella whitelist `SEASON_EVENT_HANDLERS`.

## Validazione

Aprire tramite server web:

```text
event-check.html
```

Oppure da terminale:

```bash
node tools/validate-events.js
```

Il controllo verifica schema, ID duplicati, ordine, opzioni, handler mancanti, conteggi e separazione Community/REAL.
