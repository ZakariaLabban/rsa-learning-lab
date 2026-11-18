// the words a new student needs, one sentence each
export const WORDS = {
  mod: {
    term: 'a mod n',
    meaning:
      'The remainder when a is divided by n. Like a clock: 17 mod 12 = 5, because 17 o’clock is 5 o’clock.',
  },
  prime: {
    term: 'Prime number',
    meaning: 'A number above 1 that only 1 and itself divide, such as 2, 3, 5, 7, 11, 13.',
  },
  composite: {
    term: 'Composite number',
    meaning:
      'A number that is not prime, because it can be split into smaller factors (15 = 3 × 5).',
  },
  gcd: {
    term: 'gcd(a, b)',
    meaning: 'The greatest common divisor: the largest number that divides both a and b.',
  },
  coprime: {
    term: 'Relatively prime',
    meaning: 'Two numbers whose only common divisor is 1, so gcd(a, b) = 1. For example 8 and 15.',
  },
  inverse: {
    term: 'Inverse a⁻¹ mod m',
    meaning: 'The number x with a × x = 1 (mod m). It is like dividing by a inside mod m.',
  },
  exponent: {
    term: 'Exponent',
    meaning: 'In a^b the exponent b says how many times a is multiplied by itself: 2³ = 2 × 2 × 2.',
  },
  phi: {
    term: 'φ(n) (phi of n)',
    meaning:
      'How many numbers from 1 to n share no factor with n. For n = p × q with p and q prime, φ(n) = (p − 1)(q − 1).',
  },
  modulus: {
    term: 'Modulus n',
    meaning: 'The number we divide by when we “take mod”. In RSA, n = p × q is public.',
  },
  residue: {
    term: 'Residue',
    meaning: 'The remainder. “The residue of 17 mod 5” is 2.',
  },
  plaintext: {
    term: 'Plaintext M',
    meaning: 'The original message, written as a number M below n.',
  },
  ciphertext: {
    term: 'Ciphertext C',
    meaning:
      'The scrambled message that is sent. Without the private key it looks like random numbers.',
  },
  publicKey: {
    term: 'Public key {e, n}',
    meaning: 'Shared with everyone. It can lock a message, but it cannot unlock it.',
  },
  privateKey: {
    term: 'Private key {d, n}',
    meaning:
      'Kept secret by its owner. It is the only thing that can unlock messages made with the public key.',
  },
  signature: {
    term: 'Signature',
    meaning:
      'A value only the owner of the private key could make, which anyone can check with the public key.',
  },
  fingerprint: {
    term: 'Fingerprint',
    meaning:
      'A short summary of a key. If two people see the same fingerprint, they have the same key.',
  },
  aes: {
    term: 'AES',
    meaning:
      'A fast lock that uses one shared secret key. Real systems use RSA only to protect that small key.',
  },
  attacker: {
    term: 'Attacker (Eve)',
    meaning:
      'Someone who sees the public key and the scrambled message and tries to read it anyway.',
  },
} as const;

export type WordKey = keyof typeof WORDS;
