const tabs = Array.from(document.querySelectorAll('.tab'));
const panels = Array.from(document.querySelectorAll('.menu-panel'));
const newsImage = document.getElementById('newsImage');
const newsCaption = document.getElementById('newsCaption');
const newsKicker = document.getElementById('newsKicker');
const newsCounter = document.getElementById('newsCounter');
const prevNews = document.getElementById('prevNews');
const nextNews = document.getElementById('nextNews');

const objectivesList = document.getElementById('objectivesList');
const generateAllObjectives = document.getElementById('generateAllObjectives');
const clearSavedObjectives = document.getElementById('clearSavedObjectives');
const objectivesSaveStatus = document.getElementById('objectivesSaveStatus');
const subscribersList = document.getElementById('subscribersList');
const subscribersStatus = document.getElementById('subscribersStatus');

const newsSlides = [
  {
    image: 'assets/news-approved.webp',
    kicker: 'Aggiornamento',
    caption: 'Fantaballa Approved'
  },
  {
    image: 'assets/spacchetto.webp',
    kicker: 'Pacchetti',
    caption: 'Nuove carte e spacchetti'
  },
  {
    image: 'assets/database-carte.png',
    kicker: 'Database',
    caption: 'Carte, Hall of Fame e collezioni'
  }
];

const objectiveOrder = ['live', 'stagionali', 'match', 'cursed'];
const difficultyOrder = ['bronze', 'silver', 'gold'];
const difficultyLabels = {
  bronze: 'Bronzo',
  silver: 'Argento',
  gold: 'Oro'
};

const categoryFallback = {
  live: { label: 'Obiettivi Live', kicker: 'Live' },
  stagionali: { label: 'Obiettivi Stagionali', kicker: 'Stagione' },
  match: { label: 'Obiettivi Match', kicker: 'Partita' },
  cursed: { label: 'Obiettivi Cursed', kicker: 'Cursed' }
};

const worldCupCountries = [
  { code: 'mx', name: 'Messico' },
  { code: 'za', name: 'Sudafrica' },
  { code: 'kr', name: 'Corea del Sud' },
  { code: 'cz', name: 'Cechia' },
  { code: 'ca', name: 'Canada' },
  { code: 'ba', name: 'Bosnia Erzegovina' },
  { code: 'qa', name: 'Qatar' },
  { code: 'ch', name: 'Svizzera' },
  { code: 'br', name: 'Brasile' },
  { code: 'ma', name: 'Marocco' },
  { code: 'ht', name: 'Haiti' },
  { code: 'gb-sct', name: 'Scozia' },
  { code: 'us', name: 'Stati Uniti' },
  { code: 'py', name: 'Paraguay' },
  { code: 'au', name: 'Australia' },
  { code: 'tr', name: 'Turchia' },
  { code: 'de', name: 'Germania' },
  { code: 'cw', name: 'Curaçao' },
  { code: 'ci', name: "Costa d'Avorio" },
  { code: 'ec', name: 'Ecuador' },
  { code: 'nl', name: 'Paesi Bassi' },
  { code: 'jp', name: 'Giappone' },
  { code: 'se', name: 'Svezia' },
  { code: 'tn', name: 'Tunisia' },
  { code: 'be', name: 'Belgio' },
  { code: 'eg', name: 'Egitto' },
  { code: 'ir', name: 'Iran' },
  { code: 'nz', name: 'Nuova Zelanda' },
  { code: 'es', name: 'Spagna' },
  { code: 'cv', name: 'Capo Verde' },
  { code: 'sa', name: 'Arabia Saudita' },
  { code: 'uy', name: 'Uruguay' },
  { code: 'fr', name: 'Francia' },
  { code: 'sn', name: 'Senegal' },
  { code: 'iq', name: 'Iraq' },
  { code: 'no', name: 'Norvegia' },
  { code: 'ar', name: 'Argentina' },
  { code: 'dz', name: 'Algeria' },
  { code: 'at', name: 'Austria' },
  { code: 'jo', name: 'Giordania' },
  { code: 'pt', name: 'Portogallo' },
  { code: 'cd', name: 'RD Congo' },
  { code: 'uz', name: 'Uzbekistan' },
  { code: 'co', name: 'Colombia' },
  { code: 'gb-eng', name: 'Inghilterra' },
  { code: 'hr', name: 'Croazia' },
  { code: 'gh', name: 'Ghana' },
  { code: 'pa', name: 'Panama' }
];

const storageKey = 'fantaballa.objectives.saved.v1';
const subscribersEndpoint = 'data/abbonati.json';
let activePanelId = 'giocaPanel';
let currentNews = 0;
let newsTimer;
let objectivesData = null;

function getActivePanel() {
  return document.getElementById(activePanelId) || panels[0];
}

function getActiveTiles() {
  const panel = getActivePanel();
  return Array.from(panel.querySelectorAll('.tile'));
}

function getSelectedIndex() {
  const tiles = getActiveTiles();
  const selected = tiles.findIndex(tile => tile.classList.contains('is-selected'));
  return Math.max(selected, 0);
}

function setSelected(index) {
  const tiles = getActiveTiles();
  if (!tiles[index]) return;
  tiles.forEach(tile => tile.classList.remove('is-selected'));
  tiles[index].classList.add('is-selected');
}

function resetPanelSelection(panel) {
  const tiles = Array.from(panel.querySelectorAll('.tile'));
  tiles.forEach(tile => tile.classList.remove('is-selected'));
  if (tiles[0]) tiles[0].classList.add('is-selected');
}

function switchPanel(targetId) {
  if (!document.getElementById(targetId) || targetId === activePanelId) return;

  activePanelId = targetId;

  tabs.forEach(tab => {
    const isActive = tab.dataset.target === targetId;
    tab.classList.toggle('is-active', isActive);
    if (isActive) {
      tab.setAttribute('aria-current', 'page');
    } else {
      tab.removeAttribute('aria-current');
    }
  });

  panels.forEach(panel => {
    const isActive = panel.id === targetId;
    panel.hidden = !isActive;
    panel.classList.toggle('is-active', isActive);
    if (isActive) resetPanelSelection(panel);
  });
}

function openSelected() {
  const tiles = getActiveTiles();
  const selected = tiles[getSelectedIndex()];
  if (!selected || !selected.matches('a')) return;
  selected.click();
}

function moveSelection(direction) {
  const tiles = getActiveTiles();
  if (!tiles.length) return;

  const selectedIndex = getSelectedIndex();
  let columns = window.matchMedia('(max-width: 980px)').matches ? 1 : 2;
  if (activePanelId === 'worldCupPanel') {
    columns = window.matchMedia('(max-width: 980px)').matches ? 1 : 2;
  }
  let nextIndex = selectedIndex;

  if (direction === 'left') nextIndex -= 1;
  if (direction === 'right') nextIndex += 1;
  if (direction === 'up') nextIndex -= columns;
  if (direction === 'down') nextIndex += columns;

  if (nextIndex < 0 || nextIndex >= tiles.length) return;
  setSelected(nextIndex);
  tiles[nextIndex].focus({ preventScroll: true });
}

function updateNews(index) {
  if (!newsImage || !newsKicker || !newsCaption || !newsCounter) return;
  currentNews = (index + newsSlides.length) % newsSlides.length;
  const slide = newsSlides[currentNews];
  newsImage.src = slide.image;
  newsKicker.textContent = slide.kicker;
  newsCaption.textContent = slide.caption;
  newsCounter.textContent = `${currentNews + 1} / ${newsSlides.length}`;
}

function nextSlide() {
  updateNews(currentNews + 1);
}

function prevSlide() {
  updateNews(currentNews - 1);
}

function restartNewsTimer() {
  window.clearInterval(newsTimer);
  newsTimer = window.setInterval(nextSlide, 5200);
}

function shuffleArray(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function applyRandomWorldCupFlags() {
  const worldCupTiles = Array.from(document.querySelectorAll('[data-random-flag="true"]'));
  if (!worldCupTiles.length) return;

  const flags = shuffleArray(worldCupCountries);

  worldCupTiles.forEach((tile, index) => {
    const country = flags[index % flags.length];
    const media = tile.querySelector('.flag-media');
    const label = tile.querySelector('.world-flag-label');

    if (media) {
      media.style.backgroundImage = `url("https://flagcdn.com/w640/${country.code}.png")`;
    }

    if (label) {
      label.textContent = country.name;
    }
  });
}

function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function categoryInfo(categoryKey) {
  const source = objectivesData?.categories?.[categoryKey] || {};
  return {
    label: source.label || categoryFallback[categoryKey]?.label || 'Obiettivi',
    kicker: source.kicker || categoryFallback[categoryKey]?.kicker || 'Goals'
  };
}

function generateCategoryObjectives(categoryKey) {
  const category = objectivesData?.categories?.[categoryKey];
  const pools = category?.goals || category || {};

  return difficultyOrder.map(diff => ({
    difficulty: diff,
    text: pickRandom(pools[diff]) || `Aggiungi obiettivi ${difficultyLabels[diff].toLowerCase()} in data/obiettivi.json`
  }));
}

function generateAllCategoryObjectives() {
  return objectiveOrder.reduce((acc, categoryKey) => {
    acc[categoryKey] = generateCategoryObjectives(categoryKey);
    return acc;
  }, {});
}

function saveObjectives(generated) {
  const payload = {
    generatedAt: new Date().toISOString(),
    objectives: generated
  };
  localStorage.setItem(storageKey, JSON.stringify(payload));
  return payload;
}

function getSavedObjectives() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.objectives) return null;
    return parsed;
  } catch {
    return null;
  }
}

function formatDateTime(isoString) {
  if (!isoString) return '';
  try {
    return new Intl.DateTimeFormat('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(isoString));
  } catch {
    return '';
  }
}

function setStatus(message) {
  if (objectivesSaveStatus) objectivesSaveStatus.textContent = message;
}

function renderObjectives(payload) {
  if (!objectivesList || !payload?.objectives) return;

  objectiveOrder.forEach(categoryKey => {
    const holder = document.getElementById(`objectives-${categoryKey}`);
    if (!holder) return;

    const info = categoryInfo(categoryKey);
    const items = payload.objectives[categoryKey] || generateCategoryObjectives(categoryKey);

    holder.innerHTML = items.map(item => `
      <article class="objective-card ${categoryKey} ${item.difficulty}">
        <div class="objective-card-top">
          <span>${escapeHtml(info.kicker)}</span>
          <strong>${escapeHtml(difficultyLabels[item.difficulty] || item.difficulty)}</strong>
        </div>
        <div class="objective-card-rule">${escapeHtml(item.text)}</div>
        <div class="objective-card-foot">${escapeHtml(info.label)} • ${escapeHtml(difficultyLabels[item.difficulty] || item.difficulty)}</div>
      </article>
    `).join('');
  });

  const savedDate = formatDateTime(payload.generatedAt);
  setStatus(savedDate ? `Obiettivi salvati • ${savedDate}` : 'Obiettivi salvati');

  objectivesList.classList.remove('is-revealing');
  void objectivesList.offsetWidth;
  objectivesList.classList.add('is-revealing');
}

function createNewObjectives() {
  if (!objectivesData) return;
  const generated = generateAllCategoryObjectives();
  const saved = saveObjectives(generated);
  renderObjectives(saved);
}

function clearObjectivesSave() {
  localStorage.removeItem(storageKey);
  createNewObjectives();
}

async function loadObjectives() {
  if (!objectivesList) return;

  try {
    const res = await fetch('data/obiettivi.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    objectivesData = await res.json();
  } catch (error) {
    console.error(error);
    setStatus('Errore: non riesco a caricare data/obiettivi.json');
    objectivesList.innerHTML = '<div class="objectives-error">Errore nel caricamento degli obiettivi. Controlla che data/obiettivi.json sia presente.</div>';
    return;
  }

  const saved = getSavedObjectives();
  if (saved) {
    renderObjectives(saved);
  } else {
    createNewObjectives();
  }
}


function formatSubscriberDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function renderSubscribers(payload) {
  if (!subscribersList) return;

  const subscribers = Array.isArray(payload?.subscribers) ? payload.subscribers : [];
  const channel = payload?.channel || 'fantaballa';
  const source = payload?.source || 'manuale';
  const updated = payload?.updatedAt ? formatDateTime(payload.updatedAt) : '';

  if (subscribersStatus) {
    const suffix = updated ? ` • aggiornato ${updated}` : '';
    subscribersStatus.textContent = `${subscribers.length} abbonati caricati • fonte ${source} • twitch.tv/${channel}${suffix}`;
  }

  if (!subscribers.length) {
    subscribersList.innerHTML = `
      <div class="subscribers-empty">
        Nessun abbonato caricato per ora. La sezione è pronta: puoi aggiungere nomi manualmente in <strong>data/abbonati.json</strong> oppure collegarla più avanti a un backend Twitch.
      </div>
    `;
    return;
  }

  subscribersList.innerHTML = subscribers.map((subscriber, index) => {
    const name = subscriber.name || subscriber.login || `Abbonato ${index + 1}`;
    const tier = subscriber.tier || 'Sub';
    const since = formatSubscriberDate(subscriber.since);
    const giftedBy = subscriber.giftedBy ? `Gift di ${subscriber.giftedBy}` : '';
    const meta = [giftedBy, since ? `Dal ${since}` : '', subscriber.note || ''].filter(Boolean).join(' • ');

    return `
      <article class="subscriber-row">
        <span class="subscriber-rank">${String(index + 1).padStart(2, '0')}</span>
        <span class="subscriber-main">
          <strong class="subscriber-name">${escapeHtml(name)}</strong>
          <span class="subscriber-meta">${escapeHtml(meta || 'Abbonamento attivo')}</span>
        </span>
        <span class="subscriber-tier">${escapeHtml(tier)}</span>
      </article>
    `;
  }).join('');
}

async function loadSubscribers() {
  if (!subscribersList) return;

  try {
    const res = await fetch(subscribersEndpoint, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    renderSubscribers(payload);
  } catch (error) {
    console.error(error);
    if (subscribersStatus) subscribersStatus.textContent = 'Lista abbonati non disponibile.';
    subscribersList.innerHTML = `
      <div class="subscribers-empty">
        Non riesco a caricare <strong>data/abbonati.json</strong>. Controlla che il file sia presente nella cartella data.
      </div>
    `;
  }
}

document.addEventListener('mouseenter', event => {
  const tile = event.target.closest('.tile');
  if (!tile || !getActivePanel().contains(tile)) return;
  const tiles = getActiveTiles();
  setSelected(tiles.indexOf(tile));
}, true);

document.addEventListener('focusin', event => {
  const tile = event.target.closest('.tile');
  if (!tile || !getActivePanel().contains(tile)) return;
  const tiles = getActiveTiles();
  setSelected(tiles.indexOf(tile));
});

document.addEventListener('click', event => {
  const tile = event.target.closest('.tile');
  if (!tile) return;
  if (tile.classList.contains('is-disabled')) {
    event.preventDefault();
  }
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => switchPanel(tab.dataset.target));
});

if (prevNews) {
  prevNews.addEventListener('click', event => {
    event.stopPropagation();
    prevSlide();
    restartNewsTimer();
  });
}

if (nextNews) {
  nextNews.addEventListener('click', event => {
    event.stopPropagation();
    nextSlide();
    restartNewsTimer();
  });
}

if (generateAllObjectives) {
  generateAllObjectives.addEventListener('click', createNewObjectives);
}

if (clearSavedObjectives) {
  clearSavedObjectives.addEventListener('click', clearObjectivesSave);
}

window.addEventListener('keydown', event => {
  const keyMap = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down'
  };

  if (keyMap[event.key]) {
    event.preventDefault();
    moveSelection(keyMap[event.key]);
  }

  if (event.key === 'Enter') {
    openSelected();
  }
});

applyRandomWorldCupFlags();
updateNews(0);
restartNewsTimer();
loadObjectives();
loadSubscribers();
