import { describe, expect, it } from 'vitest';
import {
  CACHE_PREFIX,
  cacheName,
  classify,
  precacheList,
  SKIP_WAITING,
  staleCaches,
} from './swPolicy';
import { SKIP_WAITING_MESSAGE } from './OfflineStatus';

const origin = 'https://rsa.example';
const precache = new Set(['/index.html', '/assets/index-abc.js', '/assets/worker-def.js']);
const request = (path: string, mode = 'cors', method = 'GET') => ({
  url: path.startsWith('http') ? path : `${origin}${path}`,
  method,
  mode,
});

describe('offline service worker policy', () => {
  it('serves page loads network-first so deep links fall back to the cached shell', () => {
    for (const path of ['/', '/playground/learn/crt', '/learn/keys?x=1', '/legacy'])
      expect(classify(request(path, 'navigate'), origin, precache)).toBe('navigate');
  });

  it('serves only listed build files from the cache', () => {
    expect(classify(request('/assets/index-abc.js'), origin, precache)).toBe('precached');
    expect(classify(request('/assets/worker-def.js?v=1'), origin, precache)).toBe('precached');
    expect(classify(request('/assets/unknown-123.js'), origin, precache)).toBe('network');
  });

  it('never intercepts API, cross-origin, non-GET, blob or malformed requests', () => {
    for (const r of [
      request('/api/keys'),
      request('/api'),
      request('/api/keys', 'navigate'),
      request('https://other.example/assets/index-abc.js'),
      request('https://other.example/', 'navigate'),
      request('/assets/index-abc.js', 'cors', 'POST'),
      request('/', 'navigate', 'POST'),
      request('blob:https://rsa.example/1234'),
      { url: 'not a url', method: 'GET', mode: 'cors' },
    ])
      expect(classify(r, origin, precache), r.url).toBe('network');
  });

  it('keeps only the current shell cache and leaves unrelated caches alone', () => {
    const current = cacheName('v2');
    expect(current.startsWith(CACHE_PREFIX)).toBe(true);
    expect(
      staleCaches(
        [cacheName('v1'), current, cacheName('v0'), 'someone-else', 'rsa-lab-x'],
        current,
      ),
    ).toEqual([cacheName('v1'), cacheName('v0')]);
  });

  it('precaches the build output except the worker and source maps', () => {
    expect(
      precacheList(['sw.js', 'index.html', 'assets/b.js', 'assets/a.css', 'assets/b.js.map']),
    ).toEqual(['/assets/a.css', '/assets/b.js', '/index.html']);
    expect(() => precacheList(['assets/a.js'])).toThrow('index.html');
  });

  it('uses the same update message in the page and the worker', () => {
    expect(SKIP_WAITING_MESSAGE).toBe(SKIP_WAITING);
  });
});
