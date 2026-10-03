import { KEYS, API_URL } from './config.js';
import { namesOf, attends } from './utils.js';

// localStorage puede lanzar (modo privado, cuota, datos bloqueados): todo va protegido.
export function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function lsSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
export function lsRemove(key) {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}
function lsGetJson(key, fallback) {
  const raw = lsGet(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

// ── Sesión ──────────────────────────────────────────────
export const getCode = () => lsGet(KEYS.code) || '';
export const setCode = c => lsSet(KEYS.code, c);
// En un sitio publicado manda SIEMPRE la dirección de config.js (nada guardado en el navegador puede desviarla).
// Solo en localhost, y solo si hay una API simulada arrancada (abrir-local.bat), manda esa.
export const EN_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
export const getApiUrl = () => (EN_LOCAL && lsGet(KEYS.apiUrl)) || API_URL || '';
export const setDevApiUrl = u => (u ? lsSet(KEYS.apiUrl, u) : lsRemove(KEYS.apiUrl));

let user = lsGetJson(KEYS.user, null);
export const getUser = () => user;
export function setUser(u) { user = u; lsSet(KEYS.user, JSON.stringify(u)); }
export const isAdmin = () => !!user && user.rol === 'admin';

/** Cerrar sesión: borra el código y toda la información guardada en este dispositivo. */
export function clearSession() {
  user = null;
  events = []; historyP1 = { items: [], total: 0 }; myHistory = []; bares = []; cumples = []; grupos = [];
  Object.values(KEYS).forEach(k => { if (k !== KEYS.apiUrl) lsRemove(k); });
}

// ── Datos (caché de la última sincronización) ───────────
let events = lsGetJson(KEYS.events, []);
export const getEvents = () => events;
export function setEvents(list) {
  events = list;
  if (!lsSet(KEYS.events, JSON.stringify(events))) console.warn('No se pudo guardar en localStorage');
}

// Historial: no se guarda entero (son ~1000 filas). Solo la primera página y "mis eventos".
let historyP1 = lsGetJson(KEYS.historyP1, { items: [], total: 0 });
export const getHistoryP1 = () => historyP1;
export function setHistoryP1(page) { historyP1 = page; lsSet(KEYS.historyP1, JSON.stringify(page)); }

let myHistory = lsGetJson(KEYS.myHistory, []);
export const getMyHistory = () => myHistory;
export function setMyHistory(list) { myHistory = list; lsSet(KEYS.myHistory, JSON.stringify(list)); }

let cumples = lsGetJson(KEYS.cumples, []);
export const getCumples = () => cumples;
export function setCumples(list) { cumples = list; lsSet(KEYS.cumples, JSON.stringify(list)); }

let grupos = lsGetJson(KEYS.grupos, []);
export const getGrupos = () => grupos;
export function setGrupos(list) { grupos = list; lsSet(KEYS.grupos, JSON.stringify(list)); }

let bares = lsGetJson(KEYS.bares, []);
export const getBares = () => bares;
export function setBares(list) { bares = list; lsSet(KEYS.bares, JSON.stringify(list)); }

// ── Yo ──────────────────────────────────────────────────
/** ¿Aparezco yo (por nombre o alias) entre los asistentes? */
export const hasMe = asistentes => attends(asistentes, namesOf(user));
