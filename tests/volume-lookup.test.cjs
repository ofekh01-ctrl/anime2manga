const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
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
    getElementById: element,
    querySelectorAll() { return []; },
    createElement() { return { textContent: '', get innerHTML() { return this.textContent; } }; }
  },
  trackTrackerUsed() {}
});
vm.runInContext(scripts.at(-1)[1], context);

const series = vm.runInContext('SERIES', context);
let checked = 0;
for (const [id, data] of Object.entries(series)) {
  context.applySeries(id);
  for (const vol of data.VOLUMES) {
    element('volumeInput').value = String(vol.volume);
    context.handleVolumeChange();
    const volumeHtml = element('volumeCard').innerHTML;
    const resultHtml = element('episodeCard').innerHTML;
    assert.match(volumeHtml, new RegExp(`Vol\\. ${vol.volume}(?!\\d)`), `${id} volume ${vol.volume} title`);
    assert.equal(element('chapterInput').value, vol.start, `${id} volume ${vol.volume} starts inclusively`);
    const cover = data.DEFAULT_COVERS[vol.volume];
    if (cover) assert.ok(volumeHtml.includes(`src="${cover}"`), `${id} volume ${vol.volume} cover`);

    const groups = data.episodeVariants || [{ episodes: data.EPISODES }];
    const matches = groups.map(group => group.episodes.filter(ep =>
      ep.chapters.some(ch => Number(ch) >= vol.start && Number(ch) <= vol.end)
    ));
    const first = matches.find(group => group.length)?.[0];
    assert.equal(String(element('episodeInput').value), first ? String(first.episode) : '',
      `${id} volume ${vol.volume} first episode`);
    if (first) {
      assert.ok(resultHtml.includes(`Volume ${vol.volume} appears in these episodes`),
        `${id} volume ${vol.volume} lists episodes`);
    } else {
      assert.ok(resultHtml.includes('No anime episodes match'), `${id} volume ${vol.volume} no adaptation`);
    }
    checked++;
  }
}

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

console.log(`Checked ${checked} volume lookups across ${Object.keys(series).length} series, plus overlap and adaptation boundaries.`);
