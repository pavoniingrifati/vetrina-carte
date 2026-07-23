(() => {
  'use strict';

  const STORAGE_KEY = 'fantaballa_achievements_v1';
  const VERSION = 1;

  const definitions = [
    { id:'buona-la-prima', category:'Immediati', icon:'🎬', title:'Buona la prima', description:'Vinci la prima partita della carriera.' },
    { id:'cappotto', category:'Immediati', icon:'🧥', title:'Cappotto', description:'Vinci con almeno 5 gol di scarto.' },
    { id:'remuntada', category:'Immediati', icon:'🔥', title:'Remuntada', description:'Vinci dopo essere stato sotto di almeno 2 gol.' },
    { id:'clin-shit', category:'Immediati', icon:'🧤', title:'Clin shit', description:'Vinci una partita senza subire gol.' },

    { id:'partita-pazza', category:'Immediati', icon:'🤯', title:'Partita pazza', description:'Vinci una partita con almeno 8 gol complessivi.' },
    { id:'corto-muso', category:'Immediati', icon:'🐴', title:'Corto muso', description:'Vinci una partita per 1-0.' },
    { id:'difesa-allegra', category:'Immediati', icon:'🎪', title:'Difesa allegra', description:'Vinci una partita subendo almeno 4 gol.' },
    { id:'pareggio-spettacolo', category:'Immediati', icon:'🎆', title:'Pareggio spettacolo', description:'Pareggia una partita con almeno 3 gol per squadra.' },
    { id:'celtic-vs-barcelona', category:'Immediati', icon:'🍀', title:'Celtic vs Barcelona', description:'Batti una squadra con OVR partita superiore di almeno 15 punti.' },
    { id:'lha-ripresa-vecino', category:'Immediati', icon:'⏱️', title:'L’ha ripresa Vecino', description:'Segna il gol decisivo negli ultimi minuti disponibili della simulazione.' },
    { id:'ma-e-del-mestiere', category:'Immediati', icon:'🧭', title:'Ma è del mestiere?', description:'Vinci con almeno un giocatore schierato fuori ruolo.' },
    { id:'senza-portiere', category:'Immediati', icon:'🥅', title:'Senza portiere', description:'Vinci usando un portiere Primavera o un giocatore fuori ruolo in porta.' },
    { id:'centenario', category:'Immediati', icon:'💯', title:'Centenario', description:'Porta un giocatore ad almeno 100 OVR totale.' },
    { id:'esagerato', category:'Immediati', icon:'🚀', title:'Esagerato', description:'Vinci con almeno 7 gol di scarto.' },
    { id:'zona-cesarini', category:'Immediati', icon:'⌛', title:'Zona Cesarini', description:'Pareggia una partita segnando negli ultimi 10 minuti.' },
    { id:'uno-in-meno-uno-in-piu', category:'Immediati', icon:'🟥', title:'Uno in meno, uno in più', description:'Vinci nonostante un’espulsione a sfavore.' },
    { id:'davide-estremo', category:'Immediati', icon:'🪨', title:'Davide estremo', description:'Batti una squadra con OVR partita superiore di almeno 25 punti.' },
    { id:'vendetta-perfetta', category:'Immediati', icon:'🔁', title:'Vendetta perfetta', description:'Batti la squadra che controllavi prima di cambiare panchina.' },
    { id:'il-pallone-e-mio', category:'Immediati', icon:'⚽', title:'Il pallone è mio', description:'Un giocatore segna almeno 3 gol nella stessa partita.' },
    { id:'manita-personale', category:'Immediati', icon:'🖐️', title:'Manita personale', description:'Un giocatore segna 5 gol nella stessa partita.' },
    { id:'cooperativa-del-gol', category:'Immediati', icon:'🤝', title:'Cooperativa del gol', description:'Vinci con almeno 3 marcatori differenti.' },
    { id:'portiere-goleador', category:'Immediati', icon:'🧤', title:'Portiere goleador', description:'Un portiere segna un gol.' },
    { id:'galacticos', category:'Immediati', icon:'🌟', title:'Galácticos', description:'Vinci con tutti gli undici titolari ad almeno 90 OVR totale.' },

    { id:'capitano-mio-capitano', category:'Oggetti', icon:'©', title:'Capitano, mio capitano', description:'Fai indossare la Fascia del capitano a un giocatore per la prima volta.' },
    { id:'utilizza-fischietto-collina', category:'Oggetti', icon:'◉', title:'Utilizza il Fischietto di Collina', description:'Usa il Fischietto di Collina per saltare un evento.' },
    { id:'annulla-un-gol-avversario', category:'Allenatori', icon:'🕵️', title:'Annulla un gol avversario', description:'Annulla con successo un gol avversario usando Rokky.' },

    { id:'campeones', category:'Stagionali', icon:'🏆', title:'Campeones', description:'Vinci il campionato.' },
    { id:'double', category:'Stagionali', icon:'👑', title:'Double', description:'Vinci campionato e coppa nella stessa stagione.' },
    { id:'chi-perde-vince', category:'Stagionali', icon:'🔄', title:'Chi perde...vince!', description:'Vinci il campionato facendo più sconfitte che vittorie.' },
    { id:'zero-vittorie-un-titolo', category:'Stagionali', icon:'0️⃣', title:'0 vittorie, 1 titolo', description:'Vinci il campionato con 0 vittorie.' },
    { id:'coppa-di-consolazione', category:'Stagionali', icon:'🥈', title:'Coppa di consolazione', description:'Vinci la coppa ma non il campionato.' },
    { id:'invincibili', category:'Stagionali', icon:'🛡️', title:'Invincibili', description:'Termina una stagione senza sconfitte.' },
    { id:'attacco-atomico', category:'Stagionali', icon:'☢️', title:'Attacco atomico', description:'Segna almeno 100 gol in una stagione.' },
    { id:'fotofinish', category:'Stagionali', icon:'📸', title:'Fotofinish', description:'Vinci il titolo con un punto o meno di vantaggio.' },
    { id:'dominio-totale', category:'Stagionali', icon:'👊', title:'Dominio totale', description:'Vinci il campionato con almeno 10 punti di vantaggio.' },
    { id:'campione-imbattuto', category:'Stagionali', icon:'🏅', title:'Campione imbattuto', description:'Vinci il campionato senza sconfitte.' },
    { id:'miglior-attacco', category:'Stagionali', icon:'⚽', title:'Miglior attacco', description:'Concludi la stagione con più gol segnati di tutti.' },
    { id:'miglior-difesa', category:'Stagionali', icon:'🧱', title:'Miglior difesa', description:'Concludi la stagione con meno gol subiti di tutti.' },
    { id:'rullo-compressore', category:'Stagionali', icon:'🚜', title:'Rullo compressore', description:'Vinci almeno 10 partite consecutive.' },
    { id:'ultimo-respiro', category:'Stagionali', icon:'🌬️', title:'Ultimo respiro', description:'Vinci il campionato superando la capolista nell’ultima giornata.' },
    { id:'campionato-perfetto', category:'Stagionali', icon:'💎', title:'Campionato perfetto', description:'Vinci tutte le partite della stagione.' },
    { id:'quota-cento', category:'Stagionali', icon:'💯', title:'Quota cento', description:'Termina il campionato con almeno 100 punti.' },
    { id:'attacco-atomico-ii', category:'Stagionali', icon:'☄️', title:'Attacco atomico II', description:'Segna almeno 150 gol in una stagione.' },
    { id:'difesa-acciaio', category:'Stagionali', icon:'🔩', title:'Difesa d’acciaio', description:'Subisci meno di 20 gol in una stagione.' },
    { id:'campione-al-minimo', category:'Stagionali', icon:'🪙', title:'Campione al minimo', description:'Vinci il campionato con al massimo 50 punti.' },
    { id:'attacco-col-contagocce', category:'Stagionali', icon:'💧', title:'Attacco col contagocce', description:'Vinci il campionato segnando al massimo 38 gol.' },

    { id:'giovani-promesse', category:'Allenatori', icon:'✨', title:'Giovani promesse', description:'Vinci il campionato con “Giovani e belli”.' },
    { id:'fuori-dagli-schemi', category:'Allenatori', icon:'🔀', title:'Fuori dagli schemi', description:'Segna 10 gol con giocatori schierati fuori ruolo usando “Duttilità”.', target:10 },
    { id:'zero-intesa', category:'Allenatori', icon:'💠', title:'Zero intesa, massimo risultato', description:'Vinci una partita con Duttilità e Intesa totale pari a zero.' },
    { id:'il-generale', category:'Allenatori', icon:'🇮🇹', title:'Il generale', description:'Completa una stagione usando solamente giocatori italiani.' },
    { id:'fascia-verde', category:'Allenatori', icon:'🟢', title:'Fascia verde', description:'Vinci il campionato con “Giovani e belli” usando soltanto giocatori con OVR base inferiore a 76.' },
    { id:'fuori-ruolo-fuori-controllo', category:'Allenatori', icon:'📈', title:'Fuori ruolo, fuori controllo', description:'Porta un giocatore a +5 OVR grazie ai gol segnati fuori ruolo con “Duttilità”.' },
    { id:'tutti-possono-tutto', category:'Allenatori', icon:'🔄', title:'Tutti possono tutto', description:'Vinci una partita con “Duttilità” schierando almeno undici giocatori fuori ruolo.' },
    { id:'nessuno-indispensabile', category:'Allenatori', icon:'🧳', title:'Nessuno è indispensabile', description:'Vinci il campionato dopo aver cambiato almeno metà della rosa iniziale.' },
    { id:'sergente-di-ferro', category:'Allenatori', icon:'🪖', title:'Il sergente di ferro', description:'Vinci cinque partite consecutive dopo l’evento del generale.' },
    { id:'talento-grezzo', category:'Allenatori', icon:'🌱', title:'Talento grezzo', description:'Vinci una partita con “Giovani e belli” schierando almeno tre titolari con OVR base tra 60 e 69.' },

    { id:'qualita-ballarini', category:'Sponsor', icon:'🍳', title:'Qualità Ballarini', description:'Porta un giocatore ad almeno 100 OVR grazie al bonus dello sponsor Padelle Ballarini.' },
    { id:'non-si-attacca-niente', category:'Sponsor', icon:'🥚', title:'Non si attacca niente', description:'Ricevi almeno 5 potenziamenti OVR durante una stagione con Padelle Ballarini.' },
    { id:'database-umano', category:'Sponsor', icon:'🧠', title:'Database umano', description:'Vinci 10 partite con la formazione scelta automaticamente dal Tattico di Football Manager.' },
    { id:'infermeria-vuota', category:'Sponsor', icon:'🏥', title:'Infermeria vuota', description:'Completa una stagione con Football Manager senza infortuni.' },
    { id:'manager-dell-anno', category:'Sponsor', icon:'💼', title:'Manager dell’anno', description:'Vinci il campionato con lo sponsor Football Manager.' },
    { id:'prodotto-premium', category:'Sponsor', icon:'⭐', title:'Prodotto premium', description:'Vinci campionato e coppa con Padelle Ballarini.' },

    { id:'tearless-supremacy', category:'Tearless e Italia 2006', icon:'📹', title:'Tearless supremacy', description:'Vinci una partita con Tearless OVR 150 titolare.' },
    { id:'da-51-a-leggenda', category:'Tearless e Italia 2006', icon:'📈', title:'Da 51 a leggenda', description:'Tearless parte da 51 OVR e vince una classifica individuale.' },
    { id:'questo-gioco-fa-schifo', category:'Tearless e Italia 2006', icon:'🚪', title:'Questo gioco fa schifo', description:'Tearless lascia la squadra prima di aver giocato una partita.' },
    { id:'campione-del-mondo', category:'Tearless e Italia 2006', icon:'🌍', title:'Campione del mondo', description:'Vinci il campionato con uno dei giocatori dell’Italia 2006 ricevuti dall’evento.' },
    { id:'berlino-ancora-azzurra', category:'Tearless e Italia 2006', icon:'🇮🇹', title:'Berlino è ancora azzurra', description:'Batti l’Italia 2006 nella partita speciale.' },
    { id:'trenta-denari', category:'Tearless e Italia 2006', icon:'🪙', title:'Trenta denari', description:'Vinci il campionato grazie ai 30 punti ottenuti contro l’Italia 2006.' },
    { id:'eroe-nazionale', category:'Tearless e Italia 2006', icon:'🏅', title:'Eroe nazionale', description:'Il campione del mondo ricevuto vince almeno due classifiche individuali.' },

    { id:'benvenuti-a-fantaballopoli', category:'Fantaballopoli', icon:'🕴️', title:'Benvenuti a Fantaballopoli', description:'Avvia per la prima volta la storia principale Fantaballopoli.' },
    { id:'mani-pulite', category:'Fantaballopoli', icon:'🧼', title:'Mani pulite', description:'Completa Fantaballopoli rifiutando ogni proposta illecita.' },
    { id:'dentro-fino-al-collo', category:'Fantaballopoli', icon:'🕳️', title:'Dentro fino al collo', description:'Accetta tutte le proposte compromettenti della storia.' },
    { id:'giuda', category:'Fantaballopoli', icon:'💋', title:'Giuda', description:'Subisci il tradimento del giocatore scelto dalla storia.' },
    { id:'il-bacio-di-giuda', category:'Fantaballopoli', icon:'🏆', title:'Il bacio di Giuda', description:'Vinci comunque il campionato dopo il tradimento.' },
    { id:'scudetto-di-cartone', category:'Fantaballopoli', icon:'📦', title:'Scudetto di cartone', description:'Vinci il campionato dopo aver ottenuto punti o vantaggi tramite Fantaballopoli.' },
    { id:'sistema-abbattuto', category:'Fantaballopoli', icon:'⚒️', title:'Sistema abbattuto', description:'Completa la strada più onesta e vinci il campionato.' },
    { id:'intercettazioni', category:'Fantaballopoli', icon:'🎙️', title:'Intercettazioni', description:'Vieni scoperto dopo aver accettato un accordo illecito.' },
    { id:'juve-battuta', category:'Fantaballopoli', icon:'⚫', title:'Juve battuta', description:'Sconfiggi la Juventus 2005/06 nella finale speciale.' },
    { id:'trentotto-denari', category:'Fantaballopoli', icon:'🪙', title:'Trentotto denari', description:'Vinci il campionato grazie ai 38 punti ottenuti nella finale.' },

    { id:'la-grande-occasione', category:'Eventi', icon:'🎟️', title:'La grande occasione', description:'Promuovi il panchinaro al posto di un titolare.' },
    { id:'like-a-bomber', category:'Eventi', icon:'🎯', title:'Like a bomber', description:'Completa la missione dei 10 gol in 5 partite.' },
    { id:'conti-in-ordine', category:'Eventi', icon:'📊', title:'Conti in ordine', description:'Ottieni almeno 9 punti nelle 4 partite del Fair Play Finanziario.' },
    { id:'tre-classiche', category:'Eventi', icon:'🏟️', title:'Tre classiche', description:'Non perdere contro Juventus, Milan e Inter nella missione della curva.' },
    { id:'milanlab-certificato', category:'Eventi', icon:'🩺', title:'MilanLab certificato', description:'Completa 5 giornate senza nuovi infortuni.' },
    { id:'calcio-champagne', category:'Eventi', icon:'🥂', title:'Calcio champagne', description:'Segna almeno 2 gol in ciascuna delle 3 partite richieste.' },
    { id:'il-pollo-d-oro', category:'Eventi', icon:'🐔', title:'Il pollo d’oro', description:'Segna con il giocatore trasformato in pollo da 1 OVR.' },
    { id:'nottata-produttiva', category:'Eventi', icon:'🌙', title:'Nottata produttiva', description:'Il giocatore insonne segna nonostante il −12 OVR.' },
    { id:'marotta-league', category:'Eventi', icon:'💼', title:'Marotta League', description:'Ottieni il raddoppio dei punti di una vittoria nella Marotta League.' },
    { id:'ippica-italiana', category:'Eventi', icon:'🐎', title:'Ippica italiana', description:'Vinci 1-0 e ottieni i 9 punti del Corto Muso.' },
    { id:'nessun-bonus-nessun-problema', category:'Eventi', icon:'🚫', title:'Nessun bonus, nessun problema', description:'Vinci usando soltanto gli OVR base.' },
    { id:'trenta-minuti-bastano', category:'Eventi', icon:'⏱️', title:'Trenta minuti bastano', description:'Vinci una partita della durata di 30 minuti.' },
    { id:'atakare', category:'Eventi', icon:'⚔️', title:'ATAKARE', description:'Vinci una partita schierando il 2-4-4.' },
    { id:'era-meglio-l-acqua', category:'Eventi', icon:'🥤', title:'Era meglio l’acqua', description:'La bevanda manda tutta la rosa fuori fino a fine stagione.' },
    { id:'rosso-vincente', category:'Eventi', icon:'🟥', title:'Rosso vincente', description:'Vinci grazie a un’espulsione trasformata in gol.' },
    { id:'i-punti-sono-davvero-i-gol', category:'Eventi', icon:'🔢', title:'I punti sono davvero i gol', description:'Ottieni almeno 6 punti segnando almeno 6 gol.' },
    { id:'vudu-terapeutico', category:'Eventi', icon:'🪄', title:'Vudù terapeutico', description:'Un giocatore infortunato raggiunge almeno 100 OVR grazie al bonus di +40 OVR.' },
    { id:'non-doveva-finire-cosi', category:'Eventi', icon:'📺', title:'Non doveva finire così', description:'Ottieni una vittoria con il risultato casuale del VAR non aggiornato.' },
    { id:'cambio-di-panchina', category:'Eventi', icon:'🔄', title:'Cambio di panchina', description:'Perdi la sfida della curva, prendi una nuova squadra e vinci il campionato.' },
    { id:'da-zero-alla-gloria', category:'Eventi', icon:'0️⃣', title:'Da zero alla gloria', description:'Dopo essere stato azzerato dall’evento Pari o Dispari, torna nelle prime due posizioni.' },
    { id:'arbitro-venduto', category:'Eventi', icon:'⚖️', title:'Arbitro venduto', description:'Sopravvivi alle conseguenze dell’arbitro ecuadoriano.' },
    { id:'scudetto-sotto-pressione', category:'Eventi', icon:'📣', title:'Scudetto sotto pressione', description:'Supera la sfida delle cinque giornate della curva.' },

    { id:'zero-zero-zero', category:'Definitivi', icon:'0️⃣', title:'0-0-0', description:'Vinci il campionato senza vincere una partita, senza segnare gol e senza subirne.', ultimate:true }
  ];

  const byId = new Map(definitions.map(item => [item.id, item]));

  function emptyState() {
    return { version:VERSION, unlocked:{}, progress:{}, careerFlags:{} };
  }

  function normalizeState(value) {
    const source = value && typeof value === 'object' ? value : {};
    const result = emptyState();
    result.unlocked = source.unlocked && typeof source.unlocked === 'object' ? source.unlocked : {};
    result.progress = source.progress && typeof source.progress === 'object' ? source.progress : {};
    result.careerFlags = source.careerFlags && typeof source.careerFlags === 'object' ? source.careerFlags : {};
    Object.keys(result.progress).forEach(id => {
      result.progress[id] = Math.max(0, Math.floor(Number(result.progress[id]) || 0));
    });
    return result;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return normalizeState(raw ? JSON.parse(raw) : null);
    } catch (error) {
      console.warn('Achievement: salvataggio non leggibile', error);
      return emptyState();
    }
  }

  function save(value) {
    const state = normalizeState(value);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.dispatchEvent(new CustomEvent('fantaballa-achievements-change', { detail:state }));
    } catch (error) {
      console.warn('Achievement: salvataggio non riuscito', error);
    }
    return state;
  }

  const popupQueue = [];
  let popupVisible = false;

  function ensurePopupStyles() {
    if (document.getElementById('fantaballaAchievementStyles')) return;
    const style = document.createElement('style');
    style.id = 'fantaballaAchievementStyles';
    style.textContent = `
      .fantaballa-achievement-popup{position:fixed;right:18px;bottom:18px;z-index:100000;width:min(370px,calc(100vw - 28px));padding:4px;border-radius:22px;background:linear-gradient(135deg,#f7d85d,#ef7b37 48%,#7443a8);box-shadow:0 22px 60px rgba(6,15,28,.42);transform:translateY(24px) scale(.96);opacity:0;transition:transform .26s ease,opacity .26s ease;pointer-events:none}
      .fantaballa-achievement-popup.show{transform:translateY(0) scale(1);opacity:1}
      .fantaballa-achievement-popup.ultimate{padding:5px;background:linear-gradient(135deg,#70e1f5,#7443a8 35%,#f5d45c 68%,#ef7b37);box-shadow:0 0 0 3px rgba(255,255,255,.9),0 22px 70px rgba(79,46,140,.55)}
      .fantaballa-achievement-popup.ultimate .fantaballa-achievement-popup-inner{background:linear-gradient(145deg,#081727,#172d4a 58%,#301c50)}
      .fantaballa-achievement-popup.ultimate .fantaballa-achievement-popup-icon{background:linear-gradient(145deg,#fff,#f5d45c 55%,#70e1f5);font-weight:1000}
      .fantaballa-achievement-popup-inner{display:grid;grid-template-columns:58px minmax(0,1fr);gap:13px;align-items:center;padding:14px;border-radius:18px;background:#10243a;color:#fff}
      .fantaballa-achievement-popup-icon{display:grid;place-items:center;width:58px;height:58px;border-radius:16px;background:linear-gradient(145deg,#fff8cd,#f7d85d);color:#10243a;font-size:30px;box-shadow:inset 0 0 0 2px rgba(16,36,58,.12)}
      .fantaballa-achievement-popup small{display:block;margin-bottom:3px;color:#f7d85d;font:900 10px/1.2 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase}
      .fantaballa-achievement-popup b{display:block;color:#fff;font:1000 18px/1.08 system-ui,sans-serif}
      .fantaballa-achievement-popup span{display:block;margin-top:5px;color:#dce8f2;font:700 12px/1.35 system-ui,sans-serif}
      @media(max-width:600px){.fantaballa-achievement-popup{right:14px;bottom:14px}.fantaballa-achievement-popup-inner{grid-template-columns:50px minmax(0,1fr);padding:12px}.fantaballa-achievement-popup-icon{width:50px;height:50px;font-size:26px}}
      @media(prefers-reduced-motion:reduce){.fantaballa-achievement-popup{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function showNextPopup() {
    if (popupVisible || !popupQueue.length || !document.body) return;
    popupVisible = true;
    ensurePopupStyles();
    const achievement = popupQueue.shift();
    const popup = document.createElement('div');
    popup.className = `fantaballa-achievement-popup${achievement.ultimate ? ' ultimate' : ''}`;
    popup.setAttribute('role', 'status');
    popup.setAttribute('aria-live', 'polite');
    popup.innerHTML = `<div class="fantaballa-achievement-popup-inner"><div class="fantaballa-achievement-popup-icon">${achievement.icon}</div><div><small>Achievement sbloccato</small><b>${achievement.title}</b><span>${achievement.description}</span></div></div>`;
    document.body.appendChild(popup);
    requestAnimationFrame(() => popup.classList.add('show'));
    window.setTimeout(() => {
      popup.classList.remove('show');
      window.setTimeout(() => {
        popup.remove();
        popupVisible = false;
        showNextPopup();
      }, 300);
    }, 4300);
  }

  function queuePopup(definition) {
    popupQueue.push(definition);
    showNextPopup();
  }

  function unlock(id, context = {}) {
    const definition = byId.get(String(id));
    if (!definition) return false;
    const state = load();
    if (state.unlocked[definition.id]) return false;
    state.unlocked[definition.id] = {
      unlockedAt:new Date().toISOString(),
      mode:String(context.mode || ''),
      teamName:String(context.teamName || ''),
      coachName:String(context.coachName || ''),
      season:Number(context.season) || 1,
      matchday:Number(context.matchday) || 0
    };
    if (definition.target) state.progress[definition.id] = Math.max(definition.target, Number(state.progress[definition.id]) || 0);
    save(state);
    queuePopup(definition);
    return true;
  }

  function addProgress(id, amount = 1, context = {}) {
    const definition = byId.get(String(id));
    if (!definition) return 0;
    const state = load();
    if (state.unlocked[definition.id]) return Math.max(Number(state.progress[definition.id]) || 0, Number(definition.target) || 0);
    const next = Math.max(0, (Number(state.progress[definition.id]) || 0) + (Number(amount) || 0));
    state.progress[definition.id] = next;
    save(state);
    if (definition.target && next >= definition.target) unlock(definition.id, context);
    return next;
  }

  function progress(id) {
    return Math.max(0, Number(load().progress[String(id)]) || 0);
  }

  function careerBucket(state, careerId, create = false) {
    const key = String(careerId || 'career');
    if (!state.careerFlags[key] && create) state.careerFlags[key] = {};
    return state.careerFlags[key] || null;
  }

  function setCareerFlag(careerId, key, value = true) {
    const state = load();
    const bucket = careerBucket(state, careerId, true);
    bucket[String(key)] = value;
    save(state);
    return value;
  }

  function getCareerFlag(careerId, key) {
    const state = load();
    const bucket = careerBucket(state, careerId, false);
    return bucket ? bucket[String(key)] : undefined;
  }

  function clearCareerFlag(careerId, key) {
    const state = load();
    const bucket = careerBucket(state, careerId, false);
    if (!bucket || !(String(key) in bucket)) return false;
    delete bucket[String(key)];
    if (!Object.keys(bucket).length) delete state.careerFlags[String(careerId || 'career')];
    save(state);
    return true;
  }

  function unlockedCount() {
    const state = load();
    return definitions.filter(item => Boolean(state.unlocked[item.id])).length;
  }

  window.FantaballaAchievements = Object.freeze({
    STORAGE_KEY,
    VERSION,
    definitions:Object.freeze(definitions.map(item => Object.freeze({...item}))),
    load,
    save,
    unlock,
    addProgress,
    progress,
    setCareerFlag,
    getCareerFlag,
    clearCareerFlag,
    unlockedCount
  });
})();
