const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const dataSource = fs.readFileSync(path.join(__dirname, '..', 'series-data.js'), 'utf8');
const guide = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
assert.match(html, /<script src="\/navigation\.js\?v=[a-f0-9]{8}"><\/script>/);
assert.match(html, /<script src="\/series-data\.js\?v=[a-f0-9]{8}"><\/script>/);
assert.match(html, /<script src="\/app\.js\?v=[a-f0-9]{8}"><\/script>/);
const root = path.join(__dirname, '..');
const sharedBody = html.slice(html.indexOf('<body>'));
const seoSection = /<section class="seo-copy" id="seriesSeoCopy" aria-label="Series guide">[\s\S]*?<\/section>/;
const pageFolders = fs.readdirSync(root).filter(folder =>
  fs.existsSync(path.join(root, folder, 'index.html')));
assert.equal(pageFolders.length, 20, 'every series has a direct page');
for (const folder of pageFolders) {
  const page = fs.readFileSync(path.join(root, folder, 'index.html'), 'utf8');
  assert.equal(page.slice(page.indexOf('<body>')).replace(seoSection, '<section class="seo-copy" id="seriesSeoCopy" aria-label="Series guide"><p></p></section>'), sharedBody,
    `${folder} uses the current shared interface and scripts`);
  assert.ok(page.includes(`href="https://anime2manga.net/${folder}/" rel="canonical"`),
    `${folder} has its own canonical URL`);
}
for (const [folder, question, answer] of [
  ['bleach', 'What manga chapter is Bleach episode 1?', 'chapter 1 in volume 1'],
  ['jujutsu-kaisen', 'What manga chapters are in Jujutsu Kaisen episode 1?', 'chapters 1–2 in volume 1']
]) {
  const page = fs.readFileSync(path.join(root, folder, 'index.html'), 'utf8');
  assert.ok(page.includes(question) && page.includes(answer), `${folder} includes verifiable answers in static HTML`);
}
const localAssets = ['index.html', 'styles.css', 'series-data.js',
  'navigation.js', 'app.js', 'manifest.webmanifest']
  .flatMap(file => [...fs.readFileSync(path.join(root, file), 'utf8')
    .matchAll(/\/(assets\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*)/g)].map(match => match[1]));
for (const asset of new Set(localAssets)) {
  assert.ok(fs.existsSync(path.join(root, asset)), `${asset} is present`);
}
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    value: '', innerHTML: '', textContent: '', dataset: {},
    classList: { toggle() {} }, querySelectorAll() { return []; }, addEventListener() {}
  });
  return elements.get(id);
}
const context = vm.createContext({
  document: {
    body: { classList: { contains() { return false; }, toggle() {} } },
    getElementById: element,
    querySelectorAll() { return []; },
    createElement() { return { textContent: '', get innerHTML() { return this.textContent; } }; },
    addEventListener() {}
  },
  window: { location: { pathname: '/', search: '' }, addEventListener() {}, scrollTo() {} },
  URLSearchParams,
  trackTrackerUsed() {}
});
vm.runInContext(dataSource, context);
vm.runInContext(guide, context);

const series = vm.runInContext('SERIES', context);
const demonCovers = Object.values(series.demonslayer.DEFAULT_COVERS);
assert.equal(demonCovers.length, 23, 'Demon Slayer has a cover for every volume');
assert.equal(new Set(demonCovers).size, 23, 'Demon Slayer covers do not repeat');
assert.equal(series.demonslayer.DEFAULT_COVERS[15],
  'https://dw9to29mmj727.cloudfront.net/products/1974714780.jpg',
  'Demon Slayer volume 15 uses the VIZ volume 15 cover');
const onePieceCovers = Object.values(series.onepiece.DEFAULT_COVERS);
assert.equal(onePieceCovers.length, 113, 'One Piece has a cover for every original volume');
assert.equal(new Set(onePieceCovers).size, 113, 'One Piece never repeats a volume cover');
assert.ok(onePieceCovers.every(url => url.startsWith('https://dw9to29mmj727.cloudfront.net/products/')),
  'One Piece uses VIZ cover images rather than ISBN-based Open Library images');
for (const [id, count] of [['naruto', 72], ['jjk', 30], ['dragonball', 16], ['dragonballz', 26], ['chainsawman', 22]]) {
  const covers = Object.values(series[id].DEFAULT_COVERS);
  assert.equal(covers.length, count, `${id} has a cover for every VIZ English volume`);
  assert.equal(new Set(covers).size, count, `${id} uses distinct volume covers`);
  assert.ok(covers.every(url => /^https:\/\/dw9to29mmj727\.cloudfront\.net\/products\/[\dX]+\.jpg$/.test(url)),
    `${id} uses VIZ image links`);
}
assert.equal(series.chainsawman.DEFAULT_COVERS[23], undefined,
  'Chainsaw Man volume 23 has no VIZ English cover yet');
for (const [id, count, host] of [['bluelock', 37, /^https:\/\/images\d?\.penguinrandomhouse\.com\/cover\//],
  ['vinland', 29, /^https:\/\/dvs-cover\.kodansha\.co\.jp\//]]) {
  const covers = Object.values(series[id].DEFAULT_COVERS);
  assert.equal(covers.length, count, `${id} covers every original volume`);
  assert.equal(new Set(covers).size, count, `${id} never repeats a volume cover`);
  assert.ok(covers.every(url => host.test(url)), `${id} uses catalog images for each volume`);
}
assert.notEqual(series.vinland.DEFAULT_COVERS[1], series.vinland.DEFAULT_COVERS[2],
  'adjacent Japanese Vinland Saga volumes show their own covers');
assert.equal(series.bluelock.DEFAULT_COVERS[1], 'https://images4.penguinrandomhouse.com/cover/9781646516544');
const disclosure = 'As an Amazon Associate, I earn from qualifying purchases. This helps support the website at no extra cost to you.';
assert.ok(html.includes(disclosure), 'home description contains the affiliate disclosure');
let checked = 0;
for (const [id, data] of Object.entries(series)) {
  context.applySeries(id);
  if (data.seoFaq) {
    for (const item of data.seoFaq) {
      assert.ok(element('seriesSeoCopy').innerHTML.includes(item.question), `${id} shows its question after navigation`);
      assert.ok(element('seriesSeoCopy').innerHTML.includes(item.answer), `${id} shows its answer after navigation`);
    }
  }
  const isKodansha = ['aot', 'bluelock', 'vinland', 'gachiakuta'].includes(id);
  assert.equal(data.publisherLabel || 'VIZ', isKodansha ? 'Kodansha' : 'VIZ', `${id} publisher label`);
  if (Object.keys(data.AMAZON_LINKS).length) {
    assert.ok(element('seriesFooter').innerHTML.includes(disclosure), `${id} affiliate disclosure`);
  }
  if (id === 'deathnote') {
    assert.equal(Object.keys(data.AMAZON_LINKS).length, data.VOLUMES.length,
      'Death Note has an Amazon link for every original volume');
    assert.equal(new Set(Object.values(data.AMAZON_LINKS)).size, data.VOLUMES.length,
      'Death Note volume links are distinct');
  }
  if (id === 'aot') {
    assert.equal(Object.keys(data.AMAZON_LINKS).length, 34,
      'Attack on Titan has a direct Amazon link for every original volume');
    assert.equal(new Set(Object.values(data.AMAZON_LINKS)).size, 34,
      'Attack on Titan volume links are distinct');
    for (const [volume, isbn] of Object.entries({
      1: '1612620248', 16: '1612629806', 25: '1632366134',
      30: '1632369028', 34: '1646512367'
    })) {
      assert.equal(data.AMAZON_LINKS[volume],
        `https://www.amazon.com/dp/${isbn}?tag=mangatoanim01-20`,
        `Attack on Titan volume ${volume} matches the publisher's print ISBN`);
    }
  }
  for (const vol of data.VOLUMES) {
    element('volumeInput').value = String(vol.volume);
    context.handleVolumeChange();
    const volumeHtml = element('volumeCard').innerHTML;
    const resultHtml = element('episodeCard').innerHTML;
    assert.match(volumeHtml, new RegExp(`Vol\\. ${vol.volume}(?!\\d)`), `${id} volume ${vol.volume} title`);
    assert.equal(element('chapterInput').value, vol.start, `${id} volume ${vol.volume} starts inclusively`);
    const cover = data.DEFAULT_COVERS[vol.volume];
    if (cover) assert.ok(volumeHtml.includes(`src="${cover}"`), `${id} volume ${vol.volume} cover`);
    if (id === 'onepiece') {
      const isbn = data.AMAZON_LINKS[vol.volume]?.match(/\/dp\/([\dX]{10})(?:\?|$)/)?.[1];
      if (isbn) assert.ok(cover.endsWith(`/${isbn}.jpg`),
        `One Piece volume ${vol.volume} cover matches its English paperback ISBN`);
    }
    if (id === 'bleach') {
      const isbn = new URL(data.AMAZON_LINKS[vol.volume]).pathname.split('/').at(-1);
      assert.equal(cover, `https://dw9to29mmj727.cloudfront.net/products/${isbn}.jpg`,
        `Bleach volume ${vol.volume} uses its matching VIZ edition cover`);
    }
    if (id === 'deathnote') {
      const amazonUrl = data.AMAZON_LINKS[vol.volume];
      const product = new URL(amazonUrl);
      assert.equal(product.hostname, 'www.amazon.com');
      assert.equal(product.searchParams.get('tag'), 'mangatoanim01-20');
      assert.equal(product.pathname, `/dp/${cover.match(/\/([\dX]{10})\.jpg$/)[1]}`,
        `Death Note volume ${vol.volume} product matches the published cover ISBN`);
      assert.ok(volumeHtml.includes(`href="${amazonUrl}"`),
        `Death Note volume ${vol.volume} displays its Amazon link`);
    }
    if (id === 'aot') {
      const amazonUrl = data.AMAZON_LINKS[vol.volume];
      const product = new URL(amazonUrl);
      assert.equal(product.hostname, 'www.amazon.com');
      assert.match(product.pathname, /^\/dp\/[\dX]{10}$/);
      assert.equal(product.searchParams.get('tag'), 'mangatoanim01-20');
      assert.ok(volumeHtml.includes(`href="${amazonUrl}"`),
        `Attack on Titan volume ${vol.volume} displays its direct Amazon link`);
    }
    const publisherUrl = data.VIZ_LINKS[vol.volume];
    if (publisherUrl) {
      const url = new URL(publisherUrl);
      const expectedVolume = id === 'vinland' ? Math.ceil(vol.volume / 2) : vol.volume;
      assert.equal(url.hostname, isKodansha ? 'kodansha.us' : 'www.viz.com', `${id} volume ${vol.volume} publisher host`);
      assert.match(url.pathname, new RegExp(`volume-${expectedVolume}(?:-|/)(?:0/)?(?:product/\\d+)?$`),
        `${id} volume ${vol.volume} links to its ${isKodansha ? 'English' : ''} volume`);
      assert.ok(volumeHtml.includes(`href="${publisherUrl}"`), `${id} volume ${vol.volume} rendered publisher link`);
      assert.ok(volumeHtml.includes(`title="${isKodansha ? 'Kodansha' : 'VIZ'}"`), `${id} volume ${vol.volume} rendered publisher label`);
    }

    const groups = data.episodeVariants || [{ episodes: data.EPISODES }];
    const matches = groups.map(group => group.episodes.filter(ep =>
      ep.chapters.some(ch => Number(ch) >= vol.start && Number(ch) <= vol.end)
    ));
    const first = matches.find(group => group.length)?.[0];
    assert.equal(String(element('episodeInput').value), first ? String(first.episode) : '',
      `${id} volume ${vol.volume} first episode`);
    if (first) {
      const hasMovies = id === 'demonslayer' && matches[1]?.length;
      const adaptationName = hasMovies ? (matches[0]?.length ? 'episodes and movies' : 'movies') : 'episodes';
      assert.ok(resultHtml.includes(`Volume ${vol.volume} appears in these ${adaptationName}`),
        `${id} volume ${vol.volume} lists episodes`);
    } else {
      assert.ok(resultHtml.includes(id === 'demonslayer' ? 'No TV episodes or movies match' : 'No anime episodes match'),
        `${id} volume ${vol.volume} no adaptation`);
    }
    checked++;
  }
}

context.applySeries('demonslayer');
assert.equal(element('episodeInputLabel').textContent, 'Anime episode');
context.setEpisodeVariant('movies');
assert.equal(element('episodeInputLabel').textContent, 'Movie');
assert.match(element('episodeCard').innerHTML, /Movie details will appear here/);
element('episodeInput').value = '1';
context.handleEpisodeChange();
assert.match(element('episodeCard').innerHTML, /Movie 1 — Mugen Train/);
element('chapterInput').value = '145';
context.handleChapterChange();
assert.match(element('episodeCard').innerHTML, /Chapter 145 is adapted in movie #2/);
element('volumeInput').value = '17';
context.handleVolumeChange();
assert.match(element('episodeCard').innerHTML, /Volume 17 appears in these movies/);
assert.match(element('episodeCard').innerHTML, /Movies: <strong>Movie 2<\/strong>/);
context.setEpisodeVariant('tv');
assert.equal(element('episodeInputLabel').textContent, 'Anime episode');
element('episodeInput').value = '1';
context.handleEpisodeChange();
assert.match(element('episodeCard').innerHTML, /Episode 1 — Cruelty/);

context.applySeries('naruto');
element('volumeInput').value = '27';
context.handleVolumeChange();
assert.match(element('episodeCard').innerHTML, /Naruto:.*Naruto: Shippuden:/s);
assert.match(element('volumeCard').innerHTML, /Vol\. 27/);

context.applySeries('bleach');
element('volumeInput').value = '1';
context.handleVolumeChange();
const firstVolumeEpisodes = context.getVolumeAdaptation(series.bleach.VOLUMES[0]).groups[0].episodes;
element('volumeInput').value = '2';
context.handleVolumeChange();
const nextVolumeEpisodes = context.getVolumeAdaptation(series.bleach.VOLUMES[1]).groups[0].episodes;
assert.ok(firstVolumeEpisodes.some(ep => nextVolumeEpisodes.includes(ep)),
  'a boundary episode must appear in both volumes when it adapts chapters from both');
assert.match(element('volumeCard').innerHTML, /Vol\. 2/);
assert.ok(series.bleach.VIZ_LINKS[1].endsWith('/bleach-volume-1-0/product/167'), 'Bleach 1 links to its official edition');

context.applySeries('jjk');
element('volumeInput').value = '21';
context.handleVolumeChange();
assert.match(element('episodeCard').innerHTML, /Partially adapted/);
assert.match(element('volumeCard').innerHTML, /Vol\. 21/);

context.applySeries('chainsawman');
element('volumeInput').value = '7';
context.handleVolumeChange();
assert.match(element('episodeCard').innerHTML, /not yet been adapted/);
assert.match(element('volumeCard').innerHTML, /Vol\. 7/);
const chainsawAmazonCodes = [
  'B010SF7Ey', 'B0fLUTlq1', 'B07Ox2bqK', 'B02GTvTnA', 'B04oZ44KV',
  'B0ipZ0ped', 'B02MZZe9L', 'B04cijNTq', 'B0g8whOFV', 'B01gbTOFc',
  'B0ej62XHr', 'B06uEvyKR', 'B027snQwo', 'B0hbBnrcV', 'B04JF8LmK',
  'B06NMLdKn', 'B0gQdC0k8', 'B05oBEnD7', 'B04HDn3l5', 'B0etJ9DrK',
  'B0hsH0XMR', 'B022nmIqp', 'B0g9bJXTz'
];
assert.ok(element('seriesFooter').innerHTML.includes(disclosure));
for (const [index, code] of chainsawAmazonCodes.entries()) {
  const volume = index + 1;
  element('volumeInput').value = String(volume);
  context.handleVolumeChange();
  assert.ok(element('volumeCard').innerHTML.includes(`href="https://link.amazon/${code}"`),
    `Chainsaw Man volume ${volume} uses its supplied affiliate link`);
}
element('volumeInput').value = '24';
context.handleVolumeChange();
assert.doesNotMatch(element('volumeCard').innerHTML, /class="get-badge amazon"/);

context.applySeries('vinland');
element('volumeInput').value = '2';
context.handleVolumeChange();
assert.match(element('volumeCard').innerHTML, /Kodansha English Vol\. 1 corresponds to Japanese Vol\. 2/);
assert.match(element('volumeCard').innerHTML, /title="Kodansha"/);

context.applySeries('hxh');
element('volumeInput').value = '1';
context.handleVolumeChange();
assert.match(element('volumeCard').innerHTML, /title="Amazon">Amazon<\/a>/);

context.applySeries('onepiece');
const onePieceAmazonLinks = series.onepiece.AMAZON_LINKS;
assert.equal(Object.keys(onePieceAmazonLinks).length, 113, 'every listed One Piece volume has an Amazon link');
assert.equal(new Set(Object.values(onePieceAmazonLinks)).size, 113, 'each One Piece volume has its own product link');
for (let volume = 1; volume <= 111; volume++) {
  assert.match(onePieceAmazonLinks[volume],
    /^https:\/\/www\.amazon\.com\/dp\/[0-9X]{10}\?tag=mangatoanim01-20$/,
    `One Piece ${volume} links to an affiliate paperback product`);
}
assert.equal(onePieceAmazonLinks[106], 'https://www.amazon.com/dp/1974745864?tag=mangatoanim01-20');
element('volumeInput').value = '106';
context.handleVolumeChange();
assert.ok(element('volumeCard').innerHTML.includes(`href="${onePieceAmazonLinks[106]}"`));
for (let episode = 1175; episode <= 1180; episode++) {
  element('episodeInput').value = String(episode);
  context.handleEpisodeChange();
  assert.equal(String(element('chapterInput').value), String(episode - 30));
  assert.equal(String(element('volumeInput').value), '113');
}
assert.match(element('episodeCard').innerHTML, /Canon/);
element('chapterInput').value = '1150';
context.handleChapterChange();
assert.match(element('episodeCard').innerHTML, /is adapted in episode #1180/);
element('volumeInput').value = '112';
context.handleVolumeChange();
assert.equal(String(element('chapterInput').value), '1134');
assert.match(element('episodeCard').innerHTML, /Episodes 1164–1174/);
assert.match(element('volumeCard').innerHTML, /href="https:\/\/link\.amazon\/B07UPNgmh"/);
element('volumeInput').value = '113';
context.handleVolumeChange();
assert.match(element('episodeCard').innerHTML, /Episodes 1175–1180/);
assert.match(element('episodeCard').innerHTML, /Only adapted through chapter 1150/);
assert.match(element('volumeCard').innerHTML, /href="https:\/\/link\.amazon\/B05gsnkAe"/);
assert.equal(series.onepiece.VOLUMES.at(-1).end, 1155);

// New series: verify adaptation boundaries and publisher-sourced volume covers.
for (const [id, count] of [['mha', 42], ['blackclover', 38], ['fullmetal', 27]]) {
  const covers = Object.values(series[id].DEFAULT_COVERS);
  assert.equal(covers.length, count, `${id} has a cover for every volume`);
  assert.equal(new Set(covers).size, count, `${id} does not reuse a volume cover`);
  assert.ok(covers.every(url => url.startsWith('https://')), `${id} uses direct image URLs`);
}
context.applySeries('mha');
element('episodeInput').value = '171';
context.handleEpisodeChange();
assert.equal(String(element('chapterInput').value), '431');
assert.equal(String(element('volumeInput').value), '42');
assert.match(element('episodeCard').innerHTML, /More \(TV special\)/);
assert.equal(series.mha.DEFAULT_COVERS[42], 'https://dw9to29mmj727.cloudfront.net/products/1974759180.jpg');

context.applySeries('blackclover');
element('chapterInput').value = '271';
context.handleChapterChange();
assert.match(element('episodeCard').innerHTML, /Beyond current data/);
element('episodeInput').value = '140';
context.handleEpisodeChange();
assert.match(element('episodeCard').innerHTML, /Anime original/);
element('volumeInput').value = '38';
context.handleVolumeChange();
assert.match(element('volumeCard').innerHTML, /Vol\. 38/);
assert.doesNotMatch(element('volumeCard').innerHTML, /class="get-badge viz"/);
assert.ok(element('volumeCard').innerHTML.includes('src="https://dosbg3xlm0x1t.cloudfront.net/images/items/9784088851365/1200/9784088851365.jpg"'));

context.applySeries('fullmetal');
element('episodeInput').value = '64';
context.handleEpisodeChange();
assert.equal(String(element('chapterInput').value), '108');
assert.equal(String(element('volumeInput').value), '27');
element('episodeInput').value = '1';
context.handleEpisodeChange();
assert.match(element('episodeCard').innerHTML, /Anime original/);
assert.equal(series.fullmetal.DEFAULT_COVERS[27], 'https://dw9to29mmj727.cloudfront.net/products/1421539845.jpg');

// Every new volume uses its own publisher-hosted cover and exact publisher link.
for (const [id, count] of [['onepunchman', 36], ['gachiakuta', 24], ['spyxfamily', 50], ['frieren', 38]]) {
  assert.equal(series[id].EPISODES.length, count, `${id} includes every released TV episode`);
  const covers = Object.values(series[id].DEFAULT_COVERS);
  assert.equal(covers.length, series[id].VOLUMES.length, `${id} has a cover for every volume`);
  assert.equal(new Set(covers).size, covers.length, `${id} does not repeat any volume cover`);
  assert.ok(covers.every(url => url.startsWith('https://')), `${id} uses direct image links`);
  assert.equal(Object.keys(series[id].VIZ_LINKS).length, series[id].VOLUMES.length,
    `${id} has a publisher link for every listed volume`);
}
assert.equal(series.onepunchman.DEFAULT_COVERS[1], 'https://dw9to29mmj727.cloudfront.net/products/1421585642.jpg');
assert.equal(series.onepunchman.DEFAULT_COVERS[34], 'https://dw9to29mmj727.cloudfront.net/products/1974766527.jpg');
assert.equal(series.gachiakuta.DEFAULT_COVERS[12], 'https://production.image.azuki.co/0a5ab28d-a285-4989-a7c8-0dc8d0c1ec1c/800_5-7.webp');
assert.equal(Object.keys(series.gachiakuta.FALLBACK_COVERS).length, 12);
assert.equal(series.gachiakuta.FALLBACK_COVERS[1], 'https://images.penguinrandomhouse.com/cover/9798888770207');
assert.equal(series.gachiakuta.FALLBACK_COVERS[12], 'https://images.penguinrandomhouse.com/cover/9798888775363');
context.applySeries('onepunchman');
element('episodeInput').value = '36';
context.handleEpisodeChange();
assert.equal(String(element('chapterInput').value), '116');
assert.equal(String(element('volumeInput').value), '24');
assert.match(element('episodeCard').innerHTML, /111, 112, 113, 114, 115, 116/);
element('chapterInput').value = '117';
context.handleChapterChange();
assert.equal(String(element('volumeInput').value), '24');
assert.match(element('episodeCard').innerHTML, /Beyond current data/);
element('volumeInput').value = '24';
context.handleVolumeChange();
assert.match(element('volumeCard').innerHTML, /Vol\. 24/);
assert.ok(element('volumeCard').innerHTML.includes(`src="${series.onepunchman.DEFAULT_COVERS[24]}"`));

context.applySeries('gachiakuta');
element('episodeInput').value = '24';
context.handleEpisodeChange();
assert.equal(String(element('chapterInput').value), '87');
assert.equal(String(element('volumeInput').value), '11');
assert.match(element('episodeCard').innerHTML, /84, 85, 86, 87/);
element('chapterInput').value = '88';
context.handleChapterChange();
assert.equal(String(element('volumeInput').value), '11');
assert.match(element('episodeCard').innerHTML, /Beyond current data/);
element('volumeInput').value = '11';
context.handleVolumeChange();
assert.match(element('volumeCard').innerHTML, /Vol\. 11/);
assert.match(element('volumeCard').innerHTML, /title="Kodansha"/);
assert.ok(element('volumeCard').innerHTML.includes(`src="${series.gachiakuta.DEFAULT_COVERS[11]}"`));
assert.ok(element('volumeCard').innerHTML.includes(`data-fallback="${series.gachiakuta.FALLBACK_COVERS[11]}"`));

for (const [id, lastEpisode, lastChapter, nextChapter, nextVolume] of [
  ['spyxfamily', 50, 87, 88, 13], ['frieren', 38, 80, 81, 9]
]) {
  context.applySeries(id);
  element('episodeInput').value = String(lastEpisode);
  context.handleEpisodeChange();
  assert.equal(String(element('chapterInput').value), String(lastChapter));
  assert.equal(String(element('volumeInput').value), String(nextVolume));
  element('chapterInput').value = String(nextChapter);
  context.handleChapterChange();
  assert.equal(String(element('volumeInput').value), String(nextVolume));
  assert.match(element('episodeCard').innerHTML, /Beyond current data/);
  assert.ok(element('volumeCard').innerHTML.includes(`src="${series[id].DEFAULT_COVERS[nextVolume]}"`));
  assert.ok(element('volumeCard').innerHTML.includes(`href="${series[id].VIZ_LINKS[nextVolume]}"`));
}
context.applySeries('spyxfamily');
for (const [episode, mission] of [[12, 'Extra Mission 1'], [26, 'Extra Mission 2']]) {
  element('episodeInput').value = String(episode);
  context.handleEpisodeChange();
  assert.match(element('episodeCard').innerHTML, /Manga bonus story/);
  assert.ok(element('episodeCard').innerHTML.includes(mission));
  assert.equal(element('chapterInput').value, 'Extra');
  assert.equal(element('volumeInput').value, 'Extra');
  assert.doesNotMatch(element('volumeCard').innerHTML, /Vol\. \d+/);
}
element('chapterInput').value = '62';
context.handleChapterChange();
assert.match(element('episodeCard').innerHTML, /#39, #40/);
assert.equal(String(element('volumeInput').value), '10');
element('chapterInput').value = '68';
context.handleChapterChange();
assert.match(element('episodeCard').innerHTML, /isn't directly adapted/);
assert.doesNotMatch(element('episodeCard').innerHTML, /\(\)/);

context.applySeries('jjk');
element('chapterInput').value = '0.2';
context.handleChapterChange();
assert.match(element('episodeCard').innerHTML, /Chapter 0\.2 is adapted/,
  'decimal bonus chapters keep their exact number');

let episodeChecks = 0;
for (const [id, data] of Object.entries(series)) {
  context.applySeries(id);
  for (const variant of data.episodeVariants || [{ episodes: data.EPISODES }]) {
    if (variant.id) context.setEpisodeVariant(variant.id);
    const seen = new Set();
    for (const ep of variant.episodes) {
      assert.ok(!seen.has(ep.episode), `${id} episode ${ep.episode} is unique in its edition`);
      seen.add(ep.episode);
      element('episodeInput').value = String(ep.episode);
      context.handleEpisodeChange();
      assert.ok(element('episodeCard').innerHTML.includes(String(ep.episode)),
        `${id} episode ${ep.episode} renders details`);
      assert.doesNotMatch(element('episodeCard').innerHTML, /No (?:episode|movie) data for that number/,
        `${id} episode ${ep.episode} is found`);
      const numbers = ep.chapters.map(Number).filter(Number.isFinite);
      if (numbers.length) {
        const chapter = Math.max(...numbers);
        assert.equal(Number(element('chapterInput').value), chapter,
          `${id} episode ${ep.episode} selects its final adapted chapter`);
        const volume = data.VOLUMES.find(vol => chapter >= vol.start && chapter <= vol.end);
        if (volume) assert.equal(Number(element('volumeInput').value), volume.volume,
          `${id} episode ${ep.episode} selects the matching volume`);
      }
      episodeChecks++;
    }
  }
}

vm.runInContext(fs.readFileSync(path.join(root, 'navigation.js'), 'utf8'), context);
const paths = vm.runInContext('SERIES_PATHS', context);
for (const [id, route] of Object.entries(paths)) {
  if (id === 'dragonballz') continue; // Both Dragon Ball editions intentionally share one page.
  context.window.location.pathname = route;
  context.restoreViewFromUrl();
  assert.equal(element('wordmark').textContent, series[id].name,
    `${id} opens the correct series from its direct URL`);
}

console.log(`Checked ${checked} volume and ${episodeChecks} episode lookups across ${Object.keys(series).length} series.`);
