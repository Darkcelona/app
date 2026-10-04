import { MONTHS_ES, TYPE_ICONS } from './config.js';
import { escHtml, parseDate, today } from './utils.js';
import { getEvents, getMyHistory, getUser, hasMe, isAdmin } from './store.js';
import { isUpcoming } from './render.js';

const $ = id => document.getElementById(id);
export const profileState = { pastLimit: 30 };

function planRow(ev, past) {
  const d = parseDate(ev.fecha);
  if (!d) return '';
  return `
  <div class="plan-row${past ? ' past' : ''}">
    <div class="plan-date"><strong>${d.getDate()}</strong><span>${MONTHS_ES[d.getMonth()]}${past ? ' ' + String(d.getFullYear()).slice(2) : ''}</span></div>
    <div class="plan-main">
      <div class="plan-title">${TYPE_ICONS[ev.tipo] || '🎸'} ${escHtml(ev.evento)}</div>
      <div class="plan-sub">${escHtml(ev.tipo || '')}${ev.sitio ? ' · 📍 ' + escHtml(ev.sitio) : ''}</div>
      ${!past && ev.previa ? `<div class="plan-sub plan-previa">🍺 Previa: ${escHtml(ev.previa)}</div>` : ''}
    </div>
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
        <div class="profile-name">${escHtml(user.nombre)}${isAdmin() ? ' <span class="role-badge">Admin</span>' : ''}</div>
        <div class="profile-alias">${user.aliases && user.aliases.length ? 'También apareces como: ' + escHtml(user.aliases.join(', ')) : 'Apareces en el Excel como "' + escHtml(user.nombre) + '"'}</div>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card"><div class="stat-num gold">${next.length}</div><div class="stat-label">Próximos planes</div></div>
      <div class="stat-card"><div class="stat-num">${past.length}</div><div class="stat-label">Planes pasados</div></div>
      <div class="stat-card"><div class="stat-num">${byYear[thisYear] || 0}</div><div class="stat-label">Este año</div></div>
    </div>

    <div class="section-title">🗓️ Mis próximos planes <span class="event-count">${next.length}</span></div>
    ${next.length ? next.map(e => planRow(e, false)).join('') : '<div class="empty-state small"><div class="empty-text">No estás apuntado a nada todavía. Ve a Quedadas y pulsa "Apuntarme".</div></div>'}

    <div class="section-title">📜 Mi historial <span class="event-count">${past.length}</span></div>
    ${years.length ? `<div class="year-chips">${years.map(y => `<span class="attendee-chip">${y}: <strong>${byYear[y]}</strong></span>`).join('')}</div>` : ''}
    ${types.length ? `<div class="year-chips">${types.map(([t, n]) => `<span class="attendee-chip">${TYPE_ICONS[t] || '🎸'} ${escHtml(t)}: <strong>${n}</strong></span>`).join('')}</div>` : ''}
    ${past.slice(0, profileState.pastLimit).map(e => planRow(e, true)).join('') ||
      `<div class="empty-state small"><div class="empty-text">${historyReady ? 'Todavía no hay planes pasados con tu nombre.' : 'Cargando tu historial…'}</div></div>`}
    ${past.length > profileState.pastLimit ? `<button class="btn-secondary btn-more" data-action="profile-more">Mostrar más (${past.length - profileState.pastLimit} restantes)</button>` : ''}

    <p class="profile-hint">¿Falta algún plan o aparece algún nombre tuyo mal escrito en el Excel? Díselo a un admin para que añada ese nombre a tu perfil.</p>
    <div class="settings-actions"><button class="btn-secondary btn-danger" data-action="logout">Cerrar sesión en este dispositivo</button></div>`;
}
