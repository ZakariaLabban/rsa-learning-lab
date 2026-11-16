# Math engine contracts

`frontend/src/engine/math/index.ts` exports browser-compatible BigInt math; no
module requires React, network access, Python or a crypto library. Values are
BigInts, never JSON numbers. Worker structured cloning supports these values;
future JSON/envelope adapters must explicitly encode integers as strings.

| Function | Result / convention |
| --- | --- |
| `gcd`, `lcm`, `mod` | Nonnegative gcd/lcm and normalized positive-modulus residues |
| `bitLength`, `i2osp`, `os2ip` | Unsigned integers and fixed-width big-endian bytes; leading zero bytes are retained by I2OSP |
| `randomRange(min,max)` | Inclusive, rejection-sampled uniform CSPRNG range |
| `extendedGcd(a,b,options)` | gcd and Bezout x/y; each trace row q/r/s/t describes the next remainder, with a*s+b*t=r |
| `inverse(a,m)` | Normalized inverse; rejects m<=1 and non-coprime values |
| `squareAndMultiply(a,b,n,options)` | Left-to-right binary algorithm; i is the original bit position, c the accumulated exponent prefix, f the reduced accumulator, square the value before optional multiplication |
| `modexp(a,b,n)` | Value-only exponentiation; b>=0, n>=1, including exponent zero and modulus one |
| `millerRabin(n,options)` | Decomposition n-1=2^k*q, per-base sequences/verdicts, and actual random-round count; typed bases never count as random evidence |
| `probablePrime(n)` | Small-prime filtering followed by 64 random rounds by default |
| `generatePrime(bits,e)` | Prime-search primitive only; run substantial searches in the future worker (#42), never directly on the UI thread |
| `deriveKey(p,q,e)` | Internal RSA key relationships, d modulo phi by default; caller must validate primality before user-facing construction (#42) |
| `encryptInt`, `decryptInt`, `decryptCrt` | Range-checked raw RSA; CRT optionally exposes mp/mq/h recombination |
| `crt`, `crtResidues` | Pairwise-coprime lecture CRT and residue conversion; rejects non-coprime systems |
| `integerRoot`, `totient`, `strongLiars` | Exact floor root; bounded teaching totient; teaching strong-liar enumeration |

Use `{trace:true,maxRows:256}` for optional arithmetic traces. Traces retain a
bounded prefix; `rowCount` and `truncated` distinguish a summary from a complete
table. Miller-Rabin also bounds stored sequences. Large traces do not change the
computed answer. Prime searches/key construction/worker progress and cancellation are in #42;
OAEP/PSS encodings are in #4. Full capabilities/signature composition and
interop reporting remain #6.

The main app now uses the browser worker/client for key generation and message
operations. Python remains an independent test reference; its legacy local API
is retained until #45. Worker key generation is implemented in #42;
OAEP/PSS/AES/fingerprint/envelope helpers are documented in envelope-v2.md.
Reference vectors and tests include both 1024/2048-bit fixtures, messages divisible
by p/q, lecture Table 9.3, strong liars of 221 and the phi(1..30) table.

Specifications and references: [RFC 8017](https://datatracker.ietf.org/doc/html/rfc8017)
for RSA primitives and octet conversions; course Chapters 8 and 9 for trace notation.
