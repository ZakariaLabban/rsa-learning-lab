# Frontend structure during migration

The default UI is `features/lecture/`: a calm, step-by-step course that follows the lecture
slides (see [lecture-view.md](lecture-view.md)). `features/workshop/` is the animated RSA journey
with guided and free modes at `/playground`. `app/App.tsx` selects the lecture view, the workshop
or the preserved `app/LegacyShell.tsx` (from the URL, then the saved choice);
`app/LabTheme.tsx` shares the theme. `features/lessons/ModernLab.tsx` provides every
new lesson/tool route under `/playground/*`; shared lesson components publish
actual math/protocol traces through the scoped `LessonTrace` player. Existing
unprefixed lesson routes remain in Legacy. See [animated-lessons.md](animated-lessons.md).
See [animated-workshop.md](animated-workshop.md) for switching, session retention,
the engine trace boundary and rollback.

- `app/`: URL routes, shell, theme, orientation and browser session state.
- `components/`: reusable display, teaching, error and playback controls.
- `content/glossary.ts`: term definitions and chapter references, using the slide notation
  (M/C, PU = {e, n}, PR = {d, n}, φ(n)). Every lesson/tool page uses `Term` for its key
  terms; `browser-tests/glossary.spec.ts` checks each Learn, Break and Tools route.
- `features/lecture/`: the lecture view (course shell, lessons, calculation model, practice
  generator, animated SVG diagrams, scoped styles).
- `features/home/`: landing page and explicitly planned-feature pages.
- `features/legacy/`: preserved key studio, message journey, math explorer and
  experiments, separated from the old monolithic App.
- `engine/math/`: independent BigInt algorithms and bounded optional traces.
- `styles/`: readable preserved workspace styles, shared tokens and shell styles.

`app/routes.ts` defines Learn, Break and Tools routes. BrowserRouter supports deep
links, refresh and back/forward. Vite dev/preview handles local static fallback;
`frontend/vercel.json` provides the hosted SPA fallback. Key generation and message
operations run in browser workers, with no Python server or `/api` proxy. The
Encrypt / Decrypt page stays mounted when navigating so the message and journey
are preserved. Retiring the old server does not remove the Legacy interface;
all three interfaces use the browser engine. See [architecture](architecture.md).

Shared controls:

| Component              | Contract                                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NumberView`           | `label`, BigInt `value`, optional `privateValue`; dec/hex/base64, copy/expand and explicit private reveal                                                              |
| `Stepper`              | Controlled `step`, `count`, `onChange`; previous/next/play/speed/result; reduced motion uses manual steps                                                              |
| `RolePanels`           | Array of Alice/Bob/Eve, knowledge and optional action descriptions                                                                                                     |
| `Term`                 | Glossary key, optional `children` label (e.g. `φ(n)`); tooltip with name, explanation and Ch 8/Ch 9 or standard reference, visible on pointer hover and keyboard focus |
| `ErrorBanner`          | Message and optional dismiss callback                                                                                                                                  |
| `LectureExampleButton` | Caller-owned `onLoad` and optional label; no baked-in numbers                                                                                                          |

## Keyring (`src/keyring/`, #8)

One shared store for every key: `keyring` (instance), `useKeyring()` (React hook).

| Source    | What                                                                                 | Saved in this browser?                                                                                                | Editable               |
| --------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `mine`    | My key pairs (generated, or imported key-pair files)                                 | Only while "Remember my private keys on this device" is on (off by default); turning it off deletes them from storage | Rename, delete, export |
| `contact` | Other people's public keys, with a verified flag                                     | Always (public data only)                                                                                             | Rename, verify, delete |
| `demo`    | Alice and Bob, bundled 2048-bit keys from `demo-keys.json` (private keys are public) | Never                                                                                                                 | No                     |
| `lecture` | p=17, q=11, e=7, d=23                                                                | Never                                                                                                                 | No                     |

Storage key `rsa-lab.keyring`, schema version 1, integers as decimal strings; every
saved entry is re-validated (and its fingerprint recomputed) on load, and invalid
entries are dropped. The active key must have a private part.

Key files (`files.ts`): `.pub` = `rsa-lab-public-v2` (also what Key Studio exports);
key pair = `rsa-lab-keypair-v2` (the UI warns before exporting it). Imports check
format and fields, n=p*q, distinct probable primes, 1<e<n, e*d = 1 mod lambda(n)
(lecture d mod phi and library d mod lambda both pass), supported size, optional
`bits` and `fingerprint`, and report a readable reason when anything is wrong.

`MyKeys` (Keys page) lists all keys with import (file or pasted text), export,
the remember toggle and clear-all. Keys generated in Key Studio are added to "My
keys" and become the active key; **Use** makes a keyring key active and, for
1024/2048-bit keys, also loads it into Key Studio. `RecipientPicker` (`components/`) is the
"To:" field: Me, Demo characters (incl. the lecture key), My contacts, or a pasted one-time key.

## Encrypt / Decrypt (`features/encrypt/`, #13)

`/learn/encrypt` replaces the old Workbench (its file stays in `features/legacy/` until #45).
`model.ts` holds the testable logic; `EncryptDecrypt.tsx` the page; `JourneyTrack.tsx` reuses
the original journey styling.

- **To:** defaults to the active key, then my newest key, then demo Alice. Encryption needs
  only the public key, so contacts and pasted keys work too.
- **Text or Number (M):** text uses textbook blocks or OAEP (per `capabilities`); keys with
  n < 256 are number-only; number mode is raw C = M^e mod n. Text is limited to 1000 bytes
  per action. **Load lecture example** = lecture key, M = 88.
- **Journey:** Bob / Alice / Eve panels and a stepper through the real values of the run
  (message, blocks or OAEP block EM, encryption, envelope, decryption). Private values
  stay hidden until revealed.
- **Decrypt** (on the page) uses the recipient's private key if this browser holds it,
  otherwise explains that only the recipient can. **Decrypt a received envelope** picks
  the matching key among my keys and the demo characters and explains every failure.
- **Hybrid** padding (AES-GCM + RSA-OAEP key wrap, up to 100,000 bytes of text) and **Also sign as me** (#44):
  choose a 1024/2048-bit signer (my keys first, then the demo characters), sign with RSA-PSS,
  then send in hybrid mode. Decrypting shows one of: unsigned, valid (named sender), unknown key
  (add the sender as a contact to check it) or invalid. The journey adds Sign, AES and Wrap steps.
  The lab signs and encrypts with one key pair for simplicity; real systems prefer separate keys.

## Attack lessons (#15, #46, #47)

`features/attacks/` contains public demo fixtures, bounded worker jobs and the Factoring
Race, YES/NO and Small-e Broadcast pages. Attack traces remain in memory and are isolated
from personal keys and practical-message APIs. See [attack-lessons.md](attack-lessons.md)
for algorithm limits, OAEP trace disclosure, measured timings, fixture provenance and tests.

## Number theory lessons (#11, #12)

`features/number-theory/` provides Miller–Rabin, Why RSA Works, square-and-multiply and CRT
pages with a typed cancellable worker and bounded teaching inputs. The old OAEP benchmark
now links to the ordinary/CRT decryption comparison; existing experiments and generation
history remain. See [number-theory-lessons.md](number-theory-lessons.md) for the math
conditions, input limits, lecture examples, timing methodology and verification.

## Files, contacts and signatures (#17, #16, #14)

`features/files/` adds the Files tab to Encrypt / Decrypt, a cancellable worker and safe
download model. `features/contacts/` shares public key text/files/QR and manages verified
contacts through the existing keyring. `features/signatures/` provides the PSS and teaching
signature lesson. These feature UIs and QR dependencies load on demand.
See [files-contacts-signatures.md](files-contacts-signatures.md) for contracts, timing,
privacy, limits and verification coverage.

## Key Generation Wizard and Extended Euclid (#10)

The Keys page starts with `KeyWizard` (`features/keys/`), then the keyring, then the
classic Key Studio (kept until #45). Logic is in `wizardModel.ts`; the Euclid table in
`features/euclid/` is shared by the wizard and the `/learn/euclid` page.

- **Step 1:** generate p and q in the worker (8/16/32/64 teaching bits, or 1024/2048 bits,
  with progress and stop), or type p and q (distinct odd primes, n ≤ 64 bits; non-primes
  are explained with a factor, e.g. 15 = 3 × 5). "How were p and q generated?" explains the
  random odd number → small-prime check → Miller–Rabin search and shows the candidate count.
- **Steps 2–5:** n, φ(n), e (teaching keys: typed, validated and with suggested valid values;
  real keys: fixed 65537), then d = e⁻¹ mod φ(n) with a mini Euclid table, a check line, a
  link to the Euclid page and a λ(n) side note.
- **Step 6:** PU = {e, n} and PR = {d, n}, with d hidden until revealed; **Save to my keyring**
  adds the key under "My keys" and makes it the active key.
- **Load lecture example:** p = 17, q = 11, e = 7 gives PU = {7, 187}, PR = {23, 187}.
- **`/learn/euclid`:** a and m (also from `?a=&m=`) → full table (rows r = s·m + t·a, the r = 1
  row highlighted, long tables summarised), then the inverse with a check line, or
  "No inverse (gcd = g)" with an explanation.

Theme preference uses localStorage when available and falls back to memory if
storage is blocked. The full offline app cache is #50; loading a static shell
without Python does not itself mean it can reopen without a network connection.
The browser tests cover all routes with API requests disabled, both themes at
375/1440px, navigation, focus restoration, theme persistence and the worked example.

The test runner uses bundled Chromium by default. To use an installed Edge on
Windows, set `$env:RSA_BROWSER_CHANNEL='msedge'` before `npm run test:browser`.
