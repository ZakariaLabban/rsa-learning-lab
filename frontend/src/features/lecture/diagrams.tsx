import { StepControls, useSteps } from './parts';

// small icons
// key icon, filled = private key
function KeyMark({ x, y, secret }: { x: number; y: number; secret?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} className={`key-mark ${secret ? 'secret' : ''}`}>
      <circle cx="6" cy="0" r="5.5" />
      <path d="M11.5 0 H27 M22 0 V5 M26 0 V4" />
    </g>
  );
}

// padlock icon
function LockMark({ x, y, open }: { x: number; y: number; open?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} className={`lock-mark ${open ? 'open' : ''}`}>
      <rect x="0" y="7" width="15" height="11" rx="1.5" />
      <path d={open ? 'M3 7 V4.5 a4.5 4.5 0 0 1 9 0 V3' : 'M3 7 V4.5 a4.5 4.5 0 0 1 9 0 V7'} />
    </g>
  );
}

// figure 0.1: big picture
const A = 92,
  E = 318,
  B = 544;
const ROWS = [70, 136, 202, 268, 334];

const CAPTIONS = [
  {
    title: 'Bob makes two keys',
    text: 'One is public, one is private. They are a matched pair: whatever the public key locks, only the private key can unlock.',
  },
  {
    title: 'Bob shares his public key with everyone',
    text: 'Alice gets a copy. So does Eve, the attacker. That is safe, because the public key can only lock. It can never unlock.',
  },
  {
    title: 'Alice locks her message',
    text: 'She turns her message 88 into a number nobody can read, using Bob’s public key: C = 88⁷ mod 187 = 11.',
  },
  {
    title: 'The locked message travels',
    text: 'Eve sees 11 go by. She has the public key, but not Bob’s private number d = 23, so she cannot get 88 back.',
  },
  {
    title: 'Bob unlocks it',
    text: 'Bob computes M = 11²³ mod 187 = 88 with his private key, which only he has. This is RSA.',
  },
] as const;

export function BigPicture() {
  const steps = useSteps(CAPTIONS.length);
  const s = steps.shown - 1; // 0 … 4
  const caption = CAPTIONS[s];
  const row = (index: number) => (s === index ? 'row now' : s > index ? 'row past' : 'row');
  return (
    <figure className="fig">
      <div
        className="figwrap"
        tabIndex={0}
        role="group"
        aria-label="Figure, scrolls sideways on narrow screens"
      >
        <svg
          className="art bigpicture"
          viewBox="0 0 640 372"
          role="img"
          aria-label={`Step ${s + 1} of 5: ${caption.title}. ${caption.text}`}
        >
          {/* participants */}
          {[
            [A, 'Alice'],
            [E, 'Eve'],
            [B, 'Bob'],
          ].map(([x, name]) => (
            <g key={name} className="who">
              <rect x={Number(x) - 46} y="10" width="92" height="30" />
              <text x={Number(x)} y="30" textAnchor="middle">
                {name}
              </text>
              <line x1={Number(x)} y1="40" x2={Number(x)} y2="364" className="life" />
            </g>
          ))}
          <text x={E} y="54" textAnchor="middle" className="sub">
            attacker
          </text>

          {/* step 1: Bob makes the key pair */}
          <g className={row(0)}>
            <text x="4" y={ROWS[0] + 5} className="stepno">
              1
            </text>
            <rect x={B - 5} y={ROWS[0] - 16} width="10" height="32" className="act" />
            <KeyMark x={B - 168} y={ROWS[0] - 12} />
            <text x={B - 130} y={ROWS[0] - 8} className="n">
              PU = {'{'}7, 187{'}'}
            </text>
            <KeyMark x={B - 168} y={ROWS[0] + 12} secret />
            <text x={B - 130} y={ROWS[0] + 16} className="n">
              PR = {'{'}23, 187{'}'}
            </text>
          </g>

          {/* step 2: the public key goes to Alice, and Eve sees it too */}
          <g className={row(1)}>
            <text x="4" y={ROWS[1] + 5} className="stepno">
              2
            </text>
            <path className="msg" pathLength={1} d={`M${B} ${ROWS[1]} H${A + 4}`} />
            <path
              className="head"
              d={`M${A + 12} ${ROWS[1] - 5} L${A + 3} ${ROWS[1]} L${A + 12} ${ROWS[1] + 5}`}
            />
            <text x={(A + B) / 2} y={ROWS[1] - 9} textAnchor="middle" className="n lab">
              PU = {'{'}7, 187{'}'}
            </text>
            <circle cx={E} cy={ROWS[1]} r="4" className="tap" />
            <text x={E + 14} y={ROWS[1] + 22} className="t lab">
              Eve sees it too
            </text>
          </g>

          {/* step 3: Alice locks the message */}
          <g className={row(2)}>
            <text x="4" y={ROWS[2] + 5} className="stepno">
              3
            </text>
            <rect x={A - 5} y={ROWS[2] - 16} width="10" height="32" className="act" />
            <text x={A + 16} y={ROWS[2] - 6} className="t">
              M = 88
            </text>
            <text x={A + 16} y={ROWS[2] + 14} className="n">
              C = 88⁷ mod 187 = 11
            </text>
            <LockMark x={A + 190} y={ROWS[2] - 6} />
          </g>

          {/* step 4: 11 travels to Bob; Eve cannot read it */}
          <g className={row(3)}>
            <text x="4" y={ROWS[3] + 5} className="stepno">
              4
            </text>
            <path className="msg" pathLength={1} d={`M${A} ${ROWS[3]} H${B - 4}`} />
            <path
              className="head"
              d={`M${B - 12} ${ROWS[3] - 5} L${B - 3} ${ROWS[3]} L${B - 12} ${ROWS[3] + 5}`}
            />
            <text x={(A + B) / 2 + 80} y={ROWS[3] - 9} textAnchor="middle" className="n lab">
              C = 11
            </text>
            <g
              className="move packet"
              style={{ transform: `translateX(${s >= 3 ? B - A - 18 : 0}px)` }}
            >
              <rect x={A + 4} y={ROWS[3] - 7} width="14" height="14" />
            </g>
            <g className="cross" transform={`translate(${E} ${ROWS[3]})`}>
              <path d="M-6 -6 L6 6 M6 -6 L-6 6" />
            </g>
            <text x={E - 16} y={ROWS[3] + 26} textAnchor="end" className="t lab">
              no d, cannot decrypt
            </text>
          </g>

          {/* step 5: Bob unlocks it */}
          <g className={row(4)}>
            <text x="4" y={ROWS[4] + 5} className="stepno">
              5
            </text>
            <rect x={B - 5} y={ROWS[4] - 16} width="10" height="32" className="act" />
            <text x={B - 16} y={ROWS[4] - 6} textAnchor="end" className="n">
              M = 11²³ mod 187
            </text>
            <text x={B - 16} y={ROWS[4] + 14} textAnchor="end" className="t">
              = 88, the message
            </text>
            <LockMark x={B - 190} y={ROWS[4] - 6} open />
          </g>
        </svg>
      </div>
      <StepControls steps={steps} label="Picture" />
      <div className="explain" aria-live="polite">
        <p>
          <b>
            {steps.shown}. {caption.title}
          </b>
        </p>
        <p>{caption.text}</p>
      </div>
      <figcaption>
        <b>Figure 0.1.</b> {caption.title}. Alice sends 88 to Bob using the lecture’s key PU = {'{'}
        7, 187{'}'}, PR = {'{'}23, 187{'}'}.
      </figcaption>
    </figure>
  );
}

// figure 2.1: lock and unlock
export type FlowPhase = 'keys' | 'encrypt' | 'decrypt';

export function RsaFlow({
  phase,
  m,
  c,
  e,
  d,
  n,
}: {
  phase: FlowPhase;
  m: string;
  c: string;
  e: string;
  d: string;
  n: string;
}) {
  const label =
    phase === 'keys'
      ? 'The message M is ready to be sent.'
      : phase === 'encrypt'
        ? `Locking: C = M^e mod n turns ${m} into ${c}.`
        : `Unlocking: M = C^d mod n turns ${c} back into ${m}.`;
  const lockOn = phase !== 'keys';
  const unlockOn = phase === 'decrypt';
  // shrink big numbers so they fit in the box, cut the really long ones
  const long = (value: string) => (value.length > 14 ? `${value.slice(0, 13)}…` : value);
  const fit = (value: string) => Math.max(11, Math.min(26, 88 / (0.62 * long(value).length)));
  const encryptText = `M^${e} mod ${n}`;
  const decryptText = `C^${d} mod ${n}`;
  // if the label is too long just show the letters
  const encryptShown = encryptText.length > 11 ? 'M^e mod n' : encryptText;
  const decryptShown = decryptText.length > 11 ? 'C^d mod n' : decryptText;
  return (
    <figure className="fig">
      <div
        className="figwrap"
        tabIndex={0}
        role="group"
        aria-label="Figure, scrolls sideways on narrow screens"
      >
        <svg className="art rsaflow" viewBox="0 0 640 150" role="img" aria-label={label}>
          {/* tokens */}
          <g className="token on">
            <rect x="6" y="54" width="104" height="58" />
            <text x="58" y="72" textAnchor="middle" className="t sub">
              message M
            </text>
            <text x="58" y="100" textAnchor="middle" className="n big" style={{ fontSize: fit(m) }}>
              {long(m)}
            </text>
          </g>
          <g className={`token ${lockOn ? 'on' : ''}`}>
            <rect x="268" y="54" width="104" height="58" />
            <text x="320" y="72" textAnchor="middle" className="t sub">
              ciphertext C
            </text>
            <text
              x="320"
              y="100"
              textAnchor="middle"
              className="n big"
              style={{ fontSize: fit(c) }}
            >
              {long(c)}
            </text>
          </g>
          <g className={`token ${unlockOn ? 'on' : ''}`}>
            <rect x="530" y="54" width="104" height="58" />
            <text x="582" y="72" textAnchor="middle" className="t sub">
              message M
            </text>
            <text
              x="582"
              y="100"
              textAnchor="middle"
              className="n big"
              style={{ fontSize: fit(m) }}
            >
              {long(m)}
            </text>
          </g>

          {/* operations */}
          <g className={`op ${phase === 'encrypt' ? 'now' : lockOn ? 'past' : ''}`}>
            <path className="msg" pathLength={1} d="M114 83 H262" />
            <path className="head" d="M254 78 L263 83 L254 88" />
            <rect x="118" y="12" width="140" height="34" />
            <KeyMark x={126} y={29} />
            <text x="158" y="24" className="t sub">
              public key
            </text>
            <text x="158" y="40" className="n">
              {encryptShown}
            </text>
          </g>
          <g className={`op ${phase === 'decrypt' ? 'now' : unlockOn ? 'past' : ''}`}>
            <path className="msg" pathLength={1} d="M376 83 H524" />
            <path className="head" d="M516 78 L525 83 L516 88" />
            <rect x="380" y="12" width="140" height="34" />
            <KeyMark x={388} y={29} secret />
            <text x="420" y="24" className="t sub">
              private key
            </text>
            <text x="420" y="40" className="n">
              {decryptShown}
            </text>
          </g>

          <g
            className="move packet"
            style={{
              transform: `translateX(${phase === 'keys' ? 0 : phase === 'encrypt' ? 262 : 524}px)`,
            }}
          >
            <rect x="52" y="124" width="12" height="12" />
          </g>
        </svg>
      </div>
      <figcaption>
        <b>Figure 2.1.</b> {label}
      </figcaption>
    </figure>
  );
}
