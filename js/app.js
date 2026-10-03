import { APP_VERSION, SYNC_MIN_INTERVAL_MS } from './config.js';
import { safeUrl, parseDate, uid, today, extractYtId, ytThumb, addAttendee, removeAttendee, extraerCodigo } from './utils.js';
import {
  getEvents, setEvents, getUser, isAdmin, getCode, setCode, getApiUrl, setDevApiUrl, EN_LOCAL, clearSession, lsGet, lsSet,
} from './store.js';
import { filters, renderEvents, renderBares, renderHistorial, toggleAttendees, fillTypeSelect } from './render.js';
import { renderProfile, profileState } from './profile.js';
import { renderCumples, renderCumpleBanner, ocultarAvisoHoy } from './cumples.js';
import { renderGrupos } from './grupos.js';
import { loadAdmin, adminAction, adminCreate, setLogFilter } from './admin.js';
import {
  AuthError, isConfigured, isLoggedIn, syncNow, loadHistoryPage, loadMyHistory, pendingCount,
  queueUpsert, queueDelete, queueJoin, queueLeave, diffEvent,
} from './api.js';
import { $, showToast } from './ui.js';

console.info(`Darkcelona ${APP_VERSION}`);

// ── Acceso ──────────────────────────────────────────────
function showAccess(msg) {
  $('access-msg').textContent = msg;
  $('access-screen').hidden = false;
  document.body.classList.add('locked');
  $('user-chip').hidden = true;
  $('tab-admin').hidden = true;
  document.querySelector('.fab').hidden = true;
}

function hideAccess() {
  $('access-screen').hidden = true;
  document.body.classList.remove('locked');
}

/** Pinta lo que depende de quién soy: nombre en la cabecera, pestaña Admin y botón de añadir. */
function applyUserUI() {
  const user = getUser();
  $('user-chip').hidden = !user;
  if (user) $('user-chip').textContent = '👤 ' + user.nombre;
  $('tab-admin').hidden = !isAdmin();
  document.querySelector('.fab').hidden = !user;
}

function logout(msg) {
  clearSession();
  profileState.pastLimit = 30;
  renderAll();
  applyUserUI();
  selectTab('quedadas');
  showAccess(msg);
}

// ── Pestañas y filtros ──────────────────────────────────
let currentTab = 'quedadas';

function selectTab(name) {
  currentTab = name;
  document.querySelectorAll('.nav-tab').forEach(t => {
    const active = t.dataset.tab === name;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
  if (name === 'bares') renderBares();
  if (name === 'cumples') renderCumples();
  if (name === 'grupos') renderGrupos();
  if (name === 'historial') { renderHistorial(); ensureHistory(); }
  if (name === 'perfil') { renderProfile(false); ensureMyHistory(); }
  if (name === 'admin') loadAdmin();
}

/** Historial: la primera página, guardada de la vez anterior, se ve al instante; luego se pide la actual. */
async function ensureHistory() {
  if (!isLoggedIn()) return;
  try { await loadHistoryPage(true); } catch (err) { if (err instanceof AuthError) return handleAuthLost(); }
  if (currentTab === 'historial') renderHistorial();
}

/** Perfil: el servidor devuelve solo los eventos pasados en los que aparezco, no todo el histórico. */
async function ensureMyHistory() {
  if (!isLoggedIn()) return;
  try { await loadMyHistory(); } catch (err) { if (err instanceof AuthError) return handleAuthLost(); }
  if (currentTab === 'perfil') renderProfile(true);
}

function selectFilter(chip) {
  filters.type = chip.dataset.filter;
  renderEvents();
}

function renderAll() {
  renderEvents();
  renderCumpleBanner();
  if (currentTab === 'cumples') renderCumples();
  if (currentTab === 'grupos') renderGrupos();
  if (currentTab === 'bares') renderBares();
  if (currentTab === 'historial') renderHistorial();
  if (currentTab === 'perfil') renderProfile(true);
}

// ── Estado de la sincronización ─────────────────────────
function updateSyncBar(state, msg) {
  const bar = $('sync-bar'), icon = $('sync-icon'), text = $('sync-text');
  const pending = pendingCount();
  if (state === 'ok' && !pending) { bar.hidden = true; return; }
  bar.hidden = false;
  if (state === 'syncing') {
    bar.className = 'sync-bar syncing';
    icon.innerHTML = '<span class="spin">🔄</span>';
    text.className = 'sync-text syncing';
    text.textContent = getEvents().length ? 'Sincronizando…' : 'Conectando con el servidor… la primera vez puede tardar hasta un minuto';
  } else if (state === 'err') {
    bar.className = 'sync-bar err';
    icon.textContent = '⚠️';
    text.className = 'sync-text err';
    text.textContent = (msg || 'Sin conexión') + (pending ? ` · ${pending} cambio${pending > 1 ? 's' : ''} por enviar` : '');
  } else {
    bar.className = 'sync-bar syncing';
    icon.textContent = '⏳';
    text.className = 'sync-text syncing';
    text.textContent = `${pending} cambio${pending > 1 ? 's' : ''} por enviar…`;
  }
}

const REJECT_MSG = {
  forbidden: 'No tienes permiso para eso',
  not_found: 'Ese plan ya no existe (puede que se haya archivado o borrado)',
};

let lastSyncAt = 0;
let flushTimer;

function handleAuthLost() {
  logout('Tu acceso ya no es válido. Pide un enlace nuevo a un admin del grupo.');
}

async function runSync(manual) {
  if (!isLoggedIn()) return;
  updateSyncBar('syncing');
  try {
    const res = await syncNow();
    lastSyncAt = Date.now();
    applyUserUI();
    renderAll();
    updateSyncBar('ok');
    res.rejected.forEach(r => showToast('❌ ' + (REJECT_MSG[r.error] || r.error), 'error'));
    if (manual) showToast('✓ Sincronizado');
    if (currentTab === 'admin') loadAdmin();
  } catch (err) {
    if (err instanceof AuthError) return handleAuthLost();
    const offline = err instanceof TypeError || !navigator.onLine;
    updateSyncBar('err', offline ? 'Sin conexión: se enviará al volver la red' : err.message.slice(0, 80));
    if (manual) showToast('❌ No se pudo sincronizar', 'error');
  }
}

/** Envía los cambios poco después de hacerlos (agrupa varios seguidos). */
function scheduleFlush() {
  updateSyncBar('pending');
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => runSync(false), 700);
}

// ── Apuntarse / quitarse ────────────────────────────────
function toggleGoing(id, joining) {
  const user = getUser();
  const events = getEvents();
  const ev = events.find(e => e.id === id);
  if (!ev || !user) return;
  setEvents(events.map(e => (e.id === id
    ? { ...e, asistentes: joining ? addAttendee(e.asistentes, user) : removeAttendee(e.asistentes, user) }
    : e)));
  (joining ? queueJoin : queueLeave)(ev);
  renderAll();
  showToast(joining ? '🤘 ¡Apuntado!' : 'Te has quitado del plan');
  scheduleFlush();
}

// ── Modal de evento ─────────────────────────────────────
let editingId = null;
let previewTimer;

function previewImg(url) {
  clearTimeout(previewTimer);
  const wrap = $('img-preview-wrap'), img = $('img-preview');
  wrap.classList.remove('visible', 'error');
  if (!url) return;
  const src = ytThumb(extractYtId(url)) || safeUrl(url);
  if (!src) { wrap.classList.add('visible', 'error'); return; }
  previewTimer = setTimeout(() => {
    img.onload = () => { wrap.classList.remove('error'); wrap.classList.add('visible'); };
    img.onerror = () => wrap.classList.add('visible', 'error');
    img.src = src;
  }, 500);
}

function openModal(id) {
  editingId = id || null;
  const user = getUser();
  const ev = id ? getEvents().find(e => e.id === id) : null;
  $('modal-title-text').textContent = ev ? '✏️ Editar Evento' : '🎸 Nueva Quedada';
  $('f-fecha').value = ev?.fecha || today();
  $('f-fecha-fin').value = ev?.fechaFin || '';
  fillTypeSelect(ev?.tipo);
  $('f-tipo').value = ev?.tipo || 'Concierto';
  $('f-evento').value = ev?.evento || '';
  $('f-sitio').value = ev?.sitio || '';
  $('f-propone').value = ev ? ev.propone || '' : user?.nombre || '';
  $('f-previa').value = ev?.previa || '';
  $('f-asistentes').value = ev ? ev.asistentes || '' : user?.nombre || '';
  $('f-imagen').value = ev?.imagen || '';
  $('f-youtube').value = ev?.youtube || '';
  $('f-tickets').value = ev?.tickets || '';
  previewImg(ev?.imagen || '');
  $('modal-overlay').classList.add('open');
  $('f-evento').focus();
}

function closeModal() {
  $('modal-overlay').classList.remove('open');
  editingId = null;
}

/** Acepta solo http(s) en los campos de enlace; avisa si hay alguno inválido. */
function readUrlField(id, label) {
  const raw = $(id).value.trim();
  if (!raw) return '';
  const url = safeUrl(raw);
  if (!url) throw new Error(`${label}: el enlace debe empezar por http:// o https://`);
  return url;
}

function saveEvent() {
  const fecha = $('f-fecha').value;
  const evento = $('f-evento').value.trim();
  if (!parseDate(fecha) || !evento) { showToast('Fecha y evento son obligatorios', 'error'); return; }
  const fechaFin = $('f-fecha-fin').value;
  if (fechaFin && (!parseDate(fechaFin) || fechaFin <= fecha)) {
    showToast('La fecha fin debe ser posterior a la de inicio', 'error');
    return;
  }
  let data;
  try {
    data = {
      fecha, fechaFin, evento,
      tipo: $('f-tipo').value,
      sitio: $('f-sitio').value.trim(),
      propone: $('f-propone').value.trim(),
      previa: $('f-previa').value.trim(),
      asistentes: $('f-asistentes').value.trim(),
      imagen: readUrlField('f-imagen', 'Imagen'),
      youtube: readUrlField('f-youtube', 'YouTube'),
      tickets: readUrlField('f-tickets', 'Entradas'),
    };
  } catch (e) {
    showToast(e.message, 'error');
    return;
  }

  const events = getEvents().slice();
  const idx = editingId ? events.findIndex(e => e.id === editingId) : -1;
  const previous = idx >= 0 ? events[idx] : undefined;
  if (previous && !Object.keys(diffEvent(previous, { ...previous, ...data })).length) { closeModal(); return; }   // sin cambios
  const saved = previous ? { ...previous, ...data } : { id: uid(), ...data };
  if (previous) events[idx] = saved; else events.push(saved);
  setEvents(events);
  queueUpsert(saved, previous);
  showToast(previous ? '✅ Evento actualizado' : '🤘 Evento añadido');
  closeModal();
  renderAll();
  scheduleFlush();
}

function deleteEvent(id) {
  if (!isAdmin()) return;
  const ev = getEvents().find(e => e.id === id);
  if (!ev || !confirm('¿Eliminar este evento? Se borrará del Excel (queda anotado en el registro y se puede deshacer).')) return;
  queueDelete(ev);
  setEvents(getEvents().filter(e => e.id !== id));
  renderAll();
  showToast('🗑️ Evento eliminado');
  scheduleFlush();
}

// ── Acceso con código ───────────────────────────────────
async function enterWithCode(code) {
  if (!code) return;
  setCode(code);
  if (!isConfigured()) { showAccess('La app todavía no está conectada al servidor. Avisa a un admin.'); return; }
  $('access-msg').textContent = 'Comprobando…';
  try {
    await syncNow();
  } catch (err) {
    clearSession();
    showAccess(err instanceof AuthError ? 'Ese código no es válido o ya no está activo. Pide uno nuevo a un admin.' : 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.');
    return;
  }
  hideAccess();
  applyUserUI();
  renderAll();
  showToast(`¡Hola, ${getUser().nombre}! 🤘`);
}

// ── PWA ─────────────────────────────────────────────────
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  if (!lsGet('darkcelona-pwa-dismissed')) $('pwa-banner').hidden = false;
});

async function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') showToast('📲 App instalada');
  deferredPrompt = null;
  $('pwa-banner').hidden = true;
  lsSet('darkcelona-pwa-dismissed', '1');
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let reg;
  try {
    reg = await navigator.serviceWorker.register('./sw.js');
  } catch (e) {
    console.warn('Service Worker no disponible (sirve la app por HTTPS o localhost):', e.message);
    return;
  }
  // Cuando una versión nueva toma el control, recarga una vez para usarla.
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    // Si está rellenando un plan, se espera a que lo cierre para no perderle lo escrito
    const recargar = () => {
      if (document.getElementById('modal-overlay')?.classList.contains('open')) return setTimeout(recargar, 3000);
      location.reload();
    };
    recargar();
  });
  // Buscar versión nueva al volver a la app y cada 30 minutos (publicar-web.sh cambia la versión del SW en cada publicación).
  const buscar = () => reg.update().catch(() => {});
  document.addEventListener('visibilitychange', () => { if (!document.hidden) buscar(); });
  setInterval(buscar, 30 * 60 * 1000);
}

// ── Eventos globales (delegación) ───────────────────────
const actions = {
  'new-event': () => openModal(),
  'close-modal': closeModal,
  'save-event': saveEvent,
  'edit': el => openModal(el.dataset.id),
  'delete': el => deleteEvent(el.dataset.id),
  'join': el => toggleGoing(el.dataset.id, true),
  'leave': el => toggleGoing(el.dataset.id, false),
  'toggle': el => toggleAttendees(el),
  'sync': () => runSync(true),
  'goto-profile': () => selectTab('perfil'),
  'cumple-dismiss': () => ocultarAvisoHoy(),
  'history-more': async () => {
    const pintar = () => { if (currentTab === 'historial') renderHistorial(); };
    pintar();                                                      // muestra "Cargando…" en el botón
    try { const p = loadHistoryPage(false); pintar(); await p; } catch (err) { if (err instanceof AuthError) return handleAuthLost(); }
    pintar();
  },
  'profile-more': () => { profileState.pastLimit += 30; renderProfile(true); },
  'logout': () => { if (confirm('¿Cerrar sesión en este dispositivo? Tendrás que volver a entrar con tu enlace personal.')) logout('Has cerrado sesión.'); },
  'install': installPWA,
  'pwa-dismiss': () => { $('pwa-banner').hidden = true; lsSet('darkcelona-pwa-dismissed', '1'); },
};

document.addEventListener('click', e => {
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    const name = actionEl.dataset.action;
    if (actions[name]) { actions[name](actionEl); return; }
    if (name.startsWith('admin-')) { adminAction(name, actionEl); return; }
  }
  const tab = e.target.closest('.nav-tab');
  if (tab) { selectTab(tab.dataset.tab); return; }
  const chip = e.target.closest('.filter-chip');
  if (chip) selectFilter(chip);
});

document.addEventListener('submit', e => {
  if (e.target.id === 'admin-new') { e.preventDefault(); adminCreate(); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'log-filter') setLogFilter(e.target.value);
});

$('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
$('event-form').addEventListener('submit', e => { e.preventDefault(); saveEvent(); });
$('access-form').addEventListener('submit', e => {
  e.preventDefault();
  const input = $('access-code');
  const code = extraerCodigo(input.value);          // vale pegar el enlace entero o solo el código
  input.value = '';
  enterWithCode(code);
});
$('f-imagen').addEventListener('input', e => previewImg(e.target.value.trim()));
$('search-input').addEventListener('input', e => { filters.search = e.target.value; renderEvents(); });
// La búsqueda del historial la hace el servidor; se espera a que la persona deje de escribir para no preguntar en cada tecla.
let historySearchTimer;
$('hist-search').addEventListener('input', e => {
  clearTimeout(historySearchTimer);
  const q = e.target.value.trim();
  historySearchTimer = setTimeout(async () => {
    try { const p = loadHistoryPage(true, q); renderHistorial(); await p; } catch (err) { if (err instanceof AuthError) return handleAuthLost(); }
    if (currentTab === 'historial') renderHistorial();
  }, 450);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !isLoggedIn()) return;
  renderEvents();
  renderCumpleBanner();                          // por si ha cambiado el día desde la última vez
  if (Date.now() - lastSyncAt > SYNC_MIN_INTERVAL_MS) runSync(false);   // trae lo que hayan cambiado otras personas
});
window.addEventListener('online', () => { if (isLoggedIn() && pendingCount()) runSync(false); });

// ── Arranque ────────────────────────────────────────────
/** El enlace personal lleva el código en la parte `#acceso=…`, que nunca viaja al servidor. */
function takeCodeFromLink() {
  const m = location.hash.match(/[#&]acceso=([^&]+)/);
  if (!m) return false;
  setCode(decodeURIComponent(m[1]));
  history.replaceState(null, '', location.pathname + location.search);   // el código no se queda en la barra de direcciones
  return true;
}

/** Solo en desarrollo (localhost): conecta sola con la API simulada que haya arrancado abrir-local.bat. */
async function devAutoConnect() {
  if (!EN_LOCAL) return;
  try {
    const r = await fetch('/__dev-config.json', { cache: 'no-store' });
    if (!r.ok) { setDevApiUrl(''); return; }           // no hay simulador: se olvida cualquier desvío anterior y manda config.js
    const { apiUrl, token } = await r.json();
    setDevApiUrl(apiUrl || '');
    if (token && !getCode()) setCode(token);          // sin enlace personal, entra como admin de pruebas
  } catch { setDevApiUrl(''); }
}

async function start() {
  registerSW();
  const fromLink = takeCodeFromLink();
  await devAutoConnect();

  if (!isConfigured()) { renderAll(); showAccess('La app todavía no está conectada al servidor. Avisa a un admin.'); return; }
  if (!getCode()) { renderAll(); showAccess('Para entrar necesitas tu enlace personal. Pídeselo a un admin del grupo.'); return; }

  hideAccess();
  applyUserUI();
  renderAll();                                   // primero lo que haya en el dispositivo
  if (fromLink && !getUser()) $('access-msg').textContent = '';
  await runSync(false);                          // y enseguida lo último del Excel
  if (fromLink && getUser()) showToast(`¡Hola, ${getUser().nombre}! 🤘`);
}

start();
