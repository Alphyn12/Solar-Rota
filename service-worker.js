const CACHE_NAME = 'gunesHesap-v8';
// Sadece local dosyaları pre-cache et — CDN dosyaları runtime'da cache'lenir
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/components.css',
  '/js/app.js',
  '/js/bill-analysis.js',
  '/js/cable-loss.js',
  '/js/calc-core.js',
  '/js/calc-engine.js',
  '/js/comparison.js',
  '/js/dashboard.js',
  '/js/data.js',
  '/js/eng-report.js',
  '/js/ev-charging.js',
  '/js/heat-pump.js',
  '/js/heatmap.js',
  '/js/hourly-profile.js',
  '/js/i18n.js',
  '/js/inverter.js',
  '/js/scenarios.js',
  '/js/structural.js',
  '/js/sun-path.js',
  '/js/tax.js',
  '/js/ui-charts.js',
  '/js/ui-render.js',
  '/locales/tr.json',
  '/locales/en.json',
  '/locales/de.json',
  '/icon-192.svg',
  '/icon-512.svg'
];

const API_DOMAINS = [
  're.jrc.ec.europa.eu',
  'api.open-meteo.com'
];

// ── Install: tüm static assets'i önbelleğe al ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      // Yeni SW hemen aktif olsun, eski SW bekletmesin
      return self.skipWaiting();
    })
  );
});

// ── Activate: eski cache versiyonlarını temizle ─────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // Bu SW tüm client'ları hemen kontrol etsin
      return self.clients.claim();
    })
  );
});

// ── Yardımcı: URL'nin API domain'e ait olup olmadığını kontrol et ───────────
function isApiRequest(url) {
  return API_DOMAINS.some((domain) => url.hostname.includes(domain));
}

// ── Yardımcı: Network First — timeout ile ──────────────────────────────────
function networkFirstWithTimeout(request, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      // Timeout doldu → cache'e düş
      caches.match(request).then((cached) => {
        if (cached) {
          resolve(cached);
        } else {
          // Cache'de de yok → offline fallback
          caches.match('/index.html').then((fallback) => {
            resolve(fallback || new Response(
              `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
              <title>Çevrimdışı — GüneşHesap</title>
              <meta name="viewport" content="width=device-width,initial-scale=1">
              <style>body{background:#0F172A;color:#F1F5F9;font-family:sans-serif;
              display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
              h1{color:#F59E0B;margin-bottom:8px}p{color:#94A3B8}</style></head>
              <body><div><h1>Çevrimdışısınız</h1>
              <p>İnternet bağlantınızı kontrol edip sayfayı yenileyin.</p></div></body></html>`,
              { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            ));
          });
        }
      });
    }, timeoutMs);

    fetch(request)
      .then((networkResponse) => {
        if (timedOut) return; // Timer zaten çalıştı, işlem tamam

        clearTimeout(timer);

        // Başarılı network yanıtını cache'e yaz (GET istekleri için)
        if (networkResponse.ok && request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }

        resolve(networkResponse);
      })
      .catch(() => {
        if (timedOut) return;
        clearTimeout(timer);

        // Network hatası → cache'e düş
        caches.match(request).then((cached) => {
          if (cached) {
            resolve(cached);
          } else {
            caches.match('/index.html').then((fallback) => {
              resolve(fallback || new Response(
                `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
                <title>Çevrimdışı — GüneşHesap</title>
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <style>body{background:#0F172A;color:#F1F5F9;font-family:sans-serif;
                display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
                h1{color:#F59E0B;margin-bottom:8px}p{color:#94A3B8}</style></head>
                <body><div><h1>Çevrimdışısınız</h1>
                <p>İnternet bağlantınızı kontrol edip sayfayı yenileyin.</p></div></body></html>`,
                { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
              ));
            });
          }
        });
      });
  });
}

// ── Yardımcı: Cache First ───────────────────────────────────────────────────
function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) {
      return cached;
    }

    // Cache'de yok → ağdan al ve cache'e yaz
    return fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok && request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Hem cache hem ağ yok → offline fallback
        return caches.match('/index.html').then((fallback) => {
          return fallback || new Response(
            `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
            <title>Çevrimdışı — GüneşHesap</title>
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <style>body{background:#0F172A;color:#F1F5F9;font-family:sans-serif;
            display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
            h1{color:#F59E0B;margin-bottom:8px}p{color:#94A3B8}</style></head>
            <body><div><h1>Çevrimdışısınız</h1>
            <p>İnternet bağlantınızı kontrol edip sayfayı yenileyin.</p></div></body></html>`,
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        });
      });
  });
}

// ── Fetch: strateji yönlendirmesi ───────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Sadece http/https isteklerini ele al
  if (!url.protocol.startsWith('http')) return;

  // Chrome extension ve browser-internal isteklerini atla
  if (url.protocol === 'chrome-extension:') return;

  if (isApiRequest(url)) {
    // API istekleri: Network First (20s timeout) → cache fallback
    event.respondWith(networkFirstWithTimeout(event.request, 20000));
  } else {
    // Static assets: Cache First → network fallback
    event.respondWith(cacheFirst(event.request));
  }
});
