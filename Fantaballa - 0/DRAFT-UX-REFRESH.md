# Miglioramento schermata Draft

Aggiornamento: 27 luglio 2026

## Modifiche principali

- Un solo pulsante per aprire o cambiare il club estratto.
- Barra superiore compatta con avanzamento, titolari, riserve, OVR, Intesa e re-roll.
- Schede giocatore semplificate: eliminati numero progressivo e barra OVR ridondante.
- Ogni candidato mostra l'impatto previsto su OVR squadra e Intesa.
- Con il profilo allenatore `Talent scout`, il candidato più utile del pack viene evidenziato come `Migliore scelta`.
- Solo il `Talent scout` mostra lo slot consigliato, l'evidenziazione verde e i consigli sulla costruzione della rosa.
- Con tutti gli altri allenatori restano visibili esclusivamente dati oggettivi: impatto su OVR e Intesa, slot compatibili e posizioni mancanti.
- Il pannello destro analizza sempre valori e lacune della rosa, ma non propone scelte o consigli senza il `Talent scout`.
- Aggiunto `Annulla ultima scelta`, che rimuove il giocatore e ripristina il pack precedente.
- Reset e ritorno al modulo sono stati spostati sotto `Altre opzioni`.
- Migliorato il passaggio Giocatori → Campo su smartphone con barra fissa di conferma.

## File modificati

- `campionato.html`
- `campionato-real.html`
- `tricolore-pisa.html`
- `assets/season/03-state-and-data.js`
- `assets/season/04-setup-and-draft.js`
- `assets/season/draft-improvements.css` (nuovo)
- `tools/test-draft-improvements.js` (nuovo)

## Compatibilità salvataggi

I vecchi salvataggi restano compatibili. Il nuovo campo `draft.lastPlacement` è opzionale e viene normalizzato senza cambiare la chiave del `localStorage` o il formato generale del salvataggio.

## Test

- Sintassi JavaScript: superata per tutti i moduli.
- Test specifici Draft UX: 15/15 superati.
- Test oggetti e quest già esistenti: 28/28 superati.
