import { mesesCortos, mesesLargos, diasSemana } from './i18n.js';
// URL de la API (Edge Function de Supabase) que hace de backend.
// La pone el administrador al desplegar; los usuarios nunca la ven ni la configuran.
export const API_URL = 'https://oqhnqebthwqerpkiszre.supabase.co/functions/v1/api';

// Solo para la consola del navegador (diagnóstico). Sube el número en cada cambio.
export const APP_VERSION = '2026.10.04-1';

export const KEYS = {
  events: 'darkcelona-events',
  historyP1: 'darkcelona-historial-p1',     // primera página del historial (para verla al instante)
  myHistory: 'darkcelona-mis-eventos',      // los eventos pasados en los que aparezco (para el perfil)
  bares: 'darkcelona-bares',
  cumples: 'darkcelona-cumples',
  grupos: 'darkcelona-grupos',
  novedadesVisto: 'darkcelona-novedades-visto',   // fecha de alta (del servidor) del último plan que ya vi
  calendario: 'darkcelona-calendario',            // 'google' | 'ics' | 'no': qué hacer al apuntarme
  personas: 'darkcelona-personas',                // nombres del grupo para el @ de asistentes
  cumpleOculto: 'darkcelona-cumple-oculto',   // día (AAAA-MM-DD) en que se cerró el aviso de cumpleaños
  code: 'darkcelona-code',
  user: 'darkcelona-user',
  outbox: 'darkcelona-outbox',
  apiUrl: 'darkcelona-api-url',   // solo desarrollo (localhost): API simulada
};

// Apps Script es lento e irregular (en pruebas: de 1 a 35 s por llamada, sobre todo en frío), así que se espera con margen.
export const SYNC_TIMEOUT_MS = 60000;
export const SYNC_MIN_INTERVAL_MS = 60000;        // como mucho una lectura por minuto al volver a la app
export const HISTORY_PAGE = 30;                   // el historial llega por páginas; nunca se descarga entero

// Nombres de meses y días en el idioma elegido (los nombres de las constantes son históricos: ya no son solo español).
export const MONTHS_ES = mesesCortos();
export const MONTHS_FULL = mesesLargos();
export const DAYS_ES = diasSemana();

// Tipos del desplegable del Excel (validación de datos de la columna Tipo). Los que aparezcan en los datos se añaden solos.
export const DEFAULT_TYPES = ['Concierto', 'Tributo', 'Festival', 'Cerveceo', 'Eventos Darkcelona', 'Otros'];
// Lo que cuenta como "conciertos" en el resumen de la página principal (música en directo).
export const TIPOS_CONCIERTO = ['Concierto', 'Tributo', 'Festival'];
export const TYPE_ICONS = { 'Concierto': '🎸', 'Tributo': '🎭', 'Festival': '🎪', 'Cerveceo': '🍺', 'Eventos Darkcelona': '🤘', 'Otros': '⚡' };
