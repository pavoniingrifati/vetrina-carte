/* Fantaballa Season Engine — 10-events.js
 * Catalogo eventi/decisioni e relativa interfaccia di risoluzione.
 * Modulo classico: l'ordine di caricamento è definito negli HTML del Campionato.
 */
const AUTO_EVENTS=[
 {title:'Problema muscolare',text:'Un titolare casuale si infortuna.',apply(){const r=pick(getStarterEntries());if(r){setOwnPlayerInjury(r,2);return `${r.player.name} è infortunato per 2 giornate.${state.seasonRules.futureInjuryZeroPoints?' Punti azzerati dalla regola del futuro.':''}`}return 'Nessun titolare disponibile.'}},
 {title:'Contusione',text:'Un giocatore casuale della rosa non è al meglio.',apply(){const r=pick(rosterPlayers());if(r){setOwnPlayerInjury(r,1);return `${r.player.name} è infortunato per 1 giornata.${state.seasonRules.futureInjuryZeroPoints?' Punti azzerati dalla regola del futuro.':''}`}return 'Nessun giocatore disponibile.'}},
 {title:'Settimana perfetta',text:'La squadra si allena alla grande.',apply(){state.activeEffects.push({type:'teamChem',value:5,rounds:1});return '+5 Intesa per la prossima partita.'}},
 {title:'Sostegno degli abbonati',text:'Gli abbonati trascinano il gruppo.',apply(){state.activeEffects.push({type:'subscriberChem',value:3,rounds:2});return '+3 Intesa agli abbonati per 2 giornate.'}},
 {title:'Arbitraggio severo',text:'La prossima gara si preannuncia nervosa.',apply(){state.activeEffects.push({type:'cards',value:1,rounds:1});return 'Probabilità di squalifica aumentata per la prossima partita.'}}
].filter(event=>!EXCLUDED_AUTO_EVENT_TITLES.has(String(event?.title||'')));
const DECISIONS=[
 {id:'nuovo-sponsor',title:'Arriva un nuovo sponsor!',text:'Scegli quello che preferisci.',choices:[
  {label:'Padelle Ballarini',effect:'Che prodotto di qualità! Le uova non si attaccano alla padella: ogni bonus OVR positivo ottenuto dagli eventi riceve +5 OVR aggiuntivi',apply(){return activateBallariniSponsor()}},
  {label:'Football Manager',effect:'Il miglior manageriale del mondo! Ottieni un Tattico che schiera automaticamente la formazione migliore e un fisioterapista che dimezza il rischio di infortunio',apply(){return activateFootballManagerSponsor()}}
 ]},

 {id:'quest-like-a-bomber',questEvent:true,title:'Un misterioso bomber ti si avvicina',text:'Sostiene che la tua squadra debba dimostrare di saper segnare come una vera macchina da gol.',available(){return questCanStart(5)},choices:[
  {label:'Accetta: Like a bomber',effect:'Segna almeno 10 gol nelle prossime 5 partite. Successo: +8 OVR al miglior attaccante fino a fine stagione. Fallimento: il miglior attaccante passa a 50 OVR fino a fine stagione.',apply(){return acceptLikeBomberQuest()}},
  {label:'Rifiuta',effect:'Nessun effetto.',apply(){return'Rifiuti la sfida. Nessun effetto.'}}
 ]},
 {id:'quest-fair-play-finanziario',questEvent:true,title:'Un funzionario con una valigetta sostiene che la tua squadra abbia dei debiti',text:'Ti propone un controllo sportivo immediato sui risultati delle prossime giornate.',available(){return questCanStart(4)},choices:[
  {label:'Accetta: Fair play finanziario',effect:'Conquista almeno 9 punti nelle prossime 4 giornate. Fallimento: -6 punti.',apply(){return acceptFairPlayQuest()}},
  {label:'Patteggia',effect:'Perdi subito 1 punto, ma la missione non parte.',apply(){return rejectFairPlayQuest()}}
 ]},
 {id:'quest-la-curva',questEvent:true,title:'I tifosi pretendono una dimostrazione di fedeltà',text:'La curva vuole che la squadra non perda contro Juventus, Milan e Inter.',available(){return questCurveAvailable()},choices:[
  {label:'Accetta: La curva',effect:'Non perdere contro Juventus, Milan e Inter. Successo: +5 OVR finché non perdi. Fallimento: -5 OVR fino a fine stagione.',apply(){return acceptCurvaQuest()}},
  {label:'Rifiuta',effect:'Nessun effetto.',apply(){return'Rifiuti la richiesta della curva. Nessun effetto.'}}
 ]},
 {id:'quest-ammazza-grandi',questEvent:true,title:'Un vecchio allenatore ti sfida',text:'Vuole vedere se sei capace di abbattere una delle squadre che guidano il campionato.',available(){return questCanStart(6)},choices:[
  {label:'Accetta: Ammazza grandi',effect:'Nelle prossime 6 giornate batti almeno una squadra che si trova nelle prime 3. Successo: +5 OVR agli under 80. Fallimento: -6 OVR al miglior giocatore.',apply(){return acceptAmmazzaGrandiQuest()}},
  {label:'Rifiuta',effect:'Nessun effetto.',apply(){return'Rifiuti la sfida del vecchio allenatore. Nessun effetto.'}}
 ]},
 {id:'quest-milanlab',questEvent:true,title:'Un medico rossonero sostiene di poter rendere la tua squadra indistruttibile',text:'Il suo laboratorio vuole sottoporre la rosa a una prova di resistenza.',available(){return questCanStart(5)},choices:[
  {label:'Accetta: MilanLab',effect:'Completa 5 giornate senza nuovi infortuni. Successo: immunità per 5 giornate. Fallimento: il primo infortunio dura il doppio.',apply(){return acceptMilanLabQuest()}},
  {label:'Rifiuta',effect:'Nessun effetto.',apply(){return'Non affidi la squadra al medico rossonero. Nessun effetto.'}}
 ]},
 {id:'quest-calcio-champagne',questEvent:true,title:'Una società sconosciuta vuole investire nella tua squadra, ma pretende spettacolo',text:'Lo sponsor vuole almeno due gol in ciascuna delle prossime tre partite.',available(){return questCanStart(3)},choices:[
  {label:'Accetta: Calcio champagne',effect:'Segna almeno 2 gol in ognuna delle prossime 3 partite. Successo: +1 punto per vittoria per 6 giornate. Fallimento: i pareggi diventano sconfitte per 6 giornate.',apply(){return acceptChampagneQuest()}},
  {label:'Rifiuta',effect:'Nessun effetto.',apply(){return'Rifiuti l’investimento. Nessun effetto.'}}
 ]},
 {id:'pulmino-bordello',title:'Il pulmino della squadra finisce in un bordello',text:"L’autista ha seguito il navigatore sbagliato e la squadra si ritrova in uno strip club.",available(){return Number(state.matchday)<19},choices:[
  {label:'Restate per lo spettacolo',effect:'+5 Intesa alla squadra per 2 giornate, ma -10 OVR a un giocatore casuale nella prossima partita',apply(){pushEffect('teamChem',5,2);return applyPlayerEffect('playerOvr',-10,1)}},
  {label:'Prendete subito un taxi',effect:'+10 OVR nella prossima partita, ma 1 scelta in meno al draft di metà stagione',apply(){pushEffect('teamOvr',10,1);return changeMidseasonPicks(-1)}}
 ]},
 {id:'figlio-presidente',title:'Il figlio del presidente contesta la formazione',text:'Il figlio del presidente pretende di decidere la formazione.',available(){return Number(state.matchday)<19},choices:[
  {label:'Segui i consigli del figlio',effect:'Perdi sicuramente la prossima partita, ma ricevi 1 scelta in più al draft di metà stagione',apply(){pushEffect('forcedLoss',1,1);return changeMidseasonPicks(1)}},
  {label:'Difendi le tue idee tattiche',effect:'+6 OVR nella prossima partita, ma 1 scelta in meno al draft di metà stagione',apply(){pushEffect('teamOvr',6,1);return changeMidseasonPicks(-1)}}
 ]},
 {id:'gol-tre-due',title:'La tua squadra ha appena segnato il gol del 3-2',text:'Cosa decidi di fare?',choices:[
  {label:'Rimani pacato in panca, applaudendo',effect:'+5 OVR a un giocatore casuale per la prossima partita',apply(){return applyPlayerEffect('playerOvr',5,1)}},
  {label:'Vai sotto la curva avversaria',effect:'+5 OVR a tutta la squadra, ma un giocatore casuale si infortuna',apply(){pushEffect('teamOvr',5,1);const entry=randomOwnEntry();if(!entry)return 'Nessun giocatore disponibile.';injureOwnPlayers([entry],1);return `${entry.player.name} si infortuna per 1 giornata.`}}
 ]},
 {id:'whatsapp-pubblicato',title:'Il gruppo WhatsApp della squadra viene pubblicato online',text:'Sono usciti gli screen delle vostre chat. E ora?',available(){return Number(state.matchday)<19},choices:[
  {label:'Dici che sei stato hackerato',effect:'+10 Intesa agli abbonati nella prossima partita, ma il draft di metà stagione viene fatto casualmente dal bot',apply(){pushEffect('subscriberChem',10,1);state.seasonRules.botMidseason=true;return 'Il bot controllerà casualmente tutte le entrate e le uscite del draft di metà stagione.'}},
  {label:'Chiedi pubblicamente scusa dicendo che hai un sacco di amici di colore',effect:'-5 Intesa a tutta la squadra per 2 giornate',apply(){pushEffect('teamChem',-5,2);return '-5 Intesa alla squadra per 2 giornate.'}}
 ]},
 {id:'rissa-mascotte',title:'Scoppia una rissa tra te e la mascotte della squadra',text:"La mascotte sostiene d’allenare meglio di te.",available(){return Number(state.matchday)<19},choices:[
  {label:'Allena lui la squadra',effect:'Non avrai più il controllo delle decisioni né del draft di metà stagione',apply(){state.seasonRules.autoDecisions=true;state.seasonRules.autoMidseason=true;state.seasonRules.botMidseason=true;return 'Da ora tutte le decisioni e il draft di metà stagione saranno gestiti casualmente dalla mascotte.'}},
  {label:'Lo fai licenziare',effect:'La mascotte appare come calciatore da 99 OVR in una squadra casuale',apply(){return addMascotToRandomTeam()}}
 ]},
 {id:'cuggino-influencer',title:'Il presidente ingaggia suo cuggino influencer',text:'Non ha mai giocato a calcio, ma ha due milioni di follower e una videocamera sempre accesa.',choices:[
  {label:'Lo mandi a fare contenuti con gli abbonati',effect:'+10 Intesa a tutti gli abbonati per 1 giornata',apply(){pushEffect('subscriberChem',10,1);return '+10 Intesa agli abbonati nella prossima partita.'}},
  {label:'Lo fai partecipare all’allenamento',effect:'+5 OVR a tutta la squadra nella prossima partita, ma tutti gli abbonati sono infortunati',apply(){pushEffect('teamOvr',5,1);const entries=rosterPlayers().filter(entry=>isSubscriber(entry.player));const names=injureOwnPlayers(entries,1);return names.length?`Abbonati infortunati per 1 giornata: ${names.join(', ')}.`:'Non ci sono abbonati in rosa.'}}
 ]},
 {id:'drone-avversario',title:'Un drone avversario spia l’allenamento',text:'Il drone è fermo sopra il campo e sta trasmettendo in diretta tutte le tattiche.',choices:[
  {label:'Gli mostri deliberatamente una tattica falsa',effect:'OVR del prossimo avversario ridotto di 10 punti',apply(){pushEffect('opponentOvr',-10,1);const opponent=nextOpponentTeam();return opponent?`${opponent.name} riceve -10 OVR nella prossima partita.`:'Il prossimo avversario riceve -10 OVR.'}},
  {label:'Lo abbatti con un pallone',effect:'2 giocatori casuali del prossimo avversario saranno infortunati',apply(){return injureNextOpponentPlayers(2)}}
 ]},
 {id:'aggiornamento-var',title:'Il VAR deve installare un aggiornamento',text:'Il sistema operativo segnala: “Tempo rimanente: 4 ore e 37 minuti”.',choices:[
  {label:'Giochi col VAR non aggiornato',effect:'Nella prossima partita il risultato è totalmente casuale e non dipende dall’OVR.',apply(){pushEffect('varRandomResult',1,1,{source:'VAR non aggiornato'});return 'La prossima partita avrà un risultato completamente casuale, indipendente dall’OVR delle due squadre.'}},
  {label:'Spegni il VAR',effect:'Nella prossima partita aumenta il rischio di espulsioni a sfavore.',apply(){pushEffect('refChaos',1,1,{opponentRedChance:0,ownRedChance:.70,source:'VAR spento'});return 'Nella prossima partita aumenta fortemente il rischio di un’espulsione per la tua squadra.'}}
 ]},
 {id:'crescita-personale',title:'Il capitano apre un corso di crescita personale',text:'Per tre ore ripete frasi come “il fuorigioco esiste solo nella tua mente”.',choices:[
  {label:'Obblighi tutti a partecipare',effect:'×2 Intesa per 1 giornata',apply(){pushEffect('teamChemMultiplier',2,1);return 'Tutti i bonus Intesa positivi dei titolari vengono raddoppiati nella prossima partita.'}},
  {label:'Interrompi il seminario e fate allenamento',effect:'+6 OVR, ma Intesa azzerata nella prossima partita',apply(){pushEffect('teamOvr',6,1);pushEffect('teamChemZero',1,1);return '+6 OVR alla squadra e Intesa azzerata nella prossima partita.'}}
 ]},

 {id:'personaggio-misterioso-tearless-italia-2006',userOnly:true,title:'Un misterioso personaggio ti si avvicina',text:'«Ehi, sai chi sono?»',available(){const chain=mysteryCharacterChain();return Number(state.matchday)<seasonLength()-2&&!chain.active&&!chain.completed},choices:[
  {label:'Ah sì, sei un famoso YouTuber!',effect:'Tearless (51 OVR) arriva in squadra al posto di un giocatore casuale.',apply(){return recruitTearless()}},
  {label:'Non sei un campione del mondo?',effect:'Uno dei campioni del mondo 2006 arriva in squadra al posto di un giocatore casuale.',apply(){return recruitWorldChampion()}}
 ]},
 {id:'cassaaa-pinguino',userOnly:true,title:'Capitolo 1: Cassaaa',text:'Arriva un misterioso pinguino e ti propone una scommessa decisamente sospetta.',available(){return Number(state.matchday)<seasonLength()-3&&!penguinChain().active&&!penguinChain().completed},choices:[
  {label:'1+over 5,3 x Steell cage',effect:'La prossima partita finisce 3-2 per te, ma devi iscriverti al suo canale. In seguito si attiverà il Capitolo 2.',apply(){return acceptCassaaaBet()}},
  {label:'Scrolla',effect:'Non lo ascolti e ti concentri sulla prossima partita',apply(){return scrollPenguin()}}
 ]},
 {id:'mentalista',title:'Arriva un mentalista nello spogliatoio',text:'Dice di poter far credere agli avversari che il pallone sia invisibile.',available(){return Number(state.matchday)<seasonLength()-6},choices:[
  {label:'Gli permetti di ipnotizzare l’attaccante',effect:'75%: +8 OVR nella prossima partita. 25%: il mentalista sbaglia e lo trasforma in un pollo da 1 OVR',apply(){return hypnotizeRandomAttacker()}},
  {label:'Gli chiedi di confondere l’arbitro',effect:'Possibile cartellino rosso avversario, ma rischio di espulsione per un tuo giocatore',apply(){pushEffect('refChaos',1,1,{opponentRedChance:.45,ownRedChance:.30,source:'Mentalista'});return 'Nella prossima partita: 45% rosso avversario e 30% rosso per la tua squadra.'}}
 ]},
 {id:'mentalista-pollaio',chainOnly:true,title:'Il richiamo del pollaio',text:'Il pollo sembra ricordare vagamente come si gioca a calcio.',choices:[
  {label:'Continua ad allenarlo',effect:'Dopo ogni giornata guadagna casualmente da 1 a 5 OVR',apply(){return trainChicken()}},
  {label:'Portalo dal veterinario',effect:'Torna subito al suo OVR originale, ma resta fuori per 5 partite',apply(){return veterinarianChicken()}},
  {label:'Accetta la sua nuova natura',effect:'Resta a 1 OVR, ma ogni suo gol vale doppio',apply(){return acceptChickenNature()}}
 ]},
 {id:'grigliata-ultras',title:"L’allenamento viene invaso da una grigliata degli ultras",text:'Fumo, salsicce e cori impediscono qualsiasi esercitazione tattica.',choices:[
  {label:'Partecipate alla grigliata',effect:'×2 Intesa nella prossima partita',apply(){pushEffect('teamChemMultiplier',2,1);return 'Tutti i bonus Intesa positivi dei titolari vengono raddoppiati nella prossima partita.'}},
  {label:'Continuate ad allenarvi nel fumo',effect:'+7 OVR, ma un giocatore casuale subisce una contusione di 1 giornata',apply(){pushEffect('teamOvr',7,1);const entry=randomOwnEntry();if(!entry)return 'Nessun giocatore disponibile.';injureOwnPlayers([entry],1);return `${entry.player.name} subisce una contusione di 1 giornata.`}}
 ]},
 {id:'rapito-alieni',title:'Un giocatore sostiene di essere stato rapito dagli alieni',text:'È tornato all’allenamento con una pettinatura diversa e nuove convinzioni tattiche.',available(){return Number(state.matchday)<19},createContext(){const entry=randomOwnEntry();return entry?{playerId:String(entry.playerId),playerName:entry.player.name}:{}},describe(context){return context?.playerName?`${this.text} Il giocatore coinvolto è ${context.playerName}.`:this.text},choices:[
  {label:'Credi alla sua storia',effect:'+5 OVR a quel giocatore fino a fine stagione',apply(context){const entry=context?.playerId?rosterEntry(context.playerId):null;if(!entry)return 'Nessun giocatore disponibile.';const current=Number(entry.player?.ovr||playerById(entry.playerId)?.ovr)||60,change=setPermanentRosterOvr(entry,current+5);return change?`${change.player.name} sale da ${change.before} a ${change.after} OVR fino a fine stagione.`:'Il bonus OVR non è stato applicato.'}},
  {label:'È un povero pazzo',effect:'Al draft di metà stagione devi scambiarlo con un giocatore di pari o maggiore OVR',apply(context){if(!context?.playerId)return 'Nessun giocatore disponibile.';queueEqualOrBetterMidseasonPlayer(context.playerId);return `${context.playerName} dovrà essere scambiato al draft di metà stagione con un giocatore di pari o maggiore OVR.`}}
 ]},

 {id:'arbitro-ecuadoriano',userOnly:true,title:'Un misterioso arbitro ecuadoriano ti si avvicina',text:'Ti propone il suo aiuto per le prossime partite.',available(){return !secretRefereeDealState().active},choices:[
  {label:'Accetta il suo aiuto',effect:'Riceverai un rigore a favore in ogni partita.',apply(){return startSecretRefereeDeal('accept')}},
  {label:'Rifiuta il suo aiuto',effect:'Riceverai un rigore contro in ogni partita.',apply(){return startSecretRefereeDeal('refuse')}}
 ]},
 {id:'maglie-nomi-sbagliati',userOnly:true,title:'Maglie con i nomi sbagliati',text:'Il magazziniere ha scambiato tutte le divise.',available(){return realCurrentLineupEntries().length>=2},choices:[
  {label:'Giocate comunque',effect:'Due titolari casuali si scambiano posizione. Entrambi ricevono -5 OVR se finiscono fuori ruolo.',apply(){return startWrongShirtsEvent()}},
  {label:'Stampate nuove maglie all’ultimo secondo',effect:'Un giocatore casuale perde la prossima partita. Gli altri ricevono +3 Intesa.',apply(){return printLastMinuteShirts()}}
 ]},
 {id:'porta-calcetto',userOnly:true,title:'La porta è più piccola del regolamento',text:'Lo stadio avversario monta per errore una porta da calcetto.',choices:[
  {label:'Protestate',effect:'La partita viene giocata normalmente. La squadra riceve -3 OVR per il nervosismo.',apply(){pushEffect('teamOvr',-3,1,{source:'Protesta per la porta da calcetto'});return 'La squadra riceve -3 OVR nella prossima partita per il nervosismo.'}},
  {label:'Accettate',effect:'Entrambe le squadre hanno meno probabilità di segnare. Il vostro portiere riceve +10 OVR.',apply(){return acceptSmallGoalMatch()}}
 ]},
 {id:'giocatore-insonne',userOnly:true,title:'Il giocatore insonne',text:'Un titolare ha passato la notte a giocare a 0-0-0.',available(){return realCurrentLineupEntries().length>0},createContext(){const entry=randomRealCurrentLineupEntry();return entry?{playerId:String(entry.playerId),playerName:entry.player.name}:{}},describe(context){return context?.playerName?`${this.text} Il giocatore coinvolto è ${context.playerName}.`:this.text},choices:[
  {label:'Mandatelo comunque in campo',effect:'-12 OVR per una partita. Se segna, ottiene +15 Intesa fino a fine stagione.',apply(context){return sendInsomniacOnField(context)}},
  {label:'Lasciatelo riposare',effect:'Non disponibile per una giornata. Al rientro: +5 OVR per 2 giornate.',apply(context){return restInsomniacPlayer(context)}}
 ]},
 {id:'maglie-novanta',title:'Il magazziniere lava tutte le maglie a 90 gradi',text:'Le divise ora sembrano adatte a una squadra Pulcini.',choices:[
  {label:'Giocate comunque con le maglie strette',effect:'+5 OVR nella prossima partita, ma rischio di infortunio aumentato',apply(){pushEffect('teamOvr',5,1);pushEffect('injuryRisk',1,1,{chance:.45,count:1,duration:1,source:'Maglie strette'});return '+5 OVR, con il 45% di rischio che un giocatore si infortuni.'}},
  {label:'Usate le vecchie maglie degli anni Novanta',effect:'+5 Intesa per 2 giornate',apply(){pushEffect('teamChem',5,2);return '+5 Intesa alla squadra per 2 giornate.'}}
 ]},
 {id:'tifoso-formazione',title:'Un tifoso vince il diritto di fare la formazione',text:'Ha vinto il concorso comprando 600 pacchetti di patatine.',choices:[
  {label:'Ti rifiuti di fare sta pagliacciata',effect:'1 punto di penalizzazione in classifica',apply(){const standing=userStanding();if(standing)standing.pts-=1;return 'È stato applicato 1 punto di penalizzazione in classifica.'}},
  {label:'Accetti ma il tifoso è Gullo',effect:'Nella prossima partita puoi al massimo pareggiare',apply(){pushEffect('maxDraw',1,1);return 'La prossima partita non potrà essere vinta: il risultato massimo sarà un pareggio.'}}
 ]},
 {id:'tiktok-boomer',title:'Il preparatore atletico boomer scopre TikTok',text:'Sostituisce l’allenamento con balletti sincronizzati e challenge.',choices:[
  {label:'Registrate la challenge',effect:'Abbonati ×2 Intesa per 2 giornate, squadra -5 OVR per 2 giornate',apply(){pushEffect('subscriberChemMultiplier',2,2);pushEffect('teamOvr',-5,2);return 'Intesa positiva degli abbonati raddoppiata e -5 OVR alla squadra per 2 giornate.'}},
  {label:'Lo fai tornare su Facebook',effect:'+5 OVR alla squadra, ma Intesa azzerata per 1 giornata',apply(){pushEffect('teamOvr',5,1);pushEffect('teamChemZero',1,1);return '+5 OVR alla squadra e Intesa azzerata nella prossima partita.'}}
 ]},
 {id:'marotta-league',title:'La Marotta League',text:'Un misterioso personaggio ti si avvicina.',choices:[
  {label:'Le vittorie valgono doppio',effect:'Ogni vittoria vale 6 punti fino a fine stagione, ma ogni sconfitta comporta 100 punti di penalità',apply(){state.seasonRules.marottaDoubleWins=true;state.seasonRules.marottaLossPenalty=100;return 'Da ora fino a fine stagione: +6 punti per ogni vittoria e -100 punti per ogni sconfitta.'}},
  {label:'Vittoria assicurata',effect:'Vinci sicuramente la prossima partita, ma aumenta drasticamente la probabilità di infortunio',apply(){pushEffect('forcedWin',1,1);pushEffect('injuryRisk',1,1,{chance:.80,count:1,duration:2,source:'Vittoria assicurata'});return 'La prossima partita sarà vinta, ma c’è l’80% di rischio di un infortunio da 2 giornate.'}}
 ]},
 {id:'corto-muso',title:'Corto Muso',text:'Un misterioso personaggio ti si avvicina.',choices:[
  {label:'Te ne intendi di ippica?',effect:'Puoi segnare al massimo 1 gol nella prossima partita, ma se vinci ottieni 9 punti',apply(){pushEffect('goalCap',1,1);pushEffect('winPoints',9,1);return 'Nella prossima partita massimo 1 gol segnato; un’eventuale vittoria vale 9 punti.'}},
  {label:'Il miglior attacco è la difesa',effect:'Non subisci gol per le prossime 2 partite, ma tutti i tuoi attaccanti sono squalificati',apply(){pushEffect('cleanSheet',1,2);const entries=rosterPlayers().filter(entry=>roleOf(entry.player)==='A');entries.forEach(entry=>statusOf(entry.playerId).suspension=Math.max(statusOf(entry.playerId).suspension,1));return entries.length?`Porta inviolata garantita per 2 partite. Attaccanti squalificati per la prossima giornata: ${entries.map(entry=>entry.player.name).join(', ')}.`:'Porta inviolata garantita per 2 partite.'}}
 ]},
 {id:'ma-che-mollo',title:'Ma che mollo',text:'Un misterioso personaggio ti si avvicina.',choices:[
  {label:'Siamo pazzi qua?',effect:'×3 Intesa nella prossima partita, ma subisci almeno 1 gol per 2 partite',apply(){pushEffect('teamChemMultiplier',3,1);pushEffect('minimumGoalsAgainst',1,2);return 'Intesa positiva triplicata nella prossima partita; almeno 1 gol subito nelle prossime 2.'}},
  {label:'Chi fa sto mestiere non è mollo',effect:'Segnano tutti gli abbonati nella prossima partita e perdi il controllo delle decisioni fino a fine stagione',apply(){pushEffect('forceSubscriberGoals',1,1);state.seasonRules.autoDecisions=true;return 'Nella prossima partita ogni abbonato presente in campo segnerà almeno un gol. Le decisioni future saranno automatiche.'}}
 ]},
 {id:'var-misterioso',title:'VAR',text:'Un misterioso personaggio ti si avvicina.',choices:[
  {label:'Favori rischiosi',effect:'5 squadre casuali tra tutte le partecipanti vanno a 0 punti; la tua può essere sorteggiata',apply(){const names=zeroFiveTeamsIncluding(USER_ID);return names.length?`${names.join(', ')} vanno a 0 punti in classifica.`:'Nessuna squadra disponibile.'}},
  {label:'Video Assistant Referee',effect:'Aumentano drasticamente le probabilità di espulsioni per le prossime 2 partite',apply(){pushEffect('refChaos',1,2,{opponentRedChance:.75,ownRedChance:.60,source:'VAR misterioso'});return 'Per 2 partite: 75% di rosso avversario e 60% di rosso per la tua squadra.'}}
 ]},
 {id:'milan-lab',title:'Milan Lab',text:'Lo staff medico presenta un piano di recupero decisamente poco rassicurante.',choices:[
  {label:'Catena di infortuni',effect:'Per le prossime 3 partite aumenta drasticamente il rischio di infortunio',apply(){pushEffect('injuryRisk',1,3,{chance:.80,count:1,duration:2,source:'Milan Lab'});return 'Per le prossime 3 partite c’è l’80% di rischio che un giocatore subisca un infortunio di 2 giornate.'}},
  {label:'Competenza',effect:'Un giocatore casuale è fuori per tutta la stagione',apply(){const entry=randomOwnEntry(item=>!statusOf(item.playerId).seasonOut)||randomOwnEntry();return ruleOutForSeason(entry,'Milan Lab')}}
 ]},
 {id:'anvedi-goicoechea',title:'Anvedi Goicoechea',text:'Il reparto portieri entra improvvisamente in una situazione d’emergenza.',available(){return Number(state.matchday)<19},createContext(){const entry=startingGoalkeeperEntry();return entry?{goalkeeperId:String(entry.playerId),goalkeeperName:entry.player.name}:{}},describe(context){return context?.goalkeeperName?`${this.text} Il portiere coinvolto è ${context.goalkeeperName}.`:this.text},choices:[
  {label:'Che ha combinato?',effect:'Perdi il portiere per il resto della stagione',apply(context){const entry=context?.goalkeeperId?rosterEntry(context.goalkeeperId):startingGoalkeeperEntry();return ruleOutForSeason(entry,'Anvedi Goicoechea')}},
  {label:'Nonno Ballotta',effect:'Nel draft di metà stagione sei costretto a cambiare il portiere',apply(context){const entry=context?.goalkeeperId?rosterEntry(context.goalkeeperId):startingGoalkeeperEntry();if(!entry)return 'Nessun portiere disponibile.';queueMandatoryMidseasonPlayer(entry.playerId);return `${entry.player.name} dovrà essere obbligatoriamente scambiato al draft di metà stagione.`}}
 ]},
 {id:'quelli-del-fantacalcio',title:'Quelli del Fantacalcio',text:'I voti sono usciti, ma qualcuno ha deciso di cambiare le regole dei bonus.',choices:[
  {label:'I pagellisti',effect:'Nella prossima partita non ti assegnano neanche un gol',apply(){pushEffect('noGoals',1,1);return 'Nella prossima partita la tua squadra segnerà 0 gol, qualunque cosa accada.'}},
  {label:'No bonus',effect:'Per le prossime 3 partite giochi con gli OVR base, senza Intesa né altri bonus',apply(){pushEffect('baseOvrOnly',1,3);return 'Per 3 partite saranno usati solo gli OVR base. Intesa e modificatori OVR saranno ignorati.'}}
 ]},
 {id:'fantaballa-fa-video',title:'Fantaballa fa un video',text:'È arrivato il momento di scegliere il prossimo format da pubblicare.',choices:[
  {label:'Maradona ma...',effect:'Ricevi Maradona con 120 OVR al posto di un attaccante, ma i tuoi punti vanno a 0',apply(){return addMaradonaEventPlayer()}},
  {label:'Campionato italiano ma...',effect:'Da ora in poi ogni pareggio del campionato vale 6 punti per entrambe le squadre',apply(){state.seasonRules.drawPoints=6;return 'Da questo momento e fino a fine stagione ogni pareggio del campionato assegna 6 punti a entrambe le squadre.'}}
 ]},
 {id:'misterfm-fa-video',title:'MisterFM fa un video',text:'MisterFM entra nello spogliatoio con una nuova idea per rivoluzionare la rosa.',choices:[
  {label:'Rebuild della squadra',effect:'I 3 titolari con OVR più basso vengono sostituiti da 3 giocatori casuali compatibili',apply(){return rebuildWeakestStarters()}},
  {label:'Experiment',effect:'Un giocatore casuale può ricevere +20 oppure -20 OVR per tutta la stagione',apply(){return runMisterFmExperiment()}}
 ]},
 {id:'demone-durata-partite',title:'Un demone si avvicina',text:'Ti propone di cambiare per sempre la durata delle tue partite.',choices:[
  {label:'Breve ma intenso',effect:'Le tue partite durano soltanto 30 minuti',apply(){state.seasonRules.matchDuration=30;state.seasonRules.longMatchRisk=false;return 'Da ora tutte le tue partite termineranno al 30° minuto.'}},
  {label:'Lungo e godurioso',effect:'Le tue partite durano 120 minuti, ma aumentano infortuni e squalifiche',apply(){state.seasonRules.matchDuration=120;state.seasonRules.longMatchRisk=true;return 'Da ora le tue partite dureranno 120 minuti, con rischio maggiore di infortuni ed espulsioni.'}}
 ]},
 {id:'personaggio-capelli-bianchi',title:'Un personaggio dai capelli bianchi si avvicina con una bevanda in mano',text:'La bottiglia non ha etichetta, ma emette una luce decisamente sospetta.',choices:[
  {label:'Bevanda energetica',effect:'50%: tutta la rosa +10 OVR. 50%: tutta la rosa fuori fino a fine stagione',apply(){if(Math.random()<.5){const names=boostAllRosterPlayers(10);return `${names.length} giocatori ricevono +10 OVR fino a fine stagione.`}const names=ruleOutAllRosterPlayers('Bevanda energetica');unlockAchievement('era-meglio-l-acqua');return `${names.length} giocatori sono infortunati fino al termine della stagione.`}},
  {label:'Rifiuto la bevanda',effect:'L’Atalanta riceve +10 OVR ogni volta che ti affronta',apply(){return activateDeathMatchClub()}}
 ]},
 {id:'figura-aldila',title:'Una figura dall’aldilà si avvicina',text:'Pronuncia poche parole e pretende una rivoluzione tattica.',available(){return Number(state.matchday)<19},choices:[
  {label:'ATAKARE',effect:'Solo la tua squadra cambia modulo e gioca con un 2-4-4',apply(){return forceUserFormation('2-4-4')}},
  {label:'Mi consenta',effect:'Al draft di metà stagione devi scambiare un difensore centrale; il pack successivo avrà un top player',apply(){return activateMandatoryDcTopSwap()}}
 ]},
 {id:'fgci-regolamento-rossi-punti',title:'FGCI',text:'La federazione presenta un nuovo regolamento con effetto immediato.',choices:[
  {label:'Ogni rosso è un gol',effect:'Ogni cartellino rosso ricevuto equivale a un gol a favore fino a fine stagione',apply(){state.seasonRules.redCardGoals=true;return 'Da ora ogni squadra che riceve un rosso ottiene anche un gol a favore.'}},
  {label:'I punti sono i gol',effect:'I punti guadagnati in classifica corrispondono ai gol segnati',apply(){state.seasonRules.pointsEqualGoals=true;return 'Da ora ogni squadra ottiene in classifica tanti punti quanti sono i gol segnati nella partita.'}}
 ]},
 {id:'mago-do-nascimento',title:'Mago do Nascimento',text:'Il mago assicura che ogni problema fisico può diventare un vantaggio.',choices:[
  {label:'Magia wodu',effect:'Finché un tuo giocatore è infortunato riceve +40 OVR',apply(){state.seasonRules.injuredOvrBonus=40;return 'Da ora ogni giocatore infortunato schierato riceve +40 OVR finché resta infortunato.'}},
  {label:'Magia nera',effect:'Un giocatore casuale riceve +20 OVR fino a fine stagione',apply(){return permanentRandomPlayerBoost(20,'Magia nera')}}
 ]},
 {id:'fgci-regolamento-gol-tardivi',title:'FGCI',text:'La federazione cambia nuovamente il regolamento del campionato.',choices:[
  {label:'Dal 80’ i gol valgono doppio',effect:'Ogni gol segnato dall’80° in poi vale due reti fino a fine stagione',apply(){state.seasonRules.lateGoalsDouble=true;return 'Da ora i gol segnati dall’80° minuto in poi valgono doppio per tutte le squadre.'}},
  {label:'Zero a zero, zero punti',effect:'Se una partita finisce 0-0 nessuna squadra ottiene punti',apply(){state.seasonRules.zeroZeroNoPoints=true;return 'Da ora ogni 0-0 assegna 0 punti a entrambe le squadre.'}}
 ]},
 {id:'underdog',title:'Underdog',text:'Il destino mette alla prova il rapporto tra favoriti e giocatori dimenticati.',choices:[
  {label:'I primi saranno gli ultimi',effect:'Un giocatore con OVR base tra 60 e 70 diventa forte quanto il tuo giocatore con l’OVR base più alto fino a fine stagione',apply(){return empowerUnderdog()}},
  {label:'Favoriti',effect:'La prossima partita è vinta automaticamente per 6-0',apply(){return guaranteeSixNil()}}
 ]},
 {id:'sessanta-sfumature',title:'60 sfumature di ca***',text:'Il numero 60 assume improvvisamente un significato molto pericoloso.',choices:[
  {label:'Un piccolo sacrificio',effect:'Un giocatore con OVR base tra 60 e 65 raddoppia la forza per tutta la stagione, ma perdi il tuo miglior giocatore',apply(){return sixtyShadesSacrifice()}},
  {label:'60 la paura',effect:'Se raggiungi esattamente 60 punti in classifica, perdi tutti i punti',apply(){return activateSixtyPointFear()}}
 ]},
 {id:'omonimo-allenatore',get title(){return `Ti si avvicina un tipo di nome ${String(state.coachName||'misterioso')}`},text:'Il tipo sostiene che condividere un nome crei un legame tattico inspiegabile.',available(){return Boolean(String(state.coachName||'').trim())},choices:[
  {label:'Ehi ma ti chiami come me',effect:'Se hai un giocatore con lo stesso nome dell’allenatore, la sua Intesa viene moltiplicata ×2 fino a fine stagione',apply(){return doubleCoachNamesakeChemistry()}},
  {label:'Che nome del ca***',effect:'L’Intesa di tutta la squadra viene moltiplicata ×2 per le prossime 2 partite',apply(){return doubleTeamChemistryTwoMatches()}}
 ]},
 {id:'figura-misteriosa-tattico-fantaguru',title:'Ti si avvicina una figura misteriosa',text:'La figura sostiene di poter sistemare la formazione oppure prevedere ogni affare del mercato.',available(){return Number(state.matchday)<19},choices:[
  {label:'Il tattico',effect:'Sistema la formazione mettendo in campo i panchinari più forti dei titolari e la aggiorna automaticamente fino a fine stagione',apply(){return activatePersistentTactician()}},
  {label:'Il fantaguru',effect:'Nel draft di metà stagione avrai sempre almeno una scelta migliore del giocatore che stai offrendo',apply(){return activateFantaguru()}}
 ]},
 {id:'figlio-del-mister',title:'Il figlio del mister',text:'In rosa c’è un giocatore con lo stesso nome dell’allenatore.',available(){return Number(state.matchday)<19&&Boolean(coachNamedRosterEntry())},choices:[
  {label:'Talento di famiglia',effect:'Il giocatore con il tuo stesso nome riceve +10 OVR fino a fine stagione',apply(){return boostCoachNamedPlayer()}},
  {label:'Scambio assicurato',effect:'Al draft puoi scambiarlo con un top player garantito del suo ruolo',apply(){return activateCoachTopSwap()}}
 ]},
 {id:'personaggio-mantello-multiverso',title:'Un personaggio misterioso col mantello ti si avvicina',text:'Apre due portali verso campionati paralleli e ti offre un nuovo giocatore.',choices:[
  {label:'Multiverso',effect:'Un giocatore casuale del Campionato del Ca*** sostituisce il tuo giocatore con OVR più basso',apply(){return multiverseClassic()}},
  {label:'Multiverso2',effect:'Un giocatore casuale del Fantacampionato del Ca*** sostituisce il tuo giocatore con OVR più basso',apply(){return multiverseReal()}}
 ]},
 {id:'personaggio-misterioso-sosia',title:'Un personaggio misterioso che ti assomiglia ti si avvicina',text:'Dice di conoscere ogni versione possibile della tua carriera da allenatore.',choices:[
  {label:'Il te stesso',effect:'Un giocatore con lo stesso nome dell’allenatore viene cercato prima nel database attivo e poi nell’altro campionato, quindi arriva al posto del giocatore più scarso',apply(){return bringCoachNamesake()}},
  {label:'Benvenuto nel mondo del domani!',effect:'Un tuo giocatore segna sempre un gol, ma ogni nuovo infortunio azzera i tuoi punti',apply(){return activateFutureScorer()}}
 ]},
 {id:'personaggio-corona-spine',title:'Si avvicina un misterioso personaggio con una corona di spine',text:'Il personaggio propone di rovesciare ogni gerarchia oppure di moltiplicare gli imprevisti della stagione.',choices:[
  {label:'Gli ultimi saranno i primi',effect:'La classifica si capovolge: il primo prende i punti dell’ultimo, il secondo quelli del penultimo e così via',apply(){return reverseStandingsPoints()}},
  {label:'La moltiplicazione',effect:'La probabilità di apparizione di un evento raddoppia fino a fine stagione',apply(){return doubleEventAppearanceRate()}}
 ]},
 {id:'fgci-regole-estreme',title:'Nuova regola FGCI',text:'La federazione propone due riforme estreme con effetto immediato.',choices:[
  {label:'Maratona',effect:'Il campionato dura il doppio rispetto al numero attuale di squadre; vittorie da 1,5 punti e pareggi da 0',apply(){return extendSeasonTo76()}},
  {label:'Hunger Games',effect:'Chi perde viene eliminato fino a fine stagione e scompare dalla classifica',apply(){return activateHungerGames()}}
 ]},
 {id:'fgci-formazioni-estreme',title:'Nuova regola FGCI',text:'La federazione cambia il numero di calciatori ammessi contemporaneamente in campo.',choices:[
  {label:'4-4-4',effect:'Ora in campo vanno 14 giocatori, con 0 panchinari',apply(){return forceSeasonFormation('4-4-4')}},
  {label:'3-3-3',effect:'Ora in campo vanno 9 giocatori, con 5 panchinari',apply(){return forceSeasonFormation('3-3-3')}}
 ]},
 {id:'generale-misterioso',title:'Si avvicina un generale misterioso',text:'Il generale vuole rivoluzionare la composizione della rosa e i rapporti tra i giocatori.',available(){return Number(state.matchday)<seasonLength()-6},choices:[
  {label:'Rimmigrazione!',effect:'Tutti i giocatori non italiani vengono scambiati con giocatori italiani compatibili; se necessario si pesca anche dall’altro campionato. Il generale ha il 50% di probabilità di tornare per il controllo dei documenti',apply(){return replaceNonItalianWithItalians()}},
  {label:'Chiusi i porti',effect:'0 Intesa per tutti i giocatori non italiani fino a fine stagione',apply(){return activateClosedPorts()}}
 ]},
 {id:'generale-documenti',chainOnly:true,title:'Controllo dei documenti',text:'Dopo alcune giornate il generale torna a controllare la rosa.',choices:[
  {label:'Collabori',effect:'Tutti gli italiani ricevono +3 Intesa fino a fine stagione',apply(){return collaborateWithGeneral()}},
  {label:'Nascondi un giocatore straniero',effect:'Recuperi il più forte tra gli stranieri sostituiti; 50% di rischio di essere scoperto e perdere 3 punti',apply(){return hideForeignPlayerFromGeneral()}},
  {label:'Cacci il generale',effect:'Recuperi la rosa originale, ma l’Intesa viene dimezzata fino a fine stagione',apply(){return dismissGeneral()}}
 ]},
 {id:'figc-regola-gol',title:'Nuova regola FIGC',text:'La federazione vuole rivoluzionare il modo in cui viene deciso il vincitore delle partite.',available(){return !state.seasonRules.federationGoalRule},choices:[
  {label:'Golden goal',effect:'Il primo che segna vince la partita. La regola resta attiva fino a fine stagione.',apply(){return activateFederationGoalRule('golden')}},
  {label:'Chi segna questo vince',effect:'Chi segna per ultimo vince la partita. La regola resta attiva fino a fine stagione.',apply(){return activateFederationGoalRule('last')}}
 ]},
 {id:'space-jam',userOnly:true,title:'Space Jam',text:'La partita sta per diventare molto meno normale.',available(){return !state.seasonRules.spaceJamRule&&!state.seasonRules.spaceJamTalentPending},choices:[
  {label:'Che succede amico?',effect:'Nella prossima partita, se vinci rubi il miglior giocatore degli avversari e lo inserisci al posto del tuo peggior giocatore compatibile con il suo ruolo. Se perdi, perdi il tuo miglior giocatore.',apply(){return activateSpaceJamTalentChallenge()}},
  {label:'Bib Bip!',effect:'Fino a fine stagione ogni partita inizia da un minuto casuale tra 0 e la durata prevista: 30, 90 o 120 minuti in base agli altri regolamenti.',apply(){return activateSpaceJamRandomKickoff()}}
 ]},
 {id:'misterioso-francese',userOnly:true,title:'Un misterioso francese si gira e ti si avvicina',text:'Con uno sguardo enigmatico ti propone due idee capaci di stravolgere la squadra.',available(){return !state.seasonRules.frenchEventChoice},choices:[
  {label:'Portiere volante',effect:'Il portiere titolare viene messo in attacco e un attaccante titolare viene messo in porta. Entrambi ottengono +10 OVR.',apply(){return activateFrenchFlyingGoalkeeper()}},
  {label:'Si è girato',effect:'Fino a fine stagione, per ogni gol segnato dopo l’80° minuto, l’attaccante autore del gol riceve +5 OVR permanente.',apply(){return activateFrenchLateTurn()}}
 ]},
 {id:'figc-formula-uno-niente-pareggio',title:'Nuovo regolamento FIGC',text:'La federazione presenta due nuovi modi di assegnare vittorie e punti, con effetto immediato fino a fine stagione.',available(){return !state.seasonRules.figcCompetitionRule&&!state.seasonRules.fgicLeagueRule},choices:[
  {label:'Formato Formula 1',effect:'Ogni giornata le squadre vengono ordinate per qualità del risultato: 25, 18, 15, 12, 10, 8, 6, 4, 2 e 1 punto alle prime 10. Con anche un solo infortunato, la partita successiva è persa 0-3 a tavolino. Espulsioni e squalifiche non fanno perdere a tavolino.',apply(){return activateFigcCompetitionRule('formula-one')}},
  {label:'Niente pareggio',effect:'Ogni partita pari continua con i tempi supplementari e, se resta in parità, con i calci di rigore.',apply(){return activateFigcCompetitionRule('no-draw')}}
 ]},
 {id:'fgic-playoff-aiuto-fondo',title:'Nuova regola FGIC',text:'La federazione propone una nuova struttura per il titolo e un aiuto speciale alle squadre in difficoltà.',available(){return !state.seasonRules.fgicLeagueRule&&!state.seasonRules.figcCompetitionRule},choices:[
  {label:'Play off',effect:'A fine campionato le prime 8 disputano i play off scudetto a eliminazione diretta, in partita secca. La squadra meglio classificata gioca in casa.',apply(){return activateFgicLeagueRule('playoffs')}},
  {label:'Aiuto dal fondo',effect:'Prima di ogni giornata, le squadre dal 10° posto in giù ricevono 4 punti per vittoria, 2 per pareggio e 1 per sconfitta.',apply(){return activateFgicLeagueRule('bottom-help')}}
 ]},
 {id:'figura-pelata-misteriosa',title:'Una figura pelata misteriosa ti si avvicina',text:'Con aria solenne propone di cambiare immediatamente il numero delle squadre che partecipano al campionato.',available(){return !state.seasonRules.dynamicLeague},choices:[
  {label:'Campionato allargato',effect:'Entrano altre 20 squadre casuali prese dall’altra modalità. Ognuna parte con punti casuali, fino al punteggio attuale della capolista.',apply(){return activateExpandedLeague()}},
  {label:'Campionato élite',effect:'Le ultime 10 vengono rimosse: da questo momento partecipano soltanto le prime 10.',apply(){return activateEliteLeague()}}
 ]},
 {id:'fgci-risultati-estremi',title:'Nuova regola FGCI',text:'La federazione cambia il valore degli 0-0 e delle sconfitte per tutte le squadre fino a fine stagione.',available(){return !state.seasonRules.fgciResultRule},choices:[
  {label:'Vince la noia',effect:'Ogni 0-0 assegna 7 punti a entrambe le squadre.',apply(){return activateFgciResultRule('boredom-wins')}},
  {label:'Tutto per tutto',effect:'Ogni sconfitta vale -3 punti per la squadra sconfitta.',apply(){return activateFgciResultRule('all-in')}}
 ]},
 {id:'nuovo-video-fantaballa',title:'Esce un nuovo video di Fantaballa',text:'Il nuovo video ispira una regola assurda che cambia tutte le partite del campionato fino a fine stagione.',available(){return !state.seasonRules.fantaballaVideoRule},choices:[
  {label:'Chi vince perde!',effect:'3 punti per chi perde, 1 punto per il pareggio e 0 punti per chi vince.',apply(){return activateFantaballaVideoRule('reverse-points')}},
  {label:'Segna o non vinci',effect:'Devi segnare almeno 2 gol per vincere la partita; altrimenti il risultato diventa un pareggio.',apply(){return activateFantaballaVideoRule('two-goals-to-win')}}
 ]},
 {id:'italia-pizza-catenaccio',userOnly:true,title:'Italia, pizza e catenaccio',text:'Due filosofie difensive possono cambiare il resto della tua stagione.',available(){return !state.seasonRules.italiaCatenaccioRule},choices:[
  {label:'Allegri insegna',effect:'Fino a fine stagione puoi segnare al massimo un gol per partita.',apply(){return activateItaliaCatenaccioRule('allegri')}},
  {label:'Il gol? Che schifo!',effect:'Fino a fine stagione, ogni volta che segni più di 3 gol perdi 6 punti in classifica.',apply(){return activateItaliaCatenaccioRule('goal-disgust')}}
 ]},
 {id:'fgci-punti-gol',title:'Nuova regola FGCI',text:'La federazione introduce una nuova regola di classifica che colpisce tutte le squadre fino a fine stagione.',available(){return !state.seasonRules.fgciPointsRule},choices:[
  {label:'Gol pesanti',effect:'Ogni gol subito vale -1 punto in classifica per tutte le squadre.',apply(){return activateFgciPointsRule('heavy-goals')}},
  {label:'Porta inviolata',effect:'Ogni squadra che non subisce gol ottiene +1 punto in classifica.',apply(){return activateFgciPointsRule('clean-sheet')}}
 ]},
 {id:'curva-contestazione',userOnly:true,title:'La curva sta contestando',describe(){const mister=String(state.coachName||'Mister').trim()||'Mister';return `${mister}, devi vendere! Vattene, vattene!`},available(){return curvaContestCanAppear()},choices:[
  {label:'Puntiamo allora allo scudetto',effect:'Entro 5 giornate devi essere tra le prime 2. Durante la sfida giochi normalmente. Se riesci, tutte le partite successive saranno trattate come gare in casa fino a fine stagione. Se fallisci, perdi la squadra e passi a una squadra casuale del campionato.',apply(){return activateCurvaTitleChallenge()}},
  {label:'Non ascoltarli',effect:'Ogni partita di campionato è trattata come una gara in trasferta fino a fine stagione.',apply(){return activateCurvaAwayPenalty()}}
 ]},
 {id:'punti-pari-dispari',title:'Punti pari o dispari',text:'Una nuova regola straordinaria colpirà la classifica soltanto dopo la prossima giornata.',available(){return Number(state.matchday)>0&&Number(state.matchday)<seasonLength()},choices:[
  {label:'Pari',effect:'Dopo la prossima giornata, le squadre con punti pari verranno portate a 0. Fino ad allora la classifica resta invariata.',apply(){return scheduleStandingsResetByParity('even')}},
  {label:'Dispari',effect:'Dopo la prossima giornata, le squadre con punti dispari verranno portate a 0. Fino ad allora la classifica resta invariata.',apply(){return scheduleStandingsResetByParity('odd')}}
 ]},
 {id:'fgci-cartellini-estremi',title:'Nuova regola FGCI',text:'La federazione introduce due cartellini capaci di cambiare completamente le partite.',choices:[
  {label:'Giallo=Rosso',effect:'Il cartellino giallo porta direttamente all’espulsione',apply(){return activateYellowEqualsRed()}},
  {label:'Cartellino Rosa',effect:'Quando compare, la partita finisce all’istante e resta valido il risultato maturato',apply(){return activatePinkCardRule()}}
 ]}
].filter(decision=>!EXCLUDED_DECISION_IDS.has(String(decision?.id||'')));
function decisionFromPending(event){
 if(!event)return null;
 return DECISIONS.find(decision=>decision.id===event.decisionId)||DECISIONS[event.decisionIndex]||null;
}
function applyDecisionChoice(decisionIndex,choiceIndex,context={},decisionId=''){
 const decision=DECISIONS.find(item=>item.id===decisionId)||DECISIONS[decisionIndex];
 const choice=decision?.choices?.[choiceIndex];
 if(!choice)return 'Scelta non disponibile.';
 const detail=choice.apply(context||{});
 if(String(decision?.id||'')==='generale-misterioso'){
  setAchievementCareerFlag('generalEventMatchday',Number(state.matchday)||0);
  setAchievementCareerFlag('generalWinStreak',0);
 }
 return `Scelta: ${choice.label}. ${detail||choice.effect}`;
}
function prepareEvent(){
 if(state.phase!=='season'||state.pendingEvent)return;
 if(prepareError404StoryEvent()||prepareFantaballopoliStoryEvent()||prepareMeritStoryEvent()){save();return}
 questState().notice='';
 if(chaosEnabled())prepareChaosOpponentEvents();
 if(prepareChainedEvent()){save();return;}
 const multiplier=clamp((Number(state.seasonRules.eventChanceMultiplier)||1)*coachEventChanceFactor(),.25,2),normalChance=Math.max(0,1-(.45*multiplier)),autoLimit=normalChance+(.10*multiplier),roll=Math.random();
 if(roll<normalChance){
   state.pendingEvent={kind:'none',resolved:true,title:'Settimana normale',text:'Nessun evento particolare. La squadra pensa solo alla partita.'};
 }else if(roll<autoLimit){
   const event=pick(AUTO_EVENTS),before=analyticsSnapshot();
   const result=event.apply();
   recordSeasonEvent({kind:'auto',title:event.title,choice:'Evento automatico',effect:event.text,result,automatic:true},before);
   state.pendingEvent={kind:'auto',resolved:true,title:event.title,text:event.text,result};
 }else{
   const seen=new Set((state.seenDecisionEvents||[]).map(String));
   const available=DECISIONS.map((decision,index)=>({decision,index})).filter(item=>!item.decision.chainOnly&&!seen.has(item.decision.id)&&(!item.decision.available||item.decision.available()));
   if(!available.length){
     state.pendingEvent={kind:'none',resolved:true,title:'Settimana normale',text:'Gli imprevisti disponibili sono già comparsi: la squadra pensa solo alla partita.'};
   }else{
     const selected=pick(available),decision=selected.decision,decisionIndex=selected.index;
     const context=decision.createContext?decision.createContext():{};
     const eventTitle=typeof decision.title==='function'?decision.title(context):decision.title;
     const eventText=decision.describe?decision.describe(context):decision.text;
     state.seenDecisionEvents=[...seen,decision.id];
     if(state.seasonRules.autoDecisions){
       const choiceIndex=Math.floor(Math.random()*decision.choices.length),choice=decision.choices[choiceIndex],before=analyticsSnapshot();
       const result=applyDecisionChoice(decisionIndex,choiceIndex,context,decision.id);
       recordSeasonEvent({kind:'decision',title:eventTitle,choice:choice?.label||'',effect:choice?.effect||'',result,automatic:true},before);
       state.pendingEvent={kind:'decision',resolved:true,title:eventTitle,text:eventText,decisionId:decision.id,decisionIndex,context,result:`Decisione automatica. ${result}`};
     }else{
       state.pendingEvent={kind:'decision',resolved:false,title:eventTitle,text:eventText,decisionId:decision.id,decisionIndex,context};
     }
   }
 }
 save();
}
function resolveDecision(i){
 if(!state.pendingEvent||state.pendingEvent.resolved)return;
 const pendingDecision=decisionFromPending(state.pendingEvent);
 if(pendingDecision&&!state.seenDecisionEvents.includes(pendingDecision.id))state.seenDecisionEvents.push(pendingDecision.id);
 const choice=pendingDecision?.choices?.[i],before=analyticsSnapshot();
 state.pendingEvent.result=applyDecisionChoice(state.pendingEvent.decisionIndex,i,state.pendingEvent.context||{},state.pendingEvent.decisionId||'');
 recordSeasonEvent({kind:'decision',title:state.pendingEvent.title||pendingDecision?.title||'Decisione',choice:choice?.label||'',effect:choice?.effect||'',result:state.pendingEvent.result,automatic:false},before);
 state.pendingEvent.resolved=true;
 seasonEventMinimized=false;seasonEventUiKey='';
 save();
 render();
}
function setSeasonEventMinimized(minimized,{focus=true}={}){
 seasonEventMinimized=Boolean(minimized);
 const overlay=document.querySelector('.season-event-overlay'),dock=document.querySelector('.season-event-dock');
 if(overlay){
   overlay.hidden=seasonEventMinimized;
   overlay.classList.toggle('is-event-hidden',seasonEventMinimized);
   overlay.setAttribute('aria-hidden',seasonEventMinimized?'true':'false');
   overlay.style.setProperty('display',seasonEventMinimized?'none':'grid','important');
 }
 if(dock){
   dock.hidden=!seasonEventMinimized;
   dock.classList.toggle('is-event-hidden',!seasonEventMinimized);
   dock.classList.toggle('is-event-visible',seasonEventMinimized);
   dock.setAttribute('aria-hidden',seasonEventMinimized?'false':'true');
   dock.style.setProperty('display',seasonEventMinimized?'block':'none','important');
 }
 if(!focus)return;
 const target=seasonEventMinimized?dock?.querySelector('[data-event-expand]'):overlay?.querySelector('[data-event-minimize]');
 try{target?.focus({preventScroll:true})}catch{target?.focus()}
}
function bindSeasonEventControls(){
 const minimize=document.querySelector('[data-event-minimize]'),expand=document.querySelector('[data-event-expand]');
 if(minimize)minimize.onclick=event=>{
   event.preventDefault();
   event.stopPropagation();
   setSeasonEventMinimized(true);
 };
 if(expand)expand.onclick=event=>{
   event.preventDefault();
   event.stopPropagation();
   setSeasonEventMinimized(false);
 };
 /* Allinea sempre DOM e variabile, anche sui browser che ignorano [hidden]. */
 setSeasonEventMinimized(seasonEventMinimized,{focus:false});
}
function renderEvent(){
 const e=state.pendingEvent;
 if(!e)return'';
 if(e.kind==='storyError404'&&!e.resolved)return renderError404StoryEvent(e);
 if(e.kind==='storyError404')return `<div class="event-card"><div class="label">Storia</div><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></div>`;
 if(e.kind==='storyFantaballopoli'&&!e.resolved)return renderFantaballopoliEvent(e);
 if(e.kind==='storyFantaballopoli')return `<div class="event-card"><div class="label">Storia</div><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p>${e.result?`<b>${esc(e.result)}</b>`:''}</div>`;
 if(e.kind==='storyMerit'&&!e.resolved)return renderMeritStoryEvent(e);
 if(e.kind==='storyMerit')return `<div class="event-card"><div class="label">Storia</div><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p>${e.result?`<b>${esc(e.result)}</b>`:''}</div>`;
 if(e.kind==='decision'&&!e.resolved){
   const d=decisionFromPending(e);
   if(!d)return'';
   const eventLabel=d.questEvent?'Evento quest':(e.chained?'Evento concatenato':'Decisione casuale · evento unico');
   const eventKey=JSON.stringify([e.decisionId||'',e.decisionIndex??'',e.title||'',e.text||'',state.matchday,e.chained||false,e.context||{}]);
   if(seasonEventUiKey!==eventKey){seasonEventUiKey=eventKey;seasonEventMinimized=false}
   const choices=d.choices.map((c,i)=>`<div class="season-event-choice-float"><button class="choice season-event-choice ${i%2===0?'tone-blue':'tone-red'}" data-choice="${i}" type="button"><span class="season-event-option-label">Opzione ${String.fromCharCode(65+i)}</span><b>${esc(c.label)}</b><small>${esc(c.effect)}</small></button></div>`).join('');
   return `<div class="season-event-overlay" role="presentation" ${seasonEventMinimized?'hidden':''}><section class="season-event-dialog" role="dialog" aria-modal="true" aria-labelledby="seasonEventTitle" aria-describedby="seasonEventCopy"><button class="season-event-minimize" data-event-minimize type="button" aria-label="Riduci l’evento e consulta la pagina">━ Riduci</button><div class="season-event-head"><div class="season-event-kicker">${esc(eventLabel)}</div><h2 class="season-event-title" id="seasonEventTitle">${esc(e.title)}</h2><p class="season-event-copy" id="seasonEventCopy">${esc(e.text)}</p></div><div class="choice-grid season-event-choice-grid">${choices}</div><p class="season-event-hint">Riduci il box per consultare Rosa, Classifica, Calendario e Statistiche; potrai riaprirlo in qualsiasi momento.</p></section></div><aside class="season-event-dock" ${seasonEventMinimized?'':'hidden'} aria-label="Evento in attesa di una decisione"><button class="season-event-dock-button" data-event-expand type="button"><span class="season-event-dock-pulse" aria-hidden="true"></span><span class="season-event-dock-copy"><span>Evento in attesa</span><b>${esc(e.title)}</b></span><span class="season-event-dock-open">Riapri ↑</span></button></aside>`;
 }
 const notice=questState().notice;
 return `<div class="event-card"><div class="label">${e.chained?'Evento concatenato':(e.kind==='auto'?'Evento casuale':'Settimana')}</div><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p>${e.result?`<b>${esc(e.result)}</b>`:''}${notice?`<div class="quest-notice">${esc(notice)}</div>`:''}</div>`
}
