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
  const SEEN_KEY = 'ab2_seen', NOTIF_KEY = 'ab2_notif', MODE_KEY = 'ab2_mode', DAYS_KEY = 'ab2_days', BEST_KEY = 'ab2_best';
  const coarse = window.matchMedia('(pointer: coarse)');
  const desktop = window.matchMedia('(min-width: 1000px)');

  const state = {
    data: store.get(DATA_KEY, null), fetchedAt: 0, loading: false,
    section: store.get(SEC_KEY, 'top'), query: '', limit: 25,
    saved: store.get(SAVED_KEY, {}), newIds: new Set(), mode: store.get(MODE_KEY, 'student'), share: null, selText: '', list: [], openId: null, font: store.get(FONT_KEY, 0)
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
      if (changed) { renderDato(); renderList(); if (desktop.matches && !state.openId) openFirst(); }
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
  // ------------------------------------------------------------ utilidades de cifras
  const num = (n, d) => Number(n).toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d });
  function sparkSVG(vals, w, h, forceDir) {
    if (!vals || vals.length < 2) return '';
    const min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), r = max - min || 1;
    const xy = vals.map((v, k) => [k * (w - 4) / (vals.length - 1) + 2, h - 3 - (v - min) / r * (h - 6)]);
    const last = xy[xy.length - 1];
    const dir = forceDir || (vals[vals.length - 1] > vals[vals.length - 2] ? 'up' : vals[vals.length - 1] < vals[vals.length - 2] ? 'down' : 'flat');
    return '<svg class="spark ' + dir + '" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">' +
      '<polyline points="' + xy.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3" fill="currentColor"/></svg>';
  }
  function chgInfo(ind) {
    if (!ind) return { cls: 'flat', txt: '' };
    if (ind.level) {
      const d = ind.diff || 0;
      return d === 0 ? { cls: 'flat', txt: 'Sin cambio' } : { cls: d > 0 ? 'up' : 'down', txt: (d > 0 ? '▲ +' : '▼ −') + num(Math.abs(d), 2) + ' pp' };
    }
    const c = ind.chg || 0;
    return c === 0 ? { cls: 'flat', txt: 'Sin cambio' } : { cls: c > 0 ? 'up' : 'down', txt: (c > 0 ? '▲ +' : '▼ −') + num(Math.abs(c), 2) + '%' };
  }
  const chgHTML = (ind) => { const c = chgInfo(ind); return c.txt ? '<span class="chg ' + c.cls + '">' + c.txt + '</span>' : ''; };
  const macro = () => (state.data && state.data.macro) || null;
  const shortVal = (x) => x.text.replace(/ (por libra|la onza|el barril|puntos)$/, '');

  // cifras de la nota (para el modo Ejecutivo)
  const FIG_RE = /(?:(?:S\/|US\$|USD|\$|€)\s?\d[\d.,]*(?:\s(?:mil\s)?(?:millones|millón|billones|mil))?|\d[\d.,]*\s?(?:%|por ciento)|\d[\d.,]*\s(?:mil\s)?(?:millones|millón|billones)(?:\sde\s(?:soles|dólares|toneladas|personas|usuarios|clientes|trabajadores))?|\d[\d.,]*\s(?:puntos básicos|pbs|toneladas|soles|dólares|empleos|trabajadores|empresas))/giu;
  function figures(i) {
    const out = [], seen = new Set();
    const text = (i.points || []).concat(i.summary || []);
    for (const block of text) {
      for (const sen of block.split(/(?<=[.;])\s+/)) {
        FIG_RE.lastIndex = 0; let m;
        while ((m = FIG_RE.exec(sen)) && out.length < 4) {
          const v = m[0].trim().replace(/[.,]$/, '');
          const key = v.toLowerCase(); if (seen.has(key)) continue; seen.add(key);
          // la frase (entre comas) donde aparece la cifra
          const st = Math.max(sen.lastIndexOf(',', m.index), sen.lastIndexOf(';', m.index)) + 1;
          let en = sen.slice(m.index + m[0].length).search(/[,;]/); en = en < 0 ? sen.length : m.index + m[0].length + en;
          let ctx = sen.slice(st, en).replace(/\s+/g, ' ').trim();
          if (ctx.split(' ').length < 6) ctx = sen.replace(/\s+/g, ' ').trim();
          ctx = ctx.replace(/^(y|e|que|mientras que)\s/i, '').replace(/[.:]$/, '');
          if (ctx.length > 130) {
            const at = Math.max(0, ctx.indexOf(v) - 50);
            ctx = (at ? '…' + ctx.slice(at).replace(/^\S*\s/, '') : ctx);
            if (ctx.length > 130) ctx = ctx.slice(0, 128).replace(/\s+\S*$/, '') + '…';
          }
          out.push({ v, ctx: ctx.charAt(0).toUpperCase() + ctx.slice(1) });
        }
      }
    }
    return out;
  }

  // ------------------------------------------------------------ glosario (modo Estudiante)
  const GLOSS = (window.AB_GLOSSARY || []).map((g, n) => {
    try { return { n, t: g.t, d: g.d, re: new RegExp('(?<![\\p{L}\\d])(?:' + g.k + ')(?![\\p{L}\\d])', 'gu' + (g.cs ? '' : 'i')) }; } catch (e) { return null; }
  }).filter(Boolean);
  function glossify(text, used) {
    const hits = [];
    GLOSS.forEach((g) => {
      if (used.has(g.n)) return;
      g.re.lastIndex = 0; const m = g.re.exec(text);
      if (m) hits.push({ s: m.index, e: m.index + m[0].length, g });
    });
    hits.sort((a, b) => a.s - b.s || (b.e - b.s) - (a.e - a.s));
    let html = '', pos = 0;
    for (const h of hits) {
      if (h.s < pos || used.has(h.g.n) || used.size >= 16) continue;
      used.add(h.g.n);
      html += esc(text.slice(pos, h.s)) + '<button type="button" class="term" data-g="' + h.g.n + '">' + esc(text.slice(h.s, h.e)) + '</button>';
      pos = h.e;
    }
    return html + esc(text.slice(pos));
  }
  const GLOSS_BY_N = new Map(GLOSS.map((g) => [g.n, g]));
  function showTerm(btn) {
    const g = GLOSS_BY_N.get(+btn.dataset.g); if (!g) return;
    const pop = $('#termPop');
    if (!pop.hidden && pop._for === btn) { hideTerm(); return; }
    pop.innerHTML = '<span class="tp-k">Glosario</span><b>' + esc(g.t) + '</b><p>' + esc(g.d) + '</p>';
    pop.hidden = false; pop._for = btn;
    const r = btn.getBoundingClientRect(); const w = Math.min(320, window.innerWidth - 24);
    pop.style.width = w + 'px';
    pop.style.left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12) + 'px';
    const h = pop.offsetHeight;
    pop.style.top = (r.bottom + 8 + h > window.innerHeight - 76 ? Math.max(8, r.top - h - 8) : r.bottom + 8) + 'px';
    document.querySelectorAll('.term.on').forEach((t) => t.classList.remove('on'));
    btn.classList.add('on');
  }
  function hideTerm() { const pop = $('#termPop'); if (!pop || pop.hidden) return; pop.hidden = true; pop._for = null; document.querySelectorAll('.term.on').forEach((t) => t.classList.remove('on')); }

  // ------------------------------------------------------------ lector
  const SHARE_IC = '<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="18" cy="5" r="2.6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="19" r="2.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3" stroke="currentColor" stroke-width="2"/></svg>';
  const shareBtn = (kind, label) => '<button type="button" class="mini-share" data-share="' + kind + '" aria-label="' + esc(label) + '" title="' + esc(label) + '">' + SHARE_IC + '</button>';

  function modeSwitch() {
    const st = state.mode !== 'exec';
    return '<div class="mode-wrap"><div class="mode-switch" role="radiogroup" aria-label="Modo de vista">' +
      '<button type="button" role="radio" data-mode="student" aria-checked="' + st + '"' + (st ? ' class="on"' : '') + '>' +
        '<svg viewBox="0 0 24 24" width="17" height="17"><path d="M2 9l10-5 10 5-10 5z M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>Estudiante</button>' +
      '<button type="button" role="radio" data-mode="exec" aria-checked="' + !st + '"' + (!st ? ' class="on"' : '') + '>' +
        '<svg viewBox="0 0 24 24" width="17" height="17"><rect x="3" y="7" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M9 7V5h6v2M3 12h18" fill="none" stroke="currentColor" stroke-width="1.9"/></svg>Ejecutivo</button>' +
      '</div><span class="mode-hint">' + (st ? 'Toca las palabras subrayadas para ver qué significan.' : 'Cifras, contexto macro e implicancias, sin explicaciones básicas.') + '</span></div>';
  }

  function readerHTML(i) {
    const sec = (i.secs && i.secs[0]) || i.sec;
    const a = i.admin || {};
    const idx = state.list.findIndex((x) => x.id === i.id);
    const next = idx >= 0 ? state.list[idx + 1] : null;
    const exec = state.mode === 'exec';
    let h = modeSwitch() +
      '<div class="meta"><span class="sec sec-' + sec + '">' + esc(secLabel(sec)) + '</span><span class="src">' + esc(i.source) + '</span><span class="dot">·</span><time title="' + esc(fullDate(i.date)) + '">' + timeAgo(i.date) + '</time></div>' +
      '<h1 class="rd-title">' + esc(i.title) + '</h1>';

    if (!exec) {
      const used = new Set();
      h += (i.img ? '<figure class="rd-img"><img referrerpolicy="no-referrer" src="' + esc(i.img) + '" alt="" onerror="this.parentNode.remove()"></figure>' : '') +
        '<section class="rd-section"><h2 class="rd-h">Resumen</h2>' + (i.summary || []).map((p) => '<p>' + glossify(p, used) + '</p>').join('') + '</section>' +
        (i.points && i.points.length ? '<section class="rd-section"><h2 class="rd-h">Datos clave</h2><ul class="rd-points">' + i.points.map((p, k) => '<li><span>' + glossify(p, used) + '</span>' + shareBtn('point:' + k, 'Compartir este dato') + '</li>').join('') + '</ul></section>' : '') +
        '<section class="rd-admin"><div class="ins-top"><div class="ins-kicker">Clave para el administrador</div>' + shareBtn('admin', 'Compartir la clave para el administrador') + '</div>' +
          '<div class="rd-admin-head"><span class="ins-concept">' + esc(a.concept) + '</span><span class="chip">' + esc(a.area) + '</span>' + (a.pestel ? '<span class="chip ghost">PESTEL: ' + esc(a.pestel) + '</span>' : '') + '</div>' +
          '<p>' + esc(a.note) + '</p>' + (a.q ? '<p class="ins-q"><b>Para pensar:</b> ' + esc(a.q) + '</p>' : '') +
        '</section>';
      if (used.size) {
        h += '<section class="rd-section rd-gloss"><h2 class="rd-h">Glosario de esta noticia</h2><dl>' +
          [...used].map((n) => GLOSS_BY_N.get(n)).map((g) => '<div><dt>' + esc(g.t) + '</dt><dd>' + esc(g.d) + '</dd></div>').join('') + '</dl></section>';
      }
    } else {
      const figs = figures(i);
      if (figs.length) h += '<section class="rd-section"><h2 class="rd-h">Cifras clave</h2><div class="kpis">' +
        figs.map((f) => '<div class="kpi"><div class="kpi-v">' + esc(f.v) + '</div><div class="kpi-c">' + esc(f.ctx) + '</div></div>').join('') + '</div></section>';
      const brief = i.points && i.points.length ? i.points.map((p, k) => ({ t: p, k: 'point:' + k })) : (i.summary || []).slice(0, 2).map((p, k) => ({ t: p, k: 'para:' + k }));
      h += '<section class="rd-section"><h2 class="rd-h">En 30 segundos</h2><ul class="rd-points exec">' + brief.map((b) => '<li><span>' + esc(b.t) + '</span>' + shareBtn(b.k, 'Compartir') + '</li>').join('') + '</ul></section>';
      h += '<section class="rd-admin exec"><div class="ins-top"><div class="ins-kicker">Implicancia estratégica</div>' + shareBtn('admin', 'Compartir la implicancia') + '</div>' +
        '<div class="rd-admin-head"><span class="chip">' + esc(a.area) + '</span>' + (a.pestel ? '<span class="chip ghost">PESTEL: ' + esc(a.pestel) + '</span>' : '') + '<span class="chip ghost">' + esc(a.concept) + '</span></div>' +
        '<p>' + esc(a.note) + '</p></section>';
      const m = macro();
      if (m && m.indicators && m.indicators.length) {
        h += '<section class="rd-section"><h2 class="rd-h">Contexto macro</h2><div class="macro-grid">' +
          m.indicators.filter((x) => !x.hidden).map((x) => '<div class="mtile"><div class="mt-l">' + esc(x.label) + (/^(S\/|%)$/.test(x.unit) ? '' : ' · ' + esc(x.unit)) + '</div><div class="mt-v">' + esc(shortVal(x)) + '</div><div class="mt-f">' + chgHTML(x) + sparkSVG(x.spark, 64, 22, chgInfo(x).cls) + '</div></div>').join('') +
          '</div><p class="rd-src">Fuente: ' + esc(m.source) + '. Último dato disponible de cada indicador; la variación es frente al dato anterior.</p></section>';
      }
      h += '<details class="rd-more"><summary>Leer el resumen completo</summary>' + (i.summary || []).map((p) => '<p>' + esc(p) + '</p>').join('') + '</details>';
    }
    h += (i.also && i.also.length ? '<p class="rd-also">También informaron: ' + i.also.map(esc).join(', ') + '.</p>' : '') +
      '<a class="btn-source" href="' + esc(i.link) + '" target="_blank" rel="noopener">Leer la nota completa en ' + esc(i.source) +
        '<svg viewBox="0 0 24 24" width="17" height="17"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></a>' +
      '<p class="rd-note">Resumen automático ' + (i.ai ? 'redactado con IA ' : '') + 'a partir de la nota publicada por ' + esc(i.source) + '. Para citar la información, consulta la fuente original.</p>' +
      (next ? '<button class="rd-next" data-next="' + next.id + '"><span>Siguiente noticia</span><b>' + esc(next.title) + '</b></button>' : '');
    return h;
  }

  function openItem(id, fromHash, auto) {
    const i = byId(id);
    if (!i) { closeReader(); return; }
    state.openId = id;
    $('#rdBody').innerHTML = readerHTML(i);
    $('#rdBarTitle').textContent = i.source;
    updateSaveBtn();
    $('#reader').hidden = false;
    document.body.classList.add('reading');
    $('#rdScroll').scrollTop = 0;
    hideTerm(); hideSel();
    if (!auto) markRead();
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
  function openFirst() { const f = state.list[0]; if (f) openItem(f.id, false, true); }
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
  function setMode(m) {
    if (m === state.mode) return;
    state.mode = m; store.set(MODE_KEY, m);
    if (state.openId) openItem(state.openId, true, true);
    renderDato();
    toast(m === 'exec' ? 'Modo Ejecutivo: directo a cifras y estrategia' : 'Modo Estudiante: con glosario de términos');
  }

  // ------------------------------------------------------------ racha de lectura
  const dayKey = (t) => new Date(t == null ? Date.now() : t).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  function streakInfo() {
    const days = new Set(store.get(DAYS_KEY, []));
    const today = days.has(dayKey());
    let n = 0, t = Date.now() - (today ? 0 : 864e5);
    while (days.has(dayKey(t))) { n++; t -= 864e5; }
    const best = Math.max(store.get(BEST_KEY, 0), n);
    const week = [];
    for (let k = 6; k >= 0; k--) { const tt = Date.now() - k * 864e5; week.push({ on: days.has(dayKey(tt)), today: k === 0, l: new Date(tt).toLocaleDateString('es-PE', { weekday: 'narrow', timeZone: 'America/Lima' }).toUpperCase() }); }
    return { n, today, best, week };
  }
  function markRead() {
    const days = store.get(DAYS_KEY, []); const t = dayKey();
    if (days.includes(t)) return;
    days.push(t); store.set(DAYS_KEY, days.slice(-400));
    const s = streakInfo();
    if (s.n > store.get(BEST_KEY, 0)) store.set(BEST_KEY, s.n);
    renderDato();
    setTimeout(() => toast(s.n > 1 ? '¡Racha de ' + s.n + ' días! Vuelve mañana para mantenerla.' : 'Empezaste tu racha de lectura. ¡Vuelve mañana!'), 400);
  }

  // ------------------------------------------------------------ Dato del Día
  function renderDato() {
    const box = $('#dato'); if (!box) return;
    if (state.query) { box.innerHTML = ''; return; }
    const m = macro(), d = m && m.dato;
    const s = streakInfo();
    let h = '';
    if (d) {
      const ind = (m.indicators || []).find((x) => x.id === d.id) || d;
      const others = (m.indicators || []).filter((x) => !x.hidden && x.id !== d.id);
      h += '<section class="dato-card" aria-label="Dato del día">' +
        '<div class="dato-top"><span class="dato-kicker">Dato del día</span><span class="dato-lbl">' + esc(d.label) + '</span>' + shareBtn('dato', 'Compartir el dato del día') + '</div>' +
        '<div class="dato-row"><div class="dato-num"><span class="dato-val">' + esc(d.value) + '</span>' + chgHTML(ind) + '</div>' + sparkSVG(d.spark, 116, 46, 'neutral') + '</div>' +
        '<p class="dato-head">' + esc(d.headline) + '</p>' +
        '<p class="dato-sub">' + esc(d.sub) + ' Fuente: BCRP.</p>' +
        (state.mode === 'exec'
          ? '<div class="ticker">' + others.map((x) => { const c = chgInfo(x); return '<span class="tk"><b>' + esc(x.label) + '</b> ' + esc(shortVal(x)) + ' <i class="' + c.cls + '">' + c.txt.replace('Sin cambio', '=') + '</i></span>'; }).join('') + '</div>'
          : '<p class="dato-why"><b>¿Por qué importa?</b> ' + esc(d.why) + '</p>') +
      '</section>';
    }
    const msg = s.n === 0 ? 'Empieza tu racha: lee una noticia hoy.'
      : s.today ? 'Llevas <b>' + s.n + (s.n === 1 ? ' día' : ' días seguidos') + '</b> leyendo AdmiBrief.'
      : 'Llevas <b>' + s.n + (s.n === 1 ? ' día' : ' días seguidos') + '</b>. Lee una noticia hoy para no perder tu racha.';
    h += '<div class="streak' + (s.today ? ' done' : '') + '"><span class="flame" aria-hidden="true">' + (s.n ? '🔥' : '📖') + '</span>' +
      '<div class="streak-txt"><span>' + msg + '</span>' + (s.best > 1 ? '<small>Mejor racha: ' + s.best + ' días</small>' : '') + '</div>' +
      '<div class="week" aria-hidden="true">' + s.week.map((w) => '<i class="' + (w.on ? 'on' : '') + (w.today ? ' today' : '') + '">' + w.l + '</i>').join('') + '</div></div>';
    box.innerHTML = h;
  }

  // ------------------------------------------------------------ compartir
  const APP_URL = () => location.origin + location.pathname.replace(/index\.html$/, '');
  function fragment(kind) {
    if (kind === 'dato') {
      const m = macro(); if (!m || !m.dato) return null; const d = m.dato;
      const ind = (m.indicators || []).find((x) => x.id === d.id) || d; const c = chgInfo(ind);
      return { kind, label: 'Dato del día', title: d.headline, quote: d.sub + ' ' + d.why, big: d.value, chg: c.txt, dir: c.cls, source: 'BCRP', link: 'https://estadisticas.bcrp.gob.pe/' };
    }
    const i = byId(state.openId); if (!i) return null;
    const base = { kind, title: i.title, source: i.source, link: i.link };
    if (kind === 'news') return Object.assign(base, { label: 'Noticia', quote: lead(i) });
    if (kind === 'admin') return Object.assign(base, { label: state.mode === 'exec' ? 'Implicancia estratégica' : 'Clave para el administrador', quote: (i.admin || {}).note || '', extra: (i.admin || {}).concept });
    if (kind.indexOf('point:') === 0) return Object.assign(base, { label: 'Dato clave', quote: (i.points || [])[+kind.slice(6)] || '' });
    if (kind.indexOf('para:') === 0) return Object.assign(base, { label: 'Resumen', quote: (i.summary || [])[+kind.slice(5)] || '' });
    if (kind === 'sel') return Object.assign(base, { label: 'Fragmento', quote: state.selText });
    return null;
  }
  function shareText(f, net) {
    const B = (t) => (net === 'wa' || net === 'slack' ? '*' + t + '*' : t);
    const L = [];
    if (f.kind === 'news') L.push(B(f.title), '', f.quote, '', 'Nota completa en ' + f.source + ': ' + f.link);
    else if (f.kind === 'dato') L.push(B('Dato del día: ' + f.title), '', f.quote, '', 'Fuente: Banco Central de Reserva del Perú (BCRP)');
    else {
      L.push(B(f.label + (f.extra ? ' · ' + f.extra : '')));
      L.push(net === 'slack' ? '> ' + f.quote : '«' + f.quote + '»');
      L.push('', 'Noticia: ' + f.title + ' (' + f.source + ')', f.link);
    }
    L.push('', 'Vía AdmiBrief: ' + APP_URL());
    if (net === 'li') L.push('', '#Administración #Economía #Perú #Negocios');
    return L.join('\n');
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e2) {} ta.remove(); return ok;
    }
  }
  const loadImg = (src) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; });
  function wrapLines(x, text, maxW) {
    const words = text.split(/\s+/); const lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  }
  async function cardCanvas(f) {
    const W = 1080, H = 1080, P = 84; const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const SERIF = '"Source Serif 4", Georgia, serif', SANS = '"IBM Plex Sans", "Segoe UI", Arial, sans-serif';
    try { await Promise.all([document.fonts.load('700 60px "Source Serif 4"'), document.fonts.load('600 30px "IBM Plex Sans"')]); } catch (e) {}
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0B1F3A'); g.addColorStop(1, '#16305A'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#2F6FDF'; x.fillRect(0, 0, W, 14);
    const logo = await loadImg('icons/icon-192.png');
    if (logo) x.drawImage(logo, P, 74, 72, 72);
    x.fillStyle = '#FFFFFF'; x.font = '700 40px ' + SERIF; x.fillText('AdmiBrief', P + 92, 116);
    x.fillStyle = '#9FB3D1'; x.font = '500 24px ' + SANS; x.fillText(new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }), P + 92, 146);
    let y = 262;
    x.fillStyle = '#7AA8F7'; x.font = '700 28px ' + SANS; x.fillText(f.label.toUpperCase() + (f.extra ? '  ·  ' + f.extra.toUpperCase() : ''), P, y);
    y += 30;
    if (f.big) {
      x.fillStyle = '#FFFFFF'; x.font = '700 150px ' + SERIF; y += 140; x.fillText(f.big, P, y);
      if (f.chg) { x.fillStyle = f.dir === 'up' ? '#6FD59A' : f.dir === 'down' ? '#FF8A80' : '#B9C4D6'; x.font = '700 44px ' + SANS; y += 72; x.fillText(f.chg, P, y); }
      y += 40;
    }
    const main = f.kind === 'dato' || f.kind === 'news' ? f.title : '«' + (f.quote.length > 420 ? f.quote.slice(0, 418).replace(/\s+\S*$/, '') + '…' : f.quote) + '»';
    const bottom = H - 210; let size = 66, lines, lh;
    for (; size >= 30; size -= 2) { x.font = '600 ' + size + 'px ' + SERIF; lh = Math.round(size * 1.28); lines = wrapLines(x, main, W - 2 * P); if (y + lines.length * lh + 20 <= bottom) break; }
    x.fillStyle = '#FFFFFF'; y += 20;
    lines.forEach((l) => { y += lh; x.fillText(l, P, y - 12); });
    x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(P, H - 168, W - 2 * P, 2);
    x.fillStyle = '#C9D4E6'; x.font = '500 27px ' + SANS;
    let foot = f.kind === 'dato' ? 'Fuente: Banco Central de Reserva del Perú (BCRP)' : f.kind === 'news' ? 'Fuente: ' + f.source : 'Fuente: ' + f.source + ' · ' + f.title;
    while (x.measureText(foot).width > W - 2 * P && foot.length > 20) foot = foot.slice(0, -2).replace(/\s*\S*$/, '') + '…';
    x.fillText(foot, P, H - 116);
    x.fillStyle = '#7AA8F7'; x.font = '600 27px ' + SANS; x.fillText('Lee más en AdmiBrief · ' + APP_URL().replace(/^https?:\/\//, '').replace(/\/$/, ''), P, H - 74);
    return c;
  }
  async function openShare(kind) {
    const f = fragment(kind); if (!f || !f.quote && !f.big) return;
    state.share = f; state.shareCanvas = null;
    hideTerm(); hideSel();
    $('#shKind').textContent = f.label + (f.kind === 'news' || f.kind === 'dato' ? '' : ' · ' + f.source);
    $('#shQuote').textContent = f.kind === 'news' || f.kind === 'dato' ? f.title : f.quote;
    $('#shImg').removeAttribute('src'); $('#shImgWrap').classList.add('loading');
    $('#shareSheet').hidden = false; document.body.classList.add('sheet-open');
    setTimeout(() => $('#shareSheet').classList.add('show'), 10);
    try { const c = await cardCanvas(f); if (state.share !== f) return; state.shareCanvas = c; $('#shImg').src = c.toDataURL('image/png'); } catch (e) {}
    $('#shImgWrap').classList.remove('loading');
  }
  function closeShare() {
    const sh = $('#shareSheet'); sh.classList.remove('show'); document.body.classList.remove('sheet-open');
    setTimeout(() => { sh.hidden = true; }, 200);
  }
  async function shareImage(f) {
    const c = state.shareCanvas || await cardCanvas(f);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const file = new File([blob], 'admibrief-' + f.kind.replace(/\W/g, '-') + '.png', { type: 'image/png' });
    if (coarse.matches && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'AdmiBrief', text: shareText(f, 'plain') }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast('Imagen descargada: adjúntala en LinkedIn, WhatsApp o Slack');
  }
  async function doShare(net) {
    const f = state.share; if (!f) return;
    if (net === 'wa') { window.open('https://wa.me/?text=' + encodeURIComponent(shareText(f, 'wa')), '_blank', 'noopener'); }
    else if (net === 'li') {
      const t = shareText(f, 'li'); await copyText(t);
      window.open('https://www.linkedin.com/feed/?shareActive=true&text=' + encodeURIComponent(t), '_blank', 'noopener');
      toast('Abriendo LinkedIn. El texto también quedó copiado.');
    } else if (net === 'slack') {
      const t = shareText(f, 'slack');
      if (coarse.matches && navigator.share) { try { await navigator.share({ text: t }); } catch (e) {} }
      else { await copyText(t); window.open('https://app.slack.com/client', '_blank', 'noopener'); toast('Copiado con formato de Slack: pégalo en tu canal'); }
    } else if (net === 'img') { await shareImage(f); }
    else if (net === 'copy') { toast((await copyText(shareText(f, 'plain'))) ? 'Texto copiado' : 'No se pudo copiar'); }
  }
  // seleccionar texto dentro de la noticia → compartir fragmento
  let selT;
  function onSelection() {
    clearTimeout(selT);
    selT = setTimeout(() => {
      const sel = window.getSelection(); const t = sel ? String(sel).replace(/\s+/g, ' ').trim() : '';
      const inBody = sel && sel.rangeCount && $('#rdBody').contains(sel.getRangeAt(0).commonAncestorContainer);
      if (inBody && t.length >= 15 && t.length <= 700 && !$('#reader').hidden) { state.selText = t; $('#selShare').hidden = false; }
      else hideSel();
    }, 250);
  }
  function hideSel() { const b = $('#selShare'); if (b) b.hidden = true; }

  // ------------------------------------------------------------ navegación
  function switchView(id) {
    document.querySelectorAll('.view').forEach((v) => (v.hidden = v.id !== id));
    document.querySelectorAll('.bb-item').forEach((b) => b.classList.toggle('active', b.dataset.view === id));
    document.body.classList.toggle('on-news', id === 'viewNews');
    if (id === 'viewSaved') renderSaved();
    if (id === 'viewInfo') renderInfo();
    if (id === 'viewApp') renderNotif();
    if (id === 'viewNews') renderDato();
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
    renderTabs(); renderDato(); renderList(); renderStatus(); renderSaved(); renderInfo();

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
    $('#rdBody').addEventListener('click', (e) => {
      const t = e.target.closest('.term'); if (t) { e.stopPropagation(); showTerm(t); return; }
      const md = e.target.closest('[data-mode]'); if (md) { setMode(md.dataset.mode); return; }
      const sh = e.target.closest('[data-share]'); if (sh) { openShare(sh.dataset.share); return; }
      const n = e.target.closest('[data-next]'); if (n) openItem(n.dataset.next);
    });
    $('#dato').addEventListener('click', (e) => { const sh = e.target.closest('[data-share]'); if (sh) openShare(sh.dataset.share); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.term') && !e.target.closest('#termPop')) hideTerm(); });
    $('#rdScroll').addEventListener('scroll', hideTerm, { passive: true });
    window.addEventListener('scroll', hideTerm, { passive: true });
    window.addEventListener('resize', hideTerm);
    document.addEventListener('selectionchange', onSelection);
    $('#selShare').addEventListener('pointerdown', (e) => e.preventDefault());
    $('#selShare').addEventListener('click', () => openShare('sel'));
    $('#shareSheet').addEventListener('click', (e) => { if (e.target.id === 'shareSheet' || e.target.closest('#shClose')) closeShare(); const b = e.target.closest('[data-net]'); if (b) doShare(b.dataset.net); });
    $('#rdBack').addEventListener('click', () => { if (location.hash.startsWith('#/n/') && !desktop.matches) history.back(); else closeReader(); });
    $('#rdSave').addEventListener('click', toggleSave);
    $('#rdShare').addEventListener('click', () => openShare('news'));
    $('#rdFontUp').addEventListener('click', () => { state.font = Math.min(4, state.font + 1); store.set(FONT_KEY, state.font); applyFont(); });
    $('#rdFontDown').addEventListener('click', () => { state.font = Math.max(-2, state.font - 1); store.set(FONT_KEY, state.font); applyFont(); });
    $('#btnRefresh').addEventListener('click', () => load(true));
    $('#btnSearch').addEventListener('click', () => {
      const sb = $('#searchbar'); sb.hidden = !sb.hidden;
      if (!sb.hidden) { switchView('viewNews'); $('#searchInput').focus(); }
      else { state.query = ''; $('#searchInput').value = ''; renderDato(); renderList(); }
    });
    let qt;
    $('#searchInput').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { state.query = e.target.value.trim(); state.limit = 25; renderDato(); renderList(); }, 200); });
    document.querySelectorAll('.bb-item').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#shareSheet').hidden) { closeShare(); return; }
      if (!$('#termPop').hidden) { hideTerm(); return; }
      if (state.openId && !desktop.matches) $('#rdBack').click();
    });

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
    setInterval(() => { renderStatus(); if (dayKey() !== state.day) { state.day = dayKey(); renderDato(); } }, 60000);
    state.day = dayKey();
    setInterval(() => { if (!document.hidden || store.get(NOTIF_KEY, false)) load(false); }, REFRESH_MS);

    if (location.hash.startsWith('#/n/')) onHash();
    else if (desktop.matches && state.data) openFirst();
    load(false);

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  window.__AB = { state };
  document.addEventListener('DOMContentLoaded', init);
})();
