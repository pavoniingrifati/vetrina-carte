# Difficoltà CPU — confronto V158 → V159

La versione 3.2.35.56.159 introduce competenza progressiva nell'asta: Amatori conserva il comportamento precedente; C, B e A aumentano l'attenzione alla qualità, la pianificazione dei crediti e la prudenza sugli ultimi slot.

## Modifiche

- OVR corrente e titolarità stimata completano la valutazione basata sul prezzo/FVM. Il peso cresce per divisione.
- Il credito per i reparti ancora da costruire viene protetto in base ai fabbisogni, ai budget di personalità e ai titolari affidabili già acquistati.
- Negli ultimi due slot le CPU evitano maggiormente riserve inferiori quando restano alternative migliori e acquistabili.
- La ricerca delle occasioni considera qualità e titolarità, riducendo il premio eccessivo al solo basso prezzo.
- Le categorie superiori riducono le chiamate caotiche e restringono la scelta verso candidati coerenti con la loro strategia; rimangono personalità, gusti e variazioni casuali.
- I calcoli di qualità/titolarità sono riutilizzati durante l'asta. Si aggiornano al cambio del mondo, della giornata o del seme.

I budget iniziali restano 500 crediti per le CPU. Questa modifica non aggiunge malus né legge risultati futuri o potenziale nascosto. Le aste già iniziate usano le nuove decisioni sui giocatori ancora disponibili; gli acquisti conclusi restano conclusi.

## Validazione

28 script di regressione passano, compresi i 62 controlli della suite principale. Il test dedicato controlla la crescita delle valutazioni e dei limiti reali sui top, la protezione dei crediti, l'ultimo slot e il completamento a budget minimo.

21 aste complete e 5.250 acquisti validi: quattro divisioni, due modalità da C in su e tre strategie. Sono confrontate con gli stessi scenari e lo stesso seme `audit-asta-0` della baseline precedente. Non si confrontano medie ottenute con semi diversi.

## Risultati

Il vantaggio è la differenza fra OVR medio del miglior undici dell'utente e media dei migliori undici delle nove CPU. Valori più bassi indicano maggiore competitività CPU in questa prova; non misurano le vittorie in campionato. “Top” indica dieci migliori OVR per ciascun ruolo.

| Divisione | Asta | Strategia | Vantaggio OVR11 prima | Vantaggio OVR11 dopo | Top utente prima | Top utente dopo |
|---|---|---|---:|---:|---:|---:|
| Amatori | reparti | equilibrata | 0.70 | 0.70 | 3 | 3 |
| Amatori | reparti | top | 5.93 | 5.93 | 15 | 15 |
| Amatori | reparti | attendista | -9.71 | -9.71 | 1 | 1 |
| Serie C | reparti | equilibrata | 1.12 | -2.83 | 4 | 2 |
| Serie C | reparti | top | 5.14 | 3.43 | 15 | 14 |
| Serie C | reparti | attendista | -11.98 | -13.04 | 0 | 1 |
| Serie C | libera | equilibrata | 1.37 | -2.51 | 6 | 0 |
| Serie C | libera | top | 3.00 | 4.50 | 7 | 10 |
| Serie C | libera | attendista | -14.57 | -10.66 | 0 | 0 |
| Serie B | reparti | equilibrata | 1.12 | -2.43 | 4 | 2 |
| Serie B | reparti | top | 5.14 | 2.19 | 15 | 13 |
| Serie B | reparti | attendista | -11.98 | -12.11 | 0 | 1 |
| Serie B | libera | equilibrata | 1.37 | -2.25 | 6 | 1 |
| Serie B | libera | top | 3.00 | 3.33 | 7 | 11 |
| Serie B | libera | attendista | -14.57 | -8.00 | 0 | 1 |
| Serie A | reparti | equilibrata | -0.31 | -0.87 | 4 | 3 |
| Serie A | reparti | top | 4.77 | 1.88 | 15 | 13 |
| Serie A | reparti | attendista | -11.22 | -2.93 | 0 | 2 |
| Serie A | libera | equilibrata | 0.01 | -0.81 | 3 | 1 |
| Serie A | libera | top | 4.58 | 0.40 | 8 | 14 |
| Serie A | libera | attendista | -14.87 | -8.57 | 0 | 0 |

Con strategia sui top, nelle aste per reparti il vantaggio dopo l'intervento è 3,43 OVR in C, 2,19 in B e 1,88 in A. Nella chiamata libera è 4,50 in C, 3,33 in B e 0,40 in A.

L'intervento non migliora ogni singolo scenario rispetto alla versione precedente: per esempio, con chiamata libera il vantaggio sui top aumenta in C e leggermente in B. La progressione della competenza è più chiara, ma le scelte casuali e le strategie dell'utente continuano a produrre differenze. Occorrono più semi e partite complete per calibrare ulteriormente la difficoltà.

Le tre aste degli Amatori sono identiche alla baseline anche nelle 250 assegnazioni e nelle rose finali. Una nuova asta di Serie A a chiamata libera è stata ripetuta dopo le ultime verifiche per controllarne la riproducibilità.

## Limiti

Listone iniziale e regolamento base; nessun evento, potere, bonus sponsor o rapporto dinamico. Il test risolve le offerte senza timer e senza click del browser. Non riproduce uno specifico salvataggio avanzato.

Le soglie di attenzione del precedente audit non vengono superate. Questo non equivale a una certificazione del bilanciamento. Il dettaglio di tutte le assegnazioni è in `auction-difficulty-after.json`; la baseline V158 è in `auction-baseline.json`.
