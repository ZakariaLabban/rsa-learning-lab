# Animated lessons

Every lesson and tool is available in the new interface. Open the directory on
`/playground`, or use the permanent routes below. Existing unprefixed URLs still
open their preserved Legacy screens. The header switch opens the same lesson in
the other interface where one existed; the new standalone Files tool returns to
Legacy Encrypt/Decrypt, which includes its Files tab.

| New route (after `/playground`) | Animated trace |
| --- | --- |
| `/learn/keys` | Prime product, totient, exponent check, inverse, key assembly |
| `/learn/miller-rabin` | Decomposition, actual residue sequence, witness verdict, strong-liar enumeration |
| `/learn/euclid` | Quotient/remainder divisions, Bézout coefficients, inverse or failure |
| `/learn/square-and-multiply` | Every square and selected multiply from the actual engine trace |
| `/learn/encrypt` | Actual number/text/OAEP/hybrid message journey and optional signing |
| `/learn/crt` | Partial products, inverses, weighted terms, modular sum and measured private decryption routes |
| `/learn/signatures` | Hash/representative, private operation, actual signature, public verification and verdict |
| `/learn/why-rsa-works` | Coprime check, both prime proof lanes, CRT conclusion and residue cycles |
| `/learn/practice` | Seeded questions, checked answers and animated solutions |
| `/break/factoring` | Initial actual trial divisors, bounded search summary, recovered factors/d/message |
| `/break/yes-or-no` | Actual textbook guesses, OAEP samples, equality results and reveal-gated OAEP masks |
| `/break/small-e` | Three recipient ciphertexts, CRT contributions, exact integer root and equality check |
| `/contacts` | Public components, serialization, fingerprint and trusted-comparison workflow |
| `/learn/example` | Adjustable complete 61×53 example, key setup and both expanded exponentiation traces |
| `/experiments` | Both actual ciphertexts per mode, equality and roundtrip results |
| `/files` | Actual AES-GCM nonce/ciphertext preview, wrapped AES key, envelope and authenticated recovery |

## Player and learning modes

Guide mode follows one calculation at a time and suggests the next lesson. Free
exploration opens the calculation map so any operation can be selected. Both
support play/pause, previous/next calculation, restart, speed, scrubbing inside
the current operation and exact-value inspection. Reduced motion replaces
continuous value movement with discrete states. Clocks stop on unmount and
pause while the browser document is hidden. Source tables remain available in
inspection drawers; Legacy tables and controls keep their original behavior.

The visual clock is separate from calculation/benchmark time. The trace adapter
reads the existing engine/worker results; it does not generate fictional
intermediate numbers. At most 128 calculations are displayed, with an explicit
notice if a middle section is omitted. Factoring similarly identifies omitted
trials rather than presenting animation duration as search time. Protocol
lessons visualize the real operation boundaries and available outputs; they do
not claim to expose every internal SHA-256/AES round or PSS salt byte.

Private-key operands, CRT details and sender-side OAEP randomness follow the
existing explicit Reveal controls. Practical message traces omit fields marked
private. File animations retain only small public metadata and a bounded
ciphertext prefix from the worker, avoiding a second main-thread parse of a
potentially large envelope. The AES key and private signing exponent are not
shown by these protocol animations.

## Routing and lifetime

`LessonExperienceProvider` scopes mode, speed and reduced motion to the new UI.
Shared lesson components render `LessonTrace` only in that context. `LessonLink`
keeps cross-topic navigation in the new interface without changing Legacy URLs.
Both shells share `LabThemeProvider` and the existing keyring/crypto engine.
Legacy remains mounted after visiting it, preserving its existing key session.
The new message workbench also stays mounted during new-lesson navigation;
its animations unmount while hidden, while the draft and computation results
remain. Other lesson forms reset on navigation. Switching to Legacy can reset
new lesson forms but does not remove shared keyring keys.

## Practice schema

Exercise generation uses a deterministic 32-bit PRNG **only for questions**, not
cryptographic randomness. An explicit seed and Intro/Exam difficulty reproduce
the same ten topics: modulus, RSA totient, private exponent, encryption,
decryption, inverse, modular power, Miller–Rabin base verdict, CRT and general
totient. Questions have stable IDs `practice.v1:<difficulty>:<seed>:<topic>`.

Progress uses localStorage key `rsa-lab-practice.v1`, version 1: attempts, correct
first attempts, current/best streak, per-topic attempts/correct and the last 128
graded IDs. Rechecking an ID does not add points. The UI highlights weak topics.
Invalid/unknown stored schemas are ignored, and storage failure leaves practice
usable in memory. No account or cloud sync is added. Deterministic seeds are
reproducible. `practiceAnswers.test.ts` proves every question type for 256 seeds
per difficulty (including 0 and 4294967295): it re-derives each answer from the
prompt text with independent brute-force/BigInt oracles (primality, φ by counting,
inverse and e·d ≡ 1 checks, modular powers, a strong-probable-prime test, CRT by
search), and checks that prompts and answers stay hand-solvable (< 10,000) and
that every worked solution ends at the graded answer.
