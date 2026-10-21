// La mascota (la pantalla con guantes y zapatillas). Cada animación vive en img/mascota/<nombre>.*:
// .webm (VP9 con transparencia), .webp animado para Safari/iOS (no pinta la transparencia del VP9)
// y .png fijo para quien tiene activado "reducir movimiento".

const BASE = 'img/mascota/';

// Todo lo que corre en iOS es WebKit; en escritorio, Safari es WebKit sin Chrome/Edge/Firefox.
const ua = navigator.userAgent;
const webkit = /iP(hone|ad|od)/.test(ua) || (/AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|Firefox|Android/.test(ua));
const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** HTML de la mascota con la animación `nombre`. `una` = se reproduce una vez y se queda quieta. */
export function mascotaHTML(nombre, { clase = '', una = false } = {}) {
  const cls = `mascota ${clase}`.trim();
  if (sinMovimiento()) return `<img class="${cls}" src="${BASE}${nombre}.png" alt="" aria-hidden="true">`;
  if (webkit) return `<img class="${cls}" src="${BASE}${nombre}${una ? '-1' : ''}.webp" alt="" aria-hidden="true">`;
  return `<video class="${cls}" src="${BASE}${nombre}.webm" poster="${BASE}${nombre}.png" autoplay muted playsinline${una ? '' : ' loop'} aria-hidden="true"></video>`;
}

/** Bloque de "no hay nada" con la mascota en lugar del emoji. */
export function vacioHTML(nombre, texto, { pequeno = false, una = false } = {}) {
  return `<div class="empty-state${pequeno ? ' small' : ''}">${mascotaHTML(nombre, { clase: 'mascota-vacio', una })}<div class="empty-text">${texto}</div></div>`;
}

let celebrando = null;

/** La mascota salta celebrando un momento junto al aviso de abajo. */
export function celebrar() {
  if (sinMovimiento()) return;
  celebrando?.remove();
  const el = document.createElement('div');
  el.className = 'mascota-pop';
  el.innerHTML = mascotaHTML('celebrar', { una: true });
  document.body.appendChild(el);
  celebrando = el;
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => el.classList.remove('show'), 2600);
  setTimeout(() => { el.remove(); if (celebrando === el) celebrando = null; }, 3000);
}
