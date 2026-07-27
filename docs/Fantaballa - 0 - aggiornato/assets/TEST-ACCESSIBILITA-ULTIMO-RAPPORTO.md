# Rapporto test accessibilità e comandi

## Esito complessivo

- Pagine di gioco verificate: 2
- Test motore superati: 52/52
- Errori runtime: 0
- Errori JavaScript in console: 0

## Controlli superati in Community e REAL

- skip link presente;
- tutti i pulsanti hanno un tipo esplicito;
- cinque schede con ruoli ARIA corretti;
- una sola scheda selezionata;
- navigazione con frecce funzionante;
- pannelli collegati alle rispettive schede;
- motivo del comando disabilitato visibile e associato;
- focus iniziale dentro le modali;
- focus contenuto nella modale durante Tab;
- modali dotate di nome accessibile;
- Esc annulla una conferma senza eseguire l'azione;
- blocco dei doppi comandi attivo;
- supporto a `prefers-reduced-motion`;
- nessun pulsante visibile senza nome accessibile;
- nessun overflow orizzontale a 390 px.

## Test del motore

| Modalità | Superati | Falliti |
|---|---:|---:|
| Community | 26 | 0 |
| REAL | 26 | 0 |
| **Totale** | **52** | **0** |

## Strumenti

Il controllo ripetibile è disponibile in:

```text
tools/test-accessibility.py
```

Il risultato strutturato dell'ultima esecuzione è disponibile in:

```text
TEST-ACCESSIBILITA.json
```
