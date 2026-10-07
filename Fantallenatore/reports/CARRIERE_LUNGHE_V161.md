# Salvataggi e carriere lunghe V161

## Interventi

- Mercato: dettagli delle ultime quattro finestre e ultimo movimento per ogni giocatore. Gli identificativi di tutte le finestre applicate restano conservati per evitare riapplicazioni, anche delle finestre rimosse. Pool, club attuale, giocatori esteri, nuovi arrivi e dati economici non vengono eliminati.
- Acquisti dell'utente aggregati per giocatore con conteggio; l'albo d'oro usa tale conteggio. I salvataggi precedenti con una riga per acquisto vengono aggregati senza perdere il totale.
- Registro dettagliato FP limitato agli ultimi 76 accrediti; saldo e totali guadagnati/spesi restano completi. Premi e recap di tutte le stagioni restano conservati.
- Snapshot: ultime 200 righe del log e finestre scambi della stagione corrente. Stato di asta, giornata corrente, Big Match pendente e live sono preservati.
- Compattazione senza mutare lo stato durante la serializzazione. Mercato compattato anche durante applicazione piani; nuova carriera stagionale copia dati economici già compattati.
- Cambio scheda e pagehide richiedono salvataggio e flush anticipati. La chiusura improvvisa del processo non consente una garanzia assoluta su IndexedDB asincrono.

## Validazione

Fixture strutturale di 100 stagioni, non cento stagioni giocate: 6.324.056 byte prima, 319.855 dopo, riduzione 95%. È un caso sintetico volutamente carico di log e piani; non una promessa sulla dimensione del tuo salvataggio.

10.000 movimenti ridotti a 250 senza modificare il mondo materializzato. Trofei e record di 99 stagioni conservati, 2.500 acquisti recuperati come 25 contatori, saldi invariati. Snapshot idempotente e non distruttivo; ripristino con parser di produzione. Riapplicazione di un piano storico impedita.

Limiti: crescita contenuta, non dimensione costante. Recap di stagione, identificativi dei piani e popolazione del mondo possono crescere perché rappresentano progressi necessari. Non misurati FPS, tempi UI o chiusura reale del browser. La compattazione riduce dati copiati e scansionati; non certifica tutte le prestazioni delle carriere lunghe.

Validazione finale: 33 script core superati. Compattazione verificata anche caricando un salvataggio precedente non compattato tramite parser di produzione.
