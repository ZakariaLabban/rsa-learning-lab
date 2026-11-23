# RSA Lab

An educational RSA application for EECE 455/632, Project 12. The working core runs
in the browser: exact 1024/2048-bit key generation, textbook/OAEP encryption,
message recovery, private-component inspection and repeat-encryption experiments.
The Learn/Break shell has light/dark themes, mobile navigation and direct routes;
unfinished lessons are clearly marked as planned.

## Run locally

Use Node 22.13+ (Node 22 is recorded in `.nvmrc`).

```powershell
Set-Location frontend
npm.cmd ci
npm.cmd run dev
```

For the production build, use `npm.cmd run build` followed by `npm.cmd run preview`.
There is no Python server to start: Vite serves the app locally, and Vercel hosts
the production build. RSA calculations run in browser workers. No account is
required for guest use. After one online
visit the built app also reopens and works offline; see [offline guest app](docs/offline.md).

## Three interfaces

The **lecture view** is the default for new visitors. `/` opens a course map with
16 short lessons that follow the lecture slides (chapters 4, 8 and 9): the GCD, Extended
Euclid, square-and-multiply, Miller-Rabin and CRT tables are filled one row at a time, then
RSA by hand, signatures, three attacks, keys, contacts, messages and files, and a practice
quiz. Lessons live under `/lecture/*`. See [the lecture view guide](docs/lecture-view.md).

The animated workshop, with guided playback, free exploration and step-by-step views
inside the RSA machines, is at `/playground` (all lessons and tools have animated routes
under `/playground/*`). The previous interface is the **Legacy lab** at `/legacy`.
The header of each view links to the others. A visitor who already chose the workshop or
the Legacy lab keeps that choice for `/`; `/lecture`, `/playground` and `/legacy` always open
the corresponding experience, and all existing lesson URLs still work. All views share the
same RSA engine. See [the workshop guide](docs/animated-workshop.md) for behavior and
rollback details, and [animated lessons](docs/animated-lessons.md) for the route map, player,
private-value handling and seeded Practice questions/progress.

Error and 404 pages, accessibility checks, page titles and link previews, and Lighthouse
results are described in [hardening](docs/hardening.md).

## Key handling and limitations

Keys live in this tab's memory, with the last eight keys available in its history.
Refreshing clears them. Private values appear only after Reveal; they are never
uploaded. Local private-key persistence and import/export are separate work in #8.
The existing public-key export contains public components only.

The custom math, OAEP and PSS code is educational, unaudited and not constant-time.
Use demonstration data. 1024-bit RSA is retained for the assignment; 2048 is the
default. Textbook encryption is deterministic and provides no integrity guarantee.
OAEP-SHA256 has a 62-byte capacity at 1024 bits and 190 bytes at 2048; count UTF-8
bytes rather than characters. The current textbook text UI allows one block
(127/255 bytes). Ciphertext uses the strictly validated `rsa-lab.v2:` envelope.
Old v1 envelopes require the old app to recover plaintext before re-encryption.

Generation runs in a cancellable worker with real candidate counts. Cancelled
or stale work cannot replace the active key. Encryption/decryption use workers
too. Benchmarks report worker elapsed computation, excluding startup, animation
and rendering; results describe a single key/device, not a controlled security study.

## Validation

```powershell
Set-Location frontend
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:browser
```

Python 3.11+ is used for independent reference tests, not by the browser app:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m reference.generate_vectors --check
.\.venv\Scripts\python.exe -m reference.generate_encoding_vectors --check
```

Tests include both key sizes, CRT/non-coprime messages, leading zero bytes,
Unicode, malformed encodings/envelopes, deterministic Python encoding fixtures,
independent OpenSSL OAEP/PSS interoperability in both directions, AES-GCM/AAD
integrity, browser cancellation, responsiveness and no API requests. CI runs on
PRs and main. Python is a development/test dependency only; the former Python
API, API client, development proxy and launcher were retired in #45. See the
[architecture and server retirement guide](docs/architecture.md).

## Structure and deployment

- `frontend/src/engine/math/`: BigInt arithmetic and optional bounded traces.
- `frontend/src/engine/encoding/`: OAEP/PSS, SHA/MGF1, AES, fingerprints and envelopes.
- `frontend/src/engine/keys/`, `worker.ts`, `client.ts`: key construction, worker execution and tab-local key ownership.
- `frontend/src/app/`, `components/`, `features/`: routes, theme and interactive screens.
- `reference/`: independent Python engine and reproducible public test fixtures.

See [Vercel setup](docs/vercel-deployment.md), [envelope v2](docs/envelope-v2.md),
[math contracts](docs/engine-contracts.md), [frontend structure](docs/frontend-structure.md)
and [contributing](CONTRIBUTING.md). Supabase project setup and database migrations are
documented in [supabase/README.md](supabase/README.md). Contacts/key import, lesson
pages, signatures and encrypted files run locally. Optional Supabase accounts and
sync are tracked separately in the GitHub roadmap (#25).
