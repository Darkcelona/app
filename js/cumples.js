// Cumpleaños: lista plana [{ m: 1–12, d: 1–31, n: 'Nombre' }] que viene de la pestaña "Cumpleaños" del Excel.
// No hay año, así que todo se calcula con "la próxima vez que cae ese día".
import { MONTHS_FULL, KEYS } from './config.js';
import { escHtml, normalizeName, namesOf, toISODate } from './utils.js';
import { getCumples, getUser, lsGet, lsSet } from './store.js';
import { botonesLista, botonAnadir } from './listas.js';

const $ = id => document.getElementById(id);
const DIA_MS = 86400000;

// ── Fechas ──────────────────────────────────────────────

const esBisiesto = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Fecha de ese día de cumpleaños en el año y. El 29 de febrero se celebra el 28 en los años no bisiestos. */
function fechaEnAnio(y, m, d) {
  if (m === 2 && d === 29 && !esBisiesto(y)) d = 28;
  const f = new Date(y, m - 1, d);
  return f.getMonth() === m - 1 && f.getDate() === d ? f : null;      // descarta días imposibles (31 de abril…)
}

const hoySinHora = (ahora = new Date()) => new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
const diasEntre = (a, b) => Math.round((b - a) / DIA_MS);              // robusto al cambio de hora (redondea)

/** Próxima vez (hoy incluido) que cae ese cumpleaños. */
function proximaFecha(m, d, hoy) {
  let f = fechaEnAnio(hoy.getFullYear(), m, d);
  if (f && f < hoy) f = fechaEnAnio(hoy.getFullYear() + 1, m, d);
  return f;
}

// ── Lógica ──────────────────────────────────────────────

export const esAniversario = nombre => normalizeName(nombre) === 'darkcelona';

/** ¿Es este cumpleaños de la persona que tiene la sesión? Casa por nombre o alias ("Javier (durgrim)" cuenta como "Javier"). */
function esMio(nombre) {
  const mios = namesOf(getUser());
  if (!mios.length) return false;
  return mios.includes(normalizeName(nombre)) || mios.includes(normalizeName(String(nombre).split('(')[0]));
}

/** Cumpleaños agrupados por día para los próximos `dias` días (hoy incluido). */
export function proximos(lista, ahora = new Date(), dias = 30) {
  const hoy = hoySinHora(ahora);
  const porFecha = new Map();
  for (const c of lista) {
    const f = proximaFecha(c.m, c.d, hoy);
    if (!f) continue;
    const enDias = diasEntre(hoy, f);
    if (enDias < 0 || enDias > dias) continue;
    const clave = toISODate(f);
    if (!porFecha.has(clave)) porFecha.set(clave, { fecha: f, enDias, nombres: [] });
    porFecha.get(clave).nombres.push(c.n);
  }
  return [...porFecha.values()].sort((a, b) => a.enDias - b.enDias);
}

export const cumplesDeHoy = (lista, ahora = new Date()) => (proximos(lista, ahora, 0)[0] || { nombres: [] }).nombres;

/** { 1: [{d, n}], … } ordenado por día dentro de cada mes. */
export function porMes(lista) {
  const meses = {};
  for (let m = 1; m <= 12; m++) meses[m] = [];
  for (const c of lista) if (meses[c.m]) meses[c.m].push({ d: c.d, n: c.n, id: c.id, mio: c.mio });
  for (const m in meses) meses[m].sort((a, b) => a.d - b.d);
  return meses;
}

const unir = nombres => (nombres.length <= 1 ? nombres.join('') : nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1]);

// ── Aviso en la página principal ────────────────────────

/** Texto del aviso de hoy (o null si no cumple nadie). Separado de la pantalla para poder probarlo. */
export function textoAviso(nombresHoy, nombreUsuario = '', esMioFn = esMio) {
  if (!nombresHoy.length) return null;
  const aniv = nombresHoy.filter(esAniversario);
  const personas = nombresHoy.filter(n => !esAniversario(n));
  const lineas = [];
  const propio = personas.find(esMioFn);
  if (propio) lineas.push({ icono: '🎉', texto: `¡Feliz cumpleaños${nombreUsuario ? ', ' + nombreUsuario : ''}!`, grande: true });
  if (aniv.length) lineas.push({ icono: '🎉', texto: '¡Hoy es el aniversario de Darkcelona!', grande: !propio });
  const otros = personas.filter(n => n !== propio);
  if (otros.length) {
    lineas.push({ icono: '🎂', texto: `Hoy ${otros.length === 1 ? 'cumple años' : 'cumplen años'} ${unir(otros)}`, grande: !propio && !aniv.length });
  }
  return lineas;
}

export function renderCumpleBanner(ahora = new Date()) {
  const el = $('cumple-banner');
  if (!el) return;
  const hoyISO = toISODate(ahora);
  const lineas = textoAviso(cumplesDeHoy(getCumples(), ahora), (getUser() || {}).nombre);
  if (!lineas || !lineas.length || lsGet(KEYS.cumpleOculto) === hoyISO) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = lineas.map(l => `<div class="cumple-linea${l.grande ? ' grande' : ''}"><span aria-hidden="true">${l.icono}</span> ${escHtml(l.texto)}</div>`).join('') +
    '<button class="btn-dismiss" data-action="cumple-dismiss" aria-label="Cerrar el aviso de hoy">✕</button>';
}

/** Oculta el aviso hasta mañana. */
export function ocultarAvisoHoy(ahora = new Date()) {
  lsSet(KEYS.cumpleOculto, toISODate(ahora));
  renderCumpleBanner(ahora);
}

// ── Pestaña Cumpleaños ──────────────────────────────────

function cuando(enDias, f) {
  if (enDias === 0) return 'Hoy';
  if (enDias === 1) return 'Mañana';
  return `En ${enDias} días · ${f.getDate()}/${f.getMonth() + 1}`;
}

const etiquetaNombre = n => (esAniversario(n) ? '🎉 Aniversario de Darkcelona' : escHtml(n));

export function renderCumples(ahora = new Date()) {
  const vista = $('cumples-view');
  if (!vista) return;
  const lista = getCumples();
  if (!lista.length) {
    vista.innerHTML = `<div class="lista-cabecera">${botonAnadir('cumple', 'Añadir cumpleaños')}</div><div class="empty-state"><div class="empty-icon">🎂</div><div class="empty-text">Todavía no hay cumpleaños cargados.</div></div>`;
    return;
  }
  const hoy = hoySinHora(ahora);
  const prox = proximos(lista, ahora, 30);
  const meses = porMes(lista);
  const mesActual = ahora.getMonth() + 1;

  const filaProx = p => `
    <div class="cumple-row${p.enDias === 0 ? ' hoy' : ''}">
      <div class="cumple-cuando">${escHtml(cuando(p.enDias, p.fecha))}</div>
      <div class="cumple-nombres">${p.nombres.map(n => `<span class="attendee-chip${esMio(n) ? ' omar' : ''}">${etiquetaNombre(n)}</span>`).join('')}</div>
    </div>`;

  const mesHtml = m => {
    const items = meses[m];
    return `
    <details class="cumple-mes"${m === mesActual ? ' open' : ''}>
      <summary>${MONTHS_FULL[m - 1]} <span class="event-count">${items.length}</span></summary>
      ${items.length ? items.map(x => `
        <div class="cumple-dia${m === mesActual && x.d === hoy.getDate() ? ' hoy' : ''}">
          <span class="cumple-num">${x.d}</span><span class="cumple-nom${esMio(x.n) ? ' mio' : ''}">${etiquetaNombre(x.n)}</span>${x.id ? botonesLista('cumple', x) : ''}
        </div>`).join('') : '<div class="cumple-dia vacio">Nadie este mes</div>'}
    </details>`;
  };

  vista.innerHTML = `
    <div class="lista-cabecera">${botonAnadir('cumple', 'Añadir cumpleaños')}</div>
    <div class="section-title section-title-first">🎂 Próximos 30 días <span class="event-count">${prox.reduce((a, p) => a + p.nombres.length, 0)}</span></div>
    ${prox.length ? prox.map(filaProx).join('') : '<div class="empty-state small"><div class="empty-text">Nadie cumple años en los próximos 30 días.</div></div>'}
    <div class="section-title">📅 Todo el año <span class="event-count">${lista.length}</span></div>
    ${Array.from({ length: 12 }, (_, i) => mesHtml(i + 1)).join('')}`;
}
