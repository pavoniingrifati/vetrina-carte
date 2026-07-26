# Correzione caricamento carte Gotham

## Problema
La modalità Gotham provava a caricare file JSON non presenti nel pacchetto (`cards (3).json`, `data/cards-gotham.json`, ecc.). Quando tutte le richieste restituivano HTTP 404, il motore non poteva costruire i pool e mostrava 0 pacchetti disponibili.

## Correzione
- inserito l'archivio fornito come `data/cards.json`;
- impostato `data/cards.json` come prima sorgente sia per Gotham sia per Fantaballa;
- mantenuti i vecchi percorsi come fallback;
- aggiunto il riconoscimento di `Gotham City FC`, `Gotahm City` e `Svicolato`;
- migliorata la diagnostica della funzione `fetchCards()`.

## Verifica dati
L'archivio contiene 1.415 record. Dopo la normalizzazione il motore trova carte sufficienti per tutti i pacchetti Gotham, inclusi Bronze, Silver, Gold, Oggetti, Strumenti, Fusion2 e Gotham Tots.
