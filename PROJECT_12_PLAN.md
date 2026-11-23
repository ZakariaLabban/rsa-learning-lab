# Project 12 plan: RSA Learning Lab

> Historical proposal, retained for project history. The Python/FastAPI runtime,
> server key ownership and proposed file layout below are superseded by the
> browser implementation and server retirement (#45). For the current architecture
> and setup, use [README.md](README.md) and [docs/architecture.md](docs/architecture.md).

An interactive educational web application that implements RSA with 1024-bit and 2048-bit keys, explains the mathematics, and demonstrates how practical RSA differs from textbook RSA. The user has chosen a polished web interface with substantial animation and interaction.

## 1. What the course actually asks for

Source: `EECE 455-632 project list FALL 2026.pdf`, Project 12 on page 3 and the introduction on page 1.

- Project 12: "Implement RSA with key sizes of 1024 and 2048 bits."
- The introduction asks for a nice graphical user interface that is user friendly and suitable for educational purposes.
- Project approval is first come, first served, with one group per project. If selection has not already been approved, confirm the reservation.
- The document does not specify a programming language, permitted libraries, padding scheme, file support, signatures, report format, or grading rubric.

We will treat key generation, encryption, decryption, and a usable educational GUI as the completion target. Encryption and decryption are our interpretation of implementing RSA, rather than additional wording in the brief. Extensions below are proposals, not claimed course requirements.

No deadlines or group-size assumptions are used in this plan.

## 2. Recommended scope

Build **RSA Learning Lab**, with a clear progression:

1. **Required foundation:** our own RSA engine, both required key sizes, encryption/decryption, and a GUI that explains the results.
2. **Recommended standout version:** an interactive math explorer, textbook-versus-OAEP experiment, and a reproducible performance comparison.
3. **Optional capstone:** hybrid file encryption or digital signatures. Complete one well before considering the other.

The goal is a convincing cryptography project: explain the algorithm, prove it works, and demonstrate a meaningful limitation. Visual polish supports that goal.

## 3. Technology and implementation policy

### Recommended stack

| Component | Choice | Reason |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | Component-based browser interface with explicit interaction states |
| Styling | CSS design tokens; Tailwind if useful | Consistent typography, spacing, surfaces, and responsive layouts |
| Animation | Motion for React + SVG | Layout transitions, animated mathematical diagrams, and playback |
| Backend | Python + FastAPI | Keeps the readable custom RSA engine separate from browser presentation |
| Core mathematics | Our own Python modules | Makes the actual RSA implementation visible and explainable |
| Randomness | Python `secrets` | System-backed randomness for prime candidates and test bases |
| Hashing | Python `hashlib` | Standard hash implementations if we implement OAEP |
| Verification / optional practical features | `cryptography` | Independent interoperability checks, PEM support, OAEP, PSS, AES-GCM |
| Tests | `pytest` | Automated arithmetic, RSA, boundary, and interoperability checks |
| Charts | SVG or a React chart library, chosen when needed | Interactive plots based on actual measured results |

Use supported Python and Node releases compatible with the selected dependencies and pin the versions actually tested. Start with the browser and API running locally on the presentation laptop, without an internet dependency. Public hosting is optional and a separate deployment decision. No database or login is needed.

This is a local full-stack web app: RSA is computed in the Python backend. Do not describe it as browser-only or end-to-end encrypted. If public hosting is added, explicitly revisit private-key handling and isolate sessions rather than keeping a shared global key.

### Library boundary

The instructor's policy on cryptography libraries is unknown. Plan conservatively:

- Write prime generation, Miller-Rabin, extended Euclid, modular inverse, modular exponentiation, key construction, and textbook RSA operations ourselves.
- Do not present a call to `generate_private_key()` or `encrypt()` as our implementation of the required RSA engine.
- Keep any library-backed features in a separate adapter and identify them in the GUI and report.
- Use the library as an independent reference in development, subject to the course policy.
- Before finalizing library-dependent extensions, clarify whether library use is permitted for verification, serialization, padding, signatures, and AES.
- If all cryptography libraries are disallowed, the required foundation remains possible. OAEP can be implemented from RFC 8017 if standard hash functions are permitted; defer AES rather than expanding into another from-scratch cipher project.

The custom engine is an educational implementation. Practical library-backed demonstrations should use 2048-bit keys by default; retain 1024-bit support to meet the assignment and compare behavior. Do not claim that this application is a production security product.

## 4. Required foundation and acceptance criteria

| Capability | Planned behavior | Evidence of completion |
| --- | --- | --- |
| 1024-bit RSA | Generate a fresh key pair with a 1024-bit modulus | Assert `n.bit_length() == 1024`; complete encryption/decryption |
| 2048-bit RSA | Same workflow with a 2048-bit modulus | Assert `n.bit_length() == 2048`; complete encryption/decryption |
| Key generation | Show public key; reveal private components explicitly in the educational view | Check all key relationships and use independent verification |
| Encryption | Encrypt a valid integer or a short UTF-8 message | Known-answer test plus generated-key tests |
| Decryption | Recover the original integer or exact original bytes | Round trips at both required sizes |
| Educational interface | Explain inputs, public/private roles, and the stages of RSA | A new user can run the example without editing code |
| Validation | Reject invalid ranges, malformed ciphertext, missing keys, and oversized text | Clear GUI errors and negative tests |
| Responsiveness | Key generation does not freeze the window | Worker execution and visible progress/activity |

The baseline text flow is explicitly labeled **Textbook RSA - educational**. It is not a secure message format. OAEP is a separate enhancement, not an implied requirement from the PDF.

## 5. RSA engine design

### Key generation

1. Select modulus size `k` from 1024 or 2048.
2. Generate independent odd candidates for `p` and `q`, approximately `k/2` bits each, with their most significant bit set.
3. Eliminate obvious composites with small-prime trial division.
4. Apply Miller-Rabin using independently sampled bases. Start with a documented 64-round policy; explain that the test establishes probable primality.
5. Require `p != q`, calculate `n = p*q`, and retry if `n.bit_length() != k`.
6. Compute `phi = (p-1)*(q-1)` and `lambda_n = lcm(p-1, q-1)`.
7. Set `e = 65537`; require `gcd(e, lambda_n) == 1`, regenerating a prime if needed.
8. Use extended Euclid to calculate `d = e^(-1) mod lambda_n`.
9. Validate `(e*d) mod lambda_n == 1` and perform a small internal round-trip check.

Using Carmichael's lambda is deliberate and compatible with RSA. Display phi too, because many course explanations derive RSA using phi. Explain that a private exponent calculated modulo lambda can differ from one calculated modulo phi while remaining valid.

### Encryption and decryption

- Public key: `(n, e)`.
- Private components: `(n, d, p, q)`; treat `p` and `q` as private too.
- Encryption: `c = m^e mod n`, with `0 <= m < n`.
- Decryption: `m = c^d mod n`, with `0 <= c < n`.
- Implement square-and-multiply explicitly for educational traces. Compare its output against Python's modular `pow` in tests.
- Avoid computing the full integer `m**e` before reducing it.
- Provide a curated small-key example so the equations can be followed by hand. Tiny keys live in a separate learning mode and do not satisfy the required key sizes.

### Text and ciphertext representation

- Encode text as UTF-8 bytes, then convert bytes to a nonnegative integer using a documented byte order.
- For textbook text mode, preserve the original byte length in an explicitly educational, versioned envelope so leading zero bytes and empty text round-trip correctly.
- Enforce `m < n`; use a conservative text limit of `modulus_bytes - 1` bytes to make acceptance easy to explain.
- Represent ciphertext as exactly `modulus_bytes` bytes, including leading zero bytes, and show Base64 or hex for copying.
- Keep plaintext byte length separate from ciphertext length and validate it against reasonable bounds on import.
- Offer integer mode separately for mathematical boundary cases. Its recovered result is an integer, not guessed text.
- Do not silently split arbitrary messages into independent textbook RSA blocks. Long messages belong in the optional hybrid mode.
- A wrong private key in raw textbook mode does not reliably produce a detectable error; it can produce another valid integer. Explain this limitation instead of promising authentication.

## 6. GUI concept

Build an immersive browser workspace with a navigation rail, a central interactive diagram, and a contextual inspector. Use a deep ink background, warm-white text, and restrained cyan and amber accents to distinguish public and private operations. Combine a readable interface font with monospace numerical values. Color is reinforced with labels and icons.

The core visual object is a data packet: the user's message becomes UTF-8 bytes, then an integer, then ciphertext, then recovered plaintext. It moves through the same diagram across screens, making the application feel coherent.

Two modes share the actual engine: **Explore**, with explanations and playback, and **Workbench**, with compact controls and immediate results. The user can switch without losing the current example.

### Signature interaction: follow your message

1. Type a short message and see the actual UTF-8 bytes appear.
2. Generate keys and inspect the public/private branches.
3. Click Encrypt; the packet follows the encoding and exponentiation stages, showing computed values.
4. Pause, step backward, or inspect a stage; then continue to ciphertext.
5. Click Decrypt and follow the packet back to the recovered bytes and text.

Animations replay recorded results; they do not imply that large-number exponentiation works by individually scrambling characters. Changing an input invalidates stale results and starts a new run. Replaying a completed trace does not generate new keys or rerun the computation.

### Keys

- 1024 / 2048-bit selector, Generate button, activity indicator, elapsed time.
- Public components visible; private components hidden until deliberately revealed.
- Decimal/hex toggle and copy buttons, with expandable large-number fields.
- A compact key-generation timeline: candidates -> probable primes -> modulus -> exponent -> private exponent.
- Show honest activity or candidate counts; do not invent a percentage for unpredictable prime searches.

### Encrypt / Decrypt

- Integer or UTF-8 input mode.
- Clear public-key encryption and private-key decryption labels.
- Textbook mode label, input byte count, available capacity, ciphertext size, copy/reset buttons.
- Preset example with a one-click round trip.
- OAEP mode appears only after that extension is implemented and tested.

### Learn RSA

- Curated tiny-number example, alongside an option to inspect a real generated key.
- Expand `p`, `q`, `n`, phi, lambda, `e`, and `d` with explanations.
- Step through square-and-multiply for small examples.
- Alice -> public key -> encrypted message -> Bob's private key diagram.
- Explain why the public key can be shared and why revealing either prime compromises the private key.

### Experiments, added after the foundation

- Repeat-encryption comparison: textbook RSA versus OAEP.
- Measured 1024 / 2048 performance charts.
- Optional CRT comparison and a bounded tiny-key factorization demonstration.

Keep file encryption and signatures out of the interface until their implementations exist. The first complete build should already be coherent with only the first three views.

### Interaction and motion system

- Short control feedback, coordinated panel transitions, and user-controlled explanatory sequences.
- Play/pause, previous/next step, replay, and speed controls for educational traces.
- Hover or keyboard focus reveals concise explanations; clicking pins the detail in the inspector.
- Prime generation can show sampled candidate/test events with actual counts, without rendering every iteration or guessing a completion percentage.
- A toy-key factorization activity can let users select factors and see why their product recovers the modulus. Full-size keys are clearly separated from this activity.
- Reduced-motion preferences and a static step-by-step alternative preserve all information.
- Keep text stable while reading; reserve decorative effects for brief transitions. Avoid constant background motion and unnecessary 3D scenes.
- Present measured computation time separately from animation playback time.

### Visual development order

Create the design tokens and one polished vertical slice first: enter a message -> generate a real key -> encrypt -> inspect -> decrypt. Lock its visual and interaction quality before extending the same components to the other views. A static mockup may guide design, but production screens must expose loading, cancellation where supported, failure, empty, and success states from real operations.

## 7. Recommended extensions, in priority order

### A. Interactive mathematical explorer

**Value:** directly supports the course's educational aim.

Use the same core calculations as the working engine. Provide a short numeric example, explanations of modular inverse and exponentiation, and a revealable trace. Full-size keys get summaries; thousands of arithmetic steps should not overwhelm the display.

### B. Why padding matters: textbook RSA versus OAEP

**Value:** turns a functioning algorithm into a strong security lesson.

1. Encrypt the same plaintext twice using the same public key in textbook mode; the ciphertext repeats.
2. Encrypt it twice using RSA-OAEP; the randomized ciphertexts differ and both decrypt to the original.
3. Explain how deterministic encryption permits equality checks and guesses from a small candidate set.
4. Add tampered-ciphertext and wrong-key cases for OAEP with one generic decryption-failed message.

Use OAEP with SHA-256, MGF1-SHA-256, and an empty label. RFC 8017 gives the maximum plaintext size as `k - 2*hLen - 2` bytes. Derived capacities for SHA-256 are **62 bytes at 1024 bits** and **190 bytes at 2048 bits**. Count UTF-8 bytes, not characters. Test those boundaries and the first rejected length.

Implementation options: use an explicitly labeled library adapter, or implement OAEP and MGF1 ourselves if the policy and scope support it. A custom OAEP implementation must interoperate in both directions with an independent implementation. Do not describe custom Python arithmetic as constant time.

### C. Performance dashboard

**Value:** explains the practical consequences of choosing a larger key.

- Measure generation, encryption, and decryption separately for each key size.
- Use multiple independently generated keys; separate variability in key generation from repeated operations on one key.
- For operation timing, reuse pre-generated keys, exclude rendering and GUI overhead, warm up, and report median plus spread.
- Use the same payload and configuration when comparing sizes; record hardware, software versions, sample count, and backend.
- Keep custom-engine versus optimized-library results separate. Export the actual measurements.
- Do not invent expected runtimes or equate key length directly with security strength.

### D. CRT decryption

**Value:** demonstrates an optimization tied directly to course number theory.

Precompute `dp = d mod (p-1)`, `dq = d mod (q-1)`, and `qInv = q^(-1) mod p`. Compute `mp = c^dp mod p`, `mq = c^dq mod q`, then `h = qInv*(mp-mq) mod p` and `m = mq+h*q`. Check equality with ordinary decryption, include messages divisible by either prime, and benchmark on the same ciphertexts. Treat the measured speedup as a result, not a promise.

### E. Hybrid file encryption: optional capstone

**Value:** demonstrates why applications combine public-key and symmetric encryption.

Generate a fresh AES-256 key, encrypt the file with AES-GCM, and wrap only that AES key with RSA-OAEP. Store a versioned envelope containing algorithm identifiers, wrapped key, nonce, ciphertext, and tag. Authenticate relevant envelope metadata as associated data, validate lengths, and reject tampering without writing a final plaintext file. Use a fresh key and nonce for every file. Initially cap file sizes and use a vetted AES-GCM implementation; streaming and bespoke AES are outside scope.

This demonstrates confidentiality and ciphertext integrity, but does not establish the sender's identity. OAEP alone is not a signature. Choose this extension if the main presentation should focus on real-world application.

### F. RSA-PSS signatures: alternative capstone

**Value:** teaches authenticity as a different public-key operation.

Sign a message or file hash with a dedicated signing key, verify with its public key, then modify the message and show verification failure. Use RSA-PSS with SHA-256 and a documented salt-length policy. Explain signatures as a separate standardized scheme; avoid describing signing as simply encrypting with the private key. Choose this extension if the main presentation should focus on integrity and identity.

### G. Tiny-key attack sandbox: optional visual extra

Factor a deliberately tiny modulus and reconstruct its private key. Bound the key size and runtime. Label it as a demonstration of the mathematics; it is not evidence that the same routine can practically factor 1024-bit or 2048-bit keys.

Recommended stopping point: foundation + A + B + C. Add D if the mathematics is a priority. Add E or F only after that version is stable. Defer chat networking, blockchain, certificate authorities, and post-quantum algorithms; they do not help satisfy this brief efficiently.

## 8. Architecture and repository structure

Keep the GUI independent from arithmetic. A command-line smoke demonstration should be able to run the engine without opening a window.

```text
src/rsa_lab/
  core/
    arithmetic.py       # gcd, extended Euclid, inverse, square-and-multiply
    primes.py           # candidates, trial division, Miller-Rabin
    keys.py             # key structures, generation, validation
    rsa.py              # integer encryption/decryption; optional CRT
    encoding.py         # UTF-8, fixed-width integers, educational envelope
  services/
    experiments.py      # traces and comparisons
    benchmarks.py       # measurements, separate from rendering
  adapters/
    reference_crypto.py # optional library verification and practical schemes
  api/
    app.py              # FastAPI application
    routes.py           # key generation, encryption/decryption, traces
    jobs.py             # CPU workers and bounded job state
frontend/
  src/
    components/         # controls, panels, number displays, packet visuals
    features/           # keys, workbench, learning, experiments
    animation/          # playback state machine and trace timeline
    api/                # typed requests and progress updates
    styles/             # tokens, typography, layouts, reduced motion
tests/
examples/
docs/
results/
README.md
pyproject.toml
```

Add OAEP, files, signatures, and charts only when their milestone begins. Run CPU-heavy key generation in a process worker rather than blocking the API event loop. Start jobs with ordinary HTTP requests; poll bounded job status initially, adding server-sent events only if live trace delivery needs it. Benchmark work should not compete with prime generation. Keep keys in memory by default, avoid private material in normal logs, and label any deliberately exported educational secrets.

Transport large RSA integers as decimal or hexadecimal strings, never JavaScript JSON numbers. Use opaque session-scoped key identifiers for normal operation. Private components are returned only for an explicit educational reveal. Keep them out of browser persistent storage. Expire server-side jobs and keys, cap work queues, and use request/run identifiers so late results cannot overwrite a newer run. Bind the local backend to loopback by default.

The engine produces structured events with stage, explanation, input/output strings, and computation metadata. The frontend maps these into a finite set of playback states. Real-key events summarize expensive operations; toy-key traces expose individual steps. This separates correct computation from controllable visual playback.

## 9. Milestones and completion gates

| Milestone | Work | Gate before advancing |
| --- | --- | --- |
| 0. Scope | Record requirements, choose stack, document library uncertainty | A concrete checklist and explicit feature priorities |
| 1. Arithmetic | Inverse, exponentiation, primality tests, toy RSA | Known answers and negative cases pass |
| 2. Full-size engine | Generate exact 1024/2048 moduli; encrypt/decrypt | Tests pass at both sizes and agree with independent checks |
| 3. Required GUI | Key generation, input validation, encryption/decryption, explanations | Fresh user can complete both-size demos; UI stays responsive |
| 4. Foundation freeze | README, setup instructions, baseline screenshots and results | Required scope can be demonstrated from a clean environment |
| 5. Standout features | Explorer, OAEP comparison, benchmarks, then optional CRT | Each feature has a reproducible demonstration and correctness evidence |
| 6. Optional capstone | Hybrid files OR signatures | Tamper/failure cases work; no regression in the foundation |
| 7. Delivery | Report, presentation, demo rehearsal, package | Full presentation runs offline on the target machine |

If an extension becomes unreliable, remove it from the delivered UI and retain the passing foundation. Do not postpone correctness work until the end.

## 10. Validation plan

### Arithmetic and key construction

- Extended Euclid satisfies the Bezout identity; inverses reject non-coprime inputs.
- Square-and-multiply agrees with independent modular `pow` across varied inputs.
- Miller-Rabin handles values below 2, small primes, even composites, Carmichael numbers, and known pseudoprimes; control bases in tests so failure paths are reproducible.
- Generated primes are distinct, generated modulus length is exact, and the exponent relationships hold.
- Known toy fixture: `p=61`, `q=53`, `n=3233`, `e=17`, `d=2753`, `m=65`, `c=2790`. This fixture uses an inverse modulo phi; lambda-based generation may yield a different valid `d`.

### End-to-end behavior

- Both key sizes, across multiple independent generated keys.
- Integers `0`, `1`, `n-1`, and non-coprime messages such as `p`; reject `-1` and `n`.
- ASCII, Arabic, emoji, line breaks, empty bytes, and leading zero bytes.
- Exact ciphertext byte width even when its numeric representation starts with zeros.
- Malformed hex/Base64, incorrect ciphertext length, missing keys, and oversized inputs.
- Repeated encryption equality in textbook mode; randomized output in OAEP mode.
- OAEP maximum lengths, wrong keys, tampering, and malformed envelopes.
- For optional hybrid mode: byte-exact file recovery and rejection after changes to the wrapped key, nonce, ciphertext, tag, or authenticated metadata.
- For optional signatures: valid signature succeeds; changed message, changed signature, and wrong key fail.

Round trips alone are insufficient: a matching bug in encryption and decryption can cancel out. Use published specifications, known numeric answers, and independent cross-implementation tests. Different OAEP ciphertexts are expected because of randomness; compare recovery and interoperability rather than expecting byte-for-byte ciphertext equality.

### GUI and delivery checks

- No freeze during either key size's generation; controls cannot launch conflicting operations.
- Labels clearly identify key size, current backend, representation, and mode.
- Private fields remain hidden until explicitly revealed; copying data copies the selected value.
- Keyboard navigation, legible layout, clear recovery from invalid input, and no clipped large integers.
- Browser checks for keyboard/touch controls, reduced motion, narrow layouts, trace playback, stale requests, API errors, and both key sizes. Use end-to-end browser tests for the main round trip; keep arithmetic verification in Python tests.
- The documented setup and launch work in a fresh environment on the presentation machine without internet access.

## 11. Deliverables and presentation

These are recommended project deliverables; the PDF does not prescribe their format.

1. Source code with a short, repeatable setup and launch guide.
2. Automated tests and a concise record of which checks passed.
3. A requirement-to-feature table showing evidence for both required key sizes.
4. A report covering the RSA derivation, implementation decisions, encoding/padding, architecture, tests, measured results, and limitations.
5. Presentation slides with the public/private workflow, one small worked example, both-size evidence, and the strongest completed experiment.
6. An offline demo, plus screenshots or a short backup recording.
7. References and attribution for borrowed ideas, specifications, code, and libraries.

Suggested demo sequence:

1. Explain the public/private key roles using Alice and Bob.
2. Generate a 1024-bit pair; encrypt and recover a short message.
3. Repeat with a 2048-bit pair and show the actual modulus bit length.
4. Walk through the small-number example to prove understanding.
5. If implemented, repeat-encrypt under textbook RSA and OAEP to explain padding.
6. Show measured performance and one useful failure case.
7. Finish with the optional file or signature demonstration only if it is complete.

Prepare to explain why `n` must have exactly the selected bit length, why the exponent needs an inverse, why decryption also works for valid messages not coprime to `n`, why padding is needed, why RSA has message-size limits, why bigger RSA keys change runtime, and which parts we wrote ourselves.

## 12. First implementation steps

1. Create the package, dependency file, tests, and README.
2. Implement and verify arithmetic with the tiny RSA fixture.
3. Implement prime generation and exact-size key generation.
4. Demonstrate both key sizes in a small command-line program.
5. Add reversible byte encoding and input validation.
6. Build the required GUI around the tested engine.
7. Freeze a complete foundation before starting the recommended extensions.

## 13. Technical references

- Course brief: `EECE 455-632 project list FALL 2026.pdf`, pages 1 and 3.
- [RFC 8017: PKCS #1 v2.2](https://datatracker.ietf.org/doc/html/rfc8017): RSA key relationships and primitives, OAEP, PSS, integer/octet conversions. Primary technical reference for the schemes.
- [cryptography RSA documentation](https://cryptography.io/en/latest/hazmat/primitives/asymmetric/rsa/): reference implementation API, serialization, OAEP/PSS examples, key-size and exponent guidance. Pin a tested stable release when implementing; the latest documentation may describe development features.
- [Motion for React: layout animations](https://motion.dev/docs/react-layout-animations): interface transitions.
- [Motion configuration](https://motion.dev/docs/react-motion-config): reduced-motion behavior.
- [FastAPI concurrency and parallelism](https://fastapi.tiangolo.com/async/): CPU work versus asynchronous request handling.
- [Python secrets](https://docs.python.org/3/library/secrets.html): system-backed randomness.

Plan prepared from the supplied brief on October 22, 2026 and updated to the user's chosen interactive web-app direction. Language choice is unrestricted according to the user; the instructor's library policy remains unconfirmed.
