# Ultimo rapporto — salvataggi versionati

Data: 21 luglio 2026

## Risultato

- **COMMUNITY**: 27/27 test superati, 0 falliti.
- **REAL**: 27/27 test superati, 0 falliti.

Totale: **54/54 test superati**, con **8 stagioni complete** e **304 giornate** simulate.

## Controlli specifici dei salvataggi

- formato envelope 2;
- modalità Community/REAL;
- `seasonId` persistente;
- backup automatico;
- recupero del temporaneo più recente;
- recupero dal backup;
- migrazione legacy;
- isolamento tra modalità;
- isolamento del JSON corrotto;
- blocco di `NaN` e `Infinity`.

## Ambiente

- versione stato: 44;
- versione formato salvataggio: 2;
- motore: 1.1.0;
- 716 giocatori / 37 club Community;
- 455 giocatori / 21 club REAL.
