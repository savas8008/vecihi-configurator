/**
 * X-Flight Configurator - Service Worker
 * PWA desteği için statik varlıkları önbelleğe alır.
 * Web Serial API çalışmak için HTTPS veya localhost gerektirir.
 */

const CACHE_NAME = 'xflight-v1';

// Önbelleğe alınacak statik dosyalar
const STATIC_ASSETS = [
  './configurator.html',
  './elrs_backpack.html',
  './style.css',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/main.js',
  './js/serial_communication.js',
  './js/logger.js',
  './js/sensors.js',
  './js/transmitter.js',
  './js/calibration.js',
  './js/osd.js',
  './js/pid.js',
  './js/advanced_page.js',
  './js/sensor_alignment.js',
  './js/page_management.js',
  './js/flight_modes.js',
  './js/aircraft_model.js',
  './js/settings_backup.js',
  './js/waypoint.js',
  './js/outputs.js',
  './js/outputs_page.js',
];

// Install: Statik varlıkları önbelleğe al
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Eski önbellekleri temizle
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Önce ağdan dene, başarısız olursa önbellekten sun
self.addEventListener('fetch', (event) => {
  // Dış CDN istekleri için ağı öncelikli kullan
  const url = new URL(event.request.url);
  const isExternal = url.origin !== self.location.origin;

  if (isExternal) {
    // CDN kaynakları: ağdan dene, başarısız olursa önbellekten
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Yerel dosyalar: Network-first (geliştirme sırasında güncel dosya alınır)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
