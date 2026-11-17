import { frame, datum, type TraceFrame } from './traceTypes';
import type { EuclidResult } from '../euclid/euclidModel';
import type {
  exponentiation,
  primality,
  rsaProof,
  residues,
  crtLesson,
  compareDecryption,
  liarSearch,
} from '../number-theory/model';
import type { PrivateKey } from '../../engine/math';

export function keyFrames(key: PrivateKey, revealed: boolean): TraceFrame[] {
  const secret = (value: bigint) => (revealed ? String(value) : 'Hidden · reveal private key');
  return [
    frame(
      'Join the primes',
      'Two distinct primes create the shared modulus.',
      [datum('p', secret(key.p)), datum('q', secret(key.q))],
      'multiply',
      datum('n', key.n),
      revealed ? `${key.p} × ${key.q} = ${key.n}` : 'p × q = n',
    ),
    frame(
      'Count coprime residues',
      'For two distinct primes, φ(n) = (p−1)(q−1).',
      [datum('p−1', secret(key.p - 1n)), datum('q−1', secret(key.q - 1n))],
      'multiply',
      datum('φ(n)', secret(key.phi)),
      revealed ? `${key.p - 1n} × ${key.q - 1n} = ${key.phi}` : '(p−1)(q−1) = φ(n)',
    ),
    frame(
      'Choose the public exponent',
      'e must be coprime to φ(n).',
      [datum('e', key.e), datum('φ(n)', secret(key.phi))],
      'gcd',
      datum('gcd(e, φ)', 1),
    ),
    frame(
      'Find the private inverse',
      'Extended Euclid gives d. It stays hidden until you reveal the private key.',
      [datum('e', key.e), datum('φ(n)', secret(key.phi))],
      'inverse',
      datum('d', secret(key.d)),
      revealed ? `${key.e} × ${key.d} mod ${key.phi} = 1` : 'e × d ≡ 1 (mod φ(n))',
    ),
    frame(
      'Assemble the keys',
      'Share (e,n). Keep the primes and d private.',
      [datum('e', key.e), datum('n', key.n)],
      'assemble',
      datum('Public key', `(${key.e}, ${key.n})`),
    ),
  ];
}

export function euclidFrames(value: EuclidResult): TraceFrame[] {
  const steps = value.rows.slice(2).map((row, i) => {
    const before = value.rows[i],
      current = value.rows[i + 1];
    return frame(
      `Division ${i + 1}`,
      `Keep the remainder and update both Bézout coefficients: r = s·m + t·a.`,
      [datum('previous r', before.r), datum('current r', current.r)],
      'divide',
      datum('next r', row.r),
      `${before.r} = ${row.q} × ${current.r} + ${row.r}; s=${row.s}, t=${row.t}`,
    );
  });
  if (value.truncated)
    steps.push(
      frame(
        'Trace limit',
        'The displayed prefix is bounded. The engine completed every division.',
        [datum('Total divisions', value.stepCount)],
        'gcd',
        datum('gcd', value.gcd),
      ),
    );
  steps.push(
    frame(
      value.inverse === null ? 'No inverse exists' : 'Normalize the inverse',
      value.inverse === null
        ? 'An inverse exists only when the gcd is 1.'
        : 'Normalize the Bézout coefficient into 0…m−1.',
      [datum('a', value.a), datum('m', value.m), datum('gcd', value.gcd)],
      value.inverse === null ? 'gcd ≠ 1' : 'inverse',
      datum('a⁻¹ mod m', value.inverse === null ? 'No inverse' : value.inverse),
    ),
  );
  return steps;
}

export function powerFrames(value: ReturnType<typeof exponentiation>): TraceFrame[] {
  let before = 1n % value.n;
  const frames: TraceFrame[] = [];
  value.result.rows.forEach((row, i) => {
    const product = before * before;
    frames.push({
      sourceIndex: i,
      ...frame(
        `Bit ${i + 1}: square`,
        row.bit
          ? 'This bit is 1. Multiply by the base after squaring.'
          : 'This bit is 0. Skip the extra multiplication.',
        [datum('running result', before), datum('same result', before)],
        'square',
        datum('remainder', row.square),
        `${before} × ${before} mod ${value.n} = ${row.square}`,
      ),
      reduction: { product, modulus: value.n },
    });
    if (row.bit)
      frames.push({
        sourceIndex: i,
        ...frame(
          `Bit ${i + 1}: multiply`,
          'A 1 bit multiplies the squared result by the normalized base.',
          [datum('squared result', row.square), datum('base', value.normalizedBase)],
          'multiply',
          datum('remainder', row.f),
          `${row.square} × ${value.normalizedBase} mod ${value.n} = ${row.f}`,
        ),
        reduction: { product: row.square * value.normalizedBase, modulus: value.n },
      });
    before = row.f;
  });
  if (!frames.length)
    frames.push(
      frame(
        'Exponent zero',
        'An empty binary exponent leaves the initial value 1 mod n. No multiplication is performed.',
        [datum('exponent', 0), datum('modulus', value.n)],
        'initialize',
        datum('result', value.result.value),
      ),
    );
  return frames;
}

export function primalityFrames(value: ReturnType<typeof primality>, round: number): TraceFrame[] {
  const run = value.result,
    row = run?.rows[round];
  if (!run || !row)
    return [
      frame(
        'Check the small cases',
        'Values below 2 are not prime; 2 and 3 are prime; larger even values are composite.',
        [datum('n', value.n)],
        'check',
        datum(
          'classification',
          value.special === 'small-prime'
            ? 'Prime'
            : value.special === 'even'
              ? 'Composite'
              : 'Not prime',
        ),
      ),
    ];
  return [
    frame(
      'Decompose n − 1',
      'Remove factors of two until q is odd.',
      [datum('n−1', value.n - 1n)],
      'split',
      datum('2^k × q', `2^${run.k} × ${run.q}`),
    ),
    ...row.sequence.map((x, i) =>
      i === 0
        ? frame(
            'Raise the selected base',
            'Compute a^q mod n. Accept this base immediately if x is 1 or n−1.',
            [datum('base a', row.base), datum('odd exponent q', run.q)],
            'modular power',
            datum('x', x),
            `${row.base}^${run.q} mod ${value.n} = ${x}`,
          )
        : {
            ...frame(
              `Square residue ${i}`,
              'Reduce the square modulo n, then compare with n−1.',
              [datum('previous x', row.sequence[i - 1]), datum('modulus n', value.n)],
              'square',
              datum('x', x),
              `${row.sequence[i - 1]}² mod ${value.n} = ${x}`,
            ),
            reduction: { product: row.sequence[i - 1] ** 2n, modulus: value.n },
          },
    ),
    frame(
      'Judge this base',
      row.passed
        ? 'Passing a base is evidence, not a proof that n is prime.'
        : 'This base is a witness proving n composite.',
      [datum('base', row.base), datum('last x', row.sequence.at(-1)!)],
      'compare',
      datum('verdict', row.passed ? 'Base passes' : 'Composite witness'),
    ),
  ].map((item, index) => ({
    ...item,
    sourceIndex: Math.max(0, Math.min(row.sequence.length - 1, index - 1)),
  }));
}

export function crtFrames(value: ReturnType<typeof crtLesson>): TraceFrame[] {
  const frames = value.rows.flatMap((row, i) => [
    frame(
      `Lane ${i + 1}: remove one modulus`,
      'Divide N by this lane’s modulus.',
      [datum('N', value.modulus), datum('m_i', row.modulus)],
      'divide',
      datum('N_i', row.partial),
      `${value.modulus} ÷ ${row.modulus} = ${row.partial}`,
    ),
    frame(
      `Lane ${i + 1}: find the inverse`,
      'Choose y_i so N_i·y_i ≡ 1 (mod m_i).',
      [datum('N_i', row.partial), datum('m_i', row.modulus)],
      'inverse',
      datum('y_i', row.coefficient),
    ),
    frame(
      `Lane ${i + 1}: weight the residue`,
      'This term supplies one residue while vanishing in all other lanes.',
      [datum('a_i', row.residue), datum('N_i', row.partial), datum('y_i', row.coefficient)],
      'multiply',
      datum('term', row.term),
      `${row.residue} × ${row.partial} × ${row.coefficient} = ${row.term}`,
    ),
  ]);
  const sum = value.rows.reduce((total, row) => total + row.term, 0n);
  frames.push({
    ...frame(
      'Recombine the lanes',
      'Sum every weighted term and take its canonical residue modulo N.',
      value.rows.map((row, i) => datum(`term ${i + 1}`, row.term)),
      'sum / mod',
      datum('A', value.value),
      `${sum} mod ${value.modulus} = ${value.value}`,
    ),
    reduction: { product: sum, modulus: value.modulus },
  });
  return frames;
}

export function proofFrames(value: ReturnType<typeof rsaProof>): TraceFrame[] {
  return [
    frame(
      'Normalize the message',
      'RSA works on a residue class modulo n.',
      [datum('original M', value.original), datum('n', value.key.n)],
      'mod',
      datum('M mod n', value.message),
    ),
    frame(
      'Connect the exponents',
      'The private exponent is the inverse of e modulo φ(n).',
      [datum('e', value.key.e), datum('d', value.key.d)],
      'multiply',
      datum('e·d', value.key.e * value.key.d),
      `${value.key.e * value.key.d} = 1 + ${value.k} × ${value.key.phi}`,
    ),
    frame(
      'Check the coprime condition',
      value.common === 1n
        ? 'Euler applies because gcd(M,n)=1.'
        : 'Euler’s coprime argument does not apply. Use the two prime lanes instead.',
      [datum('M', value.message), datum('n', value.key.n)],
      'gcd',
      datum('gcd(M,n)', value.common),
    ),
    ...value.primeRows.map((row) =>
      frame(
        `Proof modulo ${row.prime}`,
        row.message === 0n
          ? 'The message is 0 in this lane, so every positive power is 0.'
          : 'Fermat applies to this nonzero prime residue; e·d = 1 + k(p−1).',
        [datum('M mod prime', row.message), datum('prime', row.prime)],
        'prime lane',
        datum('recovered residue', row.recovered),
      ),
    ),
    frame(
      'CRT joins the proof',
      'Equality modulo both coprime primes gives equality modulo n.',
      [
        datum('residue p', value.primeRows[0].recovered),
        datum('residue q', value.primeRows[1].recovered),
      ],
      'CRT',
      datum('recovered M', value.recovered),
    ),
  ];
}

export function residueFrames(value: ReturnType<typeof residues>): TraceFrame[] {
  const frames = value.rows.map((row, i) =>
    frame(
      `Power ${row.exponent}`,
      'Multiply by a and reduce modulo n.',
      [datum('previous residue', i ? value.rows[i - 1].value : 1n), datum('a', value.a)],
      'multiply / mod',
      datum('residue', row.value),
      `a^${row.exponent} mod ${value.n} = ${row.value}`,
    ),
  );
  if (value.truncated)
    frames.push(
      frame(
        'Final engine result',
        'The first 64 powers are shown; intermediate powers up to φ(n) are omitted from the animation.',
        [datum('φ(n)', value.phi)],
        'final residue',
        datum('a^φ(n) mod n', value.value),
      ),
    );
  return frames;
}

export function liarFrames(value: ReturnType<typeof liarSearch>): TraceFrame[] {
  return [
    frame(
      'Enumerate the bases',
      'The engine tests every base from 2 to n−2; this enumeration is not a random-round probability bound.',
      [datum('n', value.n), datum('bases tested', value.tested)],
      'test bases',
      datum('passing bases', value.bases.length),
    ),
    frame(
      'Interpret the passing bases',
      value.prime
        ? 'n is prime, so passing bases are not strong liars.'
        : 'n is composite, so each passing base is a strong liar.',
      [
        datum('factor', value.factor ?? 'none'),
        datum('passing bases', value.bases.map(String).join(', ') || 'None'),
      ],
      'classify',
      datum('n is', value.prime ? 'Prime' : 'Composite'),
    ),
  ];
}

export function benchmarkFrames(
  value: ReturnType<typeof compareDecryption>,
  key: PrivateKey,
  revealed: boolean,
): TraceFrame[] {
  const hidden = (n: bigint) => (revealed ? String(n) : 'Hidden · reveal private CRT details');
  return [
    frame(
      'Ordinary RSA route',
      'One private modular exponentiation recovers the message.',
      [datum('C', value.ciphertext), datum('d', hidden(key.d))],
      'C^d mod n',
      datum('ordinary M', value.direct),
    ),
    frame(
      'CRT lane p',
      'A smaller modular exponentiation runs modulo p.',
      [datum('C', value.ciphertext), datum('d_p', hidden(key.dp)), datum('p', hidden(key.p))],
      'power / mod',
      datum('M_p', hidden(value.trace.mp)),
    ),
    frame(
      'CRT lane q',
      'Another smaller power runs modulo q.',
      [datum('C', value.ciphertext), datum('d_q', hidden(key.dq)), datum('q', hidden(key.q))],
      'power / mod',
      datum('M_q', hidden(value.trace.mq)),
    ),
    frame(
      'Align the two lanes',
      'h = q⁻¹(M_p−M_q) mod p.',
      [
        datum('q inverse', hidden(value.trace.qInv)),
        datum('M_p−M_q', hidden(value.trace.mp - value.trace.mq)),
      ],
      'multiply / mod',
      datum('h', hidden(value.trace.h)),
    ),
    frame(
      'Recombine the message',
      'M = M_q + h×q. Compare both computed plaintexts.',
      [
        datum('M_q', hidden(value.trace.mq)),
        datum('h', hidden(value.trace.h)),
        datum('q', hidden(key.q)),
      ],
      'recombine',
      datum('CRT M', value.crt),
    ),
    frame(
      'Compare measured samples',
      'These medians are actual worker computation times; animation time is excluded.',
      [
        datum('ordinary median ms', value.directMedian.toFixed(3)),
        datum('CRT median ms', value.crtMedian.toFixed(3)),
      ],
      'compare',
      datum('both plaintexts agree', String(value.direct === value.crt)),
    ),
  ];
}
