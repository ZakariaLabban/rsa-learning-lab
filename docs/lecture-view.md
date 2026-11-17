# Lecture view

The lecture view is the default interface (`/`, and `/lecture/*`). It is meant for students
meeting RSA for the first time: one idea per page, every calculation shown as the same table the
lecture slides use, filled one row at a time.

## Course

Lessons are listed in `features/lecture/LectureShell.tsx` (`GROUPS`), in the order a student
should follow them. The home page, side menu and Previous/Next buttons are all generated from
that list.

1. **Start here:** the big picture (animated five-step drawing).
2. **The tools:** GCD, Inverse mod m (Extended Euclid), Fast powers (square and multiply).
3. **RSA:** RSA by hand, Why it works (Fermat, Euler), Signatures.
4. **Going further:** Miller-Rabin, Chinese Remainder Theorem.
5. **Break it:** factoring a small key, small e with several recipients, guessing a predictable message.
6. **Use it for real:** My keys, Contacts, Messages and files (real keys, OAEP, hybrid, signing).
7. **Practice:** nine questions with hints and full solutions.

Every lesson starts with the same top: the idea, why the student needs it, the lecture slides it
follows, and a closed "Words you need" list. The numbers a lesson uses are folded into one line
("Numbers used ... Change the numbers"); the panel folds again after a successful calculation and
stays open on an error.

## Tables follow the slides

- GCD: dividend = quotient x divisor + remainder, one row per division.
- Inverse: columns Q, A1, A2, A3, B1, B2, B3, starting from (1, 0, m) and (0, 1, b).
- Powers: the by-hand method (square, simplify, multiply the needed powers) and the lecture's table
  with rows i, b_i, c, f (Table 9.3).
- Miller-Rabin: n - 1 = 2^k q, then a^q, then repeated squaring, stopping as the slide's algorithm does.

`features/lecture/model.ts` and `advanced.ts` hold these as small independent BigInt functions.
Their tests compare them with the slide examples (550^-1 mod 1759 = 355, 7^560 mod 561, 88^7 mod 187
= 11, the n = 29 and n = 221 Miller-Rabin examples) and with the engine in `src/engine/math`.
`practice.test.ts` checks 300 random quizzes against independent math.

## Controls and motion

Primary actions (Next step, Calculate, Start) are large and solid; Back and Change the numbers are
outlined; Play slowly, Show all and Start over are plain text. The step bar stays at the bottom of the
screen while a table grows. Motion is limited to the newest row or card and the two SVG drawings
(`diagrams.tsx`), and stops when the system asks for reduced motion. Tabs use the arrow-key pattern.

## Which interface opens at `/`

`app/interfacePreference.ts` stores `lecture`, `workshop` or `legacy` under `rsa-lab-interface`. With no
saved value, or when storage is blocked, `/` opens the lecture view. `/lecture/*`, `/playground/*` and
`/legacy` always open their own experience.

## Privacy

The Keys, Contacts and Messages pages use the shared keyring and the existing engine. Private keys are
shown only on the owner's Keys page, "remember private keys" stays off by default, and downloads use the
existing file-name and envelope helpers.
