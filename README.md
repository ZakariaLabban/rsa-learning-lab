# RSA Lab

A local, interactive RSA learning application for EECE 455/632, Project 12.

## Run on Windows

After the initial setup, double-click **start-lab.cmd** and open
[http://127.0.0.1:8765](http://127.0.0.1:8765). Keep its terminal open while using the lab.
The launcher only starts the local server; it does not install dependencies or expose it to the network.

### Initial setup

Use Python 3.11+ and a supported Node.js release compatible with Vite 6 (Node 22 works).
Run these commands in PowerShell from this project folder:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
Set-Location frontend
npm.cmd ci
npm.cmd run build
Set-Location ..
.\start-lab.cmd
```

The current workspace has already been set up and built. Serving the built application requires no internet. Fonts, icons, styles, and scripts are local assets.

### Development

Run the API in one terminal:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8765
```

Run Vite in another:

```powershell
Set-Location frontend
npm.cmd run dev
```

Open Vite's printed local address (normally port 5173). Vite proxies `/api` to the Python server. If Vite chooses a different port, use the standard port or explicitly add that local origin in `backend/app.py` before testing. Rebuild after frontend changes when using the Python-served production preview. Restart Python after backend changes.

## Implemented

- Exact 1024-bit and 2048-bit modulus generation using system randomness, small-prime filtering, and 64-round Miller-Rabin probable-prime tests.
- Custom extended Euclid, modular inverse, square-and-multiply, RSA key construction, integer primitives, and CRT decryption helper.
- Custom OAEP-SHA256 / MGF1-SHA256 encoding and decoding following RFC 8017.
- UTF-8 message encryption and byte-exact recovery, including empty text and leading zero bytes.
- Animated message journey with pause, replay, speed selection, and value inspection.
- Key Studio: public components, explicit private-component reveal, decimal/hex display, public JSON export, and session key history.
- Math Explorer: a six-stage worked example and a live tiny-integer square-and-multiply trace.
- Experiments: repeated textbook/OAEP encryption with actual decryption checks; active-key operation timing and JSON measurement export.
- Responsive layouts, keyboard-operable controls, and reduced-motion styling.
- A session-isolated FastAPI service, process-worker key generation, bounded job queues, and expiring in-memory keys.

The teaching example uses `p=61`, `q=53`, `e=17`, `d=2753`. It derives `d` modulo phi. Real generated keys use `e=65537` and the inverse modulo Carmichael's lambda. Both constructions are valid RSA.

## Architecture

```text
React / TypeScript / Motion / SVG
              |
       local HTTP API
              |
 FastAPI + process key workers
              |
       custom Python RSA
```

- `backend/core.py`: cryptographic mathematics, OAEP, and envelope encoding.
- `backend/app.py`: session/API lifecycle and frontend serving.
- `frontend/src/App.tsx`: interactive workspaces and playback.
- `frontend/src/styles.css`: responsive visual system.
- `tests/`: core, interoperability, and API checks.

## Validation

```powershell
.\.venv\Scripts\python.exe -m pytest -q
Set-Location frontend
npm.cmd run build
```

Tests cover both key sizes, non-coprime messages, arithmetic, a known RSA example, Unicode/empty/zero-prefixed byte strings, message-length boundaries, malformed inputs, repeated ciphertext behavior, session isolation, and real API key-generation jobs. OAEP is checked **in both directions** against the independent `cryptography` implementation. The application does not call that library for RSA computations; it is a test reference only.

## Encoding and limits

- OAEP-SHA256 accepts up to **62 bytes with 1024-bit keys** and **190 bytes with 2048-bit keys**.
- Textbook text mode conservatively accepts up to 127 or 255 bytes. It is deterministic and has no authentication. The original byte length is stored in the educational envelope.
- Ciphertext is exactly one RSA block; the hex preview is raw ciphertext, while **Copy envelope** copies the full versioned `rsa-lab.v1:` representation needed for decryption.
- A fingerprint in the envelope detects accidental key mismatch. It is not cryptographic authentication.
- Key values cross the API as strings to preserve integer precision.
- A refresh starts a fresh browser session. Keys are not saved; keep the current tab session for decrypting its envelopes. Up to eight keys are retained per session, with one-hour idle expiration.

## Scope and limitations

This is an educational application using demonstration data. The Python backend handles plaintext and private keys; this is not browser-only or end-to-end encryption. The server binds to loopback by default. Custom arithmetic/OAEP parsing is not constant time or audited for production use. 1024-bit RSA is retained for the assignment; 2048 bits is the default.

Animation duration is separate from computation time. Benchmark measurements exclude network and rendering, use five operations after one warm-up, and describe a single active key. Generation history contains individual observations; a controlled multi-key comparison is future work.

Not yet implemented: OAEP tampering activity, controlled cross-size benchmark campaigns, CRT visualization, hybrid file encryption, RSA-PSS signatures, key import/persistent private-key storage, and public hosting. The CRT helper is tested but not exposed as an experiment. Instructor library policy remains unconfirmed; the required RSA engine and OAEP are implemented here without delegating to a crypto library.

References: [RFC 8017](https://datatracker.ietf.org/doc/html/rfc8017), [Motion](https://motion.dev/docs/react), [FastAPI](https://fastapi.tiangolo.com/), and the course project PDF in this folder.
