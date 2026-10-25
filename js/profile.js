import { MONTHS_ES, TYPE_ICONS } from './config.js';
import { escHtml, parseDate, today, getAttendees, mapsUrl, personasEn, hayHueco } from './utils.js';
import { getEvents, getMyHistory, getUser, hasMe, isAdmin } from './store.js';
import { isUpcoming } from './render.js';
import { preferenciaCalendario } from './calendario.js';
import { vacioHTML } from './mascota.js';
import { t, tp } from './i18n.js';

const $ = id => document.getElementById(id);
export const profileState = { pastLimit: 30, filtro: '' };   // filtro de "Mis próximos planes": '' (todos) | 'voy' | 'bandera'

/** Quién más va (en los pasados, solo los primeros: pueden ser muchos). */
function asistentesFila(ev, past) {
  const a = getAttendees(ev.asistentes);
  if (a.length < 2) return '';
  const total = personasEn(ev.asistentes);
  const lista = past && a.length > 8 ? a.slice(0, 8).map(escHtml).join(', ') + ' ' + t('y {n} más', { n: a.length - 8 }) : a.map(escHtml).join(', ');
  return `<div class="plan-sub plan-asistentes">👥 ${total}: ${lista}</div>`;
}

/** " · 📍 Sitio" con enlace a Google Maps (como en las tarjetas de Quedadas). */
function sitioHtml(sitio) {
  const lugar = String(sitio || '').trim();
  if (!lugar) return '';
  const maps = mapsUrl(lugar);
  const cuerpo = '📍 ' + escHtml(lugar);
  return ' · ' + (maps ? `<a class="venue-link" href="${escHtml(maps)}" target="_blank" rel="noopener noreferrer" title="${t('Ver en Google Maps')}">${cuerpo}</a>` : cuerpo);
}

function planRow(ev, past, interes = false) {
  const d = parseDate(ev.fecha);
  if (!d) return '';
  return `
  <div class="plan-row${past ? ' past' : ''}">
    <div class="plan-date"><strong>${d.getDate()}</strong><span>${MONTHS_ES[d.getMonth()]}${past ? ' ' + String(d.getFullYear()).slice(2) : ''}</span></div>
    <div class="plan-main">
      <div class="plan-title">${TYPE_ICONS[ev.tipo] || '🎸'} ${escHtml(ev.evento)}${interes ? ` <span class="flag-tag">🚩 ${t('Me interesa')}</span>` : ''}</div>
      <div class="plan-sub">${escHtml(t(ev.tipo || ''))}${sitioHtml(ev.sitio)}</div>
      ${!past && ev.previa ? `<div class="plan-sub plan-previa">🍺 ${t('Previa')}: ${escHtml(ev.previa)}</div>` : ''}
      ${asistentesFila(ev, past)}
    </div>
    ${interes && ev.id ? `<div class="plan-acciones">
      ${hayHueco(ev, 1) ? `<button class="btn-sm" data-action="join" data-id="${escHtml(ev.id)}">＋ ${t('Apuntarme')}</button>` : ''}
      <button class="btn-sm" data-action="flag" data-id="${escHtml(ev.id)}">${t('Quitar bandera')} 🚩</button>
    </div>` : ''}
    ${past || interes || !ev.id ? '' : `<div class="plan-acciones">
      <button class="btn-sm" data-action="calendar" data-id="${escHtml(ev.id)}" title="${t('Añadir a mi calendario')}" aria-label="${t('Añadir a mi calendario')}">📅</button>
      <button class="btn-sm" data-action="leave" data-id="${escHtml(ev.id)}">${t('Quitarme')}</button>
    </div>`}
  </div>`;
}

/** Eventos pasados a los que fui: el histórico archivado + lo que aún esté en Quedadas con fecha ya pasada. */
export function myPastEvents() {
  const todayStr = today();
  const recent = getEvents().filter(e => !isUpcoming(e, todayStr) && hasMe(e.asistentes));
  return [...recent, ...getMyHistory().filter(e => hasMe(e.asistentes))]
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function renderProfile(historyReady) {
  const user = getUser();
  if (!user) { $('profile-view').innerHTML = ''; return; }
  const todayStr = today();
  const next = getEvents().filter(e => isUpcoming(e, todayStr) && hasMe(e.asistentes)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const filtro = profileState.filtro === 'bandera' && !getEvents().some(e => isUpcoming(e, todayStr) && e.interes && !hasMe(e.asistentes)) ? '' : profileState.filtro;   // si ya no queda ninguno con bandera, se quita el filtro
  const interesados = getEvents().filter(e => isUpcoming(e, todayStr) && e.interes && !hasMe(e.asistentes));
  const past = myPastEvents();
  const thisYear = String(new Date().getFullYear());
  const byYear = {};
  past.forEach(e => { const y = e.fecha.slice(0, 4); byYear[y] = (byYear[y] || 0) + 1; });
  const years = Object.keys(byYear).sort().reverse();
  const byType = {};
  past.forEach(e => { byType[e.tipo || 'Otros'] = (byType[e.tipo || 'Otros'] || 0) + 1; });
  const types = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  $('profile-view').innerHTML = `
    <div class="profile-head">
      <div class="profile-avatar">🤘</div>
      <div>
        <div class="profile-name">${escHtml(user.nombre)}${isAdmin() ? ` <span class="role-badge">${t('Admin')}</span>` : ''}</div>
        <div class="profile-alias">${user.aliases && user.aliases.length ? t('También apareces como:') + ' ' + escHtml(user.aliases.join(', ')) : t('Apareces en la agenda como') + ' "' + escHtml(user.nombre) + '"'}</div>
      </div>
    </div>

    <div class="stats-row plano">
      <div class="stat-card"><div class="stat-num gold">${next.length}</div><div class="stat-label">${t('Próximos planes')}</div></div>
      <div class="stat-card"><div class="stat-num">${past.length}</div><div class="stat-label">${t('Planes pasados')}</div></div>
      <div class="stat-card"><div class="stat-num">${byYear[thisYear] || 0}</div><div class="stat-label">${t('Este año')}</div></div>
    </div>

    <div class="section-title">🗓️ ${t('Mis próximos planes')} <button class="event-count count-btn${filtro === 'voy' ? ' on' : ''}" data-action="perfil-filtro" data-f="voy" title="${t('Ver solo a los que voy')}" aria-pressed="${filtro === 'voy'}">${next.length}</button>${interesados.length ? ` <button class="event-count count-btn${filtro === 'bandera' ? ' on' : ''}" data-action="perfil-filtro" data-f="bandera" title="${t('Ver solo los que tienen bandera (me interesan, no sé si voy)')}" aria-pressed="${filtro === 'bandera'}">🚩 ${interesados.length}</button>` : ''}${filtro ? ` <button class="count-btn quitar-filtro" data-action="perfil-filtro" data-f="">${t('Ver todos')}</button>` : ''}</div>
    ${next.length || interesados.length ? [...(filtro === 'bandera' ? [] : next).map(e => ({ e, i: false })), ...(filtro === 'voy' ? [] : interesados).map(e => ({ e, i: true }))].sort((a, b) => a.e.fecha.localeCompare(b.e.fecha)).map(({ e, i }) => planRow(e, false, i)).join('') : vacioHTML('triste', t('No estás apuntado a nada todavía. Ve a Quedadas y pulsa "Apuntarme".'), { pequeno: true, una: true })}

    <div class="section-title">📜 ${t('Mi historial')} <span class="event-count">${past.length}</span></div>
    ${years.length ? `<div class="year-chips">${years.map(y => `<span class="attendee-chip">${y}: <strong>${byYear[y]}</strong></span>`).join('')}</div>` : ''}
    ${types.length ? `<div class="year-chips">${types.map(([ty, n]) => `<span class="attendee-chip">${TYPE_ICONS[ty] || '🎸'} ${escHtml(t(ty))}: <strong>${n}</strong></span>`).join('')}</div>` : ''}
    ${past.slice(0, profileState.pastLimit).map(e => planRow(e, true)).join('') ||
      `<div class="empty-state small"><div class="empty-text">${historyReady ? t('Todavía no hay planes pasados con tu nombre.') : t('Cargando tu historial…')}</div></div>`}
    ${past.length > profileState.pastLimit ? `<button class="btn-secondary btn-more" data-action="profile-more">${t('Mostrar más ({n} restantes)', { n: past.length - profileState.pastLimit })}</button>` : ''}

    <div class="section-title">📅 ${t('Calendario')}</div>
    ${preferenciaCalendario()
      ? `<p class="profile-hint cal-pref">${t('Al pulsar el 📅 de un plan se añade directamente a')} <strong>${preferenciaCalendario() === 'google' ? 'Google Calendar' : t('tu calendario (archivo .ics)')}</strong>. <button class="btn-secondary" data-action="cal-reset">${t('Restablecer elección')}</button></p>`
      : `<p class="profile-hint cal-pref">${t('Al pulsar el 📅 de un plan te pregunto cómo añadirlo. Si marcas "Hacerlo siempre así", aquí podrás deshacerlo.')}</p>`}

    <p class="profile-hint">${t('¿Falta algún plan o aparece algún nombre tuyo mal escrito? Díselo a un admin para que añada ese nombre a tu perfil.')}</p>
    <div class="settings-actions"><button class="btn-secondary btn-danger" data-action="logout">${t('Cerrar sesión en este dispositivo')}</button></div>`;
}
