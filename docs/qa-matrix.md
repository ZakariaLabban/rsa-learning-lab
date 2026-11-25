# Cross-browser QA matrix (#24)

This is the written test matrix for the v1.0 release candidate. Fill it in as features
are tested. Final sign-off reruns it against one exact commit. Roadmap: #25.

How to fill a cell: `✅` passed, `❌ #N` failed (link the bug issue), `⚠️` passed with a
known limitation (explain under [Accepted limitations](#8-accepted-limitations)), `—` not
applicable, empty = not tested yet. Write the date in the row note when you test.

## 1. Candidate under test

| Field                             | Value |
| --------------------------------- | ----- |
| Commit tested (full SHA)          |       |
| URL tested                        |       |
| CI run for that commit            |       |
| Tester(s)                         |       |
| Date range                        |       |
| GitHub sign-in enabled?           |       |
| Open release blockers at sign-off |       |

## 2. Automated suite

The automated suite runs in CI on every pull request and on `main`. Record the
run for the candidate commit here. The exact steps are in
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

| Check                                                                 | Covers                                                                 | Result |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------ |
| `lint`, `format:check`, `typecheck`                                   | Code quality                                                           |        |
| `npm test` (Vitest)                                                   | Engine, keyring, cloud sync, practice, lessons                         |        |
| `npm run test:browser` (Playwright, Chromium)                         | Lecture flows, accessibility, hardening, onboarding, offline           |        |
| Mocked Supabase `account.spec.ts`                                     | Sign-in, account isolation, cloud data deletion, share-link revocation |        |
| Backup interface build tests                                          | Retained Legacy/workshop regression                                    |        |
| Python reference tests, vector, encoding and TypeScript-output checks | Independent OAEP/PSS/fingerprint interoperability                      |        |
| Supabase `supabase test db`                                           | Schema and row-level security                                          |        |

Playwright runs Chromium only. Firefox, Safari and real phones are covered by the
manual matrix below.

### Pre-release run: commit `ca35779` (25 Nov 2026)

Run locally against the `main` commit above (#81), in addition to its passing CI run:

- lint, format check and typecheck: pass
- Vitest: 35 files, 211 tests passed
- Playwright (Chrome for Testing 153): 73 passed; the 9 skipped run in the mocked build
- Mocked Supabase account flows: 10 passed
- Backup interface build tests: 63 passed
- Python: 46 tests passed; all vector, encoding and TypeScript-output checks pass
- Supabase RLS tests: not run locally; passing in CI

This run is evidence that nothing is broken before manual QA. It is not the final
sign-off, which must use the candidate commit recorded in section 1.

## 3. Browsers and devices

Use current stable versions. Record the exact version and device in the table.

| ID  | Browser | Device / OS                           | Version | Tester |
| --- | ------- | ------------------------------------- | ------- | ------ |
| CH  | Chrome  | Windows or macOS desktop              |         |        |
| ED  | Edge    | Windows desktop                       |         |        |
| FF  | Firefox | Windows or macOS desktop              |         |        |
| SA  | Safari  | macOS desktop                         |         |        |
| IOS | Safari  | iPhone (real device)                  |         |        |
| AND | Chrome  | Mid-range Android phone (real device) |         |        |

If a browser is unavailable to the team, write that in the row and in
[Accepted limitations](#8-accepted-limitations). Do not leave it blank.

## 4. Display and accessibility settings

Desktop rows at 375 px use a resized window or device emulation; phone rows use the
real screen.

| Check                                                                                        | CH  | ED  | FF  | SA  | IOS | AND |
| -------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- |
| Light theme: every page readable, nothing cut off                                            |     |     |     |     |     |     |
| Dark theme: every page readable, nothing cut off                                             |     |     |     |     |     |     |
| 375 px wide: no sideways scrolling, menus and tables usable                                  |     |     |     |     |     |     |
| Keyboard only: Tab reaches every control, focus is visible, Escape closes guides and dialogs |     |     |     |     | —   | —   |
| Reduced motion turned on in the OS: animations stop or simplify                              |     |     |     |     |     |     |
| Browser zoom 200%: text reflows, no overlapping controls                                     |     |     |     |     | —   | —   |

## 5. Features

Each row names what to do and what must happen. Mark the result per browser.

### 5.1 Lessons and page guides

For each page: it opens from the course map, the page guide opens and can be skipped,
and the main example runs. Where the page ends with **Try a practice question →**, that
link opens the matching question.

| Page (route)                                                                          | CH  | ED  | FF  | SA  | IOS | AND |
| ------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- |
| Course map (`/`)                                                                      |     |     |     |     |     |     |
| The big picture (`/lecture/start`)                                                    |     |     |     |     |     |     |
| GCD (`/lecture/gcd`)                                                                  |     |     |     |     |     |     |
| Inverse mod m (`/lecture/inverse`)                                                    |     |     |     |     |     |     |
| Powers mod n (`/lecture/power`)                                                       |     |     |     |     |     |     |
| RSA by hand (`/lecture/rsa`)                                                          |     |     |     |     |     |     |
| Why it works (`/lecture/why`)                                                         |     |     |     |     |     |     |
| Signatures (`/lecture/signatures`)                                                    |     |     |     |     |     |     |
| Is n prime? (`/lecture/primality`)                                                    |     |     |     |     |     |     |
| Remainders (CRT) (`/lecture/crt`)                                                     |     |     |     |     |     |     |
| Factor n (`/lecture/factoring`)                                                       |     |     |     |     |     |     |
| Small e (`/lecture/small-e`)                                                          |     |     |     |     |     |     |
| YES or NO? (`/lecture/guessing`)                                                      |     |     |     |     |     |     |
| Practice questions (`/lecture/practice`)                                              |     |     |     |     |     |     |
| My keys (`/lecture/keys`): page guide only                                            |     |     |     |     |     |     |
| Contacts (`/lecture/contacts`): page guide only                                       |     |     |     |     |     |     |
| Messages and files (`/lecture/messages`): page guide only                             |     |     |     |     |     |     |
| Glossary: hover or tap an underlined term; its explanation and lecture reference show |     |     |     |     |     |     |
| An unknown address such as `/lecture/nope` shows the 404 page                         |     |     |     |     |     |     |

### 5.2 Keys, messages, files and signatures

Work on My keys (`/lecture/keys`) and Messages and files (`/lecture/messages`).

| Flow                                                                                                                                                                                                                                                        | CH  | ED  | FF  | SA  | IOS | AND |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- |
| **Generate a real key** tab: 1024- and 2048-bit keys are made; Cancel stops generation and the page stays responsive                                                                                                                                        |     |     |     |     |     |     |
| Download your key (`-PRIVATE.json`) and its public key (`.pub`). In another browser or profile, **Import a key file**: the `-PRIVATE.json` becomes your key and the `.pub` becomes a contact. (Re-importing in the same browser is ignored as a duplicate.) |     |     |     |     |     |     |
| Messages, **A message**, Method **RSA with OAEP padding**: encrypt for a contact and decrypt it; Arabic text and emoji come back exactly                                                                                                                    |     |     |     |     |     |     |
| With **RSA with OAEP padding**, a message too long for one block is explained and cannot be sent                                                                                                                                                            |     |     |     |     |     |     |
| Method **Hybrid (recommended)** with **Sign as** set: after decrypting, it shows "✓ Signed by" the sender's name                                                                                                                                            |     |     |     |     |     |     |
| Signed by a key that is not in your contacts: it shows "Signed by an unknown key"                                                                                                                                                                           |     |     |     |     |     |     |
| Change one character of an encrypted envelope and decrypt: it is rejected and no plaintext appears                                                                                                                                                          |     |     |     |     |     |     |
| **A file**: encrypt a file, download it, decrypt it; the recovered file is identical to the original                                                                                                                                                        |     |     |     |     |     |     |
| Decrypt with a key that cannot open it: a clear error appears and no partial output                                                                                                                                                                         |     |     |     |     |     |     |

### 5.3 Contacts and sharing between two devices

Use two different devices on Contacts (`/lecture/contacts`). Record the pair, the
commit and the date. Results from before the candidate commit are useful evidence but
must be rerun on the candidate for sign-off.

Creating a share link needs a signed-in account on device A. Opening one does not.

| Flow                                                                                                                                                 | Result on candidate | Devices, commit and date                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 2048-bit public-key QR: A shows it under **Share my public key**, B scans it with the camera under **Add a contact**; full fingerprints match        |                     | Earlier pass, to rerun: laptop at ~375 px → physical phone, `ca35779` at rsa-learning-lab.vercel.app, 25 Nov 2026 (#16) |
| Same QR check between two physical phones                                                                                                            |                     |                                                                                                                         |
| Camera permission denied: a clear message appears, and paste and upload still work                                                                   |                     |                                                                                                                         |
| Browser without BarcodeDetector (Firefox, Safari): the fallback scanner reads the QR                                                                 |                     |                                                                                                                         |
| Share link: on A press **Create public-key link** and copy it; on B paste it under **Add a contact**; B opens `/k/…` and imports; fingerprints match |                     |                                                                                                                         |
| QR link: on A press **Use link in QR**; B scans it, opens `/k/…` and imports; fingerprints match                                                     |                     |                                                                                                                         |
| On A press **Revoke link**; opening the link on B no longer resolves. A contact B already imported stays (expected, not a bug)                       |                     |                                                                                                                         |
| Add a contact by pasting text and by uploading a `.pub` file                                                                                         |                     |                                                                                                                         |
| Mark a contact verified only after comparing the full fingerprint; unverified contacts are flagged in the recipient picker                           |                     |                                                                                                                         |

### 5.4 Accounts, sync and privacy

Work on Account (`/account`) and Privacy (`/privacy`). If GitHub sign-in is turned off
on the candidate (`VITE_SUPABASE_GITHUB_ENABLED` is not `true`), mark the GitHub part
`—` and list it under [Accepted limitations](#8-accepted-limitations).

| Flow                                                                                                                                                                                                                                  | CH  | ED  | FF  | SA  | IOS | AND |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- |
| Guest use works with no account                                                                                                                                                                                                       |     |     |     |     |     |     |
| Sign in with **Send magic link** (and **Continue with GitHub** if enabled); after returning to the lab the account page shows the signed-in state                                                                                     |     |     |     |     |     |     |
| **Guest Data and Cloud Import**: **Keep my guest data on this device** leaves guest data local; **Review…** then **Import guest public data and sync** uploads public data only                                                       |     |     |     |     |     |     |
| Public keys, contacts and practice progress sync to a second device; private keys never appear there                                                                                                                                  |     |     |     |     |     |     |
| Delete a contact on one device; it is removed on the other, and an old open tab does not bring it back                                                                                                                                |     |     |     |     |     |     |
| Switch accounts in the same browser: no data from the first account is visible                                                                                                                                                        |     |     |     |     |     |     |
| **Sign out**: a warning appears first; after signing out, private keys held in memory and the account's cached data are gone from this browser                                                                                        |     |     |     |     |     |     |
| **Clear Local Data**: the button stays disabled until you type `CLEAR`; afterwards local keys, contacts and progress are gone                                                                                                         |     |     |     |     |     |     |
| **Delete My Cloud Data**: the button stays disabled until you type `DELETE`; afterwards cloud keys, contacts, progress and share links are gone, those links stop resolving, and sync shows as off. The sign-in and local data remain |     |     |     |     |     |     |
| Privacy page is reachable and matches what the app stores                                                                                                                                                                             |     |     |     |     |     |     |

### 5.5 Offline

| Flow                                                                                                                                                                | CH  | ED  | FF  | SA  | IOS | AND |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- |
| Visit once online, go offline, reload a deep link: the page opens; keygen, encrypt and decrypt work                                                                 |     |     |     |     |     |     |
| Offline, the account page and a `/k/…` share link show a connection message rather than an error                                                                    |     |     |     |     |     |     |
| New version: "A new version of RSA Lab is ready" appears; **Reload now** loads it. Keys held only in memory are cleared by the reload (the notice warns about this) |     |     |     |     |     |     |

To trigger a new version locally: run `npm run build` and `npm run preview` in
`frontend`, open the app once, then change any source file, build again, restart the
preview and return to the open tab.

**Local fallback** (no hosting, see [offline](offline.md)). Run once on one machine:
while online, run `npm ci` and `npm run build` in `frontend`. Then disconnect from the
internet, run `npm run preview`, open `http://127.0.0.1:4173`, generate a key, and
encrypt and decrypt a message.

| Result | Machine and browser | Commit | Date |
| ------ | ------------------- | ------ | ---- |
|        |                     |        |      |

## 6. 2048-bit key generation timing

Measure on a representative mid-range phone (required) and one desktop (for
comparison). On My keys, open the **Generate a real key** tab, choose Key size
**2048 bits**, and press **Generate a key**. Time each run with a stopwatch from the
press until the key appears (the on-screen counter shows whole seconds and disappears
when the key is made). Run five times; key generation is random, so times vary widely
between runs.

While one run is in progress, scroll the page and press **Cancel**: the page must stay
responsive and Cancel must stop the run without adding a key.

| Device and browser | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Median | Cancel and scrolling OK? |
| ------------------ | ----- | ----- | ----- | ----- | ----- | ------ | ------------------------ |
|                    |       |       |       |       |       |        |                          |
|                    |       |       |       |       |       |        |                          |

These timings describe the devices measured. They are not a speed guarantee for
other devices.

## 7. Bugs found

File each reproducible bug as a GitHub issue with the browser, device, steps and
expected result. Release blockers are bugs that lose or corrupt data, expose private
key material, produce wrong cryptographic results, or stop a v1.0 feature from working
on a supported browser.

| Issue | Summary                                                                                                    | Browser / device | Blocker? | Fixed in | Retested     |
| ----- | ---------------------------------------------------------------------------------------------------------- | ---------------- | -------- | -------- | ------------ |
|       | Privacy page says "Import and synchronization are currently unavailable", but both exist (found in review) | All              | No       | This PR  | Chromium e2e |
|       | `docs/offline.md` says accounts and share links do not exist yet (found in review)                         | —                | No       | This PR  | —            |

## 8. Accepted limitations

List anything the team decided to release with, and why. Examples: a browser the
team could not test, GitHub sign-in turned off, or a known slow device.

- _None yet_

## 9. Sign-off

Sign off only when all of these are true:

- [ ] Section 1 names one exact commit, and every result in this file is for that commit.
- [ ] Every v1.0 work item in #25 is complete, except #23, #24, #25 and #51.
- [ ] The full automated suite (section 2) passes on that commit, including #21's
      end-to-end and accessibility tests and #50's offline checks.
- [ ] Every row in sections 4 and 5 is filled for every browser it applies to, and the
      local fallback result is recorded.
- [ ] Section 6 has a mid-range phone measurement.
- [ ] No unresolved release blockers in section 7.
- [ ] Evidence and screenshots handed to #23 for the report.

Signed off by: ______________ Date: ______________
