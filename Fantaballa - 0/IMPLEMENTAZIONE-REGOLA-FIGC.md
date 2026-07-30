# Implementazione — Nuova regola FIGC

## Evento

È stato aggiunto l'evento decisionale **Nuova regola FIGC** nei cataloghi condivisi di Campionato Community e Fantacampionato REAL.

La scelta resta attiva fino al termine della stagione e non può essere selezionata una seconda volta nella stessa run.

## Scelta Negativo

Per ogni episodio realmente registrato dal motore nella partita, la squadra coinvolta perde un gol:

- cartellino rosso;
- nuovo infortunio avvenuto durante la partita;
- rigore sbagliato.

Le penalità si sommano e il punteggio può scendere sotto zero.

Esempio: una squadra è sullo 0-1, riceve un rosso e subisce due nuovi infortuni. Il suo risultato diventa -3-1.

La correzione viene applicata prima dell'eventuale regola che impedisce il pareggio, così un risultato diventato pari può andare ai supplementari e ai rigori quando previsto.

Per non inventare episodi invisibili, nelle gare simulate tra squadre controllate dal computer la penalità viene applicata solo agli episodi che il motore genera e traccia realmente.

## Scelta Positivo

Ogni calciatore che realizza almeno due gol effettivi nella stessa partita assegna **+1 punto in classifica** alla propria squadra.

- doppietta: +1 punto;
- tripletta o più: sempre +1 punto per quel calciatore;
- due calciatori con almeno una doppietta: +2 punti complessivi.

Un singolo gol che vale doppio per una regola speciale non viene interpretato come una doppietta: sono necessarie almeno due marcature effettive dello stesso giocatore.

Il bonus viene applicato a tutte le squadre del turno, non soltanto alla squadra dell'utente.

## Compatibilità

- Stato dei salvataggi aggiornato alla versione 47.
- Migrazione automatica dei salvataggi precedenti.
- Regola disponibile in Campionato Community e Fantacampionato REAL.
- Riepilogo della regola mostrato nella schermata delle regole stagionali.
- Esito della penalità o del bonus mostrato nel resoconto della partita.
