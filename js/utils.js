import { MONTHS_FULL } from './config.js';

// ── Escapado / URLs seguras ─────────────────────────────

/** Escapa texto para HTML, tanto en contenido como dentro de atributos. */
export function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Devuelve la URL solo si es http(s); si no, cadena vacía (bloquea javascript:, data:, etc.). */
export function safeUrl(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '';
  } catch {
    return '';
  }
}

// ── Fechas ──────────────────────────────────────────────

export function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function today() {
  return toISODate(new Date());
}

export function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  // Rechaza fechas imposibles (31 de febrero, etc.)
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

export function formatDate(str) {
  const d = parseDate(str);
  return d ? `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}` : '';
}

export function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  if (!d) return '';
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

// ── Asistentes y nombres ────────────────────────────────

export function getAttendees(str) {
  if (!str) return [];
  return String(str).split(/[\n,]/).map(s => s.trim()).filter(Boolean);
}

/** Normaliza un nombre para compararlo: sin acentos, sin signos ("Omar?" → "omar"). */
export function normalizeName(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();
}

// ── Identificadores ─────────────────────────────────────

export function uid() {
  return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Hash corto y estable (djb2) para ids que no cambian entre sincronizaciones. */
export function hashId(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return 'x' + (h >>> 0).toString(36);
}

// ── YouTube ─────────────────────────────────────────────

export function extractYtId(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    const v = u.searchParams.get('v');
    if (v) return v;
    const m = u.pathname.match(/(?:embed|shorts|v)\/([^/?&]+)/);
    if (m) return m[1];
  } catch { /* cae al regex */ }
  const m = String(url).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([^?&/]{11})/);
  return m ? m[1] : '';
}

export function ytThumb(id) {
  return /^[\w-]{6,20}$/.test(id) ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
}

export function formatRelativeTime(isoStr) {
  const t = new Date(isoStr).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} día${days > 1 ? 's' : ''}`;
}

// ── Fechas escritas a mano en el Excel ──────────────────

function isoOf(y, m, d) {
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return parseDate(iso) ? iso : '';
}

/**
 * Texto → { fecha, fechaFin } ('' si no es fecha). Mismo criterio que apps-script/Code.gs:
 * 12/05/2026 · 2026-05-12 · 02-04/10/2026 · 29-30-31/10/2026 · 30/04-02/05/2027
 */
export function parseDateText(raw) {
  const none = { fecha: '', fechaFin: '' };
  const s = String(raw ?? '').trim();
  let r;
  if ((r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return { fecha: isoOf(+r[1], +r[2], +r[3]), fechaFin: '' };
  if ((r = s.match(/^(\d{1,2})[/.](\d{1,2})-(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/))) {
    const a = isoOf(+r[5], +r[2], +r[1]);
    return a ? { fecha: a, fechaFin: isoOf(+r[5], +r[4], +r[3]) } : none;
  }
  if ((r = s.match(/^(\d{1,2})((?:-\d{1,2})*)[/.](\d{1,2})[/.](\d{4})$/))) {
    const first = isoOf(+r[4], +r[3], +r[1]);
    if (!first) return none;
    const days = r[2] ? r[2].split('-').filter(Boolean) : [];
    const end = days.length ? isoOf(+r[4], +r[3], +days[days.length - 1]) : '';
    return { fecha: first, fechaFin: end > first ? end : '' };
  }
  if ((r = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2})$/))) return { fecha: isoOf(2000 + +r[3], +r[2], +r[1]), fechaFin: '' };
  return none;
}

/** Fecha (con rango opcional) → texto con el mismo formato que usa el Excel. */
export function formatDateRangeText(fecha, fechaFin) {
  if (!fechaFin || fechaFin <= fecha) return fecha;
  const [ay, am, ad] = fecha.split('-'), [by, bm, bd] = fechaFin.split('-');
  if (ay !== by) return fecha;
  return am === bm ? `${ad}-${bd}/${am}/${ay}` : `${ad}/${am}-${bd}/${bm}/${ay}`;
}

/** Texto legible de un rango: "2–4 oct", "30 abr – 2 may". */
export function formatShortRange(fecha, fechaFin) {
  const a = parseDate(fecha), b = parseDate(fechaFin);
  if (!a || !b) return '';
  const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${M[a.getMonth()]}`
    : `${a.getDate()} ${M[a.getMonth()]} – ${b.getDate()} ${M[b.getMonth()]}`;
}

// ── Asistentes (mismo criterio que apps-script/Code.gs) ──

/** Nombres con los que una persona aparece en el Excel, normalizados. */
export function namesOf(user) {
  if (!user) return [];
  return [user.nombre, ...(user.aliases || [])].map(normalizeName).filter(Boolean);
}

/** ¿Aparece alguno de esos nombres en el texto de asistentes? ("Omar?" y "Omar + 1" cuentan) */
export function attends(text, names) {
  if (!names.length) return false;
  return getAttendees(text).some(a => names.includes(normalizeName(a)));
}

export function addAttendee(text, user) {
  const names = namesOf(user);
  const present = String(text || '').split('\n').some(l => names.includes(normalizeName(l)));
  return present ? text : (text ? text + '\n' : '') + user.nombre;
}

export function removeAttendee(text, user) {
  const names = namesOf(user);
  const out = [];
  for (let line of String(text || '').split('\n')) {
    if (names.includes(normalizeName(line))) continue;
    if (line.includes(',')) line = line.split(',').filter(p => !names.includes(normalizeName(p))).join(',');
    out.push(line);
  }
  return out.join('\n').trim();
}

// ── Claves de eventos ──

/** Clave de una fila en el Excel: la misma que usa Code.gs para localizarla. */
export const eventKey = ev => `${ev.fecha}|${String(ev.evento || '').trim().toLowerCase()}`;

/** Asigna ids estables (hash de fecha+evento) para que no cambien entre sincronizaciones. */
export function assignIds(list) {
  const seen = new Set();
  return list.map(ev => {
    const base = hashId(eventKey(ev));
    let id = base, n = 2;
    while (seen.has(id)) id = `${base}-${n++}`;
    seen.add(id);
    return { ...ev, id };
  });
}

// ── Acceso ──────────────────────────────────────────────

/** Saca el código de lo que la persona pegue: el enlace completo (…#acceso=CÓDIGO) o solo el código. */
export function extraerCodigo(texto) {
  const t = String(texto ?? '').trim();
  const m = t.match(/[#?&]acceso=([^&\s#]+)/);
  const crudo = m ? m[1] : t.replace(/\s+/g, '');
  try { return decodeURIComponent(crudo); } catch { return crudo; }
}
