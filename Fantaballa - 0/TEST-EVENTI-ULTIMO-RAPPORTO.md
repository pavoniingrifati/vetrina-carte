# Rapporto test eventi data-driven

Data: 21 luglio 2026

## Parità con la versione precedente

Il catalogo generato dai JSON è stato confrontato con il precedente `10-events.js` monolitico.

| Modalità | Eventi automatici | Decisioni | Opzioni | Differenze |
|---|---:|---:|---:|---:|
| Community | 5 | 69 | 140 | 0 |
| REAL | 4 | 65 | 132 | 0 |

Sono stati confrontati:

- ordine e ID;
- titoli statici e dinamici;
- testi;
- flag `questEvent`, `chainOnly` e `userOnly`;
- condizioni `available`;
- creazione del contesto;
- descrizioni dinamiche;
- etichette ed effetti delle opzioni;
- corpo logico di ogni handler.

## Validatore cataloghi

- Cataloghi analizzati: 3
- Errori: 0
- Avvisi: 0
- Decisioni comuni: 65
- Decisioni esclusive Community: 4
- Eventi automatici comuni: 4
- Eventi automatici esclusivi Community: 1
- Decisioni con contenuti o condizioni dinamiche: 35

## Suite completa del motore

Esecuzione in Chromium Headless con risorse incorporate e salvataggi isolati.

| Modalità | Test | Superati | Falliti | Stagioni complete simulate |
|---|---:|---:|---:|---:|
| Community | 28 | 28 | 0 | 4 |
| REAL | 28 | 28 | 0 | 4 |
| **Totale** | **56** | **56** | **0** | **8** |

Ogni modalità ha eseguito una stagione completa standard e tre stagioni aggiuntive di stress. Sono stati provati anche tutti gli eventi automatici e tutte le scelte evento eleggibili.

## Esito

La migrazione è funzionalmente equivalente alla versione precedente e mantiene tutte le differenze tra Community e REAL.
