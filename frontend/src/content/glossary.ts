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
} as const;
export type GlossaryTerm = keyof typeof glossary;
