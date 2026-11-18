import type { PracticeKind } from './practice';

// one lesson (plain data, also used for titles and the sitemap)
export type Lesson = {
  path: string;
  label: string;
  title: string;
  text: string;
  source: string;
  // matching practice question
  practice?: PracticeKind;
};
export type Group = { name: string; blurb: string; lessons: Lesson[] };

// lessons in order
export const GROUPS: Group[] = [
  {
    name: 'Start here',
    blurb: 'Two minutes: what RSA is, with a picture.',
    lessons: [
      {
        path: '/lecture/start',
        label: 'The big picture',
        title: 'The big picture',
        text: 'Alice, Bob, a locked box and two keys.',
        source: 'Overview',
      },
    ],
  },
  {
    name: 'The tools',
    blurb: 'The three calculations RSA is built from (lecture chapters 4 and 9).',
    lessons: [
      {
        path: '/lecture/gcd',
        label: 'GCD',
        title: 'Greatest common divisor',
        text: 'Divide and keep the remainder until it is 0.',
        source: 'Chapter 4',
        practice: 'gcd',
      },
      {
        path: '/lecture/inverse',
        label: 'Inverse mod m',
        title: 'Inverse mod m',
        text: 'Fill the Q, A1–A3, B1–B3 table to find b⁻¹.',
        source: 'Chapter 4',
        practice: 'inverse',
      },
      {
        path: '/lecture/power',
        label: 'Powers mod n',
        title: 'Square and multiply',
        text: 'Compute a^b mod n in small steps, by hand or with the exponentiation algorithm.',
        source: 'Chapter 9',
        practice: 'power',
      },
    ],
  },
  {
    name: 'RSA',
    blurb: 'The algorithm itself (lecture chapter 9).',
    lessons: [
      {
        path: '/lecture/rsa',
        label: 'RSA by hand',
        title: 'RSA by hand',
        text: 'Make keys, encrypt, decrypt: the lecture example.',
        source: 'Chapter 9',
        practice: 'encrypt',
      },
      {
        path: '/lecture/why',
        label: 'Why it works',
        title: 'Why RSA works',
        text: 'Fermat, Euler and the proof, with real numbers.',
        source: 'Chapters 8 and 9',
        practice: 'phi',
      },
      {
        path: '/lecture/signatures',
        label: 'Signatures',
        title: 'Digital signatures',
        text: 'Sign with the private key, verify with the public key.',
        source: 'Chapter 9',
      },
    ],
  },
  {
    name: 'Going further',
    blurb: 'How real keys are found, and faster decryption (lecture chapter 8).',
    lessons: [
      {
        path: '/lecture/primality',
        label: 'Is n prime?',
        title: 'Miller–Rabin primality test',
        text: 'How the primes for a key are found.',
        source: 'Chapter 8',
        practice: 'mr',
      },
      {
        path: '/lecture/crt',
        label: 'Remainders (CRT)',
        title: 'Chinese Remainder Theorem',
        text: 'Rebuild a number from its remainders, and decrypt faster.',
        source: 'Chapters 8 and 9',
        practice: 'crt',
      },
    ],
  },
  {
    name: 'Break it',
    blurb: 'Why the choices in RSA matter: three attacks.',
    lessons: [
      {
        path: '/lecture/factoring',
        label: 'Factor n',
        title: 'Break a small key by factoring',
        text: 'Find p and q, rebuild d, read the message.',
        source: 'Chapter 9',
      },
      {
        path: '/lecture/small-e',
        label: 'Small e',
        title: 'Same message, small e',
        text: 'Combine ciphertexts with the CRT and take a root.',
        source: 'Chapter 9',
      },
      {
        path: '/lecture/guessing',
        label: 'YES or NO?',
        title: 'Guessing a predictable message',
        text: 'Why textbook RSA needs random padding.',
        source: 'Chapter 9',
      },
    ],
  },
  {
    name: 'Use it for real',
    blurb: 'Real keys and real messages in your browser.',
    lessons: [
      {
        path: '/lecture/keys',
        label: 'My keys',
        title: 'My keys',
        text: 'Make, import and manage key pairs.',
        source: 'Chapter 9',
      },
      {
        path: '/lecture/contacts',
        label: 'Contacts',
        title: 'Contacts and sharing keys',
        text: 'Share your public key and check fingerprints.',
        source: 'Chapter 9',
      },
      {
        path: '/lecture/messages',
        label: 'Messages and files',
        title: 'Send and receive secrets',
        text: 'Encrypt text and files, and sign them.',
        source: 'Chapter 9',
      },
    ],
  },
  {
    name: 'Practice',
    blurb: 'Test yourself, like in the exam.',
    lessons: [
      {
        path: '/lecture/practice',
        label: 'Practice questions',
        title: 'Practice with the lecture’s numbers',
        text: 'Nine questions with hints and full solutions.',
        source: 'All chapters',
      },
    ],
  },
];
export const LESSONS = GROUPS.flatMap((group) => group.lessons);

// lesson number: 0 for the overview, 1.1, 1.2 ... 6 for practice
export function clauseNumber(path: string): string {
  for (const [g, group] of GROUPS.entries())
    for (const [i, lesson] of group.lessons.entries())
      if (lesson.path === path) return group.lessons.length === 1 ? String(g) : `${g}.${i + 1}`;
  return '';
}

// number of a group, for the contents
