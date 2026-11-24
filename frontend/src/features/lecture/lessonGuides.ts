export type GuideStep = { target: string; title: string; text: string; tryNext?: boolean };
export type LessonGuideContent = { purpose: string; takeaway: string; steps: GuideStep[] };
const numbers = (text: string): GuideStep => ({
  target: '[data-guide="numbers"]',
  title: 'Choose your numbers',
  text,
});
const next = (text: string): GuideStep => ({
  target: '[data-guide="next"]',
  title: 'Move one calculation at a time',
  text,
  tryNext: true,
});
const tabs = (text: string): GuideStep => ({
  target: '[role="tablist"]',
  title: 'Explore the different views',
  text,
});
const read = (target: string, title: string, text: string): GuideStep => ({ target, title, text });
const course: GuideStep = {
  target: '.lesson-nav .next',
  title: 'Keep going when you are ready',
  text: 'This takes you to the next lesson. You can also choose any topic from the course map. There is no timer.',
};
const calculated = (
  purpose: string,
  takeaway: string,
  input: string,
  calculation: string,
  extra: GuideStep[] = [],
): LessonGuideContent => ({
  purpose,
  takeaway,
  steps: [
    numbers(input),
    ...extra,
    next(calculation),
    read(
      '.steps-bar',
      'Replay at your own pace',
      'Back revisits a step. Play slowly advances automatically; Pause stops it. Show all reveals the full example, and Start over rewinds it.',
    ),
    course,
  ],
});
export const LESSON_GUIDES: Record<string, LessonGuideContent> = {
  '/lecture/start': {
    purpose:
      'Meet Alice, Bob and Eve. Watch a message travel safely using two different keys: one to lock, one to unlock.',
    takeaway:
      'You will understand who shares a key, who keeps a secret, and what an attacker can see.',
    steps: [
      read(
        '.figwrap',
        'Follow the message',
        'Alice sends, Bob receives, and Eve watches. The yellow highlight follows the part of the story happening now.',
      ),
      next(
        'Next step moves the story forward. Try it here to watch Bob share his public key. The caption explains each scene.',
      ),
      read(
        '.steps-bar',
        'Watch or rewind',
        'Use Back to revisit a scene, or Play slowly to watch the whole journey. You can pause whenever you like.',
      ),
      course,
    ],
  },
  '/lecture/gcd': calculated(
    'Find the biggest number that divides two numbers exactly. This is the first tool we need for RSA keys.',
    'You will see why repeated division eventually finds the GCD.',
    'Start with the lecture numbers. Change the numbers opens the inputs; Calculate runs your example.',
    'Next step adds one division to the table. Read the remainder: it becomes the input for the next row.',
  ),
  '/lecture/inverse': calculated(
    'Find the number that undoes multiplication when we keep only a remainder. RSA uses this to build its private key.',
    'You will learn to read the extended Euclid table and recognise when an inverse does not exist.',
    'Change m and b to try another inverse. The lecture example is already ready to explore.',
    'Each click fills the next row. The highlighted cells and explanation show where each new value comes from.',
  ),
  '/lecture/power': calculated(
    'Compute a huge power using small steps: square, keep the remainder, and multiply only what you need.',
    'You will connect the hand calculation to the algorithm used to lock and unlock messages.',
    'Choose the base a, exponent b and modulus n. Calculate starts a fresh worked example.',
    'Each click reveals the next square or multiplication. Watch which powers are needed.',
    [
      tabs(
        'By hand explains the squares and products. Exponentiation algorithm shows the same calculation as a lecture table.',
      ),
    ],
  ),
  '/lecture/rsa': {
    purpose:
      'Build a tiny pair of RSA keys, lock a message with the public key, then unlock it with the private key.',
    takeaway: 'You will follow the complete RSA journey and see the actual numbers at every stage.',
    steps: [
      numbers(
        'The example is ready. Change the numbers to choose p, q, e and your message M. Keep the numbers small while learning.',
      ),
      tabs(
        'Start at Make keys, then Encrypt, then Decrypt. You can return to any stage to inspect it again.',
      ),
      read(
        '.rsa-steps > li',
        'Read how the keys are built',
        'The numbered lines explain n, φ(n), e and d. Links open the smaller calculation behind a step.',
      ),
      read(
        '.nav-row .primary, .nav-row button',
        'Continue to encryption',
        'After inspecting the keys, use this button to move to encryption. In the encryption and decryption views, Next step reveals the power calculation piece by piece.',
      ),
      course,
    ],
  },
  '/lecture/why': calculated(
    'See why unlocking an RSA message returns the number you started with. Two number facts make the keys work together.',
    'You will connect Euler’s theorem to a real encryption and decryption example.',
    'Choose primes, e and a message to check the proof with your own small numbers.',
    'Next step reveals one part of the proof. Read the plain-language explanation alongside the equation.',
  ),
  '/lecture/signatures': calculated(
    'A signature lets someone check a message using your public key. Here you will sign a small number and check the result.',
    'You will see why changing the message makes verification fail.',
    'Choose the key numbers and the message to sign. Recalculate to start a new example.',
    'Each step shows signing or verification. Compare the recovered value with the message being checked.',
  ),
  '/lecture/primality': calculated(
    'RSA needs prime numbers. Miller–Rabin checks whether a candidate behaves like a prime using repeated powers and squares.',
    'You will learn what a witness means and why passing a round is not always a proof of primality.',
    'Choose a candidate n and a test base. Try the ready-made examples to compare a prime and a composite.',
    'Follow the decomposition, power and squaring checks one at a time. The explanation tells you when a round can stop.',
  ),
  '/lecture/crt': calculated(
    'Rebuild a number from its remainders. Then see how the same idea makes RSA decryption faster.',
    'You will connect the CRT calculation to doing two smaller RSA calculations instead of one large one.',
    'Choose whether to start with a number or with its remainders, then calculate.',
    'Each step builds a part of the answer. Look at the remainder checks to see why the result fits.',
  ),
  '/lecture/factoring': calculated(
    'Act as an attacker against a deliberately tiny RSA key. Find its two prime factors and use them to recover the private key.',
    'You will see why small RSA keys are easy to break and why real keys need much larger primes.',
    'Choose the public modulus and ciphertext, or keep the lecture example. These tiny values are for learning only.',
    'Walk through factoring n, rebuilding the private key and recovering the message.',
  ),
  '/lecture/small-e': calculated(
    'The same unpadded message is sent to three recipients with e = 3. Combine the ciphertexts and recover the message.',
    'You will see why a low exponent and repeated textbook messages can be a dangerous combination.',
    'Choose a message, exponent and three moduli that share no factors. The lab calculates the ciphertexts for you. Start with the prepared example.',
    'Advance through the CRT combination, then the cube root. Check the recovered message against all three ciphertexts.',
  ),
  '/lecture/guessing': {
    purpose:
      'If a message can only be YES or NO, can an attacker guess it? Compare predictable textbook RSA with randomized OAEP.',
    takeaway:
      'You will see why encryption needs random padding, even when the key itself is large.',
    steps: [
      numbers(
        'Use the prepared tiny public key and ciphertext, or change the example. The attacker knows only the public information.',
      ),
      next(
        'The attacker encrypts each possible message and compares it with the intercepted ciphertext.',
      ),
      read(
        '.steps-bar',
        'Inspect both guesses',
        'Next step and Back let you compare the candidate ciphertexts. Matching one reveals the predictable message.',
      ),
      read(
        '#lesson article > .collapse:last-of-type summary',
        'Compare real encryption',
        'Open this experiment after the tour to encrypt twice with textbook RSA and OAEP. Textbook results repeat; properly randomized OAEP results differ.',
      ),
      course,
    ],
  },
  '/lecture/keys': {
    purpose: 'Make or import a key pair and choose the key you want to use elsewhere in the lab.',
    takeaway: 'You will know which part can be shared and where private-key storage is controlled.',
    steps: [
      tabs(
        'By hand is for tiny teaching keys. Generate a real key makes a larger key in this browser. Import accepts an existing key file.',
      ),
      read(
        '#keys-panel .field',
        'Make a teaching key first',
        'Try the ready-made small primes. After the tour, make the key; it appears in Your keys, where you can name it, use it and export its public part.',
      ),
      read(
        '#lesson article > details:last-of-type summary',
        'Choose what stays on this device',
        'Open this section to inspect private-key storage. Private keys are temporary by default. Remembering them stores them unencrypted on this device.',
      ),
      course,
    ],
  },
  '/lecture/contacts': {
    purpose:
      'Exchange public keys with someone so you can lock messages for each other. Private keys are never needed to add a contact.',
    takeaway: 'You will know how to import a public key and why comparing fingerprints matters.',
    steps: [
      read(
        '#share-key',
        'Choose a public key to share',
        'Select your key, or a demo key. The controls below let you copy the public text, download a .pub file or show a QR code.',
      ),
      read(
        '#contact-text',
        'Add someone else’s public key',
        'Paste the public text here, or use Choose a .pub file or the QR scanner below. Never paste a private key.',
      ),
      read(
        '#contact-name',
        'Give the contact a name',
        'A name is just a label. After adding a contact, compare the fingerprint through a separate trusted channel before marking it verified.',
      ),
      course,
    ],
  },
  '/lecture/messages': {
    purpose:
      'Lock text or a file for a recipient, then unlock it with the matching private key. You can also attach a signature.',
    takeaway:
      'You will send a complete encrypted envelope and understand which key each action needs.',
    steps: [
      read(
        '[aria-label="Send a message"] select',
        'Choose who receives it',
        'The selected public key locks the message. Start with the demo key Alice so you can try both sending and receiving on this device.',
      ),
      tabs(
        'Choose text or a file. Small text can use RSA directly; long text and files use hybrid encryption, where AES protects the data and RSA protects the AES key.',
      ),
      read(
        '#msg-text, #msg-file',
        'Prepare the message',
        'After this tour, enter a short sample or choose a demonstration file, then lock it. The encrypted envelope can be copied to the receiving section.',
      ),
      read(
        '#holder',
        'Unlock with the matching private key',
        'Choose the owner’s key here, paste an envelope below and unlock it. If the sender signed it, verification needs the sender’s public key.',
      ),
      course,
    ],
  },
  '/lecture/practice': {
    purpose:
      'Check your understanding with short questions using the same numbers and methods as the lessons.',
    takeaway:
      'You will know how to check an answer, ask for a hint and study a complete worked solution.',
    steps: [
      read(
        '#level',
        'Choose your practice set',
        'Start with the lecture examples. New random numbers lets you generate a fresh quiz when you are ready.',
      ),
      read(
        '.answer-row',
        'Try an answer first',
        'Work on paper, then type your answer and press Check. A wrong answer is a chance to try again; you can keep editing it.',
      ),
      read(
        '.question .collapse summary',
        'Get a small nudge',
        'Open Hint if you are stuck. Show the steps and the answer reveals the worked solution below it.',
      ),
      read(
        '.questions .question h3',
        'Work at your own pace',
        'Each question is independent. Your score at the top counts correct answers in this quiz. Follow a lesson’s Your turn link to jump straight to its matching topic.',
      ),
    ],
  },
};
