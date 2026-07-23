# Ultimo rapporto — validatore database

Data: 21 luglio 2026

## Stato dei database dopo la pulizia

| Dataset | Record | Errori | Avvisi | Informazioni | Correzioni pendenti |
|---|---:|---:|---:|---:|---:|
| Community | 716 giocatori · 37 club | 0 | 7 | 0 | 0 |
| REAL | 455 giocatori · 21 club | 0 | 0 | 0 | 0 |
| Cronaca gol | 10 gruppi posizione | 0 | 0 | 0 | 0 |
| Classifica fallback | 0 righe | 0 | 0 | 1 | 0 |
| **Totale** | — | **0** | **7** | **1** | **0** |

I sette avvisi Community sono sei possibili nomi duplicati e la distribuzione fragile dei ruoli di Fantaballa FC. La classifica fallback vuota è classificata come informazione, non come errore.

## Test automatici del motore

### Suite rapida

| Modalità | Superati | Falliti |
|---|---:|---:|
| Community | 23/23 | 0 |
| REAL | 23/23 | 0 |

### Suite completa

| Modalità | Superati | Falliti | Durata browser |
|---|---:|---:|---:|
| Community | 25/25 | 0 | 4,18 s |
| REAL | 25/25 | 0 | 3,95 s |

### Stress test

| Modalità | Superati | Falliti | Stagioni complete |
|---|---:|---:|---:|
| Community | 28/28 | 0 | 4 |
| REAL | 28/28 | 0 | 4 |
| **Totale** | **56/56** | **0** | **8** |

Il nuovo controllo avanzato del database è stato eseguito all'interno di entrambe le modalità:

- Community: 0 errori, 7 avvisi, 6 revisioni manuali, 0 correzioni pendenti;
- REAL: 0 errori, 0 avvisi, 0 correzioni pendenti.

Non sono stati rilevati errori JavaScript durante il caricamento dei runner o delle due modalità di gioco.
