# Ultimo rapporto di validazione della suite

Data: 21 luglio 2026

## Risultato stress test

| Modalità | Test eseguiti | Superati | Falliti | Stagioni complete simulate |
|---|---:|---:|---:|---:|
| Community | 21 | 21 | 0 | 4 |
| REAL | 21 | 21 | 0 | 4 |
| Totale | 42 | 42 | 0 | 8 |

Per ogni modalità sono state simulate:

- una stagione completa prevista dalla suite standard;
- tre stagioni complete aggiuntive dello stress test;
- 38 giornate per stagione;
- 152 giornate complessive per modalità;
- 304 giornate complessive tra Community e REAL.

Sono inoltre state provate la generazione del draft, la costruzione del calendario, una giornata completa, gli eventi automatici, le scelte evento eleggibili, i salvataggi e la migrazione dello stato.

## Integrità del gioco

I seguenti file sono rimasti identici alla precedente versione modulare:

- `campionato.html`;
- `campionato-real.html`;
- `assets/season-config-community.js`;
- `assets/season-config-real.js`;
- tutti i moduli di gioco da `01-bootstrap.js` a `14-runtime.js`.

La suite aggiunge soltanto strumenti separati e non modifica il comportamento del gioco pubblico.
