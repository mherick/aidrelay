/* AidRelay service worker — makes the app installable and
   offline-capable. CACHE_VERSION must be bumped on every shipped build;
   activation deletes every older cache, so a phone never runs stale code. */
var CACHE_VERSION = 'aidrelay-v1';
var SHELL = ['./', './index.html', './styles.css', './app.js', './relay-core.js', './demo-data.js', './storage.js', './meta-ai.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon.svg'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE_VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE_VERSION ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(function (res) {
    var copy = res.clone();
    caches.open(CACHE_VERSION).then(function (c) { c.put(e.request, copy); });
    return res;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
