let EPISODES, VOLUMES, ARC_RANGES;
let MAX_ADAPTED_CHAPTER, chapterToEpisodes;
let currentSeries;
let currentEpisodeVariant;

function arcForChapter(num) {
  return ARC_RANGES.find(a => num >= a.start && num <= a.end) || null;
}

const volumeInput = document.getElementById('volumeInput');
const chapterInput = document.getElementById('chapterInput');
const episodeInput = document.getElementById('episodeInput');
const episodeInputLabel = document.getElementById('episodeInputLabel');
const volumeCard = document.getElementById('volumeCard');
const episodeCard = document.getElementById('episodeCard');
const matchSummary = document.getElementById('matchSummary');
// Manga-vs-anime difference notes, keyed by episode number.
// Only populated where a specific, verifiable difference is confirmed —
// not filled in for every episode. Add more entries here as they're found.
let programmatic = false;

function isDemonSlayerMovieMode() {
  return currentSeries?.id === 'demonslayer' && currentEpisodeVariant?.id === 'movies';
}

function animeEntryName() {
  return isDemonSlayerMovieMode() ? 'movie' : 'episode';
}

function rebuildEpisodeIndex() {
  const adaptedChapters = EPISODES.flatMap(ep =>
    ep.chapters.map(t => parseFloat(t)).filter(n => !isNaN(n))
  );
  MAX_ADAPTED_CHAPTER = adaptedChapters.length ? Math.max(...adaptedChapters) : 0;
  chapterToEpisodes = {};
  for (const ep of EPISODES) {
    for (const token of ep.chapters) {
      if (/^-?\d+(\.\d+)?$/.test(token.trim())) {
        const num = parseFloat(token);
        if (!chapterToEpisodes[num]) chapterToEpisodes[num] = [];
        chapterToEpisodes[num].push(ep.episode);
      }
    }
  }
}

function renderEpisodeVariants(series) {
  const box = document.getElementById('editionTabs');
  const variants = series.episodeVariants || [];
  box.classList.toggle('visible', variants.length > 0);
  box.innerHTML = variants.map(variant =>
    `<button type="button" class="edition-tab" data-variant="${escapeHtml(variant.id)}" onclick="setEpisodeVariant('${escapeHtml(variant.id)}')">${escapeHtml(variant.label)}</button>`
  ).join('');
}

function setEpisodeVariant(variantId, options = {}) {
  if (!currentSeries || !currentSeries.episodeVariants) return;
  const variant = currentSeries.episodeVariants.find(v => v.id === variantId) || currentSeries.episodeVariants[0];
  currentEpisodeVariant = variant;
  EPISODES = variant.episodes;
  episodeInputLabel.textContent = isDemonSlayerMovieMode() ? 'Movie' : 'Anime episode';
  episodeInput.placeholder = variant.episodePlaceholder;
  episodeInput.max = EPISODES[EPISODES.length - 1].episode;
  document.querySelectorAll('.edition-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.variant === variant.id);
  });
  rebuildEpisodeIndex();
  if (!options.preserve) clearAll();
}

function applySeries(id) {
  const s = SERIES[id];
  currentSeries = s;
  // Resolve each volume's own media once; chapter and episode lookups can then
  // render that same object without switching covers at a chapter boundary.
  VOLUMES = s.VOLUMES.map(vol => ({
    ...vol,
    cover: s.DEFAULT_COVERS[vol.volume] || null,
    fallbackCover: (s.FALLBACK_COVERS || {})[vol.volume] || null,
    vizUrl: s.VIZ_LINKS[vol.volume] || null,
    amazonUrl: s.AMAZON_LINKS[vol.volume] || null
  }));
  ARC_RANGES = s.ARC_RANGES;

  document.title = s.pageTitle;
  document.getElementById('wordmark').textContent = s.name;
  document.getElementById('lede').textContent = s.lede;
  const seoCopyEl = document.getElementById('seriesSeoCopy');
  if (seoCopyEl) seoCopyEl.innerHTML = `<p>${escapeHtml(s.seoCopy || '')}</p>`;
  const footerEl = document.getElementById('seriesFooter');
  const affiliateDisclosure = 'As an Amazon Associate, I earn from qualifying purchases. This helps support the website at no extra cost to you.';
  footerEl.innerHTML = s.footer.map(p => `<p>${p}</p>`).join('\n')
    + (Object.keys(s.AMAZON_LINKS).length ? `<p class="affiliate-disclosure">${affiliateDisclosure}</p>` : '')
    + '<p class="made-with-love">Made with love for anime and manga fans ♡</p>';
  volumeInput.placeholder = s.volumePlaceholder;
  chapterInput.placeholder = s.chapterPlaceholder;
  chapterInput.inputMode = id === 'jjk' ? 'decimal' : 'numeric';
  episodeInput.step = 'any';
  episodeInput.min = id === 'jjk' ? '0' : '1';
  episodeInputLabel.textContent = id === 'jjk' ? 'Anime episode or movie' : 'Anime episode';

  renderEpisodeVariants(s);
  if (s.episodeVariants && s.episodeVariants.length) {
    setEpisodeVariant(s.episodeVariants[0].id, { preserve: true });
  } else {
    currentEpisodeVariant = null;
    EPISODES = s.EPISODES;
    episodeInput.placeholder = s.episodePlaceholder;
    episodeInput.max = EPISODES[EPISODES.length - 1].episode;
    rebuildEpisodeIndex();
  }

  const tabId = id === 'dragonballz' ? 'dragonball' : id;
  document.querySelectorAll('.series-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.series === tabId);
  });
  const dbTabs = document.getElementById('dbSubtabs');
  if (dbTabs) {
    const isDB = id === 'dragonball' || id === 'dragonballz';
    dbTabs.classList.toggle('visible', isDB);
    dbTabs.querySelectorAll('.db-subtab').forEach(btn => btn.classList.toggle('active', btn.dataset.dbSeries === id));
  }

  clearAll();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function findVolumeForChapter(num) {
  return VOLUMES.find(v => num >= v.start && num <= v.end) || null;
}

function findClosestEpisodeForChapter(targetNum) {
  let best = null;
  let bestChapter = -Infinity;
  for (const ep of EPISODES) {
    for (const token of ep.chapters) {
      const n = parseFloat(token);
      if (isNaN(n)) continue;
      if (n <= targetNum && n > bestChapter) {
        bestChapter = n;
        best = ep;
      }
    }
  }
  return best;
}

function renderVolumeCard(vol, chapterNum, adaptationStatus = null) {
  if (!vol) {
    const v0 = VOLUMES[0], vN = VOLUMES[VOLUMES.length - 1];
    if (currentSeries.uncollectedStart && chapterNum >= currentSeries.uncollectedStart && chapterNum <= currentSeries.uncollectedEnd) {
      volumeCard.innerHTML = `<span class="tag special">Not collected yet</span><p class="card-title">Chapter ${chapterNum}</p><p class="card-detail">${escapeHtml(currentSeries.uncollectedMessage)}</p>`;
      return;
    }
    volumeCard.innerHTML = `<p class="empty">No volume covers that chapter (valid range: chapters ${v0.start}–${vN.end}, volume ${v0.volume}–${vN.volume}).</p>`;
    return;
  }
  const cover = vol.cover;
  const fallbackCover = vol.fallbackCover;
  const fallbackAttr = fallbackCover ? ` data-fallback="${escapeHtml(fallbackCover)}"` : '';
  const coverHtml = cover
    ? `<img src="${escapeHtml(cover)}"${fallbackAttr} alt="Volume ${vol.volume} cover" onerror="if(this.dataset.fallback&&!this.dataset.retried){this.dataset.retried='1';this.src=this.dataset.fallback;}else{this.parentElement.innerHTML='Vol. ${vol.volume}';}" />`
    : `Vol. ${vol.volume}`;

  const rangeLabel = vol.start < 0
    ? `Chapters ${vol.start} to ${vol.end} (prequel numbering)`
    : `Chapters ${vol.start}–${vol.end}`;

  const extrasLine = vol.extras
    ? `<p class="card-detail">Also includes: ${escapeHtml(vol.extras)}</p>`
    : '';

  const arcInfo = arcForChapter(chapterNum);
  const arcLine = arcInfo
    ? `<p class="card-detail">Arc: <strong>${escapeHtml(arcInfo.arc)}</strong>${arcInfo.subArc ? ' — ' + escapeHtml(arcInfo.subArc) : ''}</p>`
    : '';

  const originalSeriesTag = adaptationStatus === 'partial'
    ? '<span class="tag special">Partially adapted</span>'
    : adaptationStatus === 'unadapted'
      ? `<span class="tag special">${escapeHtml(currentSeries.notAdaptedTagText || 'Not yet adapted')}</span>`
      : adaptationStatus === 'missing'
        ? '<span class="tag special">No episode match in the data</span>'
        : chapterNum <= MAX_ADAPTED_CHAPTER || adaptationStatus === 'adapted'
          ? `<span class="tag jade" style="background:var(--jade-soft);color:var(--jade)">${escapeHtml(currentSeries.adaptedTagText || 'Adapted in the anime')}</span>`
          : `<span class="tag special">${escapeHtml(currentSeries.notAdaptedTagText || 'Not yet adapted')}</span>`;

  const vizUrl = vol.vizUrl;
  const amazonUrl = vol.amazonUrl;
  // Vinland Saga uses original Japanese volume numbers here. Kodansha's English
  // hardcovers combine two of those volumes, so the shop number can differ.
  const publisherVolumeNote = currentSeries.id === 'vinland'
    ? `<p class="card-detail">Kodansha English Vol. ${Math.ceil(vol.volume / 2)} corresponds to Japanese Vol. ${vol.volume}.</p>`
    : '';
  const getRow = (vizUrl || amazonUrl)
    ? `<div class="cover-col-links">
        <div class="get-row">
          ${vizUrl ? `<a href="${escapeHtml(vizUrl)}" target="_blank" rel="noopener" class="get-badge viz" title="${escapeHtml(currentSeries.publisherLabel || 'VIZ')}">${escapeHtml(currentSeries.publisherLabel || 'VIZ')}</a>` : ''}
          ${amazonUrl ? `<a href="${escapeHtml(amazonUrl)}" target="_blank" rel="sponsored noopener" class="get-badge amazon" title="Amazon">Amazon</a>` : ''}
        </div>
      </div>`
    : '';

  volumeCard.innerHTML = `
    <div class="volume-body">
      <div class="cover-col">
        <div class="cover-box" id="coverBox">${coverHtml}</div>
        ${getRow}
      </div>
      <div class="volume-info">
        ${originalSeriesTag}
        <p class="card-title">Vol. ${vol.volume}${vol.title ? ' — ' + escapeHtml(vol.title) : ''}</p>
        <p class="card-detail">${rangeLabel}</p>
        ${publisherVolumeNote}
        ${arcLine}
        ${extrasLine}
      </div>
    </div>
    ${amazonUrl ? '<p class="aff-note">Amazon link is an affiliate link</p>' : ''}
  `;
}

function renderEpisodeResult(ep) {
  if (!ep) {
    episodeCard.innerHTML = `<p class="empty">No ${animeEntryName()} data for that number (valid range: ${EPISODES[0].episode}–${EPISODES[EPISODES.length - 1].episode}).</p>`;
    return;
  }
  if (currentSeries.id === 'jjk' && ep.episode === 0) {
    episodeCard.innerHTML = `<span class="tag canon">Movie</span>
      <p class="card-title">Jujutsu Kaisen 0: The Movie</p>
      <p class="card-detail">Adapts manga chapters 0.1–0.4 in volume 0.</p>`;
    return;
  }
  let tag, detail;
  if (ep.filler) {
    tag = '<span class="tag filler">Filler</span>';
    detail = 'No manga content — pure anime-original material. Safe to skip if you only want canon.';
  } else if (ep.animeOriginal && !ep.chapters.length) {
    tag = '<span class="tag special">Anime original</span>';
    detail = `${escapeHtml(ep.animeOriginal)} No manga chapter or volume applies.`;
  } else if (ep.sourceLabel && !ep.chapters.length) {
    tag = '<span class="tag special">Novel adaptation</span>';
    detail = `Adapted from <strong>${escapeHtml(ep.sourceLabel)}</strong>; no manga chapter or volume applies.`;
  } else if (ep.mangaExtra && !ep.chapters.length) {
    tag = '<span class="tag special">Manga bonus story</span>';
    detail = `Adapts ${escapeHtml(ep.mangaExtra)}; no numbered manga chapter applies.`;
  } else {
    tag = '<span class="tag canon">Canon</span>';
    detail = `Adapts chapter${ep.chapters.length > 1 ? 's' : ''} <strong>${ep.chapters.join(', ')}</strong>`;
  }

  episodeCard.innerHTML = `
    ${tag}
    <p class="card-title">${isDemonSlayerMovieMode() ? 'Movie' : 'Episode'} ${ep.episode}${ep.title ? ' — ' + escapeHtml(ep.title) : ''}</p>
    <p class="card-detail">${detail}</p>
  `;
}

function renderChapterBeyondData(targetNum) {
  const entry = animeEntryName();
  episodeCard.innerHTML = `
    <span class="tag special">Beyond current data</span>
    <p class="card-title">Chapter ${targetNum} isn't in this tool's ${entry} data yet</p>
    <p class="card-detail">${entry === 'movie' ? 'Movie' : 'Episode'} data here only goes up through chapter ${MAX_ADAPTED_CHAPTER} (${entry} ${EPISODES[EPISODES.length - 1].episode}). ${escapeHtml(currentSeries.beyondDataHint)}</p>
  `;
}

function renderChapterResult(targetNum) {
  if (currentSeries.id === 'jjk' && targetNum >= 0.1 && targetNum <= 0.4 && chapterToEpisodes[targetNum]?.includes(0)) {
    episodeCard.innerHTML = `<span class="tag canon">Movie</span>
      <p class="card-title">Chapter ${targetNum} is adapted in Jujutsu Kaisen 0: The Movie</p>
      <p class="card-detail">The movie covers all four chapters of manga volume 0.</p>`;
    return;
  }
  const entry = animeEntryName();
  const exact = chapterToEpisodes[targetNum];
  if (exact && exact.length) {
    const epList = exact.map(n => `#${n}`).join(', ');
    episodeCard.innerHTML = `
      <span class="tag canon">Canon</span>
      <p class="card-title">Chapter ${targetNum} is adapted in ${entry}${exact.length > 1 ? 's' : ''} ${epList}</p>
      <p class="card-detail">Jump to <strong>${entry} ${exact[exact.length - 1]}</strong> to see this chapter animated.</p>
    `;
    return;
  }
  if (targetNum > MAX_ADAPTED_CHAPTER) {
    renderChapterBeyondData(targetNum);
    return;
  }
  const closest = findClosestEpisodeForChapter(targetNum);
  if (closest) {
    episodeCard.innerHTML = `
      <span class="tag special">Between ${entry}s</span>
      <p class="card-title">Chapter ${targetNum} isn't directly adapted</p>
      <p class="card-detail">The anime is caught up through <strong>${entry} ${closest.episode}</strong>${closest.title ? ` (${escapeHtml(closest.title)})` : ''}.</p>
    `;
    return;
  }
  episodeCard.innerHTML = `<p class="empty">No ${entry} data covers that chapter.</p>`;
}

// Core pivot: given a chapter number, update volume + episode fields and cards.
function syncFromChapter(chapterNum) {
  if (currentSeries.id === 'naruto' && currentSeries.episodeVariants) {
    const targetVariant = chapterNum >= 239 ? 'shippuden' : 'naruto';
    if (!currentEpisodeVariant || currentEpisodeVariant.id !== targetVariant) {
      setEpisodeVariant(targetVariant, { preserve: true });
    }
  }
  const vol = findVolumeForChapter(chapterNum);
  renderVolumeCard(vol, chapterNum);
  renderChapterResult(chapterNum);

  programmatic = true;
  if (vol) volumeInput.value = vol.volume;
  const exact = chapterToEpisodes[chapterNum];
  if (exact && exact.length) {
    episodeInput.value = exact[exact.length - 1];
  } else if (chapterNum <= MAX_ADAPTED_CHAPTER) {
    const closest = findClosestEpisodeForChapter(chapterNum);
    episodeInput.value = closest ? closest.episode : '';
  } else {
    episodeInput.value = '';
  }
  programmatic = false;
}

function clearAll() {
  programmatic = true;
  volumeInput.value = '';
  chapterInput.value = '';
  episodeInput.value = '';
  programmatic = false;
  volumeCard.innerHTML = '<p class="empty">Volume details will appear here.</p>';
  episodeCard.innerHTML = `<p class="empty">${isDemonSlayerMovieMode() ? 'Movie' : 'Episode'} details will appear here.</p>`;
  matchSummary.hidden = true;
}

// Keep the answer visible above the detailed cards, using the same mappings
// that power the chapter, volume and episode lookups.
function updateMatchSummary(source) {
  let heading, manga, anime;
  if (source === 'volume') {
    const vol = VOLUMES.find(v => String(v.volume) === volumeInput.value.trim());
    if (!vol) { matchSummary.hidden = true; return; }
    const { groups, status } = getVolumeAdaptation(vol);
    heading = `Volume ${vol.volume}`;
    manga = `Chapters ${vol.start}–${vol.end}`;
    anime = currentSeries.id === 'jjk' && vol.volume === 0
      ? 'Jujutsu Kaisen 0: The Movie'
      : groups.length
        ? groups.map(({ variant, episodes }) => {
            const movie = currentSeries.id === 'demonslayer' && variant.id === 'movies';
            const label = movie ? (episodes.length === 1 ? 'Movie' : 'Movies') : 'Episodes';
            return `${variant.label ? variant.label + ': ' : ''}${label} ${formatEpisodeRanges(episodes)}`;
          }).join(' · ') + (status === 'partial' ? ' · Partially adapted' : '')
        : status === 'unadapted' ? 'Not yet adapted' : 'No episode match in current data';
  } else if (source === 'chapter') {
    const raw = chapterInput.value.trim();
    if (!/^-?\d+(?:\.\d+)?$/.test(raw)) { matchSummary.hidden = true; return; }
    if (currentSeries.id === 'jjk' && raw === '0') {
      heading = 'Volume 0';
      manga = 'Chapters 0.1–0.4';
      anime = 'Jujutsu Kaisen 0: The Movie';
    } else {
      const number = Number(raw);
      const vol = findVolumeForChapter(number);
      heading = `Chapter ${raw}`;
      manga = vol ? `Volume ${vol.volume}` : 'No collected volume in current data';
      const exact = chapterToEpisodes[number] || [];
      anime = exact.length
        ? `${isDemonSlayerMovieMode() ? 'Movie' : 'Episode'}${exact.length > 1 ? 's' : ''} ${formatEpisodeRanges(exact)}`
        : number > MAX_ADAPTED_CHAPTER ? 'Beyond current anime data' : 'No direct episode match';
    }
  } else {
    const number = Number(episodeInput.value.trim());
    const ep = episodeInput.value.trim() ? EPISODES.find(e => e.episode === number) : null;
    if (!ep) { matchSummary.hidden = true; return; }
    heading = `${isDemonSlayerMovieMode() ? 'Movie' : 'Episode'} ${ep.episode}`;
    if (currentSeries.id === 'jjk' && ep.episode === 0) {
      manga = 'Chapters 0.1–0.4';
      anime = 'Volume 0';
    } else if (ep.chapters.length) {
      manga = `Chapter${ep.chapters.length > 1 ? 's' : ''} ${ep.chapters.join(', ')}`;
      const volumes = [...new Set(ep.chapters.map(Number).filter(Number.isFinite)
        .map(chapter => findVolumeForChapter(chapter)?.volume).filter(v => v !== undefined))];
      anime = volumes.length ? `Volume${volumes.length > 1 ? 's' : ''} ${volumes.join(', ')}` : 'No collected volume in current data';
    } else {
      manga = ep.filler ? 'Filler · No manga match' : 'No numbered manga chapter';
      anime = '';
    }
  }
  matchSummary.innerHTML = `<span class="match-summary-label">MATCH</span>
    <strong class="match-summary-heading">${escapeHtml(heading)}</strong>
    <span class="match-summary-arrow" aria-hidden="true">→</span>
    <span class="match-summary-values">${escapeHtml(manga)}${anime ? `<span class="match-summary-separator"> · </span>${escapeHtml(anime)}` : ''}</span>`;
  matchSummary.hidden = false;
}

// A volume is an inclusive chapter interval. Match every episode that adapts
// any chapter in it, including episodes shared with an adjacent volume.
function getVolumeAdaptation(vol) {
  const variants = currentSeries.episodeVariants || [
    { id: null, label: '', episodes: EPISODES }
  ];
  let maxAdaptedChapter = -Infinity;
  let lastChapterInVolume = -Infinity;
  const groups = variants.map(variant => {
    const matching = [];
    for (const ep of variant.episodes) {
      const chapters = ep.chapters.map(Number).filter(Number.isFinite);
      for (const chapter of chapters) {
        maxAdaptedChapter = Math.max(maxAdaptedChapter, chapter);
        if (chapter >= vol.start && chapter <= vol.end) {
          lastChapterInVolume = Math.max(lastChapterInVolume, chapter);
          if (!matching.includes(ep.episode)) matching.push(ep.episode);
        }
      }
    }
    return { variant, episodes: matching.sort((a, b) => a - b) };
  }).filter(group => group.episodes.length);
  const status = !groups.length
    ? (maxAdaptedChapter < vol.start ? 'unadapted' : 'missing')
    : maxAdaptedChapter < vol.end ? 'partial' : 'adapted';
  return { groups, status, lastChapterInVolume };
}

function formatEpisodeRanges(episodes) {
  const ranges = [];
  for (const number of episodes) {
    const last = ranges[ranges.length - 1];
    if (last && Number.isInteger(number) && number === last.end + 1) {
      last.end = number;
    } else {
      ranges.push({ start: number, end: number });
    }
  }
  return ranges.map(({ start, end }) => start === end ? `${start}` : `${start}–${end}`).join(', ');
}

function renderVolumeEpisodes(vol, adaptation) {
  const { groups, status, lastChapterInVolume } = adaptation;
  if (currentSeries.id === 'jjk' && vol.volume === 0) {
    episodeCard.innerHTML = `<span class="tag canon">Movie</span>
      <p class="card-title">Manga volume 0 is adapted in Jujutsu Kaisen 0: The Movie</p>
      <p class="card-detail">The prequel contains chapters 0.1–0.4.</p>`;
    return;
  }
  if (!groups.length) {
    episodeCard.innerHTML = `<span class="tag special">${status === 'unadapted' ? 'Not yet adapted' : currentSeries.id === 'demonslayer' ? 'No adaptation match' : 'No episode match'}</span>
      <p class="card-title">No ${currentSeries.id === 'demonslayer' ? 'TV episodes or movies' : 'anime episodes'} match volume ${vol.volume}</p>
      <p class="card-detail">${status === 'unadapted'
        ? 'This volume has not yet been adapted in the available anime data.'
        : `No ${currentSeries.id === 'demonslayer' ? 'TV episode or movie' : 'episode'} in the available data maps to chapters in this volume.`}</p>`;
    return;
  }
  const hasMovies = currentSeries.id === 'demonslayer' && groups.some(({ variant }) => variant.id === 'movies');
  const hasTV = groups.some(({ variant }) => variant.id !== 'movies');
  const adaptationName = hasMovies ? (hasTV ? 'episodes and movies' : 'movies') : 'episodes';
  const lines = groups.map(({ variant, episodes }) => {
    const entry = currentSeries.id === 'demonslayer' && variant.id === 'movies'
      ? (episodes.length === 1 ? 'Movie' : 'Movies') : 'Episodes';
    return `<p class="card-detail">${variant.label ? `${escapeHtml(variant.label)}: ` : ''}<strong>${entry} ${formatEpisodeRanges(episodes)}</strong></p>`;
  }).join('');
  const partialNote = status === 'partial'
    ? `<p class="card-detail">Only adapted through chapter ${lastChapterInVolume}. Chapters ${lastChapterInVolume + 1}–${vol.end} of this volume are not yet covered by the available anime data.</p>`
    : '';
  episodeCard.innerHTML = `<span class="tag ${status === 'partial' ? 'special' : 'canon'}">${status === 'partial' ? 'Partially adapted' : 'Canon'}</span>
    <p class="card-title">Volume ${vol.volume} appears in these ${adaptationName}</p>
    ${lines}${partialNote}`;
}

function handleVolumeChange() {
  if (programmatic) return;
  if (volumeInput.value.trim() === '') { clearAll(); return; }
  const val = Number(volumeInput.value.trim());
  const vol = VOLUMES.find(v => v.volume === val);
  if (!vol) {
    programmatic = true;
    chapterInput.value = '';
    episodeInput.value = '';
    programmatic = false;
    volumeCard.innerHTML = `<p class="empty">Enter a volume number (${VOLUMES[0].volume}–${VOLUMES[VOLUMES.length - 1].volume}).</p>`;
    episodeCard.innerHTML = `<p class="empty">${isDemonSlayerMovieMode() ? 'Movie' : 'Episode'} details will appear here.</p>`;
    return;
  }
  const adaptation = getVolumeAdaptation(vol);
  const firstGroup = adaptation.groups[0];
  if (firstGroup && firstGroup.variant.id && firstGroup.variant.id !== currentEpisodeVariant?.id) {
    setEpisodeVariant(firstGroup.variant.id, { preserve: true });
  }
  renderVolumeCard(vol, vol.start, adaptation.status);
  renderVolumeEpisodes(vol, adaptation);
  programmatic = true;
  chapterInput.value = vol.start;
  episodeInput.value = firstGroup ? firstGroup.episodes[0] : '';
  programmatic = false;
  trackTrackerUsed('volume');
}

function handleChapterChange() {
  if (programmatic) return;
  const input = chapterInput.value.trim();
  if (input === '') { clearAll(); return; }
  if (!/^-?\d+(?:\.\d+)?$/.test(input)) { clearAll(); return; }
  if (currentSeries.id === 'jjk' && input === '0') {
    syncFromChapter(0.1);
    episodeCard.innerHTML = `<span class="tag canon">Movie</span>
      <p class="card-title">Jujutsu Kaisen 0 is adapted in the movie</p>
      <p class="card-detail">The prequel manga is volume 0, with chapters 0.1–0.4; there is no single chapter 0.</p>`;
    trackTrackerUsed('chapter');
    return;
  }
  const val = Number(input);
  syncFromChapter(val);
  trackTrackerUsed('chapter');
}

function handleEpisodeChange() {
  if (programmatic) return;
  if (episodeInput.value.trim() === '') { clearAll(); return; }
  const val = parseFloat(episodeInput.value);
  if (isNaN(val)) { clearAll(); return; }
  const ep = EPISODES.find(e => e.episode === val);
  renderEpisodeResult(ep);

  if (!ep) {
    programmatic = true;
    chapterInput.value = '';
    volumeInput.value = '';
    programmatic = false;
    volumeCard.innerHTML = '<p class="empty">Volume details will appear here.</p>';
    return;
  }

  trackTrackerUsed('episode');

  if (ep.filler) {
    volumeCard.innerHTML = `<p class="empty">This is a filler ${animeEntryName()} — no manga chapter or volume applies.</p>`;
    programmatic = true;
    chapterInput.value = 'Filler';
    volumeInput.value = 'Filler';
    programmatic = false;
    return;
  }

  if (ep.animeOriginal && !ep.chapters.length) {
    volumeCard.innerHTML = `<p class="empty">${escapeHtml(ep.animeOriginal)} No manga chapter or volume applies.</p>`;
    programmatic = true;
    chapterInput.value = 'Original';
    volumeInput.value = 'Original';
    programmatic = false;
    return;
  }

  if (ep.sourceLabel && !ep.chapters.length) {
    volumeCard.innerHTML = `<p class="empty">This ${animeEntryName()} adapts ${escapeHtml(ep.sourceLabel)}, so no manga chapter or volume applies.</p>`;
    programmatic = true;
    chapterInput.value = 'Novel';
    volumeInput.value = 'Novel';
    programmatic = false;
    return;
  }

  if (!ep.chapters.length) {
    volumeCard.innerHTML = `<p class="empty">${ep.mangaExtra ? `This ${animeEntryName()} adapts ${escapeHtml(ep.mangaExtra)}. ` : ''}No numbered manga chapter or volume applies.</p>`;
    programmatic = true;
    chapterInput.value = ep.mangaExtra ? 'Extra' : '';
    volumeInput.value = ep.mangaExtra ? 'Extra' : '';
    programmatic = false;
    return;
  }

  if (ep.chapters.length) {
    const nums = ep.chapters.map(t => parseFloat(t)).filter(n => !isNaN(n));
    if (nums.length) {
      const maxChapter = Math.max(...nums);
      programmatic = true;
      chapterInput.value = maxChapter;
      programmatic = false;
      const vol = findVolumeForChapter(maxChapter);
      renderVolumeCard(vol, maxChapter);
      programmatic = true;
      if (vol) volumeInput.value = vol.volume;
      programmatic = false;
    }
  }
}

volumeInput.addEventListener('input', () => { handleVolumeChange(); updateMatchSummary('volume'); });
chapterInput.addEventListener('input', () => { handleChapterChange(); updateMatchSummary('chapter'); });
episodeInput.addEventListener('input', () => { handleEpisodeChange(); updateMatchSummary('episode'); });

function switchDragonBallSeries(id) {
  applySeries(id);
  setView('series');
  document.querySelectorAll('.series-nav').forEach(el => el.classList.toggle('active', el.dataset.series === 'dragonball'));
  trackSeriesSelected(id);
  window.scrollTo({top:0, behavior:'smooth'});
}
