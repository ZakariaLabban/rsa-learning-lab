# Number theory lessons (#11 and #12)

Four guest routes now use the existing custom TypeScript math engine:

| Route | Lesson |
| --- | --- |
| `/learn/miller-rabin?n=221` | Decompose n−1, test typed/random bases, inspect actual residues, search strong liars |
| `/learn/why-rsa-works` | Euler argument for coprime messages, modulo-p/q + CRT proof for every message, residue explorer |
| `/learn/square-and-multiply` | Left-to-right Table 9.3 trace with playback and multiplication counts |
| `/learn/crt` | General CRT calculator and ordinary/CRT RSA decryption comparison |

The UI modules load on demand. `features/number-theory/model.ts` contains bounded, React-free
lesson adapters. `jobs.ts` dispatches typed worker requests, `worker.ts` runs computations,
and `useLesson.ts` terminates work on cancel, edits, restart, errors, timeout or unmount.
Responses are accepted only from the current worker. No arithmetic trace or private
benchmark value is uploaded or persisted by these pages.

## Miller–Rabin

The candidate can be supplied by `?n=` (including links from the key wizard). For odd n≥5,
the app decomposes n−1=2^k q and shows the tested base's actual sequence, starting at a^q
mod n and squaring until acceptance/failure. Typed bases must lie in 2…n−2. Zero/one,
2/3, and larger even numbers have explicit explanations without requesting an invalid
base. Passing means only that this run found no compositeness witness.

Random runs use independently drawn, uniformly distributed bases from the existing
rejection-sampling CSPRNG. For a fixed odd composite, all t random bases pass with
probability at most 4^-t. This is not a posterior probability that this candidate is prime.
Only random draws count; typing or deliberately replaying bases does not accumulate the
bound. Each run starts fresh. Accidental repeats from independent random draws are valid
sampling with replacement. Stop on a witness and report the actual number of rounds.

Find-passing-bases enumerates the full range for odd 5≤n≤10,000. For composite n these
passing bases are strong liars; for a prime, the UI explicitly avoids calling them liars.
The 221 example returns exactly 21,47,174,200. Candidate size is capped at 2048 bits;
random runs at 64 rounds; liar enumeration runs in a cancellable worker.

## Why RSA works

Typed teaching p/q/e are validated through the existing key constructor (distinct odd
primes, modulus ≤64 bits, valid e). This proof derives d modulo φ(n). Signed input M is
normalized modulo n before encryption and comparison. It displays e·d=1+kφ(n).

Euler's M^φ(n)≡1 argument appears only for gcd(M,n)=1. For every message, the separate
proof works modulo each prime: if M≡0, the recovered residue is zero; otherwise Fermat
applies because e·d−1 is divisible by that prime minus one. CRT then gives equality
modulo n. In particular, the classic M=88 under n=187 is non-coprime (gcd=11), and the UI
correctly uses the prime-residue proof. This is a correctness proof, not a security claim.

The residue explorer allows 2≤n≤10,000, computes φ(n), gcd and repeated powers, and shows
at most 64 rows while calculating the full final residue. Fermat/Euler conclusions are
displayed only when their coprimality conditions hold.

## Square-and-multiply

The trace preserves the existing engine's Table 9.3 convention: initialize c=0,f=1 mod n;
for each bit from left to right, square f and multiply by a for a one bit. Each row has
i,b_i,c,f, and the selected step separately shows the square and optional multiply.
All rows remain inspectable, with the current one highlighted. Playback uses the shared
Stepper, including reduced-motion handling.

7^560 mod 561 produces f values 7,49,157,526,160,241,298,166,67,1. The counter includes
10 squarings and 3 conditional multiplies. The naive comparison initializes to 1 and
performs b multiplications, so it counts 560; that slow loop is not executed. Exponent
zero requires no iterations and returns 1 mod n, including zero for n=1. Base/modulus
are bounded at 2048 bits; exponent at 256 bits, so the entire trace can be displayed.

## CRT and measured RSA decryption

General CRT accepts 1…8 pairwise-coprime moduli, each at most 128 bits, including composite
moduli. Negative inputs/residues are normalized. The reconstruction table shows each
partial product N_i, inverse y_i and term a_i N_i y_i, followed by their sum modulo N.
The lecture fixture has N=37×49=1813: 973↔(11,42), 678↔(12,41), and 1651↔(23,34).
The UI supports splitting A, reconstructing A, and reusing the normalized values.

The Alice-only comparison requires a full private key from the keyring or a generated
1024/2048-bit benchmark key. Public-only contacts cannot be selected. New benchmark keys
reuse the existing cancellable generation worker and remain tab-local. Their generation
time is excluded from decryption measurements. The 1024-bit option is assignment-only.

Both methods decrypt exactly the same raw RSA ciphertext. One warm-up pair is discarded;
five pairs are recorded with alternating execution order. Every result must match the
input message. Show medians and individual samples without asserting that CRT must be
faster on every browser. Timer precision/JIT/noise affect short runs. Timings exclude
encryption, key generation, UI rendering and animation; the traced recombination is
computed outside the measured loops. Private d,p,q,d_p,d_q,q-inverse and CRT intermediates
stay out of the DOM until the user explicitly reveals them, and can be hidden again.

The old OAEP benchmark in Existing experiments is replaced with a link to this comparison;
repeat-encryption demonstrations and key-generation history are retained.

## Verification and references

Unit tests match lecture traces, exhaustive liars, zero/negative/boundary inputs, proof
recovery for all 187 lecture residues, and both decryption paths for all lecture messages
plus non-coprime cases at 1024/2048 bits. Independent existing Python vectors remain
unchanged. Browser tests exercise actual worker flows, query parameters, probability
wording, steps, cancellation, generated keys, private-detail reveal and both mobile themes.

- Course Ch 8: number theory and primality; Ch 9: RSA, exponentiation Table 9.3 and CRT.
- [Handbook of Applied Cryptography §4.2.3](https://cacr.uwaterloo.ca/hac/about/chap4.pdf): Miller–Rabin.
- [Handbook of Applied Cryptography §14.5–14.6](https://cacr.uwaterloo.ca/hac/about/chap14.pdf): CRT and exponentiation.
