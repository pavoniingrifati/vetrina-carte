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

const storageKey = 'fantaballa.objectives.saved.v1';
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
  const columns = window.matchMedia('(max-width: 980px)').matches ? 1 : 2;
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

updateNews(0);
restartNewsTimer();
loadObjectives();
