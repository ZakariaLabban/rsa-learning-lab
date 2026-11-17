import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { journeyPhase, type Station } from './model';

type Point = { x: number; y: number };
const stops = [0, 8, 20, 40, 62, 74, 92, 100];
function position(points: Point[], value: number): Point {
  if (!points.length) return { x: 0, y: 0 };
  let i = 0;
  while (i < stops.length - 2 && value > stops[i + 1]) i++;
  const p = Math.max(0, Math.min(1, (value - stops[i]) / (stops[i + 1] - stops[i])));
  return {
    x: points[i].x + (points[i + 1].x - points[i].x) * p,
    y: points[i].y + (points[i + 1].y - points[i].y) * p,
  };
}

function Machine({
  privateKey,
  output,
  spin,
}: {
  privateKey?: boolean;
  output: string;
  spin: number;
}) {
  return (
    <span
      className={`machine ${privateKey ? 'machine-private' : 'machine-public'}`}
      style={{ '--spin': `${spin}deg` } as CSSProperties}
    >
      <span className="machine-cap">
        <span className="bolt" />
        <span>RSA / {privateKey ? 'D' : 'E'}</span>
        <span className="bolt" />
      </span>
      <span className="cartridge">
        <span className="cartridge-notch" />
        {privateKey ? 'PRIVATE' : 'PUBLIC'} KEY <b>{privateKey ? '23' : '7'} · 187</b>
      </span>
      <span className="machine-dial">
        <span className="rotor" />
        <span className="dial-center">
          <small>POWER</small>
          <b>{privateKey ? '23' : '7'}</b>
        </span>
      </span>
      <span className="machine-output">
        <span>OUT</span>
        <b>{output}</b>
        <span className="machine-light" />
      </span>
      <span className="machine-foot left" />
      <span className="machine-foot right" />
    </span>
  );
}

export function WorkshopScene({
  progress,
  playing,
  reduced,
  message,
  ciphertext,
  wire,
  recovered,
  altered,
  selected,
  onInspect,
  onReduce,
}: {
  progress: number;
  playing: boolean;
  reduced: boolean;
  message: bigint;
  ciphertext: bigint;
  wire: bigint;
  recovered: bigint;
  altered: boolean;
  selected: Station;
  onInspect: (station: Station) => void;
  onReduce: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  useLayoutEffect(() => {
    const scene = ref.current;
    if (!scene) return;
    const measure = () => {
      const rect = scene.getBoundingClientRect();
      const point = (selector: string) => {
        const item = scene.querySelector(selector)!.getBoundingClientRect();
        return {
          x: item.left - rect.left + item.width / 2,
          y: item.top - rect.top + item.height / 2,
        };
      };
      const a = point('.terminal-screen'),
        b = point('.machine-public .machine-dial'),
        d = point('.machine-private .machine-dial'),
        e = point('.inbox-body');
      const mobile = matchMedia('(max-width: 580px)').matches;
      const wireY = mobile ? 356 : rect.height - 95;
      const next = [
        a,
        { x: a.x + (mobile ? 0 : 10), y: a.y - 36 },
        { x: b.x, y: b.y - 23 },
        { x: b.x, y: wireY },
        { x: d.x, y: wireY + (mobile ? 30 : 0) },
        { x: d.x, y: d.y - 23 },
        { x: e.x, y: e.y - 80 },
        e,
      ];
      setPoints((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(scene);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  const phase = journeyPhase(progress);
  const packet = position(points, reduced ? [0, 24, 50, 74, 100][phase] : progress);
  const cipher = progress >= 39 && progress < 87;
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  const station = (name: Station) => `station ${name} ${selected === name ? 'is-selected' : ''}`;
  const style = {
    '--dash': -progress * 7,
    '--flow-opacity': playing && !reduced ? 0.6 : 0,
    '--receipt-y': `${58 - 58 * Math.max(0, Math.min(1, (progress - 87) / 13))}px`,
    '--receipt-opacity': progress >= 87 ? 1 : 0.18,
  } as CSSProperties;
  return (
    <div className="workbench" ref={ref} style={style} aria-label="Animated RSA workshop">
      <div className="floor" aria-hidden="true" />
      <div className="scene-topline">
        <span>
          <span className="live-dot" />A message’s journey
        </span>
        <button className="quiet" aria-pressed={reduced} onClick={onReduce}>
          Reduce motion
        </button>
      </div>
      <svg className="wires" aria-hidden="true">
        <path className="wire-shadow" d={path} />
        <path className="wire-base" d={path} />
        <path className="wire-current" d={path} />
      </svg>
      <div className="stations">
        <button
          className={station('sender')}
          onClick={() => onInspect('sender')}
          aria-label="Inspect Alice’s message"
        >
          <span className="station-label">01 / ALICE</span>
          <span className="terminal">
            <span className="terminal-top">
              OUTBOX <span>●</span>
            </span>
            <span className="terminal-screen">
              <span className="small-label">MESSAGE</span>
              <strong>{String(message)}</strong>
              <span className="screen-caret" />
            </span>
            <span className="terminal-base">
              {[0, 1, 2, 3, 4].map((n) => (
                <span key={n} />
              ))}
            </span>
          </span>
          <span className="station-name">Make a message</span>
          <span className="station-sub">It starts in the open.</span>
        </button>
        <button
          className={station('encrypt')}
          onClick={() => onInspect('encrypt')}
          aria-label="Open the encryption machine"
        >
          <span className="station-label">02 / ENCRYPT</span>
          <Machine
            output={String(ciphertext)}
            spin={reduced ? 0 : Math.max(0, Math.min(1, (progress - 16) / 23)) * 1080}
          />
          <span className="station-name">Lock the meaning</span>
          <span className="station-sub">Anyone can use this key.</span>
        </button>
        <button
          className={station('decrypt')}
          onClick={() => onInspect('decrypt')}
          aria-label="Open the decryption machine"
        >
          <span className="station-label">04 / DECRYPT</span>
          <Machine
            privateKey
            output={String(recovered)}
            spin={reduced ? 0 : Math.max(0, Math.min(1, (progress - 64) / 23)) * -1440}
          />
          <span className="station-name">Bring it back</span>
          <span className="station-sub">Bob holds the private key.</span>
        </button>
        <button
          className={station('receiver')}
          onClick={() => onInspect('receiver')}
          aria-label="Inspect Bob’s received message"
        >
          <span className="station-label">05 / BOB</span>
          <span className="inbox">
            <span className="receipt">
              <span>DELIVERED TO BOB</span>
              <strong>{String(recovered)}</strong>
              <span className="receipt-rule" />
              <span className="receipt-status">
                {altered ? 'MESSAGE CHANGED' : 'MATCHES ORIGINAL'}
              </span>
            </span>
            <span className="inbox-slot" />
            <span className="inbox-body">
              <span>INBOX</span>
              <span className="inbox-light" />
            </span>
          </span>
          <span className="station-name">Read the secret</span>
          <span className="station-sub">
            {altered ? 'The wire changed the message.' : 'Same message. Full circle.'}
          </span>
        </button>
      </div>
      <button
        className={`eve ${selected === 'eve' ? 'is-selected' : ''}`}
        onClick={() => onInspect('eve')}
        aria-label="Inspect what Eve can intercept"
      >
        <span className="eve-eye" aria-hidden="true">
          <span />
        </span>
        <span>
          <b>EVE’S VIEW</b>
          <span>Intercept the wire</span>
        </span>
        <span className="eve-value">{String(wire)}</span>
      </button>
      <div
        className={`packet ${cipher ? 'cipher' : ''}`}
        aria-hidden="true"
        style={
          {
            left: packet.x,
            top: packet.y,
            opacity: progress > 96 ? (100 - progress) / 4 : 1,
            '--tilt': reduced ? '0deg' : `${cipher ? Math.sin(progress * 0.5) * 8 : -5}deg`,
          } as CSSProperties
        }
      >
        <span className="packet-label">{cipher ? 'CIPHERTEXT' : 'MESSAGE'}</span>
        <strong>{String(progress >= 87 ? recovered : cipher ? wire : message)}</strong>
        <span className="packet-fold" />
      </div>
      {[0, 1, 2].map((i) => {
        const p = position(points, (progress + i * 5 + 13) % 100);
        return (
          <div
            key={i}
            className="signal"
            aria-hidden="true"
            style={{
              left: p.x,
              top: p.y,
              opacity: playing && !reduced && progress > 4 && progress < 94 ? 0.6 : 0,
            }}
          />
        );
      })}
      <span className="wire-label">03 / THE PUBLIC WIRE</span>
    </div>
  );
}
