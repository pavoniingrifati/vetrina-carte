# Verifica delle aste di Fantallenatore

Build di gioco: 3.2.35.56.159. Semi per scenario: 1.

**21 aste completate, 5250 acquisti validi.** Tutte le rose rispettano ruoli, unicità, budget e riserva minima.

Scenari oltre le tre soglie di attenzione: **0/21**. Questo valore non certifica da solo il bilanciamento.

## Risultati medi per scenario

| Divisione | Asta | Strategia | Semi | Residuo CPU | Top10 utente | Prezzo top/riferimento | Top tardivi economici | Vantaggio OVR11 utente |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Amatori | reparti | equilibrata | 1 | 0.11 | 3.00 | 1.09 | 0.00 | 0.70 |
| Amatori | reparti | top | 1 | 0.56 | 15.00 | 1.10 | 0.00 | 5.93 |
| Amatori | reparti | attendista | 1 | 1.00 | 1.00 | 1.05 | 0.00 | -9.71 |
| Serie C | reparti | equilibrata | 1 | 0.00 | 2.00 | 1.31 | 0.00 | -2.83 |
| Serie C | reparti | top | 1 | 0.00 | 14.00 | 1.36 | 0.00 | 3.43 |
| Serie C | reparti | attendista | 1 | 0.00 | 1.00 | 1.27 | 0.00 | -13.04 |
| Serie C | libera | equilibrata | 1 | 0.00 | 0.00 | 1.36 | 0.00 | -2.51 |
| Serie C | libera | top | 1 | 0.00 | 10.00 | 1.41 | 0.00 | 4.50 |
| Serie C | libera | attendista | 1 | 0.00 | 0.00 | 1.36 | 0.00 | -10.66 |
| Serie B | reparti | equilibrata | 1 | 0.00 | 2.00 | 1.44 | 0.00 | -2.43 |
| Serie B | reparti | top | 1 | 0.00 | 13.00 | 1.53 | 0.00 | 2.19 |
| Serie B | reparti | attendista | 1 | 0.00 | 1.00 | 1.46 | 0.00 | -12.11 |
| Serie B | libera | equilibrata | 1 | 0.00 | 1.00 | 1.53 | 0.00 | -2.25 |
| Serie B | libera | top | 1 | 0.00 | 11.00 | 1.61 | 0.00 | 3.33 |
| Serie B | libera | attendista | 1 | 0.00 | 1.00 | 1.45 | 0.00 | -8.00 |
| Serie A | reparti | equilibrata | 1 | 0.00 | 3.00 | 1.58 | 0.00 | -0.87 |
| Serie A | reparti | top | 1 | 0.00 | 13.00 | 1.68 | 0.00 | 1.88 |
| Serie A | reparti | attendista | 1 | 0.11 | 2.00 | 1.56 | 0.00 | -2.93 |
| Serie A | libera | equilibrata | 1 | 0.00 | 1.00 | 1.59 | 0.00 | -0.81 |
| Serie A | libera | top | 1 | 0.00 | 14.00 | 1.67 | 0.00 | 0.40 |
| Serie A | libera | attendista | 1 | 0.00 | 0.00 | 1.58 | 0.00 | -8.57 |

Top10: dieci migliori OVR per ciascun ruolo (40 giocatori), con valore di mercato come spareggio. Top tardivi economici: top10 presi dall’utente dopo il 60% degli slot, a <=25% del riferimento. OVR11: miglior undici sui sei moduli standard; non misura le vittorie in campionato.

## Lettura dei risultati

- Serie B, strategia sui top, asta per reparti: l’utente prende mediamente 13.00 dei 40 top10 e ottiene 2.19 punti OVR di vantaggio nel miglior undici rispetto alla media CPU.
- Serie A, strategia sui top, asta per reparti: l’utente prende mediamente 13.00 dei 40 top10 e ottiene 1.88 punti OVR di vantaggio nel miglior undici rispetto alla media CPU.

Le soglie osservano occasioni tardive, concentrazione estrema dei top e crediti CPU inutilizzati. Un grande vantaggio di qualità può richiedere interventi anche senza superare queste soglie. Per decidere una modifica serve ampliare i semi e verificare anche partite, timer ed eventuali salvataggi in cui il problema si presenta.

## Soglie applicate

- B/A: almeno 2 top10 per ruolo dopo il 60% degli slot, prezzo <=25% del riferimento
- B/A: almeno 20 dei 40 top10 per ruolo
- B/A: residuo medio CPU >=100 crediti

## Segnalazioni

Nessuno scenario supera le tre soglie nella baseline eseguita.

## Ambito e limiti

250 acquisti, decisioni CPU e turni reali; regolamento base, listone iniziale, nessun evento/potere/sponsor. Risoluzione senza timer, click o rapporti dinamici. OVR11 è un indicatore di qualità, non una previsione di vittoria.

La strategia attendista è uno stress test di risparmio: chiama giocatori economici e può ritrovarsi ad acquistarli a 1. Non rappresenta ogni possibile strategia umana di attesa.

I test non modificano il comportamento del gioco. Il JSON accanto a questo rapporto conserva ogni acquisto e ogni rosa finale per ispezionare i casi singoli.

## Riproduzione

```text
node tests/auction-competitive.js --seeds 1 --strict --report reports/auction-latest.json
node tools/summarize-auctions.js reports/auction-latest.json
```
