# RSA Lab envelope v2

Status: implemented and tested in #43; independent AI review occurs through the PR.
This educational format is not an audited messaging protocol. All cryptographic
integers use unsigned big-endian bytes; JSON integer fields are bounded counts,
never RSA components. Base64 is RFC 4648 standard alphabet with canonical padding.

## Public-key identity

A fingerprint is SHA-256 over the concatenation of:

1. UTF-8 `rsa-lab.key.v2` followed by a NUL byte.
2. Four-byte big-endian length of n, then minimal unsigned big-endian n bytes.
3. Four-byte big-endian length of e, then minimal unsigned big-endian e bytes.

n and e are greater than one, e<n; neither integer has a leading zero byte.
The wire value is 64 lowercase hexadecimal characters. UI may group it into
four-character groups separated by spaces; spaces never appear in the wire value.
A fingerprint identifies a public key, not a person's verified identity.

## Outer envelope

Wire representation: `rsa-lab.v2:` followed by base64 of canonical UTF-8 JSON.
Canonical here means `JSON.stringify` of the validated object, in the field order
below, with no whitespace or unknown fields. Parsers reserialize and compare the
JSON, rejecting duplicate keys, alternate orders/whitespace and noncanonical base64.
The parser rejects v1 explicitly; recover the original data with the old app and
re-encrypt it. There is no automatic reinterpretation of old ciphertext.

Common fields, in order: `v` (2), `recipient` (fingerprint), `bits` (modulus bit
length), `kind`. Teaching key lengths are 4..64; assignment lengths are exactly
1024 or 2048. Each RSA ciphertext block has ceil(bits/8) bytes; numeric range
checks happen against the actual key before exponentiation. Received bits and
fingerprint must match the chosen key. OAEP and hybrid require 1024/2048 bits.

| Kind | Remaining fields, in canonical order |
| --- | --- |
| `textbook-blocks` | `blocks`: array of base64 RSA blocks; `byteLength`: original byte count |
| `oaep` | `ciphertext`: one base64 RSA block |
| `hybrid` | `wrappedKey`: one base64 RSA block; `nonce`: base64 12-byte GCM IV; `ciphertext`: base64 encrypted inner payload plus 16-byte GCM tag; `contentType`: `text` or `file`; optional `file` |

Textbook chunks are width-1 bytes, with a possibly shorter final chunk. The block
count is max(1,ceil(byteLength/(width-1))); empty data uses one encryption of zero.
Byte counts preserve leading zero bytes. At most 4096 textbook blocks are allowed.
The engine (`engine/rsa`, #6) produces and opens multi-block textbook envelopes.
Textbook RSA is deterministic and does not detect arbitrary tampering.

OAEP is RFC 8017 EME-OAEP using SHA-256, MGF1-SHA256 and empty label. Capacity is
width-66 bytes: 62 at 1024 bits and 190 at 2048. OAEP is not sender authentication.

Hybrid wraps a fresh 32-byte AES key with OAEP and encrypts the inner payload
using AES-256-GCM, a fresh 12-byte nonce and a 128-bit tag. The helper
`freshAesParameters()` generates a new key/nonce pair for each payload. Low-level
AES functions accept explicit key/nonce bytes to support composition and test vectors;
normal callers must never reuse the pair.

File metadata fields, in order: `name`, `type`, `size`. Name is 1..255 characters,
contains no control characters or slash/backslash; MIME type is at most 255
characters without controls. Size is an integer 0..25 MiB. File metadata is
required exactly when the content type is file. Downloads still need filename
normalization in the file UI (#17).

## Inner payload and signatures

Plaintext JSON, before hybrid encryption, has ordered fields:
`v` (2), `type` (`text` or `file`), `data` (base64 bytes), optional `file`,
optional `signature`. File size must match decoded data length. Unknown fields
and noncanonical JSON are rejected. File metadata must match the authenticated
outer metadata when hybrid composition is implemented in #44.

Signature fields: `algorithm` (`RSA-PSS-SHA256`), `sender` (fingerprint), `value`
(base64 RSA signature, 128 or 256 bytes). Signatures use SHA-256, MGF1-SHA256 and
exactly 32 bytes of random salt. EMSA-PSS uses emBits=modulusBits-1, including
correct handling when emLen differs from the RSA block width.

`signingBytes(payload,sender)` returns UTF-8 `rsa-lab.signature.v2` plus NUL,
followed by canonical JSON of the unsigned payload fields plus a final `signer`
object with `algorithm` and `fingerprint`. The signature itself is excluded.
Thus the signature binds the bytes, file metadata, algorithm and sender key.
The signed payload is then encrypted through hybrid mode; it is too large to fit
inside a single OAEP block. An unknown sender key is distinct from an invalid
signature and from a verified contact (#44).

## Authenticated additional data

`hybridAad(header)` returns UTF-8 `rsa-lab.aad.v2` plus NUL, then canonical JSON
of the outer envelope fields excluding `ciphertext`. The ordered fields are
`v`, `recipient`, `bits`, `kind`, `wrappedKey`, `nonce`, `contentType`, optional `file`.
The helper accepts the header before ciphertext exists. Receivers must validate
the full envelope separately, verify the GCM tag before releasing plaintext and
verify any inner signature afterwards. Outer and inner content type/file metadata
must agree. Ciphertext parsing alone does not authenticate anything.

## Limits and errors

Files/data are limited to 25 MiB; decoded inner payload/ciphertext to 40 MiB;
the complete text envelope to 64 MiB characters (covers base64 nesting). Counts,
UTF-8, versions, modes, encoded lengths, file metadata and unsupported fields are
validated before operations. Modified OAEP/GCM data and wrong-key decryption
produce generic failures. Explicitly exporting user private keys is separate
from this message format and remains #8; no private components belong in envelopes.

Reference: [RFC 8017](https://datatracker.ietf.org/doc/html/rfc8017).
