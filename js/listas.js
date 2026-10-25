// Cumpleaños y bares editables por cualquier miembro: añadir, y editar/borrar lo que añadió uno mismo (el admin, todo).
import { MONTHS_FULL } from './config.js';
import { escHtml } from './utils.js';
import { getBares, getCumples, isAdmin } from './store.js';
import { itemOp } from './api.js';
import { showToast } from './ui.js';
import { t } from './i18n.js';

const $ = id => document.getElementById(id);
let ctx = null;                       // { kind, id }
let alCambiar = () => {};
export const initListas = fn => { alCambiar = fn; };

/** ¿Puede esta persona tocar este elemento? Los bares son colaborativos: cualquiera. Los cumpleaños: lo suyo, o todo si es admin. */
export const puedeTocar = (kind, item) => kind === 'bar' ? !!item : isAdmin() || !!item?.mio;

const campo = (id, etiqueta, valor = '', extra = '') =>
  `<div class="form-group full"><label class="form-label" for="${id}">${etiqueta}</label><input class="form-input" id="${id}" value="${escHtml(valor)}" ${extra}></div>`;

function formBar(b = {}) {
  return campo('l-nombre', t('Nombre del bar o sala *'), b.nombre, 'maxlength="160"')
    + campo('l-tipo', t('Tipo (Metal, Rock, Coctelería…)'), b.tipo, 'maxlength="80"')
    + campo('l-horario', t('Horario'), b.horario, 'maxlength="200"')
    + campo('l-direccion', t('Dirección'), b.direccion, 'maxlength="300"')
    + campo('l-link', t('📍 Enlace de Google Maps (opcional)'), b.link, 'type="url" placeholder="https://maps.app.goo.gl/…"');
}

function formCumple(c = {}) {
  return campo('l-nombre', t('Nombre *'), c.n ?? '', 'maxlength="120"')
    + `<div class="form-group"><label class="form-label" for="l-dia">${t('Día *')}</label><input class="form-input" id="l-dia" type="number" min="1" max="31" inputmode="numeric" value="${c.d ?? ''}"></div>`
    + `<div class="form-group"><label class="form-label" for="l-mes">${t('Mes *')}</label><select class="form-input" id="l-mes"><option value="">—</option>${
      MONTHS_FULL.map((m, i) => `<option value="${i + 1}"${c.m === i + 1 ? ' selected' : ''}>${m}</option>`).join('')}</select></div>`;
}

export function abrirLista(kind, id = '') {
  const item = id ? (kind === 'bar' ? getBares() : getCumples()).find(x => x.id === id) : null;
  ctx = { kind, id: item ? item.id : '' };
  $('lista-title').textContent = kind === 'bar' ? (item ? t('✏️ Editar bar') : t('🍺 Añadir un bar')) : (item ? t('✏️ Editar cumpleaños') : t('🎂 Añadir un cumpleaños'));
  $('lista-form').innerHTML = kind === 'bar' ? formBar(item || {}) : formCumple(item || {});
  $('lista-overlay').classList.add('open');
  setTimeout(() => $('l-nombre')?.focus(), 50);
}

export function cerrarLista() { $('lista-overlay').classList.remove('open'); ctx = null; }

const val = id => ($(id)?.value || '').trim();

export async function guardarLista() {
  if (!ctx) return;
  const { kind, id } = ctx;
  const data = kind === 'bar'
    ? { nombre: val('l-nombre'), tipo: val('l-tipo'), horario: val('l-horario'), direccion: val('l-direccion'), link: val('l-link') }
    : { nombre: val('l-nombre'), dia: Number(val('l-dia')), mes: Number(val('l-mes')) };
  if (!data.nombre) return showToast(t('Falta el nombre'), 'error');
  if (kind === 'cumple' && !(data.dia >= 1 && data.dia <= 31 && data.mes >= 1 && data.mes <= 12)) return showToast(t('Pon un día y un mes'), 'error');
  const btn = document.querySelector('[data-action=lista-guardar]'); if (btn) btn.disabled = true;
  try {
    await itemOp(kind, id ? 'edit' : 'add', { id, data });
    cerrarLista(); alCambiar();
    showToast(id ? t('Cambios guardados') : (kind === 'bar' ? t('Bar añadido 🍺') : t('Cumpleaños añadido 🎂')));
  } catch (err) {
    showToast(mensajeError(err), 'error');
  } finally { if (btn) btn.disabled = false; }
}

export async function borrarLista(kind, id) {
  const item = (kind === 'bar' ? getBares() : getCumples()).find(x => x.id === id);
  if (!item) return;
  const nombre = kind === 'bar' ? item.nombre : item.n;
  if (!confirm(kind === 'bar' ? t('¿Seguro que quieres borrar el bar «{nombre}»? Desaparecerá para todo el grupo.', { nombre }) : t('¿Seguro que quieres borrar el cumpleaños de «{nombre}»? Desaparecerá para todo el grupo.', { nombre }))) return;
  try { await itemOp(kind, 'delete', { id }); alCambiar(); showToast(t('Borrado')); }
  catch (err) { showToast(mensajeError(err), 'error'); }
}

export function mensajeError(err) {
  const m = String(err?.message || err);
  if (/unknown_action|bad_request/.test(m)) return t('Esto todavía no está disponible en el servidor actual');
  if (/forbidden/.test(m)) return t('Solo puedes cambiar lo que has añadido tú');
  if (/Ya está apuntado/.test(m)) return t('Ya estaba apuntado');
  return m || t('No se ha podido guardar');
}

export const botonesLista = (kind, item) => puedeTocar(kind, item)
  ? `<span class="lista-acciones"><button class="btn-sm" data-action="lista-edit" data-kind="${kind}" data-id="${escHtml(item.id)}" aria-label="${t('Editar')}">✏️</button><button class="btn-sm del" data-action="lista-del" data-kind="${kind}" data-id="${escHtml(item.id)}" aria-label="${t('Borrar')}">🗑️</button></span>`
  : '';
export const botonAnadir = (kind, texto) => `<button class="btn-add-lista" data-action="lista-add" data-kind="${kind}">＋ ${t(texto)}</button>`;
