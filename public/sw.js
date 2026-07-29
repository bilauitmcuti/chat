const swUrl = new URL(self.location.href);
const SW_VERSION = swUrl.searchParams.get('v') || 'v2026-07-16-01';
const CACHE_NAME = `bilauitmcuti-${SW_VERSION}`;
const PRECACHE_URLS = ['/', '/favicon.ico', '/manifest.json'];
const TURNSTILE_HOST = 'challenges.cloudflare.com';
const CLOUDFLARE_INSIGHTS_HOST = 'static.cloudflareinsights.com';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
          return Promise.resolve();
        })
      )
    )
  );
  self.clients.claim();
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'error') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request);
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Never intercept non-GET requests.
  if (request.method !== 'GET') return;

  // Never intercept cross-origin requests (including Turnstile / Insights).
  if (url.origin !== self.location.origin) return;

  // Defensive bypass for known Cloudflare hosts.
  if (url.hostname === TURNSTILE_HOST || url.hostname === CLOUDFLARE_INSIGHTS_HOST) return;

  // Never cache API routes.
  if (url.pathname.startsWith('/api/')) return;

  // Never intercept hashed Next assets — let the edge serve correct MIME types.
  if (url.pathname.startsWith('/_next/static/')) return;

  // Network-first for navigations to avoid stale HTML/CSP traps.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedRoot = await caches.match('/');
        return cachedRoot || Response.error();
      })
    );
    return;
  }

  // Static same-origin assets: network-first with cache fallback.
  event.respondWith(networkFirst(request));
});
