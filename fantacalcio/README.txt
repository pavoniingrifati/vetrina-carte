FANTABALLA CHAMPIONS — save Champions 2.fm, data 20/09/2025

36 club della fase campionato, 1086 giocatori nel save (796 nella prima squadra; gli altri in riserve/giovanili). Nessun filtro sui nomi: inclusi i giocatori personalizzati. L'appartenenza al club non certifica la registrazione UEFA. I giocatori in prestito sono assegnati al club attuale letto nel save.

Aprire tramite un server HTTP: python -m http.server 8765, poi http://localhost:8765/index.html. Per aggiornare il sito online caricare tutti i file di questa cartella nella stessa posizione, sostituendo quelli esistenti. Il Google Apps Script originale è mantenuto: nessuna formazione è stata inviata durante i controlli. Verificarne separatamente il supporto per la nuova competizione prima dell'uso pubblico.

CREDITI (funzione di importazione originale, scelta dall'utente)
rating = arrotonda(CA / 2), arrotondamento JavaScript Math.round.
raw = (rating - 50) * coefficiente + premio.
crediti = max(3, min(70, arrotonda(raw))).
P: coefficiente 0.42, premio 2; D: 0.50, 4; C: 0.62, 7; A: 0.78, 11.
Esempio CA 170, A: rating 85, crediti 38.
Budget originale: 350. I ruoli sono assegnati dalla posizione naturale principale del lettore: GK=P; D/WB=D; M/DM=C; AM/ST=A.

Database: players_stats.json per builder e admin, players_skills.json per scouting, clubs_data.json per i 36 club; database_info.json documenta la provenienza. Export CSV: giocatori_champions_crediti.csv.
L'admin contiene lo stesso database aggiornato incorporato. Lo storage del browser è distinto dalla vecchia competizione. Statistichedi fantacalcio inizializzate a zero: i totali continentali non consentono di isolare tutta la fase campionato.

Scouting: attributi visibili 1–20 estratti dal save. I profili sono medie calcolate: Tecnico (dribbling, primo controllo, passaggi, tecnica, visione); Finalizzatore (finalizzazione, testa, senza palla, freddezza, intuito); Difensore (marcatura, contrasti, posizione, intuito, concentrazione); Fisico (accelerazione, agilità, equilibrio, elevazione, integrità, velocità, resistenza, forza); Mentale (decisioni, determinazione, squadra, impegno, concentrazione, coraggio); Fascia (cross, dribbling, accelerazione, velocità, resistenza); Piazzati (angoli, punizioni, rigori); Portiere (presa, riflessi, uno contro uno, estensione aerea, comando area).
Maglie stilizzate nei colori tradizionali dei 36 club; nessuna previsione, formazione o stile tattico inventato. Le pagine accessorie dell'archivio dedicate al Mondiale/TikTok restano strumenti separati, non aggiornati alla Champions.

AGGIORNAMENTO REGOLAMENTO E MEDIE
Gol +3; assist +1; autogol -3; gol subito SOLO portieri -1; rigore parato +3; rigore sbagliato -3; giallo -0.5; rosso -1 (sostituisce giallo nella stessa partita). Un rigore segnato vale il normale gol +3. Nessun bonus porta inviolata.
Il pannello admin accetta gol_subiti, rigori_parati e rigori_sbagliati (oppure goalsConceded, penaltiesSaved, penaltiesMissed). Un valore points/punteggio esplicito prevale sul calcolo. Le nuove regole valgono per nuovi inserimenti: lo storico già inserito non viene ricalcolato automaticamente.
medie_voto_fantamedie_parziali.csv/json: export dei totali CONTINENTALI, non statistiche certificate della sola Champions. Autogol e rigori parati non disponibili (celle vuote). La stima li omette, usa i gialli e rossi cumulati senza poter eliminare le sovrapposizioni e include i rigori sbagliati letti (campo non confermato). Il voto medio usa le presenze con voto; gli eventi delle eventuali partite senza voto non sono separabili. Anche gol subiti e rossi del lettore sono non confermati. Non è una fantamedia ufficiale: le stime non sono importate nei punteggi del sito. Per ottenere medie ufficiali inserire i dati partita per partita nel pannello admin.

MAGLIE: colori tradizionali dei club applicati a builder, scouting e immagini rosa esportate. Disegni stilizzati, non divise stagionali esatte; colori non estratti dal salvataggio.

MEDIE SUL SITO
MV = media voto Champions attribuibile alla prima giornata. FM* = stima parziale: autogol e rigori parati non disponibili; alcuni altri malus non confermati. — = dato non recuperato o nessun voto. Copertura: 27 club; i totali degli altri 9 non sono separabili.
Il CA è nascosto nelle interfacce, conservato nei file dati per il calcolo dei crediti. Non è un segreto protetto lato server. Le stime restano separate dai punteggi ufficiali e dai totali dell’admin. Bastoni: stima sospesa per l’autogol noto dallo screenshot, non estratto dal save.
