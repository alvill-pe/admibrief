// Indicadores del día desde la API pública del BCRP (estadisticas.bcrp.gob.pe), sin clave.
// Devuelve { updated, source, indicators[], dato } para el «Dato del Día» y el panel ejecutivo.

const API = 'https://estadisticas.bcrp.gob.pe/estadisticas/series/api/';
const MES = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, set: 8, sep: 8, oct: 9, nov: 10, dic: 11 };

// vol: variación diaria "normal" (en %), para saber cuándo un movimiento es noticia
const DAILY = [
  { id: 'usd', code: 'PD04638PD', nm: /Interbancario.*Venta/i, label: 'Dólar', name: 'Tipo de cambio interbancario (venta)', unit: 'S/', pre: 'S/ ', dec: 3, vol: 0.3,
    why: 'Un dólar más caro encarece importaciones, insumos y deudas en dólares; favorece a los exportadores.' },
  { id: 'cobre', code: 'PD04701XD', nm: /Cobre/i, label: 'Cobre', name: 'Cobre (Londres)', unit: 'US$/lb', pre: 'US$ ', post: ' por libra', dec: 2, vol: 1.5, scale: 0.01,
    why: 'El cobre es el principal producto de exportación del Perú: su precio mueve el canon, la recaudación y el dólar.' },
  { id: 'oro', code: 'PD04704XD', nm: /Oro/i, label: 'Oro', name: 'Oro (Londres)', unit: 'US$/oz', pre: 'US$ ', post: ' la onza', dec: 0, vol: 1.2,
    why: 'El oro es refugio en tiempos de incertidumbre y el segundo producto de exportación peruano.' },
  { id: 'wti', code: 'PD04705XD', nm: /Petr[oó]leo/i, label: 'Petróleo', name: 'Petróleo WTI', unit: 'US$/barril', pre: 'US$ ', post: ' el barril', dec: 2, vol: 2,
    why: 'El petróleo define el costo de combustibles, transporte y logística de casi todas las empresas.' },
  { id: 'bvl', code: 'PD38026MD', nm: /BVL|Burs[aá]til/i, label: 'Bolsa de Lima', name: 'Índice General BVL', unit: 'puntos', pre: '', post: ' puntos', dec: 0, vol: 1,
    why: 'La Bolsa refleja la confianza de los inversionistas en las empresas que cotizan en el Perú.' },
  { id: 'tasa', code: 'PD12301MD', nm: /Referencia/i, label: 'Tasa de referencia', name: 'Tasa de referencia BCRP', unit: '%', pre: '', post: '%', dec: 2, vol: 0, level: true,
    why: 'La tasa del BCRP guía el costo de los créditos para empresas y familias.' }
];
const MONTHLY = [
  { id: 'infl', code: 'PN01273PM', label: 'Inflación anual', name: 'Inflación Lima (12 meses)', unit: '%', pre: '', post: '%', dec: 2, level: true, match: /12 meses/, nm: /12 meses/,
    why: 'La inflación mide cuánto suben los precios: afecta sueldos, costos y poder de compra de tus clientes.' },
  { id: 'inflm', code: 'PN01271PM', label: 'Inflación del mes', name: 'Inflación Lima (mensual)', unit: '%', pre: '', post: '%', dec: 2, level: true, match: /mensual/, nm: /mensual/, hidden: true }
];

const iso = (d) => d.toISOString().slice(0, 10);
function parsePeriod(name) {
  let m = name.match(/^(\d{2})\.(\w{3})\.(\d{2})$/); // 07.Oct.26
  if (m) return Date.UTC(2000 + +m[3], MES[m[2].toLowerCase()], +m[1]);
  m = name.match(/^(\w{3})\.(\d{4})$/); // Sep.2026
  if (m) return Date.UTC(+m[2], MES[m[1].toLowerCase()], 1);
  return NaN;
}
function parse(json, defs) {
  const names = (json.config && json.config.series || []).map((s) => s.name);
  // la API puede devolver las series en otro orden: se ubican por código pedido y, si hace falta, por nombre
  const idx = defs.map((d, k) => { const j = d.nm ? names.findIndex((n) => d.nm.test(n)) : -1; return j >= 0 ? j : k; });
  const out = {};
  defs.forEach((d, k) => {
    const pts = [];
    for (const p of json.periods || []) {
      const v = parseFloat(p.values[idx[k]]);
      const t = parsePeriod(p.name);
      if (Number.isFinite(v) && Number.isFinite(t)) pts.push([t, +(v * (d.scale || 1)).toFixed(4)]);
    }
    out[d.id] = pts;
  });
  return out;
}
function fmt(v, d) { return v.toLocaleString('es-PE', { minimumFractionDigits: d.dec, maximumFractionDigits: d.dec }); }

export async function buildMacro(get, NOW, prevMacro) {
  const now = new Date(NOW);
  const from = new Date(NOW - 50 * 864e5);
  const fromM = new Date(now.getUTCFullYear() - 1, now.getUTCMonth() - 2, 1);
  const dailyUrl = API + DAILY.map((d) => d.code).join('-') + '/json/' + iso(from) + '/' + iso(now);
  const monthUrl = API + MONTHLY.map((d) => d.code).join('-') + '/json/' + fromM.getFullYear() + '-' + (fromM.getMonth() + 1) + '/' + now.getUTCFullYear() + '-' + (now.getUTCMonth() + 1);
  let series = {};
  try { Object.assign(series, parse(await get(dailyUrl, { type: 'json', timeout: 25000 }), DAILY)); } catch (e) { console.log('BCRP diario:', e.message); }
  try { Object.assign(series, parse(await get(monthUrl, { type: 'json', timeout: 25000 }), MONTHLY)); } catch (e) { console.log('BCRP mensual:', e.message); }

  const indicators = [];
  for (const d of [...DAILY, ...MONTHLY]) {
    const pts = series[d.id] || [];
    if (pts.length < 2) continue;
    const [t1, v1] = pts[pts.length - 1];
    const [, v0] = pts[pts.length - 2];
    const chg = v0 ? ((v1 - v0) / Math.abs(v0)) * 100 : 0;
    const diff = v1 - v0;
    indicators.push({
      id: d.id, label: d.label, name: d.name, unit: d.unit, pre: d.pre, post: d.post || '', dec: d.dec,
      value: v1, prev: v0, chg: +chg.toFixed(2), diff: +diff.toFixed(4), date: t1, monthly: !!d.match, level: !!d.level, hidden: !!d.hidden,
      text: d.pre + fmt(v1, d) + (d.post || ''), why: d.why,
      spark: pts.slice(d.match ? -13 : -22).map((p) => p[1])
    });
  }
  console.log('Indicadores BCRP:', indicators.map((i) => i.id + '=' + i.value).join(' '));
  if (!indicators.length) return prevMacro && prevMacro.indicators ? prevMacro : null;

  // ---- Dato del Día: el movimiento más llamativo
  const by = Object.fromEntries(indicators.map((i) => [i.id, i]));
  const cands = [];
  for (const d of DAILY) {
    const i = by[d.id]; if (!i) continue;
    if (d.level) { if (i.diff !== 0 && NOW - i.date < 10 * 864e5) cands.push({ i, s: 6 }); continue; }
    cands.push({ i, s: Math.abs(i.chg) / d.vol + (d.id === 'usd' ? 0.35 : 0) });
  }
  const inf = by.infl;
  if (inf && NOW - inf.date < 40 * 864e5 && now.getUTCDate() <= 8) cands.push({ i: inf, s: 3 });
  cands.sort((a, b) => b.s - a.s);
  const pick = (cands[0] || { i: by.usd || indicators[0] }).i;

  const up = pick.diff > 0, flat = pick.diff === 0;
  const verb = flat ? 'se mantuvo' : up ? 'subió' : 'bajó';
  let headline, sub;
  const dateTxt = new Date(pick.date).toLocaleDateString('es-PE', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
  const monthTxt = new Date(pick.date).toLocaleDateString('es-PE', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  if (pick.id === 'infl') {
    headline = 'La inflación ' + (flat ? 'se mantuvo en ' : up ? 'subió a ' : 'bajó a ') + pick.text;
    sub = 'Variación de precios en Lima en los últimos 12 meses (' + monthTxt + '). Meta del BCRP: entre 1% y 3%.';
  } else if (pick.id === 'tasa') {
    headline = 'El BCRP ' + (up ? 'subió' : 'bajó') + ' su tasa de referencia a ' + pick.text;
    sub = 'Antes estaba en ' + fmt(pick.prev, pick) + '%. Dato del ' + dateTxt + '.';
  } else {
    const pct = Math.abs(pick.chg).toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + '%';
    const subj = { usd: 'El dólar', cobre: 'El cobre', oro: 'El oro', wti: 'El petróleo', bvl: 'La Bolsa de Lima' }[pick.id];
    headline = subj + ' ' + verb + (flat ? '' : ' ' + pct) + (pick.id === 'bvl' ? '' : ' y cerró en ' + pick.text);
    sub = 'Cierre del ' + dateTxt + (pick.id === 'usd' ? ' (tipo de cambio interbancario, venta)' : '') + '.';
  }
  const dato = { id: pick.id, label: pick.label, level: pick.level, diff: pick.diff, headline, sub, value: pick.text, chg: pick.chg, monthly: pick.monthly, up, flat, why: pick.why, spark: pick.spark, date: pick.date, source: 'BCRP' };
  return { updated: NOW, source: 'Banco Central de Reserva del Perú (BCRP)', indicators, dato };
}
