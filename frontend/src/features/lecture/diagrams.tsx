import { StepControls, useSteps } from './parts';

/* ───────────── small drawing pieces ───────────── */

function Key({
  x,
  y,
  kind,
  label,
}: {
  x: number;
  y: number;
  kind: 'public' | 'private';
  label: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`} className={`art-key ${kind}`}>
      <circle cx="0" cy="0" r="12" />
      <circle cx="0" cy="0" r="4" className="hole" />
      <path d="M12 0 H58 M46 0 V12 M56 0 V9" />
      <text x="28" y="34" textAnchor="middle" className="art-label">
        {label}
      </text>
    </g>
  );
}

function Padlock({ locked }: { locked: boolean }) {
  return (
    <g className="art-padlock" style={{ opacity: locked ? 1 : 0.25 }}>
      <path
        d={locked ? 'M-9 -2 V-9 a9 9 0 0 1 18 0 V-2' : 'M-9 -2 V-9 a9 9 0 0 1 18 0 V-14'}
        className="shackle"
      />
      <rect x="-14" y="-3" width="28" height="22" rx="4" className="body" />
      <circle cx="0" cy="8" r="3" className="hole" />
    </g>
  );
}

function Person({ x, name, tone }: { x: number; name: string; tone: 'alice' | 'bob' | 'eve' }) {
  return (
    <g transform={`translate(${x} 0)`} className={`art-person ${tone}`}>
      <circle cx="0" cy="268" r="26" />
      <path d="M-44 352 a44 44 0 0 1 88 0 Z" />
      <text x="0" y="380" textAnchor="middle" className="art-name">
        {name}
      </text>
    </g>
  );
}

/* ───────────── the big picture: five steps ───────────── */

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
    text: 'She puts her message in a box and locks it with Bob’s public key. Now nobody can read it, not even Alice.',
  },
  {
    title: 'The locked box travels',
    text: 'Eve sees the box go by. She has the public key, but not Bob’s private key, so she cannot open it.',
  },
  {
    title: 'Bob unlocks it',
    text: 'Bob opens the box with his private key, which only he has. The message arrives. This is RSA.',
  },
] as const;

export function BigPicture() {
  const steps = useSteps(CAPTIONS.length);
  const s = steps.shown - 1; // 0 … 4
  const locked = s >= 2 && s < 4;
  const hasMessage = s >= 2;
  const box = [
    { x: 150, y: 200 },
    { x: 150, y: 200 },
    { x: 150, y: 200 },
    { x: 410, y: 200 },
    { x: 670, y: 200 },
  ][s];
  const caption = CAPTIONS[s];
  return (
    <div className="art-wrap">
      <svg
        className="art bigpicture"
        viewBox="0 0 820 400"
        role="img"
        aria-label={`Step ${s + 1} of 5: ${caption.title}. ${caption.text}`}
      >
        <line x1="110" y1="236" x2="710" y2="236" className="art-wire" />
        <Person x={110} name="Alice" tone="alice" />
        <Person x={710} name="Bob" tone="bob" />
        <Person x={410} name="Eve (attacker)" tone="eve" />

        {/* Bob's keys */}
        <g style={{ opacity: 1 }}>
          <Key x={620} y={90} kind="public" label="public key" />
        </g>
        <g
          className="move"
          style={{
            transform: s >= 4 ? 'translate(-135px, 150px)' : 'translate(0, 0)',
          }}
        >
          <Key x={690} y={30} kind="private" label="private key (secret)" />
        </g>

        {/* the public key travels to Alice and Eve */}
        <g
          className="move"
          style={{
            transform: s >= 1 ? 'translate(-470px, 0)' : 'translate(0, 0)',
            opacity: s >= 1 ? 1 : 0,
          }}
        >
          <Key x={620} y={90} kind="public" label="Alice’s copy" />
        </g>
        <g
          className="move"
          style={{
            transform: s >= 1 ? 'translate(-320px, 210px)' : 'translate(0, 0)',
            opacity: s >= 1 ? 0.9 : 0,
          }}
        >
          <Key x={620} y={90} kind="public" label="Eve’s copy" />
        </g>

        {/* the box with the message */}
        <g
          className="move"
          style={{
            transform: `translate(${box.x}px, ${box.y}px)`,
            opacity: hasMessage ? 1 : 0,
          }}
        >
          <rect x="-46" y="-34" width="92" height="68" rx="10" className="art-box" />
          <text
            x="0"
            y="6"
            textAnchor="middle"
            className="art-msg"
            style={{ opacity: locked ? 0 : 1 }}
          >
            “Hi Bob”
          </text>
          <text
            x="0"
            y="6"
            textAnchor="middle"
            className="art-msg scrambled"
            style={{ opacity: locked ? 1 : 0 }}
          >
            q7#x9!
          </text>
          <g transform="translate(0 -34)" className="move" style={{ opacity: hasMessage ? 1 : 0 }}>
            <Padlock locked={locked} />
          </g>
        </g>

        {/* Eve cannot open it */}
        <g className="move" style={{ opacity: s === 3 ? 1 : 0 }}>
          <text x="410" y="132" textAnchor="middle" className="art-no">
            ✗ no private key
          </text>
        </g>
      </svg>
      <div className="explain" aria-live="polite">
        <p>
          <b>
            {steps.shown} · {caption.title}
          </b>
        </p>
        <p>{caption.text}</p>
      </div>
      <StepControls steps={steps} label="Picture" />
    </div>
  );
}

/* ───────────── the RSA flow: M → C → M ───────────── */

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
  const at = phase === 'keys' ? 100 : phase === 'encrypt' ? 410 : 720;
  const shown = phase === 'encrypt' ? c : m;
  const label =
    phase === 'keys'
      ? 'The message M is ready to be sent.'
      : phase === 'encrypt'
        ? `Locking: C = M^e mod n turns ${m} into ${c}.`
        : `Unlocking: M = C^d mod n turns ${c} back into ${m}.`;
  return (
    <svg className="art rsaflow" viewBox="0 0 820 200" role="img" aria-label={label}>
      <rect x="40" y="62" width="120" height="76" rx="14" className="art-token" />
      <text x="100" y="86" textAnchor="middle" className="art-small">
        message M
      </text>
      <text x="100" y="118" textAnchor="middle" className="art-big">
        {m}
      </text>

      <rect
        x="350"
        y="62"
        width="120"
        height="76"
        rx="14"
        className="art-token"
        style={{ opacity: phase === 'keys' ? 0.35 : 1 }}
      />
      <text x="410" y="86" textAnchor="middle" className="art-small">
        ciphertext C
      </text>
      <text
        x="410"
        y="118"
        textAnchor="middle"
        className="art-big"
        style={{ opacity: phase === 'keys' ? 0.35 : 1 }}
      >
        {c}
      </text>

      <rect
        x="660"
        y="62"
        width="120"
        height="76"
        rx="14"
        className="art-token"
        style={{ opacity: phase === 'decrypt' ? 1 : 0.35 }}
      />
      <text x="720" y="86" textAnchor="middle" className="art-small">
        message M
      </text>
      <text
        x="720"
        y="118"
        textAnchor="middle"
        className="art-big"
        style={{ opacity: phase === 'decrypt' ? 1 : 0.35 }}
      >
        {m}
      </text>

      <g className={`art-machine ${phase === 'encrypt' ? 'on' : ''}`}>
        <path d="M165 100 H345" className="art-arrow" />
        <path d="M335 92 L347 100 L335 108" className="art-arrow" />
        <rect x="170" y="14" width="170" height="56" rx="12" />
        <text x="255" y="35" textAnchor="middle" className="art-small">
          lock · public key
        </text>
        <text x="255" y="58" textAnchor="middle" className="art-formula">
          M^{e} mod {n}
        </text>
      </g>
      <g className={`art-machine ${phase === 'decrypt' ? 'on' : ''}`}>
        <path d="M475 100 H655" className="art-arrow" />
        <path d="M645 92 L657 100 L645 108" className="art-arrow" />
        <rect x="480" y="14" width="170" height="56" rx="12" />
        <text x="565" y="35" textAnchor="middle" className="art-small">
          unlock · private key
        </text>
        <text x="565" y="58" textAnchor="middle" className="art-formula">
          C^{d} mod {n}
        </text>
      </g>

      <g className="art-packet move" style={{ transform: `translate(${at}px, 168px)` }}>
        <circle r="17" />
        <text y="5" textAnchor="middle">
          {shown.length > 4 ? '…' : shown}
        </text>
      </g>
    </svg>
  );
}
