# Python reference

`rsa_reference.py` is the preserved custom Python engine, independent of the new
TypeScript math. `backend/core.py` re-exports its API so the local server continues
to work. `generate_key(..., inverse_modulus="phi")` matches lecture notation;
the default remains `lambda` to preserve existing API behavior.

Run from the root using the project virtual environment:

```powershell
python -m reference.generate_vectors
python -m reference.generate_vectors --check
python -m reference.check_ts_outputs
python -m pytest -q
```

The committed fixtures are deliberately public test keys, generated with the
recorded `cryptography` version. OAEP-SHA256 ciphertexts and PSS-SHA256 signatures
(MGF1-SHA256, salt length 32) were produced by that independent library. Each run
verifies them again. Normal regeneration reuses these fixed randomized artifacts
and does not generate new keys or random signatures, so output is reproducible.
The initializer refuses to overwrite existing fixtures. Do not use these keys for
messages, user identities or any data requiring secrecy.

Arithmetic expectations use Python built-in `pow` and `math.gcd`. Fixed-base
Miller-Rabin examples are deterministic. Vectors include both 1024/2048-bit keys,
non-coprime messages, phi/lambda exponents, OAEP ciphertexts and PSS signatures.

## Public attack fixtures (#15, #46, #47)

`python -m reference.generate_attack_fixtures --check` validates the committed public
attack fixtures without changing keys. CI checks deterministic tiny semiprimes and uses
OpenSSL to validate the RSA key relationships/prime factors, sizes and coprimality.
Running the command without `--check` intentionally regenerates the public broadcast
keys and replaces that fixture file. Never use these demonstration keys for real data.
See [attack-lessons.md](../docs/attack-lessons.md) for lesson limits and verification.

## Interoperability in both directions (#6)

- **Python -> TypeScript:** `frontend/src/engine/rsa/rsa.test.ts` decrypts the
  library's OAEP ciphertexts and verifies its PSS signatures through the browser
  operations, and checks the textbook vectors.
- **TypeScript -> Python:** `frontend/src/engine/rsa/ts-outputs.test.ts` builds
  deterministic outputs of the TypeScript engine (fixed OAEP seed and PSS salt) and
  compares them with the committed `frontend/src/engine/__vectors__/ts-outputs.json`.
  `check_ts_outputs.py` verifies that file with `cryptography`: OAEP (raw and inside
  v2 envelopes), PSS, multi-block textbook envelopes, fingerprints and the lecture
  teaching key. CI runs both sides. After an intended engine change, refresh the
  file from `frontend` with `UPDATE_TS_OUTPUTS=1 npm run vectors:ts` (bash) or
  `$env:UPDATE_TS_OUTPUTS=1; npm run vectors:ts` (PowerShell), then rerun the checker.
