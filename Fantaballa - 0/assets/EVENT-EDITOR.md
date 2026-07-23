# Editor grafico degli eventi Fantaballa

## Apertura

Pubblica il progetto su un server web e apri:

```text
event-editor.html
```

L'editor è una pagina interna con `noindex`: non modifica direttamente i file presenti sul server. Le modifiche restano in memoria fino all'esportazione.

## Funzioni disponibili

- Caricamento dei cataloghi Comune, Community e REAL.
- Gestione separata di decisioni ed eventi automatici.
- Creazione, duplicazione ed eliminazione degli eventi.
- Spostamento di un evento tra i tre cataloghi.
- Modifica di ID, ordine, titolo e descrizione.
- Gestione dei flag `questEvent`, `chainOnly` e `userOnly`.
- Collegamento grafico degli handler registrati.
- Aggiunta, rimozione e riordinamento delle opzioni.
- Disattivazione temporanea tramite `disabled: true`.
- Anteprima dello stesso contenuto su una larghezza di 390 px.
- Ricerca per ID, titolo o testo.
- Importazione di un catalogo o di un backup completo.
- Salvataggio e recupero di una bozza nel browser.
- Esportazione di uno o di tutti i cataloghi.

## Sicurezza

L'editor non accetta JavaScript libero e non usa `eval`.

I cataloghi possono richiamare esclusivamente gli identificativi presenti in:

```text
assets/season/event-handlers.js
```

Per creare un comportamento completamente nuovo è quindi necessario aggiungere prima un handler nel motore. Per creare una variante di un comportamento esistente è sufficiente selezionare uno degli handler già disponibili.

## Cataloghi

### Comune

Gli eventi presenti in `events-common.json` sono disponibili sia nel Campionato Community sia nel Fantacampionato REAL.

### Community

Gli eventi presenti in `events-community.json` vengono aggiunti soltanto alla modalità Community.

### REAL

Gli eventi presenti in `events-real.json` vengono aggiunti soltanto alla modalità REAL.

## Disattivazione temporanea

Se si seleziona **Disattivato**, l'editor esporta:

```json
{
  "disabled": true
}
```

Il motore mantiene l'evento nel catalogo ma non lo carica durante la partita. È quindi possibile riattivarlo in seguito senza ricostruirlo.

## Esportazione

Il pulsante **Esporta catalogo** genera il file relativo alla scheda selezionata:

```text
events-common.json
events-community.json
events-real.json
```

Il pulsante **Esporta tutti** genera i tre file e anche:

```text
fantaballa-events-backup.json
```

Il backup completo può essere reimportato dall'editor, ma non deve essere collocato nella cartella `data/events` del gioco.

## Procedura consigliata

1. Aprire `event-editor.html` tramite server web.
2. Creare o modificare gli eventi.
3. Correggere tutti gli errori bloccanti mostrati a destra.
4. Esportare i cataloghi.
5. Sostituire i file dentro `data/events/`.
6. Aprire `event-check.html`.
7. Eseguire `test-season.html` prima della pubblicazione.

## Validazione

L'editor impedisce l'esportazione in presenza di:

- ID duplicati;
- ordini duplicati;
- titoli obbligatori mancanti;
- meno di due opzioni;
- etichette mancanti;
- handler inesistenti;
- eventi esclusivi Community spostati nel REAL;
- rimozione accidentale dei contenuti minimi esistenti.

Gli avvisi sui testi lunghi non impediscono l'esportazione, ma segnalano contenuti che possono risultare troppo estesi su smartphone.

## Bozza browser

La bozza viene salvata nella chiave locale:

```text
fantaballa_event_editor_draft_v1
```

Non utilizza né modifica le chiavi dei salvataggi delle stagioni.
