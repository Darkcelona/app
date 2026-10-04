// Novedades: los planes que han añadido otras personas desde la última vez que miré.
// "Visto" es la fecha de alta (la del servidor, no la del móvil) del último plan que ya conozco; vive solo en este dispositivo.
import { KEYS } from './config.js';
import { today } from './utils.js';
import { getEvents, lsGet, lsSet } from './store.js';

const DIAS_RECIENTE = 14;       // la pestaña enseña lo añadido en las últimas dos semanas
export const novedadesState = { previo: null };   // mientras la pestaña está abierta: lo que valía "visto" al entrar (para seguir resaltando)

const getVisto = () => lsGet(KEYS.novedadesVisto);
const maxCreado = events => events.reduce((m, e) => (e.creado && e.creado > m ? e.creado : m), '');
const vigente = (e, hoy) => (e.fechaFin || e.fecha) >= hoy;

/** La primera vez en un dispositivo nada cuenta como nuevo: se parte de lo que ya hay. */
export function asegurarVisto(events = getEvents()) {
  if (getVisto() !== null) return;
  if (events.length) lsSet(KEYS.novedadesVisto, maxCreado(events) || '0');   // sin fechas de alta ('0'): todo lo que llegue después será nuevo
}

/** ¿Es un plan añadido por otra persona después de mi última visita? */
export function esNuevo(ev) {
  const desde = novedadesState.previo ?? getVisto();
  return desde !== null && !ev.mio && !!ev.creado && ev.creado > desde;
}

/** Planes por venir que no he visto aún (los que cuentan para la burbuja y el aviso). */
export function sinVer(events = getEvents(), hoy = today()) {
  const desde = getVisto();
  if (desde === null) return [];
  return events.filter(e => vigente(e, hoy) && !e.mio && e.creado && e.creado > desde);
}

/** Lo añadido por otras personas en las últimas semanas (y que aún no ha pasado), lo más reciente primero. */
export function recientes(events = getEvents(), hoy = today(), ahora = Date.now()) {
  const corte = new Date(ahora - DIAS_RECIENTE * 86400000).toISOString();
  return events.filter(e => vigente(e, hoy) && !e.mio && e.creado && e.creado >= corte)
    .sort((a, b) => b.creado.localeCompare(a.creado));
}

/** Da por vistos todos los planes actuales. */
export function marcarVisto(events = getEvents()) {
  const m = maxCreado(events);
  if (m && (getVisto() === null || m > getVisto())) lsSet(KEYS.novedadesVisto, m);
}

export function entrarNovedades() { novedadesState.previo = getVisto(); }
export function salirNovedades() { novedadesState.previo = null; }
