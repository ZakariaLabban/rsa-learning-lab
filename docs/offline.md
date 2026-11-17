# Offline guest app (#50)

After one successful online visit, RSA Lab reopens, reloads and follows deep links
without a connection. Key generation, encryption/decryption, lessons and attacks
already run in browser workers, so they keep working offline. A first-ever visit
still needs a connection, or the local build below.

## How it works

`src/sw.ts` is a small hand-written service worker, built to `/sw.js` by the
`offlineServiceWorker` plugin in `vite.config.ts`. At build time the plugin injects:

- the exact list of build files to precache (`index.html`, every JS/CSS chunk and
  the four worker bundles; not `sw.js` or source maps);
- a version: a SHA-256 of those files, so each deploy gets its own
  `rsa-lab-shell-<version>` cache.

The rules live in `src/offline/swPolicy.ts` and are unit tested:

| Request                                                                   | Handling                                                                                                                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same-origin page load (`navigate`)                                        | This version's cached `index.html` (network only if missing), so deep links and reloads work offline and a page never runs a build its cache does not hold |
| A file in this build's list                                               | Served from this version's cache                                                                                                                           |
| Everything else: `/api`, other origins, non-GET, blob/data, unknown paths | Not intercepted                                                                                                                                            |

The worker never stores runtime responses. Envelopes, plaintext, key files, account
or share-link responses therefore cannot enter its cache. Private-key persistence
remains controlled by the keyring setting (#8).

## Updates

The first install takes control immediately. Page loads always use the cached
`index.html` of the controlling version, so after a deploy the page keeps running
the build it has fully cached, online or offline. The new deploy installs in the
background and **waits**. The page shows "A new version of RSA Lab is ready" with a
**Reload now** button, warning that reloading clears keys held only in the tab's
memory. The new version activates after that click, or on its own once every RSA Lab
tab has been closed (standard service-worker behaviour). It then deletes the old shell
cache. An open page therefore never mixes files from two builds or two engine formats.
Other open tabs show "Reload to finish", because their not-yet-opened pages may fail
until they reload.

When the browser reports it is offline, a notice says so. It only promises that
guest tools keep working once this page is controlled by the worker; otherwise it
says unloaded pages still need a connection. Accounts and online share links do
not exist yet (#48/#49); they must show their own offline state when added.

## Hosting notes

`vercel.json` already serves `/sw.js` from the file system with `Cache-Control:
no-cache` (the catch-all rule), so browsers check for updates on each visit. The
CSP's `worker-src 'self'` covers it. Development (`npm run dev`) does not register
the worker.

To retire or reset the worker (for example after shipping a broken shell), deploy
a `sw.js` that deletes the `rsa-lab-shell-*` caches and calls
`self.registration.unregister()`. Until then, users keep the version they have
cached.

## Local fallback without hosting

`npm ci`, `npm run build`, then `npm run preview` serves the same static app on
`http://127.0.0.1:4173`; see the README. No Python service is needed.

## Tests

- `src/offline/offline.test.ts`: request classification, cache clean-up, the file
  list and the shared update message.
- `browser-tests/offline.spec.ts` starts its own preview server, installs the app,
  then **stops the server** so the site is genuinely unreachable. It then reloads
  deep links, generates a 1024-bit key and completes an OAEP encrypt/decrypt. A
  second test serves a new version, checks that it waits for the user, and checks
  that after Reload now only the new cache remains and that it holds build files only.
  The new version's `index.html` carries a marker, so the test also proves that
  reloads and new routes keep running the old build until Reload now.
  Playwright's `setOffline` is not used for this because it blocks page requests
  before the service worker can answer them, which real browsers do not do.
- `playwright.config.ts` sets `serviceWorkers: 'block'` for every other spec, since
  several stub worker scripts with `page.route`, which a service worker would answer
  from its cache first; `offline.spec.ts` re-enables it.
