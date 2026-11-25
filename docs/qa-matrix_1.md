# Cross-browser QA matrix (#24)

This is the written test matrix for the v1.0 release candidate. Final sign-off reruns it
against one exact commit. Roadmap: #25.

How to read a cell: `✅` passed, `❌ #N` failed (bug issue linked), `⚠️` passed with a
known limitation (see [Accepted limitations](#8-accepted-limitations)), `—` not
applicable, `N/T` not tested (see the limitation named in the row). The **Evidence** column names
what produced each result; the codes are listed under [Evidence codes](#evidence-codes).

## 1. Candidate under test

| Field                             | Value                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Commit tested (full SHA)          | `902d3d8dc2859fe3319bbfc12e014427baa19351` (main after #82)                                                                           |
| URL tested                        | Local production build of that commit (`npm run build` + `npm run preview`). Vercel production deployment of the same commit: success |
| CI run for that commit            | [CI on main for 902d3d8](https://github.com/ZakariaLabban/rsa-learning-lab/actions/runs/45634955337): success                         |
| Tester(s)                         | Claude (automated runs and release sweep), ZoulfikarSh (two-device QR check)                                                          |
| Date range                        | 25 Nov 2026                                                                                                                           |
| GitHub sign-in enabled?           | Not checked on production; accounts tested with mocked Supabase only (L3)                                                             |
| Open release blockers at sign-off | None                                                                                                                                  |

### Evidence codes

- **CI**: the GitHub Actions run above (required checks for every merge).
- **E2E**: Playwright tests of the published lecture interface (`npm run test:browser`),
  run locally in Chrome for Testing 153 on 902d3d8: 73 passed, 9 skipped (those 9 run
  in the mocked build, below).
- **A11Y**: axe (WCAG 2.0/2.1 A and AA) on every page, the 404 page and the error page,
  in both themes at desktop width, and five pages at 375 px; keyboard and reduced-motion tests
  (`accessibility.spec.ts`).
- **ACC**: mocked Supabase account flows (`account.spec.ts`): 10 passed.
- **SHARED**: tests of shared components (QR scanner, file and signature flows) that
  run in the backup-test build (`playwright.backups.config.ts`). They drive the retained
  `/contacts` and `/learn/encrypt` screens, which use the same components as the
  published pages; their evidence is the passing CI run (see L5).
- **UNIT**: Vitest engine, keyring and sync tests (35 files, 211 passed). They run the
  same code the pages use, without a browser UI.
- **PY**: independent Python `cryptography` reference checks (46 passed; vectors,
  encodings and TypeScript outputs verified).
- **SWEEP**: release sweep on 902d3d8 in Chrome for Testing 153 (section 5.0).
- **TIME**: key-generation timing run (section 6).
- **DEV**: two-device check by a person.

## 2. Automated suite

| Check                                                                 | Covers                                                                 | Result on 902d3d8                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| `lint`, `format:check`, `typecheck`                                   | Code quality                                                           | ✅ CI and local                                   |
| `npm test` (Vitest)                                                   | Engine, keyring, cloud sync, practice, lessons                         | ✅ 35 files, 211 tests                            |
| `npm run test:browser` (Playwright, Chromium)                         | Lecture flows, accessibility, hardening, onboarding, offline           | ✅ 73 passed, 9 skipped (run in the mocked build) |
| Mocked Supabase `account.spec.ts`                                     | Sign-in, account isolation, cloud data deletion, share-link revocation | ✅ 10 passed                                      |
| Backup interface build tests                                          | Retained Legacy/workshop regression                                    | ✅ CI; ⚠️ locally 63 passed, 7 failed (L5)        |
| Python reference tests, vector, encoding and TypeScript-output checks | Independent OAEP/PSS/fingerprint interoperability                      | ✅ 46 passed; all checks pass                     |
| Supabase `supabase test db`                                           | Schema and row-level security                                          | ✅ CI                                             |

Playwright runs Chromium only. Firefox, Safari and real phones are not covered by
automation; see L1.

## 3. Browsers and devices

| ID  | Browser | Device / OS                           | Version                                          | Tester             |
| --- | ------- | ------------------------------------- | ------------------------------------------------ | ------------------ |
| CH  | Chrome  | Linux, headless (local and CI)        | Chrome for Testing 153; CI's Playwright Chromium | Claude (automated) |
| ED  | Edge    | Windows desktop                       | N/T (L1)                                         | —                  |
| FF  | Firefox | Windows or macOS desktop              | N/T (L1)                                         | —                  |
| SA  | Safari  | macOS desktop                         | N/T (L1)                                         | —                  |
| IOS | Safari  | iPhone (real device)                  | N/T (L1)                                         | —                  |
| AND | Chrome  | Mid-range Android phone (real device) | N/T (L1)                                         | —                  |

The two-device QR check in 5.3 used a laptop browser and a physical phone camera; the
phone model was not recorded.

## 4. Display and accessibility settings

| Check                                                                                        | CH  | ED  | FF  | SA  | IOS | AND | Evidence                                                                 |
| -------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ------------------------------------------------------------------------ |
| Light theme: every page readable, nothing cut off                                            | ✅  | N/T | N/T | N/T | N/T | N/T | A11Y (contrast), SWEEP                                                   |
| Dark theme: every page readable, nothing cut off                                             | ✅  | N/T | N/T | N/T | N/T | N/T | A11Y (contrast), SWEEP                                                   |
| 375 px wide: no sideways scrolling, menus and tables usable                                  | ✅  | N/T | N/T | N/T | N/T | N/T | SWEEP, E2E (course map on a phone; references contained at 375 px)       |
| Keyboard only: Tab reaches every control, focus is visible, Escape closes guides and dialogs | ✅  | N/T | N/T | N/T | —   | —   | A11Y (skip link, keyboard stepping, focus outline), E2E tabs, onboarding |
| Reduced motion turned on in the OS: animations stop or simplify                              | ✅  | N/T | N/T | N/T | N/T | N/T | A11Y (reduced motion), SWEEP                                             |
| Browser zoom 200%: text reflows, no overlapping controls                                     | ⚠️  | N/T | N/T | N/T | —   | —   | SWEEP at a 640 px CSS width (L4)                                         |

## 5. Features

### 5.0 Release sweep (Chrome, 902d3d8)

Every route below was loaded in 2 themes × 3 widths (375 px, 1280 px, and 640 px for
200% zoom) × reduced motion on and off: **240 page loads**. On each load the sweep
checked for sideways scrolling and for console or page errors. **Result: 240/240
passed.**

Routes: `/`, all 16 `/lecture/*` pages, `/account`, `/privacy`, and `/lecture/nope`,
which shows "Page not found", "Error 404" and links back to the course map.

### 5.1 Lessons and page guides

| Page (route)                                                  | CH  | ED  | FF  | SA  | IOS | AND | Evidence                                                                             |
| ------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ------------------------------------------------------------------------------------ |
| Course map (`/`)                                              | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (sixteen lessons in order; works on a phone), A11Y, SWEEP                        |
| The big picture (`/lecture/start`)                            | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (five-step animation), A11Y, SWEEP                                               |
| GCD (`/lecture/gcd`)                                          | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (lecture table, playback, check an answer), A11Y, SWEEP                          |
| Inverse mod m (`/lecture/inverse`)                            | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (550⁻¹ mod 1759 table; no-inverse case), A11Y, SWEEP                             |
| Powers mod n (`/lecture/power`)                               | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (Table 9.3), A11Y, SWEEP                                                         |
| RSA by hand (`/lecture/rsa`)                                  | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (88^7 mod 187 = 11; bad key choice), A11Y, SWEEP                                 |
| Why it works (`/lecture/why`)                                 | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (proof with real numbers), A11Y, SWEEP                                           |
| Signatures (`/lecture/signatures`)                            | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (verify; forged message rejected), A11Y, SWEEP                                   |
| Is n prime? (`/lecture/primality`)                            | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (Miller–Rabin lecture examples), A11Y, SWEEP                                     |
| Remainders (CRT) (`/lecture/crt`)                             | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (rebuild A; faster decryption), A11Y, SWEEP                                      |
| Factor n (`/lecture/factoring`)                               | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (12-digit key factored), A11Y, SWEEP                                             |
| Small e (`/lecture/small-e`)                                  | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (three ciphertexts, e = 3), A11Y, SWEEP                                          |
| YES or NO? (`/lecture/guessing`)                              | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (textbook repeats, OAEP differs), A11Y, SWEEP                                    |
| Practice questions (`/lecture/practice`)                      | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (wrong answer, hint, steps, correct answer), A11Y, SWEEP                         |
| My keys, Contacts, Messages and files: page guides            | ✅  | N/T | N/T | N/T | N/T | N/T | Onboarding (every lesson's guide spotlights its own controls)                        |
| Page guides: skip, opt-out, replay, keyboard, blocked storage | ✅  | N/T | N/T | N/T | N/T | N/T | Onboarding (skip, opt-out, replay, keyboard, blocked storage; 375 px light and dark) |
| Practice links at lesson ends open the matching question      | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (try-it link test)                                                               |
| Glossary words list and lecture references on every lesson    | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (words list on every lesson; references contained at 375/1280/1920 px)           |
| An unknown address such as `/lecture/nope` shows the 404 page | ✅  | N/T | N/T | N/T | N/T | N/T | Hardening (404 with a way back, noindex), A11Y, SWEEP                                |

### 5.2 Keys, messages, files and signatures

| Flow                                                                                                    | CH  | ED  | FF  | SA  | IOS | AND | Evidence                                                                                                  |
| ------------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | --------------------------------------------------------------------------------------------------------- |
| **Generate a real key**: 2048-bit keys are made; Cancel stops generation; the page stays responsive     | ✅  | N/T | N/T | N/T | N/T | N/T | TIME (5 runs; 10/10 cancels added no key; worst frame gap 18 ms), E2E (offline 1024-bit keygen)           |
| Key files: `-PRIVATE.json` and `.pub` round-trip between two keyrings; bad files rejected with a reason | ⚠️  | N/T | N/T | N/T | N/T | N/T | UNIT (keyring file round trip; bad files) (L7)                                                            |
| OAEP message encrypted for a contact and decrypted; Arabic text and emoji come back exactly             | ⚠️  | N/T | N/T | N/T | N/T | N/T | E2E (Hybrid method, Arabic: "Meet at 5 · مرحبا"), UNIT (Arabic and emoji with OAEP and textbook), PY (L7) |
| A message too long for OAEP is explained and cannot be sent                                             | ✅  | N/T | N/T | N/T | N/T | N/T | E2E                                                                                                       |
| Signed message shows "✓ Signed by … valid"                                                              | ✅  | N/T | N/T | N/T | N/T | N/T | E2E                                                                                                       |
| Signer not in contacts shows "Signed by an unknown key"                                                 | ⚠️  | N/T | N/T | N/T | N/T | N/T | UNIT (receiver who does not know the signer), SHARED (unknown signer becomes verified) (L7)               |
| An altered envelope is rejected and no plaintext appears                                                | ✅  | N/T | N/T | N/T | N/T | N/T | UNIT (any altered field fails without plaintext; AES-GCM rejects altered data), SHARED in CI (tampering)  |
| A file is encrypted and decrypted again                                                                 | ✅  | N/T | N/T | N/T | N/T | N/T | E2E, UNIT (empty, Unicode and binary files at 1024 and 2048 bits)                                         |
| A key that cannot open the message gives a clear error and no output                                    | ⚠️  | N/T | N/T | N/T | N/T | N/T | UNIT (needs the matching private key; says who can decrypt) (L7)                                          |

### 5.3 Contacts and sharing between two devices

| Flow                                                                                               | Result | Devices, commit and date / evidence                                                                                              |
| -------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 2048-bit public-key QR shown on A and scanned by B's camera; full fingerprints match               | ⚠️     | DEV: laptop browser at ~375 px → physical phone camera, production at `ca35779`, 25 Nov 2026 (#16). Not repeated on 902d3d8 (L2) |
| Same QR check between two physical phones                                                          | N/T    | L1                                                                                                                               |
| 2048-bit QR read by the bundled fallback decoder in a second mobile-size browser; same fingerprint | ✅     | SHARED (fallback import in a second mobile browser context)                                                                      |
| Camera permission denied: useful message and fallback; camera tracks stop after a scan             | ✅     | SHARED (native QR camera path)                                                                                                   |
| Share link created, imported by a guest, then revoked; the revoked link stops resolving            | ⚠️     | ACC (mocked Supabase; L3)                                                                                                        |
| QR link (**Use link in QR**) scanned on a second device                                            | N/T    | L1, L3                                                                                                                           |
| Add a contact from pasted public-key text, then verify it                                          | ✅     | E2E (Contacts: add a public key, then verify)                                                                                    |
| Deleting a selected contact during navigation clears it as a file recipient                        | ⚠️     | SHARED in CI, retained Legacy file recipient only (L5)                                                                           |

### 5.4 Accounts, sync and privacy

| Flow                                                                                                | CH  | ED  | FF  | SA  | IOS | AND | Evidence                                                                            |
| --------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ----------------------------------------------------------------------------------- |
| Guest use works with no account                                                                     | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (every lecture test runs as a guest)                                            |
| Sign-in callback completes only on the account route; an expired link shows a recoverable error     | ⚠️  | N/T | N/T | N/T | N/T | N/T | ACC (mocked; L3)                                                                    |
| Guest data: an explicit guest choice is honoured; only approved public fields can be imported       | ⚠️  | N/T | N/T | N/T | N/T | N/T | ACC (mocked; L3), UNIT (guest data never includes private components)               |
| Sync: first sync, server revision wins, deleted records stay deleted, another tab's contact is kept | ⚠️  | N/T | N/T | N/T | N/T | N/T | UNIT (cloudSync, cloudSyncRunner), RLS tests in CI (L7)                             |
| Account switching on a shared browser keeps data isolated                                           | ⚠️  | N/T | N/T | N/T | N/T | N/T | ACC (isolates account changes; mocked, L3), UNIT (localDataIsolation, accountCache) |
| Sign-out warns before discarding a temporary private key                                            | ⚠️  | N/T | N/T | N/T | N/T | N/T | ACC (mocked; L3)                                                                    |
| Clear Local Data: clears progress across open tabs and keeps other preferences                      | ⚠️  | N/T | N/T | N/T | N/T | N/T | ACC (mocked, L3), UNIT (purges only the cleared account)                            |
| Delete My Cloud Data: deletes only after explicit confirmation                                      | ⚠️  | N/T | N/T | N/T | N/T | N/T | ACC (mocked; L3), RLS tests in CI                                                   |
| Account-deletion request goes to the configured administrator mailbox                               | ⚠️  | N/T | N/T | N/T | N/T | N/T | ACC (mocked; L3)                                                                    |
| Privacy page is reachable and matches what the app stores                                           | ✅  | N/T | N/T | N/T | N/T | N/T | SWEEP (loads); text reviewed in #82                                                 |

### 5.5 Offline

| Flow                                                                                           | CH  | ED  | FF  | SA  | IOS | AND | Evidence                    |
| ---------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | --------------------------- |
| Visit once online, go offline, reload deep links: pages open; keygen, encrypt and decrypt work | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (offline spec)          |
| A new version waits for the user (**Reload now**), then replaces the old cache                 | ✅  | N/T | N/T | N/T | N/T | N/T | E2E (offline spec)          |
| Offline, the account page and a `/k/…` link show a connection message                          | N/T | N/T | N/T | N/T | N/T | N/T | Confirmed in code only (L6) |

**Local fallback** (no hosting): the offline E2E test builds the app, serves it with
`vite preview` on localhost, installs it, and then works offline. This release run
did the same: `npm ci` and `npm run build` online, then every browser test against
the local preview server.

| Result | Machine and browser                           | Commit  | Date        |
| ------ | --------------------------------------------- | ------- | ----------- |
| ✅     | Linux, Chrome for Testing 153 (local preview) | 902d3d8 | 25 Nov 2026 |

## 6. 2048-bit key generation timing

Time from pressing **Generate a key** until the key appears in the list (automated,
5 runs). Key generation is random, so times vary between runs.

| Device and browser                                            | Run 1  | Run 2  | Run 3  | Run 4  | Run 5  | Median | Cancel and scrolling OK?                                              |
| ------------------------------------------------------------- | ------ | ------ | ------ | ------ | ------ | ------ | --------------------------------------------------------------------- |
| Linux desktop, 2 CPU cores, Chrome for Testing 153 (headless) | 0.73 s | 0.61 s | 0.49 s | 0.51 s | 0.48 s | 0.51 s | ✅ 10/10 cancels added no key; worst frame gap while scrolling: 18 ms |
| Mid-range phone                                               | N/T    | N/T    | N/T    | N/T    | N/T    | N/T    | N/T (L1)                                                              |

Chrome's CPU throttling slows only the page, not the key-generation worker, so it
cannot stand in for a phone; no throttled figure is reported. These timings describe
the device measured and are not a speed guarantee for other devices.

## 7. Bugs found

| Issue | Summary                                                                                                    | Browser / device | Blocker? | Fixed in | Retested |
| ----- | ---------------------------------------------------------------------------------------------------------- | ---------------- | -------- | -------- | -------- |
| —     | Privacy page said "Import and synchronization are currently unavailable", but both exist (found in review) | All              | No       | #82      | Reviewed |
| —     | `docs/offline.md` said accounts and share links did not exist yet (found in review)                        | —                | No       | #82      | —        |

No other bugs were found. The local backup-build failures are environment differences,
not app bugs (L5).

## 8. Accepted limitations

Accepted by ZoulfikarSh for the team on 25 Nov 2026, so that #24 can close on the
automated and Chromium evidence above.

- **L1. Browsers and devices not tested:** Edge, Firefox, Safari (macOS), iOS Safari,
  Android Chrome, phone-to-phone QR, QR-link scanning on a second device, and 2048-bit
  keygen timing on a mid-range phone. Desktop Chrome with a visible window on Windows or macOS was not run either; all results above come from headless Chromium on Linux. Edge uses
  the same engine as Chrome. Firefox and Safari have no BarcodeDetector and use the
  bundled QR fallback decoder, which is tested in Chromium (SHARED).
- **L2. Two-device QR** was checked by a person on production at `ca35779`, one commit
  before the candidate. #82 changed only documentation and the Privacy page text, not
  the QR or contacts code.
- **L3. Accounts and share links** were tested against mocked Supabase plus the real
  schema and RLS tests in CI, not by signing in on production. GitHub sign-in on
  production was not checked.
- **L4. 200% zoom** was approximated with a 640 px CSS viewport, which is what 200%
  zoom of a 1280 px window produces.
- **L5. Backup-build tests:** 7 of 70 failed locally in Chrome for Testing 153 (six
  phone-width overflow checks on the unpublished Legacy/workshop screens, and one Arabic
  download filename) and all pass in CI. Those screens are not deployed.
- **L6. Offline messages** for the account page ("You are offline…") and `/k/…` links
  ("Check your connection and reload") were confirmed in the code, not run offline.
- **L7. Logic tested without a browser UI:** these rows are backed by unit tests of
  the same code the pages call (and, where named, by CI tests of the retained screens),
  not by a browser test of the published page.
- **Open roadmap items:** #1 (professor requirements) and #41 (name and custom domain)
  are still open. This sign-off covers the app as deployed at
  rsa-learning-lab.vercel.app; a later policy or domain change should rerun section 2
  and the 5.0 sweep.

## 9. Sign-off

- [x] Section 1 names one exact commit, and every result in this file is for that commit
      (except the DEV QR check; see L2).
- [ ] Every v1.0 work item in #25 is complete, except #23, #24, #25 and #51. **#1 and
      #41 remain open; accepted in section 8.**
- [x] The full automated suite (section 2) passes on that commit, including #21's
      end-to-end and accessibility tests and #50's offline checks.
- [x] Every row in sections 4 and 5 is filled for every browser it applies to, and the
      local fallback result is recorded (untested browsers marked N/T under L1).
- [ ] Section 6 has a mid-range phone measurement. **Accepted under L1.**
- [x] No unresolved release blockers in section 7.
- [x] Evidence handed to #23: this file is the QA evidence for the report.

Signed off by: ZoulfikarSh, with the accepted limitations in section 8. Date: 25 Nov 2026
