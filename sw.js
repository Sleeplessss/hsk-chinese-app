/* HSK app service worker: offline-first app.
   - app page: network-first (gets updates), falls back to cache offline
   - vocabulary data, stroke-order data, fonts, scripts: cache-first (downloaded once) */
var VER = 'd84c39b802';
var SHELL = 'hsk-shell-' + VER, RUNTIME = 'hsk-rt-v1';
var CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.2/dist/hanzi-writer.min.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) {
    return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () { }); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('hsk-shell-') === 0 && k !== SHELL; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'precache' && e.data.urls) {
    caches.open(RUNTIME).then(function (c) {
      e.data.urls.forEach(function (u) { c.match(u).then(function (hit) { if (!hit) c.add(u).catch(function () { }); }); });
    });
  }
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(SHELL).then(function (c) { c.put('index.html', copy); });
      return res;
    }).catch(function () { return caches.match('index.html').then(function (r) { return r || caches.match('./'); }); }));
    return;
  }
  var cacheable = url.origin === location.origin || /cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(url.hostname);
  if (!cacheable) return;
  e.respondWith(caches.match(req).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) { var copy = res.clone(); caches.open(RUNTIME).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  }));
});
