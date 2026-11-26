// Offline cache, versioned per build. The page registers "sw.js?v=<build>", so every deploy installs a NEW worker with a NEW
// cache name; activation deletes every older cache, so files of different builds are never mixed.
// Strategy: network first (a fresh copy whenever online) and the cache of THIS build only as the offline fallback, so an old
// atlas or manifest is never served while the network works.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `frankentilleria-v2-${VERSION}`;
const NETWORK_TIMEOUT_MS = 4000;

// Vite's hashed files (index-AbC123xy.js) never change: the browser cache may answer them. Everything else (the page, the
// manifest, the atlases in public/assets, served with max-age) is revalidated with the server on every load.
const HASHED = /-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/;

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

/** Stores a fresh network copy of `url` in this build's cache (errors are ignored: it is only the offline fallback). */
async function store(cache, url) {
  try {
    const res = await Promise.race([fetch(url, { cache: 'no-cache' }), timeout(NETWORK_TIMEOUT_MS)]);
    if (res.status === 200 && res.type === 'basic') await cache.put(url, res);
  } catch {
    /* offline or slow: the file will be cached the next time it is used */
  }
}

// Install: the page and the hashed files it references, so the very next opening already works offline.
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await store(cache, './');
      const page = await cache.match('./');
      if (!page) return;
      const html = await page.text();
      const urls = [...html.matchAll(/(?:src|href)="(\.?\/[^"]+)"/g)].map((m) => m[1]);
      await Promise.all(urls.map((u) => store(cache, u)));
      // and the fonts the stylesheets point to (url(...) relative to each .css)
      for (const u of urls.filter((x) => x.endsWith('.css'))) {
        const css = await cache.match(u);
        if (!css) continue;
        const base = new URL(u, self.location.href);
        const fonts = [...(await css.text()).matchAll(/url\(["']?([^"')]+)["']?\)/g)]
          .map((m) => m[1])
          .filter((f) => !f.startsWith('data:'))
          .map((f) => new URL(f, base).href);
        await Promise.all(fonts.map((f) => store(cache, f)));
      }
    })(),
  );
});

// Activate: the non-hashed files the previous build had cached (atlases, manifest) are fetched again from the network
// into the new cache (never copied: an old atlas must not survive a deploy), then every older cache is deleted.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const old = (await caches.keys()).filter((k) => k !== CACHE);
      for (const name of old) {
        const reqs = await (await caches.open(name)).keys();
        const urls = reqs.map((r) => r.url).filter((u) => !HASHED.test(new URL(u).pathname));
        await Promise.all(urls.map(async (u) => ((await cache.match(u)) ? undefined : store(cache, u))));
        await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

function fromNetwork(req) {
  if (HASHED.test(new URL(req.url).pathname)) return fetch(req);
  return fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([fromNetwork(req), timeout(NETWORK_TIMEOUT_MS)]);
        // Only complete, successful responses are stored (never a partial 206 or an error page).
        if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone()).catch(() => undefined);
        return res;
      } catch (err) {
        // ignoreVary: the page asks for its scripts in CORS mode (Origin header), the install cached them without it
        const hit = await cache.match(req, { ignoreVary: true });
        if (hit) return hit;
        throw err;
      }
    })(),
  );
});
