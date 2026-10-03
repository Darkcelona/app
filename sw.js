// Cambia VERSION cuando modifiques la lista PRECACHE; los archivos propios se refrescan solos
// (stale-while-revalidate) y la navegación es network-first, así que no quedan versiones viejas atascadas.
const VERSION = 'v8';
const CACHE = `darkcelona-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './img/logo.png',
  './css/styles.css',
  './js/app.js',
  './js/config.js',
  './js/utils.js',
  './js/store.js',
  './js/api.js',
  './js/ui.js',
  './js/render.js',
  './js/profile.js',
  './js/cumples.js',
  './js/admin.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Recursos de terceros que sí se guardan para uso sin conexión. Todo lo demás
// (el documento Excel, imágenes de carteles...) pasa directo a la red.
const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const CDN_PRECACHE = [
  'https://fonts.googleapis.com/css2?family=Metal+Mania&family=Rajdhani:wght@300;400;500;600;700&display=swap',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE);
    // Best effort: si falla un CDN no se aborta la instalación.
    await Promise.all(CDN_PRECACHE.map(url =>
      fetch(new Request(url, { mode: 'no-cors' })).then(r => cache.put(url, r)).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('darkcelona-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put('./index.html', res.clone());
    return res;
  } catch {
    return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
  }
}

// En desarrollo (localhost) no se sirve nada de caché: siempre la última versión de los archivos.
const DEV = ['localhost', '127.0.0.1'].includes(self.location.hostname);

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (DEV && url.origin === self.location.origin) return;

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(networkFirstPage(request));
  } else if (url.origin === self.location.origin || CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find(c => c.url.startsWith(self.registration.scope));
    if (open) return open.focus();
    return self.clients.openWindow('./');
  })());
});
