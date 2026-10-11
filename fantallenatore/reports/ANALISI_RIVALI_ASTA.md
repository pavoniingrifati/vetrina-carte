# Analisi dei rivali durante l’asta

Questa diagnosi descrive il comportamento precedente alla correzione dei cinque rivali speciali. Implementazione e risultati successivi: [RIVALI_SPECIALI.md](../RIVALI_SPECIALI.md) e [RIVALE.md](../RIVALE.md).

Analisi del codice attuale e di simulazioni economiche riproducibili. Nessuna modifica al comportamento del gioco.

## Metodo e limiti

Il test `tests/auction-competitive.js` usa le funzioni di produzione per chiamate, limiti e incrementi. Risolve però i rilanci in ordine sequenziale fisso: non esegue i timer e l’intero percorso `cpuReact`. Esclude eventi, poteri, sponsor e variazioni dinamiche dei rapporti. Il potere di Admin, quindi, non è incluso. OVR del miglior undici misura la qualità della rosa, non probabilità di vittoria né copertura di infortuni/rotazioni.

Sono usati tre seed distinti, riutilizzati tra strategie e modalità: il campione permette una diagnosi iniziale, non una classifica statisticamente affidabile delle personalità. La strategia utente “top” offre fino al 165% del riferimento sui top10 per ruolo, senza i vincoli di distribuzione dei reparti applicati alle CPU. “Equilibrata” conserva invece un budget per reparto; “attendista” aspetta le fasi finali.

In C sono eleggibili i 17 profili non Admin, senza un minimo garantito di speciali; in B/A sono garantiti almeno tre dei cinque rivali speciali. Admin è garantito solo in A. Questo rende particolarmente importante implementare le loro differenze tattiche.

## Ogni personalità

Il limite della tabella è l’offerta massima iniziale in A su Malen (OVR 93, riferimento circa 120,66), in un confronto controllato a roster vuoti, 500 crediti, prezzo iniziale 1 e medesimo seed. Non è una classifica di forza, né una previsione del prezzo finale.

| Rivale | Comportamento effettivo | Limite A | Problema da verificare/correggere |
|---|---|---:|---|
| Il Bomberista | Attacco prioritario; chiamate top e rilanci rapidi. | 167 | Proteggere la qualità degli altri titolari senza annullarne lo stile. |
| Il Ragioniere | Chiamate convenienti; poca volatilità e rilanci lenti. | 134 | Budget prudente: può rinunciare a miglioramenti decisivi dell’undici. |
| Lo Spendaccione | Chiama top spesso; più aggressivo e rapido. | 162 | I limiti comuni possono neutralizzare la maggiore aggressività. |
| Il Tirchio | Cerca valore, evita sovrapprezzi, reagisce lentamente. | 136 | Valutare il costo del mancato acquisto, oltre al risparmio. |
| Moneyball | Cerca valore e investe più a centrocampo. | 131 | Formula di efficienza condivisa: identità solo parzialmente distinta. |
| Il Tifoso | Favorisce l’Inter in scelta, interesse e ritmo. | 152 | Preferenza fissa: misurare quanto penalizza la competitività. |
| Collezionista di Top | Massima propensione iniziale a chiamare top; attacco prioritario. | 167 | Tetti comuni comprimono la sua volontà di acquistare stelle. |
| L'Esperto | Poca volatilità; chiamate bilanciate e più sensibilità al regolamento. | 152 | expert:true non ha un utilizzo dedicato nella logica d’asta. |
| Il Pazzo | Più caos nelle chiamate e nei rilanci; acquisti meno prudenti. | 162 | Il caos si riduce con la categoria: perde parte della sua identità in A. |
| Il Gambler | Volatilità e heat elevate; budget attacco elevato. | 167 | Chiamate e tempi standard; riskTaker:true non è utilizzato. |
| Il DS Stratega | Poca volatilità; più sensibilità al regolamento. | 141 | Chiamate standard; expert:true non introduce una strategia dedicata. |
| Il Rivale Diretto | Aggressività e heat maggiori. | 157 | Non diventa automaticamente un rivale ostile; manca una risposta specifica alle scelte dell’utente. |
| Lo Squalo | Aggressività, topBias e heat alti; attacco prioritario. | 168 | Chiamate e tempi standard: manca l’accelerazione specifica promessa. |
| Il Camaleonte | Poca volatilità e ricerca del valore. | 145 | Nessuna strategia dedicata di adattamento al comportamento dell’asta. |
| Il Fantadata | Ricerca del valore, poca volatilità, centrocampo importante. | 145 | Nessuna analisi dedicata; target dei reparti sommano 510 anziché 500. |
| Il Predatore | Aggressivo; forte preferenza per i top. | 165 | Chiamate e tempi standard: manca una politica specifica di attesa e attacco. |
| Il Broker | Massimi aggression e topBias; 323 crediti nominali in attacco. | 169 | Tetti condivisi ne comprimono la forza; manca una strategia dedicata di mercato. |
| Admin | Chiamate più orientate ai top; prudenza e ricerca del valore. | 144 | In A ha inoltre il potere di acquisto immediato a 1: va verificato separatamente. |

## Interpretazione del campione

Il caso da affrontare per primo è C per reparti: la strategia utente top produce +3,48 OVR11 sulla CPU media e +2,06 sulla CPU migliore. In B per reparti il vantaggio sulla media (+1,44) non supera la migliore CPU (−0,12); in A è +1,52 e +0,67 rispettivamente. Con asta libera, in B/A anche la strategia equilibrata supera leggermente la CPU migliore nelle medie dei tre seed (+0,12/+0,30). La progressione B→A non è strettamente monotona in tutti i confronti, ma il campione è troppo piccolo per attribuire differenze modeste a un difetto sistematico.

Nelle 63 aste non emerge l’exploit dei top tardivi a prezzo ≤25% del riferimento: il contatore è sempre zero. Le CPU spendono quasi tutto; non serve aumentare indiscriminatamente l’aggressività. Il risultato della strategia attendista è nettamente peggiore: aspettare da solo non permette di aggirare le CPU.

## Problemi prioritari

1. **Le personalità avanzate sono poco sviluppate.** Squalo, Camaleonte, Fantadata, Predatore e Broker differiscono per coefficienti e target, ma condividono le probabilità standard delle chiamate, i tempi standard e i rami generici dei rilanci. Gambler, Stratega e Rivale hanno anch’essi chiamate standard. I flag `expert` e `riskTaker` non sono consumati dalla logica d’asta. Questo limita la diversità tattica, senza rendere le CPU identiche.

2. **La riserva di budget può comprimere la difficoltà sui top.** In B/A la prima punta credibile riceve al massimo il 55% del margine destinabile al reparto quando ne mancano tre. In A cresce anche la protezione degli altri reparti. Nel confronto controllato, escludendo Admin dalle divisioni inferiori, i limiti su Malen sono 146–200 in C, 163–192 in B e 131–169 in A; in B/A il tetto di budget è vincolante per tutti i profili. Il singolo nome diventa talvolta meno conteso salendo di categoria. Non dimostra che tutta l’asta in A sia più facile.

3. **La competenza cresce uguale per tutte le personalità.** È 0,40 in C, 0,75 in B, 1 in A. Il flag “esperto” non aggiunge competenza. Tutte usano lo stesso modello di valutazione calcistica; le differenze di stile si riducono con il controllo comune. Le coperture di portieri/rotazioni scattano solo da B: in C manca questa componente.

4. **Alcuni obiettivi di costruzione della rosa non partono dall’undici ottimale.** La riserva usa P1/D4/C4/A3, cioè 12 titolari potenziali. Può essere sensato come profondità, ma va confrontato con il valore marginale dell’undici e con il mercato rimasto. Non è di per sé un errore di formazione.

5. **Ordine delle regole di rinuncia da verificare.** La riduzione della rinuncia ai buoni giocatori rimasti tardi viene seguita da una regola più prudente sugli ultimi due slot, che può alzarla nuovamente fino al 98% in A. È un rischio condizionale del codice: le simulazioni non bastano a stabilire quanto spesso si presenti.

6. **Fantadata ha target nominali per 510 crediti.** I limiti legali impediscono di spendere oltre 500; l’incoerenza influenza però le riserve e il rapporto tra reparti.

## Interventi consigliati

- Prima rendere dinamico il budget in funzione del miglioramento dell’undici, della profondità necessaria e delle alternative realmente disponibili. Mantenere sempre slot e crediti legali.
- Dare ai rivali speciali politiche concrete: Squalo pressione sui top contendibili, Camaleonte adattamento ai prezzi osservati, Fantadata rendimento marginale per credito, Predatore attesa con soglie esplicite, Broker chiamate che consumano il budget degli avversari senza compromettere la propria rosa.
- Da C mantenere un livello minimo di qualità, conservando errori e differenze di stile. B/A devono migliorare nelle scelte, non soltanto nel numero di rilanci.
- Verificare il potere di Admin, i rapporti dinamici, i rilanci su timer e gli eventi in un test completo del percorso d’asta.
- Misurare vantaggio contro CPU media e migliore, distribuzione dei top, spesa sui titolari/riserve, copertura e rinunce ai miglioramenti convenienti. Zero avvisi nei test attuali non equivale a bilanciamento: le soglie rilevano solo squilibri molto grandi.

## Riferimenti

- `app_v302.js`: PERSONALITIES, SPECIAL_RIVAL_IDS, profileArchetype.
- `js/domains/auction-controller.js`: chooseNomination, tryAdminOneShot.
- `js/domains/auction-policy.js`: cpuAuctionCompetence, cpuAuctionSpendingCap, strategicSlotInterest, jumpSize.
- `js/domains/auction-clock.js`: cpuNominationDelay, cpuReactionDelay.
- `tests/auction-competitive.js`: strategie utente, metriche, limiti della simulazione.

## Riproduzione

```bash
node tests/auction-competitive.js --seeds 3 --report /tmp/fanta-rival-audit.json
node tools/audit-rival-limits.js /tmp/fanta-rival-panel.json
```

Il confronto controllato mantiene roster vuoti, prezzo iniziale 1 e seed identico. Confronta tutte le personalità sullo stesso slot CPU; Admin nelle divisioni inferiori serve solo come confronto ipotetico. I dati riassunti sono in `rivals-auction-summary.json` e `rivals-controlled-panel.json`.

## Risultati delle simulazioni

63 aste complete, 15,750 acquisti validi, tre seed per combinazione. 0 scenari superano le soglie di attenzione esistenti. Ogni rosa termina con 25 giocatori, senza sforare il budget. Le medie sotto riguardano la qualità dell’undici; un valore positivo favorisce l’utente.

| Divisione | Modalità | Strategia utente | Vantaggio OVR11 vs CPU media | vs CPU migliore | Top10 utente (max 40) | Crediti residui CPU |
|---|---|---|---:|---:|---:|---:|
| Amatori | reparti | equilibrata | +0.10 | -1.52 | 3.67 | 0.41 |
| Amatori | reparti | top | +5.88 | +4.43 | 15.33 | 0.45 |
| Amatori | reparti | attendista | -9.89 | -12.39 | 1.00 | 0.59 |
| C | reparti | equilibrata | -3.11 | -5.03 | 1.67 | 0.00 |
| C | reparti | top | +3.48 | +2.06 | 14.00 | 0.00 |
| C | reparti | attendista | -11.67 | -14.21 | 1.00 | 0.00 |
| C | libera | equilibrata | +0.97 | -0.03 | 3.33 | 2.63 |
| C | libera | top | +1.13 | +0.21 | 8.00 | 3.96 |
| C | libera | attendista | -10.24 | -11.51 | 0.00 | 3.96 |
| B | reparti | equilibrata | -1.36 | -2.45 | 2.67 | 0.04 |
| B | reparti | top | +1.44 | -0.12 | 14.00 | 0.15 |
| B | reparti | attendista | -9.59 | -10.60 | 0.00 | 0.11 |
| B | libera | equilibrata | +1.21 | +0.12 | 4.67 | 2.59 |
| B | libera | top | +2.01 | +0.76 | 7.33 | 2.22 |
| B | libera | attendista | -8.73 | -10.55 | 0.00 | 3.81 |
| A | reparti | equilibrata | -0.10 | -1.06 | 3.00 | 0.11 |
| A | reparti | top | +1.52 | +0.67 | 11.33 | 0.00 |
| A | reparti | attendista | -6.52 | -7.64 | 0.33 | 0.00 |
| A | libera | equilibrata | +1.32 | +0.30 | 4.67 | 2.44 |
| A | libera | top | +1.88 | +0.70 | 8.00 | 3.26 |
| A | libera | attendista | -9.16 | -10.82 | 0.00 | 4.82 |

I risultati descrivono questi seed e queste tre strategie, non tutte le strategie possibili. Il confronto contro la CPU migliore evita di confondere il vantaggio sulla media con la superiorità su tutti gli avversari.
