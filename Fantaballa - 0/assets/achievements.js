(() => {
  'use strict';

  const STORAGE_KEY = 'fantaballa_achievements_v1';
  const VERSION = 1;

  const definitions = [
    { id:'buona-la-prima', category:'Immediati', icon:'🎬', title:'Buona la prima', description:'Vinci la prima partita della carriera.' },
    { id:'cappotto', category:'Immediati', icon:'🧥', title:'Cappotto', description:'Vinci con almeno 5 gol di scarto.' },
    { id:'remuntada', category:'Immediati', icon:'🔥', title:'Remuntada', description:'Vinci dopo essere stato sotto di almeno 2 gol.' },
    { id:'clin-shit', category:'Immediati', icon:'🧤', title:'Clin shit', description:'Vinci una partita senza subire gol.' },

    { id:'campeones', category:'Stagionali', icon:'🏆', title:'Campeones', description:'Vinci il campionato.' },
    { id:'double', category:'Stagionali', icon:'👑', title:'Double', description:'Vinci campionato e coppa nella stessa stagione.' },
    { id:'invincibili', category:'Stagionali', icon:'🛡️', title:'Invincibili', description:'Termina una stagione senza sconfitte.' },
    { id:'attacco-atomico', category:'Stagionali', icon:'☢️', title:'Attacco atomico', description:'Segna almeno 100 gol in una stagione.' },
    { id:'fotofinish', category:'Stagionali', icon:'📸', title:'Fotofinish', description:'Vinci il titolo con un punto o meno di vantaggio.' },

    { id:'giovani-promesse', category:'Allenatori', icon:'✨', title:'Giovani promesse', description:'Vinci il campionato con “Giovani e belli”.' },
    { id:'fuori-dagli-schemi', category:'Allenatori', icon:'🔀', title:'Fuori dagli schemi', description:'Segna 10 gol con giocatori schierati fuori ruolo usando “Duttilità”.', target:10 },
    { id:'zero-intesa', category:'Allenatori', icon:'💠', title:'Zero intesa, massimo risultato', description:'Vinci una partita con Duttilità e Intesa totale pari a zero.' },
    { id:'il-generale', category:'Allenatori', icon:'🇮🇹', title:'Il generale', description:'Completa una stagione usando solamente giocatori italiani.' },

    { id:'non-doveva-finire-cosi', category:'Eventi', icon:'📺', title:'Non doveva finire così', description:'Ottieni una vittoria con il risultato casuale del VAR non aggiornato.' },
    { id:'cambio-di-panchina', category:'Eventi', icon:'🔄', title:'Cambio di panchina', description:'Perdi la sfida della curva, prendi una nuova squadra e vinci il campionato.' },
    { id:'da-zero-alla-gloria', category:'Eventi', icon:'0️⃣', title:'Da zero alla gloria', description:'Dopo essere stato azzerato dall’evento Pari o Dispari, torna nelle prime due posizioni.' },
    { id:'arbitro-venduto', category:'Eventi', icon:'⚖️', title:'Arbitro venduto', description:'Sopravvivi alle conseguenze dell’arbitro ecuadoriano.' },
    { id:'scudetto-sotto-pressione', category:'Eventi', icon:'📣', title:'Scudetto sotto pressione', description:'Supera la sfida delle cinque giornate della curva.' }
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
    popup.className = 'fantaballa-achievement-popup';
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
