# Rapporto di validazione del Balance Lab

Data: 22 luglio 2026

## Esito generale

Il Balance Lab è stato validato sul motore Community e sul motore REAL senza modificare i moduli pubblici `01–14`.

## Controlli statici

- Sintassi valida per tutti i JavaScript in `assets/`.
- Validatore eventi: 0 errori e 0 avvisi.
- Validatore database: 0 errori bloccanti; restano 7 avvisi editoriali già noti.
- Audit asset: superato, 17 asset locali e nessun riferimento mancante.
- Collegamento a `balance-lab.html` presente nella suite `test-season.html`.

## Campioni runtime eseguiti

Per ciascuna modalità sono stati eseguiti:

- 30 stagioni con motore rapido;
- 14 stagioni con motore rapido e storie alternative;
- 7 stagioni con motore completo;
- due campioni aggiuntivi con lo stesso seed per verificare la ripetibilità.

Complessivamente, i campioni funzionali principali comprendono 102 stagioni: 51 Community e 51 REAL.

## Risultati Community

| Campione | Richieste | Completate | Fallite |
|---|---:|---:|---:|
| Rapido | 30 | 30 | 0 |
| Rapido con storie | 14 | 14 | 0 |
| Completo | 7 | 7 | 0 |

## Risultati REAL

| Campione | Richieste | Completate | Fallite |
|---|---:|---:|---:|
| Rapido | 30 | 30 | 0 |
| Rapido con storie | 14 | 14 | 0 |
| Completo | 7 | 7 | 0 |

## Ripetibilità

Ripetendo modalità, scenari, quantità e seed:

- Community: risultati ripetibili;
- REAL: risultati ripetibili.

## Errori runtime

- Errori non gestiti Community: 0.
- Errori non gestiti REAL: 0.
- Stagioni fallite nei campioni principali: 0.

Alcune stagioni si concludono tramite finali anticipati o alternativi previsti dal gameplay; non sono considerate fallimenti.

## Verifica dell'interfaccia

La sintassi e la logica del controller della pagina sono state controllate. L'ambiente di esecuzione ha bloccato la navigazione HTTP locale di Chromium con `ERR_BLOCKED_BY_ADMINISTRATOR`; per questo il test runtime è stato eseguito direttamente negli stessi moduli e nello stesso contesto browser tramite harness isolato.

Questa limitazione riguarda soltanto l'ambiente di verifica e non i file del progetto pubblicati su un normale dominio HTTP/HTTPS.

## Conclusione

Il laboratorio è pronto per confronti statistici ripetibili. Per decisioni di bilanciamento definitive si raccomanda:

- almeno 500 stagioni nel motore rapido;
- conferma delle anomalie con il motore completo;
- confronto prima/dopo usando lo stesso seed;
- valutazione separata con storie alternative disattivate e attivate.
