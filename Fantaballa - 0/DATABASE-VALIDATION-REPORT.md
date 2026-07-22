# Rapporto validazione database Fantaballa

Generato: `2026-07-22T16:55:47.229986Z`

## Riepilogo

| Dataset | Record | Errori | Avvisi | Informazioni | Correzioni sicure |
|---|---:|---:|---:|---:|---:|
| community | 717 giocatori · 37 club | 0 | 8 | 0 | 0 |
| real | 455 giocatori · 21 club | 0 | 0 | 0 | 0 |
| commentary | cronaca gol | 0 | 0 | 0 | 0 |
| ranking-fallback | 0 righe | 0 | 0 | 1 | 0 |

## Criterio di pulizia

Le copie in `data/normalized/` applicano solo trasformazioni deterministiche: spazi, maiuscole delle posizioni, etichette ruolo, valori abbonamento e `rosterSize`. Nessun giocatore o club viene eliminato automaticamente.

## Questioni da verificare manualmente

- **community · PLAYER_NAME_DUPLICATE** — Nome giocatore duplicato: emadk_ [70 · inter-me-manda · A], Emadk [578 · fiumi-di-parolo · C].
- **community · PLAYER_NAME_DUPLICATE** — Nome giocatore duplicato: ale 💎 [83 · borussia-porcmund · A], Ale [830 · new-entry-team · D].
- **community · PLAYER_NAME_DUPLICATE** — Nome giocatore duplicato: Bruno Ceck [173 · borussia-porcmund · D], bruno.ceck [560 · manchester-simy · C].
- **community · PLAYER_NAME_DUPLICATE** — Nome giocatore duplicato: andyrabe51 [233 · sporting-limoncello · D], andyrabe51 [447 · patetico-miniero · C].
- **community · PLAYER_NAME_DUPLICATE** — Nome giocatore duplicato: Giulio valbo [244 · borussia-porcmund · D], Giulio Valbo [676 · bayer-leverduren · D].
- **community · PLAYER_NAME_DUPLICATE** — Nome giocatore duplicato: cristiano.vadala [367 · o-solet-mio · C], Cristiano vadala' [536 · atletico-ma-non-troppo · C].

## Tutte le anomalie

### WARNING (8)

- `community` · `PLAYER_NAME_DUPLICATE` — Nome giocatore duplicato: emadk_ [70 · inter-me-manda · A], Emadk [578 · fiumi-di-parolo · C].
- `community` · `PLAYER_NAME_DUPLICATE` — Nome giocatore duplicato: ale 💎 [83 · borussia-porcmund · A], Ale [830 · new-entry-team · D].
- `community` · `PLAYER_NAME_DUPLICATE` — Nome giocatore duplicato: Bruno Ceck [173 · borussia-porcmund · D], bruno.ceck [560 · manchester-simy · C].
- `community` · `PLAYER_NAME_DUPLICATE` — Nome giocatore duplicato: andyrabe51 [233 · sporting-limoncello · D], andyrabe51 [447 · patetico-miniero · C].
- `community` · `PLAYER_NAME_DUPLICATE` — Nome giocatore duplicato: Giulio valbo [244 · borussia-porcmund · D], Giulio Valbo [676 · bayer-leverduren · D].
- `community` · `PLAYER_NAME_DUPLICATE` — Nome giocatore duplicato: cristiano.vadala [367 · o-solet-mio · C], Cristiano vadala' [536 · atletico-ma-non-troppo · C].
- `community` · `CLUB_ROLE_DISTRIBUTION_FRAGILE` — Fantaballa FC: distribuzione ruoli fragile (P 1, D 3, C 4, A 6).
- `community` · `DATASET_PLAYER_COUNT_UNEXPECTED` — Numero giocatori inatteso: 717, attesi 716.

### INFO (1)

- `ranking-fallback` · `RANKING_EMPTY` — La classifica fallback è vuota; la pagina dipende dalla sorgente online.

## Correzioni sicure generate

Nessuna correzione necessaria.

## File generati

- `data/normalized/giocatori.json`
- `data/normalized/club.json`
- `data/normalized/giocatori-real.json`
- `data/normalized/club-real.json`
- `DATABASE-VALIDATION-REPORT.json`
