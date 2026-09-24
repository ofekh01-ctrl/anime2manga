function toggleNav(force) {
  const open = typeof force === 'boolean' ? force : !document.body.classList.contains('nav-open');
  document.body.classList.toggle('nav-open', open);
}
function setView(view) {
  document.body.classList.toggle('view-home', view === 'home');
  document.body.classList.toggle('view-series', view === 'series');
  const home = document.getElementById('homeNav');
  if (home) home.classList.toggle('home-active', view === 'home');
  if (view === 'home') document.querySelectorAll('.series-nav').forEach(el => el.classList.remove('active'));
}
const SERIES_PATHS = {
  bleach: '/bleach/',
  chainsawman: '/chainsaw-man/',
  jjk: '/jujutsu-kaisen/',
  mha: '/my-hero-academia/',
  blackclover: '/black-clover/',
  fullmetal: '/fullmetal-alchemist/',
  onepunchman: '/one-punch-man/',
  gachiakuta: '/gachiakuta/',
  spyxfamily: '/spy-x-family/',
  frieren: '/frieren/',
  demonslayer: '/demon-slayer/',
  deathnote: '/death-note/',
  hxh: '/hunter-x-hunter/',
  dandadan: '/dandadan/',
  aot: '/attack-on-titan/',
  bluelock: '/blue-lock/',
  vinland: '/vinland-saga/',
  onepiece: '/one-piece/',
  naruto: '/naruto/',
  dragonball: '/dragon-ball/',
  dragonballz: '/dragon-ball/'
};
const PATH_TO_SERIES = Object.fromEntries(
  Object.entries(SERIES_PATHS).filter(([id]) => id !== 'dragonballz').map(([id, path]) => [path, id])
);

// Analytics helpers: track meaningful use without firing an event on every keystroke.
function trackAnalyticsEvent(name, params = {}) {
  if (typeof gtag !== 'function') return;
  gtag('event', name, params);
}

function trackSeriesSelected(id) {
  const s = SERIES[id];
  if (!s) return;
  trackAnalyticsEvent('series_selected', {
    series: id,
    series_name: s.name,
    page_path: SERIES_PATHS[id] || window.location.pathname
  });
}

function trackTrackerUsed(inputType) {
  if (!currentSeries) return;
  const key = `anime2manga_tracker_used_${currentSeries.id}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch (_) {}
  trackAnalyticsEvent('tracker_used', {
    series: currentSeries.id,
    series_name: currentSeries.name,
    input_type: inputType,
    page_path: SERIES_PATHS[currentSeries.id] || window.location.pathname
  });
}

function navSeries(id, options = {}) {
  applySeries(id);
  if (!options.skipHistory) {
    const path = SERIES_PATHS[id] || '/';
    history.pushState({ view: 'series', series: id }, '', path);
    trackSeriesSelected(id);
  }
  setView('series');
  document.querySelectorAll('.series-nav').forEach(el => el.classList.toggle('active', el.dataset.series === id));
  toggleNav(false);
  window.scrollTo({top:0, behavior:'smooth'});
}
function showHome(options = {}) {
  setView('home');
  if (!options.skipHistory) {
    history.pushState({ view: 'home' }, '', '/');
    document.title = 'Anime Episode to Manga Chapter Converter | Anime2Manga';
  }
  toggleNav(false);
  window.scrollTo({top:0, behavior:'smooth'});
}
function showAbout() {
  showHome();
  setTimeout(() => document.getElementById('about')?.scrollIntoView({behavior:'smooth', block:'start'}), 50);
}
function restoreViewFromUrl() {
  const normalizedPath = window.location.pathname.endsWith('/')
    ? window.location.pathname
    : window.location.pathname + '/';
  const pathId = PATH_TO_SERIES[normalizedPath];
  const legacyId = new URLSearchParams(window.location.search).get('series');
  const id = pathId || legacyId;
  if (id && SERIES[id]) {
    navSeries(id, { skipHistory: true });
  } else {
    showHome({ skipHistory: true });
    document.title = 'Anime Episode to Manga Chapter Converter | Anime2Manga';
  }
}
window.addEventListener('popstate', restoreViewFromUrl);
document.addEventListener('DOMContentLoaded', restoreViewFromUrl);


const HOME_SERIES_PER_PAGE = 12;
let homeSeriesPage = 1;
let homeSeriesSearch = '';

function getHomeSeriesCards() {
  return Array.from(document.querySelectorAll('#homeSeriesGrid .series-card'));
}

function ensureHomeSeriesNames() {
  getHomeSeriesCards().forEach(card => {
    if (!card.dataset.seriesName) {
      const name = card.querySelector('.series-card-name')?.textContent?.trim() || '';
      card.dataset.seriesName = name;
    }
  });
}

function renderHomeSeriesBrowser() {
  ensureHomeSeriesNames();
  const cards = getHomeSeriesCards();
  const query = homeSeriesSearch.trim().toLowerCase();
  const filtered = query
    ? cards.filter(card => card.dataset.seriesName.toLowerCase().startsWith(query))
    : cards;

  const pagination = document.getElementById('seriesPagination');
  const pageLabel = document.getElementById('seriesPageLabel');
  const prev = document.getElementById('prevSeriesPage');
  const next = document.getElementById('nextSeriesPage');
  const meta = document.getElementById('seriesSearchMeta');
  const suggestions = document.getElementById('seriesSearchSuggestions');
  const noResults = document.getElementById('seriesNoResults');
  const noResultsQuery = document.getElementById('seriesNoResultsQuery');

  suggestions.replaceChildren();
  if (query) {
    filtered.forEach(card => {
      const coming = card.classList.contains('coming-card');
      const item = document.createElement(coming ? 'div' : 'button');
      item.className = `series-search-suggestion${coming ? ' coming' : ''}`;
      if (!coming) {
        item.type = 'button';
        item.addEventListener('click', () => card.click());
      }
      const name = document.createElement('span');
      name.textContent = card.dataset.seriesName;
      item.appendChild(name);
      if (coming) {
        const label = document.createElement('small');
        label.textContent = 'Coming soon';
        item.appendChild(label);
      }
      suggestions.appendChild(item);
    });
  }
  suggestions.hidden = !query || !filtered.length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / HOME_SERIES_PER_PAGE));
  homeSeriesPage = Math.min(Math.max(homeSeriesPage, 1), totalPages);
  const start = (homeSeriesPage - 1) * HOME_SERIES_PER_PAGE;
  const end = start + HOME_SERIES_PER_PAGE;
  const visible = new Set(query ? filtered : filtered.slice(start, end));

  cards.forEach(card => {
    card.dataset.seriesHidden = visible.has(card) ? 'false' : 'true';
  });

  pagination.style.display = !query && totalPages > 1 ? 'flex' : 'none';
  noResults.hidden = !query || filtered.length > 0;
  noResultsQuery.textContent = `“${homeSeriesSearch.trim()}”`;
  pageLabel.textContent = `Page ${homeSeriesPage} of ${totalPages}`;
  prev.disabled = homeSeriesPage <= 1;
  next.disabled = homeSeriesPage >= totalPages;
  meta.hidden = !query;
  meta.textContent = query
    ? (filtered.length ? `${filtered.length} result${filtered.length === 1 ? '' : 's'} for “${homeSeriesSearch.trim()}”` : `No series found for “${homeSeriesSearch.trim()}”`)
    : '';
}

function changeSeriesPage(delta) {
  homeSeriesPage += delta;
  renderHomeSeriesBrowser();
  document.querySelector('.home-section-title')?.scrollIntoView({behavior:'smooth', block:'start'});
}

function runSeriesSearch() {
  const input = document.getElementById('seriesSearchInput');
  homeSeriesSearch = input ? input.value : '';
  homeSeriesPage = 1;
  renderHomeSeriesBrowser();
}

function focusSeriesSearch() {
  showHome();
  setTimeout(() => {
    const input = document.getElementById('seriesSearchInput');
    input?.scrollIntoView({behavior:'smooth', block:'center'});
    input?.focus();
  }, 80);
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('seriesSearchInput');
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter') runSeriesSearch();
  });
  input?.addEventListener('input', runSeriesSearch);
  renderHomeSeriesBrowser();
});
