// Cumpleaños y bares editables por cualquier miembro: añadir, y editar/borrar lo que añadió uno mismo (el admin, todo).
import { MONTHS_FULL } from './config.js';
import { escHtml } from './utils.js';
import { getBares, getCumples, isAdmin } from './store.js';
import { itemOp } from './api.js';
import { showToast } from './ui.js';

const $ = id => document.getElementById(id);
let ctx = null;                       // { kind, id }
let alCambiar = () => {};
export const initListas = fn => { alCambiar = fn; };

/** ¿Puede esta persona tocar este elemento? Lo suyo, o todo si es admin. */
export const puedeTocar = item => isAdmin() || !!item?.mio;

const campo = (id, etiqueta, valor = '', extra = '') =>
  `<div class="form-group full"><label class="form-label" for="${id}">${etiqueta}</label><input class="form-input" id="${id}" value="${escHtml(valor)}" ${extra}></div>`;

function formBar(b = {}) {
  return campo('l-nombre', 'Nombre del bar o sala *', b.nombre, 'maxlength="160"')
    + campo('l-tipo', 'Tipo (Metal, Rock, Coctelería…)', b.tipo, 'maxlength="80"')
    + campo('l-horario', 'Horario', b.horario, 'maxlength="200"')
    + campo('l-direccion', 'Dirección', b.direccion, 'maxlength="300"')
    + campo('l-link', '📍 Enlace de Google Maps (opcional)', b.link, 'type="url" placeholder="https://maps.app.goo.gl/…"');
}

function formCumple(c = {}) {
  return campo('l-nombre', 'Nombre *', c.n ?? '', 'maxlength="120"')
    + `<div class="form-group"><label class="form-label" for="l-dia">Día *</label><input class="form-input" id="l-dia" type="number" min="1" max="31" inputmode="numeric" value="${c.d ?? ''}"></div>`
    + `<div class="form-group"><label class="form-label" for="l-mes">Mes *</label><select class="form-input" id="l-mes"><option value="">—</option>${
      MONTHS_FULL.map((m, i) => `<option value="${i + 1}"${c.m === i + 1 ? ' selected' : ''}>${m}</option>`).join('')}</select></div>`;
}

export function abrirLista(kind, id = '') {
  const item = id ? (kind === 'bar' ? getBares() : getCumples()).find(x => x.id === id) : null;
  ctx = { kind, id: item ? item.id : '' };
  $('lista-title').textContent = kind === 'bar' ? (item ? '✏️ Editar bar' : '🍺 Añadir un bar') : (item ? '✏️ Editar cumpleaños' : '🎂 Añadir un cumpleaños');
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
  if (!data.nombre) return showToast('Falta el nombre', 'error');
  if (kind === 'cumple' && !(data.dia >= 1 && data.dia <= 31 && data.mes >= 1 && data.mes <= 12)) return showToast('Pon un día y un mes', 'error');
  const btn = document.querySelector('[data-action=lista-guardar]'); if (btn) btn.disabled = true;
  try {
    await itemOp(kind, id ? 'edit' : 'add', { id, data });
    cerrarLista(); alCambiar();
    showToast(id ? 'Cambios guardados' : (kind === 'bar' ? 'Bar añadido 🍺' : 'Cumpleaños añadido 🎂'));
  } catch (err) {
    showToast(mensajeError(err), 'error');
  } finally { if (btn) btn.disabled = false; }
}

export async function borrarLista(kind, id) {
  const item = (kind === 'bar' ? getBares() : getCumples()).find(x => x.id === id);
  if (!item || !confirm(`¿Borrar «${kind === 'bar' ? item.nombre : item.n}»?`)) return;
  try { await itemOp(kind, 'delete', { id }); alCambiar(); showToast('Borrado'); }
  catch (err) { showToast(mensajeError(err), 'error'); }
}

export function mensajeError(err) {
  const m = String(err?.message || err);
  if (/unknown_action|bad_request/.test(m)) return 'Esto todavía no está disponible en el servidor actual';
  if (/forbidden/.test(m)) return 'Solo puedes cambiar lo que has añadido tú';
  if (/Ya está apuntado/.test(m)) return 'Ya estaba apuntado';
  return m || 'No se ha podido guardar';
}

export const botonesLista = (kind, item) => puedeTocar(item)
  ? `<span class="lista-acciones"><button class="btn-sm" data-action="lista-edit" data-kind="${kind}" data-id="${escHtml(item.id)}" aria-label="Editar">✏️</button><button class="btn-sm del" data-action="lista-del" data-kind="${kind}" data-id="${escHtml(item.id)}" aria-label="Borrar">🗑️</button></span>`
  : '';
export const botonAnadir = (kind, texto) => `<button class="btn-add-lista" data-action="lista-add" data-kind="${kind}">＋ ${texto}</button>`;
