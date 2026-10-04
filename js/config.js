// URL de la API (Edge Function de Supabase) que hace de backend.
// La pone el administrador al desplegar; los usuarios nunca la ven ni la configuran.
export const API_URL = 'https://oqhnqebthwqerpkiszre.supabase.co/functions/v1/api';

// Solo para la consola del navegador (diagnóstico). Sube el número en cada cambio.
export const APP_VERSION = '2026.10.02-6';

export const KEYS = {
  events: 'darkcelona-events',
  historyP1: 'darkcelona-historial-p1',     // primera página del historial (para verla al instante)
  myHistory: 'darkcelona-mis-eventos',      // los eventos pasados en los que aparezco (para el perfil)
  bares: 'darkcelona-bares',
  cumples: 'darkcelona-cumples',
  grupos: 'darkcelona-grupos',
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

export const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Tipos del desplegable del Excel (validación de datos de la columna Tipo). Los que aparezcan en los datos se añaden solos.
export const DEFAULT_TYPES = ['Concierto', 'Concierto Tributo', 'Festival', 'Cerveceo', 'Barbacoa', 'Otros'];
// Lo que cuenta como "conciertos" en el resumen de la página principal (música en directo).
export const TIPOS_CONCIERTO = ['Concierto', 'Concierto Tributo', 'Festival'];
export const TYPE_ICONS = { 'Concierto': '🎸', 'Concierto Tributo': '🎭', 'Festival': '🎪', 'Cerveceo': '🍺', 'Barbacoa': '🍖', 'Otros': '⚡' };
