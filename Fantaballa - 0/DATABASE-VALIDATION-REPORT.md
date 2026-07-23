# Rapporto validazione database Fantaballa

Generato: `2026-07-23T09:13:15.716284Z`

## Riepilogo

| Dataset | Record | Errori | Avvisi | Informazioni | Correzioni sicure |
|---|---:|---:|---:|---:|---:|
| community | 738 giocatori · 37 club | 0 | 25 | 0 | 17 |
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

### WARNING (25)

- `community` · `PLAYER_NAME_DUPLICATE` — Nome giocatore duplicato: emadk_ [70 · inter-me-manda · A], Emadk [578 · fiumi-di-parolo · C].
- `community` · `PLAYER_NAME_DUPLICATE` — Nome giocatore duplicato: ale 💎 [83 · borussia-porcmund · A], Ale [830 · new-entry-team · D].
- `community` · `PLAYER_NAME_DUPLICATE` — Nome giocatore duplicato: Bruno Ceck [173 · borussia-porcmund · D], bruno.ceck [560 · manchester-simy · C].
- `community` · `PLAYER_NAME_DUPLICATE` — Nome giocatore duplicato: andyrabe51 [233 · sporting-limoncello · D], andyrabe51 [447 · patetico-miniero · C].
- `community` · `PLAYER_NAME_DUPLICATE` — Nome giocatore duplicato: Giulio valbo [244 · borussia-porcmund · D], Giulio Valbo [676 · bayer-leverduren · D].
- `community` · `PLAYER_NAME_DUPLICATE` — Nome giocatore duplicato: cristiano.vadala [367 · o-solet-mio · C], Cristiano vadala' [536 · atletico-ma-non-troppo · C].
- `community` · `CLUB_ROLE_DISTRIBUTION_FRAGILE` — Fantaballa FC: distribuzione ruoli fragile (P 1, D 3, C 4, A 6).
- `community` · `CLUB_ROSTER_SIZE_MISMATCH` — Balordi FC: rosterSize è 19, ma i giocatori presenti sono 21.
- `community` · `CLUB_ROSTER_SIZE_MISMATCH` — Amaro Luciano: rosterSize è 21, ma i giocatori presenti sono 22.
- `community` · `CLUB_ROSTER_SIZE_MISMATCH` — Dragon Ballotta: rosterSize è 19, ma i giocatori presenti sono 20.
- `community` · `CLUB_ROSTER_SIZE_MISMATCH` — Dybala Coi Lupi: rosterSize è 20, ma i giocatori presenti sono 21.
- `community` · `CLUB_ROSTER_SIZE_MISMATCH` — Fiumi di Parolo: rosterSize è 20, ma i giocatori presenti sono 21.
- `community` · `CLUB_ROSTER_SIZE_MISMATCH` — Je So Paz: rosterSize è 20, ma i giocatori presenti sono 21.
- `community` · `CLUB_ROSTER_SIZE_MISMATCH` — Lino Banfield: rosterSize è 19, ma i giocatori presenti sono 20.
- `community` · `CLUB_ROSTER_SIZE_MISMATCH` — Perder Brema: rosterSize è 19, ma i giocatori presenti sono 20.
- `community` · `CLUB_ROSTER_SIZE_MISMATCH` — O Solet Mio: rosterSize è 19, ma i giocatori presenti sono 20.
- `community` · `CLUB_ROSTER_SIZE_MISMATCH` — Borussia Porcmund: rosterSize è 21, ma i giocatori presenti sono 22.
- `community` · `CLUB_ROSTER_SIZE_MISMATCH` — Bayer Leverdüren: rosterSize è 19, ma i giocatori presenti sono 20.
- `community` · `CLUB_ROSTER_SIZE_MISMATCH` — Paris Saint Gennar: rosterSize è 19, ma i giocatori presenti sono 22.
- `community` · `CLUB_ROSTER_SIZE_MISMATCH` — Sporting Limoncello: rosterSize è 19, ma i giocatori presenti sono 20.
- `community` · `CLUB_ROSTER_SIZE_MISMATCH` — Olympique Maremma: rosterSize è 19, ma i giocatori presenti sono 20.
- `community` · `CLUB_ROSTER_SIZE_MISMATCH` — Dinamo Twitch: rosterSize è 19, ma i giocatori presenti sono 20.
- `community` · `CLUB_ROSTER_SIZE_MISMATCH` — Real Fuorigioco: rosterSize è 18, ma i giocatori presenti sono 19.
- `community` · `CLUB_ROSTER_SIZE_MISMATCH` — New Entry Team: rosterSize è 21, ma i giocatori presenti sono 23.
- `community` · `DATASET_PLAYER_COUNT_UNEXPECTED` — Numero giocatori inatteso: 738, attesi 716.

### INFO (1)

- `ranking-fallback` · `RANKING_EMPTY` — La classifica fallback è vuota; la pagina dipende dalla sorgente online.

## Correzioni sicure generate

- `community` · `club:balordi-fc` · `rosterSize`: `19` → `21` (conteggio sincronizzato con i giocatori presenti)
- `community` · `club:amaro-luciano` · `rosterSize`: `21` → `22` (conteggio sincronizzato con i giocatori presenti)
- `community` · `club:dragon-ballotta` · `rosterSize`: `19` → `20` (conteggio sincronizzato con i giocatori presenti)
- `community` · `club:dybala-coi-lupi` · `rosterSize`: `20` → `21` (conteggio sincronizzato con i giocatori presenti)
- `community` · `club:fiumi-di-parolo` · `rosterSize`: `20` → `21` (conteggio sincronizzato con i giocatori presenti)
- `community` · `club:je-so-paz` · `rosterSize`: `20` → `21` (conteggio sincronizzato con i giocatori presenti)
- `community` · `club:lino-banfield` · `rosterSize`: `19` → `20` (conteggio sincronizzato con i giocatori presenti)
- `community` · `club:perder-brema` · `rosterSize`: `19` → `20` (conteggio sincronizzato con i giocatori presenti)
- `community` · `club:o-solet-mio` · `rosterSize`: `19` → `20` (conteggio sincronizzato con i giocatori presenti)
- `community` · `club:borussia-porcmund` · `rosterSize`: `21` → `22` (conteggio sincronizzato con i giocatori presenti)
- `community` · `club:bayer-leverduren` · `rosterSize`: `19` → `20` (conteggio sincronizzato con i giocatori presenti)
- `community` · `club:paris-saint-gennar` · `rosterSize`: `19` → `22` (conteggio sincronizzato con i giocatori presenti)
- `community` · `club:sporting-limoncello` · `rosterSize`: `19` → `20` (conteggio sincronizzato con i giocatori presenti)
- `community` · `club:olympique-maremma` · `rosterSize`: `19` → `20` (conteggio sincronizzato con i giocatori presenti)
- `community` · `club:dinamo-twitch` · `rosterSize`: `19` → `20` (conteggio sincronizzato con i giocatori presenti)
- `community` · `club:real-fuorigioco` · `rosterSize`: `18` → `19` (conteggio sincronizzato con i giocatori presenti)
- `community` · `club:new-entry-team` · `rosterSize`: `21` → `23` (conteggio sincronizzato con i giocatori presenti)

## File generati

- `data/normalized/giocatori.json`
- `data/normalized/club.json`
- `data/normalized/giocatori-real.json`
- `data/normalized/club-real.json`
- `DATABASE-VALIDATION-REPORT.json`
