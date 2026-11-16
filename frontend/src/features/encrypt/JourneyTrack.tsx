import { motion, useReducedMotion } from 'motion/react';
import {
  Braces,
  ChevronRight,
  Fingerprint,
  LockKeyhole,
  MessageSquare,
  UnlockKeyhole,
} from 'lucide-react';
import type { JourneyStep } from './model';

const ICONS = {
  MESSAGE: MessageSquare,
  PADDING: Braces,
  BLOCKS: Braces,
  ENCRYPT: LockKeyhole,
  CIPHERTEXT: Fingerprint,
  ENVELOPE: Fingerprint,
  DECRYPT: UnlockKeyhole,
} as const;
/** Short formulas that fit the small stage cards; the full formula is in the step detail. */
const TAGS: Record<string, string> = {
  MESSAGE: 'M',
  PADDING: 'EM',
  BLOCKS: 'm₁ … mₖ',
  ENCRYPT: 'Mᵉ mod n',
  CIPHERTEXT: 'C',
  ENVELOPE: 'C',
  DECRYPT: 'Cᵈ mod n',
};

/** The message-journey strip (reuses the original Workbench styling) for the current run. */
export function JourneyTrack({
  steps,
  step,
  onSelect,
}: {
  steps: JourneyStep[];
  step: number;
  onSelect: (index: number) => void;
}) {
  const reduced = useReducedMotion();
  return (
    <div className="journey-canvas journey-track">
      <div className="journey-stages">
        {steps.map((s, i) => {
          const Icon = ICONS[s.short as keyof typeof ICONS] ?? Braces;
          return (
            <div className="stage-wrap" key={`${s.short}-${i}`}>
              <button
                className={`journey-stage ${i === step ? 'current' : ''} ${i <= step ? 'completed' : ''} ${s.who === 'Alice' ? 'private-stage' : ''}`}
                onClick={() => onSelect(i)}
                aria-label={`Show step ${i + 1}: ${s.title}`}
                aria-current={i === step ? 'step' : undefined}
              >
                <span className="stage-index mono">0{i + 1}</span>
                <span className="stage-icon">
                  <Icon size={25} strokeWidth={1.4} />
                </span>
                <span className="stage-short">{s.short}</span>
                <span className="stage-formula mono">{TAGS[s.short] ?? s.formula}</span>
                {i === step && <motion.span layoutId="journey-dot" className="active-dot" />}
              </button>
              <strong className={i === step ? 'stage-label active-label' : 'stage-label'}>
                {s.who === 'Wire' ? 'On the wire' : s.who}
              </strong>
              {i < steps.length - 1 && (
                <div className={`stage-connector ${step > i ? 'lit' : ''}`}>
                  <span />
                  <ChevronRight size={12} />
                  {step === i + 1 && !reduced && (
                    <motion.div
                      className="travelling-packet"
                      initial={{ left: 0, opacity: 0 }}
                      animate={{ left: '85%', opacity: [0, 1, 0] }}
                      transition={{ duration: 0.6 }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
