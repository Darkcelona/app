// Idiomas: español (el original), catalán e inglés.
// La clave de cada texto ES el texto en español: t('Apuntarme'). Si falta la traducción, se ve en español.
// Los textos con variables llevan {nombre}: t('Hay {n} planes', { n: 3 }).
import { CA } from './i18n-ca.js';
import { EN } from './i18n-en.js';

export const IDIOMAS = ['es', 'ca', 'en'];
const KEY = 'darkcelona-idioma';

function detectar() {
  try { const g = localStorage.getItem(KEY); if (IDIOMAS.includes(g)) return g; } catch { /* noop */ }
  const n = (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'es').slice(0, 2).toLowerCase();
  return IDIOMAS.includes(n) ? n : 'es';
}

let idioma = detectar();
const DICT = { ca: CA, en: EN };

export const getIdioma = () => idioma;

/** Cambia de idioma y recarga: así toda la pantalla (y los cambios pendientes, que se guardan) se pintan de cero. */
export function setIdioma(l) {
  if (!IDIOMAS.includes(l) || l === idioma) return;
  try { localStorage.setItem(KEY, l); } catch { /* noop */ }
  idioma = l;
  if (typeof location !== 'undefined') location.reload();
}

/** Traduce un texto en español. `params` rellena los {huecos}. */
export function t(es, params) {
  let s = idioma === 'es' ? es : (DICT[idioma][es] ?? es);
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? m));
  return s;
}

/** Singular o plural según n: tp(n, '{n} plan', '{n} planes'). */
export const tp = (n, uno, otros) => t(n === 1 ? uno : otros, { n });

// ── Fechas ──────────────────────────────────────────────
const NOMBRES = {
  es: {
    corto: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
    largo: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    dias: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    locale: 'es-ES',
  },
  ca: {
    corto: ['gen', 'febr', 'març', 'abr', 'maig', 'juny', 'jul', 'ag', 'set', 'oct', 'nov', 'des'],
    largo: ['Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre'],
    dias: ['Dg', 'Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds'],
    locale: 'ca-ES',
  },
  en: {
    corto: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    largo: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    dias: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    locale: 'en-GB',
  },
};
export const mesesCortos = () => NOMBRES[idioma].corto;
export const mesesLargos = () => NOMBRES[idioma].largo;
export const diasSemana = () => NOMBRES[idioma].dias;
export const localeNumeros = () => NOMBRES[idioma].locale;

// ── Pantalla estática (index.html) ──────────────────────
const ATRIBUTOS = ['placeholder', 'title', 'aria-label', 'alt'];

/** Traduce los textos escritos a mano en el HTML: nodos de texto y atributos con el texto exacto en español. */
export function traducirDom(raiz = document) {
  document.documentElement.lang = idioma;
  if (idioma === 'es') return;
  const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (/\S/.test(n.nodeValue) && !['SCRIPT', 'STYLE'].includes(n.parentNode.nodeName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const nodos = [];
  while (walker.nextNode()) nodos.push(walker.currentNode);
  for (const n of nodos) {
    const original = n.nodeValue.trim();
    const traducido = t(original);
    if (traducido !== original) n.nodeValue = n.nodeValue.replace(original, traducido);
  }
  raiz.querySelectorAll(ATRIBUTOS.map(a => `[${a}]`).join(',')).forEach(el => {
    for (const a of ATRIBUTOS) if (el.hasAttribute(a)) el.setAttribute(a, t(el.getAttribute(a)));
  });
  // Textos con trozos en negrita u otro formato: el HTML entero va en data-i18n-html
  raiz.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
}

/** Rellena los selectores de idioma (el de la cabecera y el de la pantalla de acceso). */
export function iniciarSelectores() {
  document.querySelectorAll('.lang-select').forEach(sel => {
    sel.value = idioma;
    sel.addEventListener('change', () => setIdioma(sel.value));
  });
}
