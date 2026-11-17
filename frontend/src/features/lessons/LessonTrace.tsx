import { useCallback, useState, type CSSProperties } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { usePlayback } from '../workshop/usePlayback';
import { useLessonExperience } from './LessonExperience';
import type { TraceFrame } from './traceTypes';

function TracePlayer({
  frames,
  title,
  onStep,
}: {
  frames: TraceFrame[];
  title: string;
  onStep?: (index: number) => void;
}) {
  const { mode, speed, setSpeed, reduced, toggleMotion } = useLessonExperience();
  const [playback, setPlayback] = useState({ index: 0, time: 0, playing: false, single: false });
  const advance = useCallback(
    (delta: number) =>
      setPlayback((old) => {
        if (!old.playing) return old;
        const time = old.time + delta / 3000;
        if (old.single && time >= 1) return { ...old, time: 1, playing: false };
        if (time >= 1.35)
          return old.index < frames.length - 1
            ? { ...old, index: old.index + 1, time: 0 }
            : { ...old, time: 1, playing: false };
        return { ...old, time };
      }),
    [frames.length],
  );
  usePlayback(playback.playing, speed, advance);
  const index = Math.min(playback.index, frames.length - 1),
    step = frames[index];
  const raw = Math.min(1, playback.time),
    p = reduced ? Math.floor(raw * 4) / 4 : raw;
  const phase = p < 0.3 ? 0 : p < 0.65 ? 1 : p < 0.9 ? 2 : 3;
  const compact = (value: string) =>
    value.length > 50 ? `${value.slice(0, 26)}…${value.slice(-16)}` : value;
  const select = (next: number) => {
    setPlayback({ index: next, time: 0, playing: false, single: false });
    onStep?.(next);
  };
  function play(single: boolean) {
    setPlayback((old) => {
      const next = old.time >= 1 ? (old.index >= frames.length - 1 ? 0 : old.index + 1) : old.index;
      return { index: next, time: old.time >= 1 ? 0 : old.time, playing: true, single };
    });
  }
  const reduction = step.reduction,
    quotient = reduction ? reduction.product / reduction.modulus : 0n;
  const remainder = reduction ? reduction.product % reduction.modulus : 0n;
  const messages = [
    `Feed the inputs into ${step.operation}.`,
    step.equation ?? `Apply ${step.operation}.`,
    reduction
      ? `Remove ${quotient} whole groups of ${reduction.modulus}; keep ${remainder}.`
      : 'Move the computed value into the output register.',
    `${step.output.label}: ${step.output.value}`,
  ];
  return (
    <section
      className="lesson-machine"
      aria-label={`${title} animation`}
      style={
        {
          '--lesson-progress': p,
          '--lesson-travel': Math.min(1, p / 0.3),
          '--lesson-spin': reduced ? '0deg' : `${p * 360}deg`,
          '--lesson-output': p < 0.65 ? 0.15 : 1,
        } as CSSProperties
      }
    >
      <header>
        <div>
          <span className="eyebrow">INSIDE THE LESSON</span>
          <h2>{title}</h2>
        </div>
        <span className="lesson-machine-count">
          {index + 1} / {frames.length}
        </span>
      </header>
      <div className="lesson-operation-label">
        <strong>{step.title}</strong>
        <button className="quiet" aria-pressed={reduced} onClick={toggleMotion}>
          Reduce motion
        </button>
      </div>
      <div
        className={`lesson-apparatus ${reduced ? 'reduced' : ''}`}
        aria-label="Inputs flow through an operation into its output"
      >
        <div className="lesson-input-bay">
          {step.inputs.map((input, i) => (
            <div key={i} className="lesson-number-token">
              <span>{input.label}</span>
              <strong>{compact(input.value)}</strong>
            </div>
          ))}
        </div>
        <div className="lesson-connector" aria-hidden="true">
          <span />
        </div>
        <div className="lesson-core">
          <span className="lesson-gear" aria-hidden="true" />
          <span>{step.operation}</span>
        </div>
        <div className="lesson-connector output" aria-hidden="true">
          <span />
        </div>
        <div className="lesson-output-register">
          <span>{step.output.label}</span>
          <strong>{p < 0.65 ? '…' : compact(step.output.value)}</strong>
        </div>
        <div className="lesson-moving-value" aria-hidden="true">
          {phase < 2 ? compact(step.inputs[0]?.value ?? '') : compact(step.output.value)}
        </div>
      </div>
      {step.equation && <div className="lesson-equation">{step.equation}</div>}
      {reduction && (
        <div className="lesson-remainder-filter">
          <span>REMAINDER FILTER</span>
          <p>
            {String(reduction.product)} = {String(quotient)} × {String(reduction.modulus)} +{' '}
            <strong>{String(remainder)}</strong>
          </p>
          <div aria-hidden="true">
            {Array.from({ length: Number(quotient > 4n ? 4n : quotient) }, (_, i) => (
              <span key={i}>{String(reduction.modulus)}</span>
            ))}
            <em>{String(quotient)} groups removed</em>
          </div>
        </div>
      )}
      <p className="lesson-step-detail">{step.detail}</p>
      <p className="lesson-phase-status" aria-live="polite">
        {compact(messages[phase])}
      </p>
      <div className="lesson-playback">
        <button
          className="action lesson-main-play"
          onClick={() =>
            playback.playing ? setPlayback((old) => ({ ...old, playing: false })) : play(false)
          }
        >
          {playback.playing ? <Pause size={15} /> : <Play size={15} />}{' '}
          {playback.playing
            ? 'Pause animation'
            : index === frames.length - 1 && raw === 1
              ? 'Replay animation'
              : 'Play animation'}
        </button>
        <button
          className="action"
          disabled={index === 0 && raw === 0}
          onClick={() => select(raw > 0 ? index : Math.max(0, index - 1))}
        >
          Previous calculation
        </button>
        <button
          className="action"
          disabled={playback.playing || (index === frames.length - 1 && raw === 1)}
          onClick={() => play(true)}
        >
          Next calculation
        </button>
        <button className="action" aria-label="Restart calculations" onClick={() => select(0)}>
          <RotateCcw size={15} />
        </button>
        <label>
          Speed
          <select
            aria-label="Animation speed"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
          </select>
        </label>
      </div>
      <label className="lesson-scrubber">
        Inside this calculation{' '}
        <input
          aria-label="Calculation progress"
          type="range"
          min="0"
          max="1"
          step=".01"
          value={raw}
          onChange={(e) =>
            setPlayback((old) => ({ ...old, time: Number(e.target.value), playing: false }))
          }
        />
      </label>
      <details className="lesson-trace-map" open={mode === 'explore'}>
        <summary>{mode === 'explore' ? 'Explore any calculation' : 'Choose a calculation'}</summary>
        <nav aria-label="Calculation map">
          {frames.map((s, i) => (
            <button
              key={i}
              aria-current={i === index ? 'step' : undefined}
              onClick={() => select(i)}
            >
              <span>{i + 1}</span>
              {s.title}
            </button>
          ))}
        </nav>
      </details>
      <details className="lesson-exact-values">
        <summary>Inspect exact values</summary>
        <dl>
          {[...step.inputs, step.output].map((value, i) => (
            <div key={i}>
              <dt>{value.label}</dt>
              <dd>{value.value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

/** All computation lives in lesson/engine models. This player only renders their actual trace. */
export function LessonTrace({
  frames,
  title,
  resetKey,
  onStep,
}: {
  frames: TraceFrame[];
  title: string;
  resetKey: string;
  onStep?: (index: number) => void;
}) {
  const { enabled } = useLessonExperience();
  if (!enabled || !frames.length) return null;
  const shown =
    frames.length > 128
      ? [
          ...frames.slice(0, 127),
          {
            ...frames.at(-1)!,
            title: 'Final result (middle steps omitted)',
            detail: `${frames.length - 128} intermediate calculations are omitted from this bounded animation. The engine completed the full computation. ${frames.at(-1)!.detail}`,
          },
        ]
      : frames;
  return <TracePlayer key={resetKey} frames={shown} title={title} onStep={onStep} />;
}
