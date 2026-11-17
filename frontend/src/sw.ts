/*
 * Offline service worker (#50). Built to /sw.js; `vite.config.ts` replaces the two
 * placeholders below with this build's file list and version. See swPolicy.ts.
 */
import { cacheName, classify, SHELL_PATH, SKIP_WAITING, staleCaches } from './offline/swPolicy';

type ExtendableEvent = Event & { waitUntil(promise: Promise<unknown>): void };
type FetchEvent = ExtendableEvent & {
  request: Request;
  respondWith(response: Promise<Response>): void;
};
type ServiceWorkerScope = {
  location: Location;
  registration: { active: unknown };
  clients: { claim(): Promise<void> };
  skipWaiting(): Promise<void>;
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
};

// Build-time constants, replaced in vite.config.ts (bare identifiers survive minification).
declare const __RSA_LAB_PRECACHE__: string[];
declare const __RSA_LAB_VERSION__: string;

const scope = self as unknown as ServiceWorkerScope;
const PRECACHE = __RSA_LAB_PRECACHE__;
const CACHE = cacheName(__RSA_LAB_VERSION__);
const precached = new Set(PRECACHE);

scope.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // `reload` skips the HTTP cache so the cached copy matches this build exactly.
      await cache.addAll(PRECACHE.map((path) => new Request(path, { cache: 'reload' })));
      // The very first install takes control at once. Later versions wait until the
      // user chooses to reload, so an open page never mixes old and new code.
      if (!scope.registration.active) await scope.skipWaiting();
    })(),
  );
});

scope.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(staleCaches(keys, CACHE).map((key) => caches.delete(key)));
      await scope.clients.claim();
    })(),
  );
});

scope.addEventListener('message', (event) => {
  if (event.data === SKIP_WAITING) void scope.skipWaiting();
});

scope.addEventListener('fetch', (event) => {
  const handling = classify(event.request, scope.location.origin, precached);
  if (handling === 'network') return;
  if (handling === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const shell = await caches.match(SHELL_PATH, { cacheName: CACHE });
        return shell ?? Response.error();
      }),
    );
    return;
  }
  event.respondWith(
    caches
      .match(new URL(event.request.url).pathname, { cacheName: CACHE })
      .then((cached) => cached ?? fetch(event.request)),
  );
});
