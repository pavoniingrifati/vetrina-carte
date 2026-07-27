# Fix — Quest “Un leader per la squadra”

Data: 26 luglio 2026

## Problema

Quando tutti i titolari reali erano indisponibili, la formazione effettiva veniva completata con i Primavera d’emergenza. Questi giocatori temporanei non appartengono alla rosa persistente e non possono essere scelti come leader per due partite. La quest restava quindi in attesa di una selezione impossibile e bloccava i pulsanti della partita.

## Correzione

1. La quest entra nel pool degli eventi soltanto se esiste almeno un titolare reale disponibile.
2. È presente un secondo controllo al momento dell’accettazione, per gestire eventuali cambiamenti avvenuti mentre l’evento è aperto.
3. I salvataggi già bloccati mostrano il pulsante **“Annulla quest e continua”**.
4. L’annullamento non assegna penalizzazioni e non richiede di cancellare o ricominciare la stagione.
5. Aggiornati i parametri di cache dei file JavaScript nelle pagine Campionato, REAL e Tricolore Pisa.

## Come usare il fix su un salvataggio già bloccato

- Sostituire i file sul server.
- Ricaricare la pagina forzando la cache (`Ctrl + F5`).
- Nella scheda della quest premere **“Annulla quest e continua”**.
- I pulsanti **Gioca con cronaca** e **Simula subito** tornano disponibili.

## Test

- Test Fascia del capitano e quest leader: 9/9 superati.
- Validazione cataloghi eventi: nessun errore e nessun warning.
- Controllo sintattico JavaScript: superato.
- Validazione database: nessun errore bloccante; restano gli avvisi `rosterSize` già presenti nel progetto originale.
