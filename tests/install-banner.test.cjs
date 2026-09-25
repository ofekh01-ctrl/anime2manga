const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'install.js'), 'utf8');

function storage() {
  const entries = new Map();
  return {
    getItem(key) { return entries.get(key) ?? null; },
    setItem(key, value) { entries.set(key, value); }
  };
}

function run({ ua, width, coarse = true, standalone = false, local = storage(), session = storage() }) {
  const windowEvents = new Map();
  const documentEvents = new Map();
  const appended = [];
  let timer;
  const window = {
    innerWidth: width,
    localStorage: local,
    sessionStorage: session,
    matchMedia(query) { return { matches: query.includes('pointer') ? coarse : standalone }; },
    addEventListener(name, handler) { windowEvents.set(name, handler); },
    setTimeout(handler) { timer = handler; }
  };
  const document = {
    body: { appendChild(element) { appended.push(element); } },
    addEventListener(name, handler) { documentEvents.set(name, handler); },
    createElement() {
      const elements = new Map();
      return {
        hidden: false,
        setAttribute() {},
        querySelector(selector) {
          if (!elements.has(selector)) elements.set(selector, {
            hidden: false,
            textContent: '',
            addEventListener(name, handler) { this[name] = handler; }
          });
          return elements.get(selector);
        }
      };
    }
  };
  vm.runInNewContext(source, { window, document, navigator: { userAgent: ua, standalone } });
  return {
    window, appended, local,
    event(name, value) { windowEvents.get(name)(value); },
    show() { documentEvents.get('DOMContentLoaded')(); timer(); }
  };
}

const desktop = run({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', width: 1440 });
desktop.show();
assert.equal(desktop.appended.length, 0, 'never offer an install banner on desktop');
const narrowDesktop = run({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', width: 390 });
narrowDesktop.show();
assert.equal(narrowDesktop.appended.length, 0, 'a narrow desktop window is still not a phone');

const androidUA = 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';
const android = run({ ua: androidUA, width: 390 });
android.show();
assert.equal(android.appended.length, 1, 'show an install hint on a phone');
const androidBanner = android.appended[0];
assert.match(androidBanner.querySelector('.install-banner-hint').textContent, /browser menu/);
androidBanner.querySelector('.install-banner-close').click();
assert.equal(androidBanner.hidden, true, 'close button hides the banner');
assert.equal(android.local.getItem('a2m-install-dismissed'), '1');
const afterDismissal = run({ ua: androidUA, width: 390, local: android.local });
afterDismissal.show();
assert.equal(afterDismissal.appended.length, 0, 'do not show again after dismissal');

let prompted = false;
const installable = run({ ua: androidUA, width: 390 });
installable.event('beforeinstallprompt', { preventDefault() {}, prompt() { prompted = true; return Promise.resolve({ outcome: 'accepted' }); } });
installable.show();
const action = installable.appended[0].querySelector('.install-banner-action');
assert.equal(action.hidden, false, 'show the native install action when available');
action.click();
assert.equal(prompted, true, 'the button invokes the browser install prompt');

const iphone = run({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', width: 390 });
iphone.show();
assert.match(iphone.appended[0].querySelector('.install-banner-hint').textContent, /Share, then Add to Home Screen/);
const installed = run({ ua: androidUA, width: 390, standalone: true });
installed.show();
assert.equal(installed.appended.length, 0, 'do not prompt from an installed app');

console.log('Checked mobile install hint, desktop exclusion, dismissal, and installed mode.');
