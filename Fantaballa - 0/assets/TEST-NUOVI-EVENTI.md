# Rapporto test nuovi eventi

## Cataloghi

- Decisioni comuni: 71
- Decisioni Community: 77
- Decisioni REAL: 71
- Eventi automatici Community: 5
- Eventi automatici REAL: 4
- Errori catalogo: 0
- Avvisi catalogo: 0

## Test logica dedicata

Sono stati eseguiti 7 test mirati:

1. rigorista più debole, rigore segnato e +5 OVR;
2. ingresso del fratello in rosa e Parte 2;
3. fratello trasferito e gol garantito contro;
4. gol del portiere, contropiede e +10 OVR;
5. gol doppio del contratto e uscita dopo 3 partite;
6. cambio modulo, ripristino e bonus vittoria;
7. panchina del giocatore sfortunato e uscita dopo una sconfitta.

Esito: 7/7 superati.

## Suite completa del motore

| Modalità | Test | Superati | Falliti | Errori runtime |
|---|---:|---:|---:|---:|
| Community | 26 | 26 | 0 | 0 |
| REAL | 26 | 26 | 0 | 0 |
| Totale | 52 | 52 | 0 | 0 |

## Altri controlli

- sintassi di tutti i file JavaScript: OK;
- caricamento cataloghi: OK;
- editor eventi: 8/8;
- database: 0 errori;
- salvataggi serializzabili: OK;
- nessuna modifica alle chiavi del `localStorage`.

## File principali modificati

- `data/events/events-common.json`
- `assets/season/event-handlers.js`
- `assets/season/08b-user-events.js`
- `assets/season/07-effects-quests-chains.js`
- `assets/season/09-analytics-and-summary.js`
- `assets/season/12-match-simulation.js`
- `campionato.html`
- `campionato-real.html`
