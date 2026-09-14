// Minimal service worker — required by Chrome for "Add to Home Screen" installability.
// This does not cache anything or provide offline support yet; it just needs to exist
// and respond to fetch events for the site to qualify as an installable PWA.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass-through: just fetch normally from the network.
  event.respondWith(fetch(event.request));
});
