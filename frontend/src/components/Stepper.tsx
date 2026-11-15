import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

export function Stepper({
  step,
  count,
  onChange,
  label = 'Calculation steps',
}: {
  step: number;
  count: number;
  onChange: (step: number) => void;
  label?: string;
}) {
  const [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!playing || reduced || step >= count - 1) return;
    const timer = setTimeout(() => onChange(step + 1), 1200 / speed);
    return () => clearTimeout(timer);
  }, [playing, reduced, step, count, speed, onChange]);
  const isPlaying = playing && !reduced && step < count - 1;
  const select = (value: number) => {
    setPlaying(false);
    onChange(Math.max(0, Math.min(count - 1, value)));
  };
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        className="icon-button"
        aria-label="Previous step"
        disabled={step <= 0}
        onClick={() => select(step - 1)}
      >
        <ChevronLeft size={18} />
      </button>
      <span className="mono" aria-live="polite">
        {step + 1} / {count}
      </span>
      <button
        className="icon-button"
        aria-label="Next step"
        disabled={step >= count - 1}
        onClick={() => select(step + 1)}
      >
        <ChevronRight size={18} />
      </button>
      {!reduced && (
        <>
          <button
            className="secondary-button"
            onClick={() => {
              if (step >= count - 1) onChange(0);
              setPlaying(!isPlaying);
            }}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />} {isPlaying ? 'Pause' : 'Play'}
          </button>
          <label>
            Speed{' '}
            <select
              aria-label="Playback speed"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
            </select>
          </label>
        </>
      )}
      <button className="text-button" onClick={() => select(count - 1)}>
        Show result
      </button>
    </div>
  );
}
