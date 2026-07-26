'use strict';

/* FUTTU Pack Opening — Base + Premium
 * API pubblica: window.FUTTU_PACK_OPENING.play(payload)
 * Nessun asset obbligatorio: effetti e suoni sono generati via CSS/Web Audio.
 */
(function(){
  if (window.FUTTU_PACK_OPENING) return;

  const DEFAULT_THEME = {
    id: 'fantaballa',
    atmosphere: 'stadium',
    primaryColor: '#4ee5d8',
    secondaryColor: '#1f9dff',
    accentColor: '#ffe76a',
    backgroundColor: '#07111d',
    surfaceColor: '#0d1c2d',
    eyebrow: 'FUTTU ULTIMATE TEAM',
    readyText: 'Preparati al reveal',
    walkoutRarities: ['Ultra Rara', 'Season', 'Leggendaria'],
    walkoutSeries: ['Legend', 'Leggendaria', 'Tots', 'Dream', 'Dark'],
    sound: true
  };

  const RARITY = {
    'comune':       { label:'COMUNE',       color:'#aab4c3', rank:0 },
    'non comune':   { label:'NON COMUNE',   color:'#48d69b', rank:1 },
    'rara':         { label:'RARA',         color:'#58a9ff', rank:2 },
    'epica':        { label:'EPICA',        color:'#b08cff', rank:3 },
    'ultra rara':   { label:'ULTRA RARA',   color:'#ffc94a', rank:4 },
    'season':       { label:'SEASON',       color:'#ff5b6e', rank:5 },
    'leggendaria':  { label:'LEGGENDA',     color:'#ffe370', rank:6 }
  };

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const norm = value => String(value || '').trim().toLowerCase();
  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(resolve => window.setTimeout(resolve, reducedMotion() ? Math.min(ms, 45) : ms));

  let root = null;
  let scene = null;
  let runToken = 0;
  let activePayload = null;
  let activeResolve = null;
  let advanceResolve = null;
  let sequenceStarted = false;
  let summaryShown = false;
  let muted = false;
  try { muted = localStorage.getItem('futtu_opening_muted') === '1'; } catch (error) {}
  let audioContext = null;

  function mergeTheme(){
    return Object.assign({}, DEFAULT_THEME, (window.FUTTU_CONFIG && window.FUTTU_CONFIG.openingTheme) || {});
  }

  function ensureDom(){
    if (root && document.body.contains(root)) return root;
    root = document.createElement('div');
    root.id = 'futtuPackOpening';
    root.className = 'futtu-opening';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `
      <div class="fo-backdrop"></div>
      <section class="fo-scene" role="dialog" aria-modal="true" aria-labelledby="foOpeningTitle" data-phase="pack">
        <div class="fo-sky"></div>
        <div class="fo-floor"></div>
        <div class="fo-pitch"></div>
        <div class="fo-city"></div>
        <div class="fo-light-beams"><i></i><i></i><i></i><i></i></div>
        <div class="fo-particles" aria-hidden="true"></div>
        <div class="fo-flash" aria-hidden="true"></div>
        <header class="fo-header">
          <div>
            <div class="fo-eyebrow"></div>
            <h2 class="fo-title" id="foOpeningTitle">Pacchetto</h2>
          </div>
          <div class="fo-progress" aria-hidden="true"></div>
        </header>
        <div class="fo-stage">
          <div class="fo-pack-phase" tabindex="0" role="button" aria-label="Avvia apertura pacchetto">
            <div class="fo-pack-shell">
              <div class="fo-aura"></div>
              <div class="fo-ring"></div>
              <div class="fo-ring r2"></div>
              <div class="fo-pack-reflection"></div>
              <img class="fo-pack-image" alt="Pacchetto selezionato">
              <div class="fo-pack-fallback" hidden></div>
            </div>
            <div class="fo-hint">Clicca per aprire subito</div>
          </div>
          <div class="fo-reveal-phase" tabindex="0" role="button" aria-label="Mostra la carta successiva">
            <div class="fo-walkout-label" aria-hidden="true"></div>
            <div class="fo-reveal-layout">
              <div class="fo-reveal-copy">
                <div class="fo-rarity">CARTA</div>
                <h3 class="fo-card-name">Carta misteriosa</h3>
                <div class="fo-card-meta">
                  <span class="fo-chip fo-role"></span>
                  <span class="fo-chip fo-series"></span>
                </div>
                <div class="fo-card-counter"></div>
              </div>
              <div class="fo-card-visual">
                <div class="fo-card-frame">
                  <img class="fo-card-image" alt="Carta ottenuta">
                  <div class="fo-card-placeholder" hidden></div>
                </div>
              </div>
              <div class="fo-side-stat">
                <strong class="fo-side-role">—</strong>
                <span>Ruolo</span>
              </div>
            </div>
          </div>
          <div class="fo-summary-phase">
            <div>
              <h3 class="fo-summary-title">Pacchetto completato</h3>
              <div class="fo-summary-grid"></div>
            </div>
          </div>
        </div>
        <div class="fo-controls">
          <button type="button" class="fo-btn fo-sound" aria-label="Attiva o disattiva audio">🔊</button>
          <button type="button" class="fo-btn fo-skip">Salta</button>
          <button type="button" class="fo-btn fo-btn-primary fo-continue" hidden>Continua</button>
        </div>
        <div class="fo-sr-only" aria-live="polite"></div>
      </section>`;
    document.body.appendChild(root);
    scene = $('.fo-scene', root);

    $('.fo-pack-phase', root).addEventListener('click', startNow);
    $('.fo-pack-phase', root).addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        startNow();
      }
    });
    $('.fo-reveal-phase', root).addEventListener('click', advanceSequence);
    $('.fo-reveal-phase', root).addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        advanceSequence();
      }
    });
    $('.fo-skip', root).addEventListener('click', skipToSummary);
    $('.fo-continue', root).addEventListener('click', close);
    $('.fo-sound', root).addEventListener('click', toggleMute);
    root.addEventListener('keydown', onKeyDown);
    updateSoundButton();
    return root;
  }

  function applyTheme(theme){
    scene.dataset.atmosphere = theme.atmosphere || 'stadium';
    scene.style.setProperty('--fo-primary', theme.primaryColor || DEFAULT_THEME.primaryColor);
    scene.style.setProperty('--fo-secondary', theme.secondaryColor || DEFAULT_THEME.secondaryColor);
    scene.style.setProperty('--fo-accent', theme.accentColor || DEFAULT_THEME.accentColor);
    scene.style.setProperty('--fo-bg', theme.backgroundColor || DEFAULT_THEME.backgroundColor);
    scene.style.setProperty('--fo-surface', theme.surfaceColor || DEFAULT_THEME.surfaceColor);
    $('.fo-eyebrow', root).textContent = theme.eyebrow || DEFAULT_THEME.eyebrow;
  }

  function buildParticles(theme){
    const holder = $('.fo-particles', root);
    holder.innerHTML = '';
    const rain = (theme.atmosphere || '').includes('rain');
    const count = reducedMotion() ? 8 : (rain ? 52 : 34);
    for (let i = 0; i < count; i += 1) {
      const particle = document.createElement('i');
      particle.className = 'fo-particle';
      particle.style.setProperty('--x', `${Math.random() * 100}%`);
      particle.style.setProperty('--y', `${rain ? -20 - Math.random() * 80 : 70 + Math.random() * 45}%`);
      particle.style.setProperty('--w', `${rain ? 1 : 2 + Math.random() * 5}px`);
      particle.style.setProperty('--h', `${rain ? 30 + Math.random() * 55 : 2 + Math.random() * 9}px`);
      particle.style.setProperty('--o', `${0.2 + Math.random() * 0.55}`);
      particle.style.setProperty('--d', `${rain ? 1.1 + Math.random() * 1.8 : 3.4 + Math.random() * 4}s`);
      particle.style.setProperty('--delay', `${-Math.random() * 5}s`);
      particle.style.setProperty('--dx', `${-14 + Math.random() * 28}vw`);
      particle.style.setProperty('--pc', Math.random() > .5 ? (theme.primaryColor || DEFAULT_THEME.primaryColor) : (theme.secondaryColor || DEFAULT_THEME.secondaryColor));
      holder.appendChild(particle);
    }
  }

  function rarityInfo(card){
    const raw = norm(card && card.rarity);
    return RARITY[raw] || { label: String(card && card.rarity || 'CARTA').toUpperCase(), color:'#ffffff', rank:1 };
  }

  function rank(card){
    return rarityInfo(card).rank;
  }

  function isWalkout(card, theme=mergeTheme()){
    if (!card) return false;
    if (card.walkout === true || String(card.walkout).toLowerCase() === 'true') return true;
    const rarity = norm(card.rarity);
    const series = norm(card.series);
    const allowedRarities = (theme.walkoutRarities || []).map(norm);
    const allowedSeries = (theme.walkoutSeries || []).map(norm);
    return allowedRarities.includes(rarity) || allowedSeries.some(item => item && series.includes(item));
  }

  function orderCards(cards){
    return cards.map((card,index)=>({card,index})).sort((a,b)=>{
      const diff = rank(a.card) - rank(b.card);
      return diff || a.index - b.index;
    }).map(item=>item.card);
  }

  function bestCardIndex(cards){
    let best = 0;
    cards.forEach((card,index)=>{ if (rank(card) >= rank(cards[best])) best = index; });
    return best;
  }

  function setProgress(total, current){
    const progress = $('.fo-progress', root);
    progress.innerHTML = '';
    const visible = Math.min(total, 10);
    for (let i = 0; i < visible; i += 1) {
      const bar = document.createElement('i');
      if (i < Math.ceil((current / Math.max(total,1)) * visible)) bar.classList.add('is-done');
      progress.appendChild(bar);
    }
  }

  function setPackImage(src, title){
    const image = $('.fo-pack-image', root);
    const fallback = $('.fo-pack-fallback', root);
    image.hidden = false;
    fallback.hidden = true;
    image.alt = `Pacchetto ${title || ''}`;
    image.onerror = () => {
      image.hidden = true;
      fallback.hidden = false;
      fallback.textContent = title || 'Pacchetto';
    };
    image.src = src || '';
    if (!src) image.onerror();
  }

  function setCardImage(card){
    const image = $('.fo-card-image', root);
    const fallback = $('.fo-card-placeholder', root);
    image.hidden = false;
    fallback.hidden = true;
    image.alt = `Carta ${card.name || ''}`;
    image.onerror = () => {
      image.hidden = true;
      fallback.hidden = false;
      fallback.innerHTML = `
        <div class="fo-card-placeholder-inner">
          <div class="fo-card-placeholder-rarity">${rarityInfo(card).label}</div>
          <div class="fo-card-placeholder-name">${card.name || 'Carta misteriosa'}</div>
          <div class="fo-card-placeholder-meta">${[card.role, card.series || card.game].filter(Boolean).join(' · ')}</div>
        </div>`;
    };
    image.src = card.img || '';
    if (!card.img) image.onerror();
  }

  function waitForAdvance(){
    return new Promise(resolve => { advanceResolve = resolve; });
  }

  function clearAdvanceResolver(){
    if (advanceResolve) {
      const resolver = advanceResolve;
      advanceResolve = null;
      try { resolver(); } catch (error) {}
    }
  }

  function advanceSequence(){
    clearAdvanceResolver();
  }

  function showRoot(payload){
    ensureDom();
    const theme = mergeTheme();
    activePayload = Object.assign({}, payload, { theme });
    summaryShown = false;
    sequenceStarted = false;
    applyTheme(theme);
    buildParticles(theme);
    scene.dataset.phase = 'pack';
    $('.fo-reveal-phase', root).classList.remove('is-tease','is-revealed');
    $('.fo-title', root).textContent = payload.packName || payload.game || 'Pacchetto';
    $('.fo-hint', root).textContent = theme.readyText || 'Clicca per aprire subito';
    $('.fo-skip', root).hidden = false;
    $('.fo-continue', root).hidden = true;
    setPackImage(payload.cover, payload.packName || payload.game);
    setProgress((payload.cards || []).length, 0);
    root.classList.add('is-active');
    root.setAttribute('aria-hidden','false');
    document.body.classList.add('futtu-opening-active');
    window.setTimeout(()=>$('.fo-pack-phase',root).focus({preventScroll:true}),30);
    announce(`Pacchetto ${payload.packName || payload.game || ''} pronto per l'apertura.`);
  }

  async function startSequence(token){
    if (sequenceStarted || !activePayload || token !== runToken) return;
    sequenceStarted = true;
    const cards = orderCards(activePayload.cards || []);
    const theme = activePayload.theme;
    const quick = cards.length > 4;

    resumeAudio();
    sound('charge', theme);
    scene.dataset.phase = 'charge';
    $('.fo-hint', root).textContent = 'Energia in caricamento…';
    await wait(quick ? 560 : 860);
    if (token !== runToken || summaryShown) return;

    sound('burst', theme);
    scene.dataset.phase = 'burst';
    await wait(540);
    if (token !== runToken || summaryShown) return;

    for (let index = 0; index < cards.length; index += 1) {
      if (token !== runToken || summaryShown) return;
      await revealCard(cards[index], index, cards.length, quick, token, theme);
    }
    if (token === runToken && !summaryShown) showSummary(cards, token);
  }

  function startNow(){
    if (!activePayload || sequenceStarted || summaryShown) return;
    startSequence(runToken).catch(error => {
      console.error('[FUTTU Pack Opening]', error);
      showSummary(orderCards(activePayload.cards || []), runToken);
    });
  }

  async function revealCard(card, index, total, quick, token, theme){
    const info = rarityInfo(card);
    const walkout = isWalkout(card, theme);
    const reveal = $('.fo-reveal-phase', root);
    reveal.classList.remove('is-revealed');
    reveal.classList.add('is-tease');
    scene.dataset.phase = walkout ? 'walkout' : 'reveal';
    scene.style.setProperty('--fo-rarity', info.color);
    $('.fo-rarity', root).textContent = info.label;
    $('.fo-card-name', root).textContent = card.name || 'Carta misteriosa';
    $('.fo-role', root).textContent = card.role || 'Ruolo —';
    $('.fo-series', root).textContent = card.series || card.game || 'Serie —';
    $('.fo-side-role', root).textContent = card.role || '—';
    $('.fo-card-counter', root).textContent = `Carta ${index + 1} di ${total}`;
    $('.fo-walkout-label', root).textContent = walkout ? (card.series || info.label) : '';
    setCardImage(card);
    setProgress(total, index);
    announce(`${info.label}. ${card.role || ''}. ${card.series || ''}.`);

    sound(walkout ? 'walkout' : 'tease', theme, info.rank);
    await wait(walkout ? 760 : (quick ? 150 : 390));
    if (token !== runToken || summaryShown) return;

    reveal.classList.add('is-revealed');
    $('.fo-hint', root).textContent = index + 1 < total
      ? 'Clicca per mostrare la carta successiva'
      : 'Clicca per vedere il riepilogo finale';
    try { reveal.focus({preventScroll:true}); } catch (error) {}
    sound('reveal', theme, info.rank);
    announce(`${card.name || 'Carta'} rivelata.`);
    setProgress(total, index + 1);
    await waitForAdvance();
    if (token !== runToken || summaryShown) return;
  }

  function makeSummaryCard(card, index, isBest){
    const item = document.createElement('article');
    item.className = `fo-summary-card${isBest ? ' is-best' : ''}`;
    item.style.setProperty('--sd', `${Math.min(index * 60, 420)}ms`);
    const media = document.createElement('div');
    media.className = 'fo-summary-media';
    const image = document.createElement('img');
    image.alt = `Carta ${card.name || ''}`;
    image.loading = 'eager';
    image.decoding = 'async';
    image.onerror = () => {
      image.remove();
      const fallback = document.createElement('div');
      fallback.className = 'fo-summary-fallback';
      fallback.textContent = card.name || 'Carta';
      media.appendChild(fallback);
    };
    if (card.img) image.src = card.img;
    else image.onerror();
    if (card.img) media.appendChild(image);
    const name = document.createElement('div');
    name.className = 'fo-summary-name';
    name.textContent = card.name || 'Carta';
    const meta = document.createElement('div');
    meta.className = 'fo-summary-meta';
    meta.textContent = [card.rarity, card.role].filter(Boolean).join(' · ');
    item.append(media,name,meta);
    return item;
  }

  function showSummary(cards, token){
    if (!activePayload || token !== runToken) return;
    clearAdvanceResolver();
    summaryShown = true;
    sequenceStarted = true;
    scene.dataset.phase = 'summary';
    const grid = $('.fo-summary-grid', root);
    grid.innerHTML = '';
    const best = bestCardIndex(cards);
    cards.forEach((card,index)=>grid.appendChild(makeSummaryCard(card,index,index===best)));
    $('.fo-summary-title', root).textContent = cards.length === 1 ? 'Carta ottenuta' : `${cards.length} carte ottenute`;
    $('.fo-hint', root).textContent = 'Riepilogo finale del pacchetto';
    $('.fo-skip', root).hidden = true;
    $('.fo-continue', root).hidden = false;
    setProgress(cards.length, cards.length);
    sound('summary', activePayload.theme, cards[best] ? rank(cards[best]) : 1);
    announce(`Apertura completata. ${cards.length} carte ottenute.`);
    window.setTimeout(()=>$('.fo-continue',root).focus({preventScroll:true}),80);
  }

  function skipToSummary(){
    if (!activePayload) return;
    clearAdvanceResolver();
    runToken += 1;
    const token = runToken;
    showSummary(orderCards(activePayload.cards || []), token);
  }

  function close(){
    if (!root || !root.classList.contains('is-active')) return;
    const resolver = activeResolve;
    runToken += 1;
    activeResolve = null;
    clearAdvanceResolver();
    activePayload = null;
    summaryShown = false;
    sequenceStarted = false;
    root.classList.remove('is-active');
    root.setAttribute('aria-hidden','true');
    document.body.classList.remove('futtu-opening-active');
    window.setTimeout(()=>{ if (scene) scene.dataset.phase = 'pack'; },240);
    if (typeof resolver === 'function') resolver();
  }

  function onKeyDown(event){
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (summaryShown) close();
    else skipToSummary();
  }

  function play(payload){
    ensureDom();
    if (!payload || !Array.isArray(payload.cards) || !payload.cards.length) return Promise.resolve();
    if (activeResolve) {
      const oldResolve = activeResolve;
      activeResolve = null;
      oldResolve();
    }
    runToken += 1;
    const token = runToken;
    showRoot(payload);
    return new Promise(resolve => { activeResolve = resolve; });
  }

  function announce(text){
    const live = root && $('.fo-sr-only', root);
    if (live) live.textContent = text;
  }

  function toggleMute(){
    muted = !muted;
    try { localStorage.setItem('futtu_opening_muted', muted ? '1' : '0'); } catch (error) {}
    updateSoundButton();
    if (!muted) {
      resumeAudio();
      sound('tease', mergeTheme());
    }
  }

  function updateSoundButton(){
    const button = root && $('.fo-sound', root);
    if (!button) return;
    button.textContent = muted ? '🔇' : '🔊';
    button.setAttribute('aria-label', muted ? 'Riattiva audio' : 'Disattiva audio');
  }

  function resumeAudio(){
    if (muted) return;
    try {
      /* Il core crea già il contesto audio sul primo click: riutilizzarlo evita
         i blocchi autoplay dopo login, Firestore o altre operazioni asincrone. */
      if (!audioContext && window.audioCtx) audioContext = window.audioCtx;
      if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
    } catch (error) {}
  }

  function osc(frequency, duration=.12, gain=.045, type='sine', delaySeconds=0){
    if (muted || !audioContext) return;
    const now = audioContext.currentTime + delaySeconds;
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    volume.gain.setValueAtTime(0.0001, now);
    volume.gain.exponentialRampToValueAtTime(Math.max(gain,.0002), now + .012);
    volume.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(volume).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + .03);
  }

  function noise(duration=.24, gain=.045){
    if (muted || !audioContext) return;
    const length = Math.max(1, Math.floor(audioContext.sampleRate * duration));
    const buffer = audioContext.createBuffer(1,length,audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<length;i+=1) data[i]=(Math.random()*2-1)*Math.pow(1-i/length,2);
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const volume = audioContext.createGain();
    source.buffer=buffer;filter.type='lowpass';filter.frequency.value=650;volume.gain.value=gain;
    source.connect(filter).connect(volume).connect(audioContext.destination);source.start();
  }

  function sound(kind, theme, power=1){
    if (muted || (theme && theme.sound === false)) return;
    resumeAudio();
    if (!audioContext) return;
    const boost = Math.min(Math.max(Number(power)||1,1),6);
    if (kind === 'charge') { osc(95,.7,.035,'sawtooth'); osc(142,.72,.025,'triangle',.05); }
    else if (kind === 'burst') { noise(.5,.09); osc(68,.5,.07,'sine'); }
    else if (kind === 'tease') { osc(220 + boost*18,.16,.025,'triangle'); }
    else if (kind === 'reveal') { osc(360 + boost*55,.22,.04,'sine'); osc(540 + boost*70,.3,.025,'triangle',.06); }
    else if (kind === 'walkout') { noise(.3,.055); osc(110,.55,.05,'sawtooth'); osc(220,.5,.035,'triangle',.08); }
    else if (kind === 'summary') { [0,4,7,12].forEach((semi,index)=>osc(220*Math.pow(2,semi/12),.36,.025,'sine',index*.055)); }
  }

  window.FUTTU_PACK_OPENING = {
    play,
    close,
    skip: skipToSummary,
    isWalkoutCard: isWalkout,
    rarityInfo,
    version: '1.1.0-manual-reveal'
  };
})();
