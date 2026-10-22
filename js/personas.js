// Autocompletado de asistentes: al escribir "@" en el campo se ofrece la gente del grupo para ir añadiéndola.
import { KEYS } from './config.js';
import { lsGet, lsSet } from './store.js';
import { loadPersonas } from './api.js';
import { escHtml, normalizeName, getAttendees } from './utils.js';

const MAX = 60;
let lista = [];
try { const c = JSON.parse(lsGet(KEYS.personas) || '[]'); if (Array.isArray(c)) lista = c; } catch { /* noop */ }

/** Pide la lista al servidor (se guarda para usarla sin conexión). */
export async function refrescarPersonas() {
  try {
    const p = await loadPersonas();
    if (p.length) { lista = p; lsSet(KEYS.personas, JSON.stringify(p)); }
  } catch { /* sin conexión: vale la última guardada */ }
}

/** La "@palabra" que se está escribiendo justo antes del cursor, o null. */
export function consultaActual(texto, cursor) {
  const m = texto.slice(0, cursor).match(/(^|[\s,])@([^\n@,]*)$/);
  return m ? { consulta: m[2], desde: cursor - m[2].length - 1 } : null;
}

/** Sugerencias para una consulta: sin repetir a quien ya está puesto. */
export function sugerencias(consulta, yaPuestos = [], todas = lista) {
  const q = normalizeName(consulta);
  const puestos = new Set(yaPuestos.map(normalizeName));
  return todas.filter(n => !puestos.has(normalizeName(n)) && (!q || normalizeName(n).includes(q)))
    .sort((a, b) => (normalizeName(b).startsWith(q) ? 1 : 0) - (normalizeName(a).startsWith(q) ? 1 : 0))
    .slice(0, MAX);
}

export function initPersonas(textarea, caja) {
  let activa = null;      // { desde, hasta }
  let indice = 0;
  let opciones = [];

  const cerrar = () => { caja.hidden = true; caja.innerHTML = ''; activa = null; opciones = []; };

  function pintar() {
    caja.innerHTML = opciones.map((n, i) =>
      `<button type="button" class="persona-op${i === indice ? ' sel' : ''}" data-i="${i}">${escHtml(n)}</button>`).join('');
    caja.hidden = false;
    caja.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  }

  function revisar() {
    const c = consultaActual(textarea.value, textarea.selectionStart);
    if (!c) return cerrar();
    const o = sugerencias(c.consulta, getAttendees(textarea.value));
    if (!o.length) return cerrar();
    activa = { desde: c.desde, hasta: textarea.selectionStart };
    opciones = o; indice = 0;
    pintar();
  }

  function elegir(i) {
    const nombre = opciones[i];
    if (!nombre || !activa) return;
    const antes = textarea.value.slice(0, activa.desde);
    const despues = textarea.value.slice(activa.hasta);
    const ins = nombre + '\n';
    textarea.value = antes + ins + despues.replace(/^\n/, '');
    const pos = antes.length + ins.length;
    textarea.setSelectionRange(pos, pos);
    textarea.focus();
    cerrar();
  }

  textarea.addEventListener('input', revisar);
  textarea.addEventListener('click', revisar);
  textarea.addEventListener('keydown', e => {
    if (caja.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); indice = (indice + 1) % opciones.length; pintar(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); indice = (indice - 1 + opciones.length) % opciones.length; pintar(); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); elegir(indice); }
    else if (e.key === 'Escape') { e.stopPropagation(); cerrar(); }
  });
  // mousedown (no click) para que el campo no pierda el foco y el teclado del móvil no se cierre
  caja.addEventListener('mousedown', e => {
    const b = e.target.closest('.persona-op');
    if (!b) return;
    e.preventDefault();
    elegir(Number(b.dataset.i));
  });
  textarea.addEventListener('blur', () => setTimeout(cerrar, 150));
  return { cerrar };
}
