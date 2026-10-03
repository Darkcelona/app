// Comunicación con el backend (Google Apps Script sobre el Excel).
//
//  · Cada cambio (apuntarse, quitarse, crear, editar, borrar) se guarda primero en una cola (outbox) en el
//    dispositivo y se envía al Excel. Sin red, la cola espera y se reintenta: nada se pierde.
//  · Al leer, el Excel manda y encima se re-aplican los cambios aún pendientes, para que la pantalla no "salte".
import { KEYS, SYNC_TIMEOUT_MS, HISTORY_PAGE } from './config.js';
import { lsGet, lsSet, lsRemove, getCode, getApiUrl, setUser, setEvents, setBares, setCumples, getHistoryP1, setHistoryP1, setMyHistory } from './store.js';
import { assignIds, eventKey, addAttendee, removeAttendee } from './utils.js';

export class AuthError extends Error {}

export const isConfigured = () => !!getApiUrl();
export const isLoggedIn = () => !!getApiUrl() && !!getCode();

// ── Llamada HTTP ────────────────────────────────────────
async function post(body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SYNC_TIMEOUT_MS);
  try {
    // text/plain evita el preflight CORS, que Apps Script no responde.
    const resp = await fetch(getApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ code: getCode(), ...body }),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    let json;
    try { json = await resp.json(); } catch { throw new Error('La respuesta del servidor no es válida'); }
    if (json.error === 'unauthorized') throw new AuthError('unauthorized');
    if (!json.ok) throw new Error(json.error || 'Error del servidor');
    return json;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Tiempo de espera agotado');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Cola de cambios ─────────────────────────────────────
// entrada: { id, op:'upsert'|'delete'|'join'|'leave', match:{fecha,evento}|null, event?, changes? }
function readOutbox() {
  try { const o = JSON.parse(lsGet(KEYS.outbox) || '[]'); return Array.isArray(o) ? o : []; } catch { return []; }
}
const writeOutbox = list => (list.length ? lsSet(KEYS.outbox, JSON.stringify(list)) : lsRemove(KEYS.outbox));
export const pendingCount = () => readOutbox().length;

const keyOf = ev => ({ fecha: ev.fecha, evento: ev.evento });
const FIELDS = ['fecha', 'fechaFin', 'tipo', 'evento', 'sitio', 'propone', 'previa', 'asistentes', 'imagen', 'youtube', 'tickets'];

/** Campos que han cambiado entre dos versiones de un evento. */
export function diffEvent(before, after) {
  const changes = {};
  for (const f of FIELDS) if ((before[f] || '') !== (after[f] || '')) changes[f] = after[f] || '';
  return changes;
}

/** Alta (previous = undefined) o edición. Solo se envían los campos cambiados, para no pisar a otras personas. */
export function queueUpsert(event, previous) {
  const box = readOutbox();
  const i = box.findIndex(e => e.id === event.id && e.op === 'upsert');
  if (i >= 0) {
    box[i] = { ...box[i], event, changes: box[i].match ? { ...box[i].changes, ...diffEvent(previous || {}, event) } : undefined };
  } else {
    box.push({ id: event.id, op: 'upsert', match: previous ? keyOf(previous) : null, event, changes: previous ? diffEvent(previous, event) : undefined });
  }
  writeOutbox(box);
}

export function queueDelete(event) {
  let box = readOutbox().filter(e => e.id !== event.id);
  const pendingCreate = readOutbox().some(e => e.id === event.id && e.op === 'upsert' && !e.match);
  if (!pendingCreate) box.push({ id: event.id, op: 'delete', match: keyOf(event) });   // si solo existía aquí, no hay nada que borrar en el Excel
  writeOutbox(box);
}

function queueToggle(event, op, opposite) {
  const box = readOutbox();
  const last = [...box].reverse().find(e => e.id === event.id && (e.op === 'join' || e.op === 'leave'));
  if (last && last.op === opposite) box.splice(box.lastIndexOf(last), 1);        // apuntarse y quitarse sin enviar se anulan
  else box.push({ id: event.id, op, match: keyOf(event) });
  writeOutbox(box);
}
export const queueJoin = ev => queueToggle(ev, 'join', 'leave');
export const queueLeave = ev => queueToggle(ev, 'leave', 'join');

/** Re-aplica los cambios pendientes sobre una lista recién leída del Excel. */
function overlay(list, box, user) {
  let out = list.slice();
  for (const e of box) {
    if (e.op === 'join' || e.op === 'leave') {
      const k = eventKey(e.match);
      out = out.map(ev => (eventKey(ev) === k && user
        ? { ...ev, asistentes: e.op === 'join' ? addAttendee(ev.asistentes, user) : removeAttendee(ev.asistentes, user) }
        : ev));
      continue;
    }
    const keys = new Set();
    if (e.match) keys.add(eventKey(e.match));
    if (e.op === 'upsert') keys.add(eventKey(e.event));
    out = out.filter(ev => !keys.has(eventKey(ev)));
    if (e.op === 'upsert') out.push(e.event);
  }
  return out;
}

// ── Sincronización ──────────────────────────────────────
let busy = null;

/**
 * Envía la cola y lee el estado actual del Excel en una sola petición.
 * Peticiones simultáneas comparten la misma ejecución.
 * @returns {{sent:number, rejected:{op:object,error:string}[], archived:number}}
 */
export function syncNow() {
  if (busy) return busy;
  busy = (async () => {
    const box = readOutbox();
    const sent = new Set(box.map(e => JSON.stringify(e)));
    const json = await post({ action: 'sync', ops: box.map(({ op, match, event, changes }) => ({ op, match, event, changes })) });

    // Se retiran solo las entradas enviadas tal cual; las creadas o editadas durante la petición siguen en cola.
    writeOutbox(readOutbox().filter(e => !sent.has(JSON.stringify(e))));
    const rejected = [];
    (json.results || []).forEach((r, i) => { if (!r.ok) rejected.push({ op: box[i], error: r.error }); });

    setUser(json.user);
    setEvents(overlay(assignIds(json.data.quedadas), readOutbox(), json.user));
    setBares(json.data.bares);
    if (Array.isArray(json.data.cumples)) setCumples(json.data.cumples);   // un script antiguo no los manda: se conservan los que había
    return { sent: box.length, rejected, archived: json.archived || 0 };
  })().finally(() => { busy = null; });
  return busy;
}

// ── Historial (por páginas) ─────────────────────────────
// El histórico del Excel es lo más grande (~1000 filas): nunca se descarga entero. Llegan los 30 más recientes y un
// botón pide más; la búsqueda la hace el servidor; el perfil pide solo los eventos en los que aparezco.
export const historyState = { items: getHistoryP1().items, total: getHistoryP1().total, q: '', loading: false, error: '' };

/** Pide una página. reset=true empieza de cero (p. ej. al buscar). Devuelve true si cambió algo. */
export async function loadHistoryPage(reset = false, q = historyState.q) {
  if (historyState.loading) return false;
  historyState.loading = true;
  try {
    const sameQuery = q === historyState.q;
    const offset = reset || !sameQuery ? 0 : historyState.items.length;
    const json = await post({ action: 'historico', offset, limit: HISTORY_PAGE, q });
    // Compatibilidad: un script antiguo (aún sin actualizar en Google) devuelve el histórico entero en data.historico
    const lista = json.items || (json.data && json.data.historico) || [];
    const filtrada = json.items ? lista : lista.filter(e => !q || [e.evento, e.tipo, e.asistentes].join(' ').toLowerCase().includes(q.toLowerCase()))
      .sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)));
    const items = assignIds(json.items ? lista : filtrada.slice(offset, offset + HISTORY_PAGE));
    historyState.items = offset === 0 ? items : [...historyState.items, ...items];
    historyState.total = json.total ?? (json.items ? lista.length : filtrada.length);
    historyState.q = q;
    historyState.error = '';
    if (!q && offset === 0) setHistoryP1({ items, total: json.total });     // la primera página sin filtro se guarda para verla al instante
    return true;
  } catch (err) {
    historyState.error = err.message;
    throw err;
  } finally {
    historyState.loading = false;
  }
}

/** Los eventos pasados en los que aparezco (por nombre o alias). Los filtra el servidor. */
export async function loadMyHistory() {
  const json = await post({ action: 'historico', mine: true });
  setMyHistory(assignIds(json.items || (json.data && json.data.historico) || []));   // el perfil vuelve a filtrar por nombre, así que también vale con un script antiguo
}

// ── Administración (solo rol admin) ─────────────────────
export async function admin(cmd, extra = {}) {
  return post({ action: 'admin', cmd, ...extra });
}

