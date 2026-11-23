# Runtime architecture and Python server retirement (#45)

Vercel delivers the built React/TypeScript app. The browser performs RSA key
generation, encryption/decryption, signatures and lesson calculations; expensive
operations run in cancellable workers. None of these guest operations calls a
Python server. The lecture view, animated workshop and Legacy lab share this
engine. Retiring the server does not retire the Legacy interface.

Supabase migrations and row-level security tests provide the database foundation
for optional accounts (#48), public-data sync (#22) and share links (#49). Those
client integrations are separate work. Private RSA components must not be synced.

## Start the app

From the repository root, with Node 22.13+ installed:

```powershell
Set-Location frontend
npm.cmd ci
npm.cmd run dev
```

Vite prints the local development address (normally `http://127.0.0.1:5173`). For
the production build, run `npm.cmd run build` and `npm.cmd run preview`; preview
normally uses `http://localhost:4173`. No Python, database, account or API proxy
is needed for guest features. Offline reopening requires a built app served once
online; see [offline.md](offline.md).

## Independent Python verification

`reference/rsa_reference.py` separately implements the math. Tests import it
directly, exercise both 1024/2048-bit sizes, and check interoperability with the
`cryptography` library. Committed public fixtures cross-check the TypeScript
engine in both directions; neither implementation's agreement alone proves
security. See [reference/README.md](../reference/README.md).

Python 3.11+ is required only for this development/CI work. From the repository
root, create a virtual environment and install the pinned test dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m reference.generate_vectors --check
.\.venv\Scripts\python.exe -m reference.generate_encoding_vectors --check
.\.venv\Scripts\python.exe -m reference.check_ts_outputs
```

CI still discovers the reference tests automatically with `pytest` and runs the
fixture checkers. Its historical required status name, `Python reference and API
checks`, stays unchanged to preserve branch protection; there are no API tests.

## Removed compatibility code

The former `backend/` package, `frontend/src/api.ts`, unused `useLegacySession`
hook, Vite `/api` proxy, `tests/test_api.py`, `start-lab.cmd`, and FastAPI/uvicorn/httpx
dependencies are removed. The `reference/` implementation, generators, fixtures,
arithmetic tests and independent interoperability checks remain.

The old experiment content is preserved at `/experiments` and in the animated
workshop at `/playground/experiments`.
The browser suite covers real 1024/2048-bit key generation and OAEP/textbook round
trips, reveal/hide, cancellation, repeated-encryption experiments, journey playback
and worked examples. Engine tests assert no `/api` requests, and the static
browser suite starts only Vite preview.

The custom cryptography is educational, unaudited and not constant-time. Use
demonstration data; moving calculations to a server would not itself establish
production cryptographic security.
