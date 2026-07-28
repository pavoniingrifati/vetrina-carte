# Nuovi eventi della rosa

Sono stati aggiunti nove eventi data-driven, disponibili sia nel Campionato Community sia nella modalità REAL.
Sono marcati `userOnly`, quindi non vengono applicati automaticamente alle squadre controllate dal Caos.

## 1. Il rigorista improvvisato

Viene selezionato il titolare con l'OVR attuale più basso.

### Dagli fiducia
- vale per la prossima partita;
- probabilità del 35% che venga assegnato un rigore;
- la probabilità di segnare dipende dall'OVR del giocatore;
- gol: +5 OVR permanente;
- errore: -5 OVR permanente;
- se non viene assegnato alcun rigore, l'evento termina senza modifiche.

### Lascia tutto com'è
- il giocatore riceve -2 OVR nella prossima partita.

## 2. Il fratello scarso

Viene scelto un giocatore casuale della rosa.
Il fratello ha lo stesso ruolo e 30 OVR in meno, con un minimo di 1 OVR.

### Tesseralo
- il fratello viene aggiunto come riserva extra e resta fino a fine stagione;
- dopo un intervallo casuale di 2-6 giornate compare la Parte 2;
- 50%: il giocatore originale ottiene +20 OVR permanente;
- 50%: il fratello scende a 1 OVR.

### Mandalo via
- il fratello entra in una squadra casuale del campionato;
- ogni volta che affronti quella squadra, il fratello segna sicuramente un gol contro di te.

## 3. Il portiere vuole segnare

Viene selezionato il portiere titolare.

### Accetta
Per le successive 3 partite:
- 35% di possibilità che il portiere segni su calcio piazzato;
- al primo gol ottiene +10 OVR permanente;
- 35% di possibilità di subire un gol in contropiede con la porta scoperta.

### Rifiuta
- il portiere riceve -5 OVR nella prossima partita.

## 4. Il contratto scritto male

Viene scelto un giocatore casuale della rosa.

### Non correggere il contratto
- per 3 partite ogni suo gol vale doppio;
- al termine della terza partita lascia automaticamente la rosa.

### Correggi subito l'errore
- il giocatore resta;
- riceve -3 OVR per 3 partite.

## 5. Il modulo trovato su internet

### Provalo
- viene scelto casualmente un modulo standard diverso da quello attuale;
- il modulo vale per la prossima partita;
- vittoria: +2 OVR permanente a tutta la rosa;
- sconfitta: -2 OVR permanente ai titolari utilizzati;
- pareggio: nessun bonus o malus;
- dopo la partita viene ripristinato il modulo precedente.

L'evento non compare con il profilo allenatore `3-5-2`, perché quel profilo ha il modulo bloccato.

### Ignora il forum
- il prossimo avversario riceve +3 OVR.

## 6. Il giocatore che porta sfortuna

Viene scelto casualmente un titolare.

### Mettilo in panchina automaticamente
- il gioco lo sposta in panchina per la prossima partita;
- vittoria: +5 OVR permanente;
- sconfitta: lascia definitivamente la squadra;
- pareggio: nessun effetto.

### Non credere all'indovino
- il giocatore viene mantenuto o spostato automaticamente tra i titolari;
- la squadra riceve per la prossima partita un valore casuale non nullo compreso tra -5 e +5 OVR.

## Salvataggi

Tutti gli stati intermedi vengono salvati dentro `seasonRules` nel salvataggio versionato già esistente.
Non è stato creato un nuovo sistema di salvataggio e non sono state cambiate le chiavi del `localStorage`.

## 7. Il procuratore invadente

Viene scelto un giocatore presente in panchina.

### Accetta la clausola
- riceve +8 OVR per le prossime 3 partite;
- deve partire titolare in tutte e tre;
- se resta fuori anche una volta, lascia definitivamente la squadra;
- se la squadra vince tutte e tre le partite, il +8 OVR diventa permanente fino a fine stagione.

### Rifiuta
- il giocatore resta, ma perde 1 OVR fino a fine stagione.

## 8. La fascia di Calabria

Viene indicato come capitano il titolare con l’OVR attuale più alto.

### Assegnala
- il capitano riceve +12 OVR permanente;
- ogni sconfitta con lui titolare gli toglie 5 OVR permanente.

### Distruggila
- tutta la rosa perde 5 Intesa nella prossima partita.

## 9. La talpa nello spogliatoio

Vengono mostrati tre sospettati.

### Accusa un giocatore
- se è la talpa, viene cacciato e la squadra ottiene +15 Intesa nella prossima partita;
- se è innocente, lascia comunque la squadra per l’umiliazione.

### Non accusare nessuno
- nessun giocatore viene perso;
- i prossimi 3 avversari ricevono +8 OVR.

## Cambio di presidente

Tre candidati possono prendere il controllo del club:

- **Erich Toir**: 3 partite, almeno 2 vittorie, 7 gol e una vittoria con 3 gol di scarto. Il successo assegna un giocatore speciale da 95–105 OVR e +5 OVR permanente alla rosa; il fallimento vende il giocatore con OVR più alto.
- **Sylvio Berlusoni**: 3 partite con modulo casuale e capitano imposto, obiettivo 6 punti. Il successo assegna +12 OVR al capitano e il Tattico; il fallimento fa partire il giocatore e blocca l’ultimo modulo per altre 2 partite.
- **Gianpietro Pozzuolo**: per 2 partite i 3 titolari con OVR più alto vengono sostituiti da 3 panchinari. Servono almeno una vittoria e un gol di uno dei promossi. Il successo assegna +15 OVR al marcatore; il fallimento vende il giocatore con OVR più alto.
