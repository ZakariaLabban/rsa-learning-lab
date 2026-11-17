import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { machineTrace, teachingKey, type MachineKind } from './model';
import { usePlayback } from './usePlayback';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
type Playback = {
  index: number;
  elapsed: number;
  playing: boolean;
  single: boolean;
  done: boolean;
};

export function MachineCutaway({
  kind,
  base,
  automatic,
  reduced,
  speed,
  onSpeed,
  onClose,
  onContinue,
}: {
  kind: MachineKind;
  base: bigint;
  automatic: boolean;
  reduced: boolean;
  speed: number;
  onSpeed: (speed: number) => void;
  onClose: () => void;
  onContinue: () => void;
}) {
  const exponent = kind === 'encrypt' ? teachingKey.e : teachingKey.d;
  const steps = useMemo(() => machineTrace(base, exponent), [base, exponent]);
  const [playback, setPlayback] = useState<Playback>({
    index: 0,
    elapsed: 0,
    playing: automatic,
    single: false,
    done: false,
  });
  const [followJourney, setFollowJourney] = useState(automatic);
  const heading = useRef<HTMLHeadingElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const operandA = useRef<HTMLDivElement>(null);
  const operandB = useRef<HTMLDivElement>(null);
  const [travel, setTravel] = useState({ a: 0, b: 0 });
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  useLayoutEffect(() => {
    const element = track.current;
    const a = operandA.current,
      b = operandB.current;
    if (!element || !a || !b) return;
    const measure = () =>
      setTravel({
        a: element.clientWidth / 2 - a.offsetLeft - a.offsetWidth / 2,
        b: b.offsetLeft + b.offsetWidth / 2 - element.clientWidth / 2,
      });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(a);
    observer.observe(b);
    measure();
    return () => observer.disconnect();
  }, []);
  const advance = useCallback(
    (delta: number) =>
      setPlayback((old) => {
        if (!old.playing) return old;
        const elapsed = old.elapsed + delta / 3200;
        if (old.single && elapsed >= 1) return { ...old, elapsed: 1, playing: false };
        if (elapsed >= 1.28)
          return old.index < steps.length - 1
            ? { ...old, index: old.index + 1, elapsed: 0 }
            : { ...old, elapsed: 1, playing: false, done: true };
        return { ...old, elapsed };
      }),
    [steps.length],
  );
  usePlayback(playback.playing, speed, advance);
  useEffect(() => {
    if (playback.done && followJourney) onContinue();
  }, [playback.done, followJourney, onContinue]);
  const step = steps[playback.index];
  const rawP = clamp(playback.elapsed);
  const p = reduced ? Math.floor(rawP * 4) / 4 : rawP;
  const product = clamp((p - 0.22) / 0.12),
    reduce = clamp((p - 0.48) / 0.25);
  const finished = playback.index === steps.length - 1 && rawP === 1;
  const phase = p < 0.25 ? 0 : p < 0.5 ? 1 : p < 0.8 ? 2 : p < 0.92 ? 3 : 4;
  const status = [
    `Bring ${step.a} and ${step.b} into the multiplier.`,
    `Multiply: ${step.a} × ${step.b} = ${step.product}.`,
    `Remove ${step.quotient} complete groups of 187 (${step.quotient * 187n}).`,
    `Keep ${step.remainder}, the remainder.`,
    finished
      ? `Finished. The machine outputs ${step.remainder}.`
      : `Store ${step.remainder}. It becomes the running result for the next calculation.`,
  ][phase];
  const style = {
    '--operand-move': `${travel.a * clamp(p / 0.25)}px`,
    '--operand-b-move': `${travel.b * clamp(p / 0.25)}px`,
    '--operand-scale': 1 - clamp(p / 0.25) * 0.45,
    '--operand-opacity': 1 - product,
    '--product-opacity': product * (1 - clamp((p - 0.62) / 0.16)),
    '--product-scale': 0.6 + product * 0.4,
    '--product-y': reduced ? '0px' : `${clamp((p - 0.4) / 0.3) * 65}px`,
    '--calc-spin': reduced ? '0deg' : `${p * 360}deg`,
    '--groups-opacity': reduce * (1 - clamp((p - 0.72) / 0.16) * 0.7),
    '--groups-x': reduced ? '0px' : `${-clamp((p - 0.7) / 0.2) * 18}px`,
    '--remainder-opacity': 0.18 + clamp((p - 0.68) / 0.18) * 0.82,
    '--remainder-scale': 0.9 + clamp((p - 0.68) / 0.18) * 0.1,
  } as CSSProperties;
  function play(single: boolean) {
    setFollowJourney(false);
    setPlayback((old) => {
      const index =
        old.elapsed >= 1 ? (old.index === steps.length - 1 ? 0 : old.index + 1) : old.index;
      return {
        index,
        elapsed: old.elapsed >= 1 ? 0 : old.elapsed,
        playing: true,
        single,
        done: false,
      };
    });
  }
  function jump(index: number) {
    setFollowJourney(false);
    setPlayback({ index, elapsed: 0, playing: false, single: false, done: false });
  }
  const bits = exponent.toString(2);
  return (
    <div className="workbench cutaway-open">
      <section className="cutaway" aria-label="Inside the RSA machine" style={style}>
        <div className="cutaway-head">
          <div>
            <span className="eyebrow">
              INSIDE / {kind === 'encrypt' ? 'ENCRYPTION' : 'DECRYPTION'}
            </span>
            <h2 ref={heading} tabIndex={-1}>
              Small steps. Real machinery.
            </h2>
          </div>
          <button className="action" onClick={onClose}>
            Back to workshop
          </button>
        </div>
        <div className="exponent-tape">
          <span className="exponent-expression">
            {String(base)}
            <sup>{String(exponent)}</sup> mod 187
          </span>
          <div>
            <span className="bit-caption">
              {String(exponent)} = {bits}₂ · read left to right
            </span>
            <div className="bit-tape" aria-label={`Exponent bits ${bits}, read from left to right`}>
              {[...bits].map((bit, i) => (
                <span
                  className={`bit ${i === step.bitIndex ? 'active' : i < step.bitIndex ? 'done' : ''}`}
                  key={i}
                >
                  <b>{bit}</b>
                  <span>{2 ** (bits.length - i - 1)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mechanism">
          <div className="machine-instruction">
            <strong>
              {step.type.toUpperCase()} / BIT {step.bitIndex + 1} IS {step.bit}
            </strong>
            <span aria-label="Calculation count">
              {playback.index + 1} / {steps.length}
            </span>
          </div>
          <div className="calculation-track" ref={track} aria-hidden="true">
            <div className="operand" ref={operandA}>
              <span>RUNNING RESULT</span>
              <strong>{String(step.a)}</strong>
            </div>
            <div className="multiply-chamber">
              <span className="chamber-teeth" />×
            </div>
            <div className="operand operand-b" ref={operandB}>
              <span>{step.type === 'Square' ? 'SAME RESULT' : 'ORIGINAL INPUT'}</span>
              <strong>{String(step.b)}</strong>
            </div>
            <div className="product-token">{String(step.product)}</div>
          </div>
          <div className="arithmetic-line">
            {String(step.a)} × {String(step.b)}
            {p >= 0.25 && ` = ${step.product}`}
          </div>
          <div className="reducer">
            <div>
              <div className="reducer-label">REMAINDER FILTER / MOD 187</div>
              <div className="division-line" style={{ opacity: p < 0.5 ? 0.18 : 1 }}>
                <span>{String(step.product)}</span>
                <span>=</span>
                <span>{String(step.quotient)} × 187</span>
                <span>+</span>
                <strong>{String(step.remainder)}</strong>
              </div>
              <div className="discard-groups" aria-hidden="true">
                {Array.from({ length: Number(step.quotient > 4n ? 4n : step.quotient) }, (_, i) => (
                  <span key={i}>187</span>
                ))}
                <span className="group-note">
                  {step.quotient === 0n
                    ? 'No complete groups to remove.'
                    : `${step.quotient} groups total · remove ${step.quotient * 187n}`}
                </span>
              </div>
            </div>
            <div className="remainder-pocket">
              <span>KEEP THE REMAINDER</span>
              <strong>{p < 0.8 ? '?' : String(step.remainder)}</strong>
            </div>
          </div>
          <div className="register-row">
            <p className="step-explanation">
              {step.type === 'Square'
                ? `Square the running result to double its exponent. ${step.bit === 0 ? 'This bit is 0, so skip the extra multiplication.' : 'This bit is 1, so multiply by the original input next.'}`
                : 'This bit is 1: multiply by the original input to add one to the exponent.'}
            </p>
            <div className="result-register">
              <span>
                RUNNING
                <br />
                RESULT
              </span>
              <strong data-testid="running-result">
                {String(p >= 0.92 ? step.remainder : step.a)}
              </strong>
            </div>
          </div>
        </div>
        <div className="calc-status" aria-live="polite">
          {status}
        </div>
        <div className="calc-controls">
          <button
            className="action calc-play"
            onClick={() => {
              if (playback.playing) {
                setFollowJourney(false);
                setPlayback((old) => ({ ...old, playing: false }));
              } else play(false);
            }}
          >
            {playback.playing
              ? 'Pause calculations'
              : finished
                ? 'Replay calculations'
                : 'Play calculations'}
          </button>
          <button
            className="action"
            disabled={playback.index === 0 && playback.elapsed === 0}
            onClick={() =>
              jump(playback.elapsed > 0 ? playback.index : Math.max(0, playback.index - 1))
            }
          >
            Previous
          </button>
          <button
            className="action"
            disabled={playback.playing || finished}
            onClick={() => play(true)}
          >
            Next step
          </button>
          <label className="speed">
            Speed
            <select
              aria-label="Calculation speed"
              value={speed}
              onChange={(e) => onSpeed(Number(e.target.value))}
            >
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
          </label>
        </div>
        <div className="step-rail" aria-label="Calculation steps">
          {steps.map((s, i) => (
            <button
              key={i}
              aria-label={`Calculation ${i + 1}: ${s.type}, bit ${s.bitIndex + 1}`}
              aria-current={i === playback.index ? 'step' : undefined}
              className={i < playback.index || (i === playback.index && rawP === 1) ? 'done' : ''}
              onClick={() => jump(i)}
            >
              <span>{i + 1}</span>
              {s.type}
            </button>
          ))}
        </div>
        {finished && (
          <div className="calc-finish">
            <span>
              {kind === 'encrypt' ? 'Ciphertext' : 'Recovered message'} = {String(step.remainder)}
            </span>
            <button className="action" onClick={onContinue}>
              Continue journey
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
