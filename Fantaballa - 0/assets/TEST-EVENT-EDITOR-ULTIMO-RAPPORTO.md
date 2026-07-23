# Rapporto test Editor eventi

Data verifica: 22 luglio 2026.

## Risultato generale

- Test strutturali editor: **8/8 superati**.
- Errori JavaScript durante il test UI: **0**.
- Errori iniziali dei cataloghi: **0**.
- Catalogo esportato e reimportato senza differenze: **sì**.
- Overflow orizzontale a 390 px: **assente**.

## Cataloghi caricati

| Catalogo | Decisioni | Eventi automatici |
|---|---:|---:|
| Comune | 65 | 4 |
| Community esclusivi | 4 | 1 |
| REAL esclusivi | 0 | 0 |

Conteggi finali del motore:

- Community: **69 decisioni**, **5 eventi automatici**.
- REAL: **65 decisioni**, **4 eventi automatici**.

## Test UI

Sono stati verificati:

1. caricamento dei tre cataloghi;
2. selezione automatica del primo evento;
3. rendering del modulo di modifica;
4. anteprima smartphone;
5. creazione di una nuova decisione;
6. blocco iniziale per i due handler mancanti;
7. ritorno a zero errori dopo la selezione degli handler;
8. aggiornamento immediato di titolo e anteprima;
9. esportazione di `events-common.json`;
10. confronto byte-logico con il catalogo originale;
11. layout a 390 × 844 px;
12. assenza di overflow del documento.

## Test del validatore

Sono stati verificati:

- cataloghi originali validi;
- baseline esatta 69/65 valida;
- aggiunta di una nuova decisione comune consentita;
- handler inesistente bloccato;
- ordine duplicato bloccato;
- campo `disabled` accettato;
- nessun uso di `eval`;
- collegamento corretto dello script editor.

## Test del caricatore del motore

Il caricatore reale `assets/season/10-events.js` è stato eseguito in ambiente isolato:

| Modalità | Automatici | Decisioni |
|---|---:|---:|
| Community | 5 | 69 |
| REAL | 4 | 65 |

Il filtro degli eventi con `disabled: true` è presente sia per gli eventi automatici sia per le decisioni.

## Altri controlli

- Validatore eventi flessibile: superato.
- Validatore eventi baseline esatta: superato.
- Validatore database: 0 errori bloccanti, 7 avvisi già noti.
- Audit asset: superato.
- Sintassi di tutti i file JavaScript: valida.
