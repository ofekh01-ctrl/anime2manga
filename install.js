// A small, dismissible installation hint for phones only.
(() => {
  const dismissedKey = 'a2m-install-dismissed';
  const seenKey = 'a2m-install-seen-this-session';
  let installEvent = null;
  let banner = null;
  let dismissedInMemory = false;

  function stored(which, key) {
    try { return window[which].getItem(key) === '1'; } catch { return false; }
  }

  function remember(which, key) {
    try { window[which].setItem(key, '1'); } catch { /* Storage can be unavailable. */ }
  }

  function isPhone() {
    const ua = navigator.userAgent || '';
    const mobileUA = navigator.userAgentData?.mobile === true || /iPhone|iPod|Android.+Mobile/i.test(ua);
    return mobileUA && window.innerWidth <= 820 && window.matchMedia('(pointer: coarse)').matches;
  }

  function isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  }

  function eligible() {
    return isPhone() && !isInstalled() && !dismissedInMemory &&
      !stored('localStorage', dismissedKey) && !stored('sessionStorage', seenKey);
  }

  function hide() {
    if (banner) banner.hidden = true;
  }

  function dismiss() {
    dismissedInMemory = true;
    remember('localStorage', dismissedKey);
    hide();
  }

  function updateAction() {
    if (!banner) return;
    const button = banner.querySelector('.install-banner-action');
    const hint = banner.querySelector('.install-banner-hint');
    if (installEvent) {
      button.hidden = false;
      hint.hidden = true;
    } else {
      button.hidden = true;
      hint.hidden = false;
      hint.textContent = /iPhone|iPod/i.test(navigator.userAgent || '')
        ? 'Tap Share, then Add to Home Screen.'
        : 'Open your browser menu and choose Install app or Add to Home screen.';
    }
  }

  function show() {
    if (!eligible() || !document.body) return;
    banner = document.createElement('aside');
    banner.className = 'install-banner';
    banner.setAttribute('aria-label', 'Add Anime2Manga to your phone');
    banner.innerHTML = `
      <img class="install-banner-icon" src="/assets/icon-192.png" alt="" width="40" height="40">
      <div class="install-banner-copy">
        <strong>Keep Anime2Manga on your phone</strong>
        <p>Add it to your Home Screen for quick access.</p>
        <p class="install-banner-hint" hidden></p>
        <button class="install-banner-action" type="button" hidden>Add to Home Screen</button>
      </div>
      <button class="install-banner-close" type="button" aria-label="Dismiss install suggestion">×</button>`;
    banner.querySelector('.install-banner-close').addEventListener('click', dismiss);
    banner.querySelector('.install-banner-action').addEventListener('click', async () => {
      const prompt = installEvent;
      if (!prompt) return;
      installEvent = null;
      hide();
      remember('sessionStorage', seenKey);
      try {
        const choice = await prompt.prompt();
        if (choice?.outcome === 'accepted') dismiss();
      } catch { /* The browser may withdraw the install prompt. */ }
    });
    updateAction();
    document.body.appendChild(banner);
    remember('sessionStorage', seenKey);
  }

  window.addEventListener('beforeinstallprompt', event => {
    // Suppress a browser-generated install pop-up; the site offers its own hint on phones.
    event.preventDefault();
    if (!isPhone()) return;
    installEvent = event;
    updateAction();
  });
  window.addEventListener('appinstalled', dismiss);
  window.addEventListener('resize', () => { if (!isPhone() || isInstalled()) hide(); });
  document.addEventListener('DOMContentLoaded', () => {
    window.setTimeout(show, 6000);
  }, { once: true });
})();
