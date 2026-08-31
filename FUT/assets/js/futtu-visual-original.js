
(function(){
  const ACTIVE_CONFIG = window.FUTTU_CONFIG || {};
  const INFINITE_PACKS = new Set((ACTIVE_CONFIG.packs || [])
    .filter(p => ['infinite','composite','gotham-legend-infinite'].includes(p.kind))
    .map(p => p.name));
  const PACK_COPY = Object.fromEntries((ACTIVE_CONFIG.packs || []).map(p => [p.name, p.description || 'Seleziona un pacchetto e aprilo per ottenere nuove carte.']));
  const SECTION_LABELS = {
    featured:'Pacchetti promo',
    stock:'Scorta',
    foryou:'Pacchetti per te',
    classic:'Pacchetti classici',
    stadium:'Oggetti stadio stagione',
    all:'Tutti i pacchi'
  };

  function validGames(){
    const list = Array.isArray(window.VALID_GAMES) ? window.VALID_GAMES.slice() : [];
    return list.filter(g => g && g !== 'Dream Regen');
  }
  function ensureSections(){
    const all = validGames();
    const configured = ACTIVE_CONFIG.sections || {};
    const sectionValue = (key, fallback) => {
      const value = configured[key];
      if (value === '*') return all;
      const list = Array.isArray(value) ? value : fallback;
      return [...new Set(list || [])].filter(g => all.includes(g));
    };
    window.STORE_SECTIONS = {
      featured: sectionValue('featured', all.slice(0, Math.min(8, all.length))),
      stock: sectionValue('stock', all.filter(g => !INFINITE_PACKS.has(g))),
      foryou: sectionValue('foryou', all.slice(0, Math.min(4, all.length))),
      classic: sectionValue('classic', ['Gold','Silver','Bronze','Patatine']),
      stadium: sectionValue('stadium', ['Oggetti','Strumenti','Cosmetic']),
      all: all
    };
    if (!window.CURRENT_SECTION || !window.STORE_SECTIONS[window.CURRENT_SECTION]) window.CURRENT_SECTION = 'featured';
  }
  function visibleGames(){
    ensureSections();
    const all = validGames();
    const list = window.STORE_SECTIONS[window.CURRENT_SECTION] || all;
    return [...new Set(list)].filter(g => all.includes(g));
  }
  window.getVisibleGames = visibleGames;
  function packLeft(game){
    try{
      if (INFINITE_PACKS.has(game)) return '∞';
      const total = (window.GAME_STATE && window.GAME_STATE.packs && window.GAME_STATE.packs[game] || []).length;
      const cursor = Number(window.GAME_STATE && window.GAME_STATE.cursor && window.GAME_STATE.cursor[game] || 0);
      return String(Math.max(0,total-cursor));
    }catch(e){ return '—'; }
  }
  function packTotal(game){
    try{
      if (INFINITE_PACKS.has(game)) return '∞';
      return String((window.GAME_STATE && window.GAME_STATE.packs && window.GAME_STATE.packs[game] || []).length || 0);
    }catch(e){ return '—'; }
  }
  function cardCount(game){
    try{
      if (typeof window.cardCount === 'function') return window.cardCount(game);
      return (window.GAME_STATE && window.GAME_STATE.pools && window.GAME_STATE.pools[game] || []).length || 0;
    }catch(e){ return 0; }
  }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
  function selectedGame(){
    return (window.GAME_STATE && window.GAME_STATE.selected) || ACTIVE_CONFIG.defaultPack || 'Patatine';
  }
  function installTopbar(){
    const nav = document.querySelector('.fc-nav');
    if (nav) {
      nav.innerHTML = '<a>Inizio</a><a class="is-active">Negozio</a><a>Vedi</a><a>Già visualizzati</a><a>FC Points</a>';
    }
    const brand = document.querySelector('.fc-brand strong');
    if (brand) brand.textContent = 'FUTTU Ultimate Team';
    const right = document.querySelector('.fc-right');
    if (right) {
      // Monete e Like devono restare centrati sopra il carosello dei pacchetti.
      const wallet = document.getElementById('balanceCenter');
      const packsWrap = document.querySelector('.packs-sticky .wrap');
      const packsStrip = document.getElementById('packsStrip');
      if (wallet && packsWrap && wallet.parentElement !== packsWrap) {
        packsWrap.insertBefore(wallet, packsStrip || packsWrap.firstChild);
      } else if (wallet && packsWrap && packsStrip && wallet.nextElementSibling !== packsStrip) {
        packsWrap.insertBefore(wallet, packsStrip);
      }

      // Login/Punti e costo restano nella barra superiore.
      let topPoints = right.querySelector('.ut-top-points');
      if (!topPoints) {
        topPoints = document.createElement('div');
        topPoints.className = 'ut-top-points';
        right.appendChild(topPoints);
      }
      const price = document.getElementById('pricePill');
      const points = document.getElementById('pointsBadge');
      if (points && points.parentElement !== topPoints) topPoints.appendChild(points);
      if (price && price.parentElement !== topPoints) topPoints.appendChild(price);
    }
  }
  function installSidebar(){
    ensureSections();
    const sidebar = document.querySelector('.fc-sidebar');
    if (!sidebar) return;
    sidebar.innerHTML = `
      <ul>
        <li class="title">Speciale</li>
        <li data-section="featured">Pacchetti promo</li>
        <li data-section="stock">Scorta</li>
        <li data-section="foryou">Pacchetti per te</li>
        <li data-section="classic">Pacchetti classici</li>
        <li data-section="stadium">Oggetti stadio stagione</li>
        <li data-section="all">Tutti i pacchi</li>
      </ul>`;
    sidebar.querySelectorAll('li[data-section]').forEach(li=>{
      li.classList.toggle('active', li.getAttribute('data-section') === window.CURRENT_SECTION);
      li.addEventListener('click', ()=> activateUTSection(li.getAttribute('data-section')), {passive:true});
    });
  }
  function installHero(){
    const wrap = document.querySelector('header .wrap');
    if (!wrap) return;
    let hero = document.getElementById('utStoreHero');
    if (!hero) {
      hero = document.createElement('section');
      hero.id = 'utStoreHero';
      hero.className = 'ut-store-hero';
      hero.innerHTML = `
        <div class="ut-store-meta">
          <span id="utPackExpire">⌚ Scade fra: sempre disponibile</span>
          <span id="utPackLeft">Pacchetti rimasti: —</span>
        </div>
        <div class="ut-store-titleline"><h1 id="utPackTitle">Pacchetto</h1><span class="ut-lock-icon" aria-hidden="true">↯</span></div>
        <p class="ut-store-desc" id="utPackDesc"></p>
        <div class="ut-action-row" id="utActionRow"></div>`;
      wrap.prepend(hero);
    }
    const action = document.getElementById('utActionRow');
    if (action) {
      ['openBtn','myCardsBtn','bonusBtn','resetPacksBtn'].forEach(id=>{
        const el = document.getElementById(id);
        if (el && el.parentElement !== action) action.appendChild(el);
      });
      const home = Array.from(document.querySelectorAll('a.btn')).find(a => /Torna alla Home/i.test(a.textContent || '') || /vetrina-carte\/?$/i.test(a.href || ''));
      if (home && home.parentElement !== action) action.appendChild(home);
    }
  }
  function updateHero(){
    ensureSections();
    const game = selectedGame();
    const title = document.getElementById('utPackTitle');
    const desc = document.getElementById('utPackDesc');
    const left = document.getElementById('utPackLeft');
    const expire = document.getElementById('utPackExpire');
    const sectionName = SECTION_LABELS[window.CURRENT_SECTION] || 'Negozio';
    if (title) title.textContent = game;
    if (desc) desc.textContent = PACK_COPY[game] || 'Seleziona un pacchetto e aprilo per ottenere nuove carte.';
    if (left) {
      const remaining = packLeft(game);
      const total = packTotal(game);
      left.textContent = INFINITE_PACKS.has(game) ? 'Pacchetti rimasti: ∞' : `Pacchetti rimasti: ${remaining}/${total}`;
    }
    if (expire) expire.textContent = `● ${sectionName}`;
    const price = document.getElementById('pricePill');
    if (price) price.textContent = 'Apertura: GRATIS';
  }
  function renderUTPacksStrip(){
    const strip = document.getElementById('packsStrip');
    if (!strip) return;
    const games = visibleGames();
    if (games.length && (!games.includes(selectedGame()))) {
      window.GAME_STATE.selected = games[0];
      try { if (typeof window.applyPackVisual === 'function') window.applyPackVisual(); } catch(e){}
    }
    strip.innerHTML = '';
    const frag = document.createDocumentFragment();
    games.forEach(game=>{
      const back = (window.PACK_BACK_BY_GAME && window.PACK_BACK_BY_GAME[game]) || 'patatrine.png';
      const packCfg = (window.PACK_CONFIG_BY_GAME && window.PACK_CONFIG_BY_GAME[game]) || {};
      const referenceCost = Number(packCfg.referenceCost || 0);
      const referenceCurrency = String(packCfg.referenceCurrency || 'none');
      const formattedReferenceCost = new Intl.NumberFormat('it-IT').format(referenceCost);
      const left = packLeft(game);
      const total = packTotal(game);
      const count = cardCount(game);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'featured-card ut-pack-card' + (selectedGame() === game ? ' is-selected' : '');
      card.setAttribute('data-game', game);
      card.setAttribute('aria-current', selectedGame() === game ? 'true' : 'false');
      card.innerHTML = `
        <div class="ut-pack-media"><img src="${esc(back)}" alt="${esc(game)}" loading="lazy" decoding="async"></div>
        <div class="ut-pack-bottom">
          <div class="ut-pack-name">${esc(game)}</div>
          <div class="ut-pack-price" title="Valore indicativo: il pacchetto si apre sempre gratis">
            ${referenceCost <= 0
              ? `<span class="ut-cost-value">0</span>`
              : referenceCurrency === 'likes'
                ? `<span class="ut-like" aria-hidden="true">♥</span><span class="ut-cost-value">${formattedReferenceCost}</span>`
                : `<span class="ut-coin" aria-hidden="true"></span><span class="ut-cost-value">${formattedReferenceCost}</span>`
            }
          </div>
          <div class="ut-pack-reference">VALORE INDICATIVO • APERTURA GRATIS</div>
          <div class="ut-pack-sub">${INFINITE_PACKS.has(game) ? '∞ pacchetti' : `${left}/${total} pacchetti`} • ${count} carte</div>
        </div>`;
      card.addEventListener('click', ()=> selectPack(game), {passive:true});
      frag.appendChild(card);
    });
    strip.appendChild(frag);
    updateHero();
  }
  function selectPack(game){
    if (!game || !window.GAME_STATE) return;
    window.GAME_STATE.selected = game;
    try { if (typeof window.applyPackVisual === 'function') window.applyPackVisual(); } catch(e){}
    try { if (typeof window.updateOpenBtnEnabled === 'function') window.updateOpenBtnEnabled(); } catch(e){}
    renderUTPacksStrip();
    updateHero();
  }
  function activateUTSection(section){
    ensureSections();
    window.CURRENT_SECTION = section || 'featured';
    document.querySelectorAll('.fc-sidebar li[data-section]').forEach(li=>{
      li.classList.toggle('active', li.getAttribute('data-section') === window.CURRENT_SECTION);
    });
    const games = visibleGames();
    if (games.length && (!games.includes(selectedGame()))) {
      window.GAME_STATE.selected = games[0];
      try { if (typeof window.applyPackVisual === 'function') window.applyPackVisual(); } catch(e){}
    }
    try { if (typeof window.updateOpenBtnEnabled === 'function') window.updateOpenBtnEnabled(); } catch(e){}
    renderUTPacksStrip();
    updateHero();
  }
  function patchGlobals(){
    if (window.__utStoreMenuPatched) return;
    window.__utStoreMenuPatched = true;
    const oldRenderStrip = window.renderPacksStrip;
    window.renderPacksStrip = renderUTPacksStrip;
    try { renderPacksStrip = renderUTPacksStrip; } catch(e){}

    const oldApply = window.applyPackVisual;
    window.applyPackVisual = function(){
      let res;
      if (typeof oldApply === 'function') res = oldApply.apply(this, arguments);
      updateHero();
      try {
        const pack = document.getElementById('pack');
        const game = selectedGame();
        if (pack && window.PACK_BACK_BY_GAME) pack.style.backgroundImage = `url('${window.PACK_BACK_BY_GAME[game] || 'patatrine.png'}')`;
      } catch(e){}
      return res;
    };
    try { applyPackVisual = window.applyPackVisual; } catch(e){}

    const oldUpdate = window.updateOpenBtnEnabled;
    window.updateOpenBtnEnabled = function(){
      let res;
      if (typeof oldUpdate === 'function') res = oldUpdate.apply(this, arguments);
      updateHero();
      renderUTPacksStrip();
      return res;
    };
    try { updateOpenBtnEnabled = window.updateOpenBtnEnabled; } catch(e){}

    window.activateSection = activateUTSection;
    window.activateUTSection = activateUTSection;
    window.selectUTPack = selectPack;
    window.oldRenderPacksStripBeforeUT = oldRenderStrip;
  }
  function init(){
    ensureSections();
    installTopbar();
    installSidebar();
    installHero();
    patchGlobals();
    updateHero();
    renderUTPacksStrip();
    setTimeout(()=>{ updateHero(); renderUTPacksStrip(); }, 350);
    setTimeout(()=>{ updateHero(); renderUTPacksStrip(); }, 1100);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('load', ()=> setTimeout(init, 250));
})();
