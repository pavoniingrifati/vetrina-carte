# Validatore e pulizia database Fantaballa

## File aggiunti

- `database-check.html`: pannello visuale, non indicizzato, per controllare tutti i database dal browser.
- `assets/database-validator.js`: motore condiviso di validazione e normalizzazione.
- `tools/validate-databases.py`: validatore eseguibile da terminale.
- `data/normalized/`: copie normalizzate dei quattro database principali.
- `DATABASE-VALIDATION-REPORT.json`: rapporto strutturato leggibile da altri strumenti.
- `DATABASE-VALIDATION-REPORT.md`: rapporto leggibile.

## Come usare il pannello

Pubblicare l'intero progetto e aprire:

```text
database-check.html
```

La pagina controlla:

- `data/giocatori.json`;
- `data/club.json`;
- `data/giocatori-real.json`;
- `data/club-real.json`;
- `data/cronaca-gol.json`;
- `data/classifica.json`.

È possibile filtrare anomalie per dataset, gravità e testo, scaricare il rapporto JSON e scaricare singolarmente le copie normalizzate.

La pagina non può sovrascrivere i file pubblicati: ogni sostituzione rimane esplicita.

## Controlli sui giocatori

- struttura array e record oggetto;
- ID mancanti o duplicati;
- nomi mancanti o potenzialmente duplicati;
- ruolo macro valido;
- posizioni tattiche valide;
- etichetta del ruolo coerente;
- OVR numerico, intero e compreso fra 1 e 100;
- nazionale presente;
- club esistente;
- valori `subscriber` e `abbonato` canonici e coerenti;
- quotazione e ruolo sorgente nel database REAL.

Nel database REAL il ruolo fantacalcistico può differire dalla prima posizione tattica. Questa differenza è intenzionale e non viene segnalata come errore.

## Controlli sui club

- ID e nomi univoci;
- ID in formato slug;
- `shortName` presente;
- colori HEX validi;
- formazione predefinita riconosciuta;
- `rosterSize` uguale ai giocatori realmente assegnati;
- rosa minima;
- presenza di almeno un portiere;
- distribuzione minima per reparto;
- conteggio complessivo atteso dei club.

## Correzioni sicure applicate

Sono state applicate esclusivamente correzioni deterministiche e non distruttive:

- `Alecolla`: `subscriber` e `abbonato` uniformati a `si`, mantenendo il valore affermativo già presente;
- quattro `roleLabel` corretti in base al ruolo macro;
- 27 valori `rosterSize` del database Community sincronizzati con i giocatori realmente presenti;
- numero atteso dei club Community corretto da 36 a 37 nella configurazione.

Nessun giocatore o club è stato eliminato, unito o rinominato automaticamente.

## Revisioni manuali rimaste

Il validatore segnala sei gruppi di nomi potenzialmente duplicati:

- `emadk_` / `Emadk`;
- `ale 💎` / `Ale`;
- `Bruno Ceck` / `bruno.ceck`;
- `andyrabe51` / `andyrabe51`;
- `Giulio valbo` / `Giulio Valbo`;
- `cristiano.vadala` / `Cristiano vadala'`.

Questi record hanno ID, club o ruoli differenti. Rimangono quindi separati finché non viene presa una decisione editoriale.

`Fantaballa FC` possiede inoltre una distribuzione fragile di ruoli: 1 portiere, 3 difensori, 4 centrocampisti e 6 attaccanti. La rosa è utilizzabile, ma il dato resta segnalato.

## Uso da terminale

Solo controllo e generazione delle copie normalizzate:

```bash
python tools/validate-databases.py
```

Controllo e applicazione ai file live delle sole correzioni sicure:

```bash
python tools/validate-databases.py --apply-safe-fixes
```

Lo script restituisce un codice di uscita diverso da zero soltanto in presenza di errori bloccanti. Gli avvisi destinati a revisione manuale non impediscono la pubblicazione.

## Integrazione con i test del motore

`test-season-runner.html` carica `assets/database-validator.js` e la suite contiene il test:

```text
Schema completo e normalizzazione idempotente
```

Il test fallisce quando:

- compare un errore bloccante;
- i file live contengono ancora correzioni sicure non applicate.

I semplici avvisi manuali vengono riportati, ma non bloccano la suite.
