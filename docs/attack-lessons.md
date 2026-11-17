# Educational RSA attack lessons (#15, #46, #47)

These guest pages deliberately demonstrate misuse of RSA. All keys/messages are labelled
public test data. They never load visitors' personal keyrings, upload data, store attack
traces, or provide production-security assurances.

| Route | Demonstration |
| --- | --- |
| `/break/factoring` | Factor a tiny public modulus, reconstruct d and decrypt “HI” |
| `/break/yes-or-no` | Re-encrypt both possible textbook votes; compare fresh OAEP runs |
| `/break/small-e` | Public CRT + exact cube-root recovery for three e=3 recipients |

The routes and their worker are loaded on demand. `useAttack` terminates the worker on
cancel, input changes, replacement work, error, completion, timeout or unmount; stale
worker responses are ignored. The browser stays responsive during trial division.

## Factoring race

Bundled 16,20,24,28,32,40,48,52-bit semiprimes have public n,e,C and a declared two-byte
message length. Eve's `factorRace` receives only those public fields: it really tries odd
divisors from 3 up to √n and does not read a known factor or private exponent. On finding
distinct prime factors it computes φ(n), d=e^-1 mod φ(n), then recovers M and the bytes HI.
The default is a deliberately quick 16-bit example, verified on the presentation laptop.

Choose a 1,5 or 30-second search budget. The worker checks its clock every 256 trial
divisions and reports progress at most about ten times per second. Timeouts are ordinary
results with no claimed factors. A parent watchdog terminates a stuck worker after the
budget plus one second for worker script startup/delivery; that grace does not extend
the computation's search budget. Cancellation also terminates pending script loads.

Measurements cover only the trial-division search, excluding worker startup, key
reconstruction, decryption and rendering. The chart/table keep up to twelve session-only
runs. Timeout points are distinct lower bounds, not completed factorization times. Very
short searches may be below useful timer resolution. A deliberately rough estimate
uses the last completed run's observed division rate and a worst-case odd-divisor count
for another tiny 16–52-bit modulus. It is labelled as this algorithm on this browser and
hardware. It does not extrapolate an attack time for practical 1024/2048-bit RSA.

Modern large-integer factorization uses other algorithms, including the number field
sieve. No RSA-250/current record claim or universal device-speed guarantee is made.

## YES / NO equality guessing

The 1024/2048-bit public demo key and two known possible votes let Eve encrypt YES and NO
under textbook RSA and compare those ciphertexts with the intercepted one. The lesson
uses the same textbook/OAEP engine and same-message repeated-encryption experiment as
Existing experiments, which remains linked and available. Alice's side independently
decrypts the textbook ciphertext and every OAEP sample to confirm correctness.

Three same-vote OAEP samples and fresh YES/NO guesses use independent randomness. The
screen reports observed equality results without promising that random ciphertexts can
never collide. A fresh-encryption non-match cannot rule out a vote, so the deterministic
dictionary shortcut no longer works. It is not sender authentication or proof against
every possible attack.

The sender-only OAEP diagram shows actual values from a selected run: SHA-256 of an empty
label, zero padding, separator 01, message bytes, seed, both MGF1 masks, maskedDB,
maskedSeed, encoded block EM and ciphertext. Seeds are recovered from the sender's EM
for the teaching view, not injected through a production randomness override. Values are
hidden until explicitly revealed, then cleared on a changed run/sample. Eve's comparison
does not receive the sender's seed or EM. Sharing such a trace would change the threat
model; the page warns against sending it with messages. No trace or randomness is added
to practical message/file APIs, envelopes, logs, localStorage or cloud sync.

## Small-e broadcast

Three bundled, distinct 1024-bit moduli use e=3 and are pairwise coprime. The normal raw
message M is below every modulus. Thus M³ is below the product N=n1*n2*n3, and CRT recovers
the integer M³. `recoverBroadcast` receives only public keys and ciphertexts, checks
coprimality/range/exponents, reconstructs X, and accepts an integer root only if root³=X.

The guided UTF-8 message is long enough that M³ exceeds every individual modulus, so
the default example actually requires reconstruction rather than a direct root of one
ciphertext. Input is 1–61 UTF-8 bytes with no leading zero byte, keeping the integer-to-text
interpretation unambiguous and leaving room for the changed-message counterexample.

OAEP mode encrypts the same bytes with fresh independent randomness for each recipient;
all recipients decrypt correctly, while the common raw-M³ structure is absent. We report
whether the cube-root procedure recovered the original controlled message, rather than
equating a failed attack with general security. Failure controls separately show a shared
prime (explicit public gcd), a different third message, e=65537, and invalid M equal to a
modulus. They use textbook mode so each altered assumption can be isolated. e=65537
stops this particular three-recipient/e=3 procedure; textbook RSA stays deterministic.

Large CRT table values are abbreviated for readability; a recipient selector exposes the
actual computed partial products, inverses and terms through expandable/copyable fields.

## Fixtures and validation

`python -m reference.generate_attack_fixtures` creates the public bundle. It generates
1024-bit e=3 keys with the independent cryptography/OpenSSL library and reuses existing
reference/demo keys for the guessing lesson. Tiny semiprimes are generated deterministically.
`--check` validates the committed bundle without regenerating it; Python CI checks the
prime/key relationships, exact bit sizes, coprimality, ciphertexts and expected messages.
The warning explicitly states that private demonstration values are public source data.

Unit tests factor known small fixtures, verify d and plaintext, force a deterministic
deadline, check input bounds, confirm the OAEP XOR/MGF1 diagram against actual encoding,
recover both textbook votes at both sizes, validate public-only CRT recovery, and test
OAEP/counterexample paths. Browser tests exercise recovery, plots, cancellation/stale
work, a controlled worker clock for deterministic timeout coverage, actual sample traces,
all failure controls, keyboard operation and phone layouts in both themes. Production
has no clock overrides or artificial delays. Existing Python interoperability remains.

References:
- [Boneh, Twenty Years of Attacks on the RSA Cryptosystem](https://crypto.stanford.edu/~dabo/papers/RSA-survey.pdf), especially broadcast attacks and the distinction between the RSA function and a secure encryption scheme.
- [RFC 8017 §7.1](https://www.rfc-editor.org/rfc/rfc8017#section-7.1), RSAES-OAEP.
