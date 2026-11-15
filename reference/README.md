# Python reference

`rsa_reference.py` is the preserved custom Python engine, independent of the new
TypeScript math. `backend/core.py` re-exports its API so the local server continues
to work. `generate_key(..., inverse_modulus="phi")` matches lecture notation;
the default remains `lambda` to preserve existing API behavior.

Run from the root using the project virtual environment:

```powershell
python -m reference.generate_vectors
python -m reference.generate_vectors --check
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
The TypeScript tests consume arithmetic/key vectors now. Full browser OAEP/PSS
consumption and reverse interoperability are issue #6, after the encodings in #4.
