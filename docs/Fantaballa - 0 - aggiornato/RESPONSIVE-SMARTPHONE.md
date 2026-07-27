# Responsive smartphone

## Intervento

È stato aggiunto un livello responsive condiviso caricato dopo gli stili storici:

- `assets/mobile-responsive.css`
- `assets/mobile-responsive.js`

Le pagine mantengono grafica e logica originali, ma condividono ora regole comuni per viewport, safe area, touch target, modali, tabelle e tastiera mobile.

## Pagine aggiornate

- Home
- World Cup
- Campionato Community
- Fantacampionato REAL
- Classifiche
- Database giocatori
- Achievement
- Come si gioca
- Privacy
- Admin
- Controllo database
- Controllo eventi
- Test automatici

## Miglioramenti principali

- supporto `viewport-fit=cover` e aree sicure iPhone;
- eliminazione dello scorrimento orizzontale involontario;
- pulsanti principali e controlli compatti portati a dimensioni touch;
- input a 16 px per evitare lo zoom automatico su iOS;
- Home a una colonna e azioni adattive sotto 390 px;
- introduzione trasformata in pannello mobile scorrevole con comandi accessibili;
- intestazione World Cup su griglia mobile;
- step World Cup e schede lunghe scorrevoli orizzontalmente;
- modali partita, risultato ed eventi contenute dentro `100dvh`;
- blocco dello scroll di sfondo quando una modale è aperta;
- classifica convertita in schede senza titoli troncati;
- filtri e paginazione del database giocatori adattati al touch;
- toolbar tecniche e tabelle admin rese scorrevoli;
- gestione della tastiera virtuale tramite `visualViewport`;
- focus visibile per navigazione da tastiera.

## Verifiche

Sono state controllate viewport da 320, 360 e 390 px. Le pagine principali non generano overflow orizzontale del documento. La sintassi di tutti gli script JavaScript è valida; validatore eventi, validatore database e audit asset continuano a passare.

Il test runtime isolato del Campionato non può utilizzare `localStorage` perché viene eseguito in un documento `about:blank` senza origine. La logica del motore non è stata modificata; i controlli statici, la sintassi e i validatori sono passati.
