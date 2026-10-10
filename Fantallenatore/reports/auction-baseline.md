# Verifica delle aste di Fantallenatore

Build di gioco: 3.2.35.56.158. Semi per scenario: 2.

**42 aste completate, 10500 acquisti validi.** Tutte le rose rispettano ruoli, unicità, budget e riserva minima.

Scenari oltre le tre soglie di attenzione: **0/42**. Questo valore non certifica da solo il bilanciamento.

## Risultati medi per scenario

| Divisione | Asta | Strategia | Semi | Residuo CPU | Top10 utente | Prezzo top/riferimento | Top tardivi economici | Vantaggio OVR11 utente |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Amatori | reparti | equilibrata | 2 | 0.56 | 4.00 | 1.08 | 0.00 | 0.60 |
| Amatori | reparti | top | 2 | 0.56 | 15.50 | 1.10 | 0.00 | 5.96 |
| Amatori | reparti | attendista | 2 | 0.56 | 1.00 | 1.03 | 0.00 | -9.66 |
| Serie C | reparti | equilibrata | 2 | 0.06 | 4.00 | 1.12 | 0.00 | 0.64 |
| Serie C | reparti | top | 2 | 0.00 | 15.50 | 1.16 | 0.00 | 5.22 |
| Serie C | reparti | attendista | 2 | 0.00 | 0.00 | 1.12 | 0.00 | -12.32 |
| Serie C | libera | equilibrata | 2 | 0.28 | 5.50 | 1.13 | 0.00 | 0.58 |
| Serie C | libera | top | 2 | 0.06 | 6.00 | 1.15 | 0.00 | 2.51 |
| Serie C | libera | attendista | 2 | 0.06 | 0.00 | 1.08 | 0.00 | -13.89 |
| Serie B | reparti | equilibrata | 2 | 0.00 | 4.50 | 1.13 | 0.00 | 1.23 |
| Serie B | reparti | top | 2 | 0.06 | 15.50 | 1.16 | 0.00 | 5.30 |
| Serie B | reparti | attendista | 2 | 0.00 | 0.50 | 1.11 | 0.00 | -12.34 |
| Serie B | libera | equilibrata | 2 | 0.17 | 6.00 | 1.13 | 0.00 | 1.55 |
| Serie B | libera | top | 2 | 0.06 | 7.50 | 1.15 | 0.00 | 2.38 |
| Serie B | libera | attendista | 2 | 0.00 | 0.00 | 1.08 | 0.00 | -13.96 |
| Serie A | reparti | equilibrata | 2 | 0.06 | 3.50 | 1.13 | 0.00 | -0.29 |
| Serie A | reparti | top | 2 | 0.06 | 15.50 | 1.18 | 0.00 | 5.13 |
| Serie A | reparti | attendista | 2 | 0.06 | 0.50 | 1.13 | 0.00 | -11.39 |
| Serie A | libera | equilibrata | 2 | 0.06 | 4.00 | 1.15 | 0.00 | 0.08 |
| Serie A | libera | top | 2 | 0.00 | 7.50 | 1.17 | 0.00 | 4.24 |
| Serie A | libera | attendista | 2 | 0.50 | 0.00 | 1.10 | 0.00 | -13.66 |

Top10: dieci migliori OVR per ciascun ruolo (40 giocatori), con valore di mercato come spareggio. Top tardivi economici: top10 presi dall’utente dopo il 60% degli slot, a <=25% del riferimento. OVR11: miglior undici sui sei moduli standard; non misura le vittorie in campionato.

## Lettura dei risultati

- Serie B, strategia sui top, asta per reparti: l’utente prende mediamente 15.50 dei 40 top10 e ottiene 5.30 punti OVR di vantaggio nel miglior undici rispetto alla media CPU.
- Serie A, strategia sui top, asta per reparti: l’utente prende mediamente 15.50 dei 40 top10 e ottiene 5.13 punti OVR di vantaggio nel miglior undici rispetto alla media CPU.

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
node tests/auction-competitive.js --seeds 2 --strict --report reports/auction-latest.json
node tools/summarize-auctions.js reports/auction-latest.json
```
