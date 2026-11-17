/**
 * Hover/focus explanations shown by `<Term>`. Notation follows the course slides:
 * M = plaintext, C = ciphertext, PU = {e, n}, PR = {d, n}, φ(n) = (p−1)(q−1).
 * References: course Ch 8 (number theory and primality) and Ch 9 (RSA), plus the
 * standard that defines each practical building block.
 */
export const glossary = {
  modulus: {
    name: 'Modulus',
    explanation: 'The public number n = p × q. RSA calculations take remainders modulo n.',
    reference: 'Ch 9 · RSA key setup',
  },
  publicKey: {
    name: 'Public key',
    explanation: 'The pair (n, e), shared to encrypt a message or verify a signature.',
    reference: 'Ch 9 · RSA',
  },
  privateKey: {
    name: 'Private key',
    explanation:
      'The private exponent d and secret factors p and q. These allow decryption and signing.',
    reference: 'Ch 9 · RSA',
  },
  oaep: {
    name: 'OAEP',
    explanation:
      'Randomized encoding applied before RSA encryption. It is different from a signature.',
    reference: 'Ch 9 · practical RSA; RFC 8017 §7.1',
  },
  probablePrime: {
    name: 'Probable prime',
    explanation:
      'A number that passes primality tests. Passing random Miller-Rabin rounds gives evidence rather than a proof.',
    reference: 'Ch 8 · primality testing',
  },
  plaintext: {
    name: 'Plaintext',
    explanation:
      'The message M before encryption. Textbook RSA needs it as an integer with 0 ≤ M < n.',
    reference: 'Ch 9 · RSA',
  },
  ciphertext: {
    name: 'Ciphertext',
    explanation: 'The encrypted message C = M^e mod n. Only the private key turns it back into M.',
    reference: 'Ch 9 · RSA',
  },
  publicExponent: {
    name: 'Public exponent',
    explanation:
      'The number e in PU = {e, n}. It must satisfy gcd(e, φ(n)) = 1; 65537 is the usual choice.',
    reference: 'Ch 9 · RSA key setup',
  },
  privateExponent: {
    name: 'Private exponent',
    explanation:
      'The number d in PR = {d, n}, the inverse of e: e·d ≡ 1 (mod φ(n)). It undoes encryption.',
    reference: 'Ch 9 · RSA key setup',
  },
  totient: {
    name: 'φ(n)',
    explanation:
      'Euler’s totient: how many numbers from 1 to n are coprime to n. For n = p × q it is (p−1)(q−1).',
    reference: 'Ch 8 · Euler’s totient function',
  },
  carmichael: {
    name: 'λ(n)',
    explanation:
      'Carmichael’s function, lcm(p−1, q−1) for RSA. A d computed modulo λ(n) is also valid and can be smaller.',
    reference: 'Ch 9 · RSA; RFC 8017 §3.2',
  },
  gcd: {
    name: 'gcd',
    explanation:
      'Greatest common divisor: the largest number dividing both inputs. Euclid finds it by repeated remainders.',
    reference: 'Ch 8 · number theory',
  },
  coprime: {
    name: 'Coprime',
    explanation: 'Two numbers are coprime (relatively prime) when their gcd is 1.',
    reference: 'Ch 8 · number theory',
  },
  modularInverse: {
    name: 'Modular inverse',
    explanation:
      'a⁻¹ mod m is the number x with a·x ≡ 1 (mod m). It exists exactly when gcd(a, m) = 1.',
    reference: 'Ch 8 · number theory',
  },
  extendedEuclid: {
    name: 'Extended Euclid',
    explanation:
      'Euclid’s gcd algorithm, also tracking how each remainder is built from the inputs. The last step gives the inverse.',
    reference: 'Ch 8 · number theory',
  },
  fermat: {
    name: 'Fermat’s little theorem',
    explanation: 'If p is prime and p does not divide a, then a^(p−1) ≡ 1 (mod p).',
    reference: 'Ch 8 · Fermat’s theorem',
  },
  euler: {
    name: 'Euler’s theorem',
    explanation:
      'If gcd(a, n) = 1, then a^φ(n) ≡ 1 (mod n). It is why decryption undoes encryption.',
    reference: 'Ch 8 · Euler’s theorem',
  },
  millerRabin: {
    name: 'Miller–Rabin',
    explanation:
      'A randomized primality test. A witness proves n composite; each passing base makes primality more likely.',
    reference: 'Ch 8 · primality testing',
  },
  strongLiar: {
    name: 'Strong liar',
    explanation:
      'A base that passes Miller–Rabin for a composite n. At most a quarter of bases can be liars.',
    reference: 'Ch 8 · primality testing',
  },
  squareAndMultiply: {
    name: 'Square-and-multiply',
    explanation:
      'Fast modular exponentiation: read the exponent bit by bit, square each step and multiply on 1 bits.',
    reference: 'Ch 9 · Table 9.3',
  },
  crt: {
    name: 'Chinese remainder theorem',
    explanation:
      'For pairwise-coprime moduli, residues modulo each one determine a unique number modulo their product.',
    reference: 'Ch 8 · CRT; Ch 9 · RSA decryption',
  },
  textbookRsa: {
    name: 'Textbook RSA',
    explanation:
      'Raw C = M^e mod n with no padding. It is deterministic and malleable, so it is for learning only.',
    reference: 'Ch 9 · RSA',
  },
  deterministic: {
    name: 'Deterministic encryption',
    explanation:
      'The same message and key always give the same ciphertext, so an attacker can test guesses.',
    reference: 'Ch 9 · practical RSA',
  },
  factoring: {
    name: 'Factoring attack',
    explanation:
      'Finding p and q from n. Anyone who knows them can compute φ(n) and then d, breaking the key.',
    reference: 'Ch 9 · security of RSA',
  },
  broadcastAttack: {
    name: 'Broadcast attack',
    explanation:
      'With e = 3 and the same unpadded M sent to three people, CRT gives M³ exactly and a cube root reveals M.',
    reference: 'Ch 9 · security of RSA',
  },
  digitalSignature: {
    name: 'Digital signature',
    explanation:
      'A value only the private-key holder can make and anyone can check with the public key. It does not hide the message.',
    reference: 'Ch 9 · RSA; RFC 8017 §8',
  },
  pss: {
    name: 'PSS',
    explanation:
      'Probabilistic Signature Scheme: encodes a message hash with a random salt before the RSA private-key step.',
    reference: 'RFC 8017 §8.1',
  },
  hash: {
    name: 'SHA-256',
    explanation:
      'A hash function mapping any message to 32 bytes. Changing the message changes the hash unpredictably.',
    reference: 'FIPS 180-4',
  },
  hybridEncryption: {
    name: 'Hybrid encryption',
    explanation:
      'A fast symmetric key encrypts the data and RSA encrypts only that small key, so size is not limited by n.',
    reference: 'Ch 9 · practical RSA',
  },
  aesGcm: {
    name: 'AES-GCM',
    explanation:
      'Symmetric authenticated encryption. It hides the data and detects any change to it.',
    reference: 'NIST SP 800-38D',
  },
  fingerprint: {
    name: 'Fingerprint',
    explanation:
      'A short hash of a public key. Compare it over a separate trusted channel to confirm whose key it is.',
    reference: 'Key management practice',
  },
} as const;
export type GlossaryTerm = keyof typeof glossary;
