# Configurazione generale

I valori identificativi visibili nell'interfaccia sono raccolti in `GAME_CONFIG`, nel modulo `js/game-rules.js`.

| Chiave | Valore attuale | Utilizzo |
| --- | --- | --- |
| `buildVersion` | `3.2.35.56.294` | Titolo pagina, menu iniziale e numero build |
| `seasonLabel` | `2026/27` | Header, creazione carriera e schermate della lega |
| `leagueName` | `Lega Amatori` | Presentazione della carriera |
| `startingDivision` | `3` | Divisione assegnata alle nuove carriere |

I valori della carriera non vanno più duplicati direttamente nell'HTML. Gli elementi grafici usano gli attributi:

- `data-game-build`
- `data-game-season`
- `data-game-league`
- `data-current-division`

La divisione viene salvata in `state.career.division`. Le carriere precedenti che non possiedono il campo ricevono automaticamente la divisione iniziale configurata.

## Database Serie A

Le fonti ufficiali sono `data/serie-a.json` per club e giocatori italiani e `data/foreign-players.json` per i 300 nomi esteri. Dopo aver modificato uno dei JSON, eseguire:

```text
node tools/build-data.js
```

Il catalogo estero mantiene fissi soltanto ID tecnico e nome. Ruolo, età, nazionalità, campionato, OVR e potenziale vengono generati all'inizio di ogni nuova carriera; quotazione e FVM sono calcolati successivamente dai valori generati. Il comando valida i database e rigenera `data_v302.js`, necessario per mantenere l'avvio offline.

Le regole di gioco restano centralizzate nelle costanti dedicate, tra cui `ROLE_LIMITS`, `INITIAL_BUDGET`, `FANTASY_SEASON_MATCHDAYS`, `TOTAL_SLOTS` e `CAREER_STARTING_EUROS`.

## Pool estero
- Dimensione iniziale: 300 giocatori nascosti.
- Distribuzione ruoli indicativa: P 12%, D 34%, C 34%, A 20%.
- Fasce OVR: top 82-90, buoni 76-81, medi 70-75, prospetti 62-73.
- Il pool è deterministico e persistente per singola carriera.
