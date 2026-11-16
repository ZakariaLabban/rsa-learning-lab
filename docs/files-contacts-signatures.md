# Files, contacts and signatures

## Guest file exchange (#17)

Open **Encrypt / Decrypt → Files**. Choose a 1024/2048-bit recipient, select a file
(up to 25 MiB / 26,214,400 bytes), and optionally sign with a private key in the keyring.
Download the `.rsa` envelope and send it to the recipient. On receipt, upload it under
**Decrypt a file envelope**; the app selects the matching private key automatically.
Import your private key on the Keys page if this browser does not have it.

The existing v2 contract carries AES-256-GCM data with a fresh key/nonce, an RSA-OAEP-SHA256
wrapped 32-byte AES key, and optional inner RSA-PSS signature. File metadata is authenticated
in both header and payload. No plaintext download appears before tag and metadata checks pass.
Wrong keys and protected-field tampering report one generic decryption error; malformed
formats are rejected explicitly. Signature results remain distinct: unsigned, valid for a
known key, unknown sender, invalid. An invalid signature is visibly reported even when GCM
authentication succeeds; GCM authentication alone does not establish a sender's identity.

Heavy work, including base64/JSON parsing, runs in an isolated worker with Cancel and a
three-minute timeout. Input sizes are checked before reading/dispatch. Decrypted filenames
are normalized and files download as application/octet-stream; no HTML/image preview or
automatic execution is offered. Files, envelopes and plaintext are never saved to storage
or uploaded. The app buffers whole files: base64 and JSON copies require substantially more
memory than the original file, especially near the limit on phones. There is no streaming
format or production security claim.

Timings measure RSA key wrapping, AES-GCM (including Web Crypto key import), and total
worker computation (including encoding and optional signing). RSA-only time is an explicitly
labelled extrapolation from OAEP block capacity and the measured wrap, not a benchmark or
recommendation to use RSA on whole files. Animation time is excluded.

## Contacts and local public-key sharing (#16)

**Contacts** shares compact `rsa-lab-public-v2` text, `.pub` downloads and QR codes. Only
name, bits, n, e and the computed public fingerprint are included. Private values never
enter QR codes. Built-in Alice/Bob keys are labelled as public demonstrations.

Add contacts by paste, `.pub` upload, camera, or QR-image upload. Contact imports reject
private key-pair files. Existing key-file validators check the key and recomputed fingerprint.
QR scans populate the paste form for explicit import. No QR URL is fetched or followed.
Contacts reuse the shared keyring and immediately appear in recipient pickers.

Camera scanning uses BarcodeDetector when supported and a bundled `jsqr` fallback otherwise
(including native decoder errors/no match). Neither path uploads frames. Stop, route unmount,
successful scan, errors and late permission completion release camera tracks. Denied camera
access leaves paste, file and QR-image import available. QR generation/scanning libraries
load only when needed; no third-party script or network QR service is used.

Verification is manual: compare the entire fingerprint with its owner in person or over
a separately trusted channel, then acknowledge that comparison. A QR code/name does not
establish identity. Contacts may be renamed, deleted or marked unverified. Public contacts
persist under the existing versioned local keyring policy; private-key remembering remains
off by default and stores unencrypted data only after explicit opt-in.

Automated tests exercise 2048-bit QR decoding, a second mobile-size browser context, native
camera lifecycle, fallback image decoding and denied permissions. Actual optical scanning
between physical phones still needs a hardware smoke check; browser emulation does not
verify camera optics, focus or glare.

## Digital signatures lesson (#14)

**Signatures** shows Alice signing, the message hash/signature, and Bob verifying with a
selected public key. Real-size keys use RSA-PSS-SHA256 with 32-byte random salt. PSS is an
encoding and verification scheme, not simply encryption with a private key. Tamper controls
change the message/signature; a different public key demonstrates a failed check.

Teaching keys offer raw-number signatures and explicitly insecure hash-mod-n signatures.
The lecture key signs 88 and recovers 88. The collision example signs `16`, then verifies
`46` under n=187: both SHA-256 integers reduce to 24. This deliberately successful collision
does not imply PSS is broken. Private d stays hidden. Messages are bounded to 10,000 UTF-8
bytes; numeric/signature parsing is bounded before BigInt conversion. All flows are guest
features and require no account, backend or Supabase setup.

## Validation

Unit tests cover byte-exact file recovery including the 25 MiB boundary, protected-field
tampering, filenames, public-only QR payloads, 2048-bit QR decoding, PSS tampering/wrong keys
at both sizes, and the teaching collision. Playwright covers signed download/upload/recovery,
failed authentication with no download, cancellation, contact lifecycle and fingerprint
exchange between contexts, native scanner cleanup, permission denial, fallback image scanning,
signature lessons, and mobile layouts in both themes. Existing cross-language vectors stay
unchanged.
