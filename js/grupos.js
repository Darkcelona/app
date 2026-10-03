// Otros grupos de la comunidad (deportivos...): lista [{ n: 'Padel 🏓', u: 'https://t.me/+…' }] de la pestaña "Grupos" del Excel.
import { escHtml } from './utils.js';
import { getGrupos } from './store.js';

const $ = id => document.getElementById(id);

// Icono por el nombre del grupo (sin tildes ni mayúsculas); lo que no se reconozca lleva el genérico
const ICONOS = [
  [/p[aá]del|padel/, '🏓'],
  [/kart|f1|formula|f[oó]rmula|motor|carrer/, '🏎️'],
  [/f[uú][tr]?[bg]ol|balomp/, '⚽'],
];
export function iconoGrupo(nombre) {
  const n = String(nombre || '').toLowerCase();
  const hit = ICONOS.find(([re]) => re.test(n));
  return hit ? hit[1] : '👥';
}

/** El nombre sin los emojis que ya trae el Excel (el icono se pone aparte, más grande). */
export function limpiarNombre(nombre) {
  return String(nombre || '').replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/\s+/g, ' ').trim() || String(nombre || '').trim();
}

const enlaceSeguro = u => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');   // solo http(s): nunca javascript:

export function renderGrupos() {
  const lista = getGrupos().filter(g => g && g.n && enlaceSeguro(g.u));
  $('grupos-view').innerHTML = `
    <div class="section-title section-title-first">👥 Otros grupos <span class="event-count">${lista.length}</span></div>
    <p class="grupos-intro">Grupos de la comunidad Darkcelona para otras aficiones. Abiertos a todos los miembros.</p>
    ${lista.length ? lista.map(g => `
      <a class="grupo-card" href="${escHtml(enlaceSeguro(g.u))}" target="_blank" rel="noopener noreferrer">
        <span class="grupo-icono" aria-hidden="true">${iconoGrupo(g.n)}</span>
        <span class="grupo-nombre">${escHtml(limpiarNombre(g.n))}</span>
        <span class="grupo-unirme">Unirme ›</span>
      </a>`).join('') : '<div class="empty-state small"><div class="empty-text">Todavía no hay otros grupos.</div></div>'}
    <p class="grupos-nota">¿Quieres añadir un grupo? Habla antes con los admins.</p>`;
}
