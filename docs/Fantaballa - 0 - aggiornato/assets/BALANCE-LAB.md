# Balance Lab di Fantaballa

Data: 22 luglio 2026

## Scopo

`balance-lab.html` è una pagina interna che misura il bilanciamento del Campionato Community e del Fantacampionato REAL tramite stagioni simulate con seed ripetibili.

Non modifica il gameplay pubblico e non usa i salvataggi degli utenti.

## File aggiunti

- `balance-lab.html`: interfaccia del laboratorio.
- `balance-runner.html`: ambiente isolato per una modalità.
- `assets/season/16-balance-api.js`: API di simulazione e aggregazione.

Il collegamento al laboratorio è presente anche in `test-season.html`.

## Scenari confrontati

Il laboratorio può confrontare:

- tutti i 7 profili allenatore;
- gli 8 moduli standard;
- allenatori e moduli insieme;
- solo allenatori;
- solo moduli.

Per isolare l'effetto della variabile studiata:

- negli scenari allenatore il modulo resta quello di riferimento;
- negli scenari modulo il profilo allenatore resta quello di riferimento;
- il numero totale di stagioni viene distribuito in modo uniforme tra gli scenari.

## Motori disponibili

### Rapido statistico

Usa il motore reale per:

- caricamento dei database;
- draft iniziale;
- calcolo della forza della rosa;
- profili allenatore;
- formazioni;
- calendario e classifica;
- eventi automatici e decisioni;
- regole speciali principali;
- effetti successivi alle partite.

Evita cronaca dettagliata, animazioni e statistiche individuali non necessarie. È indicato per campioni estesi.

Limite massimo: 5.000 stagioni per modalità.

### Completo del gioco

Esegue il percorso integrale tramite `playRound('instant')`, mantenendo la simulazione dettagliata del gioco.

È più fedele ma più pesante. È indicato per confermare su campioni ridotti i risultati del motore rapido.

Limite massimo: 250 stagioni per modalità.

## Seed ripetibili

Ogni run deriva dal seed iniziale e da:

- modalità;
- scenario;
- indice della stagione.

Ripetendo la stessa configurazione si ottengono gli stessi risultati. Questo permette confronti attendibili prima e dopo una modifica di bilanciamento.

## Indicatori raccolti

Per ogni scenario vengono calcolati:

- stagioni richieste, completate e fallite;
- titoli vinti;
- percentuale titoli;
- percentuale Top 4;
- posizione media;
- punti medi;
- gol fatti e subiti;
- percentuale di vittorie nelle partite;
- variazione media dell'overall della rosa;
- infortuni medi;
- eventi medi;
- conclusioni anticipate o alternative.

Il report include inoltre:

- frequenza di comparsa di ogni evento;
- frequenza di ogni scelta;
- esito medio associato alle opzioni;
- giocatori più selezionati nel draft;
- avvisi automatici su valori anomali o dominanti.

## Storie alternative

L'opzione `Includi storie alternative` abilita archi e finali che possono cambiare durata e struttura della stagione.

Per confronti puramente competitivi conviene iniziare con l'opzione disattivata. Va poi attivata in un secondo campione per misurare il caos narrativo reale.

## Esportazioni

- JSON complessivo per entrambe le modalità;
- CSV separato Community;
- CSV separato REAL;
- opzionalmente, run grezze nel JSON.

Le run grezze aumentano sensibilmente la dimensione del file e sono disattivate per impostazione predefinita.

## Sicurezza dei salvataggi

Il runner crea chiavi isolate con suffisso:

`_balance_runner`

Le chiavi reali Community e REAL non vengono lette, sovrascritte o cancellate.

## Uso consigliato

1. Eseguire 30 stagioni per verificare che la configurazione sia valida.
2. Eseguire 150–500 stagioni con motore rapido.
3. Esaminare scenari ed eventi segnalati.
4. Confermare le anomalie con 30–100 stagioni del motore completo.
5. Ripetere lo stesso seed dopo una modifica.
6. Confrontare i due JSON o CSV.

Il laboratorio misura correlazioni nel sistema simulato. Un risultato va interpretato su campioni adeguati e non come prova assoluta che una singola meccanica sia la causa dell'esito.
