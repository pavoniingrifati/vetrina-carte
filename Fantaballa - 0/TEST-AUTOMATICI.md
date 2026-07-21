# Test automatici del motore stagione

## Come aprirli

Pubblicare il progetto su un server web e aprire:

`test-season.html`

La pagina è marcata `noindex,nofollow` e non è collegata al menu pubblico.

## Pulsanti disponibili

- **Test rapidi**: controlli strutturali senza le prove più pesanti.
- **Test completi**: aggiunge esecuzione delle scelte evento eleggibili e una stagione completa da 38 giornate per modalità.
- **Stress: 3 stagioni extra**: esegue la suite completa più altre tre stagioni casuali per Community e REAL.
- **Scarica report JSON**: salva il rapporto completo dell'ultima esecuzione.

## Sicurezza dei salvataggi

I test non usano le chiavi reali del gioco. Il runner crea copie della configurazione con chiavi che terminano in:

`_test_runner`

Al termine della suite queste chiavi vengono eliminate. I salvataggi Community e REAL degli utenti non vengono letti, modificati o cancellati.

## Controlli inclusi

### Bootstrap e database

- modalità e configurazione corrette;
- caricamento dei database;
- quantità attese di giocatori e club;
- assenza di errori bloccanti del validatore;
- ID giocatori e club univoci;
- riferimenti dei giocatori a club esistenti.

### Stato e salvataggi

- struttura completa di una nuova stagione;
- migrazione di un salvataggio vecchio;
- envelope di formato 2 e modalità corretta;
- conservazione del `seasonId`;
- scrittura e rilettura senza perdita di dati;
- rotazione automatica del backup;
- recupero del temporaneo più recente;
- recupero dal backup quando il primario è corrotto;
- migrazione dei vecchi stati senza envelope;
- rifiuto dei salvataggi dell'altra modalità;
- isolamento di JSON corrotti;
- blocco di `NaN`, `Infinity` e strutture non serializzabili.

### Draft e formazioni

- coerenza tra formazioni e layout grafici;
- generazione di 11 titolari e 3 riserve;
- nessun giocatore duplicato;
- compatibilità tra giocatore e posizione;
- avvio corretto del campionato.

### Campionato e simulazione

- 20 squadre;
- calendario da 38 giornate e 380 partite;
- ogni coppia di squadre si affronta due volte, invertendo casa e trasferta;
- risultati interi e non negativi;
- casualità riproducibile tramite seed;
- aggiornamento coerente della classifica;
- simulazione di una giornata completa;
- simulazione di una stagione regolare completa.

### Eventi

- quantità corretta di eventi automatici e decisioni per modalità;
- ID delle decisioni univoci;
- almeno due opzioni valide per decisione;
- eventi esclusi correttamente dal REAL;
- esecuzione isolata di tutti gli eventi automatici;
- esecuzione isolata delle scelte attualmente eleggibili.

## File aggiunti

- `test-season.html`: dashboard leggibile dei test.
- `test-season-runner.html`: ambiente isolato caricato in iframe.
- `assets/season/15-test-api.js`: asserzioni e prove del motore.

Il file `15-test-api.js` non deve essere incluso nelle due pagine del Campionato.
