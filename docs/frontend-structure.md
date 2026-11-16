# Frontend structure during migration

- `app/`: URL routes, shell, theme, orientation and temporary API session state.
- `components/`: reusable display, teaching, error and playback controls.
- `content/glossary.ts`: term definitions and chapter references.
- `features/home/`: landing page and explicitly planned-feature pages.
- `features/legacy/`: preserved key studio, message journey, math explorer and
  experiments, separated from the old monolithic App.
- `engine/math/`: independent BigInt algorithms and bounded optional traces.
- `styles/`: readable preserved workspace styles, shared tokens and shell styles.

`app/routes.ts` defines Learn, Break and Tools routes. BrowserRouter supports deep
links, refresh and back/forward. Vite preview handles static fallback; the existing
Python frontend server also serves these paths without capturing missing `/api`
routes. Hosted rewrite configuration is #9. The app runs key generation and message operations in browser workers;
the shell, worked example, key studio and existing experiments need no backend. Workbench stays mounted when navigating so message
and playback state are preserved. No Python files or launchers are retired here.

Shared controls:

| Component | Contract |
| --- | --- |
| `NumberView` | `label`, BigInt `value`, optional `privateValue`; dec/hex/base64, copy/expand and explicit private reveal |
| `Stepper` | Controlled `step`, `count`, `onChange`; previous/next/play/speed/result; reduced motion uses manual steps |
| `RolePanels` | Array of Alice/Bob/Eve, knowledge and optional action descriptions |
| `Term` | Glossary key; tooltip visible on pointer hover and keyboard focus |
| `ErrorBanner` | Message and optional dismiss callback |
| `LectureExampleButton` | Caller-owned `onLoad` and optional label; no baked-in numbers |

## Keyring (`src/keyring/`, #8)

One shared store for every key: `keyring` (instance), `useKeyring()` (React hook).

| Source | What | Saved in this browser? | Editable |
| --- | --- | --- | --- |
| `mine` | My key pairs (generated, or imported key-pair files) | Only while "Remember my private keys on this device" is on (off by default); turning it off deletes them from storage | Rename, delete, export |
| `contact` | Other people's public keys, with a verified flag | Always (public data only) | Rename, verify, delete |
| `demo` | Alice and Bob, bundled 2048-bit keys from `demo-keys.json` (private keys are public) | Never | No |
| `lecture` | p=17, q=11, e=7, d=23 | Never | No |

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
keys"; **Use** makes a keyring key active and, for 1024/2048-bit keys, loads it into
Key Studio and the Workbench. `RecipientPicker` (`components/`) is the "To:" field for
#13: Me, Demo characters (incl. the lecture key), My contacts, or a pasted one-time key.

Theme preference uses localStorage when available and falls back to memory if
storage is blocked. The full offline app cache is #50; loading a static shell
without Python does not itself mean it can reopen without a network connection.
The browser tests cover all routes with API requests disabled, both themes at
375/1440px, navigation, focus restoration, theme persistence and the worked example.

The test runner uses bundled Chromium by default. To use an installed Edge on
Windows, set `$env:RSA_BROWSER_CHANNEL='msedge'` before `npm run test:browser`.
