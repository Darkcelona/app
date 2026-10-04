// Añadir un plan al calendario del móvil: Google Calendar (enlace ya relleno) o archivo .ics (Apple, Outlook...).
// No hace falta ningún permiso ni cuenta: la persona solo confirma en su calendario.
import { KEYS } from './config.js';
import { calendarioGoogleUrl, calendarioIcs, hashId, eventKey } from './utils.js';
import { getEvents, lsGet, lsSet } from './store.js';
import { $, showToast } from './ui.js';

const appUrl = () => location.origin + location.pathname;
let pendiente = null;   // el plan del que se está preguntando

const preferencia = () => lsGet(KEYS.calendario) || '';

function descargarIcs(ev) {
  const blob = new Blob([calendarioIcs(ev, appUrl())], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `darkcelona-${hashId(eventKey(ev))}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

function hacer(ev, via) {
  if (via === 'google') {
    // Se abre en la pestaña nueva (en el móvil salta a la app de Google Calendar si la tiene)
    window.open(calendarioGoogleUrl(ev, appUrl()), '_blank', 'noopener');
  } else if (via === 'ics') {
    descargarIcs(ev);
  }
}

function preguntar(ev) {
  pendiente = ev;
  $('cal-evento').textContent = ev.evento.split('\n')[0];
  $('cal-overlay').classList.add('open');
}

export function cerrarCalendario() {
  $('cal-overlay').classList.remove('open');
  pendiente = null;
}

/** Al apuntarse: hace lo que la persona eligió la otra vez; si nunca eligió, pregunta. */
export function alApuntarse(ev) {
  const pref = preferencia();
  if (pref === 'google' || pref === 'ics') hacer(ev, pref);
  else if (pref !== 'no') preguntar(ev);
}

/** El botón 📅 de una tarjeta: pregunta siempre (así se puede cambiar de opinión). */
export function abrirCalendario(id) {
  const ev = getEvents().find(e => e.id === id);
  if (ev) preguntar(ev);
}

export function elegirCalendario(via) {
  const ev = pendiente;
  if (!ev) return;
  if ($('cal-recordar').checked) lsSet(KEYS.calendario, via);
  cerrarCalendario();
  hacer(ev, via);
  if (via === 'ics') showToast('📅 Abre el archivo para añadirlo');
}
