# Restyling schermata partita e post-partita

## Obiettivo
Rendere la presentazione delle partite più coinvolgente e più leggibile senza appesantire l'interfaccia e senza cambiare la logica di gioco.

## Interventi applicati

### Diretta partita
- nuovo header in stile telecronaca;
- scoreboard più evidente con etichetta "Diretta";
- nomi delle squadre più leggibili;
- pulsante "Vai al risultato finale" più chiaro;
- nota d'uso compatta sotto ai controlli;
- cronaca con carte evento più leggibili;
- migliore evidenza di gol, cartellini e punteggio aggiornato.

### Post-partita
- nuovo hero iniziale con punteggio centrale;
- badge della giornata e verdetto (vittoria, pareggio, sconfitta);
- informazioni rapide su modalità, durata e potenza delle squadre;
- sezione marcatori separata;
- cronaca completa in sezione dedicata;
- MVP isolato in un blocco dedicato;
- note, conseguenze ed effetti raccolti in una sezione distinta;
- pulsante principale "Continua stagione" più chiaro.

## File modificati
- `campionato.html`
- `campionato-real.html`
- `assets/match-restyling.css`
- `assets/season/12-match-simulation.js`

## Salvataggi
Nessuna modifica al sistema di salvataggio.
Tutto continua a usare il salvataggio versionato nel `localStorage` già presente.

## Gameplay
Nessuna modifica a:
- risultati;
- probabilità;
- eventi;
- regole;
- classifiche;
- salvataggi.
