/* Pulso Empresarial service worker: siempre intenta la versión más reciente y, sin conexión,
   abre lo último guardado. */
const CACHE = 'pulso-v14';
// ruta relativa a la carpeta de la app (funciona con cualquier nombre de repositorio)
const rel = (p) => { const base = new URL(self.registration.scope).pathname; return p.startsWith(base) ? p.slice(base.length) : p; };
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'glossary.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(SHELL.map((u) => fetch(u, { cache: 'reload' }).then((r) => r.ok && c.put(u, r)).catch(() => {}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== 'meta-notif').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const same = url.origin === self.location.origin;
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !font) return; // imágenes de los medios: directo a la red
  // primero la red; si falla (sin conexión), lo guardado
  e.respondWith(fetch(e.request, same ? { cache: 'no-cache' } : undefined).then((res) => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(same ? rel(url.pathname) || './' : e.request, copy)); }
    return res;
  }).catch(async () => {
    const c = await caches.open(CACHE);
    const key = same ? (rel(url.pathname) || './') : e.request;
    return (await c.match(key)) || (await c.match(e.request, { ignoreSearch: true })) || (e.request.mode === 'navigate' ? c.match('index.html') : undefined);
  }));
});

// ---- Avisos de noticias ----
const META = 'meta-notif';
async function getMeta() { try { const c = await caches.open(META); const r = await c.match('state'); return r ? await r.json() : { on: false, seen: [] }; } catch (e) { return { on: false, seen: [] }; } }
async function setMeta(m) { const c = await caches.open(META); await c.put('state', new Response(JSON.stringify(m))); }
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'notif') e.waitUntil(setMeta({ on: e.data.on, seen: e.data.seen || [] }));
});
async function checkNews() {
  const m = await getMeta();
  if (!m.on || !m.seen.length) return;
  const res = await fetch('news.json?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) return;
  const d = await res.json();
  const seen = new Set(m.seen);
  const fresh = (d.top || []).map((id) => d.items.find((i) => i.id === id)).filter((i) => i && !seen.has(i.group || i.id));
  if (fresh.length) {
    const f = fresh[0];
    await self.registration.showNotification('Pulso Empresarial', { body: f.title + (fresh.length > 1 ? ' (+' + (fresh.length - 1) + ' destacadas más)' : ''), icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'admibrief', renotify: true, data: { id: f.id } });
  }
  await setMeta({ on: true, seen: d.items.map((i) => i.group || i.id).slice(0, 400) });
}
self.addEventListener('periodicsync', (e) => { if (e.tag === 'admibrief-news') e.waitUntil(checkNews().catch(() => {})); });
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const id = (e.notification.data && e.notification.data.id) || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const c = cs[0];
    if (c) { c.focus(); if (id) c.postMessage({ type: 'open', id }); return; }
    return self.clients.openWindow('./' + (id ? '#/n/' + id : ''));
  }));
});
