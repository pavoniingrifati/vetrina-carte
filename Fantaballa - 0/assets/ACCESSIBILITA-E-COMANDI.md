# Accessibilità e rifinitura dei comandi

## Obiettivo

L'intervento migliora l'uso di Fantaballa da tastiera, smartphone e tecnologie assistive senza aggiungere pannelli permanenti e senza modificare le regole del gameplay.

## File condivisi aggiunti

- `assets/accessibility.css`
- `assets/accessibility.js`

I due file sono caricati da tutte le 17 pagine HTML del progetto.

## Miglioramenti introdotti

### Navigazione da tastiera

- collegamento “Vai al contenuto principale” visibile quando riceve il focus;
- focus ben riconoscibile su pulsanti, link, campi, schede e riepiloghi;
- navigazione delle schede Classifica, Calendario, Rosa, Statistiche e Percorso con frecce, Home ed End;
- ruoli ARIA `tab`, `tablist` e `tabpanel` aggiornati dinamicamente.

### Finestre modali

- nome accessibile ricavato automaticamente dal titolo;
- focus spostato nella finestra quando viene aperta;
- focus mantenuto all'interno durante la navigazione con Tab;
- ripristino del focus sul comando precedente alla chiusura;
- tasto Esc disponibile solo quando esiste un'azione sicura di chiusura, annullamento o riduzione.

### Comandi di partita

- pulsanti di simulazione protetti dai clic ripetuti;
- stato `aria-busy` annunciato durante l'avvio delle operazioni;
- pulsanti di partita disabilitati quando è presente una decisione evento non risolta;
- motivazione visibile e collegata al pulsante disabilitato;
- comandi di coppa e sfide finali sottoposti alla stessa protezione.

### Formazione

Il comando per schierare un calciatore infortunato espone ora chiaramente lo stato:

- `Gioca infortunato: sì (-20 Intesa)`;
- `Gioca infortunato: no`.

Il pulsante usa inoltre `aria-pressed` per indicare la scelta corrente.

### Cronaca e messaggi

- punteggio live esposto come regione di stato;
- cronaca aggiornata tramite regione live;
- toast e feedback annunciati senza interrompere la navigazione;
- pulsanti privi di `type` corretti automaticamente in `type="button"`.

### Preferenze dell'utente

Con `prefers-reduced-motion: reduce` vengono ridotte o disattivate:

- transizioni;
- animazioni decorative;
- pulsazioni;
- scorrimenti animati.

È presente anche un comportamento specifico per la modalità ad alto contrasto del sistema.

## Compatibilità

L'intervento è condiviso tra:

- Campionato Community;
- Fantacampionato REAL;
- World Cup;
- Home;
- classifiche e database;
- achievement;
- strumenti interni di test, validazione ed editing.

## Salvataggi

L'accessibilità non aggiunge nuovi dati al salvataggio e non modifica il formato del `localStorage`.
