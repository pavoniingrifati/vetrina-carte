# Implementazione Fantaballopoli — Boss finali

Versione motore: **1.3.0**  
Versione stato salvataggi: **46**  
Data aggiornamento bilanciamento: **28 luglio 2026**

## Scelta iniziale

L’evento iniziale propone tre opzioni definitive:

1. **Accetta di perdere** — entra nella Triade e attiva il percorso contro **L’Inter degli Onesti**.
2. **Rifiuta di perdere** — combatte la Triade e attiva il percorso contro **La Juve della Triade**.
3. **Non voglio partecipare** — disattiva Fantaballopoli per tutta la stagione senza alterare il campionato.

## Percorso della Triade

- La prossima partita viene persa obbligatoriamente.
- Il giocatore con l’OVR più alto scopre l’accordo.
- Può essere ceduto obbligatoriamente al draft oppure rimosso definitivamente dalla squadra.
- Se viene ceduto, arriva **Giuda** nello stesso slot.
- Il giocatore ceduto entra segretamente nella formazione de **L’Inter degli Onesti** e segna almeno un gol nella boss fight.
- Se il normale mercato viene saltato o gestito automaticamente, lo scambio narrativo con Giuda viene comunque completato.

### Maledizione di Giuda

- Ogni vittoria con **Giuda titolare** riduce permanentemente di **5 OVR tutti i giocatori della rosa**, compresi panchinari e Giuda.
- La penalità è cumulativa e **non ha alcun limite minimo**: gli OVR possono arrivare a zero o diventare negativi.
- Se una delle tre prove viene fallita, **Giuda abbandona definitivamente la rosa** e il percorso delle prove termina immediatamente.

### Prove e Cartonati

1. **Il risultato prestabilito**
   - La partita comincia dallo **0-1**.
   - Avversari: **+15 OVR**.
   - Bisogna vincere entro i 90 minuti; pareggio, supplementari o rigori equivalgono a fallimento.
   - Vittoria: Cartonato dell’Arbitro.

2. **La dimostrazione di forza**
   - Giuda deve partire titolare.
   - Giuda deve segnare almeno un gol valido.
   - La squadra deve vincere con almeno due gol di scarto.
   - Ricompensa: Cartonato di Giuda.

3. **Distruggere il dossier**
   - Cinque partite consecutive con almeno un gol segnato in ciascuna.
   - Almeno 4 vittorie su 5.
   - Almeno 2 clean sheet.
   - Almeno 10 gol complessivi.
   - Ricompensa: Cartonato del Silenzio.

Ogni Cartonato disattiva un potere de **L’Inter degli Onesti**.

## Percorso contro la Triade

Il giocatore con l’OVR più alto diventa il **Testimone**.

### Prove e Intercettazioni

1. **Vincere contro dodici**
   - Gli avversari schierano realmente un dodicesimo giocatore.
   - Viene assegnato un rigore automatico contro.
   - Pareggio vietato: supplementari e rigori.
   - Vittoria: Intercettazione dell’Arbitro.

2. **Proteggere il Testimone**
   - Il Testimone deve partire titolare nelle successive tre partite.
   - Deve segnare almeno una volta.
   - Non deve essere espulso.
   - Ricompensa: Testimonianza del Giocatore.

3. **Spezzare il dominio**
   - Bisogna segnare almeno tre gol in una singola partita entro le successive tre giornate.
   - Ricompensa: Intercettazione della Triade.

Ogni prova disattiva un potere de **La Juve della Triade**.

## Boss finali

### L’Inter degli Onesti

Rosa ispirata all’Inter 2005/2006. Poteri possibili:

- Vigilanza arbitrale;
- Gabbia per Giuda;
- Dossier completo.

### La Juve della Triade

Rosa ispirata alla Juventus 2005/2006. Poteri possibili:

- Arbitro della Triade;
- Protezione del Palazzo: +10 OVR;
- Recupero infinito.

## Premio finale

- Vittoria nella boss fight: i punti del campionato vengono raddoppiati una sola volta.
- Pareggio non possibile nella boss fight: supplementari e rigori.
- Sconfitta: punti invariati.

## Compatibilità

- Nuovo schema di stato con migrazione dei vecchi stage di Fantaballopoli.
- Autosalvataggio e backup esistenti mantenuti.
- Community e REAL continuano a condividere lo stesso motore.

## Aggiornamento achievement boss

- Rimosso l'achievement legacy `juve-battuta`.
- `Sistema abbattuto` è stato rinominato **Il Palazzo è caduto**.
- `Inter degli Onesti battuta` è stato rinominato **Il sistema sei tu**.
