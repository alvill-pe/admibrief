/* AdmiBrief — app (sin frameworks). Lee news.json, que se regenera cada hora en GitHub Actions. */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const timeAgo = (ms) => {
    if (!ms) return '';
    const m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return 'ahora';
    if (m < 60) return 'hace ' + m + ' min';
    const h = Math.round(m / 60);
    if (h < 24) return 'hace ' + h + ' h';
    const d = Math.round(h / 24);
    return d === 1 ? 'ayer' : 'hace ' + d + ' días';
  };
  const fullDate = (ms) => new Date(ms).toLocaleString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  let toastT;
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2300); };

  const SECTIONS = [
    { id: 'top', label: 'Destacado' }, { id: 'peru', label: 'Perú' }, { id: 'pol', label: 'Política' },
    { id: 'eco', label: 'Economía' }, { id: 'world', label: 'Mundo' }, { id: 'adm', label: 'Administración' }
  ];
  const secLabel = (id) => (SECTIONS.find((s) => s.id === id) || {}).label || '';
  const DATA_KEY = 'ab2_data', SAVED_KEY = 'ab2_saved', FONT_KEY = 'ab2_font', SEC_KEY = 'ab2_sec';
  const REFRESH_MS = 5 * 60 * 1000;
  const SEEN_KEY = 'ab2_seen', NOTIF_KEY = 'ab2_notif';
  const desktop = window.matchMedia('(min-width: 1000px)');

  const state = {
    data: store.get(DATA_KEY, null), fetchedAt: 0, loading: false,
    section: store.get(SEC_KEY, 'top'), query: '', limit: 25,
    saved: store.get(SAVED_KEY, {}), newIds: new Set(), list: [], openId: null, font: store.get(FONT_KEY, 0)
  };
  if (!SECTIONS.some((s) => s.id === state.section)) state.section = 'top';

  // ------------------------------------------------------------ datos
  async function load(manual) {
    if (state.loading) return;
    state.loading = true; $('#btnRefresh').classList.add('spin'); renderStatus();
    try {
      const res = await fetch('news.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const changed = !state.data || state.data.generated !== data.generated;
      state.data = data; state.fetchedAt = Date.now();
      store.set(DATA_KEY, data);
      if (changed) detectNew(data);
      if (changed) { renderList(); if (desktop.matches && !state.openId) openFirst(); }
      if (manual) toast(changed ? 'Noticias actualizadas' : 'Ya tienes lo más reciente');
    } catch (e) {
      if (manual || !state.data) toast(navigator.onLine ? 'No se pudo actualizar. Intenta en un momento.' : 'Sin conexión: mostrando lo último guardado');
    } finally {
      state.loading = false; $('#btnRefresh').classList.remove('spin'); renderStatus(); renderInfo();
      if (!state.data) renderList();
    }
  }

  // ------------------------------------------------------------ novedades y avisos
  function detectNew(data) {
    const seenArr = store.get(SEEN_KEY, null);
    const all = data.items || [];
    if (seenArr) {
      const seen = new Set(seenArr);
      all.forEach((i) => { if (!seen.has(i.group || i.id)) state.newIds.add(i.group || i.id); });
      if (state.newIds.size && store.get(NOTIF_KEY, false)) notifyNew(data, state.newIds);
    }
    store.set(SEEN_KEY, all.map((i) => i.group || i.id).slice(0, 400));
    if (store.get(NOTIF_KEY, false)) syncSW();
  }
  async function showNote(title, body, id, tag) {
    const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: tag || 'admibrief', data: { id: id || '' }, renotify: true };
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready : null;
      if (reg && reg.showNotification) return await reg.showNotification(title, opts);
      new Notification(title, opts);
    } catch (e) {}
  }
  function notifyNew(data, fresh) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const top = (data.top || []).map((id) => data.items.find((i) => i.id === id)).filter((i) => i && fresh.has(i.group || i.id));
    if (!top.length) return;
    const first = top[0];
    const more = top.length > 1 ? ' (+' + (top.length - 1) + ' destacadas más)' : '';
    showNote('AdmiBrief · ' + secLabel((first.secs && first.secs[0]) || first.sec), first.title + more, first.id);
  }
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const detectOS = () => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'pc';
  };
  function showOS(os) {
    document.querySelectorAll('#osTabs button').forEach((b) => b.classList.toggle('active', b.dataset.os === os));
    document.querySelectorAll('.steps').forEach((o) => (o.hidden = o.dataset.os !== os));
  }
  function renderNotif() {
    const st = $('#notifStatus'), btn = $('#btnNotif'), test = $('#btnNotifTest'), help = $('#notifHelp');
    const os = detectOS();
    if (!('Notification' in window)) {
      st.textContent = 'Este navegador no admite notificaciones.'; st.className = 'notif-status bad'; btn.hidden = true; test.hidden = true;
      help.textContent = os === 'ios' ? 'En iPhone/iPad (iOS 16.4 o superior) primero instala la app: Safari → Compartir → Agregar a inicio, y ábrela desde el ícono.' : '';
      return;
    }
    const perm = Notification.permission, on = perm === 'granted' && store.get(NOTIF_KEY, false);
    if (perm === 'denied') {
      st.textContent = 'Bloqueadas en este navegador.'; st.className = 'notif-status bad'; btn.hidden = true; test.hidden = true;
      help.textContent = 'Para activarlas, entra a los ajustes del sitio (ícono del candado junto a la dirección) y permite las notificaciones.'; return;
    }
    st.textContent = on ? 'Activadas: te avisaremos de las noticias más relevantes.' : 'Desactivadas.'; st.className = 'notif-status' + (on ? ' ok' : '');
    btn.hidden = false; btn.textContent = on ? 'Desactivar notificaciones' : 'Activar notificaciones'; test.hidden = !on;
    help.textContent = (os === 'ios' && !isStandalone() ? 'En iPhone las notificaciones solo funcionan con la app instalada en el inicio (iOS 16.4 o superior). ' : '') +
      'Los avisos llegan cuando abres la app o la dejas abierta en segundo plano; en Chrome de Android y PC también se revisan novedades de vez en cuando aunque esté cerrada.';
  }
  async function toggleNotif() {
    if (!('Notification' in window)) return;
    if (store.get(NOTIF_KEY, false) && Notification.permission === 'granted') { store.set(NOTIF_KEY, false); renderNotif(); toast('Notificaciones desactivadas'); syncSW(); return; }
    let perm = Notification.permission;
    if (perm !== 'granted') { try { perm = await Notification.requestPermission(); } catch (e) {} }
    if (perm === 'granted') {
      store.set(NOTIF_KEY, true); toast('Notificaciones activadas'); registerPeriodic(); syncSW();
      showNote('AdmiBrief', 'Listo. Te avisaremos de las noticias más relevantes.', '', 'welcome');
    }
    renderNotif();
  }
  function syncSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then((r) => r.active && r.active.postMessage({ type: 'notif', on: !!store.get(NOTIF_KEY, false), seen: store.get(SEEN_KEY, []) })).catch(() => {});
  }
  async function registerPeriodic() {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.periodicSync) await reg.periodicSync.register('admibrief-news', { minInterval: 60 * 60 * 1000 });
    } catch (e) {}
  }

  const items = () => (state.data && state.data.items) || [];
  const byId = (id) => items().find((i) => i.id === id) || state.saved[id];

  function computeList() {
    const all = items();
    if (state.query) {
      const q = norm(state.query).split(/\s+/).filter(Boolean);
      return all.filter((i) => { const t = norm(i.title + ' ' + i.summary.join(' ') + ' ' + i.source + ' ' + (i.admin && i.admin.concept)); return q.every((w) => t.includes(w)); })
        .sort((a, b) => b.date - a.date);
    }
    let list;
    if (state.section === 'top') {
      const top = (state.data && state.data.top) || [];
      list = top.map((id) => all.find((i) => i.id === id)).filter(Boolean);
      const seen = new Set(list.map((i) => i.group));
      list = list.concat(all.filter((i) => !seen.has(i.group)));
    } else {
      list = all.filter((i) => (i.secs || [i.sec]).includes(state.section)).sort((a, b) => b.date - a.date);
    }
    // una sola tarjeta por historia (la misma noticia en varios medios)
    const groups = new Set();
    return list.filter((i) => { const g = i.group || i.id; if (groups.has(g)) return false; groups.add(g); return true; });
  }

  // ------------------------------------------------------------ lista
  function lead(i) {
    const t = (i.summary && i.summary[0]) || '';
    return t.length > 240 ? t.slice(0, 240).replace(/\s+\S*$/, '') + '…' : t;
  }

  function cardHTML(i, idx, opts) {
    const big = opts && opts.big;
    const rank = opts && opts.rank ? '<span class="rank">' + String(opts.rank).padStart(2, '0') + '</span>' : '';
    const sec = (i.secs && i.secs[0]) || i.sec;
    const isNew = state.newIds.has(i.group || i.id) ? '<span class="new-tag">Nueva</span>' : '';
    const also = i.also && i.also.length ? '<span class="cov">+' + i.also.length + ' medios</span>' : '';
    const img = i.img ? '<div class="thumb"><img loading="lazy" referrerpolicy="no-referrer" src="' + esc(i.img) + '" alt="" onerror="this.parentNode.remove()"></div>' : '';
    return '<article class="card' + (big ? ' big' : '') + (i.id === state.openId ? ' current' : '') + '" data-id="' + i.id + '" tabindex="0" role="button" aria-label="' + esc(i.title) + '">' +
      (big ? img : '') +
      '<div class="card-main">' +
        '<div class="meta">' + rank + '<span class="sec sec-' + sec + '">' + esc(secLabel(sec)) + '</span>' + isNew + '<span class="src">' + esc(i.source) + '</span><span class="dot">·</span><time>' + timeAgo(i.date) + '</time></div>' +
        '<h3 class="title">' + esc(i.title) + '</h3>' +
        '<p class="lead">' + esc(lead(i)) + '</p>' +
        '<div class="card-foot"><span class="concept"><i></i>' + esc(i.admin ? i.admin.concept : '') + '</span>' + also +
          (state.saved[i.id] ? '<span class="saved-mark" aria-label="Guardada">★</span>' : '') + '</div>' +
      '</div>' + (big ? '' : img) +
    '</article>';
  }

  function renderList() {
    const feed = $('#feed');
    state.list = computeList();
    if (!state.list.length) {
      feed.innerHTML = state.loading || !state.data ? skeletons(5)
        : '<div class="empty"><h3>' + (state.query ? 'Sin resultados' : 'Sin noticias por ahora') + '</h3><p>' + (state.query ? 'Prueba con otra palabra.' : 'Toca actualizar en unos minutos.') + '</p></div>';
      return;
    }
    const isTop = state.section === 'top' && !state.query;
    let html = isTop ? '<div class="lead-label">Lo más relevante hoy</div>' : '';
    html += state.list.slice(0, state.limit).map((i, k) => cardHTML(i, k, isTop ? { big: k === 0, rank: k < 10 ? k + 1 : 0 } : null)).join('');
    if (state.list.length > state.limit) html += '<button class="btn-more" id="btnMore">Ver más noticias (' + (state.list.length - state.limit) + ')</button>';
    feed.innerHTML = html;
  }
  const skeletons = (n) => Array.from({ length: n }, () => '<div class="card skel"><div class="card-main"><i></i><i></i><i></i><i class="short"></i></div></div>').join('');

  function renderStatus() {
    const s = $('#status');
    if (state.loading && !state.data) { s.innerHTML = '<span class="pulse"></span>Cargando noticias…'; return; }
    if (!state.data) { s.textContent = ''; return; }
    const g = Date.parse(state.data.generated);
    s.innerHTML = (state.loading ? '<span class="pulse"></span>' : '') + 'Actualizado ' + timeAgo(g) + ' · ' + state.data.items.length + ' noticias';
  }

  function renderTabs() {
    $('#tabs').innerHTML = SECTIONS.map((s) => '<button class="tab' + (s.id === state.section ? ' active' : '') + '" data-sec="' + s.id + '">' + s.label + '</button>').join('');
  }

  function renderSaved() {
    const list = Object.values(state.saved).sort((a, b) => (b._savedAt || 0) - (a._savedAt || 0));
    $('#savedBadge').hidden = !list.length; $('#savedBadge').textContent = list.length;
    $('#savedList').innerHTML = list.length ? list.map((i) => cardHTML(i)).join('')
      : '<div class="empty"><h3>Nada guardado todavía</h3><p>Abre una noticia y toca el marcador para guardarla.</p></div>';
  }

  function renderInfo() {
    if (!state.data) return;
    $('#lastUpdate').textContent = 'Última actualización: ' + fullDate(Date.parse(state.data.generated)) + '.';
    const by = {};
    (state.data.sources || []).forEach((s) => { (by[s.sec] = by[s.sec] || []).push(s); });
    $('#sourceList').innerHTML = SECTIONS.filter((s) => by[s.id]).map((s) => '<li><b>' + s.label + ':</b> ' +
      by[s.id].map((f) => '<span class="src-pill ' + (f.ok ? 'ok' : 'fail') + '">' + esc(f.name) + '</span>').join(' ') + '</li>').join('');
  }

  // ------------------------------------------------------------ lector
  function readerHTML(i) {
    const sec = (i.secs && i.secs[0]) || i.sec;
    const a = i.admin || {};
    const idx = state.list.findIndex((x) => x.id === i.id);
    const next = idx >= 0 ? state.list[idx + 1] : null;
    return '<div class="meta"><span class="sec sec-' + sec + '">' + esc(secLabel(sec)) + '</span><span class="src">' + esc(i.source) + '</span><span class="dot">·</span><time title="' + esc(fullDate(i.date)) + '">' + timeAgo(i.date) + '</time></div>' +
      '<h1 class="rd-title">' + esc(i.title) + '</h1>' +
      (i.img ? '<figure class="rd-img"><img referrerpolicy="no-referrer" src="' + esc(i.img) + '" alt="" onerror="this.parentNode.remove()"></figure>' : '') +
      '<section class="rd-section"><h2 class="rd-h">Resumen</h2>' + (i.summary || []).map((p) => '<p>' + esc(p) + '</p>').join('') + '</section>' +
      (i.points && i.points.length ? '<section class="rd-section"><h2 class="rd-h">Datos clave</h2><ul class="rd-points">' + i.points.map((p) => '<li>' + esc(p) + '</li>').join('') + '</ul></section>' : '') +
      '<section class="rd-admin"><div class="ins-kicker">Clave para el administrador</div>' +
        '<div class="rd-admin-head"><span class="ins-concept">' + esc(a.concept) + '</span><span class="chip">' + esc(a.area) + '</span>' + (a.pestel ? '<span class="chip ghost">PESTEL: ' + esc(a.pestel) + '</span>' : '') + '</div>' +
        '<p>' + esc(a.note) + '</p>' + (a.q ? '<p class="ins-q"><b>Para pensar:</b> ' + esc(a.q) + '</p>' : '') +
      '</section>' +
      (i.also && i.also.length ? '<p class="rd-also">También informaron: ' + i.also.map(esc).join(', ') + '.</p>' : '') +
      '<a class="btn-source" href="' + esc(i.link) + '" target="_blank" rel="noopener">Leer la nota completa en ' + esc(i.source) +
        '<svg viewBox="0 0 24 24" width="17" height="17"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></a>' +
      '<p class="rd-note">Resumen automático ' + (i.ai ? 'redactado con IA ' : '') + 'a partir de la nota publicada por ' + esc(i.source) + '. Para citar la información, consulta la fuente original.</p>' +
      (next ? '<button class="rd-next" data-next="' + next.id + '"><span>Siguiente noticia</span><b>' + esc(next.title) + '</b></button>' : '');
  }

  function openItem(id, fromHash) {
    const i = byId(id);
    if (!i) { closeReader(); return; }
    state.openId = id;
    $('#rdBody').innerHTML = readerHTML(i);
    $('#rdBarTitle').textContent = i.source;
    updateSaveBtn();
    $('#reader').hidden = false;
    document.body.classList.add('reading');
    $('#rdScroll').scrollTop = 0;
    document.querySelectorAll('.card.current').forEach((c) => c.classList.remove('current'));
    document.querySelectorAll('.card[data-id="' + id + '"]').forEach((c) => c.classList.add('current'));
    if (!fromHash) {
      const h = '#/n/' + id;
      if (desktop.matches || location.hash.startsWith('#/n/')) history.replaceState(null, '', h); else history.pushState(null, '', h);
    }
  }
  function closeReader() {
    state.openId = null;
    document.body.classList.remove('reading');
    if (!desktop.matches) $('#reader').hidden = true;
    document.querySelectorAll('.card.current').forEach((c) => c.classList.remove('current'));
  }
  function openFirst() { const f = state.list[0]; if (f) openItem(f.id); }
  function onHash() {
    const m = location.hash.match(/^#\/n\/(\w+)/);
    if (m) openItem(m[1], true);
    else if (!desktop.matches) closeReader();
  }
  function applyFont() {
    document.documentElement.style.setProperty('--rd-size', (18 + state.font * 1.5) + 'px');
  }
  function updateSaveBtn() {
    const on = !!state.saved[state.openId];
    $('#rdSave').classList.toggle('on', on);
    $('#rdSave').setAttribute('aria-label', on ? 'Quitar de guardados' : 'Guardar');
  }
  function toggleSave() {
    const id = state.openId; const i = byId(id); if (!i) return;
    if (state.saved[id]) { delete state.saved[id]; toast('Quitado de guardados'); }
    else { state.saved[id] = Object.assign({}, i, { _savedAt: Date.now() }); toast('Guardado para leer después'); }
    store.set(SAVED_KEY, state.saved);
    updateSaveBtn(); renderSaved(); renderList();
  }
  function share() {
    const i = byId(state.openId); if (!i) return;
    const text = i.title + '\n\n' + (i.summary[0] || '') + '\n\nClave para el administrador: ' + (i.admin ? i.admin.concept : '');
    if (navigator.share) navigator.share({ title: i.title, text, url: i.link }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(i.title + '\n' + i.link).then(() => toast('Enlace copiado'));
  }

  // ------------------------------------------------------------ navegación
  function switchView(id) {
    document.querySelectorAll('.view').forEach((v) => (v.hidden = v.id !== id));
    document.querySelectorAll('.bb-item').forEach((b) => b.classList.toggle('active', b.dataset.view === id));
    document.body.classList.toggle('on-news', id === 'viewNews');
    if (id === 'viewSaved') renderSaved();
    if (id === 'viewInfo') renderInfo();
    if (id === 'viewApp') renderNotif();
    if (!desktop.matches && location.hash.startsWith('#/n/')) history.back();
    window.scrollTo({ top: 0 });
  }

  function onListClick(e) {
    if (e.target.id === 'btnMore') { state.limit += 25; renderList(); return; }
    const card = e.target.closest('.card[data-id]');
    if (card) openItem(card.dataset.id);
  }

  function init() {
    const today = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('#today').textContent = today.charAt(0).toUpperCase() + today.slice(1);
    document.body.classList.add('on-news');
    applyFont();
    const bar = document.querySelector('.appbar');
    const setBarH = () => document.documentElement.style.setProperty('--appbar-h', bar.offsetHeight + 'px');
    setBarH(); if (window.ResizeObserver) new ResizeObserver(setBarH).observe(bar); else window.addEventListener('resize', setBarH);
    renderTabs(); renderList(); renderStatus(); renderSaved(); renderInfo();

    $('#tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      state.section = b.dataset.sec; state.limit = 25; state.query = ''; $('#searchInput').value = '';
      store.set(SEC_KEY, state.section);
      switchView('viewNews'); renderTabs(); renderList();
      b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      if (desktop.matches) openFirst();
    });
    ['#feed', '#savedList'].forEach((s) => {
      $(s).addEventListener('click', onListClick);
      $(s).addEventListener('keydown', (e) => { if (e.key === 'Enter') onListClick(e); });
    });
    $('#rdBody').addEventListener('click', (e) => { const n = e.target.closest('[data-next]'); if (n) openItem(n.dataset.next); });
    $('#rdBack').addEventListener('click', () => { if (location.hash.startsWith('#/n/') && !desktop.matches) history.back(); else closeReader(); });
    $('#rdSave').addEventListener('click', toggleSave);
    $('#rdShare').addEventListener('click', share);
    $('#rdFontUp').addEventListener('click', () => { state.font = Math.min(4, state.font + 1); store.set(FONT_KEY, state.font); applyFont(); });
    $('#rdFontDown').addEventListener('click', () => { state.font = Math.max(-2, state.font - 1); store.set(FONT_KEY, state.font); applyFont(); });
    $('#btnRefresh').addEventListener('click', () => load(true));
    $('#btnSearch').addEventListener('click', () => {
      const sb = $('#searchbar'); sb.hidden = !sb.hidden;
      if (!sb.hidden) { switchView('viewNews'); $('#searchInput').focus(); }
      else { state.query = ''; $('#searchInput').value = ''; renderList(); }
    });
    let qt;
    $('#searchInput').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { state.query = e.target.value.trim(); state.limit = 25; renderList(); }, 200); });
    document.querySelectorAll('.bb-item').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.openId && !desktop.matches) $('#rdBack').click(); });

    // instalación
    let deferred;
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('#btnInstall').hidden = false; });
    $('#btnInstall').addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('#btnInstall').hidden = true; });
    window.addEventListener('appinstalled', () => { deferred = null; $('#btnInstall').hidden = true; renderInstall(); toast('AdmiBrief instalada'); });
    showOS(detectOS());
    $('#osTabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) showOS(b.dataset.os); });
    function renderInstall() { $('#installNow').textContent = isStandalone() ? '✓ Ya estás usando AdmiBrief como app.' : 'Elige tu dispositivo y sigue los pasos (toma menos de un minuto).'; }
    renderInstall();
    $('#btnNotif').addEventListener('click', toggleNotif);
    $('#btnNotifTest').addEventListener('click', () => showNote('AdmiBrief', 'Así se verán tus avisos de noticias relevantes.', '', 'test'));
    if (store.get(NOTIF_KEY, false)) { registerPeriodic(); syncSW(); }
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'open') { location.hash = '#/n/' + e.data.id; } });

    document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - state.fetchedAt > REFRESH_MS) load(false); });
    setInterval(renderStatus, 60000);
    setInterval(() => { if (!document.hidden || store.get(NOTIF_KEY, false)) load(false); }, REFRESH_MS);

    if (location.hash.startsWith('#/n/')) onHash();
    else if (desktop.matches && state.data) openFirst();
    load(false);

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  window.__AB = { state };
  document.addEventListener('DOMContentLoaded', init);
})();
