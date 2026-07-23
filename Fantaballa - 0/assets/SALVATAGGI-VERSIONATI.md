# Salvataggi versionati Fantaballa

## Formato corrente

Il salvataggio principale contiene un envelope di formato `2`:

```json
{
  "version": 2,
  "mode": "community | real",
  "seasonId": "...",
  "createdAt": "...",
  "updatedAt": "...",
  "gameVersion": "1.1.0",
  "state": {}
}
```

La versione interna dello stato di gioco resta separata (`44`).

## Protezioni

- scrittura prima nella chiave temporanea;
- rilettura e validazione del temporaneo;
- rotazione del primario precedente nel backup;
- verifica del nuovo primario;
- recupero automatico da temporaneo o backup;
- isolamento dei JSON corrotti, delle versioni future e dei salvataggi dell’altra modalità;
- blocco di `NaN` e `Infinity`;
- migrazione automatica dei vecchi stati senza envelope;
- `seasonId` stabile per tutta la run.

## Chiavi

Per ogni modalità vengono usate:

- `<saveBase>_autosave`
- `<saveBase>_autosave_temp`
- `<saveBase>_autosave_backup`

Le chiavi Community e REAL restano completamente separate.
