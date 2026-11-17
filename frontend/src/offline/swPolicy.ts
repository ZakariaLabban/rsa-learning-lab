/**
 * Pure caching rules for the offline service worker (#50), kept separate so they
 * can be unit tested. The worker only ever stores the build's own static files
 * (app shell, route chunks, workers, CSS). It never stores runtime responses, so
 * envelopes, plaintext, key files, API or account responses cannot enter the cache.
 */
export const CACHE_PREFIX = 'rsa-lab-shell-';
export const SHELL_PATH = '/index.html';
export const SKIP_WAITING = 'rsa-lab:skip-waiting';

export const cacheName = (version: string) => `${CACHE_PREFIX}${version}`;

export type RequestInfoLike = { url: string; method: string; mode: string };
export type Handling = 'navigate' | 'precached' | 'network';

/**
 * - `navigate`: same-origin page loads. Network first (never stored); offline falls
 *   back to the cached shell so deep links and reloads work.
 * - `precached`: a build file listed in the manifest. Served from the cache.
 * - `network`: everything else, including `/api`, cross-origin, non-GET, blob/data
 *   and unknown paths. The worker does not intercept these at all.
 */
export function classify(
  request: RequestInfoLike,
  origin: string,
  precache: ReadonlySet<string>,
): Handling {
  if (request.method !== 'GET') return 'network';
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return 'network';
  }
  if (url.origin !== origin) return 'network';
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return 'network';
  if (request.mode === 'navigate') return 'navigate';
  return precache.has(url.pathname) ? 'precached' : 'network';
}

/** Old shell caches to remove when a new version activates. Other caches are left alone. */
export const staleCaches = (keys: readonly string[], current: string) =>
  keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== current);

/** Files to precache from the build output: everything except the worker itself and maps. */
export function precacheList(files: readonly string[]) {
  const list = files
    .filter((file) => file !== 'sw.js' && !file.endsWith('.map'))
    .map((file) => `/${file.replace(/^\/+/, '')}`);
  if (!list.includes(SHELL_PATH)) throw new Error('The build has no index.html to cache.');
  return [...new Set(list)].sort();
}
