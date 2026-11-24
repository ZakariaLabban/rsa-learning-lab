import { useLocation } from 'react-router-dom';
import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { clauseNumber } from './lessons';
import type { PowerResult } from './model';
import { WORDS, type WordKey } from './words';

// Keep reference notes in their own column instead of floating them out of the article.
export function LessonArticle({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const isNote = (child: ReactNode) =>
    isValidElement(child) &&
    (child.type === UsedFor || child.type === SlideRef || child.type === Words);
  const notes = items.filter(isNote);
  return (
    <article className="lesson-article">
      <div className="lesson-content">{items.filter((child) => !isNote(child))}</div>
      {notes.length > 0 && (
        <aside className="lesson-notes" aria-label="Lesson reference">
          <h2 className="notes-title">Lesson reference</h2>
          {notes}
        </aside>
      )}
    </article>
  );
}

// minus sign like in the slides
export const fmt = (value: bigint | number) => String(value).replace('-', '−');

export function Pow({ base, exp }: { base: ReactNode; exp: ReactNode }) {
  return (
    <span className="pow">
      {base}
      <sup>{exp}</sup>
    </span>
  );
}

export function Num({ children }: { children: ReactNode }) {
  return <span className="num">{children}</span>;
}

// shows a calculation one step at a time
export function useSteps(total: number, initial = 1) {
  const [shown, setShown] = useState(Math.min(initial, total));
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    if (shown >= total) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setShown((s) => Math.min(total, s + 1)), 1600);
    return () => clearTimeout(timer);
  }, [playing, shown, total]);
  const clamped = Math.min(shown, total);
  return {
    shown: clamped,
    total,
    playing,
    done: clamped >= total,
    next: () => setShown((s) => Math.min(total, s + 1)),
    back: () => {
      setPlaying(false);
      setShown((s) => Math.max(1, s - 1));
    },
    all: () => {
      setPlaying(false);
      setShown(total);
    },
    reset: () => {
      setPlaying(false);
      setShown(Math.min(initial, total));
    },
    play: () => {
      if (shown >= total) setShown(Math.min(initial, total));
      setPlaying(true);
    },
    pause: () => setPlaying(false),
  };
}

export function StepControls({
  steps,
  label = 'Step',
}: {
  steps: ReturnType<typeof useSteps>;
  label?: string;
}) {
  const dense = steps.total > 16;
  return (
    <div className="controls steps-bar" role="group" aria-label="Step controls">
      <button
        type="button"
        className="primary big"
        data-guide="next"
        onClick={steps.done ? undefined : steps.next}
        aria-disabled={steps.done}
      >
        {steps.done ? 'Finished' : 'Next step →'}
      </button>
      <button type="button" className="back" onClick={steps.back} disabled={steps.shown <= 1}>
        ← Back
      </button>
      <span className="counter" aria-live="polite">
        {label} {steps.shown} of {steps.total}
      </span>
      <span className={`ticks ${dense ? 'dense' : ''}`} aria-hidden="true">
        {Array.from({ length: steps.total }, (_, index) => (
          <i
            key={index}
            className={index + 1 < steps.shown ? 'done' : index + 1 === steps.shown ? 'here' : ''}
          />
        ))}
      </span>
      <span className="more-controls">
        {steps.playing ? (
          <button type="button" className="quiet" onClick={steps.pause}>
            Pause
          </button>
        ) : (
          <button type="button" className="quiet" onClick={steps.play} disabled={steps.total <= 1}>
            Play slowly
          </button>
        )}
        <button type="button" className="quiet" onClick={steps.all} disabled={steps.done}>
          Show all
        </button>
        <button type="button" className="quiet" onClick={steps.reset} disabled={steps.shown <= 1}>
          Start over
        </button>
      </span>
    </div>
  );
}

// section you can open or close
export function Collapse({
  title,
  children,
  open = false,
  className = '',
}: {
  title: ReactNode;
  children: ReactNode;
  open?: boolean;
  className?: string;
}) {
  return (
    <details className={`collapse ${className}`} open={open}>
      <summary>{title}</summary>
      <div className="collapse-body">{children}</div>
    </details>
  );
}

// which slides this topic comes from
export function SlideRef({ children }: { children: ReactNode }) {
  return (
    <p className="slide-ref">
      <strong>In the lecture:</strong> {children}
    </p>
  );
}

// short summary at the top of a page
export function Idea({ children }: { children: ReactNode }) {
  return (
    <aside className="idea" aria-label="Summary">
      {children}
    </aside>
  );
}

// page title with its number
export function LessonHeader({ title }: { title: string }) {
  const { pathname } = useLocation();
  const clause = clauseNumber(pathname.replace(/\/$/, '').toLowerCase());
  return (
    <header>
      <h1>
        {clause && (
          <span className="clause-no" aria-hidden="true">
            {clause}
          </span>
        )}
        {title}
      </h1>
    </header>
  );
}

export type ProcedureLine = { text: ReactNode; depth?: number };

// the algorithm from the slides, with numbered lines.
// the lines used by the current step get highlighted
export function Procedure({
  id,
  name,
  input,
  output,
  lines,
  active,
}: {
  id: string;
  name: string;
  input?: ReactNode;
  output?: ReactNode;
  lines: ProcedureLine[];
  // line numbers in use now (start at 1)
  active: number[];
}) {
  return (
    <section className="procedure" aria-label={`Procedure: ${name}`}>
      <header>
        <span className="id">{id}</span>
        {name}
      </header>
      {(input || output) && (
        <dl>
          {input && (
            <div>
              <dt>Input</dt>
              <dd>{input}</dd>
            </div>
          )}
          {output && (
            <div>
              <dt>Output</dt>
              <dd>{output}</dd>
            </div>
          )}
        </dl>
      )}
      <ol>
        {lines.map((line, index) => {
          const on = active.includes(index + 1);
          return (
            <li key={index} className={on ? 'on' : ''} aria-current={on ? 'step' : undefined}>
              <span className="mark" aria-hidden="true" />
              <span className="n">{index + 1}</span>
              <span className="body" style={{ ['--depth' as string]: line.depth ?? 0 }}>
                {line.text}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function Field({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <small>{hint}</small>}
    </div>
  );
}

// the numbers the lesson uses. closed by default when there is a summary,
// closes again after calculating, stays open on an error
export function InputForm({
  children,
  onSubmit,
  onExample,
  error,
  submitLabel = 'Calculate',
  summary,
  startOpen = false,
}: {
  children: ReactNode;
  onSubmit: () => void;
  onExample?: () => void;
  error: string;
  submitLabel?: string | null;
  summary?: ReactNode;
  startOpen?: boolean;
}) {
  const foldable = summary !== undefined;
  const [open, setOpen] = useState(!foldable || startOpen);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (tick > 0 && foldable && !error) setOpen(false);
    // only run on a new submit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
    setTick((value) => value + 1);
  };
  if (!open)
    return (
      <div className="numbers-bar" data-guide="numbers">
        <span className="using">
          <small>Numbers used</small>
          {summary}
        </span>
        <button type="button" onClick={() => setOpen(true)}>
          Change the numbers
        </button>
      </div>
    );
  return (
    <form className="inputs" data-guide="numbers" onSubmit={submit} noValidate>
      <div className="fields">{children}</div>
      <div className="controls">
        {submitLabel !== null && (
          <button type="submit" className="primary">
            {submitLabel}
          </button>
        )}
        {onExample && (
          <button
            type="button"
            onClick={() => {
              onExample();
              setTick((value) => value + 1);
            }}
          >
            Use the lecture example
          </button>
        )}
        {foldable && (
          <button type="button" className="quiet" onClick={() => setOpen(false)}>
            Close
          </button>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

// why this lesson matters for RSA
export function UsedFor({ children }: { children: ReactNode }) {
  return (
    <p className="used-for">
      <strong>Why you need it:</strong> {children}
    </p>
  );
}

// list of the words used in the lesson
export function Words({ terms }: { terms: WordKey[] }) {
  return (
    <Collapse title="Words you need" className="words">
      <dl>
        {terms.map((key) => (
          <div key={key}>
            <dt>{WORDS[key].term}</dt>
            <dd>{WORDS[key].meaning}</dd>
          </div>
        ))}
      </dl>
    </Collapse>
  );
}

// by-hand method: square and reduce, then multiply the ones needed.
// shown = how many steps are visible
export function handSteps(run: PowerResult) {
  return run.squares.length + run.products.length;
}

export function HandMethod({ run, shown = Infinity }: { run: PowerResult; shown?: number }) {
  const { base, n, exponent, squares, needed, products } = run;
  const visibleSquares = Math.min(squares.length, shown);
  const visibleProducts = Math.max(0, Math.min(products.length, shown - squares.length));
  const finished = shown >= handSteps(run);
  const parts = needed.map((j) => squares[j].power);
  return (
    <div className="hand">
      <p>
        <b>Split the exponent into powers of 2.</b> {fmt(exponent)} ={' '}
        <Num>{parts.map(fmt).join(' + ')}</Num>.
      </p>
      <p>
        <b>Square, then simplify (mod {fmt(n)}), again and again:</b>
      </p>
      <ol className="lines">
        {squares.slice(0, visibleSquares).map((s, index) => (
          <li key={s.j} className={index === visibleSquares - 1 && !finished ? 'current' : ''}>
            {s.raw === null ? (
              <>
                <Pow base={fmt(run.a)} exp="1" /> mod {fmt(n)} = <strong>{fmt(s.value)}</strong>
              </>
            ) : (
              <>
                <Pow base={fmt(run.a)} exp={fmt(s.power)} /> = ({fmt(squares[s.j - 1].value)})
                <sup>2</sup> = {fmt(s.raw)}, and {fmt(s.raw)} mod {fmt(n)} ={' '}
                <strong>{fmt(s.value)}</strong>
              </>
            )}
            {needed.includes(s.j) && <span className="tag">needed</span>}
          </li>
        ))}
      </ol>
      {products.length > 0 && visibleSquares === squares.length && (
        <>
          <p>
            <b>Multiply the needed powers, simplifying each time:</b>
          </p>
          <ol className="lines">
            {products.slice(0, visibleProducts).map((p, index) => (
              <li
                key={p.power.toString()}
                className={index === visibleProducts - 1 && !finished ? 'current' : ''}
              >
                {fmt(p.left)} × {fmt(p.right)} = {fmt(p.raw)}, and {fmt(p.raw)} mod {fmt(n)} ={' '}
                <strong>{fmt(p.value)}</strong>
                <span className="tag">
                  = <Pow base={fmt(run.a)} exp={fmt(p.power)} />
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      {finished && (
        <p className="result">
          <Pow base={fmt(run.a)} exp={fmt(exponent)} /> mod {fmt(n)} ={' '}
          <strong>{fmt(run.result)}</strong>
          {run.a !== base && (
            <small>
              {' '}
              (the base {fmt(run.a)} was first reduced to {fmt(base)} mod {fmt(n)})
            </small>
          )}
        </p>
      )}
    </div>
  );
}

// copy button, tells you if the clipboard is blocked
export function CopyText({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setState('done');
          setTimeout(() => setState('idle'), 1500);
        } catch {
          setState('failed');
        }
      }}
    >
      {state === 'done' ? 'Copied ✓' : state === 'failed' ? 'Select the text and copy it' : label}
    </button>
  );
}

// tabs, arrow keys / Home / End move between them
export function TabList<T extends string>({
  id,
  label,
  items,
  value,
  onChange,
  className = '',
}: {
  id: string;
  label: string;
  items: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = items.length - 1;
    const target =
      event.key === 'ArrowRight'
        ? (index + 1) % items.length
        : event.key === 'ArrowLeft'
          ? (index + last) % items.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : -1;
    if (target < 0) return;
    event.preventDefault();
    onChange(items[target].id);
    refs.current[items[target].id]?.focus();
  }
  return (
    <div className={`tabs ${className}`} role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={(node) => {
            refs.current[item.id] = node;
          }}
          role="tab"
          type="button"
          id={`${id}-tab-${item.id}`}
          aria-controls={`${id}-panel`}
          aria-selected={value === item.id}
          tabIndex={value === item.id ? 0 : -1}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// content of the selected tab
export function TabPanel({
  id,
  value,
  children,
}: {
  id: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${value}`}>
      {children}
    </div>
  );
}

// check your answer box. a wrong answer gives a hint, not the number
export function CheckAnswer({
  id,
  question,
  answer,
  wrongHint,
}: {
  id: string;
  question: ReactNode;
  answer: bigint;
  wrongHint: string;
}) {
  const [text, setText] = useState('');
  const [verdict, setVerdict] = useState<'none' | 'right' | 'wrong' | 'empty'>('none');
  const check = () => {
    const clean = text.trim();
    if (!/^-?\d+$/.test(clean)) return setVerdict('empty');
    setVerdict(BigInt(clean) === answer ? 'right' : 'wrong');
  };
  return (
    <form
      className="check-answer"
      onSubmit={(event) => {
        event.preventDefault();
        check();
      }}
    >
      <label htmlFor={id}>
        <strong>Check your answer.</strong> {question}
      </label>
      <div className="check-row">
        <input
          id={id}
          value={text}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setText(event.target.value);
            setVerdict('none');
          }}
        />
        <button type="submit">Check</button>
      </div>
      <p className={`check-result ${verdict}`} role="status">
        {verdict === 'right' && 'Correct. That matches the table.'}
        {verdict === 'wrong' && wrongHint}
        {verdict === 'empty' && 'Type a whole number first.'}
      </p>
    </form>
  );
}
