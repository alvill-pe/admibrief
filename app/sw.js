/* AdmiBrief service worker: siempre intenta la versión más reciente y, sin conexión,
   abre lo último guardado. */
const CACHE = 'admibrief-v4';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(SHELL.map((u) => fetch(u, { cache: 'reload' }).then((r) => r.ok && c.put(u, r)).catch(() => {}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const same = url.origin === self.location.origin;
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !font) return; // imágenes de los medios: directo a la red
  // primero la red; si falla (sin conexión), lo guardado
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(same ? url.pathname.replace(/^.*\/admibrief\//, '') || './' : e.request, copy)); }
    return res;
  }).catch(async () => {
    const c = await caches.open(CACHE);
    const key = same ? (url.pathname.replace(/^.*\/admibrief\//, '') || './') : e.request;
    return (await c.match(key)) || (await c.match(e.request, { ignoreSearch: true })) || (e.request.mode === 'navigate' ? c.match('index.html') : undefined);
  }));
});
