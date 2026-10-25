import { MONTHS_ES, MONTHS_FULL, DAYS_ES, TYPE_ICONS, DEFAULT_TYPES, HISTORY_PAGE, TIPOS_CONCIERTO } from './config.js';
import { escHtml, safeUrl, parseDate, getAttendees, today, normalizeName, namesOf, extractYtId, ytThumb, formatShortRange, mapsUrl, entradasDeTexto, personasEn, estaCompleto, hayHueco, acompanantes, plazoVencido } from './utils.js';
import { getEvents, getBares, getUser, hasMe, isAdmin } from './store.js';
import { historyState } from './api.js';
import { esNuevo, recientes, marcarVisto, sinVer } from './novedades.js';
import { vacioHTML } from './mascota.js';
import { t, tp, localeNumeros } from './i18n.js';

const $ = id => document.getElementById(id);

export const filters = { type: 'all', search: '' };

function typeClass(tipo) {
  if (!tipo) return 'type-Otros';
  if (tipo.includes('Tributo')) return 'type-Tributo';
  if (tipo === 'Concierto') return 'type-Concierto';
  if (tipo === 'Cerveceo') return 'type-Cerveceo';
  if (tipo === 'Festival') return 'type-Festival';
  if (tipo === 'Eventos Darkcelona') return 'type-Barbacoa';   // misma clase (verde) que tenía Barbacoa
  return 'type-Otros';
}

/** Números de la página principal: planes que quedan, cuántos son conciertos y a cuántos voy. */
export function resumenPlanes(events, todayStr = today()) {
  const proximos = events.filter(e => isUpcoming(e, todayStr));
  return {
    proximos: proximos.length,
    conciertos: proximos.filter(e => TIPOS_CONCIERTO.includes(e.tipo)).length,
    voy: proximos.filter(e => hasMe(e.asistentes)).length,
  };
}

/** Un evento es "futuro" hasta el final de su último día. */
export const isUpcoming = (ev, todayStr = today()) => (ev.fechaFin || ev.fecha) >= todayStr;

// ── Tipos y filtros dinámicos ───────────────────────────
/** Tipos conocidos (los del desplegable del Excel) + cualquier otro que aparezca en los datos. */
export function allTypes() {
  const extra = new Set();
  for (const e of [...getEvents(), ...historyState.items]) if (e.tipo && !DEFAULT_TYPES.includes(e.tipo)) extra.add(e.tipo);
  return [...DEFAULT_TYPES, ...[...extra].sort()];
}

export function renderFilterChips() {
  const present = new Set(getEvents().map(e => e.tipo));
  const types = allTypes().filter(ty => present.has(ty));
  if (filters.type !== 'all' && filters.type !== 'mine' && filters.type !== 'flag' && !types.includes(filters.type)) filters.type = 'all';
  const chip = (value, label) =>
    `<button class="filter-chip${filters.type === value ? ' active' : ''}" data-filter="${escHtml(value)}">${label}</button>`;
  $('filters').innerHTML = chip('all', t('Todos')) + types.map(ty => chip(ty, escHtml(t(ty)))).join('') + chip('mine', t('⚡ Mis planes')) + (getEvents().some(e => e.interes && !hasMe(e.asistentes) && isUpcoming(e)) ? chip('flag', t('🚩 Me interesan')) : '');
}

export function fillTypeSelect(current) {
  const types = allTypes();
  if (current && !types.includes(current)) types.push(current);
  $('f-tipo').innerHTML = types.map(ty => `<option value="${escHtml(ty)}">${escHtml(t(ty))}</option>`).join('');
}

// ── Tarjeta de evento ───────────────────────────────────
const ESTADOS_VENTA = { agotado: 'AGOTADO', cancelado: 'CANCELADO', aplazado: 'APLAZADO' };
const eur = n => `${Number(n).toLocaleString(localeNumeros(), { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 })} €`;
/** " · desde 30 €" (o "30–45 €") si se conoce el precio. */
function precioTexto(ev) {
  const a = ev.precioMin, b = ev.precioMax;
  if (a == null || !(Number(a) > 0)) return '';
  return b != null && Number(b) > Number(a) ? ` · ${eur(a)}–${eur(b)}` : ' · ' + t('desde {precio}', { precio: eur(a) });
}

/** Línea de lugar: si hay sitio, es un enlace a Google Maps (en el móvil abre la app de mapas). */
function lugar(icono, texto, extra = '') {
  const sitio = String(texto || '').trim();
  if (!sitio) return '';
  const maps = mapsUrl(sitio);
  const cuerpo = `${icono} ${escHtml(sitio)}`;
  return `<div class="event-venue ${extra}">${maps ? `<a class="venue-link" href="${escHtml(maps)}" target="_blank" rel="noopener noreferrer" title="${t('Ver en Google Maps')}">${cuerpo}</a>` : cuerpo}</div>`;
}

/** "20 oct" a partir de AAAA-MM-DD. */
function fechaCorta(iso) {
  const d = parseDate(iso);
  return d ? `${d.getDate()} ${MONTHS_ES[d.getMonth()]}` : '';
}

/** Selector de acompañantes (+N) de mi apuntado. */
function pasos(ev, id) {
  const n = acompanantes(ev.asistentes, getUser());
  if (n === null) return '';
  return `<span class="plus-step" title="${t('Personas que vienen contigo')}"><button data-action="plus-menos" data-id="${id}" aria-label="${t('Un acompañante menos')}"${n ? '' : ' disabled'}>−</button><span class="plus-n">${n ? '+' + n : '+0'}</span><button data-action="plus-mas" data-id="${id}" aria-label="${t('Un acompañante más')}"${hayHueco(ev, 1) ? '' : ' disabled'}>＋</button></span>`;
}

export function eventCard(ev, d, todayStr) {
  const nuevo = esNuevo(ev);
  const attendees = getAttendees(ev.asistentes);
  const personas = personasEn(ev.asistentes);
  const mine = hasMe(ev.asistentes);
  const upcoming = isUpcoming(ev, todayStr);
  const completo = estaCompleto(ev);
  const sinPlazo = plazoVencido(ev, todayStr);
  const icon = TYPE_ICONS[ev.tipo] || '🎸';
  const myNames = namesOf(getUser());
  const id = escHtml(ev.id);

  const dateHtml = `<div class="event-date-block">
      <div class="event-day-num">${d.getDate()}</div>
      <div class="event-month">${MONTHS_ES[d.getMonth()]}</div>
      <div class="event-weekday">${DAYS_ES[d.getDay()]}</div>
      ${ev.fechaFin ? `<div class="event-range">${escHtml(formatShortRange(ev.fecha, ev.fechaFin))}</div>` : ''}
    </div>`;
  const imgSrc = safeUrl(ev.imagen) || ytThumb(extractYtId(ev.youtube || ''));
  const imgHtml = imgSrc
    ? `<div class="event-img-col"><img class="event-img" src="${escHtml(imgSrc)}" alt="${escHtml(ev.evento)}" loading="lazy" referrerpolicy="no-referrer"><div class="event-img-placeholder" hidden><span>${icon}</span></div>${dateHtml}</div>`
    : `<div class="event-img-col"><div class="event-img-placeholder"><span>${icon}</span></div>${dateHtml}</div>`;

  const yt = safeUrl(ev.youtube);
  const tk = safeUrl(ev.tickets) || entradasDeTexto(ev.evento);
  const mediaBtns = (yt || tk)
    ? `<div class="event-media-btns">${
        yt ? `<a class="btn-yt" href="${escHtml(yt)}" target="_blank" rel="noopener noreferrer">▶ YouTube</a>` : ''
      }${
        tk ? `<a class="btn-ticket" href="${escHtml(tk)}" target="_blank" rel="noopener noreferrer">🎟️ ${t('Entradas')}${precioTexto(ev)}</a>` : ''
      }</div>`
    : '';

  const chips = attendees.map(a =>
    `<span class="attendee-chip${myNames.includes(normalizeName(a)) ? ' omar' : ''}">${escHtml(a)}</span>`
  ).join('');

  const estadoVenta = ESTADOS_VENTA[ev.estadoVenta] ? `<span class="venta-badge venta-${escHtml(ev.estadoVenta)}">${t(ESTADOS_VENTA[ev.estadoVenta])}</span>` : '';
  const aforo = (ev.limite ? `<span class="limite-badge">👥 ${t('Límite {n}', { n: ev.limite })} · ${tp(personas, '{n} apuntado', '{n} apuntados')}</span>` : '')
    + (ev.fechaLimite ? (sinPlazo ? `<span class="venta-badge venta-agotado">${t('PLAZO CERRADO')}</span>` : `<span class="limite-badge">⏳ ${t('Apuntarse hasta el {fecha}', { fecha: fechaCorta(ev.fechaLimite) })}</span>`) : '')
    + (completo ? `<span class="venta-badge venta-agotado">${t('COMPLETO')}</span>` : '');
  const badges = aforo + (nuevo ? `<span class="new-badge">✨ ${t('NUEVO')}</span>` : '') + estadoVenta + (ev.fecha === todayStr || (ev.fechaFin && ev.fecha <= todayStr && ev.fechaFin >= todayStr)
    ? `<span class="upcoming-badge">${t('HOY')}</span>`
    : '');

  const joinBtn = !upcoming ? '' : mine
    ? `<span class="voy-tag">✓ ${t('Voy')}</span><button class="btn-join" data-action="leave" data-id="${id}">${t('Quitarme')}</button>${pasos(ev, id)}<button class="btn-join btn-cal" data-action="calendar" data-id="${id}" title="${t('Añadir a mi calendario')}" aria-label="${t('Añadir a mi calendario')}">📅</button>`
    : sinPlazo
      ? `<button class="btn-join" disabled title="${t('Se acabó el plazo para apuntarse')}">🔒 ${t('Plazo cerrado')}</button>`
    : completo
      ? `<button class="btn-join" disabled title="${t('Ya no caben más')}">🔒 ${t('Completo')}</button>`
      : `<button class="btn-join" data-action="join" data-id="${id}">＋ ${t('Apuntarme')}</button>`;

  return `
  <article class="event-card${mine ? ' omar-event' : ''}${nuevo ? ' is-new' : ''}" data-id="${id}">
    <div class="event-card-inner">
      ${imgHtml}
      <div class="event-content-col">
        <div class="event-card-header">
          <div class="event-main">
            <div><span class="event-type-badge ${typeClass(ev.tipo)}">${escHtml(t(ev.tipo || 'Otros'))}</span>${badges}</div>
            <div class="event-title">${escHtml(ev.evento)}</div>
            ${lugar('📍', ev.sitio)}
            ${ev.previa ? `<div class="event-venue event-previa">🍺 ${t('Previa')}: ${escHtml(ev.previa)}</div>` : ''}
          </div>
          <div class="event-actions">
            ${upcoming && !mine ? `<button class="btn-sm btn-flag${ev.interes ? ' on' : ''}" data-action="flag" data-id="${id}" title="${ev.interes ? t('Quitar la bandera') : t('Me interesa (no sé si ir)')}" aria-label="${t('Bandera: me interesa')}" aria-pressed="${ev.interes ? 'true' : 'false'}">${ev.interes ? '🚩' : '⚑'}</button>` : ''}
            <button class="btn-sm" data-action="edit" data-id="${id}" aria-label="${t('Editar evento')}">✏️</button>
            ${isAdmin() || ev.mio ? `<button class="btn-sm del" data-action="delete" data-id="${id}" aria-label="${t('Eliminar evento')}">🗑️</button>` : ''}
          </div>
        </div>
        ${mediaBtns}
        <div class="event-body event-body-hidden">
          ${ev.propone ? `<div class="event-proposer">👤 ${t('Propone')}: <strong>${escHtml(ev.propone)}</strong></div>` : ''}
          <div class="attendees-list">${chips}</div>
        </div>
        <div class="event-foot">
          ${joinBtn}
          <button class="event-card-toggle" data-action="toggle" data-count="${personas}" aria-expanded="false">${t('Ver asistentes ({n}) ▾', { n: personas })}</button>
        </div>
      </div>
    </div>
  </article>`;
}

// ── Quedadas ────────────────────────────────────────────
export function renderEvents() {
  const events = getEvents();
  const todayStr = today();
  const search = filters.search.trim().toLowerCase();

  renderFilterChips();

  const filtered = events.filter(e => {
    if (filters.type === 'flag') {
      if (!e.interes || hasMe(e.asistentes)) return false;
    } else if (filters.type === 'mine') {
      if (!hasMe(e.asistentes)) return false;
    } else if (filters.type !== 'all' && e.tipo !== filters.type) {
      return false;
    }
    if (search) return [e.evento, e.sitio, e.propone, e.asistentes, e.tipo].join(' ').toLowerCase().includes(search);
    return true;
  }).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const r = resumenPlanes(events, todayStr);
  $('stats-row').innerHTML = `
    <div class="stat-card"><div class="stat-num">${r.proximos}</div><div class="stat-label">${t('Próximos planes')}</div></div>
    <div class="stat-card"><div class="stat-num gold">${r.voy}</div><div class="stat-label">${t('Voy a')} 🤘</div></div>`;

  const list = $('events-list');
  let html = '';
  let lastMonth = '';
  for (const ev of filtered) {
    const d = parseDate(ev.fecha);
    if (!d) continue;
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
    if (monthKey !== lastMonth) {
      lastMonth = monthKey;
      html += `<div class="date-sep">${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}</div>`;
    }
    html += eventCard(ev, d, todayStr);
  }
  list.innerHTML = html || (events.length
    ? vacioHTML('triste', t('No hay eventos que coincidan'), { una: true })
    : vacioHTML('baile', t('Todavía no hay planes. ¡Añade el primero con el botón +!')));
}

// ── Novedades ───────────────────────────────────────────
export function renderNovedades() {
  const todayStr = today();
  const lista = recientes(getEvents(), todayStr);
  let html = `<div class="section-title section-title-first">✨ ${t('Novedades')} <span class="event-count">${lista.length}</span></div>
    <p class="novedades-hint">${t('Planes que ha añadido gente del grupo en las últimas dos semanas. Los de después de tu última visita van resaltados.')}</p>`;
  for (const ev of lista) {
    const d = parseDate(ev.fecha);
    if (d) html += eventCard(ev, d, todayStr);
  }
  if (!lista.length) html += vacioHTML('saludo', t('Nada nuevo por ahora. Cuando alguien añada un plan, aparecerá aquí.'), { una: true });
  $('novedades-view').innerHTML = html;
  marcarVisto();
}

/** Burbuja de la pestaña, aviso en Quedadas e insignia del icono de la app: cuántos planes nuevos hay sin ver. */
export function renderNovedadesAviso() {
  const n = sinVer().length;
  const badge = $('novedades-badge');
  badge.textContent = n > 9 ? '9+' : String(n);
  badge.hidden = !n;
  const banner = $('novedades-banner');
  banner.hidden = !n;
  if (n) banner.querySelector('.novedades-banner-text').textContent = '✨ ' + tp(n, 'Hay {n} plan nuevo desde tu última visita', 'Hay {n} planes nuevos desde tu última visita');
  try { if (navigator.setAppBadge) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch { /* noop */ }
}

export function toggleAttendees(btn) {
  const body = btn.closest('.event-content-col').querySelector('.event-body');
  const hidden = body.classList.toggle('event-body-hidden');
  btn.setAttribute('aria-expanded', String(!hidden));
  btn.textContent = hidden ? t('Ver asistentes ({n}) ▾', { n: btn.dataset.count }) : t('Ocultar ▴');
}

// ── Bares ───────────────────────────────────────────────
const BAR_ICONS = { 'Metal': '🤘', 'Rock': '🎸', 'vivo': '🎵', 'Coctelería': '🍹', 'Cocteler': '🍹', 'Club': '🌙', 'Conciertos': '🎤' };
function barIcon(tipo) {
  for (const k in BAR_ICONS) if (String(tipo).includes(k)) return BAR_ICONS[k];
  return '🍺';
}

import { botonesLista, botonAnadir } from './listas.js';

export function renderBares() {
  const bares = getBares();
  $('bares-list').innerHTML =
    `<div class="lista-cabecera">${botonAnadir('bar', 'Añadir bar')}</div><div class="section-title section-title-first">🍺 ${t('Bares y salas')} <span class="event-count">${bares.length}</span></div>` +
    (bares.length ? bares.map(b => {
      const link = safeUrl(b.link);
      return `
      <div class="bar-card">
        <div class="bar-icon">${barIcon(b.tipo)}</div>
        <div>
          <div class="bar-name">${escHtml(b.nombre)}${b.id ? botonesLista('bar', b) : ''}</div>
          <div class="bar-type">${escHtml(b.tipo)}</div>
          <div class="bar-hours">${escHtml(b.horario)}</div>
          <div class="bar-addr">📍 ${escHtml(b.direccion)}</div>
          ${link ? `<a class="bar-link" href="${escHtml(link)}" target="_blank" rel="noopener noreferrer">📍 ${t('Ver en Maps →')}</a>` : ''}
        </div>
      </div>`;
    }).join('') : `<div class="empty-state"><div class="empty-icon">🍺</div><div class="empty-text">${t('Sin bares todavía')}</div></div>`);
}

// ── Historial ───────────────────────────────────────────
export function renderHistorial() {
  const { items, total, q, loading, error } = historyState;
  const cards = items.map(ev => {
    const d = parseDate(ev.fecha);
    const att = getAttendees(ev.asistentes);
    const mine = hasMe(ev.asistentes);
    const dateBlock = d
      ? `<div class="event-day-num small">${d.getDate()}</div><div class="event-month">${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}</div>${ev.fechaFin ? `<div class="event-range">${escHtml(formatShortRange(ev.fecha, ev.fechaFin))}</div>` : ''}`
      : '<div class="event-day-num small">?</div>';
    return `
    <div class="event-card past${mine ? ' omar-event' : ''}">
      <div class="event-card-header">
        <div class="event-date-block">${dateBlock}</div>
        <div class="event-main">
          <div><span class="event-type-badge ${typeClass(ev.tipo)}">${escHtml(t(ev.tipo))}</span>${mine ? `<span class="upcoming-badge">✓ ${t('Fuiste')}</span>` : ''}</div>
          <div class="event-title small">${escHtml(ev.evento)}</div>
          <div class="event-venue small">${att.slice(0, 4).map(escHtml).join(', ')}${att.length > 4 ? '...' : ''}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  const restantes = total - items.length;
  const vacio = loading ? t('Cargando historial…') : error ? t('No se pudo cargar el historial. Inténtalo de nuevo.') : q ? t('Sin resultados') : t('Todavía no hay historial');
  $('historial-list').innerHTML =
    `<div class="section-title">📜 ${t('Historial')} <span class="event-count">${total}</span></div>` +
    (items.length ? cards : `<div class="empty-state"><div class="empty-icon">📜</div><div class="empty-text">${vacio}</div></div>`) +
    (restantes > 0
      ? `<button class="btn-secondary btn-more" data-action="history-more"${loading ? ' disabled' : ''}>${loading ? t('Cargando…') : t('Mostrar {n} más ({r} restantes)', { n: Math.min(HISTORY_PAGE, restantes), r: restantes })}</button>`
      : '');
}
