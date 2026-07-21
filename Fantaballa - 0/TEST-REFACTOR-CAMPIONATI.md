# Test del motore modulare

Data test: 21 luglio 2026

## Controlli strutturali

- Il motore condiviso è stato suddiviso in 14 moduli.
- I corpi dei 14 moduli, concatenati nel loro ordine, ricostruiscono esattamente i 687.993 caratteri del precedente `season-engine.js`.
- `node --check` non segnala errori di sintassi in nessun modulo.
- Il parser JavaScript non segnala diagnostiche.
- Entrambi gli HTML caricano una sola configurazione e gli stessi 14 moduli nello stesso ordine.
- Il vecchio file monolitico non è più distribuito nel progetto.

## Test in Chromium

Le versioni precedente e modulare sono state caricate in Chromium headless usando gli HTML reali e i database inclusi nel progetto. Le risorse di rete sono state simulate localmente per rendere il confronto riproducibile.

Per entrambe le modalità sono risultati identici:

- titolo e schermata iniziale;
- fase iniziale e nome della squadra;
- quantità di giocatori, club, eventi automatici e decisioni;
- contenuto e ordine di eventi e decisioni, verificati tramite hash;
- formazioni e profili allenatore, verificati tramite hash;
- disponibilità delle funzioni principali del motore;
- risultato di un draft casuale con generatore deterministico.

## Campionato Community

- 716 giocatori
- 37 club
- 5 eventi automatici
- 69 decisioni
- hash eventi: `897827866`
- hash formazioni e allenatori: `4258100710`
- draft deterministico: 14 giocatori identici alla versione precedente

## Fantacampionato REAL

- 455 giocatori
- 21 club
- 4 eventi automatici
- 65 decisioni
- hash eventi: `774647115`
- hash formazioni e allenatori: `4258100710`
- draft deterministico: 14 giocatori identici alla versione precedente

## Errori rilevati

- Errori JavaScript: nessuno
- Errori console durante il caricamento: nessuno
- Differenze nei controlli eseguiti: nessuna

## Limite del test attuale

Il confronto copre caricamento, configurazione, cataloghi e generazione deterministica del draft. Una simulazione automatica completa delle 38 giornate sarà il passo successivo della suite di regressione.
