// Pulso Empresarial — generador de noticias.
// Corre cada hora en GitHub Actions (gratis): lee los RSS, obtiene el texto de cada nota,
// arma un resumen amplio + datos clave + «Clave de negocio» y escribe news.json.
//
// Uso local:  node scripts/build-news.mjs [carpeta_salida]
// Variables opcionales:
//   SITE_URL      URL pública del sitio (para reutilizar el news.json anterior y acumular el día)
//   GITHUB_TOKEN  si existe, se usan los modelos gratuitos de GitHub Models para resúmenes redactados
//   AI_MODEL      modelo de GitHub Models (por defecto openai/gpt-4o-mini)
//   AI_MAX        máximo de resúmenes con IA por ejecución (por defecto 8)
//   FIXTURES      carpeta con XML/HTML de prueba (para probar sin internet)

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import { FEEDS, EXCLUDE_URL, EXCLUDE_TITLE, offTopic } from './feeds.mjs';
import { buildMacro } from './macro.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.resolve(process.argv[2] || path.join(ROOT, '_site'));
const SITE_URL = (process.env.SITE_URL || '').replace(/\/?$/, '/');
const FIXTURES = process.env.FIXTURES || '';
const AI_TOKEN = process.env.GITHUB_TOKEN || '';
const AI_MODEL = process.env.AI_MODEL || 'openai/gpt-4o-mini';
const AI_MAX = Number(process.env.AI_MAX || 8);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 PulsoEmpresarial/1.0';
const NOW = Date.now();
const HOUR = 3.6e6;
const MAX_AGE_H = { peru: 36, pol: 36, eco: 48, world: 36, salud: 72, biz: 72 };
const MAX_ITEMS = 280;
const DATA_VERSION = 8; // si cambian las reglas, se descartan los datos anteriores

// Motor de reglas compartido con la app
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'scripts', 'insights.js'), 'utf8'));
const analyzeNews = globalThis.analyzeNews;
const normText = globalThis.normText;

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const idOf = (url) => 'n' + crypto.createHash('sha1').update(url.replace(/[?#].*$/, '')).digest('hex').slice(0, 12);

// ---------------------------------------------------------------- red
async function get(url, { timeout = 20000, type = 'text' } = {}) {
  if (FIXTURES) {
    const f = path.join(FIXTURES, idOf(url) + (type === 'json' ? '.json' : '.txt'));
    if (!fs.existsSync(f)) throw new Error('sin fixture');
    const t = fs.readFileSync(f, 'utf8');
    return type === 'json' ? JSON.parse(t) : t;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-PE,es;q=0.9' }, signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return type === 'json' ? await res.json() : await res.text();
  } finally { clearTimeout(timer); }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = undefined; } }
  }));
  return out;
}

// ---------------------------------------------------------------- RSS
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', processEntities: true, htmlEntities: true, trimValues: true });
const txt = (v) => {
  if (v == null) return '';
  if (Array.isArray(v)) return txt(v[0]);
  if (typeof v === 'object') return String(v['#text'] ?? v['@_href'] ?? '');
  return String(v);
};
const attr = (v, a) => { if (!v) return ''; if (Array.isArray(v)) { for (const x of v) { const r = attr(x, a); if (r) return r; } return ''; } return v['@_' + a] || ''; };

function parseFeed(text, feed) {
  const doc = xml.parse(text);
  const ch = doc.rss?.channel || doc['rdf:RDF'] || doc.feed || {};
  let items = ch.item || doc['rdf:RDF']?.item || ch.entry || [];
  if (!Array.isArray(items)) items = [items];
  return items.map((it) => {
    let link = txt(it.link);
    if (!link || !/^https?:/.test(link)) link = attr(it.link, 'href') || txt(it.guid);
    const html = txt(it['content:encoded']) || txt(it.content);
    let img = attr(it['media:content'], 'url') || attr(it['media:thumbnail'], 'url') || attr(it['media:group']?.['media:content'], 'url');
    const enc = it.enclosure; if (!img && enc && /image/.test(attr(enc, 'type') || 'image')) img = attr(enc, 'url');
    return {
      title: cleanText(txt(it.title)), link: link.trim(), feed,
      date: Date.parse(txt(it.pubDate) || txt(it['dc:date']) || txt(it.published) || txt(it.updated)) || 0,
      desc: htmlToText(txt(it.description) || txt(it.summary)),
      html, img
    };
  }).filter((x) => x.title && /^https?:\/\//.test(x.link)).sort((a, b) => b.date - a.date).slice(0, 30);
}

// ---------------------------------------------------------------- texto
const JUNK = /^(lee también|lea también|leer también|te puede interesar|mira también|también puedes leer|video recomendado|más información|suscríbete|síguenos|únete|descarga|escucha|ver video|ver también|lo último|newsletter|recibe|haz clic|clic aquí|sigue leyendo|fuente:|foto:|crédito|\(con información de)/i;
function cleanText(s) { return String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
function htmlToText(html) {
  if (!html) return '';
  const $ = cheerio.load('<div id="r">' + html + '</div>');
  return cleanText($('#r').text());
}

/** Devuelve los párrafos del cuerpo de una nota a partir de su HTML. */
function paragraphsFromHTML(html) {
  const $ = cheerio.load('<div id="r">' + html + '</div>');
  $('script, style, iframe, figure, figcaption, blockquote, noscript, table, .embed, [class*="related"], [class*="newsletter"], [class*="ads"], aside').remove();
  const out = [];
  $('#r').find('p, h2, h3, li').each((_, el) => {
    const t = cleanText($(el).text());
    if (!t || JUNK.test(t)) return;
    const tag = el.tagName.toLowerCase();
    const linkText = cleanText($(el).find('a').text());
    if (linkText.length > t.length * 0.7) return; // párrafo que solo enlaza a otra nota
    if (/^(lee|lea|mira|ver|te puede|tambi[eé]n)\b.{0,40}:/i.test(t)) return;
    if (tag === 'p' && t.split(' ').length < 8) return;
    if (tag === 'li' && t.split(' ').length < 6) return;
    if ((tag === 'h2' || tag === 'h3')) { out.push({ h: true, t }); return; }
    out.push({ t });
  });
  if (!out.length) { // feed sin etiquetas <p>
    const t = cleanText($('#r').text());
    if (t) out.push({ t });
  }
  return out;
}

/** Lee la página de la nota (para fuentes sin texto completo en el RSS). */
async function scrapeArticle(url) {
  const html = await get(url, { timeout: 15000 });
  const $ = cheerio.load(html);
  // 1) JSON-LD articleBody
  let body = '';
  $('script[type="application/ld+json"]').each((_, el) => {
    if (body) return;
    try {
      const data = JSON.parse($(el).contents().text());
      const arr = [].concat(data['@graph'] || data);
      for (const d of arr) { if (d && typeof d.articleBody === 'string' && d.articleBody.length > 300) { body = d.articleBody; break; } }
    } catch (e) {}
  });
  const ogImg = $('meta[property="og:image"]').attr('content') || '';
  const ogDesc = $('meta[property="og:description"]').attr('content') || '';
  if (body) return { paras: body.split(/\n+/).map(cleanText).filter((t) => t.split(' ').length >= 6).map((t) => ({ t })), img: ogImg, desc: ogDesc };
  // 2) párrafos del artículo
  const scope = $('article').length ? $('article').first() : $('main').length ? $('main').first() : $('body');
  scope.find('script, style, nav, header, footer, aside, figure, iframe, form').remove();
  const paras = [];
  scope.find('p').each((_, el) => { const t = cleanText($(el).text()); if (t.split(' ').length >= 10 && !JUNK.test(t)) paras.push({ t }); });
  return { paras, img: ogImg, desc: ogDesc };
}

// ---------------------------------------------------------------- resumen extractivo
const STOP = new Set(('a al algo algunas algunos ante antes como con contra cual cuales cuando de del desde donde dos el ella ellas ellos en entre era eran es esa esas ese eso esos esta estaba estado estan estas este esto estos fue fueron ha habia han hasta hay la las le les lo los mas me mi muy no nos o otra otras otro otros para pero poco por porque que quien se ser si sido sin sobre son su sus tambien tiene tienen todo todos tras un una unas uno unos y ya segun asi solo cada dijo dice senalo indico afirmo explico agrego precisO durante luego mientras ademas tanto parte ano anos hoy ayer esto ser sera seran puede pueden podria hacer hace the and for that with this from are was were has have had its not but they their them you your our will would can could also more than into about after over said says just been being which what when who how than then there these those other some such only most many much very new one two'.toLowerCase()).split(' '));
const words = (s) => normText(s).split(/[^a-z0-9ñ%]+/).filter((w) => w.length > 2 && !STOP.has(w));

function splitSentences(p) {
  return p.replace(/([.!?…])\s+(?=[«"“¿¡A-ZÁÉÍÓÚÑ0-9])/g, '$1\u0001').split('\u0001').map(cleanText).filter(Boolean);
}

/**
 * Resumen amplio: elige las oraciones más informativas (frecuencia de términos, posición,
 * relación con el titular y presencia de cifras) y las devuelve en su orden original,
 * agrupadas por párrafo. Extensión: ~50 % de la nota, entre 150 y 400 palabras.
 */
function extractiveSummary(title, paras) {
  const sents = [];
  paras.forEach((p, pi) => { if (p.h) return; splitSentences(p.t).forEach((s, si) => sents.push({ s, pi, si, i: sents.length })); });
  const totalWords = sents.reduce((n, x) => n + x.s.split(' ').length, 0);
  if (totalWords < 70) return { paragraphs: sents.length ? [sents.map((x) => x.s).join(' ')] : [], points: [], words: totalWords };

  const tf = new Map();
  sents.forEach((x) => words(x.s).forEach((w) => tf.set(w, (tf.get(w) || 0) + 1)));
  const titleW = new Set(words(title));
  const maxTf = Math.max(...tf.values());
  sents.forEach((x) => {
    const ws = words(x.s); const n = x.s.split(' ').length;
    let sc = ws.reduce((a, w) => a + (tf.get(w) || 0) / maxTf, 0) / Math.pow(Math.max(ws.length, 1), 0.55);
    sc += ws.filter((w) => titleW.has(w)).length * 0.25;
    if (/\d/.test(x.s)) sc += 0.35;
    if (/(S\/|US\$|\$|%|millones|mil millones|soles|d[oó]lares)/i.test(x.s)) sc += 0.3;
    if (x.i === 0) sc += 2; else if (x.i < 3) sc += 0.6;
    if (x.si === 0) sc += 0.2;
    if (n < 7 || n > 75) sc -= 2;
    if (/^[«"“].*[»"”]\.?$/.test(x.s) && n < 14) sc -= 0.8; // cita suelta y corta
    if (/(\?$|^¿)/.test(x.s)) sc -= 0.6;
    x.sc = sc;
  });
  const target = Math.max(Math.min(150, Math.round(totalWords * 0.7)), Math.min(400, Math.round(totalWords * 0.5)));
  const chosen = new Set(); let w = 0;
  for (const x of sents.slice().sort((a, b) => b.sc - a.sc)) {
    if (w >= target) break;
    const n = x.s.split(' ').length;
    if (n < 7 || n > 75) continue;
    // evita oraciones casi repetidas
    const xw = new Set(words(x.s));
    let dup = false; chosen.forEach((j) => { const yw = words(sents[j].s); const inter = yw.filter((t) => xw.has(t)).length; if (inter / Math.max(1, Math.min(xw.size, yw.length)) > 0.7) dup = true; });
    if (dup) continue;
    chosen.add(x.i); w += n;
  }
  const sel = sents.filter((x) => chosen.has(x.i));
  const paragraphs = []; let cur = [], last = -1, count = 0;
  for (const x of sel) {
    if (cur.length && (x.pi !== last || count >= 3) && cur.join(' ').split(' ').length > 45) { paragraphs.push(cur.join(' ')); cur = []; count = 0; }
    cur.push(x.s); last = x.pi; count++;
  }
  if (cur.length) paragraphs.push(cur.join(' '));
  // datos clave: cifras que no entraron al resumen
  const points = sents.filter((x) => !chosen.has(x.i) && /\d/.test(x.s) && x.s.split(' ').length >= 8 && x.s.split(' ').length <= 45)
    .sort((a, b) => b.sc - a.sc).slice(0, 4).sort((a, b) => a.i - b.i).map((x) => x.s);
  return { paragraphs, points, words: totalWords };
}

// ---------------------------------------------------------------- IA gratuita (GitHub Models)
let aiDisabled = !AI_TOKEN || process.env.AI_OFF === '1';
let aiUsed = 0, aiFails = 0;
const AI_ENDPOINTS = [
  { url: 'https://models.github.ai/inference/chat/completions', headers: { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } },
  { url: 'https://models.inference.ai.azure.com/chat/completions', model: 'gpt-4o-mini' }
];
async function aiSummary(item, fullText) {
  if (aiDisabled || aiUsed >= AI_MAX) return null;
  aiUsed++;
  const prompt = `Eres editor de un boletín para estudiantes de Administración de Empresas en Perú.
Lee la noticia y responde SOLO con JSON válido con esta forma:
{"resumen":["párrafo 1","párrafo 2","párrafo 3","párrafo 4"],"puntos":["dato clave 1","dato clave 2","dato clave 3"],"admin":{"area":"","concepto":"","explicacion":"","pregunta":""}}
Reglas:
- "resumen": 3 a 5 párrafos en español, con tus propias palabras (no copies frases textuales), 250 a 380 palabras en total. Explica qué pasó, quiénes participan, cifras importantes, contexto y qué podría pasar después. Debe entenderse sin leer la nota original.
- "puntos": 3 a 5 datos concretos (cifras, fechas, decisiones), cada uno de una línea.
- "admin": área de la empresa más afectada (Finanzas, Marketing, Recursos Humanos, Operaciones y logística, Estrategia, Legal y cumplimiento, Emprendimiento, Innovación y TI, etc.), el concepto de Administración que ilustra, una explicación de 2-3 oraciones de por qué importa a un gerente o empresario y una pregunta de reflexión.
- No inventes datos que no estén en la nota.

TITULAR: ${item.title}
MEDIO: ${item.source}
NOTA:
${fullText.slice(0, 7000)}`;
  try {
    const mk = (model) => JSON.stringify({ model, temperature: 0.3, max_tokens: 1100, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] });
    let data = null;
    for (const ep of AI_ENDPOINTS) {
      if (ep.bad) continue;
      const res = await fetch(ep.url, { method: 'POST', body: mk(ep.model || AI_MODEL), headers: Object.assign({ 'Authorization': 'Bearer ' + AI_TOKEN, 'Content-Type': 'application/json' }, ep.headers || {}) });
      const text = await res.text();
      if (res.status === 429) { aiDisabled = true; log('IA: límite gratuito alcanzado'); return null; }
      try { data = JSON.parse(text); } catch (e) { data = null; }
      if (res.ok && data && data.choices) { if (!ep.logged) { log('IA OK vía', ep.url); ep.logged = true; } break; }
      log('IA', ep.url, res.status, text.slice(0, 160).replace(/\s+/g, ' '));
      ep.bad = true; data = null;
    }
    if (!data) { if (AI_ENDPOINTS.every((e) => e.bad)) aiDisabled = true; return null; }
    const j = JSON.parse(data.choices[0].message.content.replace(/^```(json)?|```$/g, ''));
    const resumen = (j.resumen || []).map(cleanText).filter(Boolean);
    if (resumen.join(' ').split(' ').length < 120) return null;
    const a = j.admin || {};
    return {
      paragraphs: resumen, points: (j.puntos || []).map(cleanText).filter(Boolean).slice(0, 5),
      admin: a.concepto && a.explicacion ? { area: cleanText(a.area), concept: cleanText(a.concepto), note: cleanText(a.explicacion), q: cleanText(a.pregunta) } : null
    };
  } catch (e) { log('IA excepción', e.message); if (++aiFails >= 2) aiDisabled = true; return null; } finally { await sleep(4500); }
}

// ---------------------------------------------------------------- agrupación y relevancia
// Salud: notas de la sección de salud de los medios y notas de otras secciones que tratan de salud
const HEALTH_URL = /\/(salud|sanidad)(\/|-)/i;
const HEALTH_TITLE = /(\bminsa\b|essalud|ministerio de salud|ministra de salud|ministro de salud|hospital|\bsalud\b|dengue|vacun|epidemia|brote|medicament|cl[ií]nica|enfermedad|c[aá]ncer|diabetes|pacientes?|\bm[eé]dic[oa]s?\b|covid|gripe|\boms\b|sanitari|desnutrici[oó]n|anemia|farmacia|botica|digemid|hipertensi[oó]n|obesidad)/i;
const HEALTH_NOT = /(salud (financiera|del mercado|de la econom)|crisis de salud (pol[ií]tica)|salud fiscal)/i;

const tokSet = (t) => new Set(words(t).filter((w) => w.length > 3));
const storyToks = (i) => new Set([...words(i.title), ...words(((i.summary && i.summary[0]) || '').split(' ').slice(0, 35).join(' '))].filter((w) => w.length > 3));
function sameStoryLoose(a, b) { let inter = 0; a.forEach((w) => { if (b.has(w)) inter++; }); return inter >= 6 && inter / Math.max(1, Math.min(a.size, b.size)) >= 0.33; }
function sameStory(a, b) {
  let inter = 0; a.forEach((w) => { if (b.has(w)) inter++; });
  return inter >= 3 && inter / Math.max(1, Math.min(a.size, b.size)) >= 0.5;
}

// ---------------------------------------------------------------- principal
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 1) noticias de la ejecución anterior (para acumular el día y reutilizar resúmenes)
  let prev = { items: [] }, prevMacro = null;
  if (SITE_URL && !FIXTURES) {
    try { prev = await get(SITE_URL + 'news.json?t=' + NOW, { type: 'json' }); prevMacro = prev.macro || null; log('Anterior:', prev.items.length, 'notas'); if (prev.version !== DATA_VERSION) { log('Versión anterior distinta: se regenera todo'); prev = { items: [] }; } }
    catch (e) { log('Sin news.json anterior:', e.message); }
  }
  const prevById = new Map((prev.items || []).map((i) => [i.id, i]));

  // 2) leer feeds
  const sourceStatus = [];
  const raw = [];
  await pool(FEEDS, 6, async (feed) => {
    try {
      const items = parseFeed(await get(feed.url), feed);
      sourceStatus.push({ name: feed.name, sec: feed.sec, ok: true, count: items.length });
      raw.push(...items);
      log('✔', feed.name, feed.sec, items.length);
    } catch (e) {
      sourceStatus.push({ name: feed.name, sec: feed.sec, ok: false, count: 0, error: e.message });
      log('✘', feed.name, feed.sec, e.message);
    }
  });

  // 3) filtrar y deduplicar por URL
  const byId = new Map();
  for (const r of raw) {
    if (EXCLUDE_URL.test(r.link) || EXCLUDE_TITLE.test(r.title) || offTopic(r.feed, r.title, r.desc)) continue;
    const date = r.date ? Math.min(r.date, NOW) : NOW;
    if (NOW - date > (r.feed.maxAge || MAX_AGE_H[r.feed.sec]) * HOUR) continue;
    const id = idOf(r.link);
    if (byId.has(id)) { const e = byId.get(id); if (!e.secs.includes(r.feed.sec)) e.secs.push(r.feed.sec); continue; }
    byId.set(id, { id, r, date, secs: [r.feed.sec] });
  }
  log('Notas nuevas en feeds:', byId.size);

  // 4) texto y resumen de cada nota (reutiliza lo ya procesado)
  const fresh = [];
  const toProcess = [...byId.values()];
  await pool(toProcess, 5, async ({ id, r, date, secs }) => {
    const old = prevById.get(id);
    if (old && old.summary && old.summary.length) {
      fresh.push(Object.assign({}, old, { secs: Array.from(new Set([...(old.secs || []), ...secs])) }));
      return;
    }
    let paras = r.html ? paragraphsFromHTML(r.html) : [];
    let img = r.img, desc = r.desc;
    if (!r.feed.brief && (!paras.length || paras.reduce((n, p) => n + p.t.split(' ').length, 0) < 90) && !FIXTURES) {
      try { const s = await scrapeArticle(r.link); if (s.paras.length) paras = s.paras; img = img || s.img; desc = desc || s.desc; } catch (e) {}
    } else if (FIXTURES && r.feed.scrape) {
      try { const s = await scrapeArticleFixture(r.link); if (s && s.paras.length) paras = s.paras; } catch (e) {}
    }
    if (!paras.length && desc) paras = [{ t: desc }];
    const ex = extractiveSummary(r.title, paras);
    if (!ex.paragraphs.length) return;
    const full = paras.filter((p) => !p.h).map((p) => p.t).join('\n');
    if (ex.paragraphs.join(' ').split(' ').length < (r.feed.brief ? 8 : 60)) return; // demasiado corto para entenderse sin abrir la nota
    const ins = analyzeNews(r.title, full.slice(0, 700));
    const tIns = analyzeNews(r.title, full.slice(0, 300));
    let s2 = secs.slice();
    const isHealth = !s2.includes('salud') && !HEALTH_NOT.test(r.title) && (HEALTH_URL.test(r.link) || HEALTH_TITLE.test(r.title));
    if (isHealth) s2.unshift('salud'); // la salud pasa a ser la sección principal de la nota
    fresh.push({
      id, title: r.title, link: r.link, source: r.feed.name.replace(/ Tecnología$/, ''), secs: s2, sec: s2[0], date,
      img: /^https:\/\//.test(img || '') ? img : '',
      summary: ex.paragraphs, points: ex.points, words: ex.words, ai: false,
      lang: r.feed.lang || 'es', brief: !!r.feed.brief || ex.words < 70,
      admin: { area: ins.area, pestel: ins.pestel, concept: ins.concept, note: ins.note, q: ins.q }, iscore: ins.score,
      _full: full
    });
  });

  // 5) mantener notas anteriores aún vigentes que ya no salen en los feeds
  const freshIds = new Set(fresh.map((i) => i.id));
  for (const old of prev.items || []) {
    if (freshIds.has(old.id)) continue;
    const maxH = Math.max(...(old.secs || [old.sec]).map((s) => MAX_AGE_H[s] || 36));
    if (NOW - old.date <= maxH * HOUR) fresh.push(old);
  }

  // 6) misma noticia en varios medios → cobertura
  const toks = fresh.map((i) => tokSet(i.title));
  const stoks = fresh.map(storyToks);
  fresh.forEach((it, a) => {
    const others = new Set();
    fresh.forEach((o, b) => { if (a !== b && o.source !== it.source && (sameStory(toks[a], toks[b]) || sameStoryLoose(stoks[a], stoks[b]))) others.add(o.source); });
    it.also = [...others];
  });

  // 7) relevancia
  fresh.forEach((it) => {
    const h = (NOW - it.date) / HOUR;
    const routine = /(precio del d[oó]lar hoy|tipo de cambio hoy|temblor hoy|sismo hoy|clima hoy|hor[oó]scopo|resultados? (en vivo|al \d))/i.test(it.title) ? 7 : 0;
    it.score = Math.round((-routine + Math.max(0, 14 - h / 1.6) + (it.iscore || 0) * 1.2 + it.also.length * 3.5 + Math.min(4, (it.words || 0) / 200) + (it.img ? 0.5 : 0)) * 10) / 10;
  });
  fresh.sort((a, b) => b.score - a.score);
  // grupo: la misma historia contada por varios medios comparte grupo (la app muestra solo una)
  const groups = [];
  fresh.forEach((it) => {
    const t = tokSet(it.title), st = storyToks(it);
    const g = groups.find((x) => sameStory(x.t, t) || sameStoryLoose(x.st, st));
    if (g) it.group = g.id; else { it.group = it.id; groups.push({ id: it.id, t, st }); }
  });

  // 8) resúmenes redactados con IA para las más relevantes (si hay acceso gratuito)
  if (!aiDisabled) {
    for (const it of fresh) {
      if (aiUsed >= AI_MAX || aiDisabled) break;
      if (it.ai || !it._full || it._full.split(' ').length < 150) continue;
      const ai = await aiSummary(it, it._full);
      if (ai) {
        it.summary = ai.paragraphs; if (ai.points.length) it.points = ai.points; it.ai = true;
        if (ai.admin) it.admin = Object.assign({}, it.admin, ai.admin);
      }
    }
    log('Resúmenes con IA en esta ejecución:', fresh.filter((i) => i.ai && i._full).length);
  }

  // 9) destacado: diversidad (máx. 5 por sección en las primeras 25)
  const top = []; const perSec = {};
  for (const it of fresh) {
    if (top.length >= 25) break;
    const s = it.secs[0]; if ((perSec[s] = (perSec[s] || 0) + 1) > (s === 'world' ? 4 : s === 'salud' ? 3 : s === 'biz' ? 5 : 6)) continue;
    if (it.lang === 'en' && (perSec.en = (perSec.en || 0) + 1) > 3) continue;
    if (top.some((id) => { const o = fresh.find((x) => x.id === id); return o && o.group === it.group; })) continue;
    top.push(it.id);
  }

  // 10) indicadores del BCRP para el «Dato del Día»
  let macro = null;
  try { macro = await buildMacro(get, NOW, prevMacro); } catch (e) { log('Macro:', e.message); macro = prevMacro; }

  const items = fresh.slice(0, MAX_ITEMS).map(({ _full, iscore, ...rest }) => rest);
  const out = { version: DATA_VERSION, generated: new Date(NOW).toISOString(), count: items.length, sources: sourceStatus.sort((a, b) => a.sec.localeCompare(b.sec)), top, macro, items };
  fs.writeFileSync(path.join(OUT_DIR, 'news.json'), JSON.stringify(out));
  const kb = Math.round(fs.statSync(path.join(OUT_DIR, 'news.json')).size / 1024);
  log(`news.json: ${items.length} notas, ${kb} KB, ${sourceStatus.filter((s) => s.ok).length}/${FEEDS.length} fuentes OK`);
}

// Para pruebas sin internet: páginas guardadas en FIXTURES
async function scrapeArticleFixture(url) {
  const f = path.join(FIXTURES, idOf(url) + '.txt');
  if (!fs.existsSync(f)) return null;
  return scrapeArticle(url);
}

main().catch((e) => { console.error(e); process.exit(1); });
