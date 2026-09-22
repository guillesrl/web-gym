const CACHE_NAME = 'entreno-brutal-v98';
const STATIC_ASSETS = [
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Limpiar cachés antiguas de versiones anteriores
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isAppShell = req.mode === 'navigate' ||
    /\.(html|css|js|json)$/i.test(url.pathname);

  if (isAppShell) {
    // Network-first sin caché HTTP: pide siempre a la red saltándose el
    // Cache-Control de GitHub Pages (max-age=600). Cambios al instante.
    // Solo usa la caché del SW como respaldo si no hay conexión.
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Imágenes y assets estáticos: cache-first (GIFs de ejercicios, iconos).
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
