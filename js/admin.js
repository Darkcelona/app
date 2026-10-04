// Panel de administración (solo rol admin): personas y registro de actividad.
import { escHtml } from './utils.js';
import { admin } from './api.js';
import { $, showToast, copyText } from './ui.js';

const state = { users: [], log: [], filter: '', reveal: null, loaded: false, error: '', entradas: '', entradasBusy: false };

const appBase = () => location.origin + location.pathname.replace(/index\.html$/, '');
const linkFor = u => u.link || `${appBase()}#acceso=${u.code}`;

export async function loadAdmin() {
  try {
    const [u, l] = await Promise.all([admin('users.list'), admin('log.list', { limit: 150 })]);
    state.users = u.users;
    state.log = l.log;
    state.error = '';
    state.loaded = true;
  } catch (err) {
    state.error = err.message;
  }
  renderAdmin();
}

const ESTADO = { activo: '🟢 Activo', baja: '⚪ De baja' };

function userRow(u) {
  const ref = `data-nombre="${escHtml(u.nombre)}" data-telegram="${escHtml(u.telegram)}"`;
  return `
  <div class="admin-row${u.estado === 'baja' ? ' off' : ''}">
    <div class="admin-main">
      <div class="admin-name">${escHtml(u.nombre)}${u.rol === 'admin' ? ' <span class="role-badge">Admin</span>' : ''}</div>
      <div class="admin-sub">${ESTADO[u.estado]}${u.telegram ? ' · @' + escHtml(u.telegram) : ''}${u.ultimo ? ' · visto ' + escHtml(u.ultimo.slice(0, 10)) : ' · sin entrar aún'}${u.alias.length ? ' · alias: ' + escHtml(u.alias.join(', ')) : ''}</div>
    </div>
    <div class="admin-btns">
      <button class="btn-sm" data-action="admin-role" ${ref} data-rol="${u.rol === 'admin' ? 'usuario' : 'admin'}" title="${u.rol === 'admin' ? 'Pasa a ser un usuario normal: ya no podrá borrar eventos ni ver este panel' : 'Podrá borrar eventos, gestionar personas y ver el registro'}">${u.rol === 'admin' ? 'Quitar admin' : '👑 Hacer admin'}</button>
      <button class="btn-sm" data-action="admin-rename" ${ref} data-alias="${escHtml(u.alias.join(', '))}" title="Cambiar el nombre o los alias">✏️ Nombre / alias</button>
      ${u.estado === 'activo'
        ? `<button class="btn-sm" data-action="admin-rotate" ${ref} title="Cierra TODOS sus dispositivos y genera un único enlace nuevo">🔑 Enlace nuevo</button>
           <button class="btn-sm del" data-action="admin-revoke" ${ref}>Dar de baja</button>`
        : `<button class="btn-sm" data-action="admin-reactivate" ${ref}>Reactivar</button>`}
    </div>
  </div>`;
}

function logRow(l) {
  return `
  <div class="log-row">
    <div class="log-main">
      <div class="log-top"><strong>${escHtml(l.usuario)}</strong> <span class="log-act">${escHtml(l.accion)}</span></div>
      <div class="log-sub">${escHtml(l.fecha)}${l.evento ? ' · ' + escHtml(l.evento) : ''}${l.resultado && l.resultado !== 'ok' ? ' · <em>' + escHtml(l.resultado) + '</em>' : ''}</div>
    </div>
    ${l.reversible ? `<button class="btn-sm" data-action="admin-undo" data-id="${escHtml(l.id)}">↩ Deshacer</button>` : ''}
  </div>`;
}

export function renderAdmin() {
  const q = state.filter.trim().toLowerCase();
  const log = q ? state.log.filter(l => [l.usuario, l.accion, l.evento].join(' ').toLowerCase().includes(q)) : state.log;
  const active = state.users.filter(u => u.estado === 'activo').length;

  $('admin-view').innerHTML = `
    ${state.error ? `<div class="sync-bar err"><span class="sync-text err">⚠️ ${escHtml(state.error)}</span></div>` : ''}
    ${state.reveal ? `
      <div class="reveal-box">
        <div class="settings-label">Enlace de acceso de ${escHtml(state.reveal.nombre)}</div>
        <div class="settings-desc">Solo se muestra ahora. Mándaselo por privado: quien tenga este enlace entra como ${escHtml(state.reveal.nombre)}.</div>
        <input class="form-input" id="reveal-link" readonly value="${escHtml(state.reveal.link)}">
        <div class="settings-actions">
          <button class="btn-primary" data-action="admin-copy">Copiar enlace</button>
          <button class="btn-secondary" data-action="admin-dismiss">Listo</button>
        </div>
      </div>` : ''}

    <div class="section-title section-title-first">🎟️ Entradas y precios</div>
    <div class="settings-card">
      <div class="settings-desc">Cada día, la primera vez que alguien abre la app, se traen de MetalBiblia los enlaces, precios y estados de los conciertos. Si acabas de añadir algo allí, puedes traerlo ahora.</div>
      <div class="settings-actions"><button class="btn-primary" data-action="admin-entradas" ${state.entradasBusy ? 'disabled' : ''}>${state.entradasBusy ? 'Sincronizando…' : '🔄 Sincronizar entradas ahora'}</button></div>
      ${state.entradas ? `<div class="settings-desc" style="margin-top:10px;white-space:pre-line">${escHtml(state.entradas)}</div>` : ''}
    </div>

    <div class="section-title">👥 Personas <span class="event-count">${active} activas · ${state.users.length} en total</span></div>
    <form class="settings-card" id="admin-new" data-action-submit="admin-create">
      <div class="settings-label">Añadir persona</div>
      <div class="admin-form">
        <input class="form-input" id="au-nombre" placeholder="Nombre (como sale en Asistentes)" required autocomplete="off">
        <input class="form-input" id="au-alias" placeholder="Alias: LuisMi, Luismi…" autocomplete="off">
        <input class="form-input" id="au-telegram" placeholder="@usuario de Telegram" autocomplete="off">
        <select class="form-input" id="au-rol"><option value="usuario">Usuario</option><option value="admin">Admin</option></select>
        <button class="btn-primary" type="submit">Crear y obtener enlace</button>
      </div>
    </form>
    ${state.users.map(userRow).join('') || '<div class="empty-state small"><div class="empty-text">Aún no hay personas. Crea la primera arriba.</div></div>'}

    <div class="section-title">📋 Registro de actividad <span class="event-count">${log.length}</span></div>
    <input class="filter-search" type="search" id="log-filter" placeholder="🔍 Filtrar por persona, acción o evento" value="${escHtml(state.filter)}">
    ${log.map(logRow).join('') || '<div class="empty-state small"><div class="empty-text">Sin actividad</div></div>'}
    <p class="profile-hint">"Deshacer" deja la fila como estaba justo antes de ese cambio. Si alguien la tocó después, esos cambios también se revierten.</p>`;
}

const ref = el => ({ nombre: el.dataset.nombre, telegram: el.dataset.telegram });

async function run(fn, okMsg) {
  try {
    const r = await fn();
    if (okMsg) showToast(okMsg);
    return r;
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
    return null;
  }
}

/** Acciones de los botones del panel. Devuelve true si la acción era de este módulo. */
export async function adminAction(action, el) {
  switch (action) {
    case 'admin-rotate': {
      if (!confirm(`¿Generar un enlace nuevo para ${el.dataset.nombre}? Se cerrarán TODOS sus dispositivos actuales.`)) return true;
      const r = await run(() => admin('users.rotate', { user: ref(el) }));
      if (r) { state.reveal = { nombre: r.user.nombre, link: linkFor(r.user) }; await loadAdmin(); }
      return true;
    }
    case 'admin-role': {
      const nuevo = el.dataset.rol;
      const aviso = nuevo === 'admin'
        ? `¿Hacer admin a ${el.dataset.nombre}? Podrá borrar eventos, gestionar personas, ver el registro y deshacer cambios.`
        : `¿Quitar el rol de admin a ${el.dataset.nombre}? Pasará a ser un usuario normal.`;
      if (!confirm(aviso)) return true;
      // El servidor exige el nombre; no se toca ni el nombre, ni los alias, ni el enlace
      if (await run(() => admin('users.upsert', { user: { ref: ref(el), nombre: el.dataset.nombre, rol: nuevo } }), nuevo === 'admin' ? '👑 Ahora es admin' : 'Ya no es admin')) await loadAdmin();
      return true;
    }
    case 'admin-rename': {
      const nombre = prompt('Nombre en las quedadas (tiene que ser único; es el que se escribe en Asistentes):', el.dataset.nombre);
      if (nombre === null) return true;
      const alias = prompt('Otros nombres con los que ya aparece en el Excel, separados por comas (opcional):', el.dataset.alias || '');
      if (alias === null) return true;
      if (await run(() => admin('users.upsert', { user: { ref: ref(el), nombre: nombre.trim(), alias } }), '✓ Guardado')) await loadAdmin();
      return true;
    }
    case 'admin-revoke': {
      if (!confirm(`¿Dar de baja a ${el.dataset.nombre}? Perderá el acceso al instante.`)) return true;
      if (await run(() => admin('users.revoke', { user: ref(el) }), 'Dado de baja')) await loadAdmin();
      return true;
    }
    case 'admin-reactivate': {
      const r = await run(() => admin('users.reactivate', { user: ref(el) }));
      if (r) { state.reveal = { nombre: r.user.nombre, link: linkFor(r.user) }; await loadAdmin(); }
      return true;
    }
    case 'admin-undo': {
      if (!confirm('¿Deshacer este cambio?')) return true;
      if (await run(() => admin('log.undo', { id: el.dataset.id }), '↩ Deshecho')) await loadAdmin();
      return true;
    }
    case 'admin-copy': {
      const ok = await copyText($('reveal-link').value);
      showToast(ok ? '📋 Enlace copiado' : 'Selecciónalo y cópialo a mano', ok ? 'success' : 'error');
      return true;
    }
    case 'admin-entradas': {
      state.entradasBusy = true; state.entradas = ''; renderAdmin();
      const r = await run(() => admin('entradas.sync'));
      state.entradasBusy = false;
      if (r && r.ok) {
        const nuevos = (r.vinculosNuevos || []).map(x => '• ' + x).join('\n');
        state.entradas = `MetalBiblia tiene ${r.metalbiblia} próximos. Planes revisados: ${r.nuestros}. Actualizados: ${r.actualizados}. Sin cambios: ${r.sinCambios}.` + (nuevos ? `\nVínculos nuevos:\n${nuevos}` : '');
        showToast(r.actualizados ? `🎟️ ${r.actualizados} planes actualizados` : '🎟️ Todo al día');
        document.querySelector('[data-action="sync"]')?.click();     // refresca los planes en pantalla
      } else if (r) state.entradas = r.error || 'No se ha podido sincronizar';
      renderAdmin();
      return true;
    }
    case 'admin-dismiss':
      state.reveal = null;
      renderAdmin();
      return true;
    default:
      return false;
  }
}

export async function adminCreate() {
  const user = {
    nombre: $('au-nombre').value.trim(),
    alias: $('au-alias').value.trim(),
    telegram: $('au-telegram').value.trim(),
    rol: $('au-rol').value,
  };
  if (!user.nombre) { showToast('Escribe el nombre', 'error'); return; }
  const r = await run(() => admin('users.upsert', { user }));
  if (!r) return;
  if (r.created) state.reveal = { nombre: r.user.nombre, link: linkFor(r.user) };
  else showToast('Esa persona ya existía: se han actualizado sus datos (su enlace no cambia)');
  await loadAdmin();
}

export function setLogFilter(v) {
  state.filter = v;
  renderAdmin();
  const input = $('log-filter');
  if (input) { input.focus(); input.setSelectionRange(v.length, v.length); }
}
